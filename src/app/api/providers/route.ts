import { NextResponse } from "next/server";
import { providerInputSchema } from "@/domain/schemas";
import { listProviders, removeProvider, saveProvider } from "@/server/repository";
import { localMutationAllowed } from "@/server/request-guard";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ providers: listProviders() });
}

export async function POST(request: Request) {
  if (!localMutationAllowed(request)) return NextResponse.json({ error: "只允许本机请求" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const parsed = providerInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "供应商配置无效" }, { status: 400 });
  try { return NextResponse.json({ provider: saveProvider(parsed.data) }, { status: parsed.data.id ? 200 : 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "供应商保存失败" }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  if (!localMutationAllowed(request)) return NextResponse.json({ error: "只允许本机请求" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少供应商 ID" }, { status: 400 });
  removeProvider(id);
  return NextResponse.json({ ok: true });
}
