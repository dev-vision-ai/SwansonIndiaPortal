import { supabase } from "../supabase-config.js";

// Configuration constants
const EMAIL_DOMAIN = 'swanson.co.in';
const ESSENTIAL_STORAGE_KEYS = ['rememberedEmpCode', 'rememberedPassword'];
const SHIFT_USER_PREFIXES = ['shift-a', 'shift-b', 'shift-c'];

// Slideshow configuration
const SLIDESHOW_IMAGES = ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.png'];
const SLIDESHOW_INTERVAL = 4000; // 4 seconds per image
let currentSlideIndex = 0;
let slideshowInterval = null;

// Admin department mappings
const ADMIN_REDIRECTS = {
    'Human Resources': 'admin-adhr.html',
    'IQA': 'admin-iqa.html',
    'Maintenance': 'employee-dashboard.html',
    'MT': 'employee-dashboard.html'
};

// ===== SLIDESHOW FUNCTIONALITY =====
function initializeSlideshow() {
    const slideshowImage = document.getElementById('slideshowImage');
    if (!slideshowImage) return;

    // Start automatic slideshow
    slideshowInterval = setInterval(() => {
        currentSlideIndex = (currentSlideIndex + 1) % SLIDESHOW_IMAGES.length;
        updateSlideshow();
    }, SLIDESHOW_INTERVAL);
}

function updateSlideshow() {
    const slideshowImage = document.getElementById('slideshowImage');
    if (!slideshowImage) return;

    // Add transition animation
    slideshowImage.classList.add('transitioning');
    
    // Change image at the blackout midpoint (optimized for 4-second intervals)
    setTimeout(() => {
        const imagePath = `../assets/login-page/${SLIDESHOW_IMAGES[currentSlideIndex]}`;
        slideshowImage.src = imagePath;
        
        // Add error handling for image loading
        slideshowImage.onerror = () => {
            console.warn(`Failed to load image: ${imagePath}`);
            // Skip to next image if current one fails
            currentSlideIndex = (currentSlideIndex + 1) % SLIDESHOW_IMAGES.length;
        };
    }, 750); // Optimized timing for 4-second intervals
    
    // Remove animation class after completion
    setTimeout(() => {
        slideshowImage.classList.remove('transitioning');
    }, 1500); // Longer animation duration for 4-second intervals
}

function stopSlideshow() {
    if (slideshowInterval) {
        clearInterval(slideshowInterval);
        slideshowInterval = null;
    }
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

        const isAdmin = userProfile.is_admin;
        const department = userProfile.department;

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

        // Redirect based on admin status and department
        if (isAdmin === true) {
            console.log("User is admin. Checking department...");

            const adminPage = ADMIN_REDIRECTS[department];
            if (adminPage) {
                console.log(`Department matches '${department}'. Redirecting to ${adminPage}.`);
                stopSlideshow(); // Stop slideshow before redirect
                window.location.href = `${basePath}/html/${adminPage}`;
            } else {
                console.warn("Admin user has an unrecognized department:", department);
                message.textContent = "Login successful, but admin role is unclear.";
            }
        } else {
            console.log("User is not admin. Redirecting to dashboard.");
            stopSlideshow(); // Stop slideshow before redirect
            window.location.href = `${basePath}/html/employee-dashboard.html`;
        }

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
