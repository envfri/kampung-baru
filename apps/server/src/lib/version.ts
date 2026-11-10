// Versi yang berjalan: nomor versi dari changelog, commit & waktu build disisipkan saat build (build.mjs).
import { APP_VERSION } from '@kb/shared';
import type { Db } from '../db/index';

declare const __BUILD_COMMIT__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

export const BUILD = {
  version: APP_VERSION,
  commit: (typeof __BUILD_COMMIT__ === 'string' && __BUILD_COMMIT__) || process.env.GIT_SHA || 'dev',
  builtAt: typeof __BUILD_TIME__ === 'string' && __BUILD_TIME__ ? __BUILD_TIME__ : null,
  startedAt: new Date().toISOString(),
};

/** Catat ke riwayat deploy bila versi/commit berbeda dari yang terakhir berjalan. */
export async function recordDeploy(db: Db) {
  const last = await db.one<{ version: string; commit: string }>(`select version, commit from deploys order by id desc limit 1`);
  if (last && last.version === BUILD.version && last.commit === BUILD.commit) return false;
  await db.query(`insert into deploys (version, commit, built_at) values ($1, $2, $3)`, [BUILD.version, BUILD.commit, BUILD.builtAt]);
  return true;
}
