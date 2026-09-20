import type { Experimental_EvaluationQuestion as EvaluationQuestion } from "ai";
import type { QuestionId } from "./types";

/**
 * jev(typesafe-ai/jev)에 던지는 질문 세트.
 *
 * jev 는 "생성" 모델이 아니라 "판정(evaluation)" 모델입니다.
 * 하나의 state(포스트 1건)에 대해 boolean / choice / score 형태의 질문에
 * 확률·분포로 답합니다. 질문을 바꾸면 lib/types.ts 의 QuestionId 도 함께 갱신하세요.
 */
export const QUESTIONS = {
  format: {
    type: "choice",
    instructions:
      "이 포스트의 콘텐츠 형식을 고르세요. 슬라이드/카드가 여러 장이면 card_news, 짧은 세로 영상은 short_video, 유튜브 롱폼은 long_video, 텍스트만 있으면 text, 여러 개의 연결된 글이면 thread, 단일 이미지는 image.",
    criteria: {
      card_news: "여러 장의 카드/슬라이드로 구성된 이미지 콘텐츠",
      short_video: "릴스, 쇼츠, 숏폼 세로 영상",
      long_video: "유튜브 롱폼 영상 (제목+설명)",
      text: "텍스트 단독 포스트",
      thread: "연속된 여러 개의 글(스레드)",
      image: "단일 이미지 + 캡션",
    },
  },
  hook_type: {
    type: "choice",
    instructions:
      "첫 문장(훅)이 독자의 주의를 끄는 방식을 고르세요. 가장 지배적인 하나만 선택합니다.",
    criteria: {
      question: "질문으로 시작 (예: '아직도 ~하세요?')",
      number: "숫자/통계/리스트로 시작 (예: '3가지 방법', '90%가')",
      contrarian: "통념을 뒤집는 주장 (예: '~는 틀렸습니다')",
      story: "개인 경험/스토리텔링으로 시작",
      how_to: "방법/가이드 제시 (예: '~하는 법')",
      announcement: "출시/이벤트/할인 공지",
      fear: "손실·불안 자극 (예: '이거 모르면 손해')",
      none: "뚜렷한 훅 없음",
    },
  },
  cta_strength: {
    type: "score",
    instructions:
      "행동 유도(CTA)의 강도를 평가하세요. 링크 클릭, 댓글, 저장, 구매 등 명시적 요청이 얼마나 강하고 구체적인지 봅니다.",
    criteria: [
      "CTA 없음",
      "약함 — 암시적이거나 모호함 (예: '확인해보세요')",
      "보통 — 명확한 행동 1개 (예: '링크에서 신청')",
      "강함 — 구체적 행동 + 이유/혜택 (예: '댓글에 X 남기면 가이드 DM')",
      "매우 강함 — 구체적 행동 + 혜택 + 마감/희소성",
    ],
  },
  pain_point: {
    type: "boolean",
    instructions:
      "이 포스트가 타깃 고객의 구체적인 문제(고통, 불편, 비용, 시간 낭비 등)를 명시적으로 언급하나요?",
    criteria: {
      true: "고객이 겪는 구체적 문제/불편이 문장으로 드러남",
      false: "문제 언급 없이 기능/혜택만 나열하거나 일반적 내용",
    },
  },
  social_proof: {
    type: "boolean",
    instructions:
      "사회적 증거(사용자 수, 후기, 수상, 유명 고객, 매출 수치, 별점 등)가 포함되어 있나요?",
  },
  urgency: {
    type: "boolean",
    instructions: "마감, 한정 수량, 오늘까지 등 긴급성/희소성 장치가 있나요?",
  },
  tone: {
    type: "choice",
    instructions: "전체 톤앤매너를 고르세요.",
    criteria: {
      professional: "전문적, 신뢰감, 격식",
      friendly: "친근한 반말/구어체, 이모지 활용",
      bold: "도발적, 강한 주장, 과감한 표현",
      educational: "설명·정보 전달 위주, 차분함",
      playful: "유머, 밈, 가벼운 장난스러움",
      luxury: "고급스러움, 절제된 표현",
    },
  },
  clarity: {
    type: "score",
    instructions:
      "메시지의 명확성을 평가하세요. 한 번 읽고 '무엇을, 누구에게, 왜'가 바로 파악되는지 봅니다.",
    criteria: [
      "매우 불명확 — 무슨 말인지 파악 어려움",
      "불명확 — 핵심이 흐림",
      "보통 — 대체로 이해되나 군더더기 있음",
      "명확 — 핵심이 바로 보임",
      "매우 명확 — 한 문장으로 요약 가능하고 군더더기 없음",
    ],
  },
  imitability: {
    type: "score",
    instructions:
      "이 포스트의 구조(훅→본문→CTA 흐름, 형식, 길이)를 다른 브랜드가 그대로 빌려 쓸 수 있는 '재사용 가능성'을 평가하세요. 특정 인물/사건에 의존할수록 낮고, 템플릿처럼 일반화 가능할수록 높습니다.",
    criteria: [
      "재사용 불가 — 특정 사건/인물에 완전히 의존",
      "낮음 — 상당 부분을 새로 써야 함",
      "보통 — 구조는 빌릴 수 있으나 내용 대부분 교체 필요",
      "높음 — 구조와 문장 패턴을 거의 그대로 활용 가능",
      "템플릿 수준 — 브랜드명만 바꿔도 성립",
    ],
  },
  make_draft: {
    type: "boolean",
    instructions:
      "이 포스트를 벤치마크해 우리 브랜드 버전의 시안을 만들 가치가 있나요? 훅이 강하고, 구조가 재사용 가능하며, 성과 지표가 높을수록 true 에 가깝습니다. 단순 공지나 잡담이면 false.",
  },
} as const satisfies Record<QuestionId, EvaluationQuestion>;

export type Questions = typeof QUESTIONS;

/** score 질문의 최대값(레벨 수 - 1) — UI 정규화에 사용 */
export function scoreMax(id: QuestionId): number {
  const q = QUESTIONS[id];
  return q.type === "score" ? q.criteria.length - 1 : 1;
}

/** 질문 ID → 대시보드 라벨 (레퍼런스 UI의 소문자 라벨 스타일) */
export const QUESTION_LABELS: Record<QuestionId, string> = {
  format: "format",
  hook_type: "hook",
  cta_strength: "cta",
  pain_point: "pain point",
  social_proof: "social proof",
  urgency: "urgency",
  tone: "tone",
  clarity: "clarity",
  imitability: "imitability",
  make_draft: "draft",
};

export const QUESTION_ORDER: QuestionId[] = [
  "format",
  "hook_type",
  "tone",
  "pain_point",
  "social_proof",
  "urgency",
  "cta_strength",
  "clarity",
  "imitability",
  "make_draft",
];
