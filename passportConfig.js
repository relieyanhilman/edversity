const LocalStrategy = require('passport-local').Strategy;
const pool = require('./db');
const bcrypt = require('bcrypt');
const passport = require("passport");

//FOR STUDENT

passport.use('localStudent', new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  function(username, password, done) {
    pool.query(
      `SELECT * FROM student WHERE email = $1`,
      [username],
      (err, result) => {
        
        if (err) {
          throw err;
        }
        
        if (result.rows.length > 0) {
          const user = result.rows[0];

          bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
              throw err;
            }

            if (isMatch) {
              // console.log(user);
              return done(null, user);
            } else {
              return done(null, false, {
                message: 'Email atau password salah',
              });
            }
          });
        } else {
          return done(null, false, { message: 'Email tidak terdaftar' });
        }
      }
    );
  }
));

//FOR MENTOR

passport.use('localMentor', new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  function(username, password, done) {
    pool.query(
      `SELECT * FROM mentor WHERE email = $1`,
      [username],
      (err, result) => {
        if (err) {
          throw err;
        }

        if (result.rows.length > 0) {
          const user = result.rows[0];

          bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
              throw err;
            }

            if (isMatch) {
              // console.log(user);
              return done(null, user);
            } else {
              return done(null, false, {
                message: 'Email atau password salah',
              });
            }
          });
        } else {
          return done(null, false, { message: 'Email tidak terdaftar' });
        }
      }
    );
  }
));

passport.serializeUser((user, done) =>{
    // console.log('Serializing...');
    // console.log(user);
    return done(null, {
      id: (typeof user.is_active !== 'undefined') ? user.mentor_id : user.student_id,
      role: (typeof user.is_active !== 'undefined') ? 'mentor' : 'student'
    })
});

passport.deserializeUser((user, done) => {
  // console.log(user);
  pool.query(
    `SELECT * FROM ${user.role} WHERE ${user.role === 'mentor' ? 'mentor_id' : 'student_id'} = $1`,
    [user.id],
    (err, result) => {
      if (err) {
        throw err;
      }
      loggedInUser = result.rows[0];
      loggedInUser.role = user.role

      // console.log('Deserializing...');
      // console.log(loggedInUser);
      
      return done(null, loggedInUser);
    }
  );
});
