const nodemailer = require("nodemailer");
const logger = require("../config/logger");

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: `"${process.env.FROM_NAME || "TemanDifa Support"}" <${
      process.env.FROM_EMAIL || "support@temandifa.com"
    }>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Email berhasil dikirim ke: ${options.to}`);
  } catch (error) {
    logger.error(`Gagal mengirim email ke ${options.to}: ${error.message}`);
    throw new Error(
      "Gagal mengirim email instruksi. Silakan coba beberapa saat lagi."
    );
  }
};

module.exports = sendEmail;
