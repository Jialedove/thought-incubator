import { NextResponse } from "next/server";
import { focusNode } from "@/server/repository";
import { localMutationAllowed } from "@/server/request-guard";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!localMutationAllowed(request)) return NextResponse.json({ error: "只允许本机请求" }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as { nodeId?: string };
  if (!body.nodeId) return NextResponse.json({ error: "缺少节点 ID" }, { status: 400 });
  try { return NextResponse.json({ bundle: focusNode(id, body.nodeId) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "焦点切换失败" }, { status: 400 }); }
}
