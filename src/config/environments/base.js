module.exports = {
  port: 3000,
  metricsPort: 9100,

  jwt: {
    expiresIn: "15m",
    refreshExpiresIn: "7d",
  },

  email: {
    port: 587,
    secure: false,
    from: "no-reply@yourdomain.com",
    fromName: "TemanDifa App",
    resetPasswordTokenExpireMinutes: 10,
  },

  agora: {
    tokenExpirationSeconds: 3600,
  },

  rateLimit: {
    generalWindowMs: 15 * 60 * 1000,
    generalMax: 100,
    authWindowMs: 15 * 60 * 1000,
    authMax: 10,
  },

  call: {
    ringingTtlSeconds: 60,
    activeTtlSeconds: 3600 * 2,
  },

  upload: {
    maxFileSizeMb: 25,
    maxFileSizeBytes: 25 * 1024 * 1024,
  },
};
