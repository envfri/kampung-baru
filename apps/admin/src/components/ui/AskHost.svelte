<script lang="ts">
  // Modal konfirmasi global (dipanggil lewat ask() di store): isian, ringkasan Sebelum → Sesudah, ketik nama untuk konfirmasi.
  import { A } from '../../lib/store.svelte';
  import Modal from './Modal.svelte';
  let vals = $state<Record<string, string>>({});
  let typed = $state('');
  $effect(() => {
    const a = A.ask;
    if (!a) return;
    vals = Object.fromEntries((a.fields ?? []).map((f) => [f.key, f.value ?? '']));
    typed = '';
  });
  const ok = $derived(!!A.ask && (!A.ask.typeToConfirm || typed.trim().toLowerCase() === A.ask.typeToConfirm.trim().toLowerCase())
    && (A.ask.fields ?? []).every((f) => !f.min || (vals[f.key] ?? '').trim().length >= f.min));
  function close(v: false | Record<string, string>) { const a = A.ask; A.ask = null; a?.resolve(v); }
</script>
{#if A.ask}
  {@const a = A.ask}
  <Modal title={a.title} sub={a.body ?? ''} icon={a.icon ?? (a.tone === 'danger' ? 'warn' : a.tone === 'ok' ? 'check' : 'info')} tone={a.tone ?? 'info'} wide={!!a.diff?.length} onclose={() => close(false)}>
    {#if a.diff?.length}
      <div class="tbl"><table>
        <thead><tr><th>Yang diubah</th><th>Sebelum</th><th>Sesudah</th></tr></thead>
        <tbody>{#each a.diff as d}<tr><td>{d.label}</td><td class="old">{d.before}</td><td class="new">{d.after}</td></tr>{/each}</tbody>
      </table></div>
    {/if}
    {#each a.fields ?? [] as f}
      <label>{f.label}
        {#if f.type === 'chips'}
          <span class="chips" role="radiogroup" aria-label={f.label}>{#each f.options ?? [] as o}<button type="button" role="radio" aria-checked={vals[f.key] === o} class:on={vals[f.key] === o} onclick={() => (vals[f.key] = o)}>{o}</button>{/each}</span>
        {:else if f.type === 'textarea'}<textarea rows="3" placeholder={f.placeholder} bind:value={vals[f.key]}></textarea>
        {:else}<input type={f.type === 'number' ? 'number' : 'text'} placeholder={f.placeholder} bind:value={vals[f.key]} />{/if}
        {#if f.help}<span class="help">{f.help}</span>{/if}
      </label>
    {/each}
    {#if a.note}<p class="note"><span>!</span>{a.note}</p>{/if}
    {#if a.typeToConfirm}
      <label><span>Ketik <code>{a.typeToConfirm}</code> untuk konfirmasi</span>
        <input bind:value={typed} autocomplete="off" spellcheck="false" onkeydown={(e) => { if (e.key === 'Enter' && ok) close({ ...vals }); }} />
      </label>
    {/if}
    {#snippet footer()}
      <button class="btn" onclick={() => close(false)}>{a.cancel ?? 'Batal'}</button>
      <button class="btn {a.tone === 'danger' ? 'danger solid' : a.tone === 'warn' ? 'warn solid' : 'primary'}" disabled={!ok} onclick={() => close({ ...vals })}>{a.confirm ?? 'Lanjutkan'}</button>
    {/snippet}
  </Modal>
{/if}
<style>
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chips button { border: 1.5px solid #C5CDC8; border-radius: 999px; padding: 4px 12px; font: 600 13px var(--body); background: #fff; color: var(--ink); cursor: pointer; }
  .chips button.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
  code { font-family: var(--mono); background: #F1F4F2; padding: 0 6px; border-radius: 5px; font-size: 13px; }
  .old { color: var(--danger); text-decoration: line-through; word-break: break-word; }
  .new { color: var(--accent); font-weight: 700; word-break: break-word; }
  .note { margin: 0; display: flex; gap: 8px; align-items: flex-start; background: var(--warn-soft); color: var(--warn); border-radius: 10px; padding: 8px 10px; font-size: 13px; font-weight: 600; }
  .note span { width: 18px; height: 18px; border-radius: 50%; background: var(--warn); color: #fff; display: grid; place-items: center; font-size: 12px; flex: none; }
</style>
