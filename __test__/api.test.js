const request = require("supertest");
const express = require("express");
const { app, initializeExpressApp } = require("../src/config/expressApp");
const errorHandler = require("../src/middleware/errorHandler");
const axios = require("axios");
const FormData = require("form-data");
const config = require("../src/config/appConfig");

jest.mock("axios");

let server;
beforeAll(async (done) => {
  await initializeExpressApp();
  server = require("http").createServer(app);
  server.listen(done);
});

afterAll((done) => {
  server.close(done);
});

describe("API Gateway Routes", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("POST /api/v1/detect should forward the request to the detector service", async () => {
    const mockResponse = { data: { result: "detection successful" } };
    axios.post.mockResolvedValue(mockResponse);

    const response = await request(server)
      .post("/api/v1/detect")
      .attach("image", Buffer.from("fake-image-data"), "test.jpg");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockResponse.data);

    expect(axios.post).toHaveBeenCalledTimes(1);
    const axiosCall = axios.post.mock.calls[0];
    expect(axiosCall[0]).toBe(config.serviceUrls.yoloDetector);
    expect(axiosCall[1]).toBeInstanceOf(FormData);
    expect(axiosCall[2]).toHaveProperty("headers");
  });

  test("POST /api/v1/scan should forward the request to the scanner service", async () => {
    const mockResponse = { data: { result: "scan successful" } };
    axios.post.mockResolvedValue(mockResponse);

    const response = await request(server)
      .post("/api/v1/scan")
      .attach("image", Buffer.from("fake-image-data"), "test.png");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockResponse.data);

    expect(axios.post).toHaveBeenCalledTimes(1);
    const axiosCall = axios.post.mock.calls[0];
    expect(axiosCall[0]).toBe(config.serviceUrls.ocr);
    expect(axiosCall[1]).toBeInstanceOf(FormData);
    expect(axiosCall[2]).toHaveProperty("headers");
  });

  test("POST /api/v1/transcribe should forward the request to the transcriber service", async () => {
    const mockResponse = { data: { result: "transcription successful" } };
    axios.post.mockResolvedValue(mockResponse);

    const response = await request(server)
      .post("/api/v1/transcribe")
      .attach("audio", Buffer.from("fake-audio-data"), "test.mp3");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockResponse.data);

    expect(axios.post).toHaveBeenCalledTimes(1);
    const axiosCall = axios.post.mock.calls[0];
    expect(axiosCall[0]).toBe(config.serviceUrls.voiceTranscriber);
    expect(axiosCall[1]).toBeInstanceOf(FormData);
    expect(axiosCall[2]).toHaveProperty("headers");
  });

  test("POST /api/v1/detect without a file should return 400", async () => {
    const response = await request(server).post("/api/v1/detect");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("File image tidak ditemukan.");
  });
});
