import { NextResponse } from "next/server";
import { modelInputSchema } from "@/domain/schemas";
import { errorPayload } from "@/server/errors";
import { listModels, removeModel, saveModel } from "@/server/repository";
import { localMutationAllowed } from "@/server/request-guard";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return NextResponse.json({ models: listModels(id) });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!localMutationAllowed(request)) return NextResponse.json({ error: "只允许本机请求" }, { status: 403 });
  const { id: providerId } = await context.params;
  const parsed = modelInputSchema.safeParse({ ...(await request.json().catch(() => ({}))), providerId });
  if (!parsed.success) return NextResponse.json({ ...errorPayload(new Error("模型配置无效")), fieldErrors: Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message])) }, { status: 400 });
  try { return NextResponse.json({ model: saveModel(parsed.data) }, { status: parsed.data.id ? 200 : 201 }); }
  catch (error) { return NextResponse.json(errorPayload(error, "模型保存失败"), { status: 400 }); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!localMutationAllowed(request)) return NextResponse.json({ error: "只允许本机请求" }, { status: 403 });
  const { id: providerId } = await context.params;
  const modelId = new URL(request.url).searchParams.get("id");
  if (!modelId) return NextResponse.json({ error: "缺少模型 ID" }, { status: 400 });
  try { const model = listModels(providerId).find((item) => item.id === modelId); if (!model) throw new Error("模型不存在"); removeModel(model.id); return NextResponse.json({ ok: true }); }
  catch (error) { return NextResponse.json(errorPayload(error, "模型删除失败"), { status: 400 }); }
}
