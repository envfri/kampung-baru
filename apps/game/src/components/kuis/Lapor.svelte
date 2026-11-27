<script lang="ts">
  // "Laporkan soal": alasan + catatan singkat (≤ 200 huruf). Batas laporan per hari dihitung server.
  import { KZ, sendReport } from '../../lib/kuis.svelte';
  import { sfx } from '../../lib/sfx';
  const REASONS: [string, string][] = [['salah', 'Jawaban salah'], ['bingung', 'Soal membingungkan'], ['ketik', 'Salah ketik'], ['lain', 'Lainnya']];
  let reason = $state(''), note = $state(''), busy = $state(false);
  const close = () => { KZ.report = null; };
  async function send() {
    if (!KZ.report || !reason || busy) return;
    busy = true;
    if (await sendReport(KZ.report.qid, reason, note.trim())) close();
    busy = false;
  }
  function key(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
</script>

<svelte:window onkeydown={key} />
<div class="bd" onclick={close} role="presentation"></div>
<section class="lapor" role="dialog" aria-modal="true" aria-label="Laporkan soal">
  <h3>Laporkan soal</h3>
  <p class="qt">“{KZ.report?.text}”</p>
  <div class="rs" role="radiogroup" aria-label="Alasan">
    {#each REASONS as [k, l]}
      <button role="radio" aria-checked={reason === k} class:on={reason === k} onclick={() => { reason = k; sfx.tap(); }}>{l}</button>
    {/each}
  </div>
  <label class="nt">Catatan (boleh kosong)
    <textarea bind:value={note} maxlength="200" rows="3" placeholder="Mis. kunci jawabannya seharusnya…"></textarea>
    <small>{note.length}/200</small>
  </label>
  {#if KZ.home?.reportsLeft !== undefined}<p class="left">Sisa laporan hari ini: {KZ.home.reportsLeft}</p>{/if}
  <div class="btns">
    <button class="btn" onclick={close}>Batal</button>
    <button class="btn hot" disabled={!reason || busy} onclick={send}>Kirim laporan</button>
  </div>
</section>

<style>
  .bd { position: fixed; inset: 0; z-index: 80; background: rgba(43,47,74,.35); }
  .lapor { position: fixed; z-index: 81; left: 50%; bottom: 0; transform: translateX(-50%); width: min(480px, 100%); background: var(--paper); border: 3px solid var(--ink); border-bottom: 0; border-radius: 22px 22px 0 0; padding: 14px 16px calc(var(--safe-b) + 16px); display: flex; flex-direction: column; gap: 10px; animation: kz-up .22s ease-out; }
  h3 { margin: 0; font-size: 20px; font-weight: 800; }
  .qt { margin: 0; font-size: 14px; font-weight: 600; color: var(--muted); max-height: 4.2em; overflow: hidden; }
  .rs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .rs button { min-height: 48px; border: 2.5px solid var(--ink); border-radius: 14px; background: var(--card); font: 700 15px var(--font); color: var(--ink); cursor: pointer; box-shadow: 0 3px 0 var(--ink); }
  .rs button.on { background: var(--coin); }
  .nt { display: flex; flex-direction: column; gap: 4px; font-weight: 700; font-size: 14px; position: relative; }
  textarea { font: 600 15px var(--font); border: 2.5px solid var(--ink); border-radius: 12px; padding: 8px 10px; resize: none; background: #fff; color: var(--ink); }
  small { align-self: flex-end; color: var(--muted); font-weight: 700; }
  .left { margin: 0; font-size: 12.5px; font-weight: 700; color: var(--muted); }
  .btns { display: flex; gap: 8px; } .btns .btn { flex: 1; min-height: 48px; }
  @keyframes kz-up { from { transform: translate(-50%, 40px); opacity: .5; } }
  @media (prefers-reduced-motion: reduce) { .lapor { animation: none; } }
  :global(:root.reduce-motion) .lapor { animation: none; }
</style>
