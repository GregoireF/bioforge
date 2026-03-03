import { gsap } from 'gsap'

export function initMagnetic() {
    const buttons = document.querySelectorAll<HTMLElement>('.magnetic');

    buttons.forEach((btn) => {
        const move = (e: MouseEvent) => {
            const rect = btn.getBoundingClientRect();
            const x = (e.clientX - rect.left - rect.width / 2) * 0.3;
            const y = (e.clientY - rect.top - rect.height / 2) * 0.3;

            gsap.to(btn, {
                x,
                y,
                duration: 0.4,
                ease: 'power2.out',
            });
        };

        const leave = () => {
            gsap.to(btn, {
                x: 0,
                y: 0,
                duration: 0.6,
                ease: 'elastic.out(1, 0.4)',
            });
        };

        btn.addEventListener('mousemove', move);
        btn.addEventListener('mouseleave', leave);

        // Cleanup
        const cleanup = () => {
            btn.removeEventListener('mousemove', move);
            btn.removeEventListener('mouseleave', leave);
            gsap.to(btn, { x: 0, y: 0, duration: 0.3 });
        };
        
        (btn as any).__magneticCleanup = cleanup;
    });

    window.addEventListener('beforeunload', () => {
        buttons.forEach((btn) => {
            if ((btn as any).__magneticCleanup) {
                (btn as any).__magneticCleanup();
            }
        });
    });
}