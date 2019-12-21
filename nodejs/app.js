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
  console.error(err.status || res.status, err.name, req.method, req.url);
  console.error(err.message);
  console.error(err.stack);
  console.error('=========================================');

  res.status(err.status || 500);
  res.json({name: err.name, message: err.message});
});

module.exports = app;
