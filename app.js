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

const {
  initializeStudent: initializePassportStudent,
  initializeMentor: initializePassportMentor,
} = require("./passportConfig");
const { query } = require("express");

initializePassportStudent(passport);
initializePassportMentor(passport);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
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

//halaman utama
app.get("/", (req, res) => {
  res.render("main-page");
});

//form register student
app.get("/register-student", (req, res) => {
  res.render("student/register-pelajar");
});

//form login student
app.get("/login-student", (req, res) => {
  res.render("student/login-pelajar");
});

//isLoggedIn? student
function isLoggedInStudent(req, res, next) {
  if (!req.isAuthenticated()) {
    // req.session.kembaliKe = req.originalUrl;
    req.flash("error", "anda harus login dulu");
    return res.redirect("/login-student");
  }
  next();
}

//dashboard student
app.get(
  "/dashboard-student",
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    //nanti isi routing isLoggedInStudent abis /dashboard-student
    console.log(req.user);
    const currentUser = req.user;

    const courseInfoRaw = await pool.query(`SELECT * FROM course`);

    const courseInfo = courseInfoRaw.rows;

    res.render("student/home", { currentUser, courseInfo });
  })
);

//student form mengubah profile
app.get(
  "/dashboard-student/profile/:id",
  catchAsync(async (req, res) => {
    //nnti isiin middleware isLoggedInStudent
    const { id } = req.params;

    const profileDataRaw = await pool.query(
      `SELECT * FROM student WHERE student_id = $1`,
      [id]
    );

    const profileData = profileDataRaw.rows[0];

    res.render("student/option", { profileData });
  })
);

//student mengubah profile
app.put(
  "/dashboard-student/profile/:id",
  catchAsync(async (req, res) => {
    //nnti isiin middleware isLoggedInStudent
    const id = parseInt(req.params.id);
    const { nama_lengkap, username, no_handphone, email } = req.body;

    const updatedProfile = await pool.query(
      "UPDATE student SET nama_lengkap=$1, username=$2, no_handphone=$3, email=$4 WHERE student_id=$5",
      [nama_lengkap, username, no_handphone, email, id]
    );

    // req.flash('success', 'Data profile berhasil di-update');
    res.redirect(`/dashboard-student`);
  })
);

app.get(
  "/dashboard-student/edwallet/:id",
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const currentUserRaw = await pool.query(
      `SELECT * FROM student WHERE student_id = $1`,
      [id]
    );

    const currentUser = currentUserRaw.rows[0];

    res.render("edwallet", { currentUser });
  })
);

//student pusat bantuan
app.get(
  "/dashboard-student/profile/:id/pusat-bantuan",
  catchAsync(async (req, res) => {
    //nnti isiin middleware isLoggedInStudent
    const { id } = req.params;
    const profileDataRaw = await pool.query(
      `SELECT * FROM student WHERE student_id = $1`,
      [id]
    );

    const profileData = profileDataRaw.rows[0];

    res.render("student/pusat-bantuan", { profileData });
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
      req.flash("error", "email sudah digunakan");
      res.redirect("/register-student");
    } else {
      const rowsInsert = await pool.query(
        `INSERT INTO student(nama_lengkap, email, password, asal_sekolah, angkatan, jenjang)
        VALUES($1, $2, $3, $4, $5, $6)
        RETURNING email, password`,
        [nama_lengkap, email, hashedPassword, asal_sekolah, angkatan, jenjang]
      );
      // console.log(rowsInsert.rows[0]);
      req.flash("success", "kamu sudah terdaftar, silakan login");
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
app.get("/logout-student", (req, res) => {
  req.logout();
  console.log("udah sampai sini");
  res.redirect("/login-student");
});

//edpedia comingsoon
app.get(
  "/edpedia-comingsoon/:id",
  catchAsync(async (req, res) => {
    //nnti isiin middleware isLoggedInStudent
    const { id } = req.params;

    const currentUserRaw = await pool.query(
      `SELECT * FROM student WHERE student_id = $1`,
      [id]
    );

    const currentUser = currentUserRaw.rows[0];

    res.render("student/edpedia", { currentUser });
  })
);

app.get(
  "/buka-kelas/:id",
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const currentUserRaw = await pool.query(
      `SELECT * FROM student WHERE student_id = $1`,
      [id]
    );

    const currentUser = currentUserRaw.rows[0];

    res.render("student/bukakelas-pelajar", { currentUser });
  })
);

app.get("/request-kelas", (req, res) => {
  res.render("student/requestkelas");
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
    res.redirect("/dashboard-student");
  })
);

app.get("/kelas", (req, res) => {});

//MENTOR

//form login mentor
app.get("/login-mentor", (req, res) => {
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
      req.flash("error", "email sudah digunakan");
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
    successRedirect: "/dashboard-mentor/",
    failureRedirect: "/login-mentor",
    failureFlash: true,
  })
);

//dashboard mentor

//role 2
//get		detail-kelas			/dashboard-mentor/:id/detail-kelas/:kelasId
//post	daftar-mentor-kelas		/dashboard-mentor/:id/detail-kelas/:kelasId

//get		render-edpedia-comingsoon	/edpedia-comingsoon/:id   DONE!!

//get		render-pusat-bantuan		/dashboard-mentor/profile/:id/pusat-bantuan DONE

//get		logout				/logout-mentor
//get		render-dashboard 		/dashboard-mentor/:id

//////////////////////////////
//detail kelas
app.get("/dashboard-mentor/:id/detail-kelas/:kelasId", (req, res) => {
  res.send("ini udah di detail-kelas");

  // res.render("");
});

//daftar mentor kelas
app.post("/dashboard-mentor/:id/detail-kelas/:kelasId", (req, res) => {
  res.send("ini buat post detail-kelas");
});

//page edpedia
app.get("/dashboard-mentor/:id/edpedia-comingsoon", catchAsync(async(req, res) => {
  // res.send("ini buat render-edpedia-comingsoon");
  const {id} = req.params;

  const currentUserRaw = await pool.query(
    `SELECT * FROM mentor WHERE mentor_id = $1`, [id]
  )

  const currentUser = currentUserRaw.rows[0];

  // const currentUser = req.user;
  // console.log(currentUser);
  res.render('mentor/edpedia-mentor', {currentUser});
}));

//page pusat bantuan
app.get("/dashboard-mentor/profile/:id/pusat-bantuan", catchAsync(async(req, res) => {
  const {id} = req.params;

  const currentUserRaw = await pool.query(
    `SELECT * FROM mentor WHERE mentor_id = $1`, [id]
  )
  const currentUser = currentUserRaw.rows[0];
  
  res.render('mentor/pusat-bantuan-mentor', {currentUser})

  // res.send("ini buat render pusat bantuan");
}));

//logout
app.get("/logout-mentor", (req, res) => {
  res.send("ini buat logout");
});

//render dashboard
app.get("/dashboard-mentor/:id", catchAsync(async(req, res) => {
  const {id} = req.params;

  const currentUserRaw = await pool.query(
    `SELECT * FROM mentor WHERE mentor_id = $1`, [id]
  )

  const currentUser = currentUserRaw.rows[0];

  const currentUserCourseRaw = await pool.query(
    `SELECT * FROM course WHERE mentor_id = $1 AND status = $2`, [id, 'open']
  )

  const currentUserCourse = currentUserCourseRaw.rows;

  // console.log({currentUser, currentUserCourse});
  // console.log(currentUserCourse);

  currentUserCourse.forEach(row => {
    var options1 = {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    }
    row.tanggal_kelas = row.tanggal_kelas.toLocaleString('id-ID', options1);
  });

  res.render('mentor/home-mentor', {currentUser, currentUserCourse});
}));

app.get("/dashboard-mentor", isLoggedInMentor, (req, res) => {
  console.log(req.user)
  res.render("mentor/home-mentor");
});

app.all("*", (req, res, next) => {
  next(new ExpressError("Page tidak ditemukan", 404));
});

app.use((err, req, res, next) => {
  const { statusCode = 500 } = err;
  if (!err.message) err.message = "oh no, ada yang salah bro";
  res.status(statusCode).render("error", { err });
});

//Check authentikasi mentor
function isLoggedInMentor(req, res, next) {
  if (!req.isAuthenticated()) {
    req.flash("error", "anda harus login dulu");
    return res.redirect("/login-mentor");
  }
  next();
}

app.listen(3000, () => {
  console.log("server sudah berjalan di port 3000");
});
