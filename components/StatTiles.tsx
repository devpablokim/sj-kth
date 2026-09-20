/*
 * StatTiles — 상단 6개 스탯 타일. 좌측 3개(POSTS READ · CHECKS RUN 검정, POSTS ANALYZED 흰),
 * 우측 3개(POSTS / SEC · ELAPSED · COST SO FAR 흰). 값이 바뀔 때 짧게 깜빡입니다.
 */
"use client";

import type { RunStats } from "@/lib/types";
import { fmtFixed, fmtInt, fmtSec, fmtUsd } from "@/lib/format";

/** ₩ 표시 — 100원 미만은 소수 1자리(₩17.2), 그 이상은 정수 콤마 */
function fmtKrw(krw: number | undefined | null): string {
  if (!krw || !Number.isFinite(krw)) return "0";
  return krw < 100 ? fmtFixed(krw, 1) : fmtInt(krw);
}

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
  sub,
  flick = true,
}: {
  label: string;
  value: string;
  dark?: boolean;
  hint?: string;
  /** 값이 바뀔 때 깜빡임 — 100ms 마다 갱신되는 ELAPSED 는 끄지 않으면 계속 반투명으로 보임 */
  flick?: boolean;
  /** 큰 숫자 아래 9px 보조 줄 (예: ≈ ₩17.2 · 추정치). 모든 타일이 같은 높이를 갖도록 빈 줄도 렌더 */
  sub?: string;
}) {
  return (
    <div
      className={[
        "panel flex min-w-0 flex-col justify-between gap-2 px-3 py-2.5 sm:min-w-[128px]",
        dark ? "!border-ink !bg-ink text-white" : "",
      ].join(" ")}
      title={hint}
    >
      <span className={["label", dark ? "!text-white/60" : ""].join(" ")}>{label}</span>
      <div className="flex flex-col gap-1">
        <span
          key={flick ? value : "static"}
          className={["tabular font-mono text-[22px] font-bold leading-none", flick ? "flick" : ""].join(" ")}
        >
          {value}
        </span>
        <span
          className={["tabular block min-h-[9px] font-mono text-[9px] leading-none", dark ? "text-white/50" : "text-muted"].join(" ")}
          aria-hidden={sub ? undefined : true}
        >
          {sub ?? ""}
        </span>
      </div>
    </div>
  );
}

export default function StatTiles({ stats, elapsedMs, costIsEstimate }: Props) {
  const elapsed = Math.max(stats.elapsedMs, elapsedMs);
  return (
    <div className="flex flex-wrap items-stretch justify-between gap-2">
      <div className="grid w-full grid-cols-3 gap-2 sm:w-auto">
        <Tile label="posts read" value={fmtInt(stats.postsRead)} dark hint="판정을 시작한 포스트 수" />
        <Tile label="checks run" value={fmtInt(stats.checksRun)} dark hint="포스트 × 질문 수" />
        <Tile label="posts analyzed" value={fmtInt(stats.postsAnalyzed)} hint="판정이 끝난 포스트 수" />
      </div>
      <div className="grid w-full grid-cols-3 gap-2 sm:w-auto">
        <Tile label="posts / sec" value={fmtFixed(stats.postsPerSec, 1)} hint="초당 판정 처리량" />
        <Tile label="elapsed" value={fmtSec(elapsed, 1)} hint="경과 시간 (초)" flick={false} />
        <Tile
          label={costIsEstimate ? "cost so far ≈" : "cost so far"}
          value={fmtUsd(stats.costUsd, 4)}
          sub={`≈ ₩${fmtKrw(stats.costKrw)}${costIsEstimate ? " · 추정치" : ""}`}
          hint={costIsEstimate ? "추정치 — 가격표를 못 가져와 기본 단가로 계산 (₩ 환산 KRW_PER_USD)" : "AI Gateway 가격 기준 누적 비용 (₩ 환산 KRW_PER_USD)"}
        />
      </div>
    </div>
  );
}
