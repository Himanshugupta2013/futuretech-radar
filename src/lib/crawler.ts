import { FUTURE_TOPICS, TechTopic } from "./topics";

export type ArticleCategory = "news" | "research";

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary: string;
  topicId: string;
  topicName: string;
  badgeColor: string;
  category: ArticleCategory;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = block.match(regex);
  return match ? decodeHtmlEntities(match[1]) : "";
}

async function fetchWithTimeout(url: string, timeoutMs = 6000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "FutureTechRadar/1.0 (+https://vercel.com)",
      },
      next: { revalidate: 900 },
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function crawlGoogleNews(topic: TechTopic, limit = 6): Promise<NewsArticle[]> {
  const encodedQuery = encodeURIComponent(topic.newsQuery);
  const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetchWithTimeout(url);
  if (!xml) return [];

  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const results: NewsArticle[] = [];

  for (const item of items.slice(0, limit)) {
    const rawTitle = extractTag(item, "title");
    const link = extractTag(item, "link");
    const pubDate = extractTag(item, "pubDate");
    const sourceTag = extractTag(item, "source");
    const description = extractTag(item, "description");

    // Google News titles often end with " - Publisher Name"
    let title = rawTitle;
    let source = sourceTag || "Tech News";
    const dashIndex = rawTitle.lastIndexOf(" - ");
    if (dashIndex > 10) {
      title = rawTitle.slice(0, dashIndex).trim();
      if (!sourceTag) source = rawTitle.slice(dashIndex + 3).trim();
    }

    if (!title || !link) continue;

    results.push({
      id: `news-${topic.id}-${Buffer.from(link).toString("base64").slice(0, 16)}`,
      title,
      url: link,
      source,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      summary: description && description !== title ? description.slice(0, 220) : `Latest business & technology coverage on ${topic.name}.`,
      topicId: topic.id,
      topicName: topic.shortName,
      badgeColor: topic.badgeColor,
      category: "news",
    });
  }

  return results;
}

async function crawlArxiv(topic: TechTopic, limit = 4): Promise<NewsArticle[]> {
  const encodedQuery = encodeURIComponent(topic.arxivQuery);
  const url = `https://export.arxiv.org/api/query?search_query=${encodedQuery}&sortBy=submittedDate&sortOrder=descending&max_results=${limit}`;
  const xml = await fetchWithTimeout(url);
  if (!xml) return [];

  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) ?? [];
  const results: NewsArticle[] = [];

  for (const entry of entries) {
    const title = extractTag(entry, "title");
    const idUrl = extractTag(entry, "id");
    const published = extractTag(entry, "published");
    const summary = extractTag(entry, "summary");

    if (!title || !idUrl) continue;

    results.push({
      id: `arxiv-${topic.id}-${idUrl.split("/").pop() ?? Math.random().toString(36).slice(2)}`,
      title,
      url: idUrl,
      source: "arXiv Research",
      publishedAt: published ? new Date(published).toISOString() : new Date().toISOString(),
      summary: summary ? `${summary.slice(0, 220)}...` : `Peer-reviewed / preprint research in ${topic.name}.`,
      topicId: topic.id,
      topicName: topic.shortName,
      badgeColor: topic.badgeColor,
      category: "research",
    });
  }

  return results;
}

export async function crawlFutureTechArticles(options: {
  topicId?: string;
  category?: "all" | ArticleCategory;
}): Promise<{ articles: NewsArticle[]; crawledAt: string }> {
  const selectedTopics =
    options.topicId && options.topicId !== "all"
      ? FUTURE_TOPICS.filter((t) => t.id === options.topicId)
      : FUTURE_TOPICS;

  const isSingleTopic = selectedTopics.length === 1;
  const newsLimit = isSingleTopic ? 12 : 2;
  const arxivLimit = isSingleTopic ? 8 : 1;

  const tasks: Promise<NewsArticle[]>[] = [];

  for (const topic of selectedTopics) {
    if (!options.category || options.category === "all" || options.category === "news") {
      tasks.push(crawlGoogleNews(topic, newsLimit));
    }
    if (!options.category || options.category === "all" || options.category === "research") {
      tasks.push(crawlArxiv(topic, arxivLimit));
    }
  }

  const batches = await Promise.all(tasks);
  const flat = batches.flat();

  // Deduplicate by normalized title and sort newest first
  const seen = new Set<string>();
  const unique = flat.filter((article) => {
    const key = article.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return {
    articles: unique,
    crawledAt: new Date().toISOString(),
  };
}
