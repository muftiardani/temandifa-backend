const authService = require("../authService");
const User = require("../../models/User");
const Session = require("../../models/Session");
const { redisClient } = require("../../../../config/redis");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../../../../config/appConfig");

jest.mock("../../models/User");
jest.mock("../../models/Session");
jest.mock("../../../../config/redis", () => ({
  redisClient: {
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    multi: jest.fn(() => ({
      set: jest.fn(),
      exec: jest.fn().mockResolvedValue(true),
    })),
  },
}));
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");
jest.mock("../emailService");

const mockReq = {
  id: "test-req-123",
  headers: {
    "user-agent": "jest-test",
    "x-forwarded-for": "127.0.0.1",
  },
  ip: "127.0.0.1",
  connection: {
    remoteAddress: "127.0.0.1",
  },
};

describe("authService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("loginUser", () => {
    it("harus melempar error 401 jika password salah", async () => {
      const mockUser = {
        _id: "userId123",
        email: "test@example.com",
        password: "hashedPassword123",
        matchPassword: jest.fn().mockResolvedValue(false),
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(
        authService.loginUser("test@example.com", "wrongPassword", mockReq)
      ).rejects.toThrow("Email atau password salah");

      expect.assertions(2);
      try {
        await authService.loginUser(
          "test@example.com",
          "wrongPassword",
          mockReq
        );
      } catch (error) {
        expect(error.statusCode).toBe(401);
      }
    });

    it("harus melempar error 401 jika user tidak ditemukan", async () => {
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        authService.loginUser("notfound@example.com", "anyPassword", mockReq)
      ).rejects.toThrow("Email atau password salah");
    });

    it("harus berhasil login dan membuat sesi jika kredensial benar", async () => {
      const mockUser = {
        _id: "userId123",
        email: "test@example.com",
        password: "hashedPassword123",
        toObject: () => ({ _id: "userId123", email: "test@example.com" }),
        matchPassword: jest.fn().mockResolvedValue(true),
      };

      const mockSession = {
        _id: "sessionId456",
        refreshTokenHash: "PENDING",
        save: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      Session.create.mockResolvedValue(mockSession);
      bcrypt.genSalt.mockResolvedValue("salt");
      bcrypt.hash.mockResolvedValue("hashedRefreshToken");
      jwt.sign
        .mockReturnValueOnce("fakeAccessToken")
        .mockReturnValueOnce("fakeRefreshToken");

      const result = await authService.loginUser(
        "test@example.com",
        "correctPassword",
        mockReq
      );

      expect(result.accessToken).toBe("fakeAccessToken");
      expect(result.refreshToken).toBe("fakeRefreshToken");

      expect(Session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ip: "127.0.0.1",
          userAgent: expect.stringContaining("jest-test"),
        })
      );

      expect(bcrypt.hash).toHaveBeenCalledWith("fakeRefreshToken", "salt");
      expect(mockSession.refreshTokenHash).toBe("hashedRefreshToken");
      expect(mockSession.save).toHaveBeenCalled();

      expect(redisClient.set).toHaveBeenCalledWith(
        "session_valid:sessionId456",
        "1",
        expect.objectContaining({
          EX: expect.any(Number),
        })
      );
    });
  });
});
