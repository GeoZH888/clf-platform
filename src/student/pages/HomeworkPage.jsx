// src/student/pages/HomeworkPage.jsx
// Student view: list assignments + open detail + submit response
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { PageHero } from '../../shared/RolePanelLayout';
import { FileText, ChevronRight, X, Calendar, Send } from 'lucide-react';
import FileUploadButton from '../../shared/FileUploadButton';
import AudioRecorder from '../../shared/AudioRecorder';
import AudioPlayer from '../../shared/AudioPlayer';
import PDFViewer from '../../shared/PDFViewer';
import { uploadStudentResponse, refreshSignedUrl } from '../../lib/homeworkStorage';

const ACCENT = '#10b981';

export default function StudentHomeworkPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [submap, setSubmap] = useState({});
  const [active, setActive] = useState(null);

  const load = async () => {
    if (!user?.id) return;
    const { data: cls } = await supabase
      .from('clf_class_members').select('class_id').eq('user_id', user.id);
    const ids = (cls || []).map(c => c.class_id);
    if (ids.length === 0) { setItems([]); return; }
    const { data: hw } = await supabase
      .from('clf_homework')
      .select('*, clf_classes(name)')
      .in('class_id', ids)
      .order('created_at', { ascending: false });
    setItems(hw || []);
    const { data: subs } = await supabase
      .from('clf_homework_submissions')
      .select('*').eq('student_id', user.id);
    const map = {};
    (subs || []).forEach(s => { map[s.homework_id] = s; });
    setSubmap(map);
  };
  useEffect(() => { load(); }, [user?.id]);

  return (
    <div>
      <PageHero icon="📝" title="我的作业" subtitle="Homework" accentColor={ACCENT}>
        {active && (
          <button onClick={() => { setActive(null); load(); }} style={{
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

      {!active && (
        items.length === 0 ? (
          <Empty>暂无作业</Empty>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map(h => {
              const sub = submap[h.id];
              return (
                <button key={h.id} onClick={() => setActive(h)} style={{
                  ...card, textAlign: 'left', cursor: 'pointer', width: '100%',
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <FileText size={14} color={ACCENT}/>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff5e6' }}>{h.title}</div>
                    <span style={chip}>{h.clf_classes?.name}</span>
                    {sub?.graded_at ? (
                      <span style={{ ...chip, background: '#10b98130', color: '#86efac' }}>
                        已批 {sub.score ?? '-'}
                      </span>
                    ) : sub ? (
                      <span style={{ ...chip, background: '#f59e0b30', color: '#fcd34d' }}>
                        已提交
                      </span>
                    ) : (
                      <span style={{ ...chip, background: '#a0785030', color: '#fef3c7' }}>
                        待提交
                      </span>
                    )}
                    <ChevronRight size={14} color="rgba(253,246,227,0.4)"
                      style={{ marginLeft: 'auto' }}/>
                  </div>
                  {h.due_at && (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center',
                      fontSize: 11, color: '#fda4af' }}>
                      <Calendar size={11}/>
                      截止：{new Date(h.due_at).toLocaleString()}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )
      )}

      {active && (
        <DetailView homework={active} existingSub={submap[active.id]}
          userId={user?.id} onSubmitted={() => { load(); }}/>
      )}
    </div>
  );
}

// ─── Detail view: prompt + response form ────────────────────────
function DetailView({ homework, existingSub, userId, onSubmitted }) {
  const [text, setText] = useState(existingSub?.content || '');
  const [pdfFile, setPdfFile] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [saving, setSaving] = useState(false);
  const [promptUrl, setPromptUrl] = useState(homework.attachment_url);
  const [respPdfUrl, setRespPdfUrl] = useState(existingSub?.response_pdf_url);
  const [respAudioUrl, setRespAudioUrl] = useState(existingSub?.response_audio_url);

  useEffect(() => {
    if (homework.attachment_path && !promptUrl) {
      refreshSignedUrl(homework.attachment_path).then(setPromptUrl);
    }
  }, [homework.attachment_path]);
  useEffect(() => {
    if (existingSub?.response_pdf_path && !respPdfUrl) {
      refreshSignedUrl(existingSub.response_pdf_path).then(setRespPdfUrl);
    }
    if (existingSub?.response_audio_path && !respAudioUrl) {
      refreshSignedUrl(existingSub.response_audio_path).then(setRespAudioUrl);
    }
  }, [existingSub?.id]);

  const submit = async () => {
    setSaving(true);
    try {
      // 1. Upsert submission row first (need ID for storage path)
      let subId = existingSub?.id;
      if (!subId) {
        const { data, error } = await supabase
          .from('clf_homework_submissions')
          .insert({
            homework_id: homework.id,
            student_id: userId,
            content: text.trim() || null,
            submitted_at: new Date().toISOString(),
          })
          .select().single();
        if (error) throw error;
        subId = data.id;
      } else {
        await supabase.from('clf_homework_submissions').update({
          content: text.trim() || null,
          submitted_at: new Date().toISOString(),
        }).eq('id', subId);
      }

      // 2. Upload media if provided
      const updates = {};
      if (pdfFile) {
        const up = await uploadStudentResponse(subId, pdfFile, 'pdf');
        updates.response_pdf_url = up.url;
        updates.response_pdf_path = up.path;
        updates.response_pdf_name = up.name;
      }
      if (audioBlob) {
        const file = new File([audioBlob], 'response.webm', { type: 'audio/webm' });
        const up = await uploadStudentResponse(subId, file, 'audio');
        updates.response_audio_url = up.url;
        updates.response_audio_path = up.path;
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('clf_homework_submissions').update(updates).eq('id', subId);
      }
      onSubmitted();
      alert('提交成功！');
    } catch (e) {
      alert('提交失败：' + (e.message || e));
    } finally { setSaving(false); }
  };

  const isGraded = !!existingSub?.graded_at;

  return (
    <div>
      {/* Prompt */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff5e6', marginBottom: 8,
          fontFamily: "'STKaiti','KaiTi',serif" }}>
          {homework.title}
        </div>
        {homework.description && (
          <div style={{ fontSize: 13, color: 'rgba(253,246,227,0.85)', marginBottom: 10,
            whiteSpace: 'pre-wrap' }}>
            {homework.description}
          </div>
        )}
        {homework.words_list?.length > 0 && (
          <div style={{ marginBottom: 10 }}>
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

      {/* Existing graded feedback (read-only) */}
      {isGraded && (
        <div style={{
          ...card, marginBottom: 16,
          background: 'rgba(16,185,129,0.08)', borderColor: '#10b98155',
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'rgba(253,246,227,0.7)' }}>分数</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#86efac' }}>
              {existingSub.score ?? '-'}
            </div>
          </div>
          {existingSub.feedback && (
            <div style={{ fontSize: 12, color: '#fff5e6',
              padding: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 6,
              whiteSpace: 'pre-wrap' }}>
              老师批语：{existingSub.feedback}
            </div>
          )}
        </div>
      )}

      {/* Response area (locked once graded) */}
      <div style={card}>
        <div style={{ fontSize: 14, color: '#fff5e6', marginBottom: 10, fontWeight: 600 }}>
          {isGraded ? '我的回答（已批改，不可修改）' : '回答区'}
        </div>

        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="文字回答（可选）" rows={5}
          disabled={isGraded}
          style={{...input, resize: 'vertical', fontFamily: 'inherit'}}/>

        {!isGraded && (
          <>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'rgba(253,246,227,0.7)', marginBottom: 6 }}>
                上传 PDF（可选）：
              </div>
              <FileUploadButton accept=".pdf" label="选择 PDF"
                onPick={setPdfFile} accentColor={ACCENT}/>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'rgba(253,246,227,0.7)', marginBottom: 6 }}>
                录制音频（可选）：
              </div>
              <AudioRecorder accentColor={ACCENT} onComplete={setAudioBlob}/>
            </div>
          </>
        )}

        {/* Existing media (if already submitted) */}
        {respPdfUrl && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: 'rgba(253,246,227,0.6)', marginBottom: 4 }}>
              已上传的 PDF：
            </div>
            <PDFViewer src={respPdfUrl} name={existingSub.response_pdf_name}
              accentColor={ACCENT} height={300}/>
          </div>
        )}
        {respAudioUrl && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: 'rgba(253,246,227,0.6)', marginBottom: 4 }}>
              已上传的音频：
            </div>
            <AudioPlayer src={respAudioUrl} label="我的录音" accentColor={ACCENT}/>
          </div>
        )}

        {!isGraded && (
          <button onClick={submit} disabled={saving} style={{
            background: ACCENT, color: '#fff', border: 'none',
            padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, marginTop: 14,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Send size={14}/> {saving ? '提交中…' : (existingSub ? '更新答案' : '提交')}
          </button>
        )}
      </div>
    </div>
  );
}

const card = {
  background: 'rgba(253,246,227,0.05)',
  border: '1px solid rgba(255,245,230,0.15)',
  borderRadius: 12, padding: 16,
};
const input = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,245,230,0.2)',
  color: '#fff5e6', padding: '8px 12px', borderRadius: 6,
  fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
};
const chip = {
  fontSize: 10, padding: '2px 8px', borderRadius: 10,
  background: '#10b98130', color: '#86efac',
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
