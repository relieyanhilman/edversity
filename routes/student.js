module.exports = function (app, pool, catchAsync, bcrypt, passport) {
  //halaman utama
  app.get('/', (req, res) => {
    res.render('main-page');
  });

  //form register student
  app.get('/registerStudent', (req, res) => {
    res.render('student/register-pelajar');
  });

  //form login student
  app.get('/loginStudent', (req, res) => {
    res.render('student/login-pelajar');
  });

  //isLoggedIn? student
  function isLoggedInStudent(req, res, next) {
    if (!req.isAuthenticated()) {
      // req.session.kembaliKe = req.originalUrl;
      req.flash('error', 'anda harus login dulu');
      return res.redirect('/loginStudent');
    }
    next();
  }

  //dashboard student
  app.get(
    '/dashboardStudent',
    isLoggedInStudent,
    catchAsync(async (req, res) => {
      // pool.query(
      //   ``,
      //   [req.params.id]
      //   )
      // console.log(req.user);
      res.render('student/home');
    })
  );

  //post register student
  app.post(
    '/registerStudent',
    catchAsync(async (req, res) => {
      const { nama_lengkap, email, password, asal_sekolah, angkatan, jenjang } =
        req.body;

      let hashedPassword = await bcrypt.hash(password, 10);

      const rowsSelect = await pool.query(
        `SELECT * FROM student
      WHERE email = $1`,
        [email]
      );

      if (rowsSelect.rows.length > 0) {
        req.flash('error', 'email sudah digunakan');
        res.redirect('/registerStudent');
      } else {
        const rowsInsert = await pool.query(
          `INSERT INTO student(nama_lengkap, email, password, asal_sekolah, angkatan, jenjang)
        VALUES($1, $2, $3, $4, $5, $6)
        RETURNING email, password`,
          [nama_lengkap, email, hashedPassword, asal_sekolah, angkatan, jenjang]
        );
        // console.log(rowsInsert.rows[0]);
        req.flash('success', 'kamu sudah terdaftar, silakan login');
        res.redirect('/loginStudent');
      }
    })
  );

  //post login student
  app.post(
    '/loginStudent',
    passport.authenticate('localStudent', {
      successRedirect: '/dashboardStudent',
      failureRedirect: '/loginStudent',
      failureFlash: true,
    })
  );

  //edpedia comingsoon
  app.get('/edpedia-comingsoon', isLoggedInStudent, (req, res) => {
    res.render('student/edpedia');
  });

  app.get('/buka-kelas', (req, res) => {
    res.render('student/bukakelas-pelajar');
  });

  app.get('/request-kelas', (req, res) => {
    res.render('student/requestkelas');
  });

  app.post(
    '/',
    catchAsync(async (req, res) => {})
  );
};
