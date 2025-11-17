const { MongoMemoryServer } = require("mongodb-memory-server");
const path = require("path");
const fs = require("fs");

const mongod = MongoMemoryServer.create();
const globalConfigPath = path.join(__dirname, "globalConfig.json");

module.exports = async () => {
  const instance = await mongod;
  const uri = instance.getUri();

  fs.writeFileSync(globalConfigPath, JSON.stringify({ mongoUri: uri }));

  process.env.NODE_ENV = "development";

  process.env.MONGO_URI = uri;
  process.env.REDIS_URI = "redis://dummy-redis:6379";

  process.env.JWT_SECRET = "dummy_jwt_secret_for_testing";
  process.env.JWT_REFRESH_SECRET = "dummy_jwt_refresh_secret_for_testing";

  process.env.GOOGLE_CLIENT_ID = "dummy-google-client-id";
  process.env.GOOGLE_ANDROID_CLIENT_ID = "dummy-google-android-id";
  process.env.GOOGLE_IOS_CLIENT_ID = "dummy-google-ios-id";

  process.env.AGORA_APP_ID = "dummy-agora-app-id";
  process.env.AGORA_APP_CERTIFICATE = "dummy-agora-certificate";

  process.env.EMAIL_HOST = "dummy-smtp.host.com";
  process.env.EMAIL_USER = "dummy@user.com";
  process.env.EMAIL_PASS = "dummy_password";

  global.__MONGOD__ = instance;
};
