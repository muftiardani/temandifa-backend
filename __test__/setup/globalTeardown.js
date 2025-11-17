const path = require("path");
const fs = require("fs");

const globalConfigPath = path.join(__dirname, "globalConfig.json");

module.exports = async () => {
  if (global.__MONGOD__) {
    await global.__MONGOD__.stop();
  }

  if (fs.existsSync(globalConfigPath)) {
    fs.unlinkSync(globalConfigPath);
  }
};
