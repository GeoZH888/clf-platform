import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const TeacherAssistantPage = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  const txt = {
    zh: {
      title: '助手精灵',
      subtitle: '智能问答、备课建议、教学支持',
      placeholder: '请问有什么可以帮您？例如：帮我设计一节HSK3的语法课...',
      send: '发送',
      welcome: '你好！我是您的助手精灵 🧞\n\n我可以帮您：\n• 设计课程教案\n• 解答教学问题\n• 推荐教学方法\n• 分析学生情况\n• 提供文化知识\n\n请问有什么可以帮您？',
      suggestions: '常用问题',
      clear: '清空对话'
    },
    en: {
      title: 'AI Helper',
      subtitle: 'Smart Q&A, lesson planning, teaching support',
      placeholder: 'How can I help? e.g.: Help me design an HSK3 grammar lesson...',
      send: 'Send',
      welcome: 'Hello! I\'m your AI Helper 🧞\n\nI can help you:\n• Design lesson plans\n• Answer teaching questions\n• Recommend teaching methods\n• Analyze student progress\n• Provide cultural knowledge\n\nHow can I help you?',
      suggestions: 'Suggestions',
      clear: 'Clear Chat'
    }
  };
  const t = txt[language] || txt.en;

  const quickQuestions = language === 'zh' ? [
    '帮我设计一节HSK3的语法课',
    '如何教学生区分"了"和"过"？',
    '推荐一些课堂互动游戏',
    '怎么提高学生的口语能力？',
    '介绍一下中国春节的习俗',
    '帮我准备一个成语故事'
  ] : [
    'Help design an HSK3 grammar lesson',
    'How to teach difference between 了 and 过?',
    'Recommend some classroom games',
    'How to improve students\' speaking?',
    'Introduce Chinese New Year customs',
    'Prepare a Chengyu story for class'
  ];

  useEffect(() => {
    if (chatMessages.length === 0) {
      setChatMessages([{ role: 'assistant', content: t.welcome }]);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = async (text = chatInput) => {
    if (!text?.trim()) return;
    
    const userMessage = { role: 'user', content: text };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setLoading(true);

    setTimeout(() => {
      const responses = {
        '设计': `好的，我来帮您设计这节课 📚\n\n**教学目标：**\n1. 掌握本课生词和句型\n2. 能够在实际场景中运用\n3. 了解相关文化背景\n\n**教学步骤：**\n1. 导入（5分钟）- 用图片或视频引入话题\n2. 生词学习（15分钟）- 听读、跟读、造句\n3. 语法讲解（15分钟）- 例句分析、对比练习\n4. 互动练习（10分钟）- 小组对话、角色扮演\n5. 总结复习（5分钟）- 重点回顾、布置作业\n\n需要我详细展开某个环节吗？`,
        '语法': `关于这个语法点，我来详细解释一下 📖\n\n**基本用法：**\n这是一个常见的语法结构，主要用于...\n\n**例句对比：**\n✓ 正确用法：...\n✗ 常见错误：...\n\n**教学建议：**\n1. 先让学生理解基本含义\n2. 通过对比加深理解\n3. 设计情景练习\n4. 布置巩固作业`,
        '游戏': `这里有一些适合课堂的互动游戏 🎮\n\n**1. 词汇配对游戏**\n准备汉字卡和拼音卡，学生快速匹配\n\n**2. 句子接龙**\n每人说一个词组成句子\n\n**3. 角色扮演**\n设定场景，学生用所学句型对话\n\n**4. 汉字猜谜**\n一人比划或描述，其他人猜`,
        '口语': `提高口语能力的几个方法 🗣️\n\n**课堂技巧：**\n1. 多设计对话练习\n2. 使用真实场景模拟\n3. 鼓励学生多开口\n\n**课后建议：**\n1. 布置录音作业\n2. 推荐中文播客/视频`,
        '春节': `关于中国春节 🧧\n\n**主要习俗：**\n• 贴春联、贴"福"字\n• 吃团圆饭、包饺子\n• 发红包、拜年\n• 放鞭炮、看春晚\n\n**教学建议：**\n可以准备图片视频，教相关词汇，让学生分享自己国家的新年习俗。`,
        '成语': `好的，我来为您准备一个成语故事 📜\n\n**画龙点睛**\nhuà lóng diǎn jīng\n\n**故事：**\n画家张僧繇画了四条龙但没画眼睛。人们问为什么，他说画上眼睛龙会飞走。人们不信，他画上眼睛后，龙真的飞走了！\n\n**含义：**\n比喻在关键处加上精辟的话，使内容更加生动。`
      };

      let response = `好的，让我来帮您...\n\n关于这个问题，我建议：\n1. 首先了解学生的现有水平\n2. 设计针对性的教学活动\n3. 多使用互动增加趣味性\n\n需要更具体的建议吗？`;

      for (const [key, value] of Object.entries(responses)) {
        if (text.includes(key)) {
          response = value;
          break;
        }
      }

      setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setLoading(false);
    }, 1500);
  };

  const handleClear = () => {
    setChatMessages([{ role: 'assistant', content: t.welcome }]);
  };

  return (
    <div>
      <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>🧞 {t.title}</h1>
          <p style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleClear}>
          🗑️ {t.clear}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.5rem' }}>
        {/* Chat */}
        <div className="card" style={{ height: '550px', display: 'flex', flexDirection: 'column', padding: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{ 
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '0.75rem 1rem',
                borderRadius: msg.role === 'user' ? '1rem 1rem 0 1rem' : '1rem 1rem 1rem 0',
                background: msg.role === 'user' ? 'var(--primary)' : 'var(--background)',
                color: msg.role === 'user' ? 'white' : 'inherit',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.role === 'assistant' && <span style={{ marginRight: '0.5rem' }}>🧞</span>}
                {msg.content}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', padding: '0.75rem 1rem', background: 'var(--background)', borderRadius: '1rem' }}>
                🧞 思考中...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div style={{ borderTop: '1px solid var(--border)', padding: '1rem', display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="form-input"
              style={{ flex: 1 }}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && !loading && handleSendMessage()}
              placeholder={t.placeholder}
              disabled={loading}
            />
            <button className="btn btn-primary" onClick={() => handleSendMessage()} disabled={loading || !chatInput.trim()}>
              {t.send}
            </button>
          </div>
        </div>

        {/* Quick Questions */}
        <div className="card">
          <h4 style={{ marginBottom: '1rem' }}>💡 {t.suggestions}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {quickQuestions.map((q, i) => (
              <button
                key={i}
                className="btn btn-outline btn-sm"
                style={{ textAlign: 'left', whiteSpace: 'normal', height: 'auto', padding: '0.5rem 0.75rem' }}
                onClick={() => handleSendMessage(q)}
                disabled={loading}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherAssistantPage;
