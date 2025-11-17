const path = require("path");
const fs = require("fs");
const YAML = require("yaml");
const { z } = require("zod");

const {
  OpenApiGeneratorV3,
  OpenAPIRegistry,
  extendZodWithOpenApi,
} = require("@asteasolutions/zod-to-openapi");

extendZodWithOpenApi(z);

const {
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
  mongoIdParamSchema,
} = require("../middleware/validators");

const registry = new OpenAPIRegistry();

const bearerAuth = [{ bearerAuth: [] }];

const ContactSchema = registry.register("Contact", contactSchema.shape.body);
const SessionSchema = registry.register(
  "Session",
  z.object({
    id: z.string().openapi({
      example: "60c72b2f5f1b2c001f2b9a0c",
    }),
    userAgent: z.string().openapi({ example: "Chrome - ...rest" }),
    ip: z.string().openapi({ example: "127.0.0.1" }),
    lastActiveAt: z.string().openapi({ format: "date-time" }),
    createdAt: z.string().openapi({ format: "date-time" }),
    isCurrent: z.boolean(),
  })
);
const UserProfileSchema = registry.register(
  "UserProfile",
  z.object({
    _id: z.string().openapi({
      example: "60c72b2f5f1b2c001f2b9a0c",
    }),
    email: z.string().email(),
    googleId: z.string().optional(),
    pushToken: z.string().optional(),
    createdAt: z.string().openapi({ format: "date-time" }),
    updatedAt: z.string().openapi({ format: "date-time" }),
  })
);

registry.registerPath({
  method: "post",
  path: "/auth/register",
  summary: "Register a new user",
  tags: ["Auth"],
  request: {
    body: {
      content: { "application/json": { schema: registerSchema.shape.body } },
    },
  },
  responses: {
    201: { description: "User registered successfully" },
    400: { description: "Bad request (validation error or email exists)" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/login",
  summary: "Log in a user",
  tags: ["Auth"],
  request: {
    body: {
      content: { "application/json": { schema: loginSchema.shape.body } },
    },
  },
  responses: {
    200: { description: "Login successful, returns access/refresh tokens" },
    401: { description: "Invalid credentials" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/google/mobile",
  summary: "Authenticate with Google on mobile",
  tags: ["Auth"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ accessToken: z.string() }),
        },
      },
    },
  },
  responses: {
    200: { description: "Google authentication successful" },
    400: { description: "Google access token is required" },
    401: { description: "Invalid Google token" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh-token",
  summary: "Refresh an access token",
  tags: ["Auth"],
  request: {
    body: {
      content: {
        "application/json": { schema: refreshTokenSchema.shape.body },
      },
    },
  },
  responses: {
    200: { description: "Returns a new access token" },
    400: { description: "Refresh token is required" },
    403: { description: "Invalid or expired refresh token" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  summary: "Log out a user (invalidate session)",
  tags: ["Auth"],
  request: {
    body: {
      content: { "application/json": { schema: logoutSchema.shape.body } },
    },
  },
  responses: {
    200: { description: "Logout successful" },
    400: { description: "Refresh token is required" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/forgotpassword",
  summary: "Request a password reset",
  tags: ["Auth"],
  request: {
    body: {
      content: {
        "application/json": { schema: forgotPasswordSchema.shape.body },
      },
    },
  },
  responses: {
    200: { description: "Password reset email sent (if email exists)" },
    400: { description: "Invalid email format" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/resetpassword/{token}",
  summary: "Reset password with a token",
  tags: ["Auth"],
  request: {
    params: resetPasswordSchema.shape.params,
    body: {
      content: {
        "application/json": { schema: resetPasswordSchema.shape.body },
      },
    },
  },
  responses: {
    200: { description: "Password has been reset successfully" },
    400: { description: "Invalid token or password" },
  },
});

registry.registerPath({
  method: "get",
  path: "/auth/profile",
  summary: "Get current user profile",
  tags: ["Auth"],
  security: bearerAuth,
  responses: {
    200: {
      description: "User profile data",
      content: { "application/json": { schema: UserProfileSchema } },
    },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "get",
  path: "/auth/sessions",
  summary: "Get all active sessions for the current user",
  tags: ["Auth"],
  security: bearerAuth,
  responses: {
    200: {
      description: "A list of active sessions",
      content: {
        "application/json": { schema: z.array(SessionSchema) },
      },
    },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/auth/sessions/{sessionId}",
  summary: "Revoke a specific session",
  tags: ["Auth"],
  security: bearerAuth,
  request: {
    params: sessionIdParamSchema.shape.params,
  },
  responses: {
    200: { description: "Session revoked successfully" },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Session not found" },
  },
});

registry.registerPath({
  method: "get",
  path: "/contacts",
  summary: "Get all emergency contacts for the user",
  tags: ["Contacts"],
  security: bearerAuth,
  responses: {
    200: {
      description: "List of contacts",
      content: { "application/json": { schema: z.array(ContactSchema) } },
    },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post",
  path: "/contacts",
  summary: "Add a new emergency contact",
  tags: ["Contacts"],
  security: bearerAuth,
  request: {
    body: {
      content: { "application/json": { schema: contactSchema.shape.body } },
    },
  },
  responses: {
    201: {
      description: "Contact created",
      content: { "application/json": { schema: ContactSchema } },
    },
    400: { description: "Invalid input" },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "put",
  path: "/contacts/{id}",
  summary: "Update an emergency contact",
  tags: ["Contacts"],
  security: bearerAuth,
  request: {
    params: mongoIdParamSchema.shape.params,
    body: {
      content: { "application/json": { schema: contactSchema.shape.body } },
    },
  },
  responses: {
    200: {
      description: "Contact updated",
      content: { "application/json": { schema: ContactSchema } },
    },
    400: { description: "Invalid input or ID" },
    401: { description: "Unauthorized" },
    404: { description: "Contact not found" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/contacts/{id}",
  summary: "Delete an emergency contact",
  tags: ["Contacts"],
  security: bearerAuth,
  request: {
    params: mongoIdParamSchema.shape.params,
  },
  responses: {
    200: { description: "Contact deleted" },
    401: { description: "Unauthorized" },
    404: { description: "Contact not found" },
  },
});

registry.registerPath({
  method: "get",
  path: "/contacts/{id}",
  summary: "Get a specific emergency contact",
  tags: ["Contacts"],
  security: bearerAuth,
  request: {
    params: mongoIdParamSchema.shape.params,
  },
  responses: {
    200: {
      description: "Contact details",
      content: { "application/json": { schema: ContactSchema } },
    },
    401: { description: "Unauthorized" },
    404: { description: "Contact not found" },
  },
});

registry.registerPath({
  method: "post",
  path: "/call/initiate",
  summary: "Initiate a new video call",
  tags: ["Call"],
  security: bearerAuth,
  request: {
    body: {
      content: {
        "application/json": { schema: initiateCallSchema.shape.body },
      },
    },
  },
  responses: {
    200: { description: "Call initiated, returns call details and token" },
    400: { description: "Invalid phone number" },
    401: { description: "Unauthorized" },
    404: { description: "Callee not found" },
    409: { description: "User is already in another call" },
  },
});

registry.registerPath({
  method: "get",
  path: "/call/status",
  summary: "Get the status of any active call for the user",
  tags: ["Call"],
  security: bearerAuth,
  responses: {
    200: { description: "Returns the active call details if any" },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post",
  path: "/call/{callId}/answer",
  summary: "Answer an incoming call",
  tags: ["Call"],
  security: bearerAuth,
  request: {
    params: callIdParamSchema.shape.params,
  },
  responses: {
    200: { description: "Call answered, returns token for the callee" },
    401: { description: "Unauthorized" },
    403: { description: "Not allowed to answer this call" },
    404: { description: "Call not found or expired" },
    409: { description: "Call is not in 'ringing' state" },
  },
});

registry.registerPath({
  method: "post",
  path: "/call/{callId}/end",
  summary: "End, decline, or cancel a call",
  tags: ["Call"],
  security: bearerAuth,
  request: {
    params: callIdParamSchema.shape.params,
  },
  responses: {
    200: { description: "Call ended/declined/cancelled successfully" },
    401: { description: "Unauthorized" },
    403: { description: "Not allowed to end this call" },
    404: { description: "Call not found" },
  },
});

registry.registerPath({
  method: "put",
  path: "/users/pushtoken",
  summary: "Update the user's Expo push token",
  tags: ["Users"],
  security: bearerAuth,
  request: {
    body: {
      content: { "application/json": { schema: pushTokenSchema.shape.body } },
    },
  },
  responses: {
    200: { description: "Push token updated successfully" },
    400: { description: "Invalid token provided" },
    401: { description: "Unauthorized" },
    404: { description: "User not found" },
  },
});

const multipartFormSchema = z.object({
  image: z.string().openapi({ format: "binary" }),
});
const audioFormSchema = z.object({
  audio: z.string().openapi({ format: "binary" }),
});

registry.registerPath({
  method: "post",
  path: "/detect",
  summary: "Detect objects in an image",
  tags: ["AI Services"],
  security: bearerAuth,
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: multipartFormSchema,
        },
      },
    },
  },
  responses: {
    200: { description: "A list of detected objects" },
    400: { description: "No file uploaded" },
    415: { description: "Invalid file type" },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post",
  path: "/scan",
  summary: "Perform OCR on an image",
  tags: ["AI Services"],
  security: bearerAuth,
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: multipartFormSchema,
        },
      },
    },
  },
  responses: {
    200: { description: "The scanned text from the image" },
    400: { description: "No file uploaded" },
    415: { description: "Invalid file type" },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post",
  path: "/transcribe",
  summary: "Transcribe an audio file",
  tags: ["AI Services"],
  security: bearerAuth,
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: audioFormSchema,
        },
      },
    },
  },
  responses: {
    200: { description: "The transcribed text from the audio" },
    400: { description: "No file uploaded" },
    415: { description: "Invalid file type" },
    401: { description: "Unauthorized" },
  },
});

/**
 * Menghasilkan spesifikasi OpenAPI v3 lengkap
 * dengan menggabungkan info dasar dari openapi.yaml
 * dan path serta skema yang di-generate dari Zod registry.
 * @returns {object} - Objek spesifikasi OpenAPI
 */
const getOpenApiDocumentation = () => {
  const yamlFile = fs.readFileSync(
    path.join(__dirname, "../docs/openapi.yaml"),
    "utf8"
  );
  const baseSpec = YAML.parse(yamlFile);

  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: baseSpec.openapi || "3.0.0",
    info: baseSpec.info || { title: "TemanDifa API", version: "1.0.0" },
    servers: baseSpec.servers || [{ url: "/api/v1" }],
    security: baseSpec.security,
    components: {
      securitySchemes: baseSpec.components.securitySchemes,
    },
    tags: baseSpec.tags,
  });
};

module.exports = { getOpenApiDocumentation };
