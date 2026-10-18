import theme from './tailwind.theme.json' with { type: 'json' }

// Token source: DESIGN.md / tailwind.theme.json (copied verbatim from the PRD folder).
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    ...theme.theme,
    extend: {
      ...theme.theme.extend,
      // Fluid headings: DESIGN.md sizes are the desktop maximum and scale down smoothly to a 360px phone.
      // Body sizes stay fixed so resident text never drops below 16px.
      fontSize: {
        ...theme.theme.extend.fontSize,
        'display-lg': ['clamp(1.75rem, 1.4rem + 1.6vw, 2.25rem)', theme.theme.extend.fontSize['display-lg'][1]],
        h1: ['clamp(1.5rem, 1.25rem + 1.1vw, 1.875rem)', theme.theme.extend.fontSize.h1[1]],
        h2: ['clamp(1.25rem, 1.1rem + 0.7vw, 1.5rem)', theme.theme.extend.fontSize.h2[1]],
        h3: ['clamp(1.125rem, 1.05rem + 0.35vw, 1.25rem)', theme.theme.extend.fontSize.h3[1]],
      },
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
