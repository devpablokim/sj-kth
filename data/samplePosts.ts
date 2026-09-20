/**
 * 샘플 데이터셋 — "AI 전환(AX) 컨설팅 · 기업 AI 교육" 카테고리의 가상 벤치마크 브랜드 6곳이
 * X · Threads · YouTube · Instagram 에 올린 카드뉴스 · 마케팅 문구 · 광고 소재 48건입니다 (브랜드별 8건, 플랫폼별 12건).
 * 실제 기업·게시물이 아니며(브랜드명 가상), 텍스트 모델의 도움을 받아 훅 유형 · CTA 강도 · 사회적 증거 · 긴급성 · 톤이
 * 골고루 섞이도록 만든 데모용 예시입니다. 지표(metrics)는 플랫폼별 현실적 범위의 시드 난수입니다.
 * 우리 브랜드 예시: 하비탄AI (https://hobbytan.com) — 기본 폼 값은 components/Dashboard.tsx 참고.
 */
import type { Post } from "@/lib/types";

export const SAMPLE_POSTS: Post[] = [
  {
    "id": "p001",
    "platform": "instagram",
    "brand": "AX아카데미",
    "handle": "@ax_academy",
    "url": "https://example.invalid/instagram/ax_academy/p001",
    "text": "대기업만 AI 전환에 성공한다는 편견, 이제 깨질 때입니다. 30인 이하 조직도 6주 안에 반복 업무를 자동화한 사례를 카드뉴스로 정리했어요. #AI전환 #중소기업AI #업무자동화",
    "slides": [
      "AI 전환은 대기업만의 이야기다?",
      "❌ 통념: 억 단위 예산과 전담 팀이 있어야 시작 가능",
      "✅ 현실: 30인 이하 기업도 3개월 내 업무 자동화 성공 사례 다수",
      "지난 1년간 중소기업 137개사와 함께한 AX아카데미",
      "평균 도입 기간 6주, 만족도 4.8/5",
      "지금 필요한 건 예산이 아니라 방법입니다",
      "프로필 링크에서 무료 진단 신청하기"
    ],
    "formatHint": "card_news",
    "postedAt": "2026-07-19T16:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 11133,
      "comments": 446,
      "shares": 868
    }
  },
  {
    "id": "p002",
    "platform": "threads",
    "brand": "프롬프트스쿨",
    "handle": "@promptschool_kr",
    "url": "https://example.invalid/threads/promptschool_kr/p002",
    "text": "팀장님, 우리 팀 업무 중에 AI가 대신할 수 있는 게 몇 개나 될까요?\n\n대부분 답을 못 합니다. 진단조차 안 해봤으니까요. AX는 도구 도입이 아니라 업무 재설계에서 시작합니다.",
    "formatHint": "text",
    "postedAt": "2026-07-03T14:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 1192,
      "comments": 99,
      "shares": 7
    }
  },
  {
    "id": "p003",
    "platform": "x",
    "brand": "AX아카데미",
    "handle": "@ax_academy",
    "url": "https://example.invalid/x/ax_academy/p003",
    "text": "지난 6개월간 AX아카데미 워크샵을 거친 팀장 82%가 '업무 시간 20% 단축'을 경험했습니다. 누적 참여 기업 340곳. 3월 기수 마감까지 D-3, 정원 12석 중 3석 남았습니다. 지금 신청 → 프로필 링크",
    "formatHint": "text",
    "postedAt": "2026-09-04T12:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 1970,
      "comments": 125,
      "shares": 32
    }
  },
  {
    "id": "p004",
    "platform": "youtube",
    "brand": "AX아카데미",
    "handle": "@ax_academy",
    "url": "https://example.invalid/youtube/ax_academy/p004",
    "text": "팀장님, AI 툴 배우기 전에 이거 먼저 물어보셨나요? #shorts\n\n요즘 너도나도 챗GPT, 코파일럿 도입한다는데 정작 '우리 팀 업무 프로세스'는 제대로 들여다보셨나요? 툴부터 배우면 반년 뒤에 또 새 툴 찾게 됩니다. AX아카데미의 팀 진단 워크샵은 도구보다 업무 흐름을 먼저 봅니다. 자세한 커리큘럼은 프로필 링크에서 확인해보세요.",
    "formatHint": "short_video",
    "postedAt": "2026-08-19T09:00:00.000Z",
    "source": "sample",
    "metrics": {
      "views": 75996,
      "likes": 3652,
      "comments": 98
    }
  },
  {
    "id": "p005",
    "platform": "instagram",
    "brand": "데이터핏컨설팅",
    "handle": "@datafit_consulting",
    "url": "https://example.invalid/instagram/datafit_consulting/p005",
    "text": "챗GPT한테 '보고서 써줘'라고만 치고 계신가요?\n\n그 한 줄이 부족해서 매번 다시 쓰고 계셨던 거예요. 프롬프트 하나 바꿨을 뿐인데 결과물이 완전히 달라지는 거 다들 아시죠? 오늘 릴스에서 실무자들이 자주 놓치는 프롬프트 습관 3가지 보여드려요. 저장해두고 다음에 써먹어보세요 :) #프롬프트엔지니어링 #업무자동화",
    "formatHint": "short_video",
    "postedAt": "2026-08-02T17:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 10055,
      "comments": 479,
      "shares": 159
    }
  },
  {
    "id": "p006",
    "platform": "threads",
    "brand": "실무AI연구소",
    "handle": "@bizai_lab",
    "url": "https://example.invalid/threads/bizai_lab/p006",
    "text": "'프롬프트만 잘 쓰면 AI 잘 쓰는 거다' — 이거 반은 틀렸어요.\n\n진짜 문제는 프롬프트가 아니라 '무엇을 물어봐야 하는지' 모르는 거거든요. 질문 설계 없이는 아무리 좋은 프롬프트도 헛돕니다.\n\n댓글에 '질문설계' 남겨주시면 무료 체크리스트 DM으로 보내드릴게요.",
    "formatHint": "thread",
    "postedAt": "2026-07-17T15:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 870,
      "comments": 115,
      "shares": 67
    }
  },
  {
    "id": "p007",
    "platform": "x",
    "brand": "AX아카데미",
    "handle": "@ax_academy",
    "url": "https://example.invalid/x/ax_academy/p007",
    "text": "1/ 프롬프트 하나로 보고서 초안 뽑는 5단계, 순서대로만 따라 하세요.\n2/ 목적 → 역할 → 맥락 → 형식 → 예시. 이 순서를 지키면 결과물 품질이 확 달라집니다.\n3/ 500개 팀을 교육하며 검증한 순서입니다. 오늘부터 적용해보세요.",
    "formatHint": "thread",
    "postedAt": "2026-09-18T13:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 1771,
      "comments": 133,
      "shares": 117
    }
  },
  {
    "id": "p008",
    "platform": "youtube",
    "brand": "프롬프트스쿨",
    "handle": "@promptschool_kr",
    "url": "https://example.invalid/youtube/promptschool_kr/p008",
    "text": "챗GPT 활용법, 3200명이 배운 프롬프트 설계 노하우\n\n00:00 인트로 - 왜 같은 챗GPT인데 결과물이 다를까\n00:45 실전 사례 - 보고서 작성 프롬프트 3단계 구조\n03:10 흔한 실수 - 지시가 아니라 맥락을 줘야 하는 이유\n05:20 수강생 후기 및 Q&A\n\n지난 1년간 누적 수강생 3,200명이 거쳐간 프롬프트스쿨의 실무 강의 핵심만 담았습니다. 궁금한 점은 댓글로 남겨주시면 다음 영상에서 다뤄볼게요.",
    "formatHint": "long_video",
    "postedAt": "2026-09-02T11:00:00.000Z",
    "source": "sample",
    "metrics": {
      "views": 51174,
      "likes": 4225,
      "comments": 260
    }
  },
  {
    "id": "p009",
    "platform": "instagram",
    "brand": "오토메이트랩",
    "handle": "@automatelab",
    "url": "https://example.invalid/instagram/automatelab/p009",
    "text": "직장인 대부분이 반복 업무에 하루 2시간 이상을 씁니다. 오토메이트랩 워크샵으로 그 시간을 되찾아보세요. #업무자동화 #노코드AI #워크샵모집",
    "slides": [
      "직장인 78%가 반복 업무에 하루 2시간을 씁니다",
      "엑셀 정리, 보고서 취합, 메일 회신... 매일 반복되는 그 일",
      "오토메이트랩 워크샵 참가자 평균, 업무 시간 주 6시간 단축",
      "노코드 자동화 툴 + AI로 직접 만드는 나만의 업무 봇",
      "이번 기수는 20명 한정, 현재 14명 마감",
      "얼리버드 할인은 이번 주 금요일 자정까지",
      "댓글에 '자동화' 남기면 커리큘럼 DM으로 보내드려요"
    ],
    "formatHint": "card_news",
    "postedAt": "2026-09-10T13:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 13290,
      "comments": 380,
      "shares": 507
    }
  },
  {
    "id": "p010",
    "platform": "threads",
    "brand": "오토메이트랩",
    "handle": "@automatelab",
    "url": "https://example.invalid/threads/automatelab/p010",
    "text": "반복 업무 하루 2시간, 1년이면 500시간\n\n중소기업 87곳 도입 결과로 확인한 자동화 효과, 지금 확인해보세요.",
    "slides": [
      "직원 1인당 반복업무 시간, 하루 평균 2.1시간",
      "1년으로 환산하면 약 500시간 — 3개월치 근무량과 맞먹는 수치",
      "오토메이트랩 도입 기업 87곳 대상 평균 조사 결과",
      "자동화 도입 후 반복업무 시간 68% 감소",
      "남는 시간, 기획과 고객 응대에 재배치",
      "우리 팀 반복업무, 지금 진단해보세요"
    ],
    "formatHint": "card_news",
    "postedAt": "2026-08-24T11:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 1837,
      "comments": 66,
      "shares": 183
    }
  },
  {
    "id": "p011",
    "platform": "x",
    "brand": "데이터핏컨설팅",
    "handle": "@datafit_consulting",
    "url": "https://example.invalid/x/datafit_consulting/p011",
    "text": "AI 자동화, 대기업 전유물이라고요? 틀렸습니다. 저희 고객사의 68%는 직원 50인 이하 기업입니다. 반복 업무 3개만 자동화해도 월 40시간이 절약됩니다. 이번 주까지 무료 진단 선착순 20팀 접수 중, 프로필 링크에서 신청하세요.",
    "formatHint": "text",
    "postedAt": "2026-07-26T09:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 1997,
      "comments": 14,
      "shares": 184
    }
  },
  {
    "id": "p012",
    "platform": "youtube",
    "brand": "오토메이트랩",
    "handle": "@automatelab",
    "url": "https://example.invalid/youtube/automatelab/p012",
    "text": "\"자동화는 개발자만 하는 거다\"는 착각, 오늘로 끝냅니다 #shorts\n\n노코드 자동화 툴 몇 개만 알면 엑셀 반복 작업, 보고서 취합, 알림 발송까지 클릭 몇 번으로 끝낼 수 있습니다. 비개발자 실무자를 위한 오토메이트랩 얼리버드 클래스, 오늘 자정까지만 30% 할인가로 신청 가능합니다. 링크 클릭해서 지금 바로 확인하세요.",
    "formatHint": "short_video",
    "postedAt": "2026-08-11T11:00:00.000Z",
    "source": "sample",
    "metrics": {
      "views": 91673,
      "likes": 5069,
      "comments": 308
    }
  },
  {
    "id": "p013",
    "platform": "instagram",
    "brand": "AX아카데미",
    "handle": "@ax_academy",
    "url": "https://example.invalid/instagram/ax_academy/p013",
    "text": "업무에 AI를 붙이는 가장 쉬운 순서, 3단계로 정리했습니다.\n\n1) 반복 업무 리스트업 → 2) 자동화 가능 영역 분류 → 3) 팀 단위 파일럿 운영. 많은 기업들이 이 순서를 건너뛰고 툴부터 도입해서 실패합니다. 진단부터 시작하세요. 더 궁금하신 분은 프로필 링크 참고해주세요. #AI전환 #업무자동화 #팀워크샵",
    "formatHint": "image",
    "postedAt": "2026-09-11T15:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 10197,
      "comments": 64,
      "shares": 484
    }
  },
  {
    "id": "p014",
    "platform": "threads",
    "brand": "프롬프트스쿨",
    "handle": "@promptschool_kr",
    "url": "https://example.invalid/threads/promptschool_kr/p014",
    "text": "작년에 만난 한 팀장님이 그러시더라고요. '우리 팀은 막내가 제일 AI 잘 써요. 근데 그게 문제예요.'\n\n한 명만 잘 쓰면 그 사람 퇴사하는 순간 조직의 AI 역량도 같이 나가버립니다. 워크샵은 그래서 팀 전체가 같이 듣는 걸 원칙으로 해요.",
    "formatHint": "text",
    "postedAt": "2026-07-09T17:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 1074,
      "comments": 156,
      "shares": 146
    }
  },
  {
    "id": "p015",
    "platform": "x",
    "brand": "팀AI워크스",
    "handle": "@teamai_works",
    "url": "https://example.invalid/x/teamai_works/p015",
    "text": "우리 팀도 AI 워크샵이 필요할까요?",
    "slides": [
      "매주 반복 보고서 작성에 3시간 이상 쓰나요?",
      "엑셀 데이터 정리만 하다 하루가 끝나나요?",
      "챗GPT는 써봤지만 업무엔 적용 못했나요?",
      "이 중 하나라도 해당된다면, 팀AI워크스 워크샵이 필요한 시점입니다.",
      "2일 워크샵으로 팀 전용 AI 업무 매뉴얼을 만들어드립니다.",
      "이번 달 한정 3팀만 선착순 무료 진단 가능합니다."
    ],
    "formatHint": "card_news",
    "postedAt": "2026-07-12T18:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 2196,
      "comments": 5,
      "shares": 100
    }
  },
  {
    "id": "p016",
    "platform": "youtube",
    "brand": "팀AI워크스",
    "handle": "@teamai_works",
    "url": "https://example.invalid/youtube/teamai_works/p016",
    "text": "87개 기업이 AI 내재화에 실패하지 않은 이유\n\n00:00 도입부 - 대부분의 AI 도입이 흐지부지되는 패턴\n01:30 사례 하나 - 초반엔 열정적이었지만 3개월 만에 멈춘 팀\n04:00 전환점 - 담당자를 남기지 않고 '팀 전체'가 쓰게 만든 방식\n07:15 정리\n\n팀AI워크스와 함께한 87개 기업의 공통점은 하나였습니다. 특정 담당자가 아니라 팀 전체가 도구를 쓸 수 있게 만드는 것. 오늘 영상에서 그 과정을 자세히 풀어봅니다.",
    "formatHint": "long_video",
    "postedAt": "2026-07-29T10:00:00.000Z",
    "source": "sample",
    "metrics": {
      "views": 116494,
      "likes": 4495,
      "comments": 146
    }
  },
  {
    "id": "p017",
    "platform": "instagram",
    "brand": "데이터핏컨설팅",
    "handle": "@datafit_consulting",
    "url": "https://example.invalid/instagram/datafit_consulting/p017",
    "text": "AI 도입, 늦출수록 손해입니다. 데이터핏이 우리 회사 데이터부터 진단해드립니다. #AI전환컨설팅 #데이터진단",
    "slides": [
      "지금 AI 안 쓰면, 내년엔 경쟁사한테 밀립니다",
      "이미 동종업계 42%가 AI 업무 도구 도입 완료",
      "안 쓰는 팀은 매달 인건비로 더 지불하고 있는 셈",
      "데이터핏은 우리 회사 데이터 구조부터 진단합니다",
      "잘못된 도구 도입, 되돌리는 비용이 더 큽니다",
      "지금 시작해야 늦지 않습니다",
      "오늘 자정까지 무료 컨설팅 신청 마감, 링크 클릭하세요"
    ],
    "formatHint": "card_news",
    "postedAt": "2026-08-28T13:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 11275,
      "comments": 31,
      "shares": 304
    }
  },
  {
    "id": "p018",
    "platform": "threads",
    "brand": "실무AI연구소",
    "handle": "@bizai_lab",
    "url": "https://example.invalid/threads/bizai_lab/p018",
    "text": "AI 전환, 이 순서대로 하면 실패 안 합니다\n\n중소기업 컨설팅에서 반복적으로 확인한 5단계 프로세스입니다.",
    "slides": [
      "1단계: 업무 프로세스 전수 조사",
      "2단계: 자동화 가능 영역 우선순위화",
      "3단계: 소규모 파일럿 2주 운영",
      "4단계: 결과 측정 후 확산 여부 결정",
      "5단계: 내부 담당자 육성 및 매뉴얼화"
    ],
    "formatHint": "card_news",
    "postedAt": "2026-09-13T16:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 1396,
      "comments": 139,
      "shares": 85
    }
  },
  {
    "id": "p019",
    "platform": "x",
    "brand": "AX아카데미",
    "handle": "@ax_academy",
    "url": "https://example.invalid/x/ax_academy/p019",
    "text": "작년 이맘때, 한 제조업 팀장님은 '우리 회사엔 AI가 안 맞는다'고 하셨습니다. 6개월 뒤, 그 팀은 발주서 처리 시간을 절반으로 줄였고, 현재 120개 팀이 같은 방식으로 도입했습니다. 데이터 정리부터 시작했을 뿐입니다. 궁금하신 분은 댓글 남겨주세요.",
    "formatHint": "text",
    "postedAt": "2026-09-16T16:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 2395,
      "comments": 133,
      "shares": 15
    }
  },
  {
    "id": "p020",
    "platform": "youtube",
    "brand": "프롬프트스쿨",
    "handle": "@promptschool_kr",
    "url": "https://example.invalid/youtube/promptschool_kr/p020",
    "text": "AI 업무 진단, 이 3단계만 따라하면 됩니다 #shorts\n\n1단계, 반복 업무 목록화. 2단계, 소요 시간 측정. 3단계, AI로 대체 가능한 항목 표시. 이 3단계만 해도 어디서부터 시작할지 감이 잡힙니다. 전체 진단 템플릿은 설명란 링크에서 무료로 받아보실 수 있습니다.",
    "formatHint": "short_video",
    "postedAt": "2026-07-15T18:00:00.000Z",
    "source": "sample",
    "metrics": {
      "views": 141316,
      "likes": 3922,
      "comments": 779
    }
  },
  {
    "id": "p021",
    "platform": "instagram",
    "brand": "오토메이트랩",
    "handle": "@automatelab",
    "url": "https://example.invalid/instagram/automatelab/p021",
    "text": "3년차 팀장님이 보내주신 후기\n\n'매주 월요일마다 주간보고 작성에 2시간씩 쓰던 저희 팀, 이제는 15분이면 끝나요.' 처음엔 반신반의하셨다는 팀장님, 워크샵 끝나고 직접 템플릿까지 만드셔서 팀원들과 공유하셨대요. 저희도 이런 후기 받을 때마다 뿌듯합니다. 궁금하신 분들은 댓글 남겨주세요, 순서대로 안내드릴게요. #AI워크샵후기 #실무AI",
    "formatHint": "short_video",
    "postedAt": "2026-08-25T14:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 1633,
      "comments": 386,
      "shares": 238
    }
  },
  {
    "id": "p022",
    "platform": "threads",
    "brand": "팀AI워크스",
    "handle": "@teamai_works",
    "url": "https://example.invalid/threads/teamai_works/p022",
    "text": "11월 슈퍼유저 워크샵, 선착순 20팀 모집 마감 임박\n\n남은 자리 3팀. 오늘 자정까지 신청하시면 얼리버드가 적용됩니다. 프로필 링크에서 바로 신청하세요.",
    "formatHint": "text",
    "postedAt": "2026-08-08T12:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 2493,
      "comments": 69,
      "shares": 93
    }
  },
  {
    "id": "p023",
    "platform": "x",
    "brand": "데이터핏컨설팅",
    "handle": "@datafit_consulting",
    "url": "https://example.invalid/x/datafit_consulting/p023",
    "text": "기업 AI 도입 실패 원인 1위는 기술이 아니라 '내재화 부족'입니다. 외부 컨설팅으로 끝나면 6개월 뒤 원점으로 돌아갑니다. 실무자가 직접 운영할 수 있어야 지속됩니다.",
    "formatHint": "text",
    "postedAt": "2026-07-23T10:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 215,
      "comments": 109,
      "shares": 153
    }
  },
  {
    "id": "p024",
    "platform": "youtube",
    "brand": "실무AI연구소",
    "handle": "@bizai_lab",
    "url": "https://example.invalid/youtube/bizai_lab/p024",
    "text": "[공지] 슈퍼유저 워크샵 8기 모집, 선착순 30명 마감 임박 #shorts\n\n지금까지 누적 수료생 5,000명을 배출한 실무AI연구소 슈퍼유저 워크샵, 이번 8기는 선착순 30명만 받습니다. 팀 내 AI 전파자를 키우고 싶으신 팀장님이라면 지금 바로 신청하세요. 마감되면 다음 기수는 두 달 뒤에나 열립니다.",
    "formatHint": "short_video",
    "postedAt": "2026-07-06T18:00:00.000Z",
    "source": "sample",
    "metrics": {
      "views": 176126,
      "likes": 2611,
      "comments": 330
    }
  },
  {
    "id": "p025",
    "platform": "instagram",
    "brand": "AX아카데미",
    "handle": "@ax_academy",
    "url": "https://example.invalid/instagram/ax_academy/p025",
    "text": "9월 슈퍼유저 워크샵 얼리버드 마감 D-2\n\n팀장급 대상 3주 완성 AI 전환 워크샵, 이번 기수부터 가격이 오릅니다. 지금 신청하시면 20% 할인가로 참여 가능해요. 자리는 8석 남았습니다. 마감 후 문의는 정가로만 안내드립니다. 서두르세요. #AI워크샵 #얼리버드마감",
    "formatHint": "image",
    "postedAt": "2026-09-07T15:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 555,
      "comments": 419,
      "shares": 419
    }
  },
  {
    "id": "p026",
    "platform": "threads",
    "brand": "프롬프트스쿨",
    "handle": "@promptschool_kr",
    "url": "https://example.invalid/threads/promptschool_kr/p026",
    "text": "경쟁사는 이미 AI로 견적서 작성 시간을 10분으로 줄였는데, 우리는 아직도 2시간 걸린다면요.\n\n올해 안에 안 바뀌면 내년엔 인력으로 못 따라잡습니다. AX는 선택이 아니라 생존 문제로 다가오고 있어요.",
    "formatHint": "thread",
    "postedAt": "2026-08-22T13:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 2170,
      "comments": 86,
      "shares": 154
    }
  },
  {
    "id": "p027",
    "platform": "x",
    "brand": "AX아카데미",
    "handle": "@ax_academy",
    "url": "https://example.invalid/x/ax_academy/p027",
    "text": "AX아카데미 4월 슈퍼유저 과정, 얼리버드 30% 할인 오늘 자정 마감입니다. 30명 정원 중 5석 남았습니다. 놓치면 다음 기수는 7월입니다. 지금 등록 → 프로필 링크",
    "formatHint": "text",
    "postedAt": "2026-08-05T11:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 2575,
      "comments": 117,
      "shares": 238
    }
  },
  {
    "id": "p028",
    "platform": "youtube",
    "brand": "AX아카데미",
    "handle": "@ax_academy",
    "url": "https://example.invalid/youtube/ax_academy/p028",
    "text": "AI 도입 늦추면 팀이 겪게 될 3가지 손실\n\n00:00 인트로\n01:20 손실 1 - 경쟁사 대비 벌어지는 생산성 격차\n03:40 손실 2 - 신입은 AI로 배우고 기존 직원은 그대로인 역량 단절\n06:00 손실 3 - 나중에 몰아서 도입할 때 드는 두 배의 비용과 시간\n08:10 마무리\n\n이번 분기 AX아카데미 팀장 대상 무료 진단 상담은 이틀 뒤 마감됩니다. 늦기 전에 설명란 링크로 신청해보세요.",
    "formatHint": "long_video",
    "postedAt": "2026-07-20T09:00:00.000Z",
    "source": "sample",
    "metrics": {
      "views": 151304,
      "likes": 3184,
      "comments": 491
    }
  },
  {
    "id": "p029",
    "platform": "instagram",
    "brand": "데이터핏컨설팅",
    "handle": "@datafit_consulting",
    "url": "https://example.invalid/instagram/datafit_consulting/p029",
    "text": "실무에서 바로 쓰는 보고서 프롬프트, 카드뉴스로 정리했습니다. #프롬프트엔지니어링 #보고서작성 #AI실무",
    "slides": [
      "보고서 초안, AI로 10분 만에 뽑는 법",
      "1. 목적과 대상 독자를 먼저 명시하기",
      "2. 원하는 톤과 분량을 구체적으로 지정하기",
      "3. 예시 문장 하나를 넣어 스타일 학습시키기",
      "누적 수강생 2,400명이 검증한 프롬프트 템플릿",
      "실무자 평점 4.7/5, 재수강률 32%",
      "전체 템플릿은 프로필 링크에서 무료로 받아보세요"
    ],
    "formatHint": "card_news",
    "postedAt": "2026-07-03T17:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 13327,
      "comments": 452,
      "shares": 600
    }
  },
  {
    "id": "p030",
    "platform": "threads",
    "brand": "실무AI연구소",
    "handle": "@bizai_lab",
    "url": "https://example.invalid/threads/bizai_lab/p030",
    "text": "좋은 워크샵은 화려한 데모가 아니라 끝나고 남는 습관을 만듭니다. 저희는 3개월 뒤 다시 찾아가 실제로 업무에 적용됐는지 확인합니다.",
    "formatHint": "text",
    "postedAt": "2026-09-05T15:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 1848,
      "comments": 102,
      "shares": 215
    }
  },
  {
    "id": "p031",
    "platform": "x",
    "brand": "AX아카데미",
    "handle": "@ax_academy",
    "url": "https://example.invalid/x/ax_academy/p031",
    "text": "동료가 프롬프트 하나로 3시간 걸릴 일을 20분 만에 끝내는 동안, 아직도 검색창에 키워드만 입력하고 계신가요? 6개월 뒤 격차는 되돌릴 수 없습니다.",
    "formatHint": "text",
    "postedAt": "2026-09-14T17:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 899,
      "comments": 135,
      "shares": 93
    }
  },
  {
    "id": "p032",
    "platform": "youtube",
    "brand": "프롬프트스쿨",
    "handle": "@promptschool_kr",
    "url": "https://example.invalid/youtube/promptschool_kr/p032",
    "text": "프롬프트 한 줄의 차이 #shorts\n\n같은 질문이라도 어떻게 묻느냐에 따라 결과물의 품질이 완전히 달라집니다. 프롬프트스쿨은 그 한 줄을 다루는 법을 가르칩니다. 관심 있으시면 설명란을 확인해보세요.",
    "formatHint": "short_video",
    "postedAt": "2026-07-13T09:00:00.000Z",
    "source": "sample",
    "metrics": {
      "views": 273752,
      "likes": 4021,
      "comments": 133
    }
  },
  {
    "id": "p033",
    "platform": "instagram",
    "brand": "오토메이트랩",
    "handle": "@automatelab",
    "url": "https://example.invalid/instagram/automatelab/p033",
    "text": "요즘 저희가 진행하는 워크샵은 이렇게 구성됩니다.\n\n1일차는 업무 프로세스 매핑, 2일차는 자동화 툴 실습, 3일차는 팀별 파일럿 발표로 마무리됩니다. 이론보다는 직접 만들어보는 시간이 훨씬 많아요. 참고 자료는 워크샵 종료 후 전원에게 공유됩니다. #AX워크샵 #업무자동화",
    "formatHint": "short_video",
    "postedAt": "2026-07-30T11:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 5335,
      "comments": 483,
      "shares": 108
    }
  },
  {
    "id": "p034",
    "platform": "threads",
    "brand": "팀AI워크스",
    "handle": "@teamai_works",
    "url": "https://example.invalid/threads/teamai_works/p034",
    "text": "오늘 회의록 정리하는 데 얼마나 걸리셨어요?\n\n저희 수강생 320명 중 70%가 워크샵 2주 만에 회의록 자동 요약을 업무에 적용했다고 답했어요. 어렵지 않아요, 방법을 몰랐을 뿐이에요.",
    "formatHint": "text",
    "postedAt": "2026-08-15T13:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 3761,
      "comments": 110,
      "shares": 20
    }
  },
  {
    "id": "p035",
    "platform": "x",
    "brand": "데이터핏컨설팅",
    "handle": "@datafit_consulting",
    "url": "https://example.invalid/x/datafit_consulting/p035",
    "text": "1/ 국내 중소기업 240곳 데이터로 확인한 자동화 효과.\n2/ 반복 업무 자동화 도입 기업의 평균 업무 처리 시간 -35%.\n3/ 도입 3개월 내 ROI 회수 기업 비율 61%.\n4/ 숫자는 거짓말하지 않습니다. 우리 팀도 가능할지 확인해보세요.",
    "formatHint": "thread",
    "postedAt": "2026-07-10T18:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 699,
      "comments": 6,
      "shares": 177
    }
  },
  {
    "id": "p036",
    "platform": "youtube",
    "brand": "오토메이트랩",
    "handle": "@automatelab",
    "url": "https://example.invalid/youtube/automatelab/p036",
    "text": "업무 자동화 도입 기업, 평균 업무시간 32% 단축했습니다\n\n00:00 배경 설명\n02:00 도입 전후 비교 데이터\n05:30 자동화 적용 업무 유형 TOP 5\n08:00 정리\n\n오토메이트랩과 함께 자동화를 도입한 120여 개 기업의 데이터를 분석한 결과, 평균적으로 반복 업무 시간이 32% 줄어든 것으로 나타났습니다. 자세한 데이터는 영상에서 확인하세요.",
    "formatHint": "long_video",
    "postedAt": "2026-07-27T10:00:00.000Z",
    "source": "sample",
    "metrics": {
      "views": 248930,
      "likes": 4595,
      "comments": 294
    }
  },
  {
    "id": "p037",
    "platform": "instagram",
    "brand": "AX아카데미",
    "handle": "@ax_academy",
    "url": "https://example.invalid/instagram/ax_academy/p037",
    "text": "우리 팀 AI 도입 준비, 체크리스트로 확인해보세요. #AI도입체크리스트 #팀워크샵",
    "slides": [
      "우리 팀, AI 도입할 준비 되어있을까요?",
      "체크리스트 1: 반복 업무가 문서화되어 있나요?",
      "체크리스트 2: 데이터가 한 곳에 정리되어 있나요?",
      "체크리스트 3: 실무자가 직접 툴을 다룰 수 있나요?",
      "지금까지 96개 기업이 이 체크리스트로 시작했습니다",
      "3개 이상 '아니오'라면 진단부터 필요해요",
      "댓글에 '진단' 남겨주시면 체크리스트 전체본 DM 드립니다"
    ],
    "formatHint": "card_news",
    "postedAt": "2026-08-12T13:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 4257,
      "comments": 516,
      "shares": 289
    }
  },
  {
    "id": "p038",
    "platform": "threads",
    "brand": "프롬프트스쿨",
    "handle": "@promptschool_kr",
    "url": "https://example.invalid/threads/promptschool_kr/p038",
    "text": "12월 워크샵, 남은 자리 확인하세요\n\n마감 임박, 서두르셔야 합니다.",
    "slides": [
      "누적 참여 기업 150곳 돌파",
      "평균 만족도 4.8 / 5.0",
      "12월 기수 정원 15팀 중 12팀 마감",
      "남은 자리 3팀, 이번 주 내 마감 예상",
      "신청은 프로필 링크에서"
    ],
    "formatHint": "card_news",
    "postedAt": "2026-08-29T15:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 3438,
      "comments": 126,
      "shares": 80
    }
  },
  {
    "id": "p039",
    "platform": "x",
    "brand": "오토메이트랩",
    "handle": "@automatelab",
    "url": "https://example.invalid/x/automatelab/p039",
    "text": "AI 도구는 넘쳐나는데, 왜 우리 팀 업무는 하나도 안 바뀔까요? 도구가 아니라 '워크플로우'가 문제일 수도 있습니다.",
    "formatHint": "text",
    "postedAt": "2026-07-24T10:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 500,
      "comments": 15,
      "shares": 261
    }
  },
  {
    "id": "p040",
    "platform": "youtube",
    "brand": "팀AI워크스",
    "handle": "@teamai_works",
    "url": "https://example.invalid/youtube/teamai_works/p040",
    "text": "우리 팀도 AI 워크샵 필요할까요? #shorts\n\n팀원들이 각자 다른 툴을 쓰고 있다면, 서로 결과물을 공유해도 이해가 안 된다면, 이미 워크샵이 필요한 신호입니다. 별점 4.9, 리뷰 312개를 받은 팀AI워크스 워크샵이 궁금하시면 댓글에 '워크샵'이라고 남겨주세요. DM으로 커리큘럼 보내드립니다.",
    "formatHint": "short_video",
    "postedAt": "2026-08-10T12:00:00.000Z",
    "source": "sample",
    "metrics": {
      "views": 224108,
      "likes": 5168,
      "comments": 456
    }
  },
  {
    "id": "p041",
    "platform": "instagram",
    "brand": "데이터핏컨설팅",
    "handle": "@datafit_consulting",
    "url": "https://example.invalid/instagram/datafit_consulting/p041",
    "text": "국내 중견기업 300곳 데이터를 분석한 결과, AI 전환에 성공한 조직의 공통점은 '기술'이 아니라 '데이터 정리 방식'이었습니다.\n\n도구를 먼저 고르기 전에, 우리 조직의 데이터가 어떻게 흐르고 있는지부터 살펴보세요. 데이터핏은 그 지점에서 시작합니다. #데이터전략 #AI전환컨설팅",
    "formatHint": "image",
    "postedAt": "2026-08-26T13:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 917,
      "comments": 77,
      "shares": 599
    }
  },
  {
    "id": "p042",
    "platform": "threads",
    "brand": "실무AI연구소",
    "handle": "@bizai_lab",
    "url": "https://example.invalid/threads/bizai_lab/p042",
    "text": "'우리 회사는 데이터가 부족해서 AI 도입이 어렵다' — 컨설팅 다니면서 제일 많이 듣는 말입니다.\n\n근데 실제로 진단해보면 데이터가 없는 게 아니라 흩어져서 못 쓰는 경우가 대부분이에요. 엑셀 47개 파일에 나눠져 있던 재고 데이터, 통합하니 바로 예측 모델이 돌아가더라고요.",
    "formatHint": "thread",
    "postedAt": "2026-08-09T11:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 2279,
      "comments": 170,
      "shares": 214
    }
  },
  {
    "id": "p043",
    "platform": "x",
    "brand": "AX아카데미",
    "handle": "@ax_academy",
    "url": "https://example.invalid/x/ax_academy/p043",
    "text": "AI 도입, 이 순서대로만 하면 됩니다",
    "slides": [
      "1단계: 반복 업무 리스트업",
      "2단계: 데이터 정리 상태 점검",
      "3단계: 우선순위 업무 선정",
      "4단계: 소규모 파일럿 실행",
      "5단계: 결과 측정 후 확산",
      "순서를 건너뛰면 대부분 실패합니다."
    ],
    "formatHint": "card_news",
    "postedAt": "2026-07-10T18:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 281,
      "comments": 17,
      "shares": 238
    }
  },
  {
    "id": "p044",
    "platform": "youtube",
    "brand": "프롬프트스쿨",
    "handle": "@promptschool_kr",
    "url": "https://example.invalid/youtube/promptschool_kr/p044",
    "text": "\"우리 회사는 AI 도입하기엔 너무 작다\"는 오해\n\n00:00 인트로 - 흔한 오해\n01:45 반례 - 직원 12명 회사의 AI 활용 사례\n04:30 작은 회사일수록 유리한 이유\n06:50 이번 분기 한정 컨설팅 안내\n\n규모가 작을수록 오히려 의사결정 속도가 빨라 AI 도입 효과가 더 크게 나타나는 경우가 많습니다. 이번 분기 한정으로 소규모 기업 대상 무료 진단 컨설팅을 진행합니다. 지금 상담 신청해보세요.",
    "formatHint": "long_video",
    "postedAt": "2026-09-11T15:00:00.000Z",
    "source": "sample",
    "metrics": {
      "views": 184453,
      "likes": 5577,
      "comments": 491
    }
  },
  {
    "id": "p045",
    "platform": "instagram",
    "brand": "오토메이트랩",
    "handle": "@automatelab",
    "url": "https://example.invalid/instagram/automatelab/p045",
    "text": "AI 교육, 신입만 들으면 된다는 착각이 조직 전체의 속도를 늦춥니다. #AI교육 #팀장워크샵 #조직전환",
    "slides": [
      "AI 교육은 젊은 직원만 들으면 된다?",
      "❌ 통념: 신입/주니어만 배우면 조직 전체가 바뀐다",
      "✅ 현실: 의사결정권 있는 팀장이 모르면 실행이 막힌다",
      "저희 워크샵 참가자의 61%가 팀장급 이상입니다",
      "이번 기수는 팀장 전용 트랙 별도 운영",
      "정원 15명 중 11명 마감, 이번 주까지만 접수",
      "지금 신청 마감 임박, 프로필 링크 확인하세요"
    ],
    "formatHint": "card_news",
    "postedAt": "2026-08-12T12:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 1995,
      "comments": 44,
      "shares": 418
    }
  },
  {
    "id": "p046",
    "platform": "threads",
    "brand": "팀AI워크스",
    "handle": "@teamai_works",
    "url": "https://example.invalid/threads/teamai_works/p046",
    "text": "워크샵 첫날 '저는 컴맹이라 못 따라갈 것 같아요' 하시던 분이 계셨어요.\n\n3주 뒤 그분이 팀 내 AI 전도사가 되어있더라고요. 저희 수강생 후기 평점 4.9, 궁금하시면 프로필 링크에서 후기 더 보실 수 있어요.",
    "formatHint": "text",
    "postedAt": "2026-07-26T10:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 2601,
      "comments": 154,
      "shares": 154
    }
  },
  {
    "id": "p047",
    "platform": "x",
    "brand": "데이터핏컨설팅",
    "handle": "@datafit_consulting",
    "url": "https://example.invalid/x/datafit_consulting/p047",
    "text": "'AI 교육은 젊은 직원한테나 필요하다'는 건 오해입니다. 저희 워크샵 수강생 평균 연령은 41세, 부서장급이 62%입니다. 댓글에 '진단'이라고 남기시면 DM으로 무료 업무 진단표 보내드립니다.",
    "formatHint": "text",
    "postedAt": "2026-09-14T16:00:00.000Z",
    "source": "sample",
    "metrics": {
      "likes": 481,
      "comments": 8,
      "shares": 153
    }
  },
  {
    "id": "p048",
    "platform": "youtube",
    "brand": "실무AI연구소",
    "handle": "@bizai_lab",
    "url": "https://example.invalid/youtube/bizai_lab/p048",
    "text": "챗GPT로 보고서 초안 5분 만에 뽑는 법 #shorts\n\n주간 보고서 쓸 때마다 시간 잡아먹히시나요? 지난주 데이터만 넣으면 5분 만에 초안이 나오는 프롬프트 템플릿, 오늘 영상에서 바로 보여드립니다. 따라 해보시고 얼마나 빨라졌는지 댓글로 알려주세요.",
    "formatHint": "short_video",
    "postedAt": "2026-08-28T14:00:00.000Z",
    "source": "sample",
    "metrics": {
      "views": 209275,
      "likes": 5004,
      "comments": 329
    }
  }
];
