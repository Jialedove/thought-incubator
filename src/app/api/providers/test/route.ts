import { NextResponse } from "next/server";
import { testProviderConnection } from "@/server/providers/registry";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { id?: string };
  if (!body.id) return NextResponse.json({ ok: false, message: "缺少供应商 ID" }, { status: 400 });
  return NextResponse.json(await testProviderConnection(body.id));
}
