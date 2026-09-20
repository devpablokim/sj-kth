/*
 * Breakdown — "ALL POSTS  {n} POSTS" 패널. 완료된 판정을 Format / Structure / Hook type / Brand 4열로 집계
 * (상위 6개, 막대 = 해당 열 최대값 대비 비율; Hook 열만 빨강 점선). 아래에 확신도 구간(자동 채택 · 검토 · 불확실) · 관문 제외 미니 스탯.
 */
"use client";

import type { GateResult, Post, PostAnalysis } from "@/lib/types";
import { fmtInt } from "@/lib/format";
import { STRUCTURE_LABEL_KO } from "@/lib/questions";
import { FORMAT_LABEL_KO, HOOK_LABEL_KO } from "@/lib/scoring";

interface Props {
  posts: Post[];
  analyses: Map<string, PostAnalysis>;
  skipped: Map<string, GateResult>;
}

interface Row {
  key: string;
  /** 한국어 보조 라벨 */
  ko?: string;
  count: number;
}

function topRows(counts: Map<string, number>, ko?: Record<string, string>, limit = 6): Row[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count, ko: ko?.[key] }));
}

function Column({ title, rows, dashed }: { title: string; rows: Row[]; dashed: boolean }) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-[11px] font-semibold leading-none text-ink">{title}</div>
      {rows.length === 0 ? (
        <div className="label py-1">—</div>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r) => (
            <li key={r.key} className="flex h-[18px] items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[11px] leading-none text-ink" title={r.ko ? `${r.key} ${r.ko}` : r.key}>
                {r.key}
                {r.ko ? <span className="ml-1 text-muted">{r.ko}</span> : null}
              </span>
              <span className="bar-track w-[56px] shrink-0 lg:w-[64px]">
                <span
                  className={dashed ? "bar-dashed" : "bar"}
                  style={{ width: `${(r.count / max) * 100}%` }}
                  title={`${r.key}: ${r.count}`}
                />
              </span>
              <span className="tabular w-[22px] shrink-0 text-right font-mono text-[10px] text-muted">{fmtInt(r.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, total, accent = false }: { label: string; value: number; total: number; accent?: boolean }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="min-w-0">
      <div className="label truncate">{label}</div>
      <div className={`tabular mt-1 font-mono text-[14px] font-bold leading-none ${accent && value > 0 ? "text-accent" : "text-ink"}`}>
        {fmtInt(value)} <span className="text-[10px] font-normal text-muted">· {pct}%</span>
      </div>
    </div>
  );
}

export default function Breakdown({ posts, analyses, skipped }: Props) {
  const brandOf = new Map(posts.map((p) => [p.id, p.brand] as const));
  const formats = new Map<string, number>();
  const structures = new Map<string, number>();
  const brands = new Map<string, number>();
  const hooks = new Map<string, number>();
  let auto = 0;
  let review = 0;
  let uncertain = 0;

  for (const a of analyses.values()) {
    const f = a.answers.format;
    if (f?.type === "choice") formats.set(f.choice, (formats.get(f.choice) ?? 0) + 1);
    if (a.structure) structures.set(a.structure.choice, (structures.get(a.structure.choice) ?? 0) + 1);
    const h = a.answers.hook_type;
    if (h?.type === "choice") hooks.set(h.choice, (hooks.get(h.choice) ?? 0) + 1);
    const b = brandOf.get(a.postId) ?? a.postId;
    brands.set(b, (brands.get(b) ?? 0) + 1);
    if (a.band === "auto") auto += 1;
    else if (a.band === "review") review += 1;
    else uncertain += 1;
  }

  const n = analyses.size;
  const seen = n + skipped.size;

  return (
    <section className="panel p-3" aria-label="전체 포스트 집계">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="label">all posts</span>
        <span className="label tabular">{fmtInt(n)} posts</span>
      </div>

      {n === 0 ? (
        <div className="flex items-center justify-center py-8 text-center text-[12px] text-muted">
          판정이 쌓이면 형식 · 구조 · 훅 유형 · 브랜드 분포가 여기에 모입니다
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
          <Column title="Format" rows={topRows(formats, FORMAT_LABEL_KO)} dashed={false} />
          <Column title="Structure" rows={topRows(structures, STRUCTURE_LABEL_KO)} dashed={false} />
          <Column title="Hook type" rows={topRows(hooks, HOOK_LABEL_KO)} dashed />
          <Column title="Brand" rows={topRows(brands)} dashed={false} />
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-2.5 sm:grid-cols-4">
        <Stat label="자동 채택 (auto)" value={auto} total={n} />
        <Stat label="검토 권장 (review)" value={review} total={n} />
        <Stat label="불확실 (uncertain)" value={uncertain} total={n} accent />
        <Stat label="관문 제외" value={skipped.size} total={seen} />
      </div>
    </section>
  );
}
