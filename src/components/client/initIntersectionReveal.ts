export function initIntersectionReveal() {
    const elements = document.querySelectorAll('.reveal-on-scroll');

    if (!elements.length || !('IntersectionObserver' in window)) {
        elements.forEach(el => el.classList.add('revealed'));
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
            }
        });
        },
        { threshold: 0.1, rootMargin: '0px 0px -10% 0px' }
    );

    elements.forEach(el => observer.observe(el));

    console.log('Reveal animations initialized');
}