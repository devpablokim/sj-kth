/**
 * 판정 결과 → 종합 점수/확신도/한 줄 요약 (서버·클라이언트 공용 순수 함수).
 * benchmarkScore: 0~100 "따라 할 가치". confidence: 0~1 질문별 확신도 평균.
 * summarize: 규칙 기반 한국어 한 줄 요약.
 */
import type { Judgement, Post, QuestionId } from "./types";

type Answers = Record<QuestionId, Judgement>;

/** boolean 확률 (없으면 0) */
function prob(j: Judgement | undefined): number {
  return j && j.type === "boolean" ? j.probability : 0;
}
/** score 를 0~1 로 정규화 (없으면 0) */
function ratio(j: Judgement | undefined): number {
  return j && j.type === "score" && j.max > 0 ? j.score / j.max : 0;
}
/** choice 값 (없으면 "none") */
function choice(j: Judgement | undefined): string {
  return j && j.type === "choice" ? j.choice : "none";
}

/** 판정 1개의 확신도 (0~1) */
export function confidenceOf(j: Judgement): number {
  switch (j.type) {
    case "boolean":
      return Math.abs(j.probability - 0.5) * 2;
    case "choice": {
      const ps = j.probabilities ? Object.values(j.probabilities).sort((a, b) => b - a) : [];
      if (ps.length === 0) return 0.5;
      return Math.max(0, Math.min(1, ps[0] - (ps[1] ?? 0)));
    }
    case "score": {
      const ps = j.probabilities ? Object.values(j.probabilities) : [];
      return ps.length ? Math.max(0, Math.min(1, Math.max(...ps))) : 1;
    }
  }
}

/** 질문 전체 확신도 평균 */
export function confidenceOfAll(answers: Answers): number {
  const vals = Object.values(answers).map(confidenceOf);
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * 0~100 종합 점수. 가중치:
 *  imitability 30 · make_draft 20 · cta 15 · clarity 15 · pain_point 10 · social_proof 5 · urgency 5
 */
export function benchmarkScore(answers: Answers): number {
  const s =
    ratio(answers.imitability) * 30 +
    prob(answers.make_draft) * 20 +
    ratio(answers.cta_strength) * 15 +
    ratio(answers.clarity) * 15 +
    prob(answers.pain_point) * 10 +
    prob(answers.social_proof) * 5 +
    prob(answers.urgency) * 5;
  return Math.round(Math.max(0, Math.min(100, s)));
}

const HOOK_KO: Record<string, string> = {
  question: "질문형 훅",
  number: "숫자형 훅",
  contrarian: "통념 반박 훅",
  story: "스토리 훅",
  how_to: "하우투 훅",
  announcement: "공지형 훅",
  fear: "손실 자극 훅",
  none: "훅 없음",
};
const FORMAT_KO: Record<string, string> = {
  card_news: "카드뉴스",
  short_video: "숏폼",
  long_video: "롱폼 영상",
  text: "텍스트",
  thread: "스레드",
  image: "이미지",
};
const TONE_KO: Record<string, string> = {
  professional: "전문적",
  friendly: "친근한",
  bold: "과감한",
  educational: "설명형",
  playful: "유쾌한",
  luxury: "고급스러운",
};

export const HOOK_LABEL_KO = HOOK_KO;
export const FORMAT_LABEL_KO = FORMAT_KO;
export const TONE_LABEL_KO = TONE_KO;

/** 규칙 기반 한 줄 요약 */
export function summarize(post: Post, answers: Answers): string {
  const parts: string[] = [];
  const fmt = choice(answers.format);
  const hook = choice(answers.hook_type);
  parts.push(`${FORMAT_KO[fmt] ?? fmt} · ${HOOK_KO[hook] ?? hook}`);

  const cta = ratio(answers.cta_strength);
  if (cta >= 0.75) parts.push("강한 CTA");
  else if (cta >= 0.5) parts.push("보통 CTA");
  else parts.push("약한 CTA");

  const extras: string[] = [];
  if (prob(answers.pain_point) >= 0.5) extras.push("페인포인트");
  if (prob(answers.social_proof) >= 0.5) extras.push("사회적 증거");
  if (prob(answers.urgency) >= 0.5) extras.push("긴급성");
  if (extras.length) parts.push(`${extras.join("·")} 포함`);

  const tone = choice(answers.tone);
  if (TONE_KO[tone]) parts.push(`${TONE_KO[tone]} 톤`);

  const imit = ratio(answers.imitability);
  const verdict =
    prob(answers.make_draft) >= 0.5
      ? imit >= 0.75
        ? "구조 그대로 재사용 가능"
        : "구조 참고해 시안 제작 권장"
      : "시안 가치 낮음";
  return `${parts.join(", ")} — ${verdict}`;
}
