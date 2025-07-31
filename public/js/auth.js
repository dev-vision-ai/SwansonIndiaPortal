import { supabase } from "../supabase-config.js";

// Classic Remember Me: Prefill credentials if saved

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

    // Classic Remember Me: Save or remove credentials
    if (rememberMe) {
        localStorage.setItem('rememberedEmpCode', empCode);
        localStorage.setItem('rememberedPassword', password);
    } else {
        localStorage.removeItem('rememberedEmpCode');
        localStorage.removeItem('rememberedPassword');
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: `${empCode.toLowerCase()}@swanson.co.in`, // Updated domain
            password: password,
        });

        if (error) throw error;

        const user = data.user;

        // Store session in localStorage or sessionStorage
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

        // Fetch user role and department from the database
        const { data: userProfile, error: profileError } = await supabase
            .from('users') 
            .select('is_admin, department') 
            .eq('id', user.id)
            .single();

        if (profileError) {
             // Handle case where user exists in auth but not in users table
             console.error("Error fetching user profile:", profileError);
             message.textContent = "Login failed: User profile not found."; 
             // Optionally sign the user out again here if profile is mandatory
             // await supabase.auth.signOut(); 
             return; 
        }

        // Check if userProfile is null (shouldn't happen with .single() unless error, but good practice)
        if (!userProfile) {
            message.textContent = "Login failed: Could not retrieve user profile.";
            return;
        }

        const isAdmin = userProfile.is_admin; 
        const department = userProfile.department; 

        // ---- Debugging Logs ----
        console.log("Attempting redirection for user:", user.email);
        console.log("Fetched isAdmin:", isAdmin, "(Type:", typeof isAdmin, ")");
        console.log("Fetched department:", `"${department}"`, "(Type:", typeof department, ")"); // Log department with quotes to see spaces
        // ---- End Debugging Logs ----

        // Check if user is a shift user (shift-a, shift-b, shift-c) and redirect directly to inline inspection form
        const username = user.email.split('@')[0].toLowerCase();
        if (username.includes('shift-a') || username.includes('shift-b') || username.includes('shift-c')) {
            console.log("Shift user detected. Redirecting directly to inline inspection form.");
            const basePath = window.location.pathname.includes('/public/') ? '/public' : '';
            window.location.href = `${basePath}/html/inline_inspection_form.html`;
            return; // Skip all other redirection logic
        }

        // After successful login check for stored redirect URL.
        // Only honor it if the user is an ADMIN (QA or Dept). Regular employees should NOT be taken to admin pages.
        const storedRedirect = sessionStorage.getItem('redirectAfterLogin');
        if (storedRedirect) {
            if (isAdmin === true) {
                sessionStorage.removeItem('redirectAfterLogin');
                window.location.href = storedRedirect;
                return; // Skip normal redirects
            }
            // Non-admin: ignore the stored redirect so they land on their dashboard
            sessionStorage.removeItem('redirectAfterLogin');
        }

        // Determine base path depending on deployment (local dev adds '/public')
        const basePath = window.location.pathname.includes('/public/') ? '/public' : '';

        // Redirect based on role and department
        if (isAdmin === true) { 
            console.log("User is admin. Checking department..."); 
            // Update the string here to match the database value
            if (department === 'Human Resources') { 
                console.log("Department matches 'Human Resources'. Redirecting to admin_adhr."); 
                window.location.href = `${basePath}/html/admin_adhr.html`; 
            } else if (department === 'Quality Assurance') {
                console.log("Department matches 'Quality Assurance'. Redirecting to admin_qa."); // Log successful match
                window.location.href = `${basePath}/html/admin_qa.html`;
            } else if (department === 'IQA') { // <-- Add this else if block
                console.log("Department matches 'IQA'. Redirecting to admin_iqa."); 
                window.location.href = `${basePath}/html/admin_iqa.html`;
            } else if (department === 'QC' || department === 'Quality Control') {
                console.log("Department matches 'QC' or 'Quality Control'. Redirecting to admin_qc.");
                window.location.href = `${basePath}/html/admin_qc.html`;
            } else {
                // Fallback for admins with unexpected departments
                console.warn("Admin user has an unrecognized department:", department);
                message.textContent = "Login successful, but admin role is unclear."; // <-- This line is being executed
                // Maybe redirect to a generic admin landing page?
                // window.location.href = "../admins_dashboard/admin_default/index.html"; 
            }
        } else {
            // User is not an admin (is_admin is FALSE or null)
            console.log("User is not admin. Redirecting to dashboard."); // Log non-admin redirect
            window.location.href = `${basePath}/html/employee_dashboard.html`;
        }

    } catch (error) {
        console.error("Login failed:", error);
        message.textContent = "Login failed. Please check credentials.";
    }
});

// Logout logic
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        // Remove session from both storages
        localStorage.removeItem('supabase.auth.session');
        sessionStorage.removeItem('supabase.auth.session');
        const basePath = window.location.pathname.includes('/public/') ? '/public' : '';
        window.location.replace(`${basePath}/html/auth.html`);
    } catch (error) {
        console.error("Error logging out:", error);
        alert("Error logging out. Please try again.");
    }
});

// Password eye icon toggle
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
