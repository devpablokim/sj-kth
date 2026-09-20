/**
 * YouTube Data API v3 수집기 (서버 전용). YOUTUBE_API_KEY 가 있을 때만 동작합니다.
 * search.list(100 units) + videos.list(1 unit) 로 제목·설명·채널·조회수·좋아요·길이를 가져와 Post 로 변환합니다.
 */
import type { Post } from "../types";

const API = "https://www.googleapis.com/youtube/v3";

export function youtubeApiKey(): string | undefined {
  const k = process.env.YOUTUBE_API_KEY?.trim();
  return k ? k : undefined;
}

interface SearchItem {
  id?: { videoId?: string };
}
interface VideoItem {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: { medium?: { url?: string }; high?: { url?: string } };
  };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
}

/** ISO 8601 duration (PT1M30S) → 초 */
function durationSeconds(iso: string | undefined): number {
  if (!iso) return 0;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const msg = /quotaExceeded/.test(body) ? "YouTube API 일일 할당량 초과" : `YouTube API 오류 (${res.status})`;
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export async function collectYoutube(query: string, max: number, signal?: AbortSignal): Promise<Post[]> {
  const key = youtubeApiKey();
  if (!key) throw new Error("YOUTUBE_API_KEY 가 설정되지 않았습니다.");
  const n = Math.max(1, Math.min(50, max));
  const search = new URL(`${API}/search`);
  search.search = new URLSearchParams({
    key,
    part: "snippet",
    q: query,
    type: "video",
    maxResults: String(n),
    relevanceLanguage: "ko",
    regionCode: "KR",
    safeSearch: "moderate",
  }).toString();
  const s = await getJson<{ items?: SearchItem[] }>(search.toString(), signal);
  const ids = (s.items ?? []).map((i) => i.id?.videoId).filter((v): v is string => Boolean(v));
  if (ids.length === 0) return [];

  const videos = new URL(`${API}/videos`);
  videos.search = new URLSearchParams({ key, part: "snippet,statistics,contentDetails", id: ids.join(",") }).toString();
  const v = await getJson<{ items?: VideoItem[] }>(videos.toString(), signal);

  return (v.items ?? []).map((item) => {
    const title = item.snippet?.title ?? "";
    const desc = (item.snippet?.description ?? "").slice(0, 1500);
    const secs = durationSeconds(item.contentDetails?.duration);
    const channel = item.snippet?.channelTitle ?? "YouTube";
    const post: Post = {
      id: `yt_${item.id}`,
      platform: "youtube",
      brand: channel,
      handle: channel,
      url: `https://www.youtube.com/watch?v=${item.id}`,
      text: desc ? `${title}\n\n${desc}` : title,
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.high?.url,
      formatHint: secs > 0 && secs <= 75 ? "short_video" : "long_video",
      postedAt: item.snippet?.publishedAt,
      source: "youtube",
      metrics: {
        views: Number(item.statistics?.viewCount ?? 0) || undefined,
        likes: Number(item.statistics?.likeCount ?? 0) || undefined,
        comments: Number(item.statistics?.commentCount ?? 0) || undefined,
      },
    };
    return post;
  });
}
