/** 날짜로 취급할 컬럼명 패턴 (시트 공통) */
export const DATE_RE =
  /일자|기준일|입사일|취득일|계약일|착수일|준공|수금일|지급\(예정\)일|점검일|만기일/;

const pad = (x: number) => String(x).padStart(2, "0");

/** 엑셀 날짜 일련번호(1900 체계) → yyyy-mm-dd. 타임존 영향 없음 */
export function serialToIso(n: number): string {
  const d = new Date(Math.round((n - 25569) * 86400000));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[,원\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function dateOf(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const m = v.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  if (typeof v === "number" && v > 20000 && v < 80000) {
    // 엑셀 날짜 일련번호 (1900 체계)
    const d = new Date(Math.round((v - 25569) * 86400000));
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  return null;
}

export function fmtMoney(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(Math.round(n));
}

export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e8) return `${(n / 1e8).toFixed(1).replace(/\.0$/, "")}억`;
  if (abs >= 1e4) return `${fmtMoney(n / 1e4)}만`;
  return fmtMoney(n);
}

export function fmtDate(v: unknown): string {
  if (typeof v === "number" && v > 20000 && v < 80000) return serialToIso(v);
  const d = dateOf(v);
  if (!d) return String(v ?? "");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
