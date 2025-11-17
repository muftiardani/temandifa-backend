const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const globalConfigPath = path.join(__dirname, "globalConfig.json");

const { mongoUri } = JSON.parse(fs.readFileSync(globalConfigPath, "utf-8"));

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany();
  }
});

afterAll(async () => {
  await mongoose.disconnect();
});
