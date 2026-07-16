'use strict';

const path = require('path');
const ejs = require('ejs')
const express = require('express');
const compression = require('compression');

// Set up the express app.
const app = express();

// The app always runs behind the OpenResty reverse proxy (a single hop) which
// sets X-Real-IP / X-Forwarded-For. Trust that one proxy so req.ip reflects the
// real client — needed for correct per-client rate limiting on /api/auth.
app.set('trust proxy', 1);

// Hold list of functions to run when the server is ready
app.onListen = [];

// Allow the express app to be exported into other files. 
module.exports = app;

// Hold onto the auth middleware 
const middleware = require('./middleware/auth');

// Grab the projects PubSub
app.contoller = require('./controller');

/**
 * Start background services
 * These services run independently of the HTTP server:
 * - host_lookup: Unix socket server for OpenResty host lookups
 * - host_scheduler: Scheduled tasks for wildcard cert renewal
 */
require('./services/host_lookup');
require('./services/host_scheduler');
require('./services/dynamic_dns');
require('./services/update_check');

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

// Gzip text responses (HTML/JS/CSS/JSON). The admin UI loads ~13 separate,
// uncompressed vendor JS/CSS files on every full page navigation (a
// traditional multi-page app, not an SPA) — this alone meaningfully cuts
// bytes-over-the-wire and perceived load time on a real network, where it
// matters far more than on localhost.
app.use(compression());

// load the JSON parser middleware. Express will parse JSON into native objects
// for any request that has JSON in its content type.
app.use(express.json());

// Set up the templating engine to build HTML for the front end.
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Per-host SSO endpoints. nginx routes /__proxy_auth/* on every proxied host to
// the app (see ops/nginx_conf/proxy.conf); these run the OIDC flow and set the
// per-host session cookie. Mounted before the page router.
app.use('/__proxy_auth', require('./routes/host_auth'));

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
