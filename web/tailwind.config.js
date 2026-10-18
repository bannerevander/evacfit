import theme from './tailwind.theme.json' with { type: 'json' }

// Token source: DESIGN.md / tailwind.theme.json (copied verbatim from the PRD folder).
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    ...theme.theme,
    extend: {
      ...theme.theme.extend,
      colors: {
        ...theme.theme.extend.colors,
        // DESIGN.md badge backgrounds, named so components never use raw hex.
        'tint-recommended': '#FEF3C7',
        'tint-confirmed': '#DBEAFE',
        'tint-in-transit': '#E0E7FF',
        'tint-arrived': '#DCFCE7',
        'tint-rejected': '#FEE2E2',
        'tint-unverified': '#FFEDD5',
      },
      fontFamily: { ...theme.theme.extend.fontFamily, sans: ['"Inter Variable"', ...theme.theme.extend.fontFamily['body-md']] }, // @fontsource registers Inter as "Inter Variable",
      // DESIGN.md: page transitions must not exceed 150ms.
      transitionDuration: { DEFAULT: '120ms' },
    },
  },
  plugins: [],
}
