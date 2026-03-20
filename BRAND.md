# Well-Tailored Brand Style Guide

## Brand Core

| Attribute | Value |
|-----------|-------|
| Brand name | Well-Tailored |
| Short label | Tailored |
| Monogram | WT |
| CLI command | `tailored` |
| Home directory | `~/.well-tailored/` |
| Env var prefix | `TAILORED_` |

### Positioning

A polished, modern tool that helps people create better-fit job applications without sounding generic or artificial.

### Personality

Polished, modern, calm, premium, credible. Sharp without being stiff.

### Avoid

- Gimmicky AI aesthetics
- Loud startup neon palettes
- Cartoon menswear iconography
- Corporate-law-firm stiffness
- Anything that feels like generic HR SaaS

---

## Color System

### Primary Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `text` | `#2B2D33` | Primary text, wordmark |
| `background` | `#F8F5EE` | Main page background (ivory) |
| `surface` | `#FFFFFF` | Cards, elevated surfaces |
| `primary` | `#314A74` | CTAs, links, brand emphasis, icon |
| `primaryHover` | `#253857` | Hover/active states |
| `muted` | `#747986` | Secondary/muted text |
| `border` | `#E3DDD2` | Borders, dividers |

### Usage Rules

- Ivory (`#F8F5EE`) as main page background
- White for cards and elevated surfaces
- Charcoal for primary text and wordmarks
- Navy for important actions, links, and brand emphasis
- Muted gray only for secondary information
- Border for subtle structure instead of heavy shadows

---

## Typography

### Font Pairing

| Role | Family | Rationale |
|------|--------|-----------|
| Headings | Manrope | Modern, tailored, editorial feel |
| Body / UI | Inter | Highly readable and practical |

### Scale

| Element | Font | Weight | Size |
|---------|------|--------|------|
| H1 | Manrope | 700 | 48-56px |
| H2 | Manrope | 700 | 36-40px |
| H3 | Manrope | 600 | 28-32px |
| H4 | Manrope | 600 | 22-24px |
| Body Large | Inter | 400 | 18px |
| Body | Inter | 400 | 16px |
| Small / Muted | Inter | 400 | 14px |
| Buttons / Labels | Inter | 600 | 14-16px |

### Rules

- Keep headlines tight and confident
- Let spacing create the premium feel
- Avoid all-caps overuse
- Do not use serif fonts

---

## UI Components

### Buttons

#### Primary

| Property | Value |
|----------|-------|
| Background | `#314A74` |
| Text | `#FFFFFF` |
| Hover | `#253857` |
| Radius | 12px |
| Padding | 12px 18px |
| Font | Inter 600 |
| Shadow | Very subtle, if any |

Use for: main CTA, generate/tailor actions, save/export.

#### Secondary

| Property | Value |
|----------|-------|
| Background | `#FFFFFF` |
| Text | `#2B2D33` |
| Border | `#E3DDD2` |
| Radius | 12px |

Use for: secondary actions, preview, compare versions.

#### Text Button

| Property | Value |
|----------|-------|
| Text | `#314A74` |
| Background | transparent |
| Hover | Underline or subtle tint |

Use sparingly.

### Cards

| Property | Value |
|----------|-------|
| Background | `#FFFFFF` |
| Border | 1px solid `#E3DDD2` |
| Radius | 16px |
| Padding | 20-24px |
| Shadow | `0 8px 24px rgba(43, 45, 51, 0.06)` |

Cards should feel like good paper on a desk. Not floating glassmorphism, not dark-mode gamer UI, not default Tailwind cards.

### Inputs

| Property | Value |
|----------|-------|
| Background | `#FFFFFF` |
| Border | `#E3DDD2` |
| Text | `#2B2D33` |
| Placeholder | `#747986` |
| Focus | Softened navy outline |
| Radius | 10-12px |

---

## Layout Principles

- Generous whitespace
- Fewer, stronger visual elements
- Subtle structure over visual noise
- Premium editorial feel over dashboard clutter

---

## Theme Tokens

```ts
export const theme = {
  colors: {
    text: "#2B2D33",
    background: "#F8F5EE",
    surface: "#FFFFFF",
    primary: "#314A74",
    primaryHover: "#253857",
    muted: "#747986",
    border: "#E3DDD2",
  },
  fontFamily: {
    heading: ["Manrope", "sans-serif"],
    body: ["Inter", "sans-serif"],
  },
  radius: {
    sm: "10px",
    md: "12px",
    lg: "16px",
    xl: "20px",
  },
  shadow: {
    card: "0 8px 24px rgba(43, 45, 51, 0.06)",
  },
};
```

---

## Logo

### Direction

WT monogram with a subtle lapel-inspired cut or stitch line. Precise, geometric, refined, quietly distinctive.

### System

1. **Primary logo**: Icon + "Well-Tailored" wordmark
2. **Secondary logo**: Wordmark only
3. **App icon / favicon**: WT monogram only

### Color Use

| Element | Color |
|---------|-------|
| Icon | `#314A74` |
| Wordmark | `#2B2D33` |
| Background | `#F8F5EE` or white |

### Wordmark

"Well-Tailored" in Manrope. Title case, slightly open spacing, readable and practical.

### Do Not

- Full suit jacket icons
- Ties, bowties, or tuxedo clip art
- Top hats or cartoon monocles
- Fashion-magazine ultra-thin letterforms
- Glossy gradients or trendy AI glows
- Overly ornate luxury branding

### Style Rules

- No gradients
- No shiny effects
- No thin fashion-magazine hairlines
- No clip-art suit icons
- Clean geometry
- Medium stroke weight
- Balanced symmetry with one distinctive cut or angle
- Simple enough to draw in one color

---

## Hero Copy

**Headline**: Job applications that actually fit.

**Subhead**: Turn your experience and a job description into sharper, more tailored application materials without losing your voice.

**CTAs**: "Tailor my application" / "See an example"
