import './styles/nocturne.css';
import { HeroEngine } from './engine/HeroEngine';
import { FleetCatalog } from './components/FleetCatalog';
import { ContactPortal } from './components/ContactPortal';
import { StatsCounter } from './components/StatsCounter';
import { ScrollAnimations } from './components/ScrollAnimations';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Navigation handling
  initNavigation();

  // 2. Preloader entry handling
  initPreloader();

  // 3. Initialize Hero Engine
  const heroEngine = new HeroEngine('heroCanvas', 'hero');
  await heroEngine.start();
  (window as any).heroEngine = heroEngine;

  // 4. Initialize Fleet Catalog
  const fleetCatalog = new FleetCatalog();
  fleetCatalog.init();

  // 5. Initialize Contact Portal Form
  const contactPortal = new ContactPortal();
  contactPortal.init();

  // 6. Initialize Stats
  const statsCounter = new StatsCounter();
  statsCounter.init();

  // 7. Initialize GSAP ScrollTrigger reveals
  ScrollAnimations.init();
});

function initNavigation(): void {
  const nav = document.getElementById('siteNav');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileNav = document.getElementById('mobileNav');
  const mobileLinks = document.querySelectorAll('.mobile-nav-links a');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      nav?.classList.add('scrolled');
    } else {
      nav?.classList.remove('scrolled');
    }
  }, { passive: true });

  if (hamburgerBtn && mobileNav) {
    hamburgerBtn.addEventListener('click', () => {
      const isOpen = hamburgerBtn.classList.toggle('active');
      mobileNav.classList.toggle('open', isOpen);
      hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : 'auto';
    });

    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        hamburgerBtn.classList.remove('active');
        mobileNav.classList.remove('open');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = 'auto';
      });
    });
  }
}

function initPreloader(): void {
  const loader = document.getElementById('loader');
  const enterBtn = document.getElementById('enterBtn');

  if (enterBtn && loader) {
    enterBtn.addEventListener('click', () => {
      loader.classList.add('loaded');
      document.body.style.overflow = 'auto';
    });
  }

  // Graceful fallback
  setTimeout(() => {
    if (enterBtn && !enterBtn.classList.contains('active')) {
      enterBtn.classList.add('active');
      const status = document.querySelector('.loader-status');
      if (status) status.textContent = 'READY — CLICK TO ENTER';
    }
  }, 4000);
}
