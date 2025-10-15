const express = require("express");
const { updatePushToken } = require("../controllers/userController");
const { protect } = require("../../middleware/authMiddleware");
const { validate } = require("../../middleware/validators");
const { pushTokenSchema } = require("../../utils/validationSchemas");

const router = express.Router();

/**
 * @swagger
 * tags:
 * name: User
 * description: User-related operations
 */

/**
 * @swagger
 * /users/pushtoken:
 * put:
 * summary: Update the Expo push token for the current user
 * tags: [User]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - token
 * properties:
 * token:
 * type: string
 * description: The Expo push token.
 * responses:
 * 200:
 * description: Push token updated successfully.
 * 400:
 * description: Bad request (e.g., token is missing).
 * 401:
 * description: Unauthorized.
 */
router.put("/pushtoken", protect, validate(pushTokenSchema), updatePushToken);

module.exports = router;
