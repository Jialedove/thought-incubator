import { NextResponse } from "next/server";
import { createSessionSchema } from "@/domain/schemas";
import { createSession, listSessions } from "@/server/repository";
import { localMutationAllowed } from "@/server/request-guard";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ sessions: listSessions() });
}

export async function POST(request: Request) {
  if (!localMutationAllowed(request)) return NextResponse.json({ error: "只允许本机请求" }, { status: 403 });
  const parsed = createSessionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "会话标题无效" }, { status: 400 });
  return NextResponse.json({ session: createSession(parsed.data.title) }, { status: 201 });
}
