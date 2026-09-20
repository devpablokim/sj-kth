/**
 * 데모 모드용 결정적 가짜 판정기.
 * post.id 로 시드를 만든 PRNG 에 텍스트 휴리스틱을 섞어 jev 와 같은 모양의 답변을 만듭니다.
 * API 키 없이 UI 를 확인하기 위한 용도이며 실제 판정이 아닙니다. (서버 전용)
 */
import type { Judgement, Post, PostAnalysis, PostFormat, QuestionId } from "./types";
import { QUESTIONS, QUESTION_ORDER, scoreMax } from "./questions";

/* ───────────── seeded PRNG ───────────── */

/** FNV-1a 32bit 해시 → 시드 */
function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — 작은 결정적 PRNG */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 문자열 키로 결정적 난수 생성기를 만듭니다 (같은 키 → 같은 수열). */
export function seededRandom(seedKey: string): () => number {
  return mulberry32(hashSeed(seedKey));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** 가중치 맵 → 정규화 확률 (합 = 1, 소수 2자리) */
function toProbabilities(weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights).map(([k, w]) => [k, Math.max(w, 0.01)] as const);
  const sum = entries.reduce((s, [, w]) => s + w, 0);
  const out: Record<string, number> = {};
  for (const [k, w] of entries) out[k] = round2(w / sum);
  return out;
}

function argmax(p: Record<string, number>): string {
  let best = "";
  let bestV = -1;
  for (const [k, v] of Object.entries(p)) {
    if (v > bestV) {
      best = k;
      bestV = v;
    }
  }
  return best;
}

/** 목표 점수 주변에 삼각 분포로 레벨 확률을 만듭니다. score 는 확률 가중 평균과 일치시킵니다. */
function scoreJudgement(id: QuestionId, target: number, rand: () => number): Judgement {
  const max = scoreMax(id);
  const weights: Record<string, number> = {};
  for (let lv = 0; lv <= max; lv++) {
    const d = Math.abs(lv - target);
    weights[String(lv)] = Math.max(0.02, 1 - d / 1.6) + rand() * 0.08;
  }
  const probabilities = toProbabilities(weights);
  let score = 0;
  for (const [lv, p] of Object.entries(probabilities)) score += Number(lv) * p;
  return { type: "score", score: round2(clamp(score, 0, max)), max, probabilities };
}

function choiceJudgement(weights: Record<string, number>): Judgement {
  const probabilities = toProbabilities(weights);
  return { type: "choice", choice: argmax(probabilities), probabilities };
}

function booleanJudgement(probability: number): Judgement {
  return { type: "boolean", probability: round2(clamp(probability, 0.01, 0.99)) };
}

/** 정규식 매칭 개수 */
function count(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

/* ───────────── 휴리스틱 판정 ───────────── */

export interface DemoEvaluation {
  answers: Record<QuestionId, Judgement>;
  usage: { inputTokens: number; outputTokens: number };
}

/** 포스트 1건을 휴리스틱 + 시드 난수로 판정합니다 (지연 없음, 순수 계산). */
export function demoJudge(post: Post): DemoEvaluation {
  const rand = seededRandom(`judge:${post.id}`);
  const fullText = [post.text, ...(post.slides ?? [])].join("\n");
  const firstLine = post.text.split(/\n/)[0]?.trim() ?? "";
  const head = firstLine.slice(0, 40);
  const noise = (amp: number) => (rand() - 0.5) * 2 * amp;

  /* format */
  const fmtW: Record<PostFormat, number> = {
    card_news: 0.3,
    short_video: 0.3,
    long_video: 0.2,
    text: 0.4,
    thread: 0.2,
    image: 0.2,
  };
  if (post.formatHint) fmtW[post.formatHint] += 6;
  if ((post.slides?.length ?? 0) >= 2) fmtW.card_news += 3;
  if (post.platform === "youtube") {
    fmtW.long_video += 2;
    fmtW.short_video += 1.2;
  }
  if (post.platform === "instagram") {
    fmtW.card_news += 1;
    fmtW.short_video += 1;
    fmtW.image += 0.8;
  }
  if (post.platform === "x" || post.platform === "threads") {
    fmtW.text += 1.2;
    if (post.text.length > 280 || /\n\d+[./)]/.test(post.text)) fmtW.thread += 1.5;
  }
  if (/쇼츠|릴스|숏폼|영상/.test(fullText)) fmtW.short_video += 0.8;
  const format = choiceJudgement(fmtW);

  /* hook_type */
  const hookW: Record<string, number> = {
    question: 0.4,
    number: 0.4,
    contrarian: 0.3,
    story: 0.3,
    how_to: 0.4,
    announcement: 0.3,
    fear: 0.3,
    none: 0.5,
  };
  if (/[?？]/.test(head)) hookW.question += 4;
  if (/\d/.test(head)) hookW.number += 3;
  if (/틀렸|아닙니다|착각|오해|사실은|반대로/.test(head)) hookW.contrarian += 3;
  if (/저는|제가|했더니|해봤|경험|년 전|어느 날/.test(head)) hookW.story += 2.5;
  if (/하는 법|하는법|방법|가이드|루틴|정리/.test(head)) hookW.how_to += 3;
  if (/출시|오픈|런칭|이벤트|할인|공개|업데이트/.test(head)) hookW.announcement += 3;
  if (/손해|모르면|놓치|후회|위험|경고/.test(head)) hookW.fear += 3;
  for (const k of Object.keys(hookW)) hookW[k] += rand() * 0.6;
  const hook = choiceJudgement(hookW);

  /* cta_strength */
  const ctaHits = count(fullText, /링크|프로필|신청|댓글|저장|DM|디엠|구매|다운로드|클릭|팔로우|구독|참여|등록|받아가/gi);
  const urgencyHits = count(fullText, /오늘|마감|한정|선착순|마지막|남았|까지만|이번 주|48시간|24시간/g);
  const benefitHits = count(fullText, /무료|혜택|증정|드립니다|보내드|할인/g);
  let ctaTarget = 0.3 + Math.min(ctaHits, 3) * 0.8 + Math.min(benefitHits, 2) * 0.5 + (urgencyHits > 0 ? 0.8 : 0);
  ctaTarget = clamp(ctaTarget + noise(0.4), 0, 4);
  const cta = scoreJudgement("cta_strength", ctaTarget, rand);

  /* pain_point */
  const painHits = count(fullText, /힘들|고민|스트레스|야근|시간이 없|시간 없|낭비|지치|불편|막막|귀찮|답답|버거|미루|포기|번아웃|실패/g);
  const painPoint = booleanJudgement(painHits > 0 ? 0.68 + Math.min(painHits, 3) * 0.08 + noise(0.06) : 0.12 + rand() * 0.3);

  /* social_proof */
  const proofHits = count(fullText, /후기|리뷰|별점|평점|수상|1위|누적|만 명|만명|천 명|천명|명이|수료|만족도|추천|검증|인증/g);
  const socialProof = booleanJudgement(proofHits > 0 ? 0.7 + Math.min(proofHits, 3) * 0.07 + noise(0.05) : 0.08 + rand() * 0.25);

  /* urgency */
  const urgency = booleanJudgement(urgencyHits > 0 ? 0.72 + Math.min(urgencyHits, 3) * 0.07 + noise(0.05) : 0.06 + rand() * 0.2);

  /* tone */
  const toneW: Record<string, number> = {
    professional: 0.4,
    friendly: 0.4,
    bold: 0.3,
    educational: 0.4,
    playful: 0.2,
    luxury: 0.1,
  };
  const emojiHits = count(fullText, /[\u{1F300}-\u{1FAFF}☀-➿]/gu);
  if (emojiHits > 0) toneW.friendly += 1 + Math.min(emojiHits, 4) * 0.4;
  if (/요[!.]|해요|예요|죠[!?]/.test(fullText)) toneW.friendly += 1.2;
  if (/습니다|입니다|드립니다/.test(fullText)) toneW.professional += 1.5;
  if (/정리|이유|방법|원리|팁|단계/.test(fullText)) toneW.educational += 1.3;
  if (/!!|절대|무조건|반드시|솔직히|진짜/.test(fullText)) toneW.bold += 1.4;
  if (/ㅋㅋ|ㅎㅎ|밈|ㅠㅠ/.test(fullText)) toneW.playful += 1.6;
  if (/프리미엄|엄선|품격|프라이빗/.test(fullText)) toneW.luxury += 1.5;
  for (const k of Object.keys(toneW)) toneW[k] += rand() * 0.5;
  const tone = choiceJudgement(toneW);

  /* clarity — 짧고 구조적일수록 명확 */
  const len = fullText.length;
  let clarityTarget = len < 120 ? 3.3 : len < 300 ? 2.9 : len < 700 ? 2.5 : 2.0;
  if (/\n/.test(post.text) || (post.slides?.length ?? 0) > 0) clarityTarget += 0.3;
  if (hook.type === "choice" && hook.choice !== "none") clarityTarget += 0.3;
  const clarity = scoreJudgement("clarity", clamp(clarityTarget + noise(0.45), 0, 4), rand);

  /* imitability — 스토리형/특정 인물 의존은 낮고 템플릿형은 높음 */
  let imitTarget = 2.1;
  if (hook.type === "choice") {
    if (hook.choice === "how_to" || hook.choice === "number" || hook.choice === "question") imitTarget += 0.8;
    if (hook.choice === "story") imitTarget -= 0.9;
    if (hook.choice === "announcement") imitTarget -= 0.4;
  }
  if (format.type === "choice" && format.choice === "card_news") imitTarget += 0.4;
  if (ctaTarget >= 2) imitTarget += 0.3;
  const imitability = scoreJudgement("imitability", clamp(imitTarget + noise(0.5), 0, 4), rand);

  /* make_draft — 훅·CTA·재사용성·명확성·지표 종합 */
  const imitScore = imitability.type === "score" ? imitability.score : 0;
  const ctaScore = cta.type === "score" ? cta.score : 0;
  const clarityScore = clarity.type === "score" ? clarity.score : 0;
  const painP = painPoint.type === "boolean" ? painPoint.probability : 0;
  const views = post.metrics?.views ?? 0;
  const likes = post.metrics?.likes ?? 0;
  const engagement = Math.min(1, Math.log10(1 + likes + views / 50) / 5);
  const hookBonus = hook.type === "choice" && hook.choice !== "none" ? 0.6 : 0;
  const logit = (imitScore / 4) * 2.2 + (ctaScore / 4) * 1.4 + (clarityScore / 4) * 1.0 + painP * 0.8 + engagement * 1.0 + hookBonus - 2.6 + noise(0.35);
  const makeDraft = booleanJudgement(1 / (1 + Math.exp(-logit)));

  const answers: Record<QuestionId, Judgement> = {
    format,
    hook_type: hook,
    cta_strength: cta,
    pain_point: painPoint,
    social_proof: socialProof,
    urgency,
    tone,
    clarity,
    imitability,
    make_draft: makeDraft,
  };

  // 질문 프롬프트 + 포스트 본문 정도의 토큰 사용량을 흉내 냅니다.
  const questionChars = JSON.stringify(QUESTIONS).length;
  const usage = {
    inputTokens: Math.round((questionChars + fullText.length) / 2.4),
    outputTokens: QUESTION_ORDER.length * 6 + Math.round(rand() * 12),
  };

  return { answers, usage };
}

/** 120~220ms 인위적 지연을 넣은 비동기 판정 (abort 지원). */
export async function demoEvaluate(post: Post, signal?: AbortSignal): Promise<DemoEvaluation> {
  const delay = 120 + Math.round(seededRandom(`delay:${post.id}`)() * 100);
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error("aborted"));
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delay);
    const onAbort = () => {
      clearTimeout(t);
      reject(signal?.reason ?? new Error("aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
  return demoJudge(post);
}

/* ───────────── 템플릿 기반 가짜 시안 ───────────── */

export interface DemoDraftInput {
  post: Post;
  analysis: PostAnalysis;
  brand: { name: string; category: string; positioning: string };
}

export interface DemoDraftOutput {
  headline: string;
  body: string;
  slides?: string[];
  matchScore: number;
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length) % arr.length];
}

/** 한국어 조사 "로/으로": 받침이 없거나 ㄹ 받침이면 "로", 그 외 "으로" */
function withRo(word: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${word}로`;
  const jong = (code - 0xac00) % 28;
  return jong === 0 || jong === 8 ? `${word}로` : `${word}으로`;
}

/** 훅 유형/톤/형식을 따라 우리 브랜드 버전의 시안을 템플릿으로 만듭니다. */
export function demoDraft({ post, analysis, brand }: DemoDraftInput): DemoDraftOutput {
  const rand = seededRandom(`draft:${post.id}:${brand.name}`);
  const name = brand.name.trim() || "우리 브랜드";
  const category = brand.category.trim() || "온라인 클래스";
  const positioning = brand.positioning.trim() || "바쁜 직장인을 위한 가장 짧은 성장 루틴";

  const hook = analysis.answers.hook_type;
  const hookType = hook.type === "choice" ? hook.choice : "none";
  const fmt = analysis.answers.format;
  const format = fmt.type === "choice" ? fmt.choice : post.formatHint ?? "text";
  const tone = analysis.answers.tone;
  const toneType = tone.type === "choice" ? tone.choice : "friendly";
  const urgency = analysis.answers.urgency.type === "boolean" && analysis.answers.urgency.probability >= 0.5;
  const proof = analysis.answers.social_proof.type === "boolean" && analysis.answers.social_proof.probability >= 0.5;
  const n = pick(rand, [3, 5, 7, 10, 15]);
  const minutes = pick(rand, [10, 15, 20, 30]);

  const headlines: Record<string, string[]> = {
    question: [`퇴근 후 ${minutes}분, 아직도 그냥 흘려보내세요?`, `${category}, 왜 늘 작심삼일로 끝날까요?`],
    number: [`직장인이 ${withRo(name)} 바꾼 ${n}가지 퇴근 루틴`, `하루 ${minutes}분, ${n}주 만에 달라지는 이유`],
    contrarian: [`열심히 하는 게 문제였습니다 — ${name}이 다르게 하는 법`, `${category}는 의지력의 문제가 아닙니다`],
    story: [`야근 끝나고 ${name} 켠 지 ${n}주, 달라진 것들`, `퇴근길 ${minutes}분이 제 커리어를 바꿨습니다`],
    how_to: [`바쁜 직장인이 ${category}를 끝까지 하는 법`, `${minutes}분으로 ${category} 루틴 만드는 ${n}단계`],
    announcement: [`${name} 새 시즌 오픈 — ${positioning}`, `${name}, 직장인 ${category} 신규 커리큘럼 공개`],
    fear: [`이 ${n}가지 모르면 올해도 ${category} 실패합니다`, `퇴근 후 시간, 이렇게 쓰면 손해입니다`],
    none: [`${name} — ${positioning}`, `${positioning}, ${name}`],
  };
  const headline = pick(rand, headlines[hookType] ?? headlines.none);

  const closer = toneType === "professional" ? "습니다" : "요";
  const ctaLines = [
    `프로필 링크에서 ${name} 첫 주 무료로 시작해보세${closer === "요" ? "요" : "십시오"}.`,
    `댓글에 "${minutes}분" 남기면 ${name} 루틴 템플릿을 DM으로 보내드려${closer === "요" ? "요" : ""}${closer === "요" ? "" : "드립니다"}`.replace("드려드립니다", "드립니다"),
    `저장해두고 오늘 퇴근 후 바로 ${name}에서 실행해보세요.`,
  ];
  const cta = pick(rand, ctaLines);
  const proofLine = proof ? pick(rand, [`이미 ${pick(rand, [1200, 3400, 8700, 12000]).toLocaleString("ko-KR")}명의 직장인이 ${withRo(name)} 루틴을 만들었어요.`, `수강생 만족도 ${pick(rand, [94, 96, 97])}% — 직장인 후기가 증명합니다.`]) : "";
  const urgencyLine = urgency ? pick(rand, ["이번 주 일요일까지 얼리버드 40% 할인.", "선착순 100명 한정, 마감되면 다음 시즌까지 기다려야 해요."]) : "";

  const painLine = pick(rand, [
    "퇴근하면 이미 방전, 강의는 결제만 하고 3강에서 멈춘 경험 있으시죠.",
    "출근 전엔 시간이 없고, 퇴근 후엔 의지가 없어요. 문제는 당신이 아니라 루틴입니다.",
    "매번 큰 결심으로 시작해서 2주 만에 끝났다면, 방식이 잘못된 거예요.",
  ]);
  const solutionLine = `${name}은 ${positioning}. 하루 ${minutes}분 단위로 잘라 놓아서 지하철에서도, 점심시간에도 이어갈 수 있어요.`;

  const body = [painLine, solutionLine, proofLine, urgencyLine, cta].filter(Boolean).join("\n\n");

  let slides: string[] | undefined;
  if (format === "card_news") {
    slides = [
      headline,
      painLine,
      `왜 실패할까? — ${pick(rand, ["시간이 아니라 단위의 문제", "의지가 아니라 설계의 문제", "강의가 아니라 루틴의 문제"])}`,
      `${name}의 방식: ${minutes}분 × 주 ${pick(rand, [3, 4, 5])}회`,
      solutionLine,
      proofLine || `직장인 ${pick(rand, [3, 4, 6])}명 중 1명이 ${n}주 후에도 계속하고 있어요.`,
      cta,
    ];
  }

  const matchScore = 62 + Math.round(rand() * 32);

  return { headline, body, slides, matchScore };
}
