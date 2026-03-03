import { CountUp } from 'countup.js';

export function initCountUp() {
    const counters = document.querySelectorAll('.count-up:not(.count-up-initialized)');
    if (!counters.length) return;

    if (!('IntersectionObserver' in window)) {
        counters.forEach(el => {
        const count = parseFloat(el.getAttribute('data-count') ?? '0');
        const suffix = el.getAttribute('data-suffix') ?? '';
        el.textContent = count + suffix;
        });
        return;
    }

    const observer = new IntersectionObserver(
        entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            const el = entry.target as HTMLElement;
            const count = parseFloat(el.getAttribute('data-count') ?? '0');
            const suffix = el.getAttribute('data-suffix') ?? '';

            const countUp = new CountUp(el, count, {
            duration: 2.5,
            useEasing: true,
            suffix,
            separator: ',',
            });

            if (!countUp.error) {
            countUp.start();
            } else {
            el.textContent = count + suffix;
            }

            el.classList.add('count-up-initialized');
            observer.unobserve(el);
        });
        },
        { threshold: 0.5 }
    );

    counters.forEach(c => observer.observe(c));
}