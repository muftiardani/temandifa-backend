module.exports = {
  setupFilesAfterEnv: ["./__test__/setup/jest.env.js"],

  globalSetup: "./__test__/setup/globalSetup.js",
  globalTeardown: "./__test__/setup/globalTeardown.js",

  testEnvironment: "node",

  transformIgnorePatterns: [
    "/node_modules/(?!express-request-id|uuid)/",
    "\\.pnp\\.[^\\/]+$",
  ],
};
