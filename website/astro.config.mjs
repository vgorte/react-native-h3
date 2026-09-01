import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import starlightLinksValidator from 'starlight-links-validator'
import { BASE, REPO, SITE, sidebar } from './pages'

export default defineConfig({
  site: SITE,
  base: BASE,
  integrations: [
    starlight({
      title: 'react-native-nitro-h3',
      description: 'Fast H3 geospatial indexing for React Native, powered by Nitro Modules.',
      logo: { src: './src/assets/logo.svg' },
      social: [{ icon: 'github', label: 'GitHub', href: REPO }],
      editLink: { baseUrl: `${REPO}/edit/main/website/` },
      lastUpdated: true,
      sidebar: sidebar(),
      plugins: [starlightLinksValidator()],
    }),
  ],
})
