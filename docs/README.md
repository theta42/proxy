# Documentation

This directory contains the GitHub Pages documentation site for the Proxy project.

**Live site:** https://theta42.github.io/proxy/

## Pages

- `index.md` - Home page with project overview
- `installation.md` - Installation and setup guide
- `api.md` - Complete API reference
- `architecture.md` - System architecture and design
- `contributing.md` - Development and contribution guide

## Local Preview

To preview the site locally:

```bash
# Install Jekyll (one-time setup)
gem install jekyll bundler

# Run local server
cd docs
jekyll serve

# View at http://localhost:4000/proxy/
```

## Theme

The site uses the Cayman theme (`jekyll-theme-cayman`). Configuration is in `_config.yml`.

## Updating Documentation

1. Edit markdown files in this directory
2. Commit and push to master branch
3. GitHub Pages automatically rebuilds (may take 1-2 minutes)
4. Changes visible at https://theta42.github.io/proxy/

## Legacy Documentation

- `dev_setup.md` - Old development setup notes (kept for reference)
- `Update 4.11.md` - Old update notes (kept for reference)
