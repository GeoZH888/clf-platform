import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

// Default data - defined outside component
const defaultChengyu = [
  { id: 1, chengyu: '一石二鸟', pinyin: 'yī shí èr niǎo', literal: 'One stone, two birds', meaning_zh: '一举两得', meaning_en: 'Kill two birds with one stone', meaning_it: 'Prendere due piccioni con una fava', story: '猎人用一块石头打下两只鸟。', story_en: 'A hunter killed two birds with one stone.', category: 'strategy', hsk_level: 4, example: '学中文能交朋友又能找工作，一石二鸟。', example_en: 'Learning Chinese helps make friends and find jobs.' },
  { id: 2, chengyu: '画龙点睛', pinyin: 'huà lóng diǎn jīng', literal: 'Paint dragon, dot eyes', meaning_zh: '在关键处加上精辟的话', meaning_en: 'Add the finishing touch', meaning_it: 'Aggiungere il tocco finale', story: '画家张僧繇画龙点睛后龙飞走了。', story_en: "Painter Zhang's dragons flew away after he dotted their eyes.", category: 'art', hsk_level: 5, example: '文章结尾画龙点睛。', example_en: 'The ending adds the finishing touch.' },
  { id: 3, chengyu: '守株待兔', pinyin: 'shǒu zhū dài tù', literal: 'Guard stump, wait for rabbit', meaning_zh: '不努力而等待意外收获', meaning_en: 'Wait for gains without effort', meaning_it: 'Aspettare senza sforzo', story: '农夫等兔子再撞树桩。', story_en: 'A farmer waited for rabbits to hit a stump again.', category: 'fable', hsk_level: 4, example: '不能守株待兔。', example_en: "Don't wait for luck." },
  { id: 4, chengyu: '亡羊补牢', pinyin: 'wáng yáng bǔ láo', literal: 'Lose sheep, mend pen', meaning_zh: '及时补救', meaning_en: 'Better late than never', meaning_it: 'Meglio tardi che mai', story: '牧羊人丢羊后修羊圈。', story_en: 'A shepherd fixed his pen after losing sheep.', category: 'fable', hsk_level: 3, example: '亡羊补牢，为时未晚。', example_en: "It's not too late." },
  { id: 5, chengyu: '对牛弹琴', pinyin: 'duì niú tán qín', literal: 'Play lute to cow', meaning_zh: '对外行讲内行话', meaning_en: 'Cast pearls before swine', meaning_it: 'Parlare al muro', story: '音乐家对牛弹琴。', story_en: 'A musician played to a cow.', category: 'communication', hsk_level: 4, example: '跟他讲物理是对牛弹琴。', example_en: 'Explaining physics to him is useless.' },
  { id: 6, chengyu: '入乡随俗', pinyin: 'rù xiāng suí sú', literal: 'Enter village, follow customs', meaning_zh: '按当地习俗办事', meaning_en: 'When in Rome, do as Romans do', meaning_it: 'Paese che vai, usanza che trovi', story: '尊重当地文化。', story_en: 'Respect local culture.', category: 'culture', hsk_level: 3, example: '在中国用筷子吃饭。', example_en: 'Use chopsticks in China.' }
];

const defaultVideos = [
  { id: 1, title_zh: '中国春节习俗', title_en: 'Chinese New Year', title_it: 'Capodanno Cinese', thumbnail: '🧧', duration: '8:32', category: 'festivals', description_zh: '最重要的节日', description_en: 'Most important festival', video_url: '', views: 12500 },
  { id: 2, title_zh: '中国茶文化', title_en: 'Tea Culture', title_it: 'Cultura del Tè', thumbnail: '🍵', duration: '10:15', category: 'lifestyle', description_zh: '茶道艺术', description_en: 'Art of tea', video_url: '', views: 8900 },
  { id: 3, title_zh: '中国书法', title_en: 'Calligraphy', title_it: 'Calligrafia', thumbnail: '🖌️', duration: '15:20', category: 'art', description_zh: '基本笔画', description_en: 'Basic strokes', video_url: '', views: 7600 },
  { id: 4, title_zh: '京剧入门', title_en: 'Peking Opera', title_it: 'Opera di Pechino', thumbnail: '🎭', duration: '12:45', category: 'art', description_zh: '传统戏剧', description_en: 'Traditional theater', video_url: '', views: 5400 },
  { id: 5, title_zh: '中国美食', title_en: 'Chinese Cuisine', title_it: 'Cucina Cinese', thumbnail: '🥟', duration: '18:30', category: 'food', description_zh: '八大菜系', description_en: 'Eight cuisines', video_url: '', views: 15200 }
];

const defaultKnowledge = [
  { id: 1, title_zh: '十二生肖', title_en: 'Chinese Zodiac', title_it: 'Zodiaco Cinese', icon: '🐉', category: 'tradition', content_zh: '鼠牛虎兔龙蛇马羊猴鸡狗猪十二种动物。', content_en: 'Rat, Ox, Tiger, Rabbit, Dragon, Snake, Horse, Goat, Monkey, Rooster, Dog, Pig.' },
  { id: 2, title_zh: '四大发明', title_en: 'Four Inventions', title_it: 'Quattro Invenzioni', icon: '🧭', category: 'history', content_zh: '造纸、印刷、火药、指南针。', content_en: 'Paper, printing, gunpowder, compass.' },
  { id: 3, title_zh: '传统节日', title_en: 'Festivals', title_it: 'Festività', icon: '🎊', category: 'festivals', content_zh: '春节、元宵、清明、端午、中秋。', content_en: 'Spring Festival, Lantern, Qingming, Dragon Boat, Mid-Autumn.' },
  { id: 4, title_zh: '中国武术', title_en: 'Martial Arts', title_it: 'Arti Marziali', icon: '🥋', category: 'martial_arts', content_zh: '少林、太极、咏春。', content_en: 'Shaolin, Tai Chi, Wing Chun.' }
];

const ChineseCulturePage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('chengyu');
  const [loading, setLoading] = useState(true);
  const [chengyu, setChengyu] = useState(defaultChengyu);
  const [videos, setVideos] = useState(defaultVideos);
  const [knowledge, setKnowledge] = useState(defaultKnowledge);
  const [shares, setShares] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [quizMode, setQuizMode] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState(null);
  const [quizAnswer, setQuizAnswer] = useState('');
  const [quizResult, setQuizResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [shareForm, setShareForm] = useState({ title: '', content: '', category: 'custom', visibility: 'public', targetClasses: [] });
  const [templateForm, setTemplateForm] = useState({});
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'content_editor';

  // Content templates
  const templates = {
    chengyu: {
      icon: '📜',
      name: { zh: '成语', en: 'Chengyu' },
      fields: [
        { key: 'chengyu', label: { zh: '成语', en: 'Chengyu' }, type: 'text', required: true, placeholder: '如：画龙点睛' },
        { key: 'pinyin', label: { zh: '拼音', en: 'Pinyin' }, type: 'text', placeholder: 'huà lóng diǎn jīng' },
        { key: 'literal', label: { zh: '字面意思', en: 'Literal Meaning' }, type: 'text', placeholder: 'Paint dragon, dot eyes' },
        { key: 'meaning_zh', label: { zh: '中文释义', en: 'Chinese Meaning' }, type: 'text', required: true },
        { key: 'meaning_en', label: { zh: '英文释义', en: 'English Meaning' }, type: 'text' },
        { key: 'story', label: { zh: '成语故事', en: 'Story' }, type: 'textarea', rows: 4 },
        { key: 'example', label: { zh: '例句', en: 'Example' }, type: 'text' },
        { key: 'category', label: { zh: '分类', en: 'Category' }, type: 'select', options: ['fable', 'history', 'strategy', 'art', 'culture', 'communication'] },
        { key: 'hsk_level', label: { zh: 'HSK等级', en: 'HSK Level' }, type: 'select', options: [1, 2, 3, 4, 5, 6] }
      ],
      points: 30
    },
    video: {
      icon: '🎬',
      name: { zh: '视频', en: 'Video' },
      fields: [
        { key: 'title_zh', label: { zh: '标题(中文)', en: 'Title (Chinese)' }, type: 'text', required: true },
        { key: 'title_en', label: { zh: '标题(英文)', en: 'Title (English)' }, type: 'text' },
        { key: 'description_zh', label: { zh: '简介', en: 'Description' }, type: 'textarea', rows: 3 },
        { key: 'video_url', label: { zh: '视频链接', en: 'Video URL' }, type: 'text', placeholder: 'https://...' },
        { key: 'duration', label: { zh: '时长', en: 'Duration' }, type: 'text', placeholder: '10:30' },
        { key: 'category', label: { zh: '分类', en: 'Category' }, type: 'select', options: ['festivals', 'food', 'art', 'lifestyle', 'culture', 'history'] },
        { key: 'hsk_level', label: { zh: 'HSK等级', en: 'HSK Level' }, type: 'select', options: [1, 2, 3, 4, 5, 6] }
      ],
      points: 50
    },
    knowledge: {
      icon: '📚',
      name: { zh: '知识', en: 'Knowledge' },
      fields: [
        { key: 'title_zh', label: { zh: '标题(中文)', en: 'Title (Chinese)' }, type: 'text', required: true },
        { key: 'title_en', label: { zh: '标题(英文)', en: 'Title (English)' }, type: 'text' },
        { key: 'content_zh', label: { zh: '内容(中文)', en: 'Content (Chinese)' }, type: 'textarea', rows: 5, required: true },
        { key: 'content_en', label: { zh: '内容(英文)', en: 'Content (English)' }, type: 'textarea', rows: 5 },
        { key: 'category', label: { zh: '分类', en: 'Category' }, type: 'select', options: ['tradition', 'history', 'festivals', 'art', 'health', 'philosophy'] },
        { key: 'icon', label: { zh: '图标', en: 'Icon' }, type: 'emoji' }
      ],
      points: 40
    },
    quiz: {
      icon: '❓',
      name: { zh: '测验题', en: 'Quiz Question' },
      fields: [
        { key: 'question', label: { zh: '问题', en: 'Question' }, type: 'textarea', rows: 2, required: true },
        { key: 'type', label: { zh: '题型', en: 'Type' }, type: 'select', options: ['multiple_choice', 'fill_blank', 'true_false'] },
        { key: 'option_a', label: { zh: '选项A', en: 'Option A' }, type: 'text' },
        { key: 'option_b', label: { zh: '选项B', en: 'Option B' }, type: 'text' },
        { key: 'option_c', label: { zh: '选项C', en: 'Option C' }, type: 'text' },
        { key: 'option_d', label: { zh: '选项D', en: 'Option D' }, type: 'text' },
        { key: 'correct_answer', label: { zh: '正确答案', en: 'Correct Answer' }, type: 'text', required: true },
        { key: 'explanation', label: { zh: '答案解析', en: 'Explanation' }, type: 'textarea', rows: 2 },
        { key: 'hsk_level', label: { zh: 'HSK等级', en: 'HSK Level' }, type: 'select', options: [1, 2, 3, 4, 5, 6] }
      ],
      points: 20
    }
  };

  const categoryNames = {
    fable: { zh: '寓言', en: 'Fable' }, history: { zh: '历史', en: 'History' },
    strategy: { zh: '策略', en: 'Strategy' }, art: { zh: '艺术', en: 'Art' },
    culture: { zh: '文化', en: 'Culture' }, communication: { zh: '沟通', en: 'Communication' },
    festivals: { zh: '节日', en: 'Festivals' }, food: { zh: '美食', en: 'Food' },
    lifestyle: { zh: '生活', en: 'Lifestyle' }, tradition: { zh: '传统', en: 'Tradition' },
    health: { zh: '养生', en: 'Health' }, philosophy: { zh: '哲学', en: 'Philosophy' },
    multiple_choice: { zh: '选择题', en: 'Multiple Choice' },
    fill_blank: { zh: '填空题', en: 'Fill Blank' }, true_false: { zh: '判断题', en: 'True/False' }
  };

  useEffect(() => { 
    loadData(); 
  }, []);

  const loadData = async () => {
    try {
      if (supabase) {
        const [c, v, k, s] = await Promise.all([
          supabase.from('dwxz_chengyu').select('*').eq('is_active', true),
          supabase.from('dwxz_culture_videos').select('*').eq('is_active', true),
          supabase.from('dwxz_culture_knowledge').select('*').eq('is_active', true),
          supabase.from('dwxz_culture_shares').select('*').order('created_at', { ascending: false })
        ]);
        if (c.data?.length) setChengyu(c.data);
        if (v.data?.length) setVideos(v.data);
        if (k.data?.length) setKnowledge(k.data);
        setShares(s.data || []);

        // 加载教师的班级
        if (isTeacher) {
          const { data: classData } = await supabase.from('dwxz_classes').select('*').eq('teacher_id', user?.id);
          setClasses(classData || []);
        }
      }
    } catch (err) { 
      console.error('Failed to load culture data:', err);
    }
    finally { setLoading(false); }
  };

  // Open template modal
  const openTemplateModal = (templateKey) => {
    setSelectedTemplate(templateKey);
    setTemplateForm({});
    setShowTemplateModal(true);
  };

  // Submit template content
  const handleTemplateSubmit = async (e) => {
    e.preventDefault();
    const template = templates[selectedTemplate];
    
    // Validate required fields
    const missingFields = template.fields.filter(f => f.required && !templateForm[f.key]);
    if (missingFields.length > 0) {
      setMessage({ type: 'error', text: language === 'zh' ? '请填写必填项' : 'Please fill required fields' });
      return;
    }

    try {
      // Save to culture_shares with pending status
      if (supabase) {
        await supabase.from('dwxz_culture_shares').insert([{
          content_type: selectedTemplate,
          title: templateForm.chengyu || templateForm.title_zh || templateForm.question?.substring(0, 30),
          title_zh: templateForm.chengyu || templateForm.title_zh || templateForm.question?.substring(0, 30),
          content: JSON.stringify(templateForm),
          category: templateForm.category || 'custom',
          author_id: user?.id,
          author_name: user?.name || user?.username,
          review_status: 'pending',
          points_reward: template.points,
          visibility: 'pending'
        }]);
      }

      setShowTemplateModal(false);
      setTemplateForm({});
      setSelectedTemplate(null);
      setMessage({ 
        type: 'success', 
        text: language === 'zh' 
          ? `已提交审核！审核通过后将获得 +${template.points} 积分` 
          : `Submitted! +${template.points} points after approval` 
      });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // 教师分享内容
  const handleShare = async (e) => {
    e.preventDefault();
    try {
      await supabase.from('dwxz_culture_shares').insert([{
        content_type: 'custom',
        title: shareForm.title,
        title_zh: shareForm.title,
        content: shareForm.content,
        category: shareForm.category,
        author_id: user?.id,
        author_name: user?.name || user?.username,
        visibility: shareForm.visibility,
        target_class_ids: shareForm.targetClasses
      }]);
      setShowShareModal(false);
      setShareForm({ title: '', content: '', category: 'custom', visibility: 'public', targetClasses: [] });
      setMessage({ type: 'success', text: language === 'zh' ? '已提交审核，审核通过后将获得 +50 积分！' : language === 'it' ? 'Inviato! +50 punti dopo approvazione' : 'Submitted! +50 points after approval' });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const startQuiz = () => { 
    setQuizQuestion(chengyu[Math.floor(Math.random() * chengyu.length)]); 
    setQuizAnswer(''); 
    setQuizResult(null); 
    setQuizMode(true); 
  };
  
  const checkAnswer = () => setQuizResult(quizAnswer.trim() === quizQuestion?.chengyu);

  const categories = { 
    chengyu: ['all','fable','history','strategy','art','culture','communication'], 
    videos: ['all','festivals','food','art','lifestyle','martial_arts'], 
    knowledge: ['all','tradition','history','festivals','art','health','philosophy','martial_arts'] 
  };
  
  const catNames = { 
    all:{zh:'全部',en:'All',it:'Tutti'}, fable:{zh:'寓言',en:'Fables',it:'Favole'}, 
    history:{zh:'历史',en:'History',it:'Storia'}, strategy:{zh:'策略',en:'Strategy',it:'Strategia'}, 
    art:{zh:'艺术',en:'Art',it:'Arte'}, culture:{zh:'文化',en:'Culture',it:'Cultura'}, 
    communication:{zh:'沟通',en:'Communication',it:'Comunicazione'}, festivals:{zh:'节日',en:'Festivals',it:'Festività'}, 
    food:{zh:'美食',en:'Food',it:'Cibo'}, lifestyle:{zh:'生活',en:'Lifestyle',it:'Lifestyle'}, 
    martial_arts:{zh:'武术',en:'Martial Arts',it:'Arti marziali'}, tradition:{zh:'传统',en:'Tradition',it:'Tradizione'}, 
    health:{zh:'养生',en:'Health',it:'Salute'}, philosophy:{zh:'哲学',en:'Philosophy',it:'Filosofia'} 
  };

  const txt = {
    zh: { title:'中国文化体验', subtitle:'成语·视频·知识', chengyu:'成语', videos:'视频', knowledge:'知识', quiz:'测验', shares:'分享', search:'搜索...', back:'返回', start:'开始', check:'检查', correct:'正确！🎉', incorrect:'答案：', next:'下一题', meaning:'含义', literal:'字面', story:'故事', example:'例句', watch:'观看', views:'观看', learn:'了解更多', addShare:'发布内容', shareTitle:'标题', shareContent:'内容', visibility:'可见性', public:'全部可见', classOnly:'指定班级', selectClasses:'选择班级', submit:'发布', cancel:'取消' },
    en: { title:'Chinese Culture', subtitle:'Chengyu · Videos · Knowledge', chengyu:'Chengyu', videos:'Videos', knowledge:'Knowledge', quiz:'Quiz', shares:'Shares', search:'Search...', back:'Back', start:'Start', check:'Check', correct:'Correct! 🎉', incorrect:'Answer:', next:'Next', meaning:'Meaning', literal:'Literal', story:'Story', example:'Example', watch:'Watch', views:'views', learn:'Learn More', addShare:'Add Content', shareTitle:'Title', shareContent:'Content', visibility:'Visibility', public:'Public', classOnly:'Class Only', selectClasses:'Select Classes', submit:'Submit', cancel:'Cancel' },
    it: { title:'Cultura Cinese', subtitle:'Chengyu · Video · Conoscenze', chengyu:'Chengyu', videos:'Video', knowledge:'Conoscenze', quiz:'Quiz', shares:'Condivisioni', search:'Cerca...', back:'Indietro', start:'Inizia', check:'Verifica', correct:'Corretto! 🎉', incorrect:'Risposta:', next:'Prossimo', meaning:'Significato', literal:'Letterale', story:'Storia', example:'Esempio', watch:'Guarda', views:'visualizzazioni', learn:'Scopri', addShare:'Aggiungi', shareTitle:'Titolo', shareContent:'Contenuto', visibility:'Visibilità', public:'Pubblico', classOnly:'Solo Classe', selectClasses:'Seleziona Classi', submit:'Pubblica', cancel:'Annulla' }
  };
  const t = txt[language] || txt.en;

  const filtChengyu = chengyu.filter(i => (filterCategory==='all'||i.category===filterCategory) && (!searchTerm||i.chengyu.includes(searchTerm)||i.meaning_zh?.includes(searchTerm)||i.meaning_en?.toLowerCase().includes(searchTerm.toLowerCase())));
  const filtVideos = videos.filter(i => (filterCategory==='all'||i.category===filterCategory) && (!searchTerm||i.title_zh?.includes(searchTerm)||i.title_en?.toLowerCase().includes(searchTerm.toLowerCase())));
  const filtKnowledge = knowledge.filter(i => (filterCategory==='all'||i.category===filterCategory) && (!searchTerm||i.title_zh?.includes(searchTerm)||i.title_en?.toLowerCase().includes(searchTerm.toLowerCase())));

  if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>📖 {t.title}</h1>
          <p style={{color:'var(--text-muted)'}}>{t.subtitle}</p>
        </div>
        {isTeacher && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', position: 'relative' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {language === 'zh' ? '创建内容可获得积分 🎯' : 'Create content to earn points 🎯'}
            </span>
            <div style={{ position: 'relative' }}>
              <button className="btn btn-primary" onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}>
                + {language === 'zh' ? '创建内容' : 'Create Content'} ▼
              </button>
              {showTemplateDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  background: 'white',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  minWidth: '200px',
                  zIndex: 100,
                  overflow: 'hidden'
                }}>
                  {Object.entries(templates).map(([key, tpl]) => (
                    <button
                      key={key}
                      onClick={() => { openTemplateModal(key); setShowTemplateDropdown(false); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        borderBottom: '1px solid var(--border)'
                      }}
                      onMouseOver={e => e.target.style.background = 'var(--background)'}
                      onMouseOut={e => e.target.style.background = 'none'}
                    >
                      <span style={{ fontSize: '1.25rem' }}>{tpl.icon}</span>
                      <div>
                        <div style={{ fontWeight: '500' }}>{tpl.name[language] || tpl.name.en}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>+{tpl.points} {language === 'zh' ? '积分' : 'pts'}</div>
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => { setShowShareModal(true); setShowTemplateDropdown(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                    onMouseOver={e => e.target.style.background = 'var(--background)'}
                    onMouseOut={e => e.target.style.background = 'none'}
                  >
                    <span style={{ fontSize: '1.25rem' }}>💬</span>
                    <div>
                      <div style={{ fontWeight: '500' }}>{language === 'zh' ? '自由分享' : 'Free Share'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>+50 {language === 'zh' ? '积分' : 'pts'}</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {message.text && <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>{message.text}</div>}

      <div className="tabs">
        <button className={`tab ${activeTab==='chengyu'?'active':''}`} onClick={()=>{setActiveTab('chengyu');setFilterCategory('all');setSelectedItem(null);}}>📜 {t.chengyu}</button>
        <button className={`tab ${activeTab==='videos'?'active':''}`} onClick={()=>{setActiveTab('videos');setFilterCategory('all');}}>🎬 {t.videos}</button>
        <button className={`tab ${activeTab==='knowledge'?'active':''}`} onClick={()=>{setActiveTab('knowledge');setFilterCategory('all');}}>📚 {t.knowledge}</button>
        <button className={`tab ${activeTab==='shares'?'active':''}`} onClick={()=>setActiveTab('shares')}>💬 {t.shares}</button>
        <button className={`tab ${activeTab==='quiz'?'active':''}`} onClick={()=>setActiveTab('quiz')}>🎯 {t.quiz}</button>
      </div>

      {activeTab!=='quiz' && (
        <div className="card" style={{marginBottom:'1rem',display:'flex',gap:'1rem',flexWrap:'wrap',alignItems:'center'}}>
          <input type="text" className="form-input" style={{flex:'1',minWidth:'200px'}} placeholder={t.search} value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
          <select className="form-select" style={{width:'auto'}} value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}>
            {categories[activeTab]?.map(c=><option key={c} value={c}>{catNames[c]?.[language]||c}</option>)}
          </select>
        </div>
      )}

      {/* CHENGYU LIST */}
      {activeTab==='chengyu' && !selectedItem && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:'1rem'}}>
          {filtChengyu.map(item=>(
            <div key={item.id} className="card" style={{cursor:'pointer'}} onClick={()=>setSelectedItem(item)}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'start'}}>
                <h2 style={{fontSize:'2rem',color:'var(--primary)'}}>{item.chengyu}</h2>
                <span className="badge badge-primary">HSK {item.hsk_level}</span>
              </div>
              <p style={{color:'var(--text-muted)',fontSize:'0.875rem'}}>{item.pinyin}</p>
              <p style={{marginTop:'0.5rem'}}>{language==='zh'?item.meaning_zh:language==='it'?(item.meaning_it||item.meaning_en):item.meaning_en}</p>
              <span className="badge badge-info" style={{marginTop:'0.5rem'}}>{catNames[item.category]?.[language]||item.category}</span>
            </div>
          ))}
        </div>
      )}

      {/* CHENGYU DETAIL */}
      {activeTab==='chengyu' && selectedItem && (
        <div className="card">
          <button className="btn btn-outline" onClick={()=>setSelectedItem(null)} style={{marginBottom:'1rem'}}>← {t.back}</button>
          <h1 style={{fontSize:'3rem',color:'var(--primary)',marginBottom:'0.5rem'}}>{selectedItem.chengyu}</h1>
          <p style={{fontSize:'1.25rem',color:'var(--text-muted)',marginBottom:'1rem'}}>{selectedItem.pinyin}</p>
          <div style={{display:'grid',gap:'1rem'}}>
            <div className="card" style={{background:'var(--background)'}}>
              <h4>{t.literal}</h4>
              <p>{selectedItem.literal}</p>
            </div>
            <div className="card" style={{background:'var(--background)'}}>
              <h4>{t.meaning}</h4>
              <p>{language==='zh'?selectedItem.meaning_zh:language==='it'?(selectedItem.meaning_it||selectedItem.meaning_en):selectedItem.meaning_en}</p>
            </div>
            <div className="card" style={{background:'var(--background)'}}>
              <h4>{t.story}</h4>
              <p>{language==='zh'?selectedItem.story:(selectedItem.story_en||selectedItem.story)}</p>
            </div>
            <div className="card" style={{background:'var(--background)'}}>
              <h4>{t.example}</h4>
              <p>{language==='zh'?selectedItem.example:(selectedItem.example_en||selectedItem.example)}</p>
            </div>
          </div>
        </div>
      )}

      {/* VIDEOS */}
      {activeTab==='videos' && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'1rem'}}>
          {filtVideos.map(item=>(
            <div key={item.id} className="card">
              <div style={{fontSize:'4rem',textAlign:'center',padding:'2rem',background:'var(--background)',borderRadius:'var(--radius-md)',marginBottom:'1rem'}}>{item.thumbnail}</div>
              <h3>{language==='zh'?item.title_zh:language==='it'?(item.title_it||item.title_en):item.title_en}</h3>
              <p style={{color:'var(--text-muted)',fontSize:'0.875rem'}}>{language==='zh'?item.description_zh:item.description_en}</p>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'1rem'}}>
                <span style={{color:'var(--text-muted)'}}>{item.duration} • {item.views?.toLocaleString()} {t.views}</span>
                <button className="btn btn-primary btn-sm">{t.watch}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KNOWLEDGE */}
      {activeTab==='knowledge' && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'1rem'}}>
          {filtKnowledge.map(item=>(
            <div key={item.id} className="card">
              <div style={{fontSize:'3rem',marginBottom:'1rem'}}>{item.icon}</div>
              <h3>{language==='zh'?item.title_zh:language==='it'?(item.title_it||item.title_en):item.title_en}</h3>
              <p style={{color:'var(--text-muted)',marginTop:'0.5rem'}}>{language==='zh'?item.content_zh:item.content_en}</p>
              <span className="badge badge-info" style={{marginTop:'1rem'}}>{catNames[item.category]?.[language]||item.category}</span>
            </div>
          ))}
        </div>
      )}

      {/* QUIZ */}
      {activeTab==='quiz' && (
        <div className="card" style={{maxWidth:'700px',margin:'0 auto'}}>
          {isTeacher ? (
            /* TEACHER: Create Quiz */
            <div>
              <h2 style={{marginBottom:'1rem',textAlign:'center'}}>🎯 {language==='zh'?'创建测验题':language==='it'?'Crea Quiz':'Create Quiz'}</h2>
              <p style={{color:'var(--text-muted)',marginBottom:'1.5rem',textAlign:'center'}}>
                {language==='zh'?'为学生创建成语或文化知识测验题':language==='it'?'Crea domande per gli studenti':'Create questions for students'}
              </p>
              
              <div className="form-group">
                <label className="form-label">{language==='zh'?'题目类型':'Question Type'}</label>
                <select className="form-select">
                  <option value="chengyu">{language==='zh'?'成语测验':'Chengyu Quiz'}</option>
                  <option value="culture">{language==='zh'?'文化知识':'Culture Knowledge'}</option>
                  <option value="pinyin">{language==='zh'?'拼音测验':'Pinyin Quiz'}</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">{language==='zh'?'问题':'Question'}</label>
                <textarea className="form-textarea" rows={3} placeholder={language==='zh'?'输入问题...':'Enter question...'}></textarea>
              </div>
              
              <div className="form-group">
                <label className="form-label">{language==='zh'?'正确答案':'Correct Answer'}</label>
                <input type="text" className="form-input" placeholder={language==='zh'?'输入正确答案...':'Enter correct answer...'}/>
              </div>
              
              <div className="form-group">
                <label className="form-label">{language==='zh'?'干扰选项（可选）':'Wrong Options (Optional)'}</label>
                <input type="text" className="form-input" placeholder={language==='zh'?'用逗号分隔，如：选项A, 选项B, 选项C':'Comma separated, e.g.: Option A, Option B, Option C'}/>
              </div>
              
              <div className="form-group">
                <label className="form-label">{language==='zh'?'目标班级':'Target Class'}</label>
                <select className="form-select">
                  <option value="all">{language==='zh'?'所有学生':'All Students'}</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              
              <div style={{display:'flex',gap:'1rem',marginTop:'1.5rem'}}>
                <button className="btn btn-primary" style={{flex:1}}>
                  {language==='zh'?'保存测验题':'Save Quiz'}
                </button>
                <button className="btn btn-outline" style={{flex:1}}>
                  {language==='zh'?'预览':'Preview'}
                </button>
              </div>
            </div>
          ) : (
            /* STUDENT: Take Quiz */
            <div style={{textAlign:'center'}}>
              {!quizMode ? (
                <div>
                  <h2 style={{marginBottom:'1rem'}}>🎯 {language==='zh'?'成语测验':language==='it'?'Quiz Chengyu':'Chengyu Quiz'}</h2>
                  <p style={{color:'var(--text-muted)',marginBottom:'2rem'}}>{language==='zh'?'根据含义猜成语':language==='it'?'Indovina il Chengyu dal significato':'Guess the Chengyu from its meaning'}</p>
                  <button className="btn btn-primary btn-lg" onClick={startQuiz}>{t.start}</button>
                </div>
              ) : (
                <div>
                  <h3 style={{marginBottom:'1rem'}}>{language==='zh'?'这个成语是什么？':language==='it'?'Qual è questo Chengyu?':'What is this Chengyu?'}</h3>
                  <div className="card" style={{background:'var(--background)',marginBottom:'1.5rem'}}>
                    <p style={{fontSize:'1.125rem'}}>{language==='zh'?quizQuestion?.meaning_zh:quizQuestion?.meaning_en}</p>
                    <p style={{color:'var(--text-muted)',marginTop:'0.5rem'}}>{quizQuestion?.pinyin}</p>
                  </div>
                  <input type="text" className="form-input" style={{textAlign:'center',fontSize:'1.5rem',marginBottom:'1rem'}} value={quizAnswer} onChange={e=>setQuizAnswer(e.target.value)} placeholder={language==='zh'?'输入成语':language==='it'?'Scrivi il Chengyu':'Enter the Chengyu'}/>
                  {quizResult===null ? (
                    <button className="btn btn-primary" onClick={checkAnswer}>{t.check}</button>
                  ) : (
                    <div>
                      <p style={{fontSize:'1.5rem',marginBottom:'1rem',color:quizResult?'var(--success)':'var(--error)'}}>{quizResult ? t.correct : `${t.incorrect} ${quizQuestion?.chengyu}`}</p>
                      <button className="btn btn-primary" onClick={startQuiz}>{t.next}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SHARES */}
      {activeTab==='shares' && (
        <div style={{display:'grid',gap:'1rem'}}>
          {shares.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--text-muted)' }}>{language === 'zh' ? '暂无分享内容' : 'No shares yet'}</p>
            </div>
          ) : (
            shares.map(share => (
              <div key={share.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <h3>{share.title_zh || share.title}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      👤 {share.author_name} • {new Date(share.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="badge badge-info">
                    {share.visibility === 'public' ? '🌐' : '🎓'} {share.visibility === 'public' ? t.public : t.classOnly}
                  </span>
                </div>
                <p style={{ marginTop: '1rem' }}>{share.content}</p>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  <span>👁️ {share.views_count || 0}</span>
                  <span>❤️ {share.likes_count || 0}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>📝 {t.addShare}</h3>
            <form onSubmit={handleShare}>
              <div className="form-group">
                <label className="form-label">{t.shareTitle} *</label>
                <input
                  type="text"
                  className="form-input"
                  value={shareForm.title}
                  onChange={e => setShareForm({...shareForm, title: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t.shareContent} *</label>
                <textarea
                  className="form-textarea"
                  value={shareForm.content}
                  onChange={e => setShareForm({...shareForm, content: e.target.value})}
                  rows={5}
                  required
                />
              </div>
              
              {/* Admin Review Notice */}
              <div style={{ 
                padding: '0.75rem', 
                background: 'var(--background)', 
                borderRadius: 'var(--radius-md)', 
                marginBottom: '1rem',
                border: '1px solid var(--border)'
              }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  💡 {language === 'zh' ? '内容提交后需要管理员审核才能发布' : language === 'it' ? 'I contenuti devono essere approvati dall\'admin' : 'Content needs admin approval before publishing'}
                </p>
              </div>
              
              <div className="form-group">
                <label className="form-label">{t.visibility}</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={`btn ${shareForm.visibility === 'public' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setShareForm({...shareForm, visibility: 'public'})}
                  >
                    🌐 {t.public}
                  </button>
                  <button
                    type="button"
                    className={`btn ${shareForm.visibility === 'class' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setShareForm({...shareForm, visibility: 'class'})}
                  >
                    🎓 {t.classOnly}
                  </button>
                </div>
              </div>
              {shareForm.visibility === 'class' && classes.length > 0 && (
                <div className="form-group">
                  <label className="form-label">{t.selectClasses}</label>
                  {classes.map(c => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={shareForm.targetClasses.includes(c.id)}
                        onChange={e => {
                          const newClasses = e.target.checked
                            ? [...shareForm.targetClasses, c.id]
                            : shareForm.targetClasses.filter(id => id !== c.id);
                          setShareForm({...shareForm, targetClasses: newClasses});
                        }}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowShareModal(false)}>{t.cancel}</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {language === 'zh' ? '提交审核' : language === 'it' ? 'Invia per Revisione' : 'Submit for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && selectedTemplate && (
        <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>
                {templates[selectedTemplate].icon} {language === 'zh' ? '创建' : 'Create'} {templates[selectedTemplate].name[language] || templates[selectedTemplate].name.en}
              </h3>
              <span style={{ background: 'var(--success)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.875rem' }}>
                +{templates[selectedTemplate].points} {language === 'zh' ? '积分' : 'pts'}
              </span>
            </div>

            <form onSubmit={handleTemplateSubmit}>
              {templates[selectedTemplate].fields.map(field => (
                <div className="form-group" key={field.key}>
                  <label className="form-label">
                    {field.label[language] || field.label.en}
                    {field.required && <span style={{ color: 'var(--danger)' }}> *</span>}
                  </label>
                  
                  {field.type === 'text' && (
                    <input
                      type="text"
                      className="form-input"
                      value={templateForm[field.key] || ''}
                      onChange={e => setTemplateForm({...templateForm, [field.key]: e.target.value})}
                      placeholder={field.placeholder || ''}
                      required={field.required}
                    />
                  )}
                  
                  {field.type === 'textarea' && (
                    <textarea
                      className="form-textarea"
                      value={templateForm[field.key] || ''}
                      onChange={e => setTemplateForm({...templateForm, [field.key]: e.target.value})}
                      rows={field.rows || 3}
                      required={field.required}
                    />
                  )}
                  
                  {field.type === 'select' && (
                    <select
                      className="form-select"
                      value={templateForm[field.key] || ''}
                      onChange={e => setTemplateForm({...templateForm, [field.key]: e.target.value})}
                    >
                      <option value="">{language === 'zh' ? '请选择...' : 'Select...'}</option>
                      {field.options.map(opt => (
                        <option key={opt} value={opt}>
                          {categoryNames[opt]?.[language] || categoryNames[opt]?.en || opt}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.type === 'emoji' && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {['🏮', '🐉', '🎋', '🥢', '🍵', '🧧', '🎎', '🏯', '🎭', '📜', '🖌️', '🎨'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          className={`btn ${templateForm[field.key] === emoji ? 'btn-primary' : 'btn-outline'}`}
                          style={{ fontSize: '1.5rem', padding: '0.5rem' }}
                          onClick={() => setTemplateForm({...templateForm, [field.key]: emoji})}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Preview */}
              {selectedTemplate === 'chengyu' && templateForm.chengyu && (
                <div style={{ 
                  padding: '1rem', 
                  background: 'var(--background)', 
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1rem',
                  border: '2px dashed var(--border)'
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    {language === 'zh' ? '📋 预览' : '📋 Preview'}
                  </div>
                  <div style={{ fontSize: '1.5rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                    {templateForm.chengyu}
                  </div>
                  {templateForm.pinyin && <div style={{ color: 'var(--text-muted)' }}>{templateForm.pinyin}</div>}
                  {templateForm.meaning_zh && <div style={{ marginTop: '0.5rem' }}>{templateForm.meaning_zh}</div>}
                </div>
              )}

              {/* Review Notice */}
              <div style={{ 
                padding: '0.75rem', 
                background: '#fef3c7', 
                borderRadius: 'var(--radius-md)', 
                marginBottom: '1rem',
                border: '1px solid #f59e0b'
              }}>
                <p style={{ fontSize: '0.875rem', color: '#92400e', margin: 0 }}>
                  ⏳ {language === 'zh' 
                    ? '提交后需要管理员审核，审核通过后内容将发布并获得积分奖励' 
                    : 'Content will be reviewed by admin. Points awarded after approval.'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowTemplateModal(false)}>
                  {language === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  📤 {language === 'zh' ? '提交审核' : 'Submit for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChineseCulturePage;
