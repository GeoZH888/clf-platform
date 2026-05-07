import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import * as pdfjsLib from 'pdfjs-dist';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const HSKTestManagementPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState([]);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [audioFiles, setAudioFiles] = useState([]);
  const [activeTab, setActiveTab] = useState('papers');
  const [showModal, setShowModal] = useState(null); // 'paper', 'question', 'audio', 'transcribe'
  const [message, setMessage] = useState({ type: '', text: '' });
  const [aiConfig, setAiConfig] = useState(null);
  const [transcribing, setTranscribing] = useState({});
  const fileInputRef = useRef(null);
  const audioInputRef = useRef(null);

  const [paperForm, setPaperForm] = useState({
    name: '', name_zh: '', hsk_level: 4, year: new Date().getFullYear(),
    test_type: 'official', source: '', description: '',
    listening_questions: 0, reading_questions: 0, writing_questions: 0
  });

  const [questionForm, setQuestionForm] = useState({
    section_type: 'listening', question_number: 1, question_type: 'choice',
    question_text: '', question_text_zh: '', audio_url: '', audio_transcript: '',
    options: [{ id: 'A', text: '' }, { id: 'B', text: '' }, { id: 'C', text: '' }, { id: 'D', text: '' }],
    correct_answer: 'A', answer_explanation_zh: '', difficulty: 3, points: 1
  });

  const txt = {
    zh: {
      title: 'HSK真题管理',
      subtitle: '上传、管理HSK考试真题和模拟题',
      papers: '试卷管理',
      questions: '题目管理',
      audio: '音频管理',
      settings: '设置',
      addPaper: '添加试卷',
      addQuestion: '添加题目',
      uploadAudio: '上传音频',
      batchUpload: '批量上传',
      transcribe: '转录',
      transcribeAll: '全部转录',
      name: '试卷名称',
      nameZh: '中文名称',
      level: 'HSK等级',
      year: '年份',
      type: '类型',
      official: '真题',
      mock: '模拟题',
      practice: '练习题',
      source: '来源',
      listening: '听力',
      reading: '阅读',
      writing: '书写',
      questionCount: '题目数量',
      duration: '时长(分钟)',
      save: '保存',
      cancel: '取消',
      edit: '编辑',
      delete: '删除',
      view: '查看',
      noData: '暂无数据',
      uploadSuccess: '上传成功！',
      transcribeSuccess: '转录成功！',
      processing: '处理中...',
      pending: '待转录',
      completed: '已完成',
      failed: '失败',
      whisperAuto: 'Whisper自动转录',
      manualInput: '手动输入',
      transcript: '转录文本',
      playAudio: '播放音频',
      questionText: '题目内容',
      options: '选项',
      correctAnswer: '正确答案',
      explanation: '解析',
      difficulty: '难度',
      points: '分值'
    },
    en: {
      title: 'HSK Test Management',
      subtitle: 'Upload and manage HSK official and mock tests',
      papers: 'Test Papers',
      questions: 'Questions',
      audio: 'Audio Files',
      settings: 'Settings',
      addPaper: 'Add Paper',
      addQuestion: 'Add Question',
      uploadAudio: 'Upload Audio',
      batchUpload: 'Batch Upload',
      transcribe: 'Transcribe',
      transcribeAll: 'Transcribe All',
      name: 'Paper Name',
      nameZh: 'Chinese Name',
      level: 'HSK Level',
      year: 'Year',
      type: 'Type',
      official: 'Official',
      mock: 'Mock',
      practice: 'Practice',
      source: 'Source',
      listening: 'Listening',
      reading: 'Reading',
      writing: 'Writing',
      questionCount: 'Question Count',
      duration: 'Duration (min)',
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      view: 'View',
      noData: 'No data',
      uploadSuccess: 'Upload successful!',
      transcribeSuccess: 'Transcription complete!',
      processing: 'Processing...',
      pending: 'Pending',
      completed: 'Completed',
      failed: 'Failed',
      whisperAuto: 'Whisper Auto-transcribe',
      manualInput: 'Manual Input',
      transcript: 'Transcript',
      playAudio: 'Play Audio',
      questionText: 'Question Text',
      options: 'Options',
      correctAnswer: 'Correct Answer',
      explanation: 'Explanation',
      difficulty: 'Difficulty',
      points: 'Points'
    }
  };
  const t = txt[language] || txt.zh;

  // Load data
  useEffect(() => {
    loadData();
  }, [supabase]);

  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // Load AI config
      const { data: configData } = await supabase.from('dwxz_rag_config').select('*').limit(1).single();
      setAiConfig(configData);

      // Load papers
      const { data: papersData } = await supabase
        .from('dwxz_hsk_test_papers')
        .select('*')
        .order('hsk_level', { ascending: true })
        .order('year', { ascending: false });
      setPapers(papersData || []);

      // Load audio files
      const { data: audioData } = await supabase
        .from('dwxz_hsk_audio_files')
        .select('*')
        .order('created_at', { ascending: false });
      setAudioFiles(audioData || []);

    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async (paperId) => {
    if (!supabase || !paperId) return;
    const { data } = await supabase
      .from('dwxz_hsk_test_questions')
      .select('*')
      .eq('paper_id', paperId)
      .order('question_number', { ascending: true });
    setQuestions(data || []);
  };

  // Save paper
  const handleSavePaper = async () => {
    if (!supabase) return;
    try {
      const total = (parseInt(paperForm.listening_questions) || 0) + 
                    (parseInt(paperForm.reading_questions) || 0) + 
                    (parseInt(paperForm.writing_questions) || 0);
      
      const payload = {
        ...paperForm,
        total_questions: total,
        created_by: user?.id
      };

      if (paperForm.id) {
        await supabase.from('dwxz_hsk_test_papers').update(payload).eq('id', paperForm.id);
      } else {
        await supabase.from('dwxz_hsk_test_papers').insert([payload]);
      }
      
      setMessage({ type: 'success', text: '✅ 保存成功！' });
      setShowModal(null);
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Save question
  const handleSaveQuestion = async () => {
    if (!supabase || !selectedPaper) return;
    try {
      const payload = {
        ...questionForm,
        paper_id: selectedPaper.id,
        options: JSON.stringify(questionForm.options)
      };

      if (questionForm.id) {
        await supabase.from('dwxz_hsk_test_questions').update(payload).eq('id', questionForm.id);
      } else {
        await supabase.from('dwxz_hsk_test_questions').insert([payload]);
      }
      
      setMessage({ type: 'success', text: '✅ 题目保存成功！' });
      setShowModal(null);
      loadQuestions(selectedPaper.id);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Upload audio files
  const handleAudioUpload = async (files) => {
    if (!supabase || !files.length) return;
    
    setMessage({ type: 'info', text: `⏳ 上传 ${files.length} 个音频文件...` });
    
    for (const file of files) {
      try {
        // For now, store file info (in production, upload to Supabase Storage)
        const audioRecord = {
          paper_id: selectedPaper?.id,
          filename: file.name,
          original_filename: file.name,
          file_size: file.size,
          transcription_status: 'pending'
        };
        
        await supabase.from('dwxz_hsk_audio_files').insert([audioRecord]);
      } catch (err) {
        console.error('Upload error:', err);
      }
    }
    
    setMessage({ type: 'success', text: t.uploadSuccess });
    loadData();
  };

  // Transcribe audio with Whisper
  const handleTranscribe = async (audioFile) => {
    if (!aiConfig?.openai_api_key) {
      setMessage({ type: 'error', text: '❌ 请先配置OpenAI API Key' });
      return;
    }

    setTranscribing(prev => ({ ...prev, [audioFile.id]: true }));
    
    try {
      // Update status to processing
      await supabase
        .from('dwxz_hsk_audio_files')
        .update({ transcription_status: 'processing' })
        .eq('id', audioFile.id);

      // In production, you would:
      // 1. Get the audio file from storage
      // 2. Send to Whisper API
      // 3. Store the transcript
      
      // For demo, simulate Whisper API call
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiConfig.openai_api_key}`
        },
        body: (() => {
          const formData = new FormData();
          // formData.append('file', audioBlob);  // Would need actual audio file
          formData.append('model', 'whisper-1');
          formData.append('language', 'zh');
          formData.append('response_format', 'verbose_json');
          return formData;
        })()
      });

      if (!response.ok) {
        throw new Error('Whisper API failed');
      }

      const result = await response.json();
      
      // Update with transcript
      await supabase
        .from('dwxz_hsk_audio_files')
        .update({
          transcript: result.text,
          transcription_status: 'completed',
          transcript_source: 'whisper',
          duration: Math.round(result.duration || 0)
        })
        .eq('id', audioFile.id);

      setMessage({ type: 'success', text: t.transcribeSuccess });
      loadData();
      
    } catch (err) {
      console.error('Transcription error:', err);
      await supabase
        .from('dwxz_hsk_audio_files')
        .update({
          transcription_status: 'failed',
          transcription_error: err.message
        })
        .eq('id', audioFile.id);
      setMessage({ type: 'error', text: '转录失败: ' + err.message });
    } finally {
      setTranscribing(prev => ({ ...prev, [audioFile.id]: false }));
    }
  };

  // Manual transcript input
  const handleManualTranscript = async (audioId, transcript) => {
    if (!supabase) return;
    try {
      await supabase
        .from('dwxz_hsk_audio_files')
        .update({
          transcript,
          transcription_status: 'completed',
          transcript_source: 'manual'
        })
        .eq('id', audioId);
      setMessage({ type: 'success', text: '✅ 手动转录已保存' });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Delete paper
  const handleDeletePaper = async (id) => {
    if (!confirm('确定删除此试卷？所有题目和音频也将被删除。')) return;
    await supabase.from('dwxz_hsk_test_papers').delete().eq('id', id);
    loadData();
  };

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>;
  }

  return (
    <div>
      <div className="content-header">
        <div>
          <h1>📝 {t.title}</h1>
          <p style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
        </div>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
          {message.text}
          <button onClick={() => setMessage({ type: '', text: '' })} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        {['papers', 'questions', 'audio', 'import'].map(tab => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'papers' && '📋'} {tab === 'questions' && '❓'} {tab === 'audio' && '🎧'} {tab === 'import' && '📥'} {tab === 'import' ? (language === 'zh' ? 'PDF导入' : 'PDF Import') : t[tab]}
          </button>
        ))}
      </div>

      {/* Papers Tab */}
      {activeTab === 'papers' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[1, 2, 3, 4, 5, 6].map(level => (
                <button key={level} className="btn btn-outline btn-sm">HSK{level}</button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={() => {
              setPaperForm({ name: '', name_zh: '', hsk_level: 4, year: new Date().getFullYear(), test_type: 'official', source: '', description: '', listening_questions: 0, reading_questions: 0, writing_questions: 0 });
              setShowModal('paper');
            }}>
              + {t.addPaper}
            </button>
          </div>

          <div className="card">
            {papers.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>{t.noData}</p>
            ) : (
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>HSK</th>
                    <th>{t.nameZh}</th>
                    <th>{t.year}</th>
                    <th>{t.type}</th>
                    <th>{t.listening}</th>
                    <th>{t.reading}</th>
                    <th>{t.writing}</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {papers.map(p => (
                    <tr key={p.id}>
                      <td><span className="badge badge-info">HSK{p.hsk_level}</span></td>
                      <td style={{ fontWeight: 600 }}>{p.name_zh || p.name}</td>
                      <td>{p.year}</td>
                      <td><span className="badge">{t[p.test_type] || p.test_type}</span></td>
                      <td>{p.listening_questions}</td>
                      <td>{p.reading_questions}</td>
                      <td>{p.writing_questions}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="btn btn-outline btn-sm" onClick={() => {
                            setSelectedPaper(p);
                            loadQuestions(p.id);
                            setActiveTab('questions');
                          }}>📋</button>
                          <button className="btn btn-outline btn-sm" onClick={() => {
                            setPaperForm(p);
                            setShowModal('paper');
                          }}>✏️</button>
                          <button className="btn btn-outline btn-sm" onClick={() => handleDeletePaper(p.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Questions Tab */}
      {activeTab === 'questions' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <select 
                className="form-select" 
                value={selectedPaper?.id || ''}
                onChange={e => {
                  const p = papers.find(x => x.id === e.target.value);
                  setSelectedPaper(p);
                  if (p) loadQuestions(p.id);
                }}
                style={{ minWidth: '250px' }}
              >
                <option value="">-- 选择试卷 --</option>
                {papers.map(p => (
                  <option key={p.id} value={p.id}>HSK{p.hsk_level} {p.name_zh} ({p.year})</option>
                ))}
              </select>
            </div>
            <button 
              className="btn btn-primary" 
              disabled={!selectedPaper}
              onClick={() => {
                setQuestionForm({
                  section_type: 'listening', question_number: questions.length + 1, question_type: 'choice',
                  question_text: '', question_text_zh: '', audio_url: '', audio_transcript: '',
                  options: [{ id: 'A', text: '' }, { id: 'B', text: '' }, { id: 'C', text: '' }, { id: 'D', text: '' }],
                  correct_answer: 'A', answer_explanation_zh: '', difficulty: 3, points: 1
                });
                setShowModal('question');
              }}
            >
              + {t.addQuestion}
            </button>
          </div>

          {selectedPaper && (
            <div className="card" style={{ marginBottom: '1rem', background: 'var(--background)' }}>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <div><strong>📋 {selectedPaper.name_zh}</strong></div>
                <div>🎧 听力: {selectedPaper.listening_questions}题</div>
                <div>📖 阅读: {selectedPaper.reading_questions}题</div>
                <div>✍️ 书写: {selectedPaper.writing_questions}题</div>
              </div>
            </div>
          )}

          <div className="card">
            {questions.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                {selectedPaper ? '暂无题目，点击上方按钮添加' : '请先选择试卷'}
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {questions.map(q => (
                  <div key={q.id} style={{ padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', display: 'flex', gap: '1rem', alignItems: 'start' }}>
                    <div style={{ 
                      width: '40px', height: '40px', borderRadius: '50%', 
                      background: q.section_type === 'listening' ? 'var(--primary)' : q.section_type === 'reading' ? 'var(--info)' : 'var(--success)',
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600
                    }}>
                      {q.question_number}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span className="badge">{t[q.section_type]}</span>
                        <span className="badge badge-info">{q.question_type}</span>
                        {q.audio_url && <span className="badge" style={{ background: 'var(--warning)' }}>🎧 有音频</span>}
                      </div>
                      <p style={{ margin: 0 }}>{q.question_text_zh || q.question_text || '(无题目文本)'}</p>
                      {q.audio_transcript && (
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          📝 {q.audio_transcript.substring(0, 100)}...
                        </p>
                      )}
                    </div>
                    <div>
                      <button className="btn btn-outline btn-sm" onClick={() => {
                        setQuestionForm({ ...q, options: JSON.parse(q.options || '[]') });
                        setShowModal('question');
                      }}>✏️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Audio Tab */}
      {activeTab === 'audio' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select 
                className="form-select"
                value={selectedPaper?.id || ''}
                onChange={e => {
                  const p = papers.find(x => x.id === e.target.value);
                  setSelectedPaper(p);
                }}
              >
                <option value="">全部音频</option>
                {papers.map(p => (
                  <option key={p.id} value={p.id}>HSK{p.hsk_level} {p.name_zh}</option>
                ))}
              </select>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                共 {audioFiles.filter(a => !selectedPaper || a.paper_id === selectedPaper.id).length} 个音频
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg"
                multiple
                style={{ display: 'none' }}
                onChange={e => handleAudioUpload(Array.from(e.target.files))}
              />
              <button className="btn btn-outline" onClick={() => audioInputRef.current?.click()}>
                📤 {t.uploadAudio}
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  const pending = audioFiles.filter(a => a.transcription_status === 'pending');
                  pending.forEach(a => handleTranscribe(a));
                }}
              >
                🎤 {t.transcribeAll}
              </button>
            </div>
          </div>

          {/* Transcription Status Summary */}
          <div className="card" style={{ marginBottom: '1rem', display: 'flex', gap: '2rem' }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 600 }}>{audioFiles.filter(a => a.transcription_status === 'completed').length}</div>
              <div style={{ color: 'var(--success)', fontSize: '0.875rem' }}>✅ {t.completed}</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 600 }}>{audioFiles.filter(a => a.transcription_status === 'pending').length}</div>
              <div style={{ color: 'var(--warning)', fontSize: '0.875rem' }}>⏳ {t.pending}</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 600 }}>{audioFiles.filter(a => a.transcription_status === 'processing').length}</div>
              <div style={{ color: 'var(--info)', fontSize: '0.875rem' }}>🔄 {t.processing}</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 600 }}>{audioFiles.filter(a => a.transcription_status === 'failed').length}</div>
              <div style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>❌ {t.failed}</div>
            </div>
          </div>

          {/* Audio Files List */}
          <div className="card">
            {audioFiles.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>{t.noData}</p>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {audioFiles
                  .filter(a => !selectedPaper || a.paper_id === selectedPaper.id)
                  .map(audio => (
                  <div key={audio.id} style={{ 
                    padding: '1rem', 
                    background: 'var(--background)', 
                    borderRadius: 'var(--radius-md)',
                    border: audio.transcription_status === 'completed' ? '1px solid var(--success)' : '1px solid var(--border)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '1.5rem' }}>🎵</span>
                          <strong>{audio.filename}</strong>
                          <span className={`badge ${
                            audio.transcription_status === 'completed' ? 'badge-success' : 
                            audio.transcription_status === 'processing' ? 'badge-info' :
                            audio.transcription_status === 'failed' ? '' : ''
                          }`} style={{
                            background: audio.transcription_status === 'failed' ? 'var(--danger)' : 
                                        audio.transcription_status === 'pending' ? 'var(--warning)' : undefined
                          }}>
                            {t[audio.transcription_status] || audio.transcription_status}
                          </span>
                          {audio.transcript_source && (
                            <span className="badge" style={{ background: audio.transcript_source === 'whisper' ? 'var(--primary)' : 'var(--info)' }}>
                              {audio.transcript_source === 'whisper' ? '🤖 Whisper' : '✋ 手动'}
                            </span>
                          )}
                        </div>
                        
                        {audio.transcript ? (
                          <div style={{ background: 'var(--card)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>
                            <strong>📝 转录文本:</strong>
                            <p style={{ margin: '0.5rem 0 0', whiteSpace: 'pre-wrap' }}>{audio.transcript}</p>
                          </div>
                        ) : (
                          <div style={{ marginTop: '0.5rem' }}>
                            <textarea
                              className="form-textarea"
                              placeholder="输入手动转录文本..."
                              rows={2}
                              style={{ width: '100%' }}
                              onBlur={e => {
                                if (e.target.value.trim()) {
                                  handleManualTranscript(audio.id, e.target.value.trim());
                                }
                              }}
                            />
                          </div>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                        {audio.file_url && (
                          <button className="btn btn-outline btn-sm">▶️</button>
                        )}
                        {audio.transcription_status !== 'completed' && (
                          <button 
                            className="btn btn-primary btn-sm"
                            disabled={transcribing[audio.id]}
                            onClick={() => handleTranscribe(audio)}
                          >
                            {transcribing[audio.id] ? '⏳' : '🎤'} {t.transcribe}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* PDF Import Tab */}
      {activeTab === 'import' && (
        <PDFImportSection 
          supabase={supabase} 
          papers={papers}
          aiConfig={aiConfig}
          onImportComplete={() => {
            loadData();
            setMessage({ type: 'success', text: '✅ 导入成功！' });
          }}
          onError={(err) => setMessage({ type: 'error', text: '❌ ' + err })}
          language={language}
        />
      )}

      {/* Paper Modal */}
      {showModal === 'paper' && (
        <div className="modal-overlay" onClick={() => setShowModal(null)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem' }}>📋 {paperForm.id ? '编辑试卷' : '添加试卷'}</h3>
            
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t.name}</label>
                  <input className="form-input" value={paperForm.name} onChange={e => setPaperForm({ ...paperForm, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t.nameZh}</label>
                  <input className="form-input" value={paperForm.name_zh} onChange={e => setPaperForm({ ...paperForm, name_zh: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t.level}</label>
                  <select className="form-select" value={paperForm.hsk_level} onChange={e => setPaperForm({ ...paperForm, hsk_level: parseInt(e.target.value) })}>
                    {[1,2,3,4,5,6].map(l => <option key={l} value={l}>HSK {l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t.year}</label>
                  <input type="number" className="form-input" value={paperForm.year} onChange={e => setPaperForm({ ...paperForm, year: parseInt(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t.type}</label>
                  <select className="form-select" value={paperForm.test_type} onChange={e => setPaperForm({ ...paperForm, test_type: e.target.value })}>
                    <option value="official">{t.official}</option>
                    <option value="mock">{t.mock}</option>
                    <option value="practice">{t.practice}</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t.source}</label>
                <input className="form-input" value={paperForm.source} onChange={e => setPaperForm({ ...paperForm, source: e.target.value })} placeholder="e.g., 汉考国际" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">🎧 {t.listening}</label>
                  <input type="number" className="form-input" value={paperForm.listening_questions} onChange={e => setPaperForm({ ...paperForm, listening_questions: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label className="form-label">📖 {t.reading}</label>
                  <input type="number" className="form-input" value={paperForm.reading_questions} onChange={e => setPaperForm({ ...paperForm, reading_questions: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label className="form-label">✍️ {t.writing}</label>
                  <input type="number" className="form-input" value={paperForm.writing_questions} onChange={e => setPaperForm({ ...paperForm, writing_questions: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setShowModal(null)}>{t.cancel}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSavePaper}>{t.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* Question Modal */}
      {showModal === 'question' && (
        <div className="modal-overlay" onClick={() => setShowModal(null)}>
          <div className="modal-content" style={{ maxWidth: '700px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem' }}>❓ {questionForm.id ? '编辑题目' : '添加题目'}</h3>
            
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">部分</label>
                  <select className="form-select" value={questionForm.section_type} onChange={e => setQuestionForm({ ...questionForm, section_type: e.target.value })}>
                    <option value="listening">🎧 {t.listening}</option>
                    <option value="reading">📖 {t.reading}</option>
                    <option value="writing">✍️ {t.writing}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">题号</label>
                  <input type="number" className="form-input" value={questionForm.question_number} onChange={e => setQuestionForm({ ...questionForm, question_number: parseInt(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label className="form-label">题型</label>
                  <select className="form-select" value={questionForm.question_type} onChange={e => setQuestionForm({ ...questionForm, question_type: e.target.value })}>
                    <option value="choice">选择题</option>
                    <option value="true_false">判断题</option>
                    <option value="fill_blank">填空题</option>
                    <option value="match">匹配题</option>
                    <option value="short_answer">简答题</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t.difficulty}</label>
                  <select className="form-select" value={questionForm.difficulty} onChange={e => setQuestionForm({ ...questionForm, difficulty: parseInt(e.target.value) })}>
                    {[1,2,3,4,5].map(d => <option key={d} value={d}>{'⭐'.repeat(d)}</option>)}
                  </select>
                </div>
              </div>

              {questionForm.section_type === 'listening' && (
                <div className="form-group" style={{ background: 'var(--background)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <label className="form-label">🎧 音频转录文本</label>
                  <textarea 
                    className="form-textarea" 
                    rows={3}
                    value={questionForm.audio_transcript}
                    onChange={e => setQuestionForm({ ...questionForm, audio_transcript: e.target.value })}
                    placeholder="男：你好，请问图书馆怎么走？&#10;女：一直往前走，到路口左转就到了。"
                  />
                  <small style={{ color: 'var(--text-muted)' }}>从音频管理中复制转录文本，或手动输入</small>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">{t.questionText}</label>
                <textarea className="form-textarea" rows={2} value={questionForm.question_text_zh} onChange={e => setQuestionForm({ ...questionForm, question_text_zh: e.target.value })} placeholder="请选择正确答案" />
              </div>

              {questionForm.question_type === 'choice' && (
                <div className="form-group">
                  <label className="form-label">{t.options}</label>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {questionForm.options.map((opt, idx) => (
                      <div key={opt.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ 
                          width: '30px', height: '30px', borderRadius: '50%', 
                          background: questionForm.correct_answer === opt.id ? 'var(--success)' : 'var(--border)',
                          color: questionForm.correct_answer === opt.id ? 'white' : 'inherit',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', fontWeight: 600
                        }} onClick={() => setQuestionForm({ ...questionForm, correct_answer: opt.id })}>
                          {opt.id}
                        </span>
                        <input 
                          className="form-input" 
                          style={{ flex: 1 }}
                          value={opt.text}
                          onChange={e => {
                            const newOpts = [...questionForm.options];
                            newOpts[idx].text = e.target.value;
                            setQuestionForm({ ...questionForm, options: newOpts });
                          }}
                          placeholder={`选项 ${opt.id}`}
                        />
                      </div>
                    ))}
                  </div>
                  <small style={{ color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>点击字母圆圈设置正确答案</small>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">{t.explanation}</label>
                <textarea className="form-textarea" rows={2} value={questionForm.answer_explanation_zh} onChange={e => setQuestionForm({ ...questionForm, answer_explanation_zh: e.target.value })} placeholder="答案解析..." />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setShowModal(null)}>{t.cancel}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveQuestion}>{t.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// PDF Import Section Component
// ============================================================
const PDFImportSection = ({ supabase, papers, aiConfig, onImportComplete, onError, language }) => {
  const [pdfFile, setPdfFile] = useState(null);
  const [audioFiles, setAudioFiles] = useState([]);
  const [extractedText, setExtractedText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [targetPaper, setTargetPaper] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [step, setStep] = useState(1); // 1: Upload, 2: Parse, 3: Review, 4: Import
  const [newPaperForm, setNewPaperForm] = useState({
    name: '', name_zh: '', hsk_level: 4, year: new Date().getFullYear(), test_type: 'official'
  });
  const [createNewPaper, setCreateNewPaper] = useState(true);
  const [zipContents, setZipContents] = useState({ pdfs: [], audios: [] });
  
  const pdfInputRef = React.useRef(null);
  const audioInputRef = React.useRef(null);
  const zipInputRef = React.useRef(null);
  const folderInputRef = React.useRef(null);

  const txt = {
    zh: {
      step1Title: '第1步：上传文件',
      step2Title: '第2步：AI解析题目',
      step3Title: '第3步：检查确认',
      step4Title: '第4步：导入完成',
      uploadPDF: '上传PDF试卷',
      uploadZIP: '上传ZIP压缩包',
      uploadAudio: '上传音频文件（可选）',
      selectPDF: '选择PDF文件',
      selectZIP: '选择ZIP文件',
      selectAudio: '选择音频文件',
      dragDrop: '或拖拽文件到此处',
      supportedFormats: '支持: PDF',
      zipFormats: '支持: ZIP (包含PDF+音频)',
      audioFormats: '支持: MP3, WAV, M4A',
      extractText: '提取文本',
      parseWithAI: 'AI解析题目',
      autoProcess: '🚀 一键自动处理',
      targetPaper: '目标试卷',
      createNew: '创建新试卷',
      selectExisting: '选择已有试卷',
      extractedText: '提取的文本',
      parsedQuestions: '解析的题目',
      questionCount: '共解析出 {count} 道题目',
      importAll: '全部导入',
      importing: '导入中...',
      noQuestions: '未解析出题目，请检查PDF内容或手动添加',
      aiNotConfigured: 'AI未配置，请先在知识库配置中设置API密钥',
      nextStep: '下一步',
      prevStep: '上一步',
      reset: '重新开始',
      zipExtracted: 'ZIP解压完成',
      foundFiles: '发现 {pdf} 个PDF, {audio} 个音频文件'
    },
    en: {
      step1Title: 'Step 1: Upload Files',
      step2Title: 'Step 2: AI Parse Questions',
      step3Title: 'Step 3: Review',
      step4Title: 'Step 4: Import Complete',
      uploadPDF: 'Upload PDF Test Paper',
      uploadZIP: 'Upload ZIP Package',
      uploadAudio: 'Upload Audio Files (Optional)',
      selectPDF: 'Select PDF File',
      selectZIP: 'Select ZIP File',
      selectAudio: 'Select Audio Files',
      dragDrop: 'or drag and drop here',
      supportedFormats: 'Supported: PDF',
      zipFormats: 'Supported: ZIP (with PDF+Audio)',
      audioFormats: 'Supported: MP3, WAV, M4A',
      extractText: 'Extract Text',
      parseWithAI: 'Parse with AI',
      autoProcess: '🚀 Auto Process All',
      targetPaper: 'Target Paper',
      createNew: 'Create New Paper',
      selectExisting: 'Select Existing Paper',
      extractedText: 'Extracted Text',
      parsedQuestions: 'Parsed Questions',
      questionCount: 'Total {count} questions parsed',
      importAll: 'Import All',
      importing: 'Importing...',
      noQuestions: 'No questions parsed. Please check PDF content or add manually.',
      aiNotConfigured: 'AI not configured. Please set API key in Knowledge Base settings.',
      nextStep: 'Next',
      prevStep: 'Previous',
      reset: 'Start Over',
      zipExtracted: 'ZIP extracted',
      foundFiles: 'Found {pdf} PDFs, {audio} audio files'
    }
  };
  const t = txt[language] || txt.zh;

  // Extract text from PDF using pdf.js
  const extractPDFText = async (file) => {
    setProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `\n--- 第 ${i} 页 ---\n${pageText}`;
      }
      
      setExtractedText(fullText);
      setStep(2);
    } catch (err) {
      onError('PDF解析失败: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Handle ZIP file upload - extract PDFs and audio files
  const handleZIPUpload = async (file) => {
    setProcessing(true);
    setProcessingStatus('📦 解压ZIP文件...');
    
    try {
      // Use JSZip to extract
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(file);
      
      const pdfs = [];
      const audios = [];
      
      // Iterate through all files in ZIP
      for (const [filename, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;
        
        const lowerName = filename.toLowerCase();
        
        if (lowerName.endsWith('.pdf')) {
          const content = await zipEntry.async('arraybuffer');
          pdfs.push({ name: filename, content });
        } else if (lowerName.match(/\.(mp3|wav|m4a|ogg|flac)$/)) {
          const content = await zipEntry.async('blob');
          audios.push({ name: filename, content });
        }
      }
      
      // Use common processing function (will auto-continue if AI is configured)
      await processExtractedFiles(pdfs, audios.map(a => ({ name: a.name, blob: a.content })));
      
    } catch (err) {
      onError('ZIP解压失败: ' + err.message);
      setProcessing(false);
    }
  };

  // Handle folder selection via input
  const handleFolderSelect = async (files) => {
    if (!files || files.length === 0) return;
    
    setProcessing(true);
    setProcessingStatus('📁 读取文件夹...');
    
    try {
      const pdfs = [];
      const audios = [];
      
      for (const file of files) {
        const lowerName = file.name.toLowerCase();
        
        if (lowerName.endsWith('.pdf')) {
          const content = await file.arrayBuffer();
          pdfs.push({ name: file.name, content });
        } else if (lowerName.match(/\.(mp3|wav|m4a|ogg|flac)$/)) {
          audios.push({ name: file.name, blob: file });
        }
      }
      
      await processExtractedFiles(pdfs, audios);
      
    } catch (err) {
      onError('文件夹读取失败: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Handle folder drop (drag & drop)
  const handleFolderDrop = async (folderEntry) => {
    setProcessing(true);
    setProcessingStatus('📁 读取文件夹...');
    
    try {
      const files = await readAllFilesFromEntry(folderEntry);
      const pdfs = [];
      const audios = [];
      
      for (const file of files) {
        const lowerName = file.name.toLowerCase();
        
        if (lowerName.endsWith('.pdf')) {
          const content = await file.arrayBuffer();
          pdfs.push({ name: file.name, content });
        } else if (lowerName.match(/\.(mp3|wav|m4a|ogg|flac)$/)) {
          audios.push({ name: file.name, blob: file });
        }
      }
      
      await processExtractedFiles(pdfs, audios);
      
    } catch (err) {
      onError('文件夹读取失败: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Recursively read all files from a directory entry
  const readAllFilesFromEntry = async (entry) => {
    const files = [];
    
    if (entry.isFile) {
      const file = await new Promise((resolve, reject) => {
        entry.file(resolve, reject);
      });
      files.push(file);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries = await new Promise((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });
      
      for (const childEntry of entries) {
        const childFiles = await readAllFilesFromEntry(childEntry);
        files.push(...childFiles);
      }
    }
    
    return files;
  };

  // Common processing for both ZIP and folder
  const processExtractedFiles = async (pdfs, audios) => {
    setZipContents({ pdfs, audios });
    setAudioFiles(audios);
    
    // If we found PDFs, extract text
    if (pdfs.length > 0) {
      setProcessingStatus('📄 提取PDF文本...');
      let fullText = '';
      
      for (const pdfFile of pdfs) {
        const pdf = await pdfjsLib.getDocument({ data: pdfFile.content }).promise;
        fullText += `\n\n=== ${pdfFile.name} ===\n`;
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += `\n--- 第 ${i} 页 ---\n${pageText}`;
        }
      }
      
      setExtractedText(fullText);
      setPdfFile({ name: pdfs.map(p => p.name).join(', '), multi: true });
      
      // Auto-generate paper name from first PDF filename
      if (pdfs.length > 0 && !newPaperForm.name_zh) {
        const firstName = pdfs[0].name.replace('.pdf', '').replace('.PDF', '');
        // Try to extract HSK level from filename
        const hskMatch = firstName.match(/HSK\s*(\d)/i);
        const yearMatch = firstName.match(/(20\d{2})/);
        
        setNewPaperForm(prev => ({
          ...prev,
          name_zh: firstName,
          name: firstName,
          hsk_level: hskMatch ? parseInt(hskMatch[1]) : prev.hsk_level,
          year: yearMatch ? parseInt(yearMatch[1]) : prev.year
        }));
      }
      
      // Continue to auto-process if AI is configured
      const apiKey = aiConfig?.deepseek_api_key || aiConfig?.openai_api_key || aiConfig?.embedding_api_key;
      if (apiKey && fullText) {
        setProcessingStatus('🤖 AI 自动解析题目...');
        await autoParseAndImport(fullText, pdfs, audios);
      } else {
        setProcessingStatus(`✅ 读取完成: ${pdfs.length} PDF, ${audios.length} 音频`);
        setStep(2);
      }
    } else {
      setProcessingStatus(`✅ 读取完成: ${pdfs.length} PDF, ${audios.length} 音频`);
      setStep(2);
    }
  };

  // Full auto process: Parse with AI and Import
  const autoParseAndImport = async (textContent, pdfs, audios) => {
    const apiKey = aiConfig?.deepseek_api_key || aiConfig?.openai_api_key || aiConfig?.embedding_api_key;
    
    try {
      // Step 2: AI Parse
      setProcessingStatus('🤖 步骤2/3: AI解析题目...');
      const proxyUrl = aiConfig?.proxy_url || 'http://localhost:3001';
      
      const prompt = `请分析以下HSK考试试卷文本，提取所有题目。返回JSON数组格式：

[
  {
    "question_number": 1,
    "section_type": "listening/reading/writing",
    "question_type": "choice/truefalse/fill/short_answer",
    "question_text": "题目内容",
    "options": [
      {"id": "A", "text": "选项A"},
      {"id": "B", "text": "选项B"},
      {"id": "C", "text": "选项C"},
      {"id": "D", "text": "选项D"}
    ],
    "correct_answer": "A",
    "difficulty": 3
  }
]

注意：
1. section_type 根据题目类型判断（听力题、阅读题、书写题）
2. question_type 根据题型判断（选择题choice、判断题truefalse、填空题fill、简答题short_answer）
3. 如果没有明确答案，correct_answer设为null
4. difficulty范围1-5
5. 只返回JSON数组，不要其他文字

试卷文本：
${textContent.substring(0, 15000)}`;

      const provider = aiConfig?.ai_provider || aiConfig?.embedding_provider || 'deepseek';
      
      const response = await fetch(`${proxyUrl}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: provider === 'anthropic' ? 'claude' : provider,
          apiKey,
          model: aiConfig?.deepseek_model || 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3
        })
      });

      const data = await response.json();
      
      if (!data.success || !data.content) {
        throw new Error(data.error || 'AI解析失败');
      }
      
      const jsonMatch = data.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('AI返回格式错误');
      }
      
      const questions = JSON.parse(jsonMatch[0]);
      setParsedQuestions(questions);
      
      if (questions.length === 0) {
        setProcessingStatus('⚠️ 未解析出题目，请手动检查');
        setStep(3);
        return;
      }
      
      // Step 3: Auto import
      setProcessingStatus(`📥 步骤3/3: 导入 ${questions.length} 道题目...`);
      
      // Get paper name from state or generate from filename
      const paperName = newPaperForm.name_zh || (pdfs[0]?.name.replace('.pdf', '') || 'HSK试卷');
      
      // Create paper
      const { data: newPaper, error: paperError } = await supabase
        .from('dwxz_hsk_test_papers')
        .insert([{
          name: paperName,
          name_zh: paperName,
          hsk_level: newPaperForm.hsk_level,
          year: newPaperForm.year,
          test_type: newPaperForm.test_type || 'official',
          total_questions: questions.length,
          listening_questions: questions.filter(q => q.section_type === 'listening').length,
          reading_questions: questions.filter(q => q.section_type === 'reading').length,
          writing_questions: questions.filter(q => q.section_type === 'writing').length
        }])
        .select()
        .single();
      
      if (paperError) throw paperError;
      const paperId = newPaper.id;

      // Import questions
      const questionsToInsert = questions.map(q => ({
        paper_id: paperId,
        question_number: q.question_number,
        section_type: q.section_type,
        question_type: q.question_type,
        question_text: q.question_text,
        options: JSON.stringify(q.options || []),
        correct_answer: q.correct_answer,
        difficulty: q.difficulty || 3,
        points: 1
      }));

      const { error: questionsError } = await supabase
        .from('dwxz_hsk_test_questions')
        .insert(questionsToInsert);

      if (questionsError) throw questionsError;

      // Save audio files info if any
      if (audios && audios.length > 0) {
        const audioRecords = audios.map(a => ({
          paper_id: paperId,
          filename: a.name,
          original_filename: a.name,
          transcription_status: 'pending'
        }));
        await supabase.from('dwxz_hsk_audio_files').insert(audioRecords);
      }

      setProcessingStatus('');
      setStep(4);
      onImportComplete();
      
    } catch (err) {
      console.error('Auto process error:', err);
      setProcessingStatus(`❌ 处理失败: ${err.message}`);
      // Fall back to manual review
      setStep(3);
    }
  };

  // Auto process: ZIP → Extract → AI Parse → Import
  const autoProcessAll = async () => {
    const apiKey = aiConfig?.deepseek_api_key || aiConfig?.openai_api_key || aiConfig?.embedding_api_key;
    if (!apiKey) {
      onError(t.aiNotConfigured);
      return;
    }
    
    if (!pdfFile && zipContents.pdfs.length === 0) {
      onError('请先上传PDF或ZIP文件');
      return;
    }
    
    setProcessing(true);
    
    try {
      // Step 1: Extract text if not already done
      if (!extractedText && pdfFile && !pdfFile.multi) {
        setProcessingStatus('📄 步骤1/3: 提取PDF文本...');
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += `\n--- 第 ${i} 页 ---\n${pageText}`;
        }
        setExtractedText(fullText);
      }
      
      // Step 2: AI Parse
      setProcessingStatus('🤖 步骤2/3: AI解析题目...');
      const proxyUrl = aiConfig?.proxy_url || 'http://localhost:3001';
      const textToProcess = extractedText || await getExtractedText();
      
      const prompt = `请分析以下HSK考试试卷文本，提取所有题目。返回JSON数组格式：

[
  {
    "question_number": 1,
    "section_type": "listening/reading/writing",
    "question_type": "choice/truefalse/fill/short_answer",
    "question_text": "题目内容",
    "options": [
      {"id": "A", "text": "选项A"},
      {"id": "B", "text": "选项B"},
      {"id": "C", "text": "选项C"},
      {"id": "D", "text": "选项D"}
    ],
    "correct_answer": "A",
    "difficulty": 3
  }
]

注意：
1. section_type 根据题目类型判断（听力题、阅读题、书写题）
2. question_type 根据题型判断（选择题choice、判断题truefalse、填空题fill、简答题short_answer）
3. 如果没有明确答案，correct_answer设为null
4. difficulty范围1-5
5. 只返回JSON数组，不要其他文字

试卷文本：
${textToProcess.substring(0, 15000)}`;

      const provider = aiConfig?.ai_provider || aiConfig?.embedding_provider || 'deepseek';
      
      const response = await fetch(`${proxyUrl}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: provider === 'anthropic' ? 'claude' : provider,
          apiKey,
          model: aiConfig?.deepseek_model || 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3
        })
      });

      const data = await response.json();
      
      if (!data.success || !data.content) {
        throw new Error(data.error || 'AI解析失败');
      }
      
      const jsonMatch = data.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('AI返回格式错误');
      }
      
      const questions = JSON.parse(jsonMatch[0]);
      setParsedQuestions(questions);
      
      // Step 3: Auto import
      setProcessingStatus('📥 步骤3/3: 导入数据库...');
      
      let paperId = targetPaper?.id;
      
      if (createNewPaper) {
        const { data: newPaper, error: paperError } = await supabase
          .from('dwxz_hsk_test_papers')
          .insert([{
            ...newPaperForm,
            name: newPaperForm.name || newPaperForm.name_zh || `HSK${newPaperForm.hsk_level} ${newPaperForm.year}`,
            total_questions: questions.length,
            listening_questions: questions.filter(q => q.section_type === 'listening').length,
            reading_questions: questions.filter(q => q.section_type === 'reading').length,
            writing_questions: questions.filter(q => q.section_type === 'writing').length
          }])
          .select()
          .single();
        
        if (paperError) throw paperError;
        paperId = newPaper.id;
      }

      const questionsToInsert = questions.map(q => ({
        paper_id: paperId,
        question_number: q.question_number,
        section_type: q.section_type,
        question_type: q.question_type,
        question_text: q.question_text,
        options: JSON.stringify(q.options || []),
        correct_answer: q.correct_answer,
        difficulty: q.difficulty || 3,
        points: 1
      }));

      const { error: questionsError } = await supabase
        .from('dwxz_hsk_test_questions')
        .insert(questionsToInsert);

      if (questionsError) throw questionsError;

      // Also save audio files info if any
      if (audioFiles.length > 0) {
        const audioRecords = audioFiles.map(a => ({
          paper_id: paperId,
          filename: a.name,
          original_filename: a.name,
          transcription_status: 'pending'
        }));
        await supabase.from('dwxz_hsk_audio_files').insert(audioRecords);
      }

      setProcessingStatus('');
      setStep(4);
      onImportComplete();
      
    } catch (err) {
      onError('自动处理失败: ' + err.message);
      setProcessingStatus('');
    } finally {
      setProcessing(false);
    }
  };

  // Helper to get extracted text
  const getExtractedText = async () => {
    if (extractedText) return extractedText;
    if (!pdfFile) return '';
    
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `\n--- 第 ${i} 页 ---\n${pageText}`;
    }
    
    setExtractedText(fullText);
    return fullText;
  };

  // Parse questions using AI
  const parseWithAI = async () => {
    // Check AI config
    const apiKey = aiConfig?.deepseek_api_key || aiConfig?.openai_api_key || aiConfig?.embedding_api_key;
    if (!apiKey) {
      onError(t.aiNotConfigured);
      return;
    }

    setProcessing(true);
    try {
      const proxyUrl = aiConfig?.proxy_url || 'http://localhost:3001';
      
      const prompt = `请分析以下HSK考试试卷文本，提取所有题目。返回JSON数组格式：

[
  {
    "question_number": 1,
    "section_type": "listening/reading/writing",
    "question_type": "choice/truefalse/fill/short_answer",
    "question_text": "题目内容",
    "options": [
      {"id": "A", "text": "选项A"},
      {"id": "B", "text": "选项B"},
      {"id": "C", "text": "选项C"},
      {"id": "D", "text": "选项D"}
    ],
    "correct_answer": "A",
    "difficulty": 3
  }
]

注意：
1. section_type 根据题目类型判断（听力题、阅读题、书写题）
2. question_type 根据题型判断（选择题choice、判断题truefalse、填空题fill、简答题short_answer）
3. 如果没有明确答案，correct_answer设为null
4. difficulty范围1-5
5. 只返回JSON数组，不要其他文字

试卷文本：
${extractedText.substring(0, 15000)}`;

      const provider = aiConfig?.ai_provider || aiConfig?.embedding_provider || 'deepseek';
      
      const response = await fetch(`${proxyUrl}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: provider === 'anthropic' ? 'claude' : provider,
          apiKey,
          model: aiConfig?.deepseek_model || 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3
        })
      });

      const data = await response.json();
      
      if (data.success && data.content) {
        // Parse JSON from response
        const jsonMatch = data.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const questions = JSON.parse(jsonMatch[0]);
          setParsedQuestions(questions);
          setStep(3);
        } else {
          throw new Error('AI返回格式错误');
        }
      } else {
        throw new Error(data.error || 'AI解析失败');
      }
    } catch (err) {
      onError('AI解析失败: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Import questions to database
  const importQuestions = async () => {
    if (!supabase) return;
    
    setProcessing(true);
    try {
      let paperId = targetPaper?.id;
      
      // Create new paper if needed
      if (createNewPaper) {
        const { data: newPaper, error: paperError } = await supabase
          .from('dwxz_hsk_test_papers')
          .insert([{
            ...newPaperForm,
            total_questions: parsedQuestions.length,
            listening_questions: parsedQuestions.filter(q => q.section_type === 'listening').length,
            reading_questions: parsedQuestions.filter(q => q.section_type === 'reading').length,
            writing_questions: parsedQuestions.filter(q => q.section_type === 'writing').length
          }])
          .select()
          .single();
        
        if (paperError) throw paperError;
        paperId = newPaper.id;
      }

      // Import questions
      const questionsToInsert = parsedQuestions.map(q => ({
        paper_id: paperId,
        question_number: q.question_number,
        section_type: q.section_type,
        question_type: q.question_type,
        question_text: q.question_text,
        options: JSON.stringify(q.options || []),
        correct_answer: q.correct_answer,
        difficulty: q.difficulty || 3,
        points: 1
      }));

      const { error: questionsError } = await supabase
        .from('dwxz_hsk_test_questions')
        .insert(questionsToInsert);

      if (questionsError) throw questionsError;

      setStep(4);
      onImportComplete();
    } catch (err) {
      onError('导入失败: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Reset everything
  const resetImport = () => {
    setPdfFile(null);
    setAudioFiles([]);
    setExtractedText('');
    setParsedQuestions([]);
    setTargetPaper(null);
    setStep(1);
  };

  // Update a parsed question
  const updateQuestion = (index, field, value) => {
    setParsedQuestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Remove a question
  const removeQuestion = (index) => {
    setParsedQuestions(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="card" style={{ padding: '2rem' }}>
      {/* Progress Steps */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
        {[1, 2, 3, 4].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: step >= s ? 'var(--primary)' : 'var(--border)',
              color: step >= s ? 'white' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600
            }}>
              {step > s ? '✓' : s}
            </div>
            {s < 4 && (
              <div style={{
                width: '60px',
                height: '4px',
                background: step > s ? 'var(--primary)' : 'var(--border)',
                margin: '0 0.5rem'
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div>
          <h3 style={{ marginBottom: '1.5rem' }}>📥 {t.step1Title}</h3>
          
          {/* ZIP Upload - Full Width */}
          <div
            style={{
              border: '3px dashed var(--primary)',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: zipContents.pdfs.length > 0 ? 'var(--primary-light)' : 'linear-gradient(135deg, var(--background) 0%, rgba(var(--primary-rgb), 0.1) 100%)',
              marginBottom: '1.5rem'
            }}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--success)'; }}
            onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
            onDrop={async e => {
              e.preventDefault();
              e.currentTarget.style.borderColor = 'var(--primary)';
              
              // Check if it's a folder (using webkitGetAsEntry)
              const items = e.dataTransfer.items;
              if (items && items.length > 0) {
                const firstItem = items[0];
                if (firstItem.webkitGetAsEntry) {
                  const entry = firstItem.webkitGetAsEntry();
                  if (entry && entry.isDirectory) {
                    // It's a folder - process it
                    handleFolderDrop(entry);
                    return;
                  }
                }
              }
              
              // Otherwise check for ZIP file
              const file = e.dataTransfer.files[0];
              if (file?.name.toLowerCase().endsWith('.zip')) {
                handleZIPUpload(file);
              }
            }}
          >
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip"
              style={{ display: 'none' }}
              onChange={e => e.target.files[0] && handleZIPUpload(e.target.files[0])}
            />
            <input
              ref={folderInputRef}
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              style={{ display: 'none' }}
              onChange={e => handleFolderSelect(e.target.files)}
            />
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📦</div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>
              {language === 'zh' ? '上传 ZIP 或 文件夹' : 'Upload ZIP or Folder'} (推荐)
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {language === 'zh' ? '拖拽 ZIP/文件夹 到此处' : 'Drag ZIP or Folder here'}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
              {language === 'zh' ? '支持: ZIP, 文件夹 (包含PDF+音频)' : 'Supported: ZIP, Folder (with PDF+Audio)'}
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
              <button 
                className="btn btn-outline btn-sm"
                onClick={(e) => { e.stopPropagation(); zipInputRef.current?.click(); }}
              >
                📦 选择ZIP
              </button>
              <button 
                className="btn btn-outline btn-sm"
                onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
              >
                📁 选择文件夹
              </button>
            </div>
            
            {zipContents.pdfs.length > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--success)', color: 'white', borderRadius: 'var(--radius-md)' }}>
                ✓ {t.foundFiles.replace('{pdf}', zipContents.pdfs.length).replace('{audio}', zipContents.audios.length)}
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', margin: '1rem 0', color: 'var(--text-muted)' }}>
            ─── 或者分别上传 ───
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* PDF Upload */}
            <div
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: pdfFile ? 'var(--success-light)' : 'var(--background)'
              }}
              onClick={() => pdfInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file?.type === 'application/pdf') {
                  setPdfFile(file);
                }
              }}
            >
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={e => setPdfFile(e.target.files[0])}
              />
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{t.uploadPDF}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.dragDrop}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>{t.supportedFormats}</div>
              
              {pdfFile && !pdfFile.multi && (
                <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'var(--success)', color: 'white', borderRadius: 'var(--radius-md)' }}>
                  ✓ {pdfFile.name}
                </div>
              )}
            </div>

            {/* Audio Upload */}
            <div
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: audioFiles.length > 0 ? 'var(--info-light)' : 'var(--background)'
              }}
              onClick={() => audioInputRef.current?.click()}
            >
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a"
                multiple
                style={{ display: 'none' }}
                onChange={e => setAudioFiles(Array.from(e.target.files))}
              />
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎧</div>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{t.uploadAudio}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.dragDrop}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>{t.audioFormats}</div>
              
              {audioFiles.length > 0 && (
                <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'var(--info)', color: 'white', borderRadius: 'var(--radius-md)' }}>
                  ✓ {audioFiles.length} 个音频文件
                </div>
              )}
            </div>
          </div>

          {/* Target Paper Selection */}
          <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--background)', borderRadius: 'var(--radius-lg)' }}>
            <h4 style={{ marginBottom: '1rem' }}>📋 {t.targetPaper}</h4>
            
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" checked={createNewPaper} onChange={() => setCreateNewPaper(true)} />
                {t.createNew}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" checked={!createNewPaper} onChange={() => setCreateNewPaper(false)} />
                {t.selectExisting}
              </label>
            </div>

            {createNewPaper ? (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '1rem' }}>
                <input
                  className="form-input"
                  placeholder="试卷名称 / Paper Name"
                  value={newPaperForm.name_zh}
                  onChange={e => setNewPaperForm({ ...newPaperForm, name_zh: e.target.value, name: e.target.value })}
                />
                <select
                  className="form-select"
                  value={newPaperForm.hsk_level}
                  onChange={e => setNewPaperForm({ ...newPaperForm, hsk_level: parseInt(e.target.value) })}
                >
                  {[1,2,3,4,5,6].map(l => <option key={l} value={l}>HSK {l}</option>)}
                </select>
                <input
                  type="number"
                  className="form-input"
                  placeholder="年份"
                  value={newPaperForm.year}
                  onChange={e => setNewPaperForm({ ...newPaperForm, year: parseInt(e.target.value) })}
                />
                <select
                  className="form-select"
                  value={newPaperForm.test_type}
                  onChange={e => setNewPaperForm({ ...newPaperForm, test_type: e.target.value })}
                >
                  <option value="official">真题</option>
                  <option value="mock">模拟题</option>
                  <option value="practice">练习题</option>
                </select>
              </div>
            ) : (
              <select
                className="form-select"
                value={targetPaper?.id || ''}
                onChange={e => setTargetPaper(papers.find(p => p.id === e.target.value))}
              >
                <option value="">-- 选择试卷 --</option>
                {papers.map(p => (
                  <option key={p.id} value={p.id}>HSK{p.hsk_level} {p.name_zh} ({p.year})</option>
                ))}
              </select>
            )}
          </div>

          {/* Processing status */}
          {processingStatus && (
            <div style={{ 
              marginTop: '1.5rem', 
              padding: '1rem', 
              background: 'var(--info-light)', 
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              fontWeight: 500
            }}>
              {processingStatus}
            </div>
          )}

          <div style={{ marginTop: '2rem', textAlign: 'center', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {/* Manual step-by-step */}
            <button
              className="btn btn-outline btn-lg"
              disabled={(!pdfFile && zipContents.pdfs.length === 0) || processing}
              onClick={() => pdfFile ? extractPDFText(pdfFile) : setStep(2)}
            >
              {processing ? '⏳ 处理中...' : `${t.nextStep} → (手动)`}
            </button>
            
            {/* Auto process all */}
            <button
              className="btn btn-primary btn-lg"
              disabled={(!pdfFile && zipContents.pdfs.length === 0) || processing || !newPaperForm.name_zh}
              onClick={autoProcessAll}
              style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--success) 100%)' }}
            >
              {processing ? `⏳ ${processingStatus || '处理中...'}` : t.autoProcess}
            </button>
          </div>
          
          {(!pdfFile && zipContents.pdfs.length === 0) && (
            <div style={{ marginTop: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              ⬆️ 请先上传 ZIP 或 PDF 文件
            </div>
          )}
          
          {(pdfFile || zipContents.pdfs.length > 0) && !newPaperForm.name_zh && (
            <div style={{ marginTop: '1rem', textAlign: 'center', color: 'var(--warning)', fontSize: '0.875rem' }}>
              ⚠️ 请填写试卷名称后才能一键处理
            </div>
          )}
        </div>
      )}

      {/* Step 2: Parse */}
      {step === 2 && (
        <div>
          <h3 style={{ marginBottom: '1.5rem' }}>🤖 {t.step2Title}</h3>
          
          <div className="form-group">
            <label className="form-label">{t.extractedText} ({extractedText.length} 字符)</label>
            <textarea
              className="form-textarea"
              rows={10}
              value={extractedText}
              onChange={e => setExtractedText(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
            />
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn btn-outline" onClick={() => setStep(1)}>
              ← {t.prevStep}
            </button>
            <button
              className="btn btn-primary btn-lg"
              disabled={processing || !extractedText}
              onClick={parseWithAI}
            >
              {processing ? '⏳ AI解析中...' : `🤖 ${t.parseWithAI}`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div>
          <h3 style={{ marginBottom: '1.5rem' }}>✅ {t.step3Title}</h3>
          
          <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--success-light)', borderRadius: 'var(--radius-md)' }}>
            {t.questionCount.replace('{count}', parsedQuestions.length)}
          </div>

          {parsedQuestions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              {t.noQuestions}
            </div>
          ) : (
            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
              {parsedQuestions.map((q, index) => (
                <div key={index} style={{
                  padding: '1rem',
                  marginBottom: '0.5rem',
                  background: 'var(--background)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span className="badge badge-info">#{q.question_number}</span>
                        <span className="badge">{q.section_type}</span>
                        <span className="badge">{q.question_type}</span>
                        {q.correct_answer && <span className="badge badge-success">答案: {q.correct_answer}</span>}
                      </div>
                      <div style={{ fontWeight: 500 }}>{q.question_text}</div>
                      {q.options && q.options.length > 0 && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                          {q.options.map(opt => (
                            <div key={opt.id}>{opt.id}. {opt.text}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => removeQuestion(index)}
                      style={{ color: 'var(--danger)' }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn btn-outline" onClick={() => setStep(2)}>
              ← {t.prevStep}
            </button>
            <button
              className="btn btn-primary btn-lg"
              disabled={processing || parsedQuestions.length === 0}
              onClick={importQuestions}
            >
              {processing ? '⏳ 导入中...' : `📥 ${t.importAll}`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === 4 && (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ marginBottom: '1rem' }}>{t.step4Title}</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            成功导入 {parsedQuestions.length} 道题目
          </p>
          <button className="btn btn-primary" onClick={resetImport}>
            {t.reset}
          </button>
        </div>
      )}
    </div>
  );
};

export default HSKTestManagementPage;
