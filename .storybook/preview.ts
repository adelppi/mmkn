import type { Preview } from '@storybook/nextjs-vite'

import '../app/globals.css'

/**
 * カタログの見え方。
 *
 * **スマホ前提の幅で見る**（`docs/overview.md`）。画面はその幅で作られている。
 */
const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    viewport: {
      options: {
        phone: { name: 'スマートフォン', styles: { width: '390px', height: '844px' } },
      },
    },
  },
  initialGlobals: {
    viewport: { value: 'phone' },
  },
}

export default preview
