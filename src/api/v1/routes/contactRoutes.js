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

/**
 * @swagger
 * tags:
 * name: Contacts
 * description: Emergency contact management
 */

/**
 * @swagger
 * /contacts:
 * get:
 * summary: Retrieve a list of emergency contacts for the user
 * tags: [Contacts]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: A list of contacts.
 * content:
 * application/json:
 * schema:
 * type: array
 * items:
 * type: object
 * properties:
 * _id:
 * type: string
 * name:
 * type: string
 * phoneNumber:
 * type: string
 * post:
 * summary: Create a new emergency contact
 * tags: [Contacts]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - name
 * - phoneNumber
 * properties:
 * name:
 * type: string
 * phoneNumber:
 * type: string
 * responses:
 * 201:
 * description: Contact created successfully.
 */
router.route("/").get(getContacts).post(validate(contactSchema), addContact);

/**
 * @swagger
 * /contacts/{id}:
 * put:
 * summary: Update an emergency contact
 * tags: [Contacts]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: The contact ID
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * name:
 * type: string
 * phoneNumber:
 * type: string
 * responses:
 * 200:
 * description: Contact updated successfully.
 * 404:
 * description: Contact not found.
 * delete:
 * summary: Delete an emergency contact
 * tags: [Contacts]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: The contact ID
 * responses:
 * 200:
 * description: Contact deleted successfully.
 * 404:
 * description: Contact not found.
 */
router
  .route("/:id")
  .put(validate(contactSchema), updateContact)
  .delete(deleteContact);

module.exports = router;
