/**
 * Instagram 무료 수집기.
 * - instagramPost(url): 봇 UA 로 게시물 페이지의 og:title(캡션) · og:description("815K likes, 9,073 comments - name on Sep 18, 2026: …") · og:image
 * - instagramProfile(handle): 공개 web_profile_info 엔드포인트(최근 12개, 캡션·좋아요·댓글·썸네일). 자주 401 로 막히므로 실패를 그대로 보고
 */
import type { Post, PostFormat } from "../types";
import { BOT_UA, BROWSER_UA, HttpError, fetchJson, fetchText, ogTags, parseCompactNumber, postId, relativeToIso } from "./http";

export function instagramPostRef(url: string): { kind: "p" | "reel" | "tv"; code: string } | null {
  const m = /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/.exec(url);
  if (!m) return null;
  const kind = m[1] === "reels" ? "reel" : (m[1] as "p" | "reel" | "tv");
  return { kind, code: m[2] };
}

export async function instagramPost(url: string, signal?: AbortSignal): Promise<Post> {
  const ref = instagramPostRef(url);
  if (!ref) throw new Error("Instagram 게시물 URL 이 아닙니다");
  const canonical = `https://www.instagram.com/${ref.kind}/${ref.code}/`;
  const { text: html } = await fetchText(canonical, {
    ua: BOT_UA,
    signal,
    timeoutMs: 15_000,
    allowStatus: [404],
    headers: { "accept-language": "en-US,en;q=0.9" },
  });
  const og = ogTags(html);
  const title = og["og:title"] ?? "";
  const desc = og["og:description"] ?? og.description ?? "";
  if (!title && !desc) throw new Error("Instagram 게시물을 읽지 못함 (비공개이거나 삭제됨)");
  const parsed = parseInstagramOg(title, desc);
  const name = parsed.name;
  let caption = parsed.caption;
  const handle = parsed.handle ?? name ?? ref.code;
  if (!caption) caption = desc.replace(/^.*?:\s*"?/, "").replace(/"?$/, "").trim() || title;
  const isVideo = ref.kind === "reel" || ref.kind === "tv" || Boolean(og["og:video"]);
  const format: PostFormat = isVideo ? "short_video" : "image";
  return {
    id: postId("ig", ref.code),
    platform: "instagram",
    brand: name || handle,
    handle: `@${handle.replace(/^@/, "")}`,
    url: canonical,
    text: caption.slice(0, 4000),
    thumbnailUrl: og["og:image"],
    formatHint: format,
    postedAt: parsed.dateText ? relativeToIso(parsed.dateText) : undefined,
    source: "collected",
    collectedVia: "instagram-og",
    metrics: { likes: parsed.likes, comments: parsed.comments },
  };
}

/**
 * og 태그 파싱 (영어/한국어 로케일 모두):
 *  title  `{name} on Instagram: "caption"`  ·  `Instagram의 {name}님 : "caption"`
 *  desc   `815K likes, 9,073 comments - {handle} on September 18, 2026: "caption"`  ·  `… - {handle} - September 18, 2026: "…"`
 */
export function parseInstagramOg(title: string, desc: string): {
  name?: string;
  handle?: string;
  caption: string;
  likes?: number;
  comments?: number;
  dateText?: string;
} {
  let name: string | undefined;
  let caption = "";
  const en = /^(.+?) on Instagram:\s*"?([\s\S]*?)"?\s*$/.exec(title);
  const ko = /^Instagram의 (.+?)님\s*:\s*"?([\s\S]*?)"?\s*$/.exec(title);
  const tm = en ?? ko;
  if (tm) {
    name = tm[1].trim();
    caption = tm[2].trim();
  }
  const dm = /^([\d.,KkMm]+)\s*likes?,\s*([\d.,KkMm]+)\s*comments?\s*-\s*(\S+)\s*(?:on|-)\s*([A-Za-z]+ \d{1,2}, \d{4})(?::\s*"?([\s\S]*?)"?)?\s*\.?\s*$/.exec(desc);
  const dateText = dm?.[4];
  if (!caption && dm?.[5]) caption = dm[5].trim();
  return {
    name,
    handle: dm?.[3],
    caption,
    likes: parseCompactNumber(dm?.[1]),
    comments: parseCompactNumber(dm?.[2]),
    dateText,
  };
}

interface IgNode {
  shortcode?: string;
  __typename?: string;
  is_video?: boolean;
  display_url?: string;
  thumbnail_src?: string;
  taken_at_timestamp?: number;
  edge_media_to_caption?: { edges?: Array<{ node?: { text?: string } }> };
  edge_liked_by?: { count?: number };
  edge_media_preview_like?: { count?: number };
  edge_media_to_comment?: { count?: number };
  video_view_count?: number;
  edge_sidecar_to_children?: { edges?: unknown[] };
}

export async function instagramProfile(handle: string, max: number, signal?: AbortSignal): Promise<Post[]> {
  const h = handle.replace(/^@/, "").trim();
  let data: { data?: { user?: { username?: string; full_name?: string; edge_owner_to_timeline_media?: { edges?: Array<{ node?: IgNode }> } } } };
  try {
    data = await fetchJson(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(h)}`, {
      signal,
      timeoutMs: 15_000,
      ua: BROWSER_UA,
      headers: { "x-ig-app-id": "936619743392459", referer: `https://www.instagram.com/${h}/` },
    });
  } catch (err) {
    if (err instanceof HttpError && (err.status === 401 || err.status === 429 || err.status === 403)) {
      throw new Error(`Instagram 이 계정 조회를 차단(${err.status}) — 게시물 URL 을 붙여넣으면 개별 수집은 됩니다`);
    }
    if (err instanceof HttpError && err.status === 404) throw new Error(`@${h} 계정을 찾을 수 없음`);
    throw err;
  }
  const user = data.data?.user;
  const edges = user?.edge_owner_to_timeline_media?.edges ?? [];
  if (!user || edges.length === 0) throw new Error(`@${h} 의 공개 게시물이 없습니다 (비공개 계정?)`);
  const out: Post[] = [];
  for (const e of edges) {
    const n = e.node;
    if (!n?.shortcode) continue;
    const caption = (n.edge_media_to_caption?.edges ?? []).map((c) => c.node?.text ?? "").join("\n").trim();
    const children = n.edge_sidecar_to_children?.edges?.length ?? 0;
    const format: PostFormat = n.is_video ? "short_video" : children >= 3 ? "card_news" : "image";
    out.push({
      id: postId("ig", n.shortcode),
      platform: "instagram",
      brand: user.full_name || user.username || h,
      handle: `@${user.username ?? h}`,
      url: `https://www.instagram.com/p/${n.shortcode}/`,
      text: (caption || "(캡션 없음)").slice(0, 4000),
      thumbnailUrl: n.thumbnail_src ?? n.display_url,
      formatHint: format,
      postedAt: n.taken_at_timestamp ? new Date(n.taken_at_timestamp * 1000).toISOString() : undefined,
      source: "collected",
      collectedVia: "instagram-profile",
      metrics: {
        likes: n.edge_liked_by?.count ?? n.edge_media_preview_like?.count,
        comments: n.edge_media_to_comment?.count,
        views: n.video_view_count,
      },
    });
    if (out.length >= max) break;
  }
  return out;
}
