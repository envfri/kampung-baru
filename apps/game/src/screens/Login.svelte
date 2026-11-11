<script lang="ts">
  import { petSVG } from '@kb/shared';
  import AuthOptions from '../components/AuthOptions.svelte';
  import SocialLinks from '../components/SocialLinks.svelte';
  import { G } from '../lib/game.svelte';
  import { I } from '../lib/icons';
  // Isi singkat tentang BUPI: membantu pemain baru (dan mesin pencari) tahu game apa ini
  const FEATURES = [
    { ic: I.smile, t: 'Rawat pet lucu', d: 'Beri makan, mandikan, ajak main, dan dandani dengan baju & aksesori.' },
    { ic: I.home, t: 'Hias rumah sendiri', d: 'Pilih mebel, atur denah, dan perluas ruangan.' },
    { ic: I.friends, t: 'Main bareng teman', d: 'Kunjungi rumah teman, ngobrol di alun-alun, dan foto bareng.' },
    { ic: I.play, t: 'Mini-game Nusantara', d: 'Balap bakiak, gasing, tangkap layangan, dan lainnya.' },
  ];
  const pets = [
    { color: '#B98A64', ear: 'kucing' },
    { color: '#F6B7A8', ear: 'tunas' },
    { color: '#C9B6E8', ear: 'kelinci' },
  ];
</script>

<main class="login">
  <div class="hero">
    <div class="pets">
      {#each pets as p, i}
        <div class="p p{i}">{@html petSVG(p, [], 'pet-bob')}</div>
      {/each}
    </div>
    <h1>BUPI</h1>
    <p>Rawat bupi-mu, hias rumah, dan kunjungi teman sekampung.</p>
  </div>
  <div class="panel">
    <AuthOptions />
  </div>
  <section class="about" aria-labelledby="about-h">
    <h2 id="about-h">Di Kampung BUPI kamu bisa</h2>
    <ul>
      {#each FEATURES as f}
        <li><span class="ic">{@html f.ic}</span><span><b>{f.t}</b>{f.d}</span></li>
      {/each}
    </ul>
    <p class="free">Gratis · langsung di browser HP &amp; komputer · bisa dipasang seperti aplikasi</p>
  </section>
  {#if G.config?.social?.length}
    <div class="follow"><span>Ikuti kabar terbaru</span><SocialLinks links={G.config.social} /></div>
  {/if}
  <footer>Dengan bermain, kamu setuju dengan aturan main yang sopan dan ramah.</footer>
</main>

<style>
  .login { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding: calc(var(--safe-t) + 24px) max(18px, var(--safe-r)) calc(var(--safe-b) + 20px) max(18px, var(--safe-l)); background: radial-gradient(120% 70% at 50% 20%, #E7F4EE 0%, var(--bg1) 45%, var(--bg2) 100%); }
  .hero { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .pets { display: flex; align-items: flex-end; justify-content: center; height: 150px; }
  .p :global(svg) { width: 100%; height: 100%; overflow: visible; }
  .p0, .p2 { width: 92px; height: 98px; margin: 0 -10px; }
  .p1 { width: 128px; height: 136px; z-index: 1; }
  .p0 { animation: pop .5s .1s both; } .p1 { animation: pop .5s both; } .p2 { animation: pop .5s .2s both; }
  h1 { margin: 6px 0 0; font-size: clamp(38px, 11vw, 56px); font-weight: 800; line-height: .95; letter-spacing: -.5px; text-shadow: 0 3px 0 rgba(255,255,255,.7); }
  p { margin: 0; font-size: 17px; font-weight: 600; max-width: 30ch; }
  .panel { width: 100%; max-width: 380px; background: var(--paper); border: 3px solid var(--ink); border-radius: 22px; box-shadow: 0 5px 0 var(--ink); padding: 18px; }
  .about { width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 8px; }
  .about h2 { margin: 0; font-size: 18px; font-weight: 800; text-align: center; }
  .about ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .about li { display: flex; flex-direction: column; gap: 4px; background: rgba(255, 253, 247, .72); border: 2px solid rgba(43, 47, 74, .14); border-radius: 14px; padding: 9px 10px; font-size: 13px; font-weight: 600; line-height: 1.3; color: var(--muted); }
  .about li b { display: block; color: var(--ink); font-size: 14.5px; font-weight: 800; margin-bottom: 1px; }
  .about .ic { width: 26px; height: 26px; color: var(--ink); }
  .about .ic :global(svg) { width: 100%; height: 100%; }
  .about .free { margin: 0 auto; font-size: 13px; font-weight: 700; color: var(--muted); text-align: center; max-width: 34ch; }
  .follow { display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 700; }
  footer { font-size: 12.5px; color: var(--muted); font-weight: 600; text-align: center; max-width: 34ch; }
</style>
