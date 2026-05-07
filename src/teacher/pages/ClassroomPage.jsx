// src/teacher/pages/ClassroomPage.jsx
// ════════════════════════════════════════════════════════════════════════════
// Stage b1.1 — 课堂教学 / Classroom co-teacher entry page.
// Three-column layout: classes sidebar | chat | workspace.
// classId comes from route param (/teacher/classroom/:classId) — playground
// is the default when no param.
// ════════════════════════════════════════════════════════════════════════════

import { useNavigate, useParams } from 'react-router-dom';
import MyClasses from '../classroom/MyClasses';
import ChatPanel from '../classroom/ChatPanel';
import WorkspacePanel from '../classroom/WorkspacePanel';
import { useCoTeacher, PLAYGROUND_KEY } from '../classroom/useCoTeacher';

export default function ClassroomPage() {
  const navigate = useNavigate();
  const { classId } = useParams();
  // classId is undefined on /teacher/classroom (no param) → treat as playground

  const activeId = classId || PLAYGROUND_KEY;
  const { conversation, messages, plan, loading, error } = useCoTeacher(activeId);

  function handleSelectClass(id) {
    if (id === PLAYGROUND_KEY) {
      navigate('/teacher/classroom');
    } else {
      navigate(`/teacher/classroom/${id}`);
    }
  }

  return (
    <div style={S.root}>
      <MyClasses
        activeClassId={activeId}
        onSelectClass={handleSelectClass}
      />

      <ChatPanel
        conversation={conversation}
        messages={messages}
        loading={loading}
      />

      <WorkspacePanel
        plan={plan}
        loading={loading}
      />

      {error && (
        <div style={S.errorToast}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}

const S = {
  root: {
    display: 'flex',
    height: 'calc(100vh - 60px)', // adjust if TeacherLayout has a different header height
    width: '100%',
    background: '#fdf6e3',
    overflow: 'hidden',
  },
  errorToast: {
    position: 'fixed',
    bottom: 20, right: 20,
    padding: '10px 16px',
    background: '#fee2e2',
    color: '#991b1b',
    border: '1px solid #fca5a5',
    borderRadius: 8,
    fontSize: 12,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    zIndex: 1000,
  },
};
