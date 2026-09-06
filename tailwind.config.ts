import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      screens: {
        short: { raw: "(max-height: 780px)" },
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        jade: {
          DEFAULT: "hsl(var(--jade))",
          light: "hsl(var(--jade-light))",
          soft: "hsl(var(--jade-soft))",
        },
        terracotta: {
          DEFAULT: "hsl(var(--terracotta))",
          light: "hsl(var(--terracotta-light))",
        },
        gold: {
          DEFAULT: "hsl(var(--gold))",
          bright: "hsl(var(--gold-bright))",
        },
        cream: "hsl(var(--cream))",
        gallery: {
          canvas: "hsl(var(--gallery-canvas))",
          ink: "hsl(var(--gallery-ink))",
          caption: "hsl(var(--gallery-caption))",
        },
        hero: {
          text: "hsl(var(--hero-text))",
        },
        trade: {
          banner: "hsl(var(--trade-banner))",
          "banner-line": "hsl(var(--trade-banner-line))",
        },
        whatsapp: "hsl(var(--whatsapp))",
        "pdf-red": "hsl(var(--pdf-red))",
        success: "hsl(var(--success))",
        info: "hsl(var(--info))",
        warning: "hsl(var(--warning))",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        DEFAULT: "0px",
        sm: "0px",
        md: "0px",
        lg: "0px",
        xl: "0px",
        "2xl": "0px",
        "3xl": "0px",
        control: "var(--radius-control)",
        sheet: "var(--radius-sheet)",
        "luxury-sharp": "0px",
        "luxury-micro": "2px",
        "luxury-sheet": "12px",
      },

      fontFamily: {
        display: ["Instrument Serif", "Georgia", "serif"],
        serif: ["Instrument Serif", "Georgia", "serif"],
        brand: ["Cinzel", "Georgia", "serif"],
        body: ["Work Sans", "Arial", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
            opacity: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
            opacity: "1",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
            opacity: "1",
          },
          to: {
            height: "0",
            opacity: "0",
          },
        },
        "fade-in": {
          "0%": {
            opacity: "0",
            transform: "translateY(20px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "slide-in": {
          "0%": {
            opacity: "0",
            transform: "translateX(-20px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateX(0)",
          },
        },
        "pulse-glow": {
          "0%, 100%": {
            boxShadow: "0 0 0 0 hsl(var(--primary) / 0)",
          },
          "50%": {
            boxShadow: "0 0 12px 2px hsl(var(--primary) / 0.3)",
          },
        },
        "pulse-fade": {
          "0%, 100%": {
            opacity: "0.5",
          },
          "50%": {
            opacity: "1",
          },
        },
        "text-glow-pulse": {
          "0%, 100%": {
            textShadow: "0 0 0 hsl(var(--accent) / 0)",
            opacity: "0.75",
          },
          "50%": {
            textShadow: "0 0 5px hsl(var(--accent) / 0.18)",
            opacity: "0.88",
          },
        },
        "expand-hint": {
          "0%, 100%": {
            opacity: "0.6",
            transform: "scale(1)",
          },
          "50%": {
            opacity: "1",
            transform: "scale(1.18)",
          },
        },
        "card-shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "cta-shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "scroll-cue": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "20%": { opacity: "1" },
          "80%": { opacity: "1" },
          "100%": { transform: "translateY(340%)", opacity: "0" },
        },
        // Slow, low-contrast sweep for the curatorial skeleton canvas.
        "curator-sweep": {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.3s ease-out",
        "accordion-up": "accordion-up 0.3s ease-out",
        "fade-in": "fade-in 0.6s ease-out",
        "slide-in": "slide-in 0.5s ease-out",
        "pulse-fade": "pulse-fade 2.5s ease-in-out infinite",
        "pulse-glow": "pulse-glow 10s ease-in-out infinite",
        "text-glow-pulse": "text-glow-pulse 16s ease-in-out infinite",
        "expand-hint": "expand-hint 1s ease-in-out 3",
        "card-shimmer": "card-shimmer 1.6s ease-in-out infinite",
        "cta-shimmer": "cta-shimmer 1.2s ease-in-out both",
        "curator-sweep": "curator-sweep 2.2s ease-in-out infinite",
        "scroll-cue": "scroll-cue 3.2s cubic-bezier(0.4,0,0.2,1) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
