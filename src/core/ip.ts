import { isIP } from "node:net";
import type { RequestLike } from "../firewall/request.js";

export function cleanRemoteIp(input?: string) {
  if (!input) return "";

  const first = input.split(",")[0]?.trim() ?? "";
  const withoutV4Mapped = first.startsWith("::ffff:") ? first.slice("::ffff:".length) : first;
  const normalizedLocalhost = withoutV4Mapped === "::1" || withoutV4Mapped === "0:0:0:0:0:0:0:1" ? "127.0.0.1" : withoutV4Mapped;

  const withPortMatch = /^(\d+\.\d+\.\d+\.\d+):\d+$/.exec(normalizedLocalhost);
  return withPortMatch ? withPortMatch[1] : normalizedLocalhost;
}

export function getRemoteIp(req: RequestLike) {
  const forwarded = req.headers?.["x-forwarded-for"];
  const realIp = req.headers?.["x-real-ip"];

  const fromForwarded = typeof forwarded === "string" ? (forwarded.split(",")[0]?.trim() ?? "") : "";
  const fromRealIp = typeof realIp === "string" ? realIp.trim() : "";
  const fromSocket = req.socket?.remoteAddress ?? "";

  return cleanRemoteIp(fromForwarded || fromRealIp || fromSocket);
}

export function ipv4ToInt(ip: string) {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;

  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;

  return ((nums[0] << 24) >>> 0) + (nums[1] << 16) + (nums[2] << 8) + nums[3];
}

export function isIpv4InCidr(ip: string, cidr: string) {
  const [base, maskStr] = cidr.split("/");
  const mask = Number(maskStr);

  if (!base || !Number.isInteger(mask) || mask < 0 || mask > 32) return false;

  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);

  if (ipInt === null || baseInt === null) return false;

  const maskBits = mask === 0 ? 0 : (~((1 << (32 - mask)) - 1) >>> 0) >>> 0;
  return (ipInt & maskBits) === (baseInt & maskBits);
}

export function isIpAllowed(remoteIp: string, opts: { allowedIps?: readonly string[]; allowedCidrs?: readonly string[] }) {
  const ip = cleanRemoteIp(remoteIp);
  if (!ip) return false;

  const ipKind = isIP(ip);
  if (ipKind === 0) return false;

  const allowedIps = opts.allowedIps ?? [];
  if (allowedIps.some((allowed) => cleanRemoteIp(allowed) === ip)) return true;

  const allowedCidrs = opts.allowedCidrs ?? [];
  if (ipKind === 4 && allowedCidrs.some((cidr) => cidr.includes(".") && isIpv4InCidr(ip, cidr))) return true;

  return false;
}
