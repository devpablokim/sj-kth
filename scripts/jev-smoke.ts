/**
 * jev 연결 확인용 스모크 테스트: `npm run jev:smoke`
 * .env 의 AI_GATEWAY_API_KEY 로 Vercel AI Gateway 의 typesafe-ai/jev 를 한 번 호출합니다.
 */
import { experimental_evaluate as evaluate } from "ai";

try {
  process.loadEnvFile(".env");
} catch {
  // .env 가 없으면 환경변수만 사용
}

async function main(): Promise<void> {
  if (!process.env.AI_GATEWAY_API_KEY?.trim()) {
    console.error("AI_GATEWAY_API_KEY 가 비어 있습니다.");
    console.error("  1) npm run env:init  → .env 생성");
    console.error("  2) Vercel 대시보드 → AI Gateway → API Keys 에서 키 발급 후 .env 에 입력");
    process.exit(1);
  }

  const model = process.env.JEV_MODEL?.trim() || "typesafe-ai/jev";
  const started = Date.now();
  const result = await evaluate({
    model,
    state: "The support agent issued a full refund to the customer.",
    questions: {
      refunded: {
        type: "boolean",
        instructions: "Was a refund issued?",
      },
    },
  });

  console.log(`✓ ${model} 응답 (${Date.now() - started}ms)`);
  console.log("  answers:", JSON.stringify(result.answers));
  console.log("  usage  :", JSON.stringify(result.usage));
  console.log("  model  :", result.response.modelId);
}

main().catch((err: unknown) => {
  const e = err as { name?: string; message?: string; statusCode?: number };
  console.error("✗ jev 호출 실패:", e.name ?? "", e.statusCode ?? "", (e.message ?? String(err)).split("\n")[0]);
  if (e.statusCode === 401) console.error("  → AI_GATEWAY_API_KEY 가 잘못됐거나 만료됐습니다.");
  process.exit(1);
});
