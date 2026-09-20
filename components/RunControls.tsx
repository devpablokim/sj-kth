/*
 * RunControls — 한 줄 실행 바. 브랜드명 / 카테고리 / 포지셔닝 입력, 시안 개수,
 * RUN ANALYSIS(검정) · STOP · LOAD POSTS JSON(토글 textarea 로 Post[] 붙여넣기, 파싱 실패 시 인라인 에러).
 */
"use client";

import { useState } from "react";
import type { Post, RunRequest } from "@/lib/types";
import type { RunStatus } from "@/lib/client/useRun";

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
  /** 사용자가 붙여넣은 포스트(없으면 샘플) */
  customPosts: Post[] | null;
  onPostsLoaded: (posts: Post[] | null) => void;
  onRun: (request: RunRequest) => void;
  onStop: () => void;
  postsCount: number;
}

const PLATFORMS = new Set(["x", "threads", "youtube", "instagram"]);

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
    posts.push(item as Post);
  }
  return { posts };
}

const inputCls =
  "h-8 min-w-0 rounded-[4px] border border-line bg-panel px-2.5 text-[12px] text-ink placeholder:text-faint focus:border-ink";

export default function RunControls({
  status,
  form,
  onFormChange,
  customPosts,
  onPostsLoaded,
  onRun,
  onStop,
  postsCount,
}: Props) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const running = status === "running";

  const canRun = !running && form.name.trim().length > 0;

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

  const applyJson = () => {
    const result = parsePosts(raw);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    onPostsLoaded(result.posts);
    setOpen(false);
  };

  return (
    <div className="panel px-3 py-2.5">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <span className="label mr-1 hidden lg:inline">our brand</span>
        <input
          className={`${inputCls} w-[150px]`}
          value={form.name}
          onChange={(e) => onFormChange({ ...form, name: e.target.value })}
          placeholder="브랜드명"
          aria-label="우리 브랜드명"
          disabled={running}
          required
        />
        <input
          className={`${inputCls} w-[190px]`}
          value={form.category}
          onChange={(e) => onFormChange({ ...form, category: e.target.value })}
          placeholder="카테고리 (예: 직장인 온라인 클래스)"
          aria-label="브랜드 카테고리"
          disabled={running}
        />
        <input
          className={`${inputCls} flex-1 basis-[260px]`}
          value={form.positioning}
          onChange={(e) => onFormChange({ ...form, positioning: e.target.value })}
          placeholder="포지셔닝 / 핵심 메시지 (예: 출퇴근 20분으로 끝내는 실무 스킬)"
          aria-label="브랜드 포지셔닝"
          disabled={running}
        />
        <label className="flex items-center gap-1.5">
          <span className="label">drafts</span>
          <input
            type="number"
            min={0}
            max={10}
            className={`${inputCls} w-[56px] font-mono tabular`}
            value={form.draftCount}
            onChange={(e) => onFormChange({ ...form, draftCount: Number(e.target.value) })}
            aria-label="생성할 시안 개수"
            disabled={running}
          />
        </label>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="label h-8 rounded-[4px] border border-line bg-panel px-2.5 !text-[10px] text-ink hover:border-ink disabled:opacity-40"
            aria-label="포스트 JSON 붙여넣기 열기/닫기"
            aria-expanded={open}
            disabled={running}
          >
            load posts json
            {customPosts ? <span className="ml-1.5 text-accent">· {postsCount}</span> : null}
          </button>
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
      </form>

      {open && (
        <div className="mt-2.5 border-t border-line pt-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="label">
              paste post[] json <span className="normal-case tracking-normal">— id · platform · brand · handle · url · text (선택: slides, formatHint, metrics, thumbnailUrl)</span>
            </span>
            {customPosts ? (
              <button
                type="button"
                className="label !text-[10px] text-accent hover:underline"
                onClick={() => {
                  onPostsLoaded(null);
                  setRaw("");
                  setError(null);
                }}
                aria-label="샘플 포스트로 되돌리기"
              >
                샘플로 되돌리기
              </button>
            ) : null}
          </div>
          <textarea
            className="thin-scroll h-32 w-full resize-y rounded-[4px] border border-line bg-page p-2 font-mono text-[11px] leading-relaxed text-ink placeholder:text-faint focus:border-ink"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={'[\n  { "id": "p001", "platform": "instagram", "brand": "브랜드", "handle": "@brand", "url": "https://...", "text": "..." }\n]'}
            aria-label="포스트 JSON 입력"
            spellCheck={false}
          />
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={applyJson}
              className="label h-7 rounded-[4px] border border-ink bg-ink px-3 !text-[10px] !text-white"
              aria-label="JSON 적용"
            >
              apply
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="label h-7 rounded-[4px] border border-line px-3 !text-[10px] text-muted hover:text-ink"
              aria-label="닫기"
            >
              close
            </button>
            {error ? (
              <span className="text-[11px] text-accent" role="alert">
                {error}
              </span>
            ) : (
              <span className="text-[11px] text-muted">비워 두면 샘플 48개로 실행합니다.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
