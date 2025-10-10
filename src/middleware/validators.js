const { body, validationResult } = require("express-validator");

const userValidationRules = () => {
  return [
    body("email").isEmail().withMessage("Format email tidak valid"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password minimal 8 karakter")
      .matches(/\d/)
      .withMessage("Password harus mengandung angka")
      .matches(/[a-z]/)
      .withMessage("Password harus mengandung huruf kecil")
      .matches(/[A-Z]/)
      .withMessage("Password harus mengandung huruf besar")
      .matches(/[!@#$%^&*(),.?":{}|<>]/)
      .withMessage("Password harus mengandung setidaknya satu simbol"),
    body("username")
      .not()
      .isEmpty()
      .withMessage("Username tidak boleh kosong")
      .isLength({ min: 3 })
      .withMessage("Username minimal 3 karakter"),
  ];
};

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const extractedErrors = [];
  errors.array().map((err) => extractedErrors.push({ [err.path]: err.msg }));

  return res.status(422).json({
    errors: extractedErrors,
  });
};

module.exports = {
  userValidationRules,
  validate,
};
