'use strict';

const express = require('express');
const app = express();

const middleware = require('./middleware/auth');

app.use(express.json());

app.use('/auth',  require('./routes/auth'));
app.use('/users', middleware.auth, require('./routes/users'));
app.use('/api', middleware.auth, require('./routes/routes'));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
