const nodemailer = require("nodemailer");
const logger = require("../config/logger");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Mengirim email yang berisi link untuk mereset password.
 * @param {string} to - Alamat email tujuan.
 * @param {string} token - Token unik untuk reset password.
 */
const sendPasswordResetEmail = async (to, token) => {
  const resetURL = `${process.env.FRONTEND_URL}/reset-password/${token}`;

  const mailOptions = {
    from: '"TemanDifa Support" <support@temandifa.com>',
    to,
    subject: "Atur Ulang Kata Sandi Akun TemanDifa Anda",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #3F7EF3;">Permintaan Atur Ulang Kata Sandi</h2>
          <p>Halo,</p>
          <p>Kami menerima permintaan untuk mengatur ulang kata sandi akun TemanDifa Anda. Anda dapat membuat kata sandi baru dengan mengklik tombol di bawah ini.</p>
          <p style="margin: 30px 0; text-align: center;">
            <a href="${resetURL}" style="background-color: #3F7EF3; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px;">Atur Ulang Kata Sandi</a>
          </p>
          <p>Tautan ini akan kedaluwarsa dalam <strong>10 menit</strong>.</p>
          <p>Jika Anda tidak merasa meminta perubahan ini, Anda bisa mengabaikan email ini dengan aman.</p>
          <hr style="border: none; border-top: 1px solid #eee;" />
          <p style="font-size: 12px; color: #888;">
            Jika Anda kesulitan mengklik tombol di atas, salin dan tempel URL berikut ke browser Anda:<br>
            <a href="${resetURL}" style="color: #3F7EF3;">${resetURL}</a>
          </p>
          <p>Terima kasih,<br>Tim TemanDifa</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Email reset password berhasil dikirim ke: ${to}`);
  } catch (error) {
    logger.error(`Gagal mengirim email ke ${to}: ${error.message}`);
    throw new Error(
      "Gagal mengirim email instruksi. Silakan coba beberapa saat lagi."
    );
  }
};

module.exports = {
  sendPasswordResetEmail,
};
