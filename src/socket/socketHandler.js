const jwt = require("jsonwebtoken");
const logger = require("../config/logger");

const userSocketMap = new Map();

const initializeSocket = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error: Token not provided."));
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return next(new Error("Authentication error: Invalid token."));
      }
      socket.user = { id: decoded.id };
      next();
    });
  });

  io.on("connection", (socket) => {
    logger.info(
      `User terhubung via WebSocket: ${socket.user.id} dengan socket ID: ${socket.id}`
    );
    userSocketMap.set(socket.user.id, socket.id);

    socket.on("cancel-call", ({ callId }) => {
      logger.info(`Panggilan ${callId} dibatalkan oleh ${socket.user.id}`);
    });

    socket.on("decline-call", ({ callId, callerId }) => {
      const callerSocketId = userSocketMap.get(callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit("call-declined");
        logger.info(
          `Panggilan ${callId} ditolak, notifikasi dikirim ke penelepon ${callerId}`
        );
      }
    });

    socket.on("end-call", ({ callId, peerId }) => {
      const peerSocketId = userSocketMap.get(peerId);
      if (peerSocketId) {
        io.to(peerSocketId).emit("call-ended");
        logger.info(
          `Panggilan ${callId} diakhiri, notifikasi dikirim ke ${peerId}`
        );
      }
    });

    socket.on("disconnect", () => {
      logger.info(`User terputus dari WebSocket: ${socket.user.id}`);
      userSocketMap.delete(socket.user.id);
    });
  });
};

module.exports = {
  initializeSocket,
};
