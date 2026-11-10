import { buildApp } from './app';
import { config } from './config';

const { app } = await buildApp();
await app.listen({ port: config.port, host: config.host });
app.log.info(`BUPI jalan di ${config.publicUrl} (admin: ${config.publicUrl}/admin/)`);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await app.close();
    process.exit(0);
  });
}
