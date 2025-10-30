const jwt = require("jsonwebtoken");
const {
  logger,
  logWithContext,
  errorWithContext,
} = require("../config/logger");
const config = require("../config/appConfig");
const appEmitter = require("../events/appEmitter");

const userSocketMap = new Map();

/**
 * Menginisialisasi listener Socket.IO dan Emitter internal.
 * @param {object} io - Instance Server Socket.IO yang didapat dari index.js.
 */
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

    jwt.verify(token, config.jwt.secret, (err, decoded) => {
      if (err) {
        errorWithContext("Socket Auth Error: Invalid token", err, null, {
          socketId: socket.id,
          errorName: err.name,
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
        `[Socket] 'cancel-call' diterima dari ${userId} untuk call ${callId}`,
        null,
        { socketId, calleeId }
      );
      if (calleeId) {
        const calleeSocketId = userSocketMap.get(calleeId);
        if (calleeSocketId) {
          io.to(calleeSocketId).emit("call-cancelled", { callId });
          logWithContext(
            "info",
            `[Socket] Sent 'call-cancelled' event to callee ${calleeId}`,
            null,
            { callId }
          );
        } else {
          logWithContext(
            "warn",
            `[Socket] Callee ${calleeId} not connected, cannot send 'call-cancelled'`,
            null,
            { callId }
          );
        }
      }
    });

    socket.on("decline-call", ({ callId, callerId }) => {
      logWithContext(
        "debug",
        `[Socket] 'decline-call' diterima dari ${userId}`,
        null,
        {
          socketId,
          callId,
          callerId,
        }
      );
      const callerSocketId = userSocketMap.get(callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit("call-declined", { callId });
        logWithContext(
          "info",
          `[Socket] Sent 'call-declined' to caller ${callerId}`,
          null,
          { socketId: callerSocketId }
        );
      } else {
        logWithContext(
          "warn",
          `[Socket] Caller ${callerId} not connected, cannot send 'call-declined'`,
          null,
          { callId }
        );
      }
    });

    socket.on("end-call", ({ callId, peerId }) => {
      logWithContext(
        "debug",
        `[Socket] 'end-call' diterima dari ${userId}`,
        null,
        {
          socketId,
          callId,
          peerId,
        }
      );
      const peerSocketId = userSocketMap.get(peerId);
      if (peerSocketId) {
        io.to(peerSocketId).emit("call-ended", { callId });
        logWithContext(
          "info",
          `[Socket] Sent 'call-ended' to peer ${peerId}`,
          null,
          { socketId: peerSocketId }
        );
      } else {
        logWithContext(
          "warn",
          `[Socket] Peer ${peerId} not connected, cannot send 'call-ended'`,
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

  appEmitter.on("call:answered", ({ callId, callerId, callee }) => {
    const callerSocketId = userSocketMap.get(callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit("call-answered", { callId, callee });
      logWithContext(
        "info",
        `[Emitter] Sent 'call:answered' via socket to caller ${callerId}`,
        null,
        { callId, socketId: callerSocketId }
      );
    } else {
      logWithContext(
        "warn",
        `[Emitter] Caller socket not found for user ${callerId}, cannot emit 'call:answered'`,
        null,
        { callId }
      );
    }
  });

  appEmitter.on("call:event", ({ eventName, peerId, callId, endedBy }) => {
    const peerSocketId = userSocketMap.get(peerId);
    if (peerSocketId) {
      io.to(peerSocketId).emit(eventName, { callId, endedBy });
      logWithContext(
        "info",
        `[Emitter] Sent '${eventName}' via socket to peer ${peerId}`,
        null,
        { callId, socketId: peerSocketId, eventName }
      );
    } else {
      logWithContext(
        "warn",
        `[Emitter] Peer socket not found for user ${peerId}, cannot emit '${eventName}'`,
        null,
        { callId, eventName }
      );
    }
  });

  io.on("error", (error) => {
    errorWithContext("Socket.IO server error occurred", error, null);
  });

  logWithContext(
    "info",
    "Socket.IO initialized successfully (with Emitters).",
    null
  );
};

module.exports = {
  initializeSocket,
  userSocketMap,
};
