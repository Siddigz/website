/*
 * Schemas for everything under src/content/. Kept free of `astro:content`
 * imports so unit tests can load this file directly.
 */
import { z } from 'astro/zod';

export const CATEGORIES = ['web-apps', 'ai-data', 'systems'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  'web-apps': 'Web & apps',
  'ai-data': 'AI & data',
  systems: 'Systems',
};

const OWNER_REPO_PREFIX = 'https://github.com/Siddigz/';

const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');
const ownerRepo = z
  .url()
  .refine((url) => url.startsWith(OWNER_REPO_PREFIX), `Must start with ${OWNER_REPO_PREFIX}`);

/** `image` is Astro's image helper; tests pass a stand-in. Generic so the image type reaches components. */
export function projectSchema<Image extends z.ZodType>(image: () => Image) {
  return z
    .object({
      title: z.string().min(1),
      /** Same sentence the GitHub profile README uses. */
      oneLiner: z.string().min(1),
      category: z.enum(CATEGORIES),
      stack: z.array(z.string().min(1)).min(1),
      date: yearMonth,
      /** A compact project may have no repository; a featured one must. */
      links: z
        .object({
          repo: ownerRepo.optional(),
          extraRepos: z.array(ownerRepo).optional(),
          live: z.url().optional(),
          video: z.url().optional(),
        })
        .default({}),
      /** Order among featured projects. Present means a large card and a page. */
      featured: z.number().int().positive().optional(),
      result: z.string().min(1).optional(),
      award: z.object({ name: z.string().min(1), event: z.string().min(1) }).optional(),
      cover: image().optional(),
      coverAlt: z.string().min(1).optional(),
      /** 'cover' crops to fill the card (photos). 'contain' shows the whole image (charts, screenshots). */
      coverFit: z.enum(['cover', 'contain']).default('cover'),
      /** Which part of a cropped cover to keep. */
      coverPosition: z.enum(['left top', 'top', 'center', 'bottom']).default('left top'),
      gallery: z.array(z.object({ src: image(), alt: z.string().min(1) })).optional(),
    })
    .superRefine((project, context) => {
      const require = (field: 'result' | 'cover' | 'coverAlt', reason: string) => {
        if (project[field] === undefined) {
          context.addIssue({ code: 'custom', path: [field], message: reason });
        }
      };
      if (project.featured !== undefined) {
        require('result', 'A featured project needs a result line');
        require('cover', 'A featured project needs a cover image');
        if (project.links.repo === undefined) {
          context.addIssue({ code: 'custom', path: ['links', 'repo'], message: 'A featured project needs a repository' });
        }
      }
      if (project.cover !== undefined) {
        require('coverAlt', 'A cover image needs alt text');
      }
    });
}

/** Strict on purpose: a role has no description field. */
export const experienceSchema = z.strictObject({
  id: z.string().optional(),
  organisation: z.string().min(1),
  title: z.string().min(1),
  team: z.string().min(1),
  start: yearMonth,
  /** Absent means the role is current. */
  end: yearMonth.optional(),
  logo: z.enum(['ciena', 'carleton']).optional(),
  order: z.number(),
});

export const proofSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  /** One line, or several lines shown under each other. */
  detail: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  link: z.url().optional(),
  order: z.number(),
});

export const skillsSchema = z.object({
  id: z.string().optional(),
  items: z.array(z.string().min(1)).min(1),
});

export const siteSchema = z.object({
  id: z.string().optional(),
  url: z.url(),
  name: z.object({ first: z.string().min(1), last: z.string().min(1) }),
  pitch: z.string().min(1),
  lookingFor: z.object({ enabled: z.boolean(), text: z.string().min(1) }),
  program: z.string().min(1),
  school: z.string().min(1),
  gpa: z.string().min(1),
  expectedGraduation: z.string().min(1),
  links: z.object({ github: z.url(), linkedin: z.url() }),
  /** The sentence in the Contact section. */
  contactNote: z.string().min(1),
  home: z.object({ city: z.string().min(1), timeZone: z.string().min(1) }),
});

export const aboutSchema = z.object({
  title: z.string().min(1),
  activities: z.array(z.object({ name: z.string().min(1), role: z.string().min(1) })),
  photos: z.array(z.object({ src: z.string().min(1), alt: z.string().min(1), caption: z.string().min(1) })),
});
