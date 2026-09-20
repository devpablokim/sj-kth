/*
 * Dashboard — 클라이언트 루트. useRun 으로 SSE 실행 상태를 갖고, 브랜드 폼 · 붙여넣은 포스트 · 선택 타일 ·
 * 열린 시안 · 경과 타이머(100ms)를 관리하며 Header / RunControls / StatTiles / 2열 그리드 / CallLog 를 조립합니다.
 * ≥1024px: 좌 47% ContentFeed, 우 53% (AnalyzingPanel · Breakdown · Drafts). 그 아래 전폭 CallLog.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import type { Draft, Post, RunRequest } from "@/lib/types";
import { useRun } from "@/lib/client/useRun";
import { SAMPLE_POSTS } from "@/data/samplePosts";
import Header from "./Header";
import RunControls, { type BrandForm } from "./RunControls";
import StatTiles from "./StatTiles";
import ContentFeed from "./ContentFeed";
import AnalyzingPanel from "./AnalyzingPanel";
import Breakdown from "./Breakdown";
import Drafts from "./Drafts";
import DraftDrawer from "./DraftDrawer";
import CallLog from "./CallLog";

/** /api/health 응답 중 화면에 쓰는 부분 (키 값은 서버가 절대 내려보내지 않음) */
interface Health {
  mode: "live" | "demo";
  jevModel: string;
  draftModel: string;
}

function parseHealth(v: unknown): Health | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.mode !== "live" && o.mode !== "demo") return null;
  return {
    mode: o.mode,
    jevModel: typeof o.jevModel === "string" ? o.jevModel : "typesafe-ai/jev",
    draftModel: typeof o.draftModel === "string" ? o.draftModel : "",
  };
}

const DEFAULT_FORM: BrandForm = {
  name: "포커스핏",
  category: "직장인 온라인 클래스 / 생산성 앱",
  positioning: "바쁜 직장인을 위한 25분 집중 루틴",
  draftCount: 3,
};

export default function Dashboard() {
  const { state, start, stop, setPosts, clearCalls } = useRun(SAMPLE_POSTS);
  const [form, setForm] = useState<BrandForm>(DEFAULT_FORM);
  const [customPosts, setCustomPosts] = useState<Post[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openDraft, setOpenDraft] = useState<Draft | null>(null);
  /** 실행 중 100ms 마다 갱신되는 "지금" (렌더 중 Date.now() 호출을 피하기 위해 상태로 보관) */
  const [now, setNow] = useState(0);
  /** 실행 전에도 LIVE/DEMO 배지와 모델 ID 를 보여주기 위한 /api/health 결과 */
  const [health, setHealth] = useState<Health | null>(null);

  const running = state.status === "running";

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/health", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: unknown) => {
        const h = parseHealth(j);
        if (h) setHealth(h);
      })
      .catch(() => {
        // health 를 못 읽어도 대시보드는 동작 — 배지만 "— MODE" 로 남음
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [running]);

  const elapsedMs = state.startedAt
    ? Math.max(0, (running ? now : (state.endedAt ?? now)) - state.startedAt)
    : 0;

  const onPostsLoaded = useCallback(
    (posts: Post[] | null) => {
      setCustomPosts(posts);
      setPosts(posts ?? SAMPLE_POSTS);
      setSelectedId(null);
      setOpenDraft(null);
    },
    [setPosts],
  );

  const onRun = useCallback(
    (request: RunRequest) => {
      setSelectedId(null);
      setOpenDraft(null);
      void start(request, customPosts ?? SAMPLE_POSTS);
    },
    [start, customPosts],
  );

  const closeDraft = useCallback(() => setOpenDraft(null), []);

  // "ANALYZING POST" 패널에 보여줄 포스트:
  // 실행 중 in-flight/current → (사용자가 클릭한) selectedId → 마지막 완료 → 첫 완료 → 없음
  const inFlightId = state.current ?? state.inFlight[state.inFlight.length - 1] ?? null;
  const firstAnalyzedId = state.analyses.size > 0 ? [...state.analyses.keys()][0] : null;
  const shownId = inFlightId ?? selectedId ?? state.lastAnalyzedId ?? firstAnalyzedId;
  const shownPost = shownId ? (state.posts.find((p) => p.id === shownId) ?? null) : null;
  const shownAnalysis = shownId ? (state.analyses.get(shownId) ?? null) : null;
  const shownAnalyzing = Boolean(shownId && state.inFlight.includes(shownId));

  const errorIds = new Set(state.errors.flatMap((e) => (e.postId ? [e.postId] : [])));
  const drawerSource = openDraft ? state.posts.find((p) => p.id === openDraft.sourcePostId) : undefined;
  const recentErrors = state.errors.slice(-3);
  const mode = state.mode ?? health?.mode ?? null;

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 p-4">
      <Header
        posts={state.posts}
        source={customPosts ? "custom" : "sample"}
        mode={mode}
        jevModel={state.jevModel ?? health?.jevModel ?? null}
        draftModel={state.draftModel ?? (health?.draftModel || null)}
      />

      <RunControls
        status={state.status}
        form={form}
        onFormChange={setForm}
        customPosts={customPosts}
        onPostsLoaded={onPostsLoaded}
        onRun={onRun}
        onStop={stop}
        postsCount={state.posts.length}
      />

      {state.errors.length > 0 && (
        <div className="-mt-1 flex min-w-0 items-baseline gap-2 px-1 text-[11px] text-accent" role="alert">
          <span className="label shrink-0 !text-accent">errors {state.errors.length}</span>
          <span className="min-w-0 truncate" title={state.errors.map((e) => `${e.postId ? `${e.postId}: ` : ""}${e.message}`).join("\n")}>
            {recentErrors.map((e) => `${e.postId ? `${e.postId}: ` : ""}${e.message}`).join(" · ")}
          </span>
        </div>
      )}

      <StatTiles stats={state.stats} elapsedMs={elapsedMs} costIsEstimate={mode !== "live"} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,47fr)_minmax(0,53fr)]">
        <ContentFeed
          posts={state.posts}
          analyses={state.analyses}
          inFlight={state.inFlight}
          errorIds={errorIds}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
        />
        <div className="flex min-w-0 flex-col gap-3">
          <AnalyzingPanel post={shownPost} analysis={shownAnalysis} analyzing={shownAnalyzing} />
          <Breakdown posts={state.posts} analyses={state.analyses} />
          <Drafts
            drafts={state.drafts}
            drafting={state.drafting}
            posts={state.posts}
            onOpen={setOpenDraft}
            draftCount={form.draftCount}
          />
        </div>
      </div>

      <CallLog calls={state.calls} onClear={clearCalls} />

      {openDraft && <DraftDrawer draft={openDraft} sourcePost={drawerSource} onClose={closeDraft} />}
    </main>
  );
}
