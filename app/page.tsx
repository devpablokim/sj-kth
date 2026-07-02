"use client";

import { useEffect, useMemo, useState } from "react";
import DataTable from "@/components/DataTable";
import Overview from "@/components/Overview";
import UploadZone from "@/components/UploadZone";
import { availableYears } from "@/lib/metrics";
import type { Dataset } from "@/lib/types";
import sampleData from "@/lib/sampleData.json";

const LS_KEY = "sj-kth-dataset-v1";
const TABS = ["개요", "매출", "매입", "프로젝트", "경비", "인사급여", "장비차량", "자금계좌", "거래처"];

export default function Home() {
  const [ds, setDs] = useState<Dataset | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("개요");
  const [yearSel, setYearSel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) setDs(JSON.parse(saved) as Dataset);
    } catch {
      // 저장된 데이터가 손상된 경우 무시
    }
    setReady(true);
  }, []);

  const load = (d: Dataset) => {
    setDs(d);
    setError(null);
    setYearSel(null);
    setTab("개요");
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(d));
    } catch {
      // 저장 실패해도 화면 표시는 계속
    }
  };

  const clear = () => {
    localStorage.removeItem(LS_KEY);
    setDs(null);
    setYearSel(null);
  };

  const years = useMemo(() => (ds ? availableYears(ds) : []), [ds]);
  const year = yearSel ?? years[0] ?? new Date().getFullYear();

  if (!ready) return null;

  if (!ds) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
        <div className="text-center">
          <p className="text-sm font-semibold tracking-widest text-[#203864]">SHINJEONG DEVELOPMENT</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-800">경영지원 대시보드</h1>
          <p className="mt-3 text-slate-500">
            경영지원 마스터 엑셀 파일을 불러오면 매출·매입·프로젝트·자금 현황을 한눈에 보여드립니다.
          </p>
        </div>

        <UploadZone onData={load} onError={setError} />

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">⚠️ {error}</p>
        )}

        <div className="text-center">
          <button
            onClick={() =>
              load({ ...(sampleData as unknown as Dataset), loadedAt: new Date().toISOString() })
            }
            className="text-sm text-slate-400 underline underline-offset-4 hover:text-slate-600"
          >
            파일이 없다면, 가상 예시 데이터로 둘러보기
          </button>
        </div>

        <div className="grid gap-3 text-sm text-slate-500 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-700">🔒 서버 전송 없음</p>
            <p className="mt-1">엑셀 파싱은 100% 브라우저 안에서 이루어집니다.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-700">💾 브라우저에만 저장</p>
            <p className="mt-1">불러온 데이터는 이 컴퓨터의 브라우저에만 보관됩니다.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-700">🚫 저장소에 데이터 없음</p>
            <p className="mt-1">코드 저장소에는 어떤 실데이터도 올라가지 않습니다.</p>
          </div>
        </div>
      </main>
    );
  }

  const tabs = TABS.filter((t) => t === "개요" || (ds.sheets[t]?.length ?? 0) > 0);

  return (
    <div className="min-h-screen">
      <header className="bg-[#203864] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="mr-auto">
            <h1 className="text-lg font-bold">신정개발 경영지원 대시보드</h1>
            <p className="text-xs text-white/60">
              {ds.fileName}
              {ds.loadedAt && ` · ${new Date(ds.loadedAt).toLocaleString("ko-KR")} 불러옴`}
              {" · 🔒 브라우저에서만 처리됨"}
            </p>
          </div>
          {years.length > 0 && (
            <select
              value={year}
              onChange={(e) => setYearSel(Number(e.target.value))}
              className="rounded-lg border border-white/30 bg-transparent px-2 py-1.5 text-sm [&>option]:text-slate-800"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          )}
          <UploadZone onData={load} onError={(m) => setError(m)} compact />
          <button
            onClick={clear}
            className="rounded-lg border border-white/30 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10"
          >
            데이터 지우기
          </button>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                tab === t
                  ? "bg-slate-100 text-[#203864]"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">⚠️ {error}</p>
        )}
        {tab === "개요" ? <Overview ds={ds} year={year} /> : <DataTable rows={ds.sheets[tab] ?? []} />}
      </main>

      <footer className="pb-8 text-center text-xs text-slate-400">
        (주)신정개발 경영지원 — 데이터는 서버로 전송되지 않으며 이 브라우저에만 저장됩니다.
      </footer>
    </div>
  );
}
