# AdminApp.jsx — 挂载 PromptTemplatesTab

我没看到你的 `AdminApp.jsx`，所以给你两种最常见的模式。挑符合你结构的那一个。

---

## ① 加 import（文件顶部）

```jsx
import PromptTemplatesTab from './PromptTemplatesTab.jsx';
```

> 如果你的 admin tabs 不在 `src/admin/` 下，路径相应调整。

---

## ② 挂载到 tabs（二选一）

### 模式 A：tabs 是数组配置式

如果你有类似这样的结构：

```jsx
const TABS = [
  { id: 'chengyu',  label: '成语', component: ChengyuAdminTab },
  { id: 'pinyin',   label: '拼音', component: PinyinAdminTab },
  // ...
];
```

加一项（建议放最后，靠近其它 meta 类工具）：

```jsx
const TABS = [
  // ...existing tabs...
  { id: 'prompts', label: '🎯 Prompt 模板', component: PromptTemplatesTab },
];
```

如果你 props 是统一传 `apiKeys` 这种，PromptTemplatesTab 接受 `currentUser` 但不是必需，可不传或传 `currentUser`。

---

### 模式 B：switch / if-else 渲染式

如果你写的是这样：

```jsx
{tab === 'chengyu' && <ChengyuAdminTab apiKeys={apiKeys} />}
{tab === 'pinyin'  && <PinyinAdminTab  apiKeys={apiKeys} />}
```

加一行：

```jsx
{tab === 'prompts' && <PromptTemplatesTab currentUser={currentUser} />}
```

然后在 tab 切换按钮的列表里加一个：

```jsx
<button onClick={() => setTab('prompts')}>🎯 Prompt 模板</button>
```

---

## 关于 props

`PromptTemplatesTab` 只用一个 **可选** prop：

| Prop          | 类型                | 用途                              |
|---------------|---------------------|-----------------------------------|
| `currentUser` | `{ email: string }` | 写入 `updated_by` 字段（审计）。不传也能用。 |

如果你已经有 super admin user 在 AdminApp 里（参考你 jgw 那套有 `super_admins` 概念），传进来即可。不传则 `updated_by` 留空。

---

## 排序建议

放在「内容管理类」tabs（成语 / 拼音 / 知识库）和「系统类」tabs（API Keys / 用户管理）之间，因为它跨在中间——既不是某个具体功能的内容，又不是纯系统配置。

或者干脆扔最后，标签上加 🎯 emoji 让它显眼。
