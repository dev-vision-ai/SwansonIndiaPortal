import { supabase } from '../supabase-config.js';

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    await loadGcasOptions();
    await loadProductOptions();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    document.getElementById('downloadBtn').addEventListener('click', handleDownload);
    document.getElementById('clearFilter').addEventListener('click', clearFilters);
    
    // Add GCAS change listener to auto-select product
    document.getElementById('filterGcas').addEventListener('change', async (e) => {
        const selectedGcas = e.target.value;
        if (selectedGcas) {
            await autoSelectProductForGcas(selectedGcas);
        } else {
            // If no GCAS selected, reset product
            document.getElementById('filterProduct').value = '';
        }
        updateFilterStatus();
    });
    
    // Add filter change listeners to update status indicator
    const filterElements = ['filterFromDate', 'filterToDate', 'filterMachine', 'filterGcas', 'filterProduct'];
    filterElements.forEach(id => {
        document.getElementById(id).addEventListener('change', updateFilterStatus);
    });
}

// Update filter status indicator
function updateFilterStatus() {
    const filterFromDate = document.getElementById('filterFromDate').value;
    const filterToDate = document.getElementById('filterToDate').value;
    const filterMachine = document.getElementById('filterMachine').value;
    const filterGcas = document.getElementById('filterGcas').value;
    const filterProduct = document.getElementById('filterProduct').value;

    const hasActiveFilters = filterFromDate || filterToDate || filterMachine || filterGcas || filterProduct;
    
    const indicator = document.getElementById('filterStatusIndicator');
    if (hasActiveFilters) {
        indicator.textContent = 'On';
        indicator.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-green-200 text-green-800';
    } else {
        indicator.textContent = 'Off';
        indicator.className = 'px-2 py-1 text-sm font-semibold rounded-full bg-gray-200 text-gray-700';
    }
}

// Clear all filters
function clearFilters() {
    document.getElementById('filterFromDate').value = '';
    document.getElementById('filterToDate').value = '';
    document.getElementById('filterMachine').value = '';
    document.getElementById('filterGcas').value = '';
    document.getElementById('filterProduct').value = '';
    updateFilterStatus();
}

// Load GCAS options from database
async function loadGcasOptions() {
    try {
        const { data, error } = await supabase
            .from('inline_products_master')
            .select('gcas_no')
            .not('gcas_no', 'is', null)
            .order('gcas_no');

        if (error) throw error;

        const gcasSelect = document.getElementById('filterGcas');
        
        // Clear existing options except "All"
        gcasSelect.innerHTML = '<option value="">All</option>';
        
        // Add unique GCAS options
        if (data && data.length > 0) {
            const uniqueGcas = [...new Set(data.map(item => item.gcas_no))];
            uniqueGcas.forEach(gcas => {
                const option = document.createElement('option');
                option.value = gcas;
                option.textContent = gcas;
                gcasSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading GCAS options:', error);
        // Fallback options if database query fails
        const gcasSelect = document.getElementById('filterGcas');
        gcasSelect.innerHTML = `
            <option value="">All</option>
            <option value="GCAS 1">GCAS 1</option>
            <option value="GCAS 2">GCAS 2</option>
            <option value="GCAS 3">GCAS 3</option>
        `;
    }
}

// Load Product options from database
async function loadProductOptions(selectedGcas = null) {
    try {
        let query = supabase
            .from('inline_products_master')
            .select('prod_code, gcas_no')
            .not('prod_code', 'is', null)
            .order('prod_code');

        // If a specific GCAS is selected, filter products by that GCAS
        if (selectedGcas) {
            query = query.eq('gcas_no', selectedGcas);
        }

        const { data, error } = await query;

        if (error) throw error;

        const productSelect = document.getElementById('filterProduct');
        
        // Clear existing options except "All"
        productSelect.innerHTML = '<option value="">All</option>';
        
        // Add unique Product options
        if (data && data.length > 0) {
            const uniqueProducts = [...new Set(data.map(item => item.prod_code))];
            uniqueProducts.forEach(product => {
                const option = document.createElement('option');
                option.value = product;
                option.textContent = product;
                productSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading Product options:', error);
        // Fallback options if database query fails
        const productSelect = document.getElementById('filterProduct');
        productSelect.innerHTML = `
            <option value="">All</option>
            <option value="Product A">Product A</option>
            <option value="Product B">Product B</option>
            <option value="Product C">Product C</option>
        `;
    }
}

// Auto-select product when GCAS is selected
async function autoSelectProductForGcas(selectedGcas) {
    try {
        const { data, error } = await supabase
            .from('inline_products_master')
            .select('prod_code')
            .eq('gcas_no', selectedGcas)
            .not('prod_code', 'is', null)
            .order('prod_code')
            .limit(1); // Get the first product for this GCAS

        if (error) throw error;

        const productSelect = document.getElementById('filterProduct');
        
        if (data && data.length > 0) {
            // Auto-select the first product for this GCAS
            const autoSelectedProduct = data[0].prod_code;
            productSelect.value = autoSelectedProduct;
        } else {
            // No products found for this GCAS
            productSelect.value = '';
        }
    } catch (error) {
        console.error('Error auto-selecting product for GCAS:', error);
        // Reset product selection on error
        document.getElementById('filterProduct').value = '';
    }
}

// Handle Download
async function handleDownload() {
    const downloadBtn = document.getElementById('downloadBtn');
    const originalContent = downloadBtn.innerHTML;
    
    try {
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = 'Downloading...';

        const filterFromDate = document.getElementById('filterFromDate').value;
        const filterToDate = document.getElementById('filterToDate').value;
        const filterMachine = document.getElementById('filterMachine').value;
        const filterGcas = document.getElementById('filterGcas').value;
        const filterProduct = document.getElementById('filterProduct').value;

        const params = new URLSearchParams();
        if (filterFromDate) params.append('start_date', filterFromDate);
        if (filterToDate) params.append('end_date', filterToDate);
        if (filterMachine) params.append('machine', filterMachine);
        if (filterGcas) params.append('gcas', filterGcas);
        if (filterProduct) params.append('product', filterProduct);

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const backendUrl = isLocalhost ? 'http://localhost:3000' : 'https://swanson-backend.onrender.com';
        const exportUrl = `${backendUrl}/export-control-datapoints?${params.toString()}`;

        const response = await fetch(exportUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Download failed');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Control-Summary-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (error) {
        console.error('Download error:', error);
        alert('Failed to download file. Please ensure the backend server is running.');
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = 'Download';
    }
}