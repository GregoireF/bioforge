import Lenis from 'lenis';

export function initLenis() {
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',  
    gestureOrientation: 'vertical',
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 2,
    infinite: false,
    autoRaf: true,    
  });

  const onResize = () => lenis.resize();
  window.addEventListener('resize', onResize);

  const cleanup = () => {
    lenis.destroy();
    window.removeEventListener('resize', onResize);
  };

  (window as any).__lenisCleanup = cleanup;

  console.log('Lenis initialized');
}

export function initLenisWithGsapScrollTrigger() {
  let lenisInstance: Lenis | null = null;

  lenisInstance = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 2,
    infinite: false,
    autoRaf: true,
  });

  function raf(time: number) {
    lenisInstance!.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  const onResize = () => lenisInstance!.resize();
  window.addEventListener('resize', onResize);

  const cleanup = () => {
    lenisInstance!.destroy();
    window.removeEventListener('resize', onResize);
  };
  (window as any).__lenisCleanup = cleanup;

  import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
    if (!lenisInstance) return;

    ScrollTrigger.scrollerProxy(document.body, {
      scrollTop(value: number | undefined) {
        if (value !== undefined) {
          lenisInstance!.scrollTo(value, { immediate: true });
        }
        return lenisInstance!.scroll;
      },
      getBoundingClientRect() {
        return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
      },
      pinType: document.body.style.transform ? 'transform' : 'fixed',
    });

    ScrollTrigger.addEventListener('refresh', () => lenisInstance!.resize());
    ScrollTrigger.refresh();
  }).catch(err => console.warn('GSAP ScrollTrigger not loaded:', err));

  console.log('Lenis + GSAP ScrollTrigger initialized');
}