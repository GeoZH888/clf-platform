import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const TeacherPointsPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState('all');
  const [classes, setClasses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [pointsToAdd, setPointsToAdd] = useState(10);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  const txt = {
    zh: {
      title: '学生积分管理',
      subtitle: '为学生奖励或扣除积分',
      allClasses: '全部班级',
      search: '搜索学生...',
      name: '姓名',
      class: '班级',
      points: '当前积分',
      level: '等级',
      actions: '操作',
      addPoints: '加分',
      deductPoints: '扣分',
      history: '记录',
      noStudents: '暂无学生',
      addPointsTitle: '奖励积分',
      deductPointsTitle: '扣除积分',
      pointsAmount: '积分数量',
      reason: '原因',
      reasonPlaceholder: '如：作业完成优秀、课堂表现好...',
      submit: '确认',
      cancel: '取消',
      success: '操作成功！',
      quickReasons: '快捷选择',
      homework: '作业优秀',
      participation: '课堂参与',
      attendance: '全勤奖励',
      improvement: '进步明显',
      helping: '帮助同学',
      late: '迟到',
      absent: '缺勤',
      incomplete: '作业未完成'
    },
    en: {
      title: 'Student Points Management',
      subtitle: 'Award or deduct points for students',
      allClasses: 'All Classes',
      search: 'Search students...',
      name: 'Name',
      class: 'Class',
      points: 'Points',
      level: 'Level',
      actions: 'Actions',
      addPoints: 'Add',
      deductPoints: 'Deduct',
      history: 'History',
      noStudents: 'No students',
      addPointsTitle: 'Award Points',
      deductPointsTitle: 'Deduct Points',
      pointsAmount: 'Points',
      reason: 'Reason',
      reasonPlaceholder: 'e.g.: Excellent homework, good participation...',
      submit: 'Confirm',
      cancel: 'Cancel',
      success: 'Success!',
      quickReasons: 'Quick Select',
      homework: 'Excellent homework',
      participation: 'Class participation',
      attendance: 'Perfect attendance',
      improvement: 'Great improvement',
      helping: 'Helping classmates',
      late: 'Late',
      absent: 'Absent',
      incomplete: 'Incomplete homework'
    }
  };
  const t = txt[language] || txt.en;

  const levels = [
    { min: 0, name: { zh: '初级学员', en: 'Beginner' }, color: '#6b7280' },
    { min: 200, name: { zh: '学习新星', en: 'Rising Star' }, color: '#22c55e' },
    { min: 500, name: { zh: '进步达人', en: 'Fast Learner' }, color: '#3b82f6' },
    { min: 1000, name: { zh: '学霸', en: 'Top Student' }, color: '#8b5cf6' },
    { min: 2000, name: { zh: '学习大师', en: 'Master' }, color: '#f59e0b' },
    { min: 5000, name: { zh: '中文专家', en: 'Expert' }, color: '#ef4444' }
  ];

  const getLevel = (points) => {
    for (let i = levels.length - 1; i >= 0; i--) {
      if (points >= levels[i].min) return levels[i];
    }
    return levels[0];
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Demo data
      setClasses([
        { id: '1', name: 'HSK2早班' },
        { id: '2', name: 'HSK3下午班' },
        { id: '3', name: 'HSK4周末班' }
      ]);
      setStudents([
        { id: '1', name: '李明', name_zh: '李明', class_name: 'HSK2早班', class_id: '1', points: 580, streak: 15 },
        { id: '2', name: '王芳', name_zh: '王芳', class_name: 'HSK2早班', class_id: '1', points: 420, streak: 8 },
        { id: '3', name: 'Marco', name_zh: 'Marco', class_name: 'HSK3下午班', class_id: '2', points: 890, streak: 22 },
        { id: '4', name: 'Sofia', name_zh: 'Sofia', class_name: 'HSK3下午班', class_id: '2', points: 1250, streak: 30 },
        { id: '5', name: '张伟', name_zh: '张伟', class_name: 'HSK4周末班', class_id: '3', points: 2100, streak: 45 },
        { id: '6', name: 'Anna', name_zh: 'Anna', class_name: 'HSK4周末班', class_id: '3', points: 350, streak: 5 }
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPoints = (student, isDeduct = false) => {
    setSelectedStudent({ ...student, isDeduct });
    setPointsToAdd(isDeduct ? -10 : 10);
    setReason('');
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setMessage({ type: 'error', text: language === 'zh' ? '请填写原因' : 'Please enter a reason' });
      return;
    }

    try {
      // Update student points
      setStudents(students.map(s => 
        s.id === selectedStudent.id 
          ? { ...s, points: Math.max(0, s.points + pointsToAdd) }
          : s
      ));
      
      setMessage({ type: 'success', text: t.success });
      setShowModal(false);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const quickReasons = selectedStudent?.isDeduct 
    ? [t.late, t.absent, t.incomplete]
    : [t.homework, t.participation, t.attendance, t.improvement, t.helping];

  const filteredStudents = students.filter(s => 
    selectedClass === 'all' || s.class_id === selectedClass
  );

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>;
  }

  return (
    <div>
      <div className="content-header">
        <h1>🎯 {t.title}</h1>
        <p style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
          {message.text}
          <button onClick={() => setMessage({ type: '', text: '' })} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select 
          className="form-select" 
          style={{ width: 'auto' }}
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
        >
          <option value="all">{t.allClasses}</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="text" className="form-input" style={{ flex: 1, minWidth: '200px' }} placeholder={t.search} />
      </div>

      {/* Student List */}
      <div className="card">
        {filteredStudents.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>{t.noStudents}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>{t.name}</th>
                  <th>{t.class}</th>
                  <th>{t.points}</th>
                  <th>{t.level}</th>
                  <th>🔥 连续</th>
                  <th>{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(student => {
                  const level = getLevel(student.points);
                  return (
                    <tr key={student.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'var(--primary)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '500'
                          }}>
                            {(student.name_zh || student.name)?.charAt(0)}
                          </div>
                          <span style={{ fontWeight: '500' }}>{student.name_zh || student.name}</span>
                        </div>
                      </td>
                      <td>{student.class_name}</td>
                      <td>
                        <span style={{ fontWeight: '600', fontSize: '1.125rem' }}>{student.points}</span>
                      </td>
                      <td>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          background: `${level.color}20`,
                          color: level.color
                        }}>
                          {level.name[language] || level.name.en}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: student.streak > 7 ? '#f59e0b' : 'var(--text-muted)' }}>
                          🔥 {student.streak} 天
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-sm" 
                            style={{ background: '#22c55e', color: 'white' }}
                            onClick={() => handleAddPoints(student, false)}
                          >
                            +{t.addPoints}
                          </button>
                          <button 
                            className="btn btn-outline btn-sm"
                            style={{ color: '#ef4444', borderColor: '#ef4444' }}
                            onClick={() => handleAddPoints(student, true)}
                          >
                            -{t.deductPoints}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && selectedStudent && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem', color: selectedStudent.isDeduct ? '#ef4444' : '#22c55e' }}>
              {selectedStudent.isDeduct ? `➖ ${t.deductPointsTitle}` : `➕ ${t.addPointsTitle}`}
            </h3>
            
            <p style={{ marginBottom: '1rem' }}>
              学生: <strong>{selectedStudent.name_zh || selectedStudent.name}</strong>
              <br />
              当前积分: <strong>{selectedStudent.points}</strong>
            </p>

            <div className="form-group">
              <label className="form-label">{t.pointsAmount}</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(selectedStudent.isDeduct ? [5, 10, 20, 50] : [5, 10, 20, 50, 100]).map(p => (
                  <button
                    key={p}
                    className={`btn btn-sm ${Math.abs(pointsToAdd) === p ? (selectedStudent.isDeduct ? 'btn-danger' : 'btn-success') : 'btn-outline'}`}
                    style={Math.abs(pointsToAdd) === p ? { background: selectedStudent.isDeduct ? '#ef4444' : '#22c55e', color: 'white' } : {}}
                    onClick={() => setPointsToAdd(selectedStudent.isDeduct ? -p : p)}
                  >
                    {selectedStudent.isDeduct ? `-${p}` : `+${p}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t.quickReasons}</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {quickReasons.map(r => (
                  <button
                    key={r}
                    className={`btn btn-sm ${reason === r ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setReason(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t.reason}</label>
              <input
                type="text"
                className="form-input"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={t.reasonPlaceholder}
              />
            </div>

            <div style={{ 
              padding: '1rem', 
              background: 'var(--background)', 
              borderRadius: 'var(--radius-md)',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>变化后积分</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: selectedStudent.isDeduct ? '#ef4444' : '#22c55e' }}>
                {selectedStudent.points} → {Math.max(0, selectedStudent.points + pointsToAdd)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>{t.cancel}</button>
              <button 
                className="btn" 
                style={{ flex: 1, background: selectedStudent.isDeduct ? '#ef4444' : '#22c55e', color: 'white' }}
                onClick={handleSubmit}
              >
                {t.submit}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherPointsPage;
