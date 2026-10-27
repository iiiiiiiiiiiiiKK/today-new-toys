<div align="center">

# 今天又有什么新玩具

**每天发现一个新的开源项目或互联网玩具。**
中文介绍 · 真实截图 · 可核实的数据 · 未知就写未知

[![在线站点](https://img.shields.io/badge/🌐_在线站点-iiiiiiiiiiiiikk.github.io-c8402a?style=for-the-badge)](https://iiiiiiiiiiiiikk.github.io/today-new-toys/)
[![代码许可](https://img.shields.io/badge/代码许可-MIT-2f4a3a?style=for-the-badge)](LICENSE)
[![收录项目](https://img.shields.io/badge/收录项目-30-191712?style=for-the-badge)](https://iiiiiiiiiiiiikk.github.io/today-new-toys/discover)
[![分类](https://img.shields.io/badge/分类-10-a5803a?style=for-the-badge)](https://iiiiiiiiiiiiikk.github.io/today-new-toys/categories)

[在线浏览](https://iiiiiiiiiiiiikk.github.io/today-new-toys/) ·
[全部项目](https://iiiiiiiiiiiiikk.github.io/today-new-toys/discover) ·
[分类索引](https://iiiiiiiiiiiiikk.github.io/today-new-toys/categories) ·
[关于这份清单](https://iiiiiiiiiiiiikk.github.io/today-new-toys/about) ·
[作者 𝕏 @0xkillcoin](https://x.com/0xkillcoin)

</div>

![首页](docs/screenshots/home-desktop.jpg)

---

## 这是什么

一个**中文的开源项目与互联网工具发现站**。它不是排行榜，也不是自动抓取的导航目录，而是一份有人读过 README、打开过官网、然后写下来的清单。

- 📖 **中文介绍**：每个项目的概览、主要功能、适用人群、使用方式都是人工撰写的，详情页会标出依据的是 README 的哪一部分、读了多少字。
- 🖼 **真实截图**：每个项目的封面都来自各自官网 / 演示站的实时抓取（带抓取日期），没有一张是设计稿或伪造界面。
- 🧾 **数据诚实**：Star、许可证、最近推送来自 GitHub API 快照；取不到就写「未知」并说明原因，**绝不填 0、不估算、不美化**。
- 🎨 **杂志式排版**：暖纸张底色、朱红点缀、衬线中文标题与等宽数字；桌面三栏、手机单栏，不是后台管理界面。
- ⚡ **纯静态**：没有后端、没有数据库、没有运行时密钥，可以部署到任何静态托管平台。

<table>
<tr>
<td width="50%"><img src="docs/screenshots/discover-desktop.jpg" alt="发现页：搜索、多标签筛选、排序与分页"></td>
<td width="50%"><img src="docs/screenshots/detail-desktop.jpg" alt="项目详情页：概览、功能、门槛、许可证与截图"></td>
</tr>
<tr>
<td align="center"><sub>发现页 · 搜索 / 多标签 AND 筛选 / 排序 / 分页</sub></td>
<td align="center"><sub>详情页 · 数据、依据、截图、同类推荐</sub></td>
</tr>
</table>

<div align="center">
<img src="docs/screenshots/home-mobile.jpg" width="300" alt="iPhone 上的首页">
<img src="docs/screenshots/about-mobile.jpg" width="300" alt="iPhone 上的关于页面">
<br><sub>iPhone 390pt：首页（左）与编辑原则（右），实际渲染截图 · 手机端为纯文字版</sub>
</div>

---

## 设计系统

整站按「一本每天更新的独立数字杂志」来排，而不是导航站模板。所有页面共用同一套 token（`src/styles/base.css`），不允页面各自发明米白或红色。

**颜色**（CSS 变量，唯一来源）

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--paper` | `#F2EDE1` | 页面底色 |
| `--paper-light` | `#FBF8F1` | 输入框、侧栏、页脚等浅色块 |
| `--ink` | `#211D18` | 主文字 |
| `--ink-soft` | `#4A423A` | 正文次级文字 |
| `--ink-mute` | `#6F6553` | 元数据（对纸色 4.9:1，达到 AA） |
| `--accent` | `#BD422D` | 品牌朱红：期号、排名、重点标线 |
| `--rule` / `--rule-strong` | `#DDD5C6` / `#C9BFAB` | 细分隔线 |

**四种字体各司其职**

- 中文标题：`Noto Serif SC`（自托管子集，缺失时回退 `Songti SC` / `SimSun`）
- 拉丁文标题与排名数字：`Instrument Serif`
- 正文：系统无衬线（`PingFang SC` / `Microsoft YaHei` / `Segoe UI`），行长 40rem、行高 1.78
- 期号、日期、许可证、技术元数据：`JetBrains Mono`，字距加宽

**版式**

- 内容最大宽度 `74rem`，正文 `40rem`，边距 `clamp(1.15rem, 4.2vw, 3.5rem)`
- 断点：`1080 / 960 / 620 / 380px`；栏目节奏统一为 `--section-gap`
- 用 **细线 + 编号 + 字号** 建立层次，不用卡片阴影和圆角：首页是「封面文章 → 索引列表 → 排名榜 → 编辑精选 → 分类索引」，五个栏目各有不同节奏
- 截图统一容器：首页封面 16:10、索引缩略图 4:3、编辑精选 4:3 / 16:10、详情页 16:10
- 动效克制：页面进入 320ms 位移 6px、FAQ 展开 200ms，`prefers-reduced-motion` 下全部关闭

```css
/* 任何新页面从这里取色，不要写死十六进制 */
background: var(--paper);
color: var(--ink);
border-bottom: 1px solid var(--rule);
```

---

## 收录了什么

**30 个手工精选**（10 个分类各 3 个，编辑逐条读过 README）：

| 分类 | 项目 |
| --- | --- |
| **AI 工具** | Ollama · Open WebUI · LobeHub（LobeChat） |
| **开发者工具** | Biome · uv · Hoppscotch |
| **效率工具** | MarkItDown · LocalSend · Espanso |
| **数据可视化** | Evidence · PyGWalker · Observable Plot |
| **创意与设计** | Excalidraw · Penpot · Screenshot to Code |
| **学习工具** | CS 自学指南 · Learn Git Branching · TypeScript Exercises |
| **开源硬件** | QMK Firmware · ESPHome · Flipper Zero |
| **互联网玩具** | Sherlock · IT-Tools · DiceBear |
| **自托管项目** | Immich · Karakeep · Linkwarden |
| **加密与 Web3** | Foundry · Rainbow · MetaMask |

在此之上，站点每天还会自动收录新项目（见「自动收录」一节）。自动条目带「自动收录」标记，与上面这批手工条目在页面上可以区分。

每个项目都有独立页面、可分享 URL、中文分享文案和三种比例的分享图。

---

## 功能

### 发现

- **首页**：今日推荐（按日期确定性轮换）、最新收录、本周热门、编辑精选、分类入口、搜索框、随机发现。
- **搜索**：覆盖项目名、一句话介绍、摘要、功能描述、别名与标签——搜「端到端加密」能找到 Excalidraw，而不只是搜标题。
- **筛选**：分类多选、多标签 **AND**、适用人群、许可证已确认；四种排序；全部分页写入 URL，可直接分享筛选结果。
- **随机发现**：从全部项目里随机跳一个，专治选择困难。

### 详情页

项目概览 · 主要功能 · 适合谁使用 · 使用方式（分步） · 技术栈与许可证 · 真实截图 · 官网 / 仓库 / 演示链接 · 同类推荐 · 收藏 / 复制链接 / 生成分享图 / **提交人工修订**。

同时展示四类「可信度」信息：

| 字段 | 展示方式 |
| --- | --- |
| **内容依据** | README 路径、字数、抓取日期，以及可展开的 README 原始小标题 |
| **许可证** | SPDX 标识 + 名称；自定义许可证附限制说明与原文链接；未声明则显示「未知」 |
| **Star / 活跃度** | 数字 + 快照时间；缺失显示「未知」并说明未做估算 |
| **截图** | 抓取来源 URL + 抓取日期；`LIVE CAPTURE` 或 `REPO PREVIEW` 标识 |

### 收藏与分享

- 收藏保存在 `localStorage`，刷新、关闭浏览器后仍在；同浏览器多标签实时同步。
- 收藏页可导出 **JSON**（含 slug、链接、许可证、收藏时间）与 **Markdown**，也可一键复制为 Markdown。
- 中文分享文案包含名称、一句话、分类、门槛、许可证、官网 / 仓库 / 详情链接，可编辑后再复制。
- 分享图由浏览器 Canvas 本地绘制，支持 **1:1 / 3:4 / 16:9**（1080×1080、1080×1440、1600×900），直接下载 PNG；不上传任何图片。

<img src="docs/screenshots/share-dialog.jpg" alt="分享图生成弹窗：三种比例与中文文案">

---

## 数据是怎么来的

```
GitHub REST API ──┐
README 原文 ──────┼──▶ data/repo/<slug>.json ──┐
官网截图 ─────────┘                            ├──▶ public/data/projects.json ──▶ 静态站点
人工撰写的中文介绍 ──▶ data/projects/<slug>.json ┘
```

**两层数据刻意分开**：`data/repo/` 是机器抓来的事实（Star、许可证、最近推送、README 摘要），只由脚本写入；`data/projects/` 是人写的中文文案，只由人编辑。`npm run data:update` 只刷新前者，永远不会覆盖后者。

### 数据可信度约定（写进了代码与测试）

1. **未知就是未知** —— `null` → UI 显示「未知」+ 原因，不填 0。
2. **许可证双重核对** —— GitHub 报 `NOASSERTION` / `Other` 一律当未知；4 个自定义许可证（Open WebUI、LobeHub、ESPHome、MetaMask）人工读 LICENSE 原文后写明限制。
3. **介绍必须有依据** —— 每个项目有 `contentBasis`；README 未读取的项目必须在文案里说明。
4. **截图必须真实** —— 全部来自官网 / 仓库页面，附抓取日期；抓不到用带文字的占位图，不拿相似产品冒充。
5. **「本周热门」不假装是流量榜** —— 站内无埋点，排名 = Star 规模（对数）+ 最近推送时间，算法在 `scripts/build-data.mjs` 里公开。
6. **不重复收录** —— slug、GitHub 全名、项目名三重去重，导入时与构建时各查一次。
7. **自动化不冒充人工** —— `review.status = draft` 的记录永远不会进入构建产物。

---

## 快速开始

```bash
git clone https://github.com/iiiiiiiiiiiiiKK/today-new-toys.git
cd today-new-toys
npm install
npm run dev       # http://localhost:5180
```

```bash
npm run build     # 数据校验 → 类型检查 → 打包 → 预渲染 45 个页面 → 后处理
npm run preview   # http://localhost:4188
npm run check     # data:check + typecheck + unit test + build
```

要求 Node.js 20+。构建期的截图、字体子集化与 OG 图脚本另需 Python 3.10+（Pillow、fontTools、brotli）与本机 Chrome；**站点本身不需要后端、数据库或任何密钥**。

---

## 项目结构

```
data/                        内容源（纯文本，进 Git，可 review）
├─ categories.json           10 个分类，全站唯一来源
├─ sources.json              待抓取的仓库清单
├─ projects/<slug>.json      **人工撰写**的中文介绍（published / draft）
├─ projects/_template.json   新增项目模板
├─ repo/<slug>.json          GitHub 元信息 + README 摘要快照（脚本生成）
├─ readme/<slug>.md          README 原文（供人工核对，不进入 dist）
├─ license/<slug>.txt        自定义许可证原文（人工核对用）
└─ logs/*.jsonl              每次抓取/更新的运行日志（append-only）

public/
├─ data/projects.json        构建产物：站点实际加载的合并数据
├─ shots/<slug>.webp         1440×900 真实截图 + 880px 卡片版
├─ og/<slug>.png             1200×630 社交预览图（由真实截图合成）
└─ fonts/                    自托管字体（Noto Serif SC 已按站内字符子集化）

src/
├─ pages/                    首页 / 发现 / 分类 / 详情 / 收藏 / 关于
├─ components/               卡片、封面（含失败占位）、分享弹窗、修订弹窗
├─ context/                  数据加载、收藏（localStorage）、Toast
└─ lib/                      搜索筛选排序分页、分享文案、Canvas 分享图

scripts/                     内容流水线（抓取 / 导入 / 更新 / 校验 / 截图 / 预渲染）
tests/unit/                  37 个单元测试（含对真实数据文件的诚实性断言）
tests/e2e/                   19 个端到端检查 + 布局审计 + 10 设备响应式矩阵
```

---

## 内容流水线

| 命令 | 作用 |
| --- | --- |
| **`npm run auto:publish`** | **无人值守：搜索新项目 → 抓 README/截图 → 生成中文条目 → 直接发布（标注「自动收录」）** |
| `npm run data:fetch` | 抓取 `sources.json` 中仓库的元信息 + README（`-- slug` 只抓指定项） |
| `npm run data:import -- <repo-url>` | 从仓库地址导入新项目，生成**草稿**（去重 + 规则版/可选 AI 中文草稿） |
| `npm run data:update` | 刷新已发布项目的 Star / 许可证 / 推送时间 / README 摘要 |
| `npm run data:verify` | 检查所有官网与仓库链接，输出 `data/link-report.json` |
| `npm run data:build` | 合并仓库快照 + 人工文案 → `public/data/projects.json` |
| `npm run data:check` | 数据质量闸门（构建前自动执行） |
| `npm run shots` / `shots:retry` | 抓取官网截图 / 对空白截图二次抓取 |
| `npm run og` | 用真实截图生成 1200×630 分享预览图 |
| `npm run fonts` | 重新子集化中文字体（新增文案后运行） |

每次抓取 / 更新都会写一条 append-only JSONL 日志到 `data/logs/`，包含每条 HTTP 请求的状态码与剩余额度、失败原因、保留的旧快照。**日志随仓库提交**，可据此复核「某个数字是什么时候抓的」。

### 自动收录（无人值守，无需人工维护）

内容**不需要你每天手动添加**。`.github/workflows/auto-update.yml` 每天 09:17（Asia/Shanghai）自动执行：

1. **发现**：按 10 个分类各跑一次 GitHub 搜索（`topic:… stars:>N pushed:>…`），取 Star 排序后的候选；
2. **过滤**：跳过 archived / fork / 描述过短 / 150 天未推送 / 低于 Star 门槛的仓库，并排除 `awesome-*` 这类清单仓库；
3. **去重**：按仓库全名、项目名、官网域名三重比对，已收录的不会重复添加（同一次运行内也会去重）；
4. **抓取**：GitHub API 取元信息，读 README，用无头 Chrome 截官网（1200×750 JPEG，失败就用占位图）；
5. **生成中文条目**：从 README 标题与安装命令生成可核实的摘要；配置了 `AI_API_KEY` 时改由模型生成；
6. **发布**：写入 `data/projects/<slug>.json`，带 `review.mode = "auto"`，然后重建数据、跑一遍 `data:check` 与单元测试、提交并发布到 GitHub Pages。

**读者能看出来源**：自动条目在卡片上有「自动收录」小标，详情页写明「未经人工校对」，`contentBasis` 记录依据的 README 与字数。人工写的条目没有这个标记。

**它不会做的事**：不猜 Star、不补许可证、不编功能、不为没有截图的条目伪造截图。取不到就写「未知」。

```bash
# 本地试跑（不写文件）
npm run auto:publish -- --limit=3 --dry-run
# 本地真跑：收录最多 3 个
GITHUB_TOKEN=... npm run auto:publish -- --limit=3
```

想接入模型生成更自然的中文摘要：在仓库 Settings → Secrets 配置 `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL`（OpenAI 兼容接口）。没配也能跑，用的是确定性规则稿。密钥只在 Actions 里，前端**没有任何**读取密钥的代码。

### 手动添加一个项目（可选）

```bash
npm run data:import -- https://github.com/owner/repo --category=dev-tools
```

脚本会识别仓库地址、检查 slug 与仓库全名是否重复、抓取元信息与 README，然后生成 `data/projects/<slug>.json` **草稿**（`review.status = "draft"`，构建时不会发布）。打开草稿，按 README 逐条改写 `summary` / `features` / `audienceFor` / `setup`，把 `status` 改成 `published`，再运行：

```bash
npm run data:check && npm run build
```

导入失败时（例如 API 额度耗尽、仓库被限制），脚本会提示改用**手动添加**：复制 `data/projects/_template.json` 后填写即可，这条路径永远可用。

### 可选：AI 辅助草稿

设置 `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` 后，`data:import --ai` 会让模型基于 README 原文生成中文草稿。**草稿一定带「待人工核校」标记且不会发布**；Key 只存在于维护者环境变量中，永远不会进入浏览器或数据文件。不配置 AI 时使用确定性的规则草稿——每一句都能追溯到 README 的章节或安装命令。

---

## 响应式与可访问性

不是「加了几个 media query」，移动端是另一套排版逻辑：

- **断点**：`1080 / 960 / 620 / 400 / 380px`；桌面双栏封面 → 平板单栏 → 手机纯文字版。
- **手机端是「纯文字版」**：列表缩略图、精选封面全部不渲染（96px 的官网截图只会变成噪点），版面交给字号、编号和细分隔线；只有详情页保留一张大截图，因为那时它才真的可读。
- 手机端实测（390pt）：头部 **148px**、封面文章 **625px**、「最新收录」单行 **106px**、首页总高 **4346px**——比上一版 5887px 缩短 26%。
- 桌面端保持影像：封面 16:10 大图、索引 132px 缩略图、精选 4:3 / 16:10，与手机端共用同一套 DOM 和 token。
- 「最新收录」在手机上用 `grid-template-areas` 显式排版（编号 / 名称 / 一句话 / 元数据 / 链接），修掉了自动排列把元数据挤进 1.7rem 编号列的错位。
- 分类与标签筛选是单行横向滚动轨道；详情页截图排在数据表之前；操作区为 2 列 44px 按钮 + 一行文字工具链。
- 已用 **10 种真实设备视口**（iPhone SE / 12 mini / 14–16 / 16 Pro / 15 Pro Max / Pixel 7 / iPad mini / iPad Pro / 桌面 1024 / 1440）× 6 个页面实测：无横向溢出、无越界文本、无坏图、触控目标 ≥ 40–44px、输入框不触发 iOS 缩放。
- 对比度：主文字 8.4:1、元数据 4.9:1、朱红标题 6.5:1（对 `#F2EDE1` 纸色），均达到 WCAG AA；全站最小字号 11.2px。
- iOS 适配：`viewport-fit=cover` + `env(safe-area-inset-*)`、`100dvh` 弹窗高度、输入框 17px（避免 Safari 聚焦自动缩放）、`touch-action: manipulation` 去掉 300ms 点击延迟、关闭 hover 缩放与固定背景（滚动重绘卡顿）。
- 键盘可用：`/` 聚焦搜索、`Esc` 关闭弹窗、跳转正文链接、FAQ 用原生 `details` 可键盘展开；`prefers-reduced-motion` 下关闭全部动效；图片失败有明确文字占位；无 JS 时有可读提示。

---

## 部署

**线上地址：<https://iiiiiiiiiiiiikk.github.io/today-new-toys/>**（GitHub Pages，`gh-pages` 分支）

构建产物是纯静态文件（`dist/`，约 7.7 MB，大部分是截图与分享图）。

| 平台 | 配置 |
| --- | --- |
| **GitHub Pages**（当前使用） | 推送到 `main` 后由 `.github/workflows/deploy-pages.yml` 自动构建并发布到 `gh-pages`；Pages 源设为 `gh-pages` 分支根目录 |
| **Cloudflare Pages / Netlify** | Build：`npm run build`，Output：`dist`；已内置 `_redirects` |
| **Vercel** | Framework：Vite，Output：`dist`；需要 SPA 回退时加 `vercel.json` rewrite |
| **任意静态服务器** | Nginx `try_files $uri $uri/ /index.html;` |

环境变量：

| 变量 | 作用 | 必需 |
| --- | --- | --- |
| `SITE_ORIGIN` | 站点完整地址（含子路径），用于 canonical / OG / sitemap / RSS | 部署时建议设置 |
| `TOYS_BASE` | Vite base，例如 `/today-new-toys/` | 子路径部署时必填 |
| `GITHUB_TOKEN` | 提高抓取额度（5000/h），**仅构建脚本使用** | 可选 |
| `CHROME_PATH` | 截图与预渲染使用的 Chrome | 可选 |
| `VITE_REPO_URL` | 「提交修订」跳转的仓库地址 | 可选 |

GitHub Pages 由 `.github/workflows/deploy-pages.yml` 自动构建并发布（推送到 `main` 触发）。工作流会把 `SITE_ORIGIN` 统一转成小写，避免 canonical / OG 指向大小写不同的主机名。

### 手动部署（子路径）

```bash
TOYS_BASE=/today-new-toys/ \
SITE_ORIGIN=https://iiiiiiiiiiiiikk.github.io/today-new-toys \
npm run build
# 然后把 dist/ 的内容发布到 Pages 分支
```

> 如果当前网络无法 `git push`（只允许 `api.github.com`），可以用 `scripts/upload-via-api.cjs` 通过 REST API 推送：
> `GITHUB_TOKEN=... OWNER=... REPO=... BRANCH=gh-pages LOCAL_ROOT=dist node scripts/upload-via-api.cjs`

---

## 测试

```bash
npm run test           # 37 个单元测试
npm run test:e2e       # 19 个端到端检查（先 npm run build && npm run preview）
npm run test:layout    # 4 视口 × 7 页面的布局审计
node tests/e2e/device-matrix.mjs   # 10 设备 × 6 页面响应式矩阵
npm run data:check     # 数据闸门
```

- **单元测试**：搜索 / 筛选 / 排序 / 分页、日期与未知值、许可证归一化、README 摘要解析、真实数据完整性（无重复、无伪造数字、截图文件存在）。
- **端到端**：首页真实数据、详情页字段与数据文件一致、随机发现、收藏刷新持久化、剪贴板、三种比例分享图画布像素与 PNG 下载、中文分享文案、按功能描述搜索、多标签 AND、分页、分类 404、收藏导出、外链安全属性、390px 无溢出、图片失败占位、无 JS 提示、控制台零报错。
- **构建期**：数据校验 + 类型检查 + 45 个路由预渲染 + OG / canonical 30/30 校验。

---

## 已知限制

- 收藏只在本地，不跨设备；换设备请用导出。
- 无账号体系、无服务端搜索；全部项目一次性加载（`projects.json` 目前约 250 KB）。项目上千时应换成分片索引。
- **自动收录的中文文案是机器整理的**：它只复述 README 里能核实的部分，读起来不如人工条目，偶尔会把英文小标题直接当功能名。页面上有「自动收录」标记，欢迎按 README 的流程改成人工版本。
- 自动 lanes 的判断靠规则（Star 门槛、推送时间、topics、描述长度），不是语义理解，所以偶尔会漏掉好项目，也可能收进「不太像玩具」的项目；`data/auto-report.json` 与 `data/logs/auto-*.jsonl` 记录了每次的候选与取舍。
- 截图是构建时 / 收录时的快照，官网改版后会过期；`npm run shots` 可重抓，页面显示抓取日期。
- 分享图在浏览器端绘制，旧版 Safari 可能出现字体回退。
- 预渲染依赖本机 Chrome；缺失时构建会跳过预渲染并明确警告（仍可部署，项目页改为客户端渲染）。
- `data/readme/` 是为人工核对保留的原文摘录，不进入 `dist/`；如需公开请先确认各项目许可证允许转载。

---

## 许可证与致谢

本站代码以 [MIT](LICENSE) 发布。站点中每个项目的名称、截图、README 摘录与商标归其各自作者所有；本站仅作介绍与引用，并链接回原始仓库。若你是作者希望修改或移除条目，请提交 issue 或 PR。

字体：**Noto Serif SC**、**Instrument Serif**、**JetBrains Mono**（均为 SIL OFL 1.1），自托管并按站内字符子集化。

<div align="center">

---

**做给喜欢在凌晨三点点开一个新链接的人。**

[作者 𝕏 @0xkillcoin](https://x.com/0xkillcoin) · [在线站点](https://iiiiiiiiiiiiikk.github.io/today-new-toys/) · [回到顶部](#今天又有什么新玩具)

</div>
