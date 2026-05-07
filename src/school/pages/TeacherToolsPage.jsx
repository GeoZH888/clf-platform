import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const TeacherToolsPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('ppt');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  // PPT Form
  const [pptForm, setPptForm] = useState({
    topic: '',
    hskLevel: 3,
    slides: 10,
    style: 'educational',
    includeImages: true,
    includeExercises: true
  });

  // Quiz Form
  const [quizForm, setQuizForm] = useState({
    topic: '',
    hskLevel: 3,
    questionCount: 10,
    questionTypes: ['multiple_choice', 'fill_blank'],
    difficulty: 'medium',
    timeLimit: 30
  });

  // Game Form
  const [gameForm, setGameForm] = useState({
    gameType: 'matching',
    topic: '',
    hskLevel: 3,
    vocabulary: '',
    difficulty: 'medium'
  });

  // Worksheet Form
  const [worksheetForm, setWorksheetForm] = useState({
    type: 'vocabulary',
    topic: '',
    hskLevel: 3,
    exerciseCount: 10,
    includeAnswers: true
  });

  const txt = {
    zh: {
      title: '教学工具中心',
      subtitle: '智能生成PPT、测验、游戏、练习册',
      ppt: 'PPT课件',
      quiz: '测验题库',
      games: '学习游戏',
      worksheet: '练习册',
      
      // PPT
      pptTitle: '智能PPT生成',
      pptDesc: '输入主题，自动生成教学PPT',
      topic: '主题/内容',
      topicPlaceholder: '如：HSK3第5课生词、中国春节、比较句语法...',
      hskLevel: 'HSK等级',
      slideCount: '幻灯片数量',
      style: '风格',
      styleEducational: '教学风格',
      styleInteractive: '互动风格',
      styleFun: '趣味风格',
      includeImages: '包含插图',
      includeExercises: '包含练习',
      generatePPT: '生成PPT',
      
      // Quiz
      quizTitle: '智能测验生成',
      quizDesc: '自动生成各类测验题目',
      questionCount: '题目数量',
      questionTypes: '题目类型',
      multipleChoice: '选择题',
      fillBlank: '填空题',
      trueFalse: '判断题',
      matching: '连线题',
      shortAnswer: '简答题',
      difficulty: '难度',
      easy: '简单',
      medium: '中等',
      hard: '困难',
      timeLimit: '时间限制(分钟)',
      generateQuiz: '生成测验',
      
      // Games
      gamesTitle: '学习游戏生成',
      gamesDesc: '生成互动学习游戏',
      gameType: '游戏类型',
      gameMatching: '词汇配对',
      gameMemory: '记忆翻牌',
      gameTyping: '打字练习',
      gamePuzzle: '汉字拼图',
      gameStory: '故事冒险',
      vocabulary: '词汇列表',
      vocabularyPlaceholder: '每行一个词，如：\n苹果\n香蕉\n西瓜',
      generateGame: '生成游戏',
      
      // Worksheet
      worksheetTitle: '练习册生成',
      worksheetDesc: '生成可打印的练习册',
      worksheetType: '类型',
      typeVocabulary: '词汇练习',
      typeGrammar: '语法练习',
      typeReading: '阅读理解',
      typeWriting: '写作练习',
      typeListening: '听力练习',
      exerciseCount: '练习题数',
      includeAnswers: '包含答案页',
      generateWorksheet: '生成练习册',
      
      // Common
      preview: '预览',
      download: '下载',
      save: '保存到资料库',
      generating: '生成中...',
      success: '生成成功！',
      assignToClass: '分配给班级',
      
      // Results
      resultReady: '生成完成！',
      previewResult: '预览结果',
      downloadPPT: '下载PPT',
      downloadPDF: '下载PDF',
      playGame: '试玩游戏',
      startQuiz: '开始测验'
    },
    en: {
      title: 'Teaching Tools Center',
      subtitle: 'AI-powered PPT, Quiz, Games, Worksheets',
      ppt: 'PPT Slides',
      quiz: 'Quiz Builder',
      games: 'Learning Games',
      worksheet: 'Worksheets',
      
      pptTitle: 'Smart PPT Generator',
      pptDesc: 'Enter a topic, generate teaching slides automatically',
      topic: 'Topic/Content',
      topicPlaceholder: 'e.g.: HSK3 Lesson 5 vocabulary, Chinese New Year, Comparison grammar...',
      hskLevel: 'HSK Level',
      slideCount: 'Number of Slides',
      style: 'Style',
      styleEducational: 'Educational',
      styleInteractive: 'Interactive',
      styleFun: 'Fun & Playful',
      includeImages: 'Include Images',
      includeExercises: 'Include Exercises',
      generatePPT: 'Generate PPT',
      
      quizTitle: 'Smart Quiz Generator',
      quizDesc: 'Automatically generate quiz questions',
      questionCount: 'Number of Questions',
      questionTypes: 'Question Types',
      multipleChoice: 'Multiple Choice',
      fillBlank: 'Fill in Blank',
      trueFalse: 'True/False',
      matching: 'Matching',
      shortAnswer: 'Short Answer',
      difficulty: 'Difficulty',
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
      timeLimit: 'Time Limit (min)',
      generateQuiz: 'Generate Quiz',
      
      gamesTitle: 'Learning Game Generator',
      gamesDesc: 'Create interactive learning games',
      gameType: 'Game Type',
      gameMatching: 'Word Matching',
      gameMemory: 'Memory Cards',
      gameTyping: 'Typing Practice',
      gamePuzzle: 'Character Puzzle',
      gameStory: 'Story Adventure',
      vocabulary: 'Vocabulary List',
      vocabularyPlaceholder: 'One word per line:\napple\nbanana\nwatermelon',
      generateGame: 'Generate Game',
      
      worksheetTitle: 'Worksheet Generator',
      worksheetDesc: 'Generate printable worksheets',
      worksheetType: 'Type',
      typeVocabulary: 'Vocabulary',
      typeGrammar: 'Grammar',
      typeReading: 'Reading',
      typeWriting: 'Writing',
      typeListening: 'Listening',
      exerciseCount: 'Exercise Count',
      includeAnswers: 'Include Answer Key',
      generateWorksheet: 'Generate Worksheet',
      
      preview: 'Preview',
      download: 'Download',
      save: 'Save to Library',
      generating: 'Generating...',
      success: 'Generated successfully!',
      assignToClass: 'Assign to Class',
      
      resultReady: 'Generation Complete!',
      previewResult: 'Preview Result',
      downloadPPT: 'Download PPT',
      downloadPDF: 'Download PDF',
      playGame: 'Play Game',
      startQuiz: 'Start Quiz'
    }
  };
  const t = txt[language] || txt.en;

  // Generate PPT with real content
  const handleGeneratePPT = async () => {
    if (!pptForm.topic) {
      setMessage({ type: 'error', text: language === 'zh' ? '请输入主题' : 'Please enter a topic' });
      return;
    }
    setLoading(true);
    setResult(null);
    
    // Generate realistic content based on topic and HSK level
    const topic = pptForm.topic;
    const hskLevel = pptForm.hskLevel;
    const slideCount = pptForm.slides;
    
    // Create slides based on the topic
    const generateSlides = () => {
      const slides = [];
      
      // Slide 1: Title
      slides.push({
        title: topic,
        content: `HSK ${hskLevel} 课程\n欢迎学习！`
      });
      
      // Slide 2: Learning Objectives
      slides.push({
        title: '📚 学习目标',
        content: `1. 了解"${topic}"的基本概念\n2. 掌握相关词汇和表达\n3. 能够使用新学的词汇造句\n4. 理解文化背景知识`
      });
      
      // Slide 3: New Vocabulary
      const vocabByTopic = {
        '中国春节': '春节 chūnjié - Spring Festival\n红包 hóngbāo - Red envelope\n拜年 bàinián - New Year visit\n饺子 jiǎozi - Dumplings\n烟花 yānhuā - Fireworks\n团圆 tuányuán - Reunion',
        '中国美食': '菜单 càidān - Menu\n点菜 diǎncài - Order food\n好吃 hǎochī - Delicious\n辣 là - Spicy\n甜 tián - Sweet\n筷子 kuàizi - Chopsticks',
        '中国文化': '文化 wénhuà - Culture\n传统 chuántǒng - Traditional\n历史 lìshǐ - History\n书法 shūfǎ - Calligraphy\n茶道 chádào - Tea ceremony\n功夫 gōngfu - Kung fu',
        '日常生活': '起床 qǐchuáng - Wake up\n吃早饭 chī zǎofàn - Eat breakfast\n上班 shàngbān - Go to work\n下班 xiàbān - Get off work\n睡觉 shuìjiào - Sleep\n休息 xiūxi - Rest',
        '购物': '多少钱 duōshǎo qián - How much\n便宜 piányi - Cheap\n贵 guì - Expensive\n打折 dǎzhé - Discount\n付款 fùkuǎn - Pay\n找零 zhǎolíng - Change'
      };
      
      const defaultVocab = `词汇1 cíhuì - Vocabulary 1\n词汇2 cíhuì - Vocabulary 2\n词汇3 cíhuì - Vocabulary 3\n词汇4 cíhuì - Vocabulary 4\n词汇5 cíhuì - Vocabulary 5`;
      
      slides.push({
        title: '📝 新词汇',
        content: vocabByTopic[topic] || defaultVocab
      });
      
      // Slide 4: Key Sentences
      const sentencesByTopic = {
        '中国春节': '1. 新年快乐！Xīnnián kuàilè! - Happy New Year!\n2. 恭喜发财！Gōngxǐ fācái! - Wish you prosperity!\n3. 我们一起包饺子吧。Let\'s make dumplings together.\n4. 春节是中国最重要的节日。Spring Festival is China\'s most important holiday.',
        '中国美食': '1. 这道菜很好吃！This dish is delicious!\n2. 我想点一份宫保鸡丁。I\'d like to order Kung Pao Chicken.\n3. 请给我一双筷子。Please give me a pair of chopsticks.\n4. 中国菜有八大菜系。Chinese cuisine has eight major styles.',
        '日常生活': '1. 我每天早上七点起床。I wake up at 7am every day.\n2. 你今天几点下班？What time do you get off work today?\n3. 周末我喜欢在家休息。I like to rest at home on weekends.\n4. 我们一起去吃饭吧！Let\'s go eat together!'
      };
      
      slides.push({
        title: '💬 常用句型',
        content: sentencesByTopic[topic] || `1. 关于"${topic}"的句子...\n2. 请跟我读...\n3. 你能用这个词造句吗？\n4. 让我们一起练习吧！`
      });
      
      // Slide 5: Grammar Point
      slides.push({
        title: '📖 语法要点',
        content: `本课语法重点：\n\n1. 结构：主语 + 谓语 + 宾语\n2. 时态：现在时 / 过去时\n3. 量词的使用\n4. 常见句式练习`
      });
      
      // Slide 6: Cultural Knowledge
      const culturalByTopic = {
        '中国春节': '🏮 文化知识：\n\n• 春节有4000多年历史\n• 农历正月初一开始\n• 持续15天，到元宵节结束\n• 贴春联、放鞭炮、看春晚\n• 给孩子发红包',
        '中国美食': '🍜 饮食文化：\n\n• 中国有八大菜系\n• 讲究色香味俱全\n• 使用筷子用餐\n• 饭前说"请慢用"\n• 主人会不断给客人夹菜',
        '中国文化': '🎭 传统文化：\n\n• 五千年文明历史\n• 四大发明闻名世界\n• 重视孝道和家庭\n• 茶文化源远流长\n• 中医药独具特色'
      };
      
      slides.push({
        title: '🌏 文化知识',
        content: culturalByTopic[topic] || `关于"${topic}"的文化背景：\n\n• 历史渊源\n• 文化意义\n• 现代发展\n• 中西对比`
      });
      
      // Add more slides if needed
      if (slideCount > 6) {
        slides.push({
          title: '✍️ 课堂练习',
          content: `练习一：填空\n1. 春节是中国最___的节日。\n2. 我们用___吃饭。\n\n练习二：造句\n用今天学的词汇造两个句子。\n\n练习三：对话\n和同学练习对话。`
        });
      }
      
      if (slideCount > 7) {
        slides.push({
          title: '🎯 小测验',
          content: `1. "新年快乐"用英语怎么说？\nA) Good morning B) Happy New Year C) Thank you\n\n2. 中国人过春节吃什么？\nA) 汉堡 B) 饺子 C) 披萨\n\n3. 红包里面有什么？\nA) 糖果 B) 钱 C) 花`
        });
      }
      
      if (slideCount > 8) {
        slides.push({
          title: '📋 课后作业',
          content: `1. 复习今天学的新词汇\n2. 用新词汇写5个句子\n3. 预习下一课内容\n4. 和家人练习对话\n\n下次课见！再见！👋`
        });
      }
      
      // Final slide
      slides.push({
        title: '🎉 今日总结',
        content: `今天我们学习了：\n\n✅ ${topic}相关词汇\n✅ 实用句型表达\n✅ 语法知识点\n✅ 文化背景\n\n谢谢大家！下课！`
      });
      
      return slides.slice(0, slideCount);
    };
    
    // Simulate loading time
    setTimeout(() => {
      setResult({
        type: 'ppt',
        title: pptForm.topic,
        slides: pptForm.slides,
        preview: generateSlides()
      });
      setLoading(false);
      setMessage({ type: 'success', text: t.success });
    }, 1500);
  };

  // Generate Quiz with real content
  const handleGenerateQuiz = async () => {
    if (!quizForm.topic) {
      setMessage({ type: 'error', text: language === 'zh' ? '请输入主题' : 'Please enter a topic' });
      return;
    }
    setLoading(true);
    setResult(null);
    
    // Generate realistic quiz questions based on topic
    const generateQuestions = () => {
      const topic = quizForm.topic;
      const count = quizForm.questionCount;
      
      // Pre-defined question banks by topic
      const questionBanks = {
        '中国春节': [
          { question: '中国春节是农历的哪一天？', options: ['A. 正月初一', 'B. 十二月三十', 'C. 八月十五', 'D. 五月初五'], answer: 'A' },
          { question: '"恭喜发财"是什么意思？', options: ['A. 身体健康', 'B. 祝你发财', 'C. 新年快乐', 'D. 万事如意'], answer: 'B' },
          { question: '春节时中国人常吃什么？', options: ['A. 月饼', 'B. 粽子', 'C. 饺子', 'D. 汤圆'], answer: 'C' },
          { question: '红包里面通常放什么？', options: ['A. 糖果', 'B. 钱', 'C. 照片', 'D. 纸条'], answer: 'B' },
          { question: '春节持续多少天？', options: ['A. 1天', 'B. 7天', 'C. 15天', 'D. 30天'], answer: 'C' },
          { question: '"拜年"是什么意思？', options: ['A. 工作', 'B. 学习', 'C. 走亲访友祝福', 'D. 购物'], answer: 'C' },
          { question: '春节的最后一天叫什么？', options: ['A. 除夕', 'B. 元宵节', 'C. 中秋节', 'D. 清明节'], answer: 'B' },
          { question: '贴春联用什么颜色的纸？', options: ['A. 白色', 'B. 黄色', 'C. 红色', 'D. 蓝色'], answer: 'C' },
          { question: '春节前一天晚上叫什么？', options: ['A. 元宵', 'B. 除夕', 'C. 初一', 'D. 腊八'], answer: 'B' },
          { question: '春节时人们会说"___快乐"', options: ['A. 生日', 'B. 新年', 'C. 周末', 'D. 早上'], answer: 'B' }
        ],
        '中国美食': [
          { question: '中国人用什么吃饭？', options: ['A. 刀叉', 'B. 勺子', 'C. 筷子', 'D. 手'], answer: 'C' },
          { question: '"好吃"的英文是什么？', options: ['A. Beautiful', 'B. Delicious', 'C. Expensive', 'D. Cheap'], answer: 'B' },
          { question: '北京烤鸭是哪里的菜？', options: ['A. 上海', 'B. 广州', 'C. 北京', 'D. 成都'], answer: 'C' },
          { question: '四川菜的特点是什么？', options: ['A. 甜', 'B. 辣', 'C. 酸', 'D. 咸'], answer: 'B' },
          { question: '饺子是用什么包的？', options: ['A. 米', 'B. 面', 'C. 豆', 'D. 菜'], answer: 'B' },
          { question: '"点菜"是什么意思？', options: ['A. 买菜', 'B. 做菜', 'C. 点餐', 'D. 洗菜'], answer: 'C' },
          { question: '中国有几大菜系？', options: ['A. 4个', 'B. 6个', 'C. 8个', 'D. 10个'], answer: 'C' },
          { question: '"茶"的拼音是什么？', options: ['A. chá', 'B. cá', 'C. tá', 'D. shá'], answer: 'A' },
          { question: '粤菜是哪个地方的菜？', options: ['A. 北京', 'B. 上海', 'C. 广东', 'D. 四川'], answer: 'C' },
          { question: '汤圆通常什么时候吃？', options: ['A. 春节', 'B. 元宵节', 'C. 中秋节', 'D. 端午节'], answer: 'B' }
        ],
        '日常生活': [
          { question: '"起床"的意思是什么？', options: ['A. 睡觉', 'B. 醒来下床', 'C. 吃饭', 'D. 工作'], answer: 'B' },
          { question: '早上好用中文怎么说？', options: ['A. 晚安', 'B. 你好', 'C. 早上好', 'D. 再见'], answer: 'C' },
          { question: '"上班"是什么意思？', options: ['A. 去学校', 'B. 去工作', 'C. 去医院', 'D. 去商店'], answer: 'B' },
          { question: '一天有多少小时？', options: ['A. 12小时', 'B. 20小时', 'C. 24小时', 'D. 30小时'], answer: 'C' },
          { question: '"休息"的反义词是什么？', options: ['A. 睡觉', 'B. 工作', 'C. 吃饭', 'D. 玩'], answer: 'B' },
          { question: '周末是哪几天？', options: ['A. 周一周二', 'B. 周三周四', 'C. 周五周六', 'D. 周六周日'], answer: 'D' },
          { question: '"吃早饭"是什么时候？', options: ['A. 早上', 'B. 中午', 'C. 晚上', 'D. 半夜'], answer: 'A' },
          { question: '"下班"以后做什么？', options: ['A. 上班', 'B. 回家', 'C. 上学', 'D. 工作'], answer: 'B' },
          { question: '一周有几天？', options: ['A. 5天', 'B. 6天', 'C. 7天', 'D. 8天'], answer: 'C' },
          { question: '"睡觉"用英文怎么说？', options: ['A. Eat', 'B. Work', 'C. Sleep', 'D. Play'], answer: 'C' }
        ],
        '购物': [
          { question: '"多少钱"是问什么？', options: ['A. 颜色', 'B. 价格', 'C. 大小', 'D. 时间'], answer: 'B' },
          { question: '"便宜"的反义词是什么？', options: ['A. 大', 'B. 小', 'C. 贵', 'D. 好'], answer: 'C' },
          { question: '买东西付款用什么？', options: ['A. 书', 'B. 钱', 'C. 纸', 'D. 笔'], answer: 'B' },
          { question: '"打折"是什么意思？', options: ['A. 涨价', 'B. 降价优惠', 'C. 不卖', 'D. 关门'], answer: 'B' },
          { question: '在哪里可以买东西？', options: ['A. 图书馆', 'B. 医院', 'C. 商店', 'D. 学校'], answer: 'C' },
          { question: '"试衣间"是做什么的？', options: ['A. 吃饭', 'B. 试穿衣服', 'C. 睡觉', 'D. 工作'], answer: 'B' },
          { question: '"现金"是什么意思？', options: ['A. 银行卡', 'B. 手机', 'C. 纸币硬币', 'D. 支票'], answer: 'C' },
          { question: '买完东西说什么？', options: ['A. 你好', 'B. 再见', 'C. 谢谢', 'D. 对不起'], answer: 'C' },
          { question: '"收银台"在哪里？', options: ['A. 门口', 'B. 付款的地方', 'C. 厕所', 'D. 仓库'], answer: 'B' },
          { question: '"大小"是问什么？', options: ['A. 价格', 'B. 颜色', 'C. 尺寸', 'D. 重量'], answer: 'C' }
        ]
      };
      
      // Default questions for other topics
      const defaultQuestions = [
        { question: `"${topic}"用英文怎么说？`, options: ['A. 正确答案', 'B. 错误选项', 'C. 错误选项', 'D. 错误选项'], answer: 'A' },
        { question: `关于"${topic}"，下面哪个是正确的？`, options: ['A. 正确描述', 'B. 错误描述', 'C. 错误描述', 'D. 错误描述'], answer: 'A' },
        { question: `"${topic}"最常见的特点是什么？`, options: ['A. 特点一', 'B. 特点二', 'C. 特点三', 'D. 特点四'], answer: 'A' },
        { question: `学习"${topic}"应该先了解什么？`, options: ['A. 基础知识', 'B. 高级内容', 'C. 不需要了解', 'D. 随便'], answer: 'A' },
        { question: `"${topic}"在中国文化中代表什么？`, options: ['A. 重要意义', 'B. 没有意义', 'C. 负面意义', 'D. 不确定'], answer: 'A' }
      ];
      
      // Get questions for the topic
      let questions = questionBanks[topic] || [];
      
      // If not enough questions, add default ones
      while (questions.length < count) {
        const defaultQ = defaultQuestions[questions.length % defaultQuestions.length];
        questions.push({
          ...defaultQ,
          question: defaultQ.question.replace('${topic}', topic)
        });
      }
      
      // Return requested number of questions
      return questions.slice(0, count).map((q, i) => ({
        id: i + 1,
        type: quizForm.questionTypes[i % quizForm.questionTypes.length],
        ...q
      }));
    };
    
    setTimeout(() => {
      setResult({
        type: 'quiz',
        title: quizForm.topic,
        questions: generateQuestions()
      });
      setLoading(false);
      setMessage({ type: 'success', text: t.success });
    }, 1500);
  };

  // Generate Game
  const handleGenerateGame = async () => {
    if (!gameForm.topic && !gameForm.vocabulary) {
      setMessage({ type: 'error', text: language === 'zh' ? '请输入主题或词汇' : 'Please enter topic or vocabulary' });
      return;
    }
    setLoading(true);
    setResult(null);
    
    setTimeout(() => {
      setResult({
        type: 'game',
        gameType: gameForm.gameType,
        title: gameForm.topic || '词汇游戏',
        vocabulary: gameForm.vocabulary.split('\n').filter(v => v.trim())
      });
      setLoading(false);
      setMessage({ type: 'success', text: t.success });
    }, 2000);
  };

  // Generate Worksheet
  const handleGenerateWorksheet = async () => {
    if (!worksheetForm.topic) {
      setMessage({ type: 'error', text: language === 'zh' ? '请输入主题' : 'Please enter a topic' });
      return;
    }
    setLoading(true);
    setResult(null);
    
    setTimeout(() => {
      setResult({
        type: 'worksheet',
        title: worksheetForm.topic,
        exerciseCount: worksheetForm.exerciseCount,
        hasAnswers: worksheetForm.includeAnswers
      });
      setLoading(false);
      setMessage({ type: 'success', text: t.success });
    }, 2000);
  };

  const tabs = [
    { id: 'ppt', label: t.ppt, icon: '📊' },
    { id: 'quiz', label: t.quiz, icon: '❓' },
    { id: 'games', label: t.games, icon: '🎮' },
    { id: 'worksheet', label: t.worksheet, icon: '📝' }
  ];

  // Get topic-related images from Unsplash
  const getTopicImages = (topic) => {
    const imageMap = {
      '中国春节': [
        'https://images.unsplash.com/photo-1548919973-5cef591cdbc9?w=800', // Chinese lanterns
        'https://images.unsplash.com/photo-1517191297489-3c32d559ff8c?w=800', // Red decorations
        'https://images.unsplash.com/photo-1545579133-99bb5ab189bd?w=800', // Fireworks
        'https://images.unsplash.com/photo-1582192730841-2a682d7375f9?w=800', // Temple
        'https://images.unsplash.com/photo-1514125669375-59ee3985d08b?w=800', // Dragon
      ],
      '中国美食': [
        'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800', // Dumplings
        'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800', // Noodles
        'https://images.unsplash.com/photo-1552611052-33e04de081de?w=800', // Dim sum
        'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=800', // Hot pot
        'https://images.unsplash.com/photo-1555126634-323283e090fa?w=800', // Chinese food
      ],
      '中国文化': [
        'https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=800', // Great Wall
        'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800', // Temple
        'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800', // Calligraphy
        'https://images.unsplash.com/photo-1545893835-abaa50cbe628?w=800', // Traditional
        'https://images.unsplash.com/photo-1474181487882-5abf3f0ba6c2?w=800', // Pagoda
      ],
      '日常生活': [
        'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800', // Morning
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800', // Food
        'https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?w=800', // Work
        'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800', // People
        'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800', // Family
      ]
    };
    return imageMap[topic] || [
      'https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=800',
      'https://images.unsplash.com/photo-1513673054901-2b5f51551112?w=800',
      'https://images.unsplash.com/photo-1523731407965-2430cd12f5e4?w=800',
      'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800',
      'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=800',
    ];
  };

  // Download PPT as HTML file with images
  const handleDownloadPPT = () => {
    if (!result || result.type !== 'ppt') return;
    
    const images = getTopicImages(result.title);
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${result.title} - 教学PPT</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', sans-serif; background: #1a1a2e; }
    
    .slide {
      width: 100%;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 60px;
      position: relative;
      overflow: hidden;
      page-break-after: always;
    }
    
    .slide-bg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-size: cover;
      background-position: center;
      filter: brightness(0.4);
      z-index: 0;
    }
    
    .slide-content {
      position: relative;
      z-index: 1;
      color: white;
      text-align: center;
      max-width: 1000px;
    }
    
    .slide h1 {
      font-size: 3.5rem;
      margin-bottom: 1.5rem;
      text-shadow: 3px 3px 6px rgba(0,0,0,0.5);
      font-weight: 700;
    }
    
    .slide .content-box {
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(10px);
      padding: 40px 50px;
      border-radius: 20px;
      text-align: left;
      font-size: 1.4rem;
      line-height: 2;
      white-space: pre-line;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.1);
    }
    
    .slide-number {
      position: absolute;
      bottom: 30px;
      right: 40px;
      font-size: 1rem;
      color: rgba(255,255,255,0.7);
      z-index: 1;
    }
    
    .logo {
      position: absolute;
      top: 30px;
      left: 40px;
      font-size: 1.2rem;
      color: rgba(255,255,255,0.8);
      z-index: 1;
    }
    
    /* Title slide special styling */
    .title-slide h1 {
      font-size: 5rem;
      margin-bottom: 2rem;
    }
    
    .title-slide .subtitle {
      font-size: 2rem;
      opacity: 0.9;
      margin-bottom: 3rem;
    }
    
    .title-slide .meta {
      font-size: 1.2rem;
      opacity: 0.7;
    }
    
    /* Vocabulary slide */
    .vocab-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      text-align: left;
    }
    
    .vocab-item {
      background: rgba(255,255,255,0.1);
      padding: 15px 20px;
      border-radius: 10px;
      border-left: 4px solid #ffd700;
    }
    
    .vocab-chinese {
      font-size: 1.8rem;
      font-weight: bold;
      color: #ffd700;
    }
    
    .vocab-pinyin {
      font-size: 1rem;
      opacity: 0.8;
      font-style: italic;
    }
    
    .vocab-english {
      font-size: 1rem;
      opacity: 0.9;
    }
    
    /* Image slide */
    .slide-image {
      max-width: 60%;
      max-height: 50vh;
      border-radius: 15px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.4);
      margin-bottom: 30px;
    }
    
    /* Print styles */
    @media print {
      .slide { height: 100vh; page-break-after: always; }
    }
    
    /* Animation for preview */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .slide-content {
      animation: fadeIn 0.6s ease-out;
    }
  </style>
</head>
<body>
  ${result.preview.map((slide, i) => {
    const bgImage = images[i % images.length];
    const isTitle = i === 0;
    const isVocab = slide.title.includes('词汇') || slide.title.includes('Vocabulary');
    const hasImage = pptForm.includeImages && (i === 0 || i === 2 || i === 5);
    
    return `
  <div class="slide ${isTitle ? 'title-slide' : ''}">
    <div class="slide-bg" style="background-image: url('${bgImage}')"></div>
    <div class="logo">🎓 大卫学中文</div>
    <div class="slide-content">
      ${hasImage && !isTitle ? `<img src="${bgImage}" class="slide-image" alt="illustration">` : ''}
      <h1>${slide.title}</h1>
      ${isTitle ? `
        <div class="subtitle">HSK ${pptForm.hskLevel} 级课程</div>
        <div class="meta">📅 ${new Date().toLocaleDateString('zh-CN')} | 👨‍🏫 教学PPT</div>
      ` : isVocab ? `
        <div class="content-box">
          <div class="vocab-grid">
            ${slide.content.split('\\n').filter(line => line.trim()).map(line => {
              const parts = line.split(' - ');
              const chinesePinyin = parts[0] || '';
              const english = parts[1] || '';
              const chinese = chinesePinyin.split(' ')[0] || chinesePinyin;
              const pinyin = chinesePinyin.split(' ').slice(1).join(' ') || '';
              return `
                <div class="vocab-item">
                  <div class="vocab-chinese">${chinese}</div>
                  <div class="vocab-pinyin">${pinyin}</div>
                  <div class="vocab-english">${english}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : `
        <div class="content-box">${slide.content}</div>
      `}
    </div>
    <div class="slide-number">${i + 1} / ${result.preview.length}</div>
  </div>
    `;
  }).join('')}
  
  <script>
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        window.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
      } else if (e.key === 'Home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (e.key === 'End') {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }
    });
    
    // Touch swipe support
    let touchStartY = 0;
    document.addEventListener('touchstart', (e) => touchStartY = e.touches[0].clientY);
    document.addEventListener('touchend', (e) => {
      const diff = touchStartY - e.changedTouches[0].clientY;
      if (Math.abs(diff) > 50) {
        window.scrollBy({ top: diff > 0 ? window.innerHeight : -window.innerHeight, behavior: 'smooth' });
      }
    });
    
    // Print info
    console.log('🎓 大卫学中文 - 教学PPT');
    console.log('按 → 或 空格键 下一页');
    console.log('按 ← 上一页');
    console.log('按 Ctrl+P 打印为PDF');
  </script>
</body>
</html>`;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.title}_教学PPT.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage({ type: 'success', text: language === 'zh' ? '✅ 下载成功！用浏览器打开HTML文件即可演示，按Ctrl+P可打印为PDF' : '✅ Downloaded! Open in browser to present, Ctrl+P to print as PDF' });
  };

  // Preview PPT in new window with images
  const handlePreviewPPT = () => {
    if (!result || result.type !== 'ppt') return;
    
    const images = getTopicImages(result.title);
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${result.title} - 预览</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; background: #000; overflow: hidden; }
    
    .slide {
      width: 100vw;
      height: 100vh;
      display: none;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 60px;
      position: relative;
    }
    
    .slide.active { display: flex; }
    
    .slide-bg {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      background-size: cover;
      background-position: center;
      filter: brightness(0.4);
    }
    
    .slide-content {
      position: relative;
      z-index: 1;
      color: white;
      text-align: center;
      max-width: 1000px;
      animation: fadeIn 0.5s ease-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    
    .slide h1 {
      font-size: 3.5rem;
      margin-bottom: 1.5rem;
      text-shadow: 3px 3px 6px rgba(0,0,0,0.5);
    }
    
    .content-box {
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(10px);
      padding: 40px 50px;
      border-radius: 20px;
      text-align: left;
      font-size: 1.4rem;
      line-height: 2;
      white-space: pre-line;
    }
    
    .slide-image {
      max-width: 50%;
      max-height: 40vh;
      border-radius: 15px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.4);
      margin-bottom: 30px;
    }
    
    .nav {
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 15px;
      z-index: 100;
    }
    
    .nav button {
      padding: 15px 30px;
      border: none;
      background: rgba(255,255,255,0.2);
      color: white;
      border-radius: 10px;
      cursor: pointer;
      font-size: 1.1rem;
      transition: all 0.3s;
      backdrop-filter: blur(10px);
    }
    
    .nav button:hover {
      background: rgba(255,255,255,0.3);
      transform: scale(1.05);
    }
    
    .progress {
      position: fixed;
      top: 0;
      left: 0;
      height: 4px;
      background: linear-gradient(90deg, #ffd700, #ff6b6b);
      transition: width 0.3s;
    }
    
    .slide-number {
      position: fixed;
      bottom: 30px;
      right: 40px;
      color: rgba(255,255,255,0.7);
      font-size: 1.2rem;
    }
    
    .logo {
      position: fixed;
      top: 30px;
      left: 40px;
      color: rgba(255,255,255,0.8);
      font-size: 1.2rem;
    }
    
    .title-slide h1 { font-size: 5rem; }
    .title-slide .subtitle { font-size: 2rem; opacity: 0.9; margin-bottom: 2rem; }
    .title-slide .meta { font-size: 1.2rem; opacity: 0.7; }
  </style>
</head>
<body>
  <div class="progress" id="progress"></div>
  <div class="logo">🎓 大卫学中文</div>
  
  ${result.preview.map((slide, i) => `
  <div class="slide ${i === 0 ? 'active title-slide' : ''}" data-index="${i}">
    <div class="slide-bg" style="background-image: url('${images[i % images.length]}')"></div>
    <div class="slide-content">
      ${i > 0 && i % 3 === 0 ? `<img src="${images[i % images.length]}" class="slide-image" alt="">` : ''}
      <h1>${slide.title}</h1>
      ${i === 0 ? `
        <div class="subtitle">HSK ${pptForm.hskLevel} 级课程</div>
        <div class="meta">📅 ${new Date().toLocaleDateString('zh-CN')}</div>
      ` : `
        <div class="content-box">${slide.content}</div>
      `}
    </div>
  </div>
  `).join('')}
  
  <div class="slide-number"><span id="current">1</span> / ${result.preview.length}</div>
  
  <div class="nav">
    <button onclick="prev()">◀ 上一页</button>
    <button onclick="next()">下一页 ▶</button>
    <button onclick="toggleFullscreen()">⛶ 全屏</button>
  </div>
  
  <script>
    let current = 0;
    const total = ${result.preview.length};
    const slides = document.querySelectorAll('.slide');
    
    function showSlide(n) {
      slides.forEach((s, i) => {
        s.classList.remove('active');
        if (i === n) s.classList.add('active');
      });
      document.getElementById('current').textContent = n + 1;
      document.getElementById('progress').style.width = ((n + 1) / total * 100) + '%';
    }
    
    function next() { if (current < total - 1) { current++; showSlide(current); } }
    function prev() { if (current > 0) { current--; showSlide(current); } }
    
    function toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
      else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      else if (e.key === 'Home') { current = 0; showSlide(0); }
      else if (e.key === 'End') { current = total - 1; showSlide(current); }
    });
    
    // Touch support
    let touchStartX = 0;
    document.addEventListener('touchstart', (e) => touchStartX = e.touches[0].clientX);
    document.addEventListener('touchend', (e) => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    });
  </script>
</body>
</html>`;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'width=1280,height=720');
  };

  // Download PDF (worksheet)
  const handleDownloadPDF = () => {
    if (!result) return;
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${result.title} - 练习册</title>
  <style>
    body { font-family: 'Microsoft YaHei', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { text-align: center; color: #c41e3a; margin-bottom: 30px; }
    .exercise { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
    .exercise h3 { margin-bottom: 15px; }
    .lines { border-bottom: 1px solid #ccc; height: 30px; margin: 10px 0; }
    .print-btn { position: fixed; top: 20px; right: 20px; padding: 10px 20px; background: #c41e3a; color: white; border: none; border-radius: 5px; cursor: pointer; }
    @media print { .print-btn { display: none; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ 打印</button>
  <h1>📝 ${result.title}</h1>
  <p style="text-align: center; color: #666; margin-bottom: 30px;">HSK ${worksheetForm.hskLevel} • ${result.exerciseCount} 道题</p>
  ${Array.from({ length: result.exerciseCount }, (_, i) => `
  <div class="exercise">
    <h3>第 ${i + 1} 题</h3>
    <p>请根据${result.title}的主题完成练习...</p>
    <div class="lines"></div>
    <div class="lines"></div>
    <div class="lines"></div>
  </div>
  `).join('')}
  ${result.hasAnswers ? '<h2 style="margin-top: 50px;">答案</h2><p>答案将在这里显示...</p>' : ''}
</body>
</html>`;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.title}_练习册.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage({ type: 'success', text: language === 'zh' ? '下载成功！打开后点击"打印"可保存为PDF' : 'Downloaded! Open and click Print to save as PDF' });
  };

  return (
    <div>
      <div className="content-header">
        <h1>🛠️ {t.title}</h1>
        <p style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
          {message.text}
          <button onClick={() => setMessage({ type: '', text: '' })} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => { setActiveTab(tab.id); setResult(null); }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
        {/* Form Section */}
        <div className="card">
          {/* PPT Tab */}
          {activeTab === 'ppt' && (
            <div>
              <h3 style={{ marginBottom: '0.5rem' }}>📊 {t.pptTitle}</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{t.pptDesc}</p>
              
              <div className="form-group">
                <label className="form-label">{t.topic} *</label>
                <input
                  type="text"
                  className="form-input"
                  value={pptForm.topic}
                  onChange={e => setPptForm({ ...pptForm, topic: e.target.value })}
                  placeholder={t.topicPlaceholder}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t.hskLevel}</label>
                  <select
                    className="form-select"
                    value={pptForm.hskLevel}
                    onChange={e => setPptForm({ ...pptForm, hskLevel: parseInt(e.target.value) })}
                  >
                    {[1, 2, 3, 4, 5, 6].map(l => <option key={l} value={l}>HSK {l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t.slideCount}</label>
                  <select
                    className="form-select"
                    value={pptForm.slides}
                    onChange={e => setPptForm({ ...pptForm, slides: parseInt(e.target.value) })}
                  >
                    {[5, 10, 15, 20, 30].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t.style}</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['educational', 'interactive', 'fun'].map(style => (
                    <button
                      key={style}
                      className={`btn ${pptForm.style === style ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setPptForm({ ...pptForm, style })}
                    >
                      {t[`style${style.charAt(0).toUpperCase() + style.slice(1)}`]}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={pptForm.includeImages}
                    onChange={e => setPptForm({ ...pptForm, includeImages: e.target.checked })}
                  />
                  {t.includeImages}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={pptForm.includeExercises}
                    onChange={e => setPptForm({ ...pptForm, includeExercises: e.target.checked })}
                  />
                  {t.includeExercises}
                </label>
              </div>

              <button
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                onClick={handleGeneratePPT}
                disabled={loading}
              >
                {loading ? t.generating : `📊 ${t.generatePPT}`}
              </button>
            </div>
          )}

          {/* Quiz Tab */}
          {activeTab === 'quiz' && (
            <div>
              <h3 style={{ marginBottom: '0.5rem' }}>❓ {t.quizTitle}</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{t.quizDesc}</p>
              
              <div className="form-group">
                <label className="form-label">{t.topic} *</label>
                <input
                  type="text"
                  className="form-input"
                  value={quizForm.topic}
                  onChange={e => setQuizForm({ ...quizForm, topic: e.target.value })}
                  placeholder={t.topicPlaceholder}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t.hskLevel}</label>
                  <select
                    className="form-select"
                    value={quizForm.hskLevel}
                    onChange={e => setQuizForm({ ...quizForm, hskLevel: parseInt(e.target.value) })}
                  >
                    {[1, 2, 3, 4, 5, 6].map(l => <option key={l} value={l}>HSK {l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t.questionCount}</label>
                  <select
                    className="form-select"
                    value={quizForm.questionCount}
                    onChange={e => setQuizForm({ ...quizForm, questionCount: parseInt(e.target.value) })}
                  >
                    {[5, 10, 15, 20, 30].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t.questionTypes}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {[
                    { id: 'multiple_choice', label: t.multipleChoice },
                    { id: 'fill_blank', label: t.fillBlank },
                    { id: 'true_false', label: t.trueFalse },
                    { id: 'matching', label: t.matching }
                  ].map(type => (
                    <button
                      key={type.id}
                      className={`btn btn-sm ${quizForm.questionTypes.includes(type.id) ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => {
                        const types = quizForm.questionTypes.includes(type.id)
                          ? quizForm.questionTypes.filter(t => t !== type.id)
                          : [...quizForm.questionTypes, type.id];
                        setQuizForm({ ...quizForm, questionTypes: types });
                      }}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t.difficulty}</label>
                  <select
                    className="form-select"
                    value={quizForm.difficulty}
                    onChange={e => setQuizForm({ ...quizForm, difficulty: e.target.value })}
                  >
                    <option value="easy">{t.easy}</option>
                    <option value="medium">{t.medium}</option>
                    <option value="hard">{t.hard}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t.timeLimit}</label>
                  <select
                    className="form-select"
                    value={quizForm.timeLimit}
                    onChange={e => setQuizForm({ ...quizForm, timeLimit: parseInt(e.target.value) })}
                  >
                    {[10, 15, 20, 30, 45, 60].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <button
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginTop: '1rem' }}
                onClick={handleGenerateQuiz}
                disabled={loading}
              >
                {loading ? t.generating : `❓ ${t.generateQuiz}`}
              </button>
            </div>
          )}

          {/* Games Tab */}
          {activeTab === 'games' && (
            <div>
              <h3 style={{ marginBottom: '0.5rem' }}>🎮 {t.gamesTitle}</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{t.gamesDesc}</p>
              
              <div className="form-group">
                <label className="form-label">{t.gameType}</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem' }}>
                  {[
                    { id: 'matching', label: t.gameMatching, icon: '🔗' },
                    { id: 'memory', label: t.gameMemory, icon: '🃏' },
                    { id: 'typing', label: t.gameTyping, icon: '⌨️' },
                    { id: 'puzzle', label: t.gamePuzzle, icon: '🧩' },
                    { id: 'story', label: t.gameStory, icon: '📖' }
                  ].map(game => (
                    <button
                      key={game.id}
                      className={`btn ${gameForm.gameType === game.id ? 'btn-primary' : 'btn-outline'}`}
                      style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}
                      onClick={() => setGameForm({ ...gameForm, gameType: game.id })}
                    >
                      <span style={{ fontSize: '1.5rem' }}>{game.icon}</span>
                      <span style={{ fontSize: '0.75rem' }}>{game.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t.topic}</label>
                <input
                  type="text"
                  className="form-input"
                  value={gameForm.topic}
                  onChange={e => setGameForm({ ...gameForm, topic: e.target.value })}
                  placeholder={t.topicPlaceholder}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t.hskLevel}</label>
                  <select
                    className="form-select"
                    value={gameForm.hskLevel}
                    onChange={e => setGameForm({ ...gameForm, hskLevel: parseInt(e.target.value) })}
                  >
                    {[1, 2, 3, 4, 5, 6].map(l => <option key={l} value={l}>HSK {l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t.difficulty}</label>
                  <select
                    className="form-select"
                    value={gameForm.difficulty}
                    onChange={e => setGameForm({ ...gameForm, difficulty: e.target.value })}
                  >
                    <option value="easy">{t.easy}</option>
                    <option value="medium">{t.medium}</option>
                    <option value="hard">{t.hard}</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t.vocabulary}</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={gameForm.vocabulary}
                  onChange={e => setGameForm({ ...gameForm, vocabulary: e.target.value })}
                  placeholder={t.vocabularyPlaceholder}
                />
              </div>

              <button
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                onClick={handleGenerateGame}
                disabled={loading}
              >
                {loading ? t.generating : `🎮 ${t.generateGame}`}
              </button>
            </div>
          )}

          {/* Worksheet Tab */}
          {activeTab === 'worksheet' && (
            <div>
              <h3 style={{ marginBottom: '0.5rem' }}>📝 {t.worksheetTitle}</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{t.worksheetDesc}</p>
              
              <div className="form-group">
                <label className="form-label">{t.worksheetType}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {[
                    { id: 'vocabulary', label: t.typeVocabulary },
                    { id: 'grammar', label: t.typeGrammar },
                    { id: 'reading', label: t.typeReading },
                    { id: 'writing', label: t.typeWriting }
                  ].map(type => (
                    <button
                      key={type.id}
                      className={`btn ${worksheetForm.type === type.id ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setWorksheetForm({ ...worksheetForm, type: type.id })}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t.topic} *</label>
                <input
                  type="text"
                  className="form-input"
                  value={worksheetForm.topic}
                  onChange={e => setWorksheetForm({ ...worksheetForm, topic: e.target.value })}
                  placeholder={t.topicPlaceholder}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t.hskLevel}</label>
                  <select
                    className="form-select"
                    value={worksheetForm.hskLevel}
                    onChange={e => setWorksheetForm({ ...worksheetForm, hskLevel: parseInt(e.target.value) })}
                  >
                    {[1, 2, 3, 4, 5, 6].map(l => <option key={l} value={l}>HSK {l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t.exerciseCount}</label>
                  <select
                    className="form-select"
                    value={worksheetForm.exerciseCount}
                    onChange={e => setWorksheetForm({ ...worksheetForm, exerciseCount: parseInt(e.target.value) })}
                  >
                    {[5, 10, 15, 20, 30].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <input
                  type="checkbox"
                  checked={worksheetForm.includeAnswers}
                  onChange={e => setWorksheetForm({ ...worksheetForm, includeAnswers: e.target.checked })}
                />
                {t.includeAnswers}
              </label>

              <button
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                onClick={handleGenerateWorksheet}
                disabled={loading}
              >
                {loading ? t.generating : `📝 ${t.generateWorksheet}`}
              </button>
            </div>
          )}
        </div>

        {/* Result Section */}
        {result && (
          <div className="card">
            <h3 style={{ marginBottom: '1rem', color: 'var(--success)' }}>✅ {t.resultReady}</h3>
            
            {result.type === 'ppt' && (
              <div>
                <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                  <h4>{result.title}</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{result.slides} slides</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  {result.preview.map((slide, i) => (
                    <div key={i} style={{ padding: '0.75rem', background: 'var(--background)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ width: '24px', height: '24px', background: 'var(--primary)', color: 'white', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>{i + 1}</span>
                      <span>{slide.title}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleDownloadPPT}>📊 {t.downloadPPT}</button>
                  <button className="btn btn-outline" style={{ flex: 1 }} onClick={handlePreviewPPT}>{t.preview}</button>
                </div>
              </div>
            )}

            {result.type === 'quiz' && (
              <div>
                <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                  <h4>{result.title}</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{result.questions.length} questions</p>
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                  {result.questions.slice(0, 5).map((q, i) => (
                    <div key={i} style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                      <p style={{ fontWeight: '500' }}>{q.question}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.5rem' }}>
                        {q.options.map((opt, j) => (
                          <span key={j} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: 'var(--background)', borderRadius: '4px' }}>{opt}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }}>🚀 {t.startQuiz}</button>
                  <button className="btn btn-outline" style={{ flex: 1 }}>{t.assignToClass}</button>
                </div>
              </div>
            )}

            {result.type === 'game' && (
              <div>
                <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '3rem' }}>
                    {result.gameType === 'matching' ? '🔗' : result.gameType === 'memory' ? '🃏' : result.gameType === 'typing' ? '⌨️' : result.gameType === 'puzzle' ? '🧩' : '📖'}
                  </span>
                  <h4 style={{ marginTop: '0.5rem' }}>{result.title}</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{result.vocabulary.length} words</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }}>🎮 {t.playGame}</button>
                  <button className="btn btn-outline" style={{ flex: 1 }}>{t.assignToClass}</button>
                </div>
              </div>
            )}

            {result.type === 'worksheet' && (
              <div>
                <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                  <h4>{result.title}</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{result.exerciseCount} exercises • {result.hasAnswers ? 'With answers' : 'No answers'}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleDownloadPDF}>📄 {t.downloadPDF}</button>
                  <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleDownloadPDF}>{t.preview}</button>
                </div>
              </div>
            )}

            <button className="btn btn-outline" style={{ width: '100%', marginTop: '1rem' }}>
              💾 {t.save}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherToolsPage;
