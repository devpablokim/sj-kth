"use client";

import { useRef, useState } from "react";
import { parseWorkbook } from "@/lib/excel";
import type { Dataset } from "@/lib/types";

interface Props {
  onData: (ds: Dataset) => void;
  onError: (msg: string) => void;
  compact?: boolean;
}

export default function UploadZone({ onData, onError, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      onData(parseWorkbook(buf, file.name));
    } catch (e) {
      onError(e instanceof Error ? e.message : "파일을 읽는 중 오류가 발생했습니다.");
    }
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".xlsx,.xlsm,.xls"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) handleFile(f);
        e.target.value = "";
      }}
    />
  );

  if (compact) {
    return (
      <>
        {input}
        <button
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-white/30 px-3 py-1.5 text-sm text-white transition hover:bg-white/10"
        >
          다른 파일 불러오기
        </button>
      </>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
      className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition ${
        dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white hover:border-blue-400"
      }`}
    >
      {input}
      <div className="text-5xl">📂</div>
      <p className="mt-4 text-lg font-semibold text-slate-700">
        경영지원 마스터 엑셀 파일을 여기에 끌어다 놓거나 클릭해서 선택하세요
      </p>
      <p className="mt-2 text-sm text-slate-500">.xlsx / .xlsm / .xls</p>
      <p className="mt-4 inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
        🔒 파일은 이 브라우저 안에서만 처리되며, 서버로 전송되지 않습니다
      </p>
    </div>
  );
}
