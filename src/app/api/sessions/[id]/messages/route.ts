import { NextResponse } from "next/server";
import { messageSchema } from "@/domain/schemas";
import { errorPayload, ProviderError } from "@/server/errors";
import { previewStreamTurn, streamTurn } from "@/server/repository";
import { localMutationAllowed } from "@/server/request-guard";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!localMutationAllowed(request)) return NextResponse.json({ error: "只允许本机请求" }, { status: 403 });
  const { id } = await context.params;
  const parsed = messageSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "消息内容无效" }, { status: 400 });
  try { previewStreamTurn(id, parsed.data.text, parsed.data.requestedFunction, parsed.data.mode); }
  catch (error) { return NextResponse.json(errorPayload(error, "消息无法开始"), { status: error instanceof ProviderError ? 409 : 400 }); }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (value: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
      void streamTurn(id, parsed.data.text, parsed.data.requestedFunction, {
        onStart: (value) => send({ type: "start", ...value }),
        onDelta: (value) => send({ type: "delta", value }),
      }, request.signal, parsed.data.mode, parsed.data.clientRequestId).then((result) => {
        send({ type: "done", result });
        controller.close();
      }).catch((error: unknown) => {
        if (request.signal.aborted) { controller.close(); return; }
        send({ type: "error", error: errorPayload(error, "消息处理失败") });
        controller.close();
      });
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no", "X-Thought-Mode": "stream" } });
}
