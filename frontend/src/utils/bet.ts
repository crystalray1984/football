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

/**
 * 是否让球盘（亚盘）
 */
export function isAsian(type: BetType): boolean {
  return type === "ah1" || type === "ah2";
}

/**
 * 是否大小球
 */
export function isOverUnder(type: BetType): boolean {
  return type === "over" || type === "under";
}

/**
 * 投注方向 → 按钮标题（用队名）
 */
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

/**
 * 投注方向 → 对应赔率/水位
 */
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

/**
 * 展示用亚赔：后端所有赔率（含让球水位）存的都是欧赔（含本金），
 * 前端一律展示为 欧赔 - 1。仅影响展示，不改动下注/落库数据。
 */
export function displayOdds(value: string): string {
  return new Decimal(value).sub(1).toFixed(2);
}

/**
 * 预计可赢（纯盈利）：本金 × (欧赔 - 1) = 本金 × 亚赔
 */
export function potentialWin(amount: string | number, value: string): string {
  return formatMoney(new Decimal(amount || 0).mul(new Decimal(value).sub(1)));
}

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

/**
 * 金额校验：50-500 的整数
 */
export function validateAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount >= MIN_BET && amount <= MAX_BET;
}

/**
 * 投注记录盘口文案
 */
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

export type SettlementState = "pending" | "win" | "loss" | "flat";

/**
 * 结算展示（口径为假设：result_profit 为净盈亏，null=未结算）
 */
export function settlement(bet: { result_profit: string | null }): {
  state: SettlementState;
  text: string;
} {
  if (bet.result_profit === null || bet.result_profit === undefined) {
    return { state: "pending", text: "待结算" };
  }
  const p = new Decimal(bet.result_profit);
  if (p.gt(0)) return { state: "win", text: "+" + formatMoney(p) };
  if (p.lt(0)) return { state: "loss", text: formatMoney(p) };
  return { state: "flat", text: formatMoney(p) };
}

/**
 * 合计已结算投注的净盈亏；未结算（result_profit == null）不计入。
 * 返回精确的十进制字符串（如 "45"、"30.75"、"-20"、"0"）。
 */
export function sumSettledProfit(
  bets: { result_profit: string | null }[],
): string {
  return bets
    .reduce(
      (acc, b) =>
        b.result_profit === null || b.result_profit === undefined
          ? acc
          : acc.add(b.result_profit),
      new Decimal(0),
    )
    .toString();
}

export function getBetResult(
  bet: Pick<BetRecord, "condition" | "amount" | "type" | "value">,
  score1: number,
  score2: number,
) {
  let result_value: string;

  //确认投注类型
  if (bet.type === "ah1") {
    //让球，买主队
    result_value = compareScore(Decimal(score1).add(bet.condition), score2);
  } else if (bet.type === "ah2") {
    //让球，买客队
    result_value = compareScore(Decimal(score2).add(bet.condition), score1);
  } else if (bet.type === "win1") {
    result_value = score1 > score2 ? "1" : "-1";
  } else if (bet.type === "win2") {
    result_value = score1 < score2 ? "1" : "-1";
  } else {
    result_value = score1 === score2 ? "1" : "-1";
  }

  //胜负计算
  let state: SettlementState;
  switch (result_value) {
    case "0.5":
    case "1":
      state = "win";
      break;
    case "-0.5":
    case "-1":
      state = "loss";
      break;
    default:
      state = "flat";
      break;
  }

  let result_profit: string;

  //收益计算
  switch (result_value) {
    case "0.5":
    case "1":
      result_profit = Decimal(bet.value)
        .sub(1)
        .mul(result_value)
        .mul(bet.amount)
        .toDecimalPlaces(2)
        .toString();
      break;
    default:
      result_profit = Decimal(result_value)
        .mul(bet.amount)
        .toDecimalPlaces(2)
        .toString();
      break;
  }

  let text: string;
  if (state === "win") {
    text = `+${result_profit}`;
  } else {
    text = result_profit;
  }

  return {
    state,
    result_profit,
    text,
  };
}

/**
 * 进行比分对比
 * @param score1
 * @param score2
 */
export function compareScore(
  score1: Decimal.Value,
  score2: Decimal.Value,
): "-0.5" | "-1" | "0" | "0.5" | "1" {
  //给作为比对的结果加上盘口
  const delta = Decimal(score1).sub(score2);
  if (delta.eq("0")) return "0";
  if (delta.gte("0.5")) {
    return "1";
  }
  if (delta.gte("0.25")) {
    return "0.5";
  }
  if (delta.lte("-0.5")) {
    return "-1";
  }
  if (delta.lte("-0.25")) {
    return "-0.5";
  }
  return "0";
}

/**
 * 收益展示：最多两位小数；正数带 + 记 win、负数 loss、0 flat
 */
export function profitDisplay(amount: string): {
  state: "win" | "loss" | "flat";
  text: string;
} {
  const d = new Decimal(amount);
  const money = formatMoney(d);
  if (d.gt(0)) return { state: "win", text: `+${money}` };
  if (d.lt(0)) return { state: "loss", text: money };
  return { state: "flat", text: money };
}

export interface UserDayProfit {
  name: string;
  profit: string;
}
export interface DailyUserProfit {
  date: string;
  total: string;
  users: UserDayProfit[];
}

/**
 * 管理员页：按比赛日 → 用户 汇总已结算净收益。
 * 日按倒序；组内用户按当日收益倒序；total = 当日所有用户之和。
 */
export function groupUserDailyProfit(rows: AdminBetRow[]): DailyUserProfit[] {
  const byDay = new Map<string, Map<string, { name: string; sum: Decimal }>>();
  for (const r of rows) {
    const date = dayKey(r.match_time);
    let users = byDay.get(date);
    if (!users) {
      users = new Map();
      byDay.set(date, users);
    }
    const u = users.get(r.openid);
    if (u) u.sum = u.sum.add(r.result_profit);
    else users.set(r.openid, { name: r.name, sum: new Decimal(r.result_profit) });
  }
  const result: DailyUserProfit[] = [];
  for (const [date, users] of byDay) {
    const sorted = [...users.values()].sort((a, b) => b.sum.comparedTo(a.sum));
    const list = sorted.map((u) => ({ name: u.name, profit: u.sum.toString() }));
    const total = sorted
      .reduce((acc, u) => acc.add(u.sum), new Decimal(0))
      .toString();
    result.push({ date, total, users: list });
  }
  result.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return result;
}

export interface BetDayGroup {
  /** 分组键，YYYY-MM-DD（比赛本地日） */
  date: string;
  /** 当日已结算净盈亏 */
  profit: string;
  bets: MyBet[];
}

/**
 * 按比赛日期分组投注记录；组按日倒序，组内保持输入顺序。
 */
export function groupBetsByDay(bets: MyBet[]): BetDayGroup[] {
  const map = new Map<string, MyBet[]>();
  for (const bet of bets) {
    const key = dayKey(bet.match.match_time);
    const arr = map.get(key);
    if (arr) arr.push(bet);
    else map.set(key, [bet]);
  }
  const groups: BetDayGroup[] = [];
  for (const [date, dayBets] of map) {
    groups.push({ date, profit: sumSettledProfit(dayBets), bets: dayBets });
  }
  groups.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return groups;
}

export type RankSortKey = "profit" | "winRate";

/**
 * 排行排序：恒倒序；主指标相同按副指标倒序，再相同按 name 升序稳定。
 * 不修改入参数组（复制后排序）；全程用 Decimal 比较，避免浮点/字典序误差。
 */
export function sortRanking(rows: RankRow[], sortKey: RankSortKey): RankRow[] {
  return [...rows].sort((a, b) => {
    const aPrimary = sortKey === "profit" ? a.profit : a.winRate;
    const bPrimary = sortKey === "profit" ? b.profit : b.winRate;
    const primaryCmp = new Decimal(bPrimary).comparedTo(aPrimary); // 倒序
    if (primaryCmp !== 0) return primaryCmp;

    const aSecondary = sortKey === "profit" ? a.winRate : a.profit;
    const bSecondary = sortKey === "profit" ? b.winRate : b.profit;
    const secondaryCmp = new Decimal(bSecondary).comparedTo(aSecondary); // 倒序
    if (secondaryCmp !== 0) return secondaryCmp;

    return a.name.localeCompare(b.name); // 名称升序稳定
  });
}
