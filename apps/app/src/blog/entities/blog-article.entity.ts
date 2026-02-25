/**
 * Blog/News Article Entity - unified shape for API responses
 */
export class BlogArticleEntity {
  title: string;
  description?: string;
  url?: string;
  source?: string;
  publishedAt?: string;
  imageUrl?: string;
  category?: string;
  author?: string;
}
