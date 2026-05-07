import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';

// ==================== USER: TEACHER APPLICATION FORM ====================
export const TeacherApplicationPage = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingApplication, setExistingApplication] = useState(null);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    qualifications: '',
    experience_years: '',
    experience_description: '',
    motivation: '',
    selected_classes: [],
    proposed_new_class: '',
    proposed_class_level: 'beginner',
    proposed_class_description: '',
    teaching_style: '',
    availability: '',
    languages_spoken: ['zh'],
    certifications: '',
    resume_url: ''
  });

  const texts = {
    zh: {
      title: '申请成为教师',
      subtitle: '填写申请表，加入我们的教师团队',
      personal_info: '个人信息',
      full_name: '全名',
      email: '电子邮箱',
      phone: '电话号码',
      qualifications: '教育背景/学历',
      experience: '教学经验',
      experience_years: '教学年限',
      experience_description: '经验描述',
      motivation: '申请动机',
      motivation_placeholder: '请说明您为什么想成为中文教师...',
      class_selection: '班级选择',
      select_existing: '选择现有班级（至少选择一个）',
      or_propose: '或者提议新班级',
      proposed_class: '新班级名称',
      proposed_level: '班级级别',
      proposed_description: '班级描述',
      teaching_info: '教学信息',
      teaching_style: '教学风格',
      teaching_style_placeholder: '描述您的教学方法和风格...',
      availability: '可用时间',
      availability_placeholder: '例如：周一至周五晚上，周末上午',
      languages: '会说的语言',
      certifications: '相关证书',
      certifications_placeholder: 'HSK证书、教师资格证等',
      resume: '简历链接（可选）',
      submit: '提交申请',
      cancel: '取消',
      application_status: '申请状态',
      status_pending: '待审核',
      status_approved: '已批准 ✓',
      status_rejected: '已拒绝',
      submitted_on: '提交时间',
      reviewer_notes: '审核意见',
      withdraw: '撤回申请',
      already_teacher: '您已经是教师',
      edit_application: '修改申请',
      beginner: '初级',
      intermediate: '中级',
      advanced: '高级',
      success_message: '申请已提交！我们会尽快审核。',
      error_select_class: '请至少选择一个现有班级或提议一个新班级',
      years: '年'
    },
    en: {
      title: 'Apply to Become a Teacher',
      subtitle: 'Fill out the application form to join our teaching team',
      personal_info: 'Personal Information',
      full_name: 'Full Name',
      email: 'Email',
      phone: 'Phone Number',
      qualifications: 'Education/Qualifications',
      experience: 'Teaching Experience',
      experience_years: 'Years of Experience',
      experience_description: 'Experience Description',
      motivation: 'Motivation',
      motivation_placeholder: 'Please explain why you want to become a Chinese teacher...',
      class_selection: 'Class Selection',
      select_existing: 'Select Existing Classes (at least one)',
      or_propose: 'Or Propose a New Class',
      proposed_class: 'New Class Name',
      proposed_level: 'Class Level',
      proposed_description: 'Class Description',
      teaching_info: 'Teaching Information',
      teaching_style: 'Teaching Style',
      teaching_style_placeholder: 'Describe your teaching methods and style...',
      availability: 'Availability',
      availability_placeholder: 'e.g., Weekday evenings, Weekend mornings',
      languages: 'Languages Spoken',
      certifications: 'Relevant Certifications',
      certifications_placeholder: 'HSK certificate, teaching license, etc.',
      resume: 'Resume Link (optional)',
      submit: 'Submit Application',
      cancel: 'Cancel',
      application_status: 'Application Status',
      status_pending: 'Pending Review',
      status_approved: 'Approved ✓',
      status_rejected: 'Rejected',
      submitted_on: 'Submitted On',
      reviewer_notes: 'Reviewer Notes',
      withdraw: 'Withdraw Application',
      already_teacher: 'You are already a teacher',
      edit_application: 'Edit Application',
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      advanced: 'Advanced',
      success_message: 'Application submitted! We will review it soon.',
      error_select_class: 'Please select at least one existing class or propose a new class',
      years: 'years'
    },
    it: {
      title: 'Candidati come Insegnante',
      subtitle: 'Compila il modulo per unirti al nostro team',
      personal_info: 'Informazioni Personali',
      full_name: 'Nome Completo',
      email: 'Email',
      phone: 'Telefono',
      qualifications: 'Istruzione/Qualifiche',
      experience: 'Esperienza Didattica',
      experience_years: 'Anni di Esperienza',
      experience_description: 'Descrizione Esperienza',
      motivation: 'Motivazione',
      motivation_placeholder: 'Spiega perché vuoi diventare insegnante di cinese...',
      class_selection: 'Selezione Classe',
      select_existing: 'Seleziona Classi Esistenti (almeno una)',
      or_propose: 'Oppure Proponi una Nuova Classe',
      proposed_class: 'Nome Nuova Classe',
      proposed_level: 'Livello Classe',
      proposed_description: 'Descrizione Classe',
      teaching_info: 'Informazioni Didattiche',
      teaching_style: 'Stile di Insegnamento',
      teaching_style_placeholder: 'Descrivi i tuoi metodi e stile...',
      availability: 'Disponibilità',
      availability_placeholder: 'es., Sere feriali, Mattine weekend',
      languages: 'Lingue Parlate',
      certifications: 'Certificazioni',
      certifications_placeholder: 'Certificato HSK, abilitazione, ecc.',
      resume: 'Link CV (opzionale)',
      submit: 'Invia Candidatura',
      cancel: 'Annulla',
      application_status: 'Stato Candidatura',
      status_pending: 'In Attesa',
      status_approved: 'Approvata ✓',
      status_rejected: 'Rifiutata',
      submitted_on: 'Inviata Il',
      reviewer_notes: 'Note Revisore',
      withdraw: 'Ritira Candidatura',
      already_teacher: 'Sei già un insegnante',
      edit_application: 'Modifica Candidatura',
      beginner: 'Principiante',
      intermediate: 'Intermedio',
      advanced: 'Avanzato',
      success_message: 'Candidatura inviata! La esamineremo presto.',
      error_select_class: 'Seleziona almeno una classe o proponi una nuova',
      years: 'anni'
    }
  };

  const txt = texts[language] || texts.en;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [appRes, classesRes] = await Promise.all([
        api.get('/teacher-application/my-application'),
        api.get('/teacher-application/available-classes')
      ]);
      if (appRes.data.application) {
        setExistingApplication(appRes.data.application);
        setForm({ ...form, ...appRes.data.application });
      }
      setAvailableClasses(classesRes.data.classes || []);
    } catch (error) {
      // Demo data
      setAvailableClasses([
        { id: 1, name: 'HSK 1 - 初级班', level: 'beginner', needs_teacher: true },
        { id: 2, name: 'HSK 2 - 基础班', level: 'beginner', needs_teacher: true },
        { id: 3, name: 'HSK 3 - 中级班', level: 'intermediate', needs_teacher: false },
        { id: 4, name: 'HSK 4 - 进阶班', level: 'intermediate', needs_teacher: true },
        { id: 5, name: '商务中文', level: 'advanced', needs_teacher: true },
        { id: 6, name: '儿童中文班', level: 'beginner', needs_teacher: true }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClassToggle = (classId) => {
    setForm(prev => ({
      ...prev,
      selected_classes: prev.selected_classes.includes(classId)
        ? prev.selected_classes.filter(id => id !== classId)
        : [...prev.selected_classes, classId]
    }));
  };

  const handleLanguageToggle = (langCode) => {
    setForm(prev => ({
      ...prev,
      languages_spoken: prev.languages_spoken.includes(langCode)
        ? prev.languages_spoken.filter(l => l !== langCode)
        : [...prev.languages_spoken, langCode]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validate: must select at least one class OR propose a new one
    if (form.selected_classes.length === 0 && !form.proposed_new_class.trim()) {
      setError(txt.error_select_class);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/teacher-application/submit', {
        ...form,
        user_id: user.id,
        user_name: user.name,
        status: 'pending'
      });
      setSuccess(txt.success_message);
      loadData();
    } catch (err) {
      // Demo: save locally
      setExistingApplication({
        ...form,
        id: Date.now(),
        status: 'pending',
        created_at: new Date().toISOString()
      });
      setSuccess(txt.success_message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!window.confirm(language === 'zh' ? '确定撤回申请？' : 'Withdraw application?')) return;
    try {
      await api.delete(`/teacher-application/${existingApplication.id}`);
      setExistingApplication(null);
      setForm({
        full_name: '', email: '', phone: '', qualifications: '', experience_years: '',
        experience_description: '', motivation: '', selected_classes: [], proposed_new_class: '',
        proposed_class_level: 'beginner', proposed_class_description: '', teaching_style: '',
        availability: '', languages_spoken: ['zh'], certifications: '', resume_url: ''
      });
    } catch {
      setExistingApplication(null);
    }
  };

  if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>;

  // Already a teacher
  if (user?.role === 'teacher') {
    return (
      <div className="card" style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
        <span style={{ fontSize: '4rem' }}>👨‍🏫</span>
        <h2 style={{ marginTop: '1rem' }}>{txt.already_teacher}</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          {language === 'zh' ? '您已经是教师，可以在教师中心管理您的班级。' : 'You can manage your classes in the Teacher Center.'}
        </p>
      </div>
    );
  }

  // Show existing application status
  if (existingApplication && existingApplication.status) {
    return (
      <div className="card" style={{ maxWidth: '700px', margin: '2rem auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '4rem' }}>
            {existingApplication.status === 'approved' ? '🎉' : existingApplication.status === 'rejected' ? '😔' : '⏳'}
          </span>
          <h2 style={{ marginTop: '1rem' }}>{txt.application_status}</h2>
          <span className={`badge badge-${existingApplication.status === 'approved' ? 'success' : existingApplication.status === 'rejected' ? 'error' : 'warning'}`} style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
            {existingApplication.status === 'approved' ? txt.status_approved : existingApplication.status === 'rejected' ? txt.status_rejected : txt.status_pending}
          </span>
        </div>

        <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
          <p><strong>{txt.submitted_on}:</strong> {new Date(existingApplication.created_at).toLocaleDateString()}</p>
          <p><strong>{txt.full_name}:</strong> {existingApplication.full_name}</p>
          <p><strong>{txt.experience_years}:</strong> {existingApplication.experience_years} {txt.years}</p>
          {existingApplication.selected_classes?.length > 0 && (
            <p><strong>{txt.select_existing}:</strong> {existingApplication.selected_classes.map(id => availableClasses.find(c => c.id === id)?.name).filter(Boolean).join(', ')}</p>
          )}
          {existingApplication.proposed_new_class && (
            <p><strong>{txt.proposed_class}:</strong> {existingApplication.proposed_new_class}</p>
          )}
        </div>

        {existingApplication.reviewer_notes && (
          <div style={{ background: existingApplication.status === 'approved' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
            <strong>{txt.reviewer_notes}:</strong>
            <p>{existingApplication.reviewer_notes}</p>
          </div>
        )}

        {existingApplication.status === 'pending' && (
          <button className="btn btn-outline btn-block" onClick={handleWithdraw} style={{ color: 'var(--error)' }}>
            {txt.withdraw}
          </button>
        )}
      </div>
    );
  }

  // Application Form
  return (
    <div>
      <div className="content-header">
        <h1>👨‍🏫 {txt.title}</h1>
        <p style={{ color: 'var(--text-muted)' }}>{txt.subtitle}</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>{success}</div>}

      <form onSubmit={handleSubmit}>
        {/* Personal Information */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3>📋 {txt.personal_info}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{txt.full_name} *</label>
              <input type="text" className="form-input" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">{txt.email} *</label>
              <input type="email" className="form-input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">{txt.phone}</label>
              <input type="tel" className="form-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{txt.qualifications} *</label>
            <input type="text" className="form-input" value={form.qualifications} onChange={e => setForm({...form, qualifications: e.target.value})} required placeholder={language === 'zh' ? '例如：北京大学中文系学士' : 'e.g., BA in Chinese Language'} />
          </div>
        </div>

        {/* Teaching Experience */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3>📚 {txt.experience}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{txt.experience_years} *</label>
              <select className="form-select" value={form.experience_years} onChange={e => setForm({...form, experience_years: e.target.value})} required>
                <option value="">--</option>
                <option value="0">0 ({language === 'zh' ? '新手' : 'New'})</option>
                <option value="1-2">1-2 {txt.years}</option>
                <option value="3-5">3-5 {txt.years}</option>
                <option value="5-10">5-10 {txt.years}</option>
                <option value="10+">10+ {txt.years}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{txt.experience_description}</label>
              <input type="text" className="form-input" value={form.experience_description} onChange={e => setForm({...form, experience_description: e.target.value})} placeholder={language === 'zh' ? '简述您的教学经历' : 'Briefly describe your teaching experience'} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{txt.motivation} *</label>
            <textarea className="form-textarea" rows={3} value={form.motivation} onChange={e => setForm({...form, motivation: e.target.value})} required placeholder={txt.motivation_placeholder} />
          </div>
        </div>

        {/* Class Selection - REQUIRED */}
        <div className="card" style={{ marginBottom: '1rem', border: '2px solid var(--primary)' }}>
          <h3>🎓 {txt.class_selection} <span style={{ color: 'var(--error)' }}>*</span></h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {language === 'zh' ? '必须选择至少一个现有班级，或提议一个新班级' : 'You must select at least one existing class OR propose a new class'}
          </p>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">{txt.select_existing}</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
              {availableClasses.map(cls => (
                <label key={cls.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', border: form.selected_classes.includes(cls.id) ? '2px solid var(--primary)' : '1px solid var(--border)', borderRadius: '0.5rem', cursor: 'pointer', background: form.selected_classes.includes(cls.id) ? 'rgba(196,30,58,0.05)' : 'white' }}>
                  <input type="checkbox" checked={form.selected_classes.includes(cls.id)} onChange={() => handleClassToggle(cls.id)} />
                  <div>
                    <strong>{cls.name}</strong>
                    {cls.needs_teacher && <span className="badge badge-warning" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>{language === 'zh' ? '需要教师' : 'Needs Teacher'}</span>}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '1rem' }}>
            <label className="form-label">{txt.or_propose}</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">{txt.proposed_class}</label>
                <input type="text" className="form-input" value={form.proposed_new_class} onChange={e => setForm({...form, proposed_new_class: e.target.value})} placeholder={language === 'zh' ? '例如：意大利人中文班' : 'e.g., Chinese for Italians'} />
              </div>
              <div className="form-group">
                <label className="form-label">{txt.proposed_level}</label>
                <select className="form-select" value={form.proposed_class_level} onChange={e => setForm({...form, proposed_class_level: e.target.value})}>
                  <option value="beginner">{txt.beginner}</option>
                  <option value="intermediate">{txt.intermediate}</option>
                  <option value="advanced">{txt.advanced}</option>
                </select>
              </div>
            </div>
            {form.proposed_new_class && (
              <div className="form-group">
                <label className="form-label">{txt.proposed_description}</label>
                <textarea className="form-textarea" rows={2} value={form.proposed_class_description} onChange={e => setForm({...form, proposed_class_description: e.target.value})} placeholder={language === 'zh' ? '描述您提议班级的目标和内容' : 'Describe the goals and content of your proposed class'} />
              </div>
            )}
          </div>
        </div>

        {/* Teaching Info */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3>🎯 {txt.teaching_info}</h3>
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label">{txt.teaching_style}</label>
            <textarea className="form-textarea" rows={2} value={form.teaching_style} onChange={e => setForm({...form, teaching_style: e.target.value})} placeholder={txt.teaching_style_placeholder} />
          </div>
          <div className="form-group">
            <label className="form-label">{txt.availability} *</label>
            <input type="text" className="form-input" value={form.availability} onChange={e => setForm({...form, availability: e.target.value})} required placeholder={txt.availability_placeholder} />
          </div>
          <div className="form-group">
            <label className="form-label">{txt.languages}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {[{ code: 'zh', name: '中文' }, { code: 'en', name: 'English' }, { code: 'it', name: 'Italiano' }, { code: 'es', name: 'Español' }, { code: 'fr', name: 'Français' }].map(lang => (
                <label key={lang.code} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.5rem 0.75rem', border: form.languages_spoken.includes(lang.code) ? '2px solid var(--primary)' : '1px solid var(--border)', borderRadius: '2rem', cursor: 'pointer', background: form.languages_spoken.includes(lang.code) ? 'rgba(196,30,58,0.1)' : 'white' }}>
                  <input type="checkbox" checked={form.languages_spoken.includes(lang.code)} onChange={() => handleLanguageToggle(lang.code)} style={{ display: 'none' }} />
                  {lang.name}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{txt.certifications}</label>
              <input type="text" className="form-input" value={form.certifications} onChange={e => setForm({...form, certifications: e.target.value})} placeholder={txt.certifications_placeholder} />
            </div>
            <div className="form-group">
              <label className="form-label">{txt.resume}</label>
              <input type="url" className="form-input" value={form.resume_url} onChange={e => setForm({...form, resume_url: e.target.value})} placeholder="https://..." />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
            {submitting ? '...' : `📤 ${txt.submit}`}
          </button>
        </div>
      </form>
    </div>
  );
};

// ==================== ADMIN: APPLICATION REVIEW ====================
export const TeacherApplicationReview = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [filter, setFilter] = useState('pending');

  const texts = {
    zh: {
      title: '教师申请审核',
      subtitle: '审核并批准教师申请',
      pending: '待审核',
      approved: '已批准',
      rejected: '已拒绝',
      all: '全部',
      applicant: '申请人',
      submitted: '提交时间',
      experience: '教学经验',
      classes: '申请班级',
      proposed: '提议新班级',
      view_details: '查看详情',
      approve: '批准',
      reject: '拒绝',
      review_notes: '审核意见',
      review_notes_placeholder: '添加审核意见（可选）...',
      confirm_approve: '确定批准此申请？申请人将成为教师。',
      confirm_reject: '确定拒绝此申请？',
      no_applications: '暂无申请',
      approved_success: '已批准！申请人已升级为教师。',
      rejected_success: '已拒绝。',
      qualifications: '学历',
      motivation: '申请动机',
      teaching_style: '教学风格',
      availability: '可用时间',
      languages: '会说语言',
      certifications: '证书',
      back: '返回',
      years: '年'
    },
    en: {
      title: 'Teacher Application Review',
      subtitle: 'Review and approve teacher applications',
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      all: 'All',
      applicant: 'Applicant',
      submitted: 'Submitted',
      experience: 'Experience',
      classes: 'Applied Classes',
      proposed: 'Proposed Class',
      view_details: 'View Details',
      approve: 'Approve',
      reject: 'Reject',
      review_notes: 'Review Notes',
      review_notes_placeholder: 'Add review notes (optional)...',
      confirm_approve: 'Approve this application? The applicant will become a teacher.',
      confirm_reject: 'Reject this application?',
      no_applications: 'No applications',
      approved_success: 'Approved! Applicant is now a teacher.',
      rejected_success: 'Rejected.',
      qualifications: 'Qualifications',
      motivation: 'Motivation',
      teaching_style: 'Teaching Style',
      availability: 'Availability',
      languages: 'Languages',
      certifications: 'Certifications',
      back: 'Back',
      years: 'years'
    },
    it: {
      title: 'Revisione Candidature Insegnanti',
      subtitle: 'Rivedi e approva le candidature',
      pending: 'In Attesa',
      approved: 'Approvate',
      rejected: 'Rifiutate',
      all: 'Tutte',
      applicant: 'Candidato',
      submitted: 'Inviata',
      experience: 'Esperienza',
      classes: 'Classi Richieste',
      proposed: 'Classe Proposta',
      view_details: 'Dettagli',
      approve: 'Approva',
      reject: 'Rifiuta',
      review_notes: 'Note Revisione',
      review_notes_placeholder: 'Aggiungi note (opzionale)...',
      confirm_approve: 'Approvare? Il candidato diventerà insegnante.',
      confirm_reject: 'Rifiutare questa candidatura?',
      no_applications: 'Nessuna candidatura',
      approved_success: 'Approvata! Ora è un insegnante.',
      rejected_success: 'Rifiutata.',
      qualifications: 'Qualifiche',
      motivation: 'Motivazione',
      teaching_style: 'Stile Didattico',
      availability: 'Disponibilità',
      languages: 'Lingue',
      certifications: 'Certificazioni',
      back: 'Indietro',
      years: 'anni'
    }
  };

  const txt = texts[language] || texts.en;

  useEffect(() => { loadApplications(); }, [filter]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/teacher-application/all?status=${filter}`);
      setApplications(res.data.applications || []);
    } catch {
      // Demo data
      setApplications([
        { id: 1, user_id: 10, full_name: 'Maria Rossi', email: 'maria@example.com', qualifications: 'MA Chinese Studies', experience_years: '3-5', motivation: 'I love teaching Chinese...', selected_classes: [1, 4], proposed_new_class: '', availability: 'Weekday evenings', languages_spoken: ['zh', 'it', 'en'], status: 'pending', created_at: '2024-01-15' },
        { id: 2, user_id: 11, full_name: '李明', email: 'liming@example.com', qualifications: 'BA Education', experience_years: '5-10', motivation: '我想帮助更多人学中文...', selected_classes: [], proposed_new_class: '商务中文高级班', proposed_class_level: 'advanced', availability: '周末', languages_spoken: ['zh', 'en'], status: 'pending', created_at: '2024-01-14' }
      ].filter(a => filter === 'all' || a.status === filter));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (app) => {
    if (!window.confirm(txt.confirm_approve)) return;
    try {
      await api.post(`/teacher-application/${app.id}/approve`, {
        reviewer_id: user.id,
        reviewer_notes: reviewNotes
      });
      alert(txt.approved_success);
      loadApplications();
      setSelectedApp(null);
    } catch {
      // Demo
      setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: 'approved', reviewer_notes: reviewNotes } : a));
      alert(txt.approved_success);
      setSelectedApp(null);
    }
  };

  const handleReject = async (app) => {
    if (!window.confirm(txt.confirm_reject)) return;
    try {
      await api.post(`/teacher-application/${app.id}/reject`, {
        reviewer_id: user.id,
        reviewer_notes: reviewNotes
      });
      alert(txt.rejected_success);
      loadApplications();
      setSelectedApp(null);
    } catch {
      setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: 'rejected', reviewer_notes: reviewNotes } : a));
      alert(txt.rejected_success);
      setSelectedApp(null);
    }
  };

  if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>;

  // Detail View
  if (selectedApp) {
    return (
      <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <button className="btn btn-outline btn-sm" onClick={() => setSelectedApp(null)} style={{ marginBottom: '1rem' }}>← {txt.back}</button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #8B0000)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.5rem' }}>
            {selectedApp.full_name?.charAt(0)}
          </div>
          <div>
            <h2>{selectedApp.full_name}</h2>
            <p style={{ color: 'var(--text-muted)' }}>{selectedApp.email}</p>
          </div>
          <span className={`badge badge-${selectedApp.status === 'approved' ? 'success' : selectedApp.status === 'rejected' ? 'error' : 'warning'}`} style={{ marginLeft: 'auto' }}>
            {txt[selectedApp.status]}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem', background: 'var(--background)', borderRadius: '0.5rem' }}>
            <strong>{txt.qualifications}</strong>
            <p>{selectedApp.qualifications}</p>
          </div>
          <div style={{ padding: '1rem', background: 'var(--background)', borderRadius: '0.5rem' }}>
            <strong>{txt.experience}</strong>
            <p>{selectedApp.experience_years} {txt.years}</p>
          </div>
        </div>

        <div style={{ padding: '1rem', background: 'var(--background)', borderRadius: '0.5rem', marginBottom: '1rem' }}>
          <strong>{txt.motivation}</strong>
          <p style={{ marginTop: '0.5rem' }}>{selectedApp.motivation}</p>
        </div>

        <div style={{ padding: '1rem', background: 'rgba(196,30,58,0.05)', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid var(--primary)' }}>
          <strong>{txt.classes}</strong>
          {selectedApp.selected_classes?.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              {selectedApp.selected_classes.map(id => <span key={id} className="badge badge-primary">Class {id}</span>)}
            </div>
          ) : <p style={{ color: 'var(--text-muted)' }}>-</p>}
          {selectedApp.proposed_new_class && (
            <div style={{ marginTop: '1rem' }}>
              <strong>{txt.proposed}:</strong>
              <p>{selectedApp.proposed_new_class} ({selectedApp.proposed_class_level})</p>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div><strong>{txt.availability}:</strong> {selectedApp.availability}</div>
          <div><strong>{txt.languages}:</strong> {selectedApp.languages_spoken?.join(', ')}</div>
          {selectedApp.teaching_style && <div><strong>{txt.teaching_style}:</strong> {selectedApp.teaching_style}</div>}
          {selectedApp.certifications && <div><strong>{txt.certifications}:</strong> {selectedApp.certifications}</div>}
        </div>

        {selectedApp.status === 'pending' && (
          <>
            <div className="form-group">
              <label className="form-label">{txt.review_notes}</label>
              <textarea className="form-textarea" rows={2} value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder={txt.review_notes_placeholder} />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-outline" style={{ flex: 1, color: 'var(--error)' }} onClick={() => handleReject(selectedApp)}>
                ✗ {txt.reject}
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleApprove(selectedApp)}>
                ✓ {txt.approve}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // List View
  return (
    <div>
      <div className="content-header">
        <h1>📋 {txt.title}</h1>
        <p style={{ color: 'var(--text-muted)' }}>{txt.subtitle}</p>
      </div>

      <div className="tabs" style={{ marginBottom: '1rem' }}>
        <button className={`tab ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>⏳ {txt.pending}</button>
        <button className={`tab ${filter === 'approved' ? 'active' : ''}`} onClick={() => setFilter('approved')}>✅ {txt.approved}</button>
        <button className={`tab ${filter === 'rejected' ? 'active' : ''}`} onClick={() => setFilter('rejected')}>❌ {txt.rejected}</button>
        <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>📋 {txt.all}</button>
      </div>

      {applications.length > 0 ? (
        <div className="card">
          {applications.map(app => (
            <div key={app.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  {app.full_name?.charAt(0)}
                </div>
                <div>
                  <strong>{app.full_name}</strong>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {app.experience_years} {txt.years} · {txt.submitted}: {new Date(app.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className={`badge badge-${app.status === 'approved' ? 'success' : app.status === 'rejected' ? 'error' : 'warning'}`}>
                  {txt[app.status]}
                </span>
                <button className="btn btn-outline btn-sm" onClick={() => { setSelectedApp(app); setReviewNotes(''); }}>
                  {txt.view_details}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <span style={{ fontSize: '4rem' }}>📋</span>
            <p>{txt.no_applications}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default { TeacherApplicationPage, TeacherApplicationReview };
