const request = require("supertest");
const { app, initializeExpressApp } = require("../src/config/expressApp");
const User = require("../src/api/v1/models/User");
const Session = require("../src/api/v1/models/Session");
const mongoose = require("mongoose");
const { redisClient } = require("../src/config/redis");

jest.mock("../src/config/redis", () => ({
  redisClient: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    multi: jest.fn(() => ({
      set: jest.fn(),
      exec: jest.fn().mockResolvedValue(true),
    })),
  },
}));

jest.mock("../src/api/v1/services/emailService", () =>
  jest.fn().mockResolvedValue(true)
);

let server;
beforeAll(async (done) => {
  await initializeExpressApp();
  server = require("http").createServer(app);
  server.listen(done);
});

afterAll((done) => {
  server.close(done);
});

describe("Alur Autentikasi API (Integration Test)", () => {
  const testUser = {
    email: "integration_test@example.com",
    password: "Password123!",
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("1. Harus mendaftarkan pengguna baru (201 Created)", async () => {
    const res = await request(server)
      .post("/api/v1/auth/register")
      .send(testUser);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
    expect(res.body.email).toBe(testUser.email);

    const dbUser = await User.findOne({ email: testUser.email });
    expect(dbUser).not.toBeNull();
    expect(dbUser.email).toBe(testUser.email);
    expect(dbUser.password).not.toBe(testUser.password);
  });

  it("2. Harus gagal mendaftarkan pengguna yang sama lagi (400 Bad Request)", async () => {
    const res = await request(server)
      .post("/api/v1/auth/register")
      .send(testUser);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Email sudah terdaftar");
  });

  it("3. Harus melempar error validasi Zod jika password lemah (400 Bad Request)", async () => {
    const res = await request(server).post("/api/v1/auth/register").send({
      email: "zod_test@example.com",
      password: "123",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("Password minimal harus 8 karakter");
  });

  it("4. Harus berhasil login dengan pengguna yang sudah ada (200 OK)", async () => {
    const res = await request(server).post("/api/v1/auth/login").send({
      login: testUser.email,
      password: testUser.password,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");

    const dbUser = await User.findOne({ email: testUser.email });
    const sessionCount = await Session.countDocuments({
      user: dbUser._id,
    });
    expect(sessionCount).toBe(2);
  });

  it("5. Harus gagal login dengan password yang salah (401 Unauthorized)", async () => {
    const res = await request(server).post("/api/v1/auth/login").send({
      login: testUser.email,
      password: "PasswordSalah!",
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Email atau password salah");
  });
});
