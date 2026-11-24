import { NextRequest, NextResponse } from "next/server";
import { POST as runCronProcessor } from "@/app/api/cron/process-intelligence/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const revalidate = 0;

// A one-time, browser-triggered smoke test for this Preview deployment only.
export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "This test is available only on a Preview deployment." }, { status: 404 });
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) {
    return NextResponse.json({ error: "A same-origin browser request is required." }, { status: 403 });
  }
  try {
    if (new URL(origin).host !== host) {
      return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cronSecret = process.env.CRON_SECRET;
  if (!supabaseUrl || !supabaseKey || !cronSecret) {
    return NextResponse.json({ error: "Preview test configuration is incomplete." }, { status: 503 });
  }

  try {
    // Once any queue row exists, this public button can never spend more Gemini calls.
    const check = await fetch(
      `${supabaseUrl}/rest/v1/preview_article_intelligence?select=article_url&limit=1`,
      { headers: { apikey: supabaseKey }, cache: "no-store" }
    );
    if (!check.ok) {
      return NextResponse.json({ error: "Could not verify the one-time test guard." }, { status: 503 });
    }
    const existing = await check.json();
    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({
        success: false,
        message: "The one-time Preview test has already been started. No additional Gemini requests were made."
      }, { status: 409 });
    }

    // Reuse the existing authenticated processor in-process; the cron secret stays server-side.
    const internalRequest = new NextRequest(request.url, {
      method: "POST",
      headers: { authorization: `Bearer ${cronSecret}` },
    });
    return await runCronProcessor(internalRequest);
  } catch (error) {
    console.error("Preview intelligence test failed:", error);
    return NextResponse.json({ error: "The Preview intelligence test could not be started." }, { status: 500 });
  }
}
