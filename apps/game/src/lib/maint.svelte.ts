// Mode perawatan: diisi saat server membalas 503 "maintenance" (lihat api.ts); App.svelte lalu menampilkan layar perawatan.
export interface MaintInfo { title: string; message: string; until: string | null }
export const MAINT = $state<{ info: MaintInfo | null }>({ info: null });
