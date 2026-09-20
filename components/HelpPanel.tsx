/*
 * HelpPanel — Header 아래 "HOW TO USE · 사용법" 접이식 패널.
 * ① 분석 대상 고르기 ② RUN ANALYSIS ③ 결과 보기 3단계(폰 1열 / sm 이상 3열)와
 * "브랜드 입력값은 시안 생성에만 쓰인다"는 안내. 접힘 상태는 localStorage(jev.help.collapsed)에 기억합니다(기본: 펼침).
 */
"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "jev.help.collapsed";
const listeners = new Set<() => void>();
/** 저장소를 못 쓰는 환경(프라이빗 모드 등)에서도 토글이 되도록 메모리에 캐시 */
let cached: boolean | null = null;

function readCollapsed(): boolean {
  if (cached !== null) return cached;
  try {
    cached = window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    cached = false;
  }
  return cached;
}

function writeCollapsed(v: boolean) {
  cached = v;
  try {
    window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
  } catch {
    // 저장 불가 — 메모리 캐시만 유지
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const serverSnapshot = () => false;

const STEPS: ReadonlyArray<{ n: string; title: string; body: string }> = [
  {
    n: "①",
    title: "분석 대상 고르기",
    body:
      "샘플로 먼저 체험하거나, '카테고리 예시 생성'으로 내 업종에 맞는 예시를 만들거나, 경쟁사 캡션을 '직접 붙여넣기'하세요. YouTube 검색은 API 키가 있으면 실제 영상을 가져옵니다.",
  },
  {
    n: "②",
    title: "RUN ANALYSIS",
    body:
      "jev 가 포스트마다 10가지(형식·훅·CTA·페인포인트·사회적 증거·긴급성·톤·명확성·재사용성·시안 가치)를 판정합니다. 48건에 수 초, 비용은 수십 원 수준.",
  },
  {
    n: "③",
    title: "결과 보기",
    body:
      "타일이나 TOP BENCHMARKS 를 누르면 상세 보기(원문·판정·원문 링크)가 열리고, 거기서 우리 브랜드 시안을 만들 수 있습니다. 상위 N개는 자동으로 시안이 생성됩니다.",
  },
];

export default function HelpPanel() {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, serverSnapshot);

  return (
    <section className="panel px-3 py-2.5" aria-label="사용법">
      <div className="flex items-center justify-between">
        <span className="label">
          how to use <span className="normal-case tracking-normal">· 사용법</span>
        </span>
        <button
          type="button"
          onClick={() => writeCollapsed(!collapsed)}
          className="label !text-[10px] !text-ink hover:underline"
          aria-expanded={!collapsed}
          aria-controls="help-panel-body"
        >
          {collapsed ? "펼치기" : "접기"}
        </button>
      </div>

      {!collapsed && (
        <div id="help-panel-body">
          <ol className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {STEPS.map((s) => (
              <li key={s.n} className="flex min-w-0 gap-2">
                <span className="shrink-0 font-mono text-[16px] leading-none text-accent" aria-hidden="true">
                  {s.n}
                </span>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold leading-tight text-ink">{s.title}</div>
                  <p className="mt-1 text-[11px] leading-snug text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-2.5 border-t border-line pt-2 text-[11px] leading-snug text-muted">
            브랜드명·카테고리·핵심 메시지는 시안 생성에만 쓰이고 검색어로는 쓰이지 않습니다.
          </p>
        </div>
      )}
    </section>
  );
}
