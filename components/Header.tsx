/*
 * Header — 세리프 헤드라인 "find what makes them buy" + 회색 메타라인,
 * 우측에 LIVE/DEMO 모드 배지와 판정/시안 모델 ID.
 */
"use client";

import type { Post } from "@/lib/types";
import { fmtInt } from "@/lib/format";

interface Props {
  posts: Post[];
  mode: "live" | "demo" | null;
  jevModel: string | null;
  draftModel: string | null;
  /** 누적 수집 포스트 수 (표시용) */
  collected?: number;
}

export default function Header({ posts, mode, jevModel, draftModel, collected = 12480 }: Props) {
  const brands = new Set(posts.map((p) => p.brand)).size;
  const platforms = new Set(posts.map((p) => p.platform)).size;

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <h1 className="font-display text-[40px] leading-[1.02] tracking-[-0.02em] text-ink">
          find what makes them buy
        </h1>
        <p className="mt-1.5 text-[12px] leading-snug text-muted">
          {fmtInt(collected)} collected posts · this run: {fmtInt(posts.length)} posts, {brands} brands,{" "}
          {platforms} platforms · every hook, CTA and social proof
        </p>
      </div>

      <div className="flex items-center gap-2 pb-1">
        <span
          className={[
            "label inline-flex h-5 items-center rounded-[3px] border px-2 !text-[9px]",
            mode === "live"
              ? "border-ink bg-ink text-white"
              : mode === "demo"
                ? "border-accent text-accent"
                : "border-line text-muted",
          ].join(" ")}
          title={mode === "live" ? "AI Gateway 키로 실제 jev 판정" : mode === "demo" ? "키 없이 결정적 가짜 판정" : "모드 미확인"}
        >
          {mode === "live" ? "● LIVE" : mode === "demo" ? "○ DEMO" : "— MODE"}
        </span>
        <span className="hidden font-mono text-[10px] text-muted sm:inline" title="판정 모델 · 시안 모델">
          {jevModel ?? "typesafe-ai/jev"}
          {draftModel ? <span className="text-faint"> · {draftModel}</span> : null}
        </span>
      </div>
    </header>
  );
}
