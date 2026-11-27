<script lang="ts">
  // Cerdas Cermat Kampung bersama Pak Kancil: beranda (beruntun, mode, papan peringkat teman), Kuis Harian &
  // Tantang Teman (soal dari server tanpa kunci; jawaban dinilai server), layar akhir & "Laporkan soal".
  // Cerdas Cermat Bareng dimainkan di rumah teman / Panggung alun-alun (components/bareng/KuisBareng.svelte).
  import { onMount, onDestroy } from 'svelte';
  import { kancilSVG, kancilLine, petSVG, KUIS_CATEGORIES, type KancilMood } from '@kb/shared';
  import { G, goTo, wearItems, fail, toast } from '../lib/game.svelte';
  import { api } from '../lib/api';
  import { COIN, PEARL, I } from '../lib/icons';
  import { sfx } from '../lib/sfx';
  import { KZ, kuisNow, loadHome, startHarian, startTantang, createTantang, answer, next, refreshRun, leaveKuis, akhiri } from '../lib/kuis.svelte';
  import Timer from '../components/kuis/Timer.svelte';
  import Soal from '../components/kuis/Soal.svelte';
  import Lapor from '../components/kuis/Lapor.svelte';

  const h = $derived(KZ.home);
  const cfg = $derived(h?.cfg ?? {});
  const run = $derived(KZ.run);
  const cur = $derived(run?.current ?? null);
  const rv = $derived(KZ.reveal);
  // soal yang ditampilkan: yang sedang berjalan, atau yang baru dijawab (dengan kuncinya)
  const shown = $derived(rv ? rv.q : cur?.q ?? null);
  const idxShown = $derived(rv ? rv.idx : cur?.idx ?? 0);
  let friends = $state<any[] | null>(null), pickId = $state<string | null>(null);

  onMount(async () => {
    await loadHome();
    const w = KZ.want;
    KZ.want = null;
    if (w?.duel) { const d = KZ.duels.find((x) => x.id === w.duel); if (d) { if (!d.me.played) startTantang(d); } }
    else if (w?.pick) openPick(w.pick);
  });
  onDestroy(() => { G.immersive = false; });
  // kembali dari latar belakang: ambil keadaan terbaru (soal yang lewat batas waktunya dicatat server)
  function onVis() { if (document.visibilityState === 'visible' && KZ.page === 'play' && KZ.run && !KZ.reveal) refreshRun(true); }
  onMount(() => { document.addEventListener('visibilitychange', onVis); return () => document.removeEventListener('visibilitychange', onVis); });

  async function openPick(id: string | null = null) {
    sfx.tap();
    KZ.page = 'pick'; pickId = id;
    try { friends = (await api.get('/api/friends')).friends; } catch (e) { fail(e); friends = []; }
  }
  async function home() { sfx.tap(); G.immersive = false; KZ.page = 'home'; KZ.run = null; KZ.reveal = null; await loadHome(); }
  async function quit() {
    if (!run || run.done) return home();
    // keluar di tengah permainan: Kuis Harian bisa dilanjutkan nanti (soal yang sedang berjalan tetap dihitung waktunya)
    if (run.kind === 'harian') { toast('Kuis Harian bisa kamu lanjutkan nanti hari ini.'); return home(); }
    return home();
  }
  const timeout = () => { if (cur && !rv && !KZ.sending) answer(null); };
  const mood = $derived<KancilMood>(rv ? (rv.correct ? 'senang' : 'hmm') : KZ.page === 'end' ? (run?.result && run.result.correct === run.result.total ? 'sorak' : (run?.result?.correct ?? 0) * 2 >= (run?.result?.total ?? 1) ? 'senang' : 'hmm') : 'netral');
  const ava = (p: any) => (p ? petSVG({ color: p.color ?? '#F2EEE3', ear: p.ear ?? 'tunas', pattern: p.pattern, eyes: p.eyes, tail: p.tail }, wearItems(p.wear)) : '');
  const todo = $derived(KZ.duels.filter((d: any) => (d.status === 'open' || d.status === 'live') && !d.me.played));
  const waiting = $derived(KZ.duels.filter((d: any) => (d.status === 'open' || d.status === 'live') && d.me.played));
  const past = $derived(KZ.duels.filter((d: any) => d.status === 'done').slice(0, 4));
  const until = (t: number) => { const m = Math.max(0, Math.round((t - Date.now()) / 60000)); return m >= 90 ? `${Math.round(m / 60)} jam lagi` : m >= 1 ? `${m} mnt lagi` : 'sebentar lagi'; };
  const sec = (ms: number) => (ms / 1000).toFixed(1).replace('.', ',');
  const catName = (c: string) => (KUIS_CATEGORIES as any)[c]?.short ?? c;
  const catColor = (c: string) => (KUIS_CATEGORIES as any)[c]?.color ?? '#5F6478';
  const qText = (a: any) => a?.q?.q ?? '';
  // Tantang: hasil dari daftar duel terbaru
  let duelNow = $state<any>(null);
  $effect(() => {
    if (KZ.page !== 'end' || !run?.duelId) return;
    api.get(`/api/duels/${run.duelId}`).then((r) => (duelNow = r.duel)).catch(() => {});
  });
  async function giveUp() {
    if (!run) return;
    const r = await akhiri(run.id);
    if (r) { KZ.reveal = null; KZ.page = 'end'; G.immersive = false; }
  }
  let armGiveUp = $state(false);
</script>

<div class="kuis" class:playing={KZ.page === 'play'}>
  {#if KZ.page === 'home'}
    <div class="col">
      <header class="hero">
        <div class="host">{@html kancilSVG('netral', { podium: true, label: 'Pak Kancil, pembawa acara' })}</div>
        <div class="bubble"><b>Cerdas Cermat Kampung</b><span>Halo! Aku Pak Kancil. Siap mengasah otak hari ini?</span></div>
      </header>
      {#if !h}<p class="muted">Memuat kuis…</p>
      {:else}
        <section class="card streak">
          <span class="fire" aria-hidden="true">★</span>
          <div><b>Beruntun {h.streak.streak} hari</b><span>{h.streak.today ? 'Kuis hari ini sudah selesai. Sampai besok!' : 'Selesaikan Kuis Harian tiap hari.'} Bonus di hari ke-3 (+{cfg.streak3Coins}) &amp; ke-7 (+{cfg.streak7Coins}{cfg.streak7Pearls ? ` + ${cfg.streak7Pearls} Mutiara` : ''}). Terbaik: {h.streak.best} hari.</span></div>
        </section>

        <section class="card mode harian">
          <div class="mh"><b>Kuis Harian</b><em>{cfg.dailyCount} soal · {cfg.timerSec} dtk/soal · {cfg.energi} energi</em></div>
          <p class="sub">{@html COIN} +{cfg.coins} koin tiap jawaban benar, semua benar +{cfg.perfectCoins}. Soal campuran 8 kategori, dari mudah ke sulit.</p>
          {#if h.today?.done}
            <div class="done"><b>Selesai: {h.today.correct}/{h.today.total} benar · {h.today.score} poin</b><span>Soal baru besok pukul 00.00 WIB.</span></div>
            <button class="btn block" disabled={KZ.busy} onclick={startHarian}>Lihat hasil hari ini</button>
          {:else if h.today}
            <button class="btn hot block big" disabled={KZ.busy} onclick={startHarian}>Lanjutkan ({h.today.answered}/{h.today.total})</button>
          {:else}
            <button class="btn hot block big" disabled={KZ.busy} onclick={startHarian}>Mulai Kuis Harian</button>
          {/if}
        </section>

        <section class="card mode tantang">
          <div class="mh"><b>Tantang Teman</b><em>{cfg.tantangCount} soal sama · sisa {h.tantangLeft}× hari ini</em></div>
          <p class="sub">Kamu main duluan, temanmu nanti menjawab soal yang sama dengan waktu yang sama. Lebih banyak benar menang; kalau seri, yang lebih cepat menang.</p>
          {#each todo as d (d.id)}
            <div class="duel hot"><span class="ava">{@html ava(d.them.pet)}</span><div><b>vs {d.them.name}</b><span>{d.them.played ? `${d.them.name}: ${d.them.label}. Giliranmu!` : d.me.started ? 'Kamu belum selesai.' : `${d.them.name} menantangmu`} · batal {until(d.expiresAt)}</span></div><button class="btn sm hot" disabled={KZ.busy} onclick={() => startTantang(d)}>{d.me.started ? 'Lanjut' : 'Main'}</button></div>
          {/each}
          {#each waiting as d (d.id)}
            <div class="duel"><span class="ava">{@html ava(d.them.pet)}</span><div><b>vs {d.them.name}</b><span>Skormu {d.me.label} · menunggu {d.them.name} main</span></div></div>
          {/each}
          {#each past as d (d.id)}
            <div class="duel past"><span class="ava">{@html ava(d.them.pet)}</span><div><b>vs {d.them.name}</b><span>{d.me.label} vs {d.them.label}</span></div><i class="res {d.result}">{d.result === 'menang' ? 'Menang' : d.result === 'kalah' ? 'Kalah' : 'Seri'}</i></div>
          {/each}
          <button class="btn block" disabled={h.tantangLeft <= 0} onclick={() => openPick()}>Tantang teman</button>
        </section>

        <section class="card mode bareng">
          <div class="mh"><b>Cerdas Cermat Bareng</b><em>2–4 pemain · {cfg.barengCount} soal</em></div>
          <p class="sub">Main langsung di rumah teman atau di Panggung alun-alun (menu Main bareng). Semua melihat soal yang sama: yang pertama benar membunyikan lonceng <b>+3</b>, benar lainnya <b>+2</b>.</p>
          <div class="row">
            <button class="btn" onclick={() => { sfx.tap(); G.immersive = false; goTo('alun'); }}>Ke Alun-alun</button>
            <button class="btn" onclick={() => { sfx.tap(); G.immersive = false; G.view = 'home'; G.sheet = 'friends'; }}>Ke rumah teman</button>
          </div>
        </section>

        <section class="card board">
          <div class="mh"><b>Papan Peringkat Minggu Ini</b><em>kamu &amp; teman · Senin–Minggu</em></div>
          {#each h.week.board as r (r.id)}
            <div class="rk" class:me={r.me}><b class="n">{r.rank}</b><span class="ava">{@html ava(r.pet)}</span><span class="nm">{r.name}{r.me ? ' (kamu)' : ''}</span><em>{r.points} poin</em></div>
          {/each}
          {#if h.week.board.length <= 1}<p class="muted">Belum ada temanmu yang ikut minggu ini. Ajak mereka main kuis!</p>{/if}
        </section>
      {/if}
      <button class="btn block" onclick={leaveKuis}>{@html I.back} Kembali ke Balai Main</button>
    </div>

  {:else if KZ.page === 'pick'}
    <div class="col">
      <section class="card">
        <div class="mh"><b>Tantang teman</b><em>{cfg.tantangCount} soal · {cfg.timerSec} dtk/soal</em></div>
        {#if friends === null}<p class="muted">Memuat teman…</p>
        {:else if !friends.length}<p class="muted">Belum ada teman. Tambah teman dulu lewat menu Teman.</p>
        {:else}
          <div class="friends" role="radiogroup" aria-label="Pilih teman">
            {#each friends as f (f.id)}
              <button role="radio" aria-checked={pickId === f.id} class:on={pickId === f.id} onclick={() => { pickId = f.id; sfx.tap(); }}>
                <span class="ava">{@html ava(f)}</span><span class="nm">{f.display_name}</span>
              </button>
            {/each}
          </div>
        {/if}
        <div class="row"><button class="btn" onclick={home}>Batal</button><button class="btn hot" disabled={!pickId || KZ.busy} onclick={() => pickId && createTantang(pickId)}>Tantang!</button></div>
      </section>
    </div>

  {:else if KZ.page === 'play' && run}
    <div class="top">
      <button class="btn sm quit" onclick={quit} aria-label="Keluar dari kuis">{@html I.back}<span>Keluar</span></button>
      <div class="prog" aria-label="Soal {idxShown + 1} dari {run.total}">
        <b>Soal {idxShown + 1}/{run.total}</b>
        <span class="dots">{#each Array(run.total) as _, i}{@const a = run.answers.find((x: any) => x.idx === i)}<i class:ok={a?.correct} class:no={a && !a.correct} class:cur={i === idxShown}></i>{/each}</span>
      </div>
      {#if cur && !rv}<Timer deadline={cur.deadline} total={cur.limitMs} now={kuisNow} onexpire={timeout} />{:else}<span class="tsp"></span>{/if}
    </div>
    <div class="stage">
      <div class="card play">
        {#if shown}
          <Soal q={shown} reveal={rv} mine={rv?.pick ?? null} locked={KZ.sending || !!rv} onpick={(p) => answer(p)} />
        {:else}
          <p class="muted">Soal berikutnya siap.</p>
          <button class="btn hot block big" disabled={KZ.busy} onclick={next}>Lanjut</button>
        {/if}
      </div>
      <div class="kcrow" aria-hidden="true">
        <div class="kc">{@html kancilSVG(mood, { podium: true })}</div>
        <p class="say">{rv ? (rv.correct ? 'Benar sekali! Pintar!' : rv.timedOut ? 'Waktunya habis! Tidak apa-apa.' : 'Hmm, belum tepat. Simak penjelasannya, ya.') : shown?.type === 'urutkan' ? 'Ketuk dari yang pertama, ya!' : shown?.type === 'cocokkan' ? 'Pasangkan kiri dan kanan!' : 'Pikirkan baik-baik, ya!'}</p>
      </div>
    </div>
    {#if rv}
      <div class="reveal" class:good={rv.correct} role="status">
        <div class="rh">
          <b>{rv.correct ? 'Benar!' : rv.timedOut ? 'Waktu habis!' : 'Belum tepat'}</b>
          {#if rv.correct}<span class="gain">{[rv.coins ? `+${rv.coins} koin` : '', rv.points ? `+${rv.points} poin` : '', rv.xp ? `+${rv.xp} XP` : ''].filter(Boolean).join(' · ')}</span>{/if}
        </div>
        <p class="tk"><b>Tahukah kamu?</b> {rv.explain}</p>
        <div class="row">
          <button class="btn sm" onclick={() => { sfx.tap(); KZ.report = { qid: rv.q.id, text: rv.q.q }; }}>Laporkan soal</button>
          <button class="btn hot next" disabled={KZ.busy} onclick={next}>{run.done ? 'Lihat hasil' : 'Lanjut'}</button>
        </div>
      </div>
    {/if}

  {:else if KZ.page === 'end' && run}
    {@const res = run.result}
    <div class="col">
      <header class="hero end">
        <div class="host">{@html kancilSVG(mood, { podium: true, ring: mood === 'sorak' })}</div>
        <div class="bubble"><b>{res ? `${res.correct}/${res.total} benar` : 'Selesai'}</b><span>{kancilLine(res?.correct ?? 0, res?.total ?? 0)}</span></div>
      </header>
      {#if res}
        <section class="card score">
          {#if run.kind === 'harian'}
            <div class="big3"><div><b>{res.score}</b><span>poin</span></div><div><b>{res.correct}</b><span>benar</span></div><div><b>{sec(res.totalMs)}</b><span>detik</span></div></div>
            <p class="earn">{@html COIN} +{res.coins} koin · +{res.xp} XP{#if res.bonus?.pearls}{' '}· {@html PEARL} +{res.bonus.pearls} Mutiara{/if}</p>
            {#if res.bonus?.perfect}<p class="bonus">Sempurna! Bonus +{cfg.perfectCoins ?? ''} koin</p>{/if}
            {#if res.bonus?.streak7}<p class="bonus">Beruntun {res.bonus.streak7} hari! Bonus besar dari Pak Kancil</p>{:else if res.bonus?.streak3}<p class="bonus">Beruntun {res.bonus.streak3} hari! Bonus +{cfg.streak3Coins} koin</p>{/if}
            {#if res.bonus?.streak}<p class="muted">Beruntun sekarang: {res.bonus.streak} hari</p>{/if}
          {:else}
            <div class="big3"><div><b>{res.correct}/{res.total}</b><span>benar</span></div><div><b>{sec(res.totalMs)}</b><span>detik</span></div></div>
            {#if duelNow}
              {#if duelNow.status === 'done'}
                <p class="vs res-{duelNow.result}"><b>{duelNow.result === 'menang' ? 'Kamu menang!' : duelNow.result === 'kalah' ? `${duelNow.them.name} menang` : 'Seri!'}</b> {duelNow.me.label} vs {duelNow.them.label}{#if duelNow.me.reward}{' '}· +{duelNow.me.reward} koin{/if}</p>
              {:else}<p class="vs">Skormu tersimpan. Menunggu {duelNow.them.name} main soal yang sama.</p>{/if}
            {/if}
          {/if}
          <div class="cats">
            {#each Object.entries(res.perCat ?? {}) as [c, v]}
              {@const x = v as any}
              <div class="ct"><span class="dot" style="background:{catColor(c)}"></span><span>{catName(c)}</span><span class="bar"><i style="width:{(x.correct / Math.max(1, x.total)) * 100}%;background:{catColor(c)}"></i></span><b>{x.correct}/{x.total}</b></div>
            {/each}
          </div>
        </section>
      {/if}
      <section class="card review">
        <div class="mh"><b>Tinjau soal</b><em>ada yang keliru? laporkan</em></div>
        {#each run.answers as a (a.idx)}
          <div class="rv" class:ok={a.correct}>
            <span class="mk" aria-label={a.correct ? 'benar' : 'salah'}>{a.correct ? '✓' : a.timedOut ? '⏱' : '✗'}</span>
            <span class="tx">{qText(a)}</span>
            <button class="btn sm" onclick={() => { sfx.tap(); KZ.report = { qid: a.qid, text: qText(a) }; }}>Laporkan</button>
          </div>
        {/each}
      </section>
      <button class="btn hot block" onclick={home}>Kembali ke Kuis</button>
    </div>
  {:else}
    <div class="col"><p class="muted">Memuat…</p><button class="btn" onclick={home}>Kembali</button></div>
  {/if}

  {#if KZ.page === 'play' && run && !run.done && !rv}
    <button class="giveup" class:armed={armGiveUp} onclick={() => { if (!armGiveUp) { armGiveUp = true; setTimeout(() => (armGiveUp = false), 3000); } else giveUp(); }}>{armGiveUp ? 'Yakin akhiri?' : 'Akhiri'}</button>
  {/if}
  {#if KZ.report}<Lapor />{/if}
</div>

<style>
  .kuis { position: absolute; inset: 0; overflow-y: auto; background: radial-gradient(ellipse at 50% -10%, #FFF3CF 0%, #F6E3B4 45%, #E9C98D 100%); padding: calc(var(--safe-t) + 84px) max(12px, var(--safe-r)) calc(var(--safe-b) + 96px) max(12px, var(--safe-l)); }
  .kuis.playing { padding-top: calc(var(--safe-t) + 10px); padding-bottom: calc(var(--safe-b) + 16px); display: flex; flex-direction: column; overflow: hidden; }
  .kuis::before { content: ''; position: fixed; left: 0; right: 0; top: 0; height: 26px; background: repeating-linear-gradient(90deg, #C0392B 0 22px, #A93226 22px 44px); border-bottom: 3px solid var(--ink); pointer-events: none; opacity: .9; }
  .kuis.playing::before { display: none; }
  .col { width: min(560px, 100%); margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
  .card { background: var(--paper); border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 4px 0 var(--ink); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
  .muted { margin: 0; font-weight: 600; color: var(--muted); font-size: 14px; }
  .hero { display: flex; align-items: flex-end; gap: 8px; }
  .host { width: 118px; flex: none; }
  .host :global(svg) { width: 100%; height: auto; display: block; }
  .bubble { position: relative; flex: 1; background: var(--paper); border: 3px solid var(--ink); border-radius: 18px; padding: 10px 12px; margin-bottom: 40px; box-shadow: 0 4px 0 var(--ink); display: flex; flex-direction: column; gap: 2px; }
  .bubble::after { content: ''; position: absolute; left: -13px; bottom: 16px; border: 10px solid transparent; border-right-color: var(--ink); }
  .bubble b { font-size: 20px; line-height: 1.15; }
  .bubble span { font-size: 14px; font-weight: 600; color: var(--muted); }
  .streak { flex-direction: row; align-items: center; gap: 10px; background: #FFF4D6; }
  .fire { width: 44px; height: 44px; flex: none; display: grid; place-items: center; font-size: 28px; color: #fff; background: #E8862E; border: 2.5px solid var(--ink); border-radius: 50%; }
  .streak div { display: flex; flex-direction: column; } .streak b { font-size: 17px; } .streak span { font-size: 13px; font-weight: 600; color: var(--muted); }
  .mh { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; }
  .mh b { font-size: 18px; } .mh em { font-style: normal; font-size: 12.5px; font-weight: 700; color: var(--muted); }
  .sub { margin: 0; font-size: 13.5px; font-weight: 600; line-height: 1.35; }
  .sub :global(svg) { width: 16px; height: 16px; vertical-align: -3px; }
  .mode.harian { background: #FFFDF2; }
  .btn.big { min-height: 52px; font-size: 18px; }
  .done { display: flex; flex-direction: column; background: #E3F5E8; border: 2px solid #9ED3B0; border-radius: 12px; padding: 6px 10px; }
  .done b { font-size: 15px; } .done span { font-size: 12.5px; font-weight: 600; color: var(--muted); }
  .row { display: flex; gap: 8px; } .row .btn { flex: 1; }
  .duel { display: flex; align-items: center; gap: 8px; border: 2px solid var(--ink); border-radius: 14px; padding: 6px 8px; background: var(--card); }
  .duel.hot { background: #FFF8E2; }
  .duel > div { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .duel b { font-size: 15px; } .duel span { font-size: 12.5px; font-weight: 600; color: var(--muted); }
  .ava { width: 40px; height: 40px; flex: none; background: var(--tint); border-radius: 10px; overflow: hidden; display: grid; place-items: center; }
  .ava :global(svg) { width: 100%; height: 100%; }
  .res { font-style: normal; font-weight: 800; font-size: 12.5px; border: 2px solid var(--ink); border-radius: 999px; padding: 0 9px; }
  .res.menang { background: #BFEBCB; } .res.kalah { background: #F8C9BE; } .res.seri { background: #FFE8A3; }
  .rk { display: flex; align-items: center; gap: 8px; padding: 3px 6px; border-radius: 12px; font-weight: 700; }
  .rk.me { background: #E2EEFA; outline: 2px solid #3F7FBF; }
  .rk .n { width: 22px; text-align: center; } .rk .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rk em { font-style: normal; font-weight: 800; }
  .friends { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; }
  .friends button { display: flex; flex-direction: column; align-items: center; gap: 2px; border: 2px solid var(--ink); border-radius: 14px; background: var(--card); padding: 6px 4px; cursor: pointer; font: 700 12.5px var(--font); color: var(--ink); }
  .friends button.on { background: var(--coin); box-shadow: 0 3px 0 var(--ink); }
  .friends .ava { width: 46px; height: 46px; }
  .friends .nm { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* main */
  .top { display: flex; align-items: center; gap: 8px; width: min(720px, 100%); margin: 0 auto; flex: none; }
  .quit { flex: none; } .quit :global(svg) { width: 16px; height: 16px; }
  .prog { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 3px; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 14px; padding: 3px 8px; box-shadow: 0 3px 0 var(--ink); }
  .prog b { font-size: 15px; }
  .dots { display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; }
  .dots i { width: 10px; height: 10px; border-radius: 50%; background: var(--track); border: 1.5px solid var(--ink); }
  .dots i.ok { background: var(--ok); } .dots i.no { background: var(--low); } .dots i.cur { outline: 2px solid #3F7FBF; outline-offset: 1px; }
  .tsp { width: 52px; flex: none; }
  .stage { position: relative; flex: 1; min-height: 0; overflow-y: auto; width: min(720px, 100%); margin: 8px auto 0; padding: 0 2px 8px; }
  .kcrow { display: flex; align-items: flex-end; justify-content: center; gap: 6px; margin-top: 12px; }
  .kc { width: 96px; flex: none; }
  .kc :global(svg) { width: 100%; height: auto; display: block; }
  .say { position: relative; margin: 0 0 54px; max-width: 220px; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 16px; padding: 6px 10px; font-weight: 700; font-size: 14px; box-shadow: 0 3px 0 var(--ink); }
  .say::after { content: ''; position: absolute; left: -12px; bottom: 12px; border: 7px solid transparent; border-right-color: var(--ink); }
  .card.play { margin-top: 4px; }
  @media (max-height: 700px) { .kcrow { display: none; } }
  .reveal { flex: none; width: min(720px, 100%); margin: 8px auto 0; background: #FDE8E3; border: 3px solid var(--ink); border-radius: 20px; box-shadow: 0 4px 0 var(--ink); padding: 10px 14px; display: flex; flex-direction: column; gap: 6px; animation: kz-in .25s ease-out; }
  .reveal.good { background: #E3F5E8; }
  .rh { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .rh b { font-size: 22px; }
  .gain { display: inline-flex; align-items: center; gap: 3px; font-weight: 800; }
  .gain :global(svg) { width: 18px; height: 18px; }
  .tk { margin: 0; font-size: 14.5px; font-weight: 600; line-height: 1.35; max-height: 7.5em; overflow-y: auto; }
  .tk b { color: #B9800F; }
  .reveal .next { flex: 1.4; min-height: 48px; font-size: 18px; }
  .giveup { position: fixed; z-index: 5; right: max(10px, var(--safe-r)); bottom: calc(var(--safe-b) + 8px); font: 700 12.5px var(--font); color: var(--muted); background: rgba(255,253,247,.85); border: 2px solid #C9C2B0; border-radius: 999px; padding: 3px 10px; cursor: pointer; }
  .giveup.armed { color: #B23A24; border-color: #B23A24; }
  /* akhir */
  .hero.end .host { width: 128px; }
  .big3 { display: flex; justify-content: space-around; gap: 8px; text-align: center; }
  .big3 div { display: flex; flex-direction: column; }
  .big3 b { font-size: 30px; line-height: 1.05; } .big3 span { font-size: 12.5px; font-weight: 700; color: var(--muted); }
  .earn { margin: 0; display: flex; align-items: center; justify-content: center; gap: 4px; font-weight: 800; font-size: 16px; flex-wrap: wrap; }
  .earn :global(svg) { width: 18px; height: 18px; }
  .bonus { margin: 0; text-align: center; font-weight: 800; color: #1E7A4C; }
  .vs { margin: 0; text-align: center; font-weight: 700; } .vs b { display: block; font-size: 20px; }
  .res-menang b { color: #1E7A4C; } .res-kalah b { color: #B23A24; }
  .cats { display: flex; flex-direction: column; gap: 4px; }
  .ct { display: grid; grid-template-columns: 12px 88px 1fr 36px; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 700; }
  .ct .dot { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid var(--ink); }
  .ct .bar { height: 10px; background: var(--track); border-radius: 999px; overflow: hidden; border: 1.5px solid var(--ink); }
  .ct .bar i { display: block; height: 100%; }
  .ct b { text-align: right; }
  .rv { display: flex; align-items: center; gap: 8px; border-bottom: 1.5px dashed #E2D9C2; padding: 4px 0; }
  .rv .mk { width: 26px; height: 26px; flex: none; display: grid; place-items: center; border-radius: 50%; background: #F8C9BE; border: 2px solid var(--ink); font-weight: 900; font-size: 13px; }
  .rv.ok .mk { background: #BFEBCB; }
  .rv .tx { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  @keyframes kz-in { from { transform: translateY(16px); opacity: 0; } }
  @media (max-width: 359px) {
    .host { width: 92px; } .bubble b { font-size: 17px; } .bubble span { font-size: 12.5px; }
    .quit span { display: none; }
    .ct { grid-template-columns: 12px 72px 1fr 32px; }
    .kc { width: 78px; }
  }
  @media (prefers-reduced-motion: reduce) { .reveal { animation: none; } }
  :global(:root.reduce-motion) .reveal { animation: none; }
</style>
