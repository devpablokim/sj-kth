/**
 * 카테고리 기준 벤치마크 "예시 세트" 생성 (서버 전용, LIVE 모드 전용).
 * 사용자가 입력한 카테고리·경쟁 브랜드를 참고해 텍스트 모델이 플랫폼별로 벤치마크 스타일 포스트를 만듭니다.
 * 결과는 실제 게시물이 아니므로 모든 포스트에 generated: true / source: "generated" 를 붙입니다.
 */
import { generateObject } from "ai";
import { z } from "zod";
import type { GenerateSetRequest, GenerateSetResponse, Platform, Post, PostFormat } from "./types";
import { draftModelId } from "./env";
import { costFor, loadPricing } from "./pricing";

const ALL_PLATFORMS: Platform[] = ["instagram", "threads", "x", "youtube"];

const setSchema = z.object({
  posts: z
    .array(
      z.object({
        brand: z.string().min(1).max(40),
        handle: z.string().min(1).max(40).describe("@로 시작하는 계정명 (영문/숫자/밑줄)"),
        format: z.enum(["card_news", "short_video", "long_video", "text", "thread", "image"]),
        text: z.string().min(20).max(900).describe("캡션/본문. 유튜브는 '제목\\n\\n설명' 형식"),
        slides: z.array(z.string().max(160)).max(8).nullable().optional().describe("card_news 일 때만 4~7장, 아니면 빈 배열"),
      }),
    )
    .min(1)
    .max(16),
});

const PLATFORM_GUIDE: Record<Platform, string> = {
  instagram: "인스타그램: 카드뉴스(슬라이드 5~7장, 1장은 커버 훅, 마지막은 CTA) 약 절반, 나머지는 릴스 캡션(short_video) 또는 단일 이미지 캡션. 해시태그 2~4개.",
  threads: "스레드: 짧은 구어체 텍스트 또는 카드뉴스. 통념을 뒤집는 한 줄, 질문형 훅, 경험담이 잘 먹힘.",
  x: "X(트위터): 280자 내외 텍스트 또는 '1/ 2/ 3/' 형식의 스레드(thread). 숫자·리스트 훅, 강한 주장.",
  youtube: "유튜브: '제목\\n\\n설명' 형식. 쇼츠(short_video, #shorts 포함)와 롱폼(long_video, 타임스탬프 포함 설명) 섞기.",
};

function buildPrompt(req: GenerateSetRequest, platform: Platform, n: number, brands: string[]): { system: string; prompt: string } {
  const system = [
    "당신은 한국 마케팅 콘텐츠 분석가입니다. 특정 카테고리의 경쟁사/벤치마크 브랜드가 실제로 올릴 법한 마케팅 포스트를",
    "'예시'로 만듭니다. 목적은 훅 유형·CTA·사회적 증거·긴급성·톤이 다양하게 섞인 벤치마크 세트를 만드는 것입니다.",
    "규칙: (1) 훅 유형을 골고루 — 질문 / 숫자·통계 / 통념 반박 / 스토리 / 하우투 / 공지·할인 / 손실 자극 / 훅 없음.",
    "(2) CTA 강도를 골고루 — 없음부터 '댓글에 X 남기면 DM' · '오늘 자정 마감' 같은 매우 강함까지.",
    "(3) 약 40%에 사회적 증거(수강생 수, 별점, 도입 기업 수 등), 약 30%에 긴급성 장치.",
    "(4) 톤을 섞기 — 전문적 / 친근한 / 과감한 / 설명형 / 유쾌한 / 고급스러운.",
    "(5) 실제 인물·실제 사건·허위 사실 금지. 수치는 그럴듯한 범위의 예시값. 한국어.",
    "(6) 각 포스트는 서로 다른 소재를 다루고, 브랜드를 순환하며 배정.",
  ].join("\n");
  const prompt = JSON.stringify(
    {
      카테고리: req.brand.category,
      참고_우리브랜드: { 이름: req.brand.name, 핵심_메시지: req.brand.positioning, 주의: "우리 브랜드의 포스트는 만들지 말 것 — 경쟁/벤치마크 브랜드의 포스트만" },
      사용할_브랜드명: brands,
      플랫폼: platform,
      플랫폼_가이드: PLATFORM_GUIDE[platform],
      개수: n,
      출력: "posts 배열. 각 항목: brand, handle, format, text, (card_news 이면 slides)",
    },
    null,
    1,
  );
  return { system, prompt };
}

function fallbackBrands(category: string): string[] {
  const base = category.replace(/\s+/g, "").slice(0, 6) || "벤치";
  return [`${base}랩`, `${base}스쿨`, `${base}클럽`, `${base}웍스`, `${base}팩토리`, `${base}플러스`].slice(0, 6);
}

function toHandle(h: string, brand: string): string {
  const cleaned = h.replace(/^@/, "").replace(/[^A-Za-z0-9_.]/g, "").slice(0, 30);
  return `@${cleaned || brand.replace(/[^A-Za-z0-9]/g, "").toLowerCase() || "brand"}`;
}

export async function generateBenchmarkSet(req: GenerateSetRequest, signal?: AbortSignal): Promise<GenerateSetResponse> {
  const started = performance.now();
  const model = draftModelId();
  const platforms = req.platforms?.length ? req.platforms : ALL_PLATFORMS;
  const count = Math.max(4, Math.min(48, Math.round(req.count)));
  const perPlatform = Math.max(1, Math.round(count / platforms.length));
  const brands = (req.competitors ?? []).map((c) => c.trim()).filter(Boolean).slice(0, 8);
  const brandNames = brands.length ? brands : fallbackBrands(req.brand.category);

  const chunks = await Promise.all(
    platforms.map(async (platform) => {
      const { system, prompt } = buildPrompt(req, platform, perPlatform, brandNames);
      const r = await generateObject({ model, schema: setSchema, system, prompt, abortSignal: signal, maxRetries: 1 });
      return { platform, posts: r.object.posts.slice(0, perPlatform), usage: r.usage, modelId: r.response.modelId };
    }),
  );

  const usage = { inputTokens: 0, outputTokens: 0 };
  const posts: Post[] = [];
  let idx = 0;
  for (const chunk of chunks) {
    usage.inputTokens += chunk.usage.inputTokens ?? 0;
    usage.outputTokens += chunk.usage.outputTokens ?? 0;
    for (const p of chunk.posts) {
      idx += 1;
      const id = `g${String(idx).padStart(3, "0")}`;
      const slides = (p.slides ?? []).map((t) => t.trim()).filter((t) => t.length >= 2);
      // 슬라이드가 4장 미만이면 카드뉴스로 볼 수 없으므로 형식을 보정
      const format: PostFormat = p.format === "card_news" && slides.length < 4 ? "image" : (p.format as PostFormat);
      posts.push({
        id,
        platform: chunk.platform,
        brand: p.brand,
        handle: toHandle(p.handle, p.brand),
        url: "",
        text: p.text,
        slides: format === "card_news" ? slides.slice(0, 7) : undefined,
        formatHint: format,
        source: "generated",
        generated: true,
      });
    }
  }
  // 플랫폼별 묶음을 섞어 모자이크가 고르게 보이도록 인터리브
  const byPlatform = new Map<Platform, Post[]>();
  for (const p of posts) byPlatform.set(p.platform, [...(byPlatform.get(p.platform) ?? []), p]);
  const interleaved: Post[] = [];
  const queues = [...byPlatform.values()];
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) interleaved.push(q.shift() as Post);

  const pricing = await loadPricing("live", model);
  const costUsd = costFor(usage, pricing);
  return {
    posts: interleaved.map((p, i) => ({ ...p, id: `g${String(i + 1).padStart(3, "0")}` })),
    model: chunks[0]?.modelId || model,
    usage,
    costUsd,
    latencyMs: Math.round(performance.now() - started),
    mode: "live",
  };
}
