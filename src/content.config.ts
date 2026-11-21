import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import {
  aboutSchema,
  explainerSchema,
  experienceSchema,
  projectSchema,
  proofSchema,
  siteSchema,
  skillsSchema,
} from './content/schemas';

const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: ({ image }) => projectSchema(image),
});

const explainers = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/explainers' }),
  schema: explainerSchema,
});

const about = defineCollection({
  loader: glob({ pattern: 'about.md', base: './src/content' }),
  schema: ({ image }) =>
    aboutSchema.extend({
      photos: aboutSchema.shape.photos.element.extend({ src: image() }).array(),
    }),
});

const experience = defineCollection({
  loader: file('src/content/experience.yaml'),
  schema: experienceSchema,
});

const proof = defineCollection({
  loader: file('src/content/proof.yaml'),
  schema: proofSchema,
});

const skills = defineCollection({
  loader: file('src/content/skills.yaml'),
  schema: skillsSchema,
});

const site = defineCollection({
  loader: file('src/content/site.yaml'),
  schema: ({ image }) =>
    siteSchema.extend({
      photo: siteSchema.shape.photo.unwrap().extend({ src: image() }).optional(),
    }),
});

export const collections = { projects, explainers, about, experience, proof, skills, site };
