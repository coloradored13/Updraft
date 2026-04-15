# Updraft — Deployment Guide

## Cloudflare Pages (Recommended)

### Option A: Git Integration (Recommended)

1. Push this repo to GitHub
2. Go to [Cloudflare Pages](https://dash.cloudflare.com/?to=/:account/pages) and sign in
3. Click **Create a project** > **Connect to Git**
4. Select the Updraft repository
5. Configure the build:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node.js version:** 20 (set via environment variable `NODE_VERSION = 20`)
6. Click **Save and Deploy**

Cloudflare will automatically deploy on every push to `main`.

### Option B: Direct Upload via CLI

```bash
# Install Wrangler globally
npm install -g wrangler

# Authenticate with Cloudflare
wrangler login

# Build the project
npm run build

# Deploy
wrangler pages deploy dist --project-name=updraft
```

### Custom Domain

After initial deployment:

1. Go to your Pages project in the Cloudflare dashboard
2. Click **Custom domains** > **Set up a custom domain**
3. Enter your domain and follow the DNS instructions

## Cache Strategy

The `_headers` file configures:

- **Hashed assets** (`/assets/*`): Cached for 1 year (immutable — filenames change on content change)
- **HTML files**: Always revalidated (ensures users get the latest version)
- **Service worker**: Always revalidated

## Build Output

```
dist/
├── index.html          (~1 KB)
├── assets/
│   └── index-[hash].js (~1.5 MB, ~338 KB brotli)
├── manifest.json
├── sw.js
├── _headers
└── _redirects
```

## Analytics (Plausible)

Privacy-respecting, cookie-free, GDPR-compliant. No consent banners needed.

### Setup

1. Create a [Plausible](https://plausible.io/) account (cloud or self-hosted)
2. Add your site domain
3. Edit `index.html` and replace `YOURDOMAIN.COM` with your actual domain in the Plausible script tag
4. In the Plausible dashboard, create these **Custom Goals**:
   - `Game Start`
   - `Game Over` (enable custom property: `score`)
   - `Victory` (enable custom property: `score`)

Page views are tracked automatically. Custom events fire from `src/utils/analytics.js`.

### Local Development

The Plausible script only sends data when the page domain matches `data-domain`. During local development (`localhost`), no data is sent.

## Alternatives

### Vercel

```bash
npm install -g vercel
vercel --prod
```

Build settings: Framework = Vite, Output = dist.

### Netlify

Drag and drop the `dist/` folder at [app.netlify.com/drop](https://app.netlify.com/drop), or connect via Git with the same build settings as Cloudflare.
