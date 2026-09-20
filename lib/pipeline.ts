/**
 * 실행 파이프라인 (서버 전용). 포스트 목록을 워커 풀로 jev 판정하고,
 * 상위 N개에 대해 시안을 만들며, 모든 진행 상황을 RunEvent 로 emit 합니다.
 * 이벤트 순서: run_start → (post_start → call_log → post_result | post_error)* → (draft_start → call_log* → draft_result | draft_error)* → run_end
 */
import type { CallLogEntry, Post, PostAnalysis, RunEvent, RunRequest, RunStats } from "./types";
import { QUESTIONS, QUESTION_ORDER } from "./questions";
import { draftModelId, jevModelId, resolveMode } from "./env";
import { evaluatePost, postToState, type RunMode } from "./jev";
import { costFor, krwPerUsd, loadPricing, type JevPricing } from "./pricing";
import { benchmarkScore, confidenceOfAll, summarize } from "./scoring";
import { generateDraft } from "./drafts";
import { SAMPLE_POSTS } from "@/data/samplePosts";

export type Emit = (e: RunEvent) => void;

const CONCURRENCY: Record<RunMode, number> = { live: 4, demo: 2 };
const MAX_DRAFTS = 10;

function newRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function newCallId(): string {
  return `call_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** 사용자에게 보여줄 수 있는 에러 메시지 (스택·내부 경로 제외) */
export function safeErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { name?: string; message?: string; statusCode?: number };
    if (e.name === "AbortError" || /abort/i.test(e.message ?? "")) return "중단됨";
    if (e.name === "GatewayAuthenticationError" || e.statusCode === 401) {
      return "AI Gateway 인증 실패 — .env 의 AI_GATEWAY_API_KEY 를 확인하세요";
    }
    if (e.statusCode === 402) return "AI Gateway 크레딧 부족";
    if (e.statusCode === 429) return "AI Gateway 요청 제한(429) — 잠시 후 다시 시도하세요";
    if (e.name === "GatewayModelNotFoundError" || e.statusCode === 404) return "Gateway 에서 모델을 찾을 수 없음 — JEV_MODEL / DRAFT_MODEL 확인";
    const msg = (e.message ?? "").split("\n")[0].slice(0, 300);
    return msg || "알 수 없는 오류";
  }
  return "알 수 없는 오류";
}

export async function runPipeline(request: RunRequest, emit: Emit, signal: AbortSignal): Promise<void> {
  const mode = resolveMode(request.demo);
  const posts: Post[] = request.posts?.length ? request.posts : SAMPLE_POSTS;
  const jevModel = jevModelId();
  const draftModel = draftModelId();
  const runId = newRunId();
  const startedAt = Date.now();
  const krw = krwPerUsd();

  const pricing: JevPricing = await loadPricing(mode, jevModel);
  // 시안 생성 모델은 단가가 다르므로 별도 조회 (실패 시 jev 단가로 추정)
  const draftPricing: JevPricing = mode === "live" ? await loadPricing(mode, draftModel) : pricing;
  const pricingFor = (model: string): JevPricing => (model === draftPricing.modelId ? draftPricing : pricing);

  const stats: RunStats = {
    postsTotal: posts.length,
    postsRead: 0,
    postsAnalyzed: 0,
    checksRun: 0,
    postsPerSec: 0,
    elapsedMs: 0,
    costUsd: 0,
    costKrw: 0,
    draftsGenerated: 0,
  };
  const touch = (): RunStats => {
    stats.elapsedMs = Date.now() - startedAt;
    stats.postsPerSec = stats.elapsedMs > 0 ? stats.postsAnalyzed / (stats.elapsedMs / 1000) : 0;
    stats.checksRun = stats.postsAnalyzed * QUESTION_ORDER.length;
    stats.costKrw = stats.costUsd * krw;
    return { ...stats };
  };
  const addCost = (usd: number) => {
    stats.costUsd += usd;
  };
  const log = (entry: Omit<CallLogEntry, "id" | "mode" | "at">) => {
    emit({ type: "call_log", entry: { ...entry, id: newCallId(), mode, at: Date.now() }, at: Date.now() });
  };

  emit({ type: "run_start", runId, mode, jevModel, draftModel, posts, at: Date.now() });

  // ── 1) 판정: 워커 풀 ──
  const analyses = new Map<string, PostAnalysis>();
  let cursor = 0;
  const worker = async () => {
    while (!signal.aborted) {
      const idx = cursor++;
      if (idx >= posts.length) return;
      const post = posts[idx];
      stats.postsRead += 1;
      emit({ type: "post_start", postId: post.id, at: Date.now() });

      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 2 && !signal.aborted; attempt++) {
        try {
          const r = await evaluatePost(post, mode, { signal });
          const costUsd = costFor(r.usage, pricing);
          addCost(costUsd);
          const analysis: PostAnalysis = {
            postId: post.id,
            answers: r.answers,
            latencyMs: r.latencyMs,
            usage: r.usage,
            costUsd,
            benchmarkScore: benchmarkScore(r.answers),
            summary: summarize(post, r.answers),
            confidence: confidenceOfAll(r.answers),
          };
          analyses.set(post.id, analysis);
          stats.postsAnalyzed += 1;
          log({
            tag: "analyze",
            postId: post.id,
            summary: `${post.brand} · ${analysis.summary}`,
            request: { model: mode === "demo" ? "demo" : jevModel, state: postToState(post), questions: QUESTIONS },
            response: { answers: r.answers, usage: r.usage },
            latencyMs: r.latencyMs,
            usage: r.usage,
            costUsd,
            model: r.model,
          });
          emit({ type: "post_result", analysis, stats: touch(), at: Date.now() });
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (signal.aborted) break;
          const status = (err as { statusCode?: number }).statusCode;
          // 인증/결제/모델 오류는 재시도해도 소용없음
          if (status === 401 || status === 402 || status === 404) break;
        }
      }
      if (lastErr && !signal.aborted) {
        emit({ type: "post_error", postId: post.id, message: safeErrorMessage(lastErr), stats: touch(), at: Date.now() });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY[mode], Math.max(1, posts.length)) }, worker));

  if (signal.aborted) return;

  // ── 2) 시안: 벤치마크 상위 N개 ──
  const draftCount = Math.max(0, Math.min(MAX_DRAFTS, Math.floor(request.draftCount || 0)));
  if (draftCount > 0 && analyses.size > 0) {
    const ranked = [...analyses.values()].sort((a, b) => {
      const da = a.answers.make_draft.type === "boolean" && a.answers.make_draft.probability >= 0.5 ? 1 : 0;
      const db = b.answers.make_draft.type === "boolean" && b.answers.make_draft.probability >= 0.5 ? 1 : 0;
      if (da !== db) return db - da;
      return b.benchmarkScore - a.benchmarkScore;
    });
    for (const analysis of ranked.slice(0, draftCount)) {
      if (signal.aborted) return;
      const post = posts.find((p) => p.id === analysis.postId);
      if (!post) continue;
      emit({ type: "draft_start", sourcePostId: post.id, at: Date.now() });
      try {
        const { draft, calls } = await generateDraft({ post, analysis, brand: request.brand, mode, signal });
        for (const c of calls) {
          const costUsd = costFor(c.usage, pricingFor(c.model));
          addCost(costUsd);
          log({
            tag: c.tag,
            postId: post.id,
            summary:
              c.tag === "draft"
                ? `${post.brand} → ${request.brand.name || "우리 브랜드"} · ${draft.headline.slice(0, 40)}`
                : `${post.brand} 시안 재판정 · match ${draft.matchScore}%`,
            request: c.request,
            response: c.response,
            latencyMs: c.latencyMs,
            usage: c.usage,
            costUsd,
            model: c.model,
          });
        }
        stats.draftsGenerated += 1;
        emit({ type: "draft_result", draft, stats: touch(), at: Date.now() });
      } catch (err) {
        if (signal.aborted) return;
        emit({ type: "draft_error", sourcePostId: post.id, message: safeErrorMessage(err), stats: touch(), at: Date.now() });
      }
    }
  }

  emit({ type: "run_end", stats: touch(), at: Date.now() });
}
