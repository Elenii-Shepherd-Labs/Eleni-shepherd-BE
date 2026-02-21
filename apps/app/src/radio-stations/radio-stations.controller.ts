import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { RadioStationsService } from './radio-stations.service';

@ApiTags('Radio Stations')
@Controller('radio-stations')
export class RadioStationsController {
  constructor(private readonly radioService: RadioStationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get radio stations by country',
    description: `
Fetches live radio stations from the Radio Browser API. Designed for visually impaired users to stream audio content.

**Frontend Implementation**:
\`\`\`typescript
// Get all Nigerian stations
const response = await fetch('http://localhost:3000/radio-stations?country=Nigeria', {
  credentials: 'include',
});
const result = await response.json();

// Play a station
const station = result.data[0];
const audio = new Audio(station.streamUrl);
audio.play();
\`\`\`

**Response Fields** (per station):
- \`stationName\`: Display name
- \`streamUrl\`: Direct stream URL (use with Audio/HTML5)
- \`tags\`: Genre/category (e.g., gospel, afrobeats)
- \`bitrate\`: Audio quality in kbps
- \`favicon\`: Station logo URL
- \`language\`: Broadcast language

**Accessibility**: Integrate with screen reader / TTS to announce station names. Use \`streamUrl\` for playback.
    `,
  })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'Country name (ISO or full). Default: Nigeria',
    example: 'Nigeria',
  })
  @ApiQuery({
    name: 'tag',
    required: false,
    description: 'Filter by tag/genre (e.g., gospel, news, afrobeats)',
    example: 'gospel',
  })
  @ApiResponse({
    status: 200,
    description: 'List of radio stations',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stationName: { type: 'string', example: 'Afrobeats Gospel Radio' },
              streamUrl: { type: 'string', example: 'https://stream.zeno.fm/...' },
              tags: { type: 'string', example: 'gospel, afrobeats' },
              bitrate: { type: 'number', example: 128 },
              favicon: { type: 'string', description: 'Logo URL' },
              language: { type: 'string', example: 'english' },
            },
          },
        },
      },
    },
  })
  async getStations(
    @Query('country') country?: string,
    @Query('tag') tag?: string,
  ) {
    const stations = await this.radioService.getStationsByCountryAndTag(
      country || 'Nigeria',
      tag,
    );
    return {
      success: true,
      message: 'Radio stations retrieved',
      data: stations,
      status: 200,
    };
  }
}
