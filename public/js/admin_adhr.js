// Basic functionality for admin ADHR dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Toggle dropdown menu
    const menuIcon = document.querySelector('.menu-icon');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    
    if (menuIcon && dropdownMenu) {
        menuIcon.addEventListener('click', function() {
            dropdownMenu.classList.toggle('show');
        });
    }

    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // Add logout logic here
            console.log('Logout clicked');
        });
    }
});
