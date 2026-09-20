/**
 * 시안(초안) 생성 (서버 전용).
 * live: generateObject 로 Gateway 텍스트 모델(DRAFT_MODEL)이 우리 브랜드 버전 시안을 만들고,
 *       jev 가 원본과의 구조 일치도(structure_match · same_hook · brand_fit)를 재판정해 matchScore 를 냅니다.
 * demo: lib/demoJudge.ts 의 템플릿 시안 + 시드 기반 matchScore (gateway 호출 없음).
 */
import { generateObject, experimental_evaluate as evaluate, type JSONValue } from "ai";
import { z } from "zod";
import type { Draft, Post, PostAnalysis, PostFormat } from "./types";
import { draftModelId, jevModelId } from "./env";
import { demoDraft, seededRandom } from "./demoJudge";
import { postToState, type RunMode } from "./jev";
import { FORMAT_LABEL_KO, HOOK_LABEL_KO, TONE_LABEL_KO } from "./scoring";

export interface DraftCall {
  tag: "draft" | "draft_judge";
  request: unknown;
  response: unknown;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
}

export interface GenerateDraftInput {
  post: Post;
  analysis: PostAnalysis;
  brand: { name: string; category: string; positioning: string };
  mode: RunMode;
  signal?: AbortSignal;
}

export interface GenerateDraftResult {
  draft: Draft;
  calls: DraftCall[];
}

const draftSchema = z.object({
  headline: z.string().min(1).max(200).describe("첫 줄 훅/제목. 원본과 같은 훅 유형"),
  body: z.string().min(1).max(2000).describe("본문 캡션. 원본과 같은 톤·길이·CTA 강도"),
  slides: z
    .array(z.string().min(1).max(300))
    .min(3)
    .max(8)
    .optional()
    .describe("카드뉴스일 때만: 원본과 같은 장수의 슬라이드 문구"),
});

const FORMATS: PostFormat[] = ["card_news", "short_video", "long_video", "text", "thread", "image"];

function formatOf(post: Post, analysis: PostAnalysis): PostFormat {
  const f = analysis.answers.format;
  if (f.type === "choice" && (FORMATS as string[]).includes(f.choice)) return f.choice as PostFormat;
  return post.formatHint ?? "text";
}

function choiceOf(a: PostAnalysis, id: keyof PostAnalysis["answers"]): string {
  const j = a.answers[id];
  return j.type === "choice" ? j.choice : "none";
}

function scoreOf(a: PostAnalysis, id: keyof PostAnalysis["answers"]): string {
  const j = a.answers[id];
  return j.type === "score" ? `${j.score.toFixed(1)} / ${j.max}` : "-";
}

function buildPrompt(input: GenerateDraftInput): { system: string; prompt: string } {
  const { post, analysis, brand } = input;
  const format = formatOf(post, analysis);
  const hook = choiceOf(analysis, "hook_type");
  const tone = choiceOf(analysis, "tone");
  const system = [
    "당신은 한국어 퍼포먼스 마케팅 카피라이터입니다.",
    "경쟁사 포스트의 '구조'(훅 유형, 톤앤매너, 형식, 길이, CTA 강도, 슬라이드 구성)는 그대로 빌리되",
    "내용은 우리 브랜드에 맞게 완전히 새로 씁니다. 원문 문장을 그대로 복사하지 않습니다.",
    "확인되지 않은 수치·후기·수상 같은 사회적 증거는 지어내지 말고 '[수치 확인 필요]' 처럼 자리표시로 남깁니다.",
    "출력은 한국어. headline 은 한 줄, body 는 플랫폼 캡션 그대로 붙여넣을 수 있는 완성 문장.",
  ].join("\n");
  const prompt = JSON.stringify(
    {
      우리_브랜드: { 이름: brand.name, 카테고리: brand.category, 핵심_메시지: brand.positioning },
      벤치마크_포스트: {
        platform: post.platform,
        format: `${format} (${FORMAT_LABEL_KO[format] ?? format})`,
        hook_type: `${hook} (${HOOK_LABEL_KO[hook] ?? hook})`,
        tone: `${tone} (${TONE_LABEL_KO[tone] ?? tone})`,
        cta_strength: scoreOf(analysis, "cta_strength"),
        clarity: scoreOf(analysis, "clarity"),
        text: post.text.slice(0, 2000),
        slides: post.slides?.slice(0, 8),
      },
      요구사항: [
        "같은 훅 유형으로 headline 을 시작할 것",
        "같은 톤과 비슷한 길이로 body 를 쓸 것",
        "CTA 강도를 원본과 같은 수준으로 맞출 것",
        format === "card_news"
          ? `slides 를 원본과 같은 장수(${post.slides?.length ?? 6}장)로 만들 것. 1장은 커버 훅, 마지막 장은 CTA`
          : "slides 는 생략할 것",
      ],
    },
    null,
    1,
  );
  return { system, prompt };
}

const JUDGE_QUESTIONS = {
  structure_match: {
    type: "score",
    instructions:
      "draft 가 original 의 구조(훅 유형 → 본문 전개 → CTA 흐름, 형식, 길이, 슬라이드 구성)를 얼마나 충실히 따랐는지 평가하세요. 내용이 다른 것은 감점 사유가 아닙니다.",
    criteria: [
      "구조가 전혀 다름",
      "일부만 비슷함",
      "대체로 비슷하나 흐름이 다름",
      "구조가 거의 같음",
      "구조·리듬·CTA 위치까지 동일",
    ],
  },
  same_hook: {
    type: "boolean",
    instructions: "draft 의 첫 문장이 original 과 같은 훅 유형(질문/숫자/반박/스토리/하우투/공지/손실자극)인가요?",
  },
  brand_fit: {
    type: "boolean",
    instructions: "draft 가 our_brand 의 카테고리·핵심 메시지에 자연스럽게 맞고, original 의 문장을 그대로 베끼지 않았나요?",
  },
} as const;

/** 시안 1건 생성 (+ jev 재판정). 실패 시 예외를 던지며, 호출 원문은 calls 로 돌려줍니다. */
export async function generateDraft(input: GenerateDraftInput): Promise<GenerateDraftResult> {
  const { post, analysis, brand, mode, signal } = input;
  const format = formatOf(post, analysis);
  const calls: DraftCall[] = [];

  if (mode === "demo") {
    const started = performance.now();
    await sleep(260 + Math.round(seededRandom(`draftdelay:${post.id}`)() * 240), signal);
    const d = demoDraft({ post, analysis, brand });
    const latencyMs = Math.round(performance.now() - started);
    calls.push({
      tag: "draft",
      request: { model: "demo", brand, sourcePostId: post.id, note: "데모 모드 — 템플릿 시안" },
      response: { headline: d.headline, body: d.body, slides: d.slides },
      latencyMs,
      usage: { inputTokens: 900 + Math.round(seededRandom(`dtok:${post.id}`)() * 400), outputTokens: 220 },
      model: "demo",
    });
    return {
      draft: {
        id: `d_${post.id}`,
        sourcePostId: post.id,
        platform: post.platform,
        format,
        headline: d.headline,
        body: d.body,
        slides: d.slides,
        matchScore: d.matchScore,
        model: "demo",
      },
      calls,
    };
  }

  // 1) 텍스트 모델로 시안 생성
  const { system, prompt } = buildPrompt(input);
  const model = draftModelId();
  const t0 = performance.now();
  const gen = await generateObject({
    model,
    schema: draftSchema,
    system,
    prompt,
    abortSignal: signal,
    maxRetries: 1,
  });
  const genLatency = Math.round(performance.now() - t0);
  const object = gen.object;
  const slides = format === "card_news" ? object.slides : undefined;
  calls.push({
    tag: "draft",
    request: { model, system, prompt: JSON.parse(prompt) as JSONValue },
    response: { object, finishReason: gen.finishReason },
    latencyMs: genLatency,
    usage: { inputTokens: gen.usage.inputTokens ?? 0, outputTokens: gen.usage.outputTokens ?? 0 },
    model: gen.response.modelId || model,
  });

  // 2) jev 로 원본 대비 구조 일치도 재판정
  const jev = jevModelId();
  const state: Record<string, JSONValue> = {
    original: postToState(post),
    draft: { headline: object.headline, body: object.body, ...(slides ? { slides } : {}) },
    our_brand: { name: brand.name, category: brand.category, positioning: brand.positioning },
  };
  const t1 = performance.now();
  const judged = await evaluate({ model: jev, state, questions: JUDGE_QUESTIONS, abortSignal: signal, maxRetries: 1 });
  const judgeLatency = Math.round(performance.now() - t1);
  const structure = judged.answers.structure_match.score / (JUDGE_QUESTIONS.structure_match.criteria.length - 1);
  const sameHook = judged.answers.same_hook.probability;
  const brandFit = judged.answers.brand_fit.probability;
  const matchScore = Math.round(Math.max(0, Math.min(100, structure * 60 + sameHook * 25 + brandFit * 15)));
  calls.push({
    tag: "draft_judge",
    request: { model: jev, state, questions: JUDGE_QUESTIONS },
    response: { answers: judged.answers, usage: judged.usage },
    latencyMs: judgeLatency,
    usage: { inputTokens: judged.usage.inputTokens ?? 0, outputTokens: judged.usage.outputTokens ?? 0 },
    model: judged.response.modelId || jev,
  });

  return {
    draft: {
      id: `d_${post.id}`,
      sourcePostId: post.id,
      platform: post.platform,
      format,
      headline: object.headline,
      body: object.body,
      slides,
      matchScore,
      model: gen.response.modelId || model,
    },
    calls,
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error("aborted"));
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(signal?.reason ?? new Error("aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
