import Decimal from "decimal.js";
import { formatHandicap } from "./format";

export type BetType = "ah1" | "ah2" | "win1" | "win2" | "draw";

export const MIN_BET = 50;
export const MAX_BET = 500;

interface MarketMatch {
  team1_name: string;
  team2_name: string;
  ah_condition: string;
}

interface OddsMatch {
  ah1_value: string;
  ah2_value: string;
  win1_value: string;
  win2_value: string;
  draw_value: string;
}

/**
 * 是否让球盘（亚盘）
 */
export function isAsian(type: BetType): boolean {
  return type === "ah1" || type === "ah2";
}

/**
 * 投注方向 → 按钮标题（用队名）
 */
export function directionLabel(type: BetType, match: MarketMatch): string {
  switch (type) {
    case "ah1":
      return `${match.team1_name} ${formatHandicap(match.ah_condition)}`;
    case "ah2":
      return `${match.team2_name} ${formatHandicap(
        new Decimal(0).sub(match.ah_condition),
      )}`;
    case "win1":
      return match.team1_name;
    case "win2":
      return match.team2_name;
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
    default:
      return match.draw_value;
  }
}

/**
 * 预计可赢（纯盈利）：让球=本金×水位；胜平负=本金×(赔率-1)
 */
export function potentialWin(
  type: BetType,
  amount: string | number,
  value: string,
): string {
  const a = new Decimal(amount || 0);
  if (isAsian(type)) return a.mul(value).toFixed(2);
  return a.mul(new Decimal(value).sub(1)).toFixed(2);
}

/**
 * 下注 condition：ah1=让球数；ah2=取反；胜平负="0" 占位
 */
export function betCondition(type: BetType, match: MarketMatch): string {
  if (type === "ah1") return new Decimal(match.ah_condition).toString();
  if (type === "ah2") return new Decimal(0).sub(match.ah_condition).toString();
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
      return `让球 ${match.team1_name} ${formatHandicap(bet.condition)} @${bet.value}`;
    case "ah2":
      return `让球 ${match.team2_name} ${formatHandicap(bet.condition)} @${bet.value}`;
    case "win1":
      return `${match.team1_name} 胜 @${bet.value}`;
    case "win2":
      return `${match.team2_name} 胜 @${bet.value}`;
    default:
      return `平局 @${bet.value}`;
  }
}

export type SettlementState = "pending" | "win" | "loss" | "flat";

/**
 * 结算展示（口径为假设：result_profit 为净盈亏，null=未结算）
 */
export function settlement(bet: {
  result_profit: string | null;
}): { state: SettlementState; text: string } {
  if (bet.result_profit === null || bet.result_profit === undefined) {
    return { state: "pending", text: "待结算" };
  }
  const p = new Decimal(bet.result_profit);
  if (p.gt(0)) return { state: "win", text: "+" + p.toFixed(2) };
  if (p.lt(0)) return { state: "loss", text: p.toFixed(2) };
  return { state: "flat", text: p.toFixed(2) };
}
