document.addEventListener('DOMContentLoaded', () => {
    // --- Mobile Menu Toggle Logic --- 
    const menuToggle = document.getElementById('menu-toggle');
    const mobileNavLinks = document.getElementById('mobile-nav-links');

    if (menuToggle && mobileNavLinks) {
        menuToggle.addEventListener('click', () => {
            mobileNavLinks.classList.toggle('active');
            // <<< Ensure this line IS present >>>
            menuToggle.classList.toggle('active'); 
            // --- Ensure textContent changing is REMOVED --- 
            /* 
            if (mobileNavLinks.classList.contains('active')) {
                menuToggle.textContent = 'Close'; 
            } else {
                menuToggle.textContent = 'Menu'; 
            }
            */
        });

        // When a link is clicked, remove active classes
        mobileNavLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (mobileNavLinks.classList.contains('active')) {
                    mobileNavLinks.classList.remove('active');
                    // <<< Ensure this line IS present >>>
                    menuToggle.classList.remove('active'); 
                    // --- Ensure textContent reset is REMOVED --- 
                    /*
                    menuToggle.textContent = 'Menu';
                    */
                }
            });
        });
    }
    // --- End Mobile Menu Toggle Logic ---

    const transitionIcon = document.getElementById('transition-icon');
    if (transitionIcon) {
        transitionIcon.style.opacity = '1';
        setTimeout(() => {
            transitionIcon.style.opacity = '0';
            setTimeout(() => {
                transitionIcon.style.display = 'none';
            }, 500); 
        }, 1500); 
    }
    // --- End Transition Icon Logic ---

    // --- Smooth Scroll & Page Transition Logic --- 
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const desktopLinks = document.querySelectorAll('#desktop-header .nav-links a'); // Target desktop links
    const body = document.body;
    
    // Hide transition icon initially (redundant but safe)
    if (transitionIcon) {
        transitionIcon.style.opacity = 0;
        transitionIcon.style.pointerEvents = 'none'; 
    }

    function applyTransition(targetHref) {
        if (transitionIcon) {
             transitionIcon.style.opacity = 1;
             transitionIcon.style.pointerEvents = 'auto';
        }
        // body.classList.add('blur-effect'); // Optional blur effect

        setTimeout(() => {
            window.location.href = targetHref;
        }, 500); // Reduced delay to 0.5s to match transition
    }

    desktopLinks.forEach(link => {
        link.addEventListener('click', function(event) {
            const targetHref = link.getAttribute('href');
            
            if (!targetHref.startsWith('#')) {
                event.preventDefault(); // Prevent default only for non-anchor links
                applyTransition(targetHref);
            } 
            // Anchor link scrolling (smooth scroll)
            else {
                event.preventDefault(); // Prevent default jump for anchor links too
                const targetElement = document.querySelector(targetHref);
                if (targetElement) { 
                    const navbarHeight = document.querySelector('#desktop-header').offsetHeight; // Use desktop header height
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