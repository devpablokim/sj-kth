/**
 * 판정 결과 → 종합 점수/확신도/구간/한 줄 요약 (서버·클라이언트 공용 순수 함수).
 *  - benchmarkScore: 0~100 "따라 할 가치" (프리셋별 가중치 — composite scoring 패턴: 가중치는 코드가 소유)
 *  - confidence: 0~1 질문별 확신도 평균 (모델 confidence 우선, 없으면 분포에서 계산)
 *  - bandOf: 확신도 → auto / review / uncertain (confidence-gated routing 패턴)
 *  - summarize: 규칙 기반 한국어 한 줄 요약
 */
import type { ConfidenceBand, Judgement, JudgeOptions, Post, QuestionId, ScoringPreset } from "./types";

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

/** 판정 1개의 확신도 (0~1) — 분포가 한쪽에 몰릴수록 1 */
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

/**
 * 질문 전체 확신도 평균. providerConfidence(typesafe 가 준 질문별 confidence)가 있으면
 * 그 값을 우선 쓰고, 없는 질문만 분포에서 계산합니다.
 */
export function confidenceOfAll(answers: Record<string, Judgement>, providerConfidence?: Record<string, number>): number {
  const ids = Object.keys(answers);
  if (ids.length === 0) return 0;
  let sum = 0;
  for (const id of ids) {
    const pc = providerConfidence?.[id];
    sum += typeof pc === "number" ? pc : confidenceOf(answers[id]);
  }
  return sum / ids.length;
}

/** 확신도 → 구간 */
export function bandOf(confidence: number, thresholds: JudgeOptions["thresholds"]): ConfidenceBand {
  if (confidence >= thresholds.auto) return "auto";
  if (confidence >= thresholds.review) return "review";
  return "uncertain";
}

export const BAND_LABEL_KO: Record<ConfidenceBand, string> = {
  auto: "자동 채택",
  review: "검토 권장",
  uncertain: "불확실",
};

/** 프리셋별 가중치 (합 100). engagement 는 구조 60 + 반응 지표 40 */
const WEIGHTS: Record<ScoringPreset, Record<"imitability" | "make_draft" | "cta_strength" | "clarity" | "pain_point" | "social_proof" | "urgency", number>> = {
  imitate: { imitability: 30, make_draft: 20, cta_strength: 15, clarity: 15, pain_point: 10, social_proof: 5, urgency: 5 },
  convert: { imitability: 10, make_draft: 5, cta_strength: 30, clarity: 15, pain_point: 20, social_proof: 10, urgency: 10 },
  engagement: { imitability: 18, make_draft: 12, cta_strength: 9, clarity: 9, pain_point: 6, social_proof: 3, urgency: 3 },
};

export const PRESET_LABEL_KO: Record<ScoringPreset, string> = {
  imitate: "모방 우선 — 구조 재사용성·시안 가치",
  convert: "전환 우선 — CTA·페인포인트·긴급성",
  engagement: "반응 우선 — 구조 60 + 좋아요·조회수 40",
};

/** 반응 지표 → 0~1 (로그 스케일, 가중 반응 10만 ≈ 1.0). 지표가 없으면 0 */
export function engagementOf(metrics: Post["metrics"] | undefined): number {
  if (!metrics) return 0;
  const weighted = (metrics.likes ?? 0) + (metrics.comments ?? 0) * 3 + (metrics.shares ?? 0) * 5 + (metrics.views ?? 0) / 50;
  if (weighted <= 0) return 0;
  return Math.max(0, Math.min(1, Math.log10(1 + weighted) / 5));
}

/**
 * 0~100 종합 점수. 기본(imitate) 가중치:
 *  imitability 30 · make_draft 20 · cta 15 · clarity 15 · pain_point 10 · social_proof 5 · urgency 5
 */
export function benchmarkScore(answers: Answers, preset: ScoringPreset = "imitate", metrics?: Post["metrics"]): number {
  const w = WEIGHTS[preset];
  let s =
    ratio(answers.imitability) * w.imitability +
    prob(answers.make_draft) * w.make_draft +
    ratio(answers.cta_strength) * w.cta_strength +
    ratio(answers.clarity) * w.clarity +
    prob(answers.pain_point) * w.pain_point +
    prob(answers.social_proof) * w.social_proof +
    prob(answers.urgency) * w.urgency;
  if (preset === "engagement") s += engagementOf(metrics) * 40;
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

export const KIND_LABEL_KO: Record<string, string> = {
  marketing: "마케팅",
  educational: "정보/교육",
  personal: "개인 글",
  news: "뉴스",
  spam: "스팸",
  uncertain: "불확실",
};

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
