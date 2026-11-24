import { NextRequest, NextResponse } from "next/server";
import {
  isSupabaseConfigured,
  getArticlesFromMemory,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Public, read-only endpoint. Article collection is handled by /api/cron/news.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get("topic") || "all";
  const typeParam = searchParams.get("type") || "all";
  const category =
    typeParam === "news" || typeParam === "research" ? typeParam : "all";

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Article storage is not configured", articles: [] },
      { status: 503 }
    );
  }

  try {
    const articles = await getArticlesFromMemory(topic, category);

    return NextResponse.json(
      {
        articles,
        updatedAt: new Date().toISOString(),
        count: articles.length,
        source: "supabase-cache",
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Article read API failed:", error);
    return NextResponse.json(
      { error: "Unable to load saved articles", articles: [] },
      { status: 500 }
    );
  }
}
