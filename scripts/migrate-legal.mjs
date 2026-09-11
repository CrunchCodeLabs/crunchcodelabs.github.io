import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import TurndownService from 'turndown';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// MyBookTrail's store/ was renamed to listing-resources/ during development.
const SRC = resolve(ROOT, '..', 'MyBookTrail', 'listing-resources', 'site');
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

const JOBS = [
  {
    file: 'privacy-policy.html',
    slug: 'my-book-trail-privacy',
    kind: 'privacy',
    title: 'Privacy Policy',
  },
  { file: 'terms.html', slug: 'my-book-trail-terms', kind: 'terms', title: 'Terms & Conditions' },
];

await mkdir(OUT, { recursive: true });

for (const job of JOBS) {
  const html = await readFile(join(SRC, job.file), 'utf8');
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? html;

  const stripped = body
    // The page hero carries a theme-toggle button, a base64 app icon and the
    // document title. LegalLayout renders the title; the rest is page chrome.
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    // Site footer duplicates our own.
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<button[\s\S]*?<\/button>/gi, '')
    .replace(/<img[^>]*>/gi, '');

  const md = td
    .turndown(stripped)
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const updated = new Date().toISOString().slice(0, 10);

  const front = [
    '---',
    `app: ${job.slug.replace(/-(privacy|terms)$/, '')}`,
    `kind: ${job.kind}`,
    `title: ${job.title}`,
    `updated: ${updated}`,
    '---',
    '',
  ].join('\n');

  await writeFile(join(OUT, `${job.slug}.md`), front + md + '\n', 'utf8');

  // Loud enough to notice if a future source page changes shape.
  const checks = {
    'base64 blobs': (md.match(/data:image/g) || []).length,
    'raw html': (md.match(/<[a-z][^>]*>/gi) || []).length,
    tables: (md.match(/^\|/gm) || []).length,
  };
  console.log(
    `wrote ${job.slug}.md (${md.length} chars) — ` +
      Object.entries(checks)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', '),
  );
}
