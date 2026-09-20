/*
 * useRun — /api/analyze 의 SSE 스트림을 읽어 RunEvent 를 리듀서로 접는 클라이언트 훅.
 * `data: {json}` 라인이 빈 줄로 구분되어 오며, 청크가 중간에 잘릴 수 있어 버퍼링 후 파싱합니다.
 * 상태: mode, posts, analyses(Map), current, stats, drafts, errors, status(idle|running|done|error),
 * calls(jev/생성 모델 호출 원문 로그 — 최대 500개, clearCalls() 로 비움).
 */
"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { CallLogEntry, Draft, Post, PostAnalysis, RunEvent, RunRequest, RunStats } from "@/lib/types";

export type RunStatus = "idle" | "running" | "done" | "error";

export interface RunError {
  postId?: string;
  message: string;
  at: number;
}

export interface RunState {
  status: RunStatus;
  mode: "live" | "demo" | null;
  jevModel: string | null;
  draftModel: string | null;
  posts: Post[];
  analyses: Map<string, PostAnalysis>;
  /** post_start 를 받았지만 아직 결과가 없는 포스트들 (동시성 > 1) */
  inFlight: string[];
  /** 가장 최근에 시작된 포스트 — 모자이크의 빨간 테두리 */
  current: string | null;
  /** 가장 최근에 완료된 포스트 — 우측 "ANALYZING POST" 패널 */
  lastAnalyzedId: string | null;
  stats: RunStats;
  drafts: Draft[];
  /** 지금 시안을 만들고 있는 원본 포스트 ID */
  drafting: string | null;
  errors: RunError[];
  startedAt: number | null;
  endedAt: number | null;
  /** 사용자가 STOP 으로 중단했는지 */
  stopped: boolean;
  /** jev/생성 모델 호출 원문 로그 (오래된 순, 최대 MAX_CALLS 개) */
  calls: CallLogEntry[];
}

const MAX_CALLS = 500;

export const EMPTY_STATS: RunStats = {
  postsTotal: 0,
  postsRead: 0,
  postsAnalyzed: 0,
  checksRun: 0,
  postsPerSec: 0,
  elapsedMs: 0,
  costUsd: 0,
  costKrw: 0,
  draftsGenerated: 0,
};

type Action =
  | { type: "start"; posts: Post[]; at: number }
  | { type: "event"; event: RunEvent }
  | { type: "client_error"; message: string; at: number }
  | { type: "stopped"; at: number }
  | { type: "stream_end"; at: number }
  | { type: "set_posts"; posts: Post[] }
  | { type: "clear_calls" };

function initialState(posts: Post[]): RunState {
  return {
    status: "idle",
    mode: null,
    jevModel: null,
    draftModel: null,
    posts,
    analyses: new Map(),
    inFlight: [],
    current: null,
    lastAnalyzedId: null,
    stats: { ...EMPTY_STATS, postsTotal: posts.length },
    drafts: [],
    drafting: null,
    errors: [],
    startedAt: null,
    endedAt: null,
    stopped: false,
    calls: [],
  };
}

function reduce(state: RunState, action: Action): RunState {
  switch (action.type) {
    case "set_posts":
      return {
        ...initialState(action.posts),
        mode: state.mode,
        jevModel: state.jevModel,
        draftModel: state.draftModel,
        calls: state.calls,
      };
    case "start":
      // 호출 로그는 실행을 넘어 누적됨 (사용자가 "지우기" 로 비울 때까지)
      return {
        ...initialState(action.posts),
        mode: state.mode,
        jevModel: state.jevModel,
        draftModel: state.draftModel,
        calls: state.calls,
        status: "running",
        startedAt: action.at,
      };
    case "clear_calls":
      return { ...state, calls: [] };
    case "client_error":
      return {
        ...state,
        status: "error",
        endedAt: action.at,
        inFlight: [],
        current: null,
        errors: [...state.errors, { message: action.message, at: action.at }],
      };
    case "stopped":
      return {
        ...state,
        status: state.analyses.size > 0 ? "done" : "idle",
        stopped: true,
        endedAt: action.at,
        inFlight: [],
        current: null,
        drafting: null,
      };
    case "stream_end":
      // run_end 없이 스트림이 끊긴 경우 — 받은 것까지로 완료 처리
      if (state.status !== "running") return state;
      return { ...state, status: "done", endedAt: action.at, inFlight: [], current: null, drafting: null };
    case "event":
      return applyEvent(state, action.event);
    default:
      return state;
  }
}

function applyEvent(state: RunState, e: RunEvent): RunState {
  switch (e.type) {
    case "run_start":
      return {
        ...state,
        mode: e.mode,
        jevModel: e.jevModel,
        draftModel: e.draftModel,
        posts: e.posts.length ? e.posts : state.posts,
        stats: { ...state.stats, postsTotal: e.posts.length || state.posts.length },
        startedAt: state.startedAt ?? e.at,
      };
    case "post_start": {
      const inFlight = state.inFlight.includes(e.postId) ? state.inFlight : [...state.inFlight, e.postId];
      return {
        ...state,
        inFlight,
        current: e.postId,
        stats: { ...state.stats, postsRead: Math.max(state.stats.postsRead, inFlight.length + state.analyses.size) },
      };
    }
    case "post_result": {
      const analyses = new Map(state.analyses);
      analyses.set(e.analysis.postId, e.analysis);
      const inFlight = state.inFlight.filter((id) => id !== e.analysis.postId);
      return {
        ...state,
        analyses,
        inFlight,
        current: state.current === e.analysis.postId ? (inFlight[inFlight.length - 1] ?? null) : state.current,
        lastAnalyzedId: e.analysis.postId,
        stats: mergeStats(state.stats, e.stats),
      };
    }
    case "post_error": {
      const inFlight = state.inFlight.filter((id) => id !== e.postId);
      return {
        ...state,
        inFlight,
        current: state.current === e.postId ? (inFlight[inFlight.length - 1] ?? null) : state.current,
        errors: [...state.errors, { postId: e.postId, message: e.message, at: e.at }],
        stats: mergeStats(state.stats, e.stats),
      };
    }
    case "draft_start":
      return { ...state, drafting: e.sourcePostId, inFlight: [], current: null };
    case "draft_result":
      return {
        ...state,
        drafting: null,
        drafts: [...state.drafts.filter((d) => d.id !== e.draft.id), e.draft],
        stats: mergeStats(state.stats, e.stats),
      };
    case "draft_error":
      return {
        ...state,
        drafting: null,
        errors: [...state.errors, { postId: e.sourcePostId, message: e.message, at: e.at }],
        stats: mergeStats(state.stats, e.stats),
      };
    case "call_log": {
      const calls = state.calls.length >= MAX_CALLS ? state.calls.slice(state.calls.length - MAX_CALLS + 1) : state.calls;
      return { ...state, calls: [...calls, e.entry] };
    }
    case "run_end":
      return {
        ...state,
        status: "done",
        endedAt: e.at,
        inFlight: [],
        current: null,
        drafting: null,
        stats: mergeStats(state.stats, e.stats),
      };
    case "fatal":
      return {
        ...state,
        status: "error",
        endedAt: e.at,
        inFlight: [],
        current: null,
        drafting: null,
        errors: [...state.errors, { message: e.message, at: e.at }],
      };
    default:
      return state;
  }
}

/** 서버 stats 를 신뢰하되 누락 필드는 기존 값을 유지 */
function mergeStats(prev: RunStats, next: RunStats | undefined): RunStats {
  if (!next) return prev;
  return {
    postsTotal: next.postsTotal || prev.postsTotal,
    postsRead: Math.max(prev.postsRead, next.postsRead ?? 0),
    postsAnalyzed: next.postsAnalyzed ?? prev.postsAnalyzed,
    checksRun: next.checksRun ?? prev.checksRun,
    postsPerSec: next.postsPerSec ?? prev.postsPerSec,
    elapsedMs: Math.max(prev.elapsedMs, next.elapsedMs ?? 0),
    costUsd: next.costUsd ?? prev.costUsd,
    costKrw: next.costKrw ?? prev.costKrw,
    draftsGenerated: next.draftsGenerated ?? prev.draftsGenerated,
  };
}

/** SSE 블록(빈 줄로 구분된 덩어리) 하나에서 data: 라인을 모아 JSON 으로 파싱 */
function parseSseBlock(block: string): RunEvent | null {
  const dataLines: string[] = [];
  for (const rawLine of block.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
    // event:/id:/retry:/주석(:) 라인은 무시
  }
  if (dataLines.length === 0) return null;
  const payload = dataLines.join("\n").trim();
  if (!payload || payload === "[DONE]") return null;
  try {
    const parsed: unknown = JSON.parse(payload);
    if (parsed && typeof parsed === "object" && typeof (parsed as { type?: unknown }).type === "string") {
      return parsed as RunEvent;
    }
  } catch {
    // 잘못된 JSON 은 조용히 건너뜀
  }
  return null;
}

export function useRun(initialPosts: Post[]) {
  const [state, dispatch] = useReducer(reduce, initialPosts, initialState);
  const abortRef = useRef<AbortController | null>(null);

  // 언마운트 시 진행 중 요청 정리
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const setPosts = useCallback((posts: Post[]) => {
    dispatch({ type: "set_posts", posts });
  }, []);

  const clearCalls = useCallback(() => {
    dispatch({ type: "clear_calls" });
  }, []);

  const start = useCallback(
    async (request: RunRequest, fallbackPosts: Post[]) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const posts = request.posts?.length ? request.posts : fallbackPosts;
      dispatch({ type: "start", posts, at: Date.now() });

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => "");
          dispatch({
            type: "client_error",
            message: `서버 응답 오류 (${res.status})${text ? `: ${text.slice(0, 300)}` : ""}`,
            at: Date.now(),
          });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const drain = (flush: boolean) => {
          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) >= 0) {
            const block = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const ev = parseSseBlock(block);
            if (ev) dispatch({ type: "event", event: ev });
          }
          if (flush && buffer.trim()) {
            const ev = parseSseBlock(buffer);
            buffer = "";
            if (ev) dispatch({ type: "event", event: ev });
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
          drain(false);
        }
        buffer += decoder.decode();
        drain(true);
        dispatch({ type: "stream_end", at: Date.now() });
      } catch (err) {
        if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
          dispatch({ type: "stopped", at: Date.now() });
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        dispatch({ type: "client_error", message: `스트림 오류: ${message}`, at: Date.now() });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [],
  );

  return { state, start, stop, setPosts, clearCalls };
}
