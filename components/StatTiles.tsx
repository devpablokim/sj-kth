/*
 * StatTiles — 상단 6개 스탯 타일. 좌측 3개(POSTS READ · CHECKS RUN 검정, POSTS ANALYZED 흰),
 * 우측 3개(POSTS / SEC · ELAPSED · COST SO FAR 흰). 값이 바뀔 때 짧게 깜빡입니다.
 */
"use client";

import type { RunStats } from "@/lib/types";
import { fmtFixed, fmtInt, fmtSec, fmtUsd } from "@/lib/format";

interface Props {
  stats: RunStats;
  /** 클라이언트 타이머 기준 경과 ms (실행 중 틱) */
  elapsedMs: number;
  /** live 가 아니면 비용은 추정치 */
  costIsEstimate: boolean;
}

function Tile({
  label,
  value,
  dark = false,
  hint,
}: {
  label: string;
  value: string;
  dark?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={[
        "panel flex min-w-[128px] flex-col justify-between gap-2 px-3 py-2.5",
        dark ? "border-ink bg-ink text-white" : "",
      ].join(" ")}
      title={hint}
    >
      <span className={["label", dark ? "!text-white/60" : ""].join(" ")}>{label}</span>
      <span key={value} className="flick tabular font-mono text-[22px] font-bold leading-none">
        {value}
      </span>
    </div>
  );
}

export default function StatTiles({ stats, elapsedMs, costIsEstimate }: Props) {
  const elapsed = Math.max(stats.elapsedMs, elapsedMs);
  return (
    <div className="flex flex-wrap items-stretch justify-between gap-2">
      <div className="grid grid-cols-3 gap-2">
        <Tile label="posts read" value={fmtInt(stats.postsRead)} dark hint="판정을 시작한 포스트 수" />
        <Tile label="checks run" value={fmtInt(stats.checksRun)} dark hint="포스트 × 질문 수" />
        <Tile label="posts analyzed" value={fmtInt(stats.postsAnalyzed)} hint="판정이 끝난 포스트 수" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Tile label="posts / sec" value={fmtFixed(stats.postsPerSec, 1)} hint="초당 판정 처리량" />
        <Tile label="elapsed" value={fmtSec(elapsed, 1)} hint="경과 시간 (초)" />
        <Tile
          label={costIsEstimate ? "cost so far ≈" : "cost so far"}
          value={fmtUsd(stats.costUsd, 4)}
          hint={costIsEstimate ? "추정치 — 가격표를 못 가져와 기본 단가로 계산" : "AI Gateway 가격 기준 누적 비용"}
        />
      </div>
    </div>
  );
}
