import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const UserGuidePage = () => {
  const { language, languages, setLanguage } = useLanguage();
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('getting-started');
  const [expandedFaq, setExpandedFaq] = useState(null);

  const guides = {
    zh: {
      title: '用户指南',
      subtitle: '完整的系统使用说明',
      sections: {
        'getting-started': {
          title: '🚀 快速入门',
          content: [
            {
              title: '首次登录',
              steps: [
                '打开系统首页',
                '选择您偏好的界面语言（中文/英文/意大利文）',
                '输入用户名和密码',
                '点击"登录"按钮',
                '系统将根据您的角色自动跳转到相应页面'
              ]
            },
            {
              title: '指纹/生物识别登录（可选）',
              steps: [
                '首次使用密码登录后',
                '点击"启用生物识别"按钮',
                '按照设备提示完成指纹或面容设置',
                '下次登录时可直接使用指纹/面容'
              ]
            },
            {
              title: '忘记密码',
              steps: [
                '点击登录页面的"忘记密码"链接',
                '选择验证方式：邮箱验证或老师验证',
                '邮箱验证：输入注册邮箱，接收验证码',
                '老师验证：选择您的老师，等待老师发送授权码',
                '输入验证码，设置新密码'
              ]
            }
          ]
        },
        'teacher': {
          title: '👨‍🏫 教师功能',
          content: [
            {
              title: '作业管理',
              steps: [
                '进入"作业管理"页面',
                '点击"布置作业"按钮',
                '选择布置方式：班级或个人',
                '填写作业标题（支持三语）、说明、截止日期',
                '选择是否允许语音/文件提交',
                '点击"布置作业"完成'
              ]
            },
            {
              title: '批改作业',
              steps: [
                '在作业列表中找到要批改的作业',
                '点击"查看提交"按钮',
                '查看学生的文字、语音或文件答案',
                '输入分数和反馈（支持三语）',
                '点击"提交评价"完成批改'
              ]
            },
            {
              title: '上传教学资料',
              steps: [
                '进入"教学资料"页面',
                '点击"上传资料"按钮',
                '填写资料标题和描述',
                '选择分享对象：班级、特定学生或公开',
                '选择文件并上传',
                '点击"上传"完成'
              ]
            },
            {
              title: '考勤管理',
              steps: [
                '进入"考勤管理"页面',
                '选择班级',
                '点击"生成二维码"',
                '将二维码展示给学生扫描',
                '二维码有效期30分钟'
              ]
            },
            {
              title: '师生家长沟通',
              steps: [
                '进入"师生沟通"页面',
                '选择发送对象：班级、学生、家长或学生和家长',
                '填写消息主题和内容',
                '可选择同时发送邮件',
                '点击"发送"完成'
              ]
            },
            {
              title: '学生密码重置审批',
              steps: [
                '当学生请求通过老师重置密码时',
                '在"密码重置请求"中查看待处理请求',
                '点击"批准"生成授权码',
                '将授权码告知学生'
              ]
            }
          ]
        },
        'student': {
          title: '👨‍🎓 学生功能',
          content: [
            {
              title: '学习小助手',
              steps: [
                '进入"学习中心"页面',
                '点击"学习小助手"标签',
                '在输入框中输入问题',
                '可以询问中文学习、语法、词汇等问题',
                '智能助手会即时回复'
              ]
            },
            {
              title: '提交作业',
              steps: [
                '在"我的作业"中找到待完成作业',
                '点击"提交"按钮',
                '可以输入文字答案',
                '可以点击🎤录制语音答案',
                '可以上传文件',
                '点击"提交作业"完成'
              ]
            },
            {
              title: '下载学习资料',
              steps: [
                '进入"学习资料"标签',
                '浏览老师分享的资料',
                '点击"下载"按钮获取资料'
              ]
            },
            {
              title: '查看学习报告',
              steps: [
                '进入"学习报告"标签',
                '点击"生成学习报告"按钮',
                '查看出勤率、作业完成率、平均分等数据',
                '查看智能分析和建议'
              ]
            },
            {
              title: '更新个人信息',
              steps: [
                '点击右上角"个人资料"按钮',
                '更新姓名、邮箱、电话等信息',
                '老师可以通过这些信息联系您',
                '点击"保存"完成'
              ]
            },
            {
              title: 'HSK练习',
              steps: [
                '进入"HSK中心"页面',
                '选择您的HSK等级（1-6）',
                '点击"开始练习"',
                '完成题目后查看正确答案和解析',
                '在"我的进度"中查看学习统计'
              ]
            }
          ]
        },
        'parent': {
          title: '👨‍👩‍👧 家长功能',
          content: [
            {
              title: '查看孩子学习概览',
              steps: [
                '登录后自动进入家长中心',
                '如有多个孩子，在顶部选择要查看的孩子',
                '在"概览"标签查看出勤率、作业完成率、平均分等'
              ]
            },
            {
              title: '查看作业情况',
              steps: [
                '点击"作业"标签',
                '查看所有作业的状态（待完成/已提交/已批改）',
                '查看老师的分数和反馈'
              ]
            },
            {
              title: '查看出勤记录',
              steps: [
                '点击"出勤"标签',
                '查看孩子的上课出勤情况',
                '了解是否有缺勤或迟到'
              ]
            },
            {
              title: '联系老师',
              steps: [
                '在"班级信息"中找到老师信息',
                '点击"联系老师"按钮',
                '填写消息内容并发送',
                '在"消息"标签查看老师回复'
              ]
            },
            {
              title: '生成学习报告',
              steps: [
                '点击孩子信息旁的"生成报告"按钮',
                '系统会生成包含智能分析的详细报告'
              ]
            }
          ]
        },
        'culture': {
          title: '📖 文化学习',
          content: [
            {
              title: '成语学习',
              steps: [
                '进入"文化学习"页面',
                '在"成语学习"标签浏览成语列表',
                '点击成语卡片查看详情',
                '学习拼音、字面意思、含义、故事和例句'
              ]
            },
            {
              title: '成语测验',
              steps: [
                '点击"成语测验"标签',
                '点击"开始测验"',
                '根据含义写出对应的成语',
                '检查答案并继续下一题'
              ]
            },
            {
              title: '文化视频',
              steps: [
                '点击"文化视频"标签',
                '浏览各类文化视频',
                '点击"观看"按钮播放视频'
              ]
            },
            {
              title: '文化知识',
              steps: [
                '点击"文化知识"标签',
                '浏览十二生肖、四大发明等知识卡片',
                '点击"了解更多"深入学习'
              ]
            }
          ]
        },
        'ai-agent': {
          title: '🤖 智能助手',
          content: [
            {
              title: '选择智能模型',
              steps: [
                '进入"智能助手"页面',
                '在"模型设置"标签选择智能模型',
                '可选：GPT-4、GPT-3.5、Claude 3、Gemini、通义千问、文心一言',
                '不同模型有不同特点，可根据需求选择'
              ]
            },
            {
              title: '选择对话模式',
              steps: [
                '在左侧选择对话模式',
                '通用助手：一般问答',
                '教学指导：教学方法建议',
                '学习辅导：学习计划和建议',
                '发音纠正：发音练习帮助',
                '写作帮助：文章修改和建议',
                '文化知识：中国文化相关问题'
              ]
            },
            {
              title: '分享经验',
              steps: [
                '点击"经验分享"标签',
                '点击"分享经验"按钮',
                '填写标题、分类和内容',
                '点击"发布"与他人分享'
              ]
            }
          ]
        },
        'security': {
          title: '🔐 账户安全',
          content: [
            {
              title: '修改密码',
              steps: [
                '进入"个人资料"页面',
                '点击"修改密码"',
                '输入当前密码',
                '输入新密码（至少6位）',
                '确认新密码',
                '点击"修改密码"完成'
              ]
            },
            {
              title: '忘记密码 - 邮箱验证',
              steps: [
                '在登录页点击"忘记密码"',
                '选择"通过邮箱验证"',
                '输入用户名和注册邮箱',
                '点击"发送验证码"',
                '在邮箱中查收验证码',
                '输入验证码，设置新密码'
              ]
            },
            {
              title: '忘记密码 - 老师验证',
              steps: [
                '在登录页点击"忘记密码"',
                '选择"通过老师验证"',
                '输入用户名，选择您的老师',
                '点击"请求授权码"',
                '联系老师获取授权码',
                '输入授权码，设置新密码'
              ]
            },
            {
              title: '启用指纹/面容登录',
              steps: [
                '在登录页输入用户名和密码',
                '点击"启用生物识别"按钮',
                '按照设备提示完成设置',
                '下次可直接使用指纹/面容登录'
              ]
            }
          ]
        }
      },
      faq: [
        { q: '如何切换界面语言？', a: '在侧边栏底部或登录页顶部点击语言按钮（🇨🇳/🇬🇧/🇮🇹）即可切换。' },
        { q: '忘记密码怎么办？', a: '点击登录页的"忘记密码"，可以通过邮箱验证或联系老师重置密码。' },
        { q: '作业可以用语音提交吗？', a: '是的，如果老师允许，您可以点击🎤按钮录制语音答案。' },
        { q: '如何联系老师？', a: '在"消息"页面撰写消息，或在班级信息中直接点击"联系老师"。' },
        { q: 'HSK练习数据会保存吗？', a: '是的，所有练习记录都会自动保存并统计在进度中。' },
        { q: '家长如何查看孩子的学习情况？', a: '家长登录后会自动进入家长中心，可以查看所有关联孩子的学习数据。' },
        { q: '可以使用指纹登录吗？', a: '可以，在支持的设备上，您可以启用指纹或面容识别登录。' },
        { q: '如何更新联系方式？', a: '在"个人资料"页面可以更新邮箱和电话，便于老师联系您。' }
      ]
    },
    en: {
      title: 'User Guide',
      subtitle: 'Complete system usage instructions',
      sections: {
        'getting-started': {
          title: '🚀 Getting Started',
          content: [
            {
              title: 'First Login',
              steps: [
                'Open the system homepage',
                'Select your preferred language (Chinese/English/Italian)',
                'Enter your username and password',
                'Click the "Login" button',
                'System will automatically redirect based on your role'
              ]
            },
            {
              title: 'Fingerprint/Biometric Login (Optional)',
              steps: [
                'After first login with password',
                'Click "Enable Biometric" button',
                'Follow device prompts to set up fingerprint or Face ID',
                'Next time you can login directly with biometrics'
              ]
            },
            {
              title: 'Forgot Password',
              steps: [
                'Click "Forgot Password" link on login page',
                'Choose verification method: Email or Teacher',
                'Email: Enter registered email, receive verification code',
                'Teacher: Select your teacher, wait for authorization code',
                'Enter code, set new password'
              ]
            }
          ]
        },
        'teacher': {
          title: '👨‍🏫 Teacher Features',
          content: [
            {
              title: 'Homework Management',
              steps: [
                'Go to "Homework Management" page',
                'Click "Assign Homework" button',
                'Choose assignment type: Class or Individual',
                'Fill in title (3 languages), instructions, due date',
                'Select if voice/file submission is allowed',
                'Click "Assign" to complete'
              ]
            },
            {
              title: 'Grade Homework',
              steps: [
                'Find the homework to grade in the list',
                'Click "View Submissions"',
                'Review student\'s text, voice, or file answers',
                'Enter score and feedback (3 languages)',
                'Click "Submit Review" to complete'
              ]
            },
            {
              title: 'Upload Teaching Materials',
              steps: [
                'Go to "Teaching Materials" page',
                'Click "Upload Material" button',
                'Fill in title and description',
                'Select sharing target: Class, specific students, or public',
                'Select file and upload',
                'Click "Upload" to complete'
              ]
            },
            {
              title: 'Attendance Management',
              steps: [
                'Go to "Attendance" page',
                'Select class',
                'Click "Generate QR Code"',
                'Display QR code for students to scan',
                'QR code valid for 30 minutes'
              ]
            },
            {
              title: 'Communication',
              steps: [
                'Go to "Communication" page',
                'Select recipients: Class, students, parents, or both',
                'Fill in subject and content',
                'Optionally send as email',
                'Click "Send" to complete'
              ]
            },
            {
              title: 'Password Reset Approval',
              steps: [
                'When students request password reset via teacher',
                'View pending requests in "Password Reset Requests"',
                'Click "Approve" to generate authorization code',
                'Share the code with the student'
              ]
            }
          ]
        },
        'student': {
          title: '👨‍🎓 Student Features',
          content: [
            {
              title: 'Learning Helper',
              steps: [
                'Go to "Learning Center" page',
                'Click "Learning Helper" tab',
                'Type your question in the input box',
                'Ask about Chinese learning, grammar, vocabulary, etc.',
                'Intelligent assistant will respond instantly'
              ]
            },
            {
              title: 'Submit Homework',
              steps: [
                'Find pending homework in "My Homework"',
                'Click "Submit" button',
                'Enter text answer',
                'Click 🎤 to record voice answer',
                'Upload files if needed',
                'Click "Submit Homework" to complete'
              ]
            },
            {
              title: 'Download Learning Materials',
              steps: [
                'Go to "Learning Materials" tab',
                'Browse materials shared by teachers',
                'Click "Download" to get materials'
              ]
            },
            {
              title: 'View Learning Reports',
              steps: [
                'Go to "Learning Reports" tab',
                'Click "Generate Report" button',
                'View attendance rate, homework completion, average scores',
                'Review Intelligent analysis and suggestions'
              ]
            },
            {
              title: 'Update Profile',
              steps: [
                'Click "Profile" button',
                'Update name, email, phone',
                'Teachers can contact you through this information',
                'Click "Save" to complete'
              ]
            },
            {
              title: 'HSK Practice',
              steps: [
                'Go to "HSK Center" page',
                'Select your HSK level (1-6)',
                'Click "Start Practice"',
                'Answer questions and view explanations',
                'Check your progress in "My Progress"'
              ]
            }
          ]
        },
        'parent': {
          title: '👨‍👩‍👧 Parent Features',
          content: [
            {
              title: 'View Child Overview',
              steps: [
                'After login, you\'ll enter Parent Center',
                'If you have multiple children, select at the top',
                'View attendance, homework completion, scores in "Overview"'
              ]
            },
            {
              title: 'View Homework Status',
              steps: [
                'Click "Homework" tab',
                'View all homework status (Pending/Submitted/Graded)',
                'See teacher\'s scores and feedback'
              ]
            },
            {
              title: 'View Attendance',
              steps: [
                'Click "Attendance" tab',
                'View child\'s class attendance',
                'Check for absences or tardiness'
              ]
            },
            {
              title: 'Contact Teacher',
              steps: [
                'Find teacher info in "Class Info"',
                'Click "Contact Teacher" button',
                'Write and send message',
                'Check teacher replies in "Messages" tab'
              ]
            },
            {
              title: 'Generate Report',
              steps: [
                'Click "Generate Report" button next to child info',
                'System will generate detailed report with Intelligent analysis'
              ]
            }
          ]
        },
        'culture': {
          title: '📖 Culture Learning',
          content: [
            {
              title: 'Chengyu Learning',
              steps: [
                'Go to "Culture Learning" page',
                'Browse chengyu list in "Chengyu" tab',
                'Click card to view details',
                'Learn pinyin, literal meaning, story, and examples'
              ]
            },
            {
              title: 'Chengyu Quiz',
              steps: [
                'Click "Quiz" tab',
                'Click "Start Quiz"',
                'Write the chengyu based on the meaning',
                'Check answer and continue'
              ]
            },
            {
              title: 'Cultural Videos',
              steps: [
                'Click "Videos" tab',
                'Browse cultural videos',
                'Click "Watch" to play'
              ]
            },
            {
              title: 'Cultural Knowledge',
              steps: [
                'Click "Knowledge" tab',
                'Browse topics like Zodiac, Four Inventions',
                'Click "Learn More" for details'
              ]
            }
          ]
        },
        'ai-agent': {
          title: '🤖 Intelligent Agent',
          content: [
            {
              title: 'Select Intelligent Model',
              steps: [
                'Go to "Intelligent Agent" page',
                'Select intelligent model in "Model Settings" tab',
                'Options: GPT-4, GPT-3.5, Claude 3, Gemini, Qwen, ERNIE',
                'Different models have different strengths'
              ]
            },
            {
              title: 'Select Conversation Mode',
              steps: [
                'Choose mode on the left sidebar',
                'General Assistant: General Q&A',
                'Teaching Guide: Teaching methods',
                'Learning Tutor: Study plans',
                'Pronunciation Coach: Pronunciation help',
                'Writing Help: Essay assistance',
                'Cultural Knowledge: Culture questions'
              ]
            },
            {
              title: 'Share Experience',
              steps: [
                'Click "Shared Experiences" tab',
                'Click "Share Experience" button',
                'Fill in title, category, content',
                'Click "Submit" to share'
              ]
            }
          ]
        },
        'security': {
          title: '🔐 Account Security',
          content: [
            {
              title: 'Change Password',
              steps: [
                'Go to "Profile" page',
                'Click "Change Password"',
                'Enter current password',
                'Enter new password (min 6 characters)',
                'Confirm new password',
                'Click "Change Password" to complete'
              ]
            },
            {
              title: 'Forgot Password - Email',
              steps: [
                'Click "Forgot Password" on login page',
                'Choose "Verify via Email"',
                'Enter username and registered email',
                'Click "Send Code"',
                'Check email for verification code',
                'Enter code, set new password'
              ]
            },
            {
              title: 'Forgot Password - Teacher',
              steps: [
                'Click "Forgot Password" on login page',
                'Choose "Verify via Teacher"',
                'Enter username, select your teacher',
                'Click "Request Code"',
                'Contact teacher for authorization code',
                'Enter code, set new password'
              ]
            },
            {
              title: 'Enable Biometric Login',
              steps: [
                'Enter username and password on login page',
                'Click "Enable Biometric" button',
                'Follow device prompts',
                'Next time use fingerprint/Face ID to login'
              ]
            }
          ]
        }
      },
      faq: [
        { q: 'How do I change the interface language?', a: 'Click language buttons (🇨🇳/🇬🇧/🇮🇹) at the bottom of sidebar or top of login page.' },
        { q: 'What if I forgot my password?', a: 'Click "Forgot Password" on login page to reset via email or teacher verification.' },
        { q: 'Can I submit homework with voice?', a: 'Yes, if allowed by teacher, click the 🎤 button to record voice answers.' },
        { q: 'How do I contact my teacher?', a: 'Use the "Messages" page or click "Contact Teacher" in class info.' },
        { q: 'Is HSK practice data saved?', a: 'Yes, all practice records are automatically saved and tracked in progress.' },
        { q: 'How can parents view their child\'s progress?', a: 'Parents automatically enter Parent Center after login to view all linked children\'s data.' },
        { q: 'Can I use fingerprint to login?', a: 'Yes, on supported devices you can enable fingerprint or Face ID login.' },
        { q: 'How do I update my contact info?', a: 'Update email and phone in "Profile" page for teacher communication.' }
      ]
    },
    it: {
      title: 'Guida Utente',
      subtitle: 'Istruzioni complete per l\'uso del sistema',
      sections: {
        'getting-started': {
          title: '🚀 Primi Passi',
          content: [
            {
              title: 'Primo Accesso',
              steps: [
                'Apri la homepage del sistema',
                'Seleziona la lingua preferita (Cinese/Inglese/Italiano)',
                'Inserisci nome utente e password',
                'Clicca il pulsante "Accedi"',
                'Il sistema ti reindirizzerà automaticamente in base al tuo ruolo'
              ]
            },
            {
              title: 'Login Biometrico (Opzionale)',
              steps: [
                'Dopo il primo login con password',
                'Clicca "Abilita Biometrico"',
                'Segui le istruzioni del dispositivo',
                'Al prossimo accesso potrai usare impronta/Face ID'
              ]
            },
            {
              title: 'Password Dimenticata',
              steps: [
                'Clicca "Password Dimenticata" nella pagina di login',
                'Scegli il metodo: Email o Insegnante',
                'Email: Inserisci email registrata, ricevi codice',
                'Insegnante: Seleziona insegnante, attendi codice',
                'Inserisci codice, imposta nuova password'
              ]
            }
          ]
        },
        'teacher': {
          title: '👨‍🏫 Funzionalità Insegnante',
          content: [
            {
              title: 'Gestione Compiti',
              steps: [
                'Vai a "Gestione Compiti"',
                'Clicca "Assegna Compito"',
                'Scegli tipo: Classe o Individuale',
                'Compila titolo (3 lingue), istruzioni, scadenza',
                'Seleziona se permettere audio/file',
                'Clicca "Assegna" per completare'
              ]
            },
            {
              title: 'Correggi Compiti',
              steps: [
                'Trova il compito nella lista',
                'Clicca "Vedi Consegne"',
                'Rivedi risposta testo/audio/file',
                'Inserisci voto e feedback (3 lingue)',
                'Clicca "Invia Valutazione"'
              ]
            },
            {
              title: 'Carica Materiali',
              steps: [
                'Vai a "Materiali Didattici"',
                'Clicca "Carica Materiale"',
                'Compila titolo e descrizione',
                'Seleziona destinatari',
                'Carica file',
                'Clicca "Carica"'
              ]
            },
            {
              title: 'Gestione Presenze',
              steps: [
                'Vai a "Presenze"',
                'Seleziona classe',
                'Clicca "Genera QR Code"',
                'Mostra QR agli studenti',
                'Valido per 30 minuti'
              ]
            },
            {
              title: 'Comunicazione',
              steps: [
                'Vai a "Comunicazione"',
                'Seleziona destinatari',
                'Compila oggetto e contenuto',
                'Opzione invio email',
                'Clicca "Invia"'
              ]
            },
            {
              title: 'Approvazione Reset Password',
              steps: [
                'Quando studenti richiedono reset via insegnante',
                'Vedi richieste in sospeso',
                'Clicca "Approva" per generare codice',
                'Condividi codice con studente'
              ]
            }
          ]
        },
        'student': {
          title: '👨‍🎓 Funzionalità Studente',
          content: [
            {
              title: 'Assistente allo Studio',
              steps: [
                'Vai a "Centro Apprendimento"',
                'Clicca tab "Assistente"',
                'Scrivi domanda nel campo',
                'Chiedi su cinese, grammatica, vocabolario',
                'L\'AI risponderà subito'
              ]
            },
            {
              title: 'Consegna Compiti',
              steps: [
                'Trova compiti in sospeso',
                'Clicca "Consegna"',
                'Inserisci risposta testo',
                'Clicca 🎤 per registrare audio',
                'Carica file se necessario',
                'Clicca "Consegna Compito"'
              ]
            },
            {
              title: 'Scarica Materiali',
              steps: [
                'Vai a "Materiali di Studio"',
                'Sfoglia materiali condivisi',
                'Clicca "Scarica"'
              ]
            },
            {
              title: 'Report di Apprendimento',
              steps: [
                'Vai a "Report"',
                'Clicca "Genera Report"',
                'Vedi presenze, compiti, voti',
                'Leggi analisi intelligente'
              ]
            },
            {
              title: 'Aggiorna Profilo',
              steps: [
                'Clicca "Profilo"',
                'Aggiorna nome, email, telefono',
                'Insegnanti possono contattarti',
                'Clicca "Salva"'
              ]
            },
            {
              title: 'Pratica HSK',
              steps: [
                'Vai a "Centro HSK"',
                'Seleziona livello (1-6)',
                'Clicca "Inizia Pratica"',
                'Rispondi e vedi spiegazioni',
                'Controlla progressi'
              ]
            }
          ]
        },
        'parent': {
          title: '👨‍👩‍👧 Funzionalità Genitore',
          content: [
            {
              title: 'Panoramica Figlio',
              steps: [
                'Dopo login entri nel Centro Genitori',
                'Se hai più figli, seleziona in alto',
                'Vedi presenze, compiti, voti in "Panoramica"'
              ]
            },
            {
              title: 'Stato Compiti',
              steps: [
                'Clicca tab "Compiti"',
                'Vedi stato (In sospeso/Consegnato/Valutato)',
                'Vedi voti e feedback'
              ]
            },
            {
              title: 'Presenze',
              steps: [
                'Clicca tab "Presenze"',
                'Vedi presenze alle lezioni',
                'Controlla assenze o ritardi'
              ]
            },
            {
              title: 'Contatta Insegnante',
              steps: [
                'Trova info insegnante in "Info Classe"',
                'Clicca "Contatta Insegnante"',
                'Scrivi e invia messaggio',
                'Vedi risposte in "Messaggi"'
              ]
            },
            {
              title: 'Genera Report',
              steps: [
                'Clicca "Genera Report" accanto info figlio',
                'Sistema genera report con analisi intelligente'
              ]
            }
          ]
        },
        'culture': {
          title: '📖 Apprendimento Culturale',
          content: [
            {
              title: 'Chengyu',
              steps: [
                'Vai a "Apprendimento Culturale"',
                'Sfoglia lista chengyu',
                'Clicca carta per dettagli',
                'Impara pinyin, significato, storia, esempi'
              ]
            },
            {
              title: 'Quiz Chengyu',
              steps: [
                'Clicca tab "Quiz"',
                'Clicca "Inizia Quiz"',
                'Scrivi chengyu dal significato',
                'Verifica e continua'
              ]
            },
            {
              title: 'Video Culturali',
              steps: [
                'Clicca tab "Video"',
                'Sfoglia video culturali',
                'Clicca "Guarda" per riprodurre'
              ]
            },
            {
              title: 'Conoscenze Culturali',
              steps: [
                'Clicca tab "Conoscenze"',
                'Sfoglia argomenti',
                'Clicca "Scopri di più"'
              ]
            }
          ]
        },
        'ai-agent': {
          title: '🤖 Agente Intelligente',
          content: [
            {
              title: 'Seleziona Modello Intelligente',
              steps: [
                'Vai a "Agente Intelligente"',
                'Seleziona modello in "Impostazioni"',
                'Opzioni: GPT-4, GPT-3.5, Claude 3, Gemini, Qwen, ERNIE',
                'Modelli diversi hanno punti di forza diversi'
              ]
            },
            {
              title: 'Modalità Conversazione',
              steps: [
                'Scegli modalità nella barra laterale',
                'Assistente Generale: Q&A generali',
                'Guida Didattica: Metodi insegnamento',
                'Tutor Studio: Piani di studio',
                'Coach Pronuncia: Aiuto pronuncia',
                'Aiuto Scrittura: Assistenza testi',
                'Conoscenza Culturale: Domande cultura'
              ]
            },
            {
              title: 'Condividi Esperienza',
              steps: [
                'Clicca tab "Esperienze"',
                'Clicca "Condividi Esperienza"',
                'Compila titolo, categoria, contenuto',
                'Clicca "Pubblica"'
              ]
            }
          ]
        },
        'security': {
          title: '🔐 Sicurezza Account',
          content: [
            {
              title: 'Cambia Password',
              steps: [
                'Vai a "Profilo"',
                'Clicca "Cambia Password"',
                'Inserisci password attuale',
                'Inserisci nuova password (min 6 caratteri)',
                'Conferma nuova password',
                'Clicca "Cambia Password"'
              ]
            },
            {
              title: 'Password Dimenticata - Email',
              steps: [
                'Clicca "Password Dimenticata"',
                'Scegli "Verifica via Email"',
                'Inserisci nome utente ed email',
                'Clicca "Invia Codice"',
                'Controlla email per codice',
                'Inserisci codice, imposta password'
              ]
            },
            {
              title: 'Password Dimenticata - Insegnante',
              steps: [
                'Clicca "Password Dimenticata"',
                'Scegli "Verifica via Insegnante"',
                'Inserisci nome utente, seleziona insegnante',
                'Clicca "Richiedi Codice"',
                'Contatta insegnante per codice',
                'Inserisci codice, imposta password'
              ]
            },
            {
              title: 'Abilita Login Biometrico',
              steps: [
                'Inserisci credenziali nella pagina login',
                'Clicca "Abilita Biometrico"',
                'Segui istruzioni dispositivo',
                'Prossimo login usa impronta/Face ID'
              ]
            }
          ]
        }
      },
      faq: [
        { q: 'Come cambio la lingua dell\'interfaccia?', a: 'Clicca i pulsanti lingua (🇨🇳/🇬🇧/🇮🇹) in fondo alla barra laterale o in alto nella pagina login.' },
        { q: 'Ho dimenticato la password, cosa faccio?', a: 'Clicca "Password Dimenticata" per reimpostare via email o verifica insegnante.' },
        { q: 'Posso consegnare compiti con audio?', a: 'Sì, se permesso dall\'insegnante, clicca 🎤 per registrare.' },
        { q: 'Come contatto il mio insegnante?', a: 'Usa "Messaggi" o clicca "Contatta Insegnante" nelle info classe.' },
        { q: 'I dati pratica HSK vengono salvati?', a: 'Sì, tutti i record sono salvati automaticamente.' },
        { q: 'Come possono i genitori vedere i progressi?', a: 'I genitori entrano automaticamente nel Centro Genitori dopo il login.' },
        { q: 'Posso usare l\'impronta per accedere?', a: 'Sì, sui dispositivi supportati puoi abilitare impronta o Face ID.' },
        { q: 'Come aggiorno i miei contatti?', a: 'Aggiorna email e telefono in "Profilo" per la comunicazione con gli insegnanti.' }
      ]
    }
  };

  const guide = guides[language] || guides.en;
  const sections = Object.keys(guide.sections);

  return (
    <div>
      <div className="content-header">
        <h1>📖 {guide.title}</h1>
        <p style={{ color: 'var(--text-muted)' }}>{guide.subtitle}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '1.5rem' }}>
        {/* Sidebar Navigation */}
        <div className="card" style={{ height: 'fit-content', position: 'sticky', top: '1rem' }}>
          <h4 style={{ marginBottom: '1rem' }}>{language === 'zh' ? '目录' : language === 'it' ? 'Indice' : 'Contents'}</h4>
          {sections.map(key => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '0.75rem',
                marginBottom: '0.25rem',
                border: 'none',
                borderRadius: '0.5rem',
                background: activeSection === key ? 'rgba(196,30,58,0.1)' : 'transparent',
                color: activeSection === key ? 'var(--primary)' : 'inherit',
                fontWeight: activeSection === key ? '600' : 'normal',
                cursor: 'pointer'
              }}
            >
              {guide.sections[key].title}
            </button>
          ))}
          <hr style={{ margin: '1rem 0' }} />
          <button
            onClick={() => setActiveSection('faq')}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '0.75rem',
              border: 'none',
              borderRadius: '0.5rem',
              background: activeSection === 'faq' ? 'rgba(196,30,58,0.1)' : 'transparent',
              color: activeSection === 'faq' ? 'var(--primary)' : 'inherit',
              fontWeight: activeSection === 'faq' ? '600' : 'normal',
              cursor: 'pointer'
            }}
          >
            ❓ FAQ
          </button>
        </div>

        {/* Content */}
        <div>
          {activeSection !== 'faq' && guide.sections[activeSection] && (
            <div className="card">
              <h2>{guide.sections[activeSection].title}</h2>
              {guide.sections[activeSection].content.map((item, idx) => (
                <div key={idx} style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--background)', borderRadius: '0.5rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>{item.title}</h3>
                  <ol style={{ paddingLeft: '1.5rem' }}>
                    {item.steps.map((step, i) => (
                      <li key={i} style={{ marginBottom: '0.5rem', lineHeight: '1.6' }}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'faq' && (
            <div className="card">
              <h2>❓ {language === 'zh' ? '常见问题' : language === 'it' ? 'Domande Frequenti' : 'Frequently Asked Questions'}</h2>
              {guide.faq.map((item, idx) => (
                <div key={idx} style={{ marginTop: '1rem', border: '1px solid var(--border)', borderRadius: '0.5rem' }}>
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%',
                      padding: '1rem',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontWeight: '500'
                    }}
                  >
                    <span>{item.q}</span>
                    <span style={{ fontSize: '1.25rem' }}>{expandedFaq === idx ? '−' : '+'}</span>
                  </button>
                  {expandedFaq === idx && (
                    <div style={{ padding: '0 1rem 1rem', color: 'var(--text-muted)' }}>
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserGuidePage;
