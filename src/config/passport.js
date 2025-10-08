const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../api/v1/models/User");

module.exports = function (passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/api/v1/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        const newUser = {
          googleId: profile.id,
          username:
            profile.displayName.replace(/\s+/g, "").toLowerCase() +
            Math.floor(Math.random() * 1000),
          email: profile.emails[0].value,
        };

        try {
          let user = await User.findOne({ googleId: profile.id });

          if (user) {
            done(null, user);
          } else {
            user = await User.findOne({ email: profile.emails[0].value });
            if (user) {
              return done(
                new Error(
                  "Email ini sudah terdaftar. Silakan login dengan cara lain."
                ),
                null
              );
            }
            user = await User.create(newUser);
            done(null, user);
          }
        } catch (err) {
          console.error(err);
          done(err, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};
