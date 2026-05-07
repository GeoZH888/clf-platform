// netlify/functions/send-notification.js
// Multi-channel notification sender
// Supports: Email (SendGrid/SMTP), SMS (Twilio/Aliyun)

const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { channel, title, content, audience } = body;

  // ── EMAIL ─────────────────────────────────────────────────────────────
  if (channel === 'email') {
    const SENDGRID_KEY = process.env.SENDGRID_API_KEY;
    const FROM_EMAIL   = process.env.NOTIFICATION_FROM_EMAIL || 'noreply@davidchinese.com';

    if (!SENDGRID_KEY) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          message: '邮件服务未配置 — 请在 Netlify 添加 SENDGRID_API_KEY 环境变量',
        }),
      };
    }

    // Get recipients from Supabase
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    let query = supabase.from('users').select('email,name').not('email','is',null).eq('is_active',true);
    if (audience === 'parents')  query = query.eq('role','parent');
    if (audience === 'students') query = query.eq('role','student');
    if (audience === 'teachers') query = query.eq('role','teacher');

    const { data: users } = await query.limit(500);
    const recipients = (users||[]).filter(u => u.email);

    if (recipients.length === 0) {
      return { statusCode:200, body: JSON.stringify({ success:false, message:'没有找到收件人邮箱' }) };
    }

    // SendGrid batch send
    const personalizations = recipients.map(u => ({
      to: [{ email: u.email, name: u.name || '' }],
      subject: title,
    }));

    try {
      const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: personalizations.slice(0, 100), // SendGrid limit
          from: { email: FROM_EMAIL, name: '大卫学中文' },
          content: [
            { type: 'text/plain', value: content },
            { type: 'text/html',  value: `
              <div style="font-family:'Noto Sans SC',sans-serif;max-width:600px;margin:0 auto;padding:20px">
                <div style="background:#c41e3a;color:#fff;padding:20px;border-radius:10px 10px 0 0;text-align:center">
                  <h2 style="margin:0">🐼 大卫学中文</h2>
                </div>
                <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 10px 10px">
                  <h3 style="color:#c41e3a">${title}</h3>
                  <p style="line-height:1.8;color:#374151">${content.replace(/\n/g,'<br>')}</p>
                  <hr style="border:none;border-top:1px solid #e5e7eb">
                  <p style="font-size:12px;color:#9ca3af">大卫学中文 · 如有疑问请联系学校</p>
                </div>
              </div>` },
          ],
        }),
      });

      if (sgRes.ok || sgRes.status === 202) {
        return { statusCode:200, body: JSON.stringify({ success:true, count:recipients.length }) };
      } else {
        const errText = await sgRes.text();
        return { statusCode:200, body: JSON.stringify({ success:false, message:`SendGrid错误: ${errText.slice(0,100)}` }) };
      }
    } catch(e) {
      return { statusCode:200, body: JSON.stringify({ success:false, message:e.message }) };
    }
  }

  // ── SMS ───────────────────────────────────────────────────────────────
  if (channel === 'sms') {
    const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID;
    const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
    const TWILIO_FROM  = process.env.TWILIO_FROM_NUMBER;

    // Alternative: Aliyun SMS
    const ALIYUN_KEY    = process.env.ALIYUN_SMS_ACCESS_KEY;
    const ALIYUN_SECRET = process.env.ALIYUN_SMS_ACCESS_SECRET;
    const ALIYUN_SIGN   = process.env.ALIYUN_SMS_SIGN_NAME || '大卫学中文';
    const ALIYUN_TPL    = process.env.ALIYUN_SMS_TEMPLATE_CODE;

    const hasTwilio = TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM;
    const hasAliyun = ALIYUN_KEY && ALIYUN_SECRET && ALIYUN_TPL;

    if (!hasTwilio && !hasAliyun) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          message: '短信服务未配置 — 请在 Netlify 添加 Twilio 或阿里云 SMS 环境变量\n' +
                   'Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER\n' +
                   '阿里云: ALIYUN_SMS_ACCESS_KEY, ALIYUN_SMS_ACCESS_SECRET, ALIYUN_SMS_TEMPLATE_CODE',
        }),
      };
    }

    // Get phone numbers from Supabase
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    let query = supabase.from('users').select('phone,name').not('phone','is',null).eq('is_active',true);
    if (audience === 'parents')  query = query.eq('role','parent');
    if (audience === 'students') query = query.eq('role','student');
    if (audience === 'teachers') query = query.eq('role','teacher');

    const { data: users } = await query.limit(200);
    const recipients = (users||[]).filter(u => u.phone);

    if (recipients.length === 0) {
      return { statusCode:200, body: JSON.stringify({ success:false, message:'没有找到手机号码' }) };
    }

    const smsText = `【大卫学中文】${title}: ${content}`.slice(0, 140);
    let sent = 0, failed = 0;

    // Use Twilio
    if (hasTwilio) {
      for (const u of recipients.slice(0, 50)) { // limit to 50 per call
        try {
          const res = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({ From: TWILIO_FROM, To: u.phone, Body: smsText }),
            }
          );
          if (res.ok) sent++; else failed++;
        } catch { failed++; }
      }
      return {
        statusCode: 200,
        body: JSON.stringify({ success: sent > 0, count: sent, failed, message: `发送成功: ${sent}, 失败: ${failed}` }),
      };
    }

    // Fallback: Aliyun (simplified — real impl needs signature)
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: false,
        message: '阿里云短信签名验证需要后端实现，建议使用 Twilio 进行快速配置',
      }),
    };
  }

  return { statusCode:400, body: JSON.stringify({ error: 'Unknown channel' }) };
};

module.exports = { handler };
