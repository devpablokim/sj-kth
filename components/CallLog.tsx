/*
 * CallLog — jev/생성 모델 호출 원문 로그 패널 (쇼케이스 "판정 로그" 구조, 레퍼런스 톤).
 * 헤더: 건수 · JSON 펼침/접기 · 지우기. 서브헤더: 최근 40회 지연 스파크라인 + 평균/p95 + 누적 횟수/비용($, ≈₩).
 * 항목(최신순, 최대 200개): 시각 · TAG · 요약 · latency, 둘째 줄 API/토큰/비용, 펼치면 request/response <pre>.
 */
"use client";

import { useState } from "react";
import type { CallLogEntry } from "@/lib/types";
import { fmtInt, fmtUsd } from "@/lib/format";

interface Props {
  calls: CallLogEntry[];
  onClear: () => void;
}

/** 클라이언트 표시용 환율 (서버 stats.costKrw 는 KRW_PER_USD env 기준) */
const KRW_PER_USD = 1400;
const MAX_RENDER = 200;
const SPARK_N = 40;

const pad2 = (n: number) => String(n).padStart(2, "0");
/** HH:mm:ss.SS (1/100초) */
function fmtTime(at: number): string {
  const d = new Date(at);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${pad2(Math.floor(d.getMilliseconds() / 10))}`;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 1) ?? "null";
  } catch {
    return "[직렬화 불가]";
  }
}

const TAG_CLS: Record<CallLogEntry["tag"], string> = {
  analyze: "border-ink bg-ink text-white",
  draft: "border-accent text-accent",
  draft_judge: "border-line text-muted",
};
const TAG_TEXT: Record<CallLogEntry["tag"], string> = {
  analyze: "analyze",
  draft: "draft",
  draft_judge: "judge",
};

/** 최근 N회 지연 스파크라인 (inline SVG 120×22, 잉크 1px) */
function Sparkline({ values }: { values: number[] }) {
  const W = 120;
  const H = 22;
  const PAD = 2;
  if (values.length === 0) {
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="shrink-0 text-faint">
        <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? (W - PAD * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => {
    const x = values.length > 1 ? PAD + i * stepX : W / 2;
    const y = H - PAD - ((v - min) / span) * (H - PAD * 2);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`최근 ${values.length}회 지연 추이`}
      className="shrink-0 text-ink"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="1.6" fill="var(--accent)" />
    </svg>
  );
}

export default function CallLog({ calls, onClear }: Props) {
  const [expanded, setExpanded] = useState(false);

  const latencies = calls.map((c) => c.latencyMs);
  const sorted = [...latencies].sort((a, b) => a - b);
  const avg = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  const p95 = percentile(sorted, 0.95);
  const sumUsd = calls.reduce((a, c) => a + (Number.isFinite(c.costUsd) ? c.costUsd : 0), 0);
  const krw = Math.round(sumUsd * KRW_PER_USD * 10) / 10;
  const spark = latencies.slice(-SPARK_N);
  const shown = calls.slice(-MAX_RENDER).reverse();

  const btn = "label h-6 rounded-[3px] border px-2 !text-[9px] transition-colors disabled:opacity-40";

  return (
    <section className="panel flex flex-col p-3" aria-label="호출 로그">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label">
          call log <span className="tabular ml-1 text-ink">{fmtInt(calls.length)}건</span>
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={`${btn} ${expanded ? "border-ink bg-ink !text-white" : "border-line text-ink hover:border-ink"}`}
            aria-pressed={expanded}
            aria-label={expanded ? "요청/응답 JSON 접기" : "요청/응답 JSON 펼침"}
            disabled={calls.length === 0}
          >
            {expanded ? "JSON 접기" : "JSON 펼침"}
          </button>
          <button
            type="button"
            onClick={onClear}
            className={`${btn} border-line text-muted hover:border-ink hover:text-ink`}
            aria-label="호출 로그 지우기"
            disabled={calls.length === 0}
          >
            지우기
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line pb-2">
        <Sparkline values={spark} />
        <span className="tabular font-mono text-[10px] text-muted">
          평균 <span className="font-bold text-ink">{fmtInt(avg)}ms</span> · p95{" "}
          <span className="font-bold text-ink">{fmtInt(p95)}ms</span>
        </span>
        <span className="tabular font-mono text-[10px] text-muted">
          누적 <span className="font-bold text-ink">{fmtInt(calls.length)}회</span> ·{" "}
          <span className="font-bold text-ink">{fmtUsd(sumUsd)}</span> (≈ ₩{krw.toFixed(1)})
        </span>
      </div>

      {calls.length === 0 ? (
        <div className="flex items-center justify-center py-6 text-center text-[12px] text-muted">
          jev 호출이 생기면 요청 · 응답 원문이 여기에 쌓입니다
        </div>
      ) : (
        <ul className="thin-scroll max-h-[360px] overflow-y-auto" aria-live="polite">
          {shown.map((c) => (
            <li key={c.id} className="border-b border-line py-1.5 last:border-b-0">
              <div className="flex items-center gap-2">
                <span className="tabular shrink-0 font-mono text-[10px] text-muted">{fmtTime(c.at)}</span>
                <span
                  className={`label inline-flex h-[15px] shrink-0 items-center rounded-[3px] border px-1.5 !text-[8px] ${TAG_CLS[c.tag]}`}
                  title={`${c.tag} · ${c.mode} · ${c.model}`}
                >
                  {TAG_TEXT[c.tag]}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] leading-none text-ink" title={c.summary}>
                  {c.summary}
                </span>
                <span className="tabular shrink-0 font-mono text-[11px] font-bold leading-none text-ink">{fmtInt(c.latencyMs)}ms</span>
              </div>
              <div className="tabular mt-1 pl-[68px] font-mono text-[10px] leading-none text-muted">
                API {fmtInt(c.latencyMs)}ms · {fmtInt(c.usage.inputTokens + c.usage.outputTokens)} tok · {fmtUsd(c.costUsd)}
                {c.mode === "demo" ? " · demo" : ""}
              </div>
              {expanded && (
                <pre className="thin-scroll mt-1.5 max-h-[260px] overflow-auto whitespace-pre-wrap break-all rounded-[4px] border border-line bg-[#fafaf8] p-2 font-mono text-[10px] leading-[1.4] text-ink">
                  {safeJson({ request: c.request, response: c.response })}
                </pre>
              )}
            </li>
          ))}
          {calls.length > MAX_RENDER && (
            <li className="label py-2 text-center">최근 {MAX_RENDER}건만 표시 (전체 {fmtInt(calls.length)}건)</li>
          )}
        </ul>
      )}
    </section>
  );
}
