const express = require("express");
const router = express.Router();
const contactController = require("../controllers/contactController");
const { validate, contactSchema } = require("../../../middleware/validators");
const passport = require("passport");

// Lindungi semua rute kontak dengan otentikasi JWT
router.use(passport.authenticate("jwt", { session: false }));

router
  .route("/")
  .get(contactController.getContacts)
  .post(validate(contactSchema), contactController.addContact);

router.route("/:id").delete(contactController.deleteContact);

module.exports = router;
