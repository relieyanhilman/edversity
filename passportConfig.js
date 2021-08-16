const LocalStrategy = require("passport-local").Strategy;
const  pool  = require("./db");
const bcrypt = require("bcrypt");

function initialize(passport) {
  const authenticateUser = (email, password, done) => {
    pool.query(
      `SELECT * FROM student WHERE email = $1`,
      [email],
      (err, result) => {
        if (err) {
          throw err;
        }
        

        if (result.rows.length > 0) {
          const studentUser = result.rows[0];

          bcrypt.compare(password, studentUser.password, (err, isMatch) => {
            if (err) {
              throw err;
            }

            if (isMatch) {
              return done(null, studentUser);
            } else {
              return done(null, false, {
                message: "Email atau password salah",
              });
            }
          });
        } else {
          return done(null, false, { message: "Email tidak terdaftar" });
        }
      }
    );
  };

  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      authenticateUser
      // (err, user, done) => {
      //   if (err){
      //     return done(err);
      //   }
      // }
    )
  );

  passport.serializeUser((studentUser, done) =>
    done(null, studentUser.student_id)
  );

  passport.deserializeUser((student_id, done) => {
    pool.query(
      `SELECT * FROM student WHERE student_id = $1`,
      [student_id],
      (err, result) => {
        if (err) {
          throw err;
        }
        return done(null, result.rows[0]);
      }
    );
  });
}

module.exports = initialize;
