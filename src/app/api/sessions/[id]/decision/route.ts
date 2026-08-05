import { NextResponse } from "next/server";
import { decisionActionSchema } from "@/domain/schemas";
import { errorPayload } from "@/server/errors";
import { decideNode } from "@/server/repository";
import { localMutationAllowed } from "@/server/request-guard";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!localMutationAllowed(request)) return NextResponse.json({ error: "只允许本机请求" }, { status: 403 });
  const { id } = await context.params;
  const parsed = decisionActionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "确认操作无效" }, { status: 400 });
  try {
    return NextResponse.json({ bundle: decideNode(id, parsed.data.nodeId, parsed.data.action, parsed.data.note, parsed.data.content) });
  } catch (error) {
    return NextResponse.json(errorPayload(error, "状态更新失败"), { status: 400 });
  }
}
