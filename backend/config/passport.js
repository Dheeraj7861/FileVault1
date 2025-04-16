const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const { ExtractJwt } = require('passport-jwt');
const User = require('../models/user.model');

// JWT token extraction options
const options = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
};

// Configure JWT strategy
passport.use(
  new JwtStrategy(options, async (payload, done) => {
    try {
      // Find the user based on the token payload
      const user = await User.findById(payload.id);
      
      if (!user) {
        return done(null, false);
      }
      
      // Return the user without password
      return done(null, user);
    } catch (error) {
      return done(error, false);
    }
  })
);

module.exports = passport; 