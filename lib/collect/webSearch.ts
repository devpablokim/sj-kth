/**
 * 검색엔진 HTML 로 게시물 링크만 찾는 무료 발견(discovery) 경로 — DuckDuckGo HTML → Bing 순으로 시도합니다.
 * 키워드 검색이 안 되는 플랫폼(Instagram · X)과 Jina 가 막혔을 때의 Threads 폴백에 씁니다.
 * 데이터센터 IP 에서는 검색엔진이 도전 페이지(202/429)나 무관한 결과를 주기도 하므로 "최선 노력" 경로이며,
 * 찾은 링크는 각 플랫폼 단건 수집기(og 태그 · fxtwitter)로 다시 읽습니다.
 */
import { BROWSER_UA, fetchText } from "./http";

function decodeDdg(href: string): string | null {
  // //duckduckgo.com/l/?uddg=<encoded>&rut=…
  const m = /[?&]uddg=([^&]+)/.exec(href);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return null;
    }
  }
  return /^https?:\/\//.test(href) ? href : null;
}

function decodeBing(href: string): string | null {
  // https://www.bing.com/ck/a?!&&p=…&u=a1<base64url>&ntb=1
  const m = /[?&]u=a1([A-Za-z0-9_-]+)/.exec(href);
  if (m) {
    try {
      const b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
      return Buffer.from(b64 + "=".repeat((4 - (b64.length % 4)) % 4), "base64").toString("utf8");
    } catch {
      return null;
    }
  }
  return /^https?:\/\//.test(href) ? href : null;
}

async function ddg(query: string, signal?: AbortSignal): Promise<string[]> {
  const { text: html } = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=kr-kr`, {
    ua: BROWSER_UA,
    signal,
    timeoutMs: 15_000,
    allowStatus: [202],
  });
  const out: string[] = [];
  const re = /class="result__a"[^>]*href="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const u = decodeDdg(m[1].replace(/&amp;/g, "&"));
    if (u) out.push(u);
  }
  return out;
}

async function bing(query: string, signal?: AbortSignal): Promise<string[]> {
  const { text: html } = await fetchText(`https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20&mkt=ko-KR&setlang=ko`, {
    ua: BROWSER_UA,
    signal,
    timeoutMs: 15_000,
  });
  const out: string[] = [];
  const items = html.match(/<li class="b_algo".*?<\/li>/gs) ?? [];
  for (const it of items) {
    const hm = /href="([^"]+)"/.exec(it);
    if (!hm) continue;
    const u = decodeBing(hm[1].replace(/&amp;/g, "&"));
    if (u) out.push(u);
  }
  return out;
}

/**
 * `site:{domain} {keyword}` 로 검색해 pattern 에 맞는 게시물 URL 을 돌려줍니다 (중복 제거, 최대 max).
 * 두 엔진 모두 실패/무결과면 빈 배열 — 호출자가 "검색엔진 접근 불가" 로 보고합니다.
 */
export async function discoverPostLinks(
  keyword: string,
  domain: string,
  pattern: RegExp,
  max: number,
  signal?: AbortSignal,
): Promise<{ links: string[]; engine: string | null }> {
  const query = `site:${domain} ${keyword}`;
  for (const [name, fn] of [
    ["duckduckgo", ddg],
    ["bing", bing],
  ] as const) {
    try {
      const links = await fn(query, signal);
      const hits = [...new Set(links.filter((u) => u.includes(domain) && pattern.test(u)))].slice(0, max);
      if (hits.length) return { links: hits, engine: name };
    } catch {
      // 다음 엔진
    }
  }
  return { links: [], engine: null };
}
