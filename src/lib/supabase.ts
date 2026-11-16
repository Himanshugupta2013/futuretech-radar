import type { FeedItem } from "./crawler";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export async function isMemoryStale(_topic: string, maxAgeMinutes = 60): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/articles?select=created_at&order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        cache: "no-store",
      }
    );

    if (!res.ok) return true;
    const data = await res.json();
    if (!data || data.length === 0) return true;

    const lastUpdated = new Date(data[0].created_at).getTime();
    return (Date.now() - lastUpdated) / (1000 * 60) > maxAgeMinutes;
  } catch {
    return true;
  }
}

export async function saveArticlesToMemory(items: FeedItem[], _topic: string): Promise<void> {
  if (!isSupabaseConfigured() || items.length === 0) return;

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
  }));

  try {
    await fetch(`${supabaseUrl}/rest/v1/articles`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-conflict",
      },
      body: JSON.stringify(rows),
    });
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
    if (topic !== "all") queryUrl += `&topic_id=eq.${topic}`;
    if (category !== "all") queryUrl += `&category=eq.${category}`;

    const res = await fetch(queryUrl, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return [];
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
  } catch {
    return [];
  }
}
