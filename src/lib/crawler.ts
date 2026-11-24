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

// Fetch trending tech stories from Hacker News API (guaranteed to never block Vercel IPs)
async function fetchHackerNewsArticles(topic: FutureTopic, limit = 5): Promise<FeedItem[]> {
  try {
    const res = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json", { cache: "no-store" });
    if (!res.ok) return [];
    const storyIds: number[] = await res.json();
    
    // Fetch top stories concurrently
    const topIds = storyIds.slice(0, 30);
    const storyPromises = topIds.map(async (id) => {
      try {
        const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { cache: "no-store" });
        return await storyRes.json();
      } catch {
        return null;
      }
    });

    const stories = await Promise.all(storyPromises);
    const validStories = stories.filter((s) => s && s.title && s.url);

    // Match meaningful phrases/terms only. Never fill a category with unrelated stories.
    const query = topic.newsQuery.toLowerCase();
    const phrases = [...query.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    const stopWords = new Set(["or", "and", "the", "for", "with", "into", "from", "about", "business", "technology", "breakthrough"]);
    const terms = query
      .replace(/"[^"]+"/g, " ")
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    const matched = validStories.filter((story) => {
      const text = (story.title + " " + (story.text || "")).toLowerCase();
      const phraseMatch = phrases.some((phrase) => text.includes(phrase));
      const termMatches = terms.filter((term) => text.includes(term)).length;
      return phraseMatch || (terms.length > 0 && termMatches >= Math.min(2, terms.length));
    });

    return matched.slice(0, limit).map((story, idx) => ({
      id: `hn-${topic.id}-${story.id || idx}`,
      title: story.title,
      summary: `Hacker News discussion and coverage regarding ${topic.name}. Score: ${story.score || 0} points.`,
      url: story.url,
      source: "Hacker News",
      publishedAt: story.time ? new Date(story.time * 1000).toISOString() : new Date().toISOString(),
      topicId: topic.id,
      topicLabel: topic.name,
      category: "news",
    }));
  } catch {
    return [];
  }
}

// Fetch open research preprints from arXiv API
async function fetchArxivForTopic(topic: FutureTopic, limit = 4): Promise<FeedItem[]> {
  const query = encodeURIComponent(topic.arxivQuery);
  const arxivUrl = `https://export.arxiv.org/api/query?search_query=${query}&start=0&max_results=${limit}&sortBy=submittedDate&sortOrder=descending`;

  try {
    const res = await fetch(arxivUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": "FutureTechRadar/1.0",
      },
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];

    return entries.map((entryXml, idx) => {
      const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/);
      const summaryMatch = entryXml.match(/<summary>([\s\S]*?)<\/summary>/);
      const idMatch = entryXml.match(/<id>([\s\S]*?)<\/id>/);
      const publishedMatch = entryXml.match(/<published>([\s\S]*?)<\/published>/);
      
      const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "Research Paper";
      const summary = summaryMatch ? summaryMatch[1].replace(/\s+/g, " ").trim() : "";
      const idUrl = idMatch ? idMatch[1].trim() : "";
      const published = publishedMatch ? publishedMatch[1].trim() : "";

      return {
        id: `arxiv-${topic.id}-${idx}-${btoa(idUrl || title).slice(0, 12)}`,
        title,
        summary,
        url: idUrl,
        source: "arXiv Preprint",
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
  const selectedTopics = topicId === "all" ? FUTURE_TOPICS : FUTURE_TOPICS.filter((t) => t.id === topicId);
  const topicsToCrawl = selectedTopics.length > 0 ? selectedTopics : FUTURE_TOPICS;

  const tasks: Promise<FeedItem[]>[] = [];

  for (const topic of topicsToCrawl) {
    if (category === "all" || category === "news") {
      tasks.push(fetchHackerNewsArticles(topic, 3));
    }
    if (category === "all" || category === "research") {
      tasks.push(fetchArxivForTopic(topic, 2));
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
