# ChengyuAdminTab.jsx — Patch (3 处改动)

只改 3 个地方。其它代码完全不动。

---

## ① 加 import（文件顶部）

**找到这一行**（line 11）：
```jsx
import { supabase } from '../lib/supabase.js';
```

**在它下面加一行**：
```jsx
import { getPrompt } from '../lib/prompts.js';
```

---

## ② 文本生成 prompt（约 line 189–196）

**找到**：
```jsx
    setGenerating(true);
    log(`开始生成 ${count} 条 ${batchTheme} 主题成语…`);
    try {
      const prompt = `生成 ${count} 条中文成语，要求：
- 主题：${batchTheme}
- HSK等级：${batchHsk}
- 每条包含：成语、拼音、中文意思、英语意思、意大利语意思、历史典故（中文，200字以内）、例句（中文）、难度（1-4）
- 返回纯 JSON 数组，不要任何 markdown 或说明文字
- ⚠️ 字符串中的双引号必须用反斜杠转义（例如 "他说\\"你好\\""），不要使用中文引号 " " 『 』
格式：[{"idiom":"...","pinyin":"...","meaning_zh":"...","meaning_en":"...","meaning_it":"...","story_zh":"...","example_zh":"...","difficulty":2,"theme":"${batchTheme}","hsk_level":${batchHsk}}]`;
```

**替换为**：
```jsx
    setGenerating(true);
    log(`开始生成 ${count} 条 ${batchTheme} 主题成语…`);
    try {
      const prompt = await getPrompt('chengyu_text', {
        count,
        theme: batchTheme,
        hsk:   batchHsk,
      });
```

---

## ③ 图片生成 prompt（约 line 256–276）

**找到**：
```jsx
    try {
      // Use story as the primary scene description (story is much richer than the 4-char idiom)
      // Fall back to meaning_zh for newly created idioms that haven't been written yet
      const sceneZh = idiom.story_zh || idiom.meaning_zh || '';
      const prompt = `Children's book illustration depicting this scene from a Chinese fable:

${sceneZh}

Visual focus: the narrative moment from this story. Show characters, setting, and action clearly. A single coherent scene, not a collage of symbols.

Style: ${style.prompt}.

STRICTLY AVOID: any Chinese text, calligraphy, or written characters; Chinese New Year decorations (red lanterns, couplets, firecrackers, gold ingots); holiday motifs; symbolic objects unrelated to the story. No text or watermarks anywhere in the image.

Composition: square format, balanced, focal subject centered, soft natural lighting, period-appropriate ancient Chinese rural or village setting.`;
```

**替换为**：
```jsx
    try {
      // Use story as the primary scene description (story is much richer than the 4-char idiom)
      // Fall back to meaning_zh for newly created idioms that haven't been written yet
      const sceneZh = idiom.story_zh || idiom.meaning_zh || '';
      const prompt = await getPrompt('chengyu_image', {
        story: sceneZh,
        idiom: idiom.idiom,
        style: style.prompt,
      });
```

---

## ✅ 验证

改完后做一次 `pnpm dev`（或 npm run dev），打开 SuperAdmin → Chengyu tab：
1. 点一次「批量生成」生成 1 条成语 → 应该正常
2. 点一次「生成插图」 → 应该正常

如果出错，console 会有 `[prompts] DB fetch failed for "chengyu_text", falling back to DEFAULT` —— 说明 SQL 还没跑或者 RLS 拦了，但因为有代码 fallback，**功能不会断**。
