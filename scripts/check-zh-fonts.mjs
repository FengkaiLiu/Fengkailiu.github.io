// Build check: warns when the site's Chinese text uses a character the font subsets don't
// have yet (it would show in the system font). Fix: npm run fonts:zh. See subset-zh-fonts.py.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CJK = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef]/g;
const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
const used = new Set([...files('src').filter((f) => f.endsWith('.ts')), 'index.html'].flatMap((f) => readFileSync(f, 'utf8').match(CJK) ?? []));
const have = new Set(readFileSync('src/fonts/zh/chars.txt', 'utf8'));
const missing = [...used].filter((c) => !have.has(c));
if (missing.length) console.warn(`\x1b[33m[zh fonts] ${missing.length} new characters aren't in the font subsets: ${missing.join('')}\n[zh fonts] Run npm run fonts:zh to add them.\x1b[0m`);
