import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { crawlFutureTech } from "@/lib/crawler";
import {
  completeCrawlerRun, createCrawlerRun, failCrawlerRun, isSupabaseConfigured,
  saveArticlesToMemory, getArticlesFromMemory,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get("topic") || "all";
  const typeParam = searchParams.get("type") || "all";
  const forceRefresh = searchParams.get("force") === "true";
  if (forceRefresh) {
    const cronSecret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");
    if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
      console.error("Rejected forced crawler request: missing or invalid CRON_SECRET");
      return NextResponse.json({ error: "Unauthorized crawler trigger" }, { status: 401 });
    }
  }
  const category = typeParam === "news" || typeParam === "research" ? typeParam : "all";
  const existingArticles = isSupabaseConfigured() ? await getArticlesFromMemory(topic, category) : [];
  const shouldCrawl = forceRefresh || existingArticles.length === 0;

  if (!shouldCrawl) {
    return NextResponse.json(
      { articles: existingArticles, updatedAt: new Date().toISOString(), count: existingArticles.length, source: "cache" },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" } }
    );
  }

  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const triggerSource = request.headers.has("x-vercel-cron") ? "vercel-cron" : forceRefresh ? "forced-api" : "cache-miss";
  let fetchedCount = 0;

  try {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured; refusing an untracked crawler run");
    await createCrawlerRun({ id: runId, triggerSource, scope: topic, startedAt });
    console.info("Crawler run started", { runId, triggerSource, topic, startedAt });

    const freshItems = await crawlFutureTech(topic, "all");
    fetchedCount = freshItems.length;
    console.info("Crawler fetch completed", { runId, fetchedCount });
    if (fetchedCount === 0) throw new Error("Crawler returned zero articles; sync timestamp was not advanced");

    const persistedCount = await saveArticlesToMemory(freshItems, topic);
    if (persistedCount !== fetchedCount) throw new Error(`Article persistence count mismatch: fetched ${fetchedCount}, persisted ${persistedCount}`);

    await completeCrawlerRun({ id: runId, scope: topic, fetchedCount, persistedCount });
    console.info("Crawler run succeeded", { runId, fetchedCount, persistedCount, completedAt: new Date().toISOString() });

    const finalArticles = await getArticlesFromMemory(topic, category);
    return NextResponse.json(
      { articles: finalArticles, updatedAt: new Date().toISOString(), count: finalArticles.length, source: "refreshed-live", run: { id: runId, status: "succeeded", fetchedCount, persistedCount } },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" } }
    );
  } catch (error) {
    console.error("Crawler run failed", { runId, triggerSource, topic, fetchedCount, error: error instanceof Error ? error.message : String(error) });
    try {
      await failCrawlerRun(runId, error);
    } catch (recordError) {
      console.error("Unable to persist crawler failure record", { runId, error: recordError instanceof Error ? recordError.message : String(recordError) });
    }
    return NextResponse.json({ error: "Crawler execution failed", run: { id: runId, status: "failed", fetchedCount } }, { status: 500 });
  }
}
