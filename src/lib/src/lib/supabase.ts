import { createClient } from "@supabase/supabase-js";
import type { FeedItem } from "./crawler";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function isMemoryStale(topic: string, maxAgeMinutes = 60): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return true;

  try {
    let query = supabase
      .from("articles")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);

    if (topic !== "all") {
      query = query.eq("topic_id", topic);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) return true;

    const lastUpdated = new Date(data[0].created_at).getTime();
    const ageMinutes = (Date.now() - lastUpdated) / (1000 * 60);
    return ageMinutes > maxAgeMinutes;
  } catch {
    return true;
  }
}

export async function saveArticlesToMemory(items: FeedItem[], _topic: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase || items.length === 0) return;

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

  await supabase.from("articles").upsert(rows, { onConflict: "url" });
}

export async function getArticlesFromMemory(
  topic: string,
  category: "all" | "news" | "research"
): Promise<FeedItem[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  let query = supabase
    .from("articles")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(60);

  if (topic !== "all") {
    query = query.eq("topic_id", topic);
  }
  if (category !== "all") {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
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
}
