/*
 * The resume switch. Off (the default): /resume.pdf does not exist and no page
 * links to it. On: it serves the file kept at a private address in a setting,
 * or a blank placeholder when there is none. The real file is never in the repo.
 */
export type ResumeEnv = { RESUME_ENABLED?: string; RESUME_URL?: string };

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 5 * 1024 * 1024;
const PDF_START = '%PDF-';

/** On only for the exact word "true", so a typo leaves it off. */
export function resumeEnabled(env: ResumeEnv): boolean {
  return env.RESUME_ENABLED === 'true';
}

// The same answer whatever went wrong, so nothing about the setting shows.
const notFound = () => new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });

const isPdf = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes.subarray(0, PDF_START.length)) === PDF_START;

async function fetchPdf(address: string, fetchImpl: typeof fetch): Promise<Uint8Array | null> {
  try {
    if (new URL(address).protocol !== 'https:') return null;
    const response = await fetchImpl(address, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.length <= MAX_BYTES && isPdf(bytes) ? bytes : null;
  } catch {
    return null;
  }
}

export async function handleResume(
  env: ResumeEnv,
  placeholder: Uint8Array,
  fileName: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (!resumeEnabled(env)) return notFound();
  const bytes = env.RESUME_URL ? await fetchPdf(env.RESUME_URL, fetchImpl) : placeholder;
  if (!bytes) return notFound();
  return new Response(bytes as Uint8Array<ArrayBuffer>, {
    headers: {
      'content-type': 'application/pdf',
      // Opens in the browser, and saves under a sensible name.
      'content-disposition': `inline; filename="${fileName.replace(/[^\w. -]/g, '')}"`,
      // Never stored: switching it off takes effect at once.
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  });
}
