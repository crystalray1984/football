# 管理员「按日用户收益」汇总页设计文档

> 日期：2026-06-21
> 目标：新增一个**仅管理员可见**的页面，按比赛日期分组、展示每个用户当日的净收益；入口为「比赛列表」上的浮动按钮。

## 背景

- 「比赛列表」即 [Matches.vue](../../../frontend/src/pages/index/Matches.vue)（在首页 tab 内渲染）。
- 管理员判断现有示例在 [pages/match/index.vue](../../../frontend/src/pages/match/index.vue)：
  ```ts
  const ADMIN = ["oc2fT5Oit4YpELFxpp2kTqSPKVis", "oc2fT5KZcBTUOm7Flb_OIwxIpKwk"];
  const isAdmin = ADMIN.includes(getToken());
  ```
- `Bet` 已有 `user`（→ `User.name`）关联；本设计新增 `match` 关联已在 Feature 1 之前由 `/api/my/bets` 引入。
- 本功能**依赖 Feature 1**（[2026-06-21-my-page-daily-grouping-design.md](2026-06-21-my-page-daily-grouping-design.md)）引入的 `dayKey`/`formatDay`（format.ts）与 `profitDisplay`（bet.ts），故应在 Feature 1 之后实现。

## 需求

1. 新增页面：按**比赛日期**分组，展示每个用户**当日净收益**。
2. 每个日期卡片：组头左侧日期、右侧「当日合计」（当日所有用户净收益之和），下面是「用户名 + 当日收益」的行。页面样式参照 Feature 1 的日卡片。
3. 收益口径：仅已结算（`result_profit` 非空）净盈亏；未结算不计入。
4. 入口：「比赛列表」右下角浮动按钮，**仅管理员可见**，点击进入该页面。
5. 管理员判断**仅在客户端**（白名单），不做服务端鉴权。

## 关键设计决策

| 决策点 | 选择 |
|---|---|
| 鉴权 | **仅客户端白名单**（前端隐藏入口/页面）；新接口无服务端鉴权，与现有 `/api/match/*` 一致 |
| 聚合位置 | **纯前端**：接口返回精简的已结算投注行，前端复用 `dayKey` 聚合（与 Feature 1 的本地时区分日一致、可单测） |
| 分组层级 | 日期 → 用户（按 openid 区分，展示 name） |
| 排序 | 日期倒序；组内用户按当日收益倒序 |
| 组头汇总 | 「当日合计」= 当日所有用户净收益之和 |

## 详细设计

### A. 前端工具

**`utils/admin.ts`（新建，仅做客户端鉴权）**
- `export const ADMIN_OPENIDS = ["oc2fT5Oit4YpELFxpp2kTqSPKVis", "oc2fT5KZcBTUOm7Flb_OIwxIpKwk"];`
- `export function isAdmin(): boolean { return ADMIN_OPENIDS.includes(getToken()); }`（`getToken` from `@/api`）
- 重构：[pages/match/index.vue](../../../frontend/src/pages/match/index.vue) 改为从此模块引入 `isAdmin`（白名单单点维护，消除重复）。

**`types.d.ts`（全局类型）**
```ts
declare interface AdminBetRow {
  openid: string;
  name: string;
  match_time: string;
  result_profit: string; // 已结算，非空
}
```

**`bet.ts`（聚合逻辑，不依赖 `@/api`，便于单测）**
```ts
export interface UserDayProfit { name: string; profit: string; }
export interface DailyUserProfit { date: string; total: string; users: UserDayProfit[]; }

export function groupUserDailyProfit(rows: AdminBetRow[]): DailyUserProfit[]
```
- 按 `dayKey(row.match_time)` 分组，组内按 `openid` 汇总 `result_profit`（Decimal），保留 `name`；
- `total` = 当日所有用户 `profit` 之和；
- 日期倒序；组内用户按 `profit` 倒序（Decimal 比较）。

### B. 后端接口

[routes.ts](../../../server/src/routes.ts)：新增 `GET /api/admin/daily-profit`（**无管理员鉴权**，与其他读接口一致）。
```ts
const bets = await Bet.findAll({
  where: { result_profit: { [Op.not]: null } }, // 仅已结算
  include: [
    { model: User, as: "user", attributes: ["name"] },
    { model: Match, as: "match", attributes: ["match_time"], required: true },
  ],
});
const data = bets.map((b) => ({
  openid: b.openid,
  name: b.user?.name ?? "",
  match_time: b.match!.match_time,
  result_profit: b.result_profit,
}));
reply.send({ code: 0, data });
```
- `Op` 从 `sequelize` 引入。
- 注册：`app.get("/api/admin/daily-profit", getDailyProfit);`

### C. 页面与入口

- **`pages/admin/daily/index.vue`（新建，非 tab 页）**：在 `pages.json` 注册（`navigationBarTitleText: "用户收益"`）。
  - `onShow`：`if (!isAdmin()) { uni.showToast({title:"无权限",icon:"none"}); uni.navigateBack(); return; }`（防御性，按钮本就仅管理员可见）；否则 `GET /api/admin/daily-profit` → `groupUserDailyProfit` → 渲染。
  - 网络异常 toast「网络异常，请重试」；空数据显示「暂无数据」。
- **`AdminDayCard.vue`（新建）**：prop `group: DailyUserProfit`。卡片：组头左 `formatDay(group.date)`、右 `profitDisplay(group.total)`（着色）；下面 `v-for` 用户行：左 `name`、右 `profitDisplay(profit)`（着色）。样式参照 `MyBetDayGroup`。
- **`Matches.vue`**：右下角浮动圆形按钮（`position: fixed`，`bottom` 需抬高避开底部 TabBar），`v-if="isAdmin()"`，点击 `uni.navigateTo({ url: "/pages/admin/daily/index" })`。

### D. 复用 Feature 1

- `dayKey` / `formatDay`（format.ts）、`profitDisplay`（bet.ts）。

## 安全说明

- `/api/admin/daily-profit` **无服务端鉴权**，仅前端按 `ADMIN_OPENIDS` 隐藏入口与页面。
- **已知风险（用户已确认接受）**：知道该 URL 的人可拉取全部用户的已结算收益数据。与现有客户端信任模式一致。

## 边界情况

- 无任何已结算投注 → 接口返回 `[]` → 页面「暂无数据」。
- 同名不同 `openid` → 按 `openid` 区分为两行。
- 前后端白名单为两处（前端 `ADMIN_OPENIDS`，本功能后端不涉及白名单）；前端白名单单点在 `utils/admin.ts`。

## 测试

- `bet.test.ts` 新增 `groupUserDailyProfit` 用例：空数组、单日单用户、单日多用户（按收益倒序）、同用户多笔累加、跨日（按日倒序）、当日合计、同名不同 openid 区分、跨年区分。

## 不做（YAGNI）

- 服务端管理员鉴权（按用户决定，仅客户端）。
- 顶部全期总计、按用户筛选、日期范围筛选。
- 未结算明细展示。

## 影响文件清单

**前端**
- `frontend/src/utils/admin.ts`（新建：`ADMIN_OPENIDS` + `isAdmin`）
- `frontend/src/utils/bet.ts`（新增 `groupUserDailyProfit` + 类型）
- `frontend/src/utils/bet.test.ts`（新增用例）
- `frontend/src/types.d.ts`（新增 `AdminBetRow`）
- `frontend/src/pages/admin/daily/index.vue`（新建）
- `frontend/src/pages/admin/daily/AdminDayCard.vue`（新建）
- `frontend/src/pages/index/Matches.vue`（浮动管理员按钮）
- `frontend/src/pages/match/index.vue`（改用 `utils/admin` 的 `isAdmin`）
- `frontend/src/pages.json`（注册新页）

**后端**
- `server/src/routes.ts`（新增 `getDailyProfit` + 注册路由）
