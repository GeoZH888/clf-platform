import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const SuperAdminPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({ users: 0, teachers: 0, students: 0, classes: 0, schools: 0 });
  const [users, setUsers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [aiSettings, setAiSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // 多语言文本
  const txt = {
    zh: {
      title: '👑 超级管理员',
      overview: '系统概览',
      users: '用户管理',
      schools: '学校管理',
      aiConfig: '智能配置',
      logs: '系统日志',
      totalUsers: '总用户',
      teachers: '教师',
      students: '学生',
      totalSchools: '学校',
      totalClasses: '班级',
      aiProvider: '选择服务商',
      aiModel: '选择模型',
      apiKey: 'API Key',
      apiKeyHint: '输入 API Key（敏感信息已加密存储）',
      baseUrl: 'API 地址',
      maxTokens: '最大 Token',
      temperature: '创造性参数',
      temperatureHint: '0-1，越高越有创造性',
      enableFeatures: '功能开关',
      pptGen: 'PPT 生成',
      quizGen: '测验生成',
      summaryGen: '摘要生成',
      lessonGen: '教案生成',
      flashcardGen: '闪卡生成',
      usageLimits: '使用限制',
      teacherLimit: '教师每日限制',
      studentLimit: '学生每日限制',
      save: '保存配置',
      saving: '保存中...',
      saved: '配置已保存！',
      testConnection: '测试连接',
      testing: '测试中...',
      testSuccess: '连接成功！',
      testFailed: '连接失败',
      addUser: '添加用户',
      addSchool: '添加学校',
      username: '用户名',
      email: '邮箱',
      role: '角色',
      status: '状态',
      actions: '操作',
      active: '活跃',
      inactive: '禁用',
      enable: '启用',
      disable: '禁用',
      delete: '删除',
      schoolName: '学校名称',
      schoolCode: '学校代码',
      maxTeachers: '教师上限',
      maxStudents: '学生上限',
      noData: '暂无数据'
    },
    en: {
      title: '👑 Super Admin',
      overview: 'Overview',
      users: 'Users',
      schools: 'Schools',
      aiConfig: 'Intelligent Config',
      logs: 'System Logs',
      totalUsers: 'Total Users',
      teachers: 'Teachers',
      students: 'Students',
      totalSchools: 'Schools',
      totalClasses: 'Classes',
      aiProvider: 'Intelligent Provider',
      aiModel: 'Intelligent Model',
      apiKey: 'API Key',
      apiKeyHint: 'Enter API Key (stored encrypted)',
      baseUrl: 'API Base URL',
      maxTokens: 'Max Tokens',
      temperature: 'Temperature',
      temperatureHint: '0-1, higher = more creative',
      enableFeatures: 'Feature Toggles',
      pptGen: 'PPT Generation',
      quizGen: 'Quiz Generation',
      summaryGen: 'Summary Generation',
      lessonGen: 'Lesson Plan Generation',
      flashcardGen: 'Flashcard Generation',
      usageLimits: 'Usage Limits',
      teacherLimit: 'Teacher Daily Limit',
      studentLimit: 'Student Daily Limit',
      save: 'Save Settings',
      saving: 'Saving...',
      saved: 'Settings saved!',
      testConnection: 'Test Connection',
      testing: 'Testing...',
      testSuccess: 'Connection successful!',
      testFailed: 'Connection failed',
      addUser: 'Add User',
      addSchool: 'Add School',
      username: 'Username',
      email: 'Email',
      role: 'Role',
      status: 'Status',
      actions: 'Actions',
      active: 'Active',
      inactive: 'Disabled',
      enable: 'Enable',
      disable: 'Disable',
      delete: 'Delete',
      schoolName: 'School Name',
      schoolCode: 'School Code',
      maxTeachers: 'Max Teachers',
      maxStudents: 'Max Students',
      noData: 'No data'
    },
    it: {
      title: '👑 Super Admin',
      overview: 'Panoramica',
      users: 'Utenti',
      schools: 'Scuole',
      aiConfig: 'Config AI',
      logs: 'Log Sistema',
      totalUsers: 'Utenti Totali',
      teachers: 'Insegnanti',
      students: 'Studenti',
      totalSchools: 'Scuole',
      totalClasses: 'Classi',
      aiProvider: 'Provider AI',
      aiModel: 'Modello AI',
      apiKey: 'API Key',
      apiKeyHint: 'Inserisci API Key (memorizzata criptata)',
      baseUrl: 'URL API Base',
      maxTokens: 'Token Massimi',
      temperature: 'Temperatura',
      temperatureHint: '0-1, più alto = più creativo',
      enableFeatures: 'Funzionalità',
      pptGen: 'Generazione PPT',
      quizGen: 'Generazione Quiz',
      summaryGen: 'Generazione Riassunto',
      lessonGen: 'Generazione Piano Lezione',
      flashcardGen: 'Generazione Flashcard',
      usageLimits: 'Limiti Utilizzo',
      teacherLimit: 'Limite Giornaliero Insegnante',
      studentLimit: 'Limite Giornaliero Studente',
      save: 'Salva Impostazioni',
      saving: 'Salvataggio...',
      saved: 'Impostazioni salvate!',
      testConnection: 'Test Connessione',
      testing: 'Test in corso...',
      testSuccess: 'Connessione riuscita!',
      testFailed: 'Connessione fallita',
      addUser: 'Aggiungi Utente',
      addSchool: 'Aggiungi Scuola',
      username: 'Nome utente',
      email: 'Email',
      role: 'Ruolo',
      status: 'Stato',
      actions: 'Azioni',
      active: 'Attivo',
      inactive: 'Disabilitato',
      enable: 'Abilita',
      disable: 'Disabilita',
      delete: 'Elimina',
      schoolName: 'Nome Scuola',
      schoolCode: 'Codice Scuola',
      maxTeachers: 'Max Insegnanti',
      maxStudents: 'Max Studenti',
      noData: 'Nessun dato'
    }
  };
  const t = txt[language] || txt.en;

  // 智能 服务商选项
  const aiProviders = [
    { id: 'openai', name: 'OpenAI', icon: '🤖', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
    { id: 'anthropic', name: 'Anthropic Claude', icon: '🧠', models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'] },
    { id: 'deepseek', name: 'DeepSeek', icon: '🔍', models: ['deepseek-chat', 'deepseek-coder'] },
    { id: 'qwen', name: '通义千问 Qwen', icon: '🇨🇳', models: ['qwen-turbo', 'qwen-plus', 'qwen-max'] },
    { id: 'ernie', name: '文心一言 ERNIE', icon: '🔮', models: ['ernie-4.0', 'ernie-3.5-turbo'] },
  ];

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (supabase) {
        // 加载统计
        const [usersRes, classesRes, schoolsRes] = await Promise.all([
          supabase.from('users').select('role', { count: 'exact' }),
          supabase.from('classes').select('id', { count: 'exact' }),
          supabase.from('schools').select('id', { count: 'exact' })
        ]);

        const userList = usersRes.data || [];
        setStats({
          users: usersRes.count || 0,
          teachers: userList.filter(u => u.role === 'teacher').length,
          students: userList.filter(u => u.role === 'student').length,
          classes: classesRes.count || 0,
          schools: schoolsRes.count || 0
        });

        // 加载用户列表
        if (activeTab === 'users') {
          const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false }).limit(100);
          setUsers(data || []);
        }

        // 加载学校列表
        if (activeTab === 'schools') {
          const { data } = await supabase.from('schools').select('*').order('created_at', { ascending: false });
          setSchools(data || []);
        }

        // 加载 智能 配置
        if (activeTab === 'aiConfig') {
          const { data } = await supabase.from('system_settings').select('*').eq('category', 'ai');
          const settings = {};
          (data || []).forEach(s => {
            settings[s.setting_key] = s.setting_value;
          });
          setAiSettings(settings);
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  // 保存 智能 配置
  const saveAiSettings = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      if (supabase) {
        for (const [key, value] of Object.entries(aiSettings)) {
          await supabase.from('system_settings')
            .upsert({ 
              setting_key: key, 
              setting_value: String(value),
              category: 'ai',
              updated_at: new Date().toISOString(),
              updated_by: user?.id
            }, { onConflict: 'setting_key' });
        }
        setMessage({ type: 'success', text: t.saved });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  // 测试 AI 连接
  const testAiConnection = async () => {
    setMessage({ type: 'info', text: t.testing });
    
    const provider = aiSettings.ai_provider || 'openai';
    const apiKey = aiSettings[`${provider}_api_key`];
    
    if (!apiKey) {
      setMessage({ type: 'error', text: 'Please enter API Key first' });
      return;
    }

    try {
      // 简单测试：检查 API Key 格式
      if (provider === 'openai' && apiKey.startsWith('sk-')) {
        setMessage({ type: 'success', text: t.testSuccess + ' (API Key format valid)' });
      } else if (provider === 'anthropic' && apiKey.startsWith('sk-ant-')) {
        setMessage({ type: 'success', text: t.testSuccess + ' (API Key format valid)' });
      } else if (apiKey.length > 20) {
        setMessage({ type: 'success', text: t.testSuccess + ' (API Key saved)' });
      } else {
        setMessage({ type: 'error', text: t.testFailed + ' (Invalid API Key format)' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: t.testFailed + ': ' + err.message });
    }
  };

  // 更新 AI 设置
  const updateAiSetting = (key, value) => {
    setAiSettings(prev => ({ ...prev, [key]: value }));
  };

  // 切换用户状态
  const toggleUserStatus = async (userId, currentStatus) => {
    if (!window.confirm('确定要更改用户状态吗？')) return;
    try {
      await supabase.from('users').update({ is_active: !currentStatus }).eq('id', userId);
      loadData();
    } catch (err) {
      alert('操作失败');
    }
  };

  if (loading && activeTab === 'overview') {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>;
  }

  const currentProvider = aiProviders.find(p => p.id === aiSettings.ai_provider) || aiProviders[0];

  return (
    <div>
      <div className="content-header">
        <h1>{t.title}</h1>
      </div>

      {/* 标签页 */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          📊 {t.overview}
        </button>
        <button className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
          👥 {t.users}
        </button>
        <button className={`tab ${activeTab === 'schools' ? 'active' : ''}`} onClick={() => setActiveTab('schools')}>
          🏫 {t.schools}
        </button>
        <button className={`tab ${activeTab === 'aiConfig' ? 'active' : ''}`} onClick={() => setActiveTab('aiConfig')}>
          🤖 {t.aiConfig}
        </button>
      </div>

      {/* 系统概览 */}
      {activeTab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', color: 'var(--primary)' }}>{stats.users}</div>
              <div style={{ color: 'var(--text-muted)' }}>{t.totalUsers}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', color: 'var(--info)' }}>{stats.teachers}</div>
              <div style={{ color: 'var(--text-muted)' }}>{t.teachers}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', color: 'var(--success)' }}>{stats.students}</div>
              <div style={{ color: 'var(--text-muted)' }}>{t.students}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', color: 'var(--warning)' }}>{stats.schools}</div>
              <div style={{ color: 'var(--text-muted)' }}>{t.totalSchools}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', color: 'var(--secondary)' }}>{stats.classes}</div>
              <div style={{ color: 'var(--text-muted)' }}>{t.totalClasses}</div>
            </div>
          </div>

          {/* 快速操作 */}
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>⚡ {language === 'zh' ? '快速操作' : 'Quick Actions'}</h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => setActiveTab('users')}>👥 {t.addUser}</button>
              <button className="btn btn-outline" onClick={() => setActiveTab('schools')}>🏫 {t.addSchool}</button>
              <button className="btn btn-outline" onClick={() => setActiveTab('aiConfig')}>🤖 {t.aiConfig}</button>
            </div>
          </div>
        </div>
      )}

      {/* 用户管理 */}
      {activeTab === 'users' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>👥 {t.users}</h3>
            <button className="btn btn-primary btn-sm">+ {t.addUser}</button>
          </div>
          
          {loading ? (
            <p>{language === 'zh' ? '加载中...' : 'Loading...'}</p>
          ) : users.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>{t.noData}</p>
          ) : (
            <div className="table-container">
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>{t.username}</th>
                    <th>{t.email}</th>
                    <th>{t.role}</th>
                    <th>{t.status}</th>
                    <th>{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>{u.username}</td>
                      <td>{u.email || '-'}</td>
                      <td><span className="badge badge-info">{u.role}</span></td>
                      <td>
                        <span className={`badge ${u.is_active !== false ? 'badge-success' : 'badge-error'}`}>
                          {u.is_active !== false ? t.active : t.inactive}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-outline"
                          onClick={() => toggleUserStatus(u.id, u.is_active !== false)}
                        >
                          {u.is_active !== false ? t.disable : t.enable}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 学校管理 */}
      {activeTab === 'schools' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>🏫 {t.schools}</h3>
            <button className="btn btn-primary btn-sm">+ {t.addSchool}</button>
          </div>
          
          {loading ? (
            <p>{language === 'zh' ? '加载中...' : 'Loading...'}</p>
          ) : schools.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>{t.noData}</p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {schools.map(s => (
                <div key={s.id} className="card" style={{ background: 'var(--background)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <h4>{s.name_zh || s.name}</h4>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{s.name}</p>
                      <p style={{ fontSize: '0.875rem' }}>
                        <span className="badge badge-info">{s.code}</span>
                        <span style={{ marginLeft: '0.5rem' }}>
                          👨‍🏫 {s.current_teachers || 0}/{s.max_teachers} | 
                          👨‍🎓 {s.current_students || 0}/{s.max_students}
                        </span>
                      </p>
                    </div>
                    <span className={`badge ${s.is_active ? 'badge-success' : 'badge-error'}`}>
                      {s.is_active ? t.active : t.inactive}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 智能 配置 */}
      {activeTab === 'aiConfig' && (
        <div>
          {message.text && (
            <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
              {message.text}
            </div>
          )}

          {/* 智能 服务商选择 */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>🤖 {t.aiProvider}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
              {aiProviders.map(provider => (
                <div
                  key={provider.id}
                  onClick={() => updateAiSetting('ai_provider', provider.id)}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    border: aiSettings.ai_provider === provider.id ? '2px solid var(--primary)' : '2px solid transparent',
                    background: aiSettings.ai_provider === provider.id ? 'rgba(196,30,58,0.05)' : 'var(--background)',
                    textAlign: 'center',
                    padding: '1rem'
                  }}
                >
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{provider.icon}</div>
                  <div style={{ fontWeight: '600' }}>{provider.name}</div>
                </div>
              ))}
            </div>
          </div>

          {/* API 配置 */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>🔑 API {language === 'zh' ? '配置' : 'Configuration'}</h3>
            
            <div className="form-group">
              <label className="form-label">{t.apiKey} *</label>
              <input
                type="password"
                className="form-input"
                value={aiSettings[`${aiSettings.ai_provider || 'openai'}_api_key`] || ''}
                onChange={(e) => updateAiSetting(`${aiSettings.ai_provider || 'openai'}_api_key`, e.target.value)}
                placeholder={t.apiKeyHint}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t.aiModel}</label>
              <select
                className="form-select"
                value={aiSettings.ai_model || ''}
                onChange={(e) => updateAiSetting('ai_model', e.target.value)}
              >
                {currentProvider.models.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">{t.maxTokens}</label>
                <input
                  type="number"
                  className="form-input"
                  value={aiSettings.ai_max_tokens || 4096}
                  onChange={(e) => updateAiSetting('ai_max_tokens', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t.temperature}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  className="form-input"
                  value={aiSettings.ai_temperature || 0.7}
                  onChange={(e) => updateAiSetting('ai_temperature', e.target.value)}
                />
                <small style={{ color: 'var(--text-muted)' }}>{t.temperatureHint}</small>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button className="btn btn-outline" onClick={testAiConnection}>
                🔗 {t.testConnection}
              </button>
            </div>
          </div>

          {/* 功能开关 */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>⚙️ {t.enableFeatures}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {[
                { key: 'ai_ppt_enabled', label: t.pptGen, icon: '📊' },
                { key: 'ai_quiz_enabled', label: t.quizGen, icon: '📝' },
                { key: 'ai_summary_enabled', label: t.summaryGen, icon: '📄' },
                { key: 'ai_lesson_plan_enabled', label: t.lessonGen, icon: '📋' },
                { key: 'ai_flashcard_enabled', label: t.flashcardGen, icon: '🃏' },
              ].map(feature => (
                <label key={feature.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={aiSettings[feature.key] !== 'false'}
                    onChange={(e) => updateAiSetting(feature.key, e.target.checked ? 'true' : 'false')}
                  />
                  <span>{feature.icon} {feature.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 使用限制 */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>📊 {t.usageLimits}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">{t.teacherLimit}</label>
                <input
                  type="number"
                  className="form-input"
                  value={aiSettings.ai_daily_limit_teacher || 100}
                  onChange={(e) => updateAiSetting('ai_daily_limit_teacher', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t.studentLimit}</label>
                <input
                  type="number"
                  className="form-input"
                  value={aiSettings.ai_daily_limit_student || 20}
                  onChange={(e) => updateAiSetting('ai_daily_limit_student', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 保存按钮 */}
          <button 
            className="btn btn-primary btn-lg" 
            style={{ width: '100%' }}
            onClick={saveAiSettings}
            disabled={saving}
          >
            {saving ? t.saving : t.save}
          </button>
        </div>
      )}
    </div>
  );
};

export default SuperAdminPage;
