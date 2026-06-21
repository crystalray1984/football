# “我的”页投注记录按日分组设计文档

> 日期：2026-06-21
> 目标：在已上线的「我的」页，把投注记录**按比赛日期分组**，并展示**每日汇总收益**。

## 背景

「我的」页（[pages/my/index.vue](../../../frontend/src/pages/my/index.vue)）当前是：顶部「合计收益」大字卡片 + 一条扁平的 `MyBetRecord` 列表（按投注 id 倒序）。记录由 `GET /api/my/bets` 返回，每条带 `match: { id, team1_name, team2_name, match_time }`。合计收益用 `sumSettledProfit`（仅已结算净盈亏）。

## 需求

1. 投注记录**按比赛日期**（`bet.match.match_time` 的本地日）分组。
2. 每个日期分组展示**当日汇总收益**：仅已结算净盈亏，未结算不计入（规则同顶部合计收益）。
3. 分组按日期**倒序**；组内记录保持原顺序（id 倒序）。
4. 记录行内时间由 `MM-DD HH:mm` 改为只显示 `HH:mm`（日期已在组头，去重）。
5. 顶部「合计收益」卡片与空态保持不变。

## 关键设计决策

| 决策点 | 选择 |
|---|---|
| 分组日期口径 | 按**比赛日期**（与记录行展示一致；当日收益 = 当日比赛盈亏） |
| 聚合位置 | **纯前端**（接口已返回全部所需数据，无后端改动） |
| 组头日期格式 | `MM-DD`（分组键用 `YYYY-MM-DD` 避免跨年冲突），不带星期 |
| 行内时间 | 只显示 `HH:mm` |
| 当日收益口径 | 仅已结算（`sumSettledProfit`），全未结算的一天显示 `0` |

## 详细设计

### A. 工具函数

**[format.ts](../../../frontend/src/utils/format.ts)**（日期工具）
- `dayKey(input: string | Date): string` → `dayjs(input).format("YYYY-MM-DD")`（分组键）。
- `formatDay(key: string): string` → `dayjs(key).format("MM-DD")`（组头展示）。
- `formatTime(input: string | Date): string` → `dayjs(input).format("HH:mm")`（行内时间）。
- `formatMatchTime` 保留不动（比赛详情/比赛列表仍在用）。

**[bet.ts](../../../frontend/src/utils/bet.ts)**
- `profitDisplay(amount: string): { state: "win" | "loss" | "flat"; text: string }`
  - `win` → `+金额`（绿）、`loss` → `金额`（红）、`flat` → `金额`（中性），金额走 `formatMoney`。
  - 重构：页面 `total` 改为 `profitDisplay(sumSettledProfit(bets.value))`，DRY 掉现有内联的正负号/着色逻辑。
- `export interface BetDayGroup { date: string; profit: string; bets: MyBet[] }`
- `groupBetsByDay(bets: MyBet[]): BetDayGroup[]`
  - 按 `dayKey(bet.match.match_time)` 分组；`profit = sumSettledProfit(dayBets)`；
  - 组按 `date` 字符串倒序（`YYYY-MM-DD` 字典序即时间序）；组内保持输入顺序。

### B. 组件

- **`MyBetDayGroup.vue`**（新建，`src/pages/my/`）：prop `group: BetDayGroup`。一张「日卡片」：
  - 组头：左 `formatDay(group.date)`，右 `profitDisplay(group.profit)`（着色）。
  - 卡片体：`v-for` 渲染 `MyBetRecord`（复用）。
- **`MyBetRecord.vue`**：行内时间从 `formatMatchTime(bet.match.match_time)` 改为 `formatTime(bet.match.match_time)`（其余不变）。
- **`pages/my/index.vue`**：
  - `const groups = computed(() => groupBetsByDay(bets.value));`
  - 模板把原扁平 `.records` 列表替换为 `v-for="g in groups"` 渲染 `MyBetDayGroup`。
  - `total` 改为复用 `profitDisplay`；「合计收益」卡片与「暂无投注记录」空态不变。

### C. 视觉

顶部「合计收益」卡片下方，堆叠多张「日卡片」：每张顶部 `MM-DD ┄┄ +金额` 组头，下面是当日记录行。

## 边界情况

- **当日全部未结算**：当日收益显示 `0`（中性色）。
- **跨年**：分组键 `YYYY-MM-DD` 保证不同年同月日不会合并；展示用 `MM-DD`。
- **空记录**：沿用现有「暂无投注记录」空态。

## 测试

- `bet.test.ts` 新增：`profitDisplay`（盈/亏/平、去末尾 0、带 +）、`groupBetsByDay`（分组、按日倒序、组内顺序、未结算不计入当日收益、跨年区分）。

## 不做（YAGNI）

- 后端改动（数据已足够，前端聚合）。
- 按下注日期（`created_at`）分组。
- 组头显示星期几。

## 影响文件清单

- `frontend/src/utils/format.ts`（新增 `dayKey`/`formatDay`/`formatTime`）
- `frontend/src/utils/bet.ts`（新增 `profitDisplay`、`groupBetsByDay`、`BetDayGroup`）
- `frontend/src/utils/bet.test.ts`（新增用例）
- `frontend/src/pages/my/MyBetDayGroup.vue`（新建）
- `frontend/src/pages/my/MyBetRecord.vue`（行内时间改 `formatTime`）
- `frontend/src/pages/my/index.vue`（分组渲染 + `total` 复用 `profitDisplay`）
