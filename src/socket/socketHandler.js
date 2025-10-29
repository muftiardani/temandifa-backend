const jwt = require("jsonwebtoken");
const {
  logger,
  logWithContext,
  errorWithContext,
} = require("../config/logger");

const userSocketMap = new Map();

const initializeSocket = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      errorWithContext(
        "Socket Auth Error: Token not provided",
        new Error("Token not provided"),
        null,
        { socketId: socket.id }
      );
      return next(new Error("Authentication error: Token not provided."));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        errorWithContext("Socket Auth Error: Invalid token", err, null, {
          socketId: socket.id,
        });
        return next(new Error("Authentication error: Invalid token."));
      }

      socket.user = { id: decoded.id };
      logWithContext("debug", `Socket authenticated successfully`, null, {
        userId: decoded.id,
        socketId: socket.id,
      });
      next();
    });
  });

  io.on("connection", (socket) => {
    if (!socket.user || !socket.user.id) {
      errorWithContext(
        "Socket connection error: User ID missing after authentication",
        new Error("User ID missing"),
        null,
        { socketId: socket.id }
      );
      socket.disconnect(true);
      return;
    }

    const userId = socket.user.id;
    const socketId = socket.id;

    logWithContext(
      "info",
      `User terhubung via WebSocket: ${userId} dengan socket ID: ${socketId}`,
      null
    );

    userSocketMap.set(userId, socketId);
    logWithContext("debug", `User-Socket map updated on connect`, null, {
      userId,
      socketId,
      mapSize: userSocketMap.size,
    });

    socket.on("cancel-call", ({ callId, calleeId }) => {
      logWithContext(
        "info",
        `Panggilan ${callId} dibatalkan oleh ${userId}`,
        null,
        { socketId }
      );
      if (calleeId) {
        const calleeSocketId = userSocketMap.get(calleeId);
        if (calleeSocketId) {
          io.to(calleeSocketId).emit("call-cancelled", { callId });
          logWithContext(
            "info",
            `Sent 'call-cancelled' event to callee ${calleeId}`,
            null,
            { callId }
          );
        } else {
          logWithContext(
            "warn",
            `Callee ${calleeId} not connected, cannot send 'call-cancelled'`,
            null,
            { callId }
          );
        }
      } else {
        logWithContext(
          "warn",
          `'cancel-call' event received without calleeId`,
          null,
          { userId, callId }
        );
      }
    });

    socket.on("decline-call", ({ callId, callerId }) => {
      logWithContext("debug", `Received 'decline-call' event`, null, {
        userId,
        socketId,
        callId,
        callerId,
      });
      const callerSocketId = userSocketMap.get(callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit("call-declined", { callId });
        logWithContext(
          "info",
          `Panggilan ${callId} ditolak, notifikasi dikirim ke penelepon ${callerId}`,
          null,
          { socketId: callerSocketId }
        );
      } else {
        logWithContext(
          "warn",
          `Caller ${callerId} not connected, cannot send 'call-declined'`,
          null,
          { callId }
        );
      }
    });

    socket.on("end-call", ({ callId, peerId }) => {
      logWithContext("debug", `Received 'end-call' event`, null, {
        userId,
        socketId,
        callId,
        peerId,
      });
      const peerSocketId = userSocketMap.get(peerId);
      if (peerSocketId) {
        io.to(peerSocketId).emit("call-ended", { callId });
        logWithContext(
          "info",
          `Panggilan ${callId} diakhiri, notifikasi dikirim ke ${peerId}`,
          null,
          { socketId: peerSocketId }
        );
      } else {
        logWithContext(
          "warn",
          `Peer ${peerId} not connected, cannot send 'call-ended'`,
          null,
          { callId }
        );
      }
    });

    socket.on("disconnect", (reason) => {
      logWithContext("info", `User terputus dari WebSocket: ${userId}`, null, {
        socketId,
        reason,
      });
      if (userSocketMap.get(userId) === socketId) {
        userSocketMap.delete(userId);
        logWithContext(
          "debug",
          `User-Socket map updated after disconnect`,
          null,
          { userId, socketId, mapSize: userSocketMap.size }
        );
      } else {
        logWithContext(
          "debug",
          `User ${userId} disconnected with an old/different socket ID (${socketId}), map not changed.`,
          null
        );
      }
    });

    socket.on("error", (error) => {
      errorWithContext("Socket error occurred", error, null, {
        userId,
        socketId,
      });
    });
  });

  io.on("error", (error) => {
    errorWithContext("Socket.IO server error occurred", error, null);
  });

  logWithContext("info", "Socket.IO initialized successfully.", null);
};

module.exports = {
  initializeSocket,
  userSocketMap,
};
