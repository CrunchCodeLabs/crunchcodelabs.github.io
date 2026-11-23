import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import TurndownService from 'turndown';

/*
 * Every privacy policy and set of terms is authored in its app's repository.
 * This script only copies them into src/content/legal/ for the site to render;
 * nothing under src/content/legal/ is edited by hand. HTML sources are
 * converted to Markdown, Markdown sources are copied as they are.
 *
 * To change a policy: edit it in the app repo, then run
 *   node scripts/migrate-legal.mjs
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SIBLINGS = resolve(ROOT, '..');
const OUT = join(ROOT, 'src', 'content', 'legal');

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
td.remove(['script', 'style', 'nav']);

/*
 * Turndown has no table support, and these policies carry a data-retention
 * schedule. Without this rule the table collapses into loose paragraphs and the
 * category/period pairing is lost, which is a content change, not a style one.
 */
td.addRule('gfmTable', {
  filter: 'table',
  replacement: (_content, node) => {
    const rows = Array.from(node.querySelectorAll('tr'));
    if (rows.length === 0) return '';
    const cellsOf = (tr) =>
      Array.from(tr.children).map((cell) =>
        cell.textContent.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|'),
      );
    const header = cellsOf(rows[0]);
    const body = rows.slice(1).map(cellsOf);
    const line = (cells) => `| ${cells.join(' | ')} |`;
    return (
      '\n\n' +
      [line(header), line(header.map(() => '---')), ...body.map(line)].join('\n') +
      '\n\n'
    );
  },
});

// MyBookTrail's store/ was renamed to listing-resources/ during development.
const MBT = join(SIBLINGS, 'MyBookTrail', 'listing-resources', 'site');
const PMF = join(SIBLINGS, 'PureMathematicsSinhala', 'listing-resources');
const MER = join(SIBLINGS, 'Meritly', 'listing-resources');
const PDM = join(SIBLINGS, 'PayDayMate', 'docs', 'play-store');
const VAN = join(SIBLINGS, 'CarvanMate', 'docs', 'legal');

const PRIVACY = { kind: 'privacy', title: 'Privacy Policy' };
const TERMS = { kind: 'terms', title: 'Terms & Conditions' };

const JOBS = [
  { app: 'my-book-trail', ...PRIVACY, src: join(MBT, 'privacy-policy.html') },
  { app: 'my-book-trail', ...TERMS, src: join(MBT, 'terms.html') },
  { app: 'al-pure-mathematics', ...PRIVACY, src: join(PMF, 'privacy-policy.html') },
  { app: 'al-pure-mathematics', ...TERMS, src: join(PMF, 'terms.md') },
  { app: 'meritly', ...PRIVACY, src: join(MER, 'privacy-policy.md') },
  { app: 'meritly', ...TERMS, src: join(MER, 'terms.md') },
  { app: 'payday-mate', ...PRIVACY, src: join(PDM, 'privacy-policy.html') },
  { app: 'payday-mate', ...TERMS, src: join(PDM, 'terms.md') },
  { app: 'vanready', ...PRIVACY, src: join(VAN, 'vanready-privacy.md') },
  { app: 'vanready', ...TERMS, src: join(VAN, 'vanready-terms.md') },
];

function fromHtml(html) {
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? html;

  const stripped = body
    // The page hero carries a theme-toggle button, a base64 app icon and the
    // document title. LegalLayout renders the title; the rest is page chrome.
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    // Site footer duplicates our own.
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<button[\s\S]*?<\/button>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    // Drop the document's own title. LegalLayout renders it, and leaving this
    // one in gives the page two <h1>s. Only the first is removed, so a stray
    // h1 deeper in the body would still surface rather than being hidden.
    .replace(/<h1[\s\S]*?<\/h1>/i, '');

  return td.turndown(stripped).replace(/\n{3,}/g, '\n\n').trim();
}

// Markdown sources open with their own "# Title" line so they read well in the
// app repo. LegalLayout renders the title, so that first h1 is dropped here.
function fromMarkdown(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/^\s*# .*\n/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

await mkdir(OUT, { recursive: true });

for (const job of JOBS) {
  const slug = `${job.app}-${job.kind}`;
  const source = await readFile(job.src, 'utf8');
  const md = job.src.endsWith('.md') ? fromMarkdown(source) : fromHtml(source);

  // The date moves only when the text does, so re-running this after one app's
  // policy changes does not re-date every other app's.
  const target = join(OUT, `${slug}.md`);
  const previous = (await readFile(target, 'utf8').catch(() => '')).replace(/\r\n/g, '\n');
  const prevBody = previous.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
  const prevDate = /^updated: (\S+)$/m.exec(previous)?.[1];
  const changed = !(prevDate && prevBody === md);
  const updated = changed ? new Date().toISOString().slice(0, 10) : prevDate;

  const front = [
    '---',
    `app: ${job.app}`,
    `kind: ${job.kind}`,
    `title: ${job.title}`,
    `updated: ${updated}`,
    '---',
    '',
  ].join('\n');

  await writeFile(target, front + md + '\n', 'utf8');

  // Loud enough to notice if a future source page changes shape.
  const checks = {
    'base64 blobs': (md.match(/data:image/g) || []).length,
    'raw html': (md.match(/<[a-z][^>]*>/gi) || []).length,
    tables: (md.match(/^\|/gm) || []).length,
  };
  console.log(
    `${changed ? 'updated  ' : 'unchanged'} ${slug}.md (${md.length} chars) — ` +
      Object.entries(checks)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', '),
  );
}

// Anything else in the folder was written by hand, which this setup rules out.
const expected = new Set(JOBS.map((j) => `${j.app}-${j.kind}.md`));
const strays = (await readdir(OUT)).filter((f) => f.endsWith('.md') && !expected.has(f));
if (strays.length) {
  console.warn(`\nNot from any app repo (move it there and add a job): ${strays.join(', ')}`);
  process.exitCode = 1;
}
