/**
 * 무료 수집 오케스트레이터 (서버 전용). API 키 없이 되는 경로만 묶어 한 번에 돌리고,
 * 경로별 성공/실패를 CollectorReport 로 그대로 보고합니다.
 *  - 키워드 × (YouTube 검색 · Threads 검색)
 *  - 계정 × (Threads 프로필 · Instagram 프로필 · X 타임라인) — 체크된 플랫폼만
 *  - 게시물 URL → 도메인별 단건 수집 (x.com · threads.com · instagram.com · youtube.com)
 * YOUTUBE_API_KEY 가 있으면 YouTube 검색은 Data API(정확한 좋아요·길이)를 우선 쓰고, 실패하면 HTML 파싱으로 폴백합니다.
 * Instagram · X 키워드 검색과 Threads 검색 폴백은 검색엔진(DDG/Bing) 링크 발견 → 단건 수집기(og · fxtwitter) 조합입니다 (최선 노력).
 */
import type { CollectRequest, CollectResponse, CollectorReport, Platform, Post } from "../types";
import { mapLimit } from "./http";
import { youtubeByUrl, youtubeSearch, youtubeVideoId } from "./youtubeHtml";
import { collectYoutube, youtubeApiKey } from "./youtube";
import { threadsPost, threadsPostRef, threadsProfile, threadsSearch } from "./threads";
import { xPost, xPostRef, xProfile } from "./x";
import { instagramPost, instagramPostRef, instagramProfile } from "./instagram";
import { discoverPostLinks } from "./webSearch";

interface Task {
  id: string;
  platform: Platform;
  method: string;
  label: string;
  run: (signal?: AbortSignal) => Promise<Post[]>;
}

function urlTask(url: string): Task | null {
  if (xPostRef(url)) return { id: `url:${url}`, platform: "x", method: "fxtwitter", label: `X 게시물 ${short(url)}`, run: (s) => xPost(url, s).then((p) => [p]) };
  if (threadsPostRef(url)) return { id: `url:${url}`, platform: "threads", method: "threads-post", label: `Threads 게시물 ${short(url)}`, run: (s) => threadsPost(url, s).then((p) => [p]) };
  if (instagramPostRef(url)) return { id: `url:${url}`, platform: "instagram", method: "instagram-og", label: `Instagram 게시물 ${short(url)}`, run: (s) => instagramPost(url, s).then((p) => [p]) };
  if (youtubeVideoId(url)) return { id: `url:${url}`, platform: "youtube", method: "youtube-oembed", label: `YouTube 영상 ${short(url)}`, run: (s) => youtubeByUrl(url, s).then((p) => [p]) };
  return null;
}

function short(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48);
}

function keywordTasks(keyword: string, platforms: Set<Platform>, per: number): Task[] {
  const tasks: Task[] = [];
  if (platforms.has("youtube")) {
    tasks.push({
      id: `yt:${keyword}`,
      platform: "youtube",
      method: youtubeApiKey() ? "youtube-api" : "youtube-html",
      label: `YouTube 검색 '${keyword}'`,
      run: async (s) => {
        if (youtubeApiKey()) {
          try {
            const viaApi = await collectYoutube(keyword, per, s);
            return viaApi.map((p) => ({ ...p, source: "collected" as const, collectedVia: "youtube-api" }));
          } catch {
            // 할당량 초과 등 → HTML 폴백
          }
        }
        return youtubeSearch(keyword, per, s);
      },
    });
  }
  if (platforms.has("threads")) {
    tasks.push({
      id: `th:${keyword}`,
      platform: "threads",
      method: "threads-search",
      label: `Threads 검색 '${keyword}'`,
      run: async (s) => {
        try {
          return await threadsSearch(keyword, per, s);
        } catch (err) {
          // Jina 가 막히면 검색엔진 발견 → og 태그 폴백
          const found = await viaDiscovery(keyword, "threads", per, s);
          if (found.length) return found;
          throw err;
        }
      },
    });
  }
  if (platforms.has("instagram")) {
    tasks.push({
      id: `igs:${keyword}`,
      platform: "instagram",
      method: "web-discovery+og",
      label: `Instagram 검색 '${keyword}'`,
      run: async (s) => {
        const found = await viaDiscovery(keyword, "instagram", per, s);
        if (!found.length) throw new Error("검색엔진에서 게시물 링크를 찾지 못함 (데이터센터 IP 차단 가능) — 게시물 URL 을 직접 넣어 주세요");
        return found;
      },
    });
  }
  if (platforms.has("x")) {
    tasks.push({
      id: `xs:${keyword}`,
      platform: "x",
      method: "web-discovery+fxtwitter",
      label: `X 검색 '${keyword}'`,
      run: async (s) => {
        const found = await viaDiscovery(keyword, "x", per, s);
        if (!found.length) throw new Error("검색엔진에서 게시물 링크를 찾지 못함 (데이터센터 IP 차단 가능) — 게시물 URL 을 직접 넣어 주세요");
        return found;
      },
    });
  }
  return tasks;
}

/** 검색엔진으로 게시물 링크를 찾고 단건 수집기로 읽음 (최대 per 건, 동시 3) */
async function viaDiscovery(keyword: string, platform: "threads" | "instagram" | "x", per: number, signal?: AbortSignal): Promise<Post[]> {
  const spec = {
    threads: { domain: "threads.com", pattern: /\/@[^/]+\/post\/[A-Za-z0-9_-]+/, read: threadsPost, via: "web-discovery+og" },
    instagram: { domain: "instagram.com", pattern: /\/(p|reel|reels|tv)\/[A-Za-z0-9_-]+/, read: instagramPost, via: "web-discovery+og" },
    x: { domain: "x.com", pattern: /\/[A-Za-z0-9_]+\/status\/\d+/, read: xPost, via: "web-discovery+fxtwitter" },
  }[platform];
  const { links } = await discoverPostLinks(keyword, spec.domain, spec.pattern, Math.min(per, 12), signal);
  if (links.length === 0) return [];
  const posts = await mapLimit(links, 3, async (u) => {
    try {
      return await spec.read(u, signal);
    } catch {
      return null;
    }
  });
  return posts.filter((p): p is Post => Boolean(p)).map((p) => ({ ...p, collectedVia: spec.via }));
}

function accountTasks(account: string, platforms: Set<Platform>, per: number): Task[] {
  const h = account.replace(/^@/, "").trim();
  const tasks: Task[] = [];
  if (!h) return tasks;
  if (platforms.has("threads")) tasks.push({ id: `thp:${h}`, platform: "threads", method: "threads-profile", label: `Threads @${h}`, run: (s) => threadsProfile(h, per, s) });
  if (platforms.has("instagram")) tasks.push({ id: `igp:${h}`, platform: "instagram", method: "instagram-profile", label: `Instagram @${h}`, run: (s) => instagramProfile(h, per, s) });
  if (platforms.has("x")) tasks.push({ id: `xp:${h}`, platform: "x", method: "x-timeline", label: `X @${h}`, run: (s) => xProfile(h, per, s) });
  return tasks;
}

/** 텍스트 정규화 키 — 같은 글의 리포스트/중복 수집 제거용 */
function textKey(p: Post): string {
  return p.text.toLowerCase().replace(/https?:\/\/\S+/g, "").replace(/[\s\p{P}]+/gu, "").slice(0, 120);
}

/** 플랫폼별로 번갈아 섞어 상한까지 자름 */
function interleave(posts: Post[], max: number): Post[] {
  const buckets = new Map<Platform, Post[]>();
  for (const p of posts) {
    const b = buckets.get(p.platform) ?? [];
    b.push(p);
    buckets.set(p.platform, b);
  }
  const lists = [...buckets.values()];
  const out: Post[] = [];
  let i = 0;
  while (out.length < max) {
    let pushed = false;
    for (const l of lists) {
      if (i < l.length && out.length < max) {
        out.push(l[i]);
        pushed = true;
      }
    }
    if (!pushed) break;
    i += 1;
  }
  return out;
}

export async function collectAll(req: CollectRequest, signal?: AbortSignal): Promise<CollectResponse> {
  const started = Date.now();
  const platforms = new Set<Platform>(req.platforms);
  const keywords = [...new Set(req.keywords.map((k) => k.trim()).filter(Boolean))].slice(0, 5);
  const accounts = [...new Set(req.accounts.map((a) => a.trim()).filter(Boolean))].slice(0, 10);
  const urls = [...new Set(req.urls.map((u) => u.trim()).filter(Boolean))].slice(0, 40);

  // 검색 1건당 가져올 수: 총 상한을 검색 경로 수로 나눔 (최소 6, 최대 24)
  const searchPaths = keywords.length * [platforms.has("youtube"), platforms.has("threads")].filter(Boolean).length;
  const per = Math.max(6, Math.min(24, Math.ceil(req.max / Math.max(1, searchPaths))));

  const tasks: Task[] = [];
  for (const k of keywords) tasks.push(...keywordTasks(k, platforms, per));
  for (const a of accounts) tasks.push(...accountTasks(a, platforms, Math.max(6, Math.min(12, per))));
  const skipped: CollectorReport[] = [];
  for (const u of urls) {
    const t = urlTask(u);
    if (t) tasks.push(t);
    else skipped.push({ id: `url:${u}`, platform: "x", method: "url", label: short(u), ok: false, count: 0, latencyMs: 0, error: "지원하지 않는 URL (x.com · threads.com · instagram.com · youtube.com 게시물만)" });
  }

  const results = await mapLimit(tasks, 4, async (t): Promise<{ report: CollectorReport; posts: Post[] }> => {
    const t0 = Date.now();
    try {
      const posts = await t.run(signal);
      return { report: { id: t.id, platform: t.platform, method: t.method, label: t.label, ok: true, count: posts.length, latencyMs: Date.now() - t0 }, posts };
    } catch (err) {
      const message = err instanceof Error ? err.message.split("\n")[0].slice(0, 200) : "수집 실패";
      return { report: { id: t.id, platform: t.platform, method: t.method, label: t.label, ok: false, count: 0, latencyMs: Date.now() - t0, error: message }, posts: [] };
    }
  });

  // 중복 제거: id/url → 본문 정규화 키
  const seenId = new Set<string>();
  const seenText = new Set<string>();
  const merged: Post[] = [];
  for (const r of results) {
    for (const p of r.posts) {
      if (seenId.has(p.id) || (p.url && seenId.has(p.url))) continue;
      const tk = textKey(p);
      if (tk.length >= 24 && seenText.has(tk)) continue;
      seenId.add(p.id);
      if (p.url) seenId.add(p.url);
      if (tk.length >= 24) seenText.add(tk);
      merged.push(p);
    }
  }
  const dropped = results.reduce((n, r) => n + r.posts.length, 0) - merged.length;
  const report = [...results.map((r) => r.report), ...skipped];
  if (dropped > 0) report.push({ id: "dedupe", platform: "threads", method: "dedupe", label: "중복 제거", ok: true, count: dropped, latencyMs: 0 });

  return { posts: interleave(merged, req.max), report, elapsedMs: Date.now() - started, source: "collected" };
}
