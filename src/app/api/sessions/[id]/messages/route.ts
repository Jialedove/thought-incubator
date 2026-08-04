import { NextResponse } from "next/server";
import { messageSchema } from "@/domain/schemas";
import { appendTurn } from "@/server/repository";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = messageSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "消息内容无效" }, { status: 400 });
  try {
    const result = appendTurn(id, parsed.data.text, parsed.data.requestedFunction);
    return NextResponse.json(result, { headers: { "X-Thought-Mode": "mock" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "消息处理失败" }, { status: 500 });
  }
}
