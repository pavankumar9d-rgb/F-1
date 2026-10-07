# NOCTURNE APEX — Midnight Formula 1 Proving Ground

**Nocturne Apex** is a private, nocturnal high-performance Formula 1 proving ground and skunkworks engineering club. Built with **Vite + TypeScript**, it completely replaces the previous coastal/Riviera reference with an ultra-focused midnight testing theme: Singapore/Las Vegas style floodlit asphalt circuits, subterranean skunkworks assembly bays, supersonic laser wind tunnels, and mission control telemetry bunkers with **zero water or marine distractions**.

---

## ⚡ Tech Stack & Architecture

- **Bundler & Dev Server**: Vite 5
- **Language**: TypeScript 5 (Strict Mode, 100% strongly typed with zero TS compile errors)
- **Scrubbing Engine**: `src/engine/HeroEngine.ts`
  - 24 fps, 1,200 WebP frames with adaptive tiers (`2k`, `1080`, `720`).
  - Dual-frame crossfade (`current - Math.floor(current)`).
  - Pinned coarse set fallback from `frames-720` ensuring the canvas never blanks or sticks.
  - Sliding window memory eviction with `ImageBitmap.close()` capped within 350 MB.
  - Live HUD telemetry (4-digit frame counter, timecode, speed gauge, and chapter drift).
- **Component Modules**:
  - `src/components/FleetCatalog.ts` (8 nocturnal prototypes, live filters, sorting, booking dispatcher)
  - `src/components/ContactPortal.ts` (Typed form validation and confirmation modal)
  - `src/components/StatsCounter.ts` (IntersectionObserver animated counters)
  - `src/components/ScrollAnimations.ts` (GSAP ScrollTrigger reveals)
  - `src/types/index.ts` (Shared data models and interfaces)
- **Styling**: `src/styles/nocturne.css` (Matte black, raw carbon, 24K gold, procedural film grain)

---

## 🏎️ Zero-Water Curated Assets

All previous yacht, pool, coastal, and marina imagery have been completely eliminated and replaced with bespoke, high-craft nocturnal motorsport assets:
- `assets/images/apex-circuit.jpg` (Midnight Formula 1 Grand Prix circuit under floodlights)
- `assets/images/apex-hangar.jpg` (Subterranean skunkworks engineering garage)
- `assets/images/apex-windtunnel.jpg` (Supersonic aerodynamic laser wind tunnel)
- `assets/images/apex-telemetry.jpg` (Mission control multi-screen telemetry bunker)
- `assets/images/apex-quarters.jpg` (Brutalist concrete driver sanctuary suite)

---

## 🚀 Running Locally

```bash
# Install dependencies
npm install

# Start Vite dev server (runs on http://localhost:5173)
npm run dev

# Typecheck and build for production
npm run build

# Preview production build
npm run preview
```
