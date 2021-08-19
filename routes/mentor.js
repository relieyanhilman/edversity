module.exports = function (app, pool, catchAsync, bcrypt, passport) {
  //form login mentor
  app.get('/loginMentor', (req, res) => {
    res.render('mentor/login-mentor');
  });

  //post register mentor
  app.post(
    '/registerMentor',
    catchAsync(async (req, res) => {
      const { nama_lengkap, jurusan, username, email, password } = req.body;

      let hashedPassword = await bcrypt.hash(password, 10);

      const rowsSelect = await pool.query(
        `SELECT * FROM mentor
      WHERE email = $1`,
        [email]
      );

      if (rowsSelect.rows.length > 0) {
        req.flash('error', 'email sudah digunakan');
        res.redirect('/'); //kalo harusnya direct ke '/registerMentor'
      } else {
        const rowsInsert = await pool.query(
          `INSERT INTO mentor(nama_lengkap, jurusan, username, email, password)
        VALUES($1, $2, $3, $4, $5)
        RETURNING email, password`,
          [nama_lengkap, jurusan, username, email, hashedPassword]
        );
        console.log(rowsInsert.rows[0]);
        req.flash('success', 'kamu sudah terdaftar, silakan login');
        res.redirect('/loginMentor');
      }
    })
  );

  //post login mentor
  app.post(
    '/loginMentor',
    passport.authenticate('localMentor', {
      successRedirect: '/dashboardMentor',
      failureRedirect: '/loginMentor',
      failureFlash: true,
    })
  );

  //dashboard mentor
  app.get('/dashboardMentor', isLoggedInMentor, (req, res) => {
    res.render('mentor/home-mentor');
  });

  //Check authentikasi mentor
  function isLoggedInMentor(req, res, next) {
    if (!req.isAuthenticated()) {
      req.flash('error', 'anda harus login dulu');
      return res.redirect('/loginMentor');
    }
    next();
  }
};
