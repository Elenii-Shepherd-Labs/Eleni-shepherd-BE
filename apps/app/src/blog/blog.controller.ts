import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { BlogService } from './blog.service';

@ApiTags('Blog & News')
@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get()
  @ApiOperation({
    summary: 'Get recent news and blog articles',
    description: `
Fetches recent news and blog content. Designed for visually impaired users - pair with screen-reader TTS to read articles aloud.

**Sources**:
- With \`GNEWS_API_KEY\`: GNews API (entertainment, sports, technology, general)
- Without key: Hacker News top stories (tech)

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch('http://localhost:3000/blog?category=entertainment&limit=10', {
  credentials: 'include',
});
const result = await response.json();

// Read aloud with TTS
for (const article of result.data) {
  await textToSpeech(article.title + '. ' + (article.description || ''));
}
\`\`\`

**Response Fields** (per article):
- \`title\`: Article title
- \`description\`: Summary (if available)
- \`url\`: Link to full article
- \`source\`: Publisher name
- \`publishedAt\`: ISO date
- \`category\`: entertainment | sports | technology | news | general
- \`author\`: Author (if available)

**Accessibility**: Use with /accessibility/read-aloud to have content spoken to the user.
    `,
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Category: entertainment, sports, technology, news, general',
    example: 'technology',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Max number of articles (default 20)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'List of articles',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              url: { type: 'string' },
              source: { type: 'string' },
              publishedAt: { type: 'string', format: 'date-time' },
              category: { type: 'string' },
              author: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async getArticles(
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ) {
    const validCategory = ['entertainment', 'sports', 'technology', 'news', 'general'].includes(
      category || '',
    )
      ? (category as any)
      : 'general';
    const limitNum = Math.min(parseInt(limit || '20', 10) || 20, 50);
    const articles = await this.blogService.getArticles(validCategory, limitNum);
    return {
      success: true,
      message: 'Articles retrieved',
      data: articles,
      status: 200,
    };
  }
}
