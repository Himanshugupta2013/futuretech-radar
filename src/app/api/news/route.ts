import { NextRequest, NextResponse } from "next/server";
import { crawlFutureTech } from "@/lib/crawler";

// Force Vercel/Next.js to run this route dynamically on every request instead of serving a static cached snapshot
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get("topic") || "all";
  const typeParam = searchParams.get("type") || "all";
  const type =
    typeParam === "news" || typeParam === "research" ? typeParam : "all";

  try {
    const articles = await crawlFutureTech(topic, type);
    return NextResponse.json(
      {
        articles,
        crawledAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Crawl error:", error);
    return NextResponse.json(
      { error: "Failed to fetch live news feed", articles: [] },
      { status: 500 }
    );
  }
}
