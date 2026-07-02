import type { Row } from "./types";
import { num } from "./format";
import { pick } from "./metrics";

/** 시트.컬럼별 선택지 (마스터 엑셀의 드롭다운 목록과 동일하게 유지) */
export const OPTIONS: Record<string, string[]> = {
  "매출.사업구분": ["화학설비세정", "하수도준설", "로봇사업", "R&D", "기타"],
  "매출.구분": ["기성", "선급금", "잔금", "정기용역", "제품판매", "기타"],
  "매출.세금계산서": ["발행", "미발행"],
  "매출.수금상태": ["수금완료", "부분수금", "미수"],
  "매입.분류": ["자재비", "외주비", "장비임차료", "유류비", "수리비", "소모품", "운반비", "기타"],
  "매입.지급상태": ["지급완료", "미지급"],
  "프로젝트.사업구분": ["화학설비세정", "하수도준설", "로봇사업", "R&D", "기타"],
  "프로젝트.상태": ["입찰중", "진행중", "완료", "보류"],
  "경비.부서": ["경영지원부", "화학세정사업부", "하수도사업부", "기술연구소", "서산지사"],
  "경비.결제수단": ["법인카드", "계좌이체", "현금"],
  "경비.계정과목": ["복리후생비", "차량유지비", "여비교통비", "접대비", "통신비", "소모품비", "지급수수료", "보험료", "교육훈련비", "임차료", "기타"],
  "인사급여.부서": ["경영지원부", "화학세정사업부", "하수도사업부", "기술연구소", "서산지사"],
  "인사급여.재직상태": ["재직", "휴직", "퇴사"],
  "장비차량.구분": ["무인로봇", "준설차량", "세정장비", "일반차량", "기타"],
  "장비차량.상태": ["가동", "대기", "정비중", "폐기"],
  "거래처.구분": ["매출처", "매입처", "겸용"],
};

/** 자동 계산되는 컬럼 (편집 불가, 원본 엑셀에서 수식인 컬럼) */
export function derivedCols(sheet: string): Set<string> {
  switch (sheet) {
    case "매출":
      return new Set(["부가세", "합계", "미수잔액"]);
    case "매입":
      return new Set(["부가세", "합계"]);
    case "인사급여":
      return new Set(["월급여계"]);
    case "프로젝트":
      return new Set(["매출누계", "계약잔액"]);
    default:
      return new Set();
  }
}

/** 행 안에서 완결되는 파생 컬럼 재계산 (해당 컬럼이 존재할 때만) */
export function recalcRow(sheet: string, row: Row): Row {
  const r = { ...row };
  const has = (k: string) => k in r;
  if (sheet === "매출") {
    if (has("부가세")) r["부가세"] = Math.round(num(r["공급가액"]) * 0.1);
    if (has("합계")) r["합계"] = num(r["공급가액"]) + num(r["부가세"]);
    if (has("미수잔액")) r["미수잔액"] = num(r["합계"]) - num(r["수금액"]);
  } else if (sheet === "매입") {
    if (has("부가세")) r["부가세"] = Math.round(num(r["공급가액"]) * 0.1);
    if (has("합계")) r["합계"] = num(r["공급가액"]) + num(r["부가세"]);
  } else if (sheet === "인사급여") {
    if (has("월급여계")) r["월급여계"] = num(r["기본급"]) + num(r["제수당"]);
  }
  return r;
}

/** 프로젝트 시트의 매출누계·계약잔액을 매출 시트 기준으로 재계산 */
export function recalcProjects(sheets: Record<string, Row[]>): Record<string, Row[]> {
  const proj = sheets["프로젝트"];
  const sales = sheets["매출"];
  if (!proj?.length || !sales) return sheets;
  const sums = new Map<string, number>();
  for (const s of sales) {
    const code = String(s["프로젝트코드"] ?? "").trim();
    if (code) sums.set(code, (sums.get(code) ?? 0) + num(pick(s, "공급가액")));
  }
  const next = proj.map((p) => {
    if (!("매출누계" in p) && !("계약잔액" in p)) return p;
    const q = { ...p };
    const cum = sums.get(String(q["프로젝트코드"] ?? "").trim()) ?? 0;
    if ("매출누계" in q) q["매출누계"] = cum;
    if ("계약잔액" in q) q["계약잔액"] = num(pick(q, "계약금액")) - cum;
    return q;
  });
  return { ...sheets, 프로젝트: next };
}
