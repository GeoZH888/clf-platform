// src/components/UsagePaywall.jsx
//
// Shown when an unpaid device has spent its free minutes for the day.
//
// Prices come from clf_tiers rather than being written here, so the superadmin
// changes them in one place and this screen follows. Both currencies are always
// shown: the audience is split between Europe and China and neither should have
// to convert.
//
// There is no "buy" button yet — payment is not wired up. Pretending otherwise
// would be worse than saying plainly how to get access.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const C = {
  bg: 'linear-gradient(160deg, #fdf6e3 0%, #f5e6c8 50%, #f0d9b5 100%)',
  card: '#fff', border: '#e8d5b0', ink: '#1a0a05', ink2: '#6b4c2a',
  ink3: '#a07850', accent: '#8B4513',
};

const eur = cents => `€${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
const cny = fen   => `¥${Math.round(fen / 100)}`;

export default function UsagePaywall({ limitMinutes, lang = 'zh', onLogin }) {
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it || en) : en;
  const [tiers, setTiers] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('clf_tiers')
        .select('slug, label_zh, label_en, label_it, description, price_eur_cents, price_cny_fen, max_seats')
        .not('price_eur_cents', 'is', null)
        .order('sort_order', { ascending: true });
      setTiers(data || []);
    })();
  }, []);

  const label = tr => lang === 'zh' ? tr.label_zh
                    : lang === 'it' ? (tr.label_it || tr.label_en)
                    : tr.label_en;

  return (
    <div style={{
      minHeight: '100dvh', background: C.bg, color: C.ink,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{ maxWidth: 460, width: '100%' }}>
        <div style={{
          background: C.card, border: `1.5px solid ${C.border}`,
          borderRadius: 18, padding: '22px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⏳</div>
          <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 6 }}>
            {t('今天的免费时间用完了', "Today's free time is up", 'Tempo gratuito esaurito')}
          </div>
          <div style={{ fontSize: 13, color: C.ink2, lineHeight: 1.6 }}>
            {t(
              `免费体验每天 ${limitMinutes} 分钟,明天会重新开始。`,
              `The free trial is ${limitMinutes} minutes a day, and it starts again tomorrow.`,
              `La prova gratuita è di ${limitMinutes} minuti al giorno e ricomincia domani.`
            )}
          </div>

          {onLogin && (
            <button onClick={onLogin} style={{
              marginTop: 16, width: '100%', padding: '12px',
              borderRadius: 12, border: 'none', cursor: 'pointer',
              background: C.accent, color: '#fdf6e3',
              fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
            }}>
              {t('已有账号,登录', 'I have an account — log in', 'Ho un account — accedi')}
            </button>
          )}
          <div style={{ fontSize: 11, color: C.ink3, marginTop: 8 }}>
            {t('付费账号没有时间限制',
               'Paid accounts have no time limit',
               'Gli account a pagamento non hanno limiti')}
          </div>
        </div>

        {tiers.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tiers.map(tier => (
              <div key={tier.slug} style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {label(tier)}
                    {tier.max_seats > 1 && (
                      <span style={{ fontSize: 11, color: C.ink3, fontWeight: 400 }}>
                        {' '}· {tier.max_seats} {t('个账号', 'accounts', 'account')}
                      </span>
                    )}
                  </div>
                  {tier.description && (
                    <div style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>
                      {tier.description}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.accent }}>
                    {eur(tier.price_eur_cents)}
                  </div>
                  <div style={{ fontSize: 12, color: C.ink3 }}>
                    {cny(tier.price_cny_fen)} / {t('月', 'mo', 'mese')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 11, color: C.ink3, textAlign: 'center', marginTop: 14, lineHeight: 1.6 }}>
          {t('账号由管理员开通 — 请联系老师或管理员。',
             'Accounts are created by an administrator — please contact your teacher.',
             'Gli account sono creati da un amministratore — contatta il tuo insegnante.')}
        </div>
      </div>
    </div>
  );
}
