// src/teacher/pages/HomeworkPage.jsx
// Merged: 作业 = create + distribute + view submissions + grade
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { PageHero } from '../../shared/RolePanelLayout';
import { Plus, FileText, Calendar, ChevronRight, X, Mic } from 'lucide-react';
import FileUploadButton from '../../shared/FileUploadButton';
import AudioRecorder from '../../shared/AudioRecorder';
import AudioPlayer from '../../shared/AudioPlayer';
import PDFViewer from '../../shared/PDFViewer';
import { uploadHomeworkPrompt, refreshSignedUrl } from '../../lib/homeworkStorage';

const ACCENT = '#c41e3a';

export default function HomeworkPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [items, setItems] = useState([]);
  const [view, setView] = useState({ mode: 'list', homework: null }); // list | create | detail

  const load = async () => {
    if (!user?.id) return;
    const { data: cls } = await supabase
      .from('clf_classes').select('id, name, grade_level')
      .eq('teacher_id', user.id).order('name');
    setClasses(cls || []);
    const ids = (cls || []).map(c => c.id);
    if (ids.length === 0) { setItems([]); return; }
    const { data } = await supabase
      .from('clf_homework')
      .select('*, clf_classes(name)')
      .in('class_id', ids)
      .order('created_at', { ascending: false });
    setItems(data || []);
  };
  useEffect(() => { load(); }, [user?.id]);

  return (
    <div>
      <PageHero icon="📝" title="作业" subtitle="Homework" accentColor={ACCENT}>
        {view.mode === 'list' && (
          <button onClick={() => setView({ mode: 'create' })} style={{
            background: ACCENT, color: '#fff', border: 'none',
            padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Plus size={14}/> 新建作业
          </button>
        )}
        {view.mode !== 'list' && (
          <button onClick={() => { setView({ mode: 'list' }); load(); }} style={{
            background: 'transparent', color: '#fff5e6',
            border: '1px solid rgba(255,245,230,0.3)',
            padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
            fontSize: 13,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <X size={12}/> 返回列表
          </button>
        )}
      </PageHero>

      {view.mode === 'create' && (
        <CreateForm classes={classes} userId={user?.id}
          onDone={() => { setView({ mode: 'list' }); load(); }}/>
      )}
      {view.mode === 'detail' && (
        <DetailView homework={view.homework} userId={user?.id}/>
      )}
      {view.mode === 'list' && (
        <ListView items={items} classes={classes}
          onOpen={(h) => setView({ mode: 'detail', homework: h })}/>
      )}
    </div>
  );
}

// ─── Create form (assign) ───────────────────────────────────────
function CreateForm({ classes, userId, onDone }) {
  const [form, setForm] = useState({
    class_id: '', title: '', description: '', due_at: '',
    words_list: '', attachment_kind: '', // '' | 'pdf' | 'audio'
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.class_id || !form.title.trim()) {
      alert('请选择班级并填写标题');
      return;
    }
    setSaving(true);
    try {
      const wordsList = form.words_list
        .split('\n').map(w => w.trim()).filter(Boolean);
      const { data: hw, error } = await supabase.from('clf_homework').insert({
        class_id: form.class_id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_at: form.due_at || null,
        created_by: userId,
        words_list: wordsList.length > 0 ? wordsList : null,
      }).select().single();
      if (error) throw error;

      let updates = {};
      if (form.attachment_kind === 'pdf' && pdfFile) {
        const uploaded = await uploadHomeworkPrompt(hw.id, pdfFile);
        updates = {
          attachment_url: uploaded.url,
          attachment_path: uploaded.path,
          attachment_type: 'pdf',
          attachment_name: uploaded.name,
        };
      } else if (form.attachment_kind === 'audio' && audioBlob) {
        const file = new File([audioBlob], 'prompt.webm', { type: 'audio/webm' });
        const uploaded = await uploadHomeworkPrompt(hw.id, file);
        updates = {
          attachment_url: uploaded.url,
          attachment_path: uploaded.path,
          attachment_type: 'audio',
          attachment_name: uploaded.name,
        };
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('clf_homework').update(updates).eq('id', hw.id);
      }
      onDone();
    } catch (e) {
      alert('保存失败：' + (e.message || e));
    } finally { setSaving(false); }
  };

  return (
    <div style={panel}>
      <h3 style={{ margin: 0, fontSize: 15, color: '#fff5e6',
        fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2 }}>
        新建作业
      </h3>
      <select value={form.class_id} onChange={e => setForm(f => ({...f, class_id: e.target.value}))} style={input}>
        <option value="">选择班级…</option>
        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
        placeholder="作业标题" style={input}/>
      <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
        placeholder="作业说明（可选）" rows={3} style={{...input, resize: 'vertical', fontFamily: 'inherit'}}/>
      <textarea value={form.words_list} onChange={e => setForm(f => ({...f, words_list: e.target.value}))}
        placeholder="单词表（可选，每行一个）" rows={3} style={{...input, resize: 'vertical', fontFamily: 'inherit'}}/>
      <input type="datetime-local" value={form.due_at}
        onChange={e => setForm(f => ({...f, due_at: e.target.value}))} style={input}/>

      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 12, color: 'rgba(253,246,227,0.7)', marginBottom: 6 }}>
          附件（可选）：
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {['', 'pdf', 'audio'].map(k => (
            <button key={k} onClick={() => setForm(f => ({...f, attachment_kind: k}))} style={{
              padding: '6px 12px', borderRadius: 16,
              background: form.attachment_kind === k ? ACCENT : 'rgba(253,246,227,0.06)',
              color: form.attachment_kind === k ? '#fff' : 'rgba(253,246,227,0.7)',
              border: '1px solid rgba(253,246,227,0.15)',
              cursor: 'pointer', fontSize: 11,
            }}>{k === '' ? '无附件' : k === 'pdf' ? 'PDF' : '音频'}</button>
          ))}
        </div>
        {form.attachment_kind === 'pdf' && (
          <FileUploadButton accept=".pdf" label="选择 PDF"
            onPick={setPdfFile} accentColor={ACCENT}/>
        )}
        {form.attachment_kind === 'audio' && (
          <AudioRecorder accentColor={ACCENT} onComplete={setAudioBlob}/>
        )}
      </div>

      <button onClick={submit} disabled={saving} style={{
        background: ACCENT, color: '#fff', border: 'none',
        padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
        fontSize: 13, fontWeight: 600, marginTop: 8,
      }}>{saving ? '保存中…' : '发布作业'}</button>
    </div>
  );
}

// ─── List view ──────────────────────────────────────────────────
function ListView({ items, classes, onOpen }) {
  if (classes.length === 0) {
    return <Empty>还没有班级。请先到「班级管理」创建班级。</Empty>;
  }
  if (items.length === 0) {
    return <Empty>还没有布置作业。点击上方「新建作业」开始。</Empty>;
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map(h => (
        <button key={h.id} onClick={() => onOpen(h)} style={{
          ...card, textAlign: 'left', cursor: 'pointer', width: '100%',
          background: 'rgba(253,246,227,0.05)',
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <FileText size={14} color={ACCENT}/>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff5e6' }}>{h.title}</div>
            <span style={chip}>{h.clf_classes?.name}</span>
            {h.attachment_type && (
              <span style={{ ...chip, background: '#3b82f630', color: '#7dd3fc' }}>
                {h.attachment_type === 'pdf' ? 'PDF' : '🎤 音频'}
              </span>
            )}
            <ChevronRight size={14} color="rgba(253,246,227,0.4)" style={{ marginLeft: 'auto' }}/>
          </div>
          {h.description && (
            <div style={{ fontSize: 12, color: 'rgba(253,246,227,0.7)', marginBottom: 6 }}>
              {h.description.length > 80 ? h.description.slice(0, 80) + '…' : h.description}
            </div>
          )}
          {h.due_at && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center',
              fontSize: 11, color: '#fda4af' }}>
              <Calendar size={11}/>
              截止：{new Date(h.due_at).toLocaleString()}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Detail view (submissions + grading) ────────────────────────
function DetailView({ homework, userId }) {
  const [subs, setSubs] = useState([]);
  const [activeSub, setActiveSub] = useState(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [promptUrl, setPromptUrl] = useState(homework.attachment_url);

  const load = async () => {
    const { data } = await supabase
      .from('clf_homework_submissions')
      .select('*, clf_user_profiles!student_id(display_name_zh, display_name, email)')
      .eq('homework_id', homework.id)
      .order('submitted_at', { ascending: false });
    setSubs(data || []);
  };
  useEffect(() => { load(); }, [homework.id]);

  // Refresh signed URL for prompt attachment if needed
  useEffect(() => {
    if (homework.attachment_path && !promptUrl) {
      refreshSignedUrl(homework.attachment_path).then(setPromptUrl);
    }
  }, [homework.attachment_path]);

  const grade = async () => {
    if (!activeSub) return;
    setSaving(true);
    try {
      await supabase.from('clf_homework_submissions').update({
        score: score ? Number(score) : null,
        feedback: feedback.trim() || null,
        graded_at: new Date().toISOString(),
        graded_by: userId,
      }).eq('id', activeSub.id);
      setActiveSub(null); setScore(''); setFeedback('');
      load();
    } catch (e) { alert('保存失败：' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      {/* Homework header info */}
      <div style={panel}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff5e6', marginBottom: 6,
          fontFamily: "'STKaiti','KaiTi',serif" }}>
          {homework.title}
        </div>
        {homework.description && (
          <div style={{ fontSize: 12, color: 'rgba(253,246,227,0.8)', marginBottom: 8 }}>
            {homework.description}
          </div>
        )}
        {homework.words_list?.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'rgba(253,246,227,0.6)', marginBottom: 4 }}>单词表：</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {homework.words_list.map((w, i) => (
                <span key={i} style={{ ...chip, background: '#10b98130', color: '#86efac' }}>{w}</span>
              ))}
            </div>
          </div>
        )}
        {homework.attachment_type === 'pdf' && promptUrl && (
          <PDFViewer src={promptUrl} name={homework.attachment_name} accentColor={ACCENT}/>
        )}
        {homework.attachment_type === 'audio' && promptUrl && (
          <AudioPlayer src={promptUrl} label={homework.attachment_name} accentColor={ACCENT}/>
        )}
      </div>

      <h3 style={{ fontSize: 14, color: '#fff5e6', margin: '20px 0 10px' }}>
        提交情况 · {subs.length} 人已交
      </h3>

      <div style={{ display: 'grid', gap: 16,
        gridTemplateColumns: activeSub ? '1fr 1.5fr' : '1fr' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {subs.length === 0 ? (
            <Empty>还没有学生提交</Empty>
          ) : subs.map(s => (
            <button key={s.id} onClick={() => {
              setActiveSub(s);
              setScore(s.score?.toString() || '');
              setFeedback(s.feedback || '');
            }} style={{
              ...card, textAlign: 'left', cursor: 'pointer', width: '100%',
              background: activeSub?.id === s.id
                ? 'rgba(196,30,58,0.18)'
                : 'rgba(253,246,227,0.05)',
              borderColor: activeSub?.id === s.id ? ACCENT : 'rgba(255,245,230,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff5e6' }}>
                  {s.clf_user_profiles?.display_name_zh
                    || s.clf_user_profiles?.display_name
                    || s.clf_user_profiles?.email?.split('@')[0]
                    || '(未知)'}
                </div>
                <span style={{ ...chip,
                  background: s.graded_at ? '#10b98130' : '#f59e0b30',
                  color: s.graded_at ? '#86efac' : '#fcd34d' }}>
                  {s.graded_at ? `已批 ${s.score ?? '-'}` : '待批'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(253,246,227,0.6)', marginTop: 2 }}>
                提交于 {new Date(s.submitted_at).toLocaleString()}
              </div>
            </button>
          ))}
        </div>

        {activeSub && (
          <SubmissionGrader sub={activeSub}
            score={score} setScore={setScore}
            feedback={feedback} setFeedback={setFeedback}
            saving={saving} onGrade={grade}/>
        )}
      </div>
    </div>
  );
}

function SubmissionGrader({ sub, score, setScore, feedback, setFeedback, saving, onGrade }) {
  const [responsePdfUrl, setResponsePdfUrl] = useState(sub.response_pdf_url);
  const [responseAudioUrl, setResponseAudioUrl] = useState(sub.response_audio_url);

  useEffect(() => {
    if (sub.response_pdf_path && !responsePdfUrl) {
      refreshSignedUrl(sub.response_pdf_path).then(setResponsePdfUrl);
    }
    if (sub.response_audio_path && !responseAudioUrl) {
      refreshSignedUrl(sub.response_audio_path).then(setResponseAudioUrl);
    }
  }, [sub.id]);

  return (
    <div style={panel}>
      <div style={{ fontSize: 12, color: 'rgba(253,246,227,0.6)', marginBottom: 8 }}>
        学生提交内容：
      </div>
      {sub.content && (
        <div style={{
          background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8,
          fontSize: 13, color: '#fff5e6', whiteSpace: 'pre-wrap',
          maxHeight: 200, overflowY: 'auto', marginBottom: 10,
        }}>{sub.content}</div>
      )}
      {responsePdfUrl && (
        <div style={{ marginBottom: 10 }}>
          <PDFViewer src={responsePdfUrl} name={sub.response_pdf_name || 'response.pdf'}
            accentColor={ACCENT} height={300}/>
        </div>
      )}
      {responseAudioUrl && (
        <div style={{ marginBottom: 10 }}>
          <AudioPlayer src={responseAudioUrl} label="学生录音" accentColor={ACCENT}/>
        </div>
      )}
      {!sub.content && !responsePdfUrl && !responseAudioUrl && (
        <div style={{ color: 'rgba(253,246,227,0.5)', fontSize: 12,
          marginBottom: 10, fontStyle: 'italic' }}>
          (没有提交内容)
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input type="number" value={score} onChange={e => setScore(e.target.value)}
          placeholder="分数 (0-100)" min={0} max={100} style={input}/>
        <textarea value={feedback} onChange={e => setFeedback(e.target.value)}
          placeholder="批语（可选）" rows={3} style={{...input, resize: 'vertical'}}/>
        <button onClick={onGrade} disabled={saving} style={{
          background: '#10b981', color: '#fff', border: 'none',
          padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
          fontSize: 13, fontWeight: 600,
        }}>{saving ? '保存中…' : '完成批改'}</button>
      </div>
    </div>
  );
}

// ─── Shared styles ──────────────────────────────────────────────
const panel = {
  background: 'rgba(253,246,227,0.05)',
  border: '1px solid rgba(255,245,230,0.15)',
  borderRadius: 12, padding: 16, marginBottom: 14,
  display: 'flex', flexDirection: 'column', gap: 8,
};
const input = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,245,230,0.2)',
  color: '#fff5e6', padding: '8px 12px', borderRadius: 6,
  fontSize: 13, fontFamily: 'inherit',
};
const card = {
  background: 'rgba(253,246,227,0.05)',
  border: '1px solid rgba(255,245,230,0.15)',
  borderRadius: 10, padding: 12,
};
const chip = {
  fontSize: 10, padding: '2px 8px', borderRadius: 10,
  background: '#c41e3a30', color: '#fda4af',
};
function Empty({ children }) {
  return (
    <div style={{
      background: 'rgba(253,246,227,0.04)',
      border: '1px dashed rgba(255,245,230,0.2)',
      borderRadius: 12, padding: 30, textAlign: 'center',
      color: 'rgba(253,246,227,0.5)', fontSize: 13,
    }}>{children}</div>
  );
}
