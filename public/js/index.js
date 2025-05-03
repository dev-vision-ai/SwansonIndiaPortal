// Import the Supabase client instance
import { supabase } from '../supabase-config.js';

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

        // --- START: Updated HTML Structure for Native Share --- 
        listingsHTML += `
            <div class="job-posting-card" id="job-${job.id}"> 
                <div class="job-title-header">
                    <h3>${escapeHTML(job.title)}</h3>
                </div>
                <div class="job-details-header">
                    ${job.location ? `<p><strong>Location:</strong> ${escapeHTML(job.location)}</p>` : ''}
                    ${job.experience_needed ? `<p><strong>Experience:</strong> ${escapeHTML(job.experience_needed)}</p>` : ''}
                    ${job.salary_range ? `<p><strong>Salary Range:</strong> ${escapeHTML(job.salary_range)}</p>` : ''}
                    ${formattedApplyBeforeDate ? `<p class="apply-before-date"><strong>Apply Before:</strong> ${formattedApplyBeforeDate}</p>` : ''}
                </div>
                <div class="job-card-body">
                    ${job.description ? `<div class="job-description"><p>${escapeHTML(job.description).replace(/\n/g, '<br>')}</p></div>` : '<div class="job-description"></div>'} 
                    <div class="job-card-footer">
                        <p class="posted-on-date"><small>Posted on: ${formattedPostedDate}</small></p>
                        <div class="footer-actions">
                            <!-- CHANGE to a button for native share -->
                            <button class="share-button" data-job-id="${job.id}" data-job-title="${escapeHTML(job.title)}" title="Share this job">
                                <i class="fas fa-share-alt"></i> Share 
                            </button>
                            <a href="mailto:viraj.j@usig.com?subject=Application for the post of ${encodeURIComponent(escapeHTML(job.title))}" class="apply-button">Apply Now</a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        // --- END: Updated HTML Structure ---
    });

    container.innerHTML = listingsHTML;

    // Add event listeners for the new share buttons
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
