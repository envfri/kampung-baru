<script lang="ts">
  import { petSVG } from '@kb/shared';
  import AuthOptions from '../components/AuthOptions.svelte';
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
  footer { font-size: 12.5px; color: var(--muted); font-weight: 600; text-align: center; max-width: 34ch; }
</style>
