import { api } from './api';
export async function uploadFile(f: File): Promise<{ id: string; url: string }> {
  if (f.size > 512 * 1024) throw new Error('Ukuran file maksimal 512 KB.');
  const buf = new Uint8Array(await f.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return api.post('/api/admin/media', { filename: f.name, mime: f.type, data: btoa(bin) });
}
