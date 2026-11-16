import { NextRequest, NextResponse } from "next/server";
import { crawlFutureTech } from "@/lib/crawler";
import {
  isSupabaseConfigured,
  isMemoryStale,
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
    if (isSupabaseConfigured()) {
      const stale = await isMemoryStale(topic);

      if (forceRefresh || stale) {
        const freshItems = await crawlFutureTech(topic, "all");
        await saveArticlesToMemory(freshItems, topic);
      }

      const rememberedArticles = await getArticlesFromMemory(topic, category);

      return NextResponse.json(
        {
          articles: rememberedArticles,
          updatedAt: new Date().toISOString(),
          source: forceRefresh || stale ? "crawled-and-saved" : "supabase-memory",
        },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
        }
      );
    }

    // Fallback if Supabase env vars are not set yet
    const articles = await crawlFutureTech(topic, category);
    return NextResponse.json(
      {
        articles,
        updatedAt: new Date().toISOString(),
        source: "live-crawl",
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Failed to load news feed:", error);
    return NextResponse.json(
      { error: "Failed to fetch future tech feed", articles: [] },
      { status: 500 }
    );
  }
}
