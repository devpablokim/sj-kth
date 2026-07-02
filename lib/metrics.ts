import type { Dataset, Row } from "./types";
import { num, dateOf } from "./format";

/** 헤더명이 정확히 일치하거나 접두어로 시작하는 첫 컬럼 값을 반환 */
export function pick(row: Row, ...prefixes: string[]): unknown {
  for (const p of prefixes) {
    if (p in row) return row[p];
    for (const k of Object.keys(row)) if (k.startsWith(p)) return row[k];
  }
  return null;
}

const yearOf = (v: unknown) => dateOf(v)?.getFullYear() ?? null;
const monthOf = (v: unknown) => {
  const d = dateOf(v);
  return d ? d.getMonth() + 1 : null;
};

export function availableYears(ds: Dataset): number[] {
  const ys = new Set<number>();
  for (const s of ["매출", "매입", "경비"]) {
    for (const r of ds.sheets[s] ?? []) {
      const y = yearOf(r["일자"]);
      if (y) ys.add(y);
    }
  }
  return [...ys].sort((a, b) => b - a);
}

function outstanding(r: Row): number {
  if ("미수잔액" in r) return num(r["미수잔액"]);
  return num(pick(r, "합계")) - num(pick(r, "수금액"));
}

export interface Kpis {
  revenue: number;
  cost: number;
  gross: number;
  margin: number;
  receivable: number;
  payable: number;
  expense: number;
  cash: number;
  headcount: number;
  payroll: number;
}

export function computeKpis(ds: Dataset, year: number): Kpis {
  let revenue = 0;
  let cost = 0;
  let receivable = 0;
  let payable = 0;
  let expense = 0;

  for (const r of ds.sheets["매출"] ?? []) {
    if (yearOf(r["일자"]) === year) revenue += num(pick(r, "공급가액"));
    receivable += outstanding(r);
  }
  for (const r of ds.sheets["매입"] ?? []) {
    if (yearOf(r["일자"]) === year) cost += num(pick(r, "공급가액"));
    if (pick(r, "지급상태") === "미지급") payable += num(pick(r, "합계"));
  }
  for (const r of ds.sheets["경비"] ?? []) {
    if (yearOf(r["일자"]) === year) expense += num(pick(r, "금액"));
  }
  const cash = (ds.sheets["자금계좌"] ?? []).reduce((s, r) => s + num(pick(r, "잔액")), 0);
  const active = (ds.sheets["인사급여"] ?? []).filter((r) => pick(r, "재직상태") === "재직");
  const payroll = active.reduce(
    (s, r) => s + (num(pick(r, "월급여계")) || num(pick(r, "기본급")) + num(pick(r, "제수당"))),
    0
  );
  const gross = revenue - cost;
  return {
    revenue,
    cost,
    gross,
    margin: revenue ? gross / revenue : 0,
    receivable,
    payable,
    expense,
    cash,
    headcount: active.length,
    payroll,
  };
}

export function monthlySeries(ds: Dataset, year: number) {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    name: `${i + 1}월`,
    매출: 0,
    매입: 0,
    경비: 0,
  }));
  const add = (sheet: string, key: "매출" | "매입" | "경비", amountCol: string) => {
    for (const r of ds.sheets[sheet] ?? []) {
      if (yearOf(r["일자"]) !== year) continue;
      const m = monthOf(r["일자"]);
      if (m) rows[m - 1][key] += num(pick(r, amountCol));
    }
  };
  add("매출", "매출", "공급가액");
  add("매입", "매입", "공급가액");
  add("경비", "경비", "금액");
  return rows;
}

export function segmentSales(ds: Dataset, year: number) {
  const map = new Map<string, number>();
  for (const r of ds.sheets["매출"] ?? []) {
    if (yearOf(r["일자"]) !== year) continue;
    const seg = String(pick(r, "사업구분") ?? "기타");
    map.set(seg, (map.get(seg) ?? 0) + num(pick(r, "공급가액")));
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function projectRows(ds: Dataset) {
  return (ds.sheets["프로젝트"] ?? []).map((r) => ({
    code: String(pick(r, "프로젝트코드") ?? ""),
    name: String(pick(r, "프로젝트명") ?? ""),
    client: String(pick(r, "발주처") ?? ""),
    amount: num(pick(r, "계약금액")),
    progress: num(pick(r, "진행률")),
    status: String(pick(r, "상태") ?? ""),
  }));
}

export function receivableTop(ds: Dataset, limit = 5) {
  return (ds.sheets["매출"] ?? [])
    .map((r) => ({
      client: String(pick(r, "거래처명") ?? ""),
      desc: String(pick(r, "내역") ?? ""),
      date: String(pick(r, "일자") ?? ""),
      amount: outstanding(r),
    }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}
