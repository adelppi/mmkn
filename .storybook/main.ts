import type { StorybookConfig } from '@storybook/nextjs-vite'

/**
 * 表示のカタログ（`docs/adr/0010-testing.md`「Storybook」）。
 *
 * **失敗形を含む全分岐を並べるために持つ。** ビューモデルがタグ付き union になっている
 * （`docs/adr/0009-web-ui.md`）ため、`kind` ごとに 1 つ置けばカタログになる。
 *
 * **スナップショット比較は持たない。** CI で確かめるのはビルドが通ることだけ（`docs/adr/0011`）。
 */
const config: StorybookConfig = {
  // Presentational の隣に置く（`docs/adr/0009`「配置と命名」）。
  stories: ['../app/**/presentation.stories.tsx'],
  addons: [],
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },
}

export default config
