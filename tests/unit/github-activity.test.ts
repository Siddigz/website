import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  activityQuery,
  allowedRepos,
  loadActivity,
  monthLabels,
  parseActivity,
} from '../../src/lib/github-activity';

const FIXTURE = 'tests/fixtures/github-activity.json';
const fixture = () => JSON.parse(readFileSync(FIXTURE, 'utf8'));
const LOGIN = 'Siddigz';
const REPOS = ['website', 'brightspace-deadlines', 'cuRiding-pi'];
const TOKEN = 'token-for-tests-only';

const answer = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

afterEach(() => vi.restoreAllMocks());

describe('allowedRepos', () => {
  it('lists every repository the content links, plus the site itself, once each', () => {
    const projects = [
      { data: { links: { repo: 'https://github.com/Siddigz/cuRiding', extraRepos: ['https://github.com/Siddigz/cuRiding-Server'] } } },
      { data: { links: { repo: 'https://github.com/Siddigz/curate/' } } },
      { data: { links: {} } },
      { data: { links: { repo: 'https://github.com/Siddigz/cuRiding' } } },
    ];
    expect(allowedRepos(projects, 'https://github.com/Siddigz/website')).toEqual([
      'cuRiding',
      'cuRiding-Server',
      'curate',
      'website',
    ]);
  });

  it('leaves out anything that is not a plain repository name', () => {
    const projects = [{ data: { links: { repo: 'https://github.com/Siddigz/bad"name' } } }];
    expect(allowedRepos(projects, 'https://example.com/not-github')).toEqual([]);
  });
});

describe('activityQuery', () => {
  it('asks for the calendar and for each repository by name', () => {
    const query = activityQuery(['website', 'cuRiding-pi']);
    expect(query).toContain('contributionCalendar');
    expect(query).toContain('r0: repository(owner: $login, name: "website")');
    expect(query).toContain('r1: repository(owner: $login, name: "cuRiding-pi")');
  });
});

describe('parseActivity', () => {
  const parsed = () => parseActivity(fixture(), { login: LOGIN, repos: REPOS })!;

  it('keeps the total and every week, with levels from 0 to 4', () => {
    const activity = parsed();
    const calendar = fixture().data.user.contributionsCollection.contributionCalendar;
    expect(activity.total).toBe(calendar.totalContributions);
    expect(activity.weeks.length).toBe(53);
    expect(activity.weeks[0]![0]).toEqual({ date: '2025-11-16', count: expect.any(Number), level: expect.any(Number) });
    const levels = new Set(activity.weeks.flat().map((day) => day.level));
    expect([...levels].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('maps the level names GitHub uses', () => {
    const json = fixture();
    const days = json.data.user.contributionsCollection.contributionCalendar.weeks[0].contributionDays;
    ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE', 'SOMETHING_NEW'].forEach(
      (name, index) => (days[index].contributionLevel = name),
    );
    const week = parseActivity(json, { login: LOGIN, repos: REPOS })!.weeks[0]!;
    expect(week.slice(0, 6).map((day) => day.level)).toEqual([0, 1, 2, 3, 4, 0]);
  });

  it('shows the five newest commits by the owner, from allowed public repositories only', () => {
    const { commits } = parsed();
    expect(commits.map((commit) => [commit.repo, commit.date])).toEqual([
      ['website', '2026-11-19'],
      ['brightspace-deadlines', '2026-11-18'],
      ['website', '2026-11-17'],
      ['cuRiding-pi', '2026-11-15'],
      ['brightspace-deadlines', '2026-11-12'],
    ]);
    for (const commit of commits) {
      expect(commit.url).toMatch(/^https:\/\/github\.com\/Siddigz\/[\w.-]+\/commit\/[0-9a-f]+$/);
    }
    const text = JSON.stringify(commits);
    expect(text).not.toContain('helper account');
    expect(text).not.toContain('never appear');
  });

  it('cuts a long headline at 80 characters', () => {
    const long = parsed().commits.find((commit) => commit.message.endsWith('…'))!;
    expect(long.message.length).toBe(80);
    expect(long.message.startsWith('Show a clear message when the calendar feed is empty')).toBe(true);
  });

  it('respects the limit', () => {
    expect(parseActivity(fixture(), { login: LOGIN, repos: REPOS, limit: 2 })!.commits.length).toBe(2);
  });

  it('still answers when no repository came back', () => {
    const json = { data: { user: fixture().data.user } };
    expect(parseActivity(json, { login: LOGIN, repos: REPOS })!.commits).toEqual([]);
  });

  it.each([null, 'text', {}, { data: null }, { errors: [{ message: 'Bad credentials' }] }, { data: { user: null } }])(
    'gives nothing for %j',
    (json) => {
      expect(parseActivity(json, { login: LOGIN, repos: REPOS })).toBeNull();
    },
  );
});

describe('monthLabels', () => {
  it('names each month at the first week that starts in it', () => {
    const labels = monthLabels(parseActivity(fixture(), { login: LOGIN, repos: REPOS })!.weeks);
    expect(labels.map((label) => label.label)).toEqual([
      'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov',
    ]);
    expect(labels[0]).toEqual({ week: 3, label: 'Dec' });
    // Every label has room: at least three weeks before the next one.
    labels.slice(1).forEach((label, index) => expect(label.week - labels[index]!.week).toBeGreaterThanOrEqual(3));
  });
});

describe('loadActivity', () => {
  const options = { login: LOGIN, repos: REPOS };

  it('reads a fixture file without asking GitHub', async () => {
    const fetchImpl = answer({});
    const activity = await loadActivity({ ...options, fixture: FIXTURE, limit: 3, fetchImpl });
    expect(activity?.weeks.length).toBe(53);
    expect(activity?.commits.length).toBe(3);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('gives nothing, and asks nothing, without a token', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchImpl = answer(fixture());
    expect(await loadActivity({ ...options, fetchImpl })).toBeNull();
    expect(await loadActivity({ ...options, token: '', fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('sends one request with the token and returns the data', async () => {
    const fetchImpl = answer(fixture());
    const activity = await loadActivity({ ...options, token: TOKEN, fetchImpl });
    expect(activity?.commits.length).toBe(5);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/graphql');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('authorization')).toBe(`bearer ${TOKEN}`);
    expect(JSON.parse(String(init.body)).variables).toEqual({ login: LOGIN });
  });

  it.each([
    ['a refused token', () => answer({ message: 'Bad credentials' }, 401)],
    ['an error body', () => answer({ errors: [{ message: 'Something went wrong' }] })],
    ['a body that is not JSON', () => vi.fn(async () => new Response('<html>', { status: 200 }))],
    ['a failed request', () => vi.fn(async () => Promise.reject(new Error(`network down for ${TOKEN}`)))],
  ])('gives nothing for %s, and never logs the token', async (_name, make) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await loadActivity({ ...options, token: TOKEN, fetchImpl: make() as unknown as typeof fetch })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(TOKEN);
  });

  it('gives nothing for a fixture that cannot be read', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await loadActivity({ ...options, fixture: 'tests/fixtures/missing.json' })).toBeNull();
  });
});
