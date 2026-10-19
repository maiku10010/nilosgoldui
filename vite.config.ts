import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { resolveApiBaseUrl } from './src/apiConfig'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  resolveApiBaseUrl(env.VITE_API_BASE_URL, env.VITE_DEMO_API_ORIGIN);
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
  return {
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [
    figmaAssetResolver(),
    {
      name: 'brand-html',
      transformIndexHtml: (html: string) => html
        .replace('__APP_NAME__', escapeHtml(env.NEXT_PUBLIC_APP_NAME?.trim() || 'Goldsmith OS'))
        .replace('__APP_LOGO__', escapeHtml(env.NEXT_PUBLIC_APP_LOGO?.trim() || '/demo-logo.svg')),
    },
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
};
})
