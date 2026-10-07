import { CarChassis } from '../types/index';

export const NOCTURNE_FLEET: CarChassis[] = [
  {
    id: 'nocturne-01',
    name: 'Nocturne 01',
    livery: 'Raw Carbon & 24K Gold Stencil',
    category: 'Hybrid V6',
    hp: '1,020 HP',
    acceleration: '2.3s',
    topSpeed: '355 KM/H',
    specSummary: '1,020 HP • 0-100 in 2.3s • 355 KM/H Top Speed',
    priceEur: 3900,
    image: 'images/grid-01-obsidian.jpg'
  },
  {
    id: 'apex-vulcan',
    name: 'Apex Vulcan',
    livery: 'Midnight Crimson & Anodized Onyx',
    category: 'Hybrid V6',
    hp: '1,050 HP',
    acceleration: '2.2s',
    topSpeed: '360 KM/H',
    specSummary: '1,050 HP • Twin-Scroll Hybrid • 360 KM/H',
    priceEur: 4400,
    image: 'images/grid-02-red.jpg'
  },
  {
    id: 'phantom-v8',
    name: 'Phantom V8',
    livery: 'Liquid Titanium & Brushed Steel',
    category: 'V8 Classic',
    hp: '860 HP',
    acceleration: '2.6s',
    topSpeed: '338 KM/H',
    specSummary: '860 HP • 18,000 RPM V8 Screamer • Pure Mechanical',
    priceEur: 3500,
    image: 'images/grid-03-silver.jpg'
  },
  {
    id: 'neon-papaya',
    name: 'Neon Papaya',
    livery: 'Night GP Papaya & Matte Carbon',
    category: 'Hybrid V6',
    hp: '990 HP',
    acceleration: '2.4s',
    topSpeed: '352 KM/H',
    specSummary: '990 HP • Active Venturi Tunnels • High Downforce',
    priceEur: 3850,
    image: 'images/grid-04-orange.jpg'
  },
  {
    id: 'vector-zero',
    name: 'Vector Zero',
    livery: 'British Racing Green & Bronze',
    category: 'Simulator Included',
    hp: '880 HP',
    acceleration: '2.5s',
    topSpeed: '342 KM/H',
    specSummary: '880 HP • 6-DOF Hydraulic Rig Pre-Flight • 342 KM/H',
    priceEur: 2700,
    image: 'images/grid-05-green.jpg'
  },
  {
    id: 'hyperion-06',
    name: 'Hyperion 06',
    livery: 'Cobalt Night & Ceramic Gloss',
    category: 'Hybrid V6',
    hp: '1,030 HP',
    acceleration: '2.3s',
    topSpeed: '356 KM/H',
    specSummary: '1,030 HP • MGU-K Boost Push-to-Pass • 356 KM/H',
    priceEur: 4200,
    image: 'images/grid-06-blue.jpg'
  },
  {
    id: 'ghost-apex',
    name: 'Ghost Apex',
    livery: 'Monochrome Arctic White & Dark Chrome',
    category: 'V8 Classic',
    hp: '830 HP',
    acceleration: '2.7s',
    topSpeed: '332 KM/H',
    specSummary: '830 HP • Naturally Aspirated • Titanium Inconel Exhaust',
    priceEur: 3200,
    image: 'images/grid-07-white.jpg'
  },
  {
    id: 'chronos-08',
    name: 'Chronos 08',
    livery: 'Giallo Modena & Raw Kevlar Weave',
    category: 'Simulator Included',
    hp: '800 HP',
    acceleration: '2.8s',
    topSpeed: '330 KM/H',
    specSummary: '800 HP • Full Telemetry Pod Included • 330 KM/H',
    priceEur: 2100,
    image: 'images/grid-08-yellow.jpg'
  }
];

export class FleetCatalog {
  private container: HTMLElement | null;
  private filterChips: NodeListOf<HTMLButtonElement>;
  private sortSelect: HTMLSelectElement | null;
  private carSelectDropdown: HTMLSelectElement | null;
  private currentFilter: string = 'all';
  private currentSort: string = 'featured';

  constructor() {
    this.container = document.getElementById('carsGridContainer');
    this.filterChips = document.querySelectorAll('.filter-chip');
    this.sortSelect = document.getElementById('sortSelect') as HTMLSelectElement | null;
    this.carSelectDropdown = document.getElementById('carSelect') as HTMLSelectElement | null;
  }

  public init(): void {
    this.populateCarSelect();
    this.bindEvents();
    this.render();
  }

  private populateCarSelect(): void {
    const dropdown = this.carSelectDropdown;
    if (!dropdown) return;
    dropdown.innerHTML = '<option value="">-- Select Chassis --</option>';
    NOCTURNE_FLEET.forEach(car => {
      const opt = document.createElement('option');
      opt.value = car.name;
      opt.textContent = `${car.name} (${car.hp}) — €${car.priceEur.toLocaleString()} / session`;
      dropdown.appendChild(opt);
    });
  }

  private bindEvents(): void {
    this.filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentFilter = chip.getAttribute('data-filter') || 'all';
        this.render();
      });
    });

    if (this.sortSelect) {
      this.sortSelect.addEventListener('change', (e) => {
        this.currentSort = (e.target as HTMLSelectElement).value;
        this.render();
      });
    }
  }

  public render(): void {
    if (!this.container) return;

    let items = [...NOCTURNE_FLEET];
    if (this.currentFilter !== 'all') {
      items = items.filter(car => car.category === this.currentFilter);
    }

    if (this.currentSort === 'price-asc') {
      items.sort((a, b) => a.priceEur - b.priceEur);
    } else if (this.currentSort === 'price-desc') {
      items.sort((a, b) => b.priceEur - a.priceEur);
    }

    const targetContainer = this.container;
    if (!targetContainer) return;
    targetContainer.innerHTML = '';
    items.forEach(car => {
      const card = document.createElement('div');
      card.className = 'car-card';
      card.innerHTML = `
        <div class="card-img-wrap">
          <img src="${car.image}" alt="${car.name}" class="card-img" loading="eager" width="400" height="300">
          <span class="card-badge">${car.category}</span>
        </div>
        <div class="card-body">
          <h3 class="card-name">${car.name}</h3>
          <span class="card-livery">${car.livery}</span>
          <p class="card-specs">${car.specSummary}</p>
          <div class="card-footer">
            <div class="card-price-row">
              <span class="price-prefix">From</span>
              <span class="price-val">€${car.priceEur.toLocaleString()} <small style="font-size:0.7em;color:var(--muted)">/ session</small></span>
            </div>
            <div class="card-actions">
              <button type="button" class="btn btn-primary btn-sm book-car-btn" data-car="${car.name}">Book Chassis</button>
              <a href="https://wa.me/000000000?text=Hello%20Nocturne%20Apex%2C%20I%20wish%20to%20reserve%20chassis%20${encodeURIComponent(car.name)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">WhatsApp</a>
            </div>
          </div>
        </div>
      `;
      targetContainer.appendChild(card);
    });

    this.container.querySelectorAll('.book-car-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const carName = (e.currentTarget as HTMLElement).getAttribute('data-car');
        const contactSection = document.getElementById('contact');
        if (contactSection) {
          contactSection.scrollIntoView({ behavior: 'smooth' });
          if (this.carSelectDropdown && carName) {
            this.carSelectDropdown.value = carName;
            this.carSelectDropdown.focus();
            this.carSelectDropdown.style.borderColor = 'var(--gold)';
            setTimeout(() => {
              if (this.carSelectDropdown) this.carSelectDropdown.style.borderColor = '';
            }, 1800);
          }
        }
      });
    });
  }
}
