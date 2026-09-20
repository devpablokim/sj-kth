/**
 * API 입력 검증용 zod 스키마 (서버 전용). analyze / draft / generate-set / collect 라우트가 공유합니다.
 */
import { z } from "zod";

export const platformSchema = z.enum(["x", "threads", "youtube", "instagram"]);
export const formatSchema = z.enum(["card_news", "short_video", "long_video", "text", "thread", "image"]);
export const sourceSchema = z.enum(["sample", "generated", "pasted", "youtube", "collected"]);

export const postSchema = z.object({
  id: z.string().min(1).max(64),
  platform: platformSchema,
  brand: z.string().min(1).max(80),
  handle: z.string().max(80).default(""),
  url: z.string().max(500).default(""),
  text: z.string().min(1).max(4000),
  slides: z.array(z.string().max(1000)).max(12).optional(),
  thumbnailUrl: z.string().max(1000).optional(),
  formatHint: formatSchema.optional(),
  postedAt: z.string().max(40).optional(),
  source: sourceSchema.optional(),
  generated: z.boolean().optional(),
  collectedVia: z.string().max(40).optional(),
  metrics: z
    .object({
      likes: z.number().nonnegative().optional(),
      comments: z.number().nonnegative().optional(),
      shares: z.number().nonnegative().optional(),
      views: z.number().nonnegative().optional(),
    })
    .optional(),
});

export const brandSchema = z.object({
  name: z.string().max(80).default(""),
  category: z.string().max(120).default(""),
  positioning: z.string().max(300).default(""),
});

const judgementSchema = z.union([
  z.object({ type: z.literal("boolean"), probability: z.number() }),
  z.object({ type: z.literal("choice"), choice: z.string(), probabilities: z.record(z.string(), z.number()).optional() }),
  z.object({
    type: z.literal("score"),
    score: z.number(),
    max: z.number(),
    probabilities: z.record(z.string(), z.number()).optional(),
  }),
]);

const usageSchema = z.object({ inputTokens: z.number().nonnegative(), outputTokens: z.number().nonnegative() });

const gateSchema = z.object({
  relevant: z.number().min(0).max(1),
  kind: z.enum(["marketing", "educational", "personal", "news", "spam", "uncertain"]),
  kindProbabilities: z.record(z.string(), z.number()).optional(),
  confidence: z.number().min(0).max(1),
  decision: z.enum(["pass", "review", "exclude"]),
  reason: z.string().max(200),
  latencyMs: z.number().nonnegative(),
  usage: usageSchema,
  costUsd: z.number().nonnegative(),
});

const structureSchema = z.object({
  choice: z.string().max(40),
  probabilities: z.record(z.string(), z.number()).optional(),
  confidence: z.number().min(0).max(1),
  format: formatSchema,
});

const recheckSchema = z.object({
  agreed: z.boolean(),
  disagreements: z.array(z.string().max(40)).max(10),
  latencyMs: z.number().nonnegative(),
});

/** 클라이언트가 되돌려주는 PostAnalysis (시안 생성 시 참고용) */
export const analysisSchema = z.object({
  postId: z.string().min(1).max(64),
  answers: z.record(z.string(), judgementSchema),
  latencyMs: z.number().nonnegative(),
  usage: usageSchema,
  costUsd: z.number().nonnegative(),
  benchmarkScore: z.number().min(0).max(100),
  summary: z.string().max(500),
  confidence: z.number().min(0).max(1),
  band: z.enum(["auto", "review", "uncertain"]).default("review"),
  providerConfidence: z.record(z.string(), z.number()).optional(),
  gate: gateSchema.optional(),
  structure: structureSchema.optional(),
  recheck: recheckSchema.optional(),
});

/** RunRequest.options — 모든 필드 선택 */
export const judgeOptionsSchema = z
  .object({
    gate: z.boolean().optional(),
    recheck: z.boolean().optional(),
    structure: z.boolean().optional(),
    preset: z.enum(["imitate", "convert", "engagement"]).optional(),
    thresholds: z.object({ auto: z.number().min(0).max(1), review: z.number().min(0).max(1) }).optional(),
  })
  .optional();

/** POST /api/collect 본문 */
export const collectRequestSchema = z.object({
  keywords: z.array(z.string().trim().min(1).max(80)).max(5).default([]),
  platforms: z.array(platformSchema).max(4).default(["youtube", "threads"]),
  accounts: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  urls: z.array(z.string().trim().min(8).max(500)).max(40).default([]),
  max: z.number().int().min(1).max(96).default(48),
});
