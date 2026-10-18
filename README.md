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

## Publishing

The site is live at **https://tpoplab.org**, built from the GitHub repo
[tpoplab/tpoplab.github.io](https://github.com/tpoplab/tpoplab.github.io).
Every push to `main` rebuilds and republishes it automatically (about 1 minute).
Browsers may keep showing the old version for up to 10 minutes; press ⌘ + Shift + R to refresh.

To publish changes after editing:

```bash
git add -A
git commit -m "Describe your change"
git push
```

(GitHub CLI is installed at `~/.local/bin/gh` and signed in as `tpoplab`.)

## Custom domain (tpoplab.org)

The domain is registered at Porkbun. Its DNS records point to GitHub Pages:

- Four `A` records for the root → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
- Four `AAAA` records for the root → `2606:50c0:8000::153` … `2606:50c0:8003::153`
- `CNAME` for `www` → `tpoplab.github.io`

`public/CNAME` contains `tpoplab.org`, and the repo's **Settings → Pages** has the same custom domain with HTTPS enforced.
Keep the domain's auto-renew turned on at Porkbun so the site doesn't go offline.
