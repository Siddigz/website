/*
 * GitHub activity for the home page, fetched while the site is built. Nothing
 * here runs in a visitor's browser. Every failure ends in `null`, so the page
 * can leave the section out and the build still succeeds.
 */
import { readFileSync } from 'node:fs';

export type Level = 0 | 1 | 2 | 3 | 4;
export type Day = { date: string; count: number; level: Level };
export type Commit = { message: string; repo: string; url: string; date: string };
export type Activity = { total: number; weeks: Day[][]; commits: Commit[] };

const ENDPOINT = 'https://api.github.com/graphql';
const TIMEOUT_MS = 10_000;
const HEADLINE_LENGTH = 80;
const REPO_URL = /^https:\/\/github\.com\/[\w.-]+\/([\w.-]+)\/?$/;

const LEVELS: Record<string, Level> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

type Linked = { data: { links: { repo?: string; extraRepos?: string[] } } };

/**
 * The names of the repositories whose commits may be shown: the ones the site
 * already links, plus the site's own. A commit anywhere else is never listed.
 */
export function allowedRepos(projects: Linked[], siteRepo: string): string[] {
  const urls = [...projects.flatMap(({ data }) => [data.links.repo, ...(data.links.extraRepos ?? [])]), siteRepo];
  const names = urls.map((url) => REPO_URL.exec(url ?? '')?.[1]).filter((name) => name !== undefined);
  return [...new Set(names)];
}

/** One request: the contribution calendar, and the latest commits of each named repository. */
export function activityQuery(repos: string[]): string {
  const repositories = repos.map(
    (name, index) => `
  r${index}: repository(owner: $login, name: ${JSON.stringify(name)}) {
    name
    url
    isPrivate
    defaultBranchRef { target { ... on Commit { history(first: 10) { nodes {
      messageHeadline committedDate url author { user { login } }
    } } } } }
  }`,
  );
  return `query($login: String!) {
  user(login: $login) { contributionsCollection { contributionCalendar {
    totalContributions
    weeks { contributionDays { date contributionCount contributionLevel } }
  } } }${repositories.join('')}
}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function parseCommits(data: Record<string, unknown>, login: string, repos: string[], limit: number): Commit[] {
  const commits: Commit[] = [];
  for (const [key, repo] of Object.entries(data)) {
    // A repository that was renamed or removed comes back as null.
    if (key === 'user' || !isRecord(repo)) continue;
    const name = repo.name;
    if (typeof name !== 'string' || !repos.includes(name) || repo.isPrivate !== false) continue;
    const nodes = (repo.defaultBranchRef as any)?.target?.history?.nodes;
    if (!Array.isArray(nodes)) continue;
    for (const node of nodes) {
      const { messageHeadline, committedDate, url } = node ?? {};
      if (node?.author?.user?.login !== login) continue;
      if (typeof messageHeadline !== 'string' || typeof committedDate !== 'string' || typeof url !== 'string') continue;
      const message =
        messageHeadline.length > HEADLINE_LENGTH ? `${messageHeadline.slice(0, HEADLINE_LENGTH - 1)}…` : messageHeadline;
      commits.push({ message, repo: name, url, date: committedDate });
    }
  }
  return commits
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((commit) => ({ ...commit, date: commit.date.slice(0, 10) }));
}

/** Shapes GitHub's answer. `null` when the calendar is missing, whatever the reason. */
export function parseActivity(
  json: unknown,
  { login, repos, limit = 5 }: { login: string; repos: string[]; limit?: number },
): Activity | null {
  const data = isRecord(json) ? json.data : undefined;
  if (!isRecord(data)) return null;
  const calendar = (data.user as any)?.contributionsCollection?.contributionCalendar;
  if (!isRecord(calendar) || typeof calendar.totalContributions !== 'number' || !Array.isArray(calendar.weeks)) {
    return null;
  }
  const weeks = calendar.weeks.map((week: any): Day[] =>
    (Array.isArray(week?.contributionDays) ? week.contributionDays : []).map(
      (day: any): Day => ({
        date: String(day?.date ?? ''),
        count: Number(day?.contributionCount) || 0,
        level: LEVELS[day?.contributionLevel] ?? 0,
      }),
    ),
  );
  return { total: calendar.totalContributions, weeks, commits: parseCommits(data, login, repos, limit) };
}

const monthName = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

/** A month's name at the first week that starts in it, so two names never crowd each other. */
export function monthLabels(weeks: Day[][]): { week: number; label: string }[] {
  return weeks.flatMap((days, week) => {
    const first = days[0] ? new Date(`${days[0].date}T00:00:00Z`) : undefined;
    if (!first || Number.isNaN(first.getTime()) || first.getUTCDate() > 7) return [];
    return [{ week, label: monthName.format(first) }];
  });
}

type LoadOptions = {
  /** A read-only GitHub token. Without one, nothing is asked and nothing is shown. */
  token?: string;
  login: string;
  repos: string[];
  /** A saved answer to read instead of asking GitHub (test builds). */
  fixture?: string;
  /** How many commits to keep. */
  limit?: number;
  fetchImpl?: typeof fetch;
};

/** Never throws. The one log line on failure says why, and never holds the token. */
export async function loadActivity({ token, login, repos, fixture, limit, fetchImpl = fetch }: LoadOptions): Promise<Activity | null> {
  const leftOut = (reason: string) => {
    console.warn(`GitHub activity left out: ${reason}`);
    return null;
  };
  try {
    if (fixture) return parseActivity(JSON.parse(readFileSync(fixture, 'utf8')), { login, repos, limit });
    if (!token) return leftOut('no token is set');
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'site-build' },
      body: JSON.stringify({ query: activityQuery(repos), variables: { login } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return leftOut(`GitHub answered ${response.status}`);
    return parseActivity(await response.json(), { login, repos, limit }) ?? leftOut('the answer held no calendar');
  } catch (error) {
    // The message of a network error can quote the request, so only its kind is logged.
    return leftOut(error instanceof Error ? error.name : 'unknown error');
  }
}
