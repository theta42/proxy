'use strict';

const path = require('path');
const ejs = require('ejs')
const express = require('express');

// Set up the express app.
const app = express();

// Hold list of functions to run when the server is ready
app.onListen = [];

// Allow the express app to be exported into other files. 
module.exports = app;

// Hold onto the auth middleware 
const middleware = require('./middleware/auth');

// Grab the projects PubSub
app.contoller = require('./controller');

// Push pubsub over the socket and back.
app.onListen.push(function(){
  app.io.use(middleware.authIO);

  app.contoller.ps.subscribe(/./g, function(data, topic){
    app.io.emit('P2PSub', { topic, data });
  });                                 

  app.io.on('connection', (socket) => {
    // console.log('socket', socket)
    var user = socket.user;
    socket.on('P2PSub', (msg) => {
      app.contoller.ps.publish(msg.topic, {...msg.data, __from:socket.user});
      // socket.broadcast.emit('P2PSub', msg);
    });
  });
}); 

// load the JSON parser middleware. Express will parse JSON into native objects
// for any request that has JSON in its content type. 
app.use(express.json());

// Set up the templating engine to build HTML for the front end.
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Routes for front end content.
app.use('/', require('./routes/render'));

// Routes for API 
app.use('/api', require('./routes/api'));

// Catch 404 and forward to error handler. If none of the above routes are
// used, this is what will be called.
app.use(async function(req, res, next) {
  try{
    var err = new Error('Not Found');
    err.message = 'Page not found'
    err.status = 404;
    next(err);
  }catch(error){
    console.log('app 404 catch error', error)
  }
});

// Error handler. This is where `next()` will go on error
app.use(async function(err, req, res, next) {
  try{  
    console.error(err.status || res.status, err.name, req.method, req.url);
    console.error(err.message);
    console.error(err.stack);
    console.error('=========================================');

    res.status(err.status || 500);
    res.json({name: err.name, message: err.message, keys: err.keys});
  }catch(error){
    console.log('error in the catch all error fn....', error);
  }
});
