import * as XLSX from "xlsx";
import type { Dataset, Row } from "./types";
import { DATE_RE, serialToIso } from "./format";

export const SHEET_NAMES = [
  "매출",
  "매입",
  "프로젝트",
  "경비",
  "인사급여",
  "장비차량",
  "자금계좌",
  "거래처",
] as const;

const REQUIRED = ["매출", "매입", "프로젝트"];

/** 브라우저 안에서만 실행됩니다. 파일 내용은 서버로 전송되지 않습니다. */
export function parseWorkbook(buf: ArrayBuffer, fileName: string): Dataset {
  // cellDates:false — 날짜를 일련번호 그대로 받아 타임존 영향 없이 직접 변환한다
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const sheets: Record<string, Row[]> = {};
  for (const name of SHEET_NAMES) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: null });
    sheets[name] = rows.map(normalizeRow).filter(hasContent);
  }
  const missing = REQUIRED.filter((n) => !sheets[n]);
  if (missing.length) {
    throw new Error(
      `필수 시트를 찾을 수 없습니다: ${missing.join(", ")}. 경영지원 마스터 엑셀 양식 파일인지 확인해 주세요.`
    );
  }
  return { fileName, loadedAt: new Date().toISOString(), sheets };
}

function normalizeRow(row: Row): Row {
  const out: Row = {};
  for (const [rawKey, v] of Object.entries(row)) {
    const k = rawKey.trim();
    if (DATE_RE.test(k) && typeof v === "number" && v > 20000 && v < 80000) {
      out[k] = serialToIso(v);
    } else if (v instanceof Date) {
      out[k] = serialFreeIso(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function hasContent(row: Row): boolean {
  return Object.values(row).some((v) => v !== null && v !== "");
}

/** Date 객체로 들어온 경우의 안전 변환 (자정 근처 반올림 오차 보정) */
function serialFreeIso(d: Date): string {
  const corrected = new Date(d.getTime() + 12 * 3600000); // 정오로 이동 후 날짜만 사용
  const p = (x: number) => String(x).padStart(2, "0");
  return `${corrected.getUTCFullYear()}-${p(corrected.getUTCMonth() + 1)}-${p(corrected.getUTCDate())}`;
}
