import { NextResponse } from "next/server";
import { testProviderConnection } from "@/server/providers/registry";
import { localMutationAllowed } from "@/server/request-guard";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!localMutationAllowed(request)) return NextResponse.json({ ok: false, message: "只允许本机请求" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { id?: string };
  if (!body.id) return NextResponse.json({ ok: false, message: "缺少供应商 ID" }, { status: 400 });
  return NextResponse.json(await testProviderConnection(body.id));
}
