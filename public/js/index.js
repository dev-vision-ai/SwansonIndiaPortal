// Import the Supabase client instance (ensure this path is correct relative to js folder)
import { supabase } from '../supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Mobile Menu Toggle ---
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

        // Close menu when clicking a link
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                menuToggle.querySelector('i').classList.add('bi-list');
                menuToggle.querySelector('i').classList.remove('bi-x-lg');
            });
        });
    }

    // --- 2. Hero Background Slideshow ---
    const heroSection = document.getElementById('hero-slideshow');
    if (heroSection) {
        const slides = [
            './assets/factory-front-2.jpg',
            './assets/slideshow/quality.jpg',
            './assets/slideshow/solar.jpg',
            './assets/slideshow/safety-first.jpg'
        ];
        
        let currentIndex = 0;
        
        // Preload images to prevent flickering
        slides.forEach(src => {
            const img = new Image();
            img.src = src;
        });

        const changeHeroBackground = () => {
            currentIndex = (currentIndex + 1) % slides.length;
            // Apply gradient overlay + image
            heroSection.style.backgroundImage = `linear-gradient(135deg, rgba(0, 46, 125, 0.9), rgba(0, 20, 60, 0.85)), url('${slides[currentIndex]}')`;
        };

        // Set initial background
        heroSection.style.backgroundImage = `linear-gradient(135deg, rgba(0, 46, 125, 0.9), rgba(0, 20, 60, 0.85)), url('${slides[0]}')`;
        
        // Rotate every 4 seconds
        setInterval(changeHeroBackground, 4000);
    }

    // --- 3. Featured Gallery (Supabase) ---
    const slideshowInner = document.getElementById('slideshow-inner');
    const slideDotsContainer = document.getElementById('slide-dots');
    const featuredSection = document.getElementById('featured-slideshow-section');

    if (featuredSection && slideshowInner) {
        fetchFeaturedSlideshowImages();
    }

    async function fetchFeaturedSlideshowImages() {
        try {
            const { data: featuredImages, error } = await supabase
                .from('gallery_images')
                .select('image_url, caption, album_id, gallery_albums(album_name)')
                .eq('featured_on_homepage', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!featuredImages || featuredImages.length === 0) {
                featuredSection.style.display = 'none';
                return;
            }

            renderSlides(featuredImages);
            showSlides(1); // Start with slide 1

        } catch (error) {
            console.error('Error fetching gallery:', error);
            featuredSection.style.display = 'none';
        }
    }

    function renderSlides(images) {
        slideshowInner.innerHTML = '';
        slideDotsContainer.innerHTML = '';
        
        images.forEach((image, index) => {
            // Get public URL
            const { data: { publicUrl } } = supabase.storage.from('gallery-images').getPublicUrl(image.image_url);
            const albumName = image.gallery_albums ? image.gallery_albums.album_name : '';
            
            // Create Slide
            const slide = document.createElement('div');
            slide.classList.add('slide');
            slide.innerHTML = `
                <img src="${publicUrl}" alt="${albumName}">
                <div class="slide-caption">
                    <h5>${albumName}</h5>
                    <p>${image.caption || ''}</p>
                </div>
            `;
            slideshowInner.appendChild(slide);

            // Create Dot
            const dot = document.createElement('span');
            dot.classList.add('dot');
            dot.onclick = () => currentSlide(index + 1);
            slideDotsContainer.appendChild(dot);
        });
    }
});

// --- 4. Global Slideshow Controls (Window Scope) ---
let slideIndex = 1;

window.plusSlides = function(n) {
    showSlides(slideIndex += n);
}

window.currentSlide = function(n) {
    showSlides(slideIndex = n);
}

function showSlides(n) {
    let i;
    const slides = document.getElementsByClassName("slide");
    const dots = document.getElementsByClassName("dot");
    
    if (!slides.length) return;

    if (n > slides.length) { slideIndex = 1 }
    if (n < 1) { slideIndex = slides.length }
    
    for (i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";
    }
    for (i = 0; i < dots.length; i++) {
        dots[i].className = dots[i].className.replace(" active", "");
    }
    
    slides[slideIndex - 1].style.display = "block";
    if(dots.length > 0) {
        dots[slideIndex - 1].className += " active";
    }
}
