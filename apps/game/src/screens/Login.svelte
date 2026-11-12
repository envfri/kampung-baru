<script lang="ts">
  // Halaman depan: langit ikut jam pengunjung, rumah & pekarangan dengan pet acak, dua kolom di desktop.
  import { petSVG, skyTime } from '@kb/shared';
  import AuthOptions from '../components/AuthOptions.svelte';
  import SocialLinks from '../components/SocialLinks.svelte';
  import { G } from '../lib/game.svelte';
  import { heroScene, miniRoom, randomPets, MINIGAME_ART } from '../lib/heroScene';

  // ?langit=pagi|siang|sore|malam & ?pets=angka hanya untuk pratinjau / tangkapan layar yang bisa diulang
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const wantSky = q?.get('langit') ?? '';
  const sky = ['pagi', 'siang', 'sore', 'malam'].includes(wantSky) ? wantSky : skyTime(new Date().getHours());
  const seed = Number(q?.get('pets')) || Math.floor(Math.random() * 1e9);
  const pets = randomPets(seed);
  const scene = heroScene(sky === 'malam', pets);
  const lead = pets[0];
  const pet = (color: string, ear: string, extra: any = {}) => petSVG({ color, ear, pattern: 'polos', eyes: 'bulat', tail: 'bulat', ...extra });
  // Isi singkat tentang BUPI: membantu pemain baru (dan mesin pencari) tahu game apa ini
  const FEATURES = [
    { art: petSVG(lead.look, lead.wear), t: 'Rawat pet lucu', d: 'Beri makan, mandikan, ajak main, dan dandani dengan baju & aksesori.', c: '#FFE6DF', wide: false },
    { art: miniRoom(), t: 'Hias rumah sendiri', d: 'Pilih mebel, atur denah, perluas ruangan, dan rawat pekarangan.', c: '#E3F1DA', wide: true },
    { art: `<span class="duo">${pet(pets[1].look.color, pets[1].look.ear)}${pet(pets[2].look.color, pets[2].look.ear)}</span>`, t: 'Main bareng teman', d: 'Kunjungi rumah teman, ngobrol di alun-alun, main congklak & foto bareng.', c: '#E1ECF8', wide: false },
    { art: MINIGAME_ART, t: 'Mini-game Nusantara', d: 'Balap bakiak, gasing, tangkap layangan, panjat pinang, dan lainnya.', c: '#FBEFD2', wide: false },
  ];
</script>

<main class="login land" data-sky={sky}>
  <div class="bg" aria-hidden="true"><div class="hills"></div><div class="orb"></div><div class="cloud c1"></div><div class="cloud c2"></div></div>

  <header class="top">
    <span class="brand"><i>{@html pet('#F6B7A8', 'tunas')}</i>BUPI</span>
    {#if G.config?.social?.length}<span class="soc"><SocialLinks links={G.config.social} /></span>{/if}
  </header>

  <section class="hero">
    <div class="copy">
      <span class="tag">Game pet kampung · gratis</span>
      <h1>BUPI</h1>
      <p class="lead">Rawat bupi-mu, hias rumah, dan kunjungi teman sekampung.</p>
      <div class="panel"><AuthOptions /></div>
      <ul class="trust"><li>Gratis</li><li>HP &amp; komputer</li><li>Bisa dipasang seperti aplikasi</li></ul>
    </div>
    <div class="scene">{@html scene}</div>
  </section>

  <section class="about" aria-labelledby="about-h">
    <h2 id="about-h">Di Kampung BUPI kamu bisa</h2>
    <ul>
      {#each FEATURES as f}
        <li style="--c:{f.c}"><span class="art" class:wide={f.wide}>{@html f.art}</span><b>{f.t}</b><span>{f.d}</span></li>
      {/each}
    </ul>
  </section>

  <footer>
    {#if G.config?.social?.length}<div class="follow"><span>Ikuti kabar terbaru</span><SocialLinks links={G.config.social} /></div>{/if}
    <p>Dengan bermain, kamu setuju dengan aturan main yang sopan dan ramah.</p>
  </footer>
</main>

<style>
  .land { position: relative; min-height: 100%; overflow-x: hidden; display: flex; flex-direction: column; align-items: center;
    padding: calc(var(--safe-t) + 10px) max(16px, var(--safe-r)) calc(var(--safe-b) + 18px) max(16px, var(--safe-l));
    --s1: #A9DDF5; --s2: #CDEBF6; --s3: #E4F4EA; --h1: #B9DDB0; --h2: #A6D29B; --orb: #FFF1C2; --glow: rgba(255, 236, 170, .5); --cl: .9; --ink2: var(--ink);
    /* langit setinggi layar, di bawahnya warna bukit (tanpa sambungan) */
    background: linear-gradient(180deg, var(--s1) 0%, var(--s2) 45%, var(--s3) 80%) 0 0 / 100% min(100vh, 980px) no-repeat, var(--h2); }
  .land[data-sky='pagi'] { --s1: #F9D6B5; --s2: #F6E7CF; --s3: #E6F2E4; --orb: #FFE3A3; --glow: rgba(255, 210, 150, .5); }
  .land[data-sky='sore'] { --s1: #F3A77E; --s2: #F8CFA0; --s3: #F1E3C4; --h1: #A9C99A; --h2: #93B98A; --orb: #FFC27A; --glow: rgba(255, 170, 100, .45); }
  .land[data-sky='malam'] { --s1: #1F2D4F; --s2: #33507A; --s3: #46648A; --h1: #324866; --h2: #283B57; --orb: #FFF4C8; --glow: rgba(255, 244, 200, .18); --cl: .22; --ink2: #FFFDF7;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='160'%3E%3Cg fill='%23FFF6D8'%3E%3Ccircle cx='20' cy='30' r='1.6'/%3E%3Ccircle cx='90' cy='12' r='1.2'/%3E%3Ccircle cx='150' cy='60' r='1.8'/%3E%3Ccircle cx='200' cy='22' r='1.1'/%3E%3Ccircle cx='60' cy='100' r='1.3'/%3E%3C/g%3E%3C/svg%3E") 0 0 / 220px 160px repeat-x,
      linear-gradient(180deg, var(--s1) 0%, var(--s2) 45%, var(--s3) 80%) 0 0 / 100% min(100vh, 980px) no-repeat, var(--h2); }
  .bg { position: absolute; inset: 0 0 auto; height: min(100vh, 980px); pointer-events: none; overflow: hidden; }
  .hills { position: absolute; left: 0; right: 0; bottom: 0; height: 38%; background: linear-gradient(180deg, var(--h1), var(--h2));
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 300' preserveAspectRatio='none'%3E%3Cpath d='M0 120 C200 40 380 70 560 100 S900 20 1100 70 S1450 50 1600 90 V300 H0Z'/%3E%3C/svg%3E") 0 0 / 100% 100% no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 300' preserveAspectRatio='none'%3E%3Cpath d='M0 120 C200 40 380 70 560 100 S900 20 1100 70 S1450 50 1600 90 V300 H0Z'/%3E%3C/svg%3E") 0 0 / 100% 100% no-repeat; }
  .orb { position: absolute; top: 9%; right: 8%; width: 86px; height: 86px; border-radius: 50%; background: var(--orb); box-shadow: 0 0 0 22px var(--glow), 0 0 90px 46px var(--glow); }
  .cloud { position: absolute; left: -230px; width: 190px; height: 60px; opacity: var(--cl); animation: cloud 90s linear infinite; will-change: transform;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 190 60'%3E%3Cpath d='M20 52a18 18 0 0 1 6-34a26 26 0 0 1 48-8a22 22 0 0 1 38 4a20 20 0 0 1 34 10a17 17 0 0 1 22 28Z' fill='%23FFFFFF'/%3E%3C/svg%3E") center / contain no-repeat; }
  .c1 { top: 7%; animation-delay: -30s; } .c2 { top: 20%; width: 130px; height: 42px; animation-duration: 120s; animation-delay: -80s; }
  @keyframes cloud { to { transform: translateX(calc(100vw + 460px)); } }

  .top { position: relative; width: 100%; max-width: 1400px; display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 52px; }
  .brand { display: inline-flex; align-items: center; gap: 8px; font-size: 22px; font-weight: 800; color: var(--ink2); }
  .brand i { width: 38px; height: 40px; display: inline-block; } .brand i :global(svg) { width: 100%; height: 100%; }
  .soc { display: none; }

  .hero { position: relative; width: 100%; max-width: 1400px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .scene { order: -1; width: 100%; max-width: 560px; }
  .scene :global(svg) { width: 100%; height: auto; display: block; max-height: 42vh; overflow: visible; filter: drop-shadow(0 18px 18px rgba(43, 47, 74, .12)); }
  .scene :global(.hop) { animation: hop 2.4s ease-in-out infinite; }
  @keyframes hop { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
  .copy { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; width: 100%; max-width: 420px; }
  .tag { display: inline-block; background: rgba(255, 253, 247, .85); border: 2px solid var(--ink); border-radius: 999px; padding: 2px 12px; font-size: 13px; font-weight: 800; box-shadow: 0 2px 0 var(--ink); }
  h1 { margin: 2px 0 0; font-size: clamp(44px, 12vw, 64px); font-weight: 800; line-height: .95; letter-spacing: -.5px; color: var(--ink2); text-shadow: 0 3px 0 rgba(255, 255, 255, .55); }
  .land[data-sky='malam'] h1 { text-shadow: 0 3px 0 rgba(0, 0, 0, .25); }
  .lead { margin: 0; font-size: 17.5px; font-weight: 700; max-width: 30ch; color: var(--ink2); }
  .panel { width: 100%; background: var(--paper); border: 3px solid var(--ink); border-radius: 22px; box-shadow: 0 5px 0 var(--ink); padding: 18px; margin-top: 6px; }
  .trust { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
  .trust li { background: rgba(255, 253, 247, .88); border: 1.5px solid rgba(43, 47, 74, .25); border-radius: 999px; padding: 1px 10px 1px 8px; font-size: 12.5px; font-weight: 800; }
  .trust li::before { content: '✓ '; color: #1E7A4C; }

  .about { position: relative; width: 100%; max-width: 1400px; margin-top: 26px; display: flex; flex-direction: column; gap: 12px; }
  .about h2 { margin: 0; text-align: center; font-size: 22px; font-weight: 800; color: var(--ink2); }
  .about ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .about li { display: flex; flex-direction: column; gap: 4px; min-width: 0; background: var(--paper); border: 2.5px solid var(--ink); border-radius: 18px; box-shadow: 0 4px 0 var(--ink); padding: 10px 12px 12px; font-size: 13px; font-weight: 600; line-height: 1.3; color: var(--muted); }
  .about li b { color: var(--ink); font-size: 15px; font-weight: 800; }
  .art { height: 78px; border-radius: 12px; background: var(--c); display: grid; place-items: center; margin-bottom: 4px; overflow: hidden; }
  .art :global(svg) { height: 66px; width: auto; max-width: 100%; }
  .art.wide :global(svg) { height: 76px; }
  .art :global(.duo) { display: flex; } .art :global(.duo svg) { height: 58px; margin: 0 -6px; }
  footer { position: relative; margin-top: 22px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
  footer p { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--muted); max-width: 40ch; }
  .follow { display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 700; }
  .land[data-sky='malam'] footer p, .land[data-sky='malam'] .follow { color: #DDE4F2; }

  /* desktop: dua kolom — teks & tombol di kiri, rumah & pekarangan besar di kanan */
  @media (min-width: 960px) {
    .land { padding-left: clamp(24px, 4vw, 64px); padding-right: clamp(24px, 4vw, 64px); }
    .soc { display: block; }
    .hero { flex-direction: row; align-items: center; justify-content: space-between; gap: clamp(24px, 4vw, 64px); min-height: calc(100vh - 140px); }
    .scene { order: 0; flex: 1 1 0; max-width: 900px; }
    .scene :global(svg) { max-height: 74vh; }
    .copy { align-items: flex-start; text-align: left; flex: 0 0 420px; }
    h1 { font-size: 88px; }
    .lead { font-size: 21px; }
    .trust { justify-content: flex-start; }
    .about { margin-top: 10px; }
    .about ul { grid-template-columns: repeat(4, 1fr); gap: 14px; }
    .art { height: 112px; } .art :global(svg) { height: 92px; } .art.wide :global(svg) { height: 104px; }
    .about li { font-size: 13.5px; }
  }
  /* layar sangat lebar: semuanya ikut lebih besar supaya tidak kosong */
  @media (min-width: 1600px) {
    .top, .hero, .about { max-width: 1640px; }
    .scene { max-width: 1080px; }
    .copy { flex-basis: 480px; }
    h1 { font-size: 112px; }
    .lead { font-size: 24px; }
    .panel { padding: 22px; }
    .about h2 { font-size: 26px; }
    .art { height: 132px; } .art :global(svg) { height: 108px; } .art.wide :global(svg) { height: 124px; }
    .about li { font-size: 14.5px; } .about li b { font-size: 17px; }
  }
  @media (prefers-reduced-motion: reduce) { .cloud, .scene :global(.hop) { animation: none; } .cloud { left: 30%; } .c2 { left: 70%; } }
</style>
