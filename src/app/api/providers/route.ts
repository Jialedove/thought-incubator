import { NextResponse } from "next/server";
import { providerInputSchema } from "@/domain/schemas";
import { errorPayload } from "@/server/errors";
import { listModels, listProviders, removeProvider, saveProvider } from "@/server/repository";
import { localMutationAllowed } from "@/server/request-guard";

export const runtime = "nodejs";

export function GET(request: Request) {
  const providerId = new URL(request.url).searchParams.get("providerId") ?? undefined;
  return NextResponse.json({ providers: listProviders(), models: listModels(providerId) });
}

export async function POST(request: Request) {
  if (!localMutationAllowed(request)) return NextResponse.json({ error: "只允许本机请求" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const parsed = providerInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ...errorPayload(new Error("供应商配置无效")), fieldErrors: Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])) }, { status: 400 });
  try { return NextResponse.json({ provider: saveProvider(parsed.data) }, { status: parsed.data.id ? 200 : 201 }); }
  catch (error) { return NextResponse.json(errorPayload(error, "供应商保存失败"), { status: 400 }); }
}

export async function DELETE(request: Request) {
  if (!localMutationAllowed(request)) return NextResponse.json({ error: "只允许本机请求" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少供应商 ID" }, { status: 400 });
  try { removeProvider(id); return NextResponse.json({ ok: true }); }
  catch (error) { return NextResponse.json(errorPayload(error, "供应商删除失败"), { status: 400 }); }
}
