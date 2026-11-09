import { config } from '../config';

let transport: any = null;

/** Kirim kode OTP. Tanpa SMTP_URL, kode hanya dicatat di log server (mode pengembangan). */
export async function sendOtp(to: string, code: string, log: { info: (...a: any[]) => void; error: (...a: any[]) => void }) {
  if (!config.smtpUrl) {
    log.info({ to, code }, 'SMTP_URL belum diisi: kode OTP hanya dicatat di log');
    return false;
  }
  try {
    if (!transport) {
      const nm = await import('nodemailer');
      transport = (nm.default ?? nm).createTransport(config.smtpUrl);
    }
    await transport.sendMail({
      from: config.mailFrom,
      to,
      subject: `Kode masuk Kampung Bulu: ${code}`,
      text: `Kode masuk kamu: ${code}\n\nKode berlaku 10 menit. Abaikan email ini jika kamu tidak meminta kode.`,
      html: `<p>Kode masuk kamu:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>Kode berlaku 10 menit. Abaikan email ini jika kamu tidak meminta kode.</p>`,
    });
    return true;
  } catch (e) {
    log.error(e, 'gagal mengirim email OTP');
    return false;
  }
}
