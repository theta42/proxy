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
const conf = require('@simpleworkjs/conf');
const buildInfo = require('./utils/build_info');
const socketPubsub = require('./utils/socket_pubsub');

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

// Push model events out to the sockets allowed to see them. The gate lives in
// utils/socket_pubsub.js, which mirrors the REST read guards per socket —
// previously this was an unconditional broadcast of every event to every
// authenticated client.
app.onListen.push(function(){
  app.io.use(middleware.authIO);
  socketPubsub.attach(app.io, app.contoller.ps);
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

// Per-app values for the shared UI shell (views/top.ejs + views/bottom.ejs).
// Set as an app local so every res.render has it, including routes that don't
// spread the routers' `values` object.
app.locals.ui = require('./utils/ui');

// Per-host SSO endpoints. nginx routes /__proxy_auth/* on every proxied host to
// the app (see ops/nginx_conf/proxy.conf); these run the OIDC flow and set the
// per-host session cookie. Mounted before the page router.
app.use('/__proxy_auth', require('./routes/host_auth'));

// Routes for front end content.
app.use('/', require('./routes/render'));

// Local, in-app copy of the project's documentation (README, DEPLOYMENT,
// api.md, docs/*) -- public, no auth, so it's readable even by a locked-out
// admin or an air-gapped operator with no route to GitHub Pages.
app.use('/docs', require('./routes/docs'));

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
    const status = err.status || 500;
    console.error(status, err.name, req.method, req.url);
    console.error(err.message);
    if (err.stack) console.error(err.stack);
    console.error('=========================================');

    res.status(status);
    // Only expose safe, non-internal fields to the client.
    const body = { name: err.name, message: err.message };
    // Browser navigation gets the HTML error page (shared with SSO); API
    // clients get JSON.
    if (req.accepts('html') && !req.originalUrl.startsWith('/api/')) {
      res.render('error', {
        title: conf.environment !== 'production' ? 'dev' : '',
        titleIcon: conf.environment !== 'production' ? '<i class="fa-brands fa-dev"></i>' : '',
        name: conf.name,
        logo: conf.logo,
        ...buildInfo,
        error: err,
      });
      return;
    }
    res.json(body);
  }catch(error){
    console.error('error in the catch-all error handler', error);
    if (!res.headersSent) {
      res.status(500).json({ name: 'Error', message: 'Internal server error' });
    }
  }
});
