/**
 * POST /api/analyze — 실행 요청을 받아 파이프라인 이벤트를 SSE(text/event-stream)로 흘려보냅니다.
 * 본문은 zod 로 검증(포스트 최대 500개, 텍스트 최대 4000자). 클라이언트가 끊으면 파이프라인을 중단합니다.
 * API 키는 서버에서만 읽으며 어떤 이벤트에도 포함되지 않습니다.
 */
import { z } from "zod";
import type { RunEvent, RunRequest } from "@/lib/types";
import { runPipeline, safeErrorMessage } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const platformSchema = z.enum(["x", "threads", "youtube", "instagram"]);
const formatSchema = z.enum(["card_news", "short_video", "long_video", "text", "thread", "image"]);

const postSchema = z.object({
  id: z.string().min(1).max(64),
  platform: platformSchema,
  brand: z.string().min(1).max(80),
  handle: z.string().max(80).default(""),
  url: z.string().max(500).default(""),
  text: z.string().min(1).max(4000),
  slides: z.array(z.string().max(1000)).max(12).optional(),
  thumbnailUrl: z.string().max(500).optional(),
  formatHint: formatSchema.optional(),
  postedAt: z.string().max(40).optional(),
  metrics: z
    .object({
      likes: z.number().nonnegative().optional(),
      comments: z.number().nonnegative().optional(),
      shares: z.number().nonnegative().optional(),
      views: z.number().nonnegative().optional(),
    })
    .optional(),
});

const bodySchema = z.object({
  posts: z.array(postSchema).max(500).optional(),
  brand: z.object({
    name: z.string().max(80).default(""),
    category: z.string().max(120).default(""),
    positioning: z.string().max(300).default(""),
  }),
  draftCount: z.number().int().min(0).max(10).default(3),
  demo: z.boolean().optional(),
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
