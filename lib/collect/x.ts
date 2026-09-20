/**
 * X(트위터) 무료 수집기.
 * - xPost(url): fxtwitter 공개 API (본문 · 좋아요 · 리포스트 · 답글 · 조회수 · 미디어). 실패 시 X 신디케이션 tweet-result 폴백.
 * - xProfile(handle): X 신디케이션 timeline-profile (자주 429 로 막힘 → 오류를 그대로 보고하고 URL 붙여넣기를 안내)
 */
import type { Post, PostFormat } from "../types";
import { BROWSER_UA, HttpError, fetchJson, fetchText, postId } from "./http";

interface FxMedia {
  photos?: Array<{ url?: string }>;
  videos?: Array<{ thumbnail_url?: string; duration?: number }>;
}
interface FxTweet {
  url?: string;
  id?: string;
  text?: string;
  created_timestamp?: number;
  likes?: number;
  retweets?: number;
  replies?: number;
  views?: number | null;
  author?: { name?: string; screen_name?: string };
  media?: FxMedia;
}

export function xPostRef(url: string): { handle: string; id: string } | null {
  const m = /(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/status\/(\d+)/.exec(url);
  return m ? { handle: m[1], id: m[2] } : null;
}

function formatOf(photos: number, video: boolean, duration?: number): PostFormat {
  if (video) return duration && duration > 75 ? "long_video" : "short_video";
  if (photos >= 3) return "card_news";
  if (photos >= 1) return "image";
  return "text";
}

export async function xPost(url: string, signal?: AbortSignal): Promise<Post> {
  const ref = xPostRef(url);
  if (!ref) throw new Error("X 게시물 URL 이 아닙니다");
  try {
    const j = await fetchJson<{ code?: number; tweet?: FxTweet }>(`https://api.fxtwitter.com/${ref.handle}/status/${ref.id}`, {
      signal,
      timeoutMs: 15_000,
    });
    const t = j.tweet;
    if (!t || !t.text) throw new Error("fxtwitter 응답에 트윗이 없음");
    const photos = t.media?.photos ?? [];
    const video = t.media?.videos?.[0];
    return {
      id: postId("x", t.id ?? ref.id),
      platform: "x",
      brand: t.author?.name ?? ref.handle,
      handle: `@${t.author?.screen_name ?? ref.handle}`,
      url: t.url ?? `https://x.com/${ref.handle}/status/${ref.id}`,
      text: t.text.slice(0, 4000),
      thumbnailUrl: photos[0]?.url ?? video?.thumbnail_url,
      formatHint: formatOf(photos.length, Boolean(video), video?.duration),
      postedAt: t.created_timestamp ? new Date(t.created_timestamp * 1000).toISOString() : undefined,
      source: "collected",
      collectedVia: "fxtwitter",
      metrics: {
        likes: t.likes,
        comments: t.replies,
        shares: t.retweets,
        views: typeof t.views === "number" ? t.views : undefined,
      },
    };
  } catch (err) {
    // 폴백: X 신디케이션 (토큰 검증 없음)
    const s = await fetchJson<{
      text?: string;
      favorite_count?: number;
      created_at?: string;
      user?: { name?: string; screen_name?: string };
      photos?: Array<{ url?: string }>;
      video?: { poster?: string };
    }>(`https://cdn.syndication.twimg.com/tweet-result?id=${ref.id}&token=x`, { signal, timeoutMs: 15_000, ua: BROWSER_UA }).catch(() => {
      throw err instanceof Error ? err : new Error("X 게시물을 읽지 못함");
    });
    if (!s.text) throw new Error("X 게시물을 읽지 못함 (삭제되었거나 비공개)");
    const photos = s.photos ?? [];
    return {
      id: postId("x", ref.id),
      platform: "x",
      brand: s.user?.name ?? ref.handle,
      handle: `@${s.user?.screen_name ?? ref.handle}`,
      url: `https://x.com/${ref.handle}/status/${ref.id}`,
      text: s.text.slice(0, 4000),
      thumbnailUrl: photos[0]?.url ?? s.video?.poster,
      formatHint: formatOf(photos.length, Boolean(s.video)),
      postedAt: s.created_at ? new Date(s.created_at).toISOString() : undefined,
      source: "collected",
      collectedVia: "x-syndication",
      metrics: { likes: s.favorite_count },
    };
  }
}

interface TimelineTweet {
  id_str?: string;
  full_text?: string;
  text?: string;
  favorite_count?: number;
  retweet_count?: number;
  reply_count?: number;
  created_at?: string;
  user?: { name?: string; screen_name?: string };
  entities?: { media?: Array<{ media_url_https?: string; type?: string }> };
  retweeted_status?: unknown;
}

/** @handle 의 최근 트윗 (신디케이션 위젯 데이터). X 가 자주 429 를 돌려주므로 실패를 그대로 보고합니다 */
export async function xProfile(handle: string, max: number, signal?: AbortSignal): Promise<Post[]> {
  const h = handle.replace(/^@/, "").trim();
  let html: string;
  try {
    html = (await fetchText(`https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(h)}?showReplies=false`, {
      signal,
      timeoutMs: 15_000,
      ua: BROWSER_UA,
    })).text;
  } catch (err) {
    if (err instanceof HttpError && err.status === 429) {
      throw new Error("X 가 계정 타임라인 조회를 제한(429) — 게시물 URL 을 붙여넣으면 개별 수집은 됩니다");
    }
    throw err;
  }
  const m = /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s.exec(html);
  if (!m) throw new Error("X 타임라인을 읽지 못함 (계정이 없거나 비공개)");
  const data = JSON.parse(m[1]) as { props?: { pageProps?: { timeline?: { entries?: Array<{ content?: { tweet?: TimelineTweet } }> } } } };
  const entries = data.props?.pageProps?.timeline?.entries ?? [];
  const out: Post[] = [];
  for (const e of entries) {
    const t = e.content?.tweet;
    if (!t || t.retweeted_status) continue;
    const text = (t.full_text ?? t.text ?? "").trim();
    if (!text || !t.id_str) continue;
    const media = t.entities?.media ?? [];
    const photos = media.filter((x) => x.type === "photo").length;
    const video = media.some((x) => x.type === "video" || x.type === "animated_gif");
    out.push({
      id: postId("x", t.id_str),
      platform: "x",
      brand: t.user?.name ?? h,
      handle: `@${t.user?.screen_name ?? h}`,
      url: `https://x.com/${t.user?.screen_name ?? h}/status/${t.id_str}`,
      text: text.slice(0, 4000),
      thumbnailUrl: media[0]?.media_url_https,
      formatHint: formatOf(photos, video),
      postedAt: t.created_at ? new Date(t.created_at).toISOString() : undefined,
      source: "collected",
      collectedVia: "x-timeline",
      metrics: { likes: t.favorite_count, comments: t.reply_count, shares: t.retweet_count },
    });
    if (out.length >= max) break;
  }
  if (out.length === 0) throw new Error(`@${h} 의 공개 트윗이 없습니다`);
  return out;
}
