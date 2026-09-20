/*
 * useElapsedSeconds — startedAt(ms epoch)이 주어진 동안 250ms 마다 갱신되는 경과 초.
 * 예시 생성 / YouTube 수집 / 시안 생성 버튼의 "생성 중… {n}s" 표시에 씁니다. startedAt 이 null 이면 0.
 */
"use client";

import { useEffect, useState } from "react";

export function useElapsedSeconds(startedAt: number | null): number {
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (startedAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAt]);

  if (startedAt === null) return 0;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}
