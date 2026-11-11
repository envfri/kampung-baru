// Denah rumah tersambung (@kb/shared houseLayout): ruangan tidak bertumpuk, semua tersambung lewat pintu,
// halaman di depan, dinding tinggi hanya di belakang, pintu menghindari mebel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { houseLayout } from '@kb/shared';

const sets = [
  [{ id: 'K', size: 6 }],
  [{ id: 'K', size: 6 }, { id: 'H', size: 7, theme: 'luar' }],
  [{ id: 'K', size: 6 }, { id: 'RT', size: 6 }, { id: 'D', size: 5 }, { id: 'KM', size: 4 }, { id: 'H', size: 7, theme: 'luar' }],
  [{ id: 'K', size: 12 }, { id: 'RT', size: 4 }, { id: 'D', size: 10 }, { id: 'KM', size: 4 }, { id: 'L', size: 5 }, { id: 'H', size: 12, theme: 'luar' }],
  [{ id: 'H', size: 7, theme: 'luar' }, { id: 'K', size: 6 }],
];

for (const rooms of sets) {
  test(`denah ${rooms.map((r) => r.id + r.size).join('+')}`, () => {
    const p = houseLayout(rooms);
    assert.equal(p.rooms.length, rooms.length);
    // tidak bertumpuk, semua di dalam denah
    for (const a of p.rooms) {
      assert.ok(a.gx >= 0 && a.gy >= 0 && a.gx + a.size <= p.W && a.gy + a.size <= p.D);
      for (const b of p.rooms) if (a !== b) assert.ok(a.gx >= b.gx + b.size || b.gx >= a.gx + a.size || a.gy >= b.gy + b.size || b.gy >= a.gy + a.size, `${a.id} & ${b.id} bertumpuk`);
    }
    // semua ruangan bisa dicapai dari ruangan pertama (jalan petak demi petak, pindah ruangan hanya lewat pintu)
    const start = p.rooms[0];
    const seen = new Set([`${start.gx},${start.gy}`]), q: [number, number][] = [[start.gx, start.gy]], reached = new Set<string>();
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      reached.add(p.at(x, y)!.id);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${x + dx},${y + dy}`;
        if (!seen.has(k) && p.pass(x, y, x + dx, y + dy)) { seen.add(k); q.push([x + dx, y + dy]); }
      }
    }
    assert.equal(reached.size, rooms.length, 'semua ruangan tersambung');
    // tidak bisa menembus dinding: hanya lewat pintu
    const crossings = [...seen].filter((k) => { const [x, y] = k.split(',').map(Number); return [[1, 0], [0, 1]].some(([dx, dy]) => p.at(x + dx, y + dy) && p.at(x + dx, y + dy) !== p.at(x, y) && p.pass(x, y, x + dx, y + dy)); });
    assert.equal(crossings.length, p.doors.length, 'satu lintasan per pintu');
    // halaman di depan: tidak ada ruangan dalam di depannya, dan tidak berdinding tinggi
    for (const h of p.rooms.filter((r) => r.outdoor)) {
      assert.equal(h.window || h.painting, false);
      for (const r of p.rooms.filter((x) => !x.outdoor)) {
        const overX = r.gx < h.gx + h.size && h.gx < r.gx + r.size, overY = r.gy < h.gy + h.size && h.gy < r.gy + r.size;
        assert.ok(!((r.gy >= h.gy + h.size && overX) || (r.gx >= h.gx + h.size && overY)), `${r.id} ada di depan halaman`);
      }
    }
    // ruangan pertama (kamar) selalu punya dinding belakang tinggi berjendela & berlukisan
    const k = p.byId.get('K')!;
    assert.ok(k.window && k.painting, 'kamar berjendela & berlukisan');
  });
}

test('pintu pindah ke petak kosong bila tertutup mebel', () => {
  const rooms = [{ id: 'K', size: 6 }, { id: 'RT', size: 6 }];
  const free = houseLayout(rooms);
  const d0 = free.doors[0];
  assert.ok(d0, 'ada pintu');
  const kTile = d0.axis === 'x' ? `5,${d0.at}` : `${d0.at},5`;
  const moved = houseLayout(rooms, (id) => (id === 'K' ? new Set([kTile]) : undefined));
  assert.notEqual(moved.doors[0].at, d0.at, 'pintu bergeser dari mebel');
  assert.equal(moved.sig, free.sig, 'letak ruangan tetap');
});
