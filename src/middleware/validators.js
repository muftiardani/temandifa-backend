const { z, ZodError } = require("zod");
const { logWithContext, errorWithContext } = require("../config/logger");

const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    logWithContext(
      "debug",
      `Request validation successful for ${req.method} ${req.originalUrl}`,
      req
    );
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedErrors = error.errors.map((issue) => ({
        msg: issue.message,
        path: issue.path.join("."),
      }));
      const errorMessage = `Validasi gagal: ${formattedErrors
        .map((e) => `${e.path || "input"}: ${e.msg}`)
        .join("; ")}`;

      errorWithContext("Request validation failed", error, req, {
        validationErrors: formattedErrors,
      });

      const validationError = new Error(errorMessage);
      validationError.statusCode = 400;
      validationError.errors = formattedErrors;

      return next(validationError);
    }
    errorWithContext(
      "Unexpected error during validation middleware",
      error,
      req
    );
    next(error);
  }
};

const registerSchema = z.object({
  body: z
    .object({
      email: z
        .string({ required_error: "Email diperlukan" })
        .email("Format email tidak valid."),
      password: z
        .string({ required_error: "Password diperlukan" })
        .min(8, "Password minimal harus 8 karakter.")
        .regex(
          /[a-z]/,
          "Password harus mengandung setidaknya satu huruf kecil."
        )
        .regex(
          /[A-Z]/,
          "Password harus mengandung setidaknya satu huruf besar."
        )
        .regex(/[0-9]/, "Password harus mengandung setidaknya satu angka.")
        .regex(
          /[^a-zA-Z0-9]/,
          "Password harus mengandung setidaknya satu simbol."
        ),
    })
    .strict(),
});

const loginSchema = z.object({
  body: z
    .object({
      login: z.string({ required_error: "Login (email/username) diperlukan." }),
      password: z.string({ required_error: "Password diperlukan." }),
    })
    .strict(),
});

const contactSchema = z.object({
  body: z
    .object({
      name: z
        .string({ required_error: "Nama kontak wajib diisi" })
        .min(1, "Nama tidak boleh kosong")
        .max(100, "Nama maksimal 100 karakter"),
      phoneNumber: z
        .string({ required_error: "Nomor telepon wajib diisi" })
        .regex(
          /^[+]?[0-9\s-()]{5,}$/,
          "Format nomor telepon tidak valid (minimal 5 digit)."
        ),
    })
    .strict(),
});

const pushTokenSchema = z.object({
  body: z
    .object({
      token: z
        .string({ required_error: "Token diperlukan." })
        .startsWith(
          "ExponentPushToken[",
          "Format push token Expo tidak valid."
        ),
    })
    .strict(),
});

const initiateCallSchema = z.object({
  body: z
    .object({
      calleePhoneNumber: z
        .string({ required_error: "Nomor telepon penerima wajib diisi" })
        .regex(
          /^[+]?[0-9\s-()]{5,}$/,
          "Format nomor telepon tidak valid (minimal 5 digit)."
        ),
    })
    .strict(),
});

const callIdParamSchema = z.object({
  params: z.object({
    callId: z
      .string({ required_error: "Call ID wajib ada di parameter URL" })
      .uuid({ message: "Format Call ID tidak valid (harus UUID)." }),
  }),
});

const sessionIdParamSchema = z.object({
  params: z.object({
    sessionId: z
      .string({ required_error: "Session ID wajib ada di parameter URL" })
      .regex(/^[0-9a-fA-F]{24}$/, "Format Session ID tidak valid"),
  }),
});

const forgotPasswordSchema = z.object({
  body: z
    .object({
      email: z
        .string({ required_error: "Email diperlukan" })
        .email("Format email tidak valid."),
    })
    .strict(),
});

const resetPasswordSchema = z.object({
  params: z.object({
    token: z
      .string({ required_error: "Token reset wajib ada di parameter URL" })
      .min(1, "Token tidak boleh kosong."),
  }),
  body: z.object({
    password: z
      .string({ required_error: "Password baru diperlukan" })
      .min(8, "Password baru minimal harus 8 karakter."),
  }),
});

const refreshTokenSchema = z.object({
  body: z
    .object({
      refreshToken: z.string({ required_error: "Refresh token wajib diisi" }),
    })
    .strict(),
});

const logoutSchema = z.object({
  body: z
    .object({
      refreshToken: z.string({
        required_error: "Refresh token wajib diisi untuk logout sesi",
      }),
    })
    .strict(),
});

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  contactSchema,
  pushTokenSchema,
  initiateCallSchema,
  callIdParamSchema,
  sessionIdParamSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  logoutSchema,
};
