import confetti from 'canvas-confetti'

interface ConfettiOptions {
    particleCount?: number;
    spread?: number;
    colors?: string[];
    duration?: number;
    disableOnMobile?: boolean;
    variant?: 'default' | 'fireworks' | 'heart' | 'emoji';
}

/**
 * Initialise les effets confetti sur les éléments avec classe .confetti-trigger
 * - Supporte options via data-confetti-* attributes
 * - Debounce pour éviter spam
 * - Réduit particules sur mobile
 * - Cleanup propre
 */
export function initConfetti() {
    const triggers = document.querySelectorAll<HTMLElement>('.confetti-trigger');

    if (!triggers.length) return;

    const isMobile = window.innerWidth < 768;

    triggers.forEach((trigger) => {
        let timeoutId: number | null = null;

        const clickHandler = (e: MouseEvent) => {
        e.preventDefault(); // si dans un form/link

        // Récupère options personnalisées via data-*
        const customOptions: ConfettiOptions = {
            particleCount: parseInt(trigger.dataset.confettiParticles || '100', 10),
            spread: parseInt(trigger.dataset.confettiSpread || '70', 10),
            colors: trigger.dataset.confettiColors?.split(',') || ['#00ff9d', '#bf00ff', '#00d4ff'],
            duration: parseInt(trigger.dataset.confettiDuration || '200', 10),
            disableOnMobile: trigger.dataset.confettiDisableMobile === 'true',
            variant: (trigger.dataset.confettiVariant as ConfettiOptions['variant']) || 'default',
        };

        // Skip sur mobile si demandé
        if (customOptions.disableOnMobile && isMobile) return;

        // Debounce : max 1 explosion toutes les 300ms
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
            const rect = trigger.getBoundingClientRect();
            const x = (rect.left + rect.width / 2) / window.innerWidth;
            const y = (rect.top + rect.height / 2) / window.innerHeight;

            const baseConfetti = {
            particleCount: isMobile ? customOptions.particleCount! / 2 : customOptions.particleCount!,
            spread: customOptions.spread!,
            origin: { x, y },
            colors: customOptions.colors!,
            ticks: customOptions.duration!,
            gravity: 0.6,
            scalar: 1.1,
            zIndex: 9999,
            };

            // Explosion principale
            confetti(baseConfetti);

            // Variantes
            if (customOptions.variant === 'fireworks') {
            setTimeout(() => {
                confetti({
                ...baseConfetti,
                particleCount: 40,
                angle: 60,
                origin: { x: x - 0.1, y },
                });
                confetti({
                ...baseConfetti,
                particleCount: 40,
                angle: 120,
                origin: { x: x + 0.1, y },
                });
            }, 100);
            } else if (customOptions.variant === 'heart') {
            confetti({
                ...baseConfetti,
                shapes: ['heart' as const],
                scalar: 1.5,
            });
            } else if (customOptions.variant === 'emoji') {
            confetti({
                ...baseConfetti,
                shapes: ['emoji as const'],
                emoji: ['🎉', '🚀', '✨'],
            });
            }

            timeoutId = null;
        }, 50); // léger délai pour fluidité
        };

        trigger.addEventListener('click', clickHandler);

        // Cleanup (si one-time use, par ex. bouton signup)
        if (trigger.dataset.confettiOnce === 'true') {
        trigger.addEventListener('click', () => {
            trigger.removeEventListener('click', clickHandler);
        }, { once: true });
        }
    });

    console.log(`Confetti ready on ${triggers.length} triggers`);
}