// Checks that every translation key used in the code exists in every messages file,
// and that all messages files have the same keys. Run in CI: `npm run check:messages`.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f)) files.push(p);
  }
})(join(root, 'src'));

const locales = readdirSync(join(root, 'messages')).filter((f) => f.endsWith('.json'));
const messages = Object.fromEntries(locales.map((f) => [f, JSON.parse(readFileSync(join(root, 'messages', f), 'utf8'))]));
const get = (obj, path) => path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
const flat = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

const problems = [];
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const bindings = [...src.matchAll(/const (\w+) = (?:await getTranslations|useTranslations)\((?:\{[^}]*namespace: )?'([\w.]+)'/g)];
  for (const [, v, ns] of bindings) {
    for (const m of src.matchAll(new RegExp(`\\b${v}\\(\\s*(['\`])([^'\`]+)\\1`, 'g'))) {
      const raw = m[2];
      const dynamic = raw.includes('${');
      const key = dynamic ? raw.slice(0, raw.indexOf('${')).replace(/\.$/, '') : raw;
      for (const [loc, msgs] of Object.entries(messages)) {
        const val = get(msgs, `${ns}.${key}`);
        if (val === undefined || (dynamic ? typeof val !== 'object' : typeof val !== 'string')) {
          problems.push(`${loc}: ${ns}.${raw}  (${file.replace(root, '')})`);
        }
      }
    }
  }
}
const [first, ...rest] = Object.keys(messages);
const base = new Set(flat(messages[first]));
for (const loc of rest) {
  const other = new Set(flat(messages[loc]));
  for (const k of base) if (!other.has(k)) problems.push(`${loc}: missing ${k}`);
  for (const k of other) if (!base.has(k)) problems.push(`${first}: missing ${k}`);
}
if (problems.length) {
  console.error([...new Set(problems)].join('\n'));
  process.exit(1);
}
console.log(`messages ok: ${files.length} files, ${base.size} keys × ${locales.length} locales`);
