document.addEventListener('DOMContentLoaded', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to the top on page load

    const links = document.querySelectorAll('.nav-links a');
    const icon = document.getElementById('transition-icon');
    const body = document.body;
    const dateElement = document.getElementById('current-date');
    const timeElement = document.getElementById('current-time');

    function updateDateTime() {
        const now = new Date();
        const formattedDate = now.toLocaleDateString();
        const formattedTime = now.toLocaleTimeString();
        dateElement.textContent = `Date: ${formattedDate}`;
        timeElement.textContent = `Time: ${formattedTime}`;
    }

    setInterval(updateDateTime, 1000); // Update every second

    // Hide transition icon initially
    icon.style.opacity = 0;
    icon.style.pointerEvents = 'none'; // So it doesn't block interaction

    // Add transition function
    function applyTransition(targetHref) {
        icon.style.opacity = 1;
        icon.style.pointerEvents = 'auto';
        body.classList.add('blur-effect');

        setTimeout(() => {
            window.location.href = targetHref;
        }, 2000);
    }

    links.forEach(link => {
        link.addEventListener('click', function(event) {
            const targetHref = link.getAttribute('href');

            // Prevent default for all navigation links initially
            event.preventDefault();

            // Handle navigation links (non-anchor)
            if (!targetHref.startsWith('#')) {
                applyTransition(targetHref);
            }
            // Handle anchor links (scrolling within the page)
            else {
                const targetElement = document.querySelector(targetHref);
                if (targetElement) { // Check if element exists before scrolling
                    const navbarHeight = document.querySelector('.navbar').offsetHeight;
                    const offsetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - navbarHeight - 20;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                } else {
                    console.warn(`Target element for anchor ${targetHref} not found.`);
                }
            }
        });
    });
});
