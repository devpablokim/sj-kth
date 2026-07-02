import * as XLSX from "xlsx";
import type { Dataset, Row } from "./types";
import { DATE_RE, MONEY_RE } from "./format";

/**
 * 수정된 데이터를 엑셀 워크북으로 생성한다. 브라우저 안에서만 실행되며,
 * 부가세·합계 등 파생 컬럼은 수식으로 기록해 다운로드한 파일을
 * 새 마스터 파일로 계속 사용할 수 있다.
 */
export function buildWorkbook(ds: Dataset): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(ds.sheets)) {
    if (!rows?.length) continue;
    const headers = Object.keys(rows[0]);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    rows.forEach((row, i) => {
      headers.forEach((h, c) => {
        const addr = XLSX.utils.encode_cell({ r: i + 1, c });
        const cell = toCell(h, row[h]);
        if (cell) ws[addr] = cell;
      });
    });
    applyFormulas(name, ws, headers, rows.length, ds);
    ws["!ref"] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: rows.length, c: headers.length - 1 },
    });
    ws["!cols"] = headers.map((h) => ({
      wch: DATE_RE.test(h) ? 12 : MONEY_RE.test(h) ? 14 : Math.min(Math.max(10, h.length * 2 + 4), 40),
    }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return wb;
}

export function downloadExcel(ds: Dataset) {
  const today = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  const stamp = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
  XLSX.writeFile(buildWorkbook(ds), `신정개발_경영지원_데이터_${stamp}.xlsx`, { compression: true });
}

function toCell(header: string, v: unknown): XLSX.CellObject | null {
  if (v === null || v === undefined || v === "") return null;
  if (DATE_RE.test(header) && typeof v === "string") {
    const serial = isoToSerial(v);
    if (serial !== null) return { t: "n", v: serial, z: "yyyy-mm-dd" };
  }
  if (typeof v === "number") {
    if (header === "진행률") return { t: "n", v, z: "0%" };
    if (MONEY_RE.test(header)) return { t: "n", v, z: "#,##0" };
    return { t: "n", v };
  }
  if (typeof v === "boolean") return { t: "b", v };
  return { t: "s", v: String(v) };
}

/** yyyy-mm-dd → 엑셀 날짜 일련번호. 타임존 영향 없음 */
function isoToSerial(iso: string): number | null {
  const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) + 25569;
}

function colOf(headers: string[], prefix: string): string | null {
  const i = headers.findIndex((h) => h === prefix || h.startsWith(prefix));
  return i >= 0 ? XLSX.utils.encode_col(i) : null;
}

function setFormula(ws: XLSX.WorkSheet, addr: string, f: string, numFmt = "#,##0") {
  const existing = ws[addr] as XLSX.CellObject | undefined;
  ws[addr] = { t: "n", v: existing?.v ?? 0, z: existing?.z ?? numFmt, f };
}

/** 원본 마스터 엑셀과 동일한 파생 컬럼 수식을 기록 */
function applyFormulas(
  name: string,
  ws: XLSX.WorkSheet,
  headers: string[],
  nRows: number,
  ds: Dataset
) {
  const col = (p: string) => colOf(headers, p);
  if (name === "매출") {
    const [supply, vat, total, paid, out] = ["공급가액", "부가세", "합계", "수금액", "미수잔액"].map(col);
    for (let r = 2; r <= nRows + 1; r++) {
      if (supply && vat) setFormula(ws, `${vat}${r}`, `ROUND(${supply}${r}*0.1,0)`);
      if (supply && vat && total) setFormula(ws, `${total}${r}`, `${supply}${r}+${vat}${r}`);
      if (total && paid && out) setFormula(ws, `${out}${r}`, `${total}${r}-${paid}${r}`);
    }
  } else if (name === "매입") {
    const [supply, vat, total] = ["공급가액", "부가세", "합계"].map(col);
    for (let r = 2; r <= nRows + 1; r++) {
      if (supply && vat) setFormula(ws, `${vat}${r}`, `ROUND(${supply}${r}*0.1,0)`);
      if (supply && vat && total) setFormula(ws, `${total}${r}`, `${supply}${r}+${vat}${r}`);
    }
  } else if (name === "인사급여") {
    const [base, extra, sum] = ["기본급", "제수당", "월급여계"].map(col);
    for (let r = 2; r <= nRows + 1; r++) {
      if (base && extra && sum) setFormula(ws, `${sum}${r}`, `${base}${r}+${extra}${r}`);
    }
  } else if (name === "프로젝트") {
    const sales = ds.sheets["매출"];
    const code = col("프로젝트코드");
    const contract = col("계약금액");
    const cum = col("매출누계");
    const remain = col("계약잔액");
    const salesHeaders = sales?.length ? Object.keys(sales[0]) : [];
    const sCode = colOf(salesHeaders, "프로젝트코드");
    const sSupply = colOf(salesHeaders, "공급가액");
    const sEnd = (sales?.length ?? 0) + 1;
    for (let r = 2; r <= nRows + 1; r++) {
      if (cum && code && sCode && sSupply && sales?.length) {
        setFormula(
          ws,
          `${cum}${r}`,
          `SUMIF(매출!$${sCode}$2:$${sCode}$${sEnd},${code}${r},매출!$${sSupply}$2:$${sSupply}$${sEnd})`
        );
      }
      if (remain && contract && cum) setFormula(ws, `${remain}${r}`, `${contract}${r}-${cum}${r}`);
    }
  }
}
