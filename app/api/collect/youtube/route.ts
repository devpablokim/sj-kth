/**
 * GET /api/collect/youtube?q=검색어&max=24 — YouTube 실제 영상 수집 (YOUTUBE_API_KEY 필요).
 */
import { collectYoutube, youtubeApiKey } from "@/lib/collect/youtube";
import type { CollectResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
  const max = Math.max(1, Math.min(48, Number(url.searchParams.get("max") ?? 24) || 24));
  if (!q) return Response.json({ error: "검색어(q)가 필요합니다." }, { status: 400 });
  if (!youtubeApiKey()) {
    return Response.json(
      { error: "YOUTUBE_API_KEY 가 설정되지 않았습니다. Google Cloud Console 에서 YouTube Data API v3 키를 만들어 환경변수에 넣으세요." },
      { status: 400 },
    );
  }
  try {
    const posts = await collectYoutube(q, max, req.signal);
    const body: CollectResponse = { posts, source: "youtube", query: q };
    return Response.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message.split("\n")[0].slice(0, 300) : "수집 실패";
    return Response.json({ error: message }, { status: 502 });
  }
}
