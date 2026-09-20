/*
 * Drafts — "DRAFTS GENERATED  {n}" 패널. 가로 스크롤 카드 행:
 * 원본 타일(sm) · "{원본 브랜드} → 우리 브랜드" · headline · matchScore%(빨강) · 심사 결과 칩(승인/검토/차단) · OPEN THIS DRAFT.
 * 시안 생성 중이면 맨 뒤에 "generating…" 자리표시 카드.
 */
"use client";

import type { Draft, Post } from "@/lib/types";
import { fmtInt, fmtScorePct } from "@/lib/format";
import PostTile from "./PostTile";

interface Props {
  drafts: Draft[];
  /** 지금 시안을 만들고 있는 원본 포스트 ID */
  drafting: string | null;
  posts: Post[];
  onOpen: (draft: Draft) => void;
  draftCount: number;
}

export default function Drafts({ drafts, drafting, posts, onOpen, draftCount }: Props) {
  const postOf = new Map(posts.map((p) => [p.id, p] as const));
  const draftingPost = drafting ? postOf.get(drafting) : undefined;
  const empty = drafts.length === 0 && !drafting;

  return (
    <section className="panel p-3" aria-label="생성된 시안">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="label">drafts generated</span>
        <span className="label tabular">{fmtInt(drafts.length)}</span>
      </div>

      {empty ? (
        <div className="flex items-center justify-center py-6 text-center text-[12px] text-muted">
          run 이 끝나면 상위 {fmtInt(draftCount)}개 포스트로 시안을 만듭니다
        </div>
      ) : (
        <div className="thin-scroll flex gap-4 overflow-x-auto pb-1" role="list">
          {drafts.map((d) => {
            const src = postOf.get(d.sourcePostId);
            return (
              <div key={d.id} role="listitem" className="flex w-[190px] min-w-[190px] shrink-0 gap-2">
                <div className="w-14 shrink-0">
                  {src ? (
                    <PostTile post={src} size="sm" />
                  ) : (
                    <div className="aspect-[16/10] w-full rounded-[3px] bg-page" aria-hidden="true" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="truncate text-[10px] leading-none text-muted" title={`${src?.brand ?? d.sourcePostId} → 우리 브랜드`}>
                    {src?.brand ?? d.sourcePostId} → 우리 브랜드
                  </div>
                  <div className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink" title={d.headline}>
                    {d.headline}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="tabular font-mono text-[14px] font-bold leading-none text-accent">{fmtScorePct(d.matchScore)}</span>
                    {d.review && (
                      <span
                        className={[
                          "label inline-flex h-[14px] items-center rounded-[2px] border px-1 !text-[8px]",
                          d.review.decision === "approve" ? "border-ok text-ok" : d.review.decision === "block" ? "border-accent bg-accent text-white" : "border-line text-muted",
                        ].join(" ")}
                        title={d.review.reasons.join(" · ")}
                      >
                        {d.review.decision === "approve" ? "승인" : d.review.decision === "block" ? "차단" : "검토"}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpen(d)}
                    className="label mt-1.5 self-start !text-[9px] !text-ink hover:underline"
                    aria-label={`${src?.brand ?? d.sourcePostId} 벤치마크 시안 열기`}
                  >
                    open this draft
                  </button>
                </div>
              </div>
            );
          })}

          {drafting && (
            <div role="listitem" className="flex w-[190px] min-w-[190px] shrink-0 gap-2" aria-live="polite">
              <div className="w-14 shrink-0">
                {draftingPost ? (
                  <PostTile post={draftingPost} size="sm" status="analyzing" />
                ) : (
                  <div className="aspect-[16/10] w-full animate-pulse rounded-[3px] bg-page" aria-hidden="true" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="truncate text-[10px] leading-none text-muted">
                  {draftingPost?.brand ?? drafting} → 우리 브랜드
                </div>
                <div className="mt-1 h-[13px] w-4/5 animate-pulse rounded-[2px] bg-page" aria-hidden="true" />
                <div className="mt-1 h-[13px] w-3/5 animate-pulse rounded-[2px] bg-page" aria-hidden="true" />
                <div className="label mt-2 animate-pulse text-accent">generating…</div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
