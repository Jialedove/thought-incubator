import { NextResponse } from "next/server";
import { cognitiveFunctionSchema } from "@/domain/schemas";
import { errorPayload } from "@/server/errors";
import { resolveModelForFunction } from "@/server/repository";

export const runtime = "nodejs";

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const functionResult = cognitiveFunctionSchema.safeParse(params.get("function"));
  if (!functionResult.success) return NextResponse.json({ ...errorPayload(new Error("认知功能无效")), field: "function" }, { status: 400 });
  const mode = params.get("mode");
  const selectedMode = mode === "mock" || mode === "real" ? mode : "auto";
  try { return NextResponse.json({ resolution: resolveModelForFunction(functionResult.data, selectedMode) }); }
  catch (error) { return NextResponse.json(errorPayload(error, "模型解析失败"), { status: 400 }); }
}
