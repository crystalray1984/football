# 「排行」Tab 页设计文档

> 日期：2026-06-26
> 目标：新增一个**所有登录用户可见**的「排行」tab 页，展示全部参与下注人员的累计**收益**与**胜率**排行；后端预聚合，前端仅排序 + 渲染。

## 背景

- 现有 tabBar 仅两项：**主页**（[pages/index/index.vue](../../../frontend/src/pages/index/index.vue)）、**我的**（[pages/my/index.vue](../../../frontend/src/pages/my/index.vue)），见 [pages.json](../../../frontend/src/pages.json)。tabBar 图标为 `static/tabbar/` 下 81×81 PNG（普通灰 `#8a96ac` + 激活绿 `#19c37d` 各一张）。
- 数据模型 [Bet.ts](../../../server/src/db/models/Bet.ts)：`result`（整数，可空）、`result_profit`（金额字符串，可空）、`openid → User.name`（[User.ts](../../../server/src/db/models/User.ts)）。
- 既有读接口（`/api/match/*`、`/api/my/bets`、`/api/admin/daily-profit`）均**无服务端鉴权**；金额一律用 `decimal.js`，前后端均已安装。
- 复用既有展示约定：`profitDisplay`（[bet.ts](../../../frontend/src/utils/bet.ts)）做收益红绿/正负着色；空名兜底「匿名」（见 [BetRecord.vue](../../../frontend/src/pages/match/BetRecord.vue)）。

## 需求

1. 新增「排行」**tab 页**，位置：**主页 | 排行 | 我的**（排行居中）。
2. 表格**严格三列**：**名称、胜率、收益**（不加名次列、不做前三高亮）。
3. **口径**：仅统计**有效投注**（`Bet.result === 1` 或 `=== -1`）。
   - **胜率** = 胜数 / 有效数 × 100（`胜 = result===1`），为**百分比数值**（不含 `%`），保留 **1 位小数**。
   - **收益** = 有效投注的 `result_profit` 之和（Decimal 精确）。
   - 走水/平局（`result===0`）、未结算（`result===null`）**均不计入**两个指标。
4. **没有任何有效投注的人员不列出**。
5. 排序：**前端**进行，可在**胜率 / 收益**之间切换主排序指标，二者**恒为倒序**；默认 **收益倒序**。
6. **前端排序使用 `decimal.js`**；主指标相同则按**副指标**（收益主 → 胜率副；胜率主 → 收益副），副指标仍倒序；再相同按名称稳定。

## 关键设计决策

| 决策点 | 选择 |
|---|---|
| 鉴权 | **无服务端鉴权**，公开榜，与其他读接口一致；所有登录用户可见 |
| 聚合位置 | **后端预聚合**（方案 B）：接口返回**每人一行**的 `{ name, winRate, profit }`；前端不再聚合 |
| 胜率形态 | **后端预先算成百分比数值**（不含 `%`，1 位小数，如 `66.7`）；前端仅渲染拼 `%` |
| 收益形态 | **Decimal 字符串**（保留精度，复用 `profitDisplay`/`formatMoney`） |
| 后端聚合实现 | 取有效投注精简行后**在 JS 用 Decimal 聚合**（金额精确求和 + 条件计数简单，避免脆弱原生 SQL）；数据量增大后可改 SQL `GROUP BY`（YAGNI，暂不做） |
| 排序 | **纯前端**，Decimal 比较；可切主指标（胜率/收益），恒倒序；副指标兜底 + 名称稳定 |
| 表格列 | 严格 3 列（名称/胜率/收益），无名次、无前三着色 |

## 详细设计

### A. 后端接口 `GET /api/rank`

[routes.ts](../../../server/src/routes.ts)：新增 `getRank`（**无管理员鉴权**），注册 `app.get("/api/rank", getRank);`。`Op` 已从 `sequelize` 引入、`Decimal` 已引入。

```ts
async function getRank(_req: FastifyRequest, reply: FastifyReply) {
  const bets = await Bet.findAll({
    where: { result: { [Op.in]: [1, -1] } }, // 仅有效投注
    include: [{ model: User, as: "user", attributes: ["name"] }],
    attributes: ["openid", "result", "result_profit"],
  });

  // 按 openid 聚合（Decimal 精确）
  const map = new Map<
    string,
    { name: string; valid: number; win: number; profit: Decimal }
  >();
  for (const b of bets) {
    let u = map.get(b.openid);
    if (!u) {
      u = { name: b.user?.name ?? "", valid: 0, win: 0, profit: new Decimal(0) };
      map.set(b.openid, u);
    }
    u.valid += 1;
    if (b.result === 1) u.win += 1;
    u.profit = u.profit.add(b.result_profit ?? 0);
  }

  const data = [...map.entries()].map(([openid, u]) => ({
    openid,
    name: u.name,
    winRate: new Decimal(u.win).div(u.valid).mul(100).toDecimalPlaces(1).toNumber(),
    profit: u.profit.toString(),
  }));

  reply.send({ code: 0, data });
}
```

- 返回顺序无所谓（前端排序）。无有效投注的用户天然不在 `data` 中（行源即有效投注）。
- `valid` 恒 > 0（仅在出现有效投注时建条目），胜率无除零。

### B. 全局类型（types.d.ts）

```ts
/** 排行榜单行（后端预聚合） */
declare interface RankRow {
  openid: string;   // 用户 openid（前端列表行唯一 key）
  name: string;     // 用户昵称，可能为空
  winRate: number;  // 预计算百分比数值，不含 %，1 位小数（如 66.7）
  profit: string;   // 有效投注净收益之和（Decimal 字符串）
}
```

### C. 前端排序（bet.ts，纯函数、可单测）

```ts
export type RankSortKey = "profit" | "winRate";

/** 排行排序：恒倒序；主指标相同按副指标倒序，再相同按 name 稳定。不改入参。 */
export function sortRanking(rows: RankRow[], sortKey: RankSortKey): RankRow[]
```

- 复制后排序，不修改入参数组。
- 全程用 `Decimal.comparedTo` 比较：降序用 `new Decimal(b.x).comparedTo(a.x)`。
- `sortKey === "profit"`：收益↓ → 收益相同则胜率↓ → 再相同 `a.name.localeCompare(b.name)`。
- `sortKey === "winRate"`：胜率↓ → 胜率相同则收益↓ → 再相同 `a.name.localeCompare(b.name)`。

### D. 百分比格式化（format.ts）

```ts
/** 百分比渲染：保留 1 位小数并拼 %（如 66.7 → "66.7%"，50 → "50.0%"） */
export function formatPercent(n: number): string  // new Decimal(n).toFixed(1) + "%"
```

### E. 页面 `pages/rank/index.vue`（新 tab）

- `onShow`：`GET /api/rank` → `rows: RankRow[]`；`sortKey` 默认 `"profit"`。
- `computed sorted = sortRanking(rows, sortKey)`。
- 列头三栏：名称 / **胜率**（可点） / **收益**（可点）；点击切换 `sortKey`，当前主排序项加 `▼` 高亮（恒倒序，不切升降）。
- 行：左 **名称**（空兜底「匿名」）；中 **胜率** `formatPercent(winRate)`；右 **收益** `profitDisplay(profit)`（着色）。
- 空数据 → 「暂无数据」；网络异常 → toast「网络异常，请重试」。
- 样式复用 [tokens.scss](../../../frontend/src/styles/tokens.scss) 卡片/分隔风格，参照 [AdminDayCard.vue](../../../frontend/src/pages/admin/daily/AdminDayCard.vue) 行布局。表格用单个 `index.vue` 即可，无需拆子组件。

### F. tabBar 接入（pages.json）

- `pages` 数组新增：`{ "path": "pages/rank/index", "style": { "navigationBarTitleText": "排行" } }`。
- `tabBar.list` **中间**插入：
  ```json
  { "pagePath": "pages/rank/index", "text": "排行",
    "iconPath": "static/tabbar/rank.png",
    "selectedIconPath": "static/tabbar/rank-active.png" }
  ```

### G. tab 图标

- 新建 `static/tabbar/rank.png`（`#8a96ac`）、`rank-active.png`（`#19c37d`），**81×81**，柱状/领奖台图形，风格对齐现有 home/mine。
- 本机无 PIL/ImageMagick：用**纯 Python（zlib + struct 手写最小 PNG）** 生成，无需第三方库。

## 边界情况

- 全员无有效投注 → 接口返回 `[]` → 页面「暂无数据」。
- 同名不同 `openid` → 后端按 `openid` 聚合为两行（各自 `name`）。
- 空 `name` → 后端返回 `""`，前端兜底「匿名」。
- `result` 仅 `{1,-1}` 入聚合；`result===1` 判胜，其余有效投注为负。
- 胜率分母恒 > 0；胜率/收益经四舍五入后相同时由副指标 + 名称决定稳定顺序。

## 测试

- `bet.test.ts` 新增 `sortRanking`：空数组；单人；**收益主排序**（倒序）+ 收益相同按胜率副；**胜率主排序** + 胜率相同按收益副；主副都相同按名称稳定；Decimal 精度（如 `"0.1"+"0.2"` 不丢精度比较）；不改入参数组。
- `format.test.ts` 新增 `formatPercent`：`66.7→"66.7%"`、`50→"50.0%"`、`100→"100.0%"`、`0→"0.0%"`。

## 不做（YAGNI）

- 服务端鉴权（公开榜）。
- 名次列 / 前三高亮（按用户定：严格三列）。
- 升/降序切换（只切主指标，恒倒序）。
- 分页 / 关键字筛选 / 时间范围 / 投注次数列。
- 后端 SQL `GROUP BY` 聚合（先 JS 聚合，数据量大再优化）。

## 影响文件清单

**前端**
- `frontend/src/utils/bet.ts`（新增 `sortRanking` + `RankSortKey`）
- `frontend/src/utils/bet.test.ts`（新增用例）
- `frontend/src/utils/format.ts`（新增 `formatPercent`）
- `frontend/src/utils/format.test.ts`（新增用例）
- `frontend/src/types.d.ts`（新增 `RankRow`）
- `frontend/src/pages/rank/index.vue`（新建）
- `frontend/src/pages.json`（注册页 + tabBar 项）
- `frontend/src/static/tabbar/rank.png`、`rank-active.png`（新建图标）

**后端**
- `server/src/routes.ts`（新增 `getRank` + 注册路由）
