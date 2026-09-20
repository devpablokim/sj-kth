/**
 * jev 호출 비용 추정 (서버 전용).
 * live 모드에서는 gateway.getAvailableModels() 로 모델의 토큰당 단가를 조회하고,
 * 실패하거나 단가가 없으면 env(JEV_PRICE_INPUT_PER_M / JEV_PRICE_OUTPUT_PER_M) 또는
 * 기본 상수(1M 토큰당 $0.10 / $0.40)를 "추정치"로 사용합니다.
 */
import { gateway } from "ai";

export interface JevPricing {
  modelId: string;
  /** 입력 토큰 1개당 USD */
  inputPerToken: number;
  /** 출력 토큰 1개당 USD */
  outputPerToken: number;
  /** gateway 에서 실제 단가를 받아왔는지, fallback 상수인지 */
  source: "gateway" | "fallback";
  /** fallback 이면 true — UI 에서 "추정치" 표기용 */
  estimated: boolean;
}

/** 기본 단가 (USD per 1M tokens). 실제 jev 단가는 gateway 모델 목록에서 덮어씁니다. */
export const DEFAULT_JEV_PRICE_INPUT_PER_M = 0.1;
export const DEFAULT_JEV_PRICE_OUTPUT_PER_M = 0.4;

const GATEWAY_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 10 * 60 * 1000;

let cache: { at: number; pricing: JevPricing } | null = null;

function envPerM(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** env 또는 기본 상수 기반의 fallback 단가 */
export function fallbackPricing(modelId: string): JevPricing {
  return {
    modelId,
    inputPerToken: envPerM("JEV_PRICE_INPUT_PER_M", DEFAULT_JEV_PRICE_INPUT_PER_M) / 1_000_000,
    outputPerToken: envPerM("JEV_PRICE_OUTPUT_PER_M", DEFAULT_JEV_PRICE_OUTPUT_PER_M) / 1_000_000,
    source: "fallback",
    estimated: true,
  };
}

function parseUsd(v: string | undefined | null): number | null {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * run 시작 시 한 번 호출합니다.
 * demo 모드이거나 gateway 조회에 실패하면 fallback 단가를 돌려줍니다 (예외를 던지지 않음).
 */
export async function loadPricing(mode: "live" | "demo", modelId: string): Promise<JevPricing> {
  if (mode === "demo") return fallbackPricing(modelId);
  if (cache && cache.pricing.modelId === modelId && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.pricing;
  }

  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("gateway.getAvailableModels 시간 초과")), GATEWAY_TIMEOUT_MS),
    );
    const { models } = await Promise.race([gateway.getAvailableModels(), timeout]);
    const entry = models.find((m) => m.id === modelId);
    const input = parseUsd(entry?.pricing?.input);
    const output = parseUsd(entry?.pricing?.output);
    if (input !== null && output !== null) {
      const pricing: JevPricing = {
        modelId,
        inputPerToken: input,
        outputPerToken: output,
        source: "gateway",
        estimated: false,
      };
      cache = { at: Date.now(), pricing };
      return pricing;
    }
  } catch (err) {
    console.warn("[pricing] gateway 단가 조회 실패, fallback 사용:", err instanceof Error ? err.message : err);
  }
  return fallbackPricing(modelId);
}

/** 토큰 사용량 → USD. usage 필드가 없으면 0 으로 취급합니다. */
export function costFor(
  usage: { inputTokens?: number | null; outputTokens?: number | null } | undefined,
  pricing: JevPricing,
): number {
  const input = usage?.inputTokens ?? 0;
  const output = usage?.outputTokens ?? 0;
  return input * pricing.inputPerToken + output * pricing.outputPerToken;
}
