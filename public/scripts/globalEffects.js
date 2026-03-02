// public/scripts/globalEffects.js
export function initGlobalEffects() {
  // -------------------------
  // Smooth scroll
  // -------------------------
  let locoScroll;
  const container = document.querySelector('[data-scroll-container]');

  if (container && window.LocomotiveScroll && window.gsap && window.ScrollTrigger) {
    locoScroll = new window.LocomotiveScroll({ el: container, smooth: true });
    locoScroll.on('scroll', window.ScrollTrigger.update);

    window.ScrollTrigger.scrollerProxy(container, {
      scrollTop(value) {
        return arguments.length
          ? locoScroll.scrollTo(value, 0, 0)
          : locoScroll.scroll.instance.scroll.y;
      },
      getBoundingClientRect() {
        return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
      },
      pinType: container.style.transform ? 'transform' : 'fixed',
    });

    window.ScrollTrigger.addEventListener('refresh', () => locoScroll.update());
    window.ScrollTrigger.refresh();
  }

  // -------------------------
  // Cursor trail
  // -------------------------
  const trailContainer = document.getElementById('cursor-trail');
  if (trailContainer) {
    const colors = ['#00ff9d', '#bf00ff', '#00d4ff'];
    let particles = [];

    document.addEventListener('mousemove', (e) => {
      const p = document.createElement('div');
      p.className = 'cursor-particle';
      p.style.left = e.clientX + 'px';
      p.style.top = e.clientY + 'px';
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      trailContainer.appendChild(p);
      particles.push(p);

      if (particles.length > 15) {
        const old = particles.shift();
        old?.remove();
      }

      setTimeout(() => {
        p.remove();
        particles = particles.filter((x) => x !== p);
      }, 600);
    });
  }

  // -------------------------
  // Scroll reveal
  // -------------------------
  if (window.gsap) {
    document.querySelectorAll('.reveal').forEach((el) => {
      window.gsap.fromTo(
        el,
        { opacity: 0, y: 100 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 80%',
            end: 'bottom 20%',
            toggleActions: 'play none none reverse',
            scroller: '[data-scroll-container]',
          },
        }
      );
    });
  }

  // -------------------------
  // Magnetic buttons
  // -------------------------
  document.querySelectorAll('.magnetic').forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      window.gsap?.to(btn, { x: x * 0.3, y: y * 0.3, duration: 0.3, ease: 'power2.out' });
    });
    btn.addEventListener('mouseleave', () =>
      window.gsap?.to(btn, { x: 0, y: 0, duration: 0.3, ease: 'elastic.out(1,0.5)' })
    );
  });

  // -------------------------
  // Particles (tsParticles)
  // -------------------------
  if (window.tsParticles && window.loadSlim) {
    window.loadSlim(window.tsParticles).then(() => {
      window.tsParticles.load({
        id: 'particles-container',
        options: {
          fullScreen: false,
          background: { color: 'transparent' },
          particles: {
            number: { value: 40, density: { enable: true } },
            color: { value: ['#00ff9d', '#bf00ff', '#00d4ff'] },
            shape: { type: 'circle' },
            opacity: { value: { min: 0.1, max: 0.5 } },
            size: { value: { min: 1, max: 3 } },
            links: { enable: true, distance: 150, color: '#00ff9d', opacity: 0.2, width: 1 },
            move: { enable: true, speed: 1, random: true, straight: false, outModes: 'bounce' },
          },
          interactivity: {
            events: { onHover: { enable: true, mode: 'grab' } },
            modes: { grab: { distance: 200, links: { opacity: 0.5 } } },
          },
        },
      });
    }).catch((e) => console.warn('tsParticles failed to load', e));
  }

  // -------------------------
  // Cleanup function
  // -------------------------
  return () => {
    if (locoScroll) locoScroll.destroy();
    window.ScrollTrigger?.getAll().forEach((t) => t.kill());
  };
}