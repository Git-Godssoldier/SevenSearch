# Opulentia Color System: Definitive Guide

## Overview
This document details how the Opulentia color palette is applied across the codebase, extending far beyond simple Tailwind and `globals.css` alterations. It covers the rationale, implementation, and best practices for using the color system in all UI features and elements, ensuring a cohesive, premium, and accessible brand experience.

---

## 1. The Core Palette

### 1.1 Neutral Scale
A unified neutral scale provides consistent, predictable steps for backgrounds, borders, and UI elements:

| Token | Value | Source | Usage | WCAG Pairing |
|---|---|---|---|---|
| `neutral-100` | `#000000` | CB Black 100% | Absolute darkest backgrounds, deep overlays | `foreground`, `labelColor`, `brand-blue` |
| `neutral-90` | `#262626` | CB Black 60% | Page backgrounds (replaces `background`) | Same as above |
| `neutral-80` | `#404040` | CB Grey 80% | Card backgrounds (replaces `textbg`), chat bubbles | `labelColor` (AA 4.9:1) |
| `neutral-60` | `#666666` | CB Grey 60% | Borders, grid lines (replaces `gridColor`), disabled fills | `controlText`, `secondaryLabel` |
| `neutral-40` | `#999999` | Warm Grey 40% | Input strokes, dividers | `controlText` |
| `neutral-30` | `#B3B3B3` | Warm Grey 30% | Hover states on dark surfaces | `labelColor` |
| `neutral-20` | `#CCCCCC` | Warm Grey 20% | Subtle fills (replaces `quaternaryLabel`), card inset shadows | N/A (decorative) |
| `neutral-10` | `#E6E6E6` | Warm Grey 10% | Inset separators, outlines | N/A |
| `neutral-05` | `#F2F2F2` | Warm Grey 5% | Hair-line borders, table row stripes | N/A |
| `neutral-02` | `#FAFAFA` | 4% PPT White | Scrim for modal backdrops, frosted panels | N/A |

### 1.2 Brand Accents

| Token | Value | Source | Usage |
|---|---|---|---|
| `brand-blue` | `#3586FF` | World Blue | Primary brand color for links, focus rings, CTAs, and key interactions |
| `brand-blue-700` | `#255EB3` | 70% brand-blue + 30% black | Selection highlights, secondary interactions |

### 1.3 Semantic Mapping
These token mappings ensure backward compatibility while moving to the new system:

| Previous Token | New Token | Notes |
|---|---|---|
| `background` | `neutral-90` | Slightly higher contrast base |
| `textbg` | `neutral-80` | Card backgrounds, form elements |
| `gridColor` | `neutral-60` | Grid lines, borders |
| `quaternaryLabel` | `neutral-20/50` | Very subtle labels and decorations |
| `linkColor` | `brand-blue` | Links and interactive elements |
| `selectControl` | `brand-blue-700` | Selected UI controls |
| `foreground` | remains `#FFFFFF` | Primary text color |
| `labelColor` | remains `#FFFFFF` | Primary label text |

**Legacy palette tokens (maintained for compatibility but will be phased out):**
- `black` (`#000000`): Deep backgrounds, canvas, and sidebar
- `white` (`#FFFFFF`): Card backgrounds, popovers
- `bianca` (`#FBF7F0`): Highlight, premium text, soft backgrounds
- `teal` (`#183C4A`): Accents, some text, and icons
- `lilac` (`#F0EDF9`): Subtle backgrounds, info, and accents
- `purple` (`#4940E0`): Primary CTAs, focus rings, highlights
- `darkgrey` (`#626467`): Muted text, secondary info
- `mediumgrey` (`#DADADA`): Borders, subtle backgrounds
- `lightgrey` (`#F2F2F2`): Inputs, light backgrounds
- `lightbg` (`#F9F9F9`): Muted, ultra-light backgrounds

---

## 2. Tailwind & globals.css

### 2.1 Tailwind Configuration

The colors are defined in `tailwind.config.js` as RGB values to enable alpha transparency:

```js
// tailwind.config.js
extend: {
  colors: {
    neutral: {
      2:  'rgb(var(--neutral-02) / <alpha-value>)',
      5:  'rgb(var(--neutral-05) / <alpha-value>)',
      10: 'rgb(var(--neutral-10) / <alpha-value>)',
      20: 'rgb(var(--neutral-20) / <alpha-value>)',
      30: 'rgb(var(--neutral-30) / <alpha-value>)',
      40: 'rgb(var(--neutral-40) / <alpha-value>)',
      60: 'rgb(var(--neutral-60) / <alpha-value>)',
      80: 'rgb(var(--neutral-80) / <alpha-value>)',
      90: 'rgb(var(--neutral-90) / <alpha-value>)',
      100: 'rgb(var(--neutral-100) / <alpha-value>)',
    },
    brand: {
      blue:  'rgb(var(--brand-blue) / <alpha-value>)',
      'blue-700': 'rgb(var(--brand-blue-700) / <alpha-value>)',
    },
  },
}
```

### 2.2 CSS Variables

In `globals.css`, these colors are defined as RGB components for optimal alpha transparency support:

```css
:root {
  /* Brand colors */
  --brand-blue: 53 134 255; /* World Blue */
  --brand-blue-700: 37 94 179; /* Generated via color-mix */

  /* Neutral scale */
  --neutral-100: 0 0 0; /* CB Black 100% */
  --neutral-90: 38 38 38; /* CB Black 60% */
  --neutral-80: 64 64 64; /* CB Grey 80% */
  --neutral-60: 102 102 102; /* CB Grey 60% */
  --neutral-40: 153 153 153; /* Warm Grey 40% */
  --neutral-30: 179 179 179; /* Warm Grey 30% */
  --neutral-20: 204 204 204; /* Warm Grey 20% */
  --neutral-10: 230 230 230; /* Warm Grey 10% */
  --neutral-05: 242 242 242; /* Warm Grey 5% */
  --neutral-02: 250 250 250; /* 4% PPT White */
  
  /* Legacy mappings for backward compatibility */
  --background: rgb(var(--neutral-90));
  --foreground: 255 255 255;
  --text: 255 255 255;
  --textbg: rgb(var(--neutral-80));
  /* etc. */
}
```

### 2.3 Utility Features

- **Alpha transparency** is now handled consistently with the `/` notation (e.g., `bg-neutral-20/50` for 50% opacity)
- **Hover/active states** are derived from base colors using modifiers rather than separate tokens
- **Borders** follow a consistent pattern: `border-neutral-40` (standard), `border-neutral-60` (strong), `border-neutral-20` (subtle)
- **Dark mode** utilities work seamlessly with this system thanks to the RGB variable format

---

## 3. Application to Page Features & Elements

### 3.1. Headers & Section Titles
- **Class:** `text-foreground` or `text-white` for maximum contrast and premium feel.
- **Usage:** All major section headers (e.g., "Capabilities", "Pricing", "Use Cases") use this color for consistency.
- **Rationale:** Ensures legibility and brand consistency across all backgrounds.

### 3.2. Cards (Features, Pricing, Testimonials)
- **Background:** `bg-neutral-90` or `bg-neutral-80` for a dark, professional look.
- **Border:** `border-neutral-60` or `border-neutral-40` for subtle separation.
- **Header Text:** `text-white` or `text-foreground` for titles.
- **Body Text:** `text-foreground/85` for descriptions and details.
- **Accent/Highlight:** Use `bg-brand-blue/20`, `bg-brand-blue-700/20`, or `bg-neutral-20/10` for subtle accents.
- **Example:**
  ```tsx
  <Card className="bg-neutral-80 border-neutral-60 ...">
    <CardTitle className="text-foreground">AGENT ORCHESTRATION</CardTitle>
    <p className="text-foreground/85">Coordinated Multi-Agent Intelligence...</p>
  </Card>
  ```

### 3.3. Pricing Section
- **Plan Name & Price:** `text-foreground` for a premium, clean highlight.
- **Plan Description & Features:** `text-foreground/85` for consistency with other body text.
- **Card Background:** `bg-neutral-80` for appropriate contrast and depth.
- **No "Popular" badge:** Spacing and clarity are prioritized.

### 3.4. Chat Components
- **Input Prompt ("Ask me anything"):** `text-foreground` for high contrast and approachability.
- **Chat Bubbles:**
  - User: `bg-brand-blue-700 text-foreground`
  - Assistant: `bg-neutral-80 text-foreground/85` (for clear distinction)
- **Avatars:** Use accent backgrounds (`bg-brand-blue`, `bg-brand-blue-700`) and `text-foreground` for initials.

### 3.5. Buttons & CTAs
- **Primary:** `bg-brand-blue text-foreground hover:bg-brand-blue/90`
- **Outline:** `border-neutral-40 text-foreground/85 hover:bg-neutral-40/10`
- **Subtle:** `bg-neutral-20/50 text-foreground/70` for less prominent actions.

### 3.6. Backgrounds & Decorative Elements
- **Section backgrounds:** Use systematic opacity values with palette colors (e.g., `bg-brand-blue/20`, `bg-neutral-20/30`).
- **Glow/Animated effects:** Use unified palette colors for animated gradients and glows (e.g., `GlowEffect` uses `['brand-blue', 'brand-blue-700', ...]`).
- **Grid overlays:** Use `neutral-60` for subtle texture and alignment guides.

### 3.7. Borders & Dividers
- **Standard borders:** `border-neutral-40` for general purpose 1px borders.
- **Strong borders:** `border-neutral-60` for emphasized separation.
- **Subtle borders:** `border-neutral-20` for minimal visual separation.
- **Usage:** Cards, section dividers, and input outlines.

### 3.8. Muted & Secondary Text
- **Standard muted:** `text-foreground/70` for secondary text.
- **More muted:** `text-foreground/50` for tertiary information.
- **Very muted:** `text-foreground/30` for decorative or background text.
- **Usage:** Subtitles, secondary info, and muted UI elements.

---

## 4. Component-Level & Inline Color Decisions

### 4.1 Component Color Patterns

- **FeatureCard, PricingCard, UseCaseCard:** Replace legacy color classes with neutral scale and brand colors:
  ```tsx
  // Before
  <Card className="bg-textbg border-gridColor">
  
  // After
  <Card className="bg-neutral-80 border-neutral-40">
  ```

- **Icons:** Use the brand color system consistently:
  ```tsx
  // Before
  <Icon className="text-linkColor" />
  <Icon className="text-selectControl" />
  <Icon className="text-systemGrey" />
  
  // After
  <Icon className="text-brand-blue" />
  <Icon className="text-brand-blue-700" />
  <Icon className="text-neutral-30" />
  ```

- **GlowEffect, TextShimmer, TextMorph:** Update motion components to use RGB values:
  ```tsx
  // Before
  <GlowEffect colors={['#3586FF', '#314F78', '#FFFFFF', '#86868B']} />
  
  // After
  <GlowEffect colors={['rgb(var(--brand-blue))', 'rgb(var(--brand-blue-700))', 'rgb(var(--neutral-10))', 'rgb(var(--neutral-40))']} />
  ```

### 4.2 Color Application Guidelines

- **No direct hex codes:** All colors must reference semantic tokens or Tailwind classes for maintainability.
- **Opacities:** Use the native opacity modifiers (e.g., `brand-blue/20` instead of rgba).
- **Text colors:** Simplify by using `text-foreground` with opacity modifiers for hierarchy.
- **Borders:** Standardize on the three-tier system: `neutral-40` (standard), `neutral-60` (strong), `neutral-20` (subtle).

---

## 5. Extending the System

### 5.1 Adding New Components

- **Use neutral scale:** Prefer the neutral scale for structural elements and backgrounds:
  ```tsx
  <NewComponent className="bg-neutral-80 border-neutral-40 text-foreground" />
  ```

- **Brand moments:** Use brand colors sparingly and intentionally for emphasis or interaction.
  ```tsx
  <InteractiveElement className="bg-brand-blue hover:bg-brand-blue/90" />
  ```

### 5.2 Accessibility & Maintenance

- **WCAG compliance:** The neutral scale is designed for AA-compliance with our text colors.
- **Contrast checking:** When using foreground text on neutral-80, ensure it meets 4.5:1 ratio.
- **Theme compatibility:** All tokens work with Tailwind's dark mode utilities.
- **Color generation:** For tints/shades outside the pre-defined steps, use `color-mix()` in CSS.

---

## 6. Rationale & Best Practices

### 6.1 Unified Color Philosophy

- **Cognitive simplicity:** A single "neutral" ladder (02→100) reduces cognitive load for developers.
- **Predictable modifiers:** Using opacity for variants creates a more predictable system.
- **One brand accent:** Using World Blue as the single brand accent creates a stronger, more cohesive visual identity.
- **Systematic generation:** Deriving secondary colors like `brand-blue-700` creates a consistent relationship between colors.

### 6.2 Best Practices

- **Border consistency:** Choose the right neutral step for your border needs.
- **Text hierarchy:** Create hierarchy with opacity rather than different colors.
- **Alpha values:** Be consistent with opacity steps (e.g., 90%, 70%, 50%, 30%, 10%).
- **Semantic meaning:** Choose colors based on their semantic meaning, not just aesthetics.

---

## 7. Example: Adding a New Feature Card

```tsx
<Card className="bg-neutral-80 border-neutral-40 shadow-sm">
  <CardHeader>
    <CardTitle className="text-foreground">NEW FEATURE</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-foreground/85">Description of the new feature...</p>
    <Button className="bg-brand-blue text-foreground hover:bg-brand-blue/90">
      Learn More
    </Button>
  </CardContent>
</Card>
```

---

## 8. Summary Table
| UI Element         | Background         | Header Text         | Body Text             | Border/Accent         |
|-------------------|-------------------|---------------------|-----------------------|-----------------------|
| Section Header    | transparent       | text-foreground     |                       |                       |
| Card (Feature)    | bg-neutral-80     | text-foreground     | text-foreground/85    | border-neutral-40     |
| Card (Pricing)    | bg-neutral-80     | text-foreground     | text-foreground/85    | border-neutral-40     |
| Card (Use Case)   | bg-neutral-80     | text-foreground     | text-foreground/85    | border-neutral-60     |
| Button (Primary)  | bg-brand-blue     | text-foreground     |                       |                       |
| Button (Outline)  | transparent       | text-foreground/85  |                       | border-neutral-40     |
| Chat Input        | transparent       | text-foreground     |                       |                       |
| Muted/Secondary   |                   |                     | text-foreground/70    |                       |

---

## 9. Opacity Reference Chart

The following opacity levels are used throughout the system for text and UI elements:

| Opacity | Value | Use Case |
|---------|-------|----------|
| 100%    | 1.0   | Primary text, main UI elements |
| 90%     | 0.9   | Hover states on brand colors |
| 85%     | 0.85  | Standard body text, card foreground |
| 70%     | 0.7   | Secondary text, muted UI |
| 50%     | 0.5   | Tertiary information, secondary labels |
| 30%     | 0.3   | Decorative elements, background text |
| 20%     | 0.2   | Subtle backgrounds, accents |
| 10%     | 0.1   | Very subtle effects, quaternary labels |

Apply these with Tailwind opacity modifiers:
```
text-foreground/85  /* 85% opacity text */
bg-brand-blue/20    /* 20% opacity background */
border-neutral-40/50 /* 50% opacity border */
```

---

## 10. Shadow System

Shadows create depth and hierarchy in the UI:

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-card` | `0 2px 12px rgba(0, 0, 0, 0.35)` | Cards, popups, elevated content |
| `--shadow-inner` | `inset 0 0 0 1px rgba(var(--neutral-20), 0.1)` | Inset shadows for depth |
| `--shadow-focus` | `0 0 0 3px rgba(var(--brand-blue), 0.25)` | Focus state indicators |

Apply via utility classes:
```
shadow-card    /* Card shadow */
shadow-inner   /* Inner shadow */
focus:ring-2   /* Focus ring using --ring color */
```

---

## 11. Migration Checklist

- [ ] Update `tailwind.config.js` with new color tokens
- [ ] Add RGB variables to `globals.css`
- [ ] Map legacy tokens to new neutral scale in `globals.css`
- [ ] Update component styles to use neutral scale and brand tokens
- [ ] Replace opacity hacks with proper Tailwind opacity modifiers
- [ ] Remove any hardcoded hex values from components
- [ ] Verify contrast ratios meet WCAG AA standards
- [ ] Update design system documentation in Figma

---

## 12. Final Notes
- Always use the neutral scale and brand colors for new code.
- Refer to this document when reviewing PRs or designing new features.
- Report any gaps in the system rather than creating one-off solutions.
- Update this guide as the design system evolves.

---

*This guide is living documentation. Update as the design system evolves.*