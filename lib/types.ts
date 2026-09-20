/**
 * 공용 도메인 타입 — 서버(파이프라인)와 클라이언트(대시보드)가 함께 사용합니다.
 */

export type Platform = "x" | "threads" | "youtube" | "instagram";

export type PostSource = "sample" | "generated" | "pasted" | "youtube";

export type PostFormat =
  | "card_news" // 카드뉴스(이미지 슬라이드)
  | "short_video" // 릴스/쇼츠/숏폼
  | "long_video" // 유튜브 롱폼
  | "text" // 텍스트 단독
  | "thread" // 연속 스레드
  | "image"; // 단일 이미지

/** 수집된(또는 샘플) 경쟁사 포스트 1건 */
export interface Post {
  id: string;
  platform: Platform;
  /** 브랜드/계정 표시명 (예: "글로우랩") */
  brand: string;
  /** @handle 또는 채널명 */
  handle: string;
  /** 원문 URL (샘플 데이터는 가짜 URL) */
  url: string;
  /** 본문/캡션/제목 텍스트 */
  text: string;
  /** 카드뉴스라면 슬라이드별 텍스트 */
  slides?: string[];
  /** 썸네일 URL 또는 없음 (없으면 UI가 텍스트 카드로 렌더) */
  thumbnailUrl?: string;
  /** 형식 힌트 (수집기가 알고 있으면 채움, jev가 다시 판정) */
  formatHint?: PostFormat;
  postedAt?: string; // ISO
  /** 출처: 샘플 데이터 / AI 생성 예시 / 사용자가 붙여넣음 / YouTube 검색 수집 */
  source?: PostSource;
  /** true 면 실제 게시물이 아니라 AI 가 카테고리 예시로 만든 포스트 (UI 에 "예시" 배지) */
  generated?: boolean;
  metrics?: {
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
  };
}

/** jev 에 던지는 질문 ID 목록 — lib/questions.ts 의 키와 1:1 */
export type QuestionId =
  | "format"
  | "hook_type"
  | "cta_strength"
  | "pain_point"
  | "social_proof"
  | "urgency"
  | "tone"
  | "clarity"
  | "imitability"
  | "make_draft";

/** jev 답변을 UI 친화적으로 정규화한 형태 */
export type Judgement =
  | { type: "boolean"; probability: number }
  | { type: "choice"; choice: string; probabilities?: Record<string, number> }
  | { type: "score"; score: number; max: number; probabilities?: Record<string, number> };

/** 포스트 1건에 대한 jev 판정 결과 */
export interface PostAnalysis {
  postId: string;
  answers: Record<QuestionId, Judgement>;
  /** 판정에 걸린 시간 (ms) */
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number };
  /** 이 호출의 추정 비용 (USD) */
  costUsd: number;
  /** 0~100. 여러 답변을 합쳐 만든 "따라 할 가치" 종합 점수 */
  benchmarkScore: number;
  /** 한 줄 요약 (질문 답변에서 규칙 기반으로 생성) */
  summary: string;
  /** 0~1. 질문별 확신도 평균 (choice: 1위-2위 확률차, boolean: |p-0.5|*2, score: 최대 확률) */
  confidence: number;
}

/** 생성된 시안(초안) 1건 */
export interface Draft {
  id: string;
  /** 어떤 경쟁사 포스트를 벤치마크했는지 */
  sourcePostId: string;
  platform: Platform;
  format: PostFormat;
  /** 시안 제목/훅 */
  headline: string;
  /** 본문 캡션 */
  body: string;
  /** 카드뉴스라면 슬라이드별 문구 */
  slides?: string[];
  /** 원본과의 구조 일치도 0~100 (jev 재판정) */
  matchScore: number;
  /** 생성에 쓴 모델 ID */
  model: string;
}

/** 실행 전체의 누적 통계 (헤더 타일에 표시) */
export interface RunStats {
  postsTotal: number;
  postsRead: number;
  postsAnalyzed: number;
  checksRun: number;
  postsPerSec: number;
  elapsedMs: number;
  costUsd: number;
  /** costUsd × KRW_PER_USD (환율은 env, 기본 1400) */
  costKrw: number;
  draftsGenerated: number;
}

/** jev/생성 모델 호출 1회의 원문 기록 — 대시보드 "CALL LOG" 패널용 (키·헤더는 절대 포함하지 않음) */
export interface CallLogEntry {
  id: string;
  tag: "analyze" | "draft" | "draft_judge";
  postId?: string;
  /** 한 줄 요약 (예: "글로우랩 · question 훅 · CTA 3/4 · draft yes") */
  summary: string;
  /** 요청 원문 (state + questions 또는 프롬프트) */
  request: unknown;
  /** 응답 원문 (answers + usage 또는 생성 결과) */
  response: unknown;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number };
  costUsd: number;
  mode: "live" | "demo";
  model: string;
  at: number;
}

/** 서버 → 클라이언트 SSE 이벤트 */
export type RunEvent =
  | { type: "run_start"; runId: string; mode: "live" | "demo"; jevModel: string; draftModel: string; posts: Post[]; at: number }
  | { type: "post_start"; postId: string; at: number }
  | { type: "post_result"; analysis: PostAnalysis; stats: RunStats; at: number }
  | { type: "post_error"; postId: string; message: string; stats: RunStats; at: number }
  | { type: "draft_start"; sourcePostId: string; at: number }
  | { type: "draft_result"; draft: Draft; stats: RunStats; at: number }
  | { type: "draft_error"; sourcePostId: string; message: string; stats: RunStats; at: number }
  | { type: "call_log"; entry: CallLogEntry; at: number }
  | { type: "run_end"; stats: RunStats; at: number }
  | { type: "fatal"; message: string; at: number };

/** 클라이언트 → 서버 실행 요청 */
export interface RunRequest {
  /** 비우면 샘플 데이터셋 사용 */
  posts?: Post[];
  /** 내 브랜드 정보 — 시안 생성 시 사용 */
  brand: {
    name: string;
    category: string;
    /** 핵심 메시지/USP */
    positioning: string;
  };
  /** 상위 N개 벤치마크 포스트에 대해 시안 생성 (0이면 생성 안 함) */
  draftCount: number;
  /** 강제 데모 모드 (키 없이) */
  demo?: boolean;
}

/** POST /api/generate-set — 카테고리 기준 벤치마크 예시 세트 생성 요청 */
export interface GenerateSetRequest {
  brand: { name: string; category: string; positioning: string };
  /** 벤치마크/경쟁 브랜드 이름 (선택, 최대 8개). 비우면 카테고리에 맞는 가상 브랜드를 만든다 */
  competitors?: string[];
  /** 12 · 24 · 48 */
  count: number;
  platforms?: Platform[];
}

export interface GenerateSetResponse {
  posts: Post[];
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  costUsd: number;
  latencyMs: number;
  mode: "live" | "demo";
}

/** GET /api/collect/youtube?q=&max= — 실제 YouTube 영상 수집 결과 */
export interface CollectResponse {
  posts: Post[];
  source: PostSource;
  query: string;
}

/** POST /api/draft — 포스트 1건에 대한 시안 생성 요청/응답 */
export interface DraftRequest {
  post: Post;
  analysis: PostAnalysis;
  brand: { name: string; category: string; positioning: string };
  demo?: boolean;
}

export interface DraftResponse {
  draft: Draft;
  calls: CallLogEntry[];
  mode: "live" | "demo";
}
