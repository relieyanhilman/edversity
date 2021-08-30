const express = require('express');
const app = express();
const pool = require("./db");
const path = require("path");
const catchAsync = require("./utils/catchAsync");
const bcrypt = require("bcrypt");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");

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
  initializeAdmin: initializePassportAdmin,
} = require('./passportConfig');

initializePassportStudent(passport);
initializePassportMentor(passport);
initializePassportAdmin(passport);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/public/uploads", express.static("public/uploads"));

app.use(
  session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60000 },
  })
);
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
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
    // pool.query(
    //   ``,
    //   [req.params.id]
    //   )
    // console.log(req.user);
    res.render("student/home");
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

//edpedia comingsoon
app.get("/edpedia-comingsoon", isLoggedInStudent, (req, res) => {
  res.render("student/edpedia");
});

app.get("/buka-kelas", (req, res) => {
  res.render("student/bukakelas-pelajar");
});

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
    } = req.body;

    const uploadKelas = await pool.query(
      `INSERT INTO course(program_studi, mata_kuliah, tanggal_kelas, waktu_kelas, deskripsi_materi,tipe_kelas, file_materi) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        program_studi,
        mata_kuliah,
        tanggal_kelas,
        waktu_kelas,
        deskripsi_materi,
        tipe_kelas,
        req.file.path,
      ]
    );

    // console.log(req.file);
    console.log(uploadKelas.rows[0]);
    res.send("berhasil upload");
    // console.log(req.body);
    // console.log(req.file);
    // res.send(req.body);
    //  req.flash('success', 'Course berhasil ditambahkan');
    //  res.redirect('/dashboard-student');
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
    successRedirect: "/dashboard-mentor",
    failureRedirect: "/login-mentor",
    failureFlash: true,
  })
);

//dashboard mentor
app.get("/dashboard-mentor", isLoggedInMentor, (req, res) => {
  res.render("mentor/home-mentor");
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
  console.log('server sudah berjalan di port 3000');
});
