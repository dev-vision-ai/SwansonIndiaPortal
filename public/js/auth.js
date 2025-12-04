import { supabase } from "../supabase-config.js";

// Configuration constants
const EMAIL_DOMAIN = 'swanson.co.in';
const ESSENTIAL_STORAGE_KEYS = ['rememberedEmpCode', 'rememberedPassword'];
const SHIFT_USER_PREFIXES = ['shift-a', 'shift-b', 'shift-c'];

// Slideshow configuration
const SLIDESHOW_IMAGES = ['1.png', '2.png', '3.png', '4.png', '5.png', '6.png', '7.png', '8.png', '9.png', '10.png'];
const SLIDESHOW_INTERVAL = 5000; // 5 seconds per image
let currentSlideIndex = 0;
let slideshowInterval = null;
let isHovering = false;
let resumeTimer = null;

// ===== SLIDESHOW FUNCTIONALITY =====
function initializeSlideshow() {
    const slideshowImage = document.getElementById('slideshowImage');
    const slideshowContainer = document.getElementById('slideshowContainer');
    const prevBtn = document.getElementById('slideshowPrevBtn');
    const nextBtn = document.getElementById('slideshowNextBtn');

    if (!slideshowImage || !slideshowContainer) return;

    // Start automatic slideshow
    slideshowInterval = setInterval(() => {
        nextSlide();
    }, SLIDESHOW_INTERVAL);

    // Add mouse hover pause/resume functionality
    slideshowContainer.addEventListener('mouseenter', () => {
        isHovering = true;
        pauseSlideshow();
        // Cancel any scheduled resumes while hovering
        if (resumeTimer) {
            clearTimeout(resumeTimer);
            resumeTimer = null;
        }
    });
    slideshowContainer.addEventListener('mouseleave', () => {
        isHovering = false;
        // Resume only when the cursor has left the slideshow container
        resumeSlideshow();
    });

    // Add mouse wheel scroll functionality
    slideshowContainer.addEventListener('wheel', handleMouseWheel, { passive: false });

    // Add button click handlers
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            pauseSlideshow();
            prevSlide();
            scheduleResume(2000);
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            pauseSlideshow();
            nextSlide();
            scheduleResume(2000);
        });
    }
}

function pauseSlideshow() {
    if (slideshowInterval) {
        clearInterval(slideshowInterval);
        slideshowInterval = null;
    }
}

function resumeSlideshow() {
    // Only resume if the cursor is not hovering over the slideshow
    if (isHovering) return;

    // Clear any scheduled resume timer, since we're resuming now
    if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
    }

    if (!slideshowInterval) {
        slideshowInterval = setInterval(() => {
            nextSlide();
        }, SLIDESHOW_INTERVAL);
    }
}


function handleMouseWheel(event) {
    event.preventDefault(); // Prevent default scrolling behavior

    // Pause automatic slideshow temporarily
    pauseSlideshow();

    // Determine scroll direction
    if (event.deltaY > 0) {
        // Scroll down - next slide
        nextSlide();
    } else {
        // Scroll up - previous slide
        prevSlide();
    }

    // Resume slideshow after a short delay if not hovering
    scheduleResume(2000);
}

function nextSlide() {
    const nextIndex = (currentSlideIndex + 1) % SLIDESHOW_IMAGES.length;
    slideTo(nextIndex, 'next');
}

function prevSlide() {
    const prevIndex = (currentSlideIndex - 1 + SLIDESHOW_IMAGES.length) % SLIDESHOW_IMAGES.length;
    slideTo(prevIndex, 'prev');
}
function slideTo(index, direction = 'next') {
    const currentImg = document.getElementById('slideshowImage');
    const nextImg = document.getElementById('slideshowImageNext');
    if (!currentImg || !nextImg) return;

    const newSrc = `../assets/login-page/${SLIDESHOW_IMAGES[index]}`;
    // Prepare next image
    nextImg.src = newSrc;
    // starting positions
    if (direction === 'next') {
        nextImg.style.transform = 'translateX(100%)';
        currentImg.style.transform = 'translateX(0)';
    } else {
        nextImg.style.transform = 'translateX(-100%)';
        currentImg.style.transform = 'translateX(0)';
    }

    // Force reflow so initial transform is applied
    // eslint-disable-next-line no-unused-expressions
    nextImg.getBoundingClientRect();

    // Apply transitions
    currentImg.style.transition = 'transform 700ms ease-in-out';
    nextImg.style.transition = 'transform 700ms ease-in-out';

    if (direction === 'next') {
        currentImg.style.transform = 'translateX(-100%)';
        nextImg.style.transform = 'translateX(0)';
    } else {
        currentImg.style.transform = 'translateX(100%)';
        nextImg.style.transform = 'translateX(0)';
    }

    // After transition completes, swap images
    setTimeout(() => {
        // set current image to new src and reset transforms
        currentImg.src = newSrc;
        currentImg.style.transition = '';
        currentImg.style.transform = 'translateX(0)';

        // reset nextImg off-screen for reuse
        nextImg.style.transition = '';
        nextImg.style.transform = direction === 'next' ? 'translateX(100%)' : 'translateX(-100%)';

        // Update current index
        currentSlideIndex = index;
    }, 750); // transition duration (matches CSS)
}

function stopSlideshow() {
    if (slideshowInterval) {
        clearInterval(slideshowInterval);
        slideshowInterval = null;
    }
}

function scheduleResume(delay) {
    if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
    }
    resumeTimer = setTimeout(() => {
        // Only resume automatically if not hovering
        if (!isHovering) resumeSlideshow();
        resumeTimer = null;
    }, delay);
}

// Prefill saved credentials on page load
document.addEventListener('DOMContentLoaded', () => {
    const empCodeInput = document.getElementById('empcode');
    const passwordInput = document.getElementById('password');
    const rememberMe = document.getElementById('rememberMe');
    const savedEmpCode = localStorage.getItem('rememberedEmpCode');
    const savedPassword = localStorage.getItem('rememberedPassword');
    if (savedEmpCode && savedPassword) {
        empCodeInput.value = savedEmpCode;
        passwordInput.value = savedPassword;
        rememberMe.checked = true;
    }

    // Initialize slideshow
    initializeSlideshow();
});

/**
 * Handles user login with Supabase authentication
 */
document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const empCode = document.getElementById("empcode").value.trim().toUpperCase();
    const password = document.getElementById("password").value.trim();
    const message = document.getElementById("message");
    const rememberMe = document.getElementById("rememberMe").checked;

    message.textContent = ""; // Clear previous errors

    if (!empCode || !password) {
        message.textContent = "Please enter both fields.";
        return;
    }

    // Save or clear credentials based on remember me preference
    if (rememberMe) {
        localStorage.setItem('rememberedEmpCode', empCode);
        localStorage.setItem('rememberedPassword', password);
    } else {
        localStorage.removeItem('rememberedEmpCode');
        localStorage.removeItem('rememberedPassword');
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: `${empCode.toLowerCase()}@${EMAIL_DOMAIN}`,
            password: password,
        });

        if (error) throw error;

        const user = data.user;

        // Store session based on remember me preference
        const session = supabase.auth.getSession ? (await supabase.auth.getSession()).data.session : data.session;
        if (session) {
            const sessionStr = JSON.stringify(session);
            if (rememberMe) {
                localStorage.setItem('supabase.auth.session', sessionStr);
                sessionStorage.removeItem('supabase.auth.session');
            } else {
                sessionStorage.setItem('supabase.auth.session', sessionStr);
                localStorage.removeItem('supabase.auth.session');
            }
        }

        // Fetch user profile from database
        const { data: userProfile, error: profileError } = await supabase
            .from('users') 
            .select('is_admin, department') 
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error("Error fetching user profile:", profileError);
            message.textContent = "Login failed: User profile not found."; 
            return; 
        }

        if (!userProfile) {
            message.textContent = "Login failed: Could not retrieve user profile.";
            return;
        }

        // Determine base path depending on deployment (local dev adds '/public')
        const basePath = window.location.pathname.includes('/public/') ? '/public' : '';

        // Check for shift users and redirect to inline inspection form
        const username = user.email.split('@')[0].toLowerCase();
        if (SHIFT_USER_PREFIXES.some(prefix => username.includes(prefix))) {
            console.log("Shift user detected. Redirecting directly to inline inspection form.");
            stopSlideshow(); // Stop slideshow before redirect
            window.location.href = `${basePath}/html/inline-inspection-form.html`;
            return;
        }

        // Redirect all users to employee dashboard
        console.log("Redirecting to employee dashboard.");
        stopSlideshow(); // Stop slideshow before redirect
        window.location.href = `${basePath}/html/employee-dashboard.html`;

    } catch (error) {
        console.error("Login failed:", error);
        message.textContent = "Login failed. Please check credentials.";
    }
});

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
    stopSlideshow();
});

/**
 * Handles user logout with session cleanup and back navigation prevention
 */
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    const basePath = window.location.pathname.includes('/public/') ? '/public' : '';

    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        // Remove session from both storages
        localStorage.removeItem('supabase.auth.session');
        sessionStorage.removeItem('supabase.auth.session');

        // Aggressive back button prevention
        window.history.replaceState({ loggedOut: true }, '', window.location.href);

        // Clear all storage except essential items
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const key = sessionStorage.key(i);
            if (!ESSENTIAL_STORAGE_KEYS.includes(key)) {
                sessionStorage.removeItem(key);
            }
        }

        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!ESSENTIAL_STORAGE_KEYS.includes(key)) {
                localStorage.removeItem(key);
            }
        }

        // Force redirect with cache busting
        const logoutUrl = `${basePath}/html/auth.html?logout=${Date.now()}`;
        stopSlideshow(); // Stop slideshow before logout redirect
        window.location.replace(logoutUrl);

    } catch (error) {
        console.error("Error logging out:", error);
        alert("Error logging out. Please try again.");
    }
});

/**
 * Password visibility toggle functionality
 */
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('togglePassword');
const eyeIcon = document.getElementById('eyeIcon');
if (togglePasswordBtn && passwordInput && eyeIcon) {
    togglePasswordBtn.addEventListener('click', function() {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        eyeIcon.classList.toggle('fa-eye');
        eyeIcon.classList.toggle('fa-eye-slash');
    });
}
