/**
 * 데모 모드용 결정적 가짜 판정 — 관문 · 구조 · 재검사 · 시안 심사 (gateway 호출 없음).
 * lib/demoJudge.ts 의 seededRandom 을 써서 같은 입력이면 항상 같은 결과가 나옵니다.
 */
import type { Judgement, Post, PostFormat, QuestionId } from "./types";
import type { RawAnswer, Usage } from "./jev";
import { demoJudge, seededRandom } from "./demoJudge";

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error("aborted"));
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(signal?.reason ?? new Error("aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function usageFor(text: string, questions: number): Usage {
  return { inputTokens: Math.round(text.length * 0.6) + 120 * questions, outputTokens: 0 };
}

function normalize(weights: Record<string, number>): Record<string, number> {
  const sum = Object.values(weights).reduce((a, b) => a + Math.max(b, 0.01), 0);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) out[k] = Math.round((Math.max(v, 0.01) / sum) * 100) / 100;
  return out;
}

function argmax(p: Record<string, number>): string {
  return Object.entries(p).sort((a, b) => b[1] - a[1])[0][0];
}

const MARKETING_WORDS = /신청|문의|할인|모집|오픈|출시|이벤트|무료|강의|교육|컨설팅|워크샵|워크숍|세미나|DM|링크|프로필|댓글/;
const PERSONAL_WORDS = /오늘|어제|주말|기분|먹|여행|우리 아이|남편|아내|친구|ㅋㅋ|ㅠㅠ/;

/** 관문: 카테고리 단어 겹침 + 마케팅 표현으로 관련성/성격을 추정 */
export async function demoGate(post: Post, category: string, signal?: AbortSignal) {
  const started = performance.now();
  await sleep(60 + Math.round(seededRandom(`gate:${post.id}`)() * 60), signal);
  const rand = seededRandom(`gatep:${post.id}`);
  const text = `${post.text} ${(post.slides ?? []).join(" ")}`.toLowerCase();
  const catWords = category
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2);
  const overlap = catWords.filter((w) => text.includes(w)).length;
  const base = catWords.length ? overlap / catWords.length : 0.5;
  const marketing = MARKETING_WORDS.test(post.text);
  const personal = PERSONAL_WORDS.test(post.text) && !marketing;
  const relevant = Math.max(0.03, Math.min(0.97, base * 0.7 + (marketing ? 0.2 : 0) + rand() * 0.15 + (post.source === "sample" || post.generated ? 0.3 : 0)));
  const kindProbs = normalize({
    marketing: marketing ? 0.6 : 0.15,
    educational: /방법|이유|정리|가이드|팁|알려/.test(post.text) ? 0.35 : 0.15,
    personal: personal ? 0.5 : 0.05,
    news: /발표|보도|기자|출시했다/.test(post.text) ? 0.25 : 0.05,
    spam: /카지노|대출|토토/.test(post.text) ? 0.8 : 0.02,
    uncertain: 0.08,
  });
  const answers: { relevant: RawAnswer; kind: RawAnswer } = {
    relevant: { type: "boolean", probability: Math.round(relevant * 100) / 100 },
    kind: { type: "choice", choice: argmax(kindProbs), probabilities: kindProbs },
  };
  return { answers, usage: usageFor(text, 2), latencyMs: Math.round(performance.now() - started) };
}

/** 구조: 형식별 옵션 중 텍스트 단서로 하나를 고름 */
export async function demoStructure(post: Post, format: PostFormat, options: string[], signal?: AbortSignal) {
  const started = performance.now();
  await sleep(50 + Math.round(seededRandom(`struct:${post.id}`)() * 50), signal);
  const rand = seededRandom(`structp:${post.id}:${format}`);
  const weights: Record<string, number> = {};
  for (const o of options) weights[o] = 0.05 + rand() * 0.2;
  const t = post.text;
  const boost = (k: string, v: number) => {
    if (k in weights) weights[k] += v;
  };
  if (/\d+\s*가지|\d+\./.test(t)) {
    boost("list", 0.5);
    boost("listicle", 0.5);
  }
  if (/후기|사례|이야기|경험/.test(t)) {
    boost("story", 0.4);
    boost("testimonial", 0.4);
    boost("case_study", 0.4);
  }
  if (/모집|신청|오픈|마감/.test(t)) {
    boost("announcement", 0.5);
    boost("poster", 0.4);
  }
  if (/\?/.test(t)) boost("qna", 0.3);
  if (/방법|하는 법|가이드|단계/.test(t)) {
    boost("how_to", 0.4);
    boost("tutorial", 0.4);
    boost("lecture", 0.3);
  }
  const probs = normalize(weights);
  const answer: RawAnswer = { type: "choice", choice: argmax(probs), probabilities: probs };
  return { answer, usage: usageFor(t, 1), latencyMs: Math.round(performance.now() - started) };
}

/** 재검사: 데모 판정은 결정적이라 원래 답을 다시 돌려주되, 확신도가 아주 낮은 질문은 1/4 확률로 흔들림을 흉내냄 */
export async function demoRecheck(post: Post, first: Record<QuestionId, Judgement>, ids: QuestionId[], signal?: AbortSignal) {
  const started = performance.now();
  await sleep(60 + Math.round(seededRandom(`recheck:${post.id}`)() * 60), signal);
  const again = demoJudge(post).answers;
  const rand = seededRandom(`recheckp:${post.id}`);
  const answers: Record<string, RawAnswer> = {};
  for (const id of ids) {
    const j = again[id] ?? first[id];
    if (j.type === "choice") {
      const ps = j.probabilities ? Object.entries(j.probabilities).sort((a, b) => b[1] - a[1]) : [];
      const margin = ps.length >= 2 ? ps[0][1] - ps[1][1] : 1;
      const flip = margin < 0.15 && rand() < 0.25 && ps.length >= 2;
      answers[id] = { type: "choice", choice: flip ? ps[1][0] : j.choice, probabilities: j.probabilities };
    } else if (j.type === "boolean") {
      const flip = Math.abs(j.probability - 0.5) < 0.08 && rand() < 0.25;
      answers[id] = { type: "boolean", probability: flip ? 1 - j.probability : j.probability };
    } else {
      answers[id] = { type: "score", score: j.score, probabilities: j.probabilities };
    }
  }
  return { answers, usage: usageFor(post.text, ids.length), latencyMs: Math.round(performance.now() - started) };
}

/** 시안 심사: 위험 단어 휴리스틱 + 시드 */
export function demoReview(draftText: string, positioning: string, seedKey: string) {
  const rand = seededRandom(`review:${seedKey}`);
  const risky = /최고|1위|유일|100%|보장|무조건|확실히|반드시 성공/.test(draftText);
  const unsafe = /멍청|바보|저능|혐오|비하/.test(draftText);
  const contradict = /대신 다 해|맡기기만|알아서 해드/.test(draftText) && /직접|내재화|우리 팀/.test(positioning);
  return {
    brand_safety: { type: "boolean" as const, probability: unsafe ? 0.2 : 0.9 + rand() * 0.08 },
    claim_risk: { type: "boolean" as const, probability: risky ? 0.75 + rand() * 0.2 : 0.08 + rand() * 0.2 },
    audience_match: { type: "boolean" as const, probability: 0.7 + rand() * 0.25 },
    contradicts_positioning: { type: "boolean" as const, probability: contradict ? 0.7 : 0.05 + rand() * 0.2 },
    quality: { type: "score" as const, score: 1.8 + rand() * 1.1, probabilities: { "0": 0.02, "1": 0.18, "2": 0.5, "3": 0.3 } },
  };
}
