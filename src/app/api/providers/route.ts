import { NextResponse } from "next/server";
import { providerInputSchema } from "@/domain/schemas";
import { listProviders, removeProvider, saveProvider } from "@/server/repository";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ providers: listProviders() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = providerInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "供应商配置无效" }, { status: 400 });
  return NextResponse.json({ provider: saveProvider(parsed.data) }, { status: 201 });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少供应商 ID" }, { status: 400 });
  removeProvider(id);
  return NextResponse.json({ ok: true });
}
