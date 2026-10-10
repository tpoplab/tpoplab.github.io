# T-Pop Research Lab Website

Built with [Astro](https://astro.build). Hosted free on GitHub Pages.

## Preview on your computer

```bash
npm install      # first time only
npm run dev      # then open http://localhost:4321
```

The page reloads automatically as you edit files.

## Where to edit things

| What | File |
|---|---|
| Lab name, tagline, email, address, social links | `src/config.ts` |
| Research themes (one file each) | `src/content/research/*.md` |
| People (one file each) | `src/content/people/*.md` |
| Photos | `public/images/people/` (then set `photo: /images/people/name.jpg`) |
| Publications | `src/data/publications.yaml` |
| News (one file each) | `src/content/news/*.md` |
| Open positions | `src/pages/join.astro` (the `positions` list at the top) |
| Colors & fonts | `src/styles/global.css` (the `:root` section at the top) |
| Logo | `src/components/Logo.astro` and `public/favicon.svg` |

**To add a person, news item or research theme**, copy an existing file in the same folder, rename it, and edit the text between the `---` lines.

People `role` must be one of: `Principal Investigator`, `Postdoc`, `PhD Student`, `Master's Student`, `Undergraduate`, `Staff`, `Alumni`.
Photos look best at a 4:5 portrait ratio, about 800×1000 px.

## Publishing to GitHub Pages

1. Create a GitHub repository (e.g. `lab-website`) and push this folder to it.
2. In the repo on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` now rebuilds and publishes the site automatically.

Until you have a custom domain, set these in `astro.config.mjs` so links work:

```js
site: 'https://YOUR-USERNAME.github.io',
base: '/lab-website',
```

## Using a custom domain (e.g. tpoplab.com)

1. Buy the domain from a registrar (Cloudflare, Namecheap, Porkbun, Google/Squarespace Domains…), about $10–15/year.
2. At the registrar, add DNS records:
   - Four `A` records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - A `CNAME` record for `www` → `YOUR-USERNAME.github.io`
3. Create a file `public/CNAME` containing just `tpoplab.com`.
4. In `astro.config.mjs` set `site: 'https://tpoplab.com'` and `base: '/'`.
5. On GitHub: **Settings → Pages → Custom domain** → `tpoplab.com`, then tick **Enforce HTTPS** once it becomes available.
