export class StatsCounter {
  private numbers: NodeListOf<HTMLElement>;
  private hasAnimated: boolean = false;

  constructor() {
    this.numbers = document.querySelectorAll('.stat-num');
  }

  public init(): void {
    if (!this.numbers.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.hasAnimated) {
          this.hasAnimated = true;
          this.numbers.forEach(el => {
            const target = el.getAttribute('data-target') || el.textContent || '0';
            if (target === '8') this.animate(el, 0, 8, 1200, '');
            else if (target === '24/7') this.animate(el, 0, 24, 1200, '/7');
            else if (target === '0%') this.animate(el, 100, 0, 1000, '%');
            else if (target === '1,050') this.animate(el, 0, 1050, 1500, ' HP');
          });
        }
      });
    }, { threshold: 0.3 });

    const statsSec = document.getElementById('stats');
    if (statsSec) observer.observe(statsSec);
  }

  private animate(elem: HTMLElement, start: number, end: number, duration: number, suffix: string): void {
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (!startTs) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(ease * (end - start) + start);
      elem.textContent = current.toLocaleString() + suffix;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        elem.textContent = end.toLocaleString() + suffix;
      }
    };
    requestAnimationFrame(step);
  }
}
