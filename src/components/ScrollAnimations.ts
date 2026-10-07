import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export class ScrollAnimations {
  public static init(): void {
    gsap.registerPlugin(ScrollTrigger);

    const targetSections = [
      '#garage',
      '#grid',
      '#windtunnel',
      '#stats',
      '#bunker',
      '#steps',
      '#sanctuary',
      '#criteria',
      '#testimonials',
      '#contact',
      '#footer'
    ];

    targetSections.forEach(selector => {
      const section = document.querySelector(selector);
      if (!section) return;

      const items = section.querySelectorAll('.reveal-up');
      if (items.length) {
        gsap.from(items, {
          scrollTrigger: {
            trigger: section,
            start: 'top 85%',
            toggleActions: 'play none none none',
            once: true
          },
          y: 28,
          opacity: 0,
          duration: 0.85,
          stagger: 0.08,
          ease: 'power3.out'
        });
      }
    });
  }
}
