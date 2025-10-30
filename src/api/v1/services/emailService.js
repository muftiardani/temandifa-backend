const nodemailer = require("nodemailer");
const ejs = require("ejs");
const path = require("path");
const fs = require("fs");
const {
  logger,
  logWithContext,
  errorWithContext,
} = require("../../../config/logger");
const config = require("../../../config/appConfig");

/**
 * Mengirim email menggunakan nodemailer, dengan dukungan template EJS.
 *
 * @param {object} options - Opsi pengiriman email.
 * @param {string} options.to - Alamat email penerima.
 * @param {string} options.subject - Subjek email.
 * @param {string} [options.text] - Versi teks biasa dari email (fallback).
 * @param {string} [options.html] - Versi HTML dari email (jika tidak menggunakan template).
 * @param {string} [options.template] - Nama file template EJS (tanpa .ejs) di 'src/templates/emails/'.
 * @param {object} [options.context] - Data yang akan dimasukkan ke dalam template EJS.
 * @param {object} [req=null] - Objek request Express (opsional) untuk logging kontekstual.
 * @returns {Promise<object>} - Informasi hasil pengiriman dari nodemailer.
 */
const sendEmail = async (options, req = null) => {
  let transporter;
  try {
    if (
      !config.email.host ||
      !config.email.user ||
      !config.email.pass ||
      !config.email.from
    ) {
      throw new Error(
        "Konfigurasi email (host, user, pass, from) tidak lengkap."
      );
    }

    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  } catch (transportError) {
    errorWithContext(
      "Gagal membuat transporter email. Periksa konfigurasi.",
      transportError,
      req
    );
    throw new Error("Gagal menginisialisasi layanan email.");
  }

  let emailHtml = options.html;
  let emailText = options.text;

  if (options.template) {
    try {
      const templatePath = path.join(
        __dirname,
        "../../..",
        "templates",
        "emails",
        `${options.template}.ejs`
      );

      if (!fs.existsSync(templatePath)) {
        throw new Error(
          `Template email '${options.template}.ejs' tidak ditemukan di ${templatePath}`
        );
      }

      const templateString = fs.readFileSync(templatePath, "utf-8");
      emailHtml = ejs.render(templateString, options.context || {});

      if (!emailText && options.context && options.context.resetUrl) {
        emailText = `Untuk mereset kata sandi Anda, silakan kunjungi URL berikut (valid 10 menit): ${options.context.resetUrl}\n\nJika Anda tidak meminta ini, abaikan email ini.`;
      } else if (!emailText) {
        emailText = options.subject;
      }
    } catch (renderError) {
      errorWithContext("Error rendering email template", renderError, req, {
        template: options.template,
      });
      throw new Error("Gagal memproses template email.");
    }
  }

  const mailOptions = {
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: options.to,
    subject: options.subject,
    text: emailText,
    html: emailHtml,
  };

  logWithContext("info", `Attempting to send email`, req, {
    to: options.to,
    subject: options.subject,
    template: options.template || "N/A",
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
