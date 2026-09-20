/**
 * Threads 무료 수집기. threads.com 은 JS 앱이라 Jina Reader 로 렌더링된 마크다운을 파싱합니다.
 * - threadsSearch(keyword): /search?q=  (공개 검색 결과)
 * - threadsProfile(handle): /@handle    (공개 프로필의 최근 스레드)
 * - threadsPost(url):       /@handle/post/CODE (Jina 실패 시 봇 UA 의 og:description 폴백)
 * 마크다운 구조: 프로필 사진 이미지 줄 → [handle](…) → [날짜](…/post/CODE) → 본문 → 이미지들 → 좋아요·답글·리포스트·공유 숫자 줄
 */
import type { Post } from "../types";
import { BOT_UA, decodeEntities, fetchText, ogTags, parseCompactNumber, postId, relativeToIso } from "./http";
import { readViaJina } from "./jina";

export interface ThreadsItem {
  handle: string;
  code: string;
  url: string;
  date?: string;
  text: string;
  images: string[];
  likes?: number;
  replies?: number;
  reposts?: number;
  shares?: number;
}

/**
 * Jina 로 Threads 페이지 읽기. threads.com 은 Jina 가 "CAPTCHA 가능" 경고와 빈 본문을 돌려주는 일이 잦아
 * 옛 도메인 threads.net(같은 페이지로 리다이렉트) 을 먼저 쓰고, 비어 있으면 threads.com 으로 한 번 더 시도합니다.
 */
async function readThreads(path: string, signal?: AbortSignal): Promise<{ title: string; markdown: string }> {
  let first: { title: string; markdown: string } | null = null;
  let firstErr: unknown = null;
  try {
    first = await readViaJina(`https://www.threads.net${path}`, signal);
    if (first.markdown.trim().length > 200) return first;
  } catch (err) {
    firstErr = err;
  }
  try {
    const second = await readViaJina(`https://www.threads.com${path}`, signal);
    if (!first || second.markdown.trim().length > first.markdown.trim().length) return second;
    return first;
  } catch (err) {
    if (first) return first;
    throw firstErr ?? err;
  }
}

const PROFILE_PIC = /^\[!\[Image \d+: (.+?)'s profile picture\]\(/;
const POST_LINK = /^\[([^\]]*)\]\(https:\/\/www\.threads\.(?:com|net)\/@([^/)]+)\/post\/([A-Za-z0-9_-]+)\)\s*$/;
const HANDLE_LINK = /^\[([^\]]+)\]\(https:\/\/www\.threads\.(?:com|net)\/@[^/)]+\)\s*$/;
const IMAGE = /^!\[Image \d+[^\]]*\]\((https?:[^)]+)\)/;
const NUMBER = /^\d[\d,.]*[KkMm천만]?$/;
const NOISE = new Set(["Translate", "Spoiler", "Follow", "Mention", "More", "Pinned", "Log in", "Sign up", "·Author", "Author", "번역"]);

/** 마크다운 링크 [text](url) → text, 굵게/기울임 제거 */
function plain(line: string): string {
  return line
    .replace(/\[([^\]]*)\]\((?:https?:)?[^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\\([_*[\]()#])/g, "$1")
    .trim();
}

/** 렌더링된 마크다운 → 스레드 목록 (프로필 사진 줄 기준으로 블록 분리) */
export function parseThreadsMarkdown(md: string, now: Date = new Date()): ThreadsItem[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const starts: number[] = [];
  lines.forEach((l, i) => {
    if (PROFILE_PIC.test(l)) starts.push(i);
  });
  const items: ThreadsItem[] = [];
  for (let b = 0; b < starts.length; b++) {
    const block = lines.slice(starts[b], b + 1 < starts.length ? starts[b + 1] : lines.length);
    let handle = PROFILE_PIC.exec(block[0])?.[1] ?? "";
    let code = "";
    let date: string | undefined;
    const textLines: string[] = [];
    const images: string[] = [];
    const numbers: string[] = [];
    let inText = false;
    for (let i = 1; i < block.length; i++) {
      const raw = block[i];
      const line = raw.trim();
      if (!line) {
        if (inText) textLines.push("");
        continue;
      }
      const pl = POST_LINK.exec(line);
      if (pl && !code) {
        handle = pl[2] || handle;
        code = pl[3];
        date = relativeToIso(pl[1], now);
        inText = true;
        continue;
      }
      if (!code) {
        // 아직 게시물 링크 전: [handle](…) 같은 헤더 줄
        if (HANDLE_LINK.test(line)) continue;
        continue;
      }
      const im = IMAGE.exec(line);
      if (im) {
        if (!/profile picture/.test(line)) images.push(im[1]);
        inText = false;
        continue;
      }
      if (NOISE.has(line)) {
        inText = false;
        continue;
      }
      if (NUMBER.test(line)) {
        if (inText) textLines.push(line);
        else numbers.push(line);
        continue;
      }
      if (HANDLE_LINK.test(line) || POST_LINK.test(line)) {
        // 답글/인용의 시작 — 본문 끝
        inText = false;
        continue;
      }
      if (inText) textLines.push(plain(line));
      else if (numbers.length === 0 && textLines.length === 0) textLines.push(plain(line));
    }
    if (!code) continue;
    // 1) 본문 끝에 붙은 지표 숫자 줄(좋아요·답글·리포스트·공유)을 먼저 떼어냄 — 이미지가 없는 스레드는 숫자가 본문 뒤에 바로 옴
    while (textLines.length && !textLines[textLines.length - 1].trim()) textLines.pop();
    while (textLines.length > 1 && NUMBER.test(textLines[textLines.length - 1].trim()) && numbers.length < 4) {
      numbers.unshift(textLines.pop()!.trim());
      while (textLines.length && !textLines[textLines.length - 1].trim()) textLines.pop();
    }
    // 2) 본문 안에 남은 숫자 줄(스타일된 span 으로 쪼개진 "3", "120")은 앞뒤 문장과 이어 붙임
    const joined: string[] = [];
    for (let i = 0; i < textLines.length; i++) {
      const cur = textLines[i];
      if (NUMBER.test(cur.trim())) {
        let j = joined.length - 1;
        while (j >= 0 && !joined[j].trim()) j--;
        let k = i + 1;
        while (k < textLines.length && !textLines[k].trim()) k++;
        if (j >= 0 && k < textLines.length && !NUMBER.test(textLines[k].trim())) {
          joined.length = j + 1;
          joined[j] = `${joined[j].trimEnd()} ${cur.trim()} ${textLines[k].trim()}`;
          i = k;
          continue;
        }
      }
      joined.push(cur);
    }
    const text = joined
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+\n/g, "\n")
      .trim();
    if (!text && images.length === 0) continue;
    const nums = numbers.slice(-4).map((n) => parseCompactNumber(n));
    items.push({
      handle,
      code,
      url: `https://www.threads.com/@${handle}/post/${code}`,
      date,
      text: text || "(이미지 스레드)",
      images,
      likes: nums[0],
      replies: nums[1],
      reposts: nums[2],
      shares: nums[3],
    });
  }
  return items;
}

function toPost(item: ThreadsItem, via: string): Post {
  const imgs = item.images.length;
  return {
    id: postId("th", item.code),
    platform: "threads",
    brand: item.handle,
    handle: `@${item.handle}`,
    url: item.url,
    text: item.text.slice(0, 4000),
    thumbnailUrl: item.images[0],
    formatHint: imgs >= 3 ? "card_news" : imgs >= 1 ? "image" : "text",
    postedAt: item.date,
    source: "collected",
    collectedVia: via,
    metrics: {
      likes: item.likes,
      comments: item.replies,
      shares: (item.reposts ?? 0) + (item.shares ?? 0) || undefined,
    },
  };
}

/** 키워드 검색 (공개 검색 결과, 관련도순) */
export async function threadsSearch(keyword: string, max: number, signal?: AbortSignal): Promise<Post[]> {
  let page = await readThreads(`/search?q=${encodeURIComponent(keyword)}&serp_type=default`, signal);
  let items = parseThreadsMarkdown(page.markdown);
  // "No results." — 검색어가 너무 길면 앞 두 단어로 한 번 더 (예: "AI 전환 컨설팅" → "AI 전환")
  if (items.length === 0 && /No results\.|결과 없음/.test(page.markdown)) {
    const words = keyword.split(/\s+/).filter(Boolean);
    if (words.length >= 3) {
      page = await readThreads(`/search?q=${encodeURIComponent(words.slice(0, 2).join(" "))}&serp_type=default`, signal);
      items = parseThreadsMarkdown(page.markdown);
    }
    if (items.length === 0) return [];
  }
  if (items.length === 0 && /Log in|로그인/.test(page.markdown) && page.markdown.length < 3000) {
    throw new Error("Threads 가 로그인 페이지를 돌려줌 — 잠시 후 다시 시도하세요");
  }
  const seen = new Set<string>();
  const out: Post[] = [];
  for (const it of items) {
    if (seen.has(it.code)) continue;
    seen.add(it.code);
    out.push(toPost(it, "threads-search"));
    if (out.length >= max) break;
  }
  return out;
}

/** @handle 프로필의 최근 스레드 */
export async function threadsProfile(handle: string, max: number, signal?: AbortSignal): Promise<Post[]> {
  const h = handle.replace(/^@/, "").trim();
  const page = await readThreads(`/@${encodeURIComponent(h)}`, signal);
  const items = parseThreadsMarkdown(page.markdown).filter((it) => it.handle.toLowerCase() === h.toLowerCase());
  if (items.length === 0) {
    if (/Sorry, this page isn't available|페이지를 사용할 수 없습니다/.test(page.markdown)) throw new Error(`@${h} 프로필을 찾을 수 없음`);
    throw new Error(`@${h} 의 공개 스레드를 읽지 못함 (비공개 계정이거나 렌더링 실패)`);
  }
  const seen = new Set<string>();
  const out: Post[] = [];
  for (const it of items) {
    if (seen.has(it.code)) continue;
    seen.add(it.code);
    out.push(toPost(it, "threads-profile"));
    if (out.length >= max) break;
  }
  return out;
}

/** og:title `김공공 (@kim00gangsa) on Threads` · `Threads의 김공공(@kim00gangsa)님` → 표시 이름 */
export function threadsNameFromTitle(title: string): string | undefined {
  const name = title
    .replace(/^Threads의\s*/, "")
    .replace(/\s*on Threads\s*$/, "")
    .replace(/\s*\(@[^)]*\)\s*님?\s*$/, "")
    .trim();
  return name || undefined;
}

export function threadsPostRef(url: string): { handle: string; code: string } | null {
  const m = /threads\.(?:com|net)\/@([^/?#]+)\/post\/([A-Za-z0-9_-]+)/.exec(url);
  return m ? { handle: m[1], code: m[2] } : null;
}

/** 게시물 URL 1개 → Post. Jina 로 본문·지표를 읽고, 실패하면 봇 UA og 태그로 폴백 */
export async function threadsPost(url: string, signal?: AbortSignal): Promise<Post> {
  const ref = threadsPostRef(url);
  if (!ref) throw new Error("Threads 게시물 URL 이 아닙니다");
  const canonical = `https://www.threads.com/@${ref.handle}/post/${ref.code}`;
  try {
    const page = await readThreads(`/@${ref.handle}/post/${ref.code}`, signal);
    const items = parseThreadsMarkdown(page.markdown);
    const hit = items.find((it) => it.code === ref.code) ?? items.find((it) => it.handle.toLowerCase() === ref.handle.toLowerCase());
    if (hit) return toPost(hit, "threads-post");
  } catch {
    // 폴백으로 진행
  }
  const { text: html } = await fetchText(canonical, { ua: BOT_UA, signal, timeoutMs: 15_000, headers: { "accept-language": "en-US,en;q=0.9" } });
  const og = ogTags(html);
  const desc = og["og:description"] ?? "";
  if (!desc || /Join Threads to share ideas/.test(desc)) throw new Error("Threads 게시물을 읽지 못함 (비공개이거나 차단)");
  const name = threadsNameFromTitle(og["og:title"] ?? "");
  return {
    id: postId("th", ref.code),
    platform: "threads",
    brand: name || ref.handle,
    handle: `@${ref.handle}`,
    url: canonical,
    text: decodeEntities(desc).slice(0, 4000),
    thumbnailUrl: og["og:image"],
    formatHint: og["og:image"] ? "image" : "text",
    source: "collected",
    collectedVia: "threads-og",
  };
}
