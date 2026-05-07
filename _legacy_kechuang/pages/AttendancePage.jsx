import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const AttendancePage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('checkin'); // checkin, history, manage
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [qrCode, setQrCode] = useState(null);
  const [scanInput, setScanInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const isTeacher = ['teacher', 'admin', 'super_admin'].includes(user?.role);

  const txt = {
    zh: {
      title: isTeacher ? '📱 考勤管理' : '📱 我的考勤',
      checkin: '签到',
      history: '考勤记录',
      manage: '管理',
      generateQR: '生成签到二维码',
      scanQR: '扫码签到',
      manualCheckin: '手动签到',
      qrValid: '有效时间',
      minutes: '分钟',
      selectClass: '选择班级',
      qrGenerated: '二维码已生成',
      qrExpires: '过期时间',
      enterCode: '输入签到码',
      checkinSuccess: '签到成功！',
      checkinFailed: '签到失败',
      alreadyChecked: '今日已签到',
      qrExpired: '二维码已过期',
      qrInvalid: '无效的签到码',
      present: '出勤',
      absent: '缺勤',
      late: '迟到',
      excused: '请假',
      date: '日期',
      time: '时间',
      status: '状态',
      method: '方式',
      noRecords: '暂无记录',
      todayAttendance: '今日签到',
      totalStudents: '总人数',
      checkedIn: '已签到',
      notCheckedIn: '未签到',
      validDuration: '有效时长',
      refresh: '刷新',
      copyCode: '复制签到码',
      copied: '已复制！'
    },
    en: {
      title: isTeacher ? '📱 Attendance Management' : '📱 My Attendance',
      checkin: 'Check In',
      history: 'History',
      manage: 'Manage',
      generateQR: 'Generate QR Code',
      scanQR: 'Scan QR Code',
      manualCheckin: 'Manual Check In',
      qrValid: 'Valid for',
      minutes: 'minutes',
      selectClass: 'Select Class',
      qrGenerated: 'QR Code Generated',
      qrExpires: 'Expires at',
      enterCode: 'Enter check-in code',
      checkinSuccess: 'Check-in successful!',
      checkinFailed: 'Check-in failed',
      alreadyChecked: 'Already checked in today',
      qrExpired: 'QR Code expired',
      qrInvalid: 'Invalid check-in code',
      present: 'Present',
      absent: 'Absent',
      late: 'Late',
      excused: 'Excused',
      date: 'Date',
      time: 'Time',
      status: 'Status',
      method: 'Method',
      noRecords: 'No records',
      todayAttendance: 'Today\'s Attendance',
      totalStudents: 'Total Students',
      checkedIn: 'Checked In',
      notCheckedIn: 'Not Checked In',
      validDuration: 'Valid Duration',
      refresh: 'Refresh',
      copyCode: 'Copy Code',
      copied: 'Copied!'
    },
    it: {
      title: isTeacher ? '📱 Gestione Presenze' : '📱 Le Mie Presenze',
      checkin: 'Check In',
      history: 'Storico',
      manage: 'Gestione',
      generateQR: 'Genera QR Code',
      scanQR: 'Scansiona QR',
      manualCheckin: 'Check In Manuale',
      qrValid: 'Valido per',
      minutes: 'minuti',
      selectClass: 'Seleziona Classe',
      qrGenerated: 'QR Code Generato',
      qrExpires: 'Scade alle',
      enterCode: 'Inserisci codice',
      checkinSuccess: 'Check-in riuscito!',
      checkinFailed: 'Check-in fallito',
      alreadyChecked: 'Già registrato oggi',
      qrExpired: 'QR Code scaduto',
      qrInvalid: 'Codice non valido',
      present: 'Presente',
      absent: 'Assente',
      late: 'In ritardo',
      excused: 'Giustificato',
      date: 'Data',
      time: 'Ora',
      status: 'Stato',
      method: 'Metodo',
      noRecords: 'Nessun record',
      todayAttendance: 'Presenze Oggi',
      totalStudents: 'Totale Studenti',
      checkedIn: 'Presenti',
      notCheckedIn: 'Assenti',
      validDuration: 'Durata Validità',
      refresh: 'Aggiorna',
      copyCode: 'Copia Codice',
      copied: 'Copiato!'
    }
  };
  const t = txt[language] || txt.en;

  useEffect(() => {
    loadData();
  }, [selectedClass]);

  const loadData = async () => {
    if (!supabase) return;
    
    try {
      // 加载班级
      if (isTeacher) {
        const { data: classData } = await supabase
          .from('dwxz_classes')
          .select('*')
          .eq('teacher_id', user?.id);
        setClasses(classData || []);
        if (classData?.length > 0 && !selectedClass) {
          setSelectedClass(classData[0].id);
        }
      }

      // 加载考勤记录
      let query = supabase.from('dwxz_attendance').select('*');
      
      if (isTeacher && selectedClass) {
        query = query.eq('class_id', selectedClass);
      } else if (!isTeacher) {
        query = query.eq('student_id', user?.id);
      }
      
      const { data: records } = await query.order('date', { ascending: false }).limit(50);
      setAttendanceRecords(records || []);

      // 加载当前有效的二维码
      if (isTeacher && selectedClass) {
        const { data: qrData } = await supabase
          .from('dwxz_attendance_qrcodes')
          .select('*')
          .eq('class_id', selectedClass)
          .eq('is_active', true)
          .gt('valid_until', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (qrData?.length > 0) {
          setQrCode(qrData[0]);
        } else {
          setQrCode(null);
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  // 生成签到二维码
  const generateQRCode = async (validMinutes = 30) => {
    if (!selectedClass) {
      setMessage({ type: 'error', text: t.selectClass });
      return;
    }

    setLoading(true);
    try {
      // 生成唯一码
      const code = `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const now = new Date();
      const validUntil = new Date(now.getTime() + validMinutes * 60000);

      const { data, error } = await supabase.from('dwxz_attendance_qrcodes').insert([{
        class_id: selectedClass,
        teacher_id: user?.id,
        qr_code: code,
        valid_from: now.toISOString(),
        valid_until: validUntil.toISOString(),
        is_active: true
      }]).select().single();

      if (error) throw error;

      setQrCode(data);
      setMessage({ type: 'success', text: t.qrGenerated });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // 学生签到
  const handleCheckin = async () => {
    if (!scanInput.trim()) return;

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // 查找二维码
      const { data: qrData } = await supabase
        .from('dwxz_attendance_qrcodes')
        .select('*')
        .eq('qr_code', scanInput.trim())
        .eq('is_active', true)
        .single();

      if (!qrData) {
        setMessage({ type: 'error', text: t.qrInvalid });
        return;
      }

      // 检查是否过期
      if (new Date(qrData.valid_until) < new Date()) {
        setMessage({ type: 'error', text: t.qrExpired });
        return;
      }

      // 检查是否已签到
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('dwxz_attendance')
        .select('id')
        .eq('student_id', user?.id)
        .eq('class_id', qrData.class_id)
        .eq('date', today)
        .single();

      if (existing) {
        setMessage({ type: 'warning', text: t.alreadyChecked });
        return;
      }

      // 创建签到记录
      await supabase.from('dwxz_attendance').insert([{
        student_id: user?.id,
        class_id: qrData.class_id,
        date: today,
        status: 'present',
        check_in_time: new Date().toISOString(),
        check_in_method: 'qrcode',
        qrcode_id: qrData.id
      }]);

      // 更新扫码次数
      await supabase
        .from('dwxz_attendance_qrcodes')
        .update({ current_scans: qrData.current_scans + 1 })
        .eq('id', qrData.id);

      setMessage({ type: 'success', text: t.checkinSuccess });
      setScanInput('');
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: t.checkinFailed });
    } finally {
      setLoading(false);
    }
  };

  // 复制签到码
  const copyCode = () => {
    if (qrCode) {
      navigator.clipboard.writeText(qrCode.qr_code);
      setMessage({ type: 'success', text: t.copied });
    }
  };

  // 生成 QR Code SVG
  const generateQRSVG = (text) => {
    // 简单的 QR 码占位符（实际应使用 qrcode 库）
    return (
      <div style={{
        width: '200px',
        height: '200px',
        background: 'white',
        border: '2px solid var(--primary)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>📱</div>
        <div style={{ 
          fontFamily: 'monospace', 
          fontSize: '0.75rem', 
          wordBreak: 'break-all',
          textAlign: 'center',
          color: 'var(--text-muted)'
        }}>
          {text}
        </div>
      </div>
    );
  };

  const getStatusBadge = (status) => {
    const styles = {
      present: { bg: 'var(--success)', text: t.present },
      absent: { bg: 'var(--error)', text: t.absent },
      late: { bg: 'var(--warning)', text: t.late },
      excused: { bg: 'var(--info)', text: t.excused }
    };
    const s = styles[status] || styles.absent;
    return <span className="badge" style={{ background: s.bg, color: 'white' }}>{s.text}</span>;
  };

  return (
    <div>
      <div className="content-header">
        <h1>{t.title}</h1>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}

      {/* 标签页 */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`tab ${activeTab === 'checkin' ? 'active' : ''}`} onClick={() => setActiveTab('checkin')}>
          📱 {t.checkin}
        </button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          📋 {t.history}
        </button>
        {isTeacher && (
          <button className={`tab ${activeTab === 'manage' ? 'active' : ''}`} onClick={() => setActiveTab('manage')}>
            ⚙️ {t.manage}
          </button>
        )}
      </div>

      {/* 教师选择班级 */}
      {isTeacher && (
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label className="form-label">{t.selectClass}</label>
          <select
            className="form-select"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">-- {t.selectClass} --</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 签到页面 */}
      {activeTab === 'checkin' && (
        <div>
          {isTeacher ? (
            // 教师：生成二维码
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>🔲 {t.generateQR}</h3>
              
              {qrCode && new Date(qrCode.valid_until) > new Date() ? (
                <div style={{ textAlign: 'center' }}>
                  {generateQRSVG(qrCode.qr_code)}
                  
                  <div style={{ marginTop: '1rem' }}>
                    <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>{t.qrGenerated}</p>
                    <p style={{ fontFamily: 'monospace', fontSize: '1.25rem', color: 'var(--primary)' }}>
                      {qrCode.qr_code}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {t.qrExpires}: {new Date(qrCode.valid_until).toLocaleTimeString()}
                    </p>
                  </div>

                  <button className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={copyCode}>
                    📋 {t.copyCode}
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
                    {language === 'zh' ? '选择有效时长，生成签到二维码' : 'Select duration and generate QR code'}
                  </p>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {[15, 30, 45, 60].map(mins => (
                      <button
                        key={mins}
                        className="btn btn-outline"
                        onClick={() => generateQRCode(mins)}
                        disabled={loading || !selectedClass}
                      >
                        {mins} {t.minutes}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // 学生：扫码签到
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>📱 {t.scanQR}</h3>
              
              <div className="form-group">
                <label className="form-label">{t.enterCode}</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value.toUpperCase())}
                    placeholder="ATT-XXXXXX-XXXX"
                    style={{ flex: 1, fontFamily: 'monospace' }}
                  />
                  <button 
                    className="btn btn-primary"
                    onClick={handleCheckin}
                    disabled={loading || !scanInput.trim()}
                  >
                    {t.checkin}
                  </button>
                </div>
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '1rem' }}>
                {language === 'zh' 
                  ? '请输入老师提供的签到码，或扫描二维码' 
                  : 'Enter the check-in code provided by your teacher'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 考勤记录 */}
      {activeTab === 'history' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>📋 {t.history}</h3>
            <button className="btn btn-outline btn-sm" onClick={loadData}>
              🔄 {t.refresh}
            </button>
          </div>

          {attendanceRecords.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              {t.noRecords}
            </p>
          ) : (
            <div className="table-container">
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>{t.date}</th>
                    <th>{t.time}</th>
                    <th>{t.status}</th>
                    <th>{t.method}</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords.map(record => (
                    <tr key={record.id}>
                      <td>{record.date}</td>
                      <td>{record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString() : '-'}</td>
                      <td>{getStatusBadge(record.status)}</td>
                      <td>
                        <span className="badge badge-info">
                          {record.check_in_method === 'qrcode' ? '📱 QR' : '✋ ' + (language === 'zh' ? '手动' : 'Manual')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 教师管理 */}
      {activeTab === 'manage' && isTeacher && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>📊 {t.todayAttendance}</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '2rem', color: 'var(--primary)' }}>
                {attendanceRecords.filter(r => r.date === new Date().toISOString().split('T')[0]).length}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.checkedIn}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '2rem', color: 'var(--success)' }}>
                {attendanceRecords.filter(r => r.status === 'present').length}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.present}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '2rem', color: 'var(--warning)' }}>
                {attendanceRecords.filter(r => r.status === 'late').length}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.late}</div>
            </div>
          </div>

          <h4 style={{ marginBottom: '1rem' }}>{t.manualCheckin}</h4>
          <p style={{ color: 'var(--text-muted)' }}>
            {language === 'zh' 
              ? '手动签到功能开发中...' 
              : 'Manual check-in feature coming soon...'}
          </p>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
