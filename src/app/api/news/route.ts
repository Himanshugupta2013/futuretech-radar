import { NextRequest, NextResponse } from "next/server";
import { ArticleCategory, crawlFutureTechArticles } from "@/lib/crawler";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const topicId = searchParams.get("topic") ?? "all";
  const rawType = searchParams.get("type") ?? "all";
  const category: "all" | ArticleCategory =
    rawType === "news" || rawType === "research" ? rawType : "all";

  try {
    const data = await crawlFutureTechArticles({ topicId, category });
    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    });
  } catch (error) {
    console.error("Crawl error:", error);
    return NextResponse.json(
      { error: "Failed to crawl latest articles", articles: [], crawledAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}
