import { NextResponse } from "next/server";
import { testProviderConnection } from "@/server/providers/registry";
import { errorPayload } from "@/server/errors";
import { localMutationAllowed } from "@/server/request-guard";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!localMutationAllowed(request)) return NextResponse.json({ ok: false, message: "只允许本机请求" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { id?: string; modelConfigId?: string };
  if (!body.id) return NextResponse.json({ ok: false, message: "缺少供应商 ID" }, { status: 400 });
  try { return NextResponse.json(await testProviderConnection(body.id, body.modelConfigId), { status: 200 }); }
  catch (error) { return NextResponse.json({ ok: false, ...errorPayload(error, "连接测试失败") }, { status: 400 }); }
}
