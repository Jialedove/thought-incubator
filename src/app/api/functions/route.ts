import { NextResponse } from "next/server";
import { functionModelsSchema } from "@/domain/schemas";
import { listFunctionModels, saveFunctionModels } from "@/server/repository";
import { localMutationAllowed } from "@/server/request-guard";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ models: listFunctionModels() });
}

export async function POST(request: Request) {
  if (!localMutationAllowed(request)) return NextResponse.json({ error: "只允许本机请求" }, { status: 403 });
  const parsed = functionModelsSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "认知功能分配无效" }, { status: 400 });
  try { return NextResponse.json({ models: saveFunctionModels(parsed.data.models) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "认知功能分配保存失败" }, { status: 400 }); }
}
