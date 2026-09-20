/**
 * 실행 파이프라인 (서버 전용). 포스트 목록을 워커 풀로 판정하고, 상위 N개에 대해 시안을 만들며,
 * 모든 진행 상황을 RunEvent 로 emit 합니다.
 *
 * 포스트 1건의 단계 (jev 활용 패턴):
 *  ① 관문(gate)   — 수집된 실제 게시물만: 우리 카테고리와 관련된 마케팅 콘텐츠인지 (pass / review / exclude)
 *  ② 본 판정      — 질문 10개 팬아웃 (형식·훅·CTA·페인포인트·사회적 증거·긴급성·톤·명확성·재사용성·시안 가치)
 *  ③ 구조(2단계)  — ②의 format 에 따라 옵션이 바뀌는 세부 구조 질문 (hierarchical classification)
 *  ④ 확신도 구간  — 모델 confidence(있으면) → auto / review / uncertain
 *  ⑤ 재검사       — review/uncertain 이면 핵심 질문을 한 번 더 물어 답이 흔들리는지 (self-consistency)
 * 이벤트 순서: run_start → (post_start → call_log* → post_result | post_skipped | post_error)* → (draft_start → call_log* → draft_result | draft_error)* → run_end
 */
import type { CallLogEntry, ConfidenceBand, JudgeOptions, Post, PostAnalysis, PostFormat, RunEvent, RunRequest, RunStats } from "./types";
import { DEFAULT_JUDGE_OPTIONS } from "./types";
import { QUESTIONS, QUESTION_ORDER, RECHECK_IDS, STRUCTURE_LABEL_KO } from "./questions";
import { draftModelId, jevModelId, resolveMode } from "./env";
import { evaluatePost, postToState, type RunMode } from "./jev";
import { evaluateGate, evaluateRecheck, evaluateStructure } from "./judge";
import { costFor, krwPerUsd, loadPricing, type JevPricing } from "./pricing";
import { bandOf, benchmarkScore, confidenceOfAll, KIND_LABEL_KO, summarize } from "./scoring";
import { generateDraft } from "./drafts";
import { SAMPLE_POSTS } from "@/data/samplePosts";

export type Emit = (e: RunEvent) => void;

const CONCURRENCY: Record<RunMode, number> = { live: 4, demo: 2 };
const MAX_DRAFTS = 10;
const FORMATS: PostFormat[] = ["card_news", "short_video", "long_video", "text", "thread", "image"];

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

/** 요청 옵션 + 기본값 → 완전한 JudgeOptions (경계값은 0~1, review ≤ auto 로 정리) */
export function resolveOptions(partial: Partial<JudgeOptions> | undefined): JudgeOptions {
  const t = { ...DEFAULT_JUDGE_OPTIONS.thresholds, ...(partial?.thresholds ?? {}) };
  const auto = Math.max(0, Math.min(1, t.auto));
  const review = Math.max(0, Math.min(auto, t.review));
  return {
    gate: partial?.gate ?? DEFAULT_JUDGE_OPTIONS.gate,
    recheck: partial?.recheck ?? DEFAULT_JUDGE_OPTIONS.recheck,
    structure: partial?.structure ?? DEFAULT_JUDGE_OPTIONS.structure,
    preset: partial?.preset ?? DEFAULT_JUDGE_OPTIONS.preset,
    thresholds: { auto, review },
  };
}

/** 관문 판정 대상 — 번들 샘플·AI 예시는 이미 큐레이션된 세트라 건너뜀 */
function needsGate(post: Post): boolean {
  return !(post.source === "sample" || post.source === "generated" || post.generated);
}

export async function runPipeline(request: RunRequest, emit: Emit, signal: AbortSignal): Promise<void> {
  const mode = resolveMode(request.demo);
  const posts: Post[] = request.posts?.length ? request.posts : SAMPLE_POSTS;
  const options = resolveOptions(request.options);
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
    postsExcluded: 0,
    postsReview: 0,
  };
  const touch = (): RunStats => {
    stats.elapsedMs = Date.now() - startedAt;
    stats.postsPerSec = stats.elapsedMs > 0 ? stats.postsAnalyzed / (stats.elapsedMs / 1000) : 0;
    stats.costKrw = stats.costUsd * krw;
    return { ...stats };
  };
  const addCost = (usd: number) => {
    stats.costUsd += usd;
  };
  const log = (entry: Omit<CallLogEntry, "id" | "mode" | "at">) => {
    emit({ type: "call_log", entry: { ...entry, id: newCallId(), mode, at: Date.now() }, at: Date.now() });
  };

  emit({ type: "run_start", runId, mode, jevModel, draftModel, posts, options, at: Date.now() });

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
          let postCost = 0;

          // ① 관문
          let gate: PostAnalysis["gate"];
          if (options.gate && needsGate(post)) {
            const g = await evaluateGate(post, request.brand.category, mode, { signal });
            const costUsd = costFor(g.call.usage, pricing);
            postCost += costUsd;
            addCost(costUsd);
            stats.checksRun += 2;
            gate = { ...g.gate, costUsd };
            log({
              tag: "gate",
              postId: post.id,
              summary: `${post.brand} · 관문 ${gate.decision} · ${gate.reason} (${KIND_LABEL_KO[gate.kind] ?? gate.kind})`,
              request: g.call.request,
              response: g.call.response,
              latencyMs: g.call.latencyMs,
              usage: g.call.usage,
              costUsd,
              model: g.call.model,
            });
            if (gate.decision === "exclude") {
              stats.postsExcluded += 1;
              emit({ type: "post_skipped", postId: post.id, gate, stats: touch(), at: Date.now() });
              lastErr = null;
              break;
            }
          }

          // ② 본 판정 (질문 10개 팬아웃)
          const r = await evaluatePost(post, mode, { signal });
          const mainCost = costFor(r.usage, pricing);
          postCost += mainCost;
          addCost(mainCost);
          stats.checksRun += QUESTION_ORDER.length;
          log({
            tag: "analyze",
            postId: post.id,
            summary: `${post.brand} · ${summarize(post, r.answers)}`,
            request: { model: mode === "demo" ? "demo" : jevModel, state: postToState(post), questions: QUESTIONS },
            response: { answers: r.answers, usage: r.usage, ...(r.providerConfidence ? { confidence: r.providerConfidence } : {}) },
            latencyMs: r.latencyMs,
            usage: r.usage,
            costUsd: mainCost,
            model: r.model,
          });

          // ③ 구조 (format 에 종속된 2단계 질문)
          let structure: PostAnalysis["structure"];
          const f = r.answers.format;
          const format: PostFormat = f.type === "choice" && (FORMATS as string[]).includes(f.choice) ? (f.choice as PostFormat) : (post.formatHint ?? "text");
          if (options.structure && !signal.aborted) {
            try {
              const s = await evaluateStructure(post, format, mode, { signal });
              const costUsd = costFor(s.call.usage, pricing);
              postCost += costUsd;
              addCost(costUsd);
              stats.checksRun += 1;
              structure = s.structure;
              log({
                tag: "structure",
                postId: post.id,
                summary: `${post.brand} · ${format} → ${structure.choice} (${STRUCTURE_LABEL_KO[structure.choice] ?? structure.choice})`,
                request: s.call.request,
                response: s.call.response,
                latencyMs: s.call.latencyMs,
                usage: s.call.usage,
                costUsd,
                model: s.call.model,
              });
            } catch (err) {
              if (signal.aborted) throw err;
              // 구조 판정은 부가 정보 — 실패해도 본 판정은 살림
            }
          }

          // ④ 확신도 구간
          const confidence = confidenceOfAll(r.answers, r.providerConfidence);
          let band: ConfidenceBand = bandOf(confidence, options.thresholds);
          if (gate?.decision === "review" && band === "auto") band = "review";
          let summary = summarize(post, r.answers);

          // ⑤ 자기일관성 재검사 (auto 가 아닐 때만)
          let recheck: PostAnalysis["recheck"];
          if (options.recheck && band !== "auto" && !signal.aborted) {
            try {
              const rc = await evaluateRecheck(post, r.answers, mode, { signal });
              const costUsd = costFor(rc.usage, pricing);
              postCost += costUsd;
              addCost(costUsd);
              stats.checksRun += RECHECK_IDS.length;
              recheck = rc.recheck;
              log({
                tag: "recheck",
                postId: post.id,
                summary: `${post.brand} · 재검사 ${recheck.agreed ? "일치" : `불일치: ${recheck.disagreements.join(", ")}`}`,
                request: rc.call.request,
                response: rc.call.response,
                latencyMs: rc.call.latencyMs,
                usage: rc.call.usage,
                costUsd,
                model: rc.call.model,
              });
              if (!recheck.agreed) {
                band = "uncertain";
                summary += ` · 재검사에서 ${recheck.disagreements.join("/")} 답이 바뀜 → 사람 확인 필요`;
              }
            } catch (err) {
              if (signal.aborted) throw err;
            }
          }
          if (band !== "auto") stats.postsReview += 1;

          const analysis: PostAnalysis = {
            postId: post.id,
            answers: r.answers,
            latencyMs: r.latencyMs,
            usage: r.usage,
            costUsd: postCost,
            benchmarkScore: benchmarkScore(r.answers, options.preset, post.metrics),
            summary,
            confidence,
            band,
            providerConfidence: r.providerConfidence,
            gate,
            structure,
            recheck,
          };
          analyses.set(post.id, analysis);
          stats.postsAnalyzed += 1;
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

  // ── 2) 시안: 벤치마크 상위 N개 (auto 구간 → review → uncertain 순, 같은 구간에서는 make_draft ≥ 0.5 → 점수) ──
  const draftCount = Math.max(0, Math.min(MAX_DRAFTS, Math.floor(request.draftCount || 0)));
  if (draftCount > 0 && analyses.size > 0) {
    const bandRank: Record<ConfidenceBand, number> = { auto: 0, review: 1, uncertain: 2 };
    const ranked = [...analyses.values()].sort((a, b) => {
      if (bandRank[a.band] !== bandRank[b.band]) return bandRank[a.band] - bandRank[b.band];
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
          if (c.tag === "draft_judge") stats.checksRun += 8;
          log({
            tag: c.tag,
            postId: post.id,
            summary:
              c.tag === "draft"
                ? `${post.brand} → ${request.brand.name || "우리 브랜드"} · ${draft.headline.slice(0, 40)}`
                : `${post.brand} 시안 재판정 · match ${draft.matchScore}% · 심사 ${draft.review?.decision ?? "-"}`,
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
