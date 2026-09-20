/**
 * 서버 전용 환경설정 헬퍼. 클라이언트 컴포넌트에서 import 하지 마세요.
 */

export const DEFAULT_JEV_MODEL = "typesafe-ai/jev";
/** Gateway 모델 ID (node_modules/@ai-sdk/gateway 의 GatewayModelId 목록에 존재) */
export const DEFAULT_DRAFT_MODEL = "anthropic/claude-sonnet-5";

export function gatewayApiKey(): string | undefined {
  const key = process.env.AI_GATEWAY_API_KEY?.trim();
  return key ? key : undefined;
}

export function hasGatewayKey(): boolean {
  return Boolean(gatewayApiKey());
}

export function jevModelId(): string {
  return process.env.JEV_MODEL?.trim() || DEFAULT_JEV_MODEL;
}

export function draftModelId(): string {
  return process.env.DRAFT_MODEL?.trim() || DEFAULT_DRAFT_MODEL;
}

function flag(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "1" || v === "true";
}

/**
 * 데모 모드 판단:
 *  - JEV_DEMO_MODE=1 이면 항상 데모
 *  - 키가 없으면 자동으로 데모 (UI 확인용)
 *  - 요청에서 demo:true 를 보내면 데모
 */
export function resolveMode(requestDemo?: boolean): "live" | "demo" {
  if (requestDemo) return "demo";
  if (flag("JEV_DEMO_MODE")) return "demo";
  return hasGatewayKey() ? "live" : "demo";
}

/** JEV_ZERO_DATA_RETENTION=1 이면 모든 jev 호출에 gateway zeroDataRetention 옵션을 붙입니다 */
export function zeroDataRetention(): boolean {
  return flag("JEV_ZERO_DATA_RETENTION");
}

/** (선택) Jina Reader API 키 — 없으면 익명 한도(분당 20회)로 동작 */
export function jinaApiKey(): string | undefined {
  const k = process.env.JINA_API_KEY?.trim();
  return k ? k : undefined;
}
