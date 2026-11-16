import { FeedItem } from "./crawler";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function getHeaders(key: string, extra?: Record<string, string>) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

export async function isMemoryStale(scope: string): Promise<boolean> {
  const cfg = getSupabaseConfig();
  if (!cfg) return true;

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/sync_state?scope=eq.${encodeURIComponent(scope)}&select=last_synced_at`,
      {
        headers: getHeaders(cfg.key),
        cache: "no-store",
      }
    );
    if (!res.ok) return true;

    const rows: { last_synced_at: string }[] = await res.json();
    if (!rows.length || !rows[0].last_synced_at) return true;

    const lastSynced = new Date(rows[0].last_synced_at).getTime();
    return Date.now() - lastSynced >= TWO_HOURS_MS;
  } catch {
    return true;
  }
}

export async function saveArticlesToMemory(items: FeedItem[], scope: string): Promise<void> {
  const cfg = getSupabaseConfig();
  if (!cfg) return;

  const nowIso = new Date().toISOString();

  try {
    if (items.length > 0) {
      const payload = items.map((item) => ({
        url: item.url,
        id: item.id,
        title: item.title,
        summary: item.summary,
        source: item.source,
        published_at: item.publishedAt,
        topic_id: item.topicId,
        topic_label: item.topicLabel,
        category: item.category,
        crawled_at: nowIso,
      }));

      await fetch(`${cfg.url}/rest/v1/articles?on_conflict=url`, {
        method: "POST",
        headers: getHeaders(cfg.key, {
          Prefer: "resolution=merge-duplicates,return=minimal",
        }),
        body: JSON.stringify(payload),
        cache: "no-store",
      });
    }

    await fetch(`${cfg.url}/rest/v1/sync_state?on_conflict=scope`, {
      method: "POST",
      headers: getHeaders(cfg.key, {
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify([{ scope, last_synced_at: nowIso }]),
      cache: "no-store",
    });
  } catch (err) {
    console.error("Failed to save findings to Supabase:", err);
  }
}

export async function getArticlesFromMemory(
  topicId: string = "all",
  category: "all" | "news" | "research" = "all",
  limit = 250
): Promise<FeedItem[]> {
  const cfg = getSupabaseConfig();
  if (!cfg) return [];

  try {
    const params = new URLSearchParams();
    params.set("select", "id,title,summary,url,source,published_at,topic_id,topic_label,category");
    params.set("order", "published_at.desc");
    params.set("limit", String(limit));

    if (topicId !== "all") {
      params.set("topic_id", `eq.${topicId}`);
    }
    if (category !== "all") {
      params.set("category", `eq.${category}`);
    }

    const res = await fetch(`${cfg.url}/rest/v1/articles?${params.toString()}`, {
      headers: getHeaders(cfg.key),
      cache: "no-store",
    });

    if (!res.ok) return [];

    const rows: {
      id: string;
      title: string;
      summary: string;
      url: string;
      source: string;
      published_at: string;
      topic_id: string;
      topic_label: string;
      category: "news" | "research";
    }[] = await res.json();

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      url: r.url,
      source: r.source,
      publishedAt: r.published_at,
      topicId: r.topic_id,
      topicLabel: r.topic_label,
      category: r.category,
    }));
  } catch {
    return [];
  }
}
