import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { BlogArticleEntity } from './entities/blog-article.entity';

type BlogCategory = 'entertainment' | 'sports' | 'technology' | 'news' | 'general';

@Injectable()
export class BlogService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Fetch news/blog articles. Uses GNews API if API key set, else Hacker News.
   */
  async getArticles(
    category: BlogCategory = 'general',
    limit: number = 20,
  ): Promise<BlogArticleEntity[]> {
    const gnewsKey = process.env.GNEWS_API_KEY;
    if (gnewsKey) {
      return this.fetchFromGNews(category, limit, gnewsKey);
    }
    return this.fetchFromHackerNews(limit);
  }

  private async fetchFromGNews(
    category: BlogCategory,
    limit: number,
    apiKey: string,
  ): Promise<BlogArticleEntity[]> {
    const topicMap: Record<string, string> = {
      entertainment: 'entertainment',
      sports: 'sports',
      technology: 'technology',
      news: 'world',
      general: 'general',
    };
    const topic = topicMap[category] || 'general';
    const url = `https://gnews.io/api/v4/top-headlines?topic=${topic}&lang=en&max=${limit}&apikey=${apiKey}`;

    const { data } = await axios.get(url, { timeout: 10000 });
    const articles = data?.articles || [];
    return articles.map((a: any) => ({
      title: a.title,
      description: a.description,
      url: a.url,
      source: a.source?.name,
      publishedAt: a.publishedAt,
      imageUrl: a.image,
      category: topic,
      author: undefined,
    }));
  }

  private async fetchFromHackerNews(limit: number): Promise<BlogArticleEntity[]> {
    const topUrl = 'https://hacker-news.firebaseio.com/v0/topstories.json';
    const { data: ids } = await axios.get<number[]>(topUrl, { timeout: 8000 });
    const slice = (ids || []).slice(0, Math.min(limit, 30));

    const items = await Promise.all(
      slice.map((id) =>
        axios
          .get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
            timeout: 5000,
          })
          .then((r) => r.data),
      ),
    );

    return items
      .filter((item: any) => item?.title)
      .map((item: any) => ({
        title: item.title,
        description: undefined,
        url: item.url,
        source: 'Hacker News',
        publishedAt: item.time
          ? new Date(item.time * 1000).toISOString()
          : undefined,
        imageUrl: undefined,
        category: 'technology',
        author: item.by,
      }));
  }
}
