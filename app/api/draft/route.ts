/**
 * POST /api/draft — 포스트 1건 + 판정 결과로 우리 브랜드 시안을 만듭니다 (상세 보기의 "시안 만들기" 버튼).
 */
import { z } from "zod";
import type { CallLogEntry, DraftResponse, PostAnalysis } from "@/lib/types";
import { draftModelId, jevModelId, resolveMode } from "@/lib/env";
import { generateDraft } from "@/lib/drafts";
import { safeErrorMessage } from "@/lib/pipeline";
import { costFor, loadPricing } from "@/lib/pricing";
import { analysisSchema, brandSchema, postSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({
  post: postSchema,
  analysis: analysisSchema,
  brand: brandSchema,
  demo: z.boolean().optional(),
});

export async function POST(req: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "본문이 올바른 JSON 이 아닙니다." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "요청 형식 오류", issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  }
  if (parsed.data.post.id !== parsed.data.analysis.postId) {
    return Response.json({ error: "post.id 와 analysis.postId 가 다릅니다." }, { status: 400 });
  }
  const mode = resolveMode(parsed.data.demo);
  const analysis = parsed.data.analysis as PostAnalysis;
  try {
    const jevPricing = await loadPricing(mode, jevModelId());
    const draftPricing = mode === "live" ? await loadPricing(mode, draftModelId()) : jevPricing;
    const { draft, calls } = await generateDraft({ post: parsed.data.post, analysis, brand: parsed.data.brand, mode, signal: req.signal });
    const at = Date.now();
    const entries: CallLogEntry[] = calls.map((c, i) => ({
      id: `call_${at.toString(36)}_${i}`,
      tag: c.tag,
      postId: parsed.data.post.id,
      summary:
        c.tag === "draft"
          ? `${parsed.data.post.brand} → ${parsed.data.brand.name || "우리 브랜드"} · ${draft.headline.slice(0, 40)}`
          : `${parsed.data.post.brand} 시안 재판정 · match ${draft.matchScore}%`,
      request: c.request,
      response: c.response,
      latencyMs: c.latencyMs,
      usage: c.usage,
      costUsd: costFor(c.usage, c.model === draftPricing.modelId ? draftPricing : jevPricing),
      mode,
      model: c.model,
      at,
    }));
    const body: DraftResponse = { draft, calls: entries, mode };
    return Response.json(body);
  } catch (err) {
    return Response.json({ error: `시안 생성 실패: ${safeErrorMessage(err)}` }, { status: 500 });
  }
}
