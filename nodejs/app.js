'use strict';

const path = require('path');
const ejs = require('ejs')
const express = require('express');
const middleware = require('./middleware/auth');

// Set up the express app.
const app = express();

// load the JSON parser middleware. Express will parse JSON into native objects
// for any request that has JSON in its content type. 
app.use(express.json());

// Set up the templating engine to build HTML for the front end.
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Have express server static content( images, CSS, browser JS) from the public
// local folder.
app.use('/static', express.static(path.join(__dirname, 'public')))

// Routes for front end content.
app.use('/',  require('./routes/index'));

// API routes for authentication. 
app.use('/api/auth',  require('./routes/auth'));

// API routes for working with users. All endpoints need to be have valid user.
app.use('/api/users', middleware.auth, require('./routes/users'));

// API routes for working with hosts. All endpoints need to be have valid user.
app.use('/api/hosts', middleware.auth, require('./routes/hosts'));

// Catch 404 and forward to error handler. If none of the above routes are
// used, this is what will be called.
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// Error handler. This is where `next()` will go on error
app.use(function(err, req, res, next) {
  console.error(err.status || res.status, err.name, req.method, req.url);
  console.error(err.message);
  console.error(err.stack);
  console.error('=========================================');

  res.status(err.status || 500);
  res.json({name: err.name, message: err.message});
});

// Allow the express app to be exported into other files. 
module.exports = app;
