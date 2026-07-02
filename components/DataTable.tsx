"use client";

import { useMemo, useState } from "react";
import type { Row } from "@/lib/types";
import { DATE_RE, MONEY_RE, fmtDate, fmtMoney, num } from "@/lib/format";
import { OPTIONS, derivedCols, recalcRow } from "@/lib/derive";

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

interface Props {
  sheetName: string;
  rows: Row[];
  onChange?: (rows: Row[]) => void;
}

export default function DataTable({ sheetName, rows, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);

  const columns = useMemo(() => (rows[0] ? Object.keys(rows[0]) : []), [rows]);
  const derived = derivedCols(sheetName);

  const filtered = useMemo(() => {
    const indexed = rows.map((r, i) => ({ r, i }));
    const q = query.trim();
    if (!q) return indexed;
    return indexed.filter(({ r }) =>
      Object.values(r).some((v) => v !== null && String(v).includes(q))
    );
  }, [rows, query]);

  const moneyCols = columns.filter((c) => MONEY_RE.test(c));
  const totals = Object.fromEntries(
    moneyCols.map((c) => [c, filtered.reduce((s, { r }) => s + num(r[c]), 0)])
  );

  const setCell = (rowIdx: number, col: string, value: unknown) => {
    if (!onChange) return;
    const next = rows.slice();
    next[rowIdx] = recalcRow(sheetName, { ...next[rowIdx], [col]: value });
    onChange(next);
  };

  const addRow = () => {
    if (!onChange || !columns.length) return;
    const empty: Row = {};
    for (const c of columns) empty[c] = null;
    onChange([...rows, recalcRow(sheetName, empty)]);
  };

  const delRow = (rowIdx: number) => {
    if (!onChange) return;
    if (window.confirm("이 행을 삭제할까요? (엑셀 다운로드 전에는 원본 파일에 영향 없음)")) {
      onChange(rows.filter((_, i) => i !== rowIdx));
    }
  };

  if (!rows.length) {
    return <p className="p-8 text-center text-slate-400">이 시트에는 데이터가 없습니다.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="검색 (거래처, 내역, 상태 등)"
          className="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <span className="mr-auto text-sm text-slate-500">{filtered.length}건</span>
        {editing && (
          <button
            onClick={addRow}
            className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            + 행 추가
          </button>
        )}
        {onChange && (
          <button
            onClick={() => setEditing(!editing)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              editing
                ? "bg-[#203864] text-white hover:bg-[#2c4a80]"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {editing ? "✓ 편집 완료" : "✏️ 편집"}
          </button>
        )}
      </div>

      {editing && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          수정 내용은 이 브라우저에만 저장됩니다. 부가세·합계 등 회색 칸은 자동 계산됩니다.
          수정을 마치면 상단의 <b>엑셀 다운로드</b>로 파일을 받아 보관하세요.
        </p>
      )}

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
              {editing && <th className="bg-[#203864] px-2 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ r, i }) => (
              <tr key={i} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-blue-50/50">
                {columns.map((c) => (
                  <td
                    key={c}
                    className={`whitespace-nowrap ${editing ? "px-1 py-1" : "px-3 py-2"} ${
                      MONEY_RE.test(c) ? "text-right tabular-nums" : "text-left"
                    }`}
                  >
                    {editing && !derived.has(c) ? (
                      <EditCell sheetName={sheetName} col={c} value={r[c]} onSet={(v) => setCell(i, c, v)} />
                    ) : editing ? (
                      <span className="block rounded bg-slate-100 px-2 py-1.5 text-slate-500">
                        <Cell col={c} value={r[c]} />
                      </span>
                    ) : (
                      <Cell col={c} value={r[c]} />
                    )}
                  </td>
                ))}
                {editing && (
                  <td className="px-2">
                    <button
                      onClick={() => delRow(i)}
                      title="행 삭제"
                      className="rounded px-1.5 py-0.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </td>
                )}
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
                {editing && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function EditCell({
  sheetName,
  col,
  value,
  onSet,
}: {
  sheetName: string;
  col: string;
  value: unknown;
  onSet: (v: unknown) => void;
}) {
  const base =
    "rounded border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500";
  const opts = OPTIONS[`${sheetName}.${col}`];

  if (opts) {
    const cur = value === null || value === undefined ? "" : String(value);
    return (
      <select value={cur} onChange={(e) => onSet(e.target.value || null)} className={`${base} min-w-24`}>
        <option value="">-</option>
        {cur && !opts.includes(cur) && <option value={cur}>{cur}</option>}
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (DATE_RE.test(col)) {
    const cur = typeof value === "string" ? value.slice(0, 10) : fmtDate(value);
    return (
      <input
        type="date"
        value={cur}
        onChange={(e) => onSet(e.target.value || null)}
        className={`${base} w-36`}
      />
    );
  }
  if (MONEY_RE.test(col) || col === "진행률") {
    return (
      <input
        inputMode="decimal"
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(e) => {
          const t = e.target.value.replace(/,/g, "").trim();
          if (t === "") return onSet(null);
          const n = Number(t);
          onSet(Number.isFinite(n) ? n : t);
        }}
        placeholder={col === "진행률" ? "0.5 = 50%" : "숫자"}
        className={`${base} w-28 text-right tabular-nums`}
      />
    );
  }
  return (
    <input
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(e) => onSet(e.target.value === "" ? null : e.target.value)}
      className={`${base} min-w-32 w-full`}
    />
  );
}

function Cell({ col, value }: { col: string; value: unknown }) {
  if (value === null || value === "" || value === undefined)
    return <span className="text-slate-300">-</span>;
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
