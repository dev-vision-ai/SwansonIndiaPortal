// Import the Supabase client instance
import { supabase } from '../supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Mobile Menu Toggle Logic --- 
    const menuToggle = document.getElementById('menu-toggle');
    const mobileNavLinks = document.getElementById('mobile-nav-links');

    if (menuToggle && mobileNavLinks) {
        menuToggle.addEventListener('click', () => {
            mobileNavLinks.classList.toggle('active');
            menuToggle.classList.toggle('active'); 
            // REMOVED Commented-out textContent logic
        });

        // When a link is clicked, remove active classes
        mobileNavLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (mobileNavLinks.classList.contains('active')) {
                    mobileNavLinks.classList.remove('active');
                    menuToggle.classList.remove('active'); 
                    // REMOVED Commented-out textContent logic
                }
            });
        });
    }
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
    if (!slideshowInner || !slideDotsContainer) {
        console.log('Slideshow elements not found on this page.');
        return;
    }
    console.log('Fetching featured slideshow images...');
    try {
        // 1. Get featured albums
        const { data: featuredAlbums, error: albumsError } = await supabase
            .from('gallery_albums')
            .select('id, album_name')
            .eq('show_in_slideshow', true); // Use the correct column name

        if (albumsError) throw albumsError;
        if (!featuredAlbums || featuredAlbums.length === 0) {
            slideshowInner.innerHTML = '<p>No featured albums to display.</p>';
            return;
        }

        console.log('Featured albums:', featuredAlbums);
        slidesData = []; // Reset slides data

        // 2. For each featured album, get its images
        for (const album of featuredAlbums) {
            const { data: images, error: imagesError } = await supabase
                .from('gallery_images')
                .select('image_url, caption')
                .eq('album_id', album.id)
                .order('created_at', { ascending: true }); // Or any other order you prefer

            if (imagesError) {
                console.error(`Error fetching images for album ${album.album_name}:`, imagesError);
                continue; // Skip to next album on error
            }

            images.forEach(image => {
                const { data: { publicUrl } } = supabase.storage.from('gallery-images').getPublicUrl(image.image_url);
                slidesData.push({
                    src: publicUrl,
                    albumName: album.album_name,
                    caption: image.caption || ''
                });
            });
        }

        if (slidesData.length === 0) {
            slideshowInner.innerHTML = '<p>No images found in featured albums.</p>';
            return;
        }

        renderSlides();
        showSlides(slideIndex);

    } catch (error) {
        console.error('Error fetching featured slideshow images:', error);
        if (slideshowInner) slideshowInner.innerHTML = '<p>Error loading slideshow images.</p>';
    }
}

function renderSlides() {
    slideshowInner.innerHTML = ''; // Clear existing slides
    slideDotsContainer.innerHTML = ''; // Clear existing dots

    slidesData.forEach((data, index) => {
        const slideDiv = document.createElement('div');
        slideDiv.classList.add('slide', 'fade');
        slideDiv.innerHTML = `
            <img src="${data.src}" alt="${data.albumName} - ${data.caption}">
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
