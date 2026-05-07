import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext(null);

// Complete translations for all UI elements
const translations = {
  en: {
    app_name: "David Learns Chinese",
    welcome: "Welcome",
    login: "Login",
    logout: "Logout",
    register: "Register",
    username: "Username",
    password: "Password",
    email: "Email",
    name: "Name",
    phone: "Phone",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    create: "Create",
    search: "Search",
    submit: "Submit",
    back: "Back",
    loading: "Loading...",
    success: "Success",
    error: "Error",
    confirm: "Confirm",
    select_language: "Select Language",
    interface_language: "Interface Language",
    content_language: "Content Language",
    language_tip: "Tip: Beginners can use Italian/English interface with Chinese content",
    language_settings: "Language Settings",
    roles: { super_admin: "Super Administrator", admin: "Administrator", teacher: "Teacher", student: "Student", parent: "Parent" },
    nav: { dashboard: "Dashboard", classes: "Classes", homework: "Homework", attendance: "Attendance", hsk: "HSK Center", reports: "Reports", messages: "Messages", events: "Events", ai_assistant: "Intelligent Assistant", admin: "Admin", profile: "Profile", settings: "Settings", help: "Help" },
    dashboard: { welcome_message: "Welcome back", total_classes: "Total Classes", pending_homework: "Pending Homework", attendance_rate: "Attendance Rate", upcoming_events: "Upcoming Events", recent_activity: "Recent Activity", quick_actions: "Quick Actions" },
    classes: { title: "My Classes", create_class: "Create Class", class_name: "Class Name", description: "Description", schedule: "Schedule", level: "Level", teacher: "Teacher", students: "Students", add_student: "Add Student", no_classes: "No classes found" },
    homework: { title: "Homework", create_homework: "Create Homework", due_date: "Due Date", submit: "Submit", submitted: "Submitted", pending: "Pending", graded: "Graded", score: "Score", feedback: "Feedback", upload_file: "Upload File", voice_input: "Voice Input", download: "Download", start_recording: "Start Recording", stop_recording: "Stop Recording" },
    hsk: { title: "HSK Center", register: "Register for HSK", practice: "Practice Test", self_test: "Self Assessment", level: "HSK Level", exam_date: "Exam Date", start_practice: "Start Practice", view_progress: "View Progress" },
    attendance: { title: "Attendance", check_in: "Check In", scan_qr: "Scan QR Code", generate_qr: "Generate QR Code", present: "Present", absent: "Absent", late: "Late", rate: "Attendance Rate" },
    reports: { title: "Reports", generate: "Generate Report", student_progress: "Student Progress", class_summary: "Class Summary", download: "Download Report" },
    ai: { title: "Intelligent Assistant", chat: "Chat", generate_ppt: "Generate PPT", generate_quiz: "Generate Quiz", games: "Learning Games", knowledge: "Knowledge Hub" },
    messages: { title: "Messages", compose: "Compose", inbox: "Inbox", sent: "Sent", send: "Send" },
    events: { title: "Events & Notices", create: "Create Event", upcoming: "Upcoming", past: "Past" },
    admin: { title: "Admin Panel", users: "User Management", tasks: "Task Management", statistics: "Statistics" },
    help: { title: "Help & Support", user_guide: "User Guide", faq: "FAQ", contact: "Contact Support" }
  },
  zh: {
    app_name: "大卫学中文",
    welcome: "欢迎",
    login: "登录",
    logout: "退出",
    register: "注册",
    username: "用户名",
    password: "密码",
    email: "电子邮件",
    name: "姓名",
    phone: "电话",
    save: "保存",
    cancel: "取消",
    delete: "删除",
    edit: "编辑",
    create: "创建",
    search: "搜索",
    submit: "提交",
    back: "返回",
    loading: "加载中...",
    success: "成功",
    error: "错误",
    confirm: "确认",
    select_language: "选择语言",
    interface_language: "界面语言",
    content_language: "内容语言",
    language_tip: "提示：初学者可以使用意大利语/英语界面，中文内容",
    language_settings: "语言设置",
    roles: { super_admin: "超级管理员", admin: "管理员", teacher: "教师", student: "学生", parent: "家长" },
    nav: { dashboard: "仪表板", classes: "班级", homework: "作业", attendance: "考勤", hsk: "HSK中心", reports: "报告", messages: "消息", events: "活动", ai_assistant: "智能助手", admin: "管理", profile: "个人资料", settings: "设置", help: "帮助" },
    dashboard: { welcome_message: "欢迎回来", total_classes: "班级总数", pending_homework: "待完成作业", attendance_rate: "出勤率", upcoming_events: "即将到来的活动", recent_activity: "最近活动", quick_actions: "快捷操作" },
    classes: { title: "我的班级", create_class: "创建班级", class_name: "班级名称", description: "描述", schedule: "课程表", level: "级别", teacher: "教师", students: "学生", add_student: "添加学生", no_classes: "没有找到班级" },
    homework: { title: "作业", create_homework: "创建作业", due_date: "截止日期", submit: "提交", submitted: "已提交", pending: "待完成", graded: "已批改", score: "分数", feedback: "反馈", upload_file: "上传文件", voice_input: "语音输入", download: "下载", start_recording: "开始录音", stop_recording: "停止录音" },
    hsk: { title: "HSK中心", register: "报名HSK", practice: "模拟考试", self_test: "自我测试", level: "HSK等级", exam_date: "考试日期", start_practice: "开始练习", view_progress: "查看进度" },
    attendance: { title: "考勤", check_in: "签到", scan_qr: "扫描二维码", generate_qr: "生成二维码", present: "出席", absent: "缺席", late: "迟到", rate: "出勤率" },
    reports: { title: "报告", generate: "生成报告", student_progress: "学生进度", class_summary: "班级总结", download: "下载报告" },
    ai: { title: "智能助手", chat: "对话", generate_ppt: "生成PPT", generate_quiz: "生成测验", games: "学习游戏", knowledge: "知识中心" },
    messages: { title: "消息", compose: "撰写", inbox: "收件箱", sent: "已发送", send: "发送" },
    events: { title: "活动通知", create: "创建活动", upcoming: "即将到来", past: "已过去" },
    admin: { title: "管理面板", users: "用户管理", tasks: "任务管理", statistics: "统计数据" },
    help: { title: "帮助与支持", user_guide: "用户指南", faq: "常见问题", contact: "联系支持" }
  },
  it: {
    app_name: "David Impara il Cinese",
    welcome: "Benvenuto",
    login: "Accedi",
    logout: "Esci",
    register: "Registrati",
    username: "Nome utente",
    password: "Password",
    email: "Email",
    name: "Nome",
    phone: "Telefono",
    save: "Salva",
    cancel: "Annulla",
    delete: "Elimina",
    edit: "Modifica",
    create: "Crea",
    search: "Cerca",
    submit: "Invia",
    back: "Indietro",
    loading: "Caricamento...",
    success: "Successo",
    error: "Errore",
    confirm: "Conferma",
    select_language: "Seleziona Lingua",
    interface_language: "Lingua Interfaccia",
    content_language: "Lingua Contenuto",
    language_tip: "Suggerimento: I principianti possono usare l'interfaccia in Italiano/Inglese con contenuti in Cinese",
    language_settings: "Impostazioni Lingua",
    roles: { super_admin: "Super Amministratore", admin: "Amministratore", teacher: "Insegnante", student: "Studente", parent: "Genitore" },
    nav: { dashboard: "Pannello", classes: "Classi", homework: "Compiti", attendance: "Presenze", hsk: "Centro HSK", reports: "Rapporti", messages: "Messaggi", events: "Eventi", ai_assistant: "Assistente Intelligente", admin: "Admin", profile: "Profilo", settings: "Impostazioni", help: "Aiuto" },
    dashboard: { welcome_message: "Bentornato", total_classes: "Classi Totali", pending_homework: "Compiti in Sospeso", attendance_rate: "Tasso di Presenza", upcoming_events: "Eventi in Arrivo", recent_activity: "Attività Recente", quick_actions: "Azioni Rapide" },
    classes: { title: "Le Mie Classi", create_class: "Crea Classe", class_name: "Nome Classe", description: "Descrizione", schedule: "Orario", level: "Livello", teacher: "Insegnante", students: "Studenti", add_student: "Aggiungi Studente", no_classes: "Nessuna classe trovata" },
    homework: { title: "Compiti", create_homework: "Crea Compito", due_date: "Scadenza", submit: "Consegna", submitted: "Consegnato", pending: "In Sospeso", graded: "Valutato", score: "Voto", feedback: "Feedback", upload_file: "Carica File", voice_input: "Input Vocale", download: "Scarica", start_recording: "Inizia Registrazione", stop_recording: "Ferma Registrazione" },
    hsk: { title: "Centro HSK", register: "Iscriviti HSK", practice: "Test Pratico", self_test: "Auto-Valutazione", level: "Livello HSK", exam_date: "Data Esame", start_practice: "Inizia Pratica", view_progress: "Vedi Progressi" },
    attendance: { title: "Presenze", check_in: "Registra", scan_qr: "Scansiona QR", generate_qr: "Genera QR", present: "Presente", absent: "Assente", late: "In Ritardo", rate: "Tasso Presenza" },
    reports: { title: "Rapporti", generate: "Genera Rapporto", student_progress: "Progresso Studente", class_summary: "Riepilogo Classe", download: "Scarica Rapporto" },
    ai: { title: "Assistente Intelligente", chat: "Chat", generate_ppt: "Genera PPT", generate_quiz: "Genera Quiz", games: "Giochi Educativi", knowledge: "Centro Conoscenze" },
    messages: { title: "Messaggi", compose: "Componi", inbox: "Posta in Arrivo", sent: "Inviati", send: "Invia" },
    events: { title: "Eventi e Avvisi", create: "Crea Evento", upcoming: "In Arrivo", past: "Passati" },
    admin: { title: "Pannello Admin", users: "Gestione Utenti", tasks: "Gestione Attività", statistics: "Statistiche" },
    help: { title: "Aiuto e Supporto", user_guide: "Guida Utente", faq: "Domande Frequenti", contact: "Contatta Supporto" }
  }
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [interfaceLanguage, setInterfaceLanguage] = useState(() => localStorage.getItem('interfaceLanguage') || 'it');
  const [contentLanguage, setContentLanguage] = useState(() => localStorage.getItem('contentLanguage') || 'zh');

  useEffect(() => { localStorage.setItem('interfaceLanguage', interfaceLanguage); document.documentElement.lang = interfaceLanguage; }, [interfaceLanguage]);
  useEffect(() => { localStorage.setItem('contentLanguage', contentLanguage); }, [contentLanguage]);

  const t = (key) => {
    const keys = key.split('.');
    let result = translations[interfaceLanguage];
    for (const k of keys) {
      if (result && result[k] !== undefined) result = result[k];
      else { result = translations['en']; for (const fk of keys) { if (result && result[fk] !== undefined) result = result[fk]; else return key; } break; }
    }
    return result;
  };

  const getContent = (content, lang = contentLanguage) => typeof content === 'string' ? content : (content?.[lang] || content?.zh || content?.en || '');
  
  const languages = [
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' }
  ];

  const languagePresets = {
    beginner_italian: { interface: 'it', content: 'zh', label: { en: 'Italian Beginner', zh: '意大利初学者', it: 'Principiante Italiano' } },
    beginner_english: { interface: 'en', content: 'zh', label: { en: 'English Beginner', zh: '英语初学者', it: 'Principiante Inglese' } },
    immersive: { interface: 'zh', content: 'zh', label: { en: 'Chinese Immersion', zh: '中文沉浸', it: 'Immersione Cinese' } }
  };

  const applyPreset = (name) => { const p = languagePresets[name]; if (p) { setInterfaceLanguage(p.interface); setContentLanguage(p.content); } };

  return (
    <LanguageContext.Provider value={{
      interfaceLanguage, contentLanguage, language: interfaceLanguage,
      setInterfaceLanguage, setContentLanguage, setLanguage: setInterfaceLanguage,
      t, getContent, languages, languagePresets, applyPreset, translations
    }}>
      {children}
    </LanguageContext.Provider>
  );
};
