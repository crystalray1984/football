import { getToken } from "@/api";

/** 管理员 openid 白名单（仅客户端鉴权） */
export const ADMIN_OPENIDS = [
  "oc2fT5Oit4YpELFxpp2kTqSPKVis",
  "oc2fT5KZcBTUOm7Flb_OIwxIpKwk",
];

/** 当前登录用户是否管理员 */
export function isAdmin(): boolean {
  return ADMIN_OPENIDS.includes(getToken());
}
