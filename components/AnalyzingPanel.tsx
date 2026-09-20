/*
 * AnalyzingPanel — 우측 상단 "ANALYZING POST  {latency} MS" 패널.
 * 좌: 포스트 타일 · 브랜드 · @handle · 태그(판정에서 true 인 것) · 한 줄 요약 · benchmark/confidence.
 * 우: JudgementRows — QUESTION_ORDER 순서로 [라벨 · 값 · 막대 · %]. 검정 실선 = 기본, 빨강 점선 = "따라 해야 할 강점".
 *     그 아래 PatternRows — 관문 · 2단계 구조 · 재검사 · 확신도 구간.
 */
"use client";

import type { Post, PostAnalysis } from "@/lib/types";
import { fmtInt, fmtPct } from "@/lib/format";
import PostTile, { PLATFORM_NAME } from "./PostTile";
import JudgementRows, { PatternRows, tagsOf } from "./JudgementRows";
import { BAND_LABEL_KO } from "@/lib/scoring";

interface Props {
  post: Post | null;
  analysis: PostAnalysis | null;
  /** 이 포스트가 지금 판정 중인지 (결과가 아직 없으면 빈 막대 + "judging…") */
  analyzing: boolean;
}

export default function AnalyzingPanel({ post, analysis, analyzing }: Props) {
  const pending = analyzing && !analysis;

  return (
    <section className="panel p-3" aria-label="분석 중인 포스트">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="label">analyzing post</span>
        <span className="label tabular">{fmtInt(analysis?.latencyMs ?? 0)} ms</span>
      </div>

      {!post ? (
        <div className="flex items-center justify-center py-10 text-[12px] text-muted">
          RUN ANALYSIS 를 누르면 여기에 판정이 흐릅니다
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          {/* 좌: 포스트 카드 */}
          <div className="min-w-0 sm:w-[200px] sm:shrink-0">
            <div className="max-w-[260px] sm:max-w-none">
              <PostTile post={post} size="md" status={pending ? "analyzing" : analysis ? "done" : "idle"} />
            </div>
            <div className="mt-2 text-[16px] font-bold leading-tight text-ink">{post.brand}</div>
            <div className="mt-0.5 truncate text-[11px] text-muted">
              {post.handle} · {PLATFORM_NAME[post.platform]}
            </div>
            {analysis ? (
              <>
                {tagsOf(analysis).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
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
                <p className="mt-2 text-[12px] leading-snug text-muted">{analysis.summary}</p>
                <div className="label mt-2 tabular">
                  benchmark {fmtInt(analysis.benchmarkScore)} · confidence {fmtPct(analysis.confidence)}
                </div>
                <div className={`label mt-1 ${analysis.band === "uncertain" ? "!text-accent" : ""}`}>{BAND_LABEL_KO[analysis.band]}</div>
              </>
            ) : pending ? (
              <div className="label mt-2 animate-pulse text-accent" aria-live="polite">
                judging…
              </div>
            ) : (
              <div className="label mt-2">not judged yet</div>
            )}
          </div>

          {/* 우: 질문별 행 + 패턴 행 */}
          <div className="min-w-0 flex-1">
            <JudgementRows analysis={analysis} pending={pending} />
            {analysis && <PatternRows analysis={analysis} className="mt-2 border-t border-line pt-1" />}
          </div>
        </div>
      )}
    </section>
  );
}
