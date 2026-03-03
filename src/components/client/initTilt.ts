import VanillaTilt from 'vanilla-tilt';

export function initTilt() {
  const elements = document.querySelectorAll('.tilt-card');
  if (!elements.length) return;

  VanillaTilt.init(Array.from(elements) as HTMLElement[], {
    max: 10,
    speed: 800,
    glare: true,
    'max-glare': 0.2,
    scale: 1.05,
  });
}