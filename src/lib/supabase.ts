import type { FeedItem } from "./crawler";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseAdminKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseReadKey = supabaseAnonKey || supabaseAdminKey;
const articlesTable = process.env.SUPABASE_ARTICLES_TABLE || (process.env.VERCEL_ENV === "preview" ? "preview_articles" : "articles");

function getRestUrl(path: string): string {
  if (!supabaseUrl || !/^https:\/\//.test(supabaseUrl)) throw new Error("Supabase URL is not configured");
  return `${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`;
}

function getAdminHeaders(extra: Record<string, string> = {}): HeadersInit {
  if (!supabaseAdminKey) throw new Error("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required for crawler observability writes");
  return { apikey: supabaseAdminKey, Authorization: `Bearer ${supabaseAdminKey}`, ...extra };
}

function getReadHeaders(): HeadersInit {
  if (!supabaseReadKey) throw new Error("Supabase API key is not configured");
  return { apikey: supabaseReadKey, Authorization: `Bearer ${supabaseReadKey}` };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseReadKey);
}

export async function isMemoryStale(_topic: string, maxAgeMinutes = 60): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  try {
    const res = await fetch(getRestUrl(`${articlesTable}?select=crawled_at&order=crawled_at.desc&limit=1`), { headers: getReadHeaders(), cache: "no-store" });
    if (!res.ok) return true;
    const data = await res.json();
    if (!data || data.length === 0) return true;
    return (Date.now() - new Date(data[0].crawled_at).getTime()) / 60000 > maxAgeMinutes;
  } catch { return true; }
}

export async function createCrawlerRun(input: { id: string; triggerSource: string; scope: string; startedAt: string }): Promise<void> {
  const res = await fetch(getRestUrl("crawler_runs"), {
    method: "POST",
    headers: getAdminHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify({ id: input.id, trigger_source: input.triggerSource, sync_scope: input.scope, status: "started", started_at: input.startedAt }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Unable to create crawler run record: ${res.status} ${await res.text()}`);
}

export async function completeCrawlerRun(input: { id: string; scope: string; fetchedCount: number; persistedCount: number }): Promise<void> {
  const res = await fetch(getRestUrl("rpc/complete_crawler_run"), {
    method: "POST",
    headers: getAdminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ p_run_id: input.id, p_scope: input.scope, p_fetched_count: input.fetchedCount, p_persisted_count: input.persistedCount }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Unable to complete crawler run: ${res.status} ${await res.text()}`);
}

export async function failCrawlerRun(id: string, error: unknown): Promise<void> {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 4000);
  const res = await fetch(getRestUrl(`crawler_runs?id=eq.${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: getAdminHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify({ status: "failed", completed_at: new Date().toISOString(), error_message: message }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Unable to persist crawler failure: ${res.status} ${await res.text()}`);
}

export async function saveArticlesToMemory(items: FeedItem[], _topic: string): Promise<number> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  if (!/^[a-z_][a-z0-9_]*$/i.test(articlesTable)) throw new Error("SUPABASE_ARTICLES_TABLE contains an invalid table name");
  if (items.length === 0) return 0;
  const rows = items.map((item) => ({
    id: item.id, title: item.title, summary: item.summary, url: item.url, source: item.source,
    published_at: item.publishedAt, topic_id: item.topicId, topic_label: item.topicLabel,
    category: item.category, crawled_at: new Date().toISOString(),
  }));
  const res = await fetch(getRestUrl(`${articlesTable}?on_conflict=url&select=url`), {
    method: "POST",
    headers: getAdminHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify(rows),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase article upsert failed: ${res.status} ${await res.text()}`);
  const savedRows: Array<{ url: string }> = await res.json();
  return savedRows.length;
}

export async function getArticlesFromMemory(topic: string, category: "all" | "news" | "research"): Promise<FeedItem[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    let query = `${articlesTable}?select=*&order=published_at.desc&limit=60`;
    if (topic !== "all") query += `&topic_id=eq.${encodeURIComponent(topic)}`;
    if (category !== "all") query += `&category=eq.${category}`;
    const res = await fetch(getRestUrl(query), { headers: getReadHeaders(), cache: "no-store" });
    if (!res.ok) {
      console.error("Supabase article read failed:", res.status, await res.text());
      return [];
    }
    const data = await res.json();
    return (data || []).map((row: any) => ({
      id: row.id, title: row.title, summary: row.summary, url: row.url, source: row.source,
      publishedAt: row.published_at, topicId: row.topic_id, topicLabel: row.topic_label, category: row.category,
    }));
  } catch (error) {
    console.error("Failed to read articles from Supabase:", error);
    return [];
  }
}
