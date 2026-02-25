/** Languages available to free-tier users (English only) */
export const FREE_TIER_LANGUAGES = ['en'] as const;

/** Languages available to subscribed users */
export const SUBSCRIBED_TIER_LANGUAGES = [
  'en',  // English
  'ha',  // Hausa
  'yo',  // Yoruba
  'ig',  // Igbo
  'sw',  // Swahili
  'de',  // German
  'ar',  // Arabic
  'fr',  // French
  'es',  // Spanish
  'pt',  // Portuguese
] as const;

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ha: 'Hausa',
  yo: 'Yoruba',
  ig: 'Igbo',
  sw: 'Swahili',
  de: 'German',
  ar: 'Arabic',
  fr: 'French',
  es: 'Spanish',
  pt: 'Portuguese',
};
