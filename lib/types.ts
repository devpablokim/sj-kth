/**
 * 공용 도메인 타입 — 서버(파이프라인·수집기)와 클라이언트(대시보드)가 함께 사용합니다.
 */

export type Platform = "x" | "threads" | "youtube" | "instagram";

/**
 * 포스트 출처
 *  - sample: 번들된 가상 샘플 · generated: AI 가 만든 카테고리 예시(실제 게시물 아님)
 *  - pasted: 사용자가 붙여넣음 · youtube: YouTube 수집 · collected: 무료 수집기(Threads/X/Instagram/YouTube 실제 게시물)
 */
export type PostSource = "sample" | "generated" | "pasted" | "youtube" | "collected";

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
  /** 출처 */
  source?: PostSource;
  /** true 면 실제 게시물이 아니라 AI 가 카테고리 예시로 만든 포스트 (UI 에 "예시" 배지) */
  generated?: boolean;
  /** 어떤 무료 수집 경로로 가져왔는지 (예: "youtube-html", "threads-search", "fxtwitter", "instagram-og") */
  collectedVia?: string;
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

/** ── 관문(gate) 판정: 수집된 실제 게시물이 분석 대상인지 먼저 거릅니다 (RAG passage filtering / re-ranking 패턴) ── */
export type GateKind = "marketing" | "educational" | "personal" | "news" | "spam" | "uncertain";
export type GateDecision = "pass" | "review" | "exclude";

export interface GateResult {
  /** 우리 카테고리와 관련된 마케팅/브랜드 콘텐츠일 확률 (boolean 질문) */
  relevant: number;
  kind: GateKind;
  kindProbabilities?: Record<string, number>;
  /** 관문 질문의 확신도 평균 */
  confidence: number;
  decision: GateDecision;
  /** 사람이 읽을 이유 (예: "관련성 0.12 · personal") */
  reason: string;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number };
  costUsd: number;
}

/** 확신도 구간 — auto(자동 채택) / review(검토 권장) / uncertain(불확실) (confidence-gated routing 패턴) */
export type ConfidenceBand = "auto" | "review" | "uncertain";

/** 2단계(계층) 분류 — 형식이 정해진 뒤 형식별 세부 구조를 묻습니다 */
export interface StructureResult {
  /** 형식별 옵션 키 (예: card_news → list / story / before_after …) */
  choice: string;
  probabilities?: Record<string, number>;
  confidence: number;
  /** 질문한 형식 */
  format: PostFormat;
}

/** 자기일관성 재검사 — 같은 입력에 핵심 질문을 한 번 더 물어 답이 흔들리는지 봅니다 */
export interface RecheckResult {
  agreed: boolean;
  /** 답이 달라진 질문 */
  disagreements: QuestionId[];
  latencyMs: number;
}

/** 포스트 1건에 대한 jev 판정 결과 */
export interface PostAnalysis {
  postId: string;
  answers: Record<QuestionId, Judgement>;
  /** 판정에 걸린 시간 (ms) — 본 판정 호출 기준 */
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number };
  /** 이 포스트에 쓴 추정 비용 (USD) — 관문·구조·재검사 호출 포함 */
  costUsd: number;
  /** 0~100. 여러 답변을 합쳐 만든 "따라 할 가치" 종합 점수 (preset 에 따라 가중치 다름) */
  benchmarkScore: number;
  /** 한 줄 요약 (질문 답변에서 규칙 기반으로 생성) */
  summary: string;
  /** 0~1. 질문별 확신도 평균 — 모델이 confidence 를 주면 그 값, 아니면 분포에서 계산 */
  confidence: number;
  band: ConfidenceBand;
  /** 모델(typesafe)이 돌려준 질문별 confidence (있을 때만) */
  providerConfidence?: Record<string, number>;
  gate?: GateResult;
  structure?: StructureResult;
  recheck?: RecheckResult;
}

/** 시안 적합성 심사 결과 (marketing/ad suitability + guardrails 패턴) */
export type DraftDecision = "approve" | "review" | "block";

export interface DraftReview {
  decision: DraftDecision;
  /** 비하·혐오·비방 등 문제가 "없을" 확률 */
  brandSafety: number;
  /** 과장·허위·보장·최상급 등 표시광고 위험 표현이 "있을" 확률 */
  claimRisk: number;
  /** 타깃 고객에게 맞는 말투·내용일 확률 */
  audienceMatch: number;
  /** 우리 브랜드 포지셔닝과 모순될 확률 */
  contradictsPositioning: number;
  /** 게시 가능 품질 0~qualityMax */
  quality: number;
  qualityMax: number;
  /** 결정 이유 (한국어) */
  reasons: string[];
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
  review?: DraftReview;
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
  /** 관문에서 제외된 포스트 수 */
  postsExcluded: number;
  /** 검토 권장(review/uncertain 구간) 포스트 수 */
  postsReview: number;
}

/** jev/생성 모델 호출 1회의 원문 기록 — 대시보드 "CALL LOG" 패널용 (키·헤더는 절대 포함하지 않음) */
export interface CallLogEntry {
  id: string;
  tag: "gate" | "analyze" | "structure" | "recheck" | "draft" | "draft_judge";
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
  | { type: "run_start"; runId: string; mode: "live" | "demo"; jevModel: string; draftModel: string; posts: Post[]; options: JudgeOptions; at: number }
  | { type: "post_start"; postId: string; at: number }
  | { type: "post_result"; analysis: PostAnalysis; stats: RunStats; at: number }
  | { type: "post_skipped"; postId: string; gate: GateResult; stats: RunStats; at: number }
  | { type: "post_error"; postId: string; message: string; stats: RunStats; at: number }
  | { type: "draft_start"; sourcePostId: string; at: number }
  | { type: "draft_result"; draft: Draft; stats: RunStats; at: number }
  | { type: "draft_error"; sourcePostId: string; message: string; stats: RunStats; at: number }
  | { type: "call_log"; entry: CallLogEntry; at: number }
  | { type: "run_end"; stats: RunStats; at: number }
  | { type: "fatal"; message: string; at: number };

/** 종합 점수 가중치 프리셋 (composite scoring 패턴 — 가중치는 코드가 소유) */
export type ScoringPreset = "imitate" | "convert" | "engagement";

/** 판정 파이프라인 옵션 */
export interface JudgeOptions {
  /** 수집된 실제 게시물을 관문 판정으로 거를지 */
  gate: boolean;
  /** 확신도가 낮은 판정을 한 번 더 물어 일관성을 볼지 */
  recheck: boolean;
  /** 형식별 세부 구조(2단계 분류)를 물을지 */
  structure: boolean;
  preset: ScoringPreset;
  /** 확신도 구간 경계: confidence ≥ auto → auto, ≥ review → review, 그 아래 uncertain */
  thresholds: { auto: number; review: number };
}

export const DEFAULT_JUDGE_OPTIONS: JudgeOptions = {
  gate: true,
  recheck: true,
  structure: true,
  preset: "imitate",
  thresholds: { auto: 0.6, review: 0.4 },
};

/** 클라이언트 → 서버 실행 요청 */
export interface RunRequest {
  /** 비우면 샘플 데이터셋 사용 */
  posts?: Post[];
  /** 내 브랜드 정보 — 관문 판정(관련성)과 시안 생성에 사용 */
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
  options?: Partial<JudgeOptions>;
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

/** ── POST /api/collect — 무료 수집기 (API 키 없이 공개 페이지·공개 엔드포인트만 사용) ── */
export interface CollectRequest {
  /** 검색어 (YouTube 검색 · Threads 검색). 최대 5개 */
  keywords: string[];
  /** 어떤 플랫폼을 수집할지 */
  platforms: Platform[];
  /** 벤치마크 계정 @handle (Threads 프로필 · Instagram 프로필 · X 타임라인 — 체크된 플랫폼에만 적용). 최대 10개 */
  accounts: string[];
  /** 게시물 URL (x.com · threads.com · instagram.com · youtube.com). 최대 40개 */
  urls: string[];
  /** 최종 포스트 수 상한 */
  max: number;
}

/** 수집 경로 1개의 결과 보고 — 어떤 무료 경로가 됐고 안 됐는지 화면에 그대로 보여줍니다 */
export interface CollectorReport {
  id: string;
  platform: Platform;
  /** 수집 방법 식별자 (예: youtube-html, threads-search, fxtwitter, instagram-og) */
  method: string;
  /** 사람이 읽을 라벨 (예: "Threads 검색 'AI 교육'") */
  label: string;
  ok: boolean;
  count: number;
  latencyMs: number;
  error?: string;
}

export interface CollectResponse {
  posts: Post[];
  report: CollectorReport[];
  elapsedMs: number;
  source: "collected";
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
