const { z } = require("zod");

/**
 * Middleware generik untuk memvalidasi permintaan (request) menggunakan skema Zod.
 * Jika validasi gagal, middleware akan mengirim respons error 400.
 * @param {z.Schema} schema - Skema Zod yang akan digunakan untuk validasi.
 */
const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        errors: error.issues.map((issue) => ({
          msg: issue.message,
          path: issue.path.join("."),
        })),
      });
    }
    next(error);
  }
};

// Skema untuk registrasi pengguna baru
const registerSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email diperlukan" })
      .email("Format email tidak valid."),
    password: z
      .string({ required_error: "Password diperlukan" })
      .min(8, "Password minimal harus 8 karakter.")
      .regex(/[a-z]/, "Password harus mengandung setidaknya satu huruf kecil.")
      .regex(/[A-Z]/, "Password harus mengandung setidaknya satu huruf besar.")
      .regex(/[0-9]/, "Password harus mengandung setidaknya satu angka.")
      .regex(
        /[^a-zA-Z0-9]/,
        "Password harus mengandung setidaknya satu simbol."
      ),
  }),
});

// Skema untuk login pengguna
const loginSchema = z.object({
  body: z.object({
    login: z.string({ required_error: "Login (email/username) diperlukan." }),
    password: z.string({ required_error: "Password diperlukan." }),
  }),
});

// Skema untuk membuat kontak baru
const contactSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Nama tidak boleh kosong"),
    phoneNumber: z
      .string()
      .regex(
        /^\+[1-9]\d{1,14}$/,
        "Format nomor telepon tidak valid. Gunakan format internasional, contoh: +628123456789"
      ),
  }),
});

// Skema untuk memperbarui push token
const pushTokenSchema = z.object({
  body: z.object({
    token: z
      .string({ required_error: "Token diperlukan." })
      .min(1, "Token tidak boleh kosong."),
  }),
});

// Skema untuk memulai panggilan
const initiateCallSchema = z.object({
  body: z.object({
    calleePhoneNumber: z
      .string()
      .regex(
        /^\+[1-9]\d{1,14}$/,
        "Format nomor telepon tidak valid. Gunakan format internasional, contoh: +628123456789"
      ),
  }),
});

// Skema untuk memvalidasi parameter callId (format ObjectId MongoDB)
const callIdSchema = z.object({
  params: z.object({
    callId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Format Call ID tidak valid."),
  }),
});

// Skema untuk meminta reset password
const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email diperlukan" })
      .email("Format email tidak valid."),
  }),
});

// Skema untuk melakukan reset password
const resetPasswordSchema = z.object({
  params: z.object({
    token: z.string().min(1, "Token diperlukan."),
  }),
  body: z.object({
    password: z
      .string({ required_error: "Password baru diperlukan" })
      .min(8, "Password baru minimal harus 8 karakter."),
  }),
});

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  contactSchema,
  pushTokenSchema,
  initiateCallSchema,
  callIdSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
