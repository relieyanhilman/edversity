module.exports = function (app, pool, catchAsync, bcrypt, passport) {
  //isLoggedIn? admin
  function isLoggedInAdmin(req, res, next) {
    if (!req.isAuthenticated()) {
      // req.session.kembaliKe = req.originalUrl;/
      return res.redirect('/admin/login');
    }
    next();
  }

  //dashboard admin
  app.get(
    '/admin',
    isLoggedInAdmin,
    catchAsync(async (req, res) => {
      if (req.user.role == 'operasional') {
        res.render('admin/index-ops', {
          user: req.user,
        });
      }
      if (req.user.role == 'hrd') {
        res.render('admin/index-hrd', {
          user: req.user,
        });
      }
      if (req.user.role == 'fundraising') {
        res.render('admin/index-fr', {
          user: req.user,
        });
      }
    })
  );

  app.post('/admin/logout', (req, res) => {
    req.logout();
    res.redirect('/admin/login');
  });

  //form login admin
  app.get('/admin/login', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.render('admin/login');
    }
    return res.redirect('/admin');
  });

  app.post(
    '/admin/login',
    passport.authenticate('localUser', {
      successRedirect: '/admin',
      failureRedirect: '/admin/login',
      failureFlash: true,
    })
  );
};
