# 朗读功能 · Stage 3+4 (批量后端 + admin UI)

## 这次做了什么

| 文件                                                | 性质     | 说明                                       |
|----------------------------------------------------|----------|-------------------------------------------|
| `netlify/functions/batch-generate-audio-background.js` | **新建** | 批量 TTS 后端（Background function）      |
| `src/admin/PoetryAdminTab.jsx`                     | **替换** | 加 voice 选择器 + 单条 🔊 + 🔊 批量朗读   |

## Stage 3+4 目标

让 admin 可以：
- 在顶部选 voice（8 选 1）
- 每首诗单独点 🔊 生成朗读
- 一键 🔊 批量朗读所有缺音频或不同 voice 的诗

UI 完全镜像现有 image 工作流（imgProvider/imgStyle → voice，🎨 → 🔊）。

## 安装步骤

### 1. 替换两个文件

```
netlify/functions/batch-generate-audio-background.js  ← 新建
src/admin/PoetryAdminTab.jsx                          ← 覆盖
```

### 2. push

```powershell
cd C:\Users\Lun_z\Desktop\coding_assistant\clf-platform

git add netlify/functions/batch-generate-audio-background.js src/admin/PoetryAdminTab.jsx
git commit -m "feat(poetry-tts): admin UI + batch backend for poem audio

Stage 3+4 of audio reading feature:

Backend (Stage 3):
- New batch-generate-audio-background.js Background function for batch TTS
- Mirrors batch-generate-illustrations-background.js pattern
- Cache-skip per poem (matching voice + provider)
- 200ms throttle between Azure calls (free tier 20 req/sec limit)
- Job tracking in character_extraction_jobs (extraction_method='poem_audio_batch')

Admin UI (Stage 4):
- 8-voice selector in top bar (xiaoxiao-poetry default)
- Per-poem 🔊 朗读 button (next to 🎨 生图)
- Header 🔊 批量朗读 button (next to 🎨 批量生图)
- Loading states, log integration, error surfacing
- Reuses supabase.auth.getSession() for admin JWT

Stage 5 (student player) still pending."
git push
```

### 3. 等 Netlify build (~1 分钟)

确认 Netlify deploy 成功 → 继续测试。

## 验证（部署后）

### 测试 1: 后端基础（Stage 1+2 验证）

如果你 **之前没测过 Stage 1+2**，现在补测：

admin → 📜 诗歌 → 任一首诗右侧点「🔊 朗读」按钮。

预期 log：
```
🔊 [xiaoxiao-poetry] 生成《静夜思》朗读…
✓ 《静夜思》朗读已生成（X秒）
```

如果失败：
- `请重新登录 admin` → admin session 过期，登出再登入
- `AZURE_TTS_KEY not set` → Netlify env vars 没配，回 Stage 1+2 README Step 3
- `Azure TTS 401` → key 错或过期
- `Azure TTS 404` → region 字符串错
- `upload failed: Bucket not found` → 没建 `poem-audio` bucket

成功后，**点页面预览**那首诗，audio_url 应该就在 DB（去 SQL 验证）：
```sql
select id, title, audio_url, audio_voice, audio_duration
from clf_poems where audio_url is not null;
```

可以**复制 audio_url 在新标签页打开**听一下。

### 测试 2: voice 切换

切顶部 voice 下拉菜单到 `🌸 晓晓·亲切`（不带 -poetry 风格的版本）→ 同首诗再点 🔊

预期 log 应该说生成了新版本（不会 cached）。DB 里 audio_voice 字段应该变成 `xiaoxiao`。

### 测试 3: 缓存

切回 `🎙️ 晓晓·诗朗诵`（之前用过的 voice）→ 同首诗再点 🔊

预期 log：
```
✓ 《静夜思》朗读已生成 （缓存命中）
```

不重新调 Azure（省钱）。

### 测试 4: 批量

点顶部「🔊 批量朗读」按钮：
- 弹 confirm 显示"将为 N 首诗词批量生成朗读"
- 确认后 log 显示"📤 提交批量朗读任务 (N 首...)"
- 后台异步运行，数十秒到几分钟（取决于诗数量）

监控进度：
```sql
select source_label, status, total_candidates, total_added, completed_at
from character_extraction_jobs
where extraction_method = 'poem_audio_batch'
order by started_at desc limit 5;
```

完成后 `status='complete'` 且 `total_added=N`。

刷新 admin 页面，所有诗应该都有 audio_url。

## 已知设计决策

### 1. 单独 function 不复用 batch-illust
audio 跟 image 流程差异（SSML 拼接、Azure 节流、缓存判断按 voice）大到合并代码会模糊化逻辑。**单独函数更清晰**。

### 2. 200ms 节流
Azure Free F0 tier 限 20 请求/秒。设 200ms = 5 请求/秒（保守）。如果你升 Standard tier 可以减到 50ms。

### 3. 批量默认 voice 不一致也重新生成
点「🔊 批量朗读」时，**已有 audio 但 voice 不同**的诗也会重新生成，覆盖旧 audio。这样切顶部 voice 然后点批量 = 全部诗都改用新 voice。

### 4. force 参数
后端支持 `force: true`（强制重新生成同 voice 的）。前端**没暴露**这个开关——admin 想强制覆盖，目前需要从 SQL 把 audio_voice 设 null。未来可以加一个「🔄 全部重生」按钮如果有需求。

## Stage 5 预告

下个会话做：
- **学生端 PoetryApp ReadScreen 加播放器**：你截图里那个阅读视图右上角加 🔊 按钮，点了播放
- 控制条：播放/暂停/进度
- voice 选择（学生端可选不同 voice）

工作量约 45 分钟。

---

## ⚠️ 重要提醒

如果 Stage 1+2 后端有 bug（你之前没测过），现在 Stage 4 单条 🔊 按钮会暴露出来。**点一下任一首诗 🔊 是最快验证**。

如果遇到任何错误截图发我。
