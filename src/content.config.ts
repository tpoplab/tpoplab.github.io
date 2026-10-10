import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const people = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/people' }),
  schema: z.object({
    name: z.string(),
    nameZh: z.string().optional(), // Chinese name, shown under the English name
    role: z.enum(['Principal Investigator', 'Postdoc', 'PhD Student', "Master's Student", 'Undergraduate', 'Staff', 'Alumni']),
    title: z.string().optional(), // e.g. "Professor" or "Full-time Research Analyst"
    photo: z.string().optional(), // e.g. "/images/people/jane.jpg"
    email: z.string().optional(),
    website: z.string().optional(),
    interests: z.array(z.string()).default([]),
    now: z.string().optional(), // alumni: current position
    order: z.number().default(100),
  }),
});

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    // How much of the date to show: 'day' → Oct 10, 2026 · 'month' → Oct 2026 · 'year' → 2026
    precision: z.enum(['day', 'month', 'year']).default('day'),
    tag: z.enum(['Paper', 'Award', 'Talk', 'People', 'Grant', 'Event']).default('Event'),
  }),
});

const research = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/research' }),
  schema: z.object({
    title: z.string(),
    short: z.string(), // short label used for publication filters
    summary: z.string(),
    icon: z.enum(['aging', 'family', 'health', 'equity']),
    order: z.number().default(100),
  }),
});

const publications = defineCollection({
  loader: file('src/data/publications.yaml'),
  schema: z.object({
    title: z.string(),
    authors: z.string(),
    venue: z.string(),
    year: z.number(),
    type: z.enum(['Journal Article', 'Book Chapter']).default('Journal Article'),
    status: z.enum(['published', 'in press', 'revise & resubmit']).default('published'),
    themes: z.array(z.string()).default([]), // research theme file names, e.g. [aging, family]
    featured: z.boolean().default(false),
    pdf: z.string().optional(),
    doi: z.string().optional(),
  }),
});

export const collections = { people, news, research, publications };
