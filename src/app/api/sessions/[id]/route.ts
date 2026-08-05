import { NextResponse } from "next/server";
import { deleteSession, getSessionBundle, updateSessionStatus } from "@/server/repository";
import { localMutationAllowed } from "@/server/request-guard";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const bundle = getSessionBundle(id);
  return bundle ? NextResponse.json(bundle) : NextResponse.json({ error: "会话不存在" }, { status: 404 });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!localMutationAllowed(_request)) return NextResponse.json({ error: "只允许本机请求" }, { status: 403 });
  const { id } = await context.params;
  deleteSession(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!localMutationAllowed(request)) return NextResponse.json({ error: "只允许本机请求" }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as { status?: "active" | "paused" | "matured" | "archived" };
  if (!body.status) return NextResponse.json({ error: "缺少会话状态" }, { status: 400 });
  try { return NextResponse.json({ session: updateSessionStatus(id, body.status) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "会话更新失败" }, { status: 400 }); }
}
