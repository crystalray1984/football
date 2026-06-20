# 足球投注小程序 · 前端页面设计规范

日期：2026-06-20
状态：已与需求方确认，待进入实现计划

## 1. 背景与范围

足球投注微信小程序，后端接口已就绪（Fastify + Sequelize）。本规范覆盖**前端三个画面的视觉与交互设计**，作为后续实现计划的输入。

范围内：
- 比赛列表 UI（补全 `Matches.vue` 模板）
- 比赛详情页（实现 `pages/match/index`）
- 投注弹出层（底部弹层）
- 配套的状态/边界处理、文案与数据映射
- **后端最小修复**（详见第 11 节，否则前端无法联调）

范围外（YAGNI）：状态筛选 tab、用户个人投注汇总、头像、比赛搜索、下拉刷新动效、骨架屏动画库、国际化文案切换。

## 2. 技术栈与现状

- uni-app（Vue 3 + Vite + TypeScript + SCSS），编译目标微信小程序 `mp-weixin`。
- 已装依赖：`dayjs`（时间格式化）、`decimal.js`（金额/赔率计算）。
- 单位统一用 `rpx`（750 设计宽度基准）。
- 现状：
  - `pages/index/index.vue` —— 入口编排（静默登录 → Login / Matches），保留。
  - `pages/index/Login.vue` —— 登录页已完成，**不复用其视觉风格**。
  - `pages/index/Matches.vue` —— 已有取数 + 10s 轮询逻辑，`<template>` 为空，需补全 UI。
  - `pages/match/index.vue` —— 空文件，需完整实现。
- 请求封装：`src/api.ts` 的 `api<T>()`，`token` 通过 header 传递（即 openid）。
- 类型：`src/types.d.ts` 现有 `Match` 仅含列表字段且 `score1/score2` 标注为非空。需扩充：
  - `MatchDetail`（含 `state`、`ah_condition`、`ah1_value`、`ah2_value`、`win_open`、`win1_value`、`win2_value`、`draw_value`），`score1/score2` 改为 `number | null`。
  - `BetRecord`（`id`、`type`、`condition`、`value`、`amount`、`result`、`result_profit`、`user?: { name: string }`），`type` 为 `"ah1" | "ah2" | "win1" | "win2" | "draw"`。

## 3. 信息架构与导航

- `pages/index/index`：承载 Login 与 Matches 两个场景（现有结构）。
- 列表点击比赛卡片 → `uni.navigateTo({ url: '/pages/match/index?match_id=ID' })`。
- 详情页内"投注"以**底部弹出层（bottom sheet）**呈现，不新开页面。
- 详情页返回使用小程序原生返回（导航栏左上角）。

## 4. 设计系统（B · 午夜盘口 · 专业深色）

深色专业盘口风格。所有颜色为固定品牌色（不随系统深浅色变化）。

颜色：
- 背景 `#0e1320`；导航栏 `#141b2c`；卡片 `#18202f`；卡片内分隔线 `#222a3a`；描边 `#232c40`。
- 文字：主 `#e8edf6`／次 `#8a96ac`／弱 `#5d6b85`。
- 绿（赔率/可投注/盈利）：`#19c37d`，高亮 `#4ade80`，赔率数字 `#9be15d`。
- 金（进行中 / live）：`#f5b431`。
- 红（亏损）：`#f76b6b`。
- 灰（待结算）：`#8a96ac`。
- 赔率按钮：底 `#202a3d`，描边 `#2c3852`；**选中态**＝绿描边 `#19c37d` + 绿底微透 `rgba(25,195,125,.14)` + 数字 `#4ade80` + 右上角 ✓。

圆角：卡片 12 / 按钮 8 / 状态胶囊 20 / 主按钮 10。

字号（px 语义，落地按 rpx 折算）：导航标题 15、队名（列表/详情）16–18、赔率数字 16–19、小节标题 13、时间/标签/副文案 11–12、比分 18。字重仅 400/500。

状态胶囊：
- 可投注：底 `rgba(25,195,125,.16)`，字 `#4ade80`。
- 进行中：底 `rgba(245,180,49,.16)`，字 `#f5b431`，前缀 5px 圆点（可加呼吸动画）。
- 已结束：底 `#222a3a`，字 `#8a96ac`。

> 比分一律用中性白 `#e8edf6`，**不**为胜方着色（列表与详情均如此）。

## 5. 画面① 比赛列表（Matches.vue）

布局：
- 顶部：标题"足球竞猜"（导航栏由 `pages.json` globalStyle 提供）。
- 单列卡片流，按后端返回顺序渲染（已排序：可投注 → 进行中 → 已结束）。
- 每张卡片：
  - 上排：左＝比赛时间（`dayjs` 格式化为 `MM-DD HH:mm`，如"08-15 23:00"），右＝状态胶囊。
  - 中排：主队名（左）— 中间 `VS`（未结束）或 `比分`（已结束，如 `2 : 1`）— 客队名（右）；最右 `>` 指示可进详情。
- **比分仅 `has_score=1` 时显示**；进行中不显示比分。`score1/score2` 可能为 `null`，渲染前需空值保护（缺值时回退为 `VS`）。
- 整卡可点 → 详情页。

时间格式约定（`dayjs`，本地时区）：统一 `MM-DD HH:mm`，**不使用**任何相对日期（今天/昨天/今晚 等）。列表与详情一致。

刷新：页面激活时每 10s 轮询 `GET /api/match/list`（沿用现有逻辑），失活清除定时器。

## 6. 画面② 比赛详情页（pages/match/index）

数据来源：`GET /api/match/detail?match_id`（比赛+盘口）、`GET /api/match/bets?match_id`（投注记录）。

结构（自上而下）：
1. **信息卡**：状态胶囊 + 主客队名（中间 VS / 已结束显示比分，中性白）+ 比赛时间。
2. **让球盘**小节：
   - 小节标题 `让球盘`，右侧副标题 `让球 {主队名} {让球数}`（如"让球 曼城 -0.5"）。
   - 两个赔率按钮并排：
     - 主队方向（`ah1`）：标题 `{主队名} {让球数}`，数字 `ah1_value`。
     - 客队方向（`ah2`）：标题 `{客队名} {取反让球数}`，数字 `ah2_value`。
3. **胜平负**小节（仅 `win_open=1` 渲染，否则整段隐藏）：
   - 三个赔率按钮：`{主队名}`(win1) / `平局`(draw) / `{客队名}`(win2)，数字分别为 `win1_value`/`draw_value`/`win2_value`。
4. **投注记录**小节：卡片内列表，按 `id` 倒序（最新在上）。每行：
   - 左：上行投注人 `user.name`；下行盘口文案 `盘口 @赔率`（映射见第 8 节）。**无头像。**
   - 右：上行 `投 ¥{amount}`；下行结算——`result_profit` 为正显示绿色 `+{值}`、为负显示红色 `{值}`、未结算（见下）显示灰色"待结算"。
   - ⚠️ 结算口径为**假设**（见第 14 节）：暂以 `result_profit == null` 判为"待结算"，非空时按正负着色并显示净值。待后端确认后可能调整。

赔率按钮可点性随状态：
- **可投注**：按钮高亮可点 → 唤起投注弹层，预选该方向。
- **进行中 / 已结束**：按钮置灰不可点，信息卡区域提示"已封盘"。

队名自适应：赔率按钮内队名最多两行，超出 `text-overflow: ellipsis`（两行截断），赔率数字始终独占底行；按钮等宽 `flex:1` + `min-width:0` 防溢出。

刷新：页面激活且比赛未结束时每 10s 轮询 detail + bets；失活或已结束停止。弹层打开期间见第 7 节。

## 7. 画面③ 投注弹出层（底部弹层）

触发：详情页可投注状态下点任一赔率按钮。

呈现：从底部滑入，背后详情加半透明遮罩 `rgba(0,0,0,.55)`；弹层底 `#161d2c`，顶部圆角 18，顶部居中拖动条。

内容：
- 标题行：`投注 · {让球盘|胜平负}` + 右侧关闭 ✕。
- 副标题：`{主队名} VS {客队名}`（让球盘追加 ` · 让球 {主队名} {让球数}`）。
- **盘口组**：展示被点击的那一组（让球的两个方向 / 胜平负的三个方向），当前选中方向绿色高亮 + ✓，可在组内切换方向。
- **投注金额**：数字输入（`type="number"` 唤起数字键盘），左侧 `¥`，右侧提示"限 50 - 500"。仅接受整数——实时剥除小数点/非法字符并 `parseInt`，与快捷金额双向同步。
- 快捷金额：`50 / 100 / 200 / 500`，点选回填并高亮（绿描边）。
- **预计可赢**：`本金 × (欧赔 − 1)`（= 本金 × 亚赔），所有盘口统一；用 `decimal.js` 计算并保留 2 位（如 `¥95.00`）。金额为空时显示 `¥0.00`。
- **确认投注**按钮（整宽，绿底 `#19c37d`）：金额合法才可点。

行为：
- **轮询源在详情页**（页面每 10s 刷新 `match`）。弹层不持有盘口数据，直接读页面的 `match`（reactive prop），盘口/赔率/预计可赢随页面实时更新；弹层只产出投注意图，不做快照。
- 确认 → 弹层 emit `{ type, amount }` → 页面用**实时 `match`** 计算 `condition` 后 `POST /api/bet`，body：`{ match_id, type, amount, condition }`。
  - `type` ∈ `ah1 | ah2 | win1 | win2 | draw`。
  - `condition`：`ah1`＝`ah_condition`；`ah2`＝`String(-ah_condition)`（与后端校验一致）；`win1/win2/draw`＝`"0"`（后端不校验，仅占位落库；因 `Bet.condition` 为 DECIMAL 列，不可传空串）。
  - `amount`：整数。
- 成功（code 0）：关弹层 + `uni.showToast` 成功 + 刷新 detail + bets。
- code -2：toast "盘口已变化，请重新下注"，刷新详情盘口。
- 其他非 0：toast 显示后端 `msg`。

## 8. 文案与数据映射

比赛状态（后端已下发 `state`）：`pending`→可投注、`playing`→进行中、`end`→已结束。

让球数格式化 `fmt(x)`：用 `decimal.js`，正数前缀 `+`，负数保留 `-`，0 显示 `0`（如 `-0.5` / `+0.5` / `0`）。

投注方向 → 按钮/记录文案（`team1`=主队名，`team2`=客队名）：

| type | 按钮标题 | 记录盘口文案 |
|------|----------|--------------|
| ah1 | `{team1} {fmt(ah_condition)}` | `让球 {team1} {fmt(condition)} @{亚赔}` |
| ah2 | `{team2} {fmt(-ah_condition)}` | `让球 {team2} {fmt(condition)} @{亚赔}` |
| win1 | `{team1}` | `{team1} 胜 @{亚赔}` |
| draw | `平局` | `平局 @{亚赔}` |
| win2 | `{team2}` | `{team2} 胜 @{亚赔}` |

赔率口径：后端所有 `*_value`（含让球水位 `ah1_value`/`ah2_value`）均为**欧赔**（含本金）。前端**一律以亚赔展示**：`亚赔 = displayOdds(value) = 欧赔 − 1`（`toFixed(2)`），应用于让球/胜平负按钮与记录 `@赔率`。仅改展示，下注 `condition`/`amount` 与落库数据不变。

预计可赢（所有盘口统一）：`profit = amount × (value − 1)`（= amount × 亚赔）。

金额展示：`¥` + 两位小数（`decimal.js` → `toFixed(2)`）。

## 9. 数据交互与刷新

| 场景 | 接口 | 触发 |
|------|------|------|
| 列表 | `GET /api/match/list` | 页面激活，10s 轮询 |
| 详情 | `GET /api/match/detail?match_id` | 进入页面 + 未结束时 10s 轮询 |
| 记录 | `GET /api/match/bets?match_id` | 同详情节奏 |
| 投注 | `POST /api/bet` | 弹层确认 |

`api<T>()` 已统一带 token（openid）。所有响应按 `ApiResp<T>`（`code` 0 成功）处理。

## 10. 状态与边界

- 列表/详情加载中：可用 `uni.showLoading` 或占位文案"加载中…"。
- 列表为空：居中提示"暂无比赛"。
- 投注记录为空：小节内提示"还没有人投注"。
- 详情 match_id 非法 / 比赛不存在：toast 后 `uni.navigateBack`。
- 封盘（非可投注）：赔率按钮置灰、不可点，提示"已封盘"。
- 网络失败：`api` reject → toast"网络异常，请重试"，轮询不中断下次重试。
- 金额非法（空 / 非整数 / <50 / >500）：确认按钮禁用；提交时再由后端兜底。

## 11. 后端最小修复（纳入本次范围）

前端联调前必须修复以下后端缺陷，否则核心流程跑不通。除特别标注外均在 `server/src/routes.ts`。

1. 路由绑定错误：`app.get("/api/match/bets", getMatchDetail)` 应为 `getMatchBets`，否则取不到投注记录。
2. 判空逻辑写反，导致合法请求被拒：
   - `getMatchDetail`：`if (!isNaN(match_id) || match_id <= 0)` 应为 `if (isNaN(match_id) || match_id <= 0)`。
   - `getMatchBets`：同上 `match_id` 判断。
   - `bet`：`match_id` 判断 `!isNaN(...)` → `isNaN(...)`；`amount` 判断 `!isNaN(amount)` → `isNaN(amount)`。
3. 首次投注崩溃：`bet` 中 `Decimal(sum)` 在该用户该场首投时 `sum` 为 `null`（`Bet.sum` 无行返回 null），`new Decimal(null)` 抛错 → 第一笔投注 500。改为 `Decimal(sum || 0)`。
4. 投注人关联方向错误（`server/src/db/models/Bet.ts`）：`@HasOne(() => User, "openid")` 会按 `User.openid = Bet.id` 关联，恒不匹配，`include:[User]` 取回的 `user` 永远为空 → 投注记录无投注人。改为 `@BelongsTo(() => User, "openid")`（`Bet.openid = User.openid`），并确认 `getMatchBets` 返回的每条记录可经 `bet.user?.name` 取到姓名（必要时为 include 显式指定 `as: "user"`）。

仅修复上述项，不改动其它后端业务逻辑。

## 11b. 小程序壳层配置（pages.json）

当前 `globalStyle` 为浅色，与午夜盘口深色内容割裂，必须调整：

- `globalStyle`：`navigationBarBackgroundColor: "#141b2c"`、`navigationBarTextStyle: "white"`、`backgroundColor: "#0e1320"`、`navigationBarTitleText: "足球竞猜"`。
- `pages/match/index` 的 `style` 单独设 `navigationBarTitleText: "比赛详情"`。
- 页面用的是**原生导航栏**（非设计稿里画的自定义顶栏），标题样式由此处决定。

## 12. 校验规则

- 投注金额：整数，`50 ≤ amount ≤ 500`（前端常量 `MIN_BET=50` / `MAX_BET=500`，与 `server/config.yaml` 保持一致）。
- 单场每人累计 ≤ 500：前端无对应接口，依赖后端报错提示兜底。
- 仅"可投注"状态可下注；`win_open=0` 时不展示也不允许胜平负投注。

## 13. 验收清单

- [ ] 列表三种状态渲染正确，已结束显示比分（中性白），排序符合后端。
- [ ] 点卡片进入对应详情页。
- [ ] 详情让球盘按队名展示，长队名两行省略不破版。
- [ ] 胜平负仅 `win_open=1` 出现。
- [ ] 投注记录正确映射盘口文案与盈/亏/待结算配色，无头像。
- [ ] 封盘状态赔率按钮不可点。
- [ ] 弹层选中方向高亮，可组内切换；预计可赢按口径计算正确。
- [ ] 投注成功关弹层+刷新；-2 提示盘口变化。
- [ ] 后端修复完成（路由绑定、判空、首投 null 守卫、用户关联），详情/记录/投注接口可用且投注记录能取到投注人。
- [ ] 小程序原生导航栏与页面底色为深色，详情页标题为"比赛详情"。

## 14. 假设与待确认

本仓库内**没有结算逻辑**，`result_profit`/`result` 从未被赋值（结算由外部服务/脚本完成）。以下为前端采用的假设，需后端/需求方确认，否则投注记录的结算展示可能有误：

- `result_profit` 表示**净盈亏**（赢为正、输为负），而非总派彩。
- 未结算时 `result_profit` 为 `null`（据此显示"待结算"）。
- 若实际为：输=0 而非负数、或用 `result` 字段区分赢/输/未结算、或 `result_profit` 存的是总派彩——则需相应调整第 6 节的着色与符号规则。

部署相关（非本设计目标，实现时注意）：`src/api.ts` 的 `API_BASE` 为 `http://127.0.0.1:10030`，真机/微信端需改为 https 且配置请求域名白名单；开发期用微信开发者工具勾选"不校验合法域名"。
