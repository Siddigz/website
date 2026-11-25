// The resume, when the owner has switched it on. Answered by the server on
// each request, so the switch works without a rebuild. See src/lib/resume.ts.
import type { APIRoute } from 'astro';
import placeholder from '../assets/resume-placeholder.pdf?inline';
import { handleResume } from '../lib/resume';
import { getSite } from '../lib/site';

export const prerender = false;

// The placeholder arrives as a data address; everything after the comma is the file.
const blank = new Uint8Array(Buffer.from(placeholder.slice(placeholder.indexOf(',') + 1), 'base64'));

export const GET: APIRoute = async () => {
  const { name, resumeLabel } = await getSite();
  return handleResume(process.env, blank, `${name.first}-${name.last}-${resumeLabel}.pdf`);
};
