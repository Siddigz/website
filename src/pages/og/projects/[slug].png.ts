// A link preview picture for each featured project. Drawn while the site is built.
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { renderOg } from '../../../lib/og';
import { projectCard } from '../../../lib/og-cards';
import { featuredProjects } from '../../../lib/projects';

export const getStaticPaths: GetStaticPaths = async () =>
  featuredProjects(await getCollection('projects')).map((project) => ({ params: { slug: project.id }, props: { project } }));

export const GET: APIRoute<{ project: CollectionEntry<'projects'> }> = async ({ props }) =>
  new Response(new Uint8Array(await renderOg(await projectCard(props.project))), { headers: { 'content-type': 'image/png' } });
