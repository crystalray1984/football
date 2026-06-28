# 大小球投注功能设计文档

> 日期：2026-06-28
> 目标：在现有「让球盘 + 胜平负」玩法框架上，新增第三种玩法 **大小球**（押两队总进球数高于/低于一个临界点），完成 **下注 + 详情页展示 + 共享口径函数支持**；不含后端自动结算（与让球/胜平负现状一致）。

## 背景

- 现有两种玩法：**让球盘**（`ah1/ah2`，常开）、**胜平负**（`win1/draw/win2`，`win_open` 控制）。核心纯函数集中在 [bet.ts](../../../frontend/src/utils/bet.ts)，有单测 [bet.test.ts](../../../frontend/src/utils/bet.test.ts)。
- **赔率口径**：后端所有赔率（含让球）都存 **欧赔（含本金）**，前端一律展示为 `欧赔 - 1`（亚赔），见 `displayOdds`。
- **结算算法**：让球用 `compareScore`（已支持半球/四分之一球盘的走盘、半赢半输），收益用 `getBetResult`。二者目前**只服务于详情页的「管理员模拟比分预览」**——仓库内没有把赛果写回 `result_profit` 的真实结算代码，真实结算由仓库外机制完成。
- **盘口字段已就绪**：[FMatch.ts](../../../server/src/db/models/FMatch.ts)（源表 `f_match`）已加 `ou_open / ou_condition / under_value / over_value`（commit `0d67085`）。
- **下注链路**：`BetSheet` 弹层 → `POST /api/bet` → 后端校验盘口/金额/限额 → 落 `f_bet`。下注接口读的是 **视图模型** [Match.ts](../../../server/src/db/models/Match.ts)（`v_f_match`），不是 `FMatch`。
- 仓库内无 `.sql`/迁移文件，`f_match` 表与 `v_f_match` 视图均**直接在数据库手动维护**。

## 需求

1. 详情页在「胜平负」区块之后新增「大小球」区块，由 `ou_open` 控制显隐（类比 `win_open`）。
2. 两个方向：**大（over）**、**小（under）**，盘口（临界点）展示在按钮上，形如「大 2.5/3 @0.95」「小 2.5/3 @0.88」。
3. 临界点支持 **整数（走盘退本）/ 半球 / 四分之一球（半赢半输）** 三种粒度，结算复用 `compareScore`，口径与让球统一。
4. 下注走现有 `/api/bet`，后端校验 `ou_open` 与盘口一致性，赔率取 `over_value/under_value`。
5. 为新增/改动的纯函数补单测；现有让球/胜平负用例不受影响。
6. **不做后端自动结算**——本次只让共享口径函数能正确计算大小球盈亏（供模拟预览与仓库外结算复用）。

## 关键设计决策

| 决策点 | 选择 |
|---|---|
| 范围 | 下注 + 展示 + 共享口径函数；**不新增后端自动结算**，与让球/胜平负现状对齐 |
| 实现方式 | **方案 A：扩展现有函数**，加 `over/under` 分支，跟随让球/胜平负模式（不重构、不另起独立模块） |
| 展示形式 | **盘口放进按钮**：标题「大小球」，按钮「大 {盘口} @{亚赔}」「小 {盘口} @{亚赔}」 |
| 盘口粒度 | **支持四分之一球**（与让球一致）；四分之一显示斜杠（`2.75→"2.5/3"`），结算复用 `compareScore` |
| 落库盘口 | `over`、`under` **都用 `ou_condition`**（临界点恒正、不取反——与让球 `ah2` 取反不同，因大小球两边共享同一临界点） |
| 下注校验 | 校验 `ou_open`（未开放报错）+ `condition === ou_condition`（变化则返回 `-2` 重下），跟随让球的防变化校验 |
| 盘口格式化 | 新增 `goalLine`（与 `handicap` 并列于 [format.ts](../../../frontend/src/utils/format.ts)）：恒正无符号，四分之一斜杠 |
| 前置依赖 | DB 内 `v_f_match` 视图需同步 SELECT 出四个大小球字段（**由用户在数据库完成**） |

## 详细设计

### A. 数据模型与全局类型

**后端视图模型** [Match.ts](../../../server/src/db/models/Match.ts)：补四个字段声明（与 `FMatch` 一致）。

```ts
@Column(DataType.TINYINT)  declare ou_open: number;
@Column(DataType.DECIMAL)  declare ou_condition: string;
@Column(DataType.DECIMAL)  declare under_value: string;
@Column(DataType.DECIMAL)  declare over_value: string;
```

**前端类型** [types.d.ts](../../../frontend/src/types.d.ts)：
- `MatchDetail` 补 `ou_open / ou_condition / under_value / over_value`；
- `BetRecord.type` 联合由 `"ah1" | "ah2" | "win1" | "win2" | "draw"` 扩为再加 `"over" | "under"`。

### B. 共享口径逻辑 [bet.ts](../../../frontend/src/utils/bet.ts)

- `BetType` 增加 `"over" | "under"`。
- 接口扩展：`MarketMatch` 补 `ou_condition`；`OddsMatch` 补 `over_value`、`under_value`。
- 新增判定：

```ts
export function isOverUnder(type: BetType): boolean {
  return type === "over" || type === "under";
}
```

- `oddsValue`：`over → over_value`，`under → under_value`。
- `betCondition`：`over`、`under` 都返回 `Decimal(match.ou_condition).toString()`（不取反）。
- `directionLabel`：`over → 大 ${goalLine(match.ou_condition)}`，`under → 小 ${goalLine(match.ou_condition)}`。
- `recordOddsText`：`over → 大小球 大 ${goalLine(bet.condition)} @${displayOdds(bet.value)}`，`under` 同理「小」。

**结算 `getBetResult`**：把现有结尾的 `draw` 兜底 `else` 改为显式分支，再加 `over/under`：

```ts
} else if (bet.type === "draw") {
  result_value = score1 === score2 ? "1" : "-1";
} else if (bet.type === "over") {
  result_value = compareScore(Decimal(score1).add(score2), bet.condition);
} else { // under
  result_value = compareScore(bet.condition, Decimal(score1).add(score2));
}
```

收益计算段（`switch(result_value)`）无需改动——大小球与让球共用同一套「半赢/全赢按 `(欧赔-1)×档位×本金`、走盘 0、半输/全输按 `档位×本金`」。

**结算口径表**（设总进球 `T = score1 + score2`，临界点 `C = ou_condition`；`compareScore` 按 delta = 前-后 分档：≥0.5 全赢 / ≥0.25 半赢 / =0 走盘 / ≤-0.25 半输 / ≤-0.5 全输）：

| 临界点 C | T | 大 over：`compareScore(T,C)` | 小 under：`compareScore(C,T)` |
|---|---|---|---|
| 2.5（半球） | 3 | delta=+0.5 → 全赢 | delta=-0.5 → 全输 |
| 2.5 | 2 | delta=-0.5 → 全输 | delta=+0.5 → 全赢 |
| 3.0（整数走盘） | 3 | delta=0 → 退本金 | delta=0 → 退本金 |
| 2.75（四分一） | 3 | delta=+0.25 → 半赢 | delta=-0.25 → 半输 |
| 2.75 | 2 | delta=-0.75 → 全输 | delta=+0.75 → 全赢 |
| 2.25（四分一） | 2 | delta=-0.25 → 半输 | delta=+0.25 → 半赢 |

### C. 盘口格式化 [format.ts](../../../frontend/src/utils/format.ts)

新增 `goalLine`（与 `handicap` 并列；恒正无符号，四分之一用斜杠）：

```ts
/** 大小球盘口展示：恒正、无符号；四分一球用斜杠（2.75 → "2.5/3"、2.25 → "2/2.5"） */
export function goalLine(condition: string | number | Decimal): string {
  if (Decimal(condition).mul(4).mod(2).eq(0)) {
    return Decimal(condition).toString();        // 整数 / 半球：2.5、3
  }
  return [Decimal(condition).sub("0.25"), Decimal(condition).add("0.25")]
    .map((t) => t.toString())
    .join("/");                                   // 四分一：2.5/3、2/2.5
}
```

### D. 后端下注接口 [routes.ts](../../../server/src/routes.ts) `bet()`

- `type` 联合类型加 `"over" | "under"`。
- 在现有「胜平负」分支之后、`else 无效投注` 之前插入大小球分支：

```ts
} else if (type === "over" || type === "under") {
  if (!match.ou_open) {
    reply.send({ code: -1, msg: "未开放大小球盘口" });
    return;
  }
  if (!Decimal(match.ou_condition).eq(condition)) {
    reply.send({ code: -2, msg: "比赛盘口已变化，重新下注" });
    return;
  }
  value = type === "over" ? match.over_value : match.under_value;
}
```

- 金额校验 / 比赛时间 / 单场限额 / 落库流程**完全不变**。

### E. 详情页 [match/index.vue](../../../frontend/src/pages/match/index.vue)

在「胜平负」`template` 之后新增「大小球」区块（两按钮，沿用让球区块样式）：

```html
<template v-if="match.ou_open">
  <view class="sec-head"><text class="sec-title"><text class="bar" />大小球</text></view>
  <view class="market">
    <view class="cell"><OddsButton :label="label('over')"  :value="odds('over')"  :disabled="!canBet()" @click="openBet('over')"  /></view>
    <view class="cell"><OddsButton :label="label('under')" :value="odds('under')" :disabled="!canBet()" @click="openBet('under')" /></view>
  </view>
</template>
```

`label`/`odds`/`openBet`/`onConfirm` 等辅助函数已是按 `BetType` 泛化的，无需改动（`betCondition` 已覆盖 over/under）。

### F. 投注弹层 [BetSheet.vue](../../../frontend/src/pages/match/BetSheet.vue)

- 引入 `isOverUnder`、`goalLine`。
- `group` 扩为三分支：

```ts
const group = computed<BetType[]>(() => {
  if (isAsian(props.type)) return ["ah1", "ah2"];
  if (isOverUnder(props.type)) return ["over", "under"];
  return ["win1", "draw", "win2"];
});
```

- 标题三态：`让球盘 / 大小球 / 胜平负`。
- 布局 class：仅胜平负是三按钮 `three`；大小球与让球同为两按钮（把模板里 `:class="{ three: !isAh }"` 改为「仅胜平负为 `three`」）。
- `subtitle`：大小球分支显示临界点，如 `${base} · 大小球 ${goalLine(props.match.ou_condition)}`。

## 边界情况

- `ou_open = 0` → 详情页不渲染大小球区块；后端下注直接拒绝（即便被绕过）。
- 下注瞬间临界点变化 → 后端 `condition !== ou_condition` 返回 `-2`，前端提示「盘口已变化，请重新下注」并刷新。
- 整数盘走盘（如 C=3、T=3）→ `result_value = "0"` → 退本金、净盈亏 0、判 `flat`。
- 四分之一球 → 半赢/半输由 `compareScore` 的 `0.5/-0.5` 档处理，收益为半额。
- 比赛未结束（`score` 为空）→ 不调用 `getBetResult`（与现有一致，仅 `has_score` 或模拟态计算）。

## 测试 [bet.test.ts](../../../frontend/src/utils/bet.test.ts)

- 测试夹具 `match` 补 `ou_condition`（如 `"2.5"`）、`over_value`、`under_value`。
- `directionLabel`：`over→"大 2.5"`、`under→"小 2.5"`（半球场景）；另加四分一夹具验证 `"大 2.5/3"`。
- `oddsValue`：`over→over_value`、`under→under_value`。
- `betCondition`：`over`、`under` 均返回 `ou_condition`（不取反）。
- `recordOddsText`：`over→"大小球 大 2.5 @..."`、`under→"大小球 小 2.5 @..."`。
- `goalLine`（[format.test.ts](../../../frontend/src/utils/format.test.ts)）：`2.5→"2.5"`、`3→"3"`、`2.75→"2.5/3"`、`2.25→"2/2.5"`。
- **`getBetResult` 大小球分支**：按上文「结算口径表」逐行覆盖（半球全赢/全输、整数走盘退本、四分一半赢/半输），并断言 `result_profit` 数值（如 C=2.5、T=3、over、欧赔 1.95、本金 100 → `+95`；四分一半赢为半额；走盘为 `0`）。

## 不做（YAGNI）

- 后端自动结算（按赛果回写 `result/result_profit`）——本次明确不含。
- 方案 B（玩法配置驱动重构）、方案 C（大小球独立模块）。
- 大小球的额外开关/限额规则（沿用现有 `min_bet/max_bet` 与单场限额）。

## 影响文件清单

**前端**
- `frontend/src/utils/bet.ts`（`BetType`、`isOverUnder`、`oddsValue`/`betCondition`/`directionLabel`/`recordOddsText`/`getBetResult` 分支、接口扩展）
- `frontend/src/utils/format.ts`（新增 `goalLine`）
- `frontend/src/utils/bet.test.ts`、`frontend/src/utils/format.test.ts`（新增用例）
- `frontend/src/types.d.ts`（`MatchDetail` 补字段、`BetRecord.type` 扩展）
- `frontend/src/pages/match/index.vue`（大小球区块）
- `frontend/src/pages/match/BetSheet.vue`（分组/标题/布局/副标题）

**后端**
- `server/src/db/models/Match.ts`（补四个字段声明）
- `server/src/routes.ts`（`bet()` 加 over/under 分支 + `type` 联合扩展）

**数据库（用户负责，非代码）**
- `v_f_match` 视图同步 SELECT 出 `ou_open / ou_condition / under_value / over_value` —— **交付前提**
