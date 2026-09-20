/*
 * Breakdown — "ALL POSTS  {n} POSTS" 패널. 완료된 판정을 Format / Brand / Hook type 3열로 집계
 * (상위 6개, 막대 = 해당 열 최대값 대비 비율; Hook 열만 빨강 점선). 아래에 확신도 구간 미니 스탯 2칸.
 */
"use client";

import type { Post, PostAnalysis } from "@/lib/types";
import { fmtInt } from "@/lib/format";
import { FORMAT_LABEL_KO, HOOK_LABEL_KO } from "@/lib/scoring";

interface Props {
  posts: Post[];
  analyses: Map<string, PostAnalysis>;
}

interface Row {
  key: string;
  /** 한국어 보조 라벨 (format/hook 만) */
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
              <span className="bar-track w-[72px] shrink-0 sm:w-[64px] lg:w-[80px]">
                <span
                  className={dashed ? "bar-dashed" : "bar"}
                  style={{ width: `${(r.count / max) * 100}%` }}
                  title={`${r.key}: ${r.count}`}
                />
              </span>
              <span className="tabular w-[26px] shrink-0 text-right font-mono text-[10px] text-muted">{fmtInt(r.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Breakdown({ posts, analyses }: Props) {
  const brandOf = new Map(posts.map((p) => [p.id, p.brand] as const));
  const formats = new Map<string, number>();
  const brands = new Map<string, number>();
  const hooks = new Map<string, number>();
  let hi = 0; // confidence ≥ 0.9
  let lo = 0; // confidence < 0.5

  for (const a of analyses.values()) {
    const f = a.answers.format;
    if (f?.type === "choice") formats.set(f.choice, (formats.get(f.choice) ?? 0) + 1);
    const h = a.answers.hook_type;
    if (h?.type === "choice") hooks.set(h.choice, (hooks.get(h.choice) ?? 0) + 1);
    const b = brandOf.get(a.postId) ?? a.postId;
    brands.set(b, (brands.get(b) ?? 0) + 1);
    if (a.confidence >= 0.9) hi += 1;
    if (a.confidence < 0.5) lo += 1;
  }

  const n = analyses.size;
  const pct = (k: number) => (n > 0 ? Math.round((k / n) * 100) : 0);

  return (
    <section className="panel p-3" aria-label="전체 포스트 집계">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="label">all posts</span>
        <span className="label tabular">{fmtInt(n)} posts</span>
      </div>

      {n === 0 ? (
        <div className="flex items-center justify-center py-8 text-center text-[12px] text-muted">
          판정이 쌓이면 형식 · 브랜드 · 훅 유형 분포가 여기에 모입니다
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Column title="Format" rows={topRows(formats, FORMAT_LABEL_KO)} dashed={false} />
          <Column title="Brand" rows={topRows(brands)} dashed={false} />
          <Column title="Hook type" rows={topRows(hooks, HOOK_LABEL_KO)} dashed />
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-2.5">
        <div className="min-w-0">
          <div className="label truncate">confidence ≥ 0.9</div>
          <div className="tabular mt-1 font-mono text-[14px] font-bold leading-none text-ink">
            {fmtInt(hi)} <span className="text-[10px] font-normal text-muted">· {pct(hi)}%</span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="label truncate">confidence &lt; 0.5 · 검토 필요</div>
          <div className="tabular mt-1 font-mono text-[14px] font-bold leading-none text-ink">
            {fmtInt(lo)} <span className="text-[10px] font-normal text-muted">· {pct(lo)}%</span>
          </div>
        </div>
      </div>
    </section>
  );
}
