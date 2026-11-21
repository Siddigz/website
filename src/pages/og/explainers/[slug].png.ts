// A link preview picture for each explainer, with its drawing. Made while the site is built.
import type { APIRoute, GetStaticPaths } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { getExplainers } from '../../../lib/explainer-list';
import { renderOg } from '../../../lib/og';
import { explainerCard } from '../../../lib/og-cards';

export const getStaticPaths: GetStaticPaths = async () => (await getExplainers()).map((explainer) => ({ params: { slug: explainer.id }, props: { explainer } }));

export const GET: APIRoute<{ explainer: CollectionEntry<'explainers'> }> = async ({ props }) =>
  new Response(new Uint8Array(await renderOg(await explainerCard(props.explainer))), { headers: { 'content-type': 'image/png' } });
