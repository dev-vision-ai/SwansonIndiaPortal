import { supabase } from "../supabase-config.js";

// Configuration constants
const EMAIL_DOMAIN = 'swanson.co.in';
const ESSENTIAL_STORAGE_KEYS = ['rememberedEmpCode', 'rememberedPassword'];
const SHIFT_USER_PREFIXES = ['shift-a', 'shift-b', 'shift-c'];

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
            window.location.href = `${basePath}/html/inline-inspection-form.html`;
            return;
        }

        // Redirect all users to employee dashboard
        console.log("Redirecting to employee dashboard.");
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
    // Cleanup code removed - slideshow functionality no longer exists
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
