const express = require("express");
const {
  initiateCall,
  answerCall,
  endCall,
  getCallStatus,
} = require("../controllers/callController");
const { protect } = require("../../../middleware/authMiddleware");
const {
  validate,
  initiateCallSchema,
  callIdSchema,
} = require("../../../middleware/validators");

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * tags:
 * name: Call
 * description: Video call management
 */

/**
 * @swagger
 * /call/initiate:
 * post:
 * summary: Initiate a new video call
 * tags: [Call]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - calleePhoneNumber
 * properties:
 * calleePhoneNumber:
 * type: string
 * responses:
 * 200:
 * description: Call initiated successfully, returns call details and tokens.
 * 404:
 * description: Callee not found.
 * 500:
 * description: Server error.
 */
router.post("/initiate", validate(initiateCallSchema), initiateCall);

/**
 * @swagger
 * /call/status:
 * get:
 * summary: Get the status of any active call for the user
 * tags: [Call]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Returns the active call details if any.
 * 401:
 * description: Unauthorized.
 */
router.get("/status", getCallStatus);

/**
 * @swagger
 * /call/{callId}/answer:
 * post:
 * summary: Answer an incoming call
 * tags: [Call]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: callId
 * required: true
 * schema:
 * type: string
 * responses:
 * 200:
 * description: Call answered successfully, returns tokens for the callee.
 * 404:
 * description: Call not found or already ended.
 */
router.post("/:callId/answer", validate(callIdSchema), answerCall);

/**
 * @swagger
 * /call/{callId}/end:
 * post:
 * summary: End or decline a call
 * tags: [Call]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: callId
 * required: true
 * schema:
 * type: string
 * responses:
 * 200:
 * description: Call ended successfully.
 * 404:
 * description: Call not found.
 */
router.post("/:callId/end", validate(callIdSchema), endCall);

module.exports = router;
