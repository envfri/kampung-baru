// Pekarangan (v0.29): pulau rumput di sekeliling rumah tidak menutupi ruangan, batas kamera mencakup rumah, langit ikut jam.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { houseLayout, houseBounds, houseYardBounds, houseYardSVG, houseIso, skyTime } from '@kb/shared';

const plans = {
  satu: houseLayout([{ id: 'kamar', size: 6 }]),
  kecil: houseLayout([{ id: 'kamar', size: 4 }]),
  lima: houseLayout([
    { id: 'kamar', size: 6, gx: 0, gy: 0 }, { id: 'tamu', size: 6, gx: 6, gy: 0 }, { id: 'dapur', size: 5, gx: 0, gy: 6 },
    { id: 'mandi', size: 4, gx: 6, gy: 6 }, { id: 'halaman', size: 6, theme: 'luar', gx: 10, gy: 6 },
  ]),
};

test('batas pekarangan mencakup seluruh rumah (kamera Pekarangan & batas geser)', () => {
  for (const [name, plan] of Object.entries(plans)) {
    const h = houseBounds(plan), y = houseYardBounds(plan);
    assert.ok(y.x <= h.x && y.y <= h.y && y.x + y.w >= h.x + h.w && y.y + y.h >= h.y + h.h, `${name}: pekarangan lebih kecil dari rumah`);
    assert.ok(y.w > h.w * 1.2, `${name}: pekarangan cukup lebar`);
  }
});

test('gambar pekarangan sah: tanpa NaN, tidak menangkap ketukan, lampu menyala hanya malam', () => {
  for (const [name, plan] of Object.entries(plans)) {
    const day = houseYardSVG(plan), night = houseYardSVG(plan, true);
    assert.ok(day.length > 2000, `${name}: pekarangan kosong`);
    assert.ok(!/NaN|undefined|Infinity/.test(day + night), `${name}: koordinat rusak`);
    assert.match(day, /^<g class="yard" pointer-events="none">/);
    assert.ok(night.includes('#FFE27A') && !day.includes('#FFE27A'), `${name}: lampu taman`);
    // ringan: tetap kecil walau rumah besar
    assert.ok(day.length < 60_000, `${name}: pekarangan terlalu berat (${day.length} byte)`);
  }
  assert.equal(houseYardSVG(houseLayout([])), '');
});

test('hiasan pekarangan berada di luar tapak rumah (tidak menutupi ruangan)', () => {
  const plan = plans.satu;
  const r = plan.rooms[0];
  // sudut lantai rumah di layar
  const L = houseIso(r.gx, r.gy + r.size), F = houseIso(r.gx + r.size, r.gy + r.size), R = houseIso(r.gx + r.size, r.gy);
  const svg = houseYardSVG(plan);
  // titik pangkal pohon, lampu, kotak surat, bunga: tidak ada yang di dalam belah ketupat lantai
  const inside = (x: number, y: number) => {
    const T = houseIso(r.gx, r.gy);
    const poly = [T, R, F, L];
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const stems = [...svg.matchAll(/<path d="M([-\d.]+) ([-\d.]+)v-8"/g)].map((m) => [+m[1], +m[2]]);
  assert.ok(stems.length >= 8, 'ada bunga');
  for (const [x, y] of stems) assert.ok(!inside(x, y - 14), `bunga di (${x}, ${y}) masuk ke lantai`);
});

test('waktu langit mengikuti jam pemain', () => {
  assert.equal(skyTime(4), 'malam');
  assert.equal(skyTime(5), 'pagi');
  assert.equal(skyTime(9), 'pagi');
  assert.equal(skyTime(10), 'siang');
  assert.equal(skyTime(14), 'siang');
  assert.equal(skyTime(15), 'sore');
  assert.equal(skyTime(17), 'sore');
  assert.equal(skyTime(18), 'malam');
  assert.equal(skyTime(23), 'malam');
});
