/*
 * ContentFeed — 좌측 큰 패널. "CONTENT FEED  {analyzed} / {total}" 헤더와
 * 포스트 타일 모자이크(포스트 수에 따라 6~8열). 분석 중인 타일은 빨간 테두리, 완료 타일은 살짝 어둡게 + 체크.
 * 아래에는 "TOP BENCHMARKS" — 벤치마크 점수 상위 포스트 순위표(따라 할 가치가 큰 순).
 * 타일/순위 클릭은 onSelect(postId) 로만 올리고, 무엇을 열지(상세 드로어)는 Dashboard 가 정합니다.
 * AI 생성 예시 세트면 헤더 우측에 "AI 생성 예시 · 실제 게시물 아님" 표시.
 */
"use client";

import type { Post, PostAnalysis } from "@/lib/types";
import { fmtInt, truncate } from "@/lib/format";
import PostTile, { PLATFORM_NAME, type TileStatus } from "./PostTile";

interface Props {
  posts: Post[];
  analyses: Map<string, PostAnalysis>;
  inFlight: string[];
  errorIds: Set<string>;
  selectedId: string | null;
  onSelect: (postId: string) => void;
}

const TOP_N = 8;

export default function ContentFeed({ posts, analyses, inFlight, errorIds, selectedId, onSelect }: Props) {
  const inFlightSet = new Set(inFlight);
  const statusOf = (id: string): TileStatus => {
    if (inFlightSet.has(id)) return "analyzing";
    if (analyses.has(id)) return "done";
    if (errorIds.has(id)) return "error";
    return "idle";
  };
  const cols = posts.length > 60 ? "grid-cols-8" : posts.length > 24 ? "grid-cols-6" : "grid-cols-4";
  const generated = posts.some((p) => p.generated);
  const postById = new Map(posts.map((p) => [p.id, p]));
  const ranked = [...analyses.values()]
    .sort((a, b) => b.benchmarkScore - a.benchmarkScore)
    .slice(0, TOP_N)
    .map((a) => ({ a, post: postById.get(a.postId) }))
    .filter((r): r is { a: PostAnalysis; post: Post } => Boolean(r.post));
  const maxScore = ranked.length ? Math.max(...ranked.map((r) => r.a.benchmarkScore), 1) : 1;

  return (
    <section className="panel flex min-h-0 flex-col p-3" aria-label="콘텐츠 피드">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="label">content feed</span>
        <span className="flex min-w-0 items-center gap-2">
          {generated && (
            <span className="truncate text-[10px] text-muted" title="AI 가 카테고리 예시로 만든 포스트 — 실제 게시물이 아닙니다">
              AI 생성 예시 · 실제 게시물 아님
            </span>
          )}
          <span className="label tabular shrink-0">
            {fmtInt(analyses.size)} / {fmtInt(posts.length)}
          </span>
        </span>
      </div>
      {posts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-16 text-[12px] text-muted">
          표시할 포스트가 없습니다. 위 &lsquo;분석 대상&rsquo;에서 불러오거나 샘플을 사용하세요.
        </div>
      ) : (
        <div className={`thin-scroll grid max-h-[560px] ${cols} gap-[5px] overflow-y-auto pr-0.5`} role="list">
          {posts.map((post) => {
            const st = statusOf(post.id);
            const a = analyses.get(post.id);
            return (
              <div
                key={post.id}
                role="listitem"
                className={selectedId === post.id ? "rounded-[3px] outline outline-2 outline-offset-1 outline-ink" : ""}
              >
                <PostTile
                  post={post}
                  status={st}
                  onClick={() => onSelect(post.id)}
                  title={
                    a
                      ? `${post.brand} · ${a.summary} · 벤치마크 ${Math.round(a.benchmarkScore)}점`
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      {/* 벤치마크 순위표 — 따라 할 가치가 큰 포스트 순 */}
      <div className="mt-4 border-t border-line pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="label">top benchmarks</span>
          <span className="label tabular">{ranked.length ? `${ranked.length} / ${analyses.size}` : "—"}</span>
        </div>
        {ranked.length === 0 ? (
          <p className="py-3 text-[11px] text-muted">판정이 끝난 포스트 중 벤치마크 점수 상위 {TOP_N}개가 여기에 순서대로 쌓입니다.</p>
        ) : (
          <ol className="flex flex-col">
            {ranked.map(({ a, post }, i) => {
              const strong = a.answers.make_draft.type === "boolean" && a.answers.make_draft.probability >= 0.5;
              const width = `${Math.max(4, (a.benchmarkScore / maxScore) * 100)}%`;
              return (
                <li key={a.postId} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onSelect(post.id)}
                    className={[
                      "grid w-full grid-cols-[18px_44px_minmax(0,1fr)_120px_34px] items-center gap-2 py-[5px] text-left",
                      selectedId === post.id ? "bg-[#fafaf8]" : "hover:bg-[#fafaf8]",
                    ].join(" ")}
                    aria-label={`${i + 1}위 ${post.brand} · 벤치마크 ${a.benchmarkScore}점`}
                  >
                    <span className="label tabular !text-[9px]">{String(i + 1).padStart(2, "0")}</span>
                    <span className="w-11">
                      <PostTile post={post} status="idle" size="sm" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-semibold leading-tight">
                        {post.brand}
                        <span className="ml-1 font-normal text-muted">
                          @{post.handle.replace(/^@/, "")} · {PLATFORM_NAME[post.platform]}
                        </span>
                      </span>
                      <span className="block truncate text-[10px] leading-tight text-muted">{truncate(a.summary, 70)}</span>
                    </span>
                    <span className="bar-track">
                      <span className={strong ? "bar-dashed" : "bar"} style={{ width }} />
                    </span>
                    <span className="label tabular text-right !text-ink">{a.benchmarkScore}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
