"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Dataset } from "@/lib/types";
import { fmtCompact, fmtMoney } from "@/lib/format";
import {
  computeKpis,
  monthlySeries,
  projectRows,
  receivableTop,
  segmentSales,
} from "@/lib/metrics";

const PIE_COLORS = ["#203864", "#4472C4", "#ED7D31", "#70AD47", "#FFC000", "#A5A5A5"];

const STATUS_DOT: Record<string, string> = {
  진행중: "bg-blue-500",
  완료: "bg-emerald-500",
  입찰중: "bg-violet-500",
  보류: "bg-slate-400",
};

export default function Overview({ ds, year }: { ds: Dataset; year: number }) {
  const k = computeKpis(ds, year);
  const monthly = monthlySeries(ds, year);
  const segments = segmentSales(ds, year);
  const projects = projectRows(ds);
  const receivables = receivableTop(ds);
  const active = projects.filter((p) => p.status === "진행중");

  const cards: { label: string; value: number; sub?: string; accent?: string }[] = [
    { label: `${year}년 매출액 (공급가액)`, value: k.revenue },
    { label: `${year}년 매입액 (공급가액)`, value: k.cost },
    { label: "매출총이익", value: k.gross, sub: `이익률 ${(k.margin * 100).toFixed(1)}%` },
    { label: `${year}년 경비 (VAT포함)`, value: k.expense },
    { label: "미수금 잔액", value: k.receivable, accent: "text-red-600" },
    { label: "미지급금", value: k.payable, accent: "text-amber-600" },
    { label: "현금성 자산", value: k.cash, accent: "text-emerald-600" },
    { label: "월 급여 총액", value: k.payroll, sub: `재직 ${k.headcount}명` },
  ];

  return (
    <div className="space-y-6">
      {/* KPI 카드 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
            <p className={`mt-1.5 text-2xl font-bold tabular-nums ${c.accent ?? "text-slate-800"}`}>
              {fmtCompact(c.value)}
              <span className="ml-0.5 text-sm font-medium text-slate-400">원</span>
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {c.sub ?? `${fmtMoney(c.value)}원`}
            </p>
          </div>
        ))}
      </div>

      {/* 차트 */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-3">
          <h3 className="mb-3 font-semibold text-slate-700">{year}년 월별 수지</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthly} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v: number) => fmtCompact(v)} tick={{ fontSize: 11 }} width={52} />
              <Tooltip formatter={(v) => `${fmtMoney(Number(v))}원`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="매출" fill="#203864" radius={[3, 3, 0, 0]} />
              <Bar dataKey="매입" fill="#ED7D31" radius={[3, 3, 0, 0]} />
              <Bar dataKey="경비" fill="#A5A5A5" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="mb-3 font-semibold text-slate-700">{year}년 사업부문별 매출</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={segments}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                style={{ fontSize: 12 }}
              >
                {segments.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${fmtMoney(Number(v))}원`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 프로젝트 & 미수금 */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-3">
          <h3 className="mb-3 font-semibold text-slate-700">
            진행중 프로젝트 <span className="text-sm font-normal text-slate-400">({active.length}건)</span>
          </h3>
          <ul className="space-y-3">
            {active.map((p) => {
              const pct = Math.round(p.progress <= 1 ? p.progress * 100 : p.progress);
              return (
                <li key={p.code} className="flex items-center gap-3">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[p.status] ?? "bg-slate-300"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-700">
                        <span className="mr-1.5 text-xs text-slate-400">{p.code}</span>
                        {p.name}
                      </p>
                      <p className="shrink-0 text-sm tabular-nums text-slate-500">{fmtCompact(p.amount)}원</p>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <span className="w-9 text-right text-xs tabular-nums text-slate-400">{pct}%</span>
                    </div>
                  </div>
                </li>
              );
            })}
            {!active.length && <p className="text-sm text-slate-400">진행중인 프로젝트가 없습니다.</p>}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="mb-3 font-semibold text-slate-700">미수금 상위</h3>
          <ul className="divide-y divide-slate-100">
            {receivables.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700">{r.client}</p>
                  <p className="truncate text-xs text-slate-400">
                    {r.date.slice(0, 10)} · {r.desc}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-red-600">
                  {fmtMoney(r.amount)}원
                </p>
              </li>
            ))}
            {!receivables.length && <p className="py-2 text-sm text-slate-400">미수금이 없습니다. 👍</p>}
          </ul>
        </div>
      </div>
    </div>
  );
}
