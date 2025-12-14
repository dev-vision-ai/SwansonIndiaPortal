import { supabase } from '../supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // Setup back button
    const backBtn = document.querySelector('.header-back-button');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            window.location.href = 'employee-dashboard.html';
        });
    }

    // Add page fade-in effect
    document.body.classList.add('page-fade-in');

    // Stock report initialization
    initializeStockReport();
});

function initializeStockReport() {
    console.log('Stock Report page initialized');

    // Add any stock report specific functionality here
    // This is a placeholder for future implementation
}