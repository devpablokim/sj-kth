/*
 * PostDrawer — 타일/TOP BENCHMARKS 를 누르면 열리는 포스트 상세 슬라이드오버(우측 고정 560px, 폰에서는 전폭).
 * 위→아래: 헤더(브랜드 · @handle · 플랫폼 · 예시 뱃지) · 타일 · 원문 전체 · 슬라이드 · 지표 · 게시일 · "원문 열기 ↗" ·
 * jev 판정(벤치마크 점수 · 확신도 · 요약 · JudgementRows) · 시안(있으면 "시안 열기", 없으면 POST /api/draft 로 생성).
 * 배경 클릭 · Esc 로 닫히고, 열려 있는 동안 body 스크롤을 잠급니다. 닫히면 진행 중인 시안 요청은 abort.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { CallLogEntry, Draft, DraftRequest, DraftResponse, Post, PostAnalysis } from "@/lib/types";
import { fmtInt, fmtPct } from "@/lib/format";
import { useElapsedSeconds } from "@/lib/client/useElapsedSeconds";
import PostTile, { PLATFORM_NAME } from "./PostTile";
import JudgementRows, { tagsOf } from "./JudgementRows";

interface Props {
  post: Post;
  analysis: PostAnalysis | null;
  brand: { name: string; category: string; positioning: string };
  onClose: () => void;
  onDraftCreated: (draft: Draft, calls: CallLogEntry[]) => void;
  /** 이 포스트로 이미 만들어진 시안 (실행 중 자동 생성분 포함) */
  existingDraft?: Draft | null;
  onOpenDraft: (draft: Draft) => void;
}

/** 실제로 열 수 있는 원문 링크인지 — http(s) 이고 샘플용 가짜 도메인이 아님 */
function canOpenUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) && !url.includes("example.invalid");
}

/** ISO → YYYY-MM-DD (로케일/타임존 무관하게 결정적) */
function fmtDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return m ? m[1] : null;
}

function errorOf(json: unknown, status: number): string {
  if (json && typeof json === "object") {
    const e = (json as { error?: unknown }).error;
    if (typeof e === "string" && e.trim()) return e;
  }
  return `서버 응답 오류 (${status})`;
}

const btnCls = "label inline-flex h-8 items-center justify-center gap-1.5 rounded-[4px] border px-3 !text-[10px] transition-colors";

export default function PostDrawer({ post, analysis, brand, onClose, onDraftCreated, existingDraft = null, onOpenDraft }: Props) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Draft | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const elapsed = useElapsedSeconds(startedAt);

  // Esc 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 열려 있는 동안 body 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // 닫히면(언마운트) 진행 중 시안 요청 중단
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const draft = existingDraft ?? created;
  const drafting = startedAt !== null;
  const nameMissing = brand.name.trim().length === 0;
  const canDraft = Boolean(analysis) && !nameMissing && !drafting;

  const makeDraft = async () => {
    if (!analysis || !canDraft) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError(null);
    setStartedAt(Date.now());
    try {
      const body: DraftRequest = {
        post,
        analysis,
        brand: { name: brand.name.trim(), category: brand.category.trim(), positioning: brand.positioning.trim() },
      };
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setError(errorOf(json, res.status));
        return;
      }
      const data = json as Partial<DraftResponse> | null;
      if (!data || !data.draft || typeof data.draft !== "object") {
        setError("응답에 시안이 없습니다. 다시 시도해 주세요.");
        return;
      }
      setCreated(data.draft);
      onDraftCreated(data.draft, Array.isArray(data.calls) ? data.calls : []);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(`요청 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        setStartedAt(null);
      }
    }
  };

  const metrics: Array<[string, number]> = (
    [
      ["likes", post.metrics?.likes],
      ["comments", post.metrics?.comments],
      ["shares", post.metrics?.shares],
      ["views", post.metrics?.views],
    ] as Array<[string, number | undefined]>
  ).filter((m): m is [string, number] => typeof m[1] === "number" && Number.isFinite(m[1]));
  const posted = fmtDate(post.postedAt);
  const openable = canOpenUrl(post.url);
  const handle = `@${post.handle.replace(/^@/, "")}`;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="포스트 상세">
      <button
        type="button"
        className="absolute inset-0 bg-ink/30"
        onClick={onClose}
        aria-label="배경을 눌러 닫기"
        tabIndex={-1}
      />
      <aside className="drawer-in absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-line bg-panel shadow-xl">
        {/* 헤더 */}
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-4">
          <span className="label shrink-0">post</span>
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted" title={`${post.brand} · ${handle} · ${PLATFORM_NAME[post.platform]}`}>
            <span className="font-semibold text-ink">{post.brand}</span> · {handle} · {PLATFORM_NAME[post.platform]}
          </span>
          {post.generated && (
            <span
              className="label inline-flex h-[16px] shrink-0 items-center rounded-[2px] border border-line bg-page px-1.5 !text-[8px] !text-ink"
              title="AI 가 카테고리 예시로 만든 포스트 — 실제 게시물이 아닙니다"
            >
              예시
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="label flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border border-line !text-[12px] !text-ink hover:border-ink"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="thin-scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
          {/* 원문 */}
          <section aria-label="원문" className="flex flex-col gap-2.5">
            <div className="w-full max-w-[320px]">
              <PostTile post={post} size="lg" status={analysis ? "done" : "idle"} />
            </div>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{post.text}</p>
            {post.slides?.length ? (
              <ol className="flex flex-col gap-1" aria-label="슬라이드">
                {post.slides.map((s, i) => (
                  <li key={i} className="flex gap-2 rounded-[4px] border border-line bg-page px-2 py-1.5 text-[11px] leading-snug text-ink">
                    <span className="tabular shrink-0 font-mono text-[10px] text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1">{s}</span>
                  </li>
                ))}
              </ol>
            ) : null}
            {(metrics.length > 0 || posted) && (
              <div className="label flex flex-wrap gap-x-3 gap-y-1 normal-case tracking-normal">
                {metrics.map(([k, v]) => (
                  <span key={k} className="tabular">
                    {k} <span className="text-ink">{fmtInt(v)}</span>
                  </span>
                ))}
                {posted && <span className="tabular">posted {posted}</span>}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {openable ? (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${btnCls} border-ink bg-panel !text-ink hover:bg-ink hover:!text-white`}
                  aria-label="원문을 새 탭에서 열기"
                >
                  원문 열기 ↗
                </a>
              ) : (
                <span className="text-[11px] text-muted">원문 링크 없음 (샘플/예시 데이터)</span>
              )}
            </div>
          </section>

          {/* 판정 */}
          <section aria-label="판정" className="border-t border-line pt-4">
            <div className="label mb-2">judgement · 판정</div>
            {analysis ? (
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="tabular font-mono text-[24px] font-bold leading-none text-ink" aria-label={`벤치마크 점수 ${analysis.benchmarkScore}`}>
                    {fmtInt(analysis.benchmarkScore)}
                  </span>
                  <span className="label tabular">
                    benchmark · confidence {fmtPct(analysis.confidence)} · {fmtInt(analysis.latencyMs)} ms
                  </span>
                </div>
                {tagsOf(analysis).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tagsOf(analysis).map((t) => (
                      <span
                        key={t}
                        className="label inline-flex h-[16px] items-center rounded-[3px] border border-line px-1.5 !text-[8px] !text-ink"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[12px] leading-snug text-muted">{analysis.summary}</p>
                <JudgementRows analysis={analysis} className="min-w-0" />
              </div>
            ) : (
              <p className="text-[12px] text-muted">아직 판정 전 — RUN ANALYSIS 를 실행하세요</p>
            )}
          </section>

          {/* 시안 */}
          <section aria-label="우리 브랜드 시안" className="border-t border-line pt-4">
            <div className="label mb-2">draft · 우리 브랜드 시안</div>
            {draft ? (
              <div className="flex flex-col gap-2">
                <div className="text-[14px] font-semibold leading-snug text-ink">{draft.headline}</div>
                <div>
                  <button
                    type="button"
                    onClick={() => onOpenDraft(draft)}
                    className={`${btnCls} border-ink bg-ink !text-white hover:bg-black`}
                    aria-label="시안 열기"
                  >
                    시안 열기
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void makeDraft()}
                    disabled={!canDraft}
                    className={`${btnCls} border-ink bg-ink !text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40`}
                    aria-label="이 포스트로 우리 브랜드 시안 만들기"
                    aria-busy={drafting}
                  >
                    {drafting ? (
                      <>
                        <span
                          className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent"
                          aria-hidden="true"
                        />
                        생성 중… {elapsed}s
                      </>
                    ) : (
                      "이 포스트로 우리 브랜드 시안 만들기"
                    )}
                  </button>
                  {!analysis ? (
                    <span className="text-[11px] text-muted">판정이 끝나야 시안을 만들 수 있어요</span>
                  ) : nameMissing ? (
                    <span className="text-[11px] text-muted">위 &lsquo;우리 브랜드&rsquo;에 브랜드명을 입력하세요</span>
                  ) : null}
                </div>
                {error && (
                  <p className="text-[11px] leading-snug text-accent" role="alert">
                    {error}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-line px-4 py-3">
          <button type="button" onClick={onClose} className={`${btnCls} border-line !text-ink hover:border-ink`} aria-label="닫기">
            닫기
          </button>
          <span className="ml-auto text-[10px] text-muted">Esc 로 닫기</span>
        </div>
      </aside>
    </div>
  );
}
