/**
 * YouTube 무료 수집기 (API 키 없음). 검색 결과 페이지의 ytInitialData 를 파싱합니다.
 * - videoRenderer: 제목 · 채널 · 조회수 · 게시 시점 · 길이 · 설명 스니펫 · 썸네일
 * - shortsLockupViewModel: 쇼츠 (제목 · 조회수 · 썸네일; 채널명은 oEmbed 로 보강)
 * 단일 영상 URL 은 oEmbed(제목·채널·썸네일) + "영상 ID 검색" 으로 설명/조회수를 채웁니다.
 */
import type { Post } from "../types";
import { BROWSER_UA, fetchJson, fetchText, mapLimit, parseCompactNumber, postId, relativeToIso } from "./http";

interface Runs {
  runs?: Array<{ text?: string }>;
  simpleText?: string;
}
interface VideoRenderer {
  videoId?: string;
  title?: Runs;
  ownerText?: Runs;
  viewCountText?: Runs;
  publishedTimeText?: Runs;
  lengthText?: Runs & { accessibility?: { accessibilityData?: { label?: string } } };
  detailedMetadataSnippets?: Array<{ snippetText?: Runs }>;
  thumbnail?: { thumbnails?: Array<{ url?: string }> };
  descriptionSnippet?: Runs;
}
interface ShortsLockup {
  onTap?: { innertubeCommand?: { reelWatchEndpoint?: { videoId?: string } } };
  overlayMetadata?: { primaryText?: { content?: string }; secondaryText?: { content?: string } };
  thumbnailViewModel?: { thumbnailViewModel?: { image?: { sources?: Array<{ url?: string }> } } };
}

function text(r: Runs | undefined): string {
  if (!r) return "";
  if (r.simpleText) return r.simpleText;
  return (r.runs ?? []).map((x) => x.text ?? "").join("");
}

/** "19:16" · "1:02:03" · "0:45" → 초 */
function lengthSeconds(s: string): number {
  const parts = s.split(":").map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p))) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function* walk(node: unknown, key: string): Generator<unknown> {
  if (Array.isArray(node)) {
    for (const v of node) yield* walk(v, key);
  } else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (key in o) yield o[key];
    for (const v of Object.values(o)) yield* walk(v, key);
  }
}

function extractInitialData(html: string): unknown {
  // `var ytInitialData = {...};</script>` 또는 `window["ytInitialData"] = {...};`
  const start = /(?:var ytInitialData|window\["ytInitialData"\])\s*=\s*/.exec(html);
  if (!start) {
    if (/consent\.youtube\.com|Before you continue/i.test(html)) throw new Error("YouTube 동의 페이지가 표시됨 (지역 제한)");
    throw new Error("검색 결과를 읽지 못함 (일시 차단 또는 페이지 구조 변경)");
  }
  const from = start.index + start[0].length;
  const end = html.indexOf(";</script>", from);
  const raw = html.slice(from, end > from ? end : undefined).trim().replace(/;$/, "");
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error("검색 결과 JSON 파싱 실패 (페이지 구조 변경)");
  }
}

async function fetchResults(query: string, signal?: AbortSignal): Promise<unknown> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=ko&gl=KR`;
  let lastErr: unknown = null;
  // 일시적으로 다른 페이지(봇 체크·빈 결과)가 오면 한 번 더
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text: html } = await fetchText(url + (attempt ? "&pbj=0" : ""), {
        ua: BROWSER_UA,
        signal,
        timeoutMs: 20_000,
        headers: { cookie: "CONSENT=YES+cb.20240101-00-p0.ko+FX+000; SOCS=CAI", "accept-language": "ko-KR,ko;q=0.9,en;q=0.8" },
      });
      return extractInitialData(html);
    } catch (err) {
      lastErr = err;
      if (signal?.aborted) throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("검색 결과를 읽지 못함");
}

function videoToPost(v: VideoRenderer): Post | null {
  const id = v.videoId;
  if (!id) return null;
  const title = text(v.title).trim();
  if (!title) return null;
  const channel = text(v.ownerText).trim() || "YouTube";
  const snippet = (v.detailedMetadataSnippets ?? []).map((s) => text(s.snippetText)).join(" ").trim() || text(v.descriptionSnippet).trim();
  const secs = lengthSeconds(text(v.lengthText));
  const thumbs = v.thumbnail?.thumbnails ?? [];
  return {
    id: postId("yt", id),
    platform: "youtube",
    brand: channel,
    handle: channel,
    url: `https://www.youtube.com/watch?v=${id}`,
    text: snippet ? `${title}\n\n${snippet}` : title,
    thumbnailUrl: thumbs[thumbs.length - 1]?.url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    formatHint: secs > 0 && secs <= 75 ? "short_video" : "long_video",
    postedAt: relativeToIso(text(v.publishedTimeText)),
    source: "collected",
    collectedVia: "youtube-html",
    metrics: { views: parseCompactNumber(text(v.viewCountText)) },
  };
}

function shortsToPost(s: ShortsLockup): Post | null {
  const id = s.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId;
  const title = s.overlayMetadata?.primaryText?.content?.trim();
  if (!id || !title) return null;
  return {
    id: postId("yt", id),
    platform: "youtube",
    brand: "YouTube Shorts",
    handle: "shorts",
    url: `https://www.youtube.com/shorts/${id}`,
    text: title,
    thumbnailUrl: s.thumbnailViewModel?.thumbnailViewModel?.image?.sources?.[0]?.url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    formatHint: "short_video",
    source: "collected",
    collectedVia: "youtube-html",
    metrics: { views: parseCompactNumber(s.overlayMetadata?.secondaryText?.content) },
  };
}

interface OEmbed {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
}

async function oembed(videoId: string, signal?: AbortSignal): Promise<OEmbed | null> {
  try {
    return await fetchJson<OEmbed>(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      { signal, timeoutMs: 8_000 },
    );
  } catch {
    return null;
  }
}

/** 검색어로 영상·쇼츠 수집 */
export async function youtubeSearch(query: string, max: number, signal?: AbortSignal): Promise<Post[]> {
  const data = await fetchResults(query, signal);
  const posts: Post[] = [];
  const seen = new Set<string>();
  for (const v of walk(data, "videoRenderer")) {
    const p = videoToPost(v as VideoRenderer);
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      posts.push(p);
    }
  }
  const shorts: Post[] = [];
  for (const s of walk(data, "shortsLockupViewModel")) {
    const p = shortsToPost(s as ShortsLockup);
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      shorts.push(p);
    }
  }
  // 롱폼 2 : 쇼츠 1 비율로 섞고 상한 적용
  const mixed: Post[] = [];
  let i = 0;
  let j = 0;
  while (mixed.length < max && (i < posts.length || j < shorts.length)) {
    if (i < posts.length) mixed.push(posts[i++]);
    if (i < posts.length && mixed.length < max) mixed.push(posts[i++]);
    if (j < shorts.length && mixed.length < max) mixed.push(shorts[j++]);
  }
  // 쇼츠 채널명 보강 (oEmbed, 최대 12개 · 동시 4)
  const needAuthor = mixed.filter((p) => p.handle === "shorts").slice(0, 12);
  await mapLimit(needAuthor, 4, async (p) => {
    const id = p.url.split("/shorts/")[1] ?? "";
    const o = await oembed(id, signal);
    if (o?.author_name) {
      p.brand = o.author_name;
      p.handle = o.author_url?.split("/").filter(Boolean).pop() ?? o.author_name;
    }
  });
  return mixed;
}

/** watch?v= · youtu.be/ · /shorts/ URL → videoId */
export function youtubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (!/(^|\.)youtube\.com$/.test(u.hostname)) return null;
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const m = /^\/(shorts|embed|live)\/([A-Za-z0-9_-]{6,})/.exec(u.pathname);
    return m ? m[2] : null;
  } catch {
    return null;
  }
}

/** 영상 URL 1개 → Post (oEmbed + 영상 ID 검색으로 설명·조회수 보강) */
export async function youtubeByUrl(url: string, signal?: AbortSignal): Promise<Post> {
  const id = youtubeVideoId(url);
  if (!id) throw new Error("YouTube 영상 URL 이 아닙니다");
  const [o, data] = await Promise.all([
    oembed(id, signal),
    fetchResults(id, signal).catch(() => null),
  ]);
  let found: Post | null = null;
  if (data) {
    for (const v of walk(data, "videoRenderer")) {
      const p = videoToPost(v as VideoRenderer);
      if (p && p.id === postId("yt", id)) {
        found = p;
        break;
      }
    }
  }
  const isShorts = /\/shorts\//.test(url);
  const base: Post = found ?? {
    id: postId("yt", id),
    platform: "youtube",
    brand: o?.author_name ?? "YouTube",
    handle: o?.author_url?.split("/").filter(Boolean).pop() ?? o?.author_name ?? "youtube",
    url: `https://www.youtube.com/watch?v=${id}`,
    text: o?.title ?? url,
    thumbnailUrl: o?.thumbnail_url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    formatHint: isShorts ? "short_video" : "long_video",
    source: "collected",
    collectedVia: "youtube-oembed",
  };
  if (o?.author_name && (base.brand === "YouTube" || base.brand === "YouTube Shorts")) {
    base.brand = o.author_name;
    base.handle = o.author_url?.split("/").filter(Boolean).pop() ?? o.author_name;
  }
  if (isShorts) base.formatHint = "short_video";
  return base;
}
