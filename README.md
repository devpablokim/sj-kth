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
  1. 분석 대상(샘플 48건 · 카테고리 예시 생성 · 직접 붙여넣기 · YouTube 검색)을 SSE 로 스트리밍하며 한 건씩 jev 에 판정을 맡깁니다.
  2. 각 포스트에 대해 **형식 · 훅 유형 · 톤 · 페인포인트 · 사회적 증거 · 긴급성 · CTA 강도 · 명확성 · 재사용 가능성 · 시안 가치** 10개 질문에 답을 받습니다.
  3. 답변을 합쳐 `benchmarkScore`(0~100)를 매기고, 상위 N개에 대해 우리 브랜드 버전 시안을 생성한 뒤 **그 시안을 다시 jev 로 재판정**해 원본과의 구조 일치도(`matchScore`)를 보여줍니다.
- **jev 는 텍스트 생성기가 아니라 판정(evaluation) 모델입니다.** 하나의 `state`(여기서는 포스트 1건)에 대해 `boolean` / `choice` / `score` 형태의 질문에 확률·분포로 답합니다.
  글을 쓰는 건 별도의 텍스트 모델(`DRAFT_MODEL`)이고, jev 는 "이 포스트가 어떤 포스트인가", "이 시안이 원본 구조를 따랐는가"를 **판단**하는 데만 씁니다.
- 샘플 데이터: `data/samplePosts.ts` (가상 브랜드 6곳 × 8건, 4개 플랫폼 × 12건). 실데이터 연결 방법은 [`data/README.md`](data/README.md).

---

## 아키텍처

```
브라우저  components/Dashboard.tsx · lib/client/useRun.ts (useReducer 로 RunEvent 누적)
   │
   │  POST /api/analyze   body: RunRequest { posts?, brand, draftCount, demo? }
   ▼
app/api/analyze/route.ts   ──── SSE  data: {RunEvent}\n\n ────▶  브라우저 리듀서
   │   (runtime nodejs · zod 검증: posts ≤ 500, text ≤ 4000자 · abort 시 파이프라인 중단)
   ▼
lib/pipeline.ts   워커 풀 (live 4 / demo 2)  post_start → post_result | post_error → … → draft_* → run_end
   │
   ├─▶ lib/jev.ts        experimental_evaluate (AI SDK) ──▶ Vercel AI Gateway ──▶ typesafe-ai/jev
   │      └─ demo 모드   lib/demoJudge.ts  — post.id 시드 기반 결정적 가짜 판정, gateway 호출 없음
   │
   ├─▶ lib/scoring.ts    benchmarkScore · 한 줄 summary · confidence(확신도)
   ├─▶ lib/pricing.ts    gateway 가격표 → env 단가 → 실측 추정 단가  (costUsd / costKrw)
   │
   └─▶ lib/drafts.ts     generateObject ──▶ gateway 텍스트 모델 (DRAFT_MODEL)  → { headline, body, slides? }
                           └─ 생성된 시안을 jev 로 재판정 (structure_match · same_hook · brand_fit) → matchScore
```

- 서버 전용 모듈(`lib/env.ts`, `lib/jev.ts`, `lib/pipeline.ts`, `lib/drafts.ts`, `lib/pricing.ts`)은 클라이언트에서 import 하지 않으며, API 키는 브라우저로 내려가지 않습니다.
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
- 검증 명령: `npm run typecheck` · `npm run lint` · `npm run build`

---

## 사용법 (화면 기준)

1. **우리 브랜드** — 브랜드명 · 카테고리 · 핵심 메시지를 입력합니다. 이 값은 "우리 브랜드 시안"을 쓸 때만 쓰이고 검색어로는 쓰이지 않습니다.
2. **분석 대상** — 무엇을 벤치마크할지 고릅니다.
   - `샘플 48건`: 생산성 앱 카테고리의 가상 브랜드 6곳 (데모용)
   - `카테고리 예시 생성`: 입력한 카테고리와 경쟁 브랜드명을 참고해 텍스트 모델이 벤치마크 스타일 포스트를 만듭니다. **실제 게시물이 아니며** 모든 타일에 `예시` 배지가 붙습니다. LIVE 모드 전용, 12건 약 $0.05 · 24건 약 $0.1 · 48건 약 $0.2.
   - `직접 붙여넣기`: 경쟁사 인스타그램/스레드/X 캡션을 복사해 붙여넣습니다. 여러 개는 빈 줄 두 번 또는 `---` 로 구분. 원문 URL 을 함께 넣으면 상세 보기에서 바로 열립니다.
   - `YouTube 검색`: `YOUTUBE_API_KEY` 가 있으면 검색어로 실제 영상(제목·설명·채널·조회수·썸네일)을 수집합니다.
   - 고급: `Post[]` JSON 붙여넣기 — 형식은 [data/README.md](data/README.md).
3. **RUN ANALYSIS** — 포스트마다 jev 가 질문 10개를 판정하고, 상위 N개(`DRAFTS`)는 자동으로 우리 브랜드 시안이 만들어집니다.
4. **결과 보기** — 타일이나 `TOP BENCHMARKS` 행을 누르면 **상세 보기**(원문 전체 · 슬라이드 · 판정 막대 · 원문 링크 열기)가 열리고, 거기서 "이 포스트로 우리 브랜드 시안 만들기"를 누를 수 있습니다. 하단 `CALL LOG` 의 `JSON 펼침` 으로 호출별 요청/응답 원문을 볼 수 있습니다.

API 요약: `POST /api/analyze`(SSE) · `POST /api/generate-set` · `GET /api/collect/youtube?q=&max=` · `POST /api/draft` · `GET /api/health`

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
| `YOUTUBE_API_KEY` | (비움) | (선택) YouTube 검색 수집용 Google API 키 — YouTube Data API v3 활성화 필요 |

---

## jev 질문 설계

질문 정의는 [`lib/questions.ts`](lib/questions.ts) 에 있고, 질문 ID 는 `lib/types.ts` 의 `QuestionId` 와 1:1 입니다.
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
| 9 | `imitability` | score 0~4 | 훅→본문→CTA 구조를 다른 브랜드가 그대로 빌려 쓸 수 있는 재사용 가능성 (특정 인물·사건 의존 ↓, 템플릿 수준 ↑) |
| 10 | `make_draft` | boolean | 이 포스트를 벤치마크해 우리 브랜드 시안을 만들 가치가 있는가 (단순 공지·잡담이면 false) |

- 대시보드 "ANALYZING POST" 패널은 `QUESTION_ORDER` 순서로 행을 그립니다. 검정 실선 막대는 확률/점수, **빨간 점선**은 "따라 해야 할 강점"(pain_point true, cta ≥ 3, imitability ≥ 3, make_draft true)입니다.
- `benchmarkScore` 는 imitability · cta_strength · clarity · make_draft · pain_point · social_proof 의 가중합입니다 (`lib/scoring.ts`).
- 시안 재판정에는 별도 질문 3개를 씁니다: `structure_match`(score 0~4) · `same_hook`(boolean) · `brand_fit`(boolean) → `matchScore` 0~100.
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

- **수집기 연결** — `lib/ingest/{x,threads,youtube,instagram}.ts` 어댑터를 만들어 원본 → `Post[]` 변환. 원본은 `data/raw/`(gitignore) 에 보관. 자세한 제안은 [`data/README.md`](data/README.md).
- **카테고리별 벤치마크 세트** — 지금은 "직장인 온라인 클래스 / 생산성 앱" 샘플 하나뿐. 카테고리마다 48~100건짜리 세트를 만들어 훅 유형·CTA 분포를 비교.
- **시안 A/B 판정** — 한 포스트에 시안을 2~3개 만들고 jev 에 `choice` 질문으로 "어느 쪽이 원본 구조에 더 가깝고 브랜드에 맞는가"를 물어 자동 선별.
- 확신도 <0.5 인 판정을 따로 모아 사람이 검토하는 큐, 판정 결과 내보내기(CSV/JSON).

---

## 라이선스

MIT — [LICENSE](LICENSE) 참고.
