import { gsap } from 'gsap';

export function initPageTransition() {
  if (!document.startViewTransition) {
    document.documentElement.style.viewTransitionName = 'none';
    return;
  }

  document.addEventListener('astro:after-swap', () => {
    document.startViewTransition(() => {
      gsap.fromTo(
        'main',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }
      );
    });
  });

  // Option : anim out avant navigation
  document.addEventListener('astro:before-swap', (e) => {
    e.preventDefault();
    document.startViewTransition(async () => {
      await gsap.to('main', { opacity: 0, y: -20, duration: 0.4 });
      e.detail.newContent;
    });
  });

  console.log('Page transitions initialized');
}