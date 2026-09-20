/*
 * DraftDrawer — 시안 상세 슬라이드오버(우측 고정 520px). 위: 원본(벤치마크) 포스트,
 * 아래: 우리 브랜드 시안(headline · body · slides · meta). 복사 / 닫기 버튼, 배경 클릭·Esc 로 닫힘.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { Draft, Post } from "@/lib/types";
import { fmtScorePct } from "@/lib/format";
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
