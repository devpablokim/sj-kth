/**
 * GET /api/health — 모드(live/demo)와 사용 중인 모델 ID 를 알려줍니다.
 * 키 값 자체는 절대 반환하지 않습니다 (hasKey 불리언만).
 */
import { draftModelId, hasGatewayKey, jevModelId, resolveMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json({
    ok: true,
    mode: resolveMode(),
    jevModel: jevModelId(),
    draftModel: draftModelId(),
    hasKey: hasGatewayKey(),
  });
}
