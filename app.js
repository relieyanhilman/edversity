const express = require("express");
const app = express();
const pool = require("./db");
const path = require("path");
const catchAsync = require("./utils/catchAsync");
const bcrypt = require("bcrypt");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");

const initializePassport = require("./passportConfig");
initializePassport(passport);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

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

//test
app.get("/", (req, res) => {
  res.send("hallo dunia");
});

//form register
app.get("/registerStudent", (req, res) => {
  res.render("register-pelajar");
});

//form login
app.get("/loginStudent", (req, res) => {
  res.render("login-pelajar");
});

//dashboard
app.get("/dashboardStudent", isLoggedIn, (req, res) => {
  res.render("home");
});


//post register
app.post(
  "/registerStudent",
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
      res.redirect("/registerStudent");
    } else {
      const rowsInsert = await pool.query(
        `INSERT INTO student(nama_lengkap, email, password, asal_sekolah, angkatan, jenjang)
        VALUES($1, $2, $3, $4, $5, $6)
        RETURNING email, password`,
        [nama_lengkap, email, hashedPassword, asal_sekolah, angkatan, jenjang]
      );
      console.log(rowsInsert.rows[0]);
      req.flash("success", "kamu sudah terdaftar, silakan login");
      res.redirect("/loginStudent");
    }
  })
);

//isLoggedIn?
function isLoggedIn(req,res,next) {
  if(!req.isAuthenticated()){
    // req.session.kembaliKe = req.originalUrl;
    req.flash('error', 'anda harus login dulu');
    return res.redirect('/loginStudent');
  }
  next();
}

//post login
app.post(
  "/loginStudent",
  passport.authenticate("local", {
    successRedirect: "/dashboardStudent",
    failureRedirect: "/loginStudent",
    failureFlash: true,
  })
);




app.listen(3000, () => {
  console.log("server sudah berjalan di port 3000");
});
