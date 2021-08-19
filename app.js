const express = require('express');
const app = express();
const pool = require('./db');
const path = require('path');
const catchAsync = require('./utils/catchAsync');
const bcrypt = require('bcrypt');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');

const {
  initializeStudent: initializePassportStudent,
  initializeMentor: initializePassportMentor,
  initializeAdmin: initializePassportAdmin,
} = require('./passportConfig');

initializePassportStudent(passport);
initializePassportMentor(passport);
initializePassportAdmin(passport);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

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

require('./routes')(app, pool, catchAsync, bcrypt, passport);

app.listen(3000, () => {
  console.log('server sudah berjalan di port 3000');
});
