<script lang="ts">
  import { PET_COLORS, PET_PARTS, petSVG } from '@kb/shared';
  const EARS = PET_PARTS.ear.filter((p) => p[2] <= 1);
  import { G, setState, toast, fail, track } from '../lib/game.svelte';
  import { api, ApiError } from '../lib/api';
  import { sfx } from '../lib/sfx';

  let name = $state('');
  let owner = $state(G.me?.user?.display_name && G.me.user.display_name !== 'Tamu' ? G.me.user.display_name : '');
  let color = $state(PET_COLORS[0]);
  let ear = $state('tunas');
  let busy = $state(false);
  const SUGGEST = ['Mochi', 'Onde', 'Cilok', 'Serabi', 'Kopi', 'Klepon', 'Gendhis', 'Getuk'];
  const A1 = ['Si', 'Mbak', 'Mas', 'Dek', 'Kak', 'Bang', 'Neng', 'Om'];
  const A2 = ['Bulbul', 'Gembul', 'Pentol', 'Cimol', 'Rengginang', 'Kerupuk', 'Mendoan', 'Wedang', 'Bakpia', 'Lemper', 'Dodol', 'Putu'];
  const roll = () => { name = `${A1[Math.floor(Math.random() * A1.length)]} ${A2[Math.floor(Math.random() * A2.length)]}`.slice(0, 16); sfx.tap(); };
  // nama ketik bebas: matikan isi-otomatis browser & pengelola sandi (yang bisa muncul dan meminta "login")
  const NOFILL = { autocomplete: 'off', 'data-1p-ignore': '', 'data-lpignore': 'true', 'data-bwignore': 'true', 'data-form-type': 'other' };

  async function submit(e: Event) {
    e.preventDefault();
    busy = true;
    try {
      const body = { name: name.trim(), color, ear, ownerName: owner.trim() || undefined };
      let r: any;
      try { r = await api.post('/api/pet', body); }
      catch (x) {
        // sesi tamu hilang (cookie terhapus/kedaluwarsa) sebelum pet dibuat: buat sesi baru lalu coba sekali lagi
        if (!(x instanceof ApiError) || x.status !== 401 || G.config?.login?.guest === false) throw x;
        await api.post('/api/auth/guest');
        r = await api.post('/api/pet', body);
      }
      setState(r.state);
      sfx.level();
      toast(`Selamat datang, ${name}!`, 'good');
      track('tutorial_done');
      const inv = localStorage.getItem('kb-invite');
      if (inv) {
        localStorage.removeItem('kb-invite');
        api.post('/api/friends', { code: inv }).then((f) => toast(`Kamu sekarang berteman dengan ${f.friend.display_name}.`, 'good')).catch(() => {});
      }
    } catch (e) { fail(e); } finally { busy = false; }
  }
</script>

<main class="setup">
  <h1>Kenalan dulu, yuk</h1>
  <div class="preview">{@html petSVG({ color, ear }, [], 'pet-bob')}</div>
  <form onsubmit={submit} autocomplete="off" data-form-type="other">
    <label for="pet-name">Nama pet</label>
    <input id="pet-name" name="bupi-pet" class="input" maxlength="16" required bind:value={name} placeholder="Ketik nama bebas, mis. Mochi" {...NOFILL} />
    <div class="chips">
      <button type="button" class="chip dice" onclick={roll}>Acak</button>
      {#each SUGGEST as s}<button type="button" class="chip" onclick={() => (name = s)}>{s}</button>{/each}
    </div>
    <label for="owner-name">Nama kamu <span class="opt">(boleh dikosongkan)</span></label>
    <input id="owner-name" name="bupi-owner" class="input" maxlength="16" bind:value={owner} placeholder="Nama panggilan" {...NOFILL} />
    <span class="lbl">Warna bulu</span>
    <div class="swatches">
      {#each PET_COLORS as c}
        <button type="button" class="sw" class:on={color === c} style="--c:{c}" aria-label="Warna {c}" onclick={() => { color = c; sfx.tap(); }}></button>
      {/each}
    </div>
    <span class="lbl">Telinga</span>
    <div class="ears">
      {#each EARS as [k, l]}
        <button type="button" class="btn sm" class:on={ear === k} onclick={() => { ear = k; sfx.tap(); }}>{l}</button>
      {/each}
    </div>
    <button class="btn hot block go" disabled={busy || name.trim().length < 2}>Mulai main</button>
  </form>
</main>

<style>
  .setup { min-height: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: calc(var(--safe-t) + 18px) max(18px, var(--safe-r)) calc(var(--safe-b) + 24px) max(18px, var(--safe-l)); background: linear-gradient(180deg, var(--bg1), var(--bg2)); overflow-y: auto; }
  h1 { margin: 0; font-size: 30px; font-weight: 800; }
  .preview { width: 150px; height: 158px; }
  .preview :global(svg) { width: 100%; height: 100%; overflow: visible; }
  form { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 8px; background: var(--paper); border: 3px solid var(--ink); border-radius: 22px; box-shadow: 0 5px 0 var(--ink); padding: 18px; }
  label, .lbl { font-weight: 800; font-size: 15.5px; margin-top: 4px; }
  .opt { font-weight: 600; color: var(--muted); font-size: 13px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { border: 2px solid var(--ink); background: var(--tint); border-radius: 999px; padding: 3px 11px; font-weight: 700; font-size: 14px; cursor: pointer; min-height: 32px; }
  .chip.dice { background: var(--coin); }
  .swatches { display: flex; flex-wrap: wrap; gap: 10px; }
  .sw { width: 40px; height: 40px; border-radius: 50%; border: 2.5px solid var(--ink); background: var(--c); cursor: pointer; padding: 0; }
  .sw.on { box-shadow: 0 0 0 3px var(--paper), 0 0 0 6px var(--ink); }
  .ears { display: flex; flex-wrap: wrap; gap: 8px; }
  .go { margin-top: 10px; font-size: 19px; min-height: 52px; }
</style>
