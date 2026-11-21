// Measures how fast the built site loads on a simulated mid-range phone, and
// fails if any page misses the budget (rule 12): a performance score of 95 or
// more, the largest content visible within 1.8 seconds, and layout shift
// under 0.05.
//
// Usage: npm run test:speed   (builds the test build first)
//    or: node scripts/measure-speed.mjs   (measures whatever is already built)
//
// Each page is measured three times and the middle run counts, so one noisy
// run cannot pass or fail the check by itself.
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

const PORT = 4327;
const RUNS = 3;
const BUDGET = { score: 95, largestContentMs: 1800, layoutShift: 0.05 };

// The home page, the first project page and the first explainer, whichever those are.
const first = (dir) => readdirSync(dir).filter((name) => name.endsWith('.md')).sort()[0]?.replace(/\.md$/, '');
const pages = ['/', `/projects/${first('src/content/projects')}`, `/explainers/${first('src/content/explainers')}`];

const middle = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function measure(url, port) {
  const { lhr } = await lighthouse(url, { port, onlyCategories: ['performance'], output: 'json', logLevel: 'error' });
  return {
    score: Math.round((lhr.categories.performance.score ?? 0) * 100),
    largestContentMs: Math.round(lhr.audits['largest-contentful-paint'].numericValue),
    layoutShift: Number(lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3)),
  };
}

const server = spawn('node', ['scripts/serve-dist.mjs', String(PORT)], { stdio: 'ignore' });
// The same browser the tests use, so no other one has to be installed.
const chrome = await launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-sandbox'] });
let failed = false;
try {
  await new Promise((resolve) => setTimeout(resolve, 800));
  const rows = [];
  for (const path of pages) {
    const runs = [];
    for (let run = 0; run < RUNS; run += 1) runs.push(await measure(`http://localhost:${PORT}${path}`, chrome.port));
    const result = {
      score: middle(runs.map((run) => run.score)),
      largestContentMs: middle(runs.map((run) => run.largestContentMs)),
      layoutShift: middle(runs.map((run) => run.layoutShift)),
    };
    const ok = result.score >= BUDGET.score && result.largestContentMs <= BUDGET.largestContentMs && result.layoutShift < BUDGET.layoutShift;
    failed ||= !ok;
    rows.push({ page: path, score: result.score, 'largest content (ms)': result.largestContentMs, 'layout shift': result.layoutShift, result: ok ? 'ok' : 'OVER BUDGET' });
  }
  console.table(rows);
  console.log(`Budget: score ${BUDGET.score} or more, largest content within ${BUDGET.largestContentMs} ms, layout shift under ${BUDGET.layoutShift}.`);
} finally {
  await chrome.kill();
  server.kill();
}
process.exit(failed ? 1 : 0);
