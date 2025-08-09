import { supabase } from '../supabase-config.js';

console.log('🚀 Production Report - Fresh Start');

// Global variables
let allForms = [];
let filteredForms = [];

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    console.log('📊 Initializing Production Report...');
    
    // Setup back button
    const backBtn = document.querySelector('.header-back-button');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            window.location.href = 'employee_dashboard.html';
        });
    }
    
    // Initialize filter functionality
    initializeFilters();
    
    // Load initial data
    loadFormsData();
    
    console.log('✅ Production Report initialized');
});

// Placeholder for filter functionality (removed)
function initializeFilters() {
    console.log('🔧 Filter functionality removed');
}

// Load forms data from database
async function loadFormsData() {
    try {
        console.log('📥 Loading forms data...');
        
        // Load ALL forms data from the database
        const { data, error } = await supabase
            .from('inline_inspection_form_master_2')
            .select('*')
            .order('production_date', { ascending: false });
        
        if (error) throw error;
        
        console.log(`✅ Loaded ${data?.length || 0} records from database`);
        
        // Load data
        allForms = data || [];
        
        console.log('✅ Data loaded - no filtering or display');
        
    } catch (error) {
        console.error('❌ Error loading forms:', error);
    }
}

// All filter and summary table logic removed

// Format date for display
function formatDate(dateString) {
    if (!dateString) return null;
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB'); // DD/MM/YYYY format
    } catch (error) {
        return dateString;
    }
}

// Get shift label
function getShiftLabel(shift) {
    const shiftMap = { '1': 'A', '2': 'B', '3': 'C' };
    return shiftMap[shift] || shift;
}
