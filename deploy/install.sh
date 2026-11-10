#!/usr/bin/env bash
# Pasang Kampung Bulu di VPS Ubuntu 22.04/24.04.
# Jalankan dari folder repo:  sudo bash deploy/install.sh domainmu.com
set -euo pipefail

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then echo "Pakai: sudo bash deploy/install.sh domainmu.com"; exit 1; fi
if [ "$(id -u)" -ne 0 ]; then echo "Jalankan dengan sudo."; exit 1; fi
cd "$(dirname "$0")/.."
REPO_DIR="$(pwd)"
OWNER="${SUDO_USER:-root}"

echo "==> 1/6 Swap (agar build tidak kehabisan RAM di VPS kecil)"
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$MEM_MB" -lt 3000 ] && ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "    swap 2 GB dibuat"
else
  echo "    tidak perlu (RAM ${MEM_MB} MB atau swap sudah ada)"
fi

echo "==> 2/6 Docker"
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y ca-certificates curl openssl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  [ "$OWNER" != "root" ] && usermod -aG docker "$OWNER" || true
else
  echo "    sudah terpasang: $(docker --version)"
fi

echo "==> 3/6 Firewall"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw allow 443/udp >/dev/null
  echo "    ufw: port 80 & 443 dibuka"
else
  echo "    ufw tidak aktif (dibiarkan). Pastikan port 80 & 443 terbuka di firewall/security group panel VPS."
fi

echo "==> 4/6 Konfigurasi (.env)"
if [ ! -f .env ]; then
  ADMIN_PW=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-16)
  PG_PW=$(openssl rand -hex 16)
  cat > .env <<ENV
DOMAIN=$DOMAIN
PUBLIC_URL=https://$DOMAIN
POSTGRES_PASSWORD=$PG_PW
ADMIN_EMAIL=admin@$DOMAIN
ADMIN_PASSWORD=$ADMIN_PW
# Login Google & email (isi lalu jalankan: docker compose up -d)
GOOGLE_CLIENT_ID=
# Email lewat Mailketing (token dari Integrasi → Email Application API; domain $DOMAIN harus aktif di Setup Domain)
MAILKETING_API_TOKEN=
MAIL_FROM=Kampung Bulu <noreply@$DOMAIN>
# WhatsApp lewat Klik Flow (kunci dari Pengaturan › API & Webhook)
KLIKFLOW_API_KEY=
KLIKFLOW_WEBHOOK_SECRET=
# PERHATIAN: mock = pembelian Mutiara simulasi (gratis). Sebelum dibuka untuk umum: ganti ke zepay,
# isi kunci ZePay, docker compose up -d, lalu daftarkan webhook dari admin → Pembayaran.
PAYMENT_PROVIDER=mock
ZEPAY_KEY_ID=
ZEPAY_SECRET=
ZEPAY_WEBHOOK_SECRET=
ZEPAY_EXPIRES_MINUTES=30
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_PRODUCTION=false
VAPID_SUBJECT=mailto:admin@$DOMAIN
ENV
  chmod 600 .env
  chown "$OWNER" .env || true
  echo "    .env dibuat"
else
  echo "    .env sudah ada (tidak diubah)"
fi

echo "==> 5/6 Build & jalankan (5–10 menit pertama kali)"
export GIT_SHA="$(git -c safe.directory='*' rev-parse --short HEAD 2>/dev/null || true)"
docker compose up -d --build
for i in $(seq 1 60); do
  if docker compose exec -T app wget -qO- http://127.0.0.1:8787/healthz >/dev/null 2>&1; then OK=1; break; fi
  sleep 5
done
if [ "${OK:-0}" != "1" ]; then echo "Server belum sehat. Cek: docker compose logs app --tail 100"; exit 1; fi

echo "==> 6/6 Backup database harian (03:15, simpan 14 hari)"
chmod +x deploy/backup.sh deploy/update.sh
CRON="15 3 * * * cd $REPO_DIR && bash deploy/backup.sh >> /var/log/kampungbulu-backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'deploy/backup.sh' ; echo "$CRON" ) | crontab -

IP=$(curl -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2)
cat <<INFO

================= Kampung Bulu terpasang =================
Game   : https://$DOMAIN
Admin  : https://$DOMAIN/admin/
Email  : $ADMIN_EMAIL
Pass   : $ADMIN_PASSWORD   (simpan, lalu ganti di menu Akun saya)

DNS    : buat A record  $DOMAIN  ->  $IP
         HTTPS aktif otomatis beberapa menit setelah DNS mengarah ke VPS ini.
Webhook: semua URL (ZePay, Klik Flow, Mailketing, Google) ada di
         admin -> Integrasi & URL  dan di file INTEGRASI.md
         ZePay   : https://$DOMAIN/api/payments/zepay/webhook
         WhatsApp: https://$DOMAIN/api/wa/klikflow/webhook
Update : bash deploy/update.sh
Log    : docker compose logs -f app
===========================================================
INFO
