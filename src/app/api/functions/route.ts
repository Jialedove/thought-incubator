import { NextResponse } from "next/server";
import { functionModelsSchema } from "@/domain/schemas";
import { errorPayload } from "@/server/errors";
import { listFunctionModels, listModels, listProviders, saveFunctionModels } from "@/server/repository";
import { localMutationAllowed } from "@/server/request-guard";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ models: listFunctionModels(), providers: listProviders(), availableModels: listModels() });
}

export async function POST(request: Request) {
  if (!localMutationAllowed(request)) return NextResponse.json({ error: "只允许本机请求" }, { status: 403 });
  const parsed = functionModelsSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ...errorPayload(new Error("认知功能分配无效")), fieldErrors: Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path.join(".") || "form"), issue.message])) }, { status: 400 });
  try { return NextResponse.json({ models: saveFunctionModels(parsed.data.models) }); }
  catch (error) { return NextResponse.json(errorPayload(error, "认知功能分配保存失败"), { status: 400 }); }
}
