require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const passport = require("passport");

const routes = require("./src/api/v1/routes");
const errorHandler = require("./src/middleware/errorHandler");
const logger = require("./src/config/logger");
const connectDB = require("./src/config/db");
const socketHandler = require("./src/socket/socketHandler");

require("./src/config/passport")(passport);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

connectDB();

app.use(cors());

app.use(helmet());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(passport.initialize());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message:
    "Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit.",
});
app.use(limiter);

socketHandler(io);

app.use("/api/v1", routes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server berjalan di port ${PORT}`);
});

module.exports = app;
