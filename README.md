# pablo-jev-test1 — find what makes them buy

경쟁사·벤치마크 브랜드가 **X · Threads · YouTube · Instagram** 에 올린 카드뉴스/마케팅 문구를
Vercel AI Gateway 의 판정 모델 **`typesafe-ai/jev`** 로 대량·고속·저비용으로 판정하고,
따라 할 가치가 큰 포스트를 골라 **우리 브랜드 버전 시안(초안)** 까지 만들어 주는 "라이브 런 대시보드"입니다.

> GitHub 레포 이름은 `sj-kth` 그대로이고, `package.json` 의 패키지 이름만 `pablo-jev-test1` 입니다.

---

## 프로젝트 소개

- 레퍼런스: <https://x.com/tarasshyn/status/2101012033340571952> — "JEV is INSANE. We gave it 3 million replay events. In 40 seconds, it watched 3,247 sessions, caught 132 rage clicks … All for just $2.17."
  이 데모의 화면 구성(스탯 타일 → 썸네일 모자이크 → 분석 중 패널 → 집계 → 드래프트 카드)을 **마케팅 콘텐츠 벤치마크**에 그대로 옮겼습니다.
- 하는 일
  1. **실제 게시물을 API 키 없이 수집**합니다 (기본). YouTube 검색 페이지 · Threads(Jina Reader 렌더링) · X 게시물(fxtwitter) · Instagram 게시물(링크 미리보기 태그). 샘플 48건 · 카테고리 예시 생성 · 직접 붙여넣기도 그대로 있습니다.
  2. 수집된 글은 먼저 **관문(gate)** — "우리 카테고리와 관련된 마케팅 콘텐츠인가?" — 을 통과해야 하고, 무관한 글은 제외됩니다.
  3. 남은 포스트마다 **형식 · 훅 유형 · 톤 · 페인포인트 · 사회적 증거 · 긴급성 · CTA 강도 · 명확성 · 재사용 가능성 · 시안 가치** 10개 질문 + 형식별 **세부 구조**(2단계)를 판정하고, 확신도가 낮으면 핵심 질문을 **한 번 더 물어** 답이 흔들리는지 봅니다.
  4. 답변을 합쳐 `benchmarkScore`(0~100, 가중치 프리셋 3종)를 매기고, 상위 N개에 대해 우리 브랜드 버전 시안을 생성한 뒤 **그 시안을 다시 jev 로 재판정**해 원본과의 구조 일치도(`matchScore`)와 **적합성 심사**(브랜드 안전 · 표시광고 위험 · 타깃 적합 · 포지셔닝 모순 · 완성도 → 승인/검토/차단)를 보여줍니다.
- **jev 는 텍스트 생성기가 아니라 판정(evaluation) 모델입니다.** 하나의 `state`(여기서는 포스트 1건)에 대해 `boolean` / `choice` / `score` 형태의 질문에 확률·분포로 답합니다.
  글을 쓰는 건 별도의 텍스트 모델(`DRAFT_MODEL`)이고, jev 는 "이 포스트가 어떤 포스트인가", "이 시안이 원본 구조를 따랐는가"를 **판단**하는 데만 씁니다.
- 샘플 데이터: `data/samplePosts.ts` (가상 브랜드 6곳 × 8건, 4개 플랫폼 × 12건). 실데이터 연결 방법은 [`data/README.md`](data/README.md).

---

## 아키텍처

```
브라우저  components/Dashboard.tsx · lib/client/useRun.ts (useReducer 로 RunEvent 누적)
   │
   │  POST /api/collect   body: CollectRequest { keywords, platforms, accounts, urls, max }   ← 무료 수집 (기본)
   ▼
lib/collect/index.ts   경로별 병렬 수집 + 보고(CollectorReport) + 중복 제거
   ├─ youtubeHtml.ts   검색 페이지 ytInitialData 파싱 (영상·쇼츠) · oEmbed        키 없음
   ├─ threads.ts       Jina Reader(r.jina.ai) 로 검색/프로필/게시물 마크다운 파싱  키 없음 (분당 20회)
   ├─ x.ts             fxtwitter 공개 API (게시물) · 신디케이션 타임라인 (자주 429) 키 없음
   ├─ instagram.ts     봇 UA 의 og:title/og:description (게시물) · 프로필 엔드포인트(자주 401)
   └─ youtube.ts       (선택) YOUTUBE_API_KEY 가 있으면 Data API 우선
   │
   │  POST /api/analyze   body: RunRequest { posts?, brand, draftCount, demo?, options? }
   ▼
app/api/analyze/route.ts   ──── SSE  data: {RunEvent}\n\n ────▶  브라우저 리듀서
   │   (runtime nodejs · zod 검증: posts ≤ 500, text ≤ 4000자 · abort 시 파이프라인 중단)
   ▼
lib/pipeline.ts   워커 풀 (live 4 / demo 2)
   │   포스트 1건: ① gate(2문항) → ② analyze(10문항) → ③ structure(1문항, format 에 종속) → ④ band → ⑤ recheck(3문항, auto 가 아닐 때)
   │   post_start → call_log* → post_result | post_skipped | post_error → … → draft_* → run_end
   │
   ├─▶ lib/jev.ts        runEvaluate: experimental_evaluate (AI SDK) ──▶ Vercel AI Gateway ──▶ typesafe-ai/jev
   │      ├─ 응답 모델 버전 · usage · providerMetadata.typesafe.confidence 를 함께 기록, ZDR 옵션(env)
   │      └─ demo 모드   lib/demoJudge.ts · lib/demoExtra.ts — 시드 기반 결정적 가짜 판정, gateway 호출 없음
   ├─▶ lib/judge.ts      관문 결정 · 2단계 구조 · 자기일관성 재검사 · 시안 심사 규칙 (임계값은 코드가 소유)
   ├─▶ lib/scoring.ts    benchmarkScore(프리셋 imitate/convert/engagement) · confidence · band(auto/review/uncertain) · summary
   ├─▶ lib/pricing.ts    gateway 가격표 → env 단가 → 실측 추정 단가  (costUsd / costKrw)
   │
   └─▶ lib/drafts.ts     generateObject ──▶ gateway 텍스트 모델 (DRAFT_MODEL)  → { headline, body, slides? }
                           └─ 시안을 jev 로 한 번에 재판정: structure_match · same_hook · brand_fit → matchScore
                                                          + brand_safety · claim_risk · audience_match · contradicts_positioning · quality → 승인/검토/차단
```

- 서버 전용 모듈(`lib/env.ts`, `lib/jev.ts`, `lib/judge.ts`, `lib/pipeline.ts`, `lib/drafts.ts`, `lib/pricing.ts`, `lib/collect/*`)은 클라이언트에서 import 하지 않으며, API 키는 브라우저로 내려가지 않습니다.
- 모든 jev/생성 모델 호출은 `call_log` 이벤트로 요청·응답 원문이 대시보드의 **CALL LOG** 패널에 쌓입니다 (키·헤더 제외).
- `GET /api/health` 는 `{ ok, mode, jevModel, draftModel, hasKey }` 만 돌려주고 키 값은 절대 반환하지 않습니다.

---

## 빠른 시작

```bash
npm install
npm run env:init            # .env.example → .env 복사 (이미 있으면 건너뜀)
#   .env 를 열어 AI_GATEWAY_API_KEY 를 채웁니다
npm run jev:smoke           # jev 에 질문 1개를 보내 키 연결을 확인 (키 없으면 안내 후 종료)
npm run dev                 # http://localhost:3000
```

- Node 20.12 이상 (`.nvmrc` 참고).
- AI Gateway 키 발급: `vercel ai-gateway api-keys create --name my-api-key` 또는 Vercel 대시보드 → AI Gateway → API Keys.
- 키를 넣지 않아도 대시보드는 뜹니다 — 아래 [데모 모드](#데모-모드) 참고.
- 검증 명령: `npm run typecheck` · `npm run lint` · `npm run build` · `npm test` (AI SDK Mock 판정 모델로 관문·구조·재검사·심사 규칙과 수집기 파서를 검증)

---

## 사용법 (화면 기준)

1. **우리 브랜드** — 브랜드명 · 카테고리 · 핵심 메시지를 입력합니다. 카테고리는 관문 판정("우리 카테고리와 관련된 글인가")과 수집 검색어 기본값에, 브랜드명·핵심 메시지는 시안 생성과 시안 심사(포지셔닝 모순)에 쓰입니다. 기본 예시는 하비탄AI(https://hobbytan.com).
2. **분석 대상** — 무엇을 벤치마크할지 고릅니다. 기본은 `실제 수집 (무료)`.
   - `실제 수집 (무료)`: 검색어(쉼표로 여러 개, 기본값은 카테고리) · 플랫폼 체크 · 벤치마크 계정 `@handle` · 게시물 URL 을 넣고 **수집 후 분석 실행 →** 을 누르면 API 키 없이 공개 페이지에서 실제 게시물을 모아 바로 판정합니다. 경로별 성공/실패(✓/✗ · 건수 · ms · 오류)가 그대로 표시됩니다.

     | 플랫폼 | 되는 것 (무료) | 방법 | 한계 |
     |---|---|---|---|
     | YouTube | 검색어 → 영상·쇼츠 (제목 · 설명 스니펫 · 채널 · 조회수 · 게시 시점 · 썸네일), 영상 URL | 검색 페이지 `ytInitialData` 파싱 · oEmbed | 좋아요 수는 `YOUTUBE_API_KEY` 가 있을 때만 |
     | Threads | 검색어 → 공개 검색 결과, `@handle` 프로필, 게시물 URL (본문 · 이미지 · 좋아요/답글/리포스트/공유) | Jina Reader(`r.jina.ai`) 렌더링 마크다운 파싱, 게시물은 봇 UA og 태그 폴백 | 익명 한도 분당 20회 (`JINA_API_KEY` 로 상향) |
     | X | 게시물 URL (본문 · 좋아요 · 리포스트 · 답글 · 조회수 · 미디어) | fxtwitter 공개 API → 신디케이션 폴백 | `@handle` 타임라인은 X 가 자주 429 로 막음 (오류로 표시) |
     | Instagram | 게시물 URL (캡션 · 좋아요 · 댓글 · 날짜 · 썸네일) | 봇 UA 의 `og:title` / `og:description` | `@handle` 프로필은 자주 401 로 막힘 (오류로 표시) |

   - `샘플 48건`: AI 전환 컨설팅 · 기업 AI 교육 카테고리의 가상 벤치마크 브랜드 6곳 (데모용, 실제 기업 아님).
   - `카테고리 예시 생성`: 텍스트 모델이 벤치마크 스타일 포스트를 만듭니다. **실제 게시물이 아니며** `예시` 배지가 붙습니다. LIVE 전용, 12건 약 $0.05 · 24건 약 $0.1 · 48건 약 $0.2.
   - `직접 붙여넣기`: 경쟁사 캡션을 복사해 붙여넣습니다. 여러 개는 빈 줄 두 번 또는 `---` 로 구분. 고급: `Post[]` JSON — 형식은 [data/README.md](data/README.md).
3. **판정 옵션** (접이식) — 점수 가중치 프리셋(모방/전환/반응) · 확신도 기준(엄격/보통/느슨) · 관문 · 재검사 · 구조 토글.
4. **RUN ANALYSIS** — 포스트마다 관문(2) → 본 판정(10) → 구조(1) → 필요 시 재검사(3) 순으로 jev 에 묻고, 상위 N개(`DRAFTS`)는 우리 브랜드 시안 + 적합성 심사가 자동으로 만들어집니다.
5. **결과 보기** — 타일에는 `제외`(관문) · `검토`/`불확실`(확신도) 뱃지가 붙습니다. 타일이나 `TOP BENCHMARKS` 를 누르면 **상세 보기**(원문 · 판정 막대 · 관문/구조/재검사/확신도 행 · 원문 링크)가 열리고, 시안 상세에는 심사 결과(승인/검토/차단 · 5개 지표 · 사유)가 있습니다. 하단 `CALL LOG` 에서 호출별 요청/응답 원문(모델 버전 · confidence 포함)을 볼 수 있습니다.

API 요약: `POST /api/collect` · `POST /api/analyze`(SSE) · `POST /api/generate-set` · `POST /api/draft` · `GET /api/health`

### "agent-reach 스킬만으로는 안 되나?"

[Agent-Reach](https://github.com/Panniantong/Agent-Reach) 는 Claude Code 같은 **로컬 에이전트**에 xreach · yt-dlp · Jina Reader 등 키 없는 CLI 스크레이퍼를 설치해 주는 도구입니다. 배포된 웹앱은 실행 중에 에이전트 스킬을 부를 수 없으므로, 같은 무료 백엔드(Jina Reader · YouTube 페이지 · fxtwitter · og 태그)를 **앱 서버 안에 직접 구현**한 것이 이 `lib/collect/*` 입니다. 로컬에서 Agent-Reach 로 긁은 결과가 있다면 `직접 붙여넣기 → 고급: Post[] JSON` 으로 넣어 같은 파이프라인에 태울 수 있습니다.

---

## Vercel 배포

1. Vercel 에서 이 레포를 import 합니다 (Framework: Next.js, 추가 설정 없음).
2. **Project → Settings → Environment Variables** 에 `AI_GATEWAY_API_KEY` 를 추가합니다 (Production · Preview 모두).
   필요하면 `JEV_MODEL`, `DRAFT_MODEL`, `KRW_PER_USD` 등 아래 표의 변수도 같은 곳에 넣습니다.
3. 같은 Vercel 팀의 AI Gateway 를 쓰는 프로젝트라면 키 없이도 **OIDC(Vercel 배포 토큰)** 로 gateway 인증이 됩니다.
   다만 이 앱은 `AI_GATEWAY_API_KEY` 유무로 live/demo 모드를 정하므로(`lib/env.ts` 의 `resolveMode`), 대시보드를 live 로 쓰려면 키를 넣는 쪽을 권장합니다.
4. `main` 브랜치에 머지되면 자동으로 Production 배포, PR 은 Preview 배포가 됩니다.
5. `/api/analyze` 는 장시간 SSE 응답을 위해 `maxDuration = 300` 으로 선언되어 있습니다. 플랜별 함수 최대 실행 시간 한도를 확인하세요.

---

## 데모 모드

키가 없거나 `JEV_DEMO_MODE=1` 이면 (또는 요청에 `demo: true` 를 넣으면) 자동으로 **데모 모드**로 돕니다.

- `lib/demoJudge.ts` 의 **결정적 가짜 판정기**가 답합니다. `post.id` 를 시드로 한 PRNG 에 텍스트 휴리스틱을 섞어서
  (예: `?` 가 있으면 question 훅 확률↑, 숫자가 있으면 number, "오늘/마감/한정" 이 있으면 urgency true 확률↑, "후기/명" 이 있으면 social_proof↑)
  같은 포스트는 항상 같은 결과가 나옵니다. 120~220ms 의 인위적 지연으로 실행 느낌만 재현합니다.
- 시안도 템플릿 기반 가짜(`demoDraft`)이고 `matchScore` 는 시드 값입니다.
- **gateway 를 절대 호출하지 않습니다.** 비용 타일은 fallback 단가 기준 추정치이며 헤더 배지에 `DEMO` 가 표시됩니다.
- UI 확인, 스크린샷, 오프라인 시연용입니다. 실제 판정 품질을 보려면 키를 넣고 live 로 돌리세요.

---

## 환경변수

`.env.example` 을 복사해 `.env` 를 만듭니다. `.env` 는 gitignore 되어 커밋되지 않습니다.

| 변수 | 기본값 | 설명 |
|---|---|---|
| `AI_GATEWAY_API_KEY` | (없음) | Vercel AI Gateway API 키. 비어 있으면 자동으로 데모 모드 |
| `JEV_MODEL` | `typesafe-ai/jev` | 판정 모델의 gateway 모델 ID |
| `DRAFT_MODEL` | `anthropic/claude-sonnet-5` | 시안(초안) 생성용 텍스트 모델. gateway 모델 ID 그대로 (예: `openai/gpt-5`, `google/gemini-2.5-flash`) |
| `JEV_DEMO_MODE` | (비움) | `1` 또는 `true` 면 키가 있어도 데모 모드 |
| `KRW_PER_USD` | `1400` | 비용 타일의 ₩ 환산 환율 (표시용) |
| `JEV_PRICE_INPUT_PER_M` | (비움) | jev 입력 토큰 단가 덮어쓰기 (USD / 1M tokens) |
| `JEV_PRICE_OUTPUT_PER_M` | (비움) | jev 출력 토큰 단가 덮어쓰기 (USD / 1M tokens) |
| `YOUTUBE_API_KEY` | (비움) | (선택) 있으면 YouTube 검색에 Data API v3(정확한 좋아요·길이)를 우선 사용, 없으면 검색 페이지 파싱 |
| `JINA_API_KEY` | (비움) | (선택) Jina Reader 키 — 없으면 익명 한도(분당 20회)로 Threads 를 읽음 |
| `JEV_ZERO_DATA_RETENTION` | (비움) | `1` 이면 모든 jev 호출에 gateway `zeroDataRetention` 옵션을 붙임 |

---

## jev 질문 설계 · 활용 패턴

질문 정의는 [`lib/questions.ts`](lib/questions.ts) 에 있고, 본 판정 질문 ID 는 `lib/types.ts` 의 `QuestionId` 와 1:1 입니다.
포스트 1건(platform · brand · text · slides · formatHint · metrics)을 `state` 로 두고 아래 10개 질문을 **한 번의 `evaluate()` 호출**로 보냅니다.

| # | ID | 타입 | 측정하는 것 |
|---|---|---|---|
| 1 | `format` | choice | 콘텐츠 형식 — `card_news` / `short_video` / `long_video` / `text` / `thread` / `image`. 수집기의 `formatHint` 를 검증 |
| 2 | `hook_type` | choice | 첫 문장이 주의를 끄는 방식 — `question` / `number` / `contrarian` / `story` / `how_to` / `announcement` / `fear` / `none` |
| 3 | `tone` | choice | 톤앤매너 — `professional` / `friendly` / `bold` / `educational` / `playful` / `luxury` |
| 4 | `pain_point` | boolean | 타깃 고객의 구체적 문제(고통·불편·비용·시간 낭비)를 문장으로 명시하는가 |
| 5 | `social_proof` | boolean | 사용자 수·후기·별점·수상·유명 고객 같은 사회적 증거가 있는가 |
| 6 | `urgency` | boolean | 마감·한정 수량·오늘까지 같은 긴급성/희소성 장치가 있는가 |
| 7 | `cta_strength` | score 0~4 | 행동 유도 강도 — 없음 → 약함 → 보통(행동 1개) → 강함(행동+혜택) → 매우 강함(행동+혜택+마감) |
| 8 | `clarity` | score 0~4 | 한 번 읽고 "무엇을, 누구에게, 왜"가 바로 잡히는가 |
| 9 | `imitability` | score 0~4 | 훅→본문→CTA 구조를 다른 브랜드가 그대로 빌려 쓸 수 있는 재사용 가능성 |
| 10 | `make_draft` | boolean | 이 포스트를 벤치마크해 우리 브랜드 시안을 만들 가치가 있는가 |

여기에 TypeSafe 공식 가이드·Vercel KB·커뮤니티 사례([awesome-jev](https://github.com/Anil-matcha/awesome-jev-by-typesafe), [Vercel KB: classify, route, and score with Jev](https://vercel.com/kb/guide/typesafe-jev-and-ai-sdk), [Jev 활용 사례](https://www.cloudraft.io/blog/top-use-cases-of-jev-typesafe-ai-model))에서 정리한 **사용 패턴**을 그대로 적용했습니다.

| 패턴 | 이 툴에서 | 코드 |
|---|---|---|
| **원자적 질문 + 투기적 팬아웃** | 질문 1개 = 판단 1개, 필요할 법한 질문을 한 호출에 모두 묻고 코드가 골라 씀 | `lib/questions.ts` |
| **관문 / 재랭킹 (RAG filtering)** | 수집된 실제 게시물에 `relevant`(boolean) · `kind`(choice, `uncertain` 탈출구 포함)를 먼저 묻고 pass / review / exclude | `GATE_QUESTIONS` · `decideGate` |
| **확신도 게이팅 (confidence-gated routing)** | `providerMetadata.typesafe.confidence`(있으면) 평균 → `auto` / `review` / `uncertain` 구간, 경계는 사용자 선택 | `bandOf` · 판정 옵션 |
| **2단계(계층) 분류** | `format` 이 정해진 뒤 형식별 옵션 집합으로 `structure` 를 묻는다 (100개 옵션을 한 번에 묻지 않음) | `STRUCTURE_QUESTIONS` · `evaluateStructure` |
| **자기일관성 (self-consistency)** | auto 가 아닌 판정은 `format` · `hook_type` · `make_draft` 를 한 번 더 물어 답이 바뀌면 `uncertain` + "사람 확인 필요" | `evaluateRecheck` |
| **복합 점수 (composite scoring)** | 가중치는 코드가 소유 — 프리셋 모방/전환/반응(반응은 좋아요·조회수 로그 스케일 40%) | `benchmarkScore` |
| **가드레일 · 광고 적합성 심사** | 시안에 `brand_safety` · `claim_risk` · `audience_match` · `contradicts_positioning` · `quality` 를 묻고 코드 규칙으로 승인/검토/차단 | `REVIEW_QUESTIONS` · `decideDraftReview` |
| **검증 (verification)** | 시안이 원본 구조를 따랐는지 `structure_match` · `same_hook` · `brand_fit` → `matchScore` | `lib/drafts.ts` |
| **버전·분포 기록 · ZDR** | 응답 모델 ID(`jev-x.y.z`) · usage · 확률 분포 · confidence 를 CALL LOG 에 그대로 저장, `JEV_ZERO_DATA_RETENTION=1` 로 ZDR | `runEvaluate` |
| **Mock 모델 테스트** | `Experimental_EvaluationMockModelV4` 로 gateway 없이 규칙을 단위 테스트 | `tests/judge.test.ts` |

- 대시보드 "ANALYZING POST" 패널은 `QUESTION_ORDER` 순서로 행을 그리고, 그 아래 `gate` · `structure` · `recheck` · `confidence` 행을 붙입니다. 검정 실선 막대는 확률/점수, **빨간 점선**은 "따라 해야 할 강점" 또는 "주의".
- 질문을 바꾸면 `QuestionId` 타입, `QUESTION_LABELS`, `QUESTION_ORDER` 도 함께 갱신해야 합니다.

---

## 비용 표시는 추정치

상단 **COST SO FAR** 타일은 jev 호출마다 돌아오는 토큰 사용량(`usage`)에 단가를 곱해 누적한 값입니다. 단가는 다음 순서로 정합니다.

1. **gateway 가격표** — run 시작 시 `gateway.getAvailableModels()` 로 `typesafe-ai/jev` 의 `pricing.input / output` 조회 (10분 캐시)
2. 없거나 실패하면 **env** — `JEV_PRICE_INPUT_PER_M` / `JEV_PRICE_OUTPUT_PER_M`
3. 그것도 없으면 **실측 추정치 $0.04 / 1M tokens** (JEV 쇼케이스에서 역산한 값, 아래 참고)

2·3번을 쓰면 타일에 `추정치` 라고 표시됩니다. ₩ 환산은 `KRW_PER_USD`(기본 1400) 를 곱한 표시용 값이고, 실제 청구액은 Vercel AI Gateway 대시보드에서 확인하세요.

---

## JEV 쇼케이스에서 배운 것

jev 공식 쇼케이스 데모 5개를 직접 돌리며 호출 93회의 요청/응답을 정리한 기록이 [`docs/reference/jev-showcase.md`](docs/reference/jev-showcase.md) 에 있습니다 (샘플 요청/응답 JSON · 호출별 지표 CSV 동봉). 이 툴의 설계 근거는 세 줄로 요약됩니다.

1. **호출 형식** — 서버에서 `{ state, questions }` 를 보내면 `choice`(선택 + 확률 분포) · `score`(단계 + 분포) · `boolean`(참 확률)으로 답이 옵니다. 키는 서버에만 두고 브라우저는 SSE 로 결과만 받습니다.
2. **배치 전략** — "항목 1개 × 질문 여러 개"면 항목을 `state` 에 두고 질문만 나열하는 쪽이 토큰상 유리합니다. 그래서 이 툴은 **포스트 1건 = state, 질문 10개 = 호출 1회** 입니다. 질문을 10개 묶어도 호출당 200~500ms 였습니다.
3. **실측 단가** — 입력 토큰 기준 약 **$0.04 / 1M tokens**(₩0.058 / 1k). 93회 호출 · 16만 토큰에 ₩9.40 이었으니, 샘플 48건 한 번 돌리는 비용은 수십 원 수준입니다. 마케팅 문구(마감·DM 유도)를 넣었을 때 긴급도·의도 판정이 정확했던 것도 CTA/urgency 질문 설계의 근거입니다.

---

## 다음 단계

- **수집 경로 보강** — X 계정 타임라인 · Instagram 프로필은 플랫폼이 자주 막습니다. 안정적으로 쓰려면 헤드리스 브라우저(`@sparticuz/chromium`) 또는 공식 API 연결이 필요합니다.
- **카테고리별 벤치마크 세트** — 수집 결과를 저장해 카테고리마다 훅 유형·구조·CTA 분포를 시계열로 비교.
- **시안 A/B 판정** — 한 포스트에 시안을 2~3개 만들고 jev `choice` 로 자동 선별.
- 판정 결과 내보내기(CSV/JSON) · 검토 큐(`review` / `uncertain` 구간만 모아 보기).

---

## 라이선스

MIT — [LICENSE](LICENSE) 참고.
