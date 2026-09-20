/*
 * JudgementRows — 질문별 판정 행 [라벨 · 값 · 막대 · %] (QUESTION_ORDER 순).
 * AnalyzingPanel(우측 패널)과 PostDrawer(상세 보기)가 함께 씁니다. 검정 실선 = 기본, 빨강 점선 = "따라 해야 할 강점".
 * pending 이면 값 "…" 과 빈 막대를 그립니다. tagsOf() 는 판정에서 true 인 태그 칩 목록.
 */
"use client";

import type { Judgement, PostAnalysis, QuestionId } from "@/lib/types";
import { QUESTION_LABELS, QUESTION_ORDER } from "@/lib/questions";
import { choiceLabel, fmtPct } from "@/lib/format";
import { FORMAT_LABEL_KO, HOOK_LABEL_KO, TONE_LABEL_KO } from "@/lib/scoring";

const CHOICE_KO: Partial<Record<QuestionId, Record<string, string>>> = {
  format: FORMAT_LABEL_KO,
  hook_type: HOOK_LABEL_KO,
  tone: TONE_LABEL_KO,
};

interface RowView {
  id: QuestionId;
  label: string;
  value: string;
  /** 0~1 */
  pct: number;
  /** 빨강 점선 여부 */
  strength: boolean;
}

/** 판정 1개 → 행 표시값. 강점 규칙: pain/social/urgency/draft p≥0.5, cta/imitability/clarity ≥3 */
function rowOf(id: QuestionId, j: Judgement | undefined): RowView {
  const label = QUESTION_LABELS[id];
  if (!j) return { id, label, value: "—", pct: 0, strength: false };
  switch (j.type) {
    case "choice": {
      const ko = CHOICE_KO[id]?.[j.choice];
      const p = j.probabilities?.[j.choice];
      return {
        id,
        label,
        value: ko ? `${choiceLabel(j.choice)} · ${ko}` : choiceLabel(j.choice),
        pct: typeof p === "number" && Number.isFinite(p) ? p : 1,
        strength: false,
      };
    }
    case "boolean": {
      const likely = j.probability >= 0.5;
      const strengthQ: QuestionId[] = ["pain_point", "social_proof", "urgency", "make_draft"];
      return {
        id,
        label,
        value: likely ? "likely" : "unlikely",
        pct: j.probability,
        strength: likely && strengthQ.includes(id),
      };
    }
    case "score": {
      const strengthQ: QuestionId[] = ["cta_strength", "imitability", "clarity"];
      return {
        id,
        label,
        value: `${j.score.toFixed(1)} / ${j.max}`,
        pct: j.max > 0 ? j.score / j.max : 0,
        strength: j.score >= 3 && strengthQ.includes(id),
      };
    }
  }
}

/** 태그 칩 — 판정에서 true 인 것만 */
export function tagsOf(a: PostAnalysis): string[] {
  const t: string[] = [];
  const hook = a.answers.hook_type;
  if (hook?.type === "choice" && hook.choice !== "none") t.push(choiceLabel(hook.choice));
  const cta = a.answers.cta_strength;
  if (cta?.type === "score") t.push(`cta ${Math.round(cta.score)}/${cta.max}`);
  const pain = a.answers.pain_point;
  if (pain?.type === "boolean" && pain.probability >= 0.5) t.push("pain point");
  const proof = a.answers.social_proof;
  if (proof?.type === "boolean" && proof.probability >= 0.5) t.push("social proof");
  const urg = a.answers.urgency;
  if (urg?.type === "boolean" && urg.probability >= 0.5) t.push("urgency");
  return t;
}

interface Props {
  analysis: PostAnalysis | null;
  /** 판정 중(결과 아직 없음) — 값 "…" + 빈 막대 */
  pending?: boolean;
  className?: string;
}

export default function JudgementRows({ analysis, pending = false, className = "" }: Props) {
  const rows = QUESTION_ORDER.map((id) => rowOf(id, analysis?.answers[id]));

  return (
    <div className={className} role="table" aria-label="질문별 판정">
      {rows.map((r) => {
        const width = pending || !analysis ? 0 : Math.max(0, Math.min(1, r.pct)) * 100;
        return (
          <div key={r.id} role="row" className="flex h-[22px] items-center gap-2 border-b border-line last:border-b-0">
            <span role="rowheader" className="label w-[84px] shrink-0 truncate">
              {r.label}
            </span>
            <span
              role="cell"
              className="w-[96px] shrink-0 truncate text-[11px] leading-none text-ink sm:w-[120px]"
              title={r.value}
            >
              {pending ? "…" : r.value}
            </span>
            <span role="cell" className="bar-track min-w-0 flex-1">
              <span
                className={r.strength ? "bar-dashed" : "bar"}
                style={{ width: `${width}%` }}
                title={`${r.label}: ${r.value} (${fmtPct(r.pct)})`}
              />
            </span>
            <span role="cell" className="tabular w-[34px] shrink-0 text-right font-mono text-[10px] text-muted">
              {pending || !analysis ? "—" : fmtPct(r.pct)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
