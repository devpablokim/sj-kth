# data/ — 샘플 데이터셋과 실제 수집 데이터 연결 가이드

이 폴더에는 대시보드가 기본으로 보여주는 **샘플 포스트 48건**(`samplePosts.ts`)이 들어 있습니다.
실제 수집 데이터로 바꾸는 방법은 아래 순서대로 읽으면 됩니다.

1. [Post JSON 스키마](#1-post-json-스키마) — 포스트 1건이 어떤 필드를 가져야 하는지
2. [예시 JSON](#2-예시-json-포스트-2건) — 붙여넣기용 최소 예시
3. [원본 파일 보관 위치 `data/raw/`](#3-원본-파일은-dataraw-에-gitignore-됨)
4. [대시보드에 붙여넣기 (LOAD POSTS JSON)](#4-대시보드에-붙여넣기--load-posts-json)
5. [수집기(스크래퍼) 어댑터 위치 제안](#5-수집기스크래퍼-어댑터-위치-제안-libingest)

---

## 0. 샘플 데이터셋 (`samplePosts.ts`)

- 카테고리: **직장인 대상 온라인 클래스 / 생산성 앱**
- 가상 브랜드 6곳 × 8건 = 48건. 브랜드·인물·URL 은 전부 허구이며 `https://example.invalid/...` 형태입니다.

| 브랜드 | 핸들 | 콘셉트 |
|---|---|---|
| 클래스온 | `@classon_kr` | 직장인 실무 온라인 클래스 (엑셀·PPT·데이터·노션) |
| 노트플로우 | `@noteflow` | AI 회의록 / 노트 앱 |
| 데일리싱크 | `@dailysync.app` | 캘린더 + 할 일 + 슬랙 요청 통합 앱 |
| 루틴랩 | `@routinelab` | 습관 트래커 + 66일 챌린지 |
| 브레인덱 | `@braindeck` | 플래시카드 학습 앱 (자격증·영어) |
| 포커스핏 | `@focusfit_official` | 집중 타이머 / 딥워크 앱 |

- 플랫폼: x 12 · threads 12 · youtube 12 · instagram 12 (브랜드마다 플랫폼별 2건, 모자이크가 섞여 보이도록 번갈아 배치)
- 형식(`formatHint`): card_news 12 (슬라이드 5~7장) · text 10 · short_video 8 · long_video 8 · thread 7 · image 3
- 훅 유형 8종(question / number / contrarian / story / how_to / announcement / fear / none), CTA 강도 0~4,
  사회적 증거 약 40%, 긴급성 약 30%, 톤 6종이 골고루 섞이도록 설계했습니다. jev 질문 10개가 전부 갈리는지 확인하는 용도입니다.
- `thumbnailUrl` 은 넣지 않았습니다 (UI 가 플랫폼 색 텍스트 타일로 렌더).

---

## 1. Post JSON 스키마

타입 정의 원본은 [`lib/types.ts`](../lib/types.ts) 의 `Post` 입니다. 대시보드와 `/api/analyze` 는 이 형태의 **배열**을 받습니다.

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | `string` | 필수 | 포스트 고유 ID. 대시보드 타일·판정 결과·시안이 이 값으로 연결되므로 한 배열 안에서 **중복 금지**. 예: `"ig_3251..."`, `"x_1893..."` |
| `platform` | `"x" \| "threads" \| "youtube" \| "instagram"` | 필수 | 플랫폼. 타일 색상과 집계 기준 |
| `brand` | `string` | 필수 | 브랜드/계정 표시명 (예: `"클래스온"`). Breakdown 패널의 Brand 열에 그대로 표시 |
| `handle` | `string` | 필수 | `@handle` 또는 채널명 |
| `url` | `string` | 필수 | 원문 URL. 시안 카드에서 "원본 보기" 용도 |
| `text` | `string` | 필수 | 본문/캡션. 유튜브는 `"제목\n\n설명"` 으로 합쳐서 넣습니다. **최대 4,000자** (API 검증 한도) |
| `slides` | `string[]` | 선택 | 카드뉴스라면 슬라이드별 텍스트 (OCR 결과 또는 대체 텍스트). 첫 장 = 커버 훅, 마지막 장 = CTA 인 경우가 많음 |
| `thumbnailUrl` | `string` | 선택 | 썸네일 이미지 URL. 있으면 타일에 이미지, 없으면 텍스트 타일 |
| `formatHint` | `"card_news" \| "short_video" \| "long_video" \| "text" \| "thread" \| "image"` | 선택 | 수집기가 아는 형식 힌트. jev 가 `format` 질문으로 다시 판정하므로 틀려도 치명적이지 않음 |
| `postedAt` | `string` (ISO 8601) | 선택 | 게시 시각. 예: `"2026-09-01T21:00:00+09:00"` |
| `metrics` | `object` | 선택 | 성과 지표. 하위 필드 전부 선택이며 숫자만: `likes`, `comments`, `shares`(리포스트/공유), `views`(조회수) |

한 번에 보낼 수 있는 포스트 수는 **최대 500건**입니다 (`/api/analyze` 의 zod 검증). 그 이상이면 나눠서 실행하세요.

플랫폼별 `text` 구성 권장:

| 플랫폼 | `text` 에 넣는 것 | `slides` | `formatHint` |
|---|---|---|---|
| x | 본문. 스레드면 각 트윗을 `"1/ ...\n\n2/ ..."` 처럼 이어 붙임 | — | `text` / `thread` / `image` |
| threads | 본문. 연속 글이면 x 와 동일하게 번호로 이어 붙임 | 캐러셀이면 이미지별 텍스트 | `text` / `thread` / `card_news` |
| youtube | `제목 + "\n\n" + 설명(더보기 포함)` | — | `long_video` / `short_video`(쇼츠) |
| instagram | 캡션(해시태그 포함) | 캐러셀이면 이미지별 OCR/대체 텍스트 | `card_news` / `short_video`(릴스) / `image` |

---

## 2. 예시 JSON (포스트 2건)

아래를 그대로 대시보드의 **LOAD POSTS JSON** 텍스트 영역에 붙여넣으면 동작합니다.

```json
[
  {
    "id": "ig_20260901_0001",
    "platform": "instagram",
    "brand": "노트플로우",
    "handle": "@noteflow",
    "url": "https://example.invalid/instagram/noteflow/ig_20260901_0001",
    "text": "회의록 쓰는 시간, 진짜 아깝지 않으세요? 🥲\n노트플로우는 녹음 → 요약 → 담당자 배정까지 자동.\n\n댓글에 '회의록' 남기면 2주 무료 체험 링크 DM 드립니다 💌\n\n#회의록 #AI노트",
    "slides": [
      "회의 끝나고 회의록 쓰느라 30분씩 쓰고 계세요?",
      "회의는 1시간, 정리는 30분. 하루 3번이면 정리만 1시간 반이에요.",
      "노트플로우는 회의를 녹음하면 요약·결정사항·담당자를 자동으로 뽑아줍니다.",
      "국내 스타트업 300곳이 이미 회의록을 사람 손으로 안 씁니다.",
      "댓글에 '회의록' 남겨주시면 2주 무료 체험 링크를 DM으로 보내드릴게요 💌"
    ],
    "formatHint": "card_news",
    "postedAt": "2026-09-01T18:30:00+09:00",
    "metrics": { "likes": 4320, "comments": 388, "shares": 910 }
  },
  {
    "id": "yt_20260903_0002",
    "platform": "youtube",
    "brand": "클래스온",
    "handle": "@classon_kr",
    "url": "https://example.invalid/youtube/classon_kr/yt_20260903_0002",
    "text": "#shorts 엑셀 표 3초 만에 예쁘게 만드는 법 (Ctrl+T 하나면 끝)\n\n범위 잡고 Ctrl+T → 스타일 고르기 → 끝. 이런 단축키 30개 모은 강의는 설명란에 👇",
    "formatHint": "short_video",
    "postedAt": "2026-09-03T12:10:00+09:00",
    "metrics": { "views": 320000, "likes": 11800, "comments": 420 }
  }
]
```

---

## 3. 원본 파일은 `data/raw/` 에 (gitignore 됨)

- 스크래퍼 결과, API 덤프, 수동으로 긁은 JSON 등 **원본은 전부 `data/raw/`** 에 두세요.
  루트 `.gitignore` 에 `/data/raw/` 가 등록되어 있어 커밋되지 않습니다.
- 권장 파일명: `data/raw/{YYYY-MM-DD}-{platform}-{brand}.json` (예: `data/raw/2026-09-20-instagram-noteflow.json`)
- 원본에는 타인의 개인정보(댓글 작성자, 프로필 등)가 섞이기 쉽습니다. `Post` 로 변환할 때 본문·캡션·공개 지표만 남기고 나머지는 버리세요.
- 커밋해도 되는 것은 이 폴더의 `samplePosts.ts` 처럼 **허구이거나 가공이 끝난 데이터**뿐입니다.

---

## 4. 대시보드에 붙여넣기 — LOAD POSTS JSON

1. `npm run dev` 로 대시보드를 띄웁니다.
2. 상단 컨트롤 바에서 **LOAD POSTS JSON** 을 누르면 텍스트 영역이 열립니다.
3. 위 스키마의 **배열(`Post[]`) JSON** 을 붙여넣습니다. 파싱에 실패하면 바로 아래에 인라인 에러가 뜹니다 (JSON 문법, 필수 필드 누락, 잘못된 `platform` 값 등).
4. 브랜드명 / 카테고리 / 포지셔닝과 시안 개수를 채우고 **RUN ANALYSIS** 를 누르면, 붙여넣은 포스트가 샘플 대신 사용됩니다.
   - 비워 두면 `SAMPLE_POSTS`(샘플 48건)로 실행됩니다.
5. 모자이크 타일은 붙여넣는 즉시 갱신됩니다. `thumbnailUrl` 이 있으면 이미지, 없으면 텍스트 타일입니다.

터미널에서 바로 API 로 보내고 싶다면 (SSE 스트림이므로 `-N`):

```bash
curl -N -X POST http://localhost:3000/api/analyze \
  -H 'content-type: application/json' \
  -d '{
    "posts": [ ...Post 배열... ],
    "brand": { "name": "우리브랜드", "category": "직장인 생산성 앱", "positioning": "알림을 끄고 25분만 집중" },
    "draftCount": 3
  }'
```

요청 형태는 `lib/types.ts` 의 `RunRequest`, 응답 이벤트는 `RunEvent` 입니다. `demo: true` 를 넣으면 키가 있어도 데모 모드로 돕니다.

---

## 5. 수집기(스크래퍼) 어댑터 위치 제안 — `lib/ingest/`

> 아직 만들지 않았습니다. 실제 수집기를 붙일 때 아래 구조를 권장합니다.

```
lib/ingest/
├── index.ts        # export { toPosts } — 플랫폼 문자열로 어댑터를 고르는 진입점
├── x.ts            # X(트위터) 원본 → Post[]  (스레드는 "1/ ... 2/ ..." 로 합치기)
├── threads.ts      # Threads 원본 → Post[]   (캐러셀 → slides)
├── youtube.ts      # YouTube 원본 → Post[]   (title + "\n\n" + description, 쇼츠는 short_video)
└── instagram.ts    # Instagram 원본 → Post[] (캡션 → text, 캐러셀 OCR/alt → slides, 릴스는 short_video)
```

각 어댑터가 지킬 계약 (제안):

```ts
// lib/ingest/instagram.ts (예시 시그니처 — 아직 없음)
import type { Post } from "@/lib/types";

/** 수집기 원본(형식은 수집기마다 다르므로 unknown) → Post[]. 변환 못 하는 항목은 건너뛰고 이유를 warnings 에 남깁니다. */
export function toPosts(raw: unknown): { posts: Post[]; warnings: string[] };
```

공통 규칙:

- **`id` 는 플랫폼 접두어 + 플랫폼 고유 ID** (`ig_...`, `x_...`, `yt_...`, `th_...`)로 만들어 여러 파일을 합쳐도 겹치지 않게.
- **`url` 기준으로 중복 제거** (같은 포스트가 두 번 수집되는 경우가 흔함).
- `text` 4,000자, 한 번에 500건 한도를 넘으면 잘라서 여러 배열로.
- 영상은 자막/스크립트를 긁을 수 있으면 `text` 의 설명 뒤에 붙이되, 한도를 넘지 않게 앞부분만.
- 이미지 OCR 결과는 `slides` 에 한 장당 한 문자열. 없으면 `slides` 를 생략하고 `formatHint` 만 남기세요.
- 각 플랫폼의 이용약관·robots·API 정책을 따르는 것은 수집기의 책임입니다. 이 저장소는 변환·판정만 담당합니다.

변환 결과를 `data/raw/` 에 저장한 뒤 4번 방법으로 붙여넣거나, 이후 파이프라인에 `posts` 로 직접 넘기면 됩니다.
