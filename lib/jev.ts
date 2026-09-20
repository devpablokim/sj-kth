/**
 * jev(typesafe-ai/jev) 판정 호출 래퍼 (서버 전용).
 * live 모드에서는 Vercel AI Gateway 의 evaluate() 를 호출하고,
 * demo 모드에서는 lib/demoJudge.ts 의 결정적 가짜 판정기를 사용합니다.
 * 두 경우 모두 결과를 lib/types.ts 의 Judgement 형태로 정규화해 돌려줍니다.
 */
import { experimental_evaluate as evaluate, type JSONValue } from "ai";
import type { Judgement, Post, QuestionId } from "./types";
import { QUESTIONS, QUESTION_ORDER, scoreMax } from "./questions";
import { jevModelId } from "./env";
import { demoEvaluate } from "./demoJudge";

export type RunMode = "live" | "demo";

/** evaluate() 가 돌려주는 개별 답변의 공통 형태 (질문별 제네릭 타입을 넓힌 것) */
export type RawAnswer =
  | { type: "boolean"; probability: number }
  | { type: "choice"; choice: string; probabilities?: Record<string, number> }
  | { type: "score"; score: number; probabilities?: Record<string, number> };

export interface EvaluatedPost {
  answers: Record<QuestionId, Judgement>;
  /** 판정에 걸린 시간 (ms) */
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number };
  /** 실제로 사용한 모델 ID ("demo" 이면 가짜 판정) */
  model: string;
}

/** 원시 답변 → UI 친화적 Judgement. score 는 scoreMax 로 max 를 채웁니다. */
export function normalizeAnswer(id: QuestionId, raw: RawAnswer): Judgement {
  switch (raw.type) {
    case "boolean":
      return { type: "boolean", probability: clamp01(raw.probability) };
    case "choice":
      return {
        type: "choice",
        choice: raw.choice,
        probabilities: raw.probabilities ? cleanProbabilities(raw.probabilities) : undefined,
      };
    case "score": {
      const max = scoreMax(id);
      return {
        type: "score",
        score: Math.min(max, Math.max(0, raw.score)),
        max,
        probabilities: raw.probabilities ? cleanProbabilities(raw.probabilities) : undefined,
      };
    }
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function cleanProbabilities(p: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(p)) out[k] = clamp01(v);
  return out;
}

/**
 * 포스트를 jev 에 넘길 state(JSON 객체)로 변환합니다.
 * undefined 값은 JSON 이 아니므로 제외하고, 텍스트는 과금 방지를 위해 적당히 자릅니다.
 */
export function postToState(post: Post): Record<string, JSONValue> {
  const state: Record<string, JSONValue> = {
    platform: post.platform,
    brand: post.brand,
    handle: post.handle,
    text: post.text.slice(0, 4000),
  };
  if (post.slides?.length) state.slides = post.slides.map((s) => s.slice(0, 1000));
  if (post.formatHint) state.formatHint = post.formatHint;
  if (post.metrics) {
    const m: Record<string, JSONValue> = {};
    if (post.metrics.likes !== undefined) m.likes = post.metrics.likes;
    if (post.metrics.comments !== undefined) m.comments = post.metrics.comments;
    if (post.metrics.shares !== undefined) m.shares = post.metrics.shares;
    if (post.metrics.views !== undefined) m.views = post.metrics.views;
    state.metrics = m;
  }
  return state;
}

/**
 * 포스트 1건을 판정합니다.
 * - live: evaluate({ model: jevModelId(), state, questions: QUESTIONS })
 *   (model 은 문자열 ID 그대로 → AI_GATEWAY_API_KEY 로 gateway 가 자동 해석)
 * - demo: demoEvaluate (120~220ms 지연 + 휴리스틱)
 */
export async function evaluatePost(
  post: Post,
  mode: RunMode,
  options: { signal?: AbortSignal } = {},
): Promise<EvaluatedPost> {
  const started = performance.now();

  if (mode === "demo") {
    const r = await demoEvaluate(post, options.signal);
    return {
      answers: r.answers,
      latencyMs: Math.round(performance.now() - started),
      usage: r.usage,
      model: "demo",
    };
  }

  const model = jevModelId();
  const result = await evaluate({
    model,
    state: postToState(post),
    questions: QUESTIONS,
    abortSignal: options.signal,
    maxRetries: 1,
  });

  const answers = {} as Record<QuestionId, Judgement>;
  for (const id of QUESTION_ORDER) {
    const raw: RawAnswer = result.answers[id];
    answers[id] = normalizeAnswer(id, raw);
  }

  return {
    answers,
    latencyMs: Math.round(performance.now() - started),
    usage: {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
    },
    model: result.response.modelId || model,
  };
}
