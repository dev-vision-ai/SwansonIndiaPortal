// Import the Supabase client instance
import { supabase } from '../supabase-config.js';

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
                    const targetHref = link.getAttribute('href');
                    
                    // Special handling for Employee Login - open in new tab
                    if (targetHref && targetHref.includes('auth.html')) {
                        window.open(targetHref, '_blank');
                        return;
                    }
                    
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
    // --- End Mobile Menu Toggle Logic ---

    // --- Transition Icon Logic ---
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
            
            // Special handling for Employee Login - open in new tab
            if (targetHref && targetHref.includes('auth.html')) {
                event.preventDefault();
                window.open(targetHref, '_blank');
                return;
            }
            
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

    // --- Career Page Job Listing Logic --- 
    const jobListingsContainer = document.getElementById('job-listings');
    // Only run job loading if the container exists on the current page
    if (jobListingsContainer) {
        console.log('Career page detected, loading jobs...');
        loadActiveJobPostings(jobListingsContainer); // Pass the container element
    }
    // --- End Career Page Job Listing Logic ---
});

// --- Utility function to escape HTML --- 
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return str.toString()
         .replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;')
         .replace(/"/g, '&quot;')
         .replace(/'/g, '&#039;');
}

// --- Function to Load and Display Active Job Postings (for Career Page) --- 
async function loadActiveJobPostings(container) { // Accept container as argument
    console.log('Loading active job postings for public view...');
    container.innerHTML = '<p>Loading available positions...</p>'; 

    try {
        const { data: jobs, error } = await supabase
            .from('job_postings')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching active job postings:', error.message);
            container.innerHTML = '<div class="no-jobs-message"><p>Could not load job postings at this time. Please try again later.</p></div>';
            return;
        }

        console.log('Fetched active jobs:', jobs);

        if (!jobs || jobs.length === 0) {
            container.innerHTML = '<div class="no-jobs-message"><p>Currently, there are no open positions. Please check back later.</p></div>';
            return;
        }

        renderPublicJobPostings(jobs, container); // Pass container to render function

    } catch (err) {
        console.error('An unexpected error occurred:', err);
        container.innerHTML = '<div class="no-jobs-message"><p>An unexpected error occurred. Please try again later.</p></div>';
    }
}

// --- Function to Render Job Postings for the Public Page (for Career Page) --- 
function renderPublicJobPostings(jobs, container) {
    let listingsHTML = ''; 

    jobs.forEach(job => {
        // Format the created_at date
        const formattedPostedDate = new Date(job.created_at).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        // Format the apply_before date (only if it exists)
        let formattedApplyBeforeDate = '';
        if (job.apply_before) {
            try {
                // Add time part to ensure correct date interpretation regardless of timezone
                formattedApplyBeforeDate = new Date(job.apply_before + 'T00:00:00').toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
            } catch (e) {
                console.error("Error formatting apply_before date:", e); 
                // Keep formattedApplyBeforeDate empty if formatting fails
            }
        }

        const seeMoreButtonHTML = job.description ? `<button class="see-more-btn">See More</button>` : '';
        
        // --- PREPARE MAILTO LINK --- 
        const recipientEmail = 'viraj.j@usig.com'; 
        const subject = `Application for: ${job.title}`; 
        // Encode subject for URL safety
        const encodedSubject = encodeURIComponent(subject);
        const mailtoLink = `mailto:${recipientEmail}?subject=${encodedSubject}`;
        // --- END PREPARE MAILTO LINK ---

        listingsHTML += `
            <div class="job-posting-card" id="job-${job.id}">
                <div class="job-title-header">
                    <h3>${escapeHTML(job.title)}</h3>
                </div>
                
                <!-- Job Details Header Section - REORDERED -->
                <div class="job-details-header">
                    ${job.location ? `<p><strong>Job Location:</strong> ${escapeHTML(job.location)}</p>` : ''} 
                    ${job.qualification ? `<p><strong>Qualification:</strong> ${escapeHTML(job.qualification)}</p>` : ''}
                    ${job.experience_needed ? `<p><strong>Required Experience:</strong> ${escapeHTML(job.experience_needed)}</p>` : ''} 
                    ${job.salary_range ? `<p><strong>Offered Salary:</strong> ${escapeHTML(job.salary_range)}</p>` : ''} 
                    ${job.num_positions ? `<p><strong>No. of Vacant Positions:</strong> ${escapeHTML(job.num_positions)}</p>` : ''} 
                    ${job.employment_type ? `<p><strong>Enrollment Type:</strong> ${escapeHTML(job.employment_type)}</p>` : ''} 
                    ${job.department ? `<p><strong>Department:</strong> ${escapeHTML(job.department)}</p>` : ''} 
                    ${formattedApplyBeforeDate ? `<p class="apply-before-date"><strong>Apply Before:</strong> ${formattedApplyBeforeDate}</p>` : ''} 
                    ${(job.program_duration && job.program_duration.toUpperCase() !== 'NA') ? `<p><strong>Duration:</strong> ${escapeHTML(job.program_duration)}</p>` : ''} 
                </div>

                <div class="job-card-body">
                    ${job.description ? `<div class="job-description"><p>${escapeHTML(job.description).replace(/\n/g, '<br>')}</p></div>` : '<div class="job-description"></div>'}
                    ${seeMoreButtonHTML}
                    <div class="job-card-footer">
                        <p class="posted-on-date"><small>Posted on: ${formattedPostedDate}</small></p>
                        <div class="job-actions"> 
                            <a href="${mailtoLink}" class="apply-button">Apply Now</a>
                            <button class="share-button" data-job-id="${job.id}" data-job-title="${escapeHTML(job.title)}"> 
                                <i class="fas fa-share-alt"></i> Share
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = listingsHTML;

    // Add 'See More' listener
    container.addEventListener('click', function(event) {
        if (event.target.classList.contains('see-more-btn')) {
            const button = event.target;
            // Find the job-card-body parent, then the job-description within it
            const cardBody = button.closest('.job-card-body');
            if (cardBody) {
                const descriptionDiv = cardBody.querySelector('.job-description');
                if (descriptionDiv) {
                    descriptionDiv.classList.toggle('expanded'); // Toggle the class
                    button.textContent = descriptionDiv.classList.contains('expanded') ? 'See Less' : 'See More'; // Update text based on new state
                }
            }
        }
    });

    addNativeShareListeners(); 
}

// --- Function to Add Event Listeners for Native Share Buttons --- 
function addNativeShareListeners() {
    const shareButtons = document.querySelectorAll('.share-button');

    shareButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const jobId = button.dataset.jobId;
            const jobTitle = button.dataset.jobTitle;
            const jobUrl = `${window.location.origin}${window.location.pathname}?jobId=${jobId}`;
            const shareData = {
                title: `Job Opening: ${jobTitle}`,
                text: `Check out this job opening at Swanson Plastics India: ${jobTitle}`,
                url: jobUrl
            };

            if (navigator.share) { // Check if Web Share API is supported
                try {
                    await navigator.share(shareData);
                    console.log('Job shared successfully');
                    // Optional: Show a temporary success message
                } catch (err) {
                    console.error('Error sharing job:', err);
                    // Handle errors (e.g., user cancelled share) - maybe fallback to copy link
                    fallbackCopyLink(jobUrl, button);
                }
            } else {
                console.warn('Web Share API not supported. Falling back to copy link.');
                // Fallback for browsers that don't support Web Share API
                fallbackCopyLink(jobUrl, button);
            }
        });
    });
}

// --- Fallback Function to Copy Link --- 
function fallbackCopyLink(url, button) {
    navigator.clipboard.writeText(url).then(() => {
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-copy"></i> Copied!';
        button.disabled = true;
        setTimeout(() => {
            button.innerHTML = originalText; 
            button.disabled = false;
        }, 2000); // Reset after 2 seconds
    }).catch(err => {
        console.error('Failed to copy link:', err);
        alert('Failed to copy link. Please copy it manually.');
    });
}

// --- Slideshow Logic (Keep only one instance of this block) ---
let slideIndex = 1;
let slidesData = []; 
const slideshowInner = document.getElementById('slideshow-inner');
const slideDotsContainer = document.getElementById('slide-dots');

async function fetchFeaturedSlideshowImages() {
    const featuredSlideshowSection = document.getElementById('featured-slideshow-section');
    if (!slideshowInner || !slideDotsContainer || !featuredSlideshowSection) {
        console.log('Slideshow elements or section not found on this page.');
        if (featuredSlideshowSection) featuredSlideshowSection.style.display = 'none';
        return;
    }
    console.log('Fetching featured slideshow images...');
    try {
        // Fetch images directly where featured_on_homepage is true
        const { data: featuredImages, error: imagesError } = await supabase
            .from('gallery_images')
            .select('image_url, caption, album_id, gallery_albums(album_name)') // Select album_name via foreign key
            .eq('featured_on_homepage', true)
            .order('created_at', { ascending: false }); // Or your preferred order

        if (imagesError) throw imagesError;

        if (!featuredImages || featuredImages.length === 0) {
            console.log('No featured images to display.');
            featuredSlideshowSection.style.display = 'none';
            return;
        }

        console.log('Featured images:', featuredImages);
        slidesData = []; // Reset slides data

        featuredImages.forEach(image => {
            const { data: { publicUrl } } = supabase.storage.from('gallery-images').getPublicUrl(image.image_url);
            slidesData.push({
                src: publicUrl,
                // Access album_name from the joined gallery_albums table
                albumName: image.gallery_albums ? image.gallery_albums.album_name : 'Unknown Album',
                caption: image.caption || ''
            });
        });

        if (slidesData.length === 0) {
            // This case should ideally be caught by the featuredImages.length check above
            console.log('No images processed for slideshow.');
            featuredSlideshowSection.style.display = 'none';
            return;
        }

        featuredSlideshowSection.style.display = 'block';
        renderSlides();
        showSlides(slideIndex);

    } catch (error) {
        console.error('Error fetching featured slideshow images:', error);
        if (slideshowInner) slideshowInner.innerHTML = '<p>Error loading slideshow images.</p>';
        if (featuredSlideshowSection) featuredSlideshowSection.style.display = 'none';
    }
}

function renderSlides() {
    slideshowInner.innerHTML = ''; // Clear existing slides
    slideDotsContainer.innerHTML = ''; // Clear existing dots

    slidesData.forEach((data, index) => {
        const slideDiv = document.createElement('div');
        slideDiv.classList.add('slide', 'fade');
        slideDiv.innerHTML = `
            <div class="slide-image-container">
                <img src="${data.src}" alt="${data.albumName} - ${data.caption}" style="object-fit: contain; max-width: 100%; max-height: 100%;">
            </div>
            <div class="slide-caption">${data.albumName}${data.caption ? ': ' + data.caption : ''}</div>
        `;
        slideshowInner.appendChild(slideDiv);

        const dotSpan = document.createElement('span');
        dotSpan.classList.add('dot');
        dotSpan.onclick = () => currentSlide(index + 1);
        slideDotsContainer.appendChild(dotSpan);
    });
}

// Functions to control the slideshow (plusSlides, currentSlide, showSlides)
// Make these functions global if onclick attributes are in HTML
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

// Call this when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('featured-slideshow-section')) { // Only run if slideshow section exists
         fetchFeaturedSlideshowImages();
    }
});


document.addEventListener('DOMContentLoaded', () => {
    const heroSection = document.getElementById('hero-slideshow');
    if (heroSection) {
        const slides = [
            {
                image: './assets/factory-front-2.jpg',
                title: 'Expanding Infrastructure',
                description: 'Progressing toward a greener, more efficient manufacturing future.'
            },
            {
                image: './assets/slideshow/join-our-team.png',
                title: 'Join Our Dynamic Team',
                description: 'Explore exciting career opportunities with us.'
            },
            {
                image: './assets/slideshow/quality.jpg',
                title: 'Commitment to Quality',
                description: 'Delivering excellence in every product.'
            },
            {
                image: './assets/slideshow/recycle.jpg',
                title: 'Sustainable Practices',
                description: 'Dedicated to a greener future through recycling.'
            },
            {
                image: './assets/slideshow/solar.jpg',
                title: 'Harnessing Solar Power',
                description: 'Investing in renewable energy for a sustainable tomorrow.'
            },
            {
                image: './assets/slideshow/safety-first.jpg',
                title: 'Safety First, Always',
                description: 'Prioritizing a safe working environment for everyone.'
            },
            {
                image: './assets/slideshow/teamwork.jpg',
                title: 'The Power of Teamwork',
                description: 'Achieving great things together.'
            },
            {
                image: './assets/slideshow/environment.jpg',
                title: 'Protecting Our Environment',
                description: 'Committed to eco-conscious manufacturing processes.'
            }
        ];
        let currentIndex = 0;
        const heroOverlay = heroSection.querySelector('.hero-overlay');
        const heroTitle = heroOverlay ? heroOverlay.querySelector('h1') : null;
        const heroDescription = heroOverlay ? heroOverlay.querySelector('p') : null;

        function changeBackgroundImage() {
            currentIndex = (currentIndex + 1) % slides.length;
            const currentSlide = slides[currentIndex];
            
            // Set background image with overlay
            const overlayGradient = 'linear-gradient(rgba(0, 46, 125, 0.5), rgba(0, 46, 125, 0.7))'; 
            heroSection.style.backgroundImage = `${overlayGradient}, url('${currentSlide.image}')`;

            // Update text content
            if (heroTitle) {
                heroTitle.textContent = currentSlide.title;
            }
            if (heroDescription) {
                heroDescription.textContent = currentSlide.description;
            }
        }

        // Initial setup
        if (slides.length > 0) {
            const initialSlide = slides[0];
            const initialOverlayGradient = 'linear-gradient(rgba(0, 46, 125, 0.5), rgba(0, 46, 125, 0.7))';
            heroSection.style.backgroundImage = `${initialOverlayGradient}, url('${initialSlide.image}')`;
            if (heroTitle) {
                heroTitle.textContent = initialSlide.title;
            }
            if (heroDescription) {
                heroDescription.textContent = initialSlide.description;
            }
        }

        setInterval(changeBackgroundImage, 3000); // Change image every 3 seconds
    }

    // Featured Gallery Slideshow Logic (existing or new)
    const slideshowInner = document.getElementById('slideshow-inner');
    const slideDotsContainer = document.getElementById('slide-dots');

    if (slideshowInner && slideDotsContainer) {
        const galleryImages = [
            { src: './assets/slideshow/environment.jpg', alt: 'Environment' },
            { src: './assets/slideshow/join-our-team.png', alt: 'Join Our Team' },
            { src: './assets/slideshow/quality.jpg', alt: 'Quality' },
            { src: './assets/slideshow/recycle.jpg', alt: 'Recycle' },
            { src: './assets/slideshow/safety-first.jpg', alt: 'Safety First' },
            { src: './assets/slideshow/solar.jpg', alt: 'Solar' },
            { src: './assets/slideshow/teamwork.jpg', alt: 'Teamwork' }
        ];

        galleryImages.forEach((image, index) => {
            // Create slide
            const slide = document.createElement('div');
            slide.classList.add('slide');
            if (index === 0) slide.classList.add('active'); // Make first slide active
            const img = document.createElement('img');
            img.src = image.src;
            img.alt = image.alt;
            slide.appendChild(img);
            slideshowInner.appendChild(slide);

            // Create dot
            const dot = document.createElement('span');
            dot.classList.add('dot');
            if (index === 0) dot.classList.add('active');
            dot.setAttribute('onclick', `currentSlide(${index + 1})`);
            slideDotsContainer.appendChild(dot);
        });

        let slideIndex = 1;
        showSlides(slideIndex);

        // Attach functions to window object to make them accessible from HTML onclick
        window.plusSlides = function(n) {
            showSlides(slideIndex += n);
        };

        window.currentSlide = function(n) {
            showSlides(slideIndex = n);
        };

        function showSlides(n) {
            let i;
            const slides = document.getElementsByClassName("slide");
            const dots = document.getElementsByClassName("dot");
            if (n > slides.length) { slideIndex = 1 }
            if (n < 1) { slideIndex = slides.length }
            for (i = 0; i < slides.length; i++) {
                slides[i].style.display = "none";
                slides[i].classList.remove('active');
            }
            for (i = 0; i < dots.length; i++) {
                dots[i].className = dots[i].className.replace(" active", "");
            }
            if (slides[slideIndex - 1]) {
                 slides[slideIndex - 1].style.display = "block";
                 slides[slideIndex - 1].classList.add('active');
            }
            if (dots[slideIndex - 1]) {
                dots[slideIndex - 1].className += " active";
            }
        }
    } else {
        console.log('Slideshow inner container or dots container not found.');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const dropdownToggles = document.querySelectorAll('.dropdown-toggle-mobile');
    
    dropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const dropdown = this.closest('.dropdown-mobile');
            const menu = dropdown.querySelector('.dropdown-menu-mobile');
            const isOpen = menu.classList.contains('show');
            
            // Close all other dropdowns first
            document.querySelectorAll('.dropdown-menu-mobile.show').forEach(openMenu => {
                if (openMenu !== menu) {
                    openMenu.classList.remove('show');
                    openMenu.style.maxHeight = '0';
                    const otherArrow = openMenu.previousElementSibling.querySelector('.dropdown-arrow');
                    if (otherArrow) otherArrow.classList.remove('rotated');
                }
            });
            
            // Toggle current dropdown
            if (isOpen) {
                menu.style.maxHeight = '0';
                setTimeout(() => menu.classList.remove('show'), 300);
            } else {
                menu.classList.add('show');
                menu.style.maxHeight = menu.scrollHeight + 'px';
            }
            
            // Toggle arrow icon
            const arrow = this.querySelector('.dropdown-arrow');
            if (arrow) arrow.classList.toggle('rotated', !isOpen);
        });
        
        // Prevent dropdown menu clicks from closing
        const menu = toggle.nextElementSibling;
        if (menu) {
            menu.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        }
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown-mobile')) {
            document.querySelectorAll('.dropdown-menu-mobile.show').forEach(menu => {
                menu.style.maxHeight = '0';
                setTimeout(() => menu.classList.remove('show'), 300);
                const arrow = menu.previousElementSibling.querySelector('.dropdown-arrow');
                if (arrow) arrow.classList.remove('rotated');
            });
        }
    });
});
