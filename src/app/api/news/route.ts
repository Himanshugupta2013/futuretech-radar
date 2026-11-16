import { NextRequest, NextResponse } from "next/server";
import { crawlFutureTech } from "@/lib/crawler";
import {
  isSupabaseConfigured,
  saveArticlesToMemory,
  getArticlesFromMemory,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get("topic") || "all";
  const typeParam = searchParams.get("type") || "all";
  const forceRefresh = searchParams.get("force") === "true";
  const category =
    typeParam === "news" || typeParam === "research" ? typeParam : "all";

  try {
    // 1. Always force a fresh crawl if requested or if memory is empty
    const existingArticles = isSupabaseConfigured() 
      ? await getArticlesFromMemory(topic, category) 
      : [];

    if (forceRefresh || existingArticles.length === 0) {
      console.log("Triggering live crawler for topic:", topic);
      const freshItems = await crawlFutureTech(topic, "all");
      console.log("Crawler fetched items count:", freshItems.length);

      if (freshItems.length > 0 && isSupabaseConfigured()) {
        await saveArticlesToMemory(freshItems, topic);
      }
    }

    const finalArticles = isSupabaseConfigured()
      ? await getArticlesFromMemory(topic, category)
      : await crawlFutureTech(topic, category);

    return NextResponse.json(
      {
        articles: finalArticles,
        updatedAt: new Date().toISOString(),
        count: finalArticles.length,
        source: forceRefresh ? "refreshed-live" : "cached-or-live",
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("API Error details:", error);
    return NextResponse.json(
      { error: String(error), articles: [] },
      { status: 500 }
    );
  }
}
