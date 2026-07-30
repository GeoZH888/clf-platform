// src/data/radicalsData.js
// 偏旁部首 dataset — radical glyph + its 读音 (pronunciation) + 名称 + meaning + example characters.
//
// Field notes:
//   r        radical glyph as written in a compound character (e.g. 氵)
//   py       pronunciation of the radical (tone-marked) — this is what the 读音 drill tests
//   read     standalone character with the same reading, used as a TTS fallback when the
//            bare radical form has no reliable voice (氵 alone is not pronounceable by TTS)
//   name_*   the traditional Chinese name of the radical (三点水, "three drops of water")
//   mean_*   what the radical means / what family of characters it marks
//   eg       example characters: { c: char, p: pinyin, zh/en/it: gloss,
//                                  x: other radicals FROM THIS SET the char also contains }
//
// `x` matters: the "which character uses this radical?" drill picks distractors from other
// radicals' example lists, and a distractor is only safe if it does NOT also contain the
// radical being asked about. 明 holds both 日 and 月, so it would be a valid answer twice.

export const RADICALS = [
  { r:'亻', py:'rén', read:'人', name_zh:'单人旁', name_en:'side-person', name_it:'uomo laterale',
    mean_zh:'人', mean_en:'person', mean_it:'persona',
    eg:[{c:'你',p:'nǐ',zh:'你',en:'you',it:'tu'},
        {c:'他',p:'tā',zh:'他',en:'he',it:'lui'},
        {c:'休',p:'xiū',zh:'休息',en:'to rest',it:'riposare',x:'木'}] },

  { r:'刂', py:'dāo', read:'刀', name_zh:'立刀旁', name_en:'standing knife', name_it:'coltello verticale',
    mean_zh:'刀·切割', mean_en:'knife, cutting', mean_it:'coltello, tagliare',
    eg:[{c:'到',p:'dào',zh:'到达',en:'to arrive',it:'arrivare'},
        {c:'别',p:'bié',zh:'别的',en:'other',it:'altro',x:'口力'},
        {c:'刻',p:'kè',zh:'雕刻',en:'to carve',it:'incidere'}] },

  { r:'冫', py:'bīng', read:'冰', name_zh:'两点水', name_en:'two drops of ice', name_it:'due gocce di ghiaccio',
    mean_zh:'冰·寒冷', mean_en:'ice, cold', mean_it:'ghiaccio, freddo',
    eg:[{c:'冷',p:'lěng',zh:'冷',en:'cold',it:'freddo'},
        {c:'冰',p:'bīng',zh:'冰',en:'ice',it:'ghiaccio'},
        {c:'冻',p:'dòng',zh:'冻结',en:'to freeze',it:'congelare'}] },

  { r:'讠', py:'yán', read:'言', name_zh:'言字旁', name_en:'speech radical', name_it:'radicale della parola',
    mean_zh:'说话·语言', mean_en:'speech, language', mean_it:'parola, lingua',
    eg:[{c:'说',p:'shuō',zh:'说话',en:'to speak',it:'parlare',x:'口'},
        {c:'请',p:'qǐng',zh:'请',en:'please, to invite',it:'per favore'},
        {c:'语',p:'yǔ',zh:'语言',en:'language',it:'lingua',x:'口'}] },

  { r:'阝', py:'fù', read:'阜', name_zh:'左耳旁', name_en:'left ear (mound)', name_it:'orecchio sinistro',
    mean_zh:'山丘·地形', mean_en:'mound, hill, terrain', mean_it:'collina, terreno',
    eg:[{c:'阳',p:'yáng',zh:'太阳',en:'sun, yang',it:'sole',x:'日'},
        {c:'院',p:'yuàn',zh:'院子',en:'courtyard',it:'cortile',x:'宀'},
        {c:'阴',p:'yīn',zh:'阴天',en:'shade, yin',it:'ombra',x:'月'}] },

  { r:'扌', py:'shǒu', read:'手', name_zh:'提手旁', name_en:'hand radical', name_it:'radicale della mano',
    mean_zh:'手·动作', mean_en:'hand, action done by hand', mean_it:'mano, azione manuale',
    eg:[{c:'打',p:'dǎ',zh:'打',en:'to hit',it:'colpire'},
        {c:'抱',p:'bào',zh:'拥抱',en:'to hug',it:'abbracciare'},
        {c:'提',p:'tí',zh:'提起',en:'to lift',it:'sollevare',x:'日'}] },

  { r:'氵', py:'shuǐ', read:'水', name_zh:'三点水', name_en:'three drops of water', name_it:"tre gocce d'acqua",
    mean_zh:'水·液体', mean_en:'water, liquid', mean_it:'acqua, liquido',
    eg:[{c:'河',p:'hé',zh:'河流',en:'river',it:'fiume',x:'口'},
        {c:'海',p:'hǎi',zh:'大海',en:'sea',it:'mare'},
        {c:'洗',p:'xǐ',zh:'洗',en:'to wash',it:'lavare'}] },

  { r:'忄', py:'xīn', read:'心', name_zh:'竖心旁', name_en:'upright heart', name_it:'cuore verticale',
    mean_zh:'心情·感受', mean_en:'feeling, emotion', mean_it:'sentimento, emozione',
    eg:[{c:'快',p:'kuài',zh:'快',en:'fast, happy',it:'veloce'},
        {c:'慢',p:'màn',zh:'慢',en:'slow',it:'lento',x:'日'},
        {c:'情',p:'qíng',zh:'感情',en:'emotion',it:'emozione'}] },

  { r:'宀', py:'mián', read:'', name_zh:'宝盖头', name_en:'roof radical', name_it:'radicale del tetto',
    mean_zh:'房屋', mean_en:'house, roof', mean_it:'casa, tetto',
    eg:[{c:'家',p:'jiā',zh:'家',en:'home',it:'casa'},
        {c:'安',p:'ān',zh:'安全',en:'safe',it:'sicuro',x:'女'},
        {c:'客',p:'kè',zh:'客人',en:'guest',it:'ospite',x:'口'}] },

  { r:'广', py:'guǎng', read:'广', name_zh:'广字旁', name_en:'shelter radical', name_it:'radicale del riparo',
    mean_zh:'房屋·场所', mean_en:'building, shelter', mean_it:'edificio, riparo',
    eg:[{c:'店',p:'diàn',zh:'商店',en:'shop',it:'negozio',x:'口'},
        {c:'床',p:'chuáng',zh:'床',en:'bed',it:'letto',x:'木'},
        {c:'座',p:'zuò',zh:'座位',en:'seat',it:'posto',x:'土'}] },

  { r:'辶', py:'chuò', read:'', name_zh:'走之底', name_en:'walking radical', name_it:'radicale del cammino',
    mean_zh:'行走·移动', mean_en:'walking, movement', mean_it:'camminare, movimento',
    eg:[{c:'这',p:'zhè',zh:'这个',en:'this',it:'questo'},
        {c:'送',p:'sòng',zh:'送',en:'to send',it:'inviare'},
        {c:'远',p:'yuǎn',zh:'远',en:'far',it:'lontano'}] },

  { r:'土', py:'tǔ', read:'土', name_zh:'提土旁', name_en:'earth radical', name_it:'radicale della terra',
    mean_zh:'土地', mean_en:'earth, soil', mean_it:'terra, suolo',
    eg:[{c:'地',p:'dì',zh:'地方',en:'ground, place',it:'terra, luogo'},
        {c:'场',p:'chǎng',zh:'广场',en:'field, square',it:'piazza'},
        {c:'城',p:'chéng',zh:'城市',en:'city wall, city',it:'città'}] },

  { r:'艹', py:'cǎo', read:'草', name_zh:'草字头', name_en:'grass radical', name_it:'radicale dell\'erba',
    mean_zh:'植物·花草', mean_en:'plants, grass', mean_it:'piante, erba',
    eg:[{c:'花',p:'huā',zh:'花',en:'flower',it:'fiore'},
        {c:'草',p:'cǎo',zh:'草',en:'grass',it:'erba',x:'日'},
        {c:'茶',p:'chá',zh:'茶',en:'tea',it:'tè',x:'木'}] },

  { r:'女', py:'nǚ', read:'女', name_zh:'女字旁', name_en:'woman radical', name_it:'radicale della donna',
    mean_zh:'女性·亲属', mean_en:'woman, family relations', mean_it:'donna, parentela',
    eg:[{c:'妈',p:'mā',zh:'妈妈',en:'mother',it:'mamma',x:'马'},
        {c:'姐',p:'jiě',zh:'姐姐',en:'older sister',it:'sorella maggiore'},
        {c:'好',p:'hǎo',zh:'好',en:'good',it:'buono',x:'子'}] },

  { r:'子', py:'zǐ', read:'子', name_zh:'子字旁', name_en:'child radical', name_it:'radicale del bambino',
    mean_zh:'孩子', mean_en:'child', mean_it:'bambino',
    eg:[{c:'孩',p:'hái',zh:'孩子',en:'child',it:'bambino'},
        {c:'孙',p:'sūn',zh:'孙子',en:'grandchild',it:'nipote'},
        {c:'孤',p:'gū',zh:'孤单',en:'alone, orphaned',it:'solo'}] },

  { r:'纟', py:'sī', read:'丝', name_zh:'绞丝旁', name_en:'silk radical', name_it:'radicale della seta',
    mean_zh:'丝线·纺织', mean_en:'silk, thread, textiles', mean_it:'seta, filo',
    eg:[{c:'红',p:'hóng',zh:'红色',en:'red',it:'rosso'},
        {c:'线',p:'xiàn',zh:'线',en:'thread, line',it:'filo'},
        {c:'给',p:'gěi',zh:'给',en:'to give',it:'dare',x:'口'}] },

  { r:'马', py:'mǎ', read:'马', name_zh:'马字旁', name_en:'horse radical', name_it:'radicale del cavallo',
    mean_zh:'马·骑乘', mean_en:'horse, riding', mean_it:'cavallo',
    eg:[{c:'骑',p:'qí',zh:'骑车',en:'to ride',it:'cavalcare',x:'口'},
        {c:'驴',p:'lǘ',zh:'驴',en:'donkey',it:'asino'},
        {c:'驾',p:'jià',zh:'驾驶',en:'to drive',it:'guidare',x:'力口'}] },

  { r:'口', py:'kǒu', read:'口', name_zh:'口字旁', name_en:'mouth radical', name_it:'radicale della bocca',
    mean_zh:'嘴·说吃', mean_en:'mouth, speaking, eating', mean_it:'bocca, parlare, mangiare',
    eg:[{c:'吃',p:'chī',zh:'吃',en:'to eat',it:'mangiare'},
        {c:'叫',p:'jiào',zh:'叫',en:'to call',it:'chiamare'},
        {c:'唱',p:'chàng',zh:'唱歌',en:'to sing',it:'cantare',x:'日'}] },

  { r:'囗', py:'wéi', read:'围', name_zh:'国字框', name_en:'enclosure radical', name_it:'radicale del recinto',
    mean_zh:'围起来的地方', mean_en:'enclosure, boundary', mean_it:'recinto, confine',
    eg:[{c:'国',p:'guó',zh:'国家',en:'country',it:'paese',x:'王'},
        {c:'园',p:'yuán',zh:'公园',en:'garden',it:'giardino'},
        {c:'图',p:'tú',zh:'图片',en:'picture, map',it:'immagine'}] },

  { r:'巾', py:'jīn', read:'巾', name_zh:'巾字旁', name_en:'cloth radical', name_it:'radicale del tessuto',
    mean_zh:'布·织物', mean_en:'cloth, fabric', mean_it:'stoffa',
    eg:[{c:'帽',p:'mào',zh:'帽子',en:'hat',it:'cappello',x:'日目'},
        {c:'帮',p:'bāng',zh:'帮助',en:'to help',it:'aiutare'},
        {c:'席',p:'xí',zh:'席位',en:'mat, seat',it:'stuoia',x:'广'}] },

  { r:'山', py:'shān', read:'山', name_zh:'山字旁', name_en:'mountain radical', name_it:'radicale della montagna',
    mean_zh:'山·地貌', mean_en:'mountain', mean_it:'montagna',
    eg:[{c:'岛',p:'dǎo',zh:'海岛',en:'island',it:'isola',x:'鸟'},
        {c:'峰',p:'fēng',zh:'山峰',en:'peak',it:'vetta'},
        {c:'岸',p:'àn',zh:'河岸',en:'shore',it:'riva',x:'广'}] },

  { r:'彳', py:'chì', read:'', name_zh:'双人旁', name_en:'step radical', name_it:'radicale del passo',
    mean_zh:'行走·道路', mean_en:'step, road, movement', mean_it:'passo, strada',
    eg:[{c:'很',p:'hěn',zh:'很',en:'very',it:'molto'},
        {c:'往',p:'wǎng',zh:'往前',en:'toward',it:'verso',x:'王'},
        {c:'行',p:'xíng',zh:'行走',en:'to walk, OK',it:'andare'}] },

  { r:'犭', py:'quǎn', read:'犬', name_zh:'反犬旁', name_en:'dog/beast radical', name_it:'radicale dell\'animale',
    mean_zh:'兽类·动物', mean_en:'dog, beast, animal', mean_it:'cane, bestia',
    eg:[{c:'狗',p:'gǒu',zh:'狗',en:'dog',it:'cane',x:'口'},
        {c:'猫',p:'māo',zh:'猫',en:'cat',it:'gatto',x:'艹田'},
        {c:'猪',p:'zhū',zh:'猪',en:'pig',it:'maiale',x:'日'}] },

  { r:'饣', py:'shí', read:'食', name_zh:'食字旁', name_en:'food radical', name_it:'radicale del cibo',
    mean_zh:'食物·吃', mean_en:'food, eating', mean_it:'cibo',
    eg:[{c:'饭',p:'fàn',zh:'米饭',en:'cooked rice, meal',it:'riso, pasto'},
        {c:'饿',p:'è',zh:'饿',en:'hungry',it:'affamato'},
        {c:'饼',p:'bǐng',zh:'饼干',en:'flatbread, biscuit',it:'focaccia'}] },

  { r:'门', py:'mén', read:'门', name_zh:'门字框', name_en:'door radical', name_it:'radicale della porta',
    mean_zh:'门·出入', mean_en:'door, gate', mean_it:'porta',
    eg:[{c:'问',p:'wèn',zh:'问',en:'to ask',it:'chiedere',x:'口'},
        {c:'间',p:'jiān',zh:'房间',en:'between, room',it:'stanza',x:'日'},
        {c:'闭',p:'bì',zh:'关闭',en:'to close',it:'chiudere'}] },

  { r:'王', py:'wáng', read:'王', name_zh:'王字旁', name_en:'jade/king radical', name_it:'radicale della giada',
    mean_zh:'玉石·珍宝', mean_en:'jade, precious stone', mean_it:'giada, pietra preziosa',
    eg:[{c:'玩',p:'wán',zh:'玩',en:'to play',it:'giocare'},
        {c:'现',p:'xiàn',zh:'现在',en:'now, to appear',it:'ora',x:'见'},
        {c:'珠',p:'zhū',zh:'珍珠',en:'pearl, bead',it:'perla',x:'木'}] },

  { r:'木', py:'mù', read:'木', name_zh:'木字旁', name_en:'tree radical', name_it:'radicale dell\'albero',
    mean_zh:'树木·木材', mean_en:'tree, wood', mean_it:'albero, legno',
    eg:[{c:'树',p:'shù',zh:'树',en:'tree',it:'albero',x:'又'},
        {c:'林',p:'lín',zh:'森林',en:'forest',it:'foresta'},
        {c:'桥',p:'qiáo',zh:'桥',en:'bridge',it:'ponte'}] },

  { r:'日', py:'rì', read:'日', name_zh:'日字旁', name_en:'sun radical', name_it:'radicale del sole',
    mean_zh:'太阳·时间', mean_en:'sun, day, time', mean_it:'sole, giorno',
    eg:[{c:'时',p:'shí',zh:'时间',en:'time',it:'tempo'},
        {c:'晚',p:'wǎn',zh:'晚上',en:'evening',it:'sera'},
        {c:'早',p:'zǎo',zh:'早上',en:'early, morning',it:'mattina'}] },

  { r:'月', py:'yuè', read:'月', name_zh:'月字旁', name_en:'moon/flesh radical', name_it:'radicale della luna',
    mean_zh:'月亮·身体部位', mean_en:'moon; also body parts', mean_it:'luna; parti del corpo',
    eg:[{c:'服',p:'fú',zh:'衣服',en:'clothing',it:'vestito'},
        {c:'脸',p:'liǎn',zh:'脸',en:'face',it:'viso'},
        {c:'朋',p:'péng',zh:'朋友',en:'friend',it:'amico'}] },

  { r:'火', py:'huǒ', read:'火', name_zh:'火字旁', name_en:'fire radical', name_it:'radicale del fuoco',
    mean_zh:'火·燃烧', mean_en:'fire, burning', mean_it:'fuoco',
    eg:[{c:'烧',p:'shāo',zh:'烧',en:'to burn',it:'bruciare'},
        {c:'灯',p:'dēng',zh:'灯',en:'lamp',it:'lampada'},
        {c:'炒',p:'chǎo',zh:'炒菜',en:'to stir-fry',it:'saltare in padella'}] },

  { r:'灬', py:'huǒ', read:'火', name_zh:'四点底', name_en:'four dots (fire)', name_it:'quattro punti (fuoco)',
    mean_zh:'火·加热', mean_en:'fire underneath, heating', mean_it:'fuoco sotto, riscaldare',
    eg:[{c:'煮',p:'zhǔ',zh:'煮',en:'to boil',it:'bollire',x:'日'},
        {c:'烹',p:'pēng',zh:'烹饪',en:'to cook',it:'cucinare'},
        {c:'焦',p:'jiāo',zh:'焦',en:'burnt',it:'bruciato'}] },

  { r:'礻', py:'shì', read:'示', name_zh:'示字旁', name_en:'spirit/altar radical', name_it:'radicale dell\'altare',
    mean_zh:'祭祀·神灵', mean_en:'spirit, ritual, worship', mean_it:'spirito, rito',
    eg:[{c:'神',p:'shén',zh:'神',en:'god, spirit',it:'dio',x:'田'},
        {c:'礼',p:'lǐ',zh:'礼物',en:'ritual, gift',it:'rito, regalo'},
        {c:'祝',p:'zhù',zh:'祝福',en:'to wish, bless',it:'augurare',x:'口'}] },

  { r:'心', py:'xīn', read:'心', name_zh:'心字底', name_en:'heart radical (bottom)', name_it:'cuore (in basso)',
    mean_zh:'心·思想感情', mean_en:'heart, thought, feeling', mean_it:'cuore, pensiero',
    eg:[{c:'念',p:'niàn',zh:'想念',en:'to miss, recite',it:'pensare a'},
        {c:'忘',p:'wàng',zh:'忘记',en:'to forget',it:'dimenticare'},
        {c:'急',p:'jí',zh:'着急',en:'anxious, urgent',it:'ansioso'}] },

  { r:'攵', py:'pū', read:'', name_zh:'反文旁', name_en:'tap/strike radical', name_it:'radicale del colpo',
    mean_zh:'敲打·使动', mean_en:'to strike, to cause action', mean_it:'colpire, causare',
    eg:[{c:'教',p:'jiào',zh:'教',en:'to teach',it:'insegnare',x:'土子'},
        {c:'收',p:'shōu',zh:'收',en:'to collect',it:'raccogliere'},
        {c:'放',p:'fàng',zh:'放',en:'to put, release',it:'mettere'}] },

  { r:'目', py:'mù', read:'目', name_zh:'目字旁', name_en:'eye radical', name_it:'radicale dell\'occhio',
    mean_zh:'眼睛·看', mean_en:'eye, seeing', mean_it:'occhio, vedere',
    eg:[{c:'眼',p:'yǎn',zh:'眼睛',en:'eye',it:'occhio'},
        {c:'睡',p:'shuì',zh:'睡觉',en:'to sleep',it:'dormire'},
        {c:'睛',p:'jīng',zh:'眼睛',en:'eyeball',it:'globo oculare'}] },

  { r:'田', py:'tián', read:'田', name_zh:'田字旁', name_en:'field radical', name_it:'radicale del campo',
    mean_zh:'田地·农耕', mean_en:'field, farming', mean_it:'campo, agricoltura',
    eg:[{c:'男',p:'nán',zh:'男人',en:'man',it:'uomo',x:'力'},
        {c:'画',p:'huà',zh:'画画',en:'to draw',it:'disegnare'},
        {c:'界',p:'jiè',zh:'世界',en:'boundary, world',it:'confine, mondo'}] },

  { r:'石', py:'shí', read:'石', name_zh:'石字旁', name_en:'stone radical', name_it:'radicale della pietra',
    mean_zh:'石头·坚硬', mean_en:'stone, hardness', mean_it:'pietra, durezza',
    eg:[{c:'硬',p:'yìng',zh:'硬',en:'hard',it:'duro',x:'日'},
        {c:'碗',p:'wǎn',zh:'碗',en:'bowl',it:'ciotola',x:'宀'},
        {c:'破',p:'pò',zh:'破',en:'broken',it:'rotto'}] },

  { r:'禾', py:'hé', read:'禾', name_zh:'禾木旁', name_en:'grain radical', name_it:'radicale del grano',
    mean_zh:'谷物·庄稼', mean_en:'grain, crops', mean_it:'grano, raccolto',
    eg:[{c:'种',p:'zhòng',zh:'种植',en:'to plant, seed',it:'piantare'},
        {c:'秒',p:'miǎo',zh:'秒',en:'second (time)',it:'secondo'},
        {c:'稻',p:'dào',zh:'水稻',en:'rice plant',it:'riso (pianta)'}] },

  { r:'穴', py:'xué', read:'穴', name_zh:'穴宝盖', name_en:'cave radical', name_it:'radicale della grotta',
    mean_zh:'洞穴·空间', mean_en:'cave, hole, space', mean_it:'grotta, cavità',
    eg:[{c:'空',p:'kōng',zh:'空',en:'empty, sky',it:'vuoto'},
        {c:'窗',p:'chuāng',zh:'窗户',en:'window',it:'finestra'},
        {c:'穿',p:'chuān',zh:'穿',en:'to wear, pierce',it:'indossare'}] },

  { r:'立', py:'lì', read:'立', name_zh:'立字旁', name_en:'stand radical', name_it:'radicale dello stare in piedi',
    mean_zh:'站立', mean_en:'to stand', mean_it:'stare in piedi',
    eg:[{c:'站',p:'zhàn',zh:'车站',en:'to stand, station',it:'stazione',x:'口'},
        {c:'端',p:'duān',zh:'端正',en:'to hold level, upright',it:'reggere, retto',x:'山'},
        {c:'竞',p:'jìng',zh:'竞争',en:'to compete',it:'competere',x:'口'}] },

  { r:'竹', py:'zhú', read:'竹', name_zh:'竹字头', name_en:'bamboo radical', name_it:'radicale del bambù',
    mean_zh:'竹子·竹制品', mean_en:'bamboo, bamboo objects', mean_it:'bambù',
    eg:[{c:'笑',p:'xiào',zh:'笑',en:'to laugh',it:'ridere'},
        {c:'笔',p:'bǐ',zh:'笔',en:'pen, brush',it:'penna'},
        {c:'笛',p:'dí',zh:'笛子',en:'flute',it:'flauto'}] },

  { r:'米', py:'mǐ', read:'米', name_zh:'米字旁', name_en:'rice radical', name_it:'radicale del riso',
    mean_zh:'米·粮食', mean_en:'rice, grain food', mean_it:'riso, cereali',
    eg:[{c:'粉',p:'fěn',zh:'面粉',en:'powder, flour',it:'polvere, farina'},
        {c:'糖',p:'táng',zh:'糖',en:'sugar',it:'zucchero',x:'广口'},
        {c:'粥',p:'zhōu',zh:'粥',en:'porridge',it:'zuppa di riso'}] },

  { r:'衤', py:'yī', read:'衣', name_zh:'衣字旁', name_en:'clothing radical', name_it:'radicale del vestito',
    mean_zh:'衣服·布料', mean_en:'clothing, garments', mean_it:'vestiti',
    eg:[{c:'衬',p:'chèn',zh:'衬衫',en:'shirt lining',it:'camicia'},
        {c:'裤',p:'kù',zh:'裤子',en:'trousers',it:'pantaloni',x:'广车'},
        {c:'袜',p:'wà',zh:'袜子',en:'socks',it:'calzini',x:'木'}] },

  { r:'疒', py:'nè', read:'', name_zh:'病字旁', name_en:'sickness radical', name_it:'radicale della malattia',
    mean_zh:'疾病', mean_en:'illness, disease', mean_it:'malattia',
    eg:[{c:'病',p:'bìng',zh:'生病',en:'illness',it:'malattia'},
        {c:'疼',p:'téng',zh:'疼',en:'to ache',it:'dolere'},
        {c:'痛',p:'tòng',zh:'痛苦',en:'pain',it:'dolore'}] },

  { r:'虫', py:'chóng', read:'虫', name_zh:'虫字旁', name_en:'insect radical', name_it:'radicale dell\'insetto',
    mean_zh:'昆虫·爬虫', mean_en:'insect, reptile', mean_it:'insetto, rettile',
    eg:[{c:'蚂',p:'mǎ',zh:'蚂蚁',en:'ant (蚂蚁)',it:'formica',x:'马'},
        {c:'蝴',p:'hú',zh:'蝴蝶',en:'butterfly (蝴蝶)',it:'farfalla',x:'月口'},
        {c:'蜂',p:'fēng',zh:'蜜蜂',en:'bee',it:'ape'}] },

  { r:'贝', py:'bèi', read:'贝', name_zh:'贝字旁', name_en:'shell/money radical', name_it:'radicale della conchiglia',
    mean_zh:'钱财·贸易', mean_en:'shell — money, wealth, trade', mean_it:'denaro, ricchezza',
    eg:[{c:'财',p:'cái',zh:'财富',en:'wealth',it:'ricchezza'},
        {c:'货',p:'huò',zh:'货物',en:'goods',it:'merce',x:'亻'},
        {c:'贵',p:'guì',zh:'贵',en:'expensive',it:'costoso'}] },

  { r:'见', py:'jiàn', read:'见', name_zh:'见字旁', name_en:'see radical', name_it:'radicale del vedere',
    mean_zh:'看见', mean_en:'to see, perceive', mean_it:'vedere',
    eg:[{c:'观',p:'guān',zh:'观看',en:'to observe',it:'osservare',x:'又'},
        {c:'觉',p:'jué',zh:'感觉',en:'to feel, sense',it:'sentire'},
        {c:'视',p:'shì',zh:'电视',en:'to look at, vision',it:'vista',x:'礻'}] },

  { r:'车', py:'chē', read:'车', name_zh:'车字旁', name_en:'vehicle radical', name_it:'radicale del veicolo',
    mean_zh:'车辆·运输', mean_en:'vehicle, transport', mean_it:'veicolo, trasporto',
    eg:[{c:'轮',p:'lún',zh:'车轮',en:'wheel',it:'ruota'},
        {c:'转',p:'zhuǎn',zh:'转弯',en:'to turn',it:'girare'},
        {c:'较',p:'jiào',zh:'比较',en:'to compare',it:'confrontare'}] },

  { r:'足', py:'zú', read:'足', name_zh:'足字旁', name_en:'foot radical', name_it:'radicale del piede',
    mean_zh:'脚·走跑', mean_en:'foot, walking, running', mean_it:'piede, correre',
    eg:[{c:'跑',p:'pǎo',zh:'跑步',en:'to run',it:'correre'},
        {c:'跳',p:'tiào',zh:'跳',en:'to jump',it:'saltare'},
        {c:'路',p:'lù',zh:'路',en:'road',it:'strada',x:'口'}] },

  { r:'钅', py:'jīn', read:'金', name_zh:'金字旁', name_en:'metal radical', name_it:'radicale del metallo',
    mean_zh:'金属', mean_en:'metal', mean_it:'metallo',
    eg:[{c:'银',p:'yín',zh:'银行',en:'silver',it:'argento'},
        {c:'钱',p:'qián',zh:'钱',en:'money',it:'denaro'},
        {c:'铁',p:'tiě',zh:'铁',en:'iron',it:'ferro'}] },

  { r:'雨', py:'yǔ', read:'雨', name_zh:'雨字头', name_en:'rain radical', name_it:'radicale della pioggia',
    mean_zh:'天气·降水', mean_en:'rain, weather', mean_it:'pioggia, tempo',
    eg:[{c:'雪',p:'xuě',zh:'雪',en:'snow',it:'neve'},
        {c:'雷',p:'léi',zh:'雷',en:'thunder',it:'tuono',x:'田'},
        {c:'需',p:'xū',zh:'需要',en:'to need',it:'avere bisogno'}] },

  { r:'鱼', py:'yú', read:'鱼', name_zh:'鱼字旁', name_en:'fish radical', name_it:'radicale del pesce',
    mean_zh:'鱼类', mean_en:'fish', mean_it:'pesce',
    eg:[{c:'鲜',p:'xiān',zh:'新鲜',en:'fresh',it:'fresco'},
        {c:'鲤',p:'lǐ',zh:'鲤鱼',en:'carp',it:'carpa',x:'田土'},
        {c:'鲸',p:'jīng',zh:'鲸鱼',en:'whale',it:'balena',x:'口'}] },

  { r:'鸟', py:'niǎo', read:'鸟', name_zh:'鸟字旁', name_en:'bird radical', name_it:'radicale dell\'uccello',
    mean_zh:'鸟类', mean_en:'bird', mean_it:'uccello',
    eg:[{c:'鸡',p:'jī',zh:'鸡',en:'chicken',it:'pollo',x:'又'},
        {c:'鸭',p:'yā',zh:'鸭子',en:'duck',it:'anatra',x:'田'},
        {c:'鹅',p:'é',zh:'鹅',en:'goose',it:'oca'}] },

  { r:'页', py:'yè', read:'页', name_zh:'页字旁', name_en:'head/page radical', name_it:'radicale della testa',
    mean_zh:'头部', mean_en:'head; also page', mean_it:'testa; pagina',
    eg:[{c:'顶',p:'dǐng',zh:'顶',en:'top, peak',it:'cima'},
        {c:'颜',p:'yán',zh:'颜色',en:'face, colour',it:'colore',x:'立'},
        {c:'题',p:'tí',zh:'题目',en:'topic, question',it:'argomento',x:'日足'}] },

  { r:'力', py:'lì', read:'力', name_zh:'力字旁', name_en:'strength radical', name_it:'radicale della forza',
    mean_zh:'力气·用力', mean_en:'strength, effort', mean_it:'forza, sforzo',
    eg:[{c:'动',p:'dòng',zh:'运动',en:'to move',it:'muovere'},
        {c:'加',p:'jiā',zh:'加上',en:'to add',it:'aggiungere',x:'口'},
        {c:'助',p:'zhù',zh:'帮助',en:'to assist',it:'aiutare'}] },

  { r:'走', py:'zǒu', read:'走', name_zh:'走字旁', name_en:'walk radical', name_it:'radicale del camminare',
    mean_zh:'走·跑', mean_en:'to walk, to run', mean_it:'camminare',
    eg:[{c:'起',p:'qǐ',zh:'起来',en:'to rise',it:'alzarsi'},
        {c:'超',p:'chāo',zh:'超过',en:'to exceed',it:'superare',x:'口'},
        {c:'越',p:'yuè',zh:'超越',en:'to cross over',it:'oltrepassare'}] },

  { r:'又', py:'yòu', read:'又', name_zh:'又字旁', name_en:'right hand radical', name_it:'radicale della mano destra',
    mean_zh:'手·再次', mean_en:'hand; again', mean_it:'mano; di nuovo',
    eg:[{c:'友',p:'yǒu',zh:'朋友',en:'friend',it:'amico'},
        {c:'双',p:'shuāng',zh:'一双',en:'pair',it:'paio'},
        {c:'取',p:'qǔ',zh:'取得',en:'to take',it:'prendere'}] },
];

// Radical glyph → entry, handy for lookups elsewhere (character detail, admin, …)
export const RADICAL_BY_GLYPH = Object.fromEntries(RADICALS.map(r => [r.r, r]));

// Localised accessors — the dataset keeps zh/en/it side by side like pinyinData.
export function radicalName(r, lang) {
  return lang === 'zh' ? r.name_zh : lang === 'it' ? (r.name_it || r.name_en) : r.name_en;
}
export function radicalMeaning(r, lang) {
  return lang === 'zh' ? r.mean_zh : lang === 'it' ? (r.mean_it || r.mean_en) : r.mean_en;
}
export function exampleGloss(e, lang) {
  return lang === 'zh' ? e.zh : lang === 'it' ? (e.it || e.en) : e.en;
}

// Does character `e` also contain radical `glyph`? Used to keep quiz distractors unambiguous.
export function alsoContains(e, glyph) {
  return !!e.x && e.x.includes(glyph);
}
