document.addEventListener('DOMContentLoaded', function() {
    const backBtn = document.querySelector('.header-back-button');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            window.location.href = 'employee_dashboard.html';
        });
    }
}); 