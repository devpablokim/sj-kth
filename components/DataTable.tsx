"use client";

import { useMemo, useState } from "react";
import type { Row } from "@/lib/types";
import { DATE_RE, fmtDate, fmtMoney, num } from "@/lib/format";

const MONEY_RE = /공급가액|부가세|합계|수금액|미수잔액|금액|잔액|기본급|제수당|월급여|취득가|계약금액|매출누계/;

const BADGE: Record<string, string> = {
  수금완료: "bg-emerald-100 text-emerald-700",
  지급완료: "bg-emerald-100 text-emerald-700",
  발행: "bg-emerald-100 text-emerald-700",
  재직: "bg-emerald-100 text-emerald-700",
  가동: "bg-emerald-100 text-emerald-700",
  완료: "bg-emerald-100 text-emerald-700",
  진행중: "bg-blue-100 text-blue-700",
  부분수금: "bg-amber-100 text-amber-700",
  입찰중: "bg-violet-100 text-violet-700",
  대기: "bg-slate-200 text-slate-600",
  보류: "bg-slate-200 text-slate-600",
  휴직: "bg-slate-200 text-slate-600",
  미수: "bg-red-100 text-red-700",
  미지급: "bg-red-100 text-red-700",
  미발행: "bg-red-100 text-red-700",
  정비중: "bg-orange-100 text-orange-700",
  퇴사: "bg-slate-300 text-slate-500",
  폐기: "bg-slate-300 text-slate-500",
};

export default function DataTable({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");

  const columns = useMemo(() => (rows[0] ? Object.keys(rows[0]) : []), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return rows;
    return rows.filter((r) =>
      Object.values(r).some((v) => v !== null && String(v).includes(q))
    );
  }, [rows, query]);

  const moneyCols = columns.filter((c) => MONEY_RE.test(c));
  const totals = Object.fromEntries(
    moneyCols.map((c) => [c, filtered.reduce((s, r) => s + num(r[c]), 0)])
  );

  if (!rows.length) {
    return <p className="p-8 text-center text-slate-400">이 시트에는 데이터가 없습니다.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="검색 (거래처, 내역, 상태 등)"
          className="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <span className="text-sm text-slate-500">{filtered.length}건</span>
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-max text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              {columns.map((c) => (
                <th
                  key={c}
                  className={`whitespace-nowrap bg-[#203864] px-3 py-2.5 font-semibold text-white ${
                    MONEY_RE.test(c) ? "text-right" : "text-left"
                  }`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-blue-50/50">
                {columns.map((c) => (
                  <td
                    key={c}
                    className={`whitespace-nowrap px-3 py-2 ${
                      MONEY_RE.test(c) ? "text-right tabular-nums" : "text-left"
                    }`}
                  >
                    <Cell col={c} value={r[c]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {moneyCols.length > 0 && (
            <tfoot className="sticky bottom-0">
              <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold">
                {columns.map((c, i) => (
                  <td key={c} className={`whitespace-nowrap px-3 py-2 ${MONEY_RE.test(c) ? "text-right tabular-nums" : ""}`}>
                    {i === 0 ? "합계" : MONEY_RE.test(c) ? fmtMoney(totals[c]) : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function Cell({ col, value }: { col: string; value: unknown }) {
  if (value === null || value === "") return <span className="text-slate-300">-</span>;
  const s = String(value);

  if (col === "진행률") {
    const pct = Math.round(num(value) <= 1 ? num(value) * 100 : num(value));
    return (
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
          <span className="block h-full rounded-full bg-blue-500" style={{ width: `${Math.min(pct, 100)}%` }} />
        </span>
        <span className="tabular-nums text-xs text-slate-500">{pct}%</span>
      </span>
    );
  }
  if (BADGE[s]) {
    return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[s]}`}>{s}</span>;
  }
  if (DATE_RE.test(col)) {
    return <>{fmtDate(value) || s.slice(0, 10)}</>;
  }
  if (MONEY_RE.test(col) && typeof value === "number") {
    return <>{fmtMoney(value)}</>;
  }
  return <>{s}</>;
}
