export function initClipboard() {
    const copyButtons = document.querySelectorAll<HTMLElement>('.clipboard-copy');

    if (!copyButtons.length) return;

    copyButtons.forEach((btn) => {
        // Récupère le texte à copier
        const getTextToCopy = () => {
        if (btn.dataset.clipboardText) {
            return btn.dataset.clipboardText;
        }
        // Si c'est un input ou textarea enfant
        const input = btn.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
        if (input) return input.value || input.textContent || '';
        // Sinon fallback sur le texte du bouton
        return btn.textContent?.trim() || '';
        };

        const originalContent = btn.innerHTML;
        const originalAriaLabel = btn.getAttribute('aria-label') || 'Copy to clipboard';

        const handleCopy = async () => {
        const text = getTextToCopy();
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);

            // Feedback visuel : "Copied!" + icône check
            btn.innerHTML = `
            <svg class="w-5 h-5 inline" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
            Copied!
            `;
            btn.setAttribute('aria-label', 'Copied to clipboard!');
            btn.classList.add('text-neon-green');

            // Reset après 2s
            setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.setAttribute('aria-label', originalAriaLabel);
            btn.classList.remove('text-neon-green');
            }, 2000);

            // Option : déclenche confetti si bouton a la classe confetti-trigger
            if (btn.classList.contains('confetti-trigger')) {
            // On peut appeler manuellement confetti ici si tu veux
            // ou laisser initConfetti gérer via click
            }
        } catch (err) {
            console.error('Clipboard copy failed:', err);

            // Fallback : sélectionner le texte et prompt
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);

            alert('Copied to clipboard (fallback mode)');
        }
        };

        btn.addEventListener('click', handleCopy);

        // Accessibilité : support Enter/Space
        btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCopy();
        }
        });
    });

    console.log(`Clipboard ready on ${copyButtons.length} elements`);
}