import { supabase } from '../supabase-config.js';
import { showToast, storePendingToast } from './toast.js';

let currentCategory = 'RM';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Back Button
    const backBtn = document.querySelector('.header-back-button');
    if (backBtn) backBtn.addEventListener('click', () => window.location.href = 'stock-report.html');
    document.body.classList.add('page-fade-in');

    // 2. Setup Tabs
    setupTabs();

    // 3. Setup Filters
    setupFilters();

    // 4. Load Data (Read Only)
    loadExistingRecords();
});

function setupTabs() {
    const tabRM = document.getElementById('tabRM');
    const tabInk = document.getElementById('tabInk');
    const tabPM = document.getElementById('tabPM');

    function setActive(cat) {
        currentCategory = cat;
        
        // 1. Reset Tab Visuals
        const inactiveClass = 'tab-btn px-3 py-1 bg-white text-gray-700 rounded text-xs border border-gray-200';
        tabRM.className = inactiveClass;
        tabInk.className = inactiveClass;
        tabPM.className = inactiveClass;

        // 2. Activate Selected Tab & Toggle "Bags" Column
        if (cat === 'RM') {
            tabRM.className = 'tab-btn px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700';
            toggleBagsColumn(true); // SHOW Bags for Raw Material
        }
        if (cat === 'INK') {
            tabInk.className = 'tab-btn px-3 py-1 bg-amber-600 text-white rounded text-xs hover:bg-amber-700';
            toggleBagsColumn(false); // HIDE Bags for Ink
        }
        if (cat === 'PM') {
            tabPM.className = 'tab-btn px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700';
            toggleBagsColumn(false); // HIDE Bags for Packing
        }
        
        // 3. Reload Data
        loadExistingRecords();
    }

    if(tabRM) tabRM.addEventListener('click', () => setActive('RM'));
    if(tabInk) tabInk.addEventListener('click', () => setActive('INK'));
    if(tabPM) tabPM.addEventListener('click', () => setActive('PM'));
    
    // Initialize default state (RM = Show Bags)
    toggleBagsColumn(true);
}

// Helper: Hides or Shows the 6th Column (Index 5) which is "Bags"
function toggleBagsColumn(show) {
    const table = document.getElementById('materialAvailabilityTable');
    if (!table) return;

    // 1. Toggle Header
    // "Bags" is the 6th <th> (index 5)
    const th = table.querySelector('thead tr th:nth-child(6)');
    if (th) {
        th.style.display = show ? '' : 'none';
    }

    // 2. Toggle Body Cells (we do this after data load, but setting a class helps)
    // Since rows are re-generated on loadExistingRecords(), we need to handle it there too.
    // See step below.
    table.setAttribute('data-show-bags', show); 
}

function setupFilters() {
    const els = ['dateFrom', 'dateTo', 'materialSearch', 'statusFilter'];
    els.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', applyFilters);
        if(el) el.addEventListener('change', applyFilters);
    });

    document.getElementById('clearFilter')?.addEventListener('click', () => {
        els.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.value = '';
        });
        applyFilters();
    });
}

// --- DATA LOADING ---
async function loadExistingRecords() {
    // Fetch only active records
    let query = supabase.from('pd_material_staging')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) { 
        console.error('Error:', error); 
        showToast('Error loading material data. Please try again.', 'error');
        return; 
    }

    const tbody = document.getElementById('materialTableBody');
    tbody.innerHTML = '';

    data.forEach(record => {
        // FILTERING LOGIC
        let match = false;
        const type = (record.material_type || '').toLowerCase();
        
        if (currentCategory === 'RM') {
            if (type.includes('raw') || type.includes('resin') || type === 'rm') match = true;
        } 
        else if (currentCategory === 'INK') {
            // Includes all Printing Materials
            if (type.includes('ink') || type.includes('printing') || type.includes('reducer') || type.includes('slip') || 
                type.includes('medium') || type.includes('retarder') || type.includes('overcoat') || type.includes('extender') || 
                type.includes('additive') || type.includes('intermediate') || type.includes('prt-mat')) match = true;
        } 
        else if (currentCategory === 'PM') {
            if (type.includes('pack') || type.includes('pm') || type.includes('pallet') || type.includes('core') || 
                type.includes('wrap') || type.includes('corrugated') || type.includes('bubble') || type.includes('sticker') || 
                type.includes('tape') || type.includes('kraft')) match = true;
        }

        if (match) addRowToTable(record);
    });
    
    // ADD THIS LINE AT THE END:
    applyFilters(); // <--- Re-apply search/date/status filters to the new data
    
    // Check if empty
    const msg = document.getElementById('emptyStateMessage');
    if (tbody.children.length === 0) msg.classList.remove('hidden');
    else msg.classList.add('hidden');
}

function addRowToTable(record) {
    const tbody = document.getElementById('materialTableBody');
    const table = document.getElementById('materialAvailabilityTable');
    
    const showBags = table.getAttribute('data-show-bags') === 'true';
    const displayStyle = showBags ? '' : 'display: none;';

    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50 transition-colors border-b';

    // 1. Format Both Dates
    const issuedDateRaw = new Date(record.issued_date);
    const issuedDateStr = issuedDateRaw.toLocaleDateString('en-GB');
    
    // NEW: Proper handling for requisition_date
    let reqDateStr = '-';
    if (record.requisition_date) {
        const reqDateRaw = new Date(record.requisition_date);
        reqDateStr = reqDateRaw.toLocaleDateString('en-GB');
    }

    // Create ISO Date for easy filtering
    const isoDate = record.issued_date.split('T')[0]; 
    const lotNo = record.lot_no || '-';
    const uomDisplay = record.uom || '-';

    row.setAttribute('data-status', record.status); 
    row.setAttribute('data-date', isoDate);
    const searchText = `${record.track_id} ${lotNo} ${record.material_name} ${record.status}`.toLowerCase();
    row.setAttribute('data-search', searchText);

    row.innerHTML = `
        <td class="px-2 py-1.5 text-center font-mono text-blue-600 font-bold bg-gray-50 border-r">${record.track_id}</td>
        
        <td class="px-2 py-1.5 text-center border-r font-medium text-gray-600">
            ${reqDateStr}
        </td>
        
        <td class="px-2 py-1.5 text-center border-r font-bold text-gray-800">${issuedDateStr}</td>
        
        <td class="px-2 py-1.5 text-center text-blue-800 font-mono text-xs border-r bg-yellow-50">${lotNo}</td>
        <td class="px-2 py-1.5 text-left border-r font-medium">${record.material_name}</td>

        <td class="px-2 py-1.5 text-center border-r" style="${displayStyle}">
            ${Number(record.bags || 0).toFixed(0)} 
        </td>

        <td class="px-2 py-1.5 text-center border-r font-semibold text-gray-700">${(record.issued_qty || 0).toFixed(2)}</td>
        <td class="px-2 py-1.5 text-center border-r text-gray-500">${(record.consumed_qty || 0).toFixed(2)}</td>
        <td class="px-2 py-1.5 text-center border-r font-bold text-green-700">${(record.balance_qty || 0).toFixed(2)}</td>
        <td class="px-2 py-1.5 text-center border-r text-xs font-bold text-gray-500 bg-gray-50">
            ${uomDisplay}
        </td>
        <td class="px-2 py-1.5 text-center border-r text-[10px] uppercase font-bold text-blue-600">${record.status}</td>
    `;

    tbody.appendChild(row);
}

// Client-side Filter
function applyFilters() {
    const search = document.getElementById('materialSearch').value.toLowerCase();
    const status = document.getElementById('statusFilter').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;

    const rows = document.querySelectorAll('#materialTableBody tr');
    
    let visibleCount = 0;

    rows.forEach(row => {
        // 1. Get Data from Attributes (Fast & Reliable)
        const rowSearchText = row.getAttribute('data-search');
        const rowStatus = row.getAttribute('data-status');
        const rowDate = row.getAttribute('data-date'); // YYYY-MM-DD

        let show = true;

        // 2. Search Logic
        if(search && !rowSearchText.includes(search)) show = false;

        // 3. Status Logic (Exact Match)
        if(status && rowStatus !== status) show = false;

        // 4. Date Logic (String Comparison works for ISO dates)
        if(dateFrom && rowDate < dateFrom) show = false;
        if(dateTo && rowDate > dateTo) show = false;
        
        // 5. Toggle Visibility
        row.style.display = show ? '' : 'none';
        
        if(show) visibleCount++;
    });

    // Optional: Show "No Data" message if filter hides everything
    const emptyMsg = document.getElementById('emptyStateMessage');
    if(emptyMsg) {
        // Only show if table is truly empty OR filter hides everything
        if(rows.length > 0 && visibleCount === 0) {
             emptyMsg.classList.remove('hidden');
             emptyMsg.querySelector('p').textContent = "No records match your filters";
        } else if (rows.length === 0) {
             emptyMsg.classList.remove('hidden');
             emptyMsg.querySelector('p').textContent = "No stock available";
        } else {
             emptyMsg.classList.add('hidden');
        }
    }
}