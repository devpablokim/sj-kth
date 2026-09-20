/**
 * jev 활용 패턴 단위 테스트 — AI SDK 의 Mock 판정 모델(Experimental_EvaluationMockModelV4)로 gateway 없이 검증합니다.
 * 실행: npm test  (node:test + tsx)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Experimental_EvaluationMockModelV4 as MockEvaluationModel } from "ai/test";
import type { Post } from "../lib/types";
import { decideDraftReview, decideGate, evaluateGate, evaluateRecheck, evaluateStructure, sameAnswer } from "../lib/judge";
import { bandOf, benchmarkScore, confidenceOfAll, engagementOf } from "../lib/scoring";
import { readProviderConfidence } from "../lib/jev";
import { parseCompactNumber, relativeToIso } from "../lib/collect/http";
import { parseThreadsMarkdown } from "../lib/collect/threads";

const post: Post = {
  id: "t1",
  platform: "threads",
  brand: "테스트",
  handle: "@test",
  url: "https://www.threads.com/@test/post/abc",
  text: "AI 교육, 아직도 외주 맡기세요? 3주 만에 우리 팀이 직접 만드는 법. 댓글에 '신청' 남기면 가이드 DM",
  source: "collected",
};

type Answers = Record<string, { type: "boolean"; probability: number } | { type: "choice"; choice: string; probabilities: Record<string, number> } | { type: "score"; score: number; probabilities: Record<string, number> }>;

function mock(answers: Answers, confidence?: Record<string, number>) {
  return new MockEvaluationModel({
    doEvaluate: async () => ({
      answers,
      warnings: [],
      usage: { inputTokens: 300, outputTokens: 0 },
      response: { modelId: "jev-mock-1.0.0" },
      ...(confidence ? { providerMetadata: { typesafe: { confidence } } } : {}),
    }),
  });
}

test("decideGate: 관련성 높고 스팸 아니면 pass", () => {
  assert.equal(decideGate({ relevant: 0.9, kind: "marketing", spamProbability: 0.02, source: "collected" }).decision, "pass");
});

test("decideGate: 수집된 글은 관련성 낮으면 exclude, 붙여넣은 글은 review", () => {
  assert.equal(decideGate({ relevant: 0.1, kind: "personal", spamProbability: 0.02, source: "collected" }).decision, "exclude");
  assert.equal(decideGate({ relevant: 0.1, kind: "personal", spamProbability: 0.02, source: "pasted" }).decision, "review");
  assert.equal(decideGate({ relevant: 0.45, kind: "educational", spamProbability: 0.02, source: "collected" }).decision, "review");
  assert.equal(decideGate({ relevant: 0.9, kind: "spam", spamProbability: 0.8, source: "collected" }).decision, "exclude");
});

test("evaluateGate: mock 모델 답변 + provider confidence 를 GateResult 로 정규화", async () => {
  const model = mock(
    {
      relevant: { type: "boolean", probability: 0.88 },
      kind: { type: "choice", choice: "marketing", probabilities: { marketing: 0.8, educational: 0.15, personal: 0.02, news: 0.01, spam: 0.01, uncertain: 0.01 } },
    },
    { relevant: 0.9, kind: 0.7 },
  );
  const { gate, call } = await evaluateGate(post, "AI 전환 컨설팅 · 기업 AI 교육", "live", { model });
  assert.equal(gate.decision, "pass");
  assert.equal(gate.kind, "marketing");
  assert.ok(Math.abs(gate.confidence - 0.8) < 1e-9, "provider confidence 평균 (0.9+0.7)/2");
  assert.equal(call.model, "jev-mock-1.0.0");
  assert.equal(call.usage.inputTokens, 300);
});

test("evaluateStructure: format 별 옵션 밖의 답은 other 로", async () => {
  const model = mock({
    structure: { type: "choice", choice: "list", probabilities: { list: 0.7, story: 0.2, before_after: 0.02, checklist: 0.02, qna: 0.02, announcement: 0.02, other: 0.02 } },
  });
  const { structure, call } = await evaluateStructure(post, "card_news", "live", { model });
  assert.equal(structure.choice, "list");
  assert.equal(structure.format, "card_news");
  assert.ok(Math.abs(structure.confidence - 0.5) < 1e-9, "1위-2위 확률차");
  const req = call.request as { questions: { structure: { criteria: Record<string, string> } } };
  assert.ok("before_after" in req.questions.structure.criteria, "card_news 전용 옵션 집합");
  const model2 = mock({ structure: { type: "choice", choice: "opinion", probabilities: { listicle: 0.1, story: 0.1, opinion: 0.6, announcement: 0.1, qna: 0.05, other: 0.05 } } });
  const r2 = await evaluateStructure(post, "text", "live", { model: model2 });
  assert.equal(r2.structure.choice, "opinion");
  assert.equal(r2.structure.format, "text");
});

test("evaluateRecheck: 답이 바뀐 질문을 disagreements 로", async () => {
  const FORMAT_P = { card_news: 0.01, short_video: 0.01, long_video: 0.01, text: 0.5, thread: 0.46, image: 0.01 };
  const HOOK_P = { question: 0.86, number: 0.02, contrarian: 0.02, story: 0.02, how_to: 0.02, announcement: 0.02, fear: 0.02, none: 0.02 };
  const first = {
    format: { type: "choice" as const, choice: "text", probabilities: FORMAT_P },
    hook_type: { type: "choice" as const, choice: "question", probabilities: HOOK_P },
    make_draft: { type: "boolean" as const, probability: 0.55 },
  };
  const model = mock({
    format: { type: "choice", choice: "thread", probabilities: { ...FORMAT_P, text: 0.4, thread: 0.56 } },
    hook_type: { type: "choice", choice: "question", probabilities: HOOK_P },
    make_draft: { type: "boolean", probability: 0.4 },
  });
  const { recheck } = await evaluateRecheck(post, first as never, "live", { model });
  assert.equal(recheck.agreed, false);
  assert.deepEqual(recheck.disagreements, ["format", "make_draft"]);
  assert.equal(sameAnswer({ type: "boolean", probability: 0.6 }, { type: "boolean", probability: 0.9 }), true);
});

test("decideDraftReview: 위험도별 approve / review / block", () => {
  const ok = decideDraftReview({ brandSafety: 0.95, claimRisk: 0.1, audienceMatch: 0.9, contradictsPositioning: 0.05, quality: 2.6, qualityMax: 3 });
  assert.equal(ok.decision, "approve");
  const rv = decideDraftReview({ brandSafety: 0.95, claimRisk: 0.5, audienceMatch: 0.9, contradictsPositioning: 0.05, quality: 2.6, qualityMax: 3 });
  assert.equal(rv.decision, "review");
  const bl = decideDraftReview({ brandSafety: 0.3, claimRisk: 0.1, audienceMatch: 0.9, contradictsPositioning: 0.05, quality: 2.6, qualityMax: 3 });
  assert.equal(bl.decision, "block");
  const bl2 = decideDraftReview({ brandSafety: 0.95, claimRisk: 0.85, audienceMatch: 0.9, contradictsPositioning: 0.05, quality: 2.6, qualityMax: 3 });
  assert.equal(bl2.decision, "block");
});

test("scoring: 확신도 구간 · 프리셋 가중치 · 반응 지표", () => {
  const t = { auto: 0.65, review: 0.4 };
  assert.equal(bandOf(0.8, t), "auto");
  assert.equal(bandOf(0.5, t), "review");
  assert.equal(bandOf(0.2, t), "uncertain");
  const answers = {
    format: { type: "choice" as const, choice: "text" },
    hook_type: { type: "choice" as const, choice: "question" },
    cta_strength: { type: "score" as const, score: 4, max: 4 },
    pain_point: { type: "boolean" as const, probability: 1 },
    social_proof: { type: "boolean" as const, probability: 0 },
    urgency: { type: "boolean" as const, probability: 1 },
    tone: { type: "choice" as const, choice: "friendly" },
    clarity: { type: "score" as const, score: 2, max: 4 },
    imitability: { type: "score" as const, score: 0, max: 4 },
    make_draft: { type: "boolean" as const, probability: 0 },
  };
  // imitate: cta 15 + pain 10 + urgency 5 + clarity 7.5 = 37.5 → 38 ; convert: cta 30 + pain 20 + urgency 10 + clarity 7.5 = 67.5 → 68
  assert.equal(benchmarkScore(answers, "imitate"), 38);
  assert.equal(benchmarkScore(answers, "convert"), 68);
  assert.ok(benchmarkScore(answers, "engagement", { likes: 50_000, comments: 2_000 }) > benchmarkScore(answers, "engagement", { likes: 3 }));
  assert.equal(engagementOf(undefined), 0);
  assert.ok(Math.abs(confidenceOfAll({ a: { type: "boolean", probability: 0.9 } }, { a: 0.42 }) - 0.42) < 1e-9, "provider confidence 우선");
  assert.deepEqual(readProviderConfidence({ typesafe: { confidence: { x: 0.5, y: "no" } } }), { x: 0.5 });
});

test("collect utils: compact numbers · relative dates · threads markdown", () => {
  assert.equal(parseCompactNumber("1.6K"), 1600);
  assert.equal(parseCompactNumber("815K likes"), 815000);
  assert.equal(parseCompactNumber("조회수 1.3천회"), 1300);
  assert.equal(parseCompactNumber("조회수 2,259회"), 2259);
  assert.equal(parseCompactNumber("1.2만"), 12000);
  const now = new Date("2026-09-20T00:00:00Z");
  assert.equal(relativeToIso("2d", now), "2026-09-18T00:00:00.000Z");
  assert.equal(relativeToIso("01/20/26", now), "2026-01-20T00:00:00.000Z");
  assert.equal(relativeToIso("3개월 전", now)?.slice(0, 7), "2026-06");
  const md = [
    "[![Image 1: acme's profile picture](https://x/pic.jpg)](https://www.threads.com/@acme)",
    "",
    "[acme](https://www.threads.com/@acme)",
    "",
    "[2d](https://www.threads.com/@acme/post/AbC123)",
    "",
    "지난 1달 동안",
    "",
    "3",
    "",
    "번 출강했습니다.",
    "",
    "![Image 2](https://x/a.jpg)",
    "",
    "12",
    "",
    "3",
    "",
    "1",
    "",
    "0",
    "",
    "[![Image 3: other's profile picture](https://x/pic2.jpg)](https://www.threads.com/@other)",
    "",
    "[other](https://www.threads.com/@other)",
    "",
    "[1d](https://www.threads.com/@other/post/XyZ)",
    "",
    "답글입니다",
    "",
    "5",
    "",
    "1",
  ].join("\n");
  const items = parseThreadsMarkdown(md, now);
  assert.equal(items.length, 2);
  assert.equal(items[0].code, "AbC123");
  assert.equal(items[0].text, "지난 1달 동안 3 번 출강했습니다.");
  assert.deepEqual([items[0].likes, items[0].replies, items[0].reposts, items[0].shares], [12, 3, 1, 0]);
  assert.equal(items[0].images.length, 1);
  assert.equal(items[1].text, "답글입니다");
  assert.deepEqual([items[1].likes, items[1].replies], [5, 1]);
});

test("instagram/threads og 파싱: 영어·한국어 로케일", async () => {
  const { parseInstagramOg } = await import("../lib/collect/instagram");
  const { threadsNameFromTitle } = await import("../lib/collect/threads");
  const en = parseInstagramOg('Instagram on Instagram: "the smile says it all"', '815K likes, 9,073 comments - instagram on September 18, 2026: "the smile says it all"');
  assert.deepEqual([en.name, en.handle, en.caption, en.likes, en.comments, en.dateText], ["Instagram", "instagram", "the smile says it all", 815000, 9073, "September 18, 2026"]);
  const ko = parseInstagramOg('Instagram의 Instagram님 : "the smile"', '817K likes, 9,097 comments - instagram - September 18, 2026: "the smile". ');
  assert.deepEqual([ko.name, ko.handle, ko.caption, ko.likes], ["Instagram", "instagram", "the smile", 817000]);
  assert.equal(threadsNameFromTitle("김공공 (@kim00gangsa) on Threads"), "김공공");
  assert.equal(threadsNameFromTitle("Threads의 김공공(@kim00gangsa)님"), "김공공");
});
