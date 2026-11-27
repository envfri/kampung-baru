// Set item premium (Mutiara): isi tiap set, efek suasana bila ≥ beberapa item set yang sama ada di satu ruangan,
// dan harga paket (diskon dari jumlah harga item yang belum dimiliki, diatur admin di Ekonomi & fitur › premium).
export interface PremiumSet {
  key: string;
  name: string;
  desc: string;
  /** efek suasana (hanya tampilan) */
  bonus: string;
  /** warna khas set (kartu toko & label suasana) */
  color: string;
  items: string[];
}

export const PREMIUM_SETS: PremiumSet[] = [
  { key: 'tamanmalam', name: 'Set Taman Malam', desc: 'Untuk halaman: kolam koi bercahaya dan lampu-lampu malam.', bonus: 'Senja biru & kunang-kunang', color: '#33427A',
    items: ['tm-kolamkoi', 'tm-pohonlampu', 'tm-lenterastupa', 'tm-jembatan', 'tm-topleskunang', 'fl-batutaman'] },
  { key: 'keraton', name: 'Set Keraton', desc: 'Ruang tamu bangsawan Jawa: ukiran, kuningan, dan batik.', bonus: 'Kilau keemasan', color: '#8E2A1E',
    items: ['kr-gamelan', 'kr-kursiraja', 'kr-gebyok', 'kr-lampukuningan', 'kr-karpetparang', 'wp-kawung'] },
  { key: 'kafe', name: 'Set Kafe Kopi Kampung', desc: 'Pojok ngopi: mesin kopi, meja bar, dan toples kerupuk.', bonus: 'Cahaya hangat & uap kopi', color: '#6B4A2B',
    items: ['kf-mesinkopi', 'kf-mejabar', 'kf-raktoples', 'kf-papanmenu', 'kf-lampuedison', 'fl-terasoemas'] },
  { key: 'pantai', name: 'Set Pantai', desc: 'Kamar tepi pantai: hammock, papan selancar, akuarium ombak.', bonus: 'Sinar matahari pagi', color: '#3F7FBF',
    items: ['pt-hammock', 'pt-kursipantai', 'pt-papanselancar', 'pt-oborbambu', 'pt-akuariumombak', 'fl-pasir'] },
  { key: 'bintang', name: 'Set Kamar Bintang', desc: 'Kamar anak penjelajah angkasa.', bonus: 'Bintang berkelip di seluruh kamar', color: '#2B3A6B',
    items: ['kb-kasurroket', 'kb-proyektor', 'kb-tenda', 'kb-karpetawan', 'kb-rakpelangi', 'wp-langit'] },
  // paket konten 17
  { key: 'dapurnenek', name: 'Set Dapur Nenek', desc: 'Dapur kampung tempo dulu: tungku tanah liat, gentong air, dan meja makan panjang.', bonus: 'Asap tungku & bara hangat', color: '#9C4A2A',
    items: ['dn-tungku', 'dn-rakpiring', 'dn-gentong', 'dn-mejamakan', 'dn-petromaks', 'wp-gedek'] },
  { key: 'sanggar', name: 'Set Sanggar Seni', desc: 'Sanggar budaya: angklung, kecapi, kendang, wayang, dan batik tulis.', bonus: 'Nada beterbangan & lampu sorot', color: '#6A3D7A',
    items: ['sg-angklung', 'sg-kecapi', 'sg-kelir', 'sg-membatik', 'sg-kendang', 'fl-papanjati'] },
  { key: 'spabali', name: 'Set Spa Bali', desc: 'Pojok santai ala Bali: bak berendam air kembang, pancuran batu, dan kamboja.', bonus: 'Uap wangi & bunga kamboja', color: '#2F7A68',
    items: ['sp-bakkayu', 'sp-pancuran', 'sp-kamboja', 'sp-rakhanduk', 'sp-lilin', 'fl-batukali'] },
];
export const PREMIUM_SET_BY_KEY: Record<string, PremiumSet> = Object.fromEntries(PREMIUM_SETS.map((s) => [s.key, s]));

/** Harga paket: jumlah harga Mutiara item set yang belum dimiliki, dipotong diskon (%), dibulatkan. */
export function bundlePrice(prices: number[], discountPct: number) {
  const total = prices.reduce((a, b) => a + b, 0);
  return { total, price: Math.max(0, Math.round(total * (1 - Math.max(0, Math.min(90, discountPct)) / 100))) };
}

/**
 * Suasana ruangan: set yang punya ≥ min item berbeda di ruangan ini (mebel + dinding + lantai).
 * `setOf` memetakan id item ke kunci set (dari data.set di katalog).
 */
export function roomMood(ids: (string | null | undefined)[], setOf: (id: string) => string | undefined, min = 3): string | null {
  const count = new Map<string, Set<string>>();
  for (const id of ids) {
    if (!id) continue;
    const k = setOf(id);
    if (!k) continue;
    if (!count.has(k)) count.set(k, new Set());
    count.get(k)!.add(id);
  }
  let best: string | null = null, n = 0;
  for (const [k, v] of count) if (v.size >= min && v.size > n) { best = k; n = v.size; }
  return best;
}

/**
 * Gambar efek suasana set (hanya tampilan) di atas satu ruangan, plus label "✦ Suasana ...".
 * `at(u, v, up)`: titik layar untuk pecahan ruangan (u, v dari 0 sampai 1) setinggi `up` px.
 * Kelas `blink` dianimasikan oleh CSS ruangan (Room.svelte); `.mood-label` dibuang saat foto Jepret.
 */
export function premiumMoodSVG(key: string, at: (u: number, v: number, up?: number) => number[], o: { wallH: number; outdoor?: boolean }) {
  const INK = '#2B2F4A';
  const n1 = (v: number) => v.toFixed(1);
  const fl = [at(0, 0), at(1, 0), at(1, 1), at(0, 1)].map((p) => p.map(n1).join(',')).join(' ');
  const fr = (k: number, m: number) => ((k * m) % 1 + 1) % 1;
  const pts = (n: number, hi: number, lo = 12) => Array.from({ length: n }, (_, k) => at(0.1 + fr(k, 0.618) * 0.8, 0.1 + fr(k, 0.382) * 0.8, lo + fr(k, 0.271) * hi));
  const blink = (k: number) => `class="blink" style="animation-delay:-${((k * 0.37) % 1.7).toFixed(2)}s"`;
  let s = '';
  if (key === 'tamanmalam') {
    s += `<polygon points="${fl}" fill="#2B3A6B" fill-opacity=".16"/>`;
    pts(9, 70).forEach(([x, y], k) => (s += `<g ${blink(k)}><circle cx="${n1(x)}" cy="${n1(y)}" r="7" fill="#EFFF7A" fill-opacity=".28"/><circle cx="${n1(x)}" cy="${n1(y)}" r="2.4" fill="#EFFF7A"/></g>`));
  } else if (key === 'keraton') {
    s += `<polygon points="${fl}" fill="#FFD27A" fill-opacity=".12"/>`;
    pts(7, o.wallH * 0.7).forEach(([x, y], k) => (s += `<path ${blink(k)} transform="translate(${n1(x)} ${n1(y)})" d="M0 -6L1.6 -1.6 6 0 1.6 1.6 0 6-1.6 1.6-6 0-1.6-1.6Z" fill="#FFE27A"/>`));
  } else if (key === 'kafe') {
    s += `<polygon points="${fl}" fill="#F2994A" fill-opacity=".1"/>`;
    pts(4, 40).forEach(([x, y], k) => (s += `<circle ${blink(k)} cx="${n1(x)}" cy="${n1(y)}" r="22" fill="#FFE7A0" fill-opacity=".16"/>`));
  } else if (key === 'pantai') {
    const top = at(0, 0, o.wallH);
    for (let k = 0; k < 4; k++) { const a = at(0.15 + k * 0.2, 1), b = at(0.3 + k * 0.2, 1); s += `<polygon points="${n1(top[0] + 30 + k * 26)},${n1(top[1])} ${n1(a[0])},${n1(a[1])} ${n1(b[0])},${n1(b[1])}" fill="#FFF6C8" fill-opacity=".13"/>`; }
  } else if (key === 'bintang') {
    s += `<polygon points="${fl}" fill="#1B2350" fill-opacity=".14"/>`;
    pts(12, o.wallH * 0.8).forEach(([x, y], k) => (s += `<circle ${blink(k)} cx="${n1(x)}" cy="${n1(y)}" r="${(1.6 + (k % 3) * 0.7).toFixed(1)}" fill="#FFF6C8"/>`));
  } else if (key === 'dapurnenek') {
    // lantai hangat kemerahan, bara kecil berkedip dekat lantai, asap tipis mengambang tinggi
    s += `<polygon points="${fl}" fill="#E07A3F" fill-opacity=".1"/>`;
    pts(7, 26, 6).forEach(([x, y], k) => (s += `<circle ${blink(k)} cx="${n1(x)}" cy="${n1(y)}" r="${k % 2 ? 1.6 : 2.2}" fill="${k % 3 ? '#FFB347' : '#FF7A3D'}"/>`));
    pts(5, o.wallH * 0.35, o.wallH * 0.45).forEach(([x, y], k) => (s += `<g ${blink(k + 3)} fill="#F4EEE4" fill-opacity=".3"><circle cx="${n1(x)}" cy="${n1(y)}" r="11"/><circle cx="${n1(x + 10)}" cy="${n1(y - 5)}" r="8"/><circle cx="${n1(x - 9)}" cy="${n1(y - 3)}" r="7"/></g>`));
  } else if (key === 'sanggar') {
    // lampu sorot dari dinding belakang + not musik beterbangan
    const top = at(0.5, 0, o.wallH), a = at(0.25, 0.85), b = at(0.85, 0.3);
    const c = at(0.55, 0.57), rx = Math.abs(at(1, 0)[0] - at(0, 0)[0]) * 0.3;
    s += `<polygon points="${fl}" fill="#6A3D7A" fill-opacity=".08"/><polygon points="${n1(top[0] - 8)},${n1(top[1])} ${n1(top[0] + 8)},${n1(top[1])} ${n1(b[0])},${n1(b[1])} ${n1(a[0])},${n1(a[1])}" fill="#FFF1C4" fill-opacity=".12"/><ellipse cx="${n1(c[0])}" cy="${n1(c[1])}" rx="${n1(rx)}" ry="${n1(rx / 2)}" fill="#FFF1C4" fill-opacity=".16"/>`;
    const cols = ['#F2B632', '#FFFDF7', '#E98BB8', '#8FD3E8'];
    pts(8, o.wallH * 0.65, 30).forEach(([x, y], k) => (s += `<g ${blink(k)} transform="translate(${n1(x)} ${n1(y)}) rotate(${(k % 3) * 8 - 8})"><ellipse rx="3.6" ry="2.6" transform="rotate(-20)" fill="${cols[k % 4]}" stroke="${INK}" stroke-width="1.1"/><path d="M3.1 -1V-13${k % 2 ? 'q5 2 4 8' : 'h7v12'}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>${k % 2 ? '' : `<ellipse cx="10" cy="-1" rx="3.6" ry="2.6" transform="rotate(-20 10 -1)" fill="${cols[(k + 1) % 4]}" stroke="${INK}" stroke-width="1.1"/>`}</g>`));
  } else if (key === 'spabali') {
    // kabut hijau-mint, uap hangat naik, bunga kamboja melayang
    s += `<polygon points="${fl}" fill="#9FE0C8" fill-opacity=".14"/>`;
    pts(4, 30, 20).forEach(([x, y], k) => (s += `<path ${blink(k)} d="M${n1(x)} ${n1(y)}q-6 -9 0 -18q6 -9 0 -18" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".55"/>`));
    pts(8, o.wallH * 0.7, 24).forEach(([x, y], k) => {
      let f = '';
      for (let i = 0; i < 5; i++) {
        const deg = k * 23 + i * 72, a = (deg * Math.PI) / 180, px = n1(Math.cos(a) * 2.6), py = n1(Math.sin(a) * 2.6);
        f += `<ellipse cx="${px}" cy="${py}" rx="3.4" ry="1.9" transform="rotate(${deg + 18} ${px} ${py})" fill="#FFFDF7" stroke="${INK}" stroke-width=".7"/>`;
      }
      s += `<g ${blink(k)} transform="translate(${n1(x)} ${n1(y)})">${f}<circle r="1.6" fill="#F7C548"/></g>`;
    });
  }
  // label suasana di atas sudut belakang ruangan (isi dibungkus .mood-shift: game boleh menggesernya bila tertutup HUD)
  const set = PREMIUM_SET_BY_KEY[key];
  const lb = at(0.5, 0, o.outdoor ? 34 : o.wallH + 14);
  const text = `✦ Suasana ${set?.name.replace(/^Set /, '') ?? key}`;
  const w = text.length * 6.4 + 18;
  s += `<g class="mood-label" transform="translate(${n1(lb[0])} ${n1(lb[1])})"><g class="mood-shift"><rect x="${n1(-w / 2)}" y="-11" width="${n1(w)}" height="20" rx="10" fill="${set?.color ?? INK}" stroke="${INK}" stroke-width="1.6"/><text y="4" text-anchor="middle" font-size="11.5" font-weight="800" fill="#FFF4C2" style="font-family:var(--font)">${text}</text></g></g>`;
  return s;
}

/* ---------------- Edisi Spesial (paket konten 19) ---------------- */
/**
 * Barang Edisi Spesial: item dengan data.edisi (nomor edisi ≥ 1). Tampil di tab "✦ Edisi Spesial" Toko Mutiara
 * dengan pratinjau bergerak; di ruangan efeknya dianimasikan CSS (kelas ed-*). Dibeli satuan (bukan paket).
 * Batas waktu jual memakai jadwal jual item yang sudah ada (available_from / available_to, diatur admin per item).
 */
export const EDISI_SPESIAL = {
  name: 'Edisi Spesial',
  badge: '✦ Edisi Spesial',
  desc: 'Barang istimewa yang hidup di rumahmu: kelopak berguguran, ubur-ubur bercahaya, kincir berputar, dan lainnya. Dibeli satuan dengan Mutiara.',
};
export const isEdisi = (it?: { data?: any } | null) => Number(it?.data?.edisi) > 0;
/** nama edisi untuk pita & teks (data.edisiNama, mis. "Edisi Natal"; bawaan "Edisi Spesial") */
export const edisiLabel = (it?: { data?: any } | null) => (typeof it?.data?.edisiNama === 'string' && it.data.edisiNama.trim() ? it.data.edisiNama.trim().slice(0, 24) : EDISI_SPESIAL.name);
/** pita kartu toko: "✦ Edisi Spesial" / "✦ Edisi Natal" */
export const edisiBadge = (it?: { data?: any } | null) => `✦ ${edisiLabel(it)}`;
/** efek tiap bentuk Edisi Spesial (kunci art), untuk kartu toko */
export const EDISI_EFEK: Record<string, string> = {
  tabebuya: 'Kelopak berguguran',
  akuariumubur: 'Ubur-ubur bercahaya',
  kincir: 'Baling-baling berputar',
  airmancurkristal: 'Air memancar berkilau',
  gramofon: 'Not musik melayang',
  lampulava: 'Lava berganti warna',
  teleskop: 'Bintang berkelip',
  wayanggolek: 'Wayang menari',
  aurora: 'Aurora berganti warna',
  kolamkaca: 'Ikan berenang',
  // Edisi Natal (paket konten 24): sahabat besar
  sahabatberuang: 'Salju menari',
  sahabatrusa: 'Lampu kerlap-kerlip',
};
/** Sisa waktu dijual, teks pendek ("Sisa 3 hari", "Sisa 5 jam", "Sisa 12 mnt"); '' bila tanpa batas atau sudah lewat. */
export function sisaWaktu(until: string | number | Date | null | undefined, now = Date.now()) {
  if (until === null || until === undefined || until === '') return '';
  const ms = new Date(until).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `Sisa ${Math.floor(h / 24)} hari`;
  if (h >= 1) return `Sisa ${h} jam`;
  return `Sisa ${Math.max(1, Math.ceil(ms / 60_000))} mnt`;
}
