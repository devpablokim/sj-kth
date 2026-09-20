/**
 * jev 활용 패턴 모음 (서버 전용). 판정 결정 규칙은 전부 코드가 소유하고, jev 는 원자적 질문에만 답합니다.
 *  - 관문(gate): relevant · kind → pass / review / exclude   (RAG filtering · abstaining moderation)
 *  - 구조(structure): format 에 따라 옵션이 바뀌는 2단계 질문   (hierarchical classification)
 *  - 재검사(recheck): 확신도 낮은 판정의 핵심 질문을 한 번 더    (self-consistency)
 *  - 시안 심사(review): 브랜드 안전 · 표시광고 위험 · 타깃 적합 · 포지셔닝 모순 · 품질 → approve / review / block (guardrails)
 * 각 함수는 live 면 runEvaluate, demo 면 lib/demoExtra 의 결정적 가짜 판정을 씁니다. 테스트에서는 model 로 Mock 모델을 주입합니다.
 */
import type { Experimental_EvaluationModel as EvaluationModel, JSONValue } from "ai";
import type { DraftReview, GateDecision, GateKind, GateResult, Judgement, Post, PostFormat, PostSource, QuestionId, RecheckResult, StructureResult } from "./types";
import { GATE_QUESTIONS, QUESTIONS, RECHECK_IDS, STRUCTURE_QUESTIONS } from "./questions";
import { normalizeAnswer, postToState, runEvaluate, type RawAnswer, type RunMode, type Usage } from "./jev";
import { confidenceOf } from "./scoring";
import { demoGate, demoRecheck, demoStructure } from "./demoExtra";

export interface CallRecord {
  request: unknown;
  response: unknown;
  latencyMs: number;
  usage: Usage;
  model: string;
}

const KINDS: GateKind[] = ["marketing", "educational", "personal", "news", "spam", "uncertain"];

/**
 * 관문 결정 규칙 (순수 함수).
 *  - 관련성 ≥ 0.6 이고 spam 이 아니면 pass
 *  - 관련성 < 0.3 이거나 spam(p ≥ 0.7) 이면 exclude — 단, 사용자가 직접 붙여넣은 글은 절대 제외하지 않고 review
 *  - 그 사이는 review (불확실은 사람이 본다: abstention)
 */
export function decideGate(input: {
  relevant: number;
  kind: GateKind;
  spamProbability: number;
  source: PostSource | undefined;
}): { decision: GateDecision; reason: string } {
  const { relevant, kind, spamProbability, source } = input;
  const canExclude = source === "collected" || source === "youtube";
  const rel = relevant.toFixed(2);
  if (spamProbability >= 0.7) {
    return canExclude ? { decision: "exclude", reason: `스팸 ${spamProbability.toFixed(2)}` } : { decision: "review", reason: `스팸 의심 ${spamProbability.toFixed(2)}` };
  }
  if (relevant >= 0.6 && kind !== "spam") return { decision: "pass", reason: `관련성 ${rel} · ${kind}` };
  if (relevant < 0.3) {
    return canExclude ? { decision: "exclude", reason: `관련성 낮음 ${rel} · ${kind}` } : { decision: "review", reason: `관련성 낮음 ${rel} · ${kind}` };
  }
  return { decision: "review", reason: `관련성 애매 ${rel} · ${kind}` };
}

/** 관문 판정 1회 (state = our_category + post) */
export async function evaluateGate(
  post: Post,
  category: string,
  mode: RunMode,
  options: { signal?: AbortSignal; model?: EvaluationModel } = {},
): Promise<{ gate: Omit<GateResult, "costUsd">; call: CallRecord }> {
  const state: Record<string, JSONValue> = { our_category: category || "(카테고리 미입력)", post: postToState(post) };
  let raw: { relevant: RawAnswer; kind: RawAnswer };
  let usage: Usage;
  let latencyMs: number;
  let model: string;
  let providerConfidence: Record<string, number> | undefined;
  if (mode === "demo" && !options.model) {
    const d = await demoGate(post, category, options.signal);
    raw = d.answers;
    usage = d.usage;
    latencyMs = d.latencyMs;
    model = "demo";
  } else {
    const r = await runEvaluate(state, GATE_QUESTIONS, { signal: options.signal, model: options.model });
    raw = r.answers;
    usage = r.usage;
    latencyMs = r.latencyMs;
    model = r.model;
    providerConfidence = r.providerConfidence;
  }
  const relevantJ = normalizeAnswer("make_draft", raw.relevant); // boolean 정규화 (max 무관)
  const kindJ = normalizeAnswer("format", raw.kind);
  const relevant = relevantJ.type === "boolean" ? relevantJ.probability : 0;
  const kindRaw = kindJ.type === "choice" ? kindJ.choice : "uncertain";
  const kind: GateKind = (KINDS as string[]).includes(kindRaw) ? (kindRaw as GateKind) : "uncertain";
  const kindProbabilities = kindJ.type === "choice" ? kindJ.probabilities : undefined;
  const spamProbability = kind === "spam" ? Math.max(0.7, kindProbabilities?.spam ?? 0.7) : (kindProbabilities?.spam ?? 0);
  const confidence =
    ((providerConfidence?.relevant ?? confidenceOf(relevantJ)) + (providerConfidence?.kind ?? confidenceOf(kindJ))) / 2;
  const { decision, reason } = decideGate({ relevant, kind, spamProbability, source: post.source });
  return {
    gate: { relevant, kind, kindProbabilities, confidence, decision, reason, latencyMs, usage },
    call: {
      request: { model: mode === "demo" ? "demo" : model, state, questions: GATE_QUESTIONS },
      response: { answers: raw, usage, ...(providerConfidence ? { confidence: providerConfidence } : {}) },
      latencyMs,
      usage,
      model,
    },
  };
}

/** 2단계 구조 판정 — format 에 맞는 옵션 집합으로 1문항 */
export async function evaluateStructure(
  post: Post,
  format: PostFormat,
  mode: RunMode,
  options: { signal?: AbortSignal; model?: EvaluationModel } = {},
): Promise<{ structure: StructureResult; call: CallRecord }> {
  const question = STRUCTURE_QUESTIONS[format];
  const questions = { structure: question } as const;
  const state: Record<string, JSONValue> = { format, ...postToState(post) };
  let raw: RawAnswer;
  let usage: Usage;
  let latencyMs: number;
  let model: string;
  let providerConfidence: Record<string, number> | undefined;
  if (mode === "demo" && !options.model) {
    const d = await demoStructure(post, format, Object.keys(question.criteria), options.signal);
    raw = d.answer;
    usage = d.usage;
    latencyMs = d.latencyMs;
    model = "demo";
  } else {
    const r = await runEvaluate(state, questions, { signal: options.signal, model: options.model });
    raw = r.answers.structure;
    usage = r.usage;
    latencyMs = r.latencyMs;
    model = r.model;
    providerConfidence = r.providerConfidence;
  }
  const j = normalizeAnswer("format", raw);
  const choice = j.type === "choice" ? j.choice : "other";
  const structure: StructureResult = {
    choice: choice in question.criteria ? choice : "other",
    probabilities: j.type === "choice" ? j.probabilities : undefined,
    confidence: providerConfidence?.structure ?? confidenceOf(j),
    format,
  };
  return {
    structure,
    call: {
      request: { model: mode === "demo" ? "demo" : model, state, questions },
      response: { answers: { structure: raw }, usage },
      latencyMs,
      usage,
      model,
    },
  };
}

/** 두 판정이 같은 답인지 (choice 는 같은 선택, boolean 은 같은 쪽) */
export function sameAnswer(a: Judgement, b: Judgement): boolean {
  if (a.type === "choice" && b.type === "choice") return a.choice === b.choice;
  if (a.type === "boolean" && b.type === "boolean") return a.probability >= 0.5 === b.probability >= 0.5;
  if (a.type === "score" && b.type === "score") return Math.round(a.score) === Math.round(b.score);
  return false;
}

/** 자기일관성 재검사 — 핵심 질문(format · hook_type · make_draft)을 한 번 더 묻고 답이 바뀐 질문을 돌려줍니다 */
export async function evaluateRecheck(
  post: Post,
  first: Record<QuestionId, Judgement>,
  mode: RunMode,
  options: { signal?: AbortSignal; model?: EvaluationModel } = {},
): Promise<{ recheck: RecheckResult; usage: Usage; call: CallRecord }> {
  const questions = Object.fromEntries(RECHECK_IDS.map((id) => [id, QUESTIONS[id]])) as Pick<typeof QUESTIONS, (typeof RECHECK_IDS)[number]>;
  const state = postToState(post);
  let answers: Record<string, RawAnswer>;
  let usage: Usage;
  let latencyMs: number;
  let model: string;
  if (mode === "demo" && !options.model) {
    const d = await demoRecheck(post, first, RECHECK_IDS, options.signal);
    answers = d.answers;
    usage = d.usage;
    latencyMs = d.latencyMs;
    model = "demo";
  } else {
    const r = await runEvaluate(state, questions, { signal: options.signal, model: options.model });
    answers = r.answers as Record<string, RawAnswer>;
    usage = r.usage;
    latencyMs = r.latencyMs;
    model = r.model;
  }
  const disagreements: QuestionId[] = [];
  for (const id of RECHECK_IDS) {
    const raw = answers[id];
    if (!raw) continue;
    if (!sameAnswer(first[id], normalizeAnswer(id, raw))) disagreements.push(id);
  }
  return {
    recheck: { agreed: disagreements.length === 0, disagreements, latencyMs },
    usage,
    call: {
      request: { model: mode === "demo" ? "demo" : model, state, questions, note: "self-consistency recheck" },
      response: { answers, usage, disagreements },
      latencyMs,
      usage,
      model,
    },
  };
}

/* ───────────── 시안 적합성 심사 (guardrails · marketing suitability) ───────────── */

export const REVIEW_QUESTIONS = {
  brand_safety: {
    type: "boolean",
    instructions: "draft 에 비하·혐오·차별·특정인 비방·경쟁사 명시 비방·민감한 사회 이슈 소재가 '없나요'? 문제가 없으면 true.",
  },
  claim_risk: {
    type: "boolean",
    instructions:
      "draft 에 표시광고법상 위험한 표현이 있나요? 예: '최고·1위·유일·100%·보장·확실히·무조건' 같은 최상급/보장 표현, 근거 없는 수치·후기·수상, 의료·투자 효과 단정. '[수치 확인 필요]' 같은 자리표시는 위험이 아닙니다.",
  },
  audience_match: {
    type: "boolean",
    instructions: "draft 의 말투·용어·예시가 our_brand 의 카테고리와 타깃 고객(예: 중소·중견기업 의사결정자, 실무자)에게 자연스럽게 맞나요?",
  },
  contradicts_positioning: {
    type: "boolean",
    instructions: "draft 의 주장이 our_brand.positioning(핵심 메시지)과 모순되나요? 예: '우리가 대신 다 해드립니다' vs 포지셔닝 '우리 팀이 직접 만들고 관리'.",
  },
  quality: {
    type: "score",
    instructions: "draft 를 지금 그대로 게시해도 되는 완성도를 평가하세요.",
    criteria: [
      "게시 불가 — 문장이 어색하거나 핵심이 없음",
      "손봐야 함 — 방향은 맞지만 다듬을 곳이 많음",
      "거의 가능 — 소소한 수정만 필요",
      "바로 게시 가능",
    ],
  },
} as const;

export const REVIEW_QUALITY_MAX = REVIEW_QUESTIONS.quality.criteria.length - 1;

/**
 * 심사 결정 규칙 (순수 함수). 임계값은 행동의 위험도에 맞춰 코드가 정합니다.
 *  block:  brandSafety < 0.5 · claimRisk ≥ 0.7 · contradicts ≥ 0.7
 *  review: claimRisk ≥ 0.4 · audienceMatch < 0.5 · contradicts ≥ 0.4 · quality < 1.5
 *  approve: 그 외
 */
export function decideDraftReview(input: {
  brandSafety: number;
  claimRisk: number;
  audienceMatch: number;
  contradictsPositioning: number;
  quality: number;
  qualityMax: number;
}): DraftReview {
  const { brandSafety, claimRisk, audienceMatch, contradictsPositioning, quality, qualityMax } = input;
  const reasons: string[] = [];
  let decision: DraftReview["decision"] = "approve";
  if (brandSafety < 0.5) {
    decision = "block";
    reasons.push(`브랜드 안전 위험 (안전 확률 ${brandSafety.toFixed(2)})`);
  }
  if (claimRisk >= 0.7) {
    decision = "block";
    reasons.push(`표시광고 위험 표현 (${claimRisk.toFixed(2)})`);
  } else if (claimRisk >= 0.4) {
    if (decision !== "block") decision = "review";
    reasons.push(`과장·보장 표현 의심 (${claimRisk.toFixed(2)})`);
  }
  if (contradictsPositioning >= 0.7) {
    decision = "block";
    reasons.push(`포지셔닝과 모순 (${contradictsPositioning.toFixed(2)})`);
  } else if (contradictsPositioning >= 0.4) {
    if (decision !== "block") decision = "review";
    reasons.push(`포지셔닝과 어긋날 수 있음 (${contradictsPositioning.toFixed(2)})`);
  }
  if (audienceMatch < 0.5) {
    if (decision !== "block") decision = "review";
    reasons.push(`타깃 적합도 낮음 (${audienceMatch.toFixed(2)})`);
  }
  if (quality < 1.5) {
    if (decision !== "block") decision = "review";
    reasons.push(`완성도 ${quality.toFixed(1)} / ${qualityMax}`);
  }
  if (reasons.length === 0) reasons.push("안전 · 표현 · 타깃 · 포지셔닝 모두 통과");
  return { decision, brandSafety, claimRisk, audienceMatch, contradictsPositioning, quality, qualityMax, reasons };
}
