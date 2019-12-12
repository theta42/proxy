'use strict';

const path = require('path');
const ejs = require('ejs')

const express = require('express');
const app = express();

const middleware = require('./middleware/auth');

app.use(express.json());

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use('/static', express.static(path.join(__dirname, 'public')))

app.use('/',  require('./routes/index'));
app.use('/api/auth',  require('./routes/auth'));
app.use('/api/users', middleware.auth, require('./routes/users'));
app.use('/api/hosts', middleware.auth, require('./routes/hosts'));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development

  console.error(err.status || res.status, req.url, err);
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.json({message: 'error!'});
});

module.exports = app;
