/**
 * 무료 수집기 공용 HTTP 유틸 (서버 전용). API 키 없이 공개 페이지·공개 엔드포인트만 읽습니다.
 * - fetchText: 타임아웃·UA·abort 를 붙인 fetch. 실패 시 Error(message) 로 통일.
 * - decodeEntities / ogTags: <meta property="og:…"> 파싱 (Instagram · Threads 게시물 폴백)
 * - parseCompactNumber: "1.6K" · "815K" · "9,073" · "1.2만" · "조회수 1.3천회" → 숫자
 * - relativeToIso: "2d" · "3개월 전" · "11일 전" · "3 months ago" · "01/20/26" → ISO 날짜
 */

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
/** 링크 미리보기 봇 UA — Instagram/Threads 는 이 UA 에 로그인 벽 대신 og 태그를 돌려줍니다 */
export const BOT_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

export interface FetchTextOptions {
  ua?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** 이 상태 코드면 예외 대신 본문을 그대로 돌려줌 (예: 404 페이지도 파싱하고 싶을 때) */
  allowStatus?: number[];
}

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

/** 부모 signal 과 타임아웃을 합친 AbortSignal */
function withTimeout(timeoutMs: number, parent?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`timeout ${timeoutMs}ms`)), timeoutMs);
  const onParent = () => ctrl.abort(parent?.reason ?? new Error("aborted"));
  if (parent) {
    if (parent.aborted) onParent();
    else parent.addEventListener("abort", onParent, { once: true });
  }
  return {
    signal: ctrl.signal,
    done: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", onParent);
    },
  };
}

export async function fetchText(url: string, opts: FetchTextOptions = {}): Promise<{ status: number; text: string }> {
  const { signal, done } = withTimeout(opts.timeoutMs ?? 20_000, opts.signal);
  try {
    const res = await fetch(url, {
      signal,
      redirect: "follow",
      headers: {
        "user-agent": opts.ua ?? BROWSER_UA,
        accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        ...(opts.headers ?? {}),
      },
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok && !(opts.allowStatus ?? []).includes(res.status)) {
      throw new HttpError(res.status, `HTTP ${res.status}`);
    }
    return { status: res.status, text };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const e = err as { name?: string; message?: string; cause?: { code?: string } };
    if (signal.aborted && !(opts.signal?.aborted ?? false)) throw new Error("응답 시간 초과");
    if (opts.signal?.aborted) throw new Error("중단됨");
    const code = e.cause?.code;
    throw new Error(code ? `네트워크 오류 (${code})` : e.message?.split("\n")[0].slice(0, 120) || "네트워크 오류");
  } finally {
    done();
  }
}

export async function fetchJson<T>(url: string, opts: FetchTextOptions = {}): Promise<T> {
  const { text } = await fetchText(url, { ...opts, headers: { accept: "application/json", ...(opts.headers ?? {}) } });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("JSON 이 아닌 응답 (차단되었거나 로그인 페이지)");
  }
}

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–" };

/** HTML 엔티티 디코드 — &quot; &#064; &#x1f979; 등 */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return m;
      try {
        return String.fromCodePoint(code);
      } catch {
        return m;
      }
    }
    const named = NAMED[body.toLowerCase()];
    return named ?? m;
  });
}

/** <meta property="og:xxx" content="…"> / <meta name="description"> → { "og:xxx": …, description: … } */
export function ogTags(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const key = m[1].toLowerCase();
    if (!(key in out)) out[key] = decodeEntities(m[2]);
  }
  // content 가 앞에 오는 변형
  const re2 = /<meta\s+content="([^"]*)"\s+(?:property|name)="([^"]+)"/gi;
  while ((m = re2.exec(html))) {
    const key = m[2].toLowerCase();
    if (!(key in out)) out[key] = decodeEntities(m[1]);
  }
  return out;
}

/** "1.6K" · "815K" · "2.3M" · "9,073" · "1.2만" · "1.3천" · "조회수 8,300회" · "8.3K views" → number */
export function parseCompactNumber(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  const s = raw.replace(/조회수|회|views?|likes?|comments?|좋아요|댓글|개|명/gi, "").replace(/,/g, "").trim();
  const m = /(-?\d+(?:\.\d+)?)\s*([KkMmBb천만억]?)/.exec(s);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return undefined;
  const mult: Record<string, number> = { K: 1e3, k: 1e3, M: 1e6, m: 1e6, B: 1e9, b: 1e9, 천: 1e3, 만: 1e4, 억: 1e8 };
  return Math.round(n * (mult[m[2]] ?? 1));
}

/** 상대/절대 날짜 문자열 → ISO (실패 시 undefined). now 는 테스트용 주입 */
export function relativeToIso(raw: string | undefined | null, now: Date = new Date()): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  // 01/20/26 (Threads) · 2026-01-20
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return new Date(Date.UTC(y, Number(m[1]) - 1, Number(m[2]))).toISOString();
  }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toISOString();
  // 2d · 4h · 1w · 5m (Threads 상대시간)
  m = /^(\d+)\s*([smhdwy])$/i.exec(s);
  const unitMs: Record<string, number> = { s: 1e3, m: 60e3, h: 3600e3, d: 86400e3, w: 7 * 86400e3, y: 365 * 86400e3 };
  if (m) return new Date(now.getTime() - Number(m[1]) * unitMs[m[2].toLowerCase()]).toISOString();
  // 3개월 전 · 11일 전 · 1년 전 · 2주 전 · 5시간 전
  m = /(\d+)\s*(초|분|시간|일|주|개월|달|년)\s*전/.exec(s);
  if (m) {
    const ko: Record<string, number> = { 초: 1e3, 분: 60e3, 시간: 3600e3, 일: 86400e3, 주: 7 * 86400e3, 개월: 30 * 86400e3, 달: 30 * 86400e3, 년: 365 * 86400e3 };
    return new Date(now.getTime() - Number(m[1]) * ko[m[2]]).toISOString();
  }
  // 3 months ago · 2 years ago
  m = /(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/i.exec(s);
  if (m) {
    const en: Record<string, number> = { second: 1e3, minute: 60e3, hour: 3600e3, day: 86400e3, week: 7 * 86400e3, month: 30 * 86400e3, year: 365 * 86400e3 };
    return new Date(now.getTime() - Number(m[1]) * en[m[2].toLowerCase()]).toISOString();
  }
  // September 18, 2026 (Instagram og:description)
  const t = Date.parse(s);
  if (Number.isFinite(t)) return new Date(t).toISOString();
  return undefined;
}

/** 안정적인 짧은 ID — 플랫폼 접두어 + 원본 키 (URL 안전 문자만) */
export function postId(prefix: string, key: string): string {
  return `${prefix}_${key.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40)}`;
}

/** 동시성 제한 map */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, worker));
  return out;
}
