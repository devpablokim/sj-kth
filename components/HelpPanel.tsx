/*
 * HelpPanel — Header 아래 "HOW TO USE · 사용법" 접이식 패널.
 * ① 분석 대상 고르기 ② RUN ANALYSIS ③ 결과 보기 3단계(폰 1열 / sm 이상 3열)와
 * 무료 수집의 한계 · 브랜드 입력값 용도 안내. 접힘 상태는 localStorage(jev.help.collapsed)에 기억합니다(기본: 펼침).
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
    title: "실제 게시물 수집 (무료, 기본)",
    body:
      "검색어(기본값은 카테고리)로 YouTube · Threads 를 검색하고, 벤치마크 계정(@handle)과 게시물 URL(X · Threads · Instagram · YouTube)을 넣으면 API 키 없이 공개 페이지에서 실제 게시물을 가져옵니다. 경로별 성공/실패가 그대로 표시됩니다.",
  },
  {
    n: "②",
    title: "수집 후 분석 실행",
    body:
      "jev 가 먼저 '우리 카테고리와 관련된 마케팅 콘텐츠인가'를 걸러(관문) 무관한 글을 제외하고, 남은 포스트마다 10가지 질문 + 형식별 세부 구조를 판정합니다. 확신도가 낮으면 한 번 더 물어 답이 흔들리는지 확인합니다.",
  },
  {
    n: "③",
    title: "결과 보기 · 시안",
    body:
      "타일이나 TOP BENCHMARKS 를 누르면 상세 보기(원문 · 판정 · 원문 링크)가 열립니다. 상위 N개는 우리 브랜드 시안이 자동 생성되고, 시안마다 브랜드 안전 · 표시광고 위험 · 타깃 적합 · 포지셔닝 모순 · 완성도를 심사해 승인/검토/차단을 표시합니다.",
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
            무료 수집의 한계: X 는 게시물 URL 단위(계정 타임라인은 X 가 자주 막음), Instagram 은 게시물 URL 단위(계정 조회는 자주 차단)로만 안정적입니다. 키워드 검색은
            YouTube · Threads 에서 됩니다. 브랜드명·카테고리·핵심 메시지는 관문 판정(관련성)과 시안 생성에 쓰이며, 카테고리는 검색어 기본값이 됩니다.
          </p>
        </div>
      )}
    </section>
  );
}
