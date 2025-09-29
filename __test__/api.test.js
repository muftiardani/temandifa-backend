const request = require("supertest");
const express = require("express");
const apiV1Routes = require("../src/api/v1/routes");
const errorHandler = require("../src/middleware/errorHandler");
const axios = require("axios");
const FormData = require("form-data");

// Mock modul axios
jest.mock("axios");

// Buat aplikasi Express palsu untuk testing
const app = express();
app.use("/api/v1", apiV1Routes);
app.use(errorHandler);

describe("API Gateway Routes", () => {
  // Hapus semua mock setelah setiap tes
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Tes untuk endpoint /detect
  test("POST /api/v1/detect should forward the request to the detector service", async () => {
    const mockResponse = { data: { result: "detection successful" } };
    axios.post.mockResolvedValue(mockResponse);

    const response = await request(app)
      .post("/api/v1/detect")
      .attach("image", Buffer.from("fake-image-data"), "test.jpg");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockResponse.data);

    // Memeriksa pemanggilan mock axios secara lebih detail
    expect(axios.post).toHaveBeenCalledTimes(1);
    const axiosCall = axios.post.mock.calls[0];
    expect(axiosCall[0]).toBe(process.env.DETECTOR_URL);
    expect(axiosCall[1]).toBeInstanceOf(FormData);
    expect(axiosCall[2]).toHaveProperty("headers");
  });

  // Tes untuk endpoint /scan
  test("POST /api/v1/scan should forward the request to the scanner service", async () => {
    const mockResponse = { data: { result: "scan successful" } };
    axios.post.mockResolvedValue(mockResponse);

    const response = await request(app)
      .post("/api/v1/scan")
      .attach("image", Buffer.from("fake-image-data"), "test.png");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockResponse.data);

    expect(axios.post).toHaveBeenCalledTimes(1);
    const axiosCall = axios.post.mock.calls[0];
    expect(axiosCall[0]).toBe(process.env.SCANNER_URL);
    expect(axiosCall[1]).toBeInstanceOf(FormData);
    expect(axiosCall[2]).toHaveProperty("headers");
  });

  // Tes untuk endpoint /transcribe
  test("POST /api/v1/transcribe should forward the request to the transcriber service", async () => {
    const mockResponse = { data: { result: "transcription successful" } };
    axios.post.mockResolvedValue(mockResponse);

    const response = await request(app)
      .post("/api/v1/transcribe")
      .attach("audio", Buffer.from("fake-audio-data"), "test.mp3");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockResponse.data);

    expect(axios.post).toHaveBeenCalledTimes(1);
    const axiosCall = axios.post.mock.calls[0];
    expect(axiosCall[0]).toBe(process.env.TRANSCRIBER_URL);
    expect(axiosCall[1]).toBeInstanceOf(FormData);
    expect(axiosCall[2]).toHaveProperty("headers");
  });

  // Tes untuk kasus file tidak ditemukan
  test("POST /api/v1/detect without a file should return 400", async () => {
    const response = await request(app).post("/api/v1/detect");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("File tidak ditemukan dalam permintaan.");
  });
});
