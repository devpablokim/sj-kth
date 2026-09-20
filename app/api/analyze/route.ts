/**
 * POST /api/analyze — 실행 요청을 받아 파이프라인 이벤트를 SSE(text/event-stream)로 흘려보냅니다.
 * 본문은 zod 로 검증(포스트 최대 500개, 텍스트 최대 4000자, 판정 옵션). 클라이언트가 끊으면 파이프라인을 중단합니다.
 * API 키는 서버에서만 읽으며 어떤 이벤트에도 포함되지 않습니다.
 */
import { z } from "zod";
import type { RunEvent, RunRequest } from "@/lib/types";
import { runPipeline, safeErrorMessage } from "@/lib/pipeline";
import { brandSchema, judgeOptionsSchema, postSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  posts: z.array(postSchema).max(500).optional(),
  brand: brandSchema,
  draftCount: z.number().int().min(0).max(10).default(3),
  demo: z.boolean().optional(),
  options: judgeOptionsSchema,
});

const HEARTBEAT_MS = 15_000;

export async function POST(req: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "본문이 올바른 JSON 이 아닙니다." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    return Response.json({ error: "요청 형식 오류", issues }, { status: 400 });
  }
  const request: RunRequest = parsed.data;

  const encoder = new TextEncoder();
  const aborter = new AbortController();
  const onReqAbort = () => aborter.abort();
  req.signal.addEventListener("abort", onReqAbort);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
          aborter.abort();
        }
      };
      const send = (e: RunEvent) => write(`data: ${JSON.stringify(e)}\n\n`);
      const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
      const finish = () => {
        clearInterval(heartbeat);
        req.signal.removeEventListener("abort", onReqAbort);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* 이미 닫힘 */
          }
        }
      };

      runPipeline(request, send, aborter.signal)
        .catch((err: unknown) => {
          if (!aborter.signal.aborted) send({ type: "fatal", message: safeErrorMessage(err), at: Date.now() });
        })
        .finally(finish);
    },
    cancel() {
      // 클라이언트가 연결을 끊음 → 파이프라인 중단
      aborter.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
