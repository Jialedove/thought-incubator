import { NextResponse } from "next/server";
import { decisionActionSchema } from "@/domain/schemas";
import { decideNode } from "@/server/repository";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  await context.params;
  const parsed = decisionActionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "确认操作无效" }, { status: 400 });
  try {
    return NextResponse.json({ bundle: decideNode(parsed.data.nodeId, parsed.data.action, parsed.data.note) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "状态更新失败" }, { status: 400 });
  }
}
