<script lang="ts">
  // Waktu relatif ("5 mnt lalu") dengan tanggal lengkap saat kursor diarahkan; diperbarui tiap menit.
  import { ago, dt } from '../../lib/store.svelte';
  import { CLOCK } from '../../lib/clock.svelte';
  let { t }: { t: string | number | null | undefined } = $props();
</script>
<span title={dt(t)}>{ago(t, CLOCK.now)}</span>
