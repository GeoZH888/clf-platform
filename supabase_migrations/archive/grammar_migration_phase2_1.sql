-- ═══════════════════════════════════════════════════════════════════
--  Phase 2.1 — Grammar content migration
--  Migrates 8 grammar patterns from old Miaohong BUILTIN_PATTERNS
--  into new CLF schema (clf_grammar_topics + clf_grammar_exercises).
--  Also adds ~6 exercises per topic across difficulties 0/1/2.
--
--  Run AFTER grammar_migration.sql (Phase 1).
--  Idempotent: ON CONFLICT (id) DO UPDATE — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- ── TOPICS ────────────────────────────────────────────────────

INSERT INTO clf_grammar_topics (id, title_zh, title_en, title_it, level, order_idx, explanation, examples) VALUES

-- ─────────────────────── Level 2 ───────────────────────

('a_bi_b',
 'A 比 B', 'Comparison with 比', 'Confronto con 比',
 2, 1,
$md$**比字句**用来比较两个事物的差异。

**结构**：A + 比 + B + 形容词 [+ 程度]

**注意**：
- 形容词前**不加"很""非常"**，要加就加在比较的后面（"高一点""高得多"）
- 否定用"**A 没有 B + adj**"或"**A 不如 B + adj**"，不用"不比"
$md$,
'[
  {"zh": "今天比昨天冷。", "pinyin": "Jīntiān bǐ zuótiān lěng.", "en": "Today is colder than yesterday.", "it": "Oggi fa più freddo di ieri."},
  {"zh": "他比我高一点。", "pinyin": "Tā bǐ wǒ gāo yìdiǎn.", "en": "He is a bit taller than me.", "it": "Lui è un po'' più alto di me."},
  {"zh": "这本书比那本有意思得多。", "pinyin": "Zhè běn shū bǐ nà běn yǒuyìsi de duō.", "en": "This book is much more interesting than that one.", "it": "Questo libro è molto più interessante di quello."},
  {"zh": "我没有他聪明。", "pinyin": "Wǒ méi yǒu tā cōngmíng.", "en": "I am not as smart as him.", "it": "Non sono intelligente come lui."}
]'::jsonb),

('shi_de_jiegou',
 '是…的', 'Emphasis: 是…的', 'Enfasi: 是…的',
 2, 2,
$md$**是…的 结构**用来强调**已发生动作**的时间、地点、方式或动作者。

**结构**：主语 + 是 + [时间/地点/方式] + 动词 + 的

**否定**：用"**不是**"（不能去掉"是"）

**区别"是…的"和一般的过去句**：
- 我昨天来的北京 → 只陈述事实
- 我**是**昨天**来的**北京 → 强调"是昨天，不是今天或前天"
$md$,
'[
  {"zh": "我是坐飞机来的。", "pinyin": "Wǒ shì zuò fēijī lái de.", "en": "I came by plane.", "it": "Sono venuto in aereo."},
  {"zh": "她是去年毕业的。", "pinyin": "Tā shì qùnián bìyè de.", "en": "She graduated last year.", "it": "Si è laureata l''anno scorso."},
  {"zh": "这个菜不是我做的。", "pinyin": "Zhège cài bú shì wǒ zuò de.", "en": "I didn''t make this dish.", "it": "Questo piatto non l''ho fatto io."},
  {"zh": "你是什么时候认识他的？", "pinyin": "Nǐ shì shénme shíhou rènshi tā de?", "en": "When did you meet him?", "it": "Quando l''hai conosciuto?"}
]'::jsonb),

('dongci_guo',
 '动词 + 过', 'Experience: verb + 过', 'Esperienza: verbo + 过',
 2, 3,
$md$**动词 + 过**表示**过去曾经**有过某种经历。

**结构**：主语 + 动词 + 过 + (宾语)

**否定**：**没有 + 动词 + 过**（不是"不…过"）

**注意**：
- "过"表示**经历**，不是完成
- 对比："了"表示**发生或完成**，"过"表示**经历过**
- "我吃了北京烤鸭" = 我吃了（刚刚）
- "我吃**过**北京烤鸭" = 我有过吃的经历（不一定最近）
$md$,
'[
  {"zh": "我吃过北京烤鸭。", "pinyin": "Wǒ chī guo Běijīng kǎoyā.", "en": "I have eaten Peking duck.", "it": "Ho mangiato l''anatra alla pechinese."},
  {"zh": "你去过中国吗？", "pinyin": "Nǐ qù guo Zhōngguó ma?", "en": "Have you been to China?", "it": "Sei mai stato in Cina?"},
  {"zh": "我没有看过这个电影。", "pinyin": "Wǒ méi yǒu kàn guo zhège diànyǐng.", "en": "I have not seen this movie.", "it": "Non ho mai visto questo film."},
  {"zh": "她学过三年日语。", "pinyin": "Tā xué guo sān nián Rìyǔ.", "en": "She studied Japanese for three years.", "it": "Ha studiato giapponese per tre anni."}
]'::jsonb),

-- ─────────────────────── Level 3 ───────────────────────

('ba_zi_ju',
 '把字句', 'Disposal: 把 sentence', 'Frase con 把',
 3, 1,
$md$**把字句**把**宾语提到动词之前**，强调对该宾语的**处理或影响**。

**结构**：主语 + 把 + 宾语 + 动词 + 补语/了/结果

**使用条件**：
1. 宾语必须是**特定的**（通常带"这""那"或确指）
2. 动词必须有**结果或补语**（不能是单个光动词）
3. 常见补语：了、完、上、下、给某人、到某处

**错误示例**：
- ✗ 我把苹果吃 → 缺补语
- ✓ 我把苹果吃**完了**

**否定**：把字之前 + 没/不（"我没把书带来"）
$md$,
'[
  {"zh": "请把门关上。", "pinyin": "Qǐng bǎ mén guān shàng.", "en": "Please close the door.", "it": "Per favore chiudi la porta."},
  {"zh": "他把钱包丢了。", "pinyin": "Tā bǎ qiánbāo diū le.", "en": "He lost his wallet.", "it": "Ha perso il portafoglio."},
  {"zh": "你能把这本书给我吗？", "pinyin": "Nǐ néng bǎ zhè běn shū gěi wǒ ma?", "en": "Can you give me this book?", "it": "Mi puoi dare questo libro?"},
  {"zh": "我没把作业做完。", "pinyin": "Wǒ méi bǎ zuòyè zuò wán.", "en": "I didn''t finish the homework.", "it": "Non ho finito i compiti."}
]'::jsonb),

('dongci_zhe',
 '动词 + 着', 'Continuous: verb + 着', 'Continuo: verbo + 着',
 3, 2,
$md$**动词 + 着**表示**动作或状态的持续**。

**两种用法**：
1. **状态持续**：门开着、灯亮着、穿着红衣服
2. **伴随动作**：笑着说、站着看、哭着跑出去（前一个动词是后一个的方式）

**对比"正在"和"着"**：
- 正在：动作**正在进行**中（我**正在**写信）
- 着：状态或伴随动作（他躺**着**看书）
$md$,
'[
  {"zh": "门开着。", "pinyin": "Mén kāi zhe.", "en": "The door is open.", "it": "La porta è aperta."},
  {"zh": "她笑着说话。", "pinyin": "Tā xiào zhe shuōhuà.", "en": "She speaks while smiling.", "it": "Parla sorridendo."},
  {"zh": "他穿着黑色的外套。", "pinyin": "Tā chuān zhe hēisè de wàitào.", "en": "He is wearing a black coat.", "it": "Indossa un cappotto nero."},
  {"zh": "孩子们听着老师讲故事。", "pinyin": "Háizimen tīng zhe lǎoshī jiǎng gùshi.", "en": "The children listen to the teacher telling a story.", "it": "I bambini ascoltano l''insegnante raccontare una storia."}
]'::jsonb),

('yaoshi_jiu',
 '要是…就…', 'Conditional: 要是…就…', 'Condizionale: 要是…就…',
 3, 3,
$md$**要是…就…**表示**条件与结果**。

**结构**：**要是** + 条件句，（主语）**就** + 结果句

**同义词**：如果、假如（书面色彩更强）

**可选简化**：口语中"要是"可以只说一次，"就"也可以省略

**时态**：
- 假设**未发生**的事：用 要是/如果
- 假设**不可能**的事：用 如果…的话，（就）…（带点虚拟语气）
$md$,
'[
  {"zh": "要是明天下雨，我就不去了。", "pinyin": "Yàoshi míngtiān xià yǔ, wǒ jiù bú qù le.", "en": "If it rains tomorrow, I won''t go.", "it": "Se domani piove, non vado."},
  {"zh": "要是你有时间，就来我家吃饭。", "pinyin": "Yàoshi nǐ yǒu shíjiān, jiù lái wǒ jiā chīfàn.", "en": "If you have time, come to my place to eat.", "it": "Se hai tempo, vieni a cena da me."},
  {"zh": "要是我有钱，我就去欧洲旅行。", "pinyin": "Yàoshi wǒ yǒu qián, wǒ jiù qù Ōuzhōu lǚxíng.", "en": "If I had money, I would travel to Europe.", "it": "Se avessi soldi, viaggerei in Europa."},
  {"zh": "要是累了就休息一下。", "pinyin": "Yàoshi lèi le jiù xiūxi yíxià.", "en": "If you''re tired, take a rest.", "it": "Se sei stanco, riposati un po''."}
]'::jsonb),

-- ─────────────────────── Level 4 ───────────────────────

('bei_zi_ju',
 '被字句', 'Passive: 被 sentence', 'Passivo: 被',
 4, 1,
$md$**被字句**表示**被动**关系 — 主语是动作的**承受者**。

**结构**：受事主语 + 被 + (施事者) + 动词 + 了/补语

**特点**：
- 施事者（做动作的人/物）可以省略："蛋糕被吃了"
- 动词通常带**结果或变化**（不能单独用"被 + 光动词"）
- 多用于**不如意的事**（丢、骂、打、吃），中性/好事用"被"较少（但现代汉语已接受）

**否定**：没 + 被（"蛋糕没被吃"）

**同义**：让、叫（口语中代替被，但施事者不能省略）
$md$,
'[
  {"zh": "蛋糕被小狗吃了。", "pinyin": "Dàngāo bèi xiǎo gǒu chī le.", "en": "The cake was eaten by the little dog.", "it": "La torta è stata mangiata dal cagnolino."},
  {"zh": "我的自行车被偷了。", "pinyin": "Wǒ de zìxíngchē bèi tōu le.", "en": "My bicycle was stolen.", "it": "La mia bici è stata rubata."},
  {"zh": "这个问题被他解决了。", "pinyin": "Zhège wèntí bèi tā jiějué le.", "en": "This problem was solved by him.", "it": "Questo problema è stato risolto da lui."},
  {"zh": "窗户被风吹开了。", "pinyin": "Chuānghu bèi fēng chuī kāi le.", "en": "The window was blown open by the wind.", "it": "La finestra è stata aperta dal vento."}
]'::jsonb),

('suiran_danshi',
 '虽然…但是…', 'Concession: 虽然…但是…', 'Concessivo: 虽然…但是…',
 4, 2,
$md$**虽然…但是…**用来表示**让步和转折**。

**结构**：**虽然** + 事实 A，**但是**/可是 + 相反的事实 B

**注意**：
- 不能说"虽然…，所以…"（所以是因果关系）
- "但是"可以替换成"**可是**"（更口语）、"**不过**"（语气较轻）
- 后半句不能没有转折词 — 必须有"但是/可是/不过"之一

**简化**：**但是** + B（省略 虽然）也通，但 A 部分会缺让步感
$md$,
'[
  {"zh": "虽然很难，但是很有意思。", "pinyin": "Suīrán hěn nán, dànshì hěn yǒuyìsi.", "en": "Although it''s hard, it''s interesting.", "it": "Sebbene sia difficile, è interessante."},
  {"zh": "虽然他很累，但是还在工作。", "pinyin": "Suīrán tā hěn lèi, dànshì hái zài gōngzuò.", "en": "Although he''s tired, he''s still working.", "it": "Anche se è stanco, sta ancora lavorando."},
  {"zh": "虽然下雨了，但是我还是出去了。", "pinyin": "Suīrán xià yǔ le, dànshì wǒ háishì chū qù le.", "en": "Although it rained, I still went out.", "it": "Anche se pioveva, sono uscito lo stesso."},
  {"zh": "虽然她不会说中文，可是很想学。", "pinyin": "Suīrán tā bú huì shuō Zhōngwén, kěshì hěn xiǎng xué.", "en": "Although she can''t speak Chinese, she wants to learn.", "it": "Anche se non sa parlare cinese, vuole impararlo."}
]'::jsonb)

ON CONFLICT (id) DO UPDATE SET
  title_zh    = EXCLUDED.title_zh,
  title_en    = EXCLUDED.title_en,
  title_it    = EXCLUDED.title_it,
  level       = EXCLUDED.level,
  order_idx   = EXCLUDED.order_idx,
  explanation = EXCLUDED.explanation,
  examples    = EXCLUDED.examples;


-- ── EXERCISES ─────────────────────────────────────────────────
-- Each topic gets ~6 exercises spread across difficulties 0/1/2.
-- Clear existing exercises for these topics first, so re-running is clean.

DELETE FROM clf_grammar_exercises WHERE topic_id IN (
  'a_bi_b','shi_de_jiegou','dongci_guo','ba_zi_ju','dongci_zhe',
  'yaoshi_jiu','bei_zi_ju','suiran_danshi'
);

-- ─── A 比 B ───
INSERT INTO clf_grammar_exercises (topic_id, type, difficulty, question, options, answer, explanation) VALUES
('a_bi_b', 'fill',   0, '今天 ___ 昨天冷。',                                    NULL,                                                       '比',        '比字句基本结构：A 比 B + 形容词。'),
('a_bi_b', 'choose', 0, '选择正确的：',                                         '["我比你高很","我比你很高","我比你高一点","我很比你高"]'::jsonb, '我比你高一点', '比字句里形容词前不加"很"。程度词放在后面，如"高一点""高得多"。'),
('a_bi_b', 'fill',   1, '这本书 ___ 那本有意思得多。',                          NULL,                                                       '比',        '"比"后面可以加程度补语"得多"。'),
('a_bi_b', 'choose', 1, '"他 ___ 我聪明。"（否定比较）',                       '["不比","没比","没有","不是"]'::jsonb,                       '没有',      '比字句否定用"没有"或"不如"，不用"不比"。'),
('a_bi_b', 'choose', 2, '最自然的句子：',                                       '["我不比他高","我没他高","我不如他高","以上都对"]'::jsonb,     '以上都对',  '否定比较有多种表达："没 + B + adj"、"不如 B + adj"都可以。'),
('a_bi_b', 'fill',   2, '弟弟 ___ 哥哥高一点。',                               NULL,                                                       '比',        '比字句 + 程度词"一点"表示略微差别。');

-- ─── 是…的 ───
INSERT INTO clf_grammar_exercises (topic_id, type, difficulty, question, options, answer, explanation) VALUES
('shi_de_jiegou', 'fill',   0, '我 ___ 坐飞机来 ___。',                            NULL,                                                    '是 的',     '是…的结构：是 + 方式 + 动词 + 的。'),
('shi_de_jiegou', 'choose', 0, '强调时间用：',                                     '["是什么时候...的","什么时候是...的","什么时候...是的","什么时候...的是"]'::jsonb, '是什么时候...的', '"是…的"把疑问词放在"是"后面。'),
('shi_de_jiegou', 'fill',   1, '她 ___ 去年毕业 ___。',                           NULL,                                                    '是 的',     '强调时间用"是…的"。'),
('shi_de_jiegou', 'choose', 1, '否定"这个菜是我做的"：',                          '["这个菜不是我做的","这个菜是我不做的","这个菜是不我做的","以上都不对"]'::jsonb, '这个菜不是我做的', '是…的的否定是"不是"，"的"保留。'),
('shi_de_jiegou', 'fill',   2, '你 ___ 什么时候认识他 ___？',                    NULL,                                                    '是 的',     '疑问句中同样用"是…的"。'),
('shi_de_jiegou', 'choose', 2, '下面哪句强调的是"方式"？',                         '["我昨天坐飞机来","我是坐飞机来的","我坐飞机是来","我来坐飞机的"]'::jsonb, '我是坐飞机来的', '"是 + 方式 + 动词 + 的"专门强调方式。');

-- ─── 动词 + 过 ───
INSERT INTO clf_grammar_exercises (topic_id, type, difficulty, question, options, answer, explanation) VALUES
('dongci_guo', 'fill',   0, '我吃 ___ 北京烤鸭。',                               NULL,                                                    '过',        '"过"表示经历过。'),
('dongci_guo', 'choose', 0, '"你去 ___ 中国吗？"',                               '["过","了","着","的"]'::jsonb,                              '过',        '询问经历用"过"。'),
('dongci_guo', 'fill',   1, '我 ___ 看 ___ 这个电影。（否定）',                   NULL,                                                    '没 过',     '动词+过的否定是"没 + V + 过"。'),
('dongci_guo', 'choose', 1, '"我学 ___ 三年日语"。',                              '["过","了","着","来"]'::jsonb,                              '过',        '"学过三年"表示有过学习的经历。'),
('dongci_guo', 'choose', 2, '"了"和"过"哪个对？"我 ___ 这个电影（去年看）。"',    '["看了","看过","看着","看到"]'::jsonb,                      '看过',      '强调经历用"过"；强调完成用"了"。这里表达的是"有过这个经历"。'),
('dongci_guo', 'fill',   2, '她 ___ 结婚 ___，所以对婚姻有经验。',                NULL,                                                    '结 过',     '"结过婚"表示有过结婚的经历。');

-- ─── 把字句 ───
INSERT INTO clf_grammar_exercises (topic_id, type, difficulty, question, options, answer, explanation) VALUES
('ba_zi_ju', 'fill',   0, '请 ___ 门关上。',                                       NULL,                                                    '把',        '把字句：主 + 把 + 宾 + 动词 + 补语。'),
('ba_zi_ju', 'choose', 0, '哪个句子是正确的把字句？',                              '["我把苹果吃","我把苹果吃了","我吃苹果把","把我吃苹果了"]'::jsonb, '我把苹果吃了', '把字句动词后必须有补语（"了""完""上"等）。'),
('ba_zi_ju', 'fill',   1, '你能 ___ 这本书给我吗？',                              NULL,                                                    '把',        '把字句常与"给"搭配，表示处置后给某人。'),
('ba_zi_ju', 'choose', 1, '哪个是正确的把字句否定？',                              '["我不把作业做完","我没把作业做完","我把不作业做完","我把作业没做完"]'::jsonb, '我没把作业做完', '否定词"没"放在"把"之前。'),
('ba_zi_ju', 'choose', 2, '下面哪句不能改成把字句？',                              '["我吃饭了","我吃了这碗饭","我关了窗户","我完成了作业"]'::jsonb, '我吃饭了',  '"我吃饭了"中宾语"饭"不是特定的，不能用把字句。"我吃了这碗饭"可以→"我把这碗饭吃了"。'),
('ba_zi_ju', 'fill',   2, '他 ___ 钱包丢 ___。',                                  NULL,                                                    '把 了',     '"把…丢了"表达遗失。');

-- ─── 动词 + 着 ───
INSERT INTO clf_grammar_exercises (topic_id, type, difficulty, question, options, answer, explanation) VALUES
('dongci_zhe', 'fill',   0, '门开 ___。',                                          NULL,                                                    '着',        '"着"表示状态持续。'),
('dongci_zhe', 'choose', 0, '"她笑 ___ 说话。"',                                   '["着","了","过","的"]'::jsonb,                              '着',        '"着"表示伴随动作。'),
('dongci_zhe', 'fill',   1, '他穿 ___ 黑色的外套。',                               NULL,                                                    '着',        '穿着 = 正在穿（状态持续）。'),
('dongci_zhe', 'choose', 1, '"着"和"正在"哪个对？"他 ___ 看书（动作在发生）"',    '["正在","着","了","过"]'::jsonb,                            '正在',      '"正在"表示动作正在进行；"着"常表示状态或伴随。'),
('dongci_zhe', 'choose', 2, '哪个句子自然？',                                      '["他躺看书","他躺着看书","他躺了看书","他看书着"]'::jsonb,   '他躺着看书', '"着"表示"躺"的姿势伴随"看书"的主要动作。'),
('dongci_zhe', 'fill',   2, '孩子们听 ___ 老师讲故事。',                           NULL,                                                    '着',        '伴随动作用"着"。');

-- ─── 要是…就… ───
INSERT INTO clf_grammar_exercises (topic_id, type, difficulty, question, options, answer, explanation) VALUES
('yaoshi_jiu', 'fill',   0, '___ 明天下雨，我 ___ 不去了。',                      NULL,                                                    '要是 就',    '要是…就…结构：要是 + 条件，就 + 结果。'),
('yaoshi_jiu', 'choose', 0, '同义词选择：',                                         '["如果","因为","所以","但是"]'::jsonb,                       '如果',      '"要是"和"如果"同义，都表示假设条件。'),
('yaoshi_jiu', 'fill',   1, '要是累 ___ ___ 休息一下。',                           NULL,                                                    '了 就',     '口语中常"要是…了 就…"简化表达条件。'),
('yaoshi_jiu', 'choose', 1, '选择合适的关联词：',                                   '["虽然…但是…","要是…就…","因为…所以…","不但…而且…"]'::jsonb, '要是…就…',   '假设+结果的关系用"要是…就…"。'),
('yaoshi_jiu', 'choose', 2, '哪句"要是…就…"使用错误？',                           '["要是你累了就休息","要是下雨我就带伞","要是你想吃我就做","要是他是老师就学生"]'::jsonb, '要是他是老师就学生', '最后一句语法错误，结果部分不完整。'),
('yaoshi_jiu', 'fill',   2, '___ 我有钱，___ 去欧洲旅行。',                       NULL,                                                    '要是 就',    '典型的"要是…就…"假设+结果结构。');

-- ─── 被字句 ───
INSERT INTO clf_grammar_exercises (topic_id, type, difficulty, question, options, answer, explanation) VALUES
('bei_zi_ju', 'fill',   0, '蛋糕 ___ 小狗吃 ___。',                                NULL,                                                    '被 了',     '被字句：受事 + 被 + 施事 + 动词 + 了。'),
('bei_zi_ju', 'choose', 0, '被字句的结构：',                                        '["主 + 被 + 动词","受事 + 被 + 施事 + 动词","施事 + 被 + 动词","被 + 受事 + 动词"]'::jsonb, '受事 + 被 + 施事 + 动词', '被字句中受事在前，施事（做动作的人）跟在"被"后面。'),
('bei_zi_ju', 'fill',   1, '我的自行车 ___ 偷 ___。（施事省略）',                  NULL,                                                    '被 了',     '被字句可以省略施事者。'),
('bei_zi_ju', 'choose', 1, '"窗户 ___ 风吹开 ___。"',                              '["被/了","把/了","是/的","有/着"]'::jsonb,                   '被/了',     '主语是受动作的对象，使用被字句。'),
('bei_zi_ju', 'choose', 2, '选出错误的被字句：',                                    '["蛋糕被吃了","我被他叫","窗户被风吹开了","问题被他解决了"]'::jsonb, '我被他叫', '被字句动词后需要补语或变化。单个"叫"不够，应说"被他叫醒/叫走"。'),
('bei_zi_ju', 'fill',   2, '这个问题 ___ 他解决 ___。',                            NULL,                                                    '被 了',     '被字句 + 已完成，用"了"。');

-- ─── 虽然…但是… ───
INSERT INTO clf_grammar_exercises (topic_id, type, difficulty, question, options, answer, explanation) VALUES
('suiran_danshi', 'fill',   0, '___ 很难，___ 很有意思。',                        NULL,                                                    '虽然 但是', '虽然…但是…：让步+转折关系。'),
('suiran_danshi', 'choose', 0, '"虽然…___…" 后面应该是：',                          '["所以","但是","因为","和"]'::jsonb,                         '但是',      '"虽然"必须搭配转折词"但是""可是""不过"。'),
('suiran_danshi', 'fill',   1, '虽然他很累，___ 还在工作。',                       NULL,                                                    '但是',      '让步+转折：虽然 A，但是 B。'),
('suiran_danshi', 'choose', 1, '"虽然"的同义替换：',                                '["尽管","因为","虽然","既然"]'::jsonb,                       '尽管',      '"虽然"书面语可以用"尽管"替换。'),
('suiran_danshi', 'choose', 2, '语法错误的句子是：',                                '["虽然下雨了，但是我去了","虽然她不会中文，所以想学","虽然累但是快乐","虽然贵可是好"]'::jsonb, '虽然她不会中文，所以想学', '虽然…不能配"所以"。应改为"虽然…但是想学"。'),
('suiran_danshi', 'fill',   2, '虽然她不会说中文，___ 很想学。',                   NULL,                                                    '可是',      '"可是"是"但是"的口语替换，表达转折。');


-- ─────────────────────── Verify ───────────────────────

DO $$
DECLARE
  topic_count int;
  ex_count int;
BEGIN
  SELECT COUNT(*) INTO topic_count FROM clf_grammar_topics;
  SELECT COUNT(*) INTO ex_count FROM clf_grammar_exercises;
  RAISE NOTICE 'Grammar topics: %, exercises: %', topic_count, ex_count;
END $$;

NOTIFY pgrst, 'reload schema';
