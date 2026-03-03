// src/components/client/initParticles.ts
import { tsParticles } from '@tsparticles/engine';

/**
 * Initialise tsParticles sur les conteneurs avec id="particles" ou class="particles-bg"
 * - Config par défaut neon + réactive
 * - Support custom via data-particles-config (JSON string)
 * - Perf : slim + lazy
 */
export async function initParticles() {
  const containers = document.querySelectorAll<HTMLElement>('#particles, .particles-bg');

  if (!containers.length) return;

  // Config par défaut (typesafe + optimisée)
  const defaultConfig = {
    fullScreen: {
      enable: false,
      zIndex: -1,
    },
    particles: {
      number: {
        value: 80,
        density: {
          enable: true,
          area: 800,
        },
      },
      color: {
        value: ['#00ff9d', '#bf00ff', '#00d4ff'],
      },
      shape: {
        type: 'circle' as const,
      },
      opacity: {
        value: 0.5,
        random: true,
        animation: {
          enable: true,
          speed: 1,
          minimumValue: 0.1,
        },
      },
      size: {
        value: 3,
        random: true,
        animation: {
          enable: true,
          speed: 2,
          minimumValue: 0.3,
        },
      },
      links: {
        enable: true,
        distance: 150,
        color: '#ffffff',
        opacity: 0.2,
        width: 1,
      },
      move: {
        enable: true,
        speed: 1.5,
        direction: 'none' as const,
        random: true,
        straight: false,
        outModes: 'out' as const,
        attract: {
          enable: false,
        },
      },
    },
    interactivity: {
      detectsOn: 'canvas' as const,
      events: {
        onHover: {
          enable: true,
          mode: 'grab' as const,
        },
        onClick: {
          enable: true,
          mode: 'push' as const,
        },
        resize: true,
      },
      modes: {
        grab: {
          distance: 200,
          links: {
            opacity: 0.5,
          },
        },
        push: {
          quantity: 4,
        },
      },
    },
    detectRetina: true,
  } satisfies IOptions; // ← aide TS à inférer le type exact

  for (const container of containers) {
    let options = defaultConfig;

    // Config custom via data-particles-config (JSON string)
    if (container.dataset.particlesConfig) {
      try {
        const custom = JSON.parse(container.dataset.particlesConfig);
        options = { ...defaultConfig, ...custom } as IOptions;
      } catch (err) {
        console.warn('Invalid particles config on container', container, err);
      }
    }

    // Charge avec la syntaxe officielle : un seul objet
    await tsParticles.load({
      id: container.id || `particles-${Math.random().toString(36).slice(2, 9)}`,
      element: container,  // cible l'élément DOM directement
      options,
    });

    console.log('tsParticles loaded on container:', container.id || container.className);
  }

  console.log(`tsParticles initialized on ${containers.length} containers`);
}