document.addEventListener('DOMContentLoaded', () => {
    // --- Mobile Menu Toggle Logic --- 
    const menuToggle = document.getElementById('menu-toggle');
    const mobileNavLinks = document.getElementById('mobile-nav-links');
    
    if (menuToggle && mobileNavLinks) {
        menuToggle.addEventListener('click', function() {
            mobileNavLinks.classList.toggle('active');
            menuToggle.classList.toggle('active');
        });

        // Close mobile menu when a non-dropdown link is clicked
        mobileNavLinks.querySelectorAll('a').forEach(link => {
            if (!link.classList.contains('dropdown-toggle-mobile')) {
                link.addEventListener('click', () => {
                    if (mobileNavLinks.classList.contains('active')) {
                        mobileNavLinks.classList.remove('active');
                        menuToggle.classList.remove('active');
                    }
                });
            }
        });
    }
    
    // Mobile dropdown toggle
    const mobileDropdownToggles = document.querySelectorAll('.dropdown-toggle-mobile');
    mobileDropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            const menu = this.nextElementSibling;
            if (menu && menu.classList.contains('mobile-dropdown-menu')) {
                menu.classList.toggle('show');
                const arrow = this.querySelector('.fas.fa-caret-down');
                if (arrow) {
                    arrow.classList.toggle('rotated');
                }
            }
        });
    });

    // --- Smooth Scroll Logic --- 
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const desktopLinks = document.querySelectorAll('#desktop-header .nav-links a');
    
    desktopLinks.forEach(link => {
        link.addEventListener('click', function(event) {
            const targetHref = link.getAttribute('href');
            
            if (!targetHref.startsWith('#')) {
                // Regular navigation - let it proceed normally
                return;
            } 
            // Anchor link scrolling (smooth scroll)
            else {
                event.preventDefault();
                const targetElement = document.querySelector(targetHref);
                if (targetElement) { 
                    const navbarHeight = document.querySelector('#desktop-header').offsetHeight;
                    const offsetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - navbarHeight - 20;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // --- Basic Slideshow Logic ---
    let slideIndex = 1;
    const slideshowInner = document.getElementById('slideshow-inner');
    const slideDotsContainer = document.getElementById('slide-dots');
    
    if (slideshowInner && slideDotsContainer) {
        // Simple slideshow with static images
        const slidesData = [
            { src: './assets/factory-front-1.jpg', caption: 'Our Factory' },
            { src: './assets/factory-front-2.jpg', caption: 'Production Facility' },
            { src: './assets/roll.png', caption: 'Our Products' }
        ];

        function renderSlides() {
            slideshowInner.innerHTML = '';
            slideDotsContainer.innerHTML = '';

            slidesData.forEach((data, index) => {
                const slideDiv = document.createElement('div');
                slideDiv.classList.add('slide', 'fade');
                slideDiv.innerHTML = `
                    <div class="slide-image-container">
                        <img src="${data.src}" alt="${data.caption}" style="object-fit: contain; max-width: 100%; max-height: 100%;">
                    </div>
                    <div class="slide-caption">${data.caption}</div>
                `;
                slideshowInner.appendChild(slideDiv);

                const dotSpan = document.createElement('span');
                dotSpan.classList.add('dot');
                dotSpan.onclick = () => currentSlide(index + 1);
                slideDotsContainer.appendChild(dotSpan);
            });
        }

        function showSlides(n) {
            let i;
            const slides = document.getElementsByClassName("slide");
            const dots = document.getElementsByClassName("dot");
            if (!slides || slides.length === 0) return;

            if (n > slides.length) {slideIndex = 1}
            if (n < 1) {slideIndex = slides.length}

            for (i = 0; i < slides.length; i++) {
                slides[i].style.display = "none";
            }
            for (i = 0; i < dots.length; i++) {
                dots[i].className = dots[i].className.replace(" active", "");
            }

            slides[slideIndex-1].style.display = "block";
            if (dots[slideIndex-1]) {
                 dots[slideIndex-1].className += " active";
            }
        }

        // Make these functions global
        window.plusSlides = function(n) {
          showSlides(slideIndex += n);
        }

        window.currentSlide = function(n) {
          showSlides(slideIndex = n);
        }

        // Initialize slideshow
        renderSlides();
        showSlides(slideIndex);
    }
});
