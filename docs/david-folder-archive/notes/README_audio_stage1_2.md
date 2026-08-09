# 朗读功能 · Stage 1+2 (后端基础)

## 这次做了什么

| 文件                                | 性质     | 说明                                           |
|------------------------------------|----------|-----------------------------------------------|
| `clf_poems_audio_metadata.sql`     | **新建** | 加 audio_voice / audio_provider / audio_duration 字段 |
| `netlify/functions/tts-generate.js`| **新建** | Azure Neural TTS 后端：单条诗生成 audio    |

## Stage 1+2 目标

让 admin 能用 curl / Postman / 浏览器 fetch **手动**调用后端 function，验证能成功生成一首诗的 audio 并写到 DB。

UI 部分（admin 按钮、学生播放器）在 Stage 3-5 做。**这次没有可视化的东西**，纯后端。

---

## 安装步骤

### Step 1: SQL（30 秒）

Supabase SQL Editor 跑：
```sql
-- 文件：clf_poems_audio_metadata.sql
```

应该看到 verify SELECT 返回 4 行：audio_duration, audio_provider, audio_url, audio_voice

### Step 2: 创建 Supabase Storage bucket（1 分钟）

**Supabase Dashboard → Storage → New bucket**：
- Name: `poem-audio`
- Public: ☑ ON
- File size limit: 10 MB
- Allowed MIME types: `audio/mpeg, audio/mp3, audio/ogg`

验证：
```sql
select id, name, public from storage.buckets where id = 'poem-audio';
-- 应该 1 行, public=true
```

### Step 3: Netlify env vars（关键！）

去 Netlify Dashboard → zhongwen-world → Site settings → Environment variables

添加 2 条：

| Key | Value | 来源 |
|---|---|---|
| `AZURE_TTS_KEY` | (你的 Speech 服务 key) | Azure Portal → Speech Service → Keys and Endpoint |
| `AZURE_TTS_REGION` | `westeurope`（或别的区域）| 同上，跟 KEY 在一起 |

⚠️ **重要**：Azure region 不是地理位置，是你创建 Speech Service 时选的 region 字符串。常见值：`westeurope`, `eastus`, `southeastasia`。

如果你 Miaohong 项目用过 Azure TTS（你 memory 里写了），**复用同一对 key + region** 即可。

### Step 4: 部署文件

```
netlify/functions/tts-generate.js   ← 新建
```

**没有前端文件改动**——这一步只放后端。

```powershell
git add netlify/functions/tts-generate.js
git commit -m "feat(poetry-tts): Azure Neural TTS backend for single poem audio

Stage 1+2 of audio reading feature:
- New tts-generate.js function: poem text -> Azure Neural TTS REST API ->
  upload to poem-audio storage bucket -> update clf_poems audio fields
- 8 voice options with poetry-reading style support (xiaoxiao, yunxi, etc)
- Cache-skip: same poem + voice + provider returns existing audio_url
- Admin auth required (same JWT pattern as admin-create-user)
- SQL companion adds audio_voice/audio_provider/audio_duration metadata
  columns to clf_poems

Stages 3-5 (admin UI button + batch + student player) coming next."
git push
```

---

## 验证（curl 测试）

部署完后，你可以用浏览器 DevTools 的 Console 测：

```js
// 1. 拿到 admin JWT (你已登录 admin)
const session = JSON.parse(localStorage.getItem(
  Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
));
const token = session.access_token;

// 2. 找一首诗的 id
const { data: poems } = await window._supabase
  .from('clf_poems').select('id, title').limit(1);
const poemId = poems[0].id;
console.log('Test poem:', poems[0]);

// 3. 调 tts-generate
const res = await fetch('/.netlify/functions/tts-generate', {
  method: 'POST',
  headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${token}` },
  body: JSON.stringify({ poem_id: poemId, voice: 'xiaoxiao-poetry' }),
});
console.log(await res.json());
```

预期返回：
```json
{
  "ok": true,
  "audio_url": "https://yqcoju...supabase.co/storage/v1/object/public/poem-audio/xxx.mp3",
  "voice": "xiaoxiao-poetry",
  "duration_seconds": 12,
  "cached": false
}
```

打开那个 audio_url 应该能听到诗的朗诵。

**第二次同样 voice 调用**应该返回 `cached: true` + 同样 URL（不重新生成）。

---

## 8 个 voice 选项

| ID | Azure voice | 风格 | label |
|---|---|---|---|
| `xiaoxiao` | XiaoxiaoNeural | 默认 | 晓晓·亲切 |
| `xiaoxiao-poetry` | XiaoxiaoNeural | poetry-reading | 晓晓·诗朗诵 ⭐ 推荐 |
| `yunxi` | YunxiNeural | 默认 | 云希·清亮 |
| `yunxi-poetry` | YunxiNeural | poetry-reading | 云希·诗朗诵 |
| `xiaoyi` | XiaoyiNeural | 默认 | 晓伊·活泼 |
| `yunyang` | YunyangNeural | 默认 | 云扬·成熟 |
| `yunyang-poetry` | YunyangNeural | poetry-reading | 云扬·诗朗诵 |
| `xiaochen` | XiaochenNeural | 默认 | 晓辰·温暖 |

带 `-poetry` 后缀的用 `mstts:express-as style="poetry-reading"`，朗诵感更强。

## Stage 3-5 预告

完成 Stage 1+2 测试后，下次会话做：
- **Stage 3**: 后端批量 `batch-generate-audio-background.js`（target_type:'poem_audio'）
- **Stage 4**: PoetryAdminTab 加 「🔊 生成朗读」按钮 + voice 选择器 + 批量按钮
- **Stage 5**: PoetryApp ReadScreen 加播放器（控制条 + 进度），voice 选择器
- **Stage 6**: 测试 + 缓存验证 + push

---

## 错误排查

### "AZURE_TTS_KEY not set"
→ Netlify env vars 没配。回 Step 3。

### "Azure TTS 401"
→ key 错了或过期。Azure Portal 重新拿。

### "Azure TTS 404"
→ region 字符串错了（不是 location 名）。检查 Azure Portal → Speech Service → Endpoint URL 看 host 字符串。

### "upload failed: Bucket not found"
→ 没创建 `poem-audio` bucket。回 Step 2。

### "Not authorized"
→ JWT 不是 admin 的。重新 admin 登录。

### "voice xxx unknown"
→ 拼错了。查上面 voice 表。
