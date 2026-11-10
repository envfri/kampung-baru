# Deploy BUPI (rekomendasi)

Panduan langkah demi langkah untuk memasang BUPI di VPS Ubuntu dengan domain **amt.ai.id**.
Semua layanan berjalan di Docker (Caddy HTTPS otomatis → aplikasi → PostgreSQL 16 + Redis), jadi sistem operasi cukup menyediakan Docker.

## 1. Pilih VPS & OS

| | Minimal | Disarankan |
|---|---|---|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 2 GB (swap 2 GB dibuat otomatis) | 4 GB |
| Disk | 20 GB SSD | 40 GB SSD |
| OS | Ubuntu 22.04 LTS | **Ubuntu 24.04 LTS** atau **26.04 LTS** |

- **Ubuntu 24.04 LTS**: pilihan paling aman sekarang. Paling banyak dipakai dan diuji di VPS; dukungan standar sampai 2029.
- **Ubuntu 26.04 LTS**: juga didukung penuh oleh `install.sh` (repo resmi Docker sudah menyediakan paket `resolute` dengan versi yang sama). Pilih ini bila ingin masa dukungan lebih panjang (sampai 2031).
- Bila suatu saat repo Docker belum punya rilis Ubuntu terbaru, `install.sh` otomatis memakai paket Docker bawaan Ubuntu.
- Pilih lokasi server di Indonesia/Singapura agar dekat dengan pemain.

## 2. Siapkan DNS

Di panel domain, buat **A record**: `amt.ai.id` → IP publik VPS.

- Cek dari komputer mana pun: `dig +short amt.ai.id` harus menampilkan IP VPS.
- Memakai Cloudflare? Set ke **DNS only** (awan abu-abu) saat pertama memasang, supaya Caddy bisa membuat sertifikat. Setelah HTTPS aktif boleh di-proxy dengan SSL mode **Full (strict)**.
- Di panel VPS (firewall / security group), buka port **22**, **80**, **443** (TCP) dan **443/UDP**.

## 3. Amankan VPS (sekali saja)

Login sebagai root/ubuntu, lalu:

```bash
sudo apt update && sudo apt -y full-upgrade
```

```bash
sudo timedatectl set-timezone Asia/Jakarta
```

Pasang kunci SSH dari komputer Anda (jalankan **di komputer Anda**, bukan di VPS):

```bash
ssh-copy-id ubuntu@IP_VPS
```

Setelah bisa login tanpa password, matikan login password di VPS:

```bash
echo -e "PasswordAuthentication no\nPermitRootLogin prohibit-password" | sudo tee /etc/ssh/sshd_config.d/99-kampung.conf
```

```bash
sudo systemctl restart ssh
```

Firewall (port SSH tetap dibuka):

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp && sudo ufw --force enable
```

Update keamanan otomatis:

```bash
sudo apt -y install unattended-upgrades && sudo dpkg-reconfigure -f noninteractive unattended-upgrades
```

> Password VPS sempat dibagikan lewat chat. Ganti password user (`passwd`) atau matikan login password seperti di atas sebelum memasang.

## 4. Ambil kode (repo privat)

Buat deploy key khusus baca di VPS:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/bupi_deploy -C "vps-bupi"
```

```bash
cat ~/.ssh/bupi_deploy.pub
```

Tempel isinya di GitHub: **envfri/kampung-baru → Settings → Deploy keys → Add deploy key** (jangan centang write access).

```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/bupi_deploy -o StrictHostKeyChecking=accept-new" git clone git@github.com:envfri/kampung-baru.git ~/bupi
```

```bash
cd ~/bupi && git config core.sshCommand "ssh -i ~/.ssh/bupi_deploy"
```

## 5. Pasang

```bash
cd ~/bupi && sudo bash deploy/install.sh amt.ai.id
```

`install.sh` (5–10 menit pertama kali):

1. menambah swap 2 GB bila RAM < 3 GB;
2. memasang Docker dari repo resmi (24.04 `noble`, 26.04 `resolute`);
3. membuka port 80/443 di ufw bila aktif;
4. membuat `.env` dengan password database & admin acak (tidak ditimpa bila sudah ada);
5. membangun & menjalankan semua layanan, menunggu sampai sehat;
6. memasang backup database harian (03:15, disimpan 14 hari di `backups/`);
7. mencetak alamat game, admin, **email & password admin**, dan URL webhook utama.

Simpan password admin yang tercetak. Keluar lalu login lagi ke SSH agar user Anda bisa menjalankan `docker` tanpa sudo.

Cek:

```bash
curl -s https://amt.ai.id/healthz && echo && curl -s https://amt.ai.id/api/version
```

## 6. Setelah terpasang (urutan yang disarankan)

1. Buka `https://amt.ai.id/admin/`, login, lalu **Akun saya → ganti password**.
2. **Admin → Integrasi & URL**: lihat status tiap layanan dan URL yang perlu didaftarkan (daftar lengkap juga di [INTEGRASI.md](INTEGRASI.md)).
3. Isi `.env` (`nano ~/bupi/.env`), mulai dengan kunci **uji**:
   - `MAILKETING_API_TOKEN`, `MAIL_FROM=BUPI <noreply@amt.ai.id>`: wajib agar pemain bisa menyimpan akun lewat email. Atau isi `GOOGLE_CLIENT_ID`.
   - `PAYMENT_PROVIDER=zepay`, `ZEPAY_KEY_ID=zpk_test_…`, `ZEPAY_SECRET=zsk_test_…`
   - `KLIKFLOW_API_KEY=kf_test_…`
   ```bash
   cd ~/bupi && docker compose up -d
   ```
4. Daftarkan webhook:
   - Admin → **Pembayaran** → Daftarkan webhook (ZePay).
   - Admin → **Email** → salin URL webhook → Mailketing → Integrasi → WebHook (Bounce & Unsubscribe).
   - Admin → **WhatsApp** → Daftarkan webhook (kunci live), atau manual di Klik Flow untuk kunci tes.
5. Uji: kirim email uji (admin → Email), WhatsApp uji (admin → WhatsApp), beli paket Mutiara lalu **Simulasi lunas** (admin → Pembayaran).
6. Siap dibuka: ganti ke kunci **live** (`zpk_live_…`, `kf_live_…`), `docker compose up -d`, lalu **daftarkan ulang webhook** (webhook uji dan live terpisah). Beli satu paket kecil sungguhan.
7. Pasang pemantau uptime (mis. UptimeRobot) ke `https://amt.ai.id/healthz`.

## 7. Update versi baru

```bash
cd ~/bupi && bash deploy/update.sh
```

`update.sh` membuat **backup database dulu**, menarik commit terbaru, membangun ulang, menunggu sampai sehat, lalu menampilkan versi yang berjalan. Riwayatnya terlihat di admin → **Versi & changelog**. Pemain melihat banner "Versi baru tersedia" di game.

## 8. Rollback (kembali ke versi sebelumnya)

`update.sh` mencetak commit sebelumnya. Untuk kembali:

```bash
cd ~/bupi && git log --oneline -5
```

```bash
git checkout KODE_COMMIT_SEBELUMNYA && GIT_SHA=$(git rev-parse --short HEAD) docker compose up -d --build
```

Bila versi baru sempat mengubah database (migrasi) dan versi lama error, pulihkan backup yang dibuat sebelum update:

```bash
ls -1t backups/ | head
```

```bash
bash deploy/restore.sh backups/bupi-YYYYMMDD-HHMMSS.sql.gz
```

`restore.sh` meminta konfirmasi (ketik `PULIHKAN`), membuat backup kondisi saat ini dulu, lalu mengganti database. Kembali ke versi terbaru nanti:

```bash
git checkout main && bash deploy/update.sh
```

## 9. Backup

- Otomatis setiap hari 03:15 WIB ke `~/bupi/backups/` (14 hari; log di `backups/backup.log`) dan setiap kali `update.sh` dijalankan.
- Manual: `bash deploy/backup.sh`.
- **Simpan juga di luar VPS** (bila VPS rusak, backup lokal ikut hilang). Contoh menarik backup ke komputer Anda:

```bash
rsync -az ubuntu@IP_VPS:~/bupi/backups/ ./backup-bupi/
```

- Simpan juga salinan `~/bupi/.env` di tempat aman (berisi kunci & password).

## 10. Perintah sehari-hari

| Perlu | Perintah |
|---|---|
| Status layanan | `docker compose ps` |
| Log aplikasi | `docker compose logs -f app` |
| Log HTTPS/Caddy | `docker compose logs -f caddy` |
| Terapkan perubahan `.env` | `docker compose up -d` |
| Restart aplikasi | `docker compose restart app` |
| Pemakaian disk Docker | `docker system df` |
| Bersihkan image lama | `docker image prune -f` |

Semua perintah dijalankan dari folder `~/bupi`.

## 11. Masalah umum

- **HTTPS belum aktif / browser memperingatkan sertifikat**: pastikan `dig +short amt.ai.id` = IP VPS, port 80 & 443 terbuka, Cloudflare dalam mode DNS only. Lihat `docker compose logs caddy`. Setelah DNS benar, sertifikat dibuat dalam beberapa menit.
- **Login tamu berhasil tapi langsung diminta masuk lagi**: `PUBLIC_URL` di `.env` harus sama dengan alamat yang dibuka pemain. Uji tanpa domain lewat `http://IP:8787` → `PUBLIC_URL=http://IP:8787`; setelah HTTPS aktif → `PUBLIC_URL=https://domain`. Cookie sesi hanya diberi flag Secure bila `PUBLIC_URL` memakai https://.
- **`install.sh` / `update.sh` berhenti "Server belum sehat"**: `docker compose logs app --tail 100`. Penyebab umum: isi `.env` salah ketik.
- **Build kehabisan memori di VPS 1–2 GB**: swap dibuat otomatis oleh `install.sh`; cek `free -h`. Bila tetap gagal, tambah RAM atau jalankan ulang `update.sh`.
- **Kode masuk email tidak sampai**: admin → Email → Kirim email uji; domain pengirim harus aktif di Mailketing → Setup Domain.
- **Webhook tidak masuk**: admin → Integrasi & URL menampilkan event terakhir yang diterima per layanan.
