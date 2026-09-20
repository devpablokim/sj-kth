/*
 * ContentFeed — 좌측 큰 패널. "CONTENT FEED  {analyzed} / {total}" 헤더와
 * 8열 포스트 타일 모자이크. 분석 중인 타일은 빨간 테두리, 완료 타일은 살짝 어둡게 + 체크.
 */
"use client";

import type { Post, PostAnalysis } from "@/lib/types";
import { fmtInt } from "@/lib/format";
import PostTile, { type TileStatus } from "./PostTile";

interface Props {
  posts: Post[];
  analyses: Map<string, PostAnalysis>;
  inFlight: string[];
  errorIds: Set<string>;
  selectedId: string | null;
  onSelect: (postId: string) => void;
}

export default function ContentFeed({ posts, analyses, inFlight, errorIds, selectedId, onSelect }: Props) {
  const inFlightSet = new Set(inFlight);
  const statusOf = (id: string): TileStatus => {
    if (inFlightSet.has(id)) return "analyzing";
    if (analyses.has(id)) return "done";
    if (errorIds.has(id)) return "error";
    return "idle";
  };

  return (
    <section className="panel flex min-h-0 flex-col p-3" aria-label="콘텐츠 피드">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="label">content feed</span>
        <span className="label tabular">
          {fmtInt(analyses.size)} / {fmtInt(posts.length)}
        </span>
      </div>
      {posts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-16 text-[12px] text-muted">
          표시할 포스트가 없습니다. LOAD POSTS JSON 으로 불러오거나 샘플을 사용하세요.
        </div>
      ) : (
        <div className="thin-scroll grid max-h-[720px] grid-cols-8 gap-[5px] overflow-y-auto pr-0.5" role="list">
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
    </section>
  );
}
