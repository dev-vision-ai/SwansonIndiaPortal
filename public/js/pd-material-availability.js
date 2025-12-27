import { supabase } from '../supabase-config.js';

// Global variable for current category
let currentCategory = 'RM';
// Global safety lock to prevent concurrent operations
let isProcessing = false;

document.addEventListener('DOMContentLoaded', () => {
    // Setup back button
    const backBtn = document.querySelector('.header-back-button');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            window.location.href = 'stock-report.html';
        });
    }

    // Add page fade-in effect
    document.body.classList.add('page-fade-in');

    // Setup button listeners
    const addRowBtn = document.getElementById('addRowBtn');
    const addRowDateEl = document.getElementById('addRowDate');
    // default the add-row date picker to today's date (local)
    if (addRowDateEl) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        addRowDateEl.value = `${y}-${m}-${d}`;
    }
    if (addRowBtn) {
        addRowBtn.addEventListener('click', () => {
            const val = addRowDateEl ? addRowDateEl.value : '';
            addNewRow(val);
        });
    }

    const deleteRowBtn = document.getElementById('deleteRowBtn');
    if (deleteRowBtn) {
        deleteRowBtn.addEventListener('click', deleteTopRow);
    }

    // Populate filters from any existing table data
    populateFiltersFromTable();
    // Wire filter inputs: date range, search, status
    const dateFromEl = document.getElementById('dateFrom');
    const dateToEl = document.getElementById('dateTo');
    const searchEl = document.getElementById('materialSearch');
    const statusEl = document.getElementById('statusFilter');
    const clearBtn = document.getElementById('clearFilter');
    // Category tabs
    const tabRM = document.getElementById('tabRM');
    const tabInk = document.getElementById('tabInk');
    const tabPM = document.getElementById('tabPM');

    function setActiveCategory(cat) {
        currentCategory = cat;
        // visual active state
        const activeBase = 'tab-btn px-3 py-1 bg-600 text-white rounded text-xs';
        const inactive = 'tab-btn px-3 py-1 bg-white text-gray-700 rounded text-xs border border-gray-200 hover:bg-gray-50';
        if (tabRM) tabRM.className = cat === 'RM' ? 'tab-btn px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700' : inactive;
        if (tabInk) tabInk.className = cat === 'INK' ? 'tab-btn px-3 py-1 bg-amber-600 text-white rounded text-xs hover:bg-amber-700' : inactive;
        if (tabPM) tabPM.className = cat === 'PM' ? 'tab-btn px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700' : inactive;
        // future: filter table rows by category
    }

    if (tabRM) tabRM.addEventListener('click', () => setActiveCategory('RM'));
    if (tabInk) tabInk.addEventListener('click', () => setActiveCategory('INK'));
    if (tabPM) tabPM.addEventListener('click', () => setActiveCategory('PM'));
    // default active
    setActiveCategory('RM');

    if (dateFromEl) dateFromEl.addEventListener('change', applyFilters);
    if (dateToEl) dateToEl.addEventListener('change', applyFilters);
    if (searchEl) searchEl.addEventListener('input', debounce(applyFilters, 300));
    if (statusEl) statusEl.addEventListener('change', applyFilters);
    if (clearBtn) clearBtn.addEventListener('click', () => {
        if (dateFromEl) dateFromEl.value = '';
        if (dateToEl) dateToEl.value = '';
        if (searchEl) searchEl.value = '';
        if (statusEl) statusEl.value = '';
        populateFiltersFromTable();
        applyFilters();
    });
    // Listen for edits in table to refresh filters (debounced)
    const tbody = document.getElementById('materialTableBody');
    if (tbody) {
        tbody.addEventListener('input', populateFiltersFromTable);
    }

    // Load existing records from database
    loadExistingRecords();
    // Update empty state after loading records
    updateEmptyState();
});

// Helper: Fetch the next available Track ID from the Database
async function getNextTrackId(issuedDate) {
    const yy = String(issuedDate.getFullYear()).slice(-2);
    const mm = String(issuedDate.getMonth() + 1).padStart(2, '0');
    const prefix = `RM${yy}${mm}`;

    // 1. Ask DB for the highest ID with this prefix
    const { data, error } = await supabase
        .from('pd_material_staging')
        .select('track_id')
        .ilike('track_id', `${prefix}-%`)
        .order('track_id', { ascending: false })
        .limit(1);

    let maxSeq = 0;

    // 2. Parse DB result
    if (data && data.length > 0 && data[0].track_id) {
        const parts = data[0].track_id.split('-');
        if (parts.length > 1) {
            maxSeq = parseInt(parts[1]) || 0;
        }
    }

    // 3. Check screen (for unsaved rows)
    const tbody = document.getElementById('materialTableBody');
    if (tbody) {
        Array.from(tbody.rows).forEach(row => {
            const cellText = row.cells[0]?.innerText || '';
            if (cellText.startsWith(`${prefix}-`)) {
                const seq = parseInt(cellText.split('-')[1]) || 0;
                if (seq > maxSeq) maxSeq = seq;
            }
        });
    }

    return `${prefix}-${String(maxSeq + 1).padStart(2, '0')}`;
}

async function addNewRow(addDateValue) {
    if (isProcessing) return; 
    isProcessing = true;

    const addRowBtn = document.getElementById('addRowBtn');
    if (addRowBtn) {
        addRowBtn.disabled = true;
        addRowBtn.textContent = 'Processing...';
    }

    try {
        const tbody = document.getElementById('materialTableBody');
        
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors'; 
        
        // Determine Issued Date
        let issuedDateObj = new Date();
        let issuedDateStr;
        if (addDateValue) {
            const dt = new Date(addDateValue);
            if (!isNaN(dt.getTime())) {
                issuedDateObj = dt;
                issuedDateStr = formatDateToDDMMYYYY(dt);
            }
        }
        if (!issuedDateStr) {
            issuedDateStr = new Date().toLocaleDateString('en-GB');
        }

        // Generate Safe ID
        const trackId = await getNextTrackId(issuedDateObj);

        row.innerHTML = `
            <td class="border-r border-gray-300 px-2 py-1.5 align-middle text-center font-medium bg-gray-50 text-blue-600">${trackId}</td>
            <td class="border-r border-gray-300 px-2 py-1.5 align-middle text-center" contenteditable="true">${issuedDateStr}</td>
            <td class="border-r border-gray-300 px-2 py-1.5 align-middle" contenteditable="true"></td>
            <td class="border-r border-gray-300 px-2 py-1.5 align-middle text-center" contenteditable="true"></td>
            <td class="border-r border-gray-300 px-2 py-1.5 align-middle text-center font-semibold bg-gray-50" contenteditable="false">0.00</td>
            <td class="border-r border-gray-300 px-2 py-1.5 align-middle text-center font-semibold bg-gray-50" contenteditable="false">0.00</td>
            <td class="border-r border-gray-300 px-2 py-1.5 align-middle text-center font-semibold bg-gray-50" contenteditable="false">0.00</td>
            <td class="border-r border-gray-300 px-2 py-1.5 align-middle text-center font-semibold bg-gray-50" contenteditable="false"></td>
            <td class="px-2 py-1.5 align-middle">
                <div class="h-full flex items-center justify-center gap-1">
                    <button class="edit-btn px-2 py-1 bg-blue-500 text-white rounded text-[10px] hover:bg-blue-600 transition-colors leading-none">Edit</button>
                    <button class="return-btn px-2 py-1 bg-orange-500 text-white rounded text-[10px] hover:bg-orange-600 transition-colors leading-none">Return</button>
                </div>
            </td>
        `;

        const cells = row.cells;
        const bagsCell = cells[3];
        const materialCell = cells[2];
        const consumedCell = cells[5];

        consumedCell.innerText = '0.00';
        consumedCell.setAttribute('contenteditable', 'false');

        setupRowEditing(row, materialCell, bagsCell);
        row.dataset.trackId = trackId;

        row.querySelector('.edit-btn').addEventListener('click', (e) => { e.stopPropagation(); showConfirmModal(row); });
        row.querySelector('.return-btn').addEventListener('click', (e) => { e.stopPropagation(); });

        tbody.insertBefore(row, tbody.firstChild);
        updateEmptyState();
        populateFiltersFromTable();

    } catch (err) {
        console.error('Error adding row:', err);
    } finally {
        isProcessing = false;
        if (addRowBtn) {
            addRowBtn.disabled = false;
            addRowBtn.textContent = 'Add Row';
        }
    }
}

function deleteTopRow() {
    // Prevent concurrent operations
    if (isProcessing) {
        alert('Please wait for current operation to complete');
        return;
    }

    isProcessing = true;

    // Update button state
    const deleteRowBtn = document.getElementById('deleteRowBtn');
    if (deleteRowBtn) {
        deleteRowBtn.disabled = true;
        deleteRowBtn.textContent = 'Processing...';
    }

    try {
        const tbody = document.getElementById('materialTableBody');
        if (tbody.firstChild) {
            const rowToDelete = tbody.firstChild;

            // Check if row has a data-id (exists in database)
            const recordId = rowToDelete.dataset.id;
            if (recordId) {
                // Delete from database
                deleteRowFromDatabase(recordId);
            }

            // Remove from DOM
            tbody.removeChild(rowToDelete);
            populateFiltersFromTable();
            applyFilters();

            // Update empty state
            updateEmptyState();
        } else {
            // No rows to delete - silent
        }
    } finally {
        // Reset processing state
        isProcessing = false;
        if (deleteRowBtn) {
            deleteRowBtn.disabled = false;
            deleteRowBtn.textContent = 'Delete Row';
        }
    }
}

// DEPRECATED: Track IDs are now immutable once created in database
// This function no longer regenerates track IDs (was causing data integrity issues)
function updateSerialNumbers() {
    // Track IDs stored in database should NOT be recalculated
    // They are generated once when row is created and must remain stable
}

// Populate filter select options from table data (optimized with cache)
function populateFiltersFromTable() {
    // Debounce with requestAnimationFrame to prevent excessive calls
    if (populateFiltersFromTable.pending) {
        return;
    }
    
    populateFiltersFromTable.pending = true;
    
    requestAnimationFrame(() => {
        populateFiltersFromTable.pending = false;
        
        // Initialize cache
        if (!filterCache.tbody) {
            filterCache.init();
        }
        
        const tbody = filterCache.tbody;
        if (!tbody) return;

        // Build header map: headerText (lowercase trimmed) -> index
        const headerCells = Array.from(document.querySelectorAll('#materialAvailabilityTable thead th'));
        const headerMap = {};
        headerCells.forEach((th, idx) => {
            headerMap[th.textContent.trim().toLowerCase()] = idx;
        });

        // Mapping of filter IDs to header names to populate from
        const mapping = {
            filterProduct: 'material',
            filterShift: 'bags',
            statusFilter: 'status'
            // other filters (operator, supervisor, qc inspector) have no matching columns
        };

        Object.keys(mapping).forEach(selectId => {
            const headerName = mapping[selectId];
            const select = document.getElementById(selectId);
            if (!select) return;

            const colIndex = headerMap[headerName];
            if (typeof colIndex === 'undefined') return;

            // collect unique values from that column
            const values = new Set();
            Array.from(tbody.rows).forEach(row => {
                const cell = row.cells[colIndex];
                if (!cell) return;
                const txt = cell.innerText.trim();
                if (txt !== '') values.add(txt);
            });

            // rebuild options
            const currentVal = select.value || '';
            select.innerHTML = '';
            const optAll = document.createElement('option'); optAll.value = ''; optAll.textContent = 'All';
            select.appendChild(optAll);
            Array.from(values).sort().forEach(v => {
                const opt = document.createElement('option'); opt.value = v; opt.textContent = v;
                select.appendChild(opt);
            });
            // restore previous selection when possible
            if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
                select.value = currentVal;
            }
        });
    });
}

// Simple debounce
function debounce(fn, wait) {
    let t;
    return function(...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

// Move focus to the next row in the same column when Enter is pressed
function moveToNextRow(currentCell) {
    const currentRow = currentCell.closest('tr');
    const tbody = currentRow.closest('tbody');
    const rows = Array.from(tbody.rows);
    const currentRowIndex = rows.indexOf(currentRow);

    // If not the last row, move to next row
    if (currentRowIndex < rows.length - 1) {
        const nextRow = rows[currentRowIndex + 1];
        const currentCellIndex = Array.from(currentRow.cells).indexOf(currentCell);

        // Find the corresponding cell in the next row
        if (nextRow.cells[currentCellIndex]) {
            const nextCell = nextRow.cells[currentCellIndex];

            // Only focus if the cell is editable
            if (nextCell.getAttribute('contenteditable') === 'true') {
                nextCell.focus();

                // Position cursor at the end of the text
                const range = document.createRange();
                const selection = window.getSelection();
                range.selectNodeContents(nextCell);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    }
}

// Setup row for editing: material autocomplete + recalculation listeners
// Consolidates duplicate code from addNewRow and addRowFromDatabase
function setupRowEditing(row, materialCell, bagsCell) {
    setupMaterialAutocomplete(materialCell);

    // Setup recalculation on input (debounced) and blur (immediate)
    const recalcDebounced = debounce(() => recalculateIssuedAndStatus(row), 300);
    bagsCell.addEventListener('input', recalcDebounced);
    bagsCell.addEventListener('blur', () => recalculateIssuedAndStatus(row));

    materialCell.addEventListener('input', recalcDebounced);
    materialCell.addEventListener('blur', () => recalculateIssuedAndStatus(row));

    // Add keyboard navigation: Enter key moves to next row, same column
    const setupKeyboardNavigation = (cell) => {
        cell.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                moveToNextRow(cell);
            }
        });
    };

    // Apply keyboard navigation to editable cells
    const cells = row.cells;
    const dateCell = cells[1]; // Issued date
    setupKeyboardNavigation(dateCell);
    setupKeyboardNavigation(materialCell);
    setupKeyboardNavigation(bagsCell);
}

// Helper: format Date -> DD/MM/YYYY
function formatDateToDDMMYYYY(d) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
}

// Parse DD/MM/YYYY to Date (local)
function parseDDMMYYYY(s) {
    if (!s) return null;
    const parts = s.split('/');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts.map(p => p.trim());
    // Use ISO format to avoid timezone shenanigans
    const iso = `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const dt = new Date(iso);
    return isNaN(dt.getTime()) ? null : dt;
}

// Convert DD/MM/YYYY string to ISO format YYYY-MM-DD
function convertDDMMYYYYToISO(dateStr) {
    const dt = parseDDMMYYYY(dateStr);
    if (!dt) return dateStr; // return as-is if parsing fails
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    return iso;
}

// Generate a UUID v4
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Cache filter element references for performance
const filterCache = {
    tbody: null,
    dateFrom: null,
    dateTo: null,
    search: null,
    status: null,
    init() {
        this.tbody = document.getElementById('materialTableBody');
        this.dateFrom = document.getElementById('dateFrom');
        this.dateTo = document.getElementById('dateTo');
        this.search = document.getElementById('materialSearch');
        this.status = document.getElementById('statusFilter');
    }
};

// Apply current filters to the table rows
function applyFilters() {
    // Initialize cache if needed
    if (!filterCache.tbody) {
        filterCache.init();
    }
    if (!filterCache.tbody) return;

    // Get filter values efficiently from cached elements
    const from = filterCache.dateFrom?.value ? new Date(filterCache.dateFrom.value) : null;
    const toRaw = filterCache.dateTo?.value ? new Date(filterCache.dateTo.value) : null;
    const to = toRaw ? new Date(toRaw.getFullYear(), toRaw.getMonth(), toRaw.getDate(), 23, 59, 59, 999) : null;
    const search = (filterCache.search?.value || '').trim().toLowerCase();
    const status = filterCache.status?.value || '';

    Array.from(filterCache.tbody.rows).forEach(row => {
        let show = true;
        // Issued date is expected in column index 1 as DD/MM/YYYY
        const dateTxt = row.cells[1] ? row.cells[1].innerText.trim() : '';
        const rowDate = parseDDMMYYYY(dateTxt);
        if (from && rowDate) {
            if (rowDate < from) show = false;
        }
        if (to && rowDate) {
            if (rowDate > to) show = false;
        }

        if (search) {
            const material = row.cells[2] ? row.cells[2].innerText.trim().toLowerCase() : '';
            if (!material.includes(search)) show = false;
        }

        if (status) {
            const s = row.cells[7] ? row.cells[7].innerText.trim() : '';
            if (s !== status) show = false;
        }

        row.style.display = show ? '' : 'none';
    });
}

// Fetch standard bag weight for a material
async function getStandardBagWeight(materialName) {
    try {
        if (!materialName) return 25;
        materialName = materialName.trim();
        // Try to find one matching material (case-insensitive). Use limit(1) to avoid single() errors when multiple rows exist.
        const { data, error } = await supabase
            .from('pd_material_catalog')
            .select('std_bag_weight')
            .ilike('material_name', materialName)
            .eq('is_active', true)
            .limit(1);

        if (error) {
            console.warn(`Could not fetch bag weight for ${materialName}, using default 25 KG:`, error);
            return 25;
        }

        if (!data || data.length === 0) {
            // No match found
            return 25;
        }

        return data[0].std_bag_weight || 25;
    } catch (error) {
        console.warn(`Error fetching standard bag weight for ${materialName}:`, error);
        return 25; // Default to 25 KG on error
    }
}

// Calculate issued quantity and update status
async function recalculateIssuedAndStatus(row, stdBagWeightProvided = null) {
    const cells = row.cells;
    const bagsCell = cells[3]; // Bags
    const issuedCell = cells[4]; // Issued (KG)
    const consumedCell = cells[5]; // Consumed (KG)
    const balanceCell = cells[6]; // Balance (KG)
    const statusCell = cells[7]; // Status

    // Get bags value
    const bags = parseFloat(bagsCell.innerText.trim()) || 0;

    // Get material name
    const materialName = cells[2].innerText.trim();
    if (!materialName) {
        issuedCell.innerText = '0.00';
        balanceCell.innerText = '0.00';
        statusCell.innerText = '';
        return;
    }

    // Use provided std bag weight (from suggestion) when available to avoid extra DB roundtrip
    let stdBagWeight = stdBagWeightProvided;
    if (stdBagWeight == null) {
        // Fallback to DB lookup
        stdBagWeight = await getStandardBagWeight(materialName);
    }

    // Calculate issued KG
    const issuedKg = bags * (parseFloat(stdBagWeight) || 25);
    issuedCell.innerText = issuedKg.toFixed(2);

    // Keep existing consumed quantity (don't force to 0)
    const consumedKg = parseFloat(consumedCell.innerText.trim()) || 0;

    // Calculate balance
    const balanceKg = issuedKg - consumedKg;
    balanceCell.innerText = balanceKg.toFixed(2);

    // Auto-set status based on balance
    if (balanceKg > 0) {
        statusCell.innerText = 'Available';
    } else if (balanceKg === 0) {
        statusCell.innerText = 'Used Up';
    } else {
        statusCell.innerText = 'Available'; // Default
    }

    // Persist changes to database (debounced calls should limit frequency)
    try {
        await saveRowToDatabase(row, row.dataset.materialType || currentCategory);
    } catch (err) {
        console.warn('Error saving recalculated values:', err);
    }
}

// Cache current user to avoid repeated auth calls
let cachedUserId = null;

// Get current logged-in user ID (cached)
async function getCurrentUser() {
    if (cachedUserId) return cachedUserId;
    const { data: { user } } = await supabase.auth.getUser();
    cachedUserId = user ? user.id : 'unknown';
    return cachedUserId;
}

// Fetch material suggestions from pd_material_catalog based on current category
async function fetchMaterialSuggestions(searchTerm = '', category = 'RM') {
    try {
        // Include std_bag_weight and id so selection can be applied instantly without an extra DB fetch
        let query = supabase
            .from('pd_material_catalog')
            .select('id, material_name, std_bag_weight')
            .ilike('material_name', `%${searchTerm}%`)
            .eq('is_active', true)
            .order('material_name');

        // TODO: Add category filtering once the column exists in the table
        // For now, fetch all materials regardless of category

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching material suggestions:', error);
            return [];
        }

        // Transform data to match expected format
        return data ? data.map(item => ({ id: item.id, material_name: item.material_name, std_bag_weight: item.std_bag_weight })) : [];
    } catch (error) {
        console.error('Error in fetchMaterialSuggestions:', error);
        return [];
    }
}

// Setup material autocomplete for a cell
function setupMaterialAutocomplete(materialCell) {
    if (!materialCell || materialCell.hasAttribute('data-autocomplete-set')) {
        return; // Already has autocomplete
    }

    // Mark as having autocomplete to avoid duplicates
    materialCell.setAttribute('data-autocomplete-set', 'true');

    let suggestionTimeout;
    materialCell.addEventListener('input', async (e) => {
        clearTimeout(suggestionTimeout);
        const searchTerm = e.target.textContent.trim();

        suggestionTimeout = setTimeout(async () => {
            // If user just selected a suggestion, don't re-open suggestions
            if (materialCell.getAttribute('data-suggestion-just-selected')) {
                materialCell.removeAttribute('data-suggestion-just-selected');
                return;
            }

            if (searchTerm.length >= 1) {
                const suggestions = await fetchMaterialSuggestions(searchTerm, currentCategory);
                showMaterialSuggestions(materialCell, suggestions);
            } else {
                // Hide suggestions if search term is too short
                const existingDropdown = document.querySelector('.material-suggestions');
                if (existingDropdown) {
                    existingDropdown.remove();
                }
            }
        }, 300); // Debounce for 300ms
    });
}

// Create and show material suggestions dropdown
function showMaterialSuggestions(inputElement, suggestions) {
    // Remove existing dropdown
    const parentCell = inputElement.closest('td');
    if (!parentCell) return;

    // Remove any visible dropdown (may have been appended to body)
    const existingDropdown = document.querySelector('.material-suggestions');
    if (existingDropdown) {
        existingDropdown.remove();
    }

    if (suggestions.length === 0) return;

    // Create dropdown with same styling as inline-inspection-form
    const dropdown = document.createElement('div');
    dropdown.className = 'material-suggestions border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto';
    dropdown.style.background = '#eaf4fb'; // Light blue background matching inline form
    dropdown.style.position = 'fixed';
    dropdown.style.zIndex = '9999';
    dropdown.style.minWidth = '200px';

    suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'px-3 py-2 hover:bg-blue-200 cursor-pointer text-sm';
        item.textContent = suggestion.material_name;
        item.addEventListener('click', async () => {
            // Set the selected text and mark as just-selected to prevent re-opening dropdown
            inputElement.textContent = suggestion.material_name;
            inputElement.setAttribute('data-suggestion-just-selected', 'true');

            // Recalculate immediately for this row using suggestion.std_bag_weight (optimistic, avoids extra DB call)
            const row = inputElement.closest('tr');
            try {
                await recalculateIssuedAndStatus(row, suggestion.std_bag_weight);
            } catch (err) {
                console.warn('Error recalculating after selection:', err);
            }

            // Short-lived flag (reduce to 50ms to avoid blocking other interactions)
            setTimeout(() => inputElement.removeAttribute('data-suggestion-just-selected'), 50);
            dropdown.remove();
        });
        dropdown.appendChild(item);
    });

    // Add to DOM first to get dimensions
    document.body.appendChild(dropdown);

    // Cache cell element to avoid multiple closest() calls
    const cellElement = inputElement.closest('td');
    const rect = cellElement.getBoundingClientRect();
    const dropdownHeight = dropdown.offsetHeight;
    const viewportHeight = window.innerHeight;
    
    // Position below by default, but above if not enough space
    let top = rect.bottom + 2;
    if (rect.bottom + dropdownHeight > viewportHeight) {
        top = rect.top - dropdownHeight - 2;
    }

    // Batch style updates to avoid multiple reflows
    Object.assign(dropdown.style, {
        left: rect.left + 'px',
        top: top + 'px',
        width: rect.width + 'px'
    });

    // Close dropdown when clicking outside (with proper cleanup)
    const closeDropdown = (e) => {
        if (!dropdown.contains(e.target) && e.target !== inputElement) {
            if (dropdown.parentNode) dropdown.remove();
            document.removeEventListener('click', closeDropdown);
        }
    };
    setTimeout(() => document.addEventListener('click', closeDropdown), 100);
}

// Load existing records from Supabase and populate table
async function loadExistingRecords() {
    const { data, error } = await supabase
        .from('pd_material_staging')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true }); // Load oldest first so newest ends up on top when inserted

    if (error) {
        console.error('Error loading records:', error);
        return;
    }

    if (data && data.length > 0) {
        data.forEach(record => {
            addRowFromDatabase(record);
        });
    }
}

// Add row to table from database record
function addRowFromDatabase(record) {
    const tbody = document.getElementById('materialTableBody');
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50 transition-colors';
    row.dataset.trackId = record.track_id;
    row.dataset.id = record.id;
    row.dataset.materialType = record.material_type;

    row.innerHTML = `
        <td class="border-r border-gray-300 px-2 py-1.5 align-middle text-center font-medium bg-gray-50">${record.track_id}</td>
        <td class="border-r border-gray-300 px-2 py-1.5 align-middle text-center" contenteditable="true">${new Date(record.issued_date).toLocaleDateString('en-GB')}</td>
        <td class="border-r border-gray-300 px-2 py-1.5 align-middle" contenteditable="true">${record.material_name || ''}</td>
        <td class="border-r border-gray-300 px-2 py-1.5 align-middle text-center" contenteditable="true">${record.bags ? parseInt(record.bags) : ''}</td>
        <td class="border-r border-gray-300 px-2 py-1.5 align-middle text-center font-semibold bg-gray-50" contenteditable="false">${(parseFloat(record.issued_qty) || 0).toFixed(2)}</td>
        <td class="border-r border-gray-300 px-2 py-1.5 align-middle text-center font-semibold bg-gray-50" contenteditable="false">${(parseFloat(record.consumed_qty) || 0).toFixed(2)}</td>
        <td class="border-r border-gray-300 px-2 py-1.5 align-middle text-center font-semibold bg-gray-50" contenteditable="false">${(parseFloat(record.balance_qty) || 0).toFixed(2)}</td>
        <td class="border-r border-gray-300 px-2 py-1.5 align-middle text-center font-semibold bg-gray-50" contenteditable="false">${record.status || ''}</td>
        <td class="px-2 py-1.5 align-middle">
            <div class="h-full flex items-center justify-center gap-1">
                <button class="edit-btn px-2 py-1 bg-blue-500 text-white rounded text-[10px] hover:bg-blue-600 transition-colors leading-none">
                    Edit
                </button>
                <button class="return-btn px-2 py-1 bg-orange-500 text-white rounded text-[10px] hover:bg-orange-600 transition-colors leading-none">
                    Return
                </button>
            </div>
        </td>
    `;

    // Edit button functionality - show warning first (UI modal)
    row.querySelector('.edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        showConfirmModal(row);
    });

    // Return button functionality (no popup)
    row.querySelector('.return-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        // Functionality logged silently
    });

    // Setup row for editing: add autocomplete and listeners
    const materialCell = row.cells[2];
    const bagsCell = row.cells[3];
    const consumedCell = row.cells[5];

    // Consumed quantity is read-only and shows actual database value
    consumedCell.setAttribute('contenteditable', 'false');

    // Add material autocomplete and recalculation listeners
    setupRowEditing(row, materialCell, bagsCell);

    tbody.insertBefore(row, tbody.firstChild);
    // Note: Track ID already loaded from database - no regeneration needed

    // Update empty state after adding database row
    updateEmptyState();
}

// Save row data to Supabase (Safe Version - Respects Consumption)
async function saveRowToDatabase(row, material_type) {
    const cells = row.cells;
    const track_id = cells[0].innerText.trim();
    const issued_date_str = cells[1].innerText.trim(); // DD/MM/YYYY
    const material_name = cells[2].innerText.trim();
    const bags = parseFloat(cells[3].innerText.trim()) || 0;

    // We calculate Issued Qty (The "Tank Capacity")
    const issued_qty = (parseFloat(cells[4].innerText.trim()) || 0).toFixed(2);

    // DANGER: We DO NOT read 'consumed_qty' or 'balance' from the screen for updates.
    // The screen might show old data. We must calculate fresh balance based on DB consumption.

    const created_by = await getCurrentUser();
    const issued_date = convertDDMMYYYYToISO(issued_date_str);

    try {
        // 1. Get Material ID (Catalog Lookup)
        let material_id = null;
        if (material_name) {
            try {
                const { data: catalogData } = await supabase
                    .from('pd_material_catalog')
                    .select('id')
                    .eq('material_name', material_name.trim())
                    .limit(1)
                    .maybeSingle();

                material_id = catalogData ? catalogData.id : generateUUID();
            } catch (err) {
                material_id = generateUUID();
            }
        } else {
            throw new Error('Cannot save without material name');
        }

        const existingId = row.dataset.id;

        if (existingId) {
            // --- UPDATE EXISTING ROW (The Safe Logic) ---

            // Step A: Ask DB for the REAL consumed total (Absolute Truth)
            const { data: currentDbRecord, error: fetchError } = await supabase
                .from('pd_material_staging')
                .select('consumed_qty')
                .eq('id', existingId)
                .single();

            if (fetchError) {
                throw new Error('Error fetching real consumption: ' + fetchError.message);
            }

            const realConsumed = currentDbRecord ? parseFloat(currentDbRecord.consumed_qty) : 0;

            // Step B: Calculate New Balance (New Issued - Real Consumed)
            const newBalance = parseFloat(issued_qty) - realConsumed;

            // Step C: Determine Status
            const newStatus = newBalance <= 0 ? 'Used Up' : 'Available';

            // Step D: Update ONLY Issued and Balance. NEVER touch Consumed.
            const updatePayload = {
                issued_date,
                material_name,
                material_id,
                bags,
                issued_qty, // We update this (Manager changed bags)
                balance_qty: newBalance, // We update this (Result of calculation)
                status: newStatus
                // consumed_qty is EXCLUDED. We rely on the Production Log for that.
            };

            const { error } = await supabase
                .from('pd_material_staging')
                .update(updatePayload)
                .eq('id', existingId);

            if (error) throw new Error('Error updating record: ' + error.message);

            // Optional: Update UI to match the fresh math immediately
            cells[5].innerText = realConsumed.toFixed(2);
            cells[6].innerText = newBalance.toFixed(2);
            cells[7].innerText = newStatus;

        } else {
            // --- INSERT NEW ROW ---
            // For a new row, consumed is always 0.
            const payload = {
                material_id,
                track_id,
                issued_date,
                material_name,
                bags,
                issued_qty,
                consumed_qty: 0, // Starts at 0
                balance_qty: issued_qty, // Balance = Issued
                status: 'Available',
                material_type,
                created_by,
                is_active: true
            };

            const { data, error } = await supabase
                .from('pd_material_staging')
                .insert([payload])
                .select();

            if (error) throw new Error('Error inserting record: ' + error.message);

            if (data && data.length > 0) {
                row.dataset.id = data[0].id;
            }
        }

    } catch (error) {
        console.error('Error saving row:', error);
        throw error; // Re-throw to allow caller to handle
    }
}

// Delete row from Supabase
async function deleteRowFromDatabase(recordId) {
    const { error } = await supabase
        .from('pd_material_staging')
        .delete()
        .eq('id', recordId);

    if (error) {
        console.error('Error deleting record:', error);
        // Removed alert popup - error is logged to console
    }
}

// Check if table is empty and show/hide empty state message
function updateEmptyState() {
    const tbody = document.getElementById('materialTableBody');
    const emptyState = document.getElementById('emptyStateMessage');

    if (!tbody || !emptyState) return;

    if (tbody.children.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
    }
}

// Edit Modal Functions
let currentEditingRow = null;
// Pending row for UI confirmation dialog
let pendingConfirmRow = null;

function showConfirmModal(row) {
    pendingConfirmRow = row;
    const textEl = document.getElementById('confirmModalText');
    if (textEl) textEl.innerText = 'Not Recommended. Proceed to edit?';
    const modal = document.getElementById('confirmModal');
    if (modal) modal.classList.remove('hidden');

    // Wire buttons (use assignments to avoid duplicate handlers)
    const cancelBtn = document.getElementById('confirmCancelBtn');
    const okBtn = document.getElementById('confirmOkBtn');
    if (cancelBtn) cancelBtn.onclick = () => { hideConfirmModal(); };
    if (okBtn) okBtn.onclick = () => { if (pendingConfirmRow) openEditModal(pendingConfirmRow); hideConfirmModal(); };
}

function hideConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.classList.add('hidden');
    pendingConfirmRow = null;
}

function openEditModal(row) {
    currentEditingRow = row;
    const modal = document.getElementById('editModal');
    
    // Get current values from the row
    const cells = row.cells;
    const issuedDateStr = cells[1].innerText.trim(); // DD/MM/YYYY format
    const materialName = cells[2].innerText.trim();
    const bags = cells[3].innerText.trim();
    const issuedQty = cells[4].innerText.trim();
    const consumedQty = cells[5].innerText.trim();
    const balanceQty = cells[6].innerText.trim();
    
    // Convert DD/MM/YYYY to YYYY-MM-DD for date input
    const issuedDate = parseDDMMYYYY(issuedDateStr);
    const dateValue = issuedDate ? issuedDate.toISOString().split('T')[0] : '';
    
    // Populate modal fields
    document.getElementById('editIssuedDate').value = dateValue;
    document.getElementById('editMaterial').value = materialName;
    document.getElementById('editBags').value = bags;
    document.getElementById('editIssuedQty').value = issuedQty;
    document.getElementById('editConsumedQty').value = consumedQty;
    document.getElementById('editBalanceQty').value = balanceQty;
    
    // Show modal
    modal.classList.remove('hidden');
    
    // Add event listeners
    document.getElementById('cancelEditBtn').onclick = closeEditModal;
    document.getElementById('saveEditBtn').onclick = saveEditModal;
    
    // Add material autocomplete to the modal input
    setupMaterialAutocomplete(document.getElementById('editMaterial'));
    
    // Add recalculation when bags, material, or consumed changes
    document.getElementById('editBags').oninput = () => recalculateModalValues();
    document.getElementById('editMaterial').oninput = () => recalculateModalValues();
    document.getElementById('editConsumedQty').oninput = () => recalculateBalance();
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    modal.classList.add('hidden');
    currentEditingRow = null;
}

async function recalculateModalValues() {
    const materialName = document.getElementById('editMaterial').value.trim();
    const bags = parseFloat(document.getElementById('editBags').value) || 0;
    
    if (!materialName) {
        document.getElementById('editIssuedQty').value = '0.00';
        document.getElementById('editBalanceQty').value = '0.00';
        return;
    }
    
    // Get standard bag weight
    const stdBagWeight = await getStandardBagWeight(materialName);
    
    // Calculate issued quantity
    const issuedQty = bags * (parseFloat(stdBagWeight) || 25);
    document.getElementById('editIssuedQty').value = issuedQty.toFixed(2);
    
    // Keep consumed quantity as is
    const consumedQty = parseFloat(document.getElementById('editConsumedQty').value) || 0;
    
    // Calculate balance
    const balanceQty = issuedQty - consumedQty;
    document.getElementById('editBalanceQty').value = balanceQty.toFixed(2);
}

// Recalculate balance when consumed changes
function recalculateBalance() {
    const issuedQty = parseFloat(document.getElementById('editIssuedQty').value) || 0;
    const consumedQty = parseFloat(document.getElementById('editConsumedQty').value) || 0;
    const balanceQty = issuedQty - consumedQty;
    document.getElementById('editBalanceQty').value = balanceQty.toFixed(2);
}

async function saveEditModal() {
    if (!currentEditingRow) return;
    
    try {
        // Get values from modal
        const issuedDateValue = document.getElementById('editIssuedDate').value;
        const materialName = document.getElementById('editMaterial').value.trim();
        const bags = parseFloat(document.getElementById('editBags').value) || 0;
        const issuedQty = parseFloat(document.getElementById('editIssuedQty').value) || 0;
        const consumedQty = parseFloat(document.getElementById('editConsumedQty').value) || 0;
        const balanceQty = parseFloat(document.getElementById('editBalanceQty').value) || 0;
        
        // Convert date back to DD/MM/YYYY format
        const issuedDate = new Date(issuedDateValue);
        const dateStr = issuedDate.toLocaleDateString('en-GB');
        
        // Update the row cells
        const cells = currentEditingRow.cells;
        cells[1].innerText = dateStr; // Issued date
        cells[2].innerText = materialName; // Material
        cells[3].innerText = bags.toString(); // Bags
        cells[4].innerText = issuedQty.toFixed(2); // Issued (KG)
        cells[5].innerText = consumedQty.toFixed(2); // Consumed (KG)
        cells[6].innerText = balanceQty.toFixed(2); // Balance (KG)
        
        // Auto-set status based on balance
        if (balanceQty > 0) {
            cells[7].innerText = 'Available';
        } else if (balanceQty === 0) {
            cells[7].innerText = 'Used Up';
        } else {
            cells[7].innerText = 'Available';
        }
        
        // Save to database
        await saveRowToDatabase(currentEditingRow, currentEditingRow.dataset.materialType || currentCategory);
        
        // Close modal
        closeEditModal();
        
        // Refresh filters
        populateFiltersFromTable();
        applyFilters();
        
    } catch (error) {
        console.error('Error saving edit:', error);
        alert('Error saving changes. Please try again.');
    }
}

// Close modal when clicking outside
document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') {
        closeEditModal();
    }
});
