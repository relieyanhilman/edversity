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
  "/edwallet",
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    res.render("student/edwallet", {currentUser: req.user});
  })
);

app.get(
  "/edwallet/gopay",
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    res.render("student/edwallet-gopay", {currentUser: req.user});
  })
);

app.get(
  "/edwallet/ovo",
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    res.render("student/edwallet-ovo", {currentUser: req.user});
  })
);

app.get(
  "/edwallet/transfer",
  isLoggedInStudent,
  catchAsync(async (req, res) => {
    res.render("student/edwallet-transfer", {currentUser: req.user});
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
        JOIN student_course sc
        ON c.course_id = sc.course_id
        WHERE 
        ((c.status = $1 AND c.tipe_kelas = $2)
        OR
        (c.status = $3 AND c.tipe_kelas = $4))
        AND c.mentor_id IS NOT NULL 
        AND sc.student_id = $5
        AND sc.role = $6
        AND c.tanggal_kelas >= CURRENT_DATE
        ORDER BY c.tanggal_kelas 
        `,
        [
          'pending', 'private',
          'open', 'public',
          id, '1',
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
  
    } catch (error){
      console.log(error);
    }

    res.render("student/edmessage", {
      currentUser: req.user,
      courses
    });
  })
);

app.put("/edmessage/terima",
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

    // req.flash('success', 'Data profile berhasil di-update');
    res.redirect('/edmessage');
  })
);

app.put("/edmessage/tolak",
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

    const coursesRaw = await pool.query(
      `SELECT * FROM course WHERE status = $1 AND tanggal_kelas >= CURRENT_DATE`,
      ['open']
    )

    var courses = coursesRaw.rows;
  
    for await (let course of courses) {
      course.tanggal_kelas = course.tanggal_kelas.toLocaleString('id-ID', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
      });
      course.waktu_kelas = course.waktu_kelas[0]+''+course.waktu_kelas[1]+':'+course.waktu_kelas[3]+''+course.waktu_kelas[4];

      var mentor = await pool.query(`SELECT nama_lengkap FROM mentor WHERE mentor_id = $1`, [course.mentor_id]);
      course.nama_mentor = mentor.rows[0].nama_lengkap;
    }

    console.log(courses);
    try {
      res.render("student/buka-kelas", {
        currentUser: req.user,
        courses
      });
      
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
      `INSERT INTO course(program_studi, mata_kuliah, tanggal_kelas, waktu_kelas, deskripsi_materi,tipe_kelas, file_materi, paket, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING course_id`,
      [
        program_studi,
        mata_kuliah,
        tanggal_kelas,
        waktu_kelas,
        deskripsi_materi,
        tipe_kelas,
        req.file.path,
        paket,
        'pending',
      ]
    );

    const kelasID = uploadKelas.rows[0].course_id

    const insertPembuatKelas = await pool.query(
      `INSERT INTO student_course VALUES ($1, $2, $3, $4, $5) RETURNING course_id`,
      [
        req.user.student_id,
        kelasID,
        1,
        null,
        null
      ]
    );
    
    req.flash("success", "Request kelas berhasil!");
    res.redirect("/dashboard-student");
  })
);

app.get("/kelas/:id", isLoggedInStudent, catchAsync(async(req, res) => {
  const { id } = req.params;

  const currentKelasRaw = await pool.query(
    `SELECT * FROM course WHERE course_id = $1`, [id]
  )
  currentKelas = currentKelasRaw.rows[0];
  
  currentKelas.tanggal_kelas = currentKelas.tanggal_kelas.toLocaleString('id-ID', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  var time = currentKelas.waktu_kelas;
  
  currentKelas.waktu_kelas = time[0]+''+time[1]+':'+time[3]+''+time[4];

  res.render("student/info-kelas", { currentUser: req.user, currentKelas });
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
  console.log(currentUser);
  const currentUserCourseRaw = await pool.query(
    `SELECT * FROM course WHERE status = $1 AND (mentor_id IS NULL OR mentor_id = $2) ORDER BY mentor_id`, 
    ['pending', req.user.mentor_id]
  )

  // const currentUserCourseRaw = await pool.query(
  //   `SELECT * FROM course WHERE mentor_id = $1 AND status = $2`, 
  //   [currentUser.mentor_id, 'open']
  // ) ini artinya kelas yang udah didaftar mentor dong, dan statusnya open. harusnya di dashboard itu kan cuma kelas yang open aja
// jadi fungsi yang dicomment ini bakal dipake di profile bagian informasi 'kelas saya'

  var currentUserCourse = currentUserCourseRaw.rows;

  // console.log({currentUser, currentUserCourse});
  // console.log(currentUserCourse);

  currentUserCourse.forEach(row => {
    row.tanggal_kelas = row.tanggal_kelas.toLocaleString('id-ID', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
    row.waktu_kelas = row.waktu_kelas[0]+''+row.waktu_kelas[1]+':'+row.waktu_kelas[3]+''+row.waktu_kelas[4];
  });
  
  res.render('mentor/home-mentor', {currentUser, currentUserCourse});
});

//render page buka-kelas
app.get("/dashboard-mentor/buka-kelas", isLoggedInMentor, isMentor, (req, res)=> {
  const currentUser = req.user;
  res.render('mentor/requestKelas-mentor', {currentUser});
  // console.log("OK");
})

app.post('/dashboard-mentor/:id/buka-kelas', upload.single('file_materi'),catchAsync(async(req, res) => {
  const {id} = req.params;

  const {program_studi, 
    mata_kuliah, tanggal_kelas, waktu_kelas, paket, deskripsi_materi, file_materi} = req.body;
  const bukaKelas = await pool.query(
    `INSERT INTO course(mentor_id, program_studi, 
      mata_kuliah, tanggal_kelas, waktu_kelas, paket, deskripsi_materi, file_materi,status
      ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`, [id, program_studi, 
        mata_kuliah, tanggal_kelas, waktu_kelas, paket, deskripsi_materi, req.file.path, 'open']
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
app.get("/dashboard-mentor/detail-kelas/:kelasId", isLoggedInMentor, isMentor, catchAsync(async(req, res) => {  //nanti tambahin ini isLoggedInMentor, isMentor,
  const {kelasId} = req.params;
  
  const currentKelasRaw = await pool.query(
    `SELECT * FROM course WHERE course_id = $1`, [kelasId]
  )

  const peserta_kelasRaw = await pool.query(
    `SELECT nama_lengkap FROM student_course JOIN student on student_course.student_id = student.student_id WHERE student_course.course_id = $1`, [kelasId]
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

app.get('/dashboard-mentor/detail-kelas/:kelasId/:file_path', async(req, res, next) => {
      try{
      const {kelasId, file_path} = req.params;


      console.log('fileController.download: started')

      const file_materi = await pool.query(`
        SELECT file_materi FROM course WHERE course_id = $1`, [kelasId]
      )

      const path = file_materi.rows[0].file_materi;
      console.log('sampe sini kah?');
      console.log(path);
      const file = fs.createReadStream(path)
      console.log(file);
      const filename = (new Date()).toISOString()
      res.setHeader('Content-Disposition', 'attachment: filename="' + path + '"')
      file.pipe(res)
      }catch(err) {
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
      `SELECT nama_lengkap FROM student_course JOIN student on student_course.student_id = student.student_id WHERE student_course.course_id = $1`, [kelasId]
    );

    res.render('mentor/info-kelas_daftar-siswa', {
      currentUser: req.user, 
      currentKelas: currentKelasRaw.rows[0], 
      peserta_kelas: peserta_kelasRaw.rows
    });
  }
))

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

//halaman utama
app.get("/", (req, res) => {
  if(!req.isAuthenticated()) res.render("main-page");
  else{
    if(req.user.role == 'student') res.redirect('/dashboard-student');
    if(req.user.role == 'mentor') res.redirect('/dashboard-mentor');
  }
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
