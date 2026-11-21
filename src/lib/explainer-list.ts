import { getCollection } from 'astro:content';

/** Every explainer, in the order the home page and the menu list them. */
export async function getExplainers() {
  return (await getCollection('explainers')).sort((a, b) => a.data.order - b.data.order);
}
