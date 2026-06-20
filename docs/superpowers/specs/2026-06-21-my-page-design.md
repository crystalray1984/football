# “我的”页面设计文档

> 日期：2026-06-21
> 目标：为足球竞猜小程序新增「我的」Tab 页，展示用户的历史投注记录与合计收益。

## 背景

当前小程序是 uni-app（Vue 3）编译到 mp-weixin，仅有两个页面且**没有 tabBar**：

- `pages/index/index` —— 入口页，`onMounted` 中执行 `uni.login()` → `POST /api/auth` 拿到 openid 作为 token（存于 [api.ts](../../../frontend/src/api.ts) 模块内的内存变量），未注册用户在本页内渲染 `Login.vue`。
- `pages/match/index` —— 比赛详情页，含投注记录列表 `BetRecord.vue`。

投注数据由 `GET /api/match/bets?match_id=` 提供，`Bet` 模型已带 `result_profit`（净盈亏，未结算为 `null`），但**尚未与 `Match` 建立关联**。

## 需求

1. 把现有主页作为第一个 Tab，「我的」作为第二个 Tab。
2. 「我的」页核心功能：查看历史投注记录 + 合计收益。
3. 合计收益用较大字体展示在页面上部，下面是投注记录列表。
4. 记录列表样式参照比赛详情页，但**不展示投注人姓名**，改为展示**比赛日期 + 对阵球队**。
5. **未结算的投注不计入合计收益**。
6. 未登录用户切换到「我的」页：合计收益统一显示 `0`，无投注记录，**不调用查询接口**。
7. 每次进入「我的」页刷新数据。

## 关键设计决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| 合计收益在哪算 | **前端** 累加 | 页面一次性加载全部记录，用 `decimal.js` 累加 `result_profit`，与详情页 `emulateTotal` 一致；后端保持纯列表接口 |
| 记录行组件 | **新建 `MyBetRecord.vue`** | `BetRecord.vue` 与详情页耦合（`emulate` 模拟、匿名兜底）；「我的」行结构不同（对阵+日期、每行不同比赛）。复用 `recordOddsText` / `settlement` 工具逻辑，仅右侧少量标记重复 |
| 接口如何带出比赛信息 | **`Bet` 加 `@BelongsTo(Match)` + `include`** | 与现有 `include: User` 完全同构，一次查询，符合 Sequelize 惯例 |

## 详细设计

### A. TabBar 与路由

- 在 [pages.json](../../../frontend/src/pages.json) 增加 `tabBar`（深色主题）：
  - `backgroundColor: #141b2c`，`color: #8a96ac`，`selectedColor: #19c37d`，`borderStyle: black`
  - 两项：`pages/index/index` → 文案「主页」；新页 `pages/my/index` → 文案「我的」
- 新增页面 `pages/my/index.vue`，在 `pages` 数组注册。
- TabBar 图标：生成 4 张 81×81 PNG 放入 `src/static/tabbar/`：
  - `home.png` / `home-active.png`（主页，普通 `#8a96ac` / 选中 `#19c37d`）
  - `mine.png` / `mine-active.png`（我的，同上）
  - 生成方式：一次性 Node 脚本，仅用内置 `zlib` 手写最小 PNG 编码器（不新增任何依赖），生成后提交 PNG、删除脚本。
- `pages/index/index` 仍为入口/启动 Tab，登录鉴权照旧在该页 `onMounted` 触发。

### B. 后端 `/api/my/bets`

涉及 [Bet.ts](../../../server/src/db/models/Bet.ts) 与 [routes.ts](../../../server/src/routes.ts)。

- `Bet` 模型新增关联：
  ```ts
  @BelongsTo(() => Match, { foreignKey: "match_id", as: "match" })
  declare match?: Match;
  ```
- 新增 `GET /api/my/bets` handler：
  - 从请求头 `token` 读取 `openid`；若为空 → 返回 `{ code: 0, data: [] }`（前端不会在未登录时调用，后端仍做兜底）。
  - 否则：
    ```ts
    Bet.findAll({
      where: { openid },
      include: [{ model: Match, as: "match",
        attributes: ["id", "team1_name", "team2_name", "match_time"] }],
      order: [["id", "desc"]],
    })
    ```
  - 返回 `{ code: 0, data: bets }`。
- 在 `routes()` 注册：`app.get("/api/my/bets", getMyBets)`。

### C. 「我的」页面 `pages/my/index.vue`

- 数据加载：`onShow` 中每次进入都刷新。
  - 若 `getToken()` 为空 → 合计收益 `0`、列表为空、**不发请求**。
  - 否则 `GET /api/my/bets`；加载中显示「加载中…」，网络异常 toast「网络异常，请重试」（与详情页一致）。
- 布局（自上而下）：
  1. **合计收益**：大号数字。正数显示 `+` 且绿色（`$c-green-bright`），负数红色（`$c-red`），`0` 中性色；金额用 `formatMoney`（最多两位小数，见 F 节）。
  2. **小字说明**（仅当存在未结算投注时）：「未结算 N 笔不计入」。
  3. **记录列表**：`MyBetRecord` 循环。
  4. **空状态**：「暂无投注记录」。

### D. `MyBetRecord.vue`

参照 `BetRecord.vue` 样式，调整左侧内容：

- 左侧：
  - 第一行（主，`$c-text`）：`队1 vs 队2`
  - 第二行（次，`$c-text2`）：`06-21 18:00 · 让球 阿森纳 -0.5 @0.95`
    （`formatMatchTime(bet.match.match_time)` + `recordOddsText(bet, bet.match)`）
- 右侧（沿用现有结算样式与颜色类）：
  - 金额 `Number(bet.amount)`
  - 结算 `settlement(bet)`：未结算显示「待结算」（`pending`），已结算显示 `+x`/`-x`（`win`/`loss`/`flat`）
- 记录排序：随接口返回顺序（投注 id 倒序，最新在前）。

### E. 合计计算、类型与测试

- 在 [bet.ts](../../../frontend/src/utils/bet.ts) 提取纯函数：
  ```ts
  // 合计已结算投注的净盈亏；未结算（result_profit == null）不计入
  export function sumSettledProfit(
    bets: { result_profit: string | null }[]
  ): string
  ```
  页面合计收益与详情页风格一致，用 `decimal.js` 累加。
- 在 `frontend/src/utils/bet.test.ts` 增加用例：含未结算（跳过）、盈、亏、平、空列表等场景。
- 类型（[types.d.ts](../../../frontend/src/types.d.ts)）新增：
  ```ts
  declare interface MyBet extends BetRecord {
    match: { team1_name: string; team2_name: string; match_time: string };
  }
  ```

### F. 金额展示格式（统一）

- **金额**统一为「最多两位小数」：四舍五入到 2 位后去掉末尾多余的 0（如 `95` → `95`、`95.50` → `95.5`、`95.555` → `95.56`、`0` → `0`）。
- `formatMoney` 作为金额格式的**唯一来源**：`new Decimal(amount).toDecimalPlaces(2).toString()`。`settlement`（结算净盈亏）与 `potentialWin`（预计可赢）改为复用 `formatMoney`。
- **赔率/水位不受此规则约束**：`displayOdds` 保持固定两位小数（`@0.95`、`@1.10`）。
- 受影响展示位：「我的」页合计收益、详情页/「我的」页结算文案、投注弹层「预计可赢」。
- 已合规、无需改动：详情页 admin 模拟收益（已用 `toDecimalPlaces(2).toString()`）、`Number(bet.amount)`（投注额为整数）。

## 边界情况

- **未登录 / 未注册**：`getToken()` 为空 → 显示 `0`、空列表、不发请求。
- **鉴权竞态**：已注册用户在启动鉴权（启动 Tab `onMounted`）完成前的极短窗口内点「我的」，`getToken()` 仍空、会短暂显示 `0`；下次 `onShow` 重新校验即恢复。实践中可忽略（鉴权在启动即触发）。如需更稳妥，可后续将鉴权上移到 `App.vue onLaunch`——**本期不做**。
- **空记录**：显示「暂无投注记录」，合计 `0`。
- **网络异常**：toast 提示，合计与列表保持上次/初始状态。

## 不做（YAGNI）

- 分页 / 无限滚动（本期一次性加载全部）。
- 时间区间筛选（本期为全量累计）。
- 个人资料头部（头像/昵称/胜率等额外统计）。
- 将鉴权上移到 `App.vue`（仅作为后续可选优化记录）。

## 影响文件清单

**前端**
- `frontend/src/pages.json`（新增 tabBar + 注册新页）
- `frontend/src/pages/my/index.vue`（新建）
- `frontend/src/pages/my/MyBetRecord.vue`（新建）
- `frontend/src/utils/format.ts`（`formatMoney` 改为最多两位小数）
- `frontend/src/utils/format.test.ts`（更新 `formatMoney` 用例）
- `frontend/src/utils/bet.ts`（`settlement`/`potentialWin` 复用 `formatMoney`；新增 `sumSettledProfit`）
- `frontend/src/utils/bet.test.ts`（更新 `settlement`/`potentialWin` 用例，新增 `sumSettledProfit` 用例）
- `frontend/src/types.d.ts`（新增 `MyBet`）
- `frontend/src/static/tabbar/*.png`（4 张图标）

**后端**
- `server/src/db/models/Bet.ts`（新增 `Match` 关联）
- `server/src/routes.ts`（新增 `getMyBets` + 注册路由）
