#!/usr/bin/env node

/**
 * Assert the contact address the site advertises can actually receive mail.
 *
 * jcsoftdev.com carried hello@jcsoftdev.com in the hero, the rail, the contact
 * section, the résumé and the RSS author field while the domain had no MX
 * records at all. Every message anyone sent bounced, and nothing anywhere
 * reported it — not a test, not a build, not a log line. It was found by
 * running `dig` on a hunch.
 *
 * This is the same shape as a deploy that gets dropped without a record: the
 * failure is invisible precisely because nothing is watching for it. So watch
 * for it.
 *
 * Reads AUTHOR_EMAIL from src/lib/seo.ts, which is the single place the address
 * is defined, and resolves MX for its domain against public resolvers rather
 * than whatever the runner's DNS happens to be.
 */

import { Resolver } from 'node:dns/promises';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEO_PATH = resolve(HERE, '../src/lib/seo.ts');

// Two independent resolvers: one of them being slow or lying should not decide
// whether this check passes.
const RESOLVERS = [
  ['1.1.1.1', 'Cloudflare'],
  ['8.8.8.8', 'Google'],
];

const TIMEOUT_MS = 10_000;

function fail(message, detail) {
  console.error(`\n  ✗ ${message}\n`);
  if (detail) console.error(`${detail}\n`);
  process.exit(1);
}

async function readAdvertisedEmail() {
  let source;
  try {
    source = await readFile(SEO_PATH, 'utf8');
  } catch (err) {
    fail(`Could not read ${SEO_PATH}`, String(err));
  }

  const match = source.match(/export\s+const\s+AUTHOR_EMAIL\s*=\s*['"]([^'"]+)['"]/);
  if (!match) {
    fail(
      'AUTHOR_EMAIL was not found in src/lib/seo.ts.',
      'If it was renamed, update the pattern in this script — do not delete the\n' +
        'check. It exists because the address silently stopped working once.'
    );
  }
  return match[1];
}

async function resolveMx(domain, address, label) {
  const resolver = new Resolver({ timeout: TIMEOUT_MS, tries: 2 });
  resolver.setServers([address]);
  try {
    const records = await resolver.resolveMx(domain);
    return { label, records };
  } catch (err) {
    // ENODATA / NOTFOUND mean the lookup worked and there is nothing there,
    // which is a real answer. Anything else is the resolver failing us.
    const code = err?.code ?? 'UNKNOWN';
    if (code === 'ENODATA' || code === 'ENOTFOUND') return { label, records: [] };
    return { label, error: code };
  }
}

const email = await readAdvertisedEmail();
const domain = email.split('@')[1];

if (!domain) {
  fail(`AUTHOR_EMAIL is not a valid address: ${email}`);
}

console.log(`Checking that ${email} can receive mail…`);

const results = await Promise.all(RESOLVERS.map(([ip, label]) => resolveMx(domain, ip, label)));
const answered = results.filter((r) => !r.error);

if (answered.length === 0) {
  const detail = results.map((r) => `  ${r.label}: ${r.error}`).join('\n');
  fail(
    `No resolver could answer for ${domain}.`,
    `${detail}\n\nTreating this as inconclusive, not as a failure of the domain.`
  );
}

const withMx = answered.filter((r) => r.records.length > 0);

if (withMx.length === 0) {
  fail(
    `${domain} has no MX records — ${email} bounces.`,
    'The site advertises this address in the hero, the rail, the contact\n' +
      'section, /resume and the RSS author field. Right now every one of those\n' +
      'is a dead end.\n\n' +
      'Fix: point MX at a mail provider or a forwarder. Cloudflare Email\n' +
      'Routing is free and this domain is already on Cloudflare DNS.\n\n' +
      `Verify with:  dig +short MX ${domain}`
  );
}

const hosts = withMx[0].records
  .sort((a, b) => a.priority - b.priority)
  .map((r) => `${r.priority} ${r.exchange}`)
  .join(', ');

console.log(`  ✓ ${domain} accepts mail — ${hosts}`);

// A resolver that disagrees usually means DNS is still propagating. Worth
// saying, not worth failing over.
for (const r of answered) {
  if (r.records.length === 0) {
    console.log(`  note: ${r.label} sees no MX yet — DNS may still be propagating.`);
  }
}
