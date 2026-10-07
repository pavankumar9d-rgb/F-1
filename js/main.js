/**
 * OBSIDIAN GP — Main Application Controller
 * Handles:
 * - GSAP ScrollTrigger section reveals (hero excluded as specified)
 * - Navigation blur & responsive mobile menu
 * - Loader lifecycle and "TAP TO ENTER"
 * - The Grid: 8 curated cars data, filtering & sorting, "Book" pre-selection
 * - The Arrival video IntersectionObserver autoplay
 * - Animated Stats counters
 * - Client-side form validation & submission state
 */

// 1. Curated Cars Dataset (Single source of truth)
const CARS_DATA = [
  {
    id: 'obsidian-01',
    name: 'Obsidian 01',
    livery: 'Matte Carbon & Gold',
    category: 'Hybrid V6',
    hp: '1,000 HP',
    spec: '1,000 HP • 0-100 in 2.4s • 350 KM/H',
    price: 3800,
    img: 'assets/images/grid-01-obsidian.jpg'
  },
  {
    id: 'crimson-02',
    name: 'Crimson 02',
    livery: 'Rosso Corsa & Obsidian',
    category: 'Hybrid V6',
    hp: '980 HP',
    spec: '980 HP • 0-100 in 2.5s • 348 KM/H',
    price: 4200,
    img: 'assets/images/grid-02-red.jpg'
  },
  {
    id: 'silver-03',
    name: 'Silver 03',
    livery: 'Liquid Silver & Titanium',
    category: 'V8 Classic',
    hp: '850 HP',
    spec: '850 HP • 0-100 in 2.7s • 335 KM/H',
    price: 3400,
    img: 'assets/images/grid-03-silver.jpg'
  },
  {
    id: 'papaya-04',
    name: 'Papaya 04',
    livery: 'Monaco Papaya & Carbon',
    category: 'Hybrid V6',
    hp: '990 HP',
    spec: '990 HP • 0-100 in 2.4s • 352 KM/H',
    price: 3900,
    img: 'assets/images/grid-04-orange.jpg'
  },
  {
    id: 'verde-05',
    name: 'Verde 05',
    livery: 'British Racing Green & Gold',
    category: 'Simulator Included',
    hp: '850 HP',
    spec: '850 HP • Full Motion Sim Rig • 340 KM/H',
    price: 2600,
    img: 'assets/images/grid-05-green.jpg'
  },
  {
    id: 'royal-06',
    name: 'Royal 06',
    livery: 'Côte d’Azur Blue & Pearl',
    category: 'Hybrid V6',
    hp: '1,020 HP',
    spec: '1,020 HP • 0-100 in 2.3s • 355 KM/H',
    price: 4100,
    img: 'assets/images/grid-06-blue.jpg'
  },
  {
    id: 'blanc-07',
    name: 'Blanc 07',
    livery: 'Alpine Ice White & Gloss Onyx',
    category: 'V8 Classic',
    hp: '820 HP',
    spec: '820 HP • Naturally Aspirated V8 • 330 KM/H',
    price: 3100,
    img: 'assets/images/grid-07-white.jpg'
  },
  {
    id: 'giallo-08',
    name: 'Giallo 08',
    livery: 'Modena Gold & Raw Kevlar',
    category: 'Simulator Included',
    hp: '780 HP',
    spec: '780 HP • Hydraulic Telemetry Pod • 325 KM/H',
    price: 1900,
    img: 'assets/images/grid-08-yellow.jpg'
  }
];

document.addEventListener('DOMContentLoaded', () => {
  initLoader();
  initNav();
  initGrid();
  initArrivalVideo();
  initStats();
  initContactForm();
  initGSAPScrollReveals();
});

/* =====================================================================
   1. LOADER & ENTER EXPERIENCE
   ===================================================================== */
function initLoader() {
  const loader = document.getElementById('loader');
  const enterBtn = document.getElementById('enterBtn');

  if (enterBtn && loader) {
    enterBtn.addEventListener('click', () => {
      loader.classList.add('loaded');
      document.body.style.overflow = 'auto';
      // Trigger a gentle scroll update
      if (window.heroEngine) {
        window.heroEngine.updateScrollTarget();
      }
    });
  }

  // Fallback timeout in case asset loading takes long
  setTimeout(() => {
    if (enterBtn && !enterBtn.classList.contains('active')) {
      enterBtn.classList.add('active');
      const status = document.querySelector('.loader-status');
      if (status) status.textContent = 'READY — CLICK TO ENTER';
    }
  }, 4000);
}

/* =====================================================================
   2. NAVIGATION & MOBILE MENU
   ===================================================================== */
function initNav() {
  const nav = document.getElementById('siteNav');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileNav = document.getElementById('mobileNav');
  const mobileLinks = document.querySelectorAll('.mobile-nav-links a');

  // Sticky blur on scroll
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }, { passive: true });

  // Mobile menu toggle
  if (hamburgerBtn && mobileNav) {
    hamburgerBtn.addEventListener('click', () => {
      const isOpen = hamburgerBtn.classList.toggle('active');
      mobileNav.classList.toggle('open', isOpen);
      hamburgerBtn.setAttribute('aria-expanded', isOpen);
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

/* =====================================================================
   3. THE GRID: FLEET DISPLAY, SORTING & FILTERING
   ===================================================================== */
function initGrid() {
  const container = document.getElementById('carsGridContainer');
  const filterChips = document.querySelectorAll('.filter-chip');
  const sortSelect = document.getElementById('sortSelect');
  const carSelectDropdown = document.getElementById('carSelect');

  let currentCategory = 'all';
  let currentSort = 'featured';

  // Populate contact form car select dropdown
  if (carSelectDropdown) {
    carSelectDropdown.innerHTML = '<option value="">-- Choose Your Car --</option>';
    CARS_DATA.forEach(car => {
      const opt = document.createElement('option');
      opt.value = car.name;
      opt.textContent = `${car.name} (${car.hp}) — €${car.price.toLocaleString()} / session`;
      carSelectDropdown.appendChild(opt);
    });
  }

  function renderCards() {
    if (!container) return;

    // Filter
    let filtered = CARS_DATA.filter(car => {
      if (currentCategory === 'all') return true;
      return car.category === currentCategory;
    });

    // Sort
    if (currentSort === 'price-asc') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (currentSort === 'price-desc') {
      filtered.sort((a, b) => b.price - a.price);
    } else {
      // featured default order
      filtered.sort((a, b) => CARS_DATA.indexOf(a) - CARS_DATA.indexOf(b));
    }

    container.innerHTML = '';
    filtered.forEach(car => {
      const card = document.createElement('div');
      card.className = 'car-card';
      card.innerHTML = `
        <div class="card-img-wrap">
          <img src="${car.img}" alt="${car.name}" class="card-img" loading="lazy" width="400" height="300">
          <span class="card-badge">${car.category}</span>
        </div>
        <div class="card-body">
          <h3 class="card-name">${car.name}</h3>
          <span class="card-livery">${car.livery}</span>
          <p class="card-specs">${car.spec}</p>
          <div class="card-footer">
            <div class="card-price-row">
              <span class="price-prefix">From</span>
              <span class="price-val">€${car.price.toLocaleString()} <small style="font-size:0.7em;font-weight:400;color:var(--muted)">/ session</small></span>
            </div>
            <div class="card-actions">
              <button type="button" class="btn btn-primary btn-sm book-car-btn" data-car="${car.name}">Book</button>
              <a href="https://wa.me/000000000?text=Hello%20Obsidian%20GP%2C%20I%20wish%20to%20inquire%20about%20booking%20the%20${encodeURIComponent(car.name)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">WhatsApp</a>
            </div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    // Attach Book button handlers
    container.querySelectorAll('.book-car-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const carName = e.currentTarget.getAttribute('data-car');
        const contactSec = document.getElementById('contact');
        if (contactSec) {
          contactSec.scrollIntoView({ behavior: 'smooth' });
          if (carSelectDropdown) {
            carSelectDropdown.value = carName;
            carSelectDropdown.focus();
            carSelectDropdown.style.borderColor = 'var(--gold)';
            setTimeout(() => {
              carSelectDropdown.style.borderColor = '';
            }, 1800);
          }
        }
      });
    });
  }

  // Filter click handlers
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.getAttribute('data-filter');
      renderCards();
    });
  });

  // Sort change handler
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderCards();
    });
  }

  renderCards();
}

/* =====================================================================
   4. THE ARRIVAL: INTERSECTION OBSERVER VIDEO AUTOPLAY
   ===================================================================== */
function initArrivalVideo() {
  const arrivalVideo = document.getElementById('storyVideo');
  if (!arrivalVideo) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        arrivalVideo.play().catch(() => {});
      } else {
        arrivalVideo.pause();
      }
    });
  }, { threshold: 0.25 });

  observer.observe(arrivalVideo);
}

/* =====================================================================
   5. STATS COUNTER ANIMATION
   ===================================================================== */
function initStats() {
  const statNumbers = document.querySelectorAll('.stat-num');
  if (!statNumbers.length) return;

  let animated = false;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !animated) {
        animated = true;
        statNumbers.forEach(el => {
          const raw = el.getAttribute('data-target') || el.textContent.trim();
          if (raw === '8') animateValue(el, 0, 8, 1200, '');
          else if (raw === '24/7') animateValue(el, 0, 24, 1200, '/7');
          else if (raw === '3') animateValue(el, 0, 3, 1000, '');
          else if (raw === '100%') animateValue(el, 0, 100, 1500, '%');
        });
      }
    });
  }, { threshold: 0.3 });

  const statsSection = document.getElementById('stats');
  if (statsSection) observer.observe(statsSection);
}

function animateValue(elem, start, end, duration, suffix = '') {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const easeOutQuad = 1 - (1 - progress) * (1 - progress);
    const current = Math.floor(easeOutQuad * (end - start) + start);
    elem.textContent = current + suffix;
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      elem.textContent = end + suffix;
    }
  };
  window.requestAnimationFrame(step);
}

/* =====================================================================
   6. CONTACT / ACCESS REQUEST FORM VALIDATION & SUBMISSION
   ===================================================================== */
function initContactForm() {
  const form = document.getElementById('accessRequestForm');
  const successBox = document.getElementById('formSuccessBox');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let isValid = true;

    // 1. Name
    const nameInput = document.getElementById('fullName');
    const nameGroup = nameInput.closest('.form-group');
    if (!nameInput.value.trim() || nameInput.value.trim().length < 2) {
      nameGroup.classList.add('has-error');
      nameInput.setAttribute('aria-invalid', 'true');
      isValid = false;
    } else {
      nameGroup.classList.remove('has-error');
      nameInput.setAttribute('aria-invalid', 'false');
    }

    // 2. Email
    const emailInput = document.getElementById('emailAddress');
    const emailGroup = emailInput.closest('.form-group');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.value.trim())) {
      emailGroup.classList.add('has-error');
      emailInput.setAttribute('aria-invalid', 'true');
      isValid = false;
    } else {
      emailGroup.classList.remove('has-error');
      emailInput.setAttribute('aria-invalid', 'false');
    }

    // 3. Phone
    const phoneInput = document.getElementById('phoneNumber');
    const phoneGroup = phoneInput.closest('.form-group');
    if (!phoneInput.value.trim() || phoneInput.value.trim().length < 6) {
      phoneGroup.classList.add('has-error');
      phoneInput.setAttribute('aria-invalid', 'true');
      isValid = false;
    } else {
      phoneGroup.classList.remove('has-error');
      phoneInput.setAttribute('aria-invalid', 'false');
    }

    // 4. Car Select
    const carSelect = document.getElementById('carSelect');
    const carGroup = carSelect.closest('.form-group');
    if (!carSelect.value) {
      carGroup.classList.add('has-error');
      carSelect.setAttribute('aria-invalid', 'true');
      isValid = false;
    } else {
      carGroup.classList.remove('has-error');
      carSelect.setAttribute('aria-invalid', 'false');
    }

    if (isValid) {
      // Simulate successful dispatch
      form.style.display = 'none';
      if (successBox) {
        successBox.classList.add('active');
        const summary = document.getElementById('successSummary');
        if (summary) {
          summary.textContent = `Invitation dispatched for ${nameInput.value.trim()} • Reserved Chassis: ${carSelect.value}. Concierge will contact you within 2 hours.`;
        }
      }
    }
  });
}

/* =====================================================================
   7. GSAP SCROLL REVEALS (Pinned CDN version, HERO EXCLUDED)
   ===================================================================== */
function initGSAPScrollReveals() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    console.warn('GSAP or ScrollTrigger not loaded. Section reveals fallback to CSS.');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // Targets for section reveal animation: fade + 24px rise, 80ms stagger, once
  const revealSections = [
    '#garage',
    '#grid',
    '#arrival',
    '#stats',
    '#membership',
    '#steps',
    '#residence',
    '#requirements',
    '#reviews',
    '#contact',
    '#footer'
  ];

  revealSections.forEach(selector => {
    const sec = document.querySelector(selector);
    if (!sec) return;

    const revealItems = sec.querySelectorAll('.reveal-up');
    if (revealItems.length) {
      gsap.from(revealItems, {
        scrollTrigger: {
          trigger: sec,
          start: 'top 85%',
          toggleActions: 'play none none none',
          once: true
        },
        y: 24,
        opacity: 0,
        duration: 0.85,
        stagger: 0.08,
        ease: 'power3.out'
      });
    }
  });
}
