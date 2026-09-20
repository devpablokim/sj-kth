/**
 * POST /api/generate-set — 카테고리 기준 벤치마크 예시 세트 생성 (LIVE 모드 전용).
 * DEMO 모드(키 없음)에서는 400 을 돌려주고 gateway 를 호출하지 않습니다.
 */
import { z } from "zod";
import { resolveMode } from "@/lib/env";
import { generateBenchmarkSet } from "@/lib/generateSet";
import { safeErrorMessage } from "@/lib/pipeline";
import { brandSchema, platformSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({
  brand: brandSchema,
  competitors: z.array(z.string().max(40)).max(8).optional(),
  count: z.union([z.literal(12), z.literal(24), z.literal(48)]).default(24),
  platforms: z.array(platformSchema).min(1).max(4).optional(),
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
    return Response.json({ error: "요청 형식 오류", issues: parsed.error.issues.slice(0, 5).map((i) => i.message) }, { status: 400 });
  }
  if (!parsed.data.brand.category.trim()) {
    return Response.json({ error: "카테고리를 입력해야 예시 세트를 만들 수 있습니다." }, { status: 400 });
  }
  if (resolveMode() === "demo") {
    return Response.json(
      { error: "예시 세트 생성은 LIVE 모드에서만 가능합니다. AI_GATEWAY_API_KEY 를 설정하세요." },
      { status: 400 },
    );
  }
  try {
    const result = await generateBenchmarkSet(parsed.data, req.signal);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: `예시 세트 생성 실패: ${safeErrorMessage(err)}` }, { status: 500 });
  }
}
