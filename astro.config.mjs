// @ts-check
import { defineConfig } from 'astro/config';

// Where the site lives: the custom domain tpoplab.org (see public/CNAME),
// published from the GitHub repo tpoplab/tpoplab.github.io.
export default defineConfig({
  site: 'https://tpoplab.org',
  base: '/',
});
