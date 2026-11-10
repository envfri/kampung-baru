// Tulis ulang CHANGELOG.md dari packages/shared/src/changelog.ts.  Jalankan: npm run changelog
import { writeFileSync } from 'node:fs';
import { changelogMarkdown, APP_VERSION } from '../packages/shared/src/changelog.ts';

writeFileSync(new URL('../CHANGELOG.md', import.meta.url), changelogMarkdown() + '\n');
console.log(`CHANGELOG.md ditulis (versi terbaru ${APP_VERSION})`);
