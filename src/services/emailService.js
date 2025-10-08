const nodemailer = require("nodemailer");
const logger = require("../config/logger");

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const message = {
    from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  try {
    const info = await transporter.sendMail(message);
    logger.info("Email terkirim: " + info.response);
  } catch (error) {
    logger.error("Gagal mengirim email: ", error);
    throw new Error("Gagal mengirim email.");
  }
};

module.exports = sendEmail;
