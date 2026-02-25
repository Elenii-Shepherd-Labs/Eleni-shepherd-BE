import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { RadioStationEntity } from './entities/radio-station.entity';

interface RadioBrowserStation {
  name: string;
  url: string;
  url_resolved?: string;
  tags?: string;
  bitrate?: number;
  favicon?: string;
  language?: string;
  country?: string;
  state?: string;
  votes?: number;
  codec?: string;
}

@Injectable()
export class RadioStationsService {
  constructor(private readonly config: ConfigService) {}

  private getBaseUrl(): string {
    return (
      this.config.get<string>('radioBrowser.baseUrl') ||
      'https://de1.api.radio-browser.info'
    );
  }

  /**
   * Fetch radio stations by country from Radio Browser API
   */
  async getStationsByCountry(country: string = 'Nigeria'): Promise<RadioStationEntity[]> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/json/stations/bycountry/${encodeURIComponent(country)}`;

    const { data } = await axios.get<RadioBrowserStation[]>(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'EleniShepherd/1.0' },
    });

    return (data || []).map((s) => ({
      stationName: s.name,
      streamUrl: s.url_resolved || s.url,
      tags: s.tags || undefined,
      bitrate: s.bitrate || undefined,
      favicon: s.favicon || undefined,
      language: s.language || undefined,
      country: s.country || undefined,
      state: s.state || undefined,
      votes: s.votes || undefined,
      codec: s.codec || undefined,
    }));
  }

  /**
   * Fetch stations with optional tag/genre filter
   */
  async getStationsByCountryAndTag(
    country: string = 'Nigeria',
    tag?: string,
  ): Promise<RadioStationEntity[]> {
    const stations = await this.getStationsByCountry(country);
    if (!tag) return stations;
    const lowerTag = tag.toLowerCase();
    return stations.filter(
      (s) =>
        s.tags?.toLowerCase().includes(lowerTag) ||
        s.language?.toLowerCase().includes(lowerTag),
    );
  }
}
