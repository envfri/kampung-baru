// Panel admin › WhatsApp: daftar pemain yang sudah menyambungkan nomor WhatsApp (nomor disamarkan),
// supaya admin bisa memutuskan sambungan lewat POST /api/admin/whatsapp/unlink/:id (routes/wa.ts).
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index';
import { requireAdmin } from '../lib/auth';
import { maskPhone } from '../lib/klikflow';

export default async function adminCommsRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const adm = { preHandler: requireAdmin(db, 'admin') };

  app.get('/api/admin/whatsapp/numbers', adm, async () => {
    const rows = await db.query<any>(
      `select id, display_name, friend_code, wa_phone, wa_verified_at, last_seen_at, banned_at,
              (notify_prefs->>'whatsapp')::boolean is false as opted_out
         from users where wa_verified_at is not null
        order by wa_verified_at desc limit 500`,
    );
    return { numbers: rows.map(({ wa_phone, ...r }) => ({ ...r, phone: maskPhone(wa_phone) })) };
  });
}
