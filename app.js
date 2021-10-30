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
const fs = require('fs');

const multer = require("multer");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads");
  },
  filename: function (req, file, cb) {
    cb(null, path.parse(file.originalname).name + '-' + Date.now() + path.parse(file.originalname).ext);
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
    cookie: { maxAge: 7 * 24 * 3600 * 1000 },
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

    const courseInfoRaw = await pool.query(`SELECT * FROM course WHERE status = 'open' AND tipe_kelas = 'public' AND bukti_selesai IS NULL LIMIT 9`);
    var courseInfo = courseInfoRaw.rows;
    
    for await (let course of courseInfo) {
      course.tanggal_kelas = course.tanggal_kelas.toLocaleString('id-ID', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
      });
      course.waktu_kelas = course.waktu_kelas[0]+''+course.waktu_kelas[1]+':'+course.waktu_kelas[3]+''+course.waktu_kelas[4];
      
      var mentor = await pool.query(`SELECT * FROM mentor WHERE mentor_id = $1`, [course.mentor_id]);
      
      course.nama_mentor = mentor.rows[0].nama_lengkap;
      course.foto_profil_mentor = mentor.rows[0].foto_profil;
      course.program_studi = titleCase(course.program_studi);
      // console.log(mentor.rows[0])
    }
    
    const mostPopularProdiRaw = await pool.query(`
      SELECT DISTINCT LOWER(program_studi) AS program_studi, COUNT(LOWER(program_studi))
      FROM course
      WHERE tipe_kelas = 'public'
      AND bukti_selesai IS NULL
      GROUP BY program_studi
      ORDER BY COUNT(LOWER(program_studi)) DESC
      LIMIT 2
    `);
    
    var mostPopularProdi = mostPopularProdiRaw.rows;
    var prodiCourses = [];

    function titleCase(str) {
      str = str.toLowerCase().split(' ');
      for (var i = 0; i < str.length; i++) {
        if (str[i] === 'dan' || str[i] === 'atau' || str[i] === 'untuk') continue;
        str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1); 
      }
      return str.join(' ');
    }

    for await (let prodi of mostPopularProdi) {
      // console.log(prodi);
      var prodiCoursesRaw = await pool.query(`SELECT * FROM course WHERE LOWER(program_studi) = $1 AND status=$2`, [prodi.program_studi, 'open']);
      var courses = prodiCoursesRaw.rows;
      // console.log(courses);
      
      for await (let course of courses) {
        
        course.tanggal_kelas = course.tanggal_kelas.toLocaleString('id-ID', {
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
        });
        
        course.waktu_kelas = course.waktu_kelas[0]+''+course.waktu_kelas[1]+':'+course.waktu_kelas[3]+''+course.waktu_kelas[4];
        var mentor = await pool.query(`SELECT * FROM mentor WHERE mentor_id = $1`, [course.mentor_id]);
        
        course.nama_mentor = mentor.rows[0].nama_lengkap;
        
        course.foto_profil_mentor = mentor.rows[0].foto_profil;

        course.program_studi = titleCase(course.program_studi);
      };
      
      prodiCourses.push(courses);
    }

    mostPopularProdi.forEach(programStudi => programStudi.program_studi = titleCase(programStudi.program_studi));

    res.render("student/home", { currentUser: req.user, courseInfo, mostPopularProdi, prodiCourses });
  })
);

//student form mengubah profile
app.get(
  "/dashboard-student/profile",
  isLoggedInStudent,
  catchAsync(async (req, res) => {

    const kelasAktifRaw = await pool.query(
      `SELECT * FROM course JOIN student_course ON course.course_id = student_course.course_id WHERE student_course.student_id = $1 AND course.status = $2 AND course.bukti_selesai IS NULL`, [req.user.student_id, 'open']
    )

    const kelasSelesaiRaw = await pool.query(
      `SELECT * FROM course JOIN student_course ON course.course_id = student_course.course_id WHERE student_course.student_id = $1 AND course.status = $2 AND course.bukti_selesai IS NOT NULL`, [req.user.student_id, 'done']
    )

    const kelasAktif = kelasAktifRaw.rows;
    const kelasSelesai = kelasSelesaiRaw.rows;
    
    for await (let kelas of kelasAktif) {
      kelas.tanggal_kelas = kelas.tanggal_kelas.toLocaleString('id-ID', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
      });
      kelas.waktu_kelas = kelas.waktu_kelas[0]+''+kelas.waktu_kelas[1]+':'+kelas.waktu_kelas[3]+''+kelas.waktu_kelas[4];

      var mentor = await pool.query(`SELECT nama_lengkap FROM mentor WHERE mentor_id = $1`, [kelas.mentor_id]);
      kelas.nama_mentor = mentor.rows[0].nama_lengkap;
    }

    for await (let kelas of kelasSelesai) {
      kelas.tanggal_kelas = kelas.tanggal_kelas.toLocaleString('id-ID', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
      });
      kelas.waktu_kelas = kelas.waktu_kelas[0]+''+kelas.waktu_kelas[1]+':'+kelas.waktu_kelas[3]+''+kelas.waktu_kelas[4];

      var mentor = await pool.query(`SELECT nama_lengkap FROM mentor WHERE mentor_id = $1`, [kelas.mentor_id]);
      kelas.nama_mentor = mentor.rows[0].nama_lengkap;
    }

    res.render("student/option", { profileData: req.user, kelasAktif, kelasSelesai});
  })
);

//student mengubah profile
app.put(
  "/dashboard-student/profile",
  upload.single("foto_profil"),
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    try {
      const id = req.user.student_id;
      var { nama_lengkap, username, no_handphone, email } = req.body;
      nama_lengkap = nama_lengkap.trim();
      
      const usernamesRaw = await pool.query(
        `SELECT username FROM student WHERE username = $1`, [username]
      );


      if(usernamesRaw.rowCount && req.user.username != username){
        req.flash('error', 'Username sudah digunakan!');
        return res.redirect(`/dashboard-student/profile`);
      } else {
        if(req.file){
          var updatedProfile = await pool.query(
            `UPDATE student SET nama_lengkap=$1, username=$2, no_handphone=$3, email=$4, foto_profil=$5 WHERE student_id=$6`,
            [nama_lengkap, username, no_handphone, email, req.file.path, id]
          );
        } else {
          var updatedProfile = await pool.query(
            `UPDATE student SET nama_lengkap=$1, username=$2, no_handphone=$3, email=$4 WHERE student_id=$5`,
            [nama_lengkap, username, no_handphone, email, id]
          );
        }
      }
    } catch (error) {
      console.log(error)
    }

    req.flash('success', 'Data profil berhasil diperbarui!');
    res.redirect(`/dashboard-student/profile`);
  })
);

app.get(
  "/edwallet",
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    res.render("student/edwallet", {currentUser: req.user});
  })
);

app.get(
  "/edwallet/:method",
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    const {method} = req.params;
    if(method == 'gopay' || method == 'ovo' || method == 'transfer')
    res.render(`student/edwallet-${method}`, {currentUser: req.user});
  })
);

app.post(
  "/edwallet/:method",
  upload.single("bukti_transfer"),
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    
    const {method} = req.params;
    const {jumlah_koin} = req.body

    if(method == 'gopay' || method == 'ovo' || method == 'transfer'){
      try {
        var d = new Date();
        var created_at = d.getFullYear() + "-" +
        ("00" + (d.getMonth() + 1)).slice(-2) + "-" +
        ("00" + d.getDate()).slice(-2) + " " +
        ("00" + d.getHours()).slice(-2) + ":" +
        ("00" + d.getMinutes()).slice(-2) + ":" +
        ("00" + d.getSeconds()).slice(-2);

        const rowsInsert = await pool.query(
          `INSERT INTO transaction_topup(student_id, metode, jumlah_koin, nominal, is_verified, verified_by, bukti_transfer, created_at)
          VALUES($1, $2, $3, $4, $5, $6, $7, $8)`,
          [req.user.student_id, method, jumlah_koin, jumlah_koin * 1100, 0, null, req.file.path, created_at]
        );
      } catch (error){
        console.log(error);
      }

      req.flash("success", "Data top-up berhasil terkirim. Mohon tunggu proses verifikasi oleh tim ed.versity.");
      res.redirect("/dashboard-student");
    }
  })
);

app.get(
  "/edmessage",
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    try{
      const id = req.user.student_id;
  
      const coursesRaw = await pool.query(`
        SELECT * FROM course c
        WHERE 
        ((c.status = $1 AND c.tipe_kelas = $2)
        OR
        (c.status = $3 AND c.tipe_kelas = $4))
        AND c.mentor_id IS NOT NULL 
        AND c.bukti_selesai IS NULL
        AND c.student_id = $5
        AND c.tanggal_kelas >= CURRENT_DATE
        ORDER BY c.tanggal_kelas 
        `,
        [
          'pending', 'private',
          'open', 'public',
          id,
        ]
      );
      var courses = coursesRaw.rows;
      // console.log(coursesRaw.rowCount);

      for await (let course of courses) {
        course.tanggal_kelas = course.tanggal_kelas.toLocaleString('id-ID', {
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
        });
        course.waktu_kelas = course.waktu_kelas[0]+''+course.waktu_kelas[1]+':'+course.waktu_kelas[3]+''+course.waktu_kelas[4];
  
        var mentor = await pool.query(`SELECT nama_lengkap FROM mentor WHERE mentor_id = $1`, [course.mentor_id]);
        course.nama_mentor = mentor.rows[0].nama_lengkap;
      }

      const privateCoursesRaw = await pool.query(`
        SELECT * FROM course c
        WHERE
        (c.status = $1 AND c.tipe_kelas = $2)
        AND c.mentor_id IS NOT NULL 
        AND c.bukti_selesai IS NULL
        AND c.student_id = $3
        AND c.tanggal_kelas >= CURRENT_DATE
        ORDER BY c.tanggal_kelas 
        `,
        [
          'open', 'private',
          id,
        ]
      );
      var privateCourses = privateCoursesRaw.rows;
      // console.log(privateCourses);

      for await (let privateCourse of privateCourses) {
        var pendaftar = await pool.query(`SELECT * FROM private_approval WHERE course_id = $1`, [privateCourse.course_id]);
        privateCourse.pendaftar = pendaftar.rows;

        for await (let pendaftar of privateCourse.pendaftar){
          var nama_pendaftar = await pool.query(`SELECT nama_lengkap FROM student WHERE student_id = $1`, [pendaftar.student_id]);
          pendaftar.nama_lengkap = nama_pendaftar.rows[0].nama_lengkap;
        }
      }
    } catch (error){
      console.log(error);
    }

    res.render("student/edmessage", {
      currentUser: req.user,
      courses,
      privateCourses
    });
  })
);

app.put("/edmessage/terima_mentor",
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    try{
      const {course_id, tipe_kelas} = req.body;
  
      if(tipe_kelas == 'private'){
        const updateMentorKelas = await pool.query(
          `UPDATE course SET status = $1 WHERE course_id = $2`, 
          ['open', course_id]
        );
      }
  
    } catch (error){
      console.log(error);
    }

    res.redirect('/edmessage');
  })
);

app.put("/edmessage/tolak_mentor",
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    try{
      const {course_id, tipe_kelas} = req.body;
  
      if(tipe_kelas == 'private'){
        const updateMentorKelas = await pool.query(
          `UPDATE course SET mentor_id = NULL, status = $1 WHERE course_id = $2`, 
          ['pending', course_id]
        );
      }
  
    } catch (error){
      console.log(error);
    }

    res.redirect('/edmessage');
  })
);

app.put("/edmessage/terima_siswa",
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    try{
      // return res.send(req.body);
      const {course_id, student_id} = req.body;
  
      const insertPesertaKelas = await pool.query(
        `INSERT INTO student_course VALUES ($1, $2, $3, $4) RETURNING course_id`,
        [
          student_id,
          course_id,
          null,
          null
        ]
      );
      
      const currentKelasRaw = await pool.query(
        `SELECT * FROM course WHERE course_id = $1`, [course_id]
      )
      currentKelas = currentKelasRaw.rows[0];

      var harga = 0;
      if(currentKelas.paket === 'sarjana'){
        harga = 10;
      }
      if(currentKelas.paket === 'cumlaude'){
        harga = 15;
      }
      if(currentKelas.paket === 'mawapres'){
        harga = 20;
      }

      const updateKoin = await pool.query(
        `UPDATE course SET total_koin = $1 WHERE course_id= $2`, [currentKelas.total_koin + harga, currentKelas.course_id]
      )

      const deleteApproval = await pool.query(
        `DELETE FROM private_approval WHERE student_id = $1 AND course_id = $2`,
        [
          student_id,
          course_id,
        ]
      );
  
    } catch (error){
      console.log(error);
    }

    // req.flash('success', 'Data profile berhasil di-update');
    res.redirect('/edmessage');
  })
);

app.put("/edmessage/tolak_siswa",
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    try{
      const {course_id, student_id} = req.body;
      
      const currentKelasRaw = await pool.query(
        `SELECT * FROM course WHERE course_id = $1`, [course_id]
      )
      currentKelas = currentKelasRaw.rows[0];

      var harga = 0;
      if(currentKelas.paket === 'sarjana'){
        harga = 10;
      }
      if(currentKelas.paket === 'cumlaude'){
        harga = 15;
      }
      if(currentKelas.paket === 'mawapres'){
        harga = 20;
      }

      const getSaldoRaw = await pool.query(
        `SELECT saldo FROM student WHERE student_id= $1`, [student_id]
      )
      const saldo = getSaldoRaw.rows[0].saldo;

      const updateSaldo = await pool.query(
        `UPDATE student SET saldo = $1 WHERE student_id= $2`, [saldo + harga, student_id]
      )

      const deleteApproval = await pool.query(
        `DELETE FROM private_approval WHERE student_id = $1 AND course_id = $2`,
        [
          student_id,
          course_id,
        ]
      );
  
    } catch (error){
      console.log(error);
    }

    // req.flash('success', 'Data profile berhasil di-update');
    res.redirect('/edmessage');
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
  isNotLoggedInStudent,
  catchAsync(async (req, res) => {
    const { nama_lengkap, email, username, no_handphone, password, asal_sekolah, angkatan, jenjang } =
      req.body;

    let hashedPassword = await bcrypt.hash(password, 10);
    // res.send(req.body);

    const emailSelect = await pool.query(
      `SELECT * FROM student
      WHERE email = $1`,
      [email]
    );

    if (emailSelect.rows.length > 0) {
      req.flash("error", "E-mail sudah digunakan!");
      res.redirect("/register-student");
    } else {

      const unameSelect = await pool.query(
        `SELECT * FROM student
        WHERE username = $1`,
        [username]
      );

      if (unameSelect.rows.length > 0) {
        req.flash("error", "Username sudah digunakan!");
        res.redirect("/register-student");
      } else {
        const rowsInsert = await pool.query(
          `INSERT INTO student(nama_lengkap, email, password, asal_sekolah, angkatan, jenjang, saldo, username, no_handphone)
          VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING email, password`,
          [nama_lengkap, email, hashedPassword, asal_sekolah, angkatan, jenjang, 0, username, no_handphone]
        );
        // console.log(rowsInsert.rows[0]);
        req.flash("success", "Anda sudah terdaftar, silakan login");
        res.redirect("/login-student");
      }
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
    try {

      const coursesRaw = await pool.query(
        `SELECT * FROM course WHERE bukti_selesai IS NULL AND tanggal_kelas >= CURRENT_DATE`
      )
      
      console.log(coursesRaw.rowCount)
      if(coursesRaw.rowCount == 0){

        res.render("student/buka-kelas", {
          currentUser: req.user,
          courses: [],
          prodi: [],
          jumlahProdi: 0
        });

      } else {

        var courses = coursesRaw.rows;
      
        for await (let course of courses) {
          course.tanggal_kelas = course.tanggal_kelas.toLocaleString('id-ID', {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
          });
          course.waktu_kelas = course.waktu_kelas[0]+''+course.waktu_kelas[1]+':'+course.waktu_kelas[3]+''+course.waktu_kelas[4];
          
          if(course.mentor_id){
            var mentor = await pool.query(`SELECT * FROM mentor WHERE mentor_id = $1`, [course.mentor_id]);
            course.nama_mentor = mentor.rows[0].nama_lengkap;
            course.foto_profil_mentor = mentor.rows[0].foto_profil;
          }
        }
    
        const prodiRaw = await pool.query(
          `SELECT DISTINCT LOWER(program_studi) AS program_studi FROM course WHERE bukti_selesai IS NULL AND tanggal_kelas >= CURRENT_DATE`
        )
        var prodi = prodiRaw.rows;
        var jumlahProdi = prodiRaw.rowCount;

        function titleCase(str) {
          str = str.toLowerCase().split(' ');
          for (var i = 0; i < str.length; i++) {
            if (str[i] === 'dan' || str[i] === 'atau' || str[i] === 'untuk') continue;
            str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1); 
          }
          return str.join(' ');
        }

        prodi.forEach(programStudi => programStudi.program_studi = titleCase(programStudi.program_studi));
        // console.log(prodi);
        
        res.render("student/buka-kelas", {
          currentUser: req.user,
          courses,
          prodi,
          jumlahProdi
        });
      }

    } catch (error) {
      console.log(error);
    }
  })
);

app.get("/request-kelas", isLoggedInStudent, (req, res) => {
  res.render("student/request-kelas");
});

app.post(
  "/request-kelas",
  isLoggedInStudent,
  upload.single("file_materi"),
  catchAsync(async (req, res) => {
    try{
      const {
        program_studi,
        mata_kuliah,
        tanggal_kelas,
        waktu_kelas,
        deskripsi_materi,
        tipe_kelas,
        paket,
      } = req.body;

      var harga = 0;

      if(paket === 'sarjana' && tipe_kelas === 'public'){
        harga = 10;
      }
      if(paket === 'cumlaude' && tipe_kelas === 'public'){
        harga = 15;
      }
      if(paket === 'mawapres' && tipe_kelas === 'public'){
        harga = 20;
      }

      if(paket === 'sarjana' && tipe_kelas === 'private'){
        harga = 30;
      }
      if(paket === 'cumlaude' && tipe_kelas === 'private'){
        harga = 40;
      }
      if(paket === 'mawapres' && tipe_kelas === 'private'){
        harga = 50;
      }
      console.log(harga);

      if ((req.user.saldo) >= harga) {
        const saldoAkhir = req.user.saldo - harga
        console.log(saldoAkhir)

        const updateSaldo = await pool.query(
          `UPDATE student SET saldo = $1 WHERE student_id= $2`, [saldoAkhir, req.user.student_id]
        )
        console.log('sampai sini3')

        const uploadKelas = await pool.query(
          `INSERT INTO course
          (student_id, program_studi, mata_kuliah, tanggal_kelas, waktu_kelas, deskripsi_materi,tipe_kelas, file_materi, paket, status, total_koin)
          VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING course_id`,
          [
            req.user.student_id,
            program_studi,
            mata_kuliah,
            tanggal_kelas,
            waktu_kelas,
            deskripsi_materi,
            tipe_kelas,
            req.file.path,
            paket,
            'pending',
            harga,
          ]
        );
        console.log('sampai sini4')

        const kelasID = uploadKelas.rows[0].course_id
        const insertPembuatKelas = await pool.query(
          `INSERT INTO student_course VALUES ($1, $2, $3, $4) RETURNING course_id`,
          [
            req.user.student_id,
            kelasID,
            null,
            null
          ]
        );
        console.log('sampai sini5')

        req.flash('success', 'Request kelas berhasil!')
        return res.redirect('/dashboard-student')
      } else{
        req.flash('error', 'Koin anda tidak cukup untuk membuka kelas')
        return res.redirect('/dashboard-student');
      }
    }catch(err) {
      console.log(err);
      res.status(500).render('500');
    }
}));

app.get("/kelas/:id", isLoggedInStudent, catchAsync(async(req, res) => {
  const { id } = req.params;
    const currentKelasRaw = await pool.query(
      `SELECT * FROM course WHERE course_id = $1`, [id]
    )

    if(currentKelasRaw.rowCount == 0){
      res.status(404).render("404");
    } else {
      try {
        var currentKelas = currentKelasRaw.rows[0];
    
        currentKelas.tanggal_kelas = currentKelas.tanggal_kelas.toLocaleString('id-ID', {
          year: 'numeric', month: 'long', day: 'numeric'
        });

        var time = currentKelas.waktu_kelas;
        
        currentKelas.waktu_kelas = time[0]+''+time[1]+':'+time[3]+''+time[4];

        const currentUserRegisteredRaw = await pool.query(
          `SELECT * FROM student_course WHERE course_id = $1 AND student_id = $2`,
          [id, req.user.student_id]
        )
        const currentUserRegistered = currentUserRegisteredRaw.rows[0];
        
        var currentKelasMasterRaw = null;
        if(currentKelas.student_id != null){
          console.log(currentKelas.student_id);
          currentKelasMasterRaw = await pool.query(
            `SELECT * FROM student WHERE student_id = $1`,
            [currentKelas.student_id]
          )
        }

        var currentKelasMaster = null;
        if(currentKelasMasterRaw != null) currentKelasMaster = currentKelasMasterRaw.rows[0];

        var currentKelasMentorRaw = null;
        if(currentKelas.mentor_id){
          currentKelasMentorRaw = await pool.query(
            `SELECT * FROM mentor WHERE mentor_id = $1`,
            [currentKelas.mentor_id]
          )
        }
        
        const currentKelasMentor = (currentKelas.mentor_id == null ? null : currentKelasMentorRaw.rows[0]);

        var harga = 0;
        
        if(currentKelas.paket === 'sarjana'){
          harga = 10;
        }
        if(currentKelas.paket === 'cumlaude'){
          harga = 15;
        }
        if(currentKelas.paket === 'mawapres'){
          harga = 20;
        }

        var isPrivateAndRegistered = false;
        if(currentKelas.tipe_kelas == 'private'){
          const currentUserRegisteredPrivateRaw = await pool.query(
            `SELECT * FROM private_approval WHERE course_id = $1 AND student_id = $2`,
            [id, req.user.student_id]
          )
          if(currentUserRegisteredPrivateRaw.rowCount) isPrivateAndRegistered = true;
        }

        res.set("Content-Disposition", "inline");
        res.render("student/info-kelas", { currentUser: req.user, currentKelas, currentUserRegistered, harga, currentKelasMaster, currentKelasMentor, isPrivateAndRegistered });
      } catch (err) {
        console.log(err);
        res.status(500).render('500');
      }
    }
}));

app.post("/kelas/:id", isLoggedInStudent, catchAsync(async(req, res) => {
  const { id } = req.params;

  try{
    const currentKelasRaw = await pool.query(
      `SELECT * FROM course WHERE course_id = $1`, [id]
    )
    currentKelas = currentKelasRaw.rows[0];

    var harga = 0;

    if(currentKelas.paket === 'sarjana'){
      harga = 10;
    }
    if(currentKelas.paket === 'cumlaude'){
      harga = 15;
    }
    if(currentKelas.paket === 'mawapres'){
      harga = 20;
    }

    // console.log(harga);

    if (req.user.saldo >= harga) {
      const saldoAkhir = req.user.saldo - harga

      if(currentKelas.tipe_kelas == 'public'){
        const jumlahSiswaRaw = await pool.query(
          `SELECT student_id FROM student_course WHERE course_id = $1`, [currentKelas.course_id]
        )
        const jumlahSiswa = jumlahSiswaRaw.rowCount;
        // return console.log(jumlahSiswa);
        if(jumlahSiswa > 15){
          req.flash('error', 'Kelas sudah penuh.')
          return res.redirect('/dashboard-student');
        } else {
          const updateSaldo = await pool.query(
            `UPDATE student SET saldo = $1 WHERE student_id= $2`, [saldoAkhir, req.user.student_id]
          )
          console.log('sampai sini3')
          const updateKoin = await pool.query(
            `UPDATE course SET total_koin = $1 WHERE course_id= $2`, [currentKelas.total_koin + harga, currentKelas.course_id]
          )
          console.log('sampai sini4')
    
          const insertPesertaKelas = await pool.query(
            `INSERT INTO student_course VALUES ($1, $2, $3, $4) RETURNING course_id`,
            [
              req.user.student_id,
              currentKelas.course_id,
              null,
              null
            ]
          );
          console.log('sampai sini5')
    
          req.flash('success', 'Berhasil bergabung ke kelas!')
          return res.redirect('/dashboard-student')
        }

      } else if (currentKelas.tipe_kelas == 'private') {
        const updateSaldo = await pool.query(
          `UPDATE student SET saldo = $1 WHERE student_id= $2`, [saldoAkhir, req.user.student_id]
        )
        console.log('sampai sini3');

        const insertPendaftarKelas = await pool.query(
          `INSERT INTO private_approval VALUES ($1, $2) RETURNING course_id`,
          [
            req.user.student_id,
            currentKelas.course_id
          ]
        );
        console.log('sampai sini4');
  
        req.flash('success', 'Berhasil mendaftar kelas. Mohon tunggu persetujuan ketua kelas.')
        return res.redirect('/dashboard-student')
      }

    } else{
      req.flash('error', 'Koin anda tidak cukup untuk mengikuti kelas.')
      return res.redirect('/dashboard-student');
    }
  }catch(err) {
    console.log(err);
  }
}));


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
// app.post(
//   "/register-mentor",
//   catchAsync(async (req, res) => {
//     const { nama_lengkap, jurusan, username, email, password } = req.body;

//     // res.send(req.body);
//     let hashedPassword = await bcrypt.hash(password, 10);

//     const rowsSelect = await pool.query(
//       `SELECT * FROM mentor
//       WHERE email = $1`,
//       [email]
//     );

//     if (rowsSelect.rows.length > 0) {
//       req.flash("error", "E-mail sudah digunakan!");
//       res.redirect("/"); //kalo harusnya direct ke '/registerMentor'
//     } else {
//       const rowsInsert = await pool.query(
//         `INSERT INTO mentor(nama_lengkap, jurusan, username, email, password)
//         VALUES($1, $2, $3, $4, $5)
//         RETURNING email, password`,
//         [nama_lengkap, jurusan, username, email, hashedPassword]
//       );
//       console.log(rowsInsert.rows[0]);
//       req.flash("success", "kamu sudah terdaftar, silakan login");
//       res.redirect("/login-mentor");
//     }
//   })
// );

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

app.get("/dashboard-mentor", isLoggedInMentor, isMentor, catchAsync(async(req, res) => {

  var currentUser = req.user;
  // console.log(currentUser);
  const currentUserCourseRaw = await pool.query(
    `SELECT * FROM course WHERE status = $1 AND (mentor_id IS NULL OR mentor_id = $2) ORDER BY mentor_id`, 
    ['pending', req.user.mentor_id]
  )

  var currentUserCourse = currentUserCourseRaw.rows;
    
  for await (let row of currentUserCourse) {
    row.tanggal_kelas = row.tanggal_kelas.toLocaleString('id-ID', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
    row.waktu_kelas = row.waktu_kelas[0]+''+row.waktu_kelas[1]+':'+row.waktu_kelas[3]+''+row.waktu_kelas[4];

    const currentKelasMasterRaw = await pool.query(
      `SELECT * FROM student WHERE student_id = $1`,
      [row.student_id]
    )

    row.currentKelasMaster = currentKelasMasterRaw.rows[0];
  };


  const userCourseRaw = await pool.query(
    `SELECT * FROM course WHERE status = $1 AND mentor_id = $2 AND bukti_selesai IS NULL ORDER BY tanggal_kelas`, 
    ['open', req.user.mentor_id]
  )

  //kelas yang sedang diajar
  let userCourse = userCourseRaw.rows;
  userCourse.forEach(row => {
    row.tanggal_kelas = row.tanggal_kelas.toLocaleString('id-ID', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  });

  userCourse.forEach(row => {
    row.waktu_kelas = row.waktu_kelas[0]+''+row.waktu_kelas[1]+':'+row.waktu_kelas[3]+''+row.waktu_kelas[4];
  })

  res.render('mentor/home-mentor', {currentUser, currentUserCourse, userCourse});
}));

//render page buka-kelas
app.get("/dashboard-mentor/buka-kelas", isLoggedInMentor, isMentor, (req, res)=> {
  const currentUser = req.user;
  res.render('mentor/requestKelas-mentor', {currentUser});
  // console.log("OK");
})

app.post('/dashboard-mentor/buka-kelas', upload.single('file_materi'),catchAsync(async(req, res) => {
  const id = req.user.mentor_id;

  const {program_studi, mata_kuliah, tanggal_kelas, waktu_kelas, paket, deskripsi_materi, file_materi} = req.body;
  const bukaKelas = await pool.query(
    `INSERT INTO course
    (mentor_id, program_studi, mata_kuliah, tanggal_kelas, waktu_kelas, paket, deskripsi_materi, file_materi, status, tipe_kelas, bukti_selesai)
    VALUES
    ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,

    [id, program_studi, mata_kuliah, tanggal_kelas, waktu_kelas, paket, deskripsi_materi, req.file.path, 'open', 'public', null]
    );

    
  const bukaKelas_id =  bukaKelas.rows[0].course_id;
  res.redirect(`/dashboard-mentor/detail-kelas/${bukaKelas_id}`)
}));


//page edpedia
app.get("/edpedia-mentor", isLoggedInMentor, isMentor, catchAsync(async(req, res) => {
  res.render('mentor/edpedia-mentor', {currentUser: req.user});
}));

//page edwallet
app.get("/edwallet-mentor", isLoggedInMentor, isMentor, catchAsync(async(req, res) => {
  const banksRaw = await pool.query(`SELECT nama_bank FROM banks`);
  const banks = banksRaw.rows;

  res.render('mentor/edwallet-mentor', {currentUser: req.user, banks});
}));

app.post("/edwallet-mentor", isLoggedInMentor, isMentor, catchAsync(async(req, res) => {
  const {nomor_rekening, nama_pemilik_rekening, bank, jumlah_koin} = req.body;

  if(jumlah_koin > req.user.saldo){
    req.flash('error', 'Pengajuan tarik koin gagal, periksa kembali saldo Anda.');
    res.redirect('/dashboard-mentor');
  }

  if(jumlah_koin < 10){
    req.flash('error', 'Pengajuan tarik koin gagal, penarikan minimal 10 koin.');
    res.redirect('/dashboard-mentor');
  }

  var d = new Date();
  var created_at = d.getFullYear() + "-" +
  ("00" + (d.getMonth() + 1)).slice(-2) + "-" +
  ("00" + d.getDate()).slice(-2) + " " +
  ("00" + d.getHours()).slice(-2) + ":" +
  ("00" + d.getMinutes()).slice(-2) + ":" +
  ("00" + d.getSeconds()).slice(-2);

  const cashoutInsert = await pool.query(
    `INSERT INTO cashouts(mentor_id, nomor_rekening, nama_pemilik_rekening, bank, jumlah_koin, is_verified, verified_by, created_at)
    VALUES($1, $2, $3, $4, $5, $6, $7, $8)`,
    [req.user.mentor_id, nomor_rekening, nama_pemilik_rekening, bank, parseInt(jumlah_koin), 0, null, created_at]
  );

  const updateSaldo = await pool.query(
    `UPDATE mentor SET saldo = $1 WHERE mentor_id = $2`,
    [req.user.saldo - jumlah_koin ,req.user.mentor_id]
  );

  req.flash('success', 'Pengajuan tarik koin berhasil');
  res.redirect('/dashboard-mentor');
}));

//detail kelas
app.get("/dashboard-mentor/detail-kelas/:kelasId", isLoggedInMentor, isMentor, catchAsync(async(req, res) => {  //nanti tambahin ini isLoggedInMentor, isMentor,
  const {kelasId} = req.params;
  
  const currentKelasRaw = await pool.query(
    `SELECT * FROM course WHERE course_id = $1`, [kelasId]
  )

  const peserta_kelasRaw = await pool.query(
    `SELECT s.nama_lengkap, s.foto_profil FROM student s JOIN student_course sc on sc.student_id = s.student_id WHERE sc.course_id = $1`, [kelasId]
  );
  
  const currentKelas = currentKelasRaw.rows[0];
  //formatting tanggal jadi tanggal nama bulan dan tahun
    var options1 = {
        year: 'numeric', month: 'long', day: 'numeric'
    }
    currentKelas.tanggal_kelas = currentKelas.tanggal_kelas.toLocaleString('id-ID', options1);

    var time = currentKelas.waktu_kelas;
    currentKelas.waktu_kelas = time[0]+''+time[1]+':'+time[3]+''+time[4];
    
  res.render("mentor/info-kelas-mentor", {
    currentUser: req.user, 
    currentKelas, 
    peserta_kelas: peserta_kelasRaw.rows,
  });
}));

app.get('/dashboard-mentor/detail-kelas/:kelasId/sourceFile', async(req, res, next) => {
  try{
    const {kelasId, fileMateri} = req.params;


    console.log('fileController.download: started')

    const file_materi = await pool.query(`
      SELECT file_materi FROM course WHERE course_id = $1`, [kelasId]
    )

    const path = file_materi.rows[0].file_materi;
    console.log('sampe sini kah?');
    
    const file = fs.createReadStream(path)
    
    const filename = (new Date()).toISOString()
    res.setHeader('Content-Disposition', 'attachment: filename="' + filename + '"')
    file.pipe(res)
  } catch(err) {
    console.log(err);
  }
})

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
      `SELECT s.nama_lengkap, s.foto_profil FROM student s JOIN student_course sc on sc.student_id = s.student_id WHERE sc.course_id = $1`, [kelasId]
    );

    res.render('mentor/info-kelas_daftar-siswa', {
      currentUser: req.user, 
      currentKelas: currentKelasRaw.rows[0], 
      peserta_kelas: peserta_kelasRaw.rows
    });
  }
))

app.put(
  "/dashboard-mentor/kelas-selesai/:id",
  isLoggedInMentor,
  upload.single('bukti_selesai'),
  catchAsync(async (req, res) => {
    try{
      const course_id = req.params.id;
  
      const updateKelas = await pool.query(
        `UPDATE course SET bukti_selesai = $1 WHERE course_id = $2 AND mentor_id = $3`, 
        [req.file.path, course_id, req.user.mentor_id]
      );
  
    } catch (error){
      console.log(error);
    }

    req.flash('success', 'Kelas berhasil ditandai sebagai selesai. Mohon tunggu verifikasi dari tim ed.versity.');
    res.redirect('/dashboard-mentor');
  })
);

app.put(
  "/dashboard-mentor/detail-kelas",
  isLoggedInMentor,
  catchAsync(async (req, res) => {
    try{
      const {course_id, tipe_kelas} = req.body;
  
      if(tipe_kelas == 'private'){
        const updateMentorKelas = await pool.query(
          `UPDATE course SET mentor_id = $1, status = $2 WHERE course_id = $3`, 
          [req.user.mentor_id, 'pending', course_id]
        );
      }
  
      if(tipe_kelas == 'public'){
        const updateMentorKelas = await pool.query(
          `UPDATE course SET mentor_id = $1, status = $2 WHERE course_id = $3`, 
          [req.user.mentor_id, 'open', course_id]
        );
      }
  
    } catch (error){
      console.log(error);
    }

    // req.flash('success', 'Data profile berhasil di-update');
    res.redirect('back');
  })
);

// page profile mentor
app.get("/dashboard-mentor/profile",
  isLoggedInMentor,
  isMentor, 
  async (req, res) => {
try{
    const user = req.user;
    const userCourseRaw = await pool.query(
      `SELECT * FROM course WHERE mentor_id=$1 AND status=$2 AND bukti_selesai IS NULL`, [user.mentor_id, 'open']
    );

    let userCourse = userCourseRaw.rows;

    const userCourseDoneRaw = await pool.query(`SELECT * FROM course WHERE mentor_id=$1 AND status=$2`, [user.mentor_id, 'done'])
    
    let userCourseDone = userCourseDoneRaw.rows;

  userCourse.forEach(row => {
    row.tanggal_kelas = row.tanggal_kelas.toLocaleString('id-ID', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  });

  userCourseDone.forEach(row => {
    row.tanggal_kelas = row.tanggal_kelas.toLocaleString('id-ID', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  });
  
  userCourse.forEach(row => {
    row.waktu_kelas = row.waktu_kelas[0]+''+row.waktu_kelas[1]+':'+row.waktu_kelas[3]+''+row.waktu_kelas[4];
  })

  userCourseDone.forEach(row => {
    row.waktu_kelas = row.waktu_kelas[0]+''+row.waktu_kelas[1]+':'+row.waktu_kelas[3]+''+row.waktu_kelas[4];
  })
    

    res.render('mentor/option-mentor', {currentUser: user, userCourse, userCourseDone})

}catch(err){
  console.log(err);
}
  }
);

// update profile mentor
app.put(
  "/dashboard-mentor/profile/:id",
  upload.single("foto_profil"),
  isLoggedInMentor,
  catchAsync(async (req, res) => {
    try {
      // res.send(req.body); 
      const id = req.user.mentor_id;
      const { nama_lengkap, no_handphone, email } = req.body;

      const updatedProfile = await pool.query(
        `UPDATE mentor SET nama_lengkap=$1, no_handphone=$2, email=$3, foto_profil=$4 WHERE mentor_id=$5`,
        [nama_lengkap, no_handphone, email, req.file.path, id]
      );
    } catch (error) {
      console.log(error)
    }
  req.flash('success', 'Data profil berhasil diperbarui!');
  res.redirect(`/dashboard-mentor/profile`);
}));

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

//halaman utama
app.get("/", (req, res) => {
  if(!req.isAuthenticated()) res.render("main-page");
  else{
    if(req.user.role == 'student') res.redirect('/dashboard-student');
    if(req.user.role == 'mentor') res.redirect('/dashboard-mentor');
  }
});

app.all("*", (req, res, next) => {
  res.render('404');
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
