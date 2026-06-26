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

export function handicap(condition: string | number | Decimal) {
  if (Decimal(condition).mul(4).mod(2).eq(0)) {
    return formatHandicap(condition);
  }

  const sym = Decimal(condition).gt(0) ? "+" : "-";
  const nums = [
    Decimal(condition).sub("0.25").abs(),
    Decimal(condition).add("0.25").abs(),
  ];
  nums.sort((num1, num2) => num1.comparedTo(num2));
  return `${sym}${nums.map((t) => t.toString()).join("/")}`;
}

/**
 * 金额格式化：最多两位小数（四舍五入到 2 位后去掉末尾多余的 0）
 */
export function formatMoney(amount: string | number | Decimal): string {
  return new Decimal(amount).toDecimalPlaces(2).toString();
}

/**
 * 分组用日期键：本地日 YYYY-MM-DD
 */
export function dayKey(input: string | Date): string {
  return dayjs(input).format("YYYY-MM-DD");
}

/**
 * 日期分组头展示：MM-DD
 */
export function formatDay(key: string): string {
  return dayjs(key).format("MM-DD");
}

/**
 * 行内时间：HH:mm
 */
export function formatTime(input: string | Date): string {
  return dayjs(input).format("HH:mm");
}

/**
 * 百分比渲染：保留 1 位小数并拼 %（如 66.7 → "66.7%"，50 → "50.0%"）
 */
export function formatPercent(n: number): string {
  return new Decimal(n).toFixed(1) + "%";
}

/**
 * 状态文案
 */
export function matchStatusText(state: "pending" | "playing" | "end"): string {
  switch (state) {
    case "pending":
      return "可投注";
    case "playing":
      return "进行中";
    default:
      return "已结束";
  }
}
