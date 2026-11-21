// Called once a day by the host's scheduler (see `crons` in vercel.json) to
// start a fresh build, which refreshes the GitHub activity. See src/lib/rebuild.ts.
import type { APIRoute } from 'astro';
import { handleRebuild } from '../../lib/rebuild';

export const prerender = false;

export const ALL: APIRoute = ({ request }) => handleRebuild(request, process.env);
