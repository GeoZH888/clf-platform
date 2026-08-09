# Phase 2B 集成指南

新 Wizard: `CharacterImportWizard.jsx` (替换 `ExtractFromCorpusWizard.jsx`)

## AdminApp.jsx 的 2 处修改

### 修改 1: Import 语句

找到:
```jsx
import ExtractFromCorpusWizard from './ExtractFromCorpusWizard.jsx';
```

改为:
```jsx
import CharacterImportWizard from './CharacterImportWizard.jsx';
```

### 修改 2: 组件使用

找到:
```jsx
<ExtractFromCorpusWizard
  open={showExtractWizard}
  onClose={()=>setShowExtractWizard(false)}
  onComplete={()=>{ setShowExtractWizard(false); loadChars(); }}
/>
```

改为:
```jsx
<CharacterImportWizard
  open={showExtractWizard}
  onClose={()=>setShowExtractWizard(false)}
  onComplete={()=>{ setShowExtractWizard(false); loadChars(); }}
/>
```

**不需要改按钮, 不需要改 state** — 只是组件名变了。

## 旧 Wizard 处理

`ExtractFromCorpusWizard.jsx` 文件可以:
- A. 删掉 (确认新版 work 后)
- B. 保留作为备份 (rename to `.bak`)

建议 B, 直到你完全放心。

## 部署步骤

```powershell
cd C:\Users\Lun_z\Desktop\coding_assistant\clf-platform

# 1. 复制 2 个后端 functions
Copy-Item "$env:USERPROFILE\Downloads\import-hsk-characters-background.js" .\netlify\functions\ -Force
Copy-Item "$env:USERPROFILE\Downloads\parse-manual-characters.js" .\netlify\functions\ -Force

# 2. 复制新 Wizard 组件
$adminDir = (Get-ChildItem -Recurse -Filter "AdminApp.jsx" | Select-Object -First 1).DirectoryName
Copy-Item "$env:USERPROFILE\Downloads\CharacterImportWizard.jsx" "$adminDir\CharacterImportWizard.jsx" -Force

# 3. 修改 AdminApp.jsx (手动改 2 处, 见上面)
# 打开 AdminApp.jsx, 改 2 行 import + 组件使用

# 4. 部署
netlify deploy --build --prod
```

## 测试顺序

### Test 1: HSK 1 导入 (最快验证)

1. 硬刷新 admin
2. 字符管理 → 🎯 从语料库提取
3. Step 1: 选 **🎯 HSK 标准字表**
4. Step 2: 只勾 **HSK 1** → 开始
5. 等 2-3 分钟 (AI 生成 300 字)
6. Step 3: 审核 300 字, 全选
7. Step 4: 跳过 AI 填充 (HSK 字已有详情)
8. Step 5: 确认入库

**预期**: `total_added: 300, total_occurrences_added: 300`

### Test 2: 手动导入 (快)

1. Step 1: 选 **📝 手动/CSV 导入**
2. Step 2: 选 "字符列表", 粘贴 `人, 口, 手`, 来源填 "测试"
3. 开始
4. Step 3: 看到 3 个候选
5. Step 4: AI 填详情 (10 秒)
6. Step 5: 入库

### Test 3: CSV 导入

```
char,pinyin,meaning_en
你,nǐ,you
好,hǎo,good
```

### Test 4: 自由文本

```
今天我和朋友一起去学校, 我们学中文. 老师很好.
```
应该提取 ~15 个唯一字。

### Test 5: Corpus 抽取 (验证老分支还 work)

跟之前一样: Step 1 选 Corpus, Step 2 选暨南二册 + 识字表.

## SQL 验证

```sql
-- 看所有来源分布
SELECT 
  source_label,
  COUNT(*) AS chars
FROM character_source_occurrences
GROUP BY source_label
ORDER BY chars DESC;

-- 期望看到:
-- HSK 1                300
-- 暨南中文修订版 ...    52
-- 手动 · 测试            3
-- etc
```

## 如果 HSK 生成太慢

Claude 一次生成 60 字 ~30 秒. HSK 1 (300 字) = 5 批 × 30s = 2.5 分钟.
超过 5 分钟可能是 Netlify background function 达到 15 min 上限.

可以减少 batch 或分多次运行。
