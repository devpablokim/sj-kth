/**
 * Jina Reader(r.jina.ai) — JS 렌더링이 필요한 공개 페이지(Threads 검색/프로필/게시물)를 마크다운으로 읽는 무료 프록시.
 * 키 없이 분당 20회 한도. JINA_API_KEY 가 있으면 Authorization 헤더로 한도를 올립니다.
 */
import { jinaApiKey } from "../env";
import { HttpError, fetchText } from "./http";

const JINA_UA = "pablo-jev-benchmark/1.0 (+https://github.com/devpablokim/sj-kth)";

export interface JinaPage {
  title: string;
  markdown: string;
}

export async function readViaJina(url: string, signal?: AbortSignal): Promise<JinaPage> {
  const key = jinaApiKey();
  let res: { status: number; text: string };
  try {
    // 브라우저형 UA 는 Jina 앞단(Cloudflare)의 봇 챌린지("Just a moment…" 403)에 걸리므로 단순 클라이언트 UA 를 씁니다
    res = await fetchText(`https://r.jina.ai/${url}`, {
      signal,
      timeoutMs: 40_000,
      ua: JINA_UA,
      headers: {
        accept: "text/plain",
        "x-return-format": "markdown",
        "x-timeout": "25",
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.status === 429) throw new Error("Jina Reader 요청 한도(분당 20회) 초과 — 잠시 후 다시 시도하거나 JINA_API_KEY 를 설정하세요");
      if (err.status === 403) throw new Error("Jina Reader 가 요청을 차단(403: 익명 한도 또는 봇 챌린지) — 잠시 후 재시도하거나 JINA_API_KEY(무료 발급)를 설정하세요");
      throw new Error(`Jina Reader 오류 (HTTP ${err.status})`);
    }
    throw err;
  }
  const title = /^Title:\s*(.*)$/m.exec(res.text)?.[1]?.trim() ?? "";
  const idx = res.text.indexOf("Markdown Content:");
  const markdown = idx >= 0 ? res.text.slice(idx + "Markdown Content:".length) : res.text;
  return { title, markdown };
}
