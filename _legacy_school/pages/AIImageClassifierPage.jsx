import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const AIImageClassifierPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  
  const [images, setImages] = useState([]);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroup, setNewGroup] = useState({ id: '', name: '', nameEn: '', color: '#8B5CF6' });
  const [editingGroup, setEditingGroup] = useState(null);
  const [groups, setGroups] = useState([
    { id: 'ZANG', name: '藏族', nameEn: 'Tibetan', color: '#8B5CF6', count: 0, images: [] },
    { id: 'LIJIN', name: '黎族', nameEn: 'Li Minority', color: '#EC4899', count: 0, images: [] },
    { id: 'KUNQU', name: '昆曲', nameEn: 'Kunqu Opera', color: '#06B6D4', count: 0, images: [] },
    { id: 'MIAO', name: '苗族', nameEn: 'Miao/Hmong', color: '#10B981', count: 0, images: [] },
    { id: 'ZHUANG', name: '壮族', nameEn: 'Zhuang', color: '#F97316', count: 0, images: [] },
    { id: 'YI', name: '彝族', nameEn: 'Yi Minority', color: '#EF4444', count: 0, images: [] },
    { id: 'DAI', name: '傣族', nameEn: 'Dai Minority', color: '#14B8A6', count: 0, images: [] },
    { id: 'DONG', name: '侗族', nameEn: 'Dong Minority', color: '#7C3AED', count: 0, images: [] },
    { id: 'BAI', name: '白族', nameEn: 'Bai Minority', color: '#64748B', count: 0, images: [] },
    { id: 'HANI', name: '哈尼族', nameEn: 'Hani Minority', color: '#A855F7', count: 0, images: [] },
    { id: 'UYGHUR', name: '维吾尔族', nameEn: 'Uyghur', color: '#0EA5E9', count: 0, images: [] },
    { id: 'MONGOL', name: '蒙古族', nameEn: 'Mongolian', color: '#22C55E', count: 0, images: [] },
    { id: 'KOREAN', name: '朝鲜族', nameEn: 'Korean', color: '#F43F5E', count: 0, images: [] },
    { id: 'MANCHU', name: '满族', nameEn: 'Manchu', color: '#FBBF24', count: 0, images: [] },
    { id: 'TUJIA', name: '土家族', nameEn: 'Tujia', color: '#FB923C', count: 0, images: [] },
    { id: 'TRAD_CN', name: '传统中国', nameEn: 'Traditional Chinese', color: '#F59E0B', count: 0, images: [] },
    { id: 'MANDALA', name: '曼陀罗', nameEn: 'Mandala', color: '#DC2626', count: 0, images: [] },
  ]);
  const [unclassified, setUnclassified] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [logs, setLogs] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const txt = {
    zh: {
      title: 'AI 图片自动分组',
      subtitle: '使用AI视觉识别自动将图片分类到正确的文化风格组',
      uploadImages: '上传图片',
      uploadFolder: '上传文件夹',
      startClassify: '开始AI分类',
      stopClassify: '停止',
      classifying: '分类中...',
      settings: '设置',
      apiKeyLabel: 'OpenAI API Key (用于GPT-4 Vision)',
      apiKeyPlaceholder: 'sk-...',
      saveSettings: '保存',
      groups: '分组',
      all: '全部',
      unclassified: '未分类',
      exportGroups: '导出分组',
      clearAll: '清空全部',
      imageCount: '张图片',
      dragDrop: '拖拽图片或文件夹到这里',
      processing: '正在处理',
      completed: '分类完成',
      failed: '分类失败',
      confidence: '置信度',
      moveTo: '移动到',
      remove: '移除',
      logs: '处理日志',
      noImages: '暂无图片',
      selectGroup: '点击分组查看图片',
      autoClassifyTip: 'AI将分析每张图片的视觉特征，自动识别文化风格',
      exportSuccess: '导出成功！',
      addGroup: '添加分组',
      editGroup: '编辑分组',
      deleteGroup: '删除分组',
      groupId: '分组ID (英文大写)',
      groupName: '中文名称',
      groupNameEn: '英文名称',
      groupColor: '颜色',
      groupFeatures: '识别特征 (用于AI识别)',
      save: '保存',
      cancel: '取消',
      confirmDelete: '确定删除此分组？分组内的图片将移至未分类。',
      characteristics: {
        ZANG: '藏族：唐卡、藏传佛教、雪山、经幡、藏式建筑、藏族服饰',
        LIJIN: '黎族：黎锦、几何图案、热带元素、黎族服饰、织锦纹样',
        KUNQU: '昆曲：戏曲脸谱、水袖、戏服、舞台、传统妆容',
        MIAO: '苗族：银饰、刺绣、蜡染、苗族服饰、牛角装饰、蝴蝶纹',
        ZHUANG: '壮族：壮锦、铜鼓纹样、歌圩场景、吊脚楼、几何刺绣',
        YI: '彝族：黑红黄配色、漆器、火把节、鹰虎图腾、独特头饰',
        DAI: '傣族：孔雀舞、泼水节、竹楼、金塔、筒裙、热带植物',
        DONG: '侗族：鼓楼、风雨桥、银饰、靛蓝布、侗族大歌',
        BAI: '白族：白色服饰、扎染、三道茶、蝴蝶泉、大理石纹',
        HANI: '哈尼族：梯田、蘑菇房、黑蓝服饰、银币装饰、丰收节',
        UYGHUR: '维吾尔族：花帽、艾德莱斯绸、葡萄藤纹、伊斯兰几何、十二木卡姆',
        MONGOL: '蒙古族：蒙古包、马头琴、那达慕、蓝色哈达、草原风光',
        KOREAN: '朝鲜族：韩服、长鼓舞、泡菜、象帽舞、朝鲜族建筑',
        MANCHU: '满族：旗袍、马褂、萨满、满文、宫廷风格',
        TUJIA: '土家族：西兰卡普、摆手舞、吊脚楼、土家织锦、虎纹',
        TRAD_CN: '传统中国：青花瓷、书法、山水画、古典建筑、龙凤图案、剪纸',
        MANDALA: '曼陀罗：对称几何、圆形图案、冥想图案、繁复花纹、神圣几何'
      }
    },
    en: {
      title: 'AI Image Auto-Grouping',
      subtitle: 'Use AI vision to automatically classify images into cultural style groups',
      uploadImages: 'Upload Images',
      uploadFolder: 'Upload Folder',
      startClassify: 'Start AI Classification',
      stopClassify: 'Stop',
      classifying: 'Classifying...',
      settings: 'Settings',
      apiKeyLabel: 'OpenAI API Key (for GPT-4 Vision)',
      apiKeyPlaceholder: 'sk-...',
      saveSettings: 'Save',
      groups: 'Groups',
      all: 'All',
      unclassified: 'Unclassified',
      exportGroups: 'Export Groups',
      clearAll: 'Clear All',
      imageCount: 'images',
      dragDrop: 'Drag & drop images or folders here',
      processing: 'Processing',
      completed: 'Classification complete',
      failed: 'Classification failed',
      confidence: 'Confidence',
      moveTo: 'Move to',
      remove: 'Remove',
      logs: 'Processing Logs',
      noImages: 'No images',
      selectGroup: 'Click a group to view images',
      autoClassifyTip: 'AI will analyze visual features of each image to identify cultural style',
      exportSuccess: 'Export successful!',
      characteristics: {
        ZANG: 'Tibetan: Thangka, Buddhist art, snow mountains, prayer flags, Tibetan architecture',
        LIJIN: 'Li Minority: Li brocade, geometric patterns, tropical elements, woven textiles',
        KUNQU: 'Kunqu Opera: Opera masks, water sleeves, costumes, stage, traditional makeup',
        MIAO: 'Miao Minority: Silver jewelry, embroidery, batik, Miao costumes, horn decorations',
        TRAD_CN: 'Traditional Chinese: Blue-white porcelain, calligraphy, landscape painting, dragons',
        MANDALA: 'Mandala: Symmetric geometry, circular patterns, meditation art, intricate designs'
      }
    }
  };
  const t = txt[language] || txt.zh;

  // Handle file upload
  const handleFileSelect = (e, isFolder = false) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    
    const newImages = imageFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      url: URL.createObjectURL(file),
      status: 'pending', // pending, classifying, classified, failed
      group: null,
      confidence: null,
      error: null
    }));
    
    setImages(prev => [...prev, ...newImages]);
    setUnclassified(prev => [...prev, ...newImages.map(img => img.id)]);
    addLog(`📤 上传了 ${newImages.length} 张图片`);
  };

  // Handle drag & drop
  const handleDrop = (e) => {
    e.preventDefault();
    const items = Array.from(e.dataTransfer.items);
    const files = [];
    
    const processEntry = async (entry) => {
      if (entry.isFile) {
        return new Promise(resolve => {
          entry.file(file => {
            if (file.type.startsWith('image/')) {
              files.push(file);
            }
            resolve();
          });
        });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        return new Promise(resolve => {
          reader.readEntries(async entries => {
            for (const e of entries) {
              await processEntry(e);
            }
            resolve();
          });
        });
      }
    };
    
    Promise.all(items.map(item => {
      const entry = item.webkitGetAsEntry?.();
      return entry ? processEntry(entry) : Promise.resolve();
    })).then(() => {
      if (files.length > 0) {
        const newImages = files.map(file => ({
          id: crypto.randomUUID(),
          file,
          name: file.name,
          url: URL.createObjectURL(file),
          status: 'pending',
          group: null,
          confidence: null,
          error: null
        }));
        setImages(prev => [...prev, ...newImages]);
        setUnclassified(prev => [...prev, ...newImages.map(img => img.id)]);
        addLog(`📤 拖拽上传了 ${newImages.length} 张图片`);
      }
    });
  };

  // Add log entry
  const addLog = (message) => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message }].slice(-100));
  };

  // Convert image to base64
  const imageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Classify single image using GPT-4 Vision
  const classifyImage = async (image) => {
    if (!apiKey) {
      throw new Error('API Key not configured');
    }

    const base64 = await imageToBase64(image.file);
    
    // Build dynamic prompt based on current groups
    const groupDescriptions = groups.map((g, i) => {
      const characteristics = {
        ZANG: 'Thangka paintings, Tibetan Buddhist art, prayer flags, snow mountains, Tibetan architecture, traditional clothing',
        LIJIN: 'Li brocade (黎锦) patterns, geometric woven designs, tropical elements, traditional textiles',
        KUNQU: 'Opera masks, costumes, water sleeves, stage performances, traditional makeup',
        MIAO: 'Silver jewelry/headdresses, embroidery, batik patterns, pleated skirts, butterfly motifs',
        ZHUANG: 'Zhuang brocade (壮锦), bronze drum patterns, song fair scenes, stilt houses, geometric embroidery',
        YI: 'Black/red/yellow color scheme, lacquerware, fire festival, eagle/tiger motifs, distinctive headwear',
        DAI: 'Peacock dance, water splashing festival, bamboo houses, golden pagodas, sarong clothing',
        DONG: 'Drum towers (鼓楼), wind-rain bridges, silver ornaments, indigo cloth, grand song',
        BAI: 'White clothing with colorful trim, tie-dye (扎染), butterfly springs, marble patterns',
        HANI: 'Rice terraces, mushroom houses, black/blue clothing, silver coins, harvest festivals',
        UYGHUR: 'Flower caps, Atlas silk, grape vine patterns, Islamic geometry, musical instruments',
        MONGOL: 'Yurts, horse-head fiddle, Naadam festival, blue hada scarves, grassland scenes',
        KOREAN: 'Hanbok/Korean dress, long drum dance, traditional architecture, fan dance',
        MANCHU: 'Qipao/cheongsam, mandarin jacket, Manchu script, court style, shamanic elements',
        TUJIA: 'Xilan Kapu brocade, hand-waving dance, stilt houses, tiger patterns',
        TRAD_CN: 'Blue-white porcelain, calligraphy, landscape paintings, dragons, phoenixes, paper cutting',
        MANDALA: 'Symmetric circular patterns, meditation art, geometric designs, sacred geometry'
      };
      return `${i + 1}. ${g.id} (${g.name}/${g.nameEn}): ${characteristics[g.id] || g.name + ' traditional patterns and art'}`;
    }).join('\n');

    const prompt = `You are an expert in Chinese ethnic minority art, cultural patterns, and traditional crafts. Analyze this image and classify it into ONE of these categories:

${groupDescriptions}
${groups.length + 1}. UNKNOWN: If the image doesn't clearly belong to any category above

Respond with ONLY a JSON object in this exact format:
{"category": "CATEGORY_ID", "confidence": 0.85, "reason": "Brief explanation in Chinese"}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'low' } }
            ]
          }
        ],
        max_tokens: 200
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse response:', content);
    }
    
    return { category: 'UNKNOWN', confidence: 0, reason: 'Failed to parse AI response' };
  };

  // Start batch classification
  const startClassification = async () => {
    if (!apiKey) {
      setShowSettings(true);
      return;
    }

    const pendingImages = images.filter(img => img.status === 'pending');
    if (pendingImages.length === 0) {
      addLog('⚠️ 没有待分类的图片');
      return;
    }

    setClassifying(true);
    setProgress({ current: 0, total: pendingImages.length });
    addLog(`🚀 开始分类 ${pendingImages.length} 张图片...`);

    for (let i = 0; i < pendingImages.length; i++) {
      if (!classifying) break; // Allow stopping

      const image = pendingImages[i];
      setProgress({ current: i + 1, total: pendingImages.length });
      
      // Update status to classifying
      setImages(prev => prev.map(img => 
        img.id === image.id ? { ...img, status: 'classifying' } : img
      ));

      try {
        const result = await classifyImage(image);
        const category = result.category;
        const confidence = result.confidence || 0;

        // Update image with classification
        setImages(prev => prev.map(img => 
          img.id === image.id ? { 
            ...img, 
            status: 'classified', 
            group: category,
            confidence,
            reason: result.reason
          } : img
        ));

        // Update group counts
        if (category !== 'UNKNOWN') {
          setGroups(prev => prev.map(g => 
            g.id === category ? { ...g, count: g.count + 1, images: [...g.images, image.id] } : g
          ));
          setUnclassified(prev => prev.filter(id => id !== image.id));
          addLog(`✅ ${image.name} → ${category} (${Math.round(confidence * 100)}%)`);
        } else {
          addLog(`❓ ${image.name} → 未能识别`);
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));

      } catch (error) {
        setImages(prev => prev.map(img => 
          img.id === image.id ? { ...img, status: 'failed', error: error.message } : img
        ));
        addLog(`❌ ${image.name}: ${error.message}`);
      }
    }

    setClassifying(false);
    addLog(`🎉 分类完成！`);
  };

  // Move image to different group
  const moveImageToGroup = (imageId, newGroupId) => {
    const image = images.find(img => img.id === imageId);
    if (!image) return;

    const oldGroupId = image.group;

    // Update image
    setImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, group: newGroupId, status: 'classified' } : img
    ));

    // Update old group
    if (oldGroupId) {
      setGroups(prev => prev.map(g => 
        g.id === oldGroupId ? { ...g, count: g.count - 1, images: g.images.filter(id => id !== imageId) } : g
      ));
    } else {
      setUnclassified(prev => prev.filter(id => id !== imageId));
    }

    // Update new group
    setGroups(prev => prev.map(g => 
      g.id === newGroupId ? { ...g, count: g.count + 1, images: [...g.images, imageId] } : g
    ));

    addLog(`🔄 移动 ${image.name} 到 ${newGroupId}`);
  };

  // Export groups to ZIP structure
  const exportGroups = async () => {
    addLog('📦 正在导出分组...');
    
    // Create folder structure info
    const structure = {};
    groups.forEach(group => {
      const groupImages = images.filter(img => img.group === group.id);
      structure[group.id] = groupImages.map(img => img.name);
    });
    structure['UNKNOWN'] = images.filter(img => !img.group || img.group === 'UNKNOWN').map(img => img.name);

    // Download as JSON for now (full ZIP would need JSZip library)
    const blob = new Blob([JSON.stringify(structure, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `image_classification_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    addLog(`✅ ${t.exportSuccess}`);
  };

  // Clear all
  const clearAll = () => {
    if (!window.confirm(language === 'zh' ? '确定要清空所有图片吗？' : 'Clear all images?')) return;
    images.forEach(img => URL.revokeObjectURL(img.url));
    setImages([]);
    setGroups(prev => prev.map(g => ({ ...g, count: 0, images: [] })));
    setUnclassified([]);
    setLogs([]);
    addLog('🗑️ 已清空所有图片');
  };

  // Get images for display
  const getDisplayImages = () => {
    if (selectedGroup === null) return images;
    if (selectedGroup === 'unclassified') return images.filter(img => !img.group || img.group === 'UNKNOWN');
    return images.filter(img => img.group === selectedGroup);
  };

  const totalImages = images.length;
  const classifiedCount = images.filter(img => img.status === 'classified' && img.group && img.group !== 'UNKNOWN').length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      {/* Header */}
      <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>🎨 {t.title}</h1>
          <p style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline" onClick={() => setShowSettings(true)}>
            ⚙️ {t.settings}
          </button>
          <button className="btn btn-outline" onClick={exportGroups} disabled={classifiedCount === 0}>
            📦 {t.exportGroups}
          </button>
          <button className="btn btn-outline" onClick={clearAll} disabled={totalImages === 0}>
            🗑️ {t.clearAll}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{totalImages}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.all}</div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>{classifiedCount}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>已分类</div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>{unclassified.length}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.unclassified}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 300px', gap: '1.5rem' }}>
        {/* Left: Groups Panel */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', maxHeight: 'calc(100vh - 300px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', background: 'var(--background)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>📁 {t.groups}</h3>
            <button 
              className="btn btn-sm btn-primary"
              onClick={() => { setNewGroup({ id: '', name: '', nameEn: '', color: '#8B5CF6' }); setShowAddGroup(true); }}
              title={t.addGroup}
            >
              +
            </button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* All */}
            <div
              onClick={() => setSelectedGroup(null)}
              style={{
                padding: '1rem',
                cursor: 'pointer',
                background: selectedGroup === null ? 'rgba(196, 30, 58, 0.1)' : 'transparent',
                borderLeft: selectedGroup === null ? '4px solid var(--primary)' : '4px solid transparent',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}
            >
              <span style={{ fontWeight: 'bold' }}>{t.all}</span>
              <span style={{ background: 'var(--primary)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.875rem' }}>
                {totalImages}
              </span>
            </div>

            {/* Groups */}
            {groups.map(group => (
              <div
                key={group.id}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  background: selectedGroup === group.id ? 'rgba(196, 30, 58, 0.1)' : 'transparent',
                  borderLeft: selectedGroup === group.id ? `4px solid ${group.color}` : '4px solid transparent',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div onClick={() => setSelectedGroup(group.id)} style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: group.color, display: 'inline-block' }}></span>
                    {group.id}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{group.name}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingGroup(group); setNewGroup({ ...group }); setShowAddGroup(true); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', opacity: 0.5 }}
                    title={t.editGroup}
                  >
                    ✏️
                  </button>
                  <span style={{ 
                    background: group.count > 0 ? group.color : 'var(--text-muted)', 
                    color: 'white', 
                    padding: '0.2rem 0.6rem', 
                    borderRadius: '999px', 
                    fontSize: '0.8rem',
                    opacity: group.count > 0 ? 1 : 0.5,
                    minWidth: '32px',
                    textAlign: 'center'
                  }}>
                    {group.count}
                  </span>
                </div>
              </div>
            ))}

            {/* Unclassified */}
            <div
              onClick={() => setSelectedGroup('unclassified')}
              style={{
                padding: '1rem',
                cursor: 'pointer',
                background: selectedGroup === 'unclassified' ? 'rgba(234, 179, 8, 0.1)' : 'transparent',
                borderLeft: selectedGroup === 'unclassified' ? '4px solid var(--warning)' : '4px solid transparent',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                color: 'var(--warning)'
              }}
            >
              <span style={{ fontWeight: 'bold' }}>{t.unclassified}</span>
              <span style={{ background: 'var(--warning)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.875rem' }}>
                {unclassified.length}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Images Grid */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Upload/Action Bar */}
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              multiple
              onChange={(e) => handleFileSelect(e)}
            />
            <input
              type="file"
              ref={folderInputRef}
              style={{ display: 'none' }}
              webkitdirectory=""
              directory=""
              onChange={(e) => handleFileSelect(e, true)}
            />
            <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>
              📷 {t.uploadImages}
            </button>
            <button className="btn btn-outline" onClick={() => folderInputRef.current?.click()}>
              📁 {t.uploadFolder}
            </button>
            <div style={{ flex: 1 }} />
            {classifying ? (
              <button className="btn btn-outline" onClick={() => setClassifying(false)} style={{ color: 'var(--danger)' }}>
                ⏹️ {t.stopClassify}
              </button>
            ) : (
              <button 
                className="btn btn-primary" 
                onClick={startClassification}
                disabled={images.filter(i => i.status === 'pending').length === 0}
              >
                🤖 {t.startClassify}
              </button>
            )}
          </div>

          {/* Progress Bar */}
          {classifying && (
            <div style={{ padding: '0.5rem 1rem', background: 'var(--background)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span>{t.processing}...</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${(progress.current / progress.total) * 100}%`, 
                  height: '100%', 
                  background: 'var(--primary)',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          )}

          {/* Images Grid or Drop Zone */}
          <div 
            style={{ flex: 1, padding: '1rem', overflowY: 'auto', minHeight: '400px' }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {images.length === 0 ? (
              <div style={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center',
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-muted)'
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📷</div>
                <p>{t.dragDrop}</p>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>{t.autoClassifyTip}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                {getDisplayImages().map(image => (
                  <div 
                    key={image.id}
                    style={{
                      position: 'relative',
                      aspectRatio: '1',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      border: `2px solid ${image.group ? groups.find(g => g.id === image.group)?.color || 'var(--border)' : 'var(--border)'}`,
                      cursor: 'pointer'
                    }}
                    onClick={() => setPreviewItem(image)}
                  >
                    <img 
                      src={image.url} 
                      alt={image.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {/* Status overlay */}
                    {image.status === 'classifying' && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="loading-spinner" />
                      </div>
                    )}
                    {/* Group badge */}
                    {image.group && image.group !== 'UNKNOWN' && (
                      <div style={{
                        position: 'absolute',
                        top: '0.5rem',
                        right: '0.5rem',
                        background: groups.find(g => g.id === image.group)?.color || 'var(--primary)',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 'bold'
                      }}>
                        {image.group}
                      </div>
                    )}
                    {/* Confidence */}
                    {image.confidence && (
                      <div style={{
                        position: 'absolute',
                        bottom: '0.5rem',
                        right: '0.5rem',
                        background: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        padding: '0.2rem 0.4rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem'
                      }}>
                        {Math.round(image.confidence * 100)}%
                      </div>
                    )}
                    {/* Error indicator */}
                    {image.status === 'failed' && (
                      <div style={{
                        position: 'absolute',
                        top: '0.5rem',
                        left: '0.5rem',
                        background: 'var(--danger)',
                        color: 'white',
                        padding: '0.2rem 0.4rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem'
                      }}>
                        ❌
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Logs Panel */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
            <h3 style={{ margin: 0 }}>📋 {t.logs}</h3>
          </div>
          <div style={{ flex: 1, padding: '0.5rem', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.8rem', background: '#1a1a2e', color: '#a0a0a0' }}>
            {logs.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.5 }}>等待操作...</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} style={{ padding: '0.25rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: '#666', marginRight: '0.5rem' }}>[{log.time}]</span>
                  <span>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem' }}>⚙️ {t.settings}</h3>
            
            <div className="form-group">
              <label className="form-label">{t.apiKeyLabel}</label>
              <input
                type="password"
                className="form-input"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={t.apiKeyPlaceholder}
              />
              <small style={{ color: 'var(--text-muted)' }}>
                需要 GPT-4 Vision API 权限 (gpt-4o 模型)
              </small>
            </div>

            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>🎨 分类特征说明</h4>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {Object.entries(t.characteristics).map(([key, desc]) => (
                  <p key={key} style={{ marginBottom: '0.5rem' }}>
                    <strong style={{ color: groups.find(g => g.id === key)?.color }}>{key}:</strong> {desc.split(':')[1]}
                  </p>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setShowSettings(false)}>取消</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setShowSettings(false); addLog('✅ 设置已保存'); }}>
                💾 {t.saveSettings}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewItem && (
        <div className="modal-overlay" onClick={() => setPreviewItem(null)}>
          <div className="modal-content" style={{ maxWidth: '800px', padding: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{ position: 'relative' }}>
              <img 
                src={previewItem.url} 
                alt={previewItem.name}
                style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', background: '#000' }}
              />
              <button 
                onClick={() => setPreviewItem(null)}
                style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>{previewItem.name}</h4>
              {previewItem.reason && (
                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>{previewItem.reason}</p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span>{t.moveTo}:</span>
                {groups.map(g => (
                  <button
                    key={g.id}
                    className={`btn btn-sm ${previewItem.group === g.id ? 'btn-primary' : 'btn-outline'}`}
                    style={{ borderColor: g.color, color: previewItem.group === g.id ? 'white' : g.color }}
                    onClick={() => { moveImageToGroup(previewItem.id, g.id); setPreviewItem({ ...previewItem, group: g.id }); }}
                  >
                    {g.id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Group Modal */}
      {showAddGroup && (
        <div className="modal-overlay" onClick={() => { setShowAddGroup(false); setEditingGroup(null); }}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem' }}>
              {editingGroup ? `✏️ ${t.editGroup}` : `➕ ${t.addGroup}`}
            </h3>
            
            <div className="form-group">
              <label className="form-label">{t.groupId} *</label>
              <input
                type="text"
                className="form-input"
                value={newGroup.id}
                onChange={e => setNewGroup({ ...newGroup, id: e.target.value.toUpperCase().replace(/[^A-Z_]/g, '') })}
                placeholder="e.g., ZHUANG, NAXI, BUYI"
                disabled={!!editingGroup}
                style={{ fontFamily: 'monospace' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t.groupName} *</label>
              <input
                type="text"
                className="form-input"
                value={newGroup.name}
                onChange={e => setNewGroup({ ...newGroup, name: e.target.value })}
                placeholder="e.g., 壮族, 纳西族, 布依族"
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t.groupNameEn}</label>
              <input
                type="text"
                className="form-input"
                value={newGroup.nameEn}
                onChange={e => setNewGroup({ ...newGroup, nameEn: e.target.value })}
                placeholder="e.g., Zhuang Minority"
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t.groupColor}</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="color"
                  value={newGroup.color}
                  onChange={e => setNewGroup({ ...newGroup, color: e.target.value })}
                  style={{ width: '50px', height: '40px', padding: 0, border: 'none', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  {['#8B5CF6', '#EC4899', '#06B6D4', '#10B981', '#F97316', '#EF4444', '#F59E0B', '#6366F1', '#14B8A6', '#A855F7'].map(color => (
                    <button
                      key={color}
                      onClick={() => setNewGroup({ ...newGroup, color })}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: color,
                        border: newGroup.color === color ? '3px solid white' : 'none',
                        boxShadow: newGroup.color === color ? `0 0 0 2px ${color}` : 'none',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              {editingGroup && (
                <button 
                  className="btn btn-outline" 
                  style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                  onClick={() => {
                    if (window.confirm(t.confirmDelete)) {
                      // Move images to unclassified
                      const groupImages = images.filter(img => img.group === editingGroup.id);
                      groupImages.forEach(img => {
                        setImages(prev => prev.map(i => i.id === img.id ? { ...i, group: null } : i));
                        setUnclassified(prev => [...prev, img.id]);
                      });
                      // Remove group
                      setGroups(prev => prev.filter(g => g.id !== editingGroup.id));
                      setShowAddGroup(false);
                      setEditingGroup(null);
                      addLog(`🗑️ 删除分组: ${editingGroup.id}`);
                    }
                  }}
                >
                  🗑️ {t.deleteGroup}
                </button>
              )}
              <button className="btn btn-outline" onClick={() => { setShowAddGroup(false); setEditingGroup(null); }}>
                {t.cancel}
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                disabled={!newGroup.id || !newGroup.name}
                onClick={() => {
                  if (editingGroup) {
                    // Update existing group
                    setGroups(prev => prev.map(g => 
                      g.id === editingGroup.id ? { ...g, name: newGroup.name, nameEn: newGroup.nameEn, color: newGroup.color } : g
                    ));
                    addLog(`✏️ 更新分组: ${newGroup.id}`);
                  } else {
                    // Add new group
                    if (groups.some(g => g.id === newGroup.id)) {
                      alert('ID already exists!');
                      return;
                    }
                    setGroups(prev => [...prev, { ...newGroup, count: 0, images: [] }]);
                    addLog(`➕ 添加分组: ${newGroup.id} (${newGroup.name})`);
                  }
                  setShowAddGroup(false);
                  setEditingGroup(null);
                }}
              >
                💾 {t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIImageClassifierPage;
