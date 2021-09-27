const express = require("express");
const app = express();
const pool = require("./db");
const path = require("path");
const catchAsync = require("./utils/catchAsync");
const prettyDate2 = require("./utils/prettyDate2");
const bcrypt = require("bcrypt");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const ExpressError = require("./utils/ExpressError");
const methodOverride = require("method-override");

const multer = require("multer");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "application/pdf"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 30 },
  fileFilter: fileFilter,
});

require("./passportConfig");
const { query } = require("express");

// initializePassportStudent(passport);
// initializePassportMentor(passport);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/public/uploads", express.static("public/uploads"));
app.use(methodOverride("_method"));

app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60000 },
  })
);
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

//STUDENT

//isLoggedIn? student
function isLoggedInStudent(req, res, next) {
  if (!req.isAuthenticated() || req.user.role != 'student') {
    // req.session.kembaliKe = req.originalUrl;
    req.flash("error", "Anda harus login terlebih dahulu!");
    return res.redirect("/login-student");
  }
  next();
}

//isNotLoggedIn? student
function isNotLoggedInStudent(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard-student');
  }
  next();
}

//halaman utama
app.get("/", (req, res) => {
  if(!req.isAuthenticated()) res.render("main-page");
  else{
    if(req.user.role == 'student') res.redirect('/dashboard-student');
    if(req.user.role == 'mentor') res.redirect('/dashboard-mentor');
  }
});

//form register student
app.get("/register-student",
  isNotLoggedInStudent,
  (req, res) => {
    res.render("student/register");
  }
);

//form login student
app.get("/login-student",
  isNotLoggedInStudent,
  (req, res) => {
    res.render("student/login");
  }
);

//dashboard student
app.get(
  "/dashboard-student",
  isLoggedInStudent,
  catchAsync(async (req, res) => {

    const courseInfoRaw = await pool.query(`SELECT * FROM course WHERE status = 'open' AND tipe_kelas = 'public'`);
    var courseInfo = courseInfoRaw.rows;

    for await (let course of courseInfo) {
      course.tanggal_kelas = course.tanggal_kelas.toLocaleString('id-ID', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
      });
      course.waktu_kelas = course.waktu_kelas[0]+''+course.waktu_kelas[1]+':'+course.waktu_kelas[3]+''+course.waktu_kelas[4];

      var mentor = await pool.query(`SELECT nama_lengkap FROM mentor WHERE mentor_id = $1`, [course.mentor_id]);
      course.nama_mentor = mentor.rows[0].nama_lengkap;
    }

    res.render("student/home", { currentUser: req.user, courseInfo });
  })
);

//student form mengubah profile
app.get(
  "/dashboard-student/profile",
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    res.render("student/option", { profileData: req.user });
  })
);

//student mengubah profile
app.put(
  "/dashboard-student/profile/:id",
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    // res.send(req.body);
    const id = req.user.student_id;
    const { nama_lengkap, username, no_handphone, email } = req.body;

    const updatedProfile = await pool.query(
      `UPDATE student SET nama_lengkap=$1, username=$2, no_handphone=$3, email=$4 WHERE student_id=$5`,
      [nama_lengkap, username, no_handphone, email, id]
    );

    // req.flash('success', 'Data profile berhasil di-update');
    res.redirect(`/dashboard-student/profile`);
  })
);

app.get(
  "/dashboard-student/edwallet",
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    res.render("student/edwallet");
  })
);

//student pusat bantuan
app.get(
  "/dashboard-student/profile/pusat-bantuan",
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    res.render("student/pusat-bantuan", { profileData: req.user });
  })
);

//post register student
app.post(
  "/register-student",
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
      req.flash("error", "E-mail sudah digunakan!");
      res.redirect("/register-student");
    } else {
      const rowsInsert = await pool.query(
        `INSERT INTO student(nama_lengkap, email, password, asal_sekolah, angkatan, jenjang)
        VALUES($1, $2, $3, $4, $5, $6)
        RETURNING email, password`,
        [nama_lengkap, email, hashedPassword, asal_sekolah, angkatan, jenjang]
      );
      // console.log(rowsInsert.rows[0]);
      req.flash("success", "Anda sudah terdaftar, silakan login");
      res.redirect("/login-student");
    }
  })
);

//post login student
app.post(
  "/login-student",
  passport.authenticate("localStudent", {
    successRedirect: "/dashboard-student",
    failureRedirect: "/login-student",
    failureFlash: true,
  })
);

// app.get('/login-student', function(req, res, next) {
//   passport.authenticate('LocalStudent', function(err, user, info) {
//     if (err) { return next(err); }
//     if (!user) { return res.redirect('/login-student'); }
//     req.logIn(user, function(err) {
//       if (err) { return next(err); }
//       const currentUser = req.user
//       console.log(currentUser)
//       // return res.redirect(`/dashboard-student/${currentUser.student_id}`);
//     });
//   })(req, res, next);
// });

//post logout student
app.post("/logout-student",
  isLoggedInStudent,
  (req, res) => {
    req.logout();
    console.log("udah sampai sini");
    res.redirect("/login-student");
  }
);

//edpedia comingsoon
app.get(
  "/edpedia",
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    res.render("student/edpedia");
  })
);

app.get(
  "/buka-kelas",
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    res.render("student/buka-kelas", { currentUser: req.user });
  })
);

app.get("/request-kelas", (req, res) => {
  isLoggedInStudent,
  res.render("student/request-kelas");
});

app.post(
  "/request-kelas",
  upload.single("file_materi"),
  catchAsync(async (req, res) => {
    const {
      program_studi,
      mata_kuliah,
      tanggal_kelas,
      waktu_kelas,
      deskripsi_materi,
      tipe_kelas,
      paket,
    } = req.body;

    const uploadKelas = await pool.query(
      `INSERT INTO course(program_studi, mata_kuliah, tanggal_kelas, waktu_kelas, deskripsi_materi,tipe_kelas, file_materi, paket) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        program_studi,
        mata_kuliah,
        tanggal_kelas,
        waktu_kelas,
        deskripsi_materi,
        tipe_kelas,
        req.file.path,
        paket,
      ]
    );
    
    req.flash("success", "berhasil upload kelas");
    res.redirect("/request-kelas"); //nanti ini dipindahin aja lagi routenya ke /dashboard-student
  })
);

app.get("/kelas", (req, res) => {});

//MENTOR


// isLoggedIn? mentor
function isLoggedInMentor(req, res, next) {
  if (!req.isAuthenticated()) {
    req.flash("error", "Anda harus login terlebih dahulu!");
    return res.redirect("/login-mentor");
  }
  next();
}

// isNotLoggedIn? mentor
function isNotLoggedInMentor(req, res, next) {
  if (req.isAuthenticated() && req.user.role == 'mentor') {
    return res.redirect("/dashboard-mentor");
  } 
  next();
}

// isNot? mentor
function isMentor(req, res, next) {
  if (req.isAuthenticated() && req.user.role != 'mentor') {
    return res.status(404).redirect("/dashboard-student");
  } 
  next();
}

//form login mentor
app.get("/login-mentor", isNotLoggedInMentor, isMentor, (req, res) => {
  res.render("mentor/login-mentor");
});

//post register mentor
app.post(
  "/register-mentor",
  catchAsync(async (req, res) => {
    const { nama_lengkap, jurusan, username, email, password } = req.body;

    // res.send(req.body);
    let hashedPassword = await bcrypt.hash(password, 10);

    const rowsSelect = await pool.query(
      `SELECT * FROM mentor
      WHERE email = $1`,
      [email]
    );

    if (rowsSelect.rows.length > 0) {
      req.flash("error", "E-mail sudah digunakan!");
      res.redirect("/"); //kalo harusnya direct ke '/registerMentor'
    } else {
      const rowsInsert = await pool.query(
        `INSERT INTO mentor(nama_lengkap, jurusan, username, email, password)
        VALUES($1, $2, $3, $4, $5)
        RETURNING email, password`,
        [nama_lengkap, jurusan, username, email, hashedPassword]
      );
      console.log(rowsInsert.rows[0]);
      req.flash("success", "kamu sudah terdaftar, silakan login");
      res.redirect("/login-mentor");
    }
  })
);

//post login mentor
app.post(
  "/login-mentor",
  passport.authenticate("localMentor", {
    successRedirect: "/dashboard-mentor",
    failureRedirect: "/login-mentor",
    failureFlash: true,
  })
);

// render dashboard

app.get("/dashboard-mentor", isLoggedInMentor, isMentor, async (req, res) => {

  var currentUser = req.user;

  const currentUserCourseRaw = await pool.query(
    `SELECT * FROM course WHERE mentor_id = $1 AND status = $2`, 
    [currentUser.mentor_id, 'open']
  )

  var currentUserCourse = currentUserCourseRaw.rows;

  // console.log({currentUser, currentUserCourse});
  // console.log(currentUserCourse);

  currentUserCourse.forEach(row => {
    row.tanggal_kelas = row.tanggal_kelas.toLocaleString('id-ID', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  });

  res.render('mentor/home-mentor', {currentUser, currentUserCourse});
});


//page edpedia
app.get("/edpedia-mentor", isLoggedInMentor, isMentor, catchAsync(async(req, res) => {
  res.render('mentor/edpedia-mentor', {currentUser: req.user});
}));

//page edwallet
app.get("/edwallet-mentor", isLoggedInMentor, isMentor, catchAsync(async(req, res) => {
  res.render('mentor/edwallet-mentor', {currentUser: req.user});
}));

//role 2
//get		detail-kelas			/dashboard-mentor/:id/detail-kelas/:kelasId //DONE!!
//post	daftar-mentor-kelas		/dashboard-mentor/:id/detail-kelas/:kelasId

//get		render-edpedia-comingsoon	/edpedia-comingsoon/:id   DONE!!

//get		render-pusat-bantuan		/dashboard-mentor/profile/:id/pusat-bantuan DONE!!

//get		logout				/logout-mentor
//get		render-dashboard 		/dashboard-mentor/:id

//////////////////////////////


//detail kelas
app.get("/dashboard-mentor/detail-kelas/:kelasId", isLoggedInMentor, isMentor, catchAsync(async(req, res) => {
  const {kelasId} = req.params;

  const currentKelasRaw = await pool.query(
    `SELECT * FROM course WHERE course_id = $1`, [kelasId]
  )

  const peserta_kelasRaw = await pool.query(
    `SELECT nama_lengkap FROM student_course JOIN student on student_course.student_id = student.student_id WHERE student_course.course_id = $1`, [kelasId]
  );
  
  //formatting tanggal jadi tanggal nama bulan dan tahun
    var options1 = {
        year: 'numeric', month: 'long', day: 'numeric'
    }
    currentKelas.tanggal_kelas = currentKelas.tanggal_kelas.toLocaleString('id-ID', options1);

    var time = currentKelas.waktu_kelas;
    
    let waktu_kelas = time[0]+''+time[1]+':'+time[3]+''+time[4];
    
    
  
  res.render("mentor/info-kelas-mentor", {
    currentUser: req.user, 
    currentKelas: currentKelasRaw.rows[0], 
    peserta_kelas: peserta_kelasRaw.rows, 
    waktu_kelas
  });
}));


//halaman khusus list siswa dalam kelas 
app.get('/dashboard-mentor/detail-kelas/:kelasId/daftar-siswa',
  isLoggedInMentor,
  isMentor,
  catchAsync(async(req, res) => {
    const {kelasId} = req.params;

    const currentKelasRaw = await pool.query(
      `SELECT * FROM course WHERE course_id = $1`, [kelasId]
    )

    const peserta_kelasRaw = await pool.query(
      `SELECT nama_lengkap FROM student_course JOIN student on student_course.student_id = student.student_id WHERE student_course.course_id = $1`, [kelasId]
    );

    res.render('mentor/info-kelas_daftar-siswa', {
      currentUser: req.user, 
      currentKelas: currentKelasRaw.rows[0], 
      peserta_kelas: peserta_kelasRaw.rows
    });
  }
))

//daftar mentor kelas
app.post("/dashboard-mentor/:id/detail-kelas/:kelasId", (req, res) => {
  res.send("ini buat post detail-kelas");
});


// page profile mentor
app.get("/dashboard-mentor/profile",
  isLoggedInMentor,
  isMentor, 
  (req, res) => {
    res.render('mentor/option-mentor', {currentUser: req.user})
  }
);

// update profile mentor
app.put(
  "/dashboard-mentor/profile/:id",
  isLoggedInMentor,
  catchAsync(async (req, res) => {
    const id = req.user.mentor_id;
    const { nama_lengkap, no_handphone, email } = req.body;

    const updatedProfile = await pool.query(
      `UPDATE mentor SET nama_lengkap=$1, no_handphone=$2, email=$3 WHERE mentor_id=$4`,
      [nama_lengkap, no_handphone, email, id]
    );

    // req.flash('success', 'Data profile berhasil di-update');
    res.redirect(`/dashboard-mentor/profile`);
  })
);

// page pusat bantuan
app.get("/dashboard-mentor/profile/pusat-bantuan",
  isLoggedInMentor,
  isMentor, 
  catchAsync(async(req, res) => {
    res.render('mentor/pusat-bantuan-mentor', {currentUser: req.user})
  }
));

//logout
app.post("/logout-mentor", (req, res) => {
  isLoggedInMentor,
  req.logout();
  res.redirect('/');
});

app.all("*", (req, res, next) => {
  next(new ExpressError("Page tidak ditemukan", 404));
});

app.use((err, req, res, next) => {
  const { statusCode = 500 } = err;
  if (!err.message) err.message = "oh no, ada yang salah bro";
  res.status(statusCode).render("error", { err });
});

app.listen(3000, () => {
  console.log("server sudah berjalan di port 3000");
});
