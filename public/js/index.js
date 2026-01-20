import { supabase } from '../supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Mobile Menu Toggle
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            document.querySelector('.navbar').classList.toggle('menu-active');
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
                document.querySelector('.navbar').classList.remove('menu-active');
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
                document.querySelector('.navbar').classList.remove('menu-active');
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
        let autoSlideInterval;
        
        const moveSlideshow = (direction = 'next') => {
            if (direction === 'next') {
                index++;
            } else if (direction === 'prev') {
                index--;
                if (index < 0) {
                    index = totalImages - 1;
                }
            }
            
            track.style.transition = 'transform 1.2s cubic-bezier(0.2, 1, 0.3, 1)';
            
            // On screens smaller than 992px, each item is 100% width, otherwise 50%
            const stepSize = window.innerWidth <= 992 ? 100 : 50;
            track.style.transform = `translateX(-${index * stepSize}%)`;

            // Reset loop without jump for forward movement
            if (direction === 'next' && index >= totalImages) {
                setTimeout(() => {
                    track.style.transition = 'none';
                    index = 0;
                    track.style.transform = `translateX(0)`;
                }, 1200);
            }
        };

        // Auto slideshow
        const startAutoSlide = () => {
            autoSlideInterval = setInterval(() => moveSlideshow('next'), 4000);
        };

        const stopAutoSlide = () => {
            if (autoSlideInterval) {
                clearInterval(autoSlideInterval);
            }
        };

        // Navigation button functionality
        const prevBtn = document.getElementById('slideshow-prev');
        const nextBtn = document.getElementById('slideshow-next');

        if (prevBtn && nextBtn) {
            prevBtn.addEventListener('click', () => {
                stopAutoSlide();
                moveSlideshow('prev');
                // Restart auto slide after manual interaction
                setTimeout(startAutoSlide, 8000);
            });

            nextBtn.addEventListener('click', () => {
                stopAutoSlide();
                moveSlideshow('next');
                // Restart auto slide after manual interaction
                setTimeout(startAutoSlide, 8000);
            });
        }

        // Start auto slideshow
        startAutoSlide();
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

    // 5. Load Jobs if on Career Page
    if (document.getElementById('job-listings')) {
        loadJobs();
    }
});

/**
 * Career Page Logic
 */
async function loadJobs() {
    const container = document.getElementById('job-listings');
    if (!container) return;

    try {
        const { data: jobs, error } = await supabase
            .from('job_postings')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!jobs || jobs.length === 0) {
            renderNoJobs();
            return;
        }

        renderJobs(jobs);
    } catch (error) {
        console.error('Error loading jobs:', error);
        renderError();
    }
}

function renderJobs(jobs) {
    const container = document.getElementById('job-listings');
    container.innerHTML = jobs.map(job => {
        const descriptionText = (job.description || 'Detailed role responsibilities and expectations are shared here once published by HR.').trim();
        const descriptionHtml = descriptionText.replace(/\n/g,'<br>');
        const needsToggle = descriptionText.length > 220;
        const employmentType = (job.employment_type || 'Full Time').trim();
        const employmentModifier = employmentType.toLowerCase();
        const employmentClass = employmentModifier.includes('contract')
            ? 'contract'
            : employmentModifier.includes('part')
                ? 'part-time'
                : 'full-time';
        const metaEntries = [
            { icon: 'bi bi-geo-alt', label: 'Location', value: job.location || 'Onda, Goa' },
            { icon: 'bi bi-person', label: 'Preferable', value: job.gender_preference || 'Any' },
            { icon: 'bi bi-briefcase', label: 'Experience', value: job.experience_needed || 'Not specified' },
            { icon: 'bi bi-mortarboard', label: 'Qualification', value: job.qualification || 'Not specified' },
            { icon: 'bi bi-calendar-event', label: 'Apply Before', value: job.apply_before ? new Date(job.apply_before).toLocaleDateString('en-GB') : 'N/A' }
        ];
        const metaHtml = metaEntries.map(entry => `
            <div class="job-meta-item">
                <span class="meta-label">${entry.label}</span>
                <div class="meta-value">
                    <i class="${entry.icon}"></i>
                    <span>${entry.value}</span>
                </div>
            </div>
        `).join('');

        return `
        <div class="job-card modern-card reveal-up active">
            <div class="job-card-header">
                <div class="job-title-area">
                    <h3>${job.title}</h3>
                    <p class="job-department">${job.department || 'General'}</p>
                </div>
                <div class="employment-pill ${employmentClass}">
                    ${employmentType}
                </div>
            </div>
            
            <div class="job-meta">
                ${metaHtml}
            </div>

            <div class="job-description ${needsToggle ? 'collapsed' : 'expanded'}">
                <p>${descriptionHtml}</p>
            </div>
            ${needsToggle ? '<button type="button" class="job-description-toggle" data-expanded="false">Read more</button>' : ''}

            <div class="job-card-footer">
                <div class="job-salary-info">
                    ${job.salary_range ? `<div class="salary-range">Salary: ${job.salary_range}</div>` : ''}
                    ${job.num_positions ? `<div class="positions-count">${job.num_positions} position${job.num_positions > 1 ? 's' : ''} available</div>` : ''}
                </div>
                <a href="mailto:viraj.j@usig.com?subject=Application for ${job.title}" class="btn-main apply-btn">Apply Now</a>
            </div>
        </div>
    `}).join('');
    attachDescriptionToggles();
}

function attachDescriptionToggles() {
    document.querySelectorAll('.job-description-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const desc = btn.previousElementSibling;
            const expanded = btn.dataset.expanded === 'true';
            desc.classList.toggle('expanded', !expanded);
            desc.classList.toggle('collapsed', expanded);
            btn.dataset.expanded = (!expanded).toString();
            btn.textContent = expanded ? 'Read more' : 'Show less';
        });
    });
}

function renderNoJobs() {
    const container = document.getElementById('job-listings');
    container.innerHTML = `
        <div class="modern-card">
            <div class="no-jobs-message">
                <i class="bi bi-briefcase" style="font-size: 3rem; color: var(--primary); opacity: 0.3;"></i>
                <p style="margin-top: 1rem;">Currently, there are no open positions. <br>Please check back later or send your CV to HR.</p>
                <a href="mailto:viraj.j@usig.com" class="btn-main" style="margin-top: 2rem; display: inline-block;">Send CV to HR</a>
            </div>
        </div>
    `;
}

function renderError() {
    const container = document.getElementById('job-listings');
    container.innerHTML = `
        <div class="modern-card">
            <div class="no-jobs-message">
                <i class="bi bi-exclamation-triangle" style="font-size: 3rem; color: #dc3545; opacity: 0.5;"></i>
                <p style="margin-top: 1rem;">Unable to load job postings at this time. <br>Please try again later.</p>
                <a href="mailto:viraj.j@usig.com" class="btn-main" style="margin-top: 2rem; display: inline-block;">Contact HR Directly</a>
            </div>
        </div>
    `;
}
