/*
 * CollectPanel — "실제 수집 (무료)" 탭. API 키 없이 공개 페이지에서 실제 게시물을 가져옵니다 (POST /api/collect).
 *  - 검색어(쉼표 구분, 기본값은 카테고리에서 파생) → YouTube · Threads 검색
 *  - 플랫폼 체크 · 벤치마크 계정 @handle (Threads 프로필 · Instagram 프로필 · X 타임라인 — 체크된 플랫폼만)
 *  - 게시물 URL (x.com · threads.com · instagram.com · youtube.com, 한 줄에 하나)
 *  - 건수 상한 · [수집 후 분석 실행 →] / [수집만]
 * 결과: 경로별 보고(✓/✗ · 건수 · ms · 오류)를 그대로 보여주고, 포스트는 onCollected / onCollectAndRun 으로 올립니다.
 */
"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { CollectRequest, CollectResponse, CollectorReport, Platform, Post } from "@/lib/types";
import { useElapsedSeconds } from "@/lib/client/useElapsedSeconds";
import { fmtInt } from "@/lib/format";
import { PLATFORM_NAME } from "./PostTile";

interface Props {
  /** 검색어 기본값을 만들 카테고리 */
  category: string;
  busy: boolean;
  onCollected: (posts: Post[]) => void;
  onCollectAndRun: (posts: Post[]) => void;
  /** 상위 폼에 "수집 중" 상태를 알림 (RUN 비활성화용) */
  onLoadingChange: (loading: boolean) => void;
}

const PLATFORM_IDS: Platform[] = ["youtube", "threads", "instagram", "x"];
const PLATFORM_HINT: Record<Platform, string> = {
  youtube: "검색어 · 영상 URL",
  threads: "검색어 · @계정 · 게시물 URL",
  instagram: "게시물 URL (계정 조회는 자주 차단)",
  x: "게시물 URL (계정 타임라인은 자주 차단)",
};
const MAXES = [24, 48, 96] as const;
type Max = (typeof MAXES)[number];

/** "AI 전환(AX) 컨설팅 · 기업 AI 교육" → ["AI 전환 컨설팅", "기업 AI 교육"] */
export function keywordsFromCategory(category: string): string[] {
  return category
    .split(/[·,/|]/)
    .map((s) => s.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 2)
    .slice(0, 3);
}

function errorOf(json: unknown, status: number): string {
  if (json && typeof json === "object") {
    const o = json as { error?: unknown; issues?: unknown };
    if (typeof o.error === "string" && o.error.trim()) {
      const issues = Array.isArray(o.issues) ? o.issues.filter((i): i is string => typeof i === "string") : [];
      return issues.length ? `${o.error} — ${issues.join(" / ")}` : o.error;
    }
  }
  return `서버 응답 오류 (${status})`;
}

const inputCls =
  "h-8 w-full min-w-0 rounded-[4px] border border-line bg-panel px-2.5 text-[12px] text-ink placeholder:text-faint focus:border-ink disabled:opacity-50";
const selectCls =
  "h-8 w-full min-w-0 rounded-[4px] border border-line bg-panel px-2 text-[12px] text-ink focus:border-ink disabled:opacity-50";
const areaCls =
  "thin-scroll w-full resize-y rounded-[4px] border border-line bg-panel p-2 text-[12px] leading-relaxed text-ink placeholder:text-faint focus:border-ink disabled:opacity-50";
const primaryBtn =
  "label inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[4px] border border-ink bg-ink px-3 !text-[10px] !text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40";
const ghostBtn =
  "label inline-flex h-8 shrink-0 items-center rounded-[4px] border border-line bg-panel px-2.5 !text-[10px] !text-ink hover:border-ink disabled:opacity-40";

function isEnter(e: KeyboardEvent<HTMLInputElement>): boolean {
  if (e.key !== "Enter" || e.nativeEvent.isComposing) return false;
  e.preventDefault();
  return true;
}

export default function CollectPanel({ category, busy, onCollected, onCollectAndRun, onLoadingChange }: Props) {
  /** 사용자가 손대기 전까지는 카테고리에서 파생한 검색어를 씀 */
  const [keywordsInput, setKeywordsInput] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<Set<Platform>>(() => new Set(PLATFORM_IDS));
  const [accounts, setAccounts] = useState("");
  const [urls, setUrls] = useState("");
  const [max, setMax] = useState<Max>(48);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CollectorReport[] | null>(null);
  const [resultCount, setResultCount] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const elapsed = useElapsedSeconds(startedAt);
  const keywordsValue = keywordsInput ?? keywordsFromCategory(category).join(", ");
  const loading = startedAt !== null;

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const collect = async (thenRun: boolean) => {
    const keywords = keywordsValue
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
    const accountList = accounts
      .split(/[,\s]+/)
      .map((s) => s.trim().replace(/^@/, ""))
      .filter(Boolean)
      .slice(0, 10);
    const urlList = urls
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s))
      .slice(0, 40);
    if (keywords.length === 0 && accountList.length === 0 && urlList.length === 0) {
      setError("검색어, 계정, 게시물 URL 중 하나는 넣어 주세요.");
      return;
    }
    const body: CollectRequest = { keywords, platforms: [...platforms], accounts: accountList, urls: urlList, max };
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError(null);
    setReport(null);
    setResultCount(null);
    setStartedAt(Date.now());
    onLoadingChange(true);
    try {
      const res = await fetch("/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setError(errorOf(json, res.status));
        return;
      }
      const data = json as Partial<CollectResponse> | null;
      const posts = data && Array.isArray(data.posts) ? data.posts : [];
      const rep = data && Array.isArray(data.report) ? data.report : [];
      setReport(rep);
      setResultCount(posts.length);
      if (posts.length === 0) {
        setError("수집된 게시물이 없습니다. 아래 경로별 결과를 보고 검색어를 바꾸거나 게시물 URL 을 직접 넣어 보세요.");
        return;
      }
      if (thenRun) onCollectAndRun(posts);
      else onCollected(posts);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(`요청 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        setStartedAt(null);
        onLoadingChange(false);
      }
    }
  };

  const disabled = busy || loading;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_88px]">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="label">검색어 (쉼표로 여러 개 · 기본값은 카테고리) — YouTube · Threads 검색</span>
          <input
            className={inputCls}
            value={keywordsValue}
            onChange={(e) => setKeywordsInput(e.target.value)}
            onKeyDown={(e) => {
              if (isEnter(e) && !disabled) void collect(true);
            }}
            placeholder="예: 기업 AI 교육, AX 컨설팅"
            aria-label="수집 검색어"
            disabled={disabled}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="label">최대 건수</span>
          <select className={selectCls} value={max} onChange={(e) => setMax((Number(e.target.value) as Max) || 48)} disabled={disabled} aria-label="최대 수집 건수">
            {MAXES.map((m) => (
              <option key={m} value={m}>
                {m}건
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" role="group" aria-label="수집 플랫폼">
        <span className="label">플랫폼</span>
        {PLATFORM_IDS.map((p) => (
          <label key={p} className="flex items-center gap-1 text-[11px] text-ink" title={PLATFORM_HINT[p]}>
            <input type="checkbox" checked={platforms.has(p)} onChange={() => togglePlatform(p)} disabled={disabled} className="h-3 w-3 accent-black" />
            {PLATFORM_NAME[p]}
            <span className="hidden text-muted sm:inline">· {PLATFORM_HINT[p]}</span>
          </label>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="label">벤치마크 계정 @handle (쉼표/공백 구분, 선택)</span>
          <textarea
            className={`${areaCls} min-h-[56px] font-mono text-[11px]`}
            value={accounts}
            onChange={(e) => setAccounts(e.target.value)}
            placeholder={"@hobbytan_ai @fastcampus_official\n(Threads 프로필 · Instagram · X 중 체크된 플랫폼에 시도)"}
            aria-label="벤치마크 계정"
            disabled={disabled}
            spellCheck={false}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="label">게시물 URL (한 줄에 하나, 선택) — X · Threads · Instagram · YouTube</span>
          <textarea
            className={`${areaCls} min-h-[56px] font-mono text-[11px]`}
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder={"https://x.com/…/status/…\nhttps://www.threads.com/@…/post/…\nhttps://www.instagram.com/p/…/"}
            aria-label="게시물 URL 목록"
            disabled={disabled}
            spellCheck={false}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void collect(true)} disabled={disabled} className={primaryBtn} aria-label="수집 후 분석 실행" aria-busy={loading}>
          {loading ? (
            <>
              <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" aria-hidden="true" />
              수집 중… {elapsed}s
            </>
          ) : (
            "수집 후 분석 실행 →"
          )}
        </button>
        <button type="button" onClick={() => void collect(false)} disabled={disabled} className={ghostBtn} aria-label="수집만 하기">
          수집만
        </button>
        {resultCount !== null && !error && (
          <span className="text-[11px] text-ok" aria-live="polite">
            {fmtInt(resultCount)}건 수집됨
          </span>
        )}
      </div>
      <p className="text-[11px] leading-snug text-muted">
        API 키 없이 공개 페이지만 읽습니다 (YouTube 검색 페이지 · Threads 는 Jina Reader 렌더링 · X 는 fxtwitter · Instagram 은 링크 미리보기 태그). 플랫폼 정책에 따라 일부 경로는 그때그때 막힐 수 있고, 아래에 경로별로 표시됩니다. 수집된 글은 모두 &lsquo;실제&rsquo; 게시물이며 원문 링크가 열립니다.
      </p>
      {error && (
        <p className="text-[11px] leading-snug text-accent" role="alert">
          {error}
        </p>
      )}
      {report && report.length > 0 && (
        <ul className="flex flex-col gap-0.5 rounded-[4px] border border-line bg-panel p-2" aria-label="수집 경로별 결과">
          {report.map((r) => (
            <li key={r.id} className="flex min-w-0 items-baseline gap-2 text-[11px] leading-snug">
              <span className={`shrink-0 font-mono ${r.ok ? "text-ok" : "text-accent"}`} aria-label={r.ok ? "성공" : "실패"}>
                {r.ok ? "✓" : "✗"}
              </span>
              <span className="min-w-0 flex-1 truncate text-ink" title={`${r.label} · ${r.method}`}>
                {r.label} <span className="text-faint">· {r.method}</span>
              </span>
              <span className="tabular shrink-0 font-mono text-[10px] text-muted">
                {r.ok ? `${fmtInt(r.count)}건` : ""} {r.latencyMs ? `${fmtInt(r.latencyMs)}ms` : ""}
              </span>
              {r.error && <span className="min-w-0 max-w-[55%] truncate text-accent" title={r.error}>{r.error}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
