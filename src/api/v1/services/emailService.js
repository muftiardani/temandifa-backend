const nodemailer = require("nodemailer");
const {
  logger,
  logWithContext,
  errorWithContext,
} = require("../../../config/logger");

const sendEmail = async (options, req = null) => {
  const requiredEnvVars = [
    "EMAIL_HOST",
    "EMAIL_PORT",
    "EMAIL_USERNAME",
    "EMAIL_PASSWORD",
    "FROM_EMAIL",
  ];
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    const configError = new Error(
      `Konfigurasi email tidak lengkap. Variabel environment hilang: ${missingVars.join(
        ", "
      )}`
    );
    errorWithContext("Email configuration incomplete", configError, req);
    throw configError;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10),
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: `"${process.env.FROM_NAME || "TemanDifa Support"}" <${
      process.env.FROM_EMAIL
    }>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  logWithContext("info", `Attempting to send email`, req, {
    to: options.to,
    subject: options.subject,
  });
  try {
    const info = await transporter.sendMail(mailOptions);
    logWithContext("info", `Email sent successfully`, req, {
      to: options.to,
      messageId: info.messageId,
      accepted: info.accepted,
    });
    return info;
  } catch (error) {
    errorWithContext("Error sending email", error, req, {
      to: options.to,
      subject: options.subject,
    });
    throw new Error(
      `Gagal mengirim email ke ${options.to}. Silakan coba beberapa saat lagi.`
    );
  }
};

module.exports = sendEmail;
