import dayjs from "dayjs";
import Decimal from "decimal.js";

/**
 * 比赛时间统一格式 MM-DD HH:mm（不使用相对日期）
 */
export function formatMatchTime(input: string | Date): string {
  return dayjs(input).format("MM-DD HH:mm");
}

/**
 * 让球数格式化：正数加 +，负数保留 -，0 显示 0
 */
export function formatHandicap(condition: string | number | Decimal): string {
  const d = new Decimal(condition);
  if (d.gt(0)) return "+" + d.toString();
  return d.toString();
}

/**
 * 金额格式化：两位小数
 */
export function formatMoney(amount: string | number | Decimal): string {
  return new Decimal(amount).toFixed(2);
}

/**
 * 状态文案
 */
export function matchStatusText(
  state: "pending" | "playing" | "end",
): string {
  switch (state) {
    case "pending":
      return "可投注";
    case "playing":
      return "进行中";
    default:
      return "已结束";
  }
}
