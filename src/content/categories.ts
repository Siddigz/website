/*
 * The project categories. Kept apart from the content schemas so a browser
 * script can use them without bringing the schema library along.
 */
export const CATEGORIES = ['web-apps', 'ai-data', 'systems'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  'web-apps': 'Web & apps',
  'ai-data': 'AI & data',
  systems: 'Systems',
};
