/**
 * Radio Station Entity - normalized shape for API responses
 * Based on Radio Browser API: https://de1.api.radio-browser.info
 */
export class RadioStationEntity {
  stationName: string;
  streamUrl: string;
  tags?: string;
  bitrate?: number;
  favicon?: string;
  language?: string;
  country?: string;
  state?: string;
  votes?: number;
  codec?: string;
}
