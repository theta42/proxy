'use strict';

const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const {rateLimit} = require('express-rate-limit');
const {marked} = require('marked');
const conf = require('@simpleworkjs/conf');
const buildInfo = require('../utils/build_info');

// Public, unauthenticated, and reads from disk on every request -- throttle
// per IP so it can't be used to hammer the filesystem (mirrors the pattern
// in routes/auth.js/routes/host.js), generous since this is just docs.
const docsLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 120,
	standardHeaders: true,
	legacyHeaders: false,
	message: {name: 'TooManyRequests', message: 'Too many requests, please try again later.'},
});

const values = {
	title: conf.environment !== 'production' ? `dev` : '',
	titleIcon: conf.environment !== 'production' ? `<i class="fa-brands fa-dev"></i>` : '',
	name: conf.name,
	logo: conf.logo,
	...buildInfo,
};

// Full local copy of the project's documentation, rendered server-side --
// so an operator running air-gapped (no route to GitHub Pages, where this
// content otherwise only lives) can still read it from the running app.
// An explicit slug -> file allowlist, never a user-suppliable path, so
// there's no way to make this read outside the doc set below.
const DOCS = {
	// Plain-language "what is this and why would I use it" guides -- linked
	// directly from the relevant card in the UI (see the help icon on each
	// card). Each links onward to the deeper technical doc below for readers
	// who want the system-design/protocol-level detail.
	hosts:        {title: 'Hosts & HTTPS',              file: path.join(__dirname, '../../docs/concepts-hosts.md')},
	dns:          {title: 'DNS Providers',              file: path.join(__dirname, '../../docs/concepts-dns.md')},
	access:       {title: 'Users, Groups & Permissions', file: path.join(__dirname, '../../docs/concepts-access.md')},
	'api-tokens': {title: 'API Tokens',                 file: path.join(__dirname, '../../docs/concepts-api-tokens.md')},

	overview:     {title: 'Overview',      file: path.join(__dirname, '../../README.md')},
	changelog:    {title: 'Changelog',     file: path.join(__dirname, '../../CHANGELOG.md')},
	deployment:   {title: 'Deployment',    file: path.join(__dirname, '../../DEPLOYMENT.md')},
	api:          {title: 'API Reference', file: path.join(__dirname, '../api.md')},
	installation: {title: 'Installation',  file: path.join(__dirname, '../../docs/installation.md')},
	architecture: {title: 'Architecture',  file: path.join(__dirname, '../../docs/architecture.md')},
	docker:       {title: 'Docker',        file: path.join(__dirname, '../../docs/docker.md')},
	contributing: {title: 'Contributing',  file: path.join(__dirname, '../../docs/contributing.md')},
};

const docList = Object.entries(DOCS).map(([slug, d]) => ({slug, title: d.title}));

// README.md links its screenshots as repo-relative "docs/images/...", which
// only resolves correctly on GitHub. Serve that same folder here and rewrite
// the rendered markup to point at it absolutely, so the images work when
// read from /docs/overview too.
router.use('/images', require('express').static(path.join(__dirname, '../../docs/images')));
function fixImagePaths(html) {
	return html.replace(/(["(])docs\/images\//g, '$1/docs/images/');
}

// docs/*.md files (not the repo-root README/CHANGELOG/api.md) carry Jekyll
// front matter for the GitHub Pages build and a "← Back to Home" link back
// to that site's index -- both meaningless here (this viewer has its own
// doc-list sidebar, docs_page.ejs) and, worse, marked() doesn't know front
// matter isn't regular markdown: it rendered as a garbled heading + stray
// <hr> at the top of every page. Strip both before rendering.
function stripJekyllCruft(content) {
	return content
		.replace(/^---\n[\s\S]*?\n---\n/, '')
		.replace(/^\s*\[← Back to Home\]\([^)]*\)\s*\n/m, '');
}

// Docs cross-link each other as "<slug>.html" (correct for the Jekyll/GitHub
// Pages build, which is what these same .md files also feed) and
// "index.html" for the docs home -- neither resolves here, where a doc lives
// at /docs/<slug> with no .html suffix. Rewrite known doc links to the
// in-app route, same idea as fixImagePaths() above. Only touches slugs that
// actually exist, so an unrelated "foo.html" link is left alone.
// Docs are also linked by their real filename stem (e.g. "concepts-hosts.html"
// for docs/concepts-hosts.md) -- the correct, working link on the Jekyll/
// GitHub Pages build, where the URL IS the filename stem. That doesn't match
// this viewer's own short slugs (DOCS keys, e.g. "hosts"), so also resolve by
// filename as a fallback -- one link written in a doc works correctly on
// both targets, rather than needing two different link forms.
const slugByFilename = Object.fromEntries(
	Object.entries(DOCS).map(([slug, d]) => [path.basename(d.file, '.md'), slug])
);
function fixDocLinks(html) {
	return html
		.replace(/href="index\.html"/g, 'href="/docs"')
		.replace(/href="([a-z0-9-]+)\.html"/g, (match, name) => {
			const slug = DOCS[name] ? name : slugByFilename[name];
			return slug ? `href="/docs/${slug}"` : match;
		});
}

router.use(docsLimiter);

router.get('/', function(req, res) {
	res.render('docs_index', {...values, docs: docList});
});

// Plain, dependency-free line-substring search over the same allowlisted
// doc set -- no separate index to build/maintain, no new dependency, and it
// keeps working with no internet access (same reasoning as the rest of this
// route). Must be registered before the /:slug catch-all below, or "search"
// would be treated as a (nonexistent) doc slug and 404.
router.get('/search', function(req, res) {
	const q = (req.query.q || '').trim();
	if (!q) return res.json({results: []});
	const qLower = q.toLowerCase();

	const results = [];
	for (const [slug, doc] of Object.entries(DOCS)) {
		try {
			const content = stripJekyllCruft(fs.readFileSync(doc.file, 'utf8'));
			const matchLine = content.split('\n').find(line => line.toLowerCase().includes(qLower));
			if (matchLine) {
				results.push({slug, title: doc.title, snippet: matchLine.trim().slice(0, 200)});
			}
		} catch (error) { /* unreadable doc file -- skip it */ }
	}

	res.json({results});
});

router.get('/:slug', function(req, res, next) {
	const doc = DOCS[req.params.slug];
	if (!doc) return next({status: 404, message: 'Doc not found'});

	try {
		const content = stripJekyllCruft(fs.readFileSync(doc.file, 'utf8'));
		res.render('docs_page', {
			...values,
			docs: docList,
			currentSlug: req.params.slug,
			docTitle: doc.title,
			docHtml: fixDocLinks(fixImagePaths(marked(content))),
		});
	} catch (error) {
		next(error);
	}
});

module.exports = router;
