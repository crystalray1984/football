# 大小球投注功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有让球盘与胜平负框架内新增大小球玩法，完整支持盘口展示、投注、记录文案和共享结算口径，同时保持既有玩法行为不变。

**Architecture:** 沿用现有 `BetType`、`bet.ts` 纯函数、`POST /api/bet` 与比赛详情页，不引入玩法配置层或独立大小球模块。前端把 over/under 作为第三组投注方向，后端从 `v_f_match` 读取大小球字段并校验开关与盘口；结算继续复用 `compareScore`，因此整数、半球和四分之一球与让球共用同一收益档位。

**Tech Stack:** uni-app（Vue 3 + TypeScript，mp-weixin）、Vitest、`decimal.js`；Fastify 5、sequelize-typescript、PostgreSQL；Yarn 1。

## Global Constraints

- 所有面向用户的文案、注释和提交说明使用简体中文。
- 实现方式固定为方案 A：扩展现有函数与页面，不重构为配置驱动，也不新建独立大小球模块。
- `BetType` 新增且仅新增 `"over" | "under"`；按钮与记录文案固定使用「大小球」「大」「小」。
- 后端赔率均为含本金欧赔；前端展示统一调用 `displayOdds`，显示值为 `欧赔 - 1`，落库仍保存原始欧赔。
- over 与 under 的落库 `condition` 都是 `Decimal(match.ou_condition).toString()`，恒正且不取反。
- 盘口必须支持整数、半球、四分之一球；四分之一球以斜杠显示，如 `2.75 → "2.5/3"`、`2.25 → "2/2.5"`。
- 大小球收益必须复用 `compareScore` 和 `getBetResult` 现有收益段，不另写一套收益公式。
- 后端必须先校验 `ou_open`，再用 Decimal 校验请求 `condition === ou_condition`；关闭时返回 `{ code: -1, msg: "未开放大小球盘口" }`，盘口变化时返回 `{ code: -2, msg: "比赛盘口已变化，重新下注" }`。
- 金额校验、比赛时间校验、单场限额和 `f_bet` 落库流程保持不变；不增加大小球专属限额或开关。
- 不实现后端自动结算，不写回 `result` / `result_profit`；本次只扩展共享口径函数供管理员模拟和仓库外结算复用。
- 不新增 npm 依赖，不新增 SQL/迁移文件。`f_match` 字段已经存在；`v_f_match` 必须由用户在数据库中手工暴露 `ou_open / ou_condition / under_value / over_value`，这是运行时验收前置条件。
- 每个纯函数改动先写失败测试；提交前必须通过前端全量 Vitest、前端 mp-weixin 构建和后端 TypeScript 构建。

---

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `frontend/src/utils/format.ts` | 提供无符号大小球盘口格式化 `goalLine` | 修改 |
| `frontend/src/utils/format.test.ts` | 覆盖整数、半球和两种四分之一球格式 | 修改 |
| `frontend/src/utils/bet.ts` | 扩展投注类型、方向/赔率/盘口/记录文案和大小球结算 | 修改 |
| `frontend/src/utils/bet.test.ts` | 覆盖大小球共享口径与全部结算档位 | 修改 |
| `frontend/src/types.d.ts` | 扩展 `MatchDetail` 与 `BetRecord.type` | 修改 |
| `server/src/db/models/Match.ts` | 声明 `v_f_match` 暴露的四个大小球字段 | 修改 |
| `server/src/routes.ts` | 允许 over/under，并校验开关、盘口和赔率来源 | 修改 |
| `frontend/src/pages/match/index.vue` | 在胜平负后展示大小球市场并打开投注弹层 | 修改 |
| `frontend/src/pages/match/BetSheet.vue` | 支持大小球分组、标题、双按钮布局和副标题 | 修改 |

依赖顺序：Task 1 产出 `goalLine` → Task 2 产出完整市场口径与类型 → Task 3 扩展结算 → Task 4 接通后端下注 → Task 5 接通页面与弹层 → Task 6 全链路验收。

---

### Task 1: `goalLine` 大小球盘口格式化

**Files:**
- Modify: `frontend/src/utils/format.ts:20-32`
- Test: `frontend/src/utils/format.test.ts:1-57`

**Interfaces:**
- Consumes: 已安装的 `Decimal`，入参类型 `string | number | Decimal`。
- Produces: `export function goalLine(condition: string | number | Decimal): string`；整数/半球返回规范十进制字符串，四分之一球返回相邻半球盘口的斜杠形式。

- [ ] **Step 1: 写失败测试**

把 `frontend/src/utils/format.test.ts` 的 import 块替换为：

```ts
import { describe, expect, it } from "vitest";
import {
  dayKey,
  formatDay,
  formatHandicap,
  formatMatchTime,
  formatMoney,
  formatPercent,
  formatTime,
  goalLine,
  matchStatusText,
} from "./format";
```

在文件末尾追加：

```ts
describe("goalLine", () => {
  it("半球保持单一数字", () => expect(goalLine("2.5")).toBe("2.5"));
  it("整数保持单一数字", () => expect(goalLine("3")).toBe("3"));
  it("2.75 显示为 2.5/3", () => expect(goalLine("2.75")).toBe("2.5/3"));
  it("2.25 显示为 2/2.5", () => expect(goalLine("2.25")).toBe("2/2.5"));
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd /Users/crystal/Documents/Projects/football/frontend && yarn test src/utils/format.test.ts`

Expected: FAIL，Vitest 报告 `goalLine` 未从 `./format` 导出。

- [ ] **Step 3: 实现最小格式化函数**

在 `frontend/src/utils/format.ts` 的 `handicap` 函数之后新增：

```ts
/**
 * 大小球盘口展示：恒正、无符号；四分一球用斜杠
 * （2.75 → "2.5/3"、2.25 → "2/2.5"）。
 */
export function goalLine(condition: string | number | Decimal): string {
  if (Decimal(condition).mul(4).mod(2).eq(0)) {
    return Decimal(condition).toString();
  }
  return [Decimal(condition).sub("0.25"), Decimal(condition).add("0.25")]
    .map((t) => t.toString())
    .join("/");
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd /Users/crystal/Documents/Projects/football/frontend && yarn test src/utils/format.test.ts`

Expected: PASS，`format.test.ts` 共 25 条测试通过。

- [ ] **Step 5: 提交**

```bash
cd /Users/crystal/Documents/Projects/football
git add frontend/src/utils/format.ts frontend/src/utils/format.test.ts
git commit -m "feat: 新增大小球盘口格式化"
```

---

### Task 2: 大小球类型与共享市场口径

**Files:**
- Modify: `frontend/src/types.d.ts:65-100`
- Modify: `frontend/src/utils/bet.ts:1-118`
- Test: `frontend/src/utils/bet.test.ts:1-88`

**Interfaces:**
- Consumes: Task 1 的 `goalLine(condition): string`；现有 `displayOdds(value): string`、`handicap(condition): string`。
- Produces:
  - `BetType = "ah1" | "ah2" | "win1" | "win2" | "draw" | "over" | "under"`。
  - `isOverUnder(type: BetType): boolean`。
  - `MarketMatch` 新增 `ou_condition: string`；`OddsMatch` 新增 `over_value: string`、`under_value: string`。
  - `MatchDetail` 新增 `ou_open / ou_condition / under_value / over_value`。
  - `directionLabel`、`oddsValue`、`betCondition`、`recordOddsText` 对 over/under 有显式分支。

- [ ] **Step 1: 写失败测试**

把 `frontend/src/utils/bet.test.ts` 顶部 import 块替换为：

```ts
import { describe, expect, it } from "vitest";
import {
  betCondition,
  directionLabel,
  displayOdds,
  groupBetsByDay,
  groupUserDailyProfit,
  isOverUnder,
  MAX_BET,
  MIN_BET,
  oddsValue,
  potentialWin,
  profitDisplay,
  recordOddsText,
  settlement,
  sortRanking,
  sumSettledProfit,
  validateAmount,
} from "./bet";
```

把测试夹具替换为：

```ts
// 注意：后端所有赔率（含让球）均存欧赔（含本金），前端一律展示为 欧赔-1（亚赔）
const match = {
  team1_name: "曼城",
  team2_name: "利物浦",
  ah_condition: "-0.5",
  ah1_value: "1.95",
  ah2_value: "1.88",
  win1_value: "2.10",
  win2_value: "3.05",
  draw_value: "3.20",
  ou_condition: "2.5",
  over_value: "1.95",
  under_value: "1.88",
};
```

在夹具后追加：

```ts
describe("isOverUnder", () => {
  it("over 是大小球", () => expect(isOverUnder("over")).toBe(true));
  it("under 是大小球", () => expect(isOverUnder("under")).toBe(true));
  it("让球不是大小球", () => expect(isOverUnder("ah1")).toBe(false));
  it("胜平负不是大小球", () => expect(isOverUnder("draw")).toBe(false));
});
```

在现有 `describe("directionLabel")` 中追加：

```ts
it("大球显示方向与半球盘口", () =>
  expect(directionLabel("over", match)).toBe("大 2.5"));
it("小球显示方向与半球盘口", () =>
  expect(directionLabel("under", match)).toBe("小 2.5"));
it("四分之一球显示斜杠盘口", () =>
  expect(directionLabel("over", { ...match, ou_condition: "2.75" })).toBe("大 2.5/3"));
```

在现有 `describe("oddsValue")` 中追加：

```ts
it("over 返回大球原始欧赔", () => expect(oddsValue("over", match)).toBe("1.95"));
it("under 返回小球原始欧赔", () => expect(oddsValue("under", match)).toBe("1.88"));
```

在现有 `describe("betCondition")` 中追加：

```ts
it("over 使用同一个大小球临界点", () =>
  expect(betCondition("over", match)).toBe("2.5"));
it("under 使用同一个大小球临界点且不取反", () =>
  expect(betCondition("under", match)).toBe("2.5"));
```

在现有 `describe("recordOddsText")` 中追加：

```ts
it("大球记录显示盘口与亚赔", () =>
  expect(recordOddsText({ type: "over", condition: "2.5", value: "1.95" }, match)).toBe(
    "大小球 大 2.5 @0.95",
  ));
it("小球记录显示盘口与亚赔", () =>
  expect(recordOddsText({ type: "under", condition: "2.5", value: "1.88" }, match)).toBe(
    "大小球 小 2.5 @0.88",
  ));
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd /Users/crystal/Documents/Projects/football/frontend && yarn test src/utils/bet.test.ts`

Expected: FAIL，首先报告 `isOverUnder` 未导出；新增 over/under 断言尚未获得对应结果。

- [ ] **Step 3: 扩展全局接口类型**

把 `frontend/src/types.d.ts` 的 `MatchDetail` 与 `BetRecord` 声明替换为：

```ts
/**
 * 比赛详情（含盘口）
 */
declare interface MatchDetail extends Match {
  /** 让球数（主队） */
  ah_condition: string;
  /** 让球主队水位 */
  ah1_value: string;
  /** 让球客队水位 */
  ah2_value: string;
  /** 是否开放胜平负 1/0 */
  win_open: number;
  /** 主胜赔率 */
  win1_value: string;
  /** 客胜赔率 */
  win2_value: string;
  /** 平局赔率 */
  draw_value: string;
  /** 是否开放大小球 1/0 */
  ou_open: number;
  /** 大小球临界点 */
  ou_condition: string;
  /** 小球赔率 */
  under_value: string;
  /** 大球赔率 */
  over_value: string;
}

/**
 * 投注记录
 */
declare interface BetRecord {
  id: number;
  type: "ah1" | "ah2" | "win1" | "win2" | "draw" | "over" | "under";
  /** 盘口 */
  condition: string;
  /** 赔率 */
  value: string;
  /** 投注金额 */
  amount: string;
  /** 赛果（结算后非空） */
  result: number | null;
  /** 结算净盈亏（未结算为 null） */
  result_profit: string | null;
  /** 投注人 */
  user?: { name: string };
}
```

- [ ] **Step 4: 扩展共享市场函数**

把 `frontend/src/utils/bet.ts` 顶部 import、`BetType` 和两个内部接口替换为：

```ts
import Decimal from "decimal.js";
import { dayKey, formatMoney, goalLine, handicap } from "./format";

export type BetType =
  | "ah1"
  | "ah2"
  | "win1"
  | "win2"
  | "draw"
  | "over"
  | "under";

export const MIN_BET = 50;
export const MAX_BET = 500;

interface MarketMatch {
  team1_name: string;
  team2_name: string;
  ah_condition: string;
  ou_condition: string;
}

interface OddsMatch {
  ah1_value: string;
  ah2_value: string;
  win1_value: string;
  win2_value: string;
  draw_value: string;
  over_value: string;
  under_value: string;
}
```

在 `isAsian` 后新增：

```ts
/**
 * 是否大小球
 */
export function isOverUnder(type: BetType): boolean {
  return type === "over" || type === "under";
}
```

把 `directionLabel` 替换为：

```ts
export function directionLabel(type: BetType, match: MarketMatch): string {
  switch (type) {
    case "ah1":
      return `${match.team1_name} ${handicap(match.ah_condition)}`;
    case "ah2":
      return `${match.team2_name} ${handicap(
        new Decimal(0).sub(match.ah_condition),
      )}`;
    case "win1":
      return match.team1_name;
    case "win2":
      return match.team2_name;
    case "over":
      return `大 ${goalLine(match.ou_condition)}`;
    case "under":
      return `小 ${goalLine(match.ou_condition)}`;
    default:
      return "平局";
  }
}
```

把 `oddsValue` 替换为：

```ts
export function oddsValue(type: BetType, match: OddsMatch): string {
  switch (type) {
    case "ah1":
      return match.ah1_value;
    case "ah2":
      return match.ah2_value;
    case "win1":
      return match.win1_value;
    case "win2":
      return match.win2_value;
    case "over":
      return match.over_value;
    case "under":
      return match.under_value;
    default:
      return match.draw_value;
  }
}
```

把 `betCondition` 替换为：

```ts
/**
 * 下注 condition：ah1=让球数；ah2=取反；
 * over/under=相同大小球临界点；胜平负="0" 占位。
 */
export function betCondition(type: BetType, match: MarketMatch): string {
  if (type === "ah1") return new Decimal(match.ah_condition).toString();
  if (type === "ah2") return new Decimal(0).sub(match.ah_condition).toString();
  if (isOverUnder(type)) return new Decimal(match.ou_condition).toString();
  return "0";
}
```

把 `recordOddsText` 替换为：

```ts
export function recordOddsText(
  bet: { type: BetType; condition: string; value: string },
  match: { team1_name: string; team2_name: string },
): string {
  switch (bet.type) {
    case "ah1":
      return `让球 ${match.team1_name} ${handicap(bet.condition)} @${displayOdds(bet.value)}`;
    case "ah2":
      return `让球 ${match.team2_name} ${handicap(bet.condition)} @${displayOdds(bet.value)}`;
    case "win1":
      return `${match.team1_name} 胜 @${displayOdds(bet.value)}`;
    case "win2":
      return `${match.team2_name} 胜 @${displayOdds(bet.value)}`;
    case "over":
      return `大小球 大 ${goalLine(bet.condition)} @${displayOdds(bet.value)}`;
    case "under":
      return `大小球 小 ${goalLine(bet.condition)} @${displayOdds(bet.value)}`;
    default:
      return `平局 @${displayOdds(bet.value)}`;
  }
}
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `cd /Users/crystal/Documents/Projects/football/frontend && yarn test src/utils/bet.test.ts`

Expected: PASS，`bet.test.ts` 共 72 条测试通过；原有让球和胜平负断言仍通过。

- [ ] **Step 6: 提交**

```bash
cd /Users/crystal/Documents/Projects/football
git add frontend/src/types.d.ts frontend/src/utils/bet.ts frontend/src/utils/bet.test.ts
git commit -m "feat: 扩展大小球共享市场口径"
```

---

### Task 3: 大小球共享结算

**Files:**
- Modify: `frontend/src/utils/bet.ts:156-176`
- Test: `frontend/src/utils/bet.test.ts`

**Interfaces:**
- Consumes: Task 2 的 over/under 类型；现有 `compareScore(score1, score2)` 与 `getBetResult` 收益 switch。
- Produces: `getBetResult` 对 over 使用 `compareScore(score1 + score2, condition)`，对 under 使用 `compareScore(condition, score1 + score2)`；返回结构仍为 `{ state, result_profit, text }`。

- [ ] **Step 1: 写覆盖全部结算档位的失败测试**

在 `frontend/src/utils/bet.test.ts` 顶部现有 import 列表加入 `getBetResult`：

```ts
import {
  betCondition,
  directionLabel,
  displayOdds,
  getBetResult,
  groupBetsByDay,
  groupUserDailyProfit,
  isOverUnder,
  MAX_BET,
  MIN_BET,
  oddsValue,
  potentialWin,
  profitDisplay,
  recordOddsText,
  settlement,
  sortRanking,
  sumSettledProfit,
  validateAmount,
} from "./bet";
```

在 `recordOddsText` 测试块之后追加：

```ts
describe("getBetResult 大小球", () => {
  const cases: Array<{
    name: string;
    type: "over" | "under";
    condition: string;
    score1: number;
    score2: number;
    expected: {
      state: "win" | "loss" | "flat";
      result_profit: string;
      text: string;
    };
  }> = [
    {
      name: "2.5 盘总进球 3：大球全赢",
      type: "over",
      condition: "2.5",
      score1: 2,
      score2: 1,
      expected: { state: "win", result_profit: "95", text: "+95" },
    },
    {
      name: "2.5 盘总进球 3：小球全输",
      type: "under",
      condition: "2.5",
      score1: 2,
      score2: 1,
      expected: { state: "loss", result_profit: "-100", text: "-100" },
    },
    {
      name: "2.5 盘总进球 2：大球全输",
      type: "over",
      condition: "2.5",
      score1: 1,
      score2: 1,
      expected: { state: "loss", result_profit: "-100", text: "-100" },
    },
    {
      name: "2.5 盘总进球 2：小球全赢",
      type: "under",
      condition: "2.5",
      score1: 1,
      score2: 1,
      expected: { state: "win", result_profit: "95", text: "+95" },
    },
    {
      name: "3 盘总进球 3：大球走盘",
      type: "over",
      condition: "3",
      score1: 2,
      score2: 1,
      expected: { state: "flat", result_profit: "0", text: "0" },
    },
    {
      name: "3 盘总进球 3：小球走盘",
      type: "under",
      condition: "3",
      score1: 2,
      score2: 1,
      expected: { state: "flat", result_profit: "0", text: "0" },
    },
    {
      name: "2.75 盘总进球 3：大球半赢",
      type: "over",
      condition: "2.75",
      score1: 2,
      score2: 1,
      expected: { state: "win", result_profit: "47.5", text: "+47.5" },
    },
    {
      name: "2.75 盘总进球 3：小球半输",
      type: "under",
      condition: "2.75",
      score1: 2,
      score2: 1,
      expected: { state: "loss", result_profit: "-50", text: "-50" },
    },
    {
      name: "2.75 盘总进球 2：大球全输",
      type: "over",
      condition: "2.75",
      score1: 1,
      score2: 1,
      expected: { state: "loss", result_profit: "-100", text: "-100" },
    },
    {
      name: "2.75 盘总进球 2：小球全赢",
      type: "under",
      condition: "2.75",
      score1: 1,
      score2: 1,
      expected: { state: "win", result_profit: "95", text: "+95" },
    },
    {
      name: "2.25 盘总进球 2：大球半输",
      type: "over",
      condition: "2.25",
      score1: 1,
      score2: 1,
      expected: { state: "loss", result_profit: "-50", text: "-50" },
    },
    {
      name: "2.25 盘总进球 2：小球半赢",
      type: "under",
      condition: "2.25",
      score1: 1,
      score2: 1,
      expected: { state: "win", result_profit: "47.5", text: "+47.5" },
    },
  ];

  it.each(cases)("$name", ({ type, condition, score1, score2, expected }) => {
    expect(
      getBetResult(
        { type, condition, amount: "100", value: "1.95" },
        score1,
        score2,
      ),
    ).toEqual(expected);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd /Users/crystal/Documents/Projects/football/frontend && yarn test src/utils/bet.test.ts`

Expected: FAIL；旧实现把 over/under 落入平局兜底，至少「大球全赢」「整数走盘」「四分之一半赢/半输」断言失败。

- [ ] **Step 3: 实现大小球结算分支**

把 `frontend/src/utils/bet.ts` 中 `getBetResult` 的投注类型判断替换为：

```ts
  // 确认投注类型
  if (bet.type === "ah1") {
    // 让球，买主队
    result_value = compareScore(Decimal(score1).add(bet.condition), score2);
  } else if (bet.type === "ah2") {
    // 让球，买客队
    result_value = compareScore(Decimal(score2).add(bet.condition), score1);
  } else if (bet.type === "win1") {
    result_value = score1 > score2 ? "1" : "-1";
  } else if (bet.type === "win2") {
    result_value = score1 < score2 ? "1" : "-1";
  } else if (bet.type === "draw") {
    result_value = score1 === score2 ? "1" : "-1";
  } else if (bet.type === "over") {
    result_value = compareScore(Decimal(score1).add(score2), bet.condition);
  } else {
    // under：临界点减总进球，方向与 over 相反
    result_value = compareScore(bet.condition, Decimal(score1).add(score2));
  }
```

不要修改其后的胜负状态与收益 switch；`"0.5" / "1" / "0" / "-0.5" / "-1"` 已分别覆盖半赢、全赢、走盘、半输、全输。

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd /Users/crystal/Documents/Projects/football/frontend && yarn test src/utils/bet.test.ts`

Expected: PASS，`bet.test.ts` 共 84 条测试通过，其中新增 12 条逐项覆盖设计文档结算口径表。

- [ ] **Step 5: 提交**

```bash
cd /Users/crystal/Documents/Projects/football
git add frontend/src/utils/bet.ts frontend/src/utils/bet.test.ts
git commit -m "feat: 支持大小球共享结算"
```

---

### Task 4: 后端视图模型与大小球下注校验

**Files:**
- Modify: `server/src/routes.ts:383-489`
- Modify: `server/src/db/models/Match.ts:79-93`

**Interfaces:**
- Consumes: 数据库视图 `v_f_match` 的 `ou_open: number`、`ou_condition: string`、`over_value: string`、`under_value: string`。
- Produces: `POST /api/bet` 接受 `type: "over" | "under"`；成功时写入共享正盘口和对应欧赔，关闭或盘口变化时按全局约束返回固定错误。

- [ ] **Step 1: 先扩展路由，让 TypeScript 暴露缺失模型字段**

把 `server/src/routes.ts` 中请求体的 type 声明替换为：

```ts
  const { match_id, type, amount, condition } = req.body as {
    match_id: number;
    type: "ah1" | "ah2" | "win1" | "win2" | "draw" | "over" | "under";
    amount: number;
    condition: string;
  };
```

把现有胜平负分支末尾到无效投注分支替换为：

```ts
  } else if (["win1", "win2", "draw"].includes(type)) {
    if (!match.win_open) {
      reply.send({
        code: -1,
        msg: "未开放胜平负盘口",
      });
      return;
    }
    switch (type) {
      case "win1":
        value = match.win1_value;
        break;
      case "win2":
        value = match.win2_value;
        break;
      default:
        value = match.draw_value;
        break;
    }
  } else if (type === "over" || type === "under") {
    if (!match.ou_open) {
      reply.send({
        code: -1,
        msg: "未开放大小球盘口",
      });
      return;
    }
    if (!Decimal(match.ou_condition).eq(condition)) {
      reply.send({
        code: -2,
        msg: "比赛盘口已变化，重新下注",
      });
      return;
    }
    value = type === "over" ? match.over_value : match.under_value;
  } else {
    reply.send({
      code: -1,
      msg: "无效投注",
    });
    return;
  }
```

- [ ] **Step 2: 运行后端构建，确认模型契约尚未满足**

Run: `cd /Users/crystal/Documents/Projects/football/server && yarn build`

Expected: FAIL，`tsc` 报告 `Match` 上不存在 `ou_open / ou_condition / over_value / under_value` 属性（TS2339，形如 `Property 'ou_condition' does not exist on type 'Match'`）；诊断均指向 `routes.ts` 新增大小球分支引用了尚未补齐的 `Match` 字段。

- [ ] **Step 3: 补齐 `v_f_match` 模型声明**

在 `server/src/db/models/Match.ts` 的 `draw_value` 字段之后、class 结束之前新增：

```ts
  /**
   * 是否开启大小球投注
   */
  @Column(DataType.TINYINT)
  declare ou_open: number;

  /**
   * 大小球临界点
   */
  @Column(DataType.DECIMAL)
  declare ou_condition: string;

  /**
   * 大小球小球赔率（欧赔）
   */
  @Column(DataType.DECIMAL)
  declare under_value: string;

  /**
   * 大小球大球赔率（欧赔）
   */
  @Column(DataType.DECIMAL)
  declare over_value: string;
```

- [ ] **Step 4: 运行后端构建，确认通过**

Run: `cd /Users/crystal/Documents/Projects/football/server && yarn build`

Expected: PASS，`tsc` 退出码为 0；`Bet.create` 继续收到原有 `match_id / openid / type / value / amount / condition` 结构。

- [ ] **Step 5: 提交**

```bash
cd /Users/crystal/Documents/Projects/football
git add server/src/db/models/Match.ts server/src/routes.ts
git commit -m "feat: 接入大小球下注校验"
```

---

### Task 5: 详情页大小球市场与投注弹层

**Files:**
- Modify: `frontend/src/pages/match/index.vue:4-13,227-257`
- Modify: `frontend/src/pages/match/BetSheet.vue:1-105`

**Interfaces:**
- Consumes: Task 2 的 `BetType`、`isOverUnder`、`directionLabel`、`oddsValue`、`betCondition`，Task 1 的 `goalLine`，以及 `MatchDetail.ou_*`。
- Produces:
  - 详情页仅在 `match.ou_open` 为真时，于胜平负后显示 over/under 双按钮。
  - 弹层组为 `["over", "under"]`，标题为「投注 · 大小球」，双列布局，副标题包含共享临界点。
  - 确认仍发往现有 `onConfirm`，无需新增 API 调用函数。

> 项目当前没有 Vue 组件测试依赖或 DOM 测试环境。本任务保持依赖零增长，以 mp-weixin 构建作为自动门槛，并在 Task 6 用微信开发者工具做真实交互验收。

- [ ] **Step 1: 扩展 BetSheet 的分组与展示状态**

把 `frontend/src/pages/match/BetSheet.vue` 的整个 `<script setup lang="ts">` 块替换为：

```vue
<script setup lang="ts">
import {
  directionLabel,
  displayOdds,
  isAsian,
  isOverUnder,
  oddsValue,
  potentialWin,
  validateAmount,
  type BetType,
} from "@/utils/bet";
import { goalLine, handicap } from "@/utils/format";
import { computed, ref, watch } from "vue";
import OddsButton from "./OddsButton.vue";

const props = defineProps<{
  visible: boolean;
  match: MatchDetail;
  /** 唤起时点击的方向 */
  type: BetType;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [{ type: BetType; amount: number }];
}>();

const quickAmounts = [50, 100, 200, 500];

const selected = ref<BetType>(props.type);
const amountInput = ref("");

// 弹层不持有盘口数据，直接读页面（轮询源）的 props.match，盘口/赔率跟随页面实时更新
watch(
  () => props.visible,
  (v) => {
    if (v) {
      selected.value = props.type;
      amountInput.value = "";
    }
  },
);

/** 该弹层展示的方向组 */
const group = computed<BetType[]>(() => {
  if (isAsian(props.type)) return ["ah1", "ah2"];
  if (isOverUnder(props.type)) return ["over", "under"];
  return ["win1", "draw", "win2"];
});
const isAh = computed(() => isAsian(props.type));
const isOu = computed(() => isOverUnder(props.type));
const isThree = computed(() => !isAh.value && !isOu.value);
const title = computed(() => {
  if (isAh.value) return "让球盘";
  if (isOu.value) return "大小球";
  return "胜平负";
});

const amount = computed(() => parseInt(amountInput.value || "0", 10) || 0);
const valid = computed(() => validateAmount(amount.value));
const win = computed(() =>
  potentialWin(amount.value, oddsValue(selected.value, props.match)),
);

const subtitle = computed(() => {
  const base = `${props.match.team1_name} VS ${props.match.team2_name}`;
  if (isAh.value) {
    return `${base} · 让球 ${props.match.team1_name} ${handicap(
      props.match.ah_condition,
    )}`;
  }
  if (isOu.value) {
    return `${base} · 大小球 ${goalLine(props.match.ou_condition)}`;
  }
  return base;
});

function onInput(e: any) {
  amountInput.value = String(e.detail.value).replace(/[^\d]/g, "");
}
function pick(v: number) {
  amountInput.value = String(v);
}
function confirm() {
  if (!valid.value) return;
  emit("confirm", { type: selected.value, amount: amount.value });
}

function btnLabel(t: BetType): string {
  return directionLabel(t, props.match);
}
function btnValue(t: BetType): string {
  return displayOdds(oddsValue(t, props.match));
}
</script>
```

在同文件模板中做两个精确替换：

```vue
<text class="title">投注 · {{ title }}</text>
```

```vue
<view class="group" :class="{ three: isThree }">
```

- [ ] **Step 2: 在详情页接入大小球双按钮**

把 `frontend/src/pages/match/index.vue` 的 bet 工具 import 替换为下面的版本：

> **范围说明**：此处顺带把原先以**值**方式导入的纯类型 `SettlementState` 改为 `type` 导入。这是本计划（spec）范围**之外**、对现有不规范导入的顺带修正——目的是符合 `isolatedModules` 并消除 Step 3 mp-weixin 构建时的 `"SettlementState" is not exported`；不改变任何运行时行为。

```ts
import {
  betCondition,
  directionLabel,
  displayOdds,
  getBetResult,
  oddsValue,
  type BetType,
  type SettlementState,
} from "@/utils/bet";
```

在胜平负 `</template>` 之后、投注记录标题之前插入：

```vue
    <!-- 大小球 -->
    <template v-if="match.ou_open">
      <view class="sec-head">
        <text class="sec-title"><text class="bar" />大小球</text>
      </view>
      <view class="market">
        <view class="cell"
          ><OddsButton
            :label="label('over')"
            :value="odds('over')"
            :disabled="!canBet()"
            @click="openBet('over')"
        /></view>
        <view class="cell"
          ><OddsButton
            :label="label('under')"
            :value="odds('under')"
            :disabled="!canBet()"
            @click="openBet('under')"
        /></view>
      </view>
    </template>
```

- [ ] **Step 3: 构建微信小程序**

Run: `cd /Users/crystal/Documents/Projects/football/frontend && yarn build`

Expected: PASS，输出 `Build complete`；允许现有 Sass `@import` deprecation warning，但不得再出现 `"SettlementState" is not exported` 或任何新增的 TypeScript/Vue 错误。

- [ ] **Step 4: 提交**

```bash
cd /Users/crystal/Documents/Projects/football
git add frontend/src/pages/match/index.vue frontend/src/pages/match/BetSheet.vue
git commit -m "feat: 展示大小球市场与投注弹层"
```

---

### Task 6: 全量回归与运行时验收

**Files:**
- Verify: `frontend/src/utils/format.test.ts`
- Verify: `frontend/src/utils/bet.test.ts`
- Verify: `frontend/src/pages/match/index.vue`
- Verify: `frontend/src/pages/match/BetSheet.vue`
- Verify: `server/src/routes.ts`
- External prerequisite: PostgreSQL 视图 `v_f_match`

**Interfaces:**
- Consumes: Task 1-5 的全部接口，以及用户已同步的 `v_f_match` 四个字段。
- Produces: 可复核的自动化结果与真实下注验收记录；本任务不修改代码、不创建数据库迁移。

- [ ] **Step 1: 运行前端全量单测**

Run: `cd /Users/crystal/Documents/Projects/football/frontend && yarn test`

Expected: PASS，2 个测试文件、109 条测试全部通过；其中 `format.test.ts` 25 条，`bet.test.ts` 84 条。

- [ ] **Step 2: 运行前后端构建**

Run: `cd /Users/crystal/Documents/Projects/football/frontend && yarn build`

Expected: PASS 并输出 `Build complete`；只有已知 Sass deprecation warning。

Run: `cd /Users/crystal/Documents/Projects/football/server && yarn build`

Expected: PASS，`tsc` 退出码为 0。

- [ ] **Step 3: 确认数据库视图前置条件**

在项目使用的 PostgreSQL 数据库执行：

```sql
SELECT ou_open, ou_condition, under_value, over_value
FROM v_f_match
LIMIT 1;
```

Expected: 查询成功且返回四个同名列；若视图尚未暴露字段，先由用户按现有数据库维护流程更新 `v_f_match`，再继续运行时验收。

- [ ] **Step 4: 验证展示、弹层和成功下注**

通过现有运维方式准备一场尚未开赛、`ou_open = 1`、`ou_condition = 2.75`、`over_value = 1.95`、`under_value = 1.88` 的比赛，然后在微信开发者工具中：

1. 进入比赛详情，确认「大小球」位于「胜平负」之后。
2. 确认两个按钮分别显示「大 2.5/3 @0.95」和「小 2.5/3 @0.88」。
3. 点击大球，确认弹层标题为「投注 · 大小球」，副标题包含「大小球 2.5/3」，并且只显示大/小两个等宽按钮。
4. 输入 100 并确认，确认页面提示「投注成功」。
5. 刷新投注记录，确认新记录为「大小球 大 2.5/3 @0.95」，数据库 `f_bet` 的 `type` 为 `over`、`condition` 为 `2.75`、`value` 为 `1.95`、`amount` 为 `100`。
6. 对 under 重复一次，确认 `condition` 仍为正 `2.75`，`value` 来自 `under_value`。

- [ ] **Step 5: 验证开关、盘口变化和比赛状态边界**

1. 把同一比赛的 `ou_open` 设为 0 并刷新详情，确认大小球区块消失。
2. 在微信开发者工具 Network 面板重放已捕获的 `POST /api/bet` 大小球请求，确认返回 `{ code: -1, msg: "未开放大小球盘口" }`。
3. 恢复 `ou_open = 1`，保持详情页打开；在下一次 10 秒轮询前把数据库 `ou_condition` 从 `2.75` 改为 `3`，立即用旧弹层确认下注。
4. 确认接口返回 `code: -2`，前端提示「盘口已变化，请重新下注」并触发刷新。
5. 将比赛状态置为已开始后刷新，确认大小球按钮禁用，行为与让球、胜平负一致。

- [ ] **Step 6: 复核范围并保持工作树干净**

Run: `cd /Users/crystal/Documents/Projects/football && git status --short`

Expected: 没有未提交的功能文件；仓库中没有新增 SQL/迁移、自动结算代码、玩法配置层或大小球专属限额。
