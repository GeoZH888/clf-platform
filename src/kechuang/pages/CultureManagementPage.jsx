import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const CultureManagementPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('chengyu');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiConfig, setAiConfig] = useState(null);

  // 表单状态
  const [form, setForm] = useState({});

  const tableMap = {
    chengyu: 'chengyu',
    videos: 'culture_videos',
    knowledge: 'culture_knowledge',
    games: 'culture_games'
  };

  const txt = {
    zh: {
      title: '🎭 文化内容管理',
      chengyu: '📜 成语管理',
      videos: '🎬 视频管理',
      knowledge: '📚 知识管理',
      games: '🎮 游戏管理',
      add: '添加',
      edit: '编辑',
      delete: '删除',
      save: '保存',
      cancel: '取消',
      confirm: '确定删除吗？',
      success: '操作成功！',
      failed: '操作失败',
      noData: '暂无数据',
      chengyuText: '成语',
      pinyin: '拼音',
      literal: '字面意思',
      meaningZh: '中文含义',
      meaningEn: '英文含义',
      story: '故事',
      example: '例句',
      category: '分类',
      hskLevel: 'HSK级别',
      titleZh: '中文标题',
      titleEn: '英文标题',
      description: '描述',
      videoUrl: '视频链接',
      thumbnail: '缩略图',
      duration: '时长',
      content: '内容',
      icon: '图标',
      isActive: '启用',
      aiAutoFill: 'AI 智能填充',
      aiAutoFillDesc: '只需输入成语，AI 将自动生成全部内容',
      generating: '生成中...',
      oneClickGenerate: '✨ 一键生成'
    },
    en: {
      title: '🎭 Culture Content Management',
      chengyu: '📜 Chengyu',
      videos: '🎬 Videos',
      knowledge: '📚 Knowledge',
      games: '🎮 Games',
      add: 'Add',
      edit: 'Edit',
      delete: 'Delete',
      save: 'Save',
      cancel: 'Cancel',
      confirm: 'Confirm delete?',
      success: 'Success!',
      failed: 'Operation failed',
      noData: 'No data',
      chengyuText: 'Chengyu',
      pinyin: 'Pinyin',
      literal: 'Literal Meaning',
      meaningZh: 'Chinese Meaning',
      meaningEn: 'English Meaning',
      story: 'Story',
      example: 'Example',
      category: 'Category',
      hskLevel: 'HSK Level',
      titleZh: 'Chinese Title',
      titleEn: 'English Title',
      description: 'Description',
      videoUrl: 'Video URL',
      thumbnail: 'Thumbnail',
      duration: 'Duration',
      content: 'Content',
      icon: 'Icon',
      isActive: 'Active',
      aiAutoFill: 'AI Auto-Fill',
      aiAutoFillDesc: 'Enter chengyu and AI will generate all content',
      generating: 'Generating...',
      oneClickGenerate: '✨ Generate'
    },
    it: {
      title: '🎭 Gestione Contenuti Culturali',
      chengyu: '📜 Chengyu',
      videos: '🎬 Video',
      knowledge: '📚 Conoscenze',
      games: '🎮 Giochi',
      add: 'Aggiungi',
      edit: 'Modifica',
      delete: 'Elimina',
      save: 'Salva',
      cancel: 'Annulla',
      confirm: 'Confermi eliminazione?',
      success: 'Operazione riuscita!',
      failed: 'Operazione fallita',
      noData: 'Nessun dato',
      chengyuText: 'Chengyu',
      pinyin: 'Pinyin',
      literal: 'Significato Letterale',
      meaningZh: 'Significato Cinese',
      meaningEn: 'Significato Inglese',
      story: 'Storia',
      example: 'Esempio',
      category: 'Categoria',
      hskLevel: 'Livello HSK',
      titleZh: 'Titolo Cinese',
      titleEn: 'Titolo Inglese',
      description: 'Descrizione',
      videoUrl: 'URL Video',
      thumbnail: 'Miniatura',
      duration: 'Durata',
      content: 'Contenuto',
      icon: 'Icona',
      isActive: 'Attivo',
      aiAutoFill: 'AI Auto-Compila',
      aiAutoFillDesc: 'Inserisci il chengyu e AI genererà tutti i contenuti',
      generating: 'Generando...',
      oneClickGenerate: '✨ Genera'
    }
  };
  const t = txt[language] || txt.zh;

  const categories = ['fable', 'history', 'philosophy', 'art', 'culture', 'nature'];

  // Load AI config
  useEffect(() => {
    const loadAIConfig = async () => {
      if (!supabase) return;
      try {
        const { data } = await supabase.from('dwxz_rag_config').select('*').limit(1).single();
        setAiConfig(data);
      } catch (err) {
        console.log('AI config not found');
      }
    };
    loadAIConfig();
  }, [supabase]);

  useEffect(() => {
    loadItems();
  }, [activeTab, supabase]);

  const loadItems = async () => {
    setLoading(true);
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from(tableMap[activeTab])
          .select('*')
          .order('created_at', { ascending: false });
        
        if (!error && data) {
          setItems(data);
        } else {
          setItems([]);
        }
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item = null) => {
    setEditItem(item);
    setForm(item ? { ...item } : getDefaultForm());
    setShowModal(true);
  };

  const getDefaultForm = () => {
    switch (activeTab) {
      case 'chengyu':
        return { chengyu: '', pinyin: '', literal: '', meaning_zh: '', meaning_en: '', story: '', example: '', category: 'fable', hsk_level: 3, is_active: true };
      case 'videos':
        return { title_zh: '', title_en: '', description: '', video_url: '', thumbnail_url: '', category: 'culture', duration: '', is_active: true };
      case 'knowledge':
        return { icon: '📖', title_zh: '', title_en: '', content: '', category: 'culture', is_active: true };
      case 'games':
        return { name: '', name_zh: '', game_type: 'matching', hsk_levels: [1,2,3], is_active: true };
      default:
        return {};
    }
  };

  // Built-in chengyu dictionary for common idioms (fallback when AI not configured)
  const chengyuDictionary = {
    '水滴石穿': {
      pinyin: 'shuǐ dī shí chuān',
      literal: 'Water dripping wears through stone',
      meaning_zh: '比喻坚持不懈，力量虽小也能成就大事',
      meaning_en: 'Constant dripping wears away the stone; persistence leads to success',
      story: '宋朝有个叫张乖崖的县令，一天看见一个小吏从府库出来时，鬓角旁挂着一枚小钱。张乖崖命人将他押回审讯，小吏辩解说不过是一文钱。张乖崖写下判词："一日一钱，千日千钱。绳锯木断，水滴石穿。"意思是一天偷一钱，千天就是千钱。绳子反复锯木能断，水滴持续滴石能穿。',
      example: '学习语言需要水滴石穿的精神，每天坚持练习。',
      category: 'philosophy',
      hsk_level: 4
    },
    '画龙点睛': {
      pinyin: 'huà lóng diǎn jīng',
      literal: 'Paint a dragon and dot its eyes',
      meaning_zh: '比喻在关键处加上精辟的话使内容更加生动传神',
      meaning_en: 'Adding the finishing touch; making the crucial point that brings everything to life',
      story: '南北朝时期，画家张僧繇在金陵安乐寺的墙壁上画了四条龙，但都没有画眼睛。有人问为什么，他说画上眼睛龙就会飞走。大家不信，他就给其中两条龙点上了眼睛，顿时电闪雷鸣，两条龙破壁飞去。',
      example: '他的演讲结尾那句话真是画龙点睛。',
      category: 'art',
      hsk_level: 4
    },
    '一石二鸟': {
      pinyin: 'yī shí èr niǎo',
      literal: 'One stone, two birds',
      meaning_zh: '做一件事同时达到两个目的',
      meaning_en: 'Kill two birds with one stone; achieve two goals with one action',
      story: '这个成语来源于英语谚语"Kill two birds with one stone"，后被翻译成中文成语。形容做一件事情能够同时达到两个目的，效率很高。',
      example: '去图书馆学习还能遇见朋友，真是一石二鸟。',
      category: 'strategy',
      hsk_level: 3
    },
    '守株待兔': {
      pinyin: 'shǒu zhū dài tù',
      literal: 'Guard a tree stump waiting for rabbits',
      meaning_zh: '比喻死守狭隘的经验，不知变通，或妄想不劳而获',
      meaning_en: 'Wait passively for opportunities instead of taking action; rely on luck',
      story: '战国时期，宋国有个农夫在田里干活，看见一只兔子撞在树桩上死了。他很高兴，捡起兔子回家。从此他再也不干活了，天天守在树桩旁等兔子，结果再也没等到，田地也荒废了。',
      example: '找工作不能守株待兔，要主动投简历。',
      category: 'fable',
      hsk_level: 3
    },
    '对牛弹琴': {
      pinyin: 'duì niú tán qín',
      literal: 'Play the lute to a cow',
      meaning_zh: '比喻对不懂道理的人讲道理，白费口舌',
      meaning_en: 'Cast pearls before swine; talk to someone who cannot understand',
      story: '古时候有个叫公明仪的人，弹琴技艺很高超。有一天他看到一头牛在吃草，就想为它弹琴。他弹了很多美妙的曲子，牛却只顾低头吃草，毫无反应。这并不是牛不好，而是曲子不适合牛听。',
      example: '跟他解释这些专业知识简直是对牛弹琴。',
      category: 'fable',
      hsk_level: 4
    },
    '亡羊补牢': {
      pinyin: 'wáng yáng bǔ láo',
      literal: 'Mend the sheepfold after losing sheep',
      meaning_zh: '比喻出了问题以后想办法补救，可以防止继续受损失',
      meaning_en: 'Better late than never; take remedial action after a loss',
      story: '从前有个人养了一圈羊。一天早上，他发现羊圈破了个洞，少了一只羊。邻居劝他把羊圈修好，他说羊已经丢了，还修什么。第二天又少了一只羊。他后悔莫及，赶紧把羊圈修好，从此再也没丢过羊。',
      example: '虽然考试没考好，但亡羊补牢，现在开始努力还不晚。',
      category: 'fable',
      hsk_level: 3
    },
    '塞翁失马': {
      pinyin: 'sài wēng shī mǎ',
      literal: 'The old man at the frontier lost his horse',
      meaning_zh: '比喻坏事在一定条件下可以变成好事',
      meaning_en: 'A blessing in disguise; misfortune may be a blessing',
      story: '边塞有位老人丢了一匹马，邻居都来安慰他。老人说这不一定是坏事。几个月后，那匹马带着一群野马回来了。邻居又来祝贺，老人说这不一定是好事。后来他儿子骑马摔断了腿，但因此免于从军，保住了性命。',
      example: '我没考上那所大学，但塞翁失马，现在这所学校更适合我。',
      category: 'philosophy',
      hsk_level: 4
    },
    '掩耳盗铃': {
      pinyin: 'yǎn ěr dào líng',
      literal: 'Cover ears while stealing a bell',
      meaning_zh: '比喻自己欺骗自己',
      meaning_en: 'Deceive oneself; bury one\'s head in the sand',
      story: '从前有个人想偷别人家门上的铃铛。他知道用手碰铃铛会发出声音，于是想出一个办法：把自己的耳朵捂住。他以为自己听不见，别人也听不见。结果刚碰到铃铛就被抓住了。',
      example: '不去检查身体是掩耳盗铃，问题不会自己消失。',
      category: 'fable',
      hsk_level: 4
    },
    '狐假虎威': {
      pinyin: 'hú jiǎ hǔ wēi',
      literal: 'The fox borrows the tiger\'s might',
      meaning_zh: '比喻借助别人的威势来欺压人',
      meaning_en: 'Borrow someone else\'s authority to intimidate others',
      story: '老虎抓住了一只狐狸要吃掉它。狐狸说："你不能吃我，天帝命我管理百兽。不信你跟在我后面，看看动物们是不是都怕我。"老虎跟着狐狸走，动物们看见都逃跑了。老虎不知道它们是怕自己，以为真的是怕狐狸。',
      example: '他只是老板的亲戚，却狐假虎威地指挥别人。',
      category: 'fable',
      hsk_level: 4
    },
    '刻舟求剑': {
      pinyin: 'kè zhōu qiú jiàn',
      literal: 'Mark the boat to find the sword',
      meaning_zh: '比喻拘泥成例，不知道随着情势的变化而改变看法或办法',
      meaning_en: 'Take rigid measures regardless of changed circumstances',
      story: '楚国有个人坐船过江时，不小心把剑掉进水里。他急忙在船舷上刻了个记号，说等船靠岸后从这里下去找剑。船靠岸后他跳入水中，当然找不到剑，因为船已经移动了，而剑还在原来的地方。',
      example: '用老方法解决新问题是刻舟求剑。',
      category: 'fable',
      hsk_level: 4
    },
    // 新增常用成语
    '一马当先': {
      pinyin: 'yī mǎ dāng xiān',
      literal: 'One horse takes the lead',
      meaning_zh: '形容领先、带头，走在最前面',
      meaning_en: 'Take the lead; be in the forefront; be a pioneer',
      story: '这个成语来源于古代战场。在骑兵冲锋时，总有一匹马跑在最前面，带领其他战马向前冲锋。后来用来比喻在工作或行动中走在群众前面，起带头作用。',
      example: '在这次比赛中，他一马当先，第一个冲过终点线。',
      category: 'history',
      hsk_level: 4
    },
    '胸有成竹': {
      pinyin: 'xiōng yǒu chéng zhú',
      literal: 'Have a bamboo in one\'s chest',
      meaning_zh: '比喻做事之前已有完整的计划和把握',
      meaning_en: 'Have a well-thought-out plan; be fully prepared',
      story: '宋朝有个画家叫文同，特别擅长画竹子。他经常观察竹子的生长，对竹子的形态了如指掌。每次画竹之前，心中已经有了完整的竹子形象。朋友问他秘诀，他说画竹之前要"胸有成竹"。',
      example: '面对这次考试，他胸有成竹，一点都不紧张。',
      category: 'art',
      hsk_level: 4
    },
    '半途而废': {
      pinyin: 'bàn tú ér fèi',
      literal: 'Give up halfway',
      meaning_zh: '比喻事情没做完就停止了，不能善始善终',
      meaning_en: 'Give up halfway; leave something unfinished',
      story: '东汉时期，有个叫乐羊子的人外出求学。一年后他回家了，妻子问为什么这么快就回来。他说想家了。妻子拿起剪刀把织了一半的布剪断，说学习和织布一样，半途而废就什么都没有了。乐羊子深受触动，继续求学七年才回家。',
      example: '学习不能半途而废，要坚持到底。',
      category: 'history',
      hsk_level: 3
    },
    '井底之蛙': {
      pinyin: 'jǐng dǐ zhī wā',
      literal: 'A frog at the bottom of a well',
      meaning_zh: '比喻见识狭窄的人',
      meaning_en: 'A person with limited outlook; narrow-minded',
      story: '一只青蛙住在井里，觉得井就是整个世界。一天，一只海龟来访，告诉它大海有多么广阔。青蛙不相信，因为它从来没有离开过井。这个故事告诉我们不要像井底之蛙一样目光短浅。',
      example: '你要多出去看看，不要做井底之蛙。',
      category: 'fable',
      hsk_level: 4
    },
    '画蛇添足': {
      pinyin: 'huà shé tiān zú',
      literal: 'Draw a snake and add feet to it',
      meaning_zh: '比喻做多余的事，反而弄巧成拙',
      meaning_en: 'Ruin something by adding unnecessary details; gild the lily',
      story: '古时候有几个人分一壶酒，酒不够大家喝。有人提议画蛇比赛，谁先画完谁喝酒。一人很快画完了，见别人还没画完，就给蛇添上了脚。这时另一人画完了说："蛇本来没有脚，你画的不是蛇。"于是他喝了酒。',
      example: '文章已经很好了，再加这段话就是画蛇添足。',
      category: 'fable',
      hsk_level: 4
    },
    '愚公移山': {
      pinyin: 'yú gōng yí shān',
      literal: 'The foolish old man who moved mountains',
      meaning_zh: '比喻坚持不懈地改造自然或坚定不移地进行斗争',
      meaning_en: 'Perseverance can overcome any obstacle; where there is a will, there is a way',
      story: '古时候有位老人叫愚公，他家门前有两座大山挡住了出路。愚公决定带领全家人挖山。有人嘲笑他，他说："我死了有儿子，儿子死了有孙子，子子孙孙无穷无尽，总有一天能挖完。"天帝被他感动，派神仙把山移走了。',
      example: '只要有愚公移山的精神，再大的困难也能克服。',
      category: 'fable',
      hsk_level: 4
    },
    '叶公好龙': {
      pinyin: 'yè gōng hào lóng',
      literal: 'Lord Ye\'s love of dragons',
      meaning_zh: '比喻口头上说喜欢某事物，实际上并不真正喜欢',
      meaning_en: 'Professed love of what one actually fears; pretend to like something',
      story: '古代有个叫叶公的人，到处说自己有多喜欢龙，家里的墙上、柱子上、门窗上都画满了龙。天上的真龙听说后很感动，就飞到他家拜访。叶公一看见真龙，吓得魂飞魄散，转身就跑。',
      example: '他说喜欢冒险，遇到危险却吓跑了，真是叶公好龙。',
      category: 'fable',
      hsk_level: 5
    },
    '杞人忧天': {
      pinyin: 'qǐ rén yōu tiān',
      literal: 'A man from Qi worries about the sky falling',
      meaning_zh: '比喻不必要的忧虑',
      meaning_en: 'Unnecessary anxiety; worry about things that won\'t happen',
      story: '古代杞国有个人，整天担心天会塌下来，地会陷下去。他因此吃不下饭，睡不着觉。有人开导他说天是气体积聚而成，不会塌下来；地是土块积聚而成，不会陷下去。他这才放下心来。',
      example: '不用杞人忧天，事情没你想得那么糟糕。',
      category: 'fable',
      hsk_level: 5
    },
    '破釜沉舟': {
      pinyin: 'pò fǔ chén zhōu',
      literal: 'Break the cauldrons and sink the boats',
      meaning_zh: '比喻下定决心，不留退路',
      meaning_en: 'Burn one\'s bridges; show determination to fight to the end',
      story: '秦朝末年，项羽率军渡河攻打秦军。过河后，他下令把船沉掉，把锅砸碎，每人只带三天的粮食。士兵们知道没有退路，只能拼死一战。最终他们以少胜多，打败了秦军。',
      example: '这次创业我破釜沉舟，一定要成功。',
      category: 'history',
      hsk_level: 5
    },
    '纸上谈兵': {
      pinyin: 'zhǐ shàng tán bīng',
      literal: 'Discuss military tactics on paper',
      meaning_zh: '比喻空谈理论，不能解决实际问题',
      meaning_en: 'Armchair strategist; all theory and no practice',
      story: '战国时期赵国将军赵奢有个儿子叫赵括，从小熟读兵书，谈起兵法头头是道。赵奢却说他只会纸上谈兵。后来赵括果然被秦国打败，四十万大军全军覆没。',
      example: '光说不练是纸上谈兵，要动手去做才行。',
      category: 'history',
      hsk_level: 4
    },
    '一劳永逸': {
      pinyin: 'yī láo yǒng yì',
      literal: 'One effort, forever at ease',
      meaning_zh: '辛苦一次，把事情办好，以后就可以不再费力了',
      meaning_en: 'Get something done once and for all; a one-time effort for lasting benefit',
      story: '这个成语出自东汉班固的《封燕然山铭》。意思是经过一次努力，就能获得长久的安逸。后来用来形容一次付出辛劳，就能长期受益，不必再费力。',
      example: '买一台好电脑虽然贵，但一劳永逸，不用经常换。',
      category: 'philosophy',
      hsk_level: 4
    },
    '自相矛盾': {
      pinyin: 'zì xiāng máo dùn',
      literal: 'Self-contradicting spear and shield',
      meaning_zh: '比喻自己说话做事前后抵触',
      meaning_en: 'Contradict oneself; be self-contradictory',
      story: '古代有个卖矛和盾的人，先夸他的盾坚固无比，什么矛都刺不穿；又夸他的矛锋利无比，什么盾都能刺穿。有人问：用你的矛刺你的盾会怎样？他无法回答。',
      example: '你刚才说的话自相矛盾，让人无法相信。',
      category: 'fable',
      hsk_level: 4
    },
    '三心二意': {
      pinyin: 'sān xīn èr yì',
      literal: 'Three hearts, two minds',
      meaning_zh: '形容犹豫不决，意志不坚定',
      meaning_en: 'Be of two minds; be indecisive; half-hearted',
      story: '形容一个人做事不专心，想法太多，一会儿想这样，一会儿想那样，没有明确的目标和坚定的决心。',
      example: '学习不能三心二意，要专心致志。',
      category: 'philosophy',
      hsk_level: 3
    },
    '四面楚歌': {
      pinyin: 'sì miàn chǔ gē',
      literal: 'Chu songs from all sides',
      meaning_zh: '比喻陷入四面受敌、孤立无援的困境',
      meaning_en: 'Be besieged on all sides; be isolated and without help',
      story: '楚汉战争末期，项羽被刘邦的军队包围在垓下。夜里，汉军四面唱起楚国的歌谣，项羽以为楚地都已被占领，军心涣散。这就是"四面楚歌"的由来。',
      example: '公司经营困难，竞争对手又多，真是四面楚歌。',
      category: 'history',
      hsk_level: 5
    },
    '五颜六色': {
      pinyin: 'wǔ yán liù sè',
      literal: 'Five colors, six hues',
      meaning_zh: '形容色彩繁多，非常好看',
      meaning_en: 'Colorful; multicolored; of various colors',
      story: '这是一个形容词性成语，用来描述颜色丰富多彩的样子。五和六在这里表示多的意思，形容颜色种类繁多。',
      example: '花园里的花五颜六色，非常漂亮。',
      category: 'nature',
      hsk_level: 2
    },
    '七上八下': {
      pinyin: 'qī shàng bā xià',
      literal: 'Seven up, eight down',
      meaning_zh: '形容心里慌乱不安',
      meaning_en: 'Be agitated; feel unsettled; be on tenterhooks',
      story: '这个成语形象地描述了心情忐忑不安的状态，就像心在上下乱跳一样。常用来形容紧张、担心或焦虑的心情。',
      example: '等待考试成绩时，我心里七上八下的。',
      category: 'philosophy',
      hsk_level: 3
    },
    '九牛一毛': {
      pinyin: 'jiǔ niú yī máo',
      literal: 'One hair from nine oxen',
      meaning_zh: '比喻极大数量中微不足道的一部分',
      meaning_en: 'A drop in the bucket; negligible',
      story: '九头牛身上的一根毛，比喻在庞大的数量中，某一部分显得非常渺小，微不足道。出自汉代司马迁的文章。',
      example: '这点钱对他来说只是九牛一毛。',
      category: 'philosophy',
      hsk_level: 4
    },
    '十全十美': {
      pinyin: 'shí quán shí měi',
      literal: 'Ten complete, ten beautiful',
      meaning_zh: '各方面都非常完美，毫无缺陷',
      meaning_en: 'Perfect in every way; flawless',
      story: '十在中国文化中代表圆满、完整。十全十美形容事物各方面都达到了完美的程度，没有任何缺点或不足。',
      example: '世界上没有十全十美的人，每个人都有缺点。',
      category: 'philosophy',
      hsk_level: 3
    },
    '百发百中': {
      pinyin: 'bǎi fā bǎi zhòng',
      literal: 'A hundred shots, a hundred hits',
      meaning_zh: '形容射箭或打枪准确，每次都命中目标；也比喻做事有把握',
      meaning_en: 'Hit the mark every time; be a crack shot; be sure to succeed',
      story: '春秋时期，楚国有个叫养由基的人，箭术高超，射一百箭能中一百箭。后来用来形容技术非常精准，或者做事非常有把握。',
      example: '他打篮球投篮百发百中，是队里的得分王。',
      category: 'history',
      hsk_level: 4
    },
    '千方百计': {
      pinyin: 'qiān fāng bǎi jì',
      literal: 'A thousand methods, a hundred plans',
      meaning_zh: '想尽各种办法',
      meaning_en: 'By every possible means; try every way possible',
      story: '千和百都表示数量很多，方和计都指方法、计策。这个成语形容为了达到目的，想尽了各种各样的办法。',
      example: '他千方百计想要解决这个问题。',
      category: 'philosophy',
      hsk_level: 4
    },
    '万众一心': {
      pinyin: 'wàn zhòng yī xīn',
      literal: 'Ten thousand people, one heart',
      meaning_zh: '千万人一条心，形容团结一致',
      meaning_en: 'Millions of people all of one mind; united as one',
      story: '这个成语形容众多的人团结一致，齐心协力。常用来描述在困难面前，大家团结一心共同面对。',
      example: '面对灾难，全国人民万众一心，共度难关。',
      category: 'philosophy',
      hsk_level: 4
    },
    '虎虎生威': {
      pinyin: 'hǔ hǔ shēng wēi',
      literal: 'Tiger-like power and vigor',
      meaning_zh: '形容勇猛威武，气势磅礴',
      meaning_en: 'Full of vigor and vitality; showing great power and majesty like a tiger',
      story: '虎是百兽之王，威风凛凛。"虎虎生威"形容人像老虎一样威武雄壮，充满力量和气势。常用来形容人精神抖擞、气势逼人的样子。',
      example: '运动员们个个虎虎生威，准备迎接比赛。',
      category: 'nature',
      hsk_level: 4
    },
    '龙飞凤舞': {
      pinyin: 'lóng fēi fèng wǔ',
      literal: 'Dragons flying and phoenixes dancing',
      meaning_zh: '形容书法笔势有力，灵活舒展，也形容山势蜿蜒',
      meaning_en: 'Lively and vigorous calligraphy; also describes winding mountain ranges',
      story: '龙和凤都是中国传统文化中的神圣动物。"龙飞凤舞"原来形容山势蜿蜒起伏，后来多用来形容书法笔力遒劲，气势奔放。',
      example: '他的书法龙飞凤舞，非常有气势。',
      category: 'art',
      hsk_level: 5
    },
    '马到成功': {
      pinyin: 'mǎ dào chéng gōng',
      literal: 'Success upon arrival of the horse',
      meaning_zh: '形容事情顺利，一开始就取得成功',
      meaning_en: 'Achieve immediate success; win instant success',
      story: '古代战争中，战马一到战场就取得胜利，形容做事顺利，很快就能成功。常用作祝福语。',
      example: '祝你新的一年马到成功！',
      category: 'history',
      hsk_level: 3
    },
    '鹤立鸡群': {
      pinyin: 'hè lì jī qún',
      literal: 'A crane standing among chickens',
      meaning_zh: '比喻一个人的才能或仪表在众人中特别突出',
      meaning_en: 'Stand head and shoulders above others; outstanding among the ordinary',
      story: '鹤身材高大优雅，站在鸡群中格外显眼。比喻一个人在众人中显得特别出众，才华或外貌超群。',
      example: '她在人群中鹤立鸡群，一眼就能认出来。',
      category: 'nature',
      hsk_level: 5
    },
    '画饼充饥': {
      pinyin: 'huà bǐng chōng jī',
      literal: 'Draw a cake to satisfy hunger',
      meaning_zh: '比喻用空想来安慰自己',
      meaning_en: 'Feed on illusions; comfort oneself with false hopes',
      story: '画一个饼来充饥是不可能的。这个成语比喻用空想来安慰自己，或者说用不切实际的办法来解决问题。',
      example: '光想不做是画饼充饥，解决不了问题。',
      category: 'philosophy',
      hsk_level: 5
    },
    '雪中送炭': {
      pinyin: 'xuě zhōng sòng tàn',
      literal: 'Send charcoal in snowy weather',
      meaning_zh: '比喻在别人急需时给予物质上或精神上的帮助',
      meaning_en: 'Provide timely help; help someone in their hour of need',
      story: '下雪天送炭取暖，是最及时的帮助。比喻在别人最困难、最需要帮助的时候伸出援手。与"锦上添花"相对。',
      example: '朋友在我最困难的时候借钱给我，真是雪中送炭。',
      category: 'philosophy',
      hsk_level: 4
    },
    '锦上添花': {
      pinyin: 'jǐn shàng tiān huā',
      literal: 'Add flowers to brocade',
      meaning_zh: '比喻好上加好，美上加美',
      meaning_en: 'Add the finishing touch to something already beautiful; make something even better',
      story: '锦缎已经很美了，再绣上花就更美。比喻在美好的基础上再增添美好的东西。与"雪中送炭"相对。',
      example: '你的建议让这个方案锦上添花。',
      category: 'philosophy',
      hsk_level: 4
    },
    '入乡随俗': {
      pinyin: 'rù xiāng suí sú',
      literal: 'When entering a village, follow its customs',
      meaning_zh: '到一个地方，就顺从当地的习俗',
      meaning_en: 'When in Rome, do as the Romans do',
      story: '进入一个地方就要遵从那里的风俗习惯。这是一种尊重当地文化、适应新环境的态度。',
      example: '出国旅游要入乡随俗，尊重当地文化。',
      category: 'philosophy',
      hsk_level: 4
    },
    '异口同声': {
      pinyin: 'yì kǒu tóng shēng',
      literal: 'Different mouths, same voice',
      meaning_zh: '不同的人说同样的话，形容意见一致',
      meaning_en: 'Speak with one voice; unanimous',
      story: '不同的人发出相同的声音，形容大家的意见或说法完全一致。',
      example: '大家异口同声地赞成这个提议。',
      category: 'philosophy',
      hsk_level: 4
    },
    '前功尽弃': {
      pinyin: 'qián gōng jìn qì',
      literal: 'All previous efforts wasted',
      meaning_zh: '以前的功劳努力全部白费',
      meaning_en: 'All previous efforts wasted; lose all one has gained',
      story: '之前所做的努力和取得的成绩全部付诸东流。常用来告诫人们要坚持到底，不要半途而废。',
      example: '现在放弃的话，就前功尽弃了。',
      category: 'philosophy',
      hsk_level: 5
    },
    '举一反三': {
      pinyin: 'jǔ yī fǎn sān',
      literal: 'From one example, infer three',
      meaning_zh: '从一件事情类推知道许多事情',
      meaning_en: 'Draw inferences from one example; learn by analogy',
      story: '出自《论语》，孔子说："举一隅不以三隅反，则不复也。"意思是教一个角就能推知其他三个角，形容学习能力强，善于类推。',
      example: '学习要举一反三，不能死记硬背。',
      category: 'philosophy',
      hsk_level: 4
    },
    '因材施教': {
      pinyin: 'yīn cái shī jiào',
      literal: 'Teach according to aptitude',
      meaning_zh: '根据学生的不同特点进行教育',
      meaning_en: 'Teach students in accordance with their aptitude',
      story: '这是孔子提出的教育理念，主张根据每个学生的能力和特点来进行针对性的教学，是因材施教的来源。',
      example: '好老师懂得因材施教，让每个学生都能进步。',
      category: 'philosophy',
      hsk_level: 5
    }
  };

  // AI Auto-fill for Chengyu
  const handleAIAutoFill = async () => {
    if (!form.chengyu || form.chengyu.length < 2) {
      setMessage({ type: 'error', text: language === 'zh' ? '请先输入成语！' : 'Please enter a chengyu first!' });
      return;
    }

    // Check if we have it in built-in dictionary first
    const dictEntry = chengyuDictionary[form.chengyu];
    if (dictEntry) {
      setForm(prev => ({
        ...prev,
        ...dictEntry
      }));
      setMessage({ type: 'success', text: '✅ 从内置词典获取成功！' });
      return;
    }

    // Get API config - check multiple possible key fields
    const provider = aiConfig?.ai_provider || aiConfig?.embedding_provider || 'openai';
    let apiKey = null;
    let model = 'gpt-4o-mini';
    let apiUrl = 'https://api.openai.com/v1/chat/completions';

    if (provider === 'openai') {
      apiKey = aiConfig?.openai_api_key || aiConfig?.embedding_api_key;
      model = aiConfig?.openai_model || 'gpt-4o-mini';
    } else if (provider === 'claude' || provider === 'anthropic') {
      apiKey = aiConfig?.claude_api_key;
      model = aiConfig?.claude_model || 'claude-sonnet-4-20250514';
      apiUrl = 'https://api.anthropic.com/v1/messages';
    } else if (provider === 'deepseek') {
      apiKey = aiConfig?.deepseek_api_key || aiConfig?.embedding_api_key;
      model = aiConfig?.deepseek_model || 'deepseek-chat';
      apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    }
    
    // Last fallback: try embedding_api_key if nothing else works
    if (!apiKey && aiConfig?.embedding_api_key) {
      apiKey = aiConfig.embedding_api_key;
      // Detect provider from API key prefix
      if (apiKey.startsWith('sk-ant')) {
        apiUrl = 'https://api.anthropic.com/v1/messages';
        model = 'claude-sonnet-4-20250514';
      } else {
        // Default to OpenAI-compatible (works for DeepSeek too)
        apiUrl = 'https://api.deepseek.com/v1/chat/completions';
        model = 'deepseek-chat';
      }
    }

    if (!apiKey) {
      setMessage({ 
        type: 'error', 
        text: language === 'zh' 
          ? `❌ "${form.chengyu}" 不在内置词典中，且AI未配置。请在"知识库配置"中设置API密钥，或尝试：水滴石穿、画龙点睛、守株待兔、对牛弹琴、亡羊补牢` 
          : '❌ AI not configured! Please set API key in Knowledge Base Settings.' 
      });
      return;
    }

    setAiGenerating(true);
    setMessage({ type: 'info', text: `🤖 AI 正在为 "${form.chengyu}" 生成内容...` });

    try {
      const prompt = `请为成语"${form.chengyu}"提供完整信息，返回JSON格式：

{
  "pinyin": "拼音（带声调，如 yī shí èr niǎo）",
  "literal": "字面意思（英文）",
  "meaning_zh": "中文释义（一句话）",
  "meaning_en": "English meaning",
  "story": "成语故事（100-150字）",
  "example": "例句（中文）",
  "category": "分类：fable/history/philosophy/art/culture/nature 选一个",
  "hsk_level": "推荐HSK等级：1-6的数字"
}

只返回JSON，不要其他文字。`;

      let result;
      
      // Try proxy server first (solves CORS), then fallback to direct call
      const proxyUrl = aiConfig?.proxy_url || 'http://localhost:3001';
      
      console.log('🔍 AI Config:', { provider, model, proxyUrl, hasApiKey: !!apiKey });
      console.log('🚀 Trying proxy server at:', proxyUrl);
      
      try {
        // Try proxy first
        const proxyResponse = await fetch(`${proxyUrl}/api/ai/chengyu`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: provider === 'anthropic' ? 'claude' : provider,
            apiKey,
            model,
            chengyu: form.chengyu
          })
        });
        
        console.log('📡 Proxy response status:', proxyResponse.status);
        
        if (proxyResponse.ok) {
          const proxyData = await proxyResponse.json();
          console.log('✅ Proxy data:', proxyData);
          
          if (proxyData.success && proxyData.data) {
            const parsed = proxyData.data;
            setForm(prev => ({
              ...prev,
              pinyin: parsed.pinyin || prev.pinyin,
              literal: parsed.literal || prev.literal,
              meaning_zh: parsed.meaning_zh || prev.meaning_zh,
              meaning_en: parsed.meaning_en || prev.meaning_en,
              story: parsed.story || prev.story,
              example: parsed.example || prev.example,
              category: parsed.category || prev.category,
              hsk_level: parseInt(parsed.hsk_level) || prev.hsk_level
            }));
            setMessage({ type: 'success', text: '✅ AI 内容生成成功！' });
            setAiGenerating(false);
            return;
          } else if (proxyData.error) {
            throw new Error(proxyData.error);
          }
        } else {
          const errorData = await proxyResponse.json();
          console.error('❌ Proxy error:', errorData);
          throw new Error(errorData.error || `Proxy returned ${proxyResponse.status}`);
        }
      } catch (proxyErr) {
        console.error('❌ Proxy connection failed:', proxyErr.message);
        // If proxy fails, show specific error instead of trying direct call (which will also fail)
        setMessage({ 
          type: 'error', 
          text: `❌ AI 调用失败: ${proxyErr.message}。请确保代理服务器运行中 (localhost:3001)` 
        });
        setAiGenerating(false);
        return;
      }
      
      // Direct API call (may fail due to CORS)
      if (provider === 'claude' || provider === 'anthropic') {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model,
            max_tokens: 2000,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        const data = await response.json();
        result = data.content?.[0]?.text || '';
      } else {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
          })
        });
        const data = await response.json();
        result = data.choices?.[0]?.message?.content || '';
      }

      // Parse JSON
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setForm(prev => ({
          ...prev,
          pinyin: parsed.pinyin || prev.pinyin,
          literal: parsed.literal || prev.literal,
          meaning_zh: parsed.meaning_zh || prev.meaning_zh,
          meaning_en: parsed.meaning_en || prev.meaning_en,
          story: parsed.story || prev.story,
          example: parsed.example || prev.example,
          category: parsed.category || prev.category,
          hsk_level: parseInt(parsed.hsk_level) || prev.hsk_level
        }));
        setMessage({ type: 'success', text: '✅ AI 内容生成成功！' });
      } else {
        throw new Error('Invalid JSON response');
      }
    } catch (err) {
      console.error('AI error:', err);
      // Give helpful error message
      if (err.message === 'Failed to fetch') {
        setMessage({ 
          type: 'error', 
          text: `❌ AI 调用失败 (CORS)。请启动代理服务器: cd ai-proxy-server && npm start` 
        });
      } else {
        setMessage({ type: 'error', text: '❌ AI 生成失败: ' + err.message });
      }
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSave = async () => {
    try {
      if (supabase) {
        if (editItem) {
          await supabase.from(tableMap[activeTab]).update(form).eq('id', editItem.id);
        } else {
          await supabase.from(tableMap[activeTab]).insert([form]);
        }
      }
      setMessage({ type: 'success', text: t.success });
      setShowModal(false);
      loadItems();
    } catch (err) {
      setMessage({ type: 'error', text: t.failed + ': ' + err.message });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t.confirm)) return;
    try {
      if (supabase) {
        await supabase.from(tableMap[activeTab]).delete().eq('id', id);
      }
      setMessage({ type: 'success', text: t.success });
      loadItems();
    } catch (err) {
      setMessage({ type: 'error', text: t.failed });
    }
  };

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>;
  }

  return (
    <div>
      <div className="content-header">
        <h1>{t.title}</h1>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
          {message.text}
          <button onClick={() => setMessage({ type: '', text: '' })} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}>×</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {Object.keys(tableMap).map(tab => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab(tab)}
          >
            {t[tab]}
          </button>
        ))}
      </div>

      {/* Stats and Add button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>{items.length} 条记录</span>
        <button className="btn btn-primary" onClick={() => openModal()}>
          + {t.add}
        </button>
      </div>

      {/* List */}
      <div className="card">
        {items.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>{t.noData}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  {activeTab === 'chengyu' && <><th>{t.chengyuText}</th><th>{t.pinyin}</th><th>{t.category}</th><th>HSK</th></>}
                  {activeTab === 'videos' && <><th>{t.titleZh}</th><th>{t.category}</th><th>{t.duration}</th></>}
                  {activeTab === 'knowledge' && <><th>{t.icon}</th><th>{t.titleZh}</th><th>{t.category}</th></>}
                  {activeTab === 'games' && <><th>Name</th><th>Type</th><th>HSK</th></>}
                  <th>{t.isActive}</th>
                  <th style={{ width: '120px' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    {activeTab === 'chengyu' && (
                      <>
                        <td style={{ fontWeight: '600', fontSize: '1.1rem' }}>{item.chengyu}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{item.pinyin}</td>
                        <td><span className="badge badge-info">{item.category}</span></td>
                        <td><span className="badge">HSK{item.hsk_level}</span></td>
                      </>
                    )}
                    {activeTab === 'videos' && (
                      <>
                        <td>{item.title_zh}</td>
                        <td><span className="badge badge-info">{item.category}</span></td>
                        <td>{item.duration}</td>
                      </>
                    )}
                    {activeTab === 'knowledge' && (
                      <>
                        <td style={{ fontSize: '1.5rem' }}>{item.icon}</td>
                        <td>{item.title_zh}</td>
                        <td><span className="badge badge-info">{item.category}</span></td>
                      </>
                    )}
                    {activeTab === 'games' && (
                      <>
                        <td>{item.name_zh || item.name}</td>
                        <td><span className="badge badge-info">{item.game_type}</span></td>
                        <td>{item.hsk_levels?.join(', ')}</td>
                      </>
                    )}
                    <td>
                      <span className={`badge ${item.is_active ? 'badge-success' : ''}`}>
                        {item.is_active ? '✓' : '✗'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => openModal(item)}>✏️</button>
                        <button className="btn btn-outline btn-sm" onClick={() => handleDelete(item.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============ MODAL ============ */}
      {showModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1rem'
          }}
          onClick={() => !aiGenerating && setShowModal(false)}
        >
          <div 
            style={{ 
              backgroundColor: 'var(--card)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '650px',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '1px solid var(--border)'
            }} 
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>
                {editItem ? `✏️ ${t.edit}` : `➕ ${t.add}`} - {t[activeTab]}
              </h2>
              <button 
                onClick={() => setShowModal(false)}
                disabled={aiGenerating}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '1.5rem', 
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '0.5rem',
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            </div>

            {/* ====== CHENGYU FORM ====== */}
            {activeTab === 'chengyu' && (
              <>
                {/* AI Auto-Fill Section - PROMINENT */}
                <div style={{ 
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.1))',
                  border: '2px solid var(--primary)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>🤖</span>
                    <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.1rem' }}>{t.aiAutoFill}</h3>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 1rem' }}>
                    {t.aiAutoFillDesc}
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ 
                        flex: 1,
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        padding: '0.75rem 1rem',
                        textAlign: 'center',
                        letterSpacing: '0.15em',
                        background: 'var(--background)'
                      }}
                      value={form.chengyu || ''} 
                      onChange={e => setForm({...form, chengyu: e.target.value})} 
                      placeholder="输入成语"
                      disabled={aiGenerating}
                    />
                    <button 
                      type="button" 
                      className="btn btn-primary"
                      onClick={handleAIAutoFill}
                      disabled={aiGenerating || !form.chengyu || form.chengyu.length < 2}
                      style={{ 
                        whiteSpace: 'nowrap',
                        padding: '0.75rem 1.5rem',
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        minWidth: '140px',
                        justifyContent: 'center'
                      }}
                    >
                      {aiGenerating ? (
                        <>
                          <span style={{ 
                            width: '16px', 
                            height: '16px', 
                            border: '2px solid rgba(255,255,255,0.3)', 
                            borderTopColor: 'white',
                            borderRadius: '50%', 
                            animation: 'spin 1s linear infinite',
                            display: 'inline-block'
                          }}></span>
                          {t.generating}
                        </>
                      ) : (
                        t.oneClickGenerate
                      )}
                    </button>
                  </div>
                  {/* AI Status indicator */}
                  <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: aiConfig?.openai_api_key || aiConfig?.claude_api_key || aiConfig?.deepseek_api_key || aiConfig?.embedding_api_key ? '#22c55e' : '#ef4444',
                      display: 'inline-block'
                    }}></span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      AI: {aiConfig?.ai_provider === 'claude' ? 'Claude' : aiConfig?.ai_provider === 'deepseek' || aiConfig?.embedding_provider === 'deepseek' ? 'DeepSeek' : 'OpenAI'}
                      {' · '}
                      {aiConfig?.openai_api_key || aiConfig?.claude_api_key || aiConfig?.deepseek_api_key || aiConfig?.embedding_api_key ? '已配置 ✓' : '未配置 ✗'}
                    </span>
                  </div>
                </div>

                {/* Form fields - dimmed during AI generation */}
                <div style={{ opacity: aiGenerating ? 0.5 : 1, pointerEvents: aiGenerating ? 'none' : 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">{t.pinyin}</label>
                      <input className="form-input" value={form.pinyin || ''} onChange={e => setForm({...form, pinyin: e.target.value})} placeholder="yī shí èr niǎo" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">{t.literal}</label>
                      <input className="form-input" value={form.literal || ''} onChange={e => setForm({...form, literal: e.target.value})} placeholder="Literal meaning" />
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">{t.meaningZh}</label>
                      <textarea className="form-textarea" rows={2} value={form.meaning_zh || ''} onChange={e => setForm({...form, meaning_zh: e.target.value})} placeholder="中文释义" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">{t.meaningEn}</label>
                      <textarea className="form-textarea" rows={2} value={form.meaning_en || ''} onChange={e => setForm({...form, meaning_en: e.target.value})} placeholder="English meaning" />
                    </div>
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label">{t.story}</label>
                    <textarea className="form-textarea" rows={3} value={form.story || ''} onChange={e => setForm({...form, story: e.target.value})} placeholder="成语故事..." />
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label">{t.example}</label>
                    <input className="form-input" value={form.example || ''} onChange={e => setForm({...form, example: e.target.value})} placeholder="例句" />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">{t.category}</label>
                      <select className="form-select" value={form.category || 'fable'} onChange={e => setForm({...form, category: e.target.value})}>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">{t.hskLevel}</label>
                      <select className="form-select" value={form.hsk_level || 3} onChange={e => setForm({...form, hsk_level: parseInt(e.target.value)})}>
                        {[1,2,3,4,5,6].map(l => <option key={l} value={l}>HSK {l}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">{t.isActive}</label>
                      <select className="form-select" value={form.is_active ? 'yes' : 'no'} onChange={e => setForm({...form, is_active: e.target.value === 'yes'})}>
                        <option value="yes">✓ 启用</option>
                        <option value="no">✗ 禁用</option>
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ====== VIDEO FORM ====== */}
            {activeTab === 'videos' && (
              <div>
                <div className="form-group">
                  <label className="form-label">{t.titleZh} *</label>
                  <input className="form-input" value={form.title_zh || ''} onChange={e => setForm({...form, title_zh: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t.titleEn}</label>
                  <input className="form-input" value={form.title_en || ''} onChange={e => setForm({...form, title_en: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t.videoUrl} *</label>
                  <input className="form-input" value={form.video_url || ''} onChange={e => setForm({...form, video_url: e.target.value})} placeholder="https://..." />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">{t.category}</label>
                    <select className="form-select" value={form.category || 'culture'} onChange={e => setForm({...form, category: e.target.value})}>
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.duration}</label>
                    <input className="form-input" value={form.duration || ''} onChange={e => setForm({...form, duration: e.target.value})} placeholder="5:30" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t.description}</label>
                  <textarea className="form-textarea" rows={2} value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} />
                </div>
              </div>
            )}

            {/* ====== KNOWLEDGE FORM ====== */}
            {activeTab === 'knowledge' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">{t.icon}</label>
                    <input className="form-input" style={{ fontSize: '1.5rem', textAlign: 'center' }} value={form.icon || '📖'} onChange={e => setForm({...form, icon: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.titleZh} *</label>
                    <input className="form-input" value={form.title_zh || ''} onChange={e => setForm({...form, title_zh: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t.titleEn}</label>
                  <input className="form-input" value={form.title_en || ''} onChange={e => setForm({...form, title_en: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t.content}</label>
                  <textarea className="form-textarea" rows={4} value={form.content || ''} onChange={e => setForm({...form, content: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t.category}</label>
                  <select className="form-select" value={form.category || 'culture'} onChange={e => setForm({...form, category: e.target.value})}>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* ====== GAMES FORM ====== */}
            {activeTab === 'games' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Name (EN)</label>
                    <input className="form-input" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">名称 (中文)</label>
                    <input className="form-input" value={form.name_zh || ''} onChange={e => setForm({...form, name_zh: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Game Type</label>
                  <select className="form-select" value={form.game_type || 'matching'} onChange={e => setForm({...form, game_type: e.target.value})}>
                    <option value="matching">Matching</option>
                    <option value="quiz">Quiz</option>
                    <option value="memory">Memory</option>
                    <option value="puzzle">Puzzle</option>
                  </select>
                </div>
              </div>
            )}

            {/* Save / Cancel Buttons */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => setShowModal(false)}
                disabled={aiGenerating}
              >
                {t.cancel}
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                onClick={handleSave}
                disabled={aiGenerating}
              >
                ✓ {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default CultureManagementPage;
