import type { FeedItem } from "./crawler";

const supabaseUrl = process.env.SUPABASE_URL || "";
// Prefer Supabase's current secret key. Keep the legacy service-role variable
// as a migration fallback, but never expose either value to browser code.
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseSecretKey);
}

function supabaseHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    // Supabase's new sb_secret_* keys are opaque API keys, not JWTs.
    // Send them as apikey only; do not put them in Authorization: Bearer.
    apikey: supabaseSecretKey,
    ...extra,
  };
}

export async function isMemoryStale(_topic: string, maxAgeMinutes = 60): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  try {
    // The articles table uses crawled_at (not created_at).
    const res = await fetch(
      `${supabaseUrl}/rest/v1/articles?select=crawled_at&order=crawled_at.desc&limit=1`,
      {
        headers: supabaseHeaders(),
        cache: "no-store",
      }
    );
    if (!res.ok) {
      console.error("Supabase freshness check failed:", res.status, await res.text());
      return true;
    }
    const data = await res.json();
    if (!data || data.length === 0 || !data[0].crawled_at) return true;
    const lastUpdated = new Date(data[0].crawled_at).getTime();
    if (Number.isNaN(lastUpdated)) return true;
    return (Date.now() - lastUpdated) / (1000 * 60) > maxAgeMinutes;
  } catch (error) {
    console.error("Supabase freshness check error:", error);
    return true;
  }
}

export async function saveArticlesToMemory(items: FeedItem[], _topic: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.error(
      "Supabase save skipped: set SUPABASE_URL and SUPABASE_SECRET_KEY in the server environment."
    );
    return;
  }
  if (items.length === 0) return;

  const crawledAt = new Date().toISOString();
  const rows = items.map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    url: item.url,
    source: item.source,
    published_at: item.publishedAt,
    topic_id: item.topicId,
    topic_label: item.topicLabel,
    category: item.category,
    crawled_at: crawledAt,
  }));

  try {
    // url is the articles table's primary key, so explicitly upsert on url.
    const res = await fetch(`${supabaseUrl}/rest/v1/articles?on_conflict=url`, {
      method: "POST",
      headers: supabaseHeaders({
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify(rows),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Supabase article upsert failed:", res.status, errText);
      return;
    }

    console.log(`Supabase saved/upserted ${rows.length} article rows.`);
  } catch (error) {
    console.error("Failed to save articles to Supabase:", error);
  }
}

export async function getArticlesFromMemory(
  topic: string,
  category: "all" | "news" | "research"
): Promise<FeedItem[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    let queryUrl = `${supabaseUrl}/rest/v1/articles?select=*&order=published_at.desc&limit=60`;
    if (topic !== "all") queryUrl += `&topic_id=eq.${encodeURIComponent(topic)}`;
    if (category !== "all") queryUrl += `&category=eq.${category}`;

    const res = await fetch(queryUrl, {
      headers: supabaseHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Supabase article read failed:", res.status, await res.text());
      return [];
    }
    const data = await res.json();

    return (data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      url: row.url,
      source: row.source,
      publishedAt: row.published_at,
      topicId: row.topic_id,
      topicLabel: row.topic_label,
      category: row.category,
    }));
  } catch (error) {
    console.error("Failed to read articles from Supabase:", error);
    return [];
  }
}
