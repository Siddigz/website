/*
 * Stands in for the framework's on-request picture endpoint (`/_image`).
 * Every picture on this site is made while the site is built, so nothing
 * needs that address. Left as the framework ships it, anyone could ask the
 * server to resize pictures over and over. This answers "not found" instead.
 */
export const prerender = false;

export function GET(): Response {
  return new Response('Not found', {
    status: 404,
    // The host may remember the answer, so repeats do not reach the server at all.
    headers: { 'cache-control': 'public, max-age=3600', 'x-robots-tag': 'noindex' },
  });
}
