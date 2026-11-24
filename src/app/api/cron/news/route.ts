import { NextRequest, NextResponse } from "next/server";
import { crawlFutureTech } from "@/lib/crawler";
import {
  isSupabaseConfigured,
  saveArticlesToMemory,
  pruneArticlesFromMemory,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("CRON_SECRET is not configured.");
    return NextResponse.json(
      { error: "Cron authentication is not configured" },
      { status: 500 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 }
    );
  }

  try {
    const articles = await crawlFutureTech("all", "all");
    await saveArticlesToMemory(articles, "all");
    const cleanup = await pruneArticlesFromMemory(180, 200);

    return NextResponse.json({
      success: true,
      crawled: articles.length,
      cleanup,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Scheduled ingestion failed:", error);
    return NextResponse.json(
      { error: "Scheduled ingestion failed" },
      { status: 500 }
    );
  }
}
