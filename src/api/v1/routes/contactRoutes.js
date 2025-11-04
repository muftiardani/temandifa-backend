const express = require("express");
const contactController = require("../controllers/contactController");
const { protect } = require("../../../middleware/authMiddleware");
const {
  validate,
  contactSchema,
  mongoIdParamSchema,
} = require("../../../middleware/validators");

const router = express.Router();

router.use(protect);

router
  .route("/")
  .get(contactController.getContacts)
  .post(validate(contactSchema), contactController.addContact);

router
  .route("/:id")
  .get(validate(mongoIdParamSchema), contactController.getContactById)
  .put(
    validate(mongoIdParamSchema),
    validate(contactSchema),
    contactController.updateContact
  )
  .delete(validate(mongoIdParamSchema), contactController.deleteContact);

module.exports = router;
