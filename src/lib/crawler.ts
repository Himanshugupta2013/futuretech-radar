import { FUTURE_TOPICS } from "./topics";

type FutureTopic = (typeof FUTURE_TOPICS)[number];

export interface FeedItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  topicId: string;
  topicLabel: string;
  category: "news" | "research";
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = block.match(regex);
  return match ? decodeHtmlEntities(match[1]) : "";
}

async function fetchGoogleNewsForTopic(topic: FutureTopic, limit = 6): Promise<FeedItem[]> {
  const query = encodeURIComponent(`${topic.newsQuery} when:7d`);
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const res = await fetch(rssUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FutureTechRadar/1.0)",
      },
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

    return items.slice(0, limit).map((itemXml, idx) => {
      const rawTitle = extractTag(itemXml, "title");
      const link = extractTag(itemXml, "link");
      const pubDate = extractTag(itemXml, "pubDate");
      const source = extractTag(itemXml, "source") || "Tech News";
      const description = extractTag(itemXml, "description");

      const cleanTitle = rawTitle.replace(/\s+-\s+[^-]+$/, "").trim() || rawTitle;

      return {
        id: `news-${topic.id}-${idx}-${Buffer.from(link || cleanTitle).toString("base64").slice(0, 12)}`,
        title: cleanTitle,
        summary: description && description !== cleanTitle ? description : `Latest coverage on ${topic.name} via ${source}.`,
        url: link,
        source,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        topicId: topic.id,
        topicLabel: topic.name,
        category: "news",
      };
    });
  } catch {
    return [];
  }
}

async function fetchArxivForTopic(topic: FutureTopic, limit = 4): Promise<FeedItem[]> {
  const query = encodeURIComponent(topic.arxivQuery);
  const arxivUrl = `https://export.arxiv.org/api/query?search_query=${query}&start=0&max_results=${limit}&sortBy=submittedDate&sortOrder=descending`;

  try {
    const res = await fetch(arxivUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": "FutureTechRadar/1.0 (mailto:research@futuretechradar.local)",
      },
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];

    return entries.map((entryXml, idx) => {
      const title = extractTag(entryXml, "title");
      const summary = extractTag(entryXml, "summary");
      const idUrl = extractTag(entryXml, "id");
      const published = extractTag(entryXml, "published");

      const authorMatches = entryXml.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g) || [];
      const firstAuthor = authorMatches[0] ? extractTag(authorMatches[0], "name") : "arXiv Preprint";
      const sourceLabel = authorMatches.length > 1 ? `${firstAuthor} et al. (arXiv)` : `${firstAuthor} (arXiv)`;

      return {
        id: `arxiv-${topic.id}-${idx}-${Buffer.from(idUrl || title).toString("base64").slice(0, 12)}`,
        title,
        summary,
        url: idUrl,
        source: sourceLabel,
        publishedAt: published ? new Date(published).toISOString() : new Date().toISOString(),
        topicId: topic.id,
        topicLabel: topic.name,
        category: "research",
      };
    });
  } catch {
    return [];
  }
}

export async function crawlFutureTech(
  topicId: string = "all",
  category: "all" | "news" | "research" = "all"
): Promise<FeedItem[]> {
  const selectedTopics =
    topicId === "all"
      ? FUTURE_TOPICS
      : FUTURE_TOPICS.filter((t) => t.id === topicId);

  const topicsToCrawl = selectedTopics.length > 0 ? selectedTopics : FUTURE_TOPICS;
  const isSingleTopic = topicId !== "all";
  const newsLimit = isSingleTopic ? 12 : 2;
  const arxivLimit = isSingleTopic ? 8 : 1;

  const tasks: Promise<FeedItem[]>[] = [];

  for (const topic of topicsToCrawl) {
    if (category === "all" || category === "news") {
      tasks.push(fetchGoogleNewsForTopic(topic, newsLimit));
    }
    if (category === "all" || category === "research") {
      tasks.push(fetchArxivForTopic(topic, arxivLimit));
    }
  }

  const results = await Promise.all(tasks);
  const merged = results.flat();

  const seenUrls = new Set<string>();
  const deduped = merged.filter((item) => {
    if (!item.url || seenUrls.has(item.url)) return false;
    seenUrls.add(item.url);
    return true;
  });

  deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return deduped;
}
