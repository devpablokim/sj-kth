/**
 * POST /api/collect — 무료 수집 (API 키 없이 공개 페이지·공개 엔드포인트만 사용).
 * body: CollectRequest { keywords, platforms, accounts, urls, max } → CollectResponse { posts, report, elapsedMs }
 * 경로별 성공/실패는 report 로 그대로 돌려주며, 전부 실패해도 200 + 빈 posts (화면에서 이유를 보여주기 위해).
 */
import type { CollectResponse } from "@/lib/types";
import { collectAll } from "@/lib/collect";
import { collectRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "본문이 올바른 JSON 이 아닙니다." }, { status: 400 });
  }
  const parsed = collectRequestSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    return Response.json({ error: "요청 형식 오류", issues }, { status: 400 });
  }
  const { keywords, accounts, urls, platforms } = parsed.data;
  if (keywords.length === 0 && accounts.length === 0 && urls.length === 0) {
    return Response.json({ error: "검색어, 계정, 게시물 URL 중 하나는 필요합니다." }, { status: 400 });
  }
  if (platforms.length === 0 && urls.length === 0) {
    return Response.json({ error: "플랫폼을 하나 이상 선택하세요." }, { status: 400 });
  }
  try {
    const body: CollectResponse = await collectAll(parsed.data, req.signal);
    return Response.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message.split("\n")[0].slice(0, 300) : "수집 실패";
    return Response.json({ error: message }, { status: 502 });
  }
}
