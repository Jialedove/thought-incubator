import { NextResponse } from "next/server";
import { errorPayload } from "@/server/errors";
import { discoverModels } from "@/server/providers/registry";
import { localMutationAllowed } from "@/server/request-guard";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!localMutationAllowed(request)) return NextResponse.json({ error: "只允许本机请求" }, { status: 403 });
  const { id } = await context.params;
  try { return NextResponse.json({ models: await discoverModels(id, request.signal) }); }
  catch (error) { return NextResponse.json(errorPayload(error, "模型发现失败"), { status: 400 }); }
}
