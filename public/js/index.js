import { supabase } from '../supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Mobile Menu Toggle
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            // Change icon
            const icon = menuToggle.querySelector('i');
            if (navLinks.classList.contains('active')) {
                icon.classList.remove('bi-list');
                icon.classList.add('bi-x-lg');
            } else {
                icon.classList.remove('bi-x-lg');
                icon.classList.add('bi-list');
            }
        });

        // Dropdown toggle logic
        const toggleDropdown = (e, toggle) => {
            e.preventDefault();
            e.stopPropagation();
            const li = toggle.parentElement;
            const isOpen = li.classList.contains('open');
            
            // Close all other dropdowns first
            document.querySelectorAll('.nav-links li.open').forEach(item => {
                if (item !== li) {
                    item.classList.remove('open');
                    item.querySelector('.nav-dropdown-toggle')?.setAttribute('aria-expanded', 'false');
                }
            });

            // Toggle current
            if (isOpen) {
                li.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
            } else {
                li.classList.add('open');
                toggle.setAttribute('aria-expanded', 'true');
            }
        };

        // Click handler
        navLinks.addEventListener('click', (e) => {
            const toggle = e.target.closest('.nav-dropdown-toggle');
            if (toggle) {
                toggleDropdown(e, toggle);
            }
        });

        // Keyboard handler
        navLinks.addEventListener('keydown', (e) => {
            const toggle = e.target.closest('.nav-dropdown-toggle');
            if (toggle && (e.key === 'Enter' || e.key === ' ')) {
                toggleDropdown(e, toggle);
            }
        });

        // Close menu when clicking a non-toggle link
        navLinks.querySelectorAll('a:not(.nav-dropdown-toggle)').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                document.querySelectorAll('.nav-links li.open').forEach(li => li.classList.remove('open'));
                menuToggle.querySelector('i').classList.add('bi-list');
                menuToggle.querySelector('i').classList.remove('bi-x-lg');
            });
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.nav-links')) {
                document.querySelectorAll('.nav-links li.open').forEach(li => {
                    li.classList.remove('open');
                    li.querySelector('.nav-dropdown-toggle')?.setAttribute('aria-expanded', 'false');
                });
            }
        });

        // Close dropdowns when selecting a dropdown link (also collapse mobile menu)
        navLinks.querySelectorAll('.dropdown-menu a').forEach(a => {
            a.addEventListener('click', () => {
                document.querySelectorAll('.nav-links li.open').forEach(li => li.classList.remove('open'));
                navLinks.classList.remove('active');
                if (menuToggle) {
                    menuToggle.querySelector('i').classList.add('bi-list');
                    menuToggle.querySelector('i').classList.remove('bi-x-lg');
                }
            });
        });
    }

    // 2. Scroll Effect for Navbar
    const nav = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });

    // 2. Reveal Animations on Scroll
    const observerOptions = { threshold: 0.1 };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.modern-card, .split-text-box, h2, .reveal-text, .reveal-up, .page-card').forEach(el => {
        observer.observe(el);
    });

    // 3. Dynamic Full-Width Slideshow (2 items at a time)
    const track = document.getElementById('slideshow-track');
    if (track) {
        const images = [
            { src: 'quality.jpg', title: 'Quality Excellence', desc: 'Rigorous testing and precision manufacturing ensure every product meets the highest standards.' },
            { src: 'environment.jpg', title: 'Environmental Commitment', desc: 'Sustainable practices and eco-friendly processes for a greener tomorrow.' },
            { src: 'safety-first.jpg', title: 'Safety First', desc: 'Comprehensive safety protocols protect our team and community every day.' },
            { src: 'teamwork.jpg', title: 'Teamwork & Collaboration', desc: 'United workforce driving innovation through shared knowledge and expertise.' },
            { src: 'solar.jpg', title: 'Sustainable Energy', desc: 'Harnessing renewable energy solutions for cleaner manufacturing processes.' },
            { src: 'recycle.jpg', title: 'Recycling & Sustainability', desc: 'Circular economy principles guide our waste reduction and material reuse initiatives.' }
        ];

        // Determine path prefix
        const isSubPage = window.location.pathname.includes('/html/');
        const pathPrefix = isSubPage ? '../assets/slideshow/' : './assets/slideshow/';

        // Render slides (double them for infinite feel)
        const allSlides = [...images, ...images];
        track.innerHTML = allSlides.map(img => `
            <div class="slideshow-item">
                <img src="${pathPrefix}${img.src}" alt="${img.title}">
                <div class="slideshow-caption">
                    <h4>${img.title}</h4>
                    <p>${img.desc}</p>
                </div>
            </div>
        `).join('');

        let index = 0;
        const totalImages = images.length;
        
        const moveSlideshow = () => {
            index++;
            track.style.transition = 'transform 1.2s cubic-bezier(0.2, 1, 0.3, 1)';
            
            // Move by 50% since each item is exactly 50% width with no gaps
            track.style.transform = `translateX(-${index * 50}%)`;

            // Reset loop without jump
            if (index >= totalImages) {
                setTimeout(() => {
                    track.style.transition = 'none';
                    index = 0;
                    track.style.transform = `translateX(0)`;
                }, 1200);
            }
        };

        setInterval(moveSlideshow, 4000);
    }

    // 4. Dynamic Hero Image Rotation - TEMPORARILY DISABLED
    /*
    const hero = document.getElementById('hero-slideshow');
    if (hero) {
        const pathPrefix = window.location.pathname.includes('/html/') ? '../' : './';
        const images = [
            `${pathPrefix}assets/factory-front-2.jpg`,
            `${pathPrefix}assets/slideshow/quality.jpg`,
            `${pathPrefix}assets/slideshow/solar.jpg`
        ];
        let i = 0;
        setInterval(() => {
            i = (i + 1) % images.length;
            hero.style.backgroundImage = `url(${images[i]})`;
        }, 5000);
    }
    */
});
