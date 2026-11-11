# Instagram BUPI (@playbupi)

Dibuat dari art orisinal BUPI dengan `npm run instagram` (butuh Playwright).

| File | Ukuran | Untuk |
| --- | --- | --- |
| `profil.png` | 1080×1080 | Foto profil (aman dipotong lingkaran) |
| `post-1-kiri.png` | 1080×1350 (4:5) | Post grid kiri: "Kenalin, ini BUPI" |
| `post-2-tengah.png` | 1080×1350 (4:5) | Post grid tengah: hal-hal yang bisa dilakukan |
| `post-3-kanan.png` | 1080×1350 (4:5) | Post grid kanan: "Main GRATIS" + layar game |
| `pratinjau-grid.png` | - | Gambaran baris pertama profil setelah ketiganya diunggah |

Ketiga post menyambung jadi satu pemandangan (umbul-umbul, tanah, jalan setapak) di baris pertama grid profil.
Instagram memotong post 4:5 menjadi 3:4 di grid profil, jadi bagian yang menyambung sudah disesuaikan dengan potongan itu.
Di feed, tiap post tampil utuh dan bisa dibaca sendiri.

## Urutan unggah

Post terbaru tampil paling kiri atas, jadi unggah **dari kanan ke kiri**:

1. `post-3-kanan.png`
2. `post-2-tengah.png`
3. `post-1-kiri.png` (terakhir, jadi post pertama yang dilihat orang)

Unggah sebagai 3 post terpisah (bukan carousel) dan jangan di-crop ulang di aplikasi: pilih rasio 4:5 saat mengunggah.

## Bio (saran)

```
Game pet kampung 🌱
Rawat pet lucu, hias rumah, main bareng teman.
Gratis, langsung di HP, tanpa unduh 👇
```

Tautan bio: alamat game (mis. `https://domainmu/`).

## Caption (saran)

**Post 3 (diunggah pertama)**

```
Main BUPI GRATIS, langsung di HP! 📱
Nggak perlu unduh apa-apa: buka link di bio, pilih pet, dan kamu langsung jadi warga Kampung Bupi.
Bisa dipasang di layar utama juga, rasanya kayak aplikasi.

#BUPI #GamePet #GameGratis #GameHP #GameIndonesia #VirtualPet #KampungBupi
```

**Post 2**

```
Di Kampung BUPI kamu bisa…
1️⃣ Rawat & dandani pet: kasih makan, mandiin, ajak main, pilih baju & aksesori
2️⃣ Hias rumah sendiri: pilih mebel, atur denah, perluas ruangan
3️⃣ Main bareng teman: mampir ke rumah teman, ngobrol di alun-alun, foto bareng
4️⃣ Mini-game Nusantara: balap bakiak, gasing, tangkap layangan, dan lainnya

Kamu paling penasaran yang mana? Tulis di komentar 👇

#BUPI #GamePet #GameIndonesia #HiasRumah #MainBareng #KampungBupi
```

**Post 1 (diunggah terakhir)**

```
Halo, warga! 👋 Kenalin, ini BUPI 🌱
Pet lucu dari Kampung Bupi yang siap jadi temanmu.
Rawat dia, hias rumahnya, lalu ajak main bareng teman-temanmu sekampung.

Mainnya gratis, langsung di HP. Link di bio ya!

#BUPI #GamePet #PetLucu #VirtualPet #GameIndonesia #GameGratis #KampungBupi
```
