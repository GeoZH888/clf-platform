// netlify/functions/teacher-ai-status.js
// Poll this to get background job result
// GET /.netlify/functions/teacher-ai-status?id=xxx

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  const job_id = event.queryStringParameters?.id;
  if (!job_id) return { statusCode:400, headers, body: JSON.stringify({ error:'Missing id' }) };

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY
    );

    const { data, error } = await supabase
      .from('ai_jobs')
      .select('id, status, result, created_at, updated_at')
      .eq('id', job_id)
      .single();

    if (error || !data) return { statusCode:404, headers, body: JSON.stringify({ status:'not_found' }) };

    return { statusCode:200, headers, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode:500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
