/*
 * DraftDrawer — 시안 상세 슬라이드오버(우측 고정 520px). 위: 원본(벤치마크) 포스트,
 * 가운데: 우리 브랜드 시안(headline · body · slides · meta), 아래: jev 적합성 심사(승인/검토/차단 · 5개 지표 · 사유).
 * 복사 / 닫기 버튼, 배경 클릭·Esc 로 닫힘.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { Draft, DraftReview, Post } from "@/lib/types";
import { fmtPct, fmtScorePct } from "@/lib/format";
import { FORMAT_LABEL_KO } from "@/lib/scoring";
import PostTile, { PLATFORM_NAME } from "./PostTile";

interface Props {
  draft: Draft;
  sourcePost: Post | undefined;
  onClose: () => void;
}

/** 클립보드용 평문 — headline / body / 번호 매긴 slides */
function toPlainText(d: Draft): string {
  const lines = [d.headline, "", d.body];
  if (d.slides?.length) {
    lines.push("", ...d.slides.map((s, i) => `${i + 1}. ${s}`));
  }
  return lines.join("\n");
}

const btnCls = "label h-8 rounded-[4px] border px-3 !text-[10px] transition-colors";

const DECISION: Record<DraftReview["decision"], { text: string; cls: string; hint: string }> = {
  approve: { text: "승인", cls: "border-ok bg-ok text-white", hint: "안전 · 표현 · 타깃 · 포지셔닝 모두 통과 — 그대로 써도 됨" },
  review: { text: "검토", cls: "border-line bg-page text-ink", hint: "게시 전에 사람이 한 번 확인" },
  block: { text: "차단", cls: "border-accent bg-accent text-white", hint: "브랜드 안전 · 표시광고 · 포지셔닝 중 하나가 위험 — 수정 필요" },
};

/** 심사 지표 행 — 값이 좋을수록(안전·적합·품질 ↑, 위험·모순 ↓) 검정, 나쁘면 빨강 점선 */
function ReviewRows({ review }: { review: DraftReview }) {
  const rows: Array<{ label: string; value: string; pct: number; bad: boolean; hint: string }> = [
    { label: "brand safety", value: fmtPct(review.brandSafety), pct: review.brandSafety, bad: review.brandSafety < 0.5, hint: "비하·혐오·비방 등이 없을 확률" },
    { label: "claim risk", value: fmtPct(review.claimRisk), pct: review.claimRisk, bad: review.claimRisk >= 0.4, hint: "최상급·보장·근거 없는 수치 등 표시광고 위험 표현이 있을 확률" },
    { label: "audience", value: fmtPct(review.audienceMatch), pct: review.audienceMatch, bad: review.audienceMatch < 0.5, hint: "타깃 고객에게 맞는 말투·내용일 확률" },
    { label: "contradiction", value: fmtPct(review.contradictsPositioning), pct: review.contradictsPositioning, bad: review.contradictsPositioning >= 0.4, hint: "우리 포지셔닝과 모순될 확률" },
    { label: "quality", value: `${review.quality.toFixed(1)} / ${review.qualityMax}`, pct: review.qualityMax > 0 ? review.quality / review.qualityMax : 0, bad: review.quality < 1.5, hint: "지금 그대로 게시해도 되는 완성도" },
  ];
  return (
    <div role="table" aria-label="시안 심사 지표">
      {rows.map((r) => (
        <div key={r.label} role="row" className="flex h-[22px] items-center gap-2 border-b border-line last:border-b-0" title={r.hint}>
          <span role="rowheader" className="label w-[84px] shrink-0 truncate">
            {r.label}
          </span>
          <span role="cell" className={`w-[64px] shrink-0 text-[11px] leading-none ${r.bad ? "text-accent" : "text-ink"}`}>
            {r.value}
          </span>
          <span role="cell" className="bar-track min-w-0 flex-1">
            <span className={r.bad ? "bar-dashed" : "bar"} style={{ width: `${Math.max(0, Math.min(1, r.pct)) * 100}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DraftDrawer({ draft, sourcePost, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Esc 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 언마운트 시 "복사됨" 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const copy = async () => {
    const text = toPlainText(draft);
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // 비보안 컨텍스트/권한 거부 시 textarea + execCommand 폴백
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (!ok) return;
    setCopied(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1500);
  };

  const formatKo = FORMAT_LABEL_KO[draft.format] ?? draft.format;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="시안 상세">
      <button
        type="button"
        className="absolute inset-0 bg-ink/30"
        onClick={onClose}
        aria-label="배경을 눌러 닫기"
        tabIndex={-1}
      />
      <aside className="drawer-in absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col border-l border-line bg-panel shadow-xl">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-4">
          <span className="label">draft</span>
          <button
            type="button"
            onClick={onClose}
            className="label flex h-6 w-6 items-center justify-center rounded-[3px] border border-line !text-[12px] !text-ink hover:border-ink"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="thin-scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
          {/* 원본 */}
          <section aria-label="원본 벤치마크 포스트">
            <div className="label mb-2">원본 (벤치마크)</div>
            {sourcePost ? (
              <div className="flex flex-col gap-2.5">
                <div className="w-full max-w-[300px]">
                  <PostTile post={sourcePost} size="lg" />
                </div>
                <div>
                  <div className="text-[14px] font-bold leading-tight text-ink">{sourcePost.brand}</div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {sourcePost.handle} · {PLATFORM_NAME[sourcePost.platform]}
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink">{sourcePost.text}</p>
                {sourcePost.slides?.length ? (
                  <ol className="flex flex-col gap-1" aria-label="원본 슬라이드">
                    {sourcePost.slides.map((s, i) => (
                      <li key={i} className="flex gap-2 rounded-[4px] border border-line bg-page px-2 py-1.5 text-[11px] leading-snug text-ink">
                        <span className="tabular shrink-0 font-mono text-[10px] text-muted">{i + 1}</span>
                        <span className="min-w-0 flex-1">{s}</span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            ) : (
              <div className="text-[12px] text-muted">원본 포스트({draft.sourcePostId})를 찾을 수 없습니다.</div>
            )}
          </section>

          {/* 시안 */}
          <section aria-label="우리 브랜드 시안" className="border-t border-line pt-4">
            <div className="label mb-2">우리 브랜드 시안</div>
            <h2 className="text-[18px] font-semibold leading-snug text-ink">{draft.headline}</h2>
            <p className="mt-2.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{draft.body}</p>
            {draft.slides?.length ? (
              <ol className="mt-3 flex flex-col gap-1.5" aria-label="시안 슬라이드">
                {draft.slides.map((s, i) => (
                  <li key={i} className="flex gap-2 rounded-[4px] border border-line px-2.5 py-2 text-[12px] leading-snug text-ink">
                    <span className="tabular shrink-0 font-mono text-[10px] font-bold text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1">{s}</span>
                  </li>
                ))}
              </ol>
            ) : null}
            <div className="label mt-3 normal-case tracking-normal">
              {PLATFORM_NAME[draft.platform]} · {formatKo} · match{" "}
              <span className="font-bold text-accent">{fmtScorePct(draft.matchScore)}</span> · {draft.model}
            </div>
          </section>

          {/* 심사 */}
          <section aria-label="시안 심사" className="border-t border-line pt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="label">review · jev 적합성 심사</span>
              {draft.review && (
                <span className={`label inline-flex h-[18px] items-center rounded-[3px] border px-2 !text-[9px] ${DECISION[draft.review.decision].cls}`} title={DECISION[draft.review.decision].hint}>
                  {DECISION[draft.review.decision].text}
                </span>
              )}
            </div>
            {draft.review ? (
              <div className="flex flex-col gap-2">
                <ReviewRows review={draft.review} />
                <ul className="flex flex-col gap-0.5 text-[11px] leading-snug text-muted">
                  {draft.review.reasons.map((r) => (
                    <li key={r}>· {r}</li>
                  ))}
                </ul>
                <p className="text-[10px] leading-snug text-faint">
                  jev 가 시안을 보고 브랜드 안전 · 표시광고 위험 표현 · 타깃 적합 · 포지셔닝 모순 · 완성도를 판정하고, 승인/검토/차단 규칙은 코드가 정합니다 (차단: 안전 &lt; 50% · 위험 표현 ≥ 70% · 모순 ≥ 70%).
                </p>
              </div>
            ) : (
              <p className="text-[12px] text-muted">이 시안은 심사 결과가 없습니다 (이전 버전에서 만든 시안).</p>
            )}
          </section>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={copy}
            className={`${btnCls} border-ink bg-ink !text-white hover:bg-black`}
            aria-label="시안 텍스트 복사"
          >
            {copied ? "복사됨" : "복사"}
          </button>
          <button type="button" onClick={onClose} className={`${btnCls} border-line !text-ink hover:border-ink`} aria-label="닫기">
            닫기
          </button>
          <span className="ml-auto text-[10px] text-muted">Esc 로 닫기</span>
        </div>
      </aside>
    </div>
  );
}
