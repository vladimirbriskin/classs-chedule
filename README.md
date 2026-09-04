# 课程与作业日历 · Course & Assignment Calendar

一个**完全离线、零后端、本地端到端加密**的个人课程与作业 DDL 看板。
直接部署在 GitHub Pages，可作为 PWA 添加到手机主屏幕。

> 仓库里没有任何个人日程数据。数据由你自己在本机导入，并以 AES-256-GCM 加密后存入 `localStorage`。

---

## 1. 部署到 GitHub Pages

```bash
git init && git add . && git commit -m "init: course calendar"
git branch -M main
git remote add origin git@github.com:<你的用户名>/<仓库名>.git
git push -u origin main
```

在仓库 **Settings → Pages** 中把 Source 设为 `Deploy from a branch`，分支选 `main` / 根目录 `/`。
约 1 分钟后访问 `https://<你的用户名>.github.io/<仓库名>/`。

> Web Crypto API 只在 HTTPS 或 localhost 下可用。GitHub Pages 默认 HTTPS，满足要求；
> 用 `file://` 直接双击打开 `index.html` 会无法加密，属预期行为。

**添加到主屏幕**：iOS Safari → 分享 → 添加到主屏幕；Android Chrome → 菜单 → 安装应用。
首次联网打开后即完成离线缓存，之后断网也能秒开、查阅并勾选作业。

本地预览：

```bash
python3 -m http.server 4173
```

---

## 2. 首次使用

1. 打开页面 → 设置**主密码**（至少 8 位，不会上传、无法找回）。
2. 底栏 **设置 / 导入** → 粘贴 JSON 或上传 `.json` 文件 → **覆盖导入**。
3. 之后每次打开都是磨砂玻璃锁屏，输入主密码进入；**刷新页面即重新上锁**。

把课程大纲 PDF 变成可导入的 JSON：点设置里的 **「复制 PDF → JSON 提取 Prompt」**，
连同 PDF 一起丢给多模态 AI（Claude / GPT 等），把返回的 JSON 粘回导入框即可。

---

## 3. 安全模型

| 环节 | 实现 |
| --- | --- |
| 密钥派生 | PBKDF2-SHA256，310,000 次迭代，16 字节随机盐 |
| 加密 | AES-256-GCM，每次保存生成新的 12 字节 IV |
| 落盘内容 | `localStorage` 中只有 `{ salt, iv, ciphertext }`，无明文、无校验和 |
| 密码校验 | 由 GCM 认证标签隐式完成，解密失败即密码错误 |
| 明文生命周期 | 仅存在于当前页面的内存变量；刷新、关闭、后台超过 5 分钟即清除 |
| 网络 | 零后端、零埋点、零第三方请求；Service Worker 只缓存公开静态壳 |

**没有密码找回机制。** 忘记主密码 = 本机密文永久不可解，只能重置后重新导入。
建议定期用「导出明文 JSON 备份」留一份离线副本。

> 注意：导出的备份是**明文**。它和 `class description/`（课程大纲原件）
> 都已写入 `.gitignore`，请勿提交到公开仓库。

---

## 4. 文件结构

```
index.html                 单文件应用（UI + 加密 + 排课引擎），无任何外部依赖
manifest.json              PWA 清单
sw.js                      Service Worker：App Shell 预缓存 + 离线回落
icon-192/512/maskable.png  应用图标
apple-touch-icon.png       iOS 主屏图标
my-schedule-2026W1.json    你的课表数据（已 gitignore，仅本机使用）
```

关于样式：本项目用手写的「设计令牌 + 原子类」CSS 替代 Tailwind CDN。
CDN 版 Tailwind 是运行时 JIT 编译器，必须联网首载，与「完全离线、秒开、零外部请求」的目标冲突；
命名与分层沿用 Tailwind 的思路（tokens → 原子类 → 组件类）。

---

## 5. 数据契约

完整字段说明见 `index.html` 中 `id="schema-doc"` 的注释块，或在 App 的
设置面板里点「查看数据契约 Schema」。要点：

- `courses[].schedule[]` 支持 `weekly`（`byweekday` + `interval` + `weeks` + `exdates`）
  与 `once` 两种规则；节假日停课写进 `exdates`。
- `courses[].sessions[]` 按日期为某一次课追加主题、线上/线下、阅读材料等信息。
- `assignments[].due` 接受 `YYYY-MM-DD`（视为 23:59）或 `YYYY-MM-DDTHH:mm`（本地时间）。
- `done` 字段由 App 维护；**合并导入**永远不会覆盖你已勾选的完成状态。
