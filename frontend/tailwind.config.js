/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Brand / layout ──────────────────────────────────────
        nest: {
          bg:     '#EFF2F7',   // cool page background
          card:   '#FFFFFF',
          green:  '#E0F4EB',   // soft sage mint sensor card
          blue:   '#E8ECFC',   // soft periwinkle sensor card
          cream:  '#F8FAFB',   // insights panel
          border: '#DCE3EC',   // cool gray border
        },

        // ── Accent / action colors ───────────────────────────────
        accent: {
          DEFAULT: '#3B9E72',  // primary green
          light:   '#5CBD91',
          nav:     '#45B07E',
        },
        indigo: {
          accent: '#5A52E0',
        },

        // ── Semantic text tokens (use text-tx-* classes) ────────
        tx: {
          primary:   '#1E293B',   // slate-800  — headings, bold values
          secondary: '#334155',   // slate-700  — sub-headings, labels
          body:      '#475569',   // slate-600  — body / description text
          muted:     '#64748B',   // slate-500  — secondary captions
          faint:     '#94A3B8',   // slate-400  — placeholder / disabled
        },

        // ── Override Tailwind gray → cool slate-based palette ────
        // Replaces warm gray (#f9fafb…#111827) with blue-tinted slate
        // so every text-gray-* / bg-gray-* / border-gray-* auto-updates
        gray: {
          50:  '#F8FAFC',   // slate-50
          100: '#F1F5F9',   // slate-100
          200: '#E2E8F0',   // slate-200
          300: '#CBD5E1',   // slate-300
          400: '#94A3B8',   // slate-400 — secondary / muted labels
          500: '#64748B',   // slate-500 — medium text
          600: '#475569',   // slate-600 — body text
          700: '#334155',   // slate-700 — strong text
          800: '#1E293B',   // slate-800 — headings
          900: '#0F172A',   // slate-900 — dark headings
          950: '#020617',   // slate-950
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
