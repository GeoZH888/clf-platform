// src/heritage/HeritageApp.jsx
// 非遗 / Heritage — fully PUBLIC (no auth required). Phase 2.A of the build plan.
// Routes:
//   /feiyi/             → category grid
//   /feiyi/<slug>       → category detail (articles list, "coming soon" if empty)
//
// Data lives in:
//   clf_feiyi_categories  (RLS: anon SELECT where is_active = true)
//   clf_feiyi_articles    (RLS: anon SELECT where is_published = true)
// See supabase/migrations/006_feiyi_content.sql.
//
// Fallback behavior: if the categories query fails (e.g. DB down, RLS
// misconfigured), the UI degrades to a hardcoded 4-category list so the
// public site never goes blank. Articles fall back to a "coming soon" pane.

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

// Hardcoded fallback in case the DB query fails. Matches the seed rows
// in migration 006 — keep in sync if the seed ever changes.
const FALLBACK_CATEGORIES = [
  { slug:'folklore',  name_zh:'民俗故事', name_en:'Folklore',  name_it:'Folclore',
    description_zh:'传统民间传说', description_en:'Traditional folk tales', description_it:'Racconti popolari',
    icon:'俗', color:'#a0522d', sort_order: 1 },
  { slug:'opera',     name_zh:'传统戏曲', name_en:'Opera',     name_it:'Opera',
    description_zh:'昆曲、京剧、各地戏种', description_en:'Kunqu, Beijing opera, regional styles', description_it:'Kunqu, opera di Pechino',
    icon:'戏', color:'#c41e3a', sort_order: 2 },
  { slug:'crafts',    name_zh:'民间工艺', name_en:'Crafts',    name_it:'Artigianato',
    description_zh:'剪纸、刺绣、陶瓷', description_en:'Paper-cutting, embroidery, ceramics', description_it:'Carta tagliata, ricamo',
    icon:'工', color:'#8b4513', sort_order: 3 },
  { slug:'festivals', name_zh:'节庆文化', name_en:'Festivals', name_it:'Feste',
    description_zh:'传统节日与仪式', description_en:'Traditional festivals & rituals', description_it:'Feste e rituali',
    icon:'庆', color:'#d4a017', sort_order: 4 },
];

const LANG_KEY = 'david_feiyi_lang';

function useLang() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem(LANG_KEY) || 'zh'; }
    catch { return 'zh'; }
  });
  useEffect(() => {
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
  }, [lang]);
  return [lang, setLang];
}

// Pull localized field, falling back to zh if the requested lang is missing.
function t(row, base, lang) {
  return row[`${base}_${lang}`] || row[`${base}_zh`] || '';
}

export default function HeritageApp() {
  return (
    <BrowserRouter basename="/feiyi">
      <Routes>
        <Route path="/" element={<HeritageHome />} />
        <Route path=":slug" element={<CategoryPage />} />
        <Route path="*" element={<HeritageHome />} />
      </Routes>
    </BrowserRouter>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Header (shared by home + category pages)
// ──────────────────────────────────────────────────────────────────────
function Header({ lang, setLang, title_override }) {
  return (
    <header style={{
      padding: '20px 24px',
      background: 'linear-gradient(90deg, #a0522d 0%, #8b4513 100%)',
      color: '#fff5e6',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700,
          fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 6 }}>
          {title_override || (lang === 'zh' ? '非遗' : lang === 'en' ? 'Heritage' : 'Patrimonio')}
        </div>
        <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
          {lang === 'zh' ? '中华非物质文化遗产'
            : lang === 'en' ? 'Chinese Intangible Cultural Heritage'
            : 'Patrimonio culturale immateriale cinese'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {['zh', 'en', 'it'].map(l => (
          <button key={l} onClick={() => setLang(l)} style={{
            padding: '5px 11px', borderRadius: 14,
            background: lang === l ? '#fff5e6' : 'rgba(255,255,255,0.15)',
            color: lang === l ? '#a0522d' : '#fff5e6',
            border: '1px solid rgba(255,255,255,0.3)',
            cursor: 'pointer', fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase',
          }}>{l}</button>
        ))}
        <a href="/" style={{
          padding: '5px 11px', borderRadius: 14,
          background: 'rgba(255,255,255,0.15)', color: '#fff5e6',
          border: '1px solid rgba(255,255,255,0.3)',
          textDecoration: 'none',
          cursor: 'pointer', fontSize: 11, fontWeight: 600, marginLeft: 4,
        }}>
          {lang === 'zh' ? '首页' : 'Home'}
        </a>
      </div>
    </header>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Home: category grid
// ──────────────────────────────────────────────────────────────────────
function HeritageHome() {
  const [lang, setLang] = useLang();
  const navigate = useNavigate();
  const [categories, setCategories] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase.from('clf_feiyi_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data || data.length === 0) {
          // RLS issue, network issue, or empty table — fall back to hardcoded.
          if (error) console.warn('[Heritage] categories query failed:', error.message);
          setCategories(FALLBACK_CATEGORIES);
        } else {
          setCategories(data);
        }
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #fdf6e3 0%, #f5e6c8 50%, #f0d9b5 100%)',
      color: '#1a0a05',
    }}>
      <Header lang={lang} setLang={setLang} />

      <main style={{ padding: '24px 20px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          background: '#fff',
          border: '1px solid #e8d5b0',
          borderRadius: 14, padding: 16, marginBottom: 20,
          fontSize: 13, color: '#5d4630', lineHeight: 1.7,
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
        }}>
          {lang === 'zh' && '非物质文化遗产是人类口口相传、代代相承的生活智慧与艺术形式。这里收集中华传统文化中的多个主题，供所有人自由浏览学习。'}
          {lang === 'en' && 'Intangible cultural heritage represents living traditions transmitted through generations. This collection introduces themes from Chinese tradition, freely available to all.'}
          {lang === 'it' && 'Il patrimonio culturale immateriale rappresenta tradizioni viventi tramandate per generazioni. Questa raccolta presenta temi della tradizione cinese, gratuita per tutti.'}
        </div>

        <SectionLabel color="#a0522d" label={lang === 'zh' ? '主题' : lang === 'en' ? 'Themes' : 'Temi'}/>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
        }}>
          {(categories || []).map(c => (
            <CategoryTile key={c.slug} cat={c} lang={lang} onClick={() => navigate(`/${c.slug}`)} />
          ))}
        </div>

        <div style={{
          textAlign: 'center', marginTop: 40, fontSize: 11, color: '#a07850',
        }}>
          {lang === 'zh' && '公益资源 · 免费开放 · 无需注册'}
          {lang === 'en' && 'Public resource · Free · No registration'}
          {lang === 'it' && 'Risorsa pubblica · Gratuita · Nessuna registrazione'}
        </div>
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Category detail: list of published articles, or "coming soon" pane
// ──────────────────────────────────────────────────────────────────────
function CategoryPage() {
  const { slug } = useParams();
  const [lang, setLang] = useLang();
  const [cat, setCat] = useState(null);
  const [articles, setArticles] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // Category metadata — graceful fallback to the hardcoded list.
    supabase.from('clf_feiyi_categories')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (data) setCat(data);
        else setCat(FALLBACK_CATEGORIES.find(c => c.slug === slug) || null);
        if (error) console.warn('[Heritage] category fetch failed:', error.message);
      });
    // Published articles for this category, newest first.
    supabase.from('clf_feiyi_articles')
      .select('id, title_zh, title_en, title_it, cover_image_url, published_at')
      .eq('category_slug', slug)
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn('[Heritage] articles fetch failed:', error.message);
        setArticles(data || []);
      });
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #fdf6e3 0%, #f5e6c8 50%, #f0d9b5 100%)',
      color: '#1a0a05',
    }}>
      <Header lang={lang} setLang={setLang} title_override={cat ? t(cat, 'name', lang) : '...'} />

      <main style={{ padding: '24px 20px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 16 }}>
          <Link to="/" style={{
            color: '#a0522d', fontSize: 12, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            ← {lang === 'zh' ? '所有主题' : lang === 'en' ? 'All themes' : 'Tutti i temi'}
          </Link>
        </div>

        {cat && (
          <div style={{
            background: '#fff', border: `1.5px solid ${cat.color}40`,
            borderLeft: `5px solid ${cat.color}`,
            borderRadius: 14, padding: 18, marginBottom: 24,
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              fontSize: 20, fontWeight: 700, color: cat.color,
              fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2,
              marginBottom: 6,
            }}>{t(cat, 'name', lang)}</div>
            <div style={{ fontSize: 13, color: '#5d4630', lineHeight: 1.7 }}>
              {t(cat, 'description', lang)}
            </div>
          </div>
        )}

        {articles === null && <Loading/>}

        {articles && articles.length === 0 && <ComingSoon lang={lang}/>}

        {articles && articles.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 14,
          }}>
            {articles.map(a => <ArticleCard key={a.id} article={a} lang={lang} catColor={cat?.color || '#a0522d'}/>)}
          </div>
        )}
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Reusable bits
// ──────────────────────────────────────────────────────────────────────
function SectionLabel({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
      <div style={{ flex: 1, height: 1,
        background: `linear-gradient(to right, transparent, ${color}66)` }}/>
      <div style={{ fontSize: 12, color, fontWeight: 700, letterSpacing: 4 }}>{label}</div>
      <div style={{ flex: 1, height: 1,
        background: `linear-gradient(to left, transparent, ${color}66)` }}/>
    </div>
  );
}

function Loading() {
  return <div style={{ textAlign: 'center', padding: 40, color: '#a07850', opacity: 0.6 }}>···</div>;
}

function ComingSoon({ lang }) {
  return (
    <div style={{
      background: '#fff', border: '1px dashed #e8d5b0',
      borderRadius: 14, padding: '40px 20px', textAlign: 'center',
      color: '#a07850',
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📖</div>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {lang === 'zh' && '内容正在筹备中，欢迎稍后再来浏览。'}
        {lang === 'en' && 'Content is being prepared — please check back soon.'}
        {lang === 'it' && 'Contenuti in preparazione — torna a trovarci presto.'}
      </div>
    </div>
  );
}

function CategoryTile({ cat, lang, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        border: `1.5px solid ${hovered ? cat.color : '#e8d5b0'}`,
        borderRadius: 14, padding: '18px 12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered
          ? `0 10px 24px ${cat.color}30`
          : '0 2px 6px rgba(0,0,0,0.04)',
        textAlign: 'center',
        color: '#1a0a05',
      }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: `${cat.color}15`,
        border: `1.5px solid ${cat.color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 800, color: cat.color,
        fontFamily: "'STKaiti','KaiTi',serif",
        margin: '0 auto 10px',
      }}>
        {cat.icon}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4,
        fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 1 }}>
        {t(cat, 'name', lang)}
      </div>
      <div style={{ fontSize: 10, color: '#8b6f47', lineHeight: 1.4 }}>
        {t(cat, 'description', lang)}
      </div>
    </button>
  );
}

function ArticleCard({ article, lang, catColor }) {
  const title = article[`title_${lang}`] || article.title_zh;
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => alert(title + ' · 详情页面建设中…')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff', border: `1.5px solid ${hovered ? catColor : '#e8d5b0'}`,
        borderRadius: 14, padding: 0, overflow: 'hidden',
        cursor: 'pointer', textAlign: 'left',
        transition: 'all 0.2s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? `0 10px 24px ${catColor}30` : '0 2px 6px rgba(0,0,0,0.04)',
      }}>
      {article.cover_image_url && (
        <div style={{
          width: '100%', height: 140,
          background: `url(${article.cover_image_url}) center/cover, ${catColor}15`,
        }}/>
      )}
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a0a05',
          fontFamily: "'STKaiti','KaiTi',serif", lineHeight: 1.3 }}>
          {title}
        </div>
        {article.published_at && (
          <div style={{ fontSize: 10, color: '#a07850', marginTop: 6 }}>
            {new Date(article.published_at).toLocaleDateString()}
          </div>
        )}
      </div>
    </button>
  );
}
