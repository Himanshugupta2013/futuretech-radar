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

// Fetch trending tech stories from Hacker News API.
async function fetchHackerNewsArticles(topic: FutureTopic, limit = 5): Promise<FeedItem[]> {
  try {
    const res = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json", { cache: "no-store" });
    if (!res.ok) {
      console.error("Hacker News feed request failed", { topic: topic.id, status: res.status });
      return [];
    }
    const storyIds: number[] = await res.json();
    const topIds = storyIds.slice(0, 30);
    const storyPromises = topIds.map(async (id) => {
      try {
        const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { cache: "no-store" });
        if (!storyRes.ok) {
          console.warn("Hacker News story request failed", { storyId: id, status: storyRes.status });
          return null;
        }
        return await storyRes.json();
      } catch (error) {
        console.warn("Hacker News story request threw", { storyId: id, error: String(error) });
        return null;
      }
    });

    const stories = await Promise.all(storyPromises);
    const validStories = stories.filter((s) => s && s.title && s.url);
    const keywords = topic.newsQuery.toLowerCase().split(" ");
    const matched = validStories.filter((story) => {
      const text = (story.title + " " + (story.text || "")).toLowerCase();
      return keywords.some((kw) => text.includes(kw));
    });
    const itemsToUse = matched.length > 0 ? matched : validStories.slice(0, limit);

    return itemsToUse.slice(0, limit).map((story, idx) => ({
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
  } catch (error) {
    console.error("Hacker News topic fetch failed", { topic: topic.id, error: String(error) });
    return [];
  }
}

// Fetch open research preprints from arXiv API.
async function fetchArxivForTopic(topic: FutureTopic, limit = 4): Promise<FeedItem[]> {
  const query = encodeURIComponent(topic.arxivQuery);
  const arxivUrl = `https://export.arxiv.org/api/query?search_query=${query}&start=0&max_results=${limit}&sortBy=submittedDate&sortOrder=descending`;

  try {
    const res = await fetch(arxivUrl, {
      cache: "no-store",
      headers: { "User-Agent": "FutureTechRadar/1.0" },
    });
    if (!res.ok) {
      console.error("arXiv topic request failed", { topic: topic.id, status: res.status });
      return [];
    }

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
  } catch (error) {
    console.error("arXiv topic fetch failed", { topic: topic.id, error: String(error) });
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
    if (category === "all" || category === "news") tasks.push(fetchHackerNewsArticles(topic, 3));
    if (category === "all" || category === "research") tasks.push(fetchArxivForTopic(topic, 2));
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
