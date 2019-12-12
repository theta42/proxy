var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', async function(req, res, next) {
  res.render('hosts', { title: 'Express' });
});

/* GET home page. */
router.get('/hosts', function(req, res, next) {
  res.render('hosts', { title: 'Express' });
});

/* GET home page. */
router.get('/users', function(req, res, next) {
  res.render('users', { title: 'Express' });
});

/* GET home page. */
router.get('/login', function(req, res, next) {
  res.render('login', {redirect: req.query.redirect});
});

module.exports = router;
