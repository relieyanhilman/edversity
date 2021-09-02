var fs = require('fs');

module.exports = function (app, pool, catchAsync, bcrypt, passport) {
  fs.readdirSync(__dirname).forEach(function (file) {
    if (file == 'index.js') return;
    var name = file.substr(0, file.indexOf('.'));
    require('./' + name)(app, pool, catchAsync, bcrypt, passport);
  });
};
