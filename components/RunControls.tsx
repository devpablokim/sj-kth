/*
 * RunControls — "설정" 카드.
 *  A) 우리 브랜드: 브랜드명 · 카테고리 · 핵심 메시지 · 시안 개수 — 시안 생성에만 쓰이고 검색어로는 쓰이지 않음.
 *  B) 분석 대상: 샘플 48건 / 카테고리 예시 생성(POST /api/generate-set) / 직접 붙여넣기(텍스트 → Post[], 고급 JSON) /
 *     YouTube 검색(GET /api/collect/youtube). 결과는 onPostsLoaded(posts, source) 로 올리고, null 이면 샘플로 되돌립니다.
 *  맨 아래: "현재 분석 대상: {label} · {n}건" · RUN ANALYSIS → / STOP (소스 로딩 중엔 비활성).
 */
"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type {
  CollectResponse,
  GenerateSetRequest,
  GenerateSetResponse,
  Platform,
  Post,
  PostFormat,
  PostSource,
  RunRequest,
} from "@/lib/types";
import type { RunStatus } from "@/lib/client/useRun";
import { useElapsedSeconds } from "@/lib/client/useElapsedSeconds";
import { fmtInt, fmtUsd } from "@/lib/format";
import { PLATFORM_NAME } from "./PostTile";

export interface BrandForm {
  name: string;
  category: string;
  positioning: string;
  draftCount: number;
}

interface Props {
  status: RunStatus;
  form: BrandForm;
  onFormChange: (next: BrandForm) => void;
  /** 사용자가 불러온 포스트(없으면 샘플) */
  customPosts: Post[] | null;
  /** posts=null 이면 샘플로 되돌림 */
  onPostsLoaded: (posts: Post[] | null, source: PostSource | null) => void;
  onRun: (request: RunRequest) => void;
  onStop: () => void;
  postsCount: number;
  /** live 가 아니면 예시 생성이 막힘을 설명 */
  mode: "live" | "demo" | null;
  /** 현재 분석 대상 라벨 (예: "샘플 48건", "YouTube 검색") */
  sourceLabel: string;
}

type BenchMode = "sample" | "generate" | "paste" | "youtube";

const BENCH_MODES: ReadonlyArray<{ id: BenchMode; label: string }> = [
  { id: "sample", label: "샘플 48건" },
  { id: "generate", label: "카테고리 예시 생성" },
  { id: "paste", label: "직접 붙여넣기" },
  { id: "youtube", label: "YouTube 검색" },
];

const COUNTS = [12, 24, 48] as const;
type Count = (typeof COUNTS)[number];
function toCount(v: string): Count {
  const n = Number(v);
  return n === 12 || n === 48 ? n : 24;
}

const PLATFORM_IDS: Platform[] = ["x", "threads", "youtube", "instagram"];
const PLATFORMS = new Set<string>(PLATFORM_IDS);

/** 붙여넣은 JSON 을 Post[] 로 최소 검증 (id/platform/brand/handle/url/text 필수) */
function parsePosts(raw: string): { posts: Post[] } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { error: `JSON 파싱 실패: ${e instanceof Error ? e.message : String(e)}` };
  }
  const arr = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { posts?: unknown }).posts)
      ? ((parsed as { posts: unknown[] }).posts)
      : null;
  if (!arr) return { error: "배열([...]) 또는 { posts: [...] } 형태여야 합니다." };
  if (arr.length === 0) return { error: "포스트가 비어 있습니다." };
  if (arr.length > 500) return { error: `최대 500개까지 가능합니다 (현재 ${arr.length}개).` };

  const posts: Post[] = [];
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (!item || typeof item !== "object") return { error: `${i + 1}번째 항목이 객체가 아닙니다.` };
    const o = item as Record<string, unknown>;
    for (const key of ["id", "platform", "brand", "handle", "url", "text"] as const) {
      if (typeof o[key] !== "string" || !(o[key] as string).trim()) {
        return { error: `${i + 1}번째 항목에 "${key}" 문자열이 필요합니다.` };
      }
    }
    if (!PLATFORMS.has(o.platform as string)) {
      return { error: `${i + 1}번째 항목의 platform 은 x | threads | youtube | instagram 중 하나여야 합니다.` };
    }
    if ((o.text as string).length > 4000) return { error: `${i + 1}번째 항목의 text 가 4000자를 넘습니다.` };
    const post = item as Post;
    posts.push({ ...post, source: post.source ?? "pasted" });
  }
  return { posts };
}

/** 슬라이드 마커처럼 보이는 줄: "1." · "1/" · "1)" · "①" */
const SLIDE_MARK = /^\s*(?:\d{1,2}\s*[./)]|[①-⑳])/;

/** 붙여넣은 텍스트를 포스트 단위로 분리 — `---` 줄 또는 빈 줄 두 개 이상 */
function splitPastedPosts(raw: string): string[] {
  const text = `\n${raw.replace(/\r\n?/g, "\n")}\n`;
  return text
    .split(/\n[ \t]*-{3,}[ \t]*\n|\n(?:[ \t]*\n){2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function guessFormat(text: string): PostFormat {
  const marks = text.split("\n").filter((line) => SLIDE_MARK.test(line)).length;
  return marks >= 3 ? "card_news" : "text";
}

function buildPastedPosts(input: {
  brand: string;
  platform: Platform;
  text: string;
  urls: string;
}): { posts: Post[] } | { error: string } {
  const chunks = splitPastedPosts(input.text);
  if (chunks.length === 0) return { error: "포스트 텍스트를 붙여넣으세요." };
  if (chunks.length > 200) return { error: `최대 200개까지 가능합니다 (현재 ${chunks.length}개).` };
  const tooLong = chunks.findIndex((c) => c.length > 4000);
  if (tooLong >= 0) return { error: `${tooLong + 1}번째 포스트가 4000자를 넘습니다.` };

  const urls = input.urls
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean);
  const brand = input.brand.trim().replace(/^@/, "") || "경쟁사";
  const posts: Post[] = chunks.map((text, i) => ({
    id: `u${String(i + 1).padStart(3, "0")}`,
    platform: input.platform,
    brand,
    handle: `@${brand}`,
    url: urls[i] ?? "",
    text,
    formatHint: guessFormat(text),
    source: "pasted",
  }));
  return { posts };
}

/** API 에러 본문 { error } → 메시지 */
function errorOf(json: unknown, status: number): string {
  if (json && typeof json === "object") {
    const e = (json as { error?: unknown }).error;
    if (typeof e === "string" && e.trim()) return e;
  }
  return `서버 응답 오류 (${status})`;
}

const YT_KEY_HINT = "Vercel 환경변수 YOUTUBE_API_KEY 필요 — Google Cloud Console → YouTube Data API v3 키";

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

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent"
      aria-hidden="true"
    />
  );
}

/** input 에서 Enter → 폼 제출 대신 해당 모드의 동작 */
function onEnter(fn: () => void) {
  return (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      fn();
    }
  };
}

export default function RunControls({
  status,
  form,
  onFormChange,
  customPosts,
  onPostsLoaded,
  onRun,
  onStop,
  postsCount,
  mode,
  sourceLabel,
}: Props) {
  const running = status === "running";
  const [benchMode, setBenchMode] = useState<BenchMode>("sample");

  // B-2 카테고리 예시 생성
  const [competitors, setCompetitors] = useState("");
  const [genCount, setGenCount] = useState<Count>(24);
  const [genStartedAt, setGenStartedAt] = useState<number | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<{ n: number; costUsd: number } | null>(null);
  const genAbort = useRef<AbortController | null>(null);
  const genElapsed = useElapsedSeconds(genStartedAt);

  // B-3 직접 붙여넣기
  const [pasteBrand, setPasteBrand] = useState("");
  const [pastePlatform, setPastePlatform] = useState<Platform>("instagram");
  const [pasteText, setPasteText] = useState("");
  const [pasteUrls, setPasteUrls] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteResult, setPasteResult] = useState<number | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonRaw, setJsonRaw] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // B-4 YouTube 검색 (검색어를 손대기 전까지는 카테고리를 그대로 씀)
  const [ytQuery, setYtQuery] = useState<string | null>(null);
  const [ytCount, setYtCount] = useState<Count>(24);
  const [ytStartedAt, setYtStartedAt] = useState<number | null>(null);
  const [ytError, setYtError] = useState<{ message: string; keyHint: boolean } | null>(null);
  const [ytResult, setYtResult] = useState<number | null>(null);
  const ytAbort = useRef<AbortController | null>(null);
  const ytElapsed = useElapsedSeconds(ytStartedAt);
  const ytValue = ytQuery ?? form.category;

  // 언마운트 시 진행 중 요청 정리
  useEffect(() => {
    return () => {
      genAbort.current?.abort();
      ytAbort.current?.abort();
    };
  }, []);

  const sourceLoading = genStartedAt !== null || ytStartedAt !== null;
  const nameMissing = form.name.trim().length === 0;
  const canRun = !running && !sourceLoading && !nameMissing;
  const busy = running || sourceLoading;

  const submit = () => {
    if (!canRun) return;
    const request: RunRequest = {
      brand: {
        name: form.name.trim(),
        category: form.category.trim(),
        positioning: form.positioning.trim(),
      },
      draftCount: Math.max(0, Math.min(10, Math.round(form.draftCount) || 0)),
      ...(customPosts && customPosts.length ? { posts: customPosts } : {}),
    };
    onRun(request);
  };

  const resetToSample = () => {
    onPostsLoaded(null, null);
    setBenchMode("sample");
    setGenResult(null);
    setPasteResult(null);
    setYtResult(null);
  };

  const selectMode = (id: BenchMode) => {
    setBenchMode(id);
    if (id === "sample" && customPosts) resetToSample();
  };

  const generate = async () => {
    const brand = { name: form.name.trim(), category: form.category.trim(), positioning: form.positioning.trim() };
    if (!brand.category) {
      setGenError("위 '우리 브랜드'의 카테고리를 먼저 입력하세요 — 예시는 카테고리를 기준으로 만듭니다.");
      return;
    }
    const list = competitors
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
    const body: GenerateSetRequest = { brand, count: genCount, ...(list.length ? { competitors: list } : {}) };

    genAbort.current?.abort();
    const ctrl = new AbortController();
    genAbort.current = ctrl;
    setGenError(null);
    setGenResult(null);
    setGenStartedAt(Date.now());
    try {
      const res = await fetch("/api/generate-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setGenError(errorOf(json, res.status));
        return;
      }
      const data = json as Partial<GenerateSetResponse> | null;
      const posts = data && Array.isArray(data.posts) ? data.posts : [];
      if (posts.length === 0) {
        setGenError("생성된 포스트가 없습니다. 다시 시도해 주세요.");
        return;
      }
      onPostsLoaded(posts, "generated");
      setGenResult({ n: posts.length, costUsd: typeof data?.costUsd === "number" ? data.costUsd : 0 });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setGenError(`요청 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (genAbort.current === ctrl) {
        genAbort.current = null;
        setGenStartedAt(null);
      }
    }
  };

  const applyPaste = () => {
    const result = buildPastedPosts({ brand: pasteBrand, platform: pastePlatform, text: pasteText, urls: pasteUrls });
    if ("error" in result) {
      setPasteError(result.error);
      setPasteResult(null);
      return;
    }
    setPasteError(null);
    setPasteResult(result.posts.length);
    onPostsLoaded(result.posts, "pasted");
  };

  const applyJson = () => {
    const result = parsePosts(jsonRaw);
    if ("error" in result) {
      setJsonError(result.error);
      return;
    }
    setJsonError(null);
    setPasteError(null);
    setPasteResult(result.posts.length);
    onPostsLoaded(result.posts, "pasted");
    setJsonOpen(false);
  };

  const search = async () => {
    const q = ytValue.trim();
    if (!q) {
      setYtError({ message: "검색어를 입력하세요 (기본값은 위 카테고리).", keyHint: false });
      return;
    }
    ytAbort.current?.abort();
    const ctrl = new AbortController();
    ytAbort.current = ctrl;
    setYtError(null);
    setYtResult(null);
    setYtStartedAt(Date.now());
    try {
      const res = await fetch(`/api/collect/youtube?q=${encodeURIComponent(q)}&max=${ytCount}`, { signal: ctrl.signal });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setYtError({ message: errorOf(json, res.status), keyHint: res.status === 400 });
        return;
      }
      const data = json as Partial<CollectResponse> | null;
      const posts = data && Array.isArray(data.posts) ? data.posts : [];
      if (posts.length === 0) {
        setYtError({ message: "검색 결과가 없습니다. 다른 검색어로 시도해 보세요.", keyHint: false });
        return;
      }
      onPostsLoaded(posts, "youtube");
      setYtResult(posts.length);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setYtError({ message: `요청 실패: ${err instanceof Error ? err.message : String(err)}`, keyHint: false });
    } finally {
      if (ytAbort.current === ctrl) {
        ytAbort.current = null;
        setYtStartedAt(null);
      }
    }
  };

  const generating = genStartedAt !== null;
  const searching = ytStartedAt !== null;
  const canGenerate = !busy && mode !== "demo";

  return (
    <form
      className="panel flex flex-col gap-3 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      aria-label="설정"
    >
      {/* A. 우리 브랜드 */}
      <section aria-label="우리 브랜드">
        <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="label">our brand</span>
          <span className="text-[11px] text-muted">· 시안 생성에 사용</span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,2fr)_84px]">
          <Field label="브랜드명">
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              placeholder="예: 하비탄ai"
              aria-label="우리 브랜드명"
              disabled={running}
              autoComplete="organization"
            />
          </Field>
          <Field label="카테고리">
            <input
              className={inputCls}
              value={form.category}
              onChange={(e) => onFormChange({ ...form, category: e.target.value })}
              placeholder="예: AX 전환 컨설팅 · 교육"
              aria-label="브랜드 카테고리"
              disabled={running}
            />
          </Field>
          <Field label="핵심 메시지 / USP" className="sm:col-span-2 lg:col-span-1">
            <input
              className={inputCls}
              value={form.positioning}
              onChange={(e) => onFormChange({ ...form, positioning: e.target.value })}
              placeholder="예: 3주 만에 실무에 AI 도입하는 클래스"
              aria-label="브랜드 포지셔닝"
              disabled={running}
            />
          </Field>
          <Field label="drafts" className="w-[84px]">
            <input
              type="number"
              min={0}
              max={10}
              className={`${inputCls} font-mono tabular`}
              value={form.draftCount}
              onChange={(e) => onFormChange({ ...form, draftCount: Number(e.target.value) })}
              aria-label="생성할 시안 개수"
              disabled={running}
            />
          </Field>
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-muted">
          이 값은 &lsquo;우리 브랜드 시안&rsquo;을 쓸 때만 사용됩니다. 무엇을 분석할지는 아래 &lsquo;분석 대상&rsquo;에서 고릅니다.
        </p>
      </section>

      {/* B. 분석 대상 */}
      <section aria-label="분석 대상" className="border-t border-line pt-3">
        <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="label">benchmark source</span>
          <span className="text-[11px] text-muted">· 무엇을 분석할지</span>
        </div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="분석 대상 선택">
          {BENCH_MODES.map((m) => {
            const selected = benchMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => selectMode(m.id)}
                disabled={busy}
                className={[
                  "h-7 rounded-[4px] border px-2.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  selected ? "border-ink bg-ink text-white" : "border-line bg-panel text-ink hover:border-ink",
                ].join(" ")}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="mt-2 rounded-[4px] border border-line bg-page p-2.5" role="tabpanel">
          {benchMode === "sample" && (
            <p className="text-[11px] leading-snug text-muted">생산성 앱 카테고리의 가상 브랜드 6곳 48건 (데모용)</p>
          )}

          {benchMode === "generate" && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_88px_auto] sm:items-end">
                <Field label="벤치마크/경쟁 브랜드 (쉼표로 구분, 선택)">
                  <input
                    className={inputCls}
                    value={competitors}
                    onChange={(e) => setCompetitors(e.target.value)}
                    onKeyDown={onEnter(() => {
                      if (canGenerate) void generate();
                    })}
                    placeholder="예: 패스트캠퍼스, 클래스101, 인프런"
                    disabled={busy}
                  />
                </Field>
                <Field label="건수">
                  <select
                    className={selectCls}
                    value={genCount}
                    onChange={(e) => setGenCount(toCount(e.target.value))}
                    disabled={busy}
                    aria-label="생성할 예시 건수"
                  >
                    {COUNTS.map((c) => (
                      <option key={c} value={c}>
                        {c}건
                      </option>
                    ))}
                  </select>
                </Field>
                <button
                  type="button"
                  onClick={() => void generate()}
                  disabled={!canGenerate}
                  className={primaryBtn}
                  aria-label="예시 세트 만들기"
                  aria-busy={generating}
                >
                  {generating ? (
                    <>
                      <Spinner />
                      생성 중… {genElapsed}s
                    </>
                  ) : (
                    "예시 세트 만들기"
                  )}
                </button>
              </div>
              <p className="text-[11px] leading-snug text-muted">
                입력한 카테고리와 브랜드를 참고해 AI가 벤치마크 스타일 포스트를 만들어 판정합니다. 실제 게시물이 아니며 모든
                타일에 &lsquo;예시&rsquo; 표시가 붙습니다. 비용은 약 $0.05 (24건) 수준.
              </p>
              {mode === "demo" && (
                <p className="text-[11px] leading-snug text-accent">
                  예시 생성은 LIVE 모드(AI Gateway 키)에서만 동작합니다 — 지금은 DEMO 모드라 버튼이 비활성화되어 있습니다.
                </p>
              )}
              {genError && (
                <p className="text-[11px] leading-snug text-accent" role="alert">
                  {genError}
                </p>
              )}
              {genResult && !genError && (
                <p className="text-[11px] leading-snug text-ok" aria-live="polite">
                  {fmtInt(genResult.n)}건 생성됨 · {fmtUsd(genResult.costUsd)}
                </p>
              )}
            </div>
          )}

          {benchMode === "paste" && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
                <Field label="브랜드명 (경쟁사)">
                  <input
                    className={inputCls}
                    value={pasteBrand}
                    onChange={(e) => setPasteBrand(e.target.value)}
                    placeholder="예: 클래스101"
                    disabled={busy}
                  />
                </Field>
                <Field label="플랫폼">
                  <select
                    className={selectCls}
                    value={pastePlatform}
                    onChange={(e) => setPastePlatform(PLATFORMS.has(e.target.value) ? (e.target.value as Platform) : "instagram")}
                    disabled={busy}
                    aria-label="플랫폼"
                  >
                    {PLATFORM_IDS.map((p) => (
                      <option key={p} value={p}>
                        {PLATFORM_NAME[p]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="포스트 텍스트 — 여러 개는 빈 줄 두 번 또는 --- 로 구분">
                <textarea
                  className={`${areaCls} min-h-[120px]`}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"첫 번째 포스트 캡션…\n\n\n두 번째 포스트 캡션…\n---\n세 번째 포스트 캡션…"}
                  disabled={busy}
                  spellCheck={false}
                />
              </Field>
              <Field label="원문 URL (한 줄에 하나, 순서대로 매핑, 선택)">
                <textarea
                  className={`${areaCls} min-h-[56px] font-mono text-[11px]`}
                  value={pasteUrls}
                  onChange={(e) => setPasteUrls(e.target.value)}
                  placeholder={"https://www.instagram.com/p/…\nhttps://www.instagram.com/p/…"}
                  disabled={busy}
                  spellCheck={false}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={applyPaste} disabled={busy} className={primaryBtn} aria-label="포스트 불러오기">
                  포스트 불러오기
                </button>
                <button
                  type="button"
                  onClick={() => setJsonOpen((v) => !v)}
                  disabled={busy}
                  className={ghostBtn}
                  aria-expanded={jsonOpen}
                  aria-label="고급: Post[] JSON 붙여넣기 열기/닫기"
                >
                  고급: Post[] JSON
                </button>
                {pasteError ? (
                  <span className="text-[11px] text-accent" role="alert">
                    {pasteError}
                  </span>
                ) : pasteResult !== null ? (
                  <span className="text-[11px] text-ok" aria-live="polite">
                    {fmtInt(pasteResult)}건 불러옴
                  </span>
                ) : null}
              </div>

              {jsonOpen && (
                <div className="border-t border-line pt-2">
                  <div className="label mb-1.5">
                    paste post[] json{" "}
                    <span className="normal-case tracking-normal">
                      — id · platform · brand · handle · url · text (선택: slides, formatHint, metrics, thumbnailUrl)
                    </span>
                  </div>
                  <textarea
                    className={`${areaCls} h-32 font-mono text-[11px]`}
                    value={jsonRaw}
                    onChange={(e) => setJsonRaw(e.target.value)}
                    placeholder={'[\n  { "id": "p001", "platform": "instagram", "brand": "브랜드", "handle": "@brand", "url": "https://...", "text": "..." }\n]'}
                    aria-label="포스트 JSON 입력"
                    spellCheck={false}
                    disabled={busy}
                  />
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={applyJson} disabled={busy} className={primaryBtn} aria-label="JSON 적용">
                      apply
                    </button>
                    <button type="button" onClick={() => setJsonOpen(false)} className={ghostBtn} aria-label="JSON 입력 닫기">
                      close
                    </button>
                    {jsonError && (
                      <span className="text-[11px] text-accent" role="alert">
                        {jsonError}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {benchMode === "youtube" && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_88px_auto] sm:items-end">
                <Field label="검색어 (기본값: 카테고리)">
                  <input
                    className={inputCls}
                    value={ytValue}
                    onChange={(e) => setYtQuery(e.target.value)}
                    onKeyDown={onEnter(() => {
                      if (!busy) void search();
                    })}
                    placeholder="예: AI 컨설팅 교육"
                    disabled={busy}
                  />
                </Field>
                <Field label="건수">
                  <select
                    className={selectCls}
                    value={ytCount}
                    onChange={(e) => setYtCount(toCount(e.target.value))}
                    disabled={busy}
                    aria-label="수집할 영상 수"
                  >
                    {COUNTS.map((c) => (
                      <option key={c} value={c}>
                        {c}개
                      </option>
                    ))}
                  </select>
                </Field>
                <button
                  type="button"
                  onClick={() => void search()}
                  disabled={busy}
                  className={primaryBtn}
                  aria-label="YouTube 검색"
                  aria-busy={searching}
                >
                  {searching ? (
                    <>
                      <Spinner />
                      검색 중… {ytElapsed}s
                    </>
                  ) : (
                    "검색"
                  )}
                </button>
              </div>
              <p className="text-[11px] leading-snug text-muted">
                YouTube Data API 로 실제 영상(제목·설명·조회수·썸네일)을 가져와 판정합니다. 서버에 YOUTUBE_API_KEY 가 있어야 합니다.
              </p>
              {ytError && (
                <div className="text-[11px] leading-snug text-accent" role="alert">
                  <p>{ytError.message}</p>
                  {ytError.keyHint && <p className="mt-0.5 text-muted">{YT_KEY_HINT}</p>}
                </div>
              )}
              {ytResult !== null && !ytError && (
                <p className="text-[11px] leading-snug text-ok" aria-live="polite">
                  {fmtInt(ytResult)}개 영상 수집됨
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 실행 행 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-2.5">
        <div className="min-w-0 flex-1 text-[11px] leading-snug text-muted">
          현재 분석 대상: <span className="font-semibold text-ink">{sourceLabel}</span> · {fmtInt(postsCount)}건
          {customPosts && !running ? (
            <button
              type="button"
              className="ml-2 text-accent hover:underline disabled:opacity-40"
              onClick={resetToSample}
              disabled={sourceLoading}
              aria-label="샘플 포스트로 되돌리기"
            >
              샘플로 되돌리기
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {!running && nameMissing && <span className="text-[11px] text-muted">브랜드명을 입력하면 실행할 수 있어요</span>}
          {running ? (
            <button
              type="button"
              onClick={onStop}
              className="label h-8 rounded-[4px] border border-accent bg-panel px-3 !text-[10px] text-accent hover:bg-accent hover:text-white"
              aria-label="분석 중단"
            >
              stop
            </button>
          ) : (
            <button
              type="submit"
              className="label h-8 rounded-[4px] border border-ink bg-ink px-3.5 !text-[10px] !text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="분석 실행"
              disabled={!canRun}
            >
              run analysis →
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
