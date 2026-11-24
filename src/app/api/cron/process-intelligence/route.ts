import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { FUTURE_TOPICS } from "@/lib/topics";
import {
  ARTICLE_INTELLIGENCE_MODEL,
  generateArticleIntelligence,
  INTELLIGENCE_PROMPT_VERSION,
} from "@/lib/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const revalidate = 0;

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function dbHeaders(extra: Record<string, string> = {}): HeadersInit {
  return { apikey: supabaseKey, ...extra };
}

type PreviewArticle = {
  url: string;
  title: string;
  summary: string | null;
  source: string | null;
};

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Cron authentication is not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Preview Supabase credentials are not configured." }, { status: 503 });
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Gemini is not configured." }, { status: 503 });
  }

  try {
    // This first controlled run deliberately samples only two research abstracts.
    // Hacker News currently supplies title + discussion score, not a real article excerpt.
    const articlesResponse = await fetch(
      `${supabaseUrl}/rest/v1/preview_articles?select=url,title,summary,source&category=eq.research&order=crawled_at.desc&limit=2`,
      { headers: dbHeaders(), cache: "no-store" }
    );
    if (!articlesResponse.ok) {
      throw new Error(`Could not read Preview research articles (${articlesResponse.status}).`);
    }

    const articles = (await articlesResponse.json()) as PreviewArticle[];
    const results: Array<{ url: string; status: string; topic?: string; reason?: string }> = [];

    for (const article of articles) {
      const contentHash = createHash("sha256")
        .update([article.title, article.summary || ""].join("\n"))
        .digest("hex");

      // Insert a pending work item only when this article has not been processed before.
      const queueResponse = await fetch(
        `${supabaseUrl}/rest/v1/preview_article_intelligence?on_conflict=article_url`,
        {
          method: "POST",
          headers: dbHeaders({
            "Content-Type": "application/json",
            Prefer: "resolution=ignore-duplicates,return=minimal",
          }),
          body: JSON.stringify({
            article_url: article.url,
            processing_status: "pending",
            content_hash: contentHash,
            model_name: ARTICLE_INTELLIGENCE_MODEL,
            prompt_version: INTELLIGENCE_PROMPT_VERSION,
            attempt_count: 0,
          }),
          cache: "no-store",
        }
      );
      if (!queueResponse.ok) {
        throw new Error(`Could not queue a Preview article (${queueResponse.status}).`);
      }

      // Atomic claim: only one invocation can move a pending row to processing.
      const claimResponse = await fetch(
        `${supabaseUrl}/rest/v1/preview_article_intelligence?article_url=eq.${encodeURIComponent(article.url)}&processing_status=eq.pending`,
        {
          method: "PATCH",
          headers: dbHeaders({
            "Content-Type": "application/json",
            Prefer: "return=representation",
          }),
          body: JSON.stringify({
            processing_status: "processing",
            attempt_count: 1,
            processing_error: null,
            updated_at: new Date().toISOString(),
          }),
          cache: "no-store",
        }
      );
      if (!claimResponse.ok) {
        throw new Error(`Could not claim a Preview article (${claimResponse.status}).`);
      }
      const claimed = await claimResponse.json();
      if (!Array.isArray(claimed) || claimed.length === 0) {
        results.push({ url: article.url, status: "already_processed_or_in_progress" });
        continue;
      }

      try {
        const intelligence = await generateArticleIntelligence({
          title: article.title,
          summary: article.summary || "",
          source: article.source || "Unknown",
          url: article.url,
        });
        const topic = intelligence.primaryTopicId
          ? FUTURE_TOPICS.find((item) => item.id === intelligence.primaryTopicId)
          : null;

        const saveResponse = await fetch(
          `${supabaseUrl}/rest/v1/preview_article_intelligence?article_url=eq.${encodeURIComponent(article.url)}`,
          {
            method: "PATCH",
            headers: dbHeaders({
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            }),
            body: JSON.stringify({
              primary_topic_id: intelligence.primaryTopicId,
              primary_topic_label: topic?.name || null,
              secondary_topics: intelligence.secondaryTopicIds,
              relevance_score: intelligence.relevanceScore,
              confidence: intelligence.confidence,
              classification_reason: intelligence.classificationReason,
              what_happened: intelligence.whatHappened,
              why_it_matters: intelligence.whyItMatters,
              opportunities: intelligence.opportunities,
              risks: intelligence.risks,
              evidence_note: intelligence.evidenceNote,
              processing_status: intelligence.isRelevant ? "completed" : "skipped",
              processing_error: null,
              analyzed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }),
            cache: "no-store",
          }
        );
        if (!saveResponse.ok) {
          throw new Error(`Could not save intelligence (${saveResponse.status}).`);
        }
        results.push({
          url: article.url,
          status: intelligence.isRelevant ? "completed" : "skipped",
          topic: topic?.name,
          reason: intelligence.classificationReason,
        });
      } catch (error) {
        const safeMessage = error instanceof Error ? error.message.slice(0, 500) : "Unknown processing error";
        await fetch(
          `${supabaseUrl}/rest/v1/preview_article_intelligence?article_url=eq.${encodeURIComponent(article.url)}`,
          {
            method: "PATCH",
            headers: dbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
            body: JSON.stringify({
              processing_status: "failed",
              processing_error: safeMessage,
              updated_at: new Date().toISOString(),
            }),
            cache: "no-store",
          }
        );
        results.push({ url: article.url, status: "failed", reason: safeMessage });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
      note: "Preview-only controlled batch; maximum two research articles per request.",
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Preview intelligence batch failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Preview intelligence batch failed." },
      { status: 500 }
    );
  }
}
