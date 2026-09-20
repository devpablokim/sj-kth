/**
 * jev(typesafe-ai/jev) 판정 호출 래퍼 (서버 전용).
 * live 모드에서는 Vercel AI Gateway 의 evaluate() 를 호출하고,
 * demo 모드에서는 lib/demoJudge.ts 의 결정적 가짜 판정기를 사용합니다.
 *
 * 공통 규칙:
 *  - 모든 호출은 runEvaluate() 를 거쳐 usage · 응답 모델 버전(jev-1.x.x) · provider confidence 를 함께 돌려줍니다
 *    (버전을 로그에 남기고 확률 분포를 저장하라는 TypeSafe 가이드)
 *  - JEV_ZERO_DATA_RETENTION=1 이면 gateway zeroDataRetention 옵션을 붙입니다
 */
import {
  experimental_evaluate as evaluate,
  type Experimental_EvaluationModel as EvaluationModel,
  type Experimental_EvaluationQuestion as EvaluationQuestion,
  type JSONValue,
} from "ai";
import type { Judgement, Post, QuestionId } from "./types";
import { QUESTIONS, QUESTION_ORDER, scoreMax } from "./questions";
import { jevModelId, zeroDataRetention } from "./env";
import { demoEvaluate } from "./demoJudge";

export type RunMode = "live" | "demo";

/** evaluate() 가 돌려주는 개별 답변의 공통 형태 (질문별 제네릭 타입을 넓힌 것) */
export type RawAnswer =
  | { type: "boolean"; probability: number }
  | { type: "choice"; choice: string; probabilities?: Record<string, number> }
  | { type: "score"; score: number; probabilities?: Record<string, number> };

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

/** runEvaluate 의 공통 결과 */
export interface RawEvaluation<Q extends Record<string, EvaluationQuestion>> {
  answers: { [K in keyof Q]: RawAnswer };
  usage: Usage;
  latencyMs: number;
  /** 실제 응답 모델 ID (예: "typesafe-ai/jev" 또는 버전이 붙은 ID) */
  model: string;
  /** typesafe provider 가 돌려주는 질문별 confidence (0~1). 없으면 undefined */
  providerConfidence?: Record<string, number>;
}

export interface EvaluatedPost {
  answers: Record<QuestionId, Judgement>;
  /** 판정에 걸린 시간 (ms) */
  latencyMs: number;
  usage: Usage;
  /** 실제로 사용한 모델 ID ("demo" 이면 가짜 판정) */
  model: string;
  providerConfidence?: Record<string, number>;
}

/** 원시 답변 → UI 친화적 Judgement. score 는 scoreMax 로 max 를 채웁니다. */
export function normalizeAnswer(id: QuestionId, raw: RawAnswer): Judgement {
  return normalizeWithMax(raw, scoreMax(id));
}

export function normalizeWithMax(raw: RawAnswer, max: number): Judgement {
  switch (raw.type) {
    case "boolean":
      return { type: "boolean", probability: clamp01(raw.probability) };
    case "choice":
      return {
        type: "choice",
        choice: raw.choice,
        probabilities: raw.probabilities ? cleanProbabilities(raw.probabilities) : undefined,
      };
    case "score":
      return {
        type: "score",
        score: Math.min(max, Math.max(0, raw.score)),
        max,
        probabilities: raw.probabilities ? cleanProbabilities(raw.probabilities) : undefined,
      };
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

/** gateway providerOptions — ZDR 플래그가 켜져 있을 때만 */
function providerOptions(): { gateway: { zeroDataRetention: true } } | undefined {
  return zeroDataRetention() ? { gateway: { zeroDataRetention: true } } : undefined;
}

/** providerMetadata.typesafe.confidence → Record<string, number> (없으면 undefined) */
export function readProviderConfidence(meta: unknown): Record<string, number> | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const typesafe = (meta as Record<string, unknown>).typesafe;
  if (!typesafe || typeof typesafe !== "object") return undefined;
  const conf = (typesafe as Record<string, unknown>).confidence;
  if (!conf || typeof conf !== "object") return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(conf as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = clamp01(v);
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * 공통 evaluate 호출 (live 전용). state + questions 를 보내고 원시 답변·usage·모델 버전·confidence 를 돌려줍니다.
 * 데모 모드는 각 호출처가 demoJudge 로 처리합니다.
 */
export async function runEvaluate<Q extends Record<string, EvaluationQuestion>>(
  state: Record<string, JSONValue>,
  questions: Q,
  options: { signal?: AbortSignal; model?: EvaluationModel } = {},
): Promise<RawEvaluation<Q>> {
  const model: EvaluationModel = options.model ?? jevModelId();
  const modelId = typeof model === "string" ? model : model.modelId;
  const started = performance.now();
  const result = await evaluate({
    model,
    state,
    questions,
    abortSignal: options.signal,
    maxRetries: 1,
    providerOptions: providerOptions(),
  });
  return {
    answers: result.answers as unknown as { [K in keyof Q]: RawAnswer },
    usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0 },
    latencyMs: Math.round(performance.now() - started),
    model: result.response.modelId || modelId,
    providerConfidence: readProviderConfidence(result.providerMetadata),
  };
}

/**
 * 포스트 1건을 판정합니다 (본 판정 — 질문 10개 팬아웃).
 * - live: evaluate({ model: jevModelId(), state, questions: QUESTIONS })
 * - demo: demoEvaluate (120~220ms 지연 + 휴리스틱)
 */
export async function evaluatePost(
  post: Post,
  mode: RunMode,
  options: { signal?: AbortSignal } = {},
): Promise<EvaluatedPost> {
  if (mode === "demo") {
    const started = performance.now();
    const r = await demoEvaluate(post, options.signal);
    return {
      answers: r.answers,
      latencyMs: Math.round(performance.now() - started),
      usage: r.usage,
      model: "demo",
    };
  }

  const r = await runEvaluate(postToState(post), QUESTIONS, { signal: options.signal });
  const answers = {} as Record<QuestionId, Judgement>;
  for (const id of QUESTION_ORDER) answers[id] = normalizeAnswer(id, r.answers[id]);
  return { answers, latencyMs: r.latencyMs, usage: r.usage, model: r.model, providerConfidence: r.providerConfidence };
}
