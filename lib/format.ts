/*
 * 표시용 포맷 유틸 — 숫자 콤마, 초/ms, USD, 퍼센트.
 * 서버/클라이언트 어디서나 import 가능한 순수 함수만 둡니다.
 */

/** 정수 콤마 표기: 121176 → "121,176" */
export function fmtInt(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString("en-US");
}

/** 소수점 고정 표기 (기본 1자리): 75.735 → "75.7" */
export function fmtFixed(n: number | undefined | null, digits = 1): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return (0).toFixed(digits);
  return n.toFixed(digits);
}

/** ms → 초 표기: 22480 → "22.5" */
export function fmtSec(ms: number | undefined | null, digits = 1): string {
  if (!ms || !Number.isFinite(ms)) return (0).toFixed(digits);
  return (ms / 1000).toFixed(digits);
}

/** ms 정수 표기: 109.4 → "109" */
export function fmtMs(ms: number | undefined | null): string {
  if (!ms || !Number.isFinite(ms)) return "0";
  return String(Math.round(ms));
}

/** USD 표기. 기본 소수 4자리이지만 1달러 이상이면 2자리: 0.0921 → "$0.0921" */
export function fmtUsd(usd: number | undefined | null, digits = 4): string {
  if (!usd || !Number.isFinite(usd)) return `$${(0).toFixed(Math.min(digits, 2))}`;
  const d = usd >= 1 ? 2 : digits;
  return `$${usd.toFixed(d)}`;
}

/** 0~1 확률 → "42%" */
export function fmtPct(p: number | undefined | null, digits = 0): string {
  if (p === undefined || p === null || !Number.isFinite(p)) return "0%";
  return `${(Math.max(0, Math.min(1, p)) * 100).toFixed(digits)}%`;
}

/** 0~100 점수 → "78%" */
export function fmtScorePct(score: number | undefined | null): string {
  if (score === undefined || score === null || !Number.isFinite(score)) return "0%";
  return `${Math.round(Math.max(0, Math.min(100, score)))}%`;
}

/** 텍스트 앞부분 자르기 (타일용): 줄바꿈 제거 후 n자 + "…" */
export function truncate(text: string, n: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > n ? `${flat.slice(0, n)}…` : flat;
}

/** snake_case 선택지 → 표시용: "how_to" → "how-to" */
export function choiceLabel(choice: string): string {
  return choice.replace(/_/g, "-");
}
