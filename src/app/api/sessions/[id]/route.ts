import { NextResponse } from "next/server";
import { deleteSession, getSessionBundle } from "@/server/repository";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const bundle = getSessionBundle(id);
  return bundle ? NextResponse.json(bundle) : NextResponse.json({ error: "会话不存在" }, { status: 404 });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  deleteSession(id);
  return NextResponse.json({ ok: true });
}
