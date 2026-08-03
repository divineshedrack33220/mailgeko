import { NextRequest, NextResponse } from "next/server";
import mjml from "mjml";

export const runtime = "nodejs";

const MAX_INPUT = 512 * 1024;

export async function POST(req: NextRequest) {
  let input: string;
  try {
    const body = await req.json();
    input = typeof body?.mjml === "string" ? body.mjml : "";
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!input.trim()) {
    return NextResponse.json({ error: "mjml is required" }, { status: 400 });
  }
  if (input.length > MAX_INPUT) {
    return NextResponse.json({ error: "mjml is too large" }, { status: 413 });
  }

  try {
    const { html, errors } = await mjml(input, { validationLevel: "soft" });
    return NextResponse.json({ html, errors: errors ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed to render MJML" },
      { status: 422 }
    );
  }
}
