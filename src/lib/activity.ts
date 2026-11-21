/*
 * The GitHub activity for this build, asked for once however many pages need
 * to know about it (the home page shows it; the menu lists it only if it is there).
 */
import { getCollection } from 'astro:content';
import { ACTIVITY_FIXTURE, fixtures } from './build-env';
import { allowedRepos, loadActivity, type Activity } from './github-activity';
import { getSite } from './site';

let asked: Promise<Activity | null> | undefined;

async function ask(): Promise<Activity | null> {
  const site = await getSite();
  return loadActivity({
    token: process.env.GITHUB_ACTIVITY_TOKEN,
    login: new URL(site.links.github).pathname.replaceAll('/', ''),
    repos: allowedRepos(await getCollection('projects'), site.repository),
    fixture: fixtures ? ACTIVITY_FIXTURE : undefined,
    // Three sit level with the year beside them.
    limit: 3,
  });
}

/** Null (no token, GitHub unreachable) leaves the section out; nothing else depends on it. */
export function getActivity(): Promise<Activity | null> {
  return (asked ??= ask());
}
