import type { Config } from "tailwindcss";
import { fontFamily } from 'tailwindcss/defaultTheme';

const config: Config = {
  darkMode: 'class',                     // toggled via <html class="dark">
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* neutral surfaces */
        bg          : 'hsl(var(--bg) / <alpha-value>)',
        surface     : 'hsl(var(--surface) / <alpha-value>)',
        'surface-2' : 'hsl(var(--surface-2) / <alpha-value>)',
        border      : 'hsl(var(--border) / <alpha-value>)',
        text        : 'hsl(var(--text) / <alpha-value>)',
        muted       : 'hsl(var(--muted-text) / <alpha-value>)',

        /* brand + accent */
        primary     : 'hsl(var(--primary) / <alpha-value>)',
        'on-primary': 'hsl(var(--primary-on) / <alpha-value>)',
        secondary   : 'hsl(var(--secondary) / <alpha-value>)',
        'on-secondary':'hsl(var(--secondary-on) / <alpha-value>)',
      },

      borderRadius: {
        xs : 'var(--radius-xs)',
        DEFAULT: 'var(--radius)',
        lg : 'var(--radius-lg)',
      },

      boxShadow: {
        sm : 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        lg : 'var(--shadow-lg)',
        glass: '0 4px 30px hsl(220 50% 2% / 0.25)',      // extra bloom for glass overlays
      },

      backdropBlur: {
        glass: 'var(--glass-blur)',
      },

      spacing: {
        1 : 'var(--space-1)',
        2 : 'var(--space-2)',
        3 : 'var(--space-3)',
        4 : 'var(--space-4)',
        5 : 'var(--space-5)',
        6 : 'var(--space-6)',
      },

      fontFamily: {
        sans: ['Inter', ...fontFamily.sans],
      },
    },
  },
  plugins: [
    /**
     * Component primitives — usable immediately via @apply.
     * They compile to CSS once, avoiding runtime overhead.
     */
    function ({ addComponents, theme }: any) {
      addComponents({
        /* === Buttons ======================================= */
        '.btn': {
          '@apply inline-flex items-center justify-center gap-2 font-medium transition active:scale-[.98] focus-visible:outline-none': {},
          padding: `${theme('spacing.3')} ${theme('spacing.4')}`,
          borderRadius: theme('borderRadius.DEFAULT'),
        },
        '.btn-primary': {
          '@apply btn text-on-primary bg-primary hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/50': {},
        },
        '.btn-secondary': {
          '@apply btn text-on-secondary bg-secondary hover:bg-secondary/90 focus-visible:ring-2 focus-visible:ring-secondary/40': {},
        },

        /* === Cards ========================================= */
        '.card': {
          '@apply bg-surface text-text border border-border shadow rounded-lg': {},
          padding: theme('spacing.5'),
        },

        /* === Glass overlay (e.g. nav, modal) =============== */
        '.glass': {
          '@apply backdrop-blur-glass shadow-glass border border-border': {},
          backgroundColor: 'hsl(var(--glass-bg))',
        },

        /* === Input ========================================= */
        '.input': {
          '@apply w-full bg-surface-2 text-text placeholder:opacity-60 border border-border rounded-md focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none transition': {},
          padding: `${theme('spacing.3')} ${theme('spacing.4')}`,
        },
      });
    },
  ],
};

export default config;
