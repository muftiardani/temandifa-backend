const express = require("express");
const {
  getContacts,
  addContact,
  updateContact,
  deleteContact,
} = require("../controllers/contactController");
const { protect } = require("../../../middleware/authMiddleware");
const { validate, contactSchema } = require("../../../middleware/validators");

const router = express.Router();

router.use(protect);

router.route("/").get(getContacts);
router.route("/").post(validate(contactSchema), addContact);
router.route("/:id").put(validate(contactSchema), updateContact);
router.route("/:id").delete(deleteContact);

module.exports = router;
