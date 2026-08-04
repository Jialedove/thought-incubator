import { NextResponse } from "next/server";
import { cognitiveFunctionSchema } from "@/domain/schemas";
import { listFunctionModels, saveFunctionModel } from "@/server/repository";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ models: listFunctionModels() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { cognitiveFunction?: string; providerId?: string | null; modelId?: string | null };
  const parsed = cognitiveFunctionSchema.safeParse(body.cognitiveFunction);
  if (!parsed.success) return NextResponse.json({ error: "认知功能无效" }, { status: 400 });
  return NextResponse.json({ models: saveFunctionModel(parsed.data, body.providerId ?? null, body.modelId ?? null) });
}
