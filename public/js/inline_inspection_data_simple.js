import { supabase } from '../supabase-config.js';

// Move this to the very top of the file
const tablesContainer = document.getElementById('tablesContainer');

// Global variables that need to be declared early
let addNewTableBtn = null;
let ipqcUpdateTimeout = null;
let qcInspectorsCache = [];

// ===== IST TIMESTAMP UTILITY =====
function getISTTimestamp() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const istTime = new Date(now.getTime() + istOffset);
    return istTime.toISOString();
}

// ===== CLOCK FUNCTIONALITY =====
let clockInterval = null;

// ===== SHIFT DISPLAY FUNCTIONALITY =====
function setShiftDisplay() {
    try {
        const shiftElement = document.getElementById('shiftDisplay');
        if (!shiftElement) return;
        
        // Get user from session
        supabase.auth.getUser().then(result => {
            if (result.data.user && result.data.user.email) {
                const username = result.data.user.email.split('@')[0].toLowerCase();
                let shiftLabel = '';
                
                if (username.includes('shift-a')) {
                    shiftLabel = 'Shift A';
                } else if (username.includes('shift-b')) {
                    shiftLabel = 'Shift B';
                } else if (username.includes('shift-c')) {
                    shiftLabel = 'Shift C';
                } else {
                    // No shift in email, don't show anything
                    shiftLabel = '';
                }
                
                shiftElement.textContent = shiftLabel;
            }
        }).catch(error => {
            console.error('Error getting user for shift display:', error);
            // Don't show shift if error
            shiftElement.textContent = '';
        });
    } catch (error) {
        console.error('Error setting shift display:', error);
    }
}

function updateClock() {
    try {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        const timeString = `Time: ${hours}:${minutes}:${seconds}`;
        
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            timeElement.textContent = timeString;
        }
    } catch (error) {
        console.error('Error updating clock:', error);
    }
}

function startClock() {
    try {
        // Clear existing interval if any
        if (clockInterval) {
            clearInterval(clockInterval);
        }
        
        // Update immediately
        updateClock();
        
        // Update every second
        clockInterval = setInterval(updateClock, 1000);
        intervals.add(clockInterval);
        
        console.log('✅ Clock started successfully');
    } catch (error) {
        console.error('❌ Error starting clock:', error);
    }
}

function stopClock() {
    try {
        if (clockInterval) {
            clearInterval(clockInterval);
            clockInterval = null;
        }
        console.log('✅ Clock stopped successfully');
    } catch (error) {
        console.error('❌ Error stopping clock:', error);
    }
}

// ===== MEMORY LEAK PREVENTION =====
// Track all event listeners for cleanup
const eventListeners = new Map();
const intervals = new Set();
const timeouts = new Set();

// Cleanup function to prevent memory leaks
function cleanupResources() {
    try {
        // Stop the clock
        stopClock();
        
        // Clear all intervals
        intervals.forEach(interval => {
            try {
                clearInterval(interval);
            } catch (e) {
                console.warn('Failed to clear interval:', e);
            }
        });
        intervals.clear();
        
        // Clear all timeouts
        timeouts.forEach(timeout => {
            try {
                clearTimeout(timeout);
            } catch (e) {
                console.warn('Failed to clear timeout:', e);
            }
        });
        timeouts.clear();
        
        // Remove all tracked event listeners
        eventListeners.forEach((listener, element) => {
            try {
                if (element && element.removeEventListener) {
                    element.removeEventListener('input', listener);
                    element.removeEventListener('change', listener);
                    element.removeEventListener('keydown', listener);
                    element.removeEventListener('blur', listener);
                }
            } catch (e) {
                console.warn('Failed to remove event listener:', e);
            }
        });
        eventListeners.clear();
        

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
}

// Enhanced session management
let sessionCheckInterval = null;
let lastSessionCheck = Date.now();

// Session validation function
async function validateSession() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
    
            window.location.replace('auth.html');
            return false;
        }
        lastSessionCheck = Date.now();
        return true;
    } catch (error) {
        console.error('Session validation error:', error);
        return false;
    }
}

// Periodic session check
function startSessionMonitoring() {
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
    }
    
    sessionCheckInterval = setInterval(async () => {
        const isValid = await validateSession();
        if (!isValid) {
            cleanupResources();
        }
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    intervals.add(sessionCheckInterval);
}

// Enhanced debounced save with memory management
let saveTimeout = null;

function debouncedSave(table) {
    if (viewMode) {
        return;
    }
    
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        timeouts.delete(saveTimeout);
    }
    
    saveTimeout = setTimeout(() => {
        if (!table) table = document.querySelector('#tablesContainer table');
        if (table) saveLotToSupabase(table);
        saveTimeout = null;
    }, 1000);
    
    timeouts.add(saveTimeout);
}

const lotTheadHTML = `
<thead>
<tr>
    <th colspan="2" class="border border-gray-300 px-2 py-1">Time</th>
    <th rowspan="2" class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">Lot No.</th>
    <th rowspan="2" class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">Roll Position</th>
    <th rowspan="2" class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">Arm</th>
    <th rowspan="2" class="border border-gray-300 px-2 py-1 vertical-header" style="width:50px; min-width:50px; max-width:50px;">
        Roll Weight
        <span style="display: inline-block; transform: rotate(-180deg); writing-mode: initial;">
            <input type="checkbox" id="rollWeightLock" style="vertical-align: middle; margin-left: 4px; margin-bottom: 40px;">
            <span style="font-size: 16px; vertical-align: top; margin-left: 2px;">🔒</span>
        </span>
    </th>
    <th rowspan="2" class="border border-gray-300 px-2 py-1 vertical-header" style="width:40px; min-width:40px; max-width:40px;">Roll Width (mm)</th>
    <th rowspan="2" class="border border-gray-300 px-2 py-1 vertical-header" style="width:40px; min-width:40px; max-width:40px;">Film Weight (GSM)</th>
    <th rowspan="2" class="border border-gray-300 px-2 py-1 vertical-header" style="width:40px; min-width:40px; max-width:40px;">Thickness</th>
    <th rowspan="2" class="border border-gray-300 px-2 py-1 vertical-header" style="width:40px; min-width:40px; max-width:40px;">
        Roll θ
        <span style="display: inline-block; transform: rotate(-180deg); writing-mode: initial;">
            <input type="checkbox" id="rollThetaLock" style="vertical-align: middle; margin-left: 4px; margin-bottom: 80px;">
            <span style="font-size: 16px; vertical-align: top; margin-left: 2px;">🔒</span>
        </span>
    </th>
    <th colspan="2" class="border border-gray-300 px-2 py-1">Paper Core θ</th>
    <th colspan="7" class="border border-gray-300 px-2 py-1">Film Appearance</th>
    <th colspan="5" class="border border-gray-300 px-2 py-1">Printing</th>
    <th colspan="4" class="border border-gray-300 px-2 py-1">Roll Appearance</th>
    <th rowspan="2" class="border border-gray-300 px-2 py-1 vertical-header"" style="width:33px; min-width:33px; max-width:33px;">Others</th>
    <th rowspan="2" class="border border-gray-300 px-2 py-1" style="width:55px; min-width:55px; max-width:55px;">Accept / Reject</th>
    <th rowspan="2" class="border border-gray-300 px-2 py-1" style="width:100px; min-width:100px; max-width:100px;">Defect Name</th>
    <th rowspan="2" class="border border-gray-300 px-2 py-1" style="width:100px; min-width:100px; max-width:100px;">PI Changed</th>
    <th rowspan="2" class="border border-gray-300 px-2 py-1" style="width:100px; min-width:100px; max-width:100px;">Inspected By</th>
</tr>
<tr>
    <th class="border border-gray-300 px-2 py-1" style="width:30px; min-width:30px; max-width:30px;">Hr.</th>
    <th class="border border-gray-300 px-2 py-1" style="width:30px; min-width:30px; max-width:30px;">Min.</th>
    <th class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">Paper Core θ (ID)</th>
    <th class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">Paper Core θ (OD)</th>
    <th class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">Lines/Strips</th>
    <th class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">Glossy</th>
    <th class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">Film Color</th>
    <th class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">Pin Hole</th>
    <th class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">Patch Mark</th>
    <th class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">Odour</th>
    <th class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">CT</th>
    <th class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">Print Color</th>
    <th class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">Mis Print</th>
    <th class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">Dirty Print</th>
    <th class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">Tape Test</th>
    <th class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">Centralization</th>
    <th class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">Wrinkles</th>
    <th class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">PRS</th>
    <th class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">Roll Curve</th>
    <th class="border border-gray-300 px-2 py-1 vertical-header" style="width:30px; min-width:30px; max-width:30px;">Core Misalignment</th>
</tr>
</thead>
`;

document.addEventListener('DOMContentLoaded', async function() {
    // Start session monitoring
    startSessionMonitoring();
    
    // Start the clock
    startClock();
    
    // Set shift display based on user session
    setShiftDisplay();
    
    // Get URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const viewMode = urlParams.get('mode') === 'view';
    
    // Assign all DOM elements at the very top
    const rowCountDisplay = document.getElementById('rowCountDisplay');
    const addRowsBtn = document.getElementById('addNewRowsBtn');
    const numRowsInput = document.getElementById('numRowsInput');
    if (!rowCountDisplay || !addRowsBtn || !numRowsInput) {
        alert('Error: One or more required DOM elements are missing.');
        return;
    }
    if (addRowsBtn) {
        addRowsBtn.textContent = 'Add Rows';
        // Hide Add Rows button in view mode
        if (viewMode) {
            addRowsBtn.style.display = 'none';
        }
    }
    // Move all config/constants here
    const totalColumns = 33;
    const mergedIndices = [0, 1, 2, 4, 31]; // Hour, Minutes, Lot No., Arm, Remarks
    const dropdownIndex = 29; // Accept / Reject column
    
    // Global variable to track if current form is non-printed
    let isNonPrintedForm = false;
    const dropdownOptions = ["", "Accept", "Reject", "KIV", "Rework"];
    const fixedWidthIndices = {
        10: '40px', 11: '40px', 12: '33px', 13: '33px', 14: '33px', 15: '33px',
        16: '33px', 17: '33px', 18: '33px', 19: '33px', 20: '33px', 21: '33px',
        22: '33px', 23: '33px', 24: '33px', 25: '33px', 26: '33px', 27: '33px',
        28: '33px', 30: '33px', 31: '33px', 32: '80px'
    };
    // All code that uses these variables goes below this line
    
    // ===== LOAD FORM DATA IF FORM ID PROVIDED =====
    const traceabilityCode = urlParams.get('traceability_code');
    const lotLetter = urlParams.get('lot_letter');
    // If in view mode, disable all editing functionality
    if (viewMode) {
        // Add view-only indicator immediately
        const viewOnlyIndicator = document.createElement('div');
        viewOnlyIndicator.id = 'viewOnlyIndicator';
        viewOnlyIndicator.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 text-center';
        viewOnlyIndicator.innerHTML = `
            <div class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
                <span class="font-semibold">VIEW ONLY MODE</span>
            </div>
            <div class="text-sm mt-1">This form is in read-only mode. No changes can be made.</div>
        `;
        document.body.appendChild(viewOnlyIndicator);
        
        // In view mode, ensure summary tables are rendered after data loads
        setTimeout(() => {
            renderDefectsSummaryTable();
            renderIPQCDefectsTable();
            renderStatisticsTable();
            renderProductionNoSummaryTable();
        }, 3000);
    }
    
    if (traceabilityCode) {
        try {
            // Load all lots for this traceability_code, order by created_at ascending to get the oldest first
            const { data: lots, error } = await supabase
                .from('inline_inspection_form_master_2')
                .select('*')
                .eq('traceability_code', traceabilityCode)
                .eq('lot_letter', lotLetter)
                .order('created_at', { ascending: true });
            
            if (error) {
                console.error('Error loading form:', error);
                alert('Error loading form data: ' + error.message);
                return;
            }
            
            if (lots && lots.length > 0) {
                // Use the oldest lot for header section
                const formData = lots[0];
                
                document.getElementById('customer').textContent = formData.customer || '[Customer]';
                // Show only production_no in the main Production No field
                document.getElementById('production_no').textContent = formData.production_no || '[Production No.]';
                // Set production_no_2 field separately
                document.getElementById('production_no_2').value = formData.production_no_2 || '';
                document.getElementById('prod_code').textContent = formData.prod_code || '[Prod. Code]';
                
                // Add auto-save functionality for production_no_2 field
                const productionNo2Field = document.getElementById('production_no_2');
                if (productionNo2Field && !viewMode) {
                    let saveTimeout;
                    
                    productionNo2Field.addEventListener('input', function() {
                        clearTimeout(saveTimeout);
                        saveTimeout = setTimeout(async () => {
                            try {
                                const newValue = this.value.trim();
                                console.log('Auto-saving production_no_2:', newValue);
                                
                                const { error } = await supabase
                                    .from('inline_inspection_form_master_2')
                                    .update({ production_no_2: newValue })
                                    .eq('traceability_code', traceabilityCode)
                                    .eq('lot_letter', lotLetter);
                                
                                if (error) {
                                    console.error('Error auto-saving production_no_2:', error);
                                } else {
                                    console.log('✅ production_no_2 auto-saved successfully');
                                }
                            } catch (error) {
                                console.error('Error in production_no_2 auto-save:', error);
                            }
                        }, 1000); // 1 second delay
                    });
                }
                document.getElementById('spec').textContent = formData.spec || '[Spec]';
                document.getElementById('printed').checked = formData.printed || false;
                document.getElementById('non_printed').checked = formData.non_printed || false;
                document.getElementById('ct').checked = formData.ct || false;
                
                // Store the form type globally for use in table creation
                isNonPrintedForm = formData.non_printed || false;
                console.log('Form type detected - Non-printed:', isNonPrintedForm);
                document.getElementById('year').textContent = formData.year || '[Year]';
                document.getElementById('month').textContent = formData.month || '[Month]';
                document.getElementById('date').textContent = formData.date || '[Date]';
                document.getElementById('mc_no').textContent = formData.mc_no || '[M/C No.]';
                document.getElementById('shift').textContent = formData.shift || '[Shift]';
                // Data loading is now handled by loadAllLots() function
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error loading form: ' + error.message);
        }
    }
    
    // Initialize tablesContainer early
    if (!tablesContainer.id) {
        tablesContainer.id = 'tablesContainer';
    }

    // Load existing inspection data for this form
    if (traceabilityCode) {
        window.isLoadingData = true;
        await loadAllLots();
        window.isLoadingData = false;
        
        // If in view mode, disable all editing after data is loaded
        if (viewMode) {
            setTimeout(() => {
                // Disable all contenteditable cells
                const editableCells = document.querySelectorAll('td[contenteditable="true"]');
                editableCells.forEach(cell => {
                    cell.contentEditable = false;
                });
                
                // Disable all select dropdowns
                const selectDropdowns = document.querySelectorAll('select');
                selectDropdowns.forEach(select => {
                    select.disabled = true;
                });
                
                // Disable all input fields
                const inputFields = document.querySelectorAll('input');
                inputFields.forEach(input => {
                    input.disabled = true;
                });
                
                // Disable all buttons except back button
                const buttons = document.querySelectorAll('button');
                buttons.forEach(button => {
                    if (!button.classList.contains('header-back-button')) {
                        button.disabled = true;
                    }
                });
                
                console.log('View mode: Disabled', editableCells.length, 'editable cells');
                console.log('View mode: Disabled', selectDropdowns.length, 'select dropdowns');
                console.log('View mode: Disabled', inputFields.length, 'input fields');
                console.log('View mode: Disabled', buttons.length, 'buttons');
                
                // Apply color coding for X/O values in view mode
                console.log('View mode: Applying color coding for X/O values');
                
                // Apply Accept/Reject color coding to tables
                applyColorCodingToTable();
                
                // Apply X/O color coding to all cells
                const allCells = document.querySelectorAll('td');
                allCells.forEach(cell => {
                    applyXOColorCoding(cell);
                });
                
                // Ensure Accept/Reject and Roll Position cells get proper color coding in view mode
                const tables = document.querySelectorAll('table');
                tables.forEach(table => {
                    const tbody = table.querySelector('tbody');
                    if (!tbody) return;
                    
                    const rows = tbody.rows;
                    for (let r = 0; r < rows.length; r++) {
                        const row = rows[r];
                        const acceptRejectCell = row.querySelector('td[data-field="accept_reject"]');
                        const rollPosCell = row.querySelector('td[data-field="roll_position"]');
                        
                        if (acceptRejectCell) {
                            const select = acceptRejectCell.querySelector('select');
                            if (select) {
                                const value = select.value;
                                let bgColor = '';
                                let fgColor = '#fff';
                                
                                if (value === 'Accept') {
                                    bgColor = '#218838'; // dark green
                                } else if (value === 'Reject') {
                                    bgColor = '#c82333'; // dark red
                                } else if (value === 'KIV') {
                                    bgColor = '#0056b3'; // dark blue
                                } else if (value === 'Rework') {
                                    bgColor = '#e6b800'; // dark yellow
                                }
                                
                                // Apply colors to Accept/Reject cell and dropdown (same as main table)
                                if (bgColor) {
                                    acceptRejectCell.style.backgroundColor = bgColor;
                                    acceptRejectCell.style.color = fgColor;
                                    select.style.backgroundColor = bgColor;
                                    select.style.color = fgColor;
                                    
                                    // Also apply to Roll Position cell
                                    if (rollPosCell) {
                                        rollPosCell.style.backgroundColor = bgColor;
                                        rollPosCell.style.color = fgColor;
                                    }
                                } else {
                                    // Reset colors if no status
                                    acceptRejectCell.style.backgroundColor = '';
                                    acceptRejectCell.style.color = '';
                                    select.style.backgroundColor = '';
                                    select.style.color = '';
                                    if (rollPosCell) {
                                        rollPosCell.style.backgroundColor = '';
                                        rollPosCell.style.color = '';
                                    }
                                }
                            }
                        }
                    }
                });
                
                console.log('View mode: Color coding applied');
            }, 500); // Small delay to ensure all elements are rendered
        }
    }

    function updateRowCount(tbody) {
        if (!tbody || !tbody.rows) return;
        const dataRows = Array.from(tbody.rows);
        if (typeof rowCountDisplay !== 'undefined') {
        rowCountDisplay.textContent = `Rows: ${dataRows.length}`;
        }
    }

    // Removed capitalizeWords function to prevent typing issues

    function createCell(contentEditable = true, rowspan = 1, isDropdown = false, colIndex = null, isFirstRow = false) {
        const td = document.createElement('td');
        td.className = 'border border-gray-300 px-1 py-1';
        // Add word wrap and text center
        td.style.whiteSpace = 'pre-wrap';
        td.style.wordBreak = 'break-word';
        td.style.textAlign = 'center';
        
        // In view mode, always make cells non-editable
        if (viewMode) {
            contentEditable = false;
        }
        
        // Add data-field attribute for simple mapping
        if (colIndex !== null) {
            const fieldMap = {
                0: 'hour', 1: 'minute', 2: 'lot_no', 3: 'roll_position', 4: 'arm',
                5: 'roll_weight', 6: 'roll_width_mm', 7: 'film_weight_gsm', 8: 'thickness',
                9: 'roll_dia', 10: 'paper_core_dia_id', 11: 'paper_core_dia_od',
                12: 'lines_strips', 13: 'glossy', 14: 'film_color', 15: 'pin_hole',
                16: 'patch_mark', 17: 'odour', 18: 'ct_appearance', 19: 'print_color',
                20: 'mis_print', 21: 'dirty_print', 22: 'tape_test', 23: 'centralization',
                24: 'wrinkles', 25: 'prs', 26: 'roll_curve', 27: 'core_misalignment',
                28: 'others', 29: 'accept_reject', 30: 'defect_name', 31: 'remarks', 32: 'inspected_by'
            };
            td.dataset.field = fieldMap[colIndex];
            
            // Pre-fill NA values for non-printed forms in specific columns
            const naColumns = [18, 19, 20, 21, 22, 23]; // ct_appearance, print_color, mis_print, dirty_print, tape_test, centralization
            if (isNonPrintedForm && naColumns.includes(colIndex)) {
                td.textContent = 'NA';
                console.log(`Pre-filled NA in column ${colIndex} (${fieldMap[colIndex]})`);
            }
        }
        
        // Special handling for "Inspected By" column (32) - only first row should be editable
        if (colIndex === 32 && !isFirstRow) {
            contentEditable = false;
            // No gray styling - keep it looking normal but uneditable
        }
        
        if (colIndex !== null && fixedWidthIndices[colIndex]) {
            td.style.width = fixedWidthIndices[colIndex];
            td.style.minWidth = fixedWidthIndices[colIndex];
            td.style.maxWidth = fixedWidthIndices[colIndex];
        }
        
        if (isDropdown) {
            const select = document.createElement('select');
            select.className = 'border border-gray-200 rounded text-xs';
            select.style.width = '100%';
            select.style.minWidth = '0';
            select.style.padding = '0';
            select.style.margin = '0';
            
            // In view mode, disable the dropdown
            if (viewMode) {
                select.disabled = true;
            }
            dropdownOptions.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt || 'Select';
                select.appendChild(option);
            });
            
            select.addEventListener('change', function(e) {
                if (viewMode) {
                    console.log('Select change blocked - in view mode');
                    e.preventDefault();
                    return;
                }
                
                const table = select.closest('table');
                const formId = table?.dataset?.formId;
                const allTables = Array.from(document.querySelectorAll('#tablesContainer table'));
                const tableIndex = allTables.indexOf(table);
                console.log('[DEBUG] Cell change event in table:', { formId, tableIndex });
                
                // Handle Accept/Reject → Disable Row functionality
                const selectedValue = select.value;
                const row = select.closest('tr');
                
                // Check if CT checkbox is checked for this table
                const ctCheckbox = table ? table.querySelector('input[name="ct"]') : null;
                const isCTChecked = ctCheckbox ? ctCheckbox.checked : false;
                
                // Handle manual Accept/Reject change → Clear X/O values if changing from Reject
                if (selectedValue !== 'Reject' && selectedValue !== 'Rework') {
                    // If changing from Reject to Accept or empty, clear all X values
                    clearXValuesInRow(row);
                }
                
                // Handle manual Accept/Reject change → Clear all X/O values if changing to default
                if (selectedValue === '') {
                    // If changing to default/empty, clear all X and O values
                    clearAllXOValuesInRow(row);
                }
                
                if (selectedValue === 'Accept') {
                    // For Accept: Disable X/O cells and Defect Name (client can't edit when Accept)
                    const cells = row ? row.querySelectorAll('td[data-field]') : [];
                    cells.forEach(cell => {
                        const fieldName = cell.dataset.field;
                        // Always keep Glossy, CT, Film Weight GSM, and Paper Core fields enabled at all times
                        // Disable other X/O fields and Defect Name (not Accept/Reject, Remarks, Inspected By, Glossy, CT, GSM, Paper Core)
                        if (fieldName && !['accept_reject', 'remarks', 'inspected_by', 'glossy', 'ct_appearance', 'film_weight_gsm', 'paper_core_dia_id', 'paper_core_dia_od'].includes(fieldName)) {
                            cell.contentEditable = false;
                        }
                    });
                } else if (selectedValue === 'Reject' || selectedValue === 'Rework') {
                    // For Reject/Rework: Enable Defect Name and Remarks (client needs to enter defect info)
                    const cells = row ? row.querySelectorAll('td[data-field]') : [];
                    cells.forEach(cell => {
                        const fieldName = cell.dataset.field;
                        // Enable Defect Name and Remarks, disable X/O fields except Glossy, CT, Film Weight GSM, and Paper Core fields
                        if (fieldName === 'defect_name' || fieldName === 'remarks') {
                            cell.contentEditable = true;
                        } else if (fieldName && !['accept_reject', 'inspected_by', 'glossy', 'ct_appearance', 'film_weight_gsm', 'paper_core_dia_id', 'paper_core_dia_od'].includes(fieldName)) {
                            cell.contentEditable = false;
                        }
                    });
                } else {
                    // When cleared: Re-enable all cells
                    const cells = row ? row.querySelectorAll('td[data-field]') : [];
                    cells.forEach(cell => {
                        const fieldName = cell.dataset.field;
                        // Re-enable X/O fields and Defect Name
                        if (fieldName && !['accept_reject', 'remarks', 'inspected_by'].includes(fieldName)) {
                            cell.contentEditable = true;
                        }
                    });
                }
                
                // Auto-clear defect name when changing to Accept (remarks are preserved)
                if (selectedValue === 'Accept') {
                    const defectNameCell = row ? row.querySelector('td[data-field="defect_name"]') : null;
                    
                    if (defectNameCell) {
                        defectNameCell.textContent = '';
                        defectNameCell.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    
                    // Change all X values to O in this row when Accept is selected
                    const cells = row ? row.querySelectorAll('td[data-field]') : [];
                    cells.forEach(cell => {
                        const fieldName = cell.dataset.field;
                        // Only change X/O fields (not Accept/Reject, Defect Name, Remarks, Inspected By)
                        if (fieldName && !['accept_reject', 'defect_name', 'remarks', 'inspected_by'].includes(fieldName)) {
                            if (cell.textContent.trim() === 'X') {
                                cell.textContent = 'O';
                                cell.dispatchEvent(new Event('input', { bubbles: true }));
                            }
                        }
                    });
                    
                    console.log('Auto-cleared defect name and changed X to O for Accept status (remarks preserved)');
                }
                
                // Save the Accept/Reject selection to database immediately
                setTimeout(() => {
                    saveLotTableToSupabase(table);
                }, 100);
                
                applyColorCodingToTable();
                updateSummaryTable();
            });
            
            td.appendChild(select);
        } else if (contentEditable) {
            td.contentEditable = 'true';
            td.spellcheck = false;
            
            // Apply character limits and formatting based on field type
            td.addEventListener('input', function(e) {
                if (viewMode) {
                    console.log('Input blocked - in view mode');
                    e.preventDefault();
                    return;
                }
                
                const table = td.closest('table');
                const formId = table?.dataset?.formId;
                const allTables = Array.from(document.querySelectorAll('#tablesContainer table'));
                const tableIndex = allTables.indexOf(table);
                console.log('[DEBUG] Cell input event in table:', { formId, tableIndex });
                
                const field = td.dataset.field;
                let text = td.textContent;
                
                // Apply character limits and formatting based on field type
                if (field === 'roll_weight') {
                    // Roll Weight - format: XX.XX (2 digits before decimal, 2 after)
                    text = text.replace(/[^0-9.]/g, ''); // Only allow numbers and decimal
                    
                    // Ensure only one decimal point
                    const parts = text.split('.');
                    if (parts.length > 2) {
                        text = parts[0] + '.' + parts.slice(1).join('');
                    }
                    
                    // Limit to 2 digits before decimal and 2 after
                    if (parts.length === 2) {
                        const beforeDecimal = parts[0].substring(0, 2); // Max 2 digits before decimal
                        const afterDecimal = parts[1].substring(0, 2); // Max 2 digits after decimal
                        text = beforeDecimal + '.' + afterDecimal;
                    } else if (parts.length === 1) {
                        // No decimal point yet, limit to 2 digits
                        text = parts[0].substring(0, 2);
                    }
                    
                    // Remove leading zeros (except for decimal numbers like 0.25)
                    if (text.startsWith('0') && !text.startsWith('0.')) {
                        text = text.substring(1);
                    }
                } else if (field === 'roll_width_mm') {
                    // Roll Width (mm) - format: XXX (3 digits, no decimal)
                    text = text.replace(/[^0-9]/g, ''); // Only allow numbers
                    text = text.substring(0, 3); // Max 3 digits
                    // Remove leading zeros
                    if (text.startsWith('0') && text.length > 1) {
                        text = text.substring(1);
                    }
                } else if (field === 'film_weight_gsm') {
                    // Film Weight (GSM) - format: XX.X (2 digits before, 1 after decimal)
                    text = text.replace(/[^0-9.]/g, ''); // Only allow numbers and decimal
                    
                    // Ensure only one decimal point
                    const parts = text.split('.');
                    if (parts.length > 2) {
                        text = parts[0] + '.' + parts.slice(1).join('');
                    }
                    
                    // Limit to 2 digits before decimal and 1 after
                    if (parts.length === 2) {
                        const beforeDecimal = parts[0].substring(0, 2); // Max 2 digits before decimal
                        const afterDecimal = parts[1].substring(0, 1); // Max 1 digit after decimal
                        text = beforeDecimal + '.' + afterDecimal;
                    } else if (parts.length === 1) {
                        // No decimal point yet, limit to 2 digits
                        text = parts[0].substring(0, 2);
                    }
                    
                    // Remove leading zeros (except for decimal numbers like 0.5)
                    if (text.startsWith('0') && !text.startsWith('0.')) {
                        text = text.substring(1);
                    }
                } else if (field === 'thickness') {
                    // Thickness - format: XX (2 digits, no decimal)
                    text = text.replace(/[^0-9]/g, ''); // Only allow numbers
                    text = text.substring(0, 2); // Max 2 digits
                    // Remove leading zeros
                    if (text.startsWith('0') && text.length > 1) {
                        text = text.substring(1);
                    }
                } else if (field === 'roll_dia') {
                    // Roll θ - format: XXX (3 digits, no decimal)
                    text = text.replace(/[^0-9]/g, ''); // Only allow numbers
                    text = text.substring(0, 3); // Max 3 digits
                    // Remove leading zeros
                    if (text.startsWith('0') && text.length > 1) {
                        text = text.substring(1);
                    }
                } else if (field === 'paper_core_dia_id') {
                    // Paper Core θ (ID) - format: XXX.X (3 digits before, 1 after decimal)
                    text = text.replace(/[^0-9.]/g, ''); // Only allow numbers and decimal
                    
                    // Ensure only one decimal point
                    const parts = text.split('.');
                    if (parts.length > 2) {
                        text = parts[0] + '.' + parts.slice(1).join('');
                    }
                    
                    // Limit to 3 digits before decimal and 1 after
                    if (parts.length === 2) {
                        const beforeDecimal = parts[0].substring(0, 3); // Max 3 digits before decimal
                        const afterDecimal = parts[1].substring(0, 1); // Max 1 digit after decimal
                        text = beforeDecimal + '.' + afterDecimal;
                    } else if (parts.length === 1) {
                        // No decimal point yet, limit to 3 digits
                        text = parts[0].substring(0, 3);
                    }
                    
                    // Remove leading zeros (except for decimal numbers like 0.5)
                    if (text.startsWith('0') && !text.startsWith('0.')) {
                        text = text.substring(1);
                    }
                } else if (field === 'paper_core_dia_od') {
                    // Paper Core θ (OD) - format: XXX (3 digits, no decimal)
                    text = text.replace(/[^0-9]/g, ''); // Only allow numbers
                    text = text.substring(0, 3); // Max 3 digits
                    // Remove leading zeros
                    if (text.startsWith('0') && text.length > 1) {
                        text = text.substring(1);
                    }
                } else if (field === 'hour') {
                    // Hour - 2 characters (00-23)
                    text = text.replace(/[^0-9]/g, ''); // Only allow numbers
                    if (text.length > 2) text = text.substring(0, 2);
                    if (parseInt(text) > 23) text = '23';
                } else if (field === 'minute') {
                    // Minute - 2 characters (00-59)
                    text = text.replace(/[^0-9]/g, ''); // Only allow numbers
                    if (text.length > 2) text = text.substring(0, 2);
                    if (parseInt(text) > 59) text = '59';
                } else if (field === 'lot_no' || field === 'roll_position') {
                    // Lot No. and Roll Position - 2 characters (01-99)
                    text = text.replace(/[^0-9]/g, ''); // Only allow numbers
                    if (text.length > 2) text = text.substring(0, 2);
                } else if (field === 'arm') {
                    // Arm - 1 character (A-Z)
                    text = text.replace(/[^A-Za-z]/g, '').toUpperCase(); // Only allow letters
                    if (text.length > 1) text = text.substring(0, 1);
                } else if (field === 'lines_strips' || field === 'film_color' || field === 'pin_hole' || 
                          field === 'patch_mark' || field === 'odour' || field === 'ct' || 
                          field === 'print_color' || field === 'mis_print' || field === 'dirty_print' || 
                          field === 'tape_test' || field === 'centralization' || field === 'wrinkles' || 
                          field === 'prs' || field === 'roll_curve' || field === 'core_misalignment' || 
                          field === 'other') {
                    // These fields only allow O or X (uppercase)
                    text = text.replace(/[^OXox]/g, '').toUpperCase(); // Only allow O and X
                    if (text.length > 1) text = text.substring(0, 1);
                } else {
                    // For other fields, apply normal capitalization
                    const capitalizedText = capitalizeText(text);
                if (text !== capitalizedText) {
                        text = capitalizedText;
                    }
                }
                
                // Update cell content if changed
                if (td.textContent !== text) {
                    // Preserve cursor position
                    const selection = window.getSelection();
                    const range = selection.getRangeAt(0);
                    const cursorOffset = range.startOffset;
                    
                    td.textContent = text;
                    
                    // Restore cursor position
                    try {
                        const newRange = document.createRange();
                        newRange.setStart(td.firstChild || td, Math.min(cursorOffset, td.textContent.length));
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    } catch (e) {
                        // If cursor restoration fails, just place at end
                        const range = document.createRange();
                        range.selectNodeContents(td);
                        range.collapse(false);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                }
                
                // Apply color coding for X/O values
                applyXOColorCoding(td);
                applyColorCodingToTable();
                updateSummaryTable();
            });
            
            // Also capitalize when user finishes typing (blur event)
            td.addEventListener('blur', function(e) {
                if (viewMode) {
                    console.log('Blur blocked - in view mode');
                    return;
                }
                
                const table = td.closest('table');
                const formId = table?.dataset?.formId;
                const allTables = Array.from(document.querySelectorAll('#tablesContainer table'));
                const tableIndex = allTables.indexOf(table);
                console.log('[DEBUG] Cell blur event in table:', { formId, tableIndex });
                const text = td.textContent;
                const capitalizedText = capitalizeText(text);
                
                if (text !== capitalizedText) {
                    td.textContent = capitalizedText;
                }
                
                // Apply color coding for X/O values
                applyXOColorCoding(td);
                applyColorCodingToTable();
                updateSummaryTable();
            });
            
            // Enter key navigation to next cell
            td.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const currentRow = td.parentElement;
                    const table = currentRow.parentElement;
                    const rows = Array.from(table.children);
                    const rowIndex = rows.indexOf(currentRow);

                    // Build a 2D grid of the table (visual cells)
                    function buildGrid() {
                        const grid = [];
                        for (let r = 0; r < rows.length; r++) {
                            const row = rows[r];
                            let col = 0;
                            if (!grid[r]) grid[r] = [];
                            for (let c = 0; c < row.children.length; c++) {
                                // Skip filled cells (from rowspan)
                                while (grid[r][col]) col++;
                                const cell = row.children[c];
                                const colspan = parseInt(cell.getAttribute('colspan') || 1);
                                const rowspan = parseInt(cell.getAttribute('rowspan') || 1);
                                for (let rs = 0; rs < rowspan; rs++) {
                                    for (let cs = 0; cs < colspan; cs++) {
                                        if (!grid[r + rs]) grid[r + rs] = [];
                                        grid[r + rs][col + cs] = cell;
                                    }
                                }
                                col += colspan;
                            }
                        }
                        return grid;
                    }

                    const grid = buildGrid();
                    // Find the current cell's visual position
                    let visualCol = -1;
                    for (let col = 0; col < grid[rowIndex].length; col++) {
                        if (grid[rowIndex][col] === td) {
                            visualCol = col;
                            break;
                        }
                    }
                    // Move to the cell in the next row at the same visual column
                    if (visualCol !== -1 && grid[rowIndex + 1] && grid[rowIndex + 1][visualCol]) {
                        const nextCell = grid[rowIndex + 1][visualCol];
                        nextCell.focus();
                        // Place caret at end
                        const range = document.createRange();
                        range.selectNodeContents(nextCell);
                        range.collapse(false);
                        const sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                }
            });
        }
        
        if (rowspan > 1) {
            td.rowSpan = rowspan;
        }
        return td;
    }

    // Defensive addRows
    function addRows(n, appendOnly = false) {
        if (!tablesContainer) return;
        const firstTable = tablesContainer.querySelector('table');
        if (!firstTable) return;
        const tbody = firstTable.querySelector('tbody');
        if (!tbody) return;
        if (!appendOnly) clearRows(tbody);
        
        // Determine lot number for this table
        const tables = tablesContainer.querySelectorAll('table');
        let lotNumber = '01'; // Default for first table
        
        // If this is the first table and it's empty, always use "01"
        if (tables.length === 1 && tbody.rows.length === 0) {
            lotNumber = '01';
        } else if (tables.length > 1) {
            // This is not the first table, get the next lot number
            lotNumber = getNextLotNumber();
        }
        
        for (let i = 0; i < n; i++) {
            const tr = document.createElement('tr');
            const isFirstRow = (tbody.rows.length === 0); // First row in the table
                for (let col = 0; col < totalColumns; col++) {
                const td = createCell(true, 1, col === dropdownIndex, col, isFirstRow);
                if (col === 3) td.textContent = (tbody.rows.length + 1).toString();
                // Set lot number only for the first row of the table
                if (col === 2 && isFirstRow) {
                    td.textContent = lotNumber;
                }
                        tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
        updateRowCount(tbody);
        // Always save after adding rows, even if empty
        const tableRef = tbody.closest('table');
        if (tableRef && tableRef.dataset && tableRef.dataset.formId) {
            saveLotToSupabase(tableRef);
        }
    }

    // Defensive clearRows
    function clearRows(tbody) {
        if (!tbody) return;
        while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
        updateRowCount(tbody);
        // Update Add Next Lot button state after clearing rows
        if (addNewTableBtn) {
            updateAddNextLotButtonState();
        }
    }
    
    // ===== INSPECTED BY ROW FUNCTION =====


    // ===== DEBOUNCED SAVE FUNCTION =====
    let saveTimeout = null;
    
    function debouncedSave(table) {
        if (viewMode) {
            console.log('Save blocked - in view mode');
            return;
        }
        
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            if (!table) table = document.querySelector('#tablesContainer table');
            if (table) saveLotToSupabase(table);
        }, 1000);
    }

    // Defensive saveLotToSupabase - Updated for individual JSONB columns
    async function saveLotToSupabase(table) {
        if (viewMode) {
            console.log('Save blocked - in view mode');
            return;
        }
        
        if (!table || !table.dataset || !table.dataset.formId) {
            console.warn('saveLotToSupabase: No table or formId provided!', table);
            return;
        }
        const formId = table.dataset.formId;
        // Debug: Log which table is being saved
        const allTables = Array.from(document.querySelectorAll('#tablesContainer table'));
        const tableIndex = allTables.indexOf(table);
        let sampleCell = '';
        try {
            sampleCell = table.querySelector('tbody tr td')?.textContent || '';
        } catch (e) {}
        console.log('[DEBUG] saveLotToSupabase:', { formId, tableIndex, sampleCell });
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        const rows = tbody.rows;
        
        // Initialize JSONB objects for individual columns
        const rollWeights = {};
        const rollWidths = {};
        const filmWeightsGsm = {};
        const thicknessData = {};
        const rollDiameters = {};
        const acceptRejectStatus = {};
        const defectNames = {};
        const filmAppearance = {};
        const printingQuality = {};
        const rollAppearance = {};
        const paperCoreData = {};
        const timeData = {};
        const remarksData = {};
        
        let inspectedBy = '';
        let armValue = '';
        let totalRolls = 0;
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const cells = row.querySelectorAll('td[data-field]');
            const rollPosition = (i + 1).toString();
            let isEmpty = true;
            
            cells.forEach(cell => {
                const fieldName = cell.dataset.field;
                if (!fieldName) return;
                
                let value = '';
                if (cell.querySelector('select')) {
                    value = cell.querySelector('select').value;
                } else if (cell.querySelector('input')) {
                    value = cell.querySelector('input').checked;
                } else {
                    value = cell.textContent;
                }
                
                if (fieldName === 'inspected_by' && i === 0) {
                    inspectedBy = value;
                } else if (fieldName === 'arm' && i === 0) {
                    armValue = value;
                } else {
                    // Map field names to JSONB columns
                    switch (fieldName) {
                        case 'roll_weight':
                            rollWeights[rollPosition] = value;
                            break;
                        case 'roll_width_mm':
                            rollWidths[rollPosition] = value;
                            break;
                        case 'film_weight_gsm':
                            filmWeightsGsm[rollPosition] = value;
                            break;
                        case 'thickness':
                            thicknessData[rollPosition] = value;
                            break;
                        case 'roll_dia':
                            rollDiameters[rollPosition] = value;
                            break;
                        case 'accept_reject':
                            acceptRejectStatus[rollPosition] = value;
                            break;
                        case 'defect_name':
                            defectNames[rollPosition] = value;
                            break;
                        case 'remarks':
                            remarksData[rollPosition] = value;
                            break;
                        // Film appearance fields
                        case 'lines_strips':
                        case 'glossy':
                        case 'film_color':
                        case 'pin_hole':
                        case 'patch_mark':
                        case 'odour':
                        case 'ct_appearance':
                            if (!filmAppearance[rollPosition]) {
                                filmAppearance[rollPosition] = {};
                            }
                            filmAppearance[rollPosition][fieldName] = value;
                            break;
                        // Printing quality fields
                        case 'print_color':
                        case 'mis_print':
                        case 'dirty_print':
                        case 'tape_test':
                        case 'centralization':
                            if (!printingQuality[rollPosition]) {
                                printingQuality[rollPosition] = {};
                            }
                            printingQuality[rollPosition][fieldName] = value;
                            break;
                        // Roll appearance fields
                        case 'wrinkles':
                        case 'prs':
                        case 'roll_curve':
                        case 'core_misalignment':
                        case 'others':
                            if (!rollAppearance[rollPosition]) {
                                rollAppearance[rollPosition] = {};
                            }
                            rollAppearance[rollPosition][fieldName] = value;
                            break;
                        // Paper core fields
                        case 'paper_core_dia_id':
                        case 'paper_core_dia_od':
                            if (!paperCoreData[rollPosition]) {
                                paperCoreData[rollPosition] = {};
                            }
                            paperCoreData[rollPosition][fieldName === 'paper_core_dia_id' ? 'id' : 'od'] = value;
                            break;
                        // Time fields
                        case 'hour':
                        case 'minute':
                            if (!timeData[rollPosition]) {
                                timeData[rollPosition] = {};
                            }
                            timeData[rollPosition][fieldName] = value;
                            break;
                    }
                }
                
                if (value && value !== '') isEmpty = false;
            });
            
            if (!isEmpty) {
                totalRolls++;
            }
        }
        
        // Calculate summary from the extracted data
        const summary = calculateSummaryFromJSONB({
            rollWeights,
            rollWidths,
            acceptRejectStatus
        });
        
        // Debug: Log the update payload
        console.log('Saving to individual JSONB columns:', {
            roll_weights: rollWeights,
            roll_widths: rollWidths,
            film_weights_gsm: filmWeightsGsm,
            thickness_data: thicknessData,
            roll_diameters: rollDiameters,
            accept_reject_status: acceptRejectStatus,
            defect_names: defectNames,
            film_appearance: filmAppearance,
            printing_quality: printingQuality,
            roll_appearance: rollAppearance,
            paper_core_data: paperCoreData,
            time_data: timeData,
            remarks_data: remarksData,
            summary: summary
        });
        
        // Update row in Supabase with individual JSONB columns
        const { error } = await supabase
            .from('inline_inspection_form_master_2')
            .update({ 
                roll_weights: rollWeights,
                roll_widths: rollWidths,
                film_weights_gsm: filmWeightsGsm,
                thickness_data: thicknessData,
                roll_diameters: rollDiameters,
                accept_reject_status: acceptRejectStatus,
                defect_names: defectNames,
                film_appearance: filmAppearance,
                printing_quality: printingQuality,
                roll_appearance: rollAppearance,
                paper_core_data: paperCoreData,
                time_data: timeData,
                remarks_data: remarksData,
                inspected_by: inspectedBy,
                arm: armValue,
                updated_at: getISTTimestamp(),
                accepted_rolls: summary.accepted_rolls,
                rejected_rolls: summary.rejected_rolls,
                rework_rolls: summary.rework_rolls,
                kiv_rolls: summary.kiv_rolls,
                total_rolls: summary.total_rolls,
                accepted_weight: summary.accepted_weight,
                rejected_weight: summary.rejected_weight,
                rework_weight: summary.rework_weight,
                kiv_weight: summary.kiv_weight
            })
            .eq('form_id', formId);
        if (error) {
            alert('Error saving lot: ' + error.message);
        } else {
            console.log('Lot saved to individual JSONB columns!');
        }
    }
    
    // Calculate summary from rolls data
    function calculateSummary(rolls) {
        let accepted = 0, rejected = 0, rework = 0, kiv = 0;
        let accepted_weight = 0, rejected_weight = 0, rework_weight = 0, kiv_weight = 0;
        rolls.forEach(roll => {
            const status = roll.accept_reject;
            const weight = parseFloat(roll.roll_weight) || 0;
            if (status === 'Accept') {
                accepted++;
                accepted_weight += weight;
            } else if (status === 'Reject') {
                rejected++;
                rejected_weight += weight;
            } else if (status === 'Rework') {
                rework++;
                rework_weight += weight;
            } else if (status === 'KIV') {
                kiv++;
                kiv_weight += weight;
            }
        });
        return {
            accepted_rolls: accepted,
            rejected_rolls: rejected,
            rework_rolls: rework,
            kiv_rolls: kiv,
            total_rolls: rolls.length,
            accepted_weight: +accepted_weight.toFixed(2),
            rejected_weight: +rejected_weight.toFixed(2),
            rework_weight: +rework_weight.toFixed(2),
            kiv_weight: +kiv_weight.toFixed(2)
        };
    }

    // Calculate summary from individual JSONB columns
    function calculateSummaryFromJSONB(jsonbData) {
        const { rollWeights, rollWidths, acceptRejectStatus } = jsonbData;
        let accepted = 0, rejected = 0, rework = 0, kiv = 0;
        let accepted_weight = 0, rejected_weight = 0, rework_weight = 0, kiv_weight = 0;
        let total_rolls = 0;
        
        // Iterate through all roll positions
        const rollPositions = Object.keys(acceptRejectStatus);
        rollPositions.forEach(position => {
            const status = acceptRejectStatus[position];
            const weight = parseFloat(rollWeights[position]) || 0;
            
            if (status === 'Accept') {
                accepted++;
                accepted_weight += weight;
            } else if (status === 'Reject') {
                rejected++;
                rejected_weight += weight;
            } else if (status === 'Rework') {
                rework++;
                rework_weight += weight;
            } else if (status === 'KIV') {
                kiv++;
                kiv_weight += weight;
            }
            
            if (status && status !== '') {
                total_rolls++;
            }
        });
        
        return {
            accepted_rolls: accepted,
            rejected_rolls: rejected,
            rework_rolls: rework,
            kiv_rolls: kiv,
            total_rolls: total_rolls,
            accepted_weight: +accepted_weight.toFixed(2),
            rejected_weight: +rejected_weight.toFixed(2),
            rework_weight: +rework_weight.toFixed(2),
            kiv_weight: +kiv_weight.toFixed(2)
        };
    }

    // ===== NEW JSONB LOAD FUNCTION =====
    async function loadInspectionData(traceabilityCode) {
        try {
            const tables = tablesContainer.querySelectorAll('table');
            tables.forEach(table => {
                const tbody = table.querySelector('tbody');
                if (!tbody) return;
                tbody.innerHTML = '';
                // Add more logic here if you want to reset or repopulate rows
            });
            // ...rest of your data loading logic, always using tbody from each table...
        } catch (error) {
            console.error('Error loading inspection data:', error);
        }
    }

    // ===== BACKWARD COMPATIBILITY - OLD SAVE FUNCTION =====
    async function saveCellToSupabase(event) {
        if (viewMode) {
            console.log('Save blocked - in view mode');
            return;
        }
        
        // ... existing save logic ...
    }
    
    async function saveTable() {
        if (viewMode) {
            console.log('Save blocked - in view mode');
            return;
        }
        
        // ... existing save logic ...
    }

    // ===== BACKWARD COMPATIBILITY - OLD TABLE SAVE =====
    async function saveTable() {
        if (viewMode) {
            console.log('Save blocked - in view mode');
            return;
        }
        
        // This is now deprecated - use saveLotToSupabase instead
        console.log('Table save is deprecated. Use saveLotToSupabase instead.');
        await saveLotToSupabase();
    }

    // Helper function to capitalize text
    function capitalizeText(text) {
        if (!text || typeof text !== 'string') return text;
        const words = text.split(' ');
        const capitalizedWords = words.map(word => {
            if (word.length > 0) {
                return word.charAt(0).toUpperCase() + word.slice(1);
            }
            return word;
        });
        return capitalizedWords.join(' ');
    }

    // Helper function to apply color coding for X/O values
    function applyXOColorCoding(cell) {
        const text = cell.textContent.trim().toUpperCase();
        
        // Reset colors first
        cell.style.color = '';
        cell.style.fontWeight = '';
        cell.style.backgroundColor = '';
        
        if (text === 'X') {
            cell.style.color = '#dc2626'; // red
            cell.style.fontWeight = 'bold';
            cell.style.backgroundColor = '#fecaca'; // darker red background
        } else if (text === 'O') {
            cell.style.color = '#2563eb'; // blue
            cell.style.fontWeight = 'bold';
        }
    }

    // ===== COLOR CODING FUNCTION =====
    function applyColorCodingToTable() {
        // Loop through all dynamic tables
        const tables = tablesContainer.querySelectorAll('table');
        tables.forEach(table => {
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            const rows = tbody.rows;
        // Build a 2D grid of the table (visual cells)
        function buildGrid() {
            const grid = [];
            for (let r = 0; r < rows.length; r++) {
                const row = rows[r];
                let col = 0;
                if (!grid[r]) grid[r] = [];
                for (let c = 0; c < row.children.length; c++) {
                    // Skip filled cells (from rowspan)
                    while (grid[r][col]) col++;
                    const cell = row.children[c];
                    const colspan = parseInt(cell.getAttribute('colspan') || 1);
                    const rowspan = parseInt(cell.getAttribute('rowspan') || 1);
                    for (let rs = 0; rs < rowspan; rs++) {
                        for (let cs = 0; cs < colspan; cs++) {
                            if (!grid[r + rs]) grid[r + rs] = [];
                            grid[r + rs][col + cs] = cell;
                        }
                    }
                    col += colspan;
                }
            }
            return grid;
        }
        const grid = buildGrid();
        // Apply colors to each row based on Accept/Reject value
        for (let r = 0; r < grid.length; r++) {
            const acceptCell = grid[r][29]; // Accept/Reject column
            if (!acceptCell) continue;
            const select = acceptCell.querySelector('select');
            if (!select) continue;
            const value = select.value;
            let rollPosCell = null;
            if (grid[r] && grid[r][3]) {
                rollPosCell = grid[r][3];
            }
            function setColors(bg, fg) {
                acceptCell.style.backgroundColor = bg;
                acceptCell.style.color = fg;
                select.style.backgroundColor = bg;
                select.style.color = fg;
                if (rollPosCell) {
                    rollPosCell.style.backgroundColor = bg;
                    rollPosCell.style.color = fg;
                }
            }
            if (value === 'Accept') {
                setColors('#218838', '#fff'); // dark green
            } else if (value === 'Reject') {
                setColors('#c82333', '#fff'); // dark red
            } else if (value === 'KIV') {
                setColors('#0056b3', '#fff'); // dark blue
            } else if (value === 'Rework') {
                setColors('#e6b800', '#fff'); // dark yellow
            } else {
                setColors('', '');
            }
        }
        });
    }



    // ===== HOOK INTO UI EVENTS =====
    function addSaveListeners() {
        const tables = tablesContainer.querySelectorAll('table');
        tables.forEach(table => {
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            // Remove previous handler if present
            if (tbody._saveHandler) {
                tbody.removeEventListener('input', tbody._saveHandler, true);
                tbody.removeEventListener('change', tbody._saveHandler, true);
            }
            // Create a new handler that always saves this table
            tbody._saveHandler = function(event) { 
                // Handle automatic Accept/Reject based on X/O input
                handleXOInput(event);
                debouncedSave(table); 
            };
            tbody.addEventListener('input', tbody._saveHandler, true);
            tbody.addEventListener('change', tbody._saveHandler, true);
        });
    }

    // ===== AUTOMATIC ACCEPT/REJECT BASED ON X/O INPUT =====
    function handleXOInput(event) {
        const cell = event.target;
        if (!cell || !cell.dataset || !cell.dataset.field) return;
        
        // Define X/O fields that should trigger automatic Accept/Reject
        const xoFields = [
            'lines_strips', 'glossy', 'film_color', 'pin_hole', 'patch_mark', 'odour',
            'print_color', 'mis_print', 'dirty_print', 'tape_test', 'centralization',
            'wrinkles', 'prs', 'roll_curve', 'core_misalignment', 'others'
        ];
        
        const fieldName = cell.dataset.field;
        if (!xoFields.includes(fieldName)) return;
        
        const inputValue = cell.textContent.trim().toUpperCase();
        const row = cell.closest('tr');
        if (!row) return;
        
        // Find the Accept/Reject dropdown in the same row
        const acceptRejectCell = row.querySelector('td[data-field="accept_reject"]');
        if (!acceptRejectCell) return;
        
        const acceptRejectSelect = acceptRejectCell.querySelector('select');
        if (!acceptRejectSelect) return;
        
        // Check ALL X/O fields in the row to determine Accept/Reject
        let hasX = false;
        let hasO = false;
        let totalXOFilled = 0;
        let xFieldName = null; // Track which field has X
        
        // Check all X/O fields in this row
        xoFields.forEach(field => {
            const fieldCell = row.querySelector(`td[data-field="${field}"]`);
            if (fieldCell) {
                const value = fieldCell.textContent.trim().toUpperCase();
                if (value === 'X') {
                    hasX = true;
                    totalXOFilled++;
                } else if (value === 'O') {
                    hasO = true;
                    totalXOFilled++;
                }
            }
        });
        
        // Use the field that was actually changed (the one that triggered this event)
        if (inputValue === 'X') {
            xFieldName = fieldName;
        }
        
        // Auto-update Accept/Reject based on ALL X/O fields in the row
        if (hasX) {
            // If ANY field has X, set to Reject
            acceptRejectSelect.value = 'Reject';
            acceptRejectSelect.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Auto-fill defect name based on the X field
            if (xFieldName) {
                autoFillDefectName(row, xFieldName);
            }
            
            // Re-apply color coding to show red background for X values
            const table = row.closest('table');
            if (table) {
                applyColorCodingToTable(table);
            }
        } else if (hasO && totalXOFilled > 0) {
            // If ALL filled fields are O (no X found), set to Accept
            acceptRejectSelect.value = 'Accept';
            acceptRejectSelect.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            // If no X/O fields are filled, reset to default
            acceptRejectSelect.value = '';
            acceptRejectSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    // ===== CLEAR X VALUES WHEN MANUALLY CHANGING FROM REJECT =====
    function clearXValuesInRow(row) {
        if (!row) return;
        
        // Define X/O fields that should be cleared
        const xoFields = [
            'lines_strips', 'glossy', 'film_color', 'pin_hole', 'patch_mark', 'odour',
            'print_color', 'mis_print', 'dirty_print', 'tape_test', 'centralization',
            'wrinkles', 'prs', 'roll_curve', 'core_misalignment', 'others'
        ];
        
        // Clear all X values in X/O fields
        xoFields.forEach(field => {
            const fieldCell = row.querySelector(`td[data-field="${field}"]`);
            if (fieldCell && fieldCell.textContent.trim().toUpperCase() === 'X') {
                fieldCell.textContent = '';
            }
        });
        
        // Re-apply color coding to remove red background styling
        const table = row.closest('table');
        if (table) {
            applyColorCodingToTable(table);
        }
    }

    // ===== CLEAR ALL X/O VALUES WHEN MANUALLY CHANGING TO DEFAULT =====
    function clearAllXOValuesInRow(row) {
        if (!row) return;
        
        // Define X/O fields that should be cleared
        const xoFields = [
            'lines_strips', 'glossy', 'film_color', 'pin_hole', 'patch_mark', 'odour',
            'print_color', 'mis_print', 'dirty_print', 'tape_test', 'centralization',
            'wrinkles', 'prs', 'roll_curve', 'core_misalignment', 'others'
        ];
        
        // Clear all X and O values in X/O fields
        xoFields.forEach(field => {
            const fieldCell = row.querySelector(`td[data-field="${field}"]`);
            if (fieldCell) {
                const value = fieldCell.textContent.trim().toUpperCase();
                if (value === 'X' || value === 'O') {
                    fieldCell.textContent = '';
                }
            }
        });
        
        // Re-apply color coding to remove red background styling
        const table = row.closest('table');
        if (table) {
            applyColorCodingToTable(table);
        }
    }

    // ===== AUTO-FILL DEFECT NAME BASED ON X FIELD =====
    function autoFillDefectName(row, xFieldName) {
        if (!row) return;
        
        // Find the defect name cell in the same row
        const defectNameCell = row.querySelector('td[data-field="defect_name"]');
        if (!defectNameCell) return;
        
        // Define field to defect name mappings
        const fieldToDefectMappings = {
            'mis_print': 'Mis Print',
            'dirty_print': 'Dirty Print', 
            'pin_hole': 'Pin Hole',
            'core_misalignment': 'Core Misalignment',
            'prs': 'PRS'
        };
        
        // Check if this X field has a direct mapping
        if (fieldToDefectMappings[xFieldName]) {
            // Use the exact defect name from mapping
            defectNameCell.textContent = fieldToDefectMappings[xFieldName];
            // Trigger input event to ensure save
            defectNameCell.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (xFieldName === 'wrinkles') {
            // For wrinkles, show defect suggestions from database
            showWrinkleDefectSuggestions(defectNameCell);
        } else {
            // For other fields, show all defect suggestions filtered by field name
            showDefectSuggestionsForField(defectNameCell, xFieldName);
        }
    }

    // ===== SHOW WRINKLE DEFECT SUGGESTIONS =====
    function showWrinkleDefectSuggestions(defectNameCell) {
        // Use the existing defect autocomplete system with wrinkle filter
        showDefectAutocomplete(defectNameCell, 'wrinkle');
    }

    // ===== SHOW DEFECT SUGGESTIONS FOR SPECIFIC FIELD =====
    function showDefectSuggestionsForField(defectNameCell, fieldName) {
        // Map field names to search terms for defect suggestions
        const fieldToSearchTerms = {
            'lines_strips': 'line',
            'glossy': 'gloss',
            'film_color': 'color',
            'pin_hole': 'hole',
            'patch_mark': 'patch',
            'odour': 'odor',
            'print_color': 'print',
            'tape_test': 'tape',
            'centralization': 'central',
            'prs': 'prs',
            'roll_curve': 'curve',
            'others': 'other'
        };
        
        const searchTerm = fieldToSearchTerms[fieldName] || fieldName;
        showDefectAutocomplete(defectNameCell, searchTerm);
    }

    // ===== LOCK CHECKBOX FUNCTIONALITY =====
    function getLockCheckboxesForTable(table) {
        const rollWeightLock = table.querySelector('#rollWeightLock');
        const rollThetaLock = table.querySelector('#rollThetaLock');
        return { rollWeightLock, rollThetaLock };
    }

    // Add event listeners
    addRowsBtn.addEventListener('click', async () => {
        // Double-check form type from UI if not set from database
        if (isNonPrintedForm === false) {
            const nonPrintedCheckbox = document.getElementById('non_printed');
            if (nonPrintedCheckbox && nonPrintedCheckbox.checked) {
                isNonPrintedForm = true;
                console.log('Form type updated from UI - Non-printed:', isNonPrintedForm);
            }
        }
        console.log('Add Rows clicked - Current isNonPrintedForm:', isNonPrintedForm);
        const n = parseInt(numRowsInput.value, 10) || 1;
        addRows(n);
        afterTableStructureChange();
        // Ensure first table has lot number "01"
        ensureFirstTableHasLotNumber();
        // Update Add Next Lot button state
        if (addNewTableBtn) {
            updateAddNextLotButtonState();
        }
        // Disable Add Rows button after adding rows
        addRowsBtn.disabled = true;
        // Only save if we're not loading data and have a traceability_code
        if (traceabilityCode && !window.isLoadingData) {
            try {
                // Save new rows as JSONB lot data
                console.log('Adding', n, 'new rows');
                const table = document.querySelector('#tablesContainer table');
                if (table) {
                    await saveLotToSupabase(table);
                }
            } catch (error) {
                console.error('Error saving new rows:', error);
                alert('Error saving new rows: ' + error.message);
            }
        }
    });



    // Defensive global Save button
    const saveTableBtn = document.getElementById('saveTableBtn');
    if (saveTableBtn) {
        saveTableBtn.addEventListener('click', () => {
            const tables = Array.from(tablesContainer.querySelectorAll('table'));
            console.log('Tables found for saving:', tables);
            if (!tables.length) {
                alert('No tables to save!');
                return;
            }
            let foundValid = false;
            tables.forEach(table => {
                if (table && table.dataset && table.dataset.formId) {
                    foundValid = true;
                    saveLotToSupabase(table);
                } else {
                    console.warn('Skipping invalid table:', table);
                }
            });
            if (!foundValid) {
                alert('No valid tables with formId to save!');
            }
        });
    }

    // ===== SUMMARY TABLE LOGIC =====
    // Add this function to render the summary table dynamically
    function renderSummaryTable(summary) {
        const container = document.getElementById('dynamicSummaryTableContainer');
        if (!container) return;
        container.innerHTML = `
            <table class="min-w-[400px] w-auto text-xs text-center border-collapse border border-gray-700 bg-white">
                <tbody>
                    <tr style="height: 30px;"><td style="border: 1px solid #9ca3af;">Accepted Rolls</td><td style="border: 1px solid #9ca3af;">${summary.acceptedCount} Rolls</td><td style="border: 1px solid #9ca3af;">${summary.acceptedWeight} KG</td></tr>
                    <tr style="height: 30px;"><td style="border: 1px solid #9ca3af;">Rejected Rolls</td><td style="border: 1px solid #9ca3af;">${summary.rejectedCount} Rolls</td><td style="border: 1px solid #9ca3af;">${summary.rejectedWeight} KG</td></tr>
                    <tr style="height: 30px;"><td style="border: 1px solid #9ca3af;">Rolls Rejected for Rework</td><td style="border: 1px solid #9ca3af;">${summary.reworkCount} Rolls</td><td style="border: 1px solid #9ca3af;">${summary.reworkWeight} KG</td></tr>
                    <tr style="height: 30px;"><td style="border: 1px solid #9ca3af;">KIV Rolls</td><td style="border: 1px solid #9ca3af;">${summary.kivCount} Rolls</td><td style="border: 1px solid #9ca3af;">${summary.kivWeight} KG</td></tr>
                    <tr style="height: 30px;"><td style="border: 1px solid #9ca3af;"><b>Total Rolls</b></td><td style="border: 1px solid #9ca3af;">${summary.totalCount} Rolls</td><td style="border: 1px solid #9ca3af;">${summary.totalWeight} KG</td></tr>
                </tbody>
            </table>
        `;
    }

    // Update updateSummaryTable to use renderSummaryTable
    function updateSummaryTable() {
        // Indices for Accept/Reject and Roll Weight columns
        const ACCEPT_COL = 29; // Accept / Reject
        const WEIGHT_COL = 5;  // Roll Weight
        // Initialize counters
        let acceptedCount = 0, acceptedWeight = 0;
        let rejectedCount = 0, rejectedWeight = 0;
        let reworkCount = 0, reworkWeight = 0;
        let kivCount = 0, kivWeight = 0;
        // Loop through all tables
        document.querySelectorAll('#tablesContainer table').forEach(table => {
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            const rows = Array.from(tbody.rows);
            // Build a visual grid for the table body
            const grid = [];
            for (let r = 0; r < rows.length; r++) {
                const row = rows[r];
                let col = 0;
                if (!grid[r]) grid[r] = [];
                for (let c = 0; c < row.children.length; c++) {
                    // Skip filled cells (from rowspan)
                    while (grid[r][col]) col++;
                    const cell = row.children[c];
                    const colspan = parseInt(cell.getAttribute('colspan') || 1);
                    const rowspan = parseInt(cell.getAttribute('rowspan') || 1);
                    for (let rs = 0; rs < rowspan; rs++) {
                        for (let cs = 0; cs < colspan; cs++) {
                            if (!grid[r + rs]) grid[r + rs] = [];
                            grid[r + rs][col + cs] = cell;
                        }
                    }
                    col += colspan;
                }
            }
            // Now, for each row, get the correct cells by visual index
            for (let r = 0; r < grid.length; r++) {
                const acceptCell = grid[r][ACCEPT_COL];
                const weightCell = grid[r][WEIGHT_COL];
                // Get dropdown value
                let status = '';
                if (acceptCell) {
                    const select = acceptCell.querySelector('select');
                    if (select) status = select.value.trim();
                }
                // Get weight value
                let weight = 0;
                if (weightCell) {
                    const val = weightCell.textContent.trim();
                    weight = parseFloat(val) || 0;
                }
                // Tally
                if (status === 'Accept') {
                    acceptedCount++;
                    acceptedWeight += weight;
                } else if (status === 'Reject') {
                    rejectedCount++;
                    rejectedWeight += weight;
                } else if (status === 'Rework') {
                    reworkCount++;
                    reworkWeight += weight;
                } else if (status === 'KIV') {
                    kivCount++;
                    kivWeight += weight;
                }
            }
        });
        // Totals
        const totalCount = acceptedCount + rejectedCount + reworkCount + kivCount;
        const totalWeight = acceptedWeight + rejectedWeight + reworkWeight + kivWeight;
        // Render the summary table dynamically
        renderSummaryTable({
            acceptedCount,
            acceptedWeight: acceptedWeight.toFixed(2),
            rejectedCount,
            rejectedWeight: rejectedWeight.toFixed(2),
            reworkCount,
            reworkWeight: reworkWeight.toFixed(2),
            kivCount,
            kivWeight: kivWeight.toFixed(2),
            totalCount,
            totalWeight: totalWeight.toFixed(2)
        });
        
        // Update Production No Summary table live
        renderProductionNoSummaryTable();
    }

    // Hook summary update to all relevant events
    function hookSummaryTableUpdates() {
        // On any cell edit or dropdown change
        document.getElementById('tablesContainer').addEventListener('input', updateSummaryTable, true);
        document.getElementById('tablesContainer').addEventListener('change', updateSummaryTable, true);
        
        // After table add/delete
        const origAddRows = addRows;
        addRows = function(n) {
            origAddRows(n);
            updateSummaryTable();
        };
        
        const origClearRows = clearRows;
        clearRows = function() {
            origClearRows();
            updateSummaryTable();
        };
    }

    // ===== TAB NAVIGATION BETWEEN ROLL WEIGHT AND ROLL DIA =====
    function updateFastEntryTabOrder() {
        // Remove old tabindex attributes
        tablesContainer.querySelectorAll('td[tabindex]').forEach(td => td.removeAttribute('tabindex'));
        
        // Add tabindex to Roll Weight and Roll Dia cells for fast entry
        tablesContainer.querySelectorAll('table').forEach(table => {
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.rows);
            
            // Get lock checkbox states
            const { rollWeightLock, rollThetaLock } = getLockCheckboxesForTable(table);
            const isRollWeightLocked = rollWeightLock && rollWeightLock.checked;
            const isRollDiaLocked = rollThetaLock && rollThetaLock.checked;
            
            // Build a 2D grid of the table (visual cells)
            const grid = [];
            for (let r = 0; r < rows.length; r++) {
                const row = rows[r];
                let col = 0;
                if (!grid[r]) grid[r] = [];
                for (let c = 0; c < row.children.length; c++) {
                    // Skip filled cells (from rowspan)
                    while (grid[r][col]) col++;
                    const cell = row.children[c];
                    const colspan = parseInt(cell.getAttribute('colspan') || 1);
                    const rowspan = parseInt(cell.getAttribute('rowspan') || 1);
                    for (let rs = 0; rs < rowspan; rs++) {
                        for (let cs = 0; cs < colspan; cs++) {
                            if (!grid[r + rs]) grid[r + rs] = [];
                            grid[r + rs][col + cs] = cell;
                        }
                    }
                    col += colspan;
                }
            }
            
            // Only add tabindex if checkboxes are checked
            if (isRollWeightLocked || isRollDiaLocked) {
                for (let r = 0; r < grid.length; r++) {
                    const rollWeightCell = grid[r][5]; // Roll Weight
                    const rollDiaCell = grid[r][9];    // Roll Dia
                    
                    if (rollWeightCell && isRollWeightLocked) {
                        rollWeightCell.setAttribute('tabindex', (r * 2 + 1).toString());
                    }
                    if (rollDiaCell && isRollDiaLocked) {
                        rollDiaCell.setAttribute('tabindex', (r * 2 + 2).toString());
                    }
                }
            }
        });
    }

    // ===== ENTER KEY HANDLER =====
    function handleEnterNavigation(e) {
        if (e.key === 'Enter') {
            const currentCell = e.target.closest('td');
            if (!currentCell) return;
            
            const currentTabIndex = parseInt(currentCell.getAttribute('tabindex') || '0');
            const nextTabIndex = currentTabIndex + 1;
            
            const nextCell = tablesContainer.querySelector(`td[tabindex="${nextTabIndex}"]`);
            if (nextCell) {
                e.preventDefault();
                nextCell.focus();
                // Place caret at end for contentEditable cells
                if (nextCell.contentEditable === 'true') {
                    const range = document.createRange();
                    range.selectNodeContents(nextCell);
                    range.collapse(false);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
        }
    }

    // ===== AFTER TABLE STRUCTURE CHANGE =====
    function afterTableStructureChange() {
        updateFastEntryTabOrder();
        addLockCheckboxListeners();
    }

    // ===== LOCK CHECKBOX EVENT LISTENERS =====
    function addLockCheckboxListeners() {
        tablesContainer.querySelectorAll('table').forEach(table => {
            const { rollWeightLock, rollThetaLock } = getLockCheckboxesForTable(table);
            
            if (rollWeightLock) {
                rollWeightLock.removeEventListener('change', updateFastEntryTabOrder);
                rollWeightLock.addEventListener('change', updateFastEntryTabOrder);
            }
            
            if (rollThetaLock) {
                rollThetaLock.removeEventListener('change', updateFastEntryTabOrder);
                rollThetaLock.addEventListener('change', updateFastEntryTabOrder);
            }
        });
    }

    // Initialize
    addSaveListeners();
    hookSummaryTableUpdates();
    updateSummaryTable();
    updateFastEntryTabOrder();
    addLockCheckboxListeners();
    
    // Update Add Next Lot button state on page load
    if (addNewTableBtn) {
        updateAddNextLotButtonState();
    }
    
    // Add enter key navigation listener
    tablesContainer.addEventListener('keydown', handleEnterNavigation);
    
    // ===== PAGE UNLOAD CLEANUP =====
    // Use beforeunload for cleanup (more reliable than unload)
    window.addEventListener('beforeunload', function() {
        cleanupResources();
    });
    
    // Use pagehide instead of unload for better browser compatibility
    window.addEventListener('pagehide', function() {
        cleanupResources();
    });
    
    // Additional cleanup on visibility change (when user switches tabs)
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') {
            // Optional: cleanup when user switches away from the page
            // cleanupResources();
        }
    });
    
    // ===== FORCE REDIRECT ON BACK BUTTON =====
    window.onpopstate = function() {
        // Immediately redirect to login if back button is pressed
        window.location.replace('auth.html');
    };
    
    // On page load, fetch and render all lots for the current traceability_code
    if (traceabilityCode) {
        try {
            const { data: lots, error } = await supabase
                .from('inline_inspection_form_master_2')
                .select('*')
                .eq('traceability_code', traceabilityCode)
                .eq('lot_letter', lotLetter);

            if (lots && lots.length > 0) {
                lots.forEach(lot => {
                    // renderLotTable(lot.inspection_data); // This line is removed
                });
            }
        } catch (error) {
            console.error('Error loading lots:', error);
        }
    }

    // Function to render a lot as a table in the UI (with thead)
    // This function is no longer used as the summary table is removed.
    // function renderLotTable(inspection_data) {
    //     // Create a new table element
    //     const table = document.createElement('table');
    //     table.className = 'min-w-full bg-white shadow-md rounded mt-8';

    //     // Build thead (copy from your HTML structure)
    //     const thead = document.createElement('thead');
    //     thead.innerHTML = `
    //         <tr class="bg-[#232f3e] text-white font-bold uppercase tracking-wider text-center">
    //             <th class="py-2 px-4 border-r border-gray-300">Sr No</th>
    //             <th class="py-2 px-4 border-r border-gray-300">Production Date</th>
    //             <th class="py-2 px-4 border-r border-gray-300">Product</th>
    //             <th class="py-2 px-4 border-r border-gray-300">M/C No</th>
    //             <th class="py-2 px-4 border-r border-gray-300">Shift</th>
    //             <th class="py-2 px-4 border-r border-gray-300">Operator</th>
    //             <th class="py-2 px-4 border-r border-gray-300">Supervisor</th>
    //             <th class="py-2 px-4 border-r border-gray-300">Line Leader</th>
    //             <th class="py-2 px-4 border-r border-gray-300">QC Inspector</th>
    //             <th class="py-2 px-4">Action</th>
    //         </tr>
    //     `;
    //     table.appendChild(thead);

    //     // Build tbody
    //     const tbody = document.createElement('tbody');
    //     if (inspection_data.rolls && inspection_data.rolls.length > 0) {
    //         inspection_data.rolls.forEach((roll, i) => {
    //             const tr = document.createElement('tr');
    //             // Example: show Sr No, Production Date, Product, etc. (customize as needed)
    //             tr.innerHTML = `
    //                 <td class="py-3 px-4 border-r border-gray-200 text-center">${i + 1}</td>
    //                 <td class="py-3 px-4 border-r border-gray-200 text-center">${inspection_data.date || '-'}</td>
    //                 <td class="py-3 px-4 border-r border-gray-200 text-center">${inspection_data.prod_code || '-'}</td>
    //                 <td class="py-3 px-4 border-r border-gray-200 text-center">${inspection_data.machine || '-'}</td>
    //                 <td class="py-3 px-4 border-r border-gray-200 text-center">${inspection_data.shift || '-'}</td>
    //                 <td class="py-3 px-4 border-r border-gray-200 text-center">${roll.operator || '-'}</td>
    //                 <td class="py-3 px-4 border-r border-gray-200 text-center">${roll.supervisor || '-'}</td>
    //                 <td class="py-3 px-4 border-r border-gray-200 text-center">${roll.line_leader || '-'}</td>
    //                 <td class="py-3 px-4 border-r border-gray-200 text-center">${roll.qc_inspector || '-'}</td>
    //                 <td class="py-3 px-4 text-center">-</td>
    //             `;
    //             tbody.appendChild(tr);
    //         });
    //     }
    //     table.appendChild(tbody);
    //     // Append the table to the tablesContainer
    //     const tablesContainer = document.getElementById('tablesContainer');
    //     tablesContainer.appendChild(table);
    // }

    // Don't add any default rows - start with empty table
    // User will add rows manually using the "Add New Rows" button

    // ===== ADD NEW TABLE FUNCTIONALITY =====
    
    // Create and style the "Add Next Lot" button (only in edit mode)
    if (!viewMode) {
        addNewTableBtn = document.createElement('button');
    addNewTableBtn.textContent = 'Add Next Lot';
    addNewTableBtn.style.margin = '10px 0 20px 10px';
    // Match Add New Rows button style exactly
    addNewTableBtn.className = addRowsBtn.className;
    // Copy all inline styles from Add New Rows button
    const addRowsBtnStyles = window.getComputedStyle(addRowsBtn);
    addNewTableBtn.style.cssText = addRowsBtn.style.cssText;
    // Optionally, copy computed styles for padding, font, etc.
    addNewTableBtn.style.height = addRowsBtnStyles.height;
    addNewTableBtn.style.fontSize = addRowsBtnStyles.fontSize;
    addNewTableBtn.style.padding = addRowsBtnStyles.padding;
    addNewTableBtn.style.borderRadius = addRowsBtnStyles.borderRadius;
    addNewTableBtn.style.margin = '10px 0 0 0'; // Keep margin for separation
        
        // Initially disable the button
        addNewTableBtn.disabled = true;
        addNewTableBtn.style.opacity = '0.5';
        addNewTableBtn.style.cursor = 'not-allowed';

    // Initially append the button after the first table
    tablesContainer.appendChild(addNewTableBtn);
    }

    // Add global table border styles for all tables
    if (!document.getElementById('custom-table-borders')) {
        const style = document.createElement('style');
        style.id = 'custom-table-borders';
        style.textContent = `
            #tablesContainer table {
                border: 2px solid #000 !important;
                border-collapse: collapse !important;
            }
            #tablesContainer table th,
            #tablesContainer table td {
                border: 1px solid #888 !important;
            }
            #tablesContainer table th {
                text-align: center !important;
                vertical-align: middle !important;
            }
            .vertical-text {
                text-align: center !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Hook up save logic to all tables - now uses debounced save
    function addSaveListenersToAllTables() {
        // Remove previous listeners by replacing node (for extra tables)
        const allTbs = tablesContainer.querySelectorAll('table tbody');
        allTbs.forEach(tbody => {
            tbody.addEventListener('input', debouncedSave, true);
            tbody.addEventListener('change', debouncedSave, true);
        });
    }

    // Helper to create a new table with n rows, matching formatting of the first table
    function createNewTable(n) {
        const origTable = tablesContainer.querySelector('table');
        const table = document.createElement('table');
        // Copy all classes and inline styles from the first table
        if (origTable) {
            table.className = origTable.className;
            table.style.cssText = origTable.style.cssText;
        } else {
            table.className = 'w-full border-collapse mt-6';
        }
        // Add thick black border to all sides
        table.style.border = '2px solid #000';
        table.style.borderCollapse = 'collapse';
        // Clone thead from the first table
        const thead = origTable ? origTable.querySelector('thead').cloneNode(true) : document.querySelector('thead').cloneNode(true);
        table.appendChild(thead);
        // Create tbody
        const tbody = document.createElement('tbody');
        for (let i = 0; i < n; i++) {
            const tr = document.createElement('tr');
            const isFirstRow = (i === 0); // First row in this table
            if (i === 0) {
                // First row: add merged cells
                for (let col = 0; col < totalColumns; col++) {
                    if (col === 31 || col === 32) {
                        tr.appendChild(createCell(true, 1, false, col, isFirstRow));
                    } else if (mergedIndices.includes(col)) {
                        tr.appendChild(createCell(true, n, false, col, isFirstRow));
                    } else if (col === 3) {
                        const td = createCell(true, 1, false, col, isFirstRow);
                        td.textContent = '1';
                        tr.appendChild(td);
                    } else if (col === dropdownIndex) {
                        tr.appendChild(createCell(false, 1, true, col, isFirstRow));
                    } else if (col > 4 && col < 31 && col !== dropdownIndex) {
                        tr.appendChild(createCell(true, 1, false, col, isFirstRow));
                    }
                }
            } else {
                // Subsequent rows: skip merged cells
                for (let col = 0; col < totalColumns; col++) {
                    if (col === 31 || col === 32) {
                        tr.appendChild(createCell(true, 1, false, col, isFirstRow));
                    } else if (col === 3) {
                        const td = createCell(true, 1, false, col, isFirstRow);
                        td.textContent = (i + 1).toString();
                        tr.appendChild(td);
                    } else if (col === dropdownIndex) {
                        tr.appendChild(createCell(false, 1, true, col, isFirstRow));
                    } else if (!mergedIndices.includes(col) && col > 4 && col < 31 && col !== dropdownIndex) {
                        tr.appendChild(createCell(true, 1, false, col, isFirstRow));
                    }
                }
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        // Ensure every table has a data-formId attribute
        if (!table.dataset.formId) {
            table.dataset.formId = crypto.randomUUID();
        }
        return table;
    }

    // Add this function near the top of the file or before the Add Next Lot handler
    function getNextLotNumber() {
        const tables = tablesContainer.querySelectorAll('table');
        if (tables.length === 0) {
            return '01'; // First table gets 01
        }
        
        // Find the highest lot number from existing tables
        let maxLotNumber = 0;
        tables.forEach(table => {
            const tbody = table.querySelector('tbody');
            if (tbody) {
                const firstRow = tbody.querySelector('tr');
                if (firstRow) {
                    const cells = firstRow.querySelectorAll('td');
                    if (cells.length > 2) { // lot_no is at index 2
                        const lotNoCell = cells[2];
                        const lotNo = parseInt(lotNoCell.textContent) || 0;
                    if (lotNo > maxLotNumber) {
                        maxLotNumber = lotNo;
                    }
            }
        }
            }
        });
        
        // If no lot numbers found, start with 01
        if (maxLotNumber === 0) {
            return '01';
        }
        
        // Return next lot number as 2-digit string
        return (maxLotNumber + 1).toString().padStart(2, '0');
    }

    // Function to fill NA values in existing tables for non-printed forms
    function fillNAValuesForNonPrintedForm() {
        const tables = tablesContainer.querySelectorAll('table');
        const naFieldNames = ['ct_appearance', 'print_color', 'mis_print', 'dirty_print', 'tape_test', 'centralization'];
        
        tables.forEach(table => {
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            
            let naFilledCount = 0;
            Array.from(tbody.rows).forEach(row => {
                naFieldNames.forEach(fieldName => {
                    const cell = row.querySelector(`td[data-field="${fieldName}"]`);
                    if (cell && cell.textContent.trim() === '') {
                        cell.textContent = 'NA';
                        naFilledCount++;
                        console.log(`Filled NA for ${fieldName} in row ${row.rowIndex}`);
                    }
                });
            });
            
            // If we filled any NA values, save the entire table
            if (naFilledCount > 0) {
                console.log(`Filled ${naFilledCount} NA values, triggering table save...`);
                setTimeout(() => {
                    saveLotTableToSupabase(table);
                }, 100);
            }
        });
    }

    // Add this function near the top of the file or before the Add Next Lot handler
    function buildEmptyRoll(position, lotNumber = '01') {
        // For non-printed forms, pre-fill NA in printing-related columns
        const naValue = isNonPrintedForm ? "NA" : "";
        console.log('Building roll', position, '- Non-printed form:', isNonPrintedForm, '- NA value:', naValue);
        
        return {
            arm: "",
            prs: "",
            hour: "",
            odour: "",
            glossy: "",
            lot_no: lotNumber,
            minute: "",
            others: "",
            remarks: "",
            pin_hole: "",
            roll_dia: "",
            wrinkles: "",
            mis_print: naValue,        // Pre-fill NA for non-printed
            tape_test: naValue,        // Pre-fill NA for non-printed
            thickness: "",
            film_color: "",
            patch_mark: "",
            roll_curve: "",
            defect_name: "",
            dirty_print: naValue,      // Pre-fill NA for non-printed
            print_color: naValue,      // Pre-fill NA for non-printed
            roll_weight: "",
            lines_strips: "",
            accept_reject: "",
            ct_appearance: naValue,    // Pre-fill NA for non-printed
            roll_position: position.toString(),
            roll_width_mm: "",
            centralization: naValue,   // Pre-fill NA for non-printed
            film_weight_gsm: "",
            core_misalignment: "",
            paper_core_dia_id: "",
            paper_core_dia_od: ""
        };
    }

    // Add event listener to the button (only if it exists)
    if (addNewTableBtn) {
    addNewTableBtn.addEventListener('click', async function() {
        // Double-check form type from UI if not set from database
        if (isNonPrintedForm === false) {
            const nonPrintedCheckbox = document.getElementById('non_printed');
            if (nonPrintedCheckbox && nonPrintedCheckbox.checked) {
                isNonPrintedForm = true;
                console.log('Form type updated from UI for Add Next Lot - Non-printed:', isNonPrintedForm);
            }
        }
        
        // Get the number of rows in the main table (first table)
        const mainTable = tablesContainer.querySelector('table');
        let rowCount = 1;
        if (mainTable) {
            const tbody = mainTable.querySelector('tbody');
            if (tbody) rowCount = tbody.rows.length;
        }
        
        // Get the next lot number
        const nextLotNumber = getNextLotNumber();
        
        const rolls = [];
        for (let i = 1; i <= rowCount; i++) {
            rolls.push(buildEmptyRoll(i, nextLotNumber));
        }
        
        // Generate new form_id
        const form_id = crypto.randomUUID();
        
        // Insert new row in Supabase with individual JSONB columns
        const { error } = await supabase
            .from('inline_inspection_form_master_2')
            .insert([{
                form_id: form_id,
                traceability_code: traceabilityCode,
                lot_letter: lotLetter,
                lot_no: nextLotNumber,
                roll_weights: {},
                roll_widths: {},
                film_weights_gsm: {},
                thickness_data: {},
                roll_diameters: {},
                accept_reject_status: {},
                defect_names: {},
                film_appearance: {},
                printing_quality: {},
                roll_appearance: {},
                paper_core_data: {},
                time_data: {},
                remarks_data: {},
                total_rolls: rowCount, // Store the row count
                accepted_rolls: 0,
                rejected_rolls: 0,
                rework_rolls: 0,
                kiv_rolls: 0,
                accepted_weight: 0,
                rejected_weight: 0,
                rework_weight: 0,
                kiv_weight: 0,
                status: 'draft',
                created_at: getISTTimestamp(),
                updated_at: getISTTimestamp()
            }]);
        if (error) {
            alert('Error creating new lot: ' + error.message);
            return;
        }
        
        // Reload all lots (to show the new table)
        console.log('Reloading lots after creating new lot...');
        await loadAllLots();
        
        // Ensure new table is properly set up
        setTimeout(() => {
        addSaveListeners(); // <-- Ensure new table cells are hooked up for saving
            updateAddNextLotButtonState();
            
        // Scroll to the new lot's table
            const tables = tablesContainer.querySelectorAll('table');
            if (tables.length > 0) {
                const newTable = tables[tables.length - 1];
                console.log('New table found:', newTable);
                newTable.scrollIntoView({ behavior: 'smooth', block: 'center' });
                saveLotToSupabase(newTable);
            }
        }, 500); // Increased timeout to ensure everything is loaded
        });
    }

    // Helper to update spacing between tables
    function updateTableSpacing() {
        const tables = tablesContainer.querySelectorAll('table');
        tables.forEach((tbl, idx) => {
            if (idx < tables.length - 1) {
                tbl.style.marginBottom = '32px';
            } else {
                tbl.style.marginBottom = '0';
            }
        });
    }

    // Helper to serialize table body data
    function serializeTableBody(tbody) {
        const data = [];
        const rows = Array.from(tbody.rows);
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const cells = row.querySelectorAll('td[data-field]');
            const rowData = {};
            
            cells.forEach(cell => {
                const fieldName = cell.dataset.field;
                if (!fieldName) return;
                
                let value = '';
                if (cell.querySelector('select')) {
                    value = cell.querySelector('select').value;
                } else if (cell.querySelector('input')) {
                    value = cell.querySelector('input').checked;
                } else {
                    value = cell.textContent;
                }
                
                rowData[fieldName] = value;
            });
            
            data.push(rowData);
        }
        
        return data;
    }



    // Initial visibility check
    // updateAddTableBtnVisibility(); // REMOVE THIS LINE

    // Call updateTableSpacing after any table add/remove/restore
    if (addNewTableBtn) {
    addNewTableBtn.addEventListener('click', updateTableSpacing);
    }

    // ===== KEYBOARD NAVIGATION FUNCTIONALITY =====
    function setupKeyboardNavigation() {
        if (viewMode) {
            console.log('Keyboard navigation disabled - in view mode');
            return;
        }
        
        document.addEventListener('keydown', function(e) {
            const activeElement = document.activeElement;
            
            // Only handle arrow keys when a table cell is focused
            if (!activeElement || !activeElement.matches('td[contenteditable="true"]')) {
                return;
            }
            
            const currentCell = activeElement;
            const currentRow = currentCell.closest('tr');
            const currentTable = currentRow.closest('table');
            const tbody = currentTable.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const currentRowIndex = rows.indexOf(currentRow);
            const cells = Array.from(currentRow.querySelectorAll('td'));
            const currentCellIndex = cells.indexOf(currentCell);
            
            let targetCell = null;
            
            switch(e.key) {
                case 'ArrowUp':
                    if (currentRowIndex > 0) {
                        const targetRow = rows[currentRowIndex - 1];
                        const targetCells = Array.from(targetRow.querySelectorAll('td'));
                        if (targetCells[currentCellIndex]) {
                            targetCell = targetCells[currentCellIndex];
                        }
                    }
                    break;
                    
                case 'ArrowDown':
                    if (currentRowIndex < rows.length - 1) {
                        const targetRow = rows[currentRowIndex + 1];
                        const targetCells = Array.from(targetRow.querySelectorAll('td'));
                        if (targetCells[currentCellIndex]) {
                            targetCell = targetCells[currentCellIndex];
                        }
                    }
                    break;
                    
                case 'ArrowLeft':
                    if (currentCellIndex > 0) {
                        targetCell = cells[currentCellIndex - 1];
                    }
                    break;
                    
                case 'ArrowRight':
                    if (currentCellIndex < cells.length - 1) {
                        targetCell = cells[currentCellIndex + 1];
                    }
                    break;
            }
            
            if (targetCell && targetCell.isContentEditable) {
                e.preventDefault();
                targetCell.focus();
                
                // Place cursor at the end of the text
                const range = document.createRange();
                const selection = window.getSelection();
                range.selectNodeContents(targetCell);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });
    }
    
    // Initialize keyboard navigation
    setupKeyboardNavigation();



    // ===== FILL O FUNCTIONALITY =====
    const fillOBtn = document.getElementById('fillOBtn');
    if (fillOBtn) {
        fillOBtn.addEventListener('click', function() {
            // Get all tables in the container
            const allTables = tablesContainer.querySelectorAll('table');
            
            allTables.forEach(table => {
                const tbody = table.querySelector('tbody');
                if (!tbody) return;
                
                // Define the specific fields to fill (Film Appearance, Printing, Roll Appearance)
                const fieldsToFill = [
                    'lines_strips', 'glossy', 'film_color', 'pin_hole', 'patch_mark', 'odour', 'ct_appearance', 'print_color', // Film Appearance
                    'mis_print', 'dirty_print', 'tape_test', 'centralization', // Printing
                    'wrinkles', 'prs', 'roll_curve', 'core_misalignment', 'others' // Roll Appearance
                ];
                
                // Get cells with data-field attributes that match our target fields
                const cells = tbody.querySelectorAll('td[data-field]');
                
                cells.forEach(cell => {
                    const fieldName = cell.dataset.field;
                    
                    // Only process cells that are in our target fields
                    if (!fieldsToFill.includes(fieldName)) return;
                    
                    // Skip cells that already have content (not empty)
                    if (cell.textContent.trim() !== '') return;
                    
                    // Fill empty cells with "O"
                    cell.textContent = 'O';
                    
                    // Apply color coding
                    applyXOColorCoding(cell);
                    
                    // Trigger save to Supabase
                    const event = new Event('input', { bubbles: true });
                    cell.dispatchEvent(event);
                });
            });
            
            // Show confirmation
            const originalText = fillOBtn.textContent;
            fillOBtn.textContent = 'Saved!';
            fillOBtn.style.backgroundColor = '#10b981'; // green
            setTimeout(() => {
                fillOBtn.textContent = originalText;
                fillOBtn.style.backgroundColor = ''; // reset to original
            }, 1000);
        });
    }

    // ===== MIGRATION FUNCTION - Convert old data to JSONB =====
    async function migrateOldDataToJSONB() {
        if (!traceabilityCode) return;
        
        try {
            console.log('Starting migration of old data to JSONB...');
            
            // Load all old individual row data
            const { data: oldData, error } = await supabase
                .from('inline_inspection_form_master_2')
                .select('*')
                .eq('traceability_code', traceabilityCode)
                .eq('lot_letter', lotLetter)
                .not('row_number', 'is', null)
                .order('row_number');
            
            if (error) {
                console.error('Error loading old data for migration:', error);
                return;
            }
            
            if (oldData && oldData.length > 0) {
                console.log('Found', oldData.length, 'old rows to migrate');
                
                // Convert to JSONB structure
                const rolls = [];
                let inspectedBy = '';
                
                oldData.forEach((rowData, index) => {
                    const rollData = {
                        roll_position: index + 1,
                        hour: rowData.hour || '',
                        minute: rowData.minute || '',
                        lot_no: rowData.lot_no || '',
                        arm: rowData.arm || '',
                        roll_weight: rowData.roll_weight || '',
                        roll_width_mm: rowData.roll_width_mm || '',
                        film_weight_gsm: rowData.film_weight_gsm || '',
                        thickness: rowData.thickness || '',
                        roll_dia: rowData.roll_dia || '',
                        paper_core_dia_id: rowData.paper_core_dia_id || '',
                        paper_core_dia_od: rowData.paper_core_dia_od || '',
                        lines_strips: rowData.lines_strips || '',
                        glossy: rowData.glossy || '',
                        film_color: rowData.film_color || '',
                        pin_hole: rowData.pin_hole || '',
                        patch_mark: rowData.patch_mark || '',
                        odour: rowData.odour || '',
                        ct_appearance: rowData.ct_appearance || '',
                        print_color: rowData.print_color || '',
                        mis_print: rowData.mis_print || '',
                        dirty_print: rowData.dirty_print || '',
                        tape_test: rowData.tape_test || '',
                        centralization: rowData.centralization || '',
                        wrinkles: rowData.wrinkles || '',
                        prs: rowData.prs || '',
                        roll_curve: rowData.roll_curve || '',
                        core_misalignment: rowData.core_misalignment || '',
                        others: rowData.others || '',
                        accept_reject: rowData.accept_reject || '',
                        defect_name: rowData.defect_name || '',
                        remarks: rowData.remarks || ''
                    };
                    
                    // Store inspected_by from first row only
                    if (index === 0) {
                        inspectedBy = rowData.inspected_by || '';
                    }
                    
                    rolls.push(rollData);
                });
                
                // Create JSONB object
                const lotData = {
                    customer: document.getElementById('customer').textContent,
                    production_no: document.getElementById('production_no').textContent,
                    prod_code: document.getElementById('prod_code').textContent,
                    spec: document.getElementById('spec').textContent,
                    shift: document.getElementById('shift').textContent,
                    machine: document.getElementById('mc_no').textContent,
                    date: `${document.getElementById('year').textContent}-${document.getElementById('month').textContent.padStart(2, '0')}-${document.getElementById('date').textContent.padStart(2, '0')}`,
                    inspected_by: inspectedBy,
                    rolls: rolls,
                    summary: calculateSummary(rolls)
                };
                
                // Migration function deprecated - now using individual JSONB columns
                console.log('Migration function deprecated - using new JSONB structure');
                
                if (saveError) {
                    console.error('Error saving migrated data:', saveError);
                } else {
                    console.log('Successfully migrated old data to JSONB');
                    
                    // Delete old individual rows
                    const { error: deleteError } = await supabase
                        .from('inline_inspection_form_master_2')
                        .delete()
                        .eq('traceability_code', traceabilityCode)
                        .eq('lot_letter', lotLetter)
                        .not('row_number', 'is', null);
                    
                    if (deleteError) {
                        console.error('Error deleting old rows:', deleteError);
                    } else {
                        console.log('Old individual rows deleted');
                    }
                }
            }
        } catch (error) {
            console.error('Error during migration:', error);
        }
    }

    // ===== AUTO-MIGRATION ON LOAD =====
    // If we have old data format, migrate it automatically
    if (traceabilityCode) {
        // Migration logic removed - now using individual JSONB columns
        console.log('Using new JSONB structure - no migration needed');
    }

    // ===== MULTI-LOT SUPPORT START =====

    // Helper to create a table for a lot, given its data and form_id
    function createLotTable(lot, nRows = 0) {
        console.log('createLotTable called with lot:', lot);
        
        // Reconstruct rolls array from individual JSONB columns
        const rolls = [];
        const maxRolls = Math.max(
            Object.keys(lot.roll_weights || {}).length,
            Object.keys(lot.roll_widths || {}).length,
            Object.keys(lot.film_weights_gsm || {}).length,
            Object.keys(lot.thickness_data || {}).length,
            Object.keys(lot.roll_diameters || {}).length,
            Object.keys(lot.accept_reject_status || {}).length,
            Object.keys(lot.defect_names || {}).length,
            Object.keys(lot.remarks_data || {}).length,
            Object.keys(lot.film_appearance || {}).length,
            Object.keys(lot.printing_quality || {}).length,
            Object.keys(lot.roll_appearance || {}).length,
            Object.keys(lot.paper_core_data || {}).length,
            Object.keys(lot.time_data || {}).length
        );
        
        for (let i = 1; i <= maxRolls; i++) {
            const rollKey = i.toString();
            const roll = {
                roll_position: i,
                roll_weight: lot.roll_weights?.[rollKey] || '',
                roll_width_mm: lot.roll_widths?.[rollKey] || '',
                film_weight_gsm: lot.film_weights_gsm?.[rollKey] || '',
                thickness: lot.thickness_data?.[rollKey] || '',
                roll_dia: lot.roll_diameters?.[rollKey] || '',
                accept_reject: lot.accept_reject_status?.[rollKey] || '',
                defect_name: lot.defect_names?.[rollKey] || '',
                remarks: lot.remarks_data?.[rollKey] || '',
                hour: lot.time_data?.[rollKey]?.hour || '',
                minute: lot.time_data?.[rollKey]?.minute || '',
                // Film appearance fields
                lines_strips: lot.film_appearance?.[rollKey]?.lines_strips || '',
                glossy: lot.film_appearance?.[rollKey]?.glossy || '',
                film_color: lot.film_appearance?.[rollKey]?.film_color || '',
                pin_hole: lot.film_appearance?.[rollKey]?.pin_hole || '',
                patch_mark: lot.film_appearance?.[rollKey]?.patch_mark || '',
                odour: lot.film_appearance?.[rollKey]?.odour || '',
                ct_appearance: lot.film_appearance?.[rollKey]?.ct_appearance || '',
                // Printing quality fields
                print_color: lot.printing_quality?.[rollKey]?.print_color || '',
                mis_print: lot.printing_quality?.[rollKey]?.mis_print || '',
                dirty_print: lot.printing_quality?.[rollKey]?.dirty_print || '',
                tape_test: lot.printing_quality?.[rollKey]?.tape_test || '',
                centralization: lot.printing_quality?.[rollKey]?.centralization || '',
                // Roll appearance fields
                wrinkles: lot.roll_appearance?.[rollKey]?.wrinkles || '',
                prs: lot.roll_appearance?.[rollKey]?.prs || '',
                roll_curve: lot.roll_appearance?.[rollKey]?.roll_curve || '',
                core_misalignment: lot.roll_appearance?.[rollKey]?.core_misalignment || '',
                others: lot.roll_appearance?.[rollKey]?.others || '',
                // Paper core fields
                paper_core_dia_id: lot.paper_core_data?.[rollKey]?.id || '',
                paper_core_dia_od: lot.paper_core_data?.[rollKey]?.od || '',
                // Lot-level fields (same for all rows in this lot)
                lot_no: lot.lot_no || '',
                arm: lot.arm || '',
                inspected_by: lot.inspected_by || ''
            };
            rolls.push(roll);
        }
        
        console.log('Reconstructed rolls:', rolls);
        
        // Insert a dotted separator before each table except the first
        if (tablesContainer.childElementCount > 0) {
            const separator = document.createElement('div');
            separator.style.borderTop = '2px dotted #888';
            separator.style.margin = '32px 0 24px 0';
            separator.style.width = '100%';
            tablesContainer.appendChild(separator);
        }

        // Add Fill O button (only in edit mode)
        if (!viewMode) {
        const fillOButton = document.createElement('button');
        fillOButton.textContent = 'Fill O';
            fillOButton.className = 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-0.5 px-2 rounded mb-2 text-sm mr-2';
        fillOButton.style.marginBottom = '8px';
        fillOButton.onclick = function() {
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                // Only fill Lines/Strips (12), Film Appearance (13-19), Printing (20-24), Roll Appearance (25-28)
                const targetIndices = [
                    12,                    // Lines/Strips
                    13, 14, 15, 16, 17, 18, 19, // Film Appearance
                    20, 21, 22, 23, 24,         // Printing
                    25, 26, 27, 28              // Roll Appearance
                ];
                targetIndices.forEach(idx => {
                    const td = cells[idx];
                    if (
                        td &&
                        !td.querySelector('select') &&
                        !td.querySelector('input') &&
                        td.textContent.trim() === '' // Only fill empty cells (NA cells will be skipped automatically)
                    ) {
                            // Temporarily enable cell for Fill O operation
                            const wasEditable = td.contentEditable;
                            td.contentEditable = 'true';
                        td.textContent = 'O';
                            // Trigger save event for this cell
                        td.dispatchEvent(new Event('input', { bubbles: true }));
                            // Restore original editable state
                            td.contentEditable = wasEditable;
                    }
                });
            });
                
                // Save the table after filling O values
                setTimeout(() => {
                    saveLotTableToSupabase(table);
                }, 100);
        };
        tablesContainer.appendChild(fillOButton);
            
            // Add Clear O button
            const clearOButton = document.createElement('button');
            clearOButton.textContent = 'Clear O';
            clearOButton.className = 'bg-red-500 hover:bg-red-700 text-white font-bold py-0.5 px-2 rounded mb-2 text-sm';
            clearOButton.style.marginBottom = '8px';
            clearOButton.onclick = function() {
                const rows = table.querySelectorAll('tbody tr');
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    // Only clear Lines/Strips (12), Film Appearance (13-19), Printing (20-24), Roll Appearance (25-28)
                    const targetIndices = [
                        12,                    // Lines/Strips
                        13, 14, 15, 16, 17, 18, 19, // Film Appearance
                        20, 21, 22, 23, 24,         // Printing
                        25, 26, 27, 28              // Roll Appearance
                    ];
                    targetIndices.forEach(idx => {
                        const td = cells[idx];
                        if (
                            td &&
                            !td.querySelector('select') &&
                            !td.querySelector('input') &&
                            td.textContent.trim() === 'O' // Only clear O values (NA cells don't contain O)
                        ) {
                            // Temporarily enable cell for Clear O operation
                            const wasEditable = td.contentEditable;
                            td.contentEditable = 'true';
                            td.textContent = '';
                            // Trigger save event for this cell
                            td.dispatchEvent(new Event('input', { bubbles: true }));
                            // Restore original editable state
                            td.contentEditable = wasEditable;
                        }
                    });
                });
                
                // Save the table after clearing O values
                setTimeout(() => {
                    saveLotTableToSupabase(table);
                }, 100);
            };
            tablesContainer.appendChild(clearOButton);

        // Add Delete Table button
        const deleteTableButton = document.createElement('button');
        deleteTableButton.textContent = 'Delete Table';
        deleteTableButton.className = 'bg-red-500 hover:bg-red-700 text-white font-bold py-0.5 px-2 rounded mb-2 text-sm ml-2';
        deleteTableButton.style.marginBottom = '8px';
            deleteTableButton.onclick = function() {
                // Store the table reference for the overlay
                window.currentDeleteTable = table;
                window.currentDeleteTableButton = deleteTableButton;
                window.currentFillOButton = fillOButton;
                window.currentClearOButton = clearOButton;
                
                // Show the custom overlay
                const overlay = document.getElementById('deleteTableConfirmationOverlay');
                const title = document.getElementById('deleteTableConfirmationTitle');
                const message = document.getElementById('deleteTableConfirmationMessage');
                
                // Check if this is the main table (first table)
                const tables = tablesContainer.querySelectorAll('table');
                const isMainTable = tables.length > 0 && table === tables[0];
                
                if (isMainTable) {
                    title.textContent = 'Confirm Main Table Clear';
                    message.textContent = 'Are you sure you want to clear all rows from the main table? This action cannot be undone.';
                } else {
                    title.textContent = 'Confirm Table Deletion';
                    message.textContent = 'Are you sure you want to delete this table? This action cannot be undone.';
                }
                
                overlay.classList.remove('hidden');
        };
        tablesContainer.appendChild(deleteTableButton);
        }
        const table = document.createElement('table');
        table.className = 'w-full border-collapse mt-6';
        table.style.border = '2px solid #000';
        table.style.borderCollapse = 'collapse';
        table.dataset.formId = lot.form_id;
        // Build thead (copy from your HTML structure)
        const thead = document.createElement('thead');
        thead.innerHTML = lotTheadHTML.replace(/<thead>|<\/thead>/g, '');
        table.appendChild(thead);
        // Build tbody - Updated for individual JSONB columns
        const tbody = document.createElement('tbody');
        
        console.log('Rolls reconstructed from JSONB:', rolls);
        const numRows = Math.max(rolls.length, nRows);
        
        // Always add the correct number of rows
        for (let i = 0; i < numRows; i++) {
            const tr = document.createElement('tr');
            const isFirstRow = (i === 0); // First row in this table
            for (let col = 0; col < totalColumns; col++) {
                const td = createCell(true, 1, col === dropdownIndex, col, isFirstRow);
                if (col === 3) td.textContent = (i + 1).toString();
                
                // Set lot number for first row if no rolls data (new lot)
                if (col === 2 && isFirstRow && rolls.length === 0) {
                    td.textContent = lot.lot_no || '';
                    console.log('Setting lot number for new table:', lot.lot_no);
                }
                // Set arm for first row if no rolls data (new lot)
                else if (col === 4 && isFirstRow && rolls.length === 0) {
                    td.textContent = lot.arm || '';
                    console.log('Setting arm for new table:', lot.arm);
                }
                // If there is data for this row, fill it
                else if (rolls[i]) {
                    const fieldMap = {
                        0: 'hour', 1: 'minute', 2: 'lot_no', 3: 'roll_position', 4: 'arm',
                        5: 'roll_weight', 6: 'roll_width_mm', 7: 'film_weight_gsm', 8: 'thickness',
                        9: 'roll_dia', 10: 'paper_core_dia_id', 11: 'paper_core_dia_od',
                        12: 'lines_strips', 13: 'glossy', 14: 'film_color', 15: 'pin_hole',
                        16: 'patch_mark', 17: 'odour', 18: 'ct_appearance', 19: 'print_color',
                        20: 'mis_print', 21: 'dirty_print', 22: 'tape_test', 23: 'centralization',
                        24: 'wrinkles', 25: 'prs', 26: 'roll_curve', 27: 'core_misalignment',
                        28: 'others', 29: 'accept_reject', 30: 'defect_name', 31: 'remarks', 32: 'inspected_by'
                    };
                    const fieldName = fieldMap[col];
                    let value = rolls[i][fieldName] || '';
                    
                    // Only show lot number in the first row
                    if (col === 2 && !isFirstRow) {
                        value = ''; // Clear lot number for non-first rows
                    } else if (col === 2 && isFirstRow) {
                        value = lot.lot_no || value; // Use lot.lot_no for first row
                    }
                    
                    // Only show inspected_by in the first row
                    if (col === 32 && !isFirstRow) {
                        value = ''; // Clear inspected_by for non-first rows
                    } else if (col === 32 && isFirstRow) {
                        value = lot.inspected_by || value; // Use lot.inspected_by for first row
                    }
                    
                    // Only show arm in the first row
                    if (col === 4 && !isFirstRow) {
                        value = ''; // Clear arm for non-first rows
                    } else if (col === 4 && isFirstRow) {
                        value = lot.arm || value; // Use lot.arm for first row
                    }
                    
                    if (td && td.querySelector('select')) {
                        const select = td.querySelector('select');
                        if (select) {
                            select.value = value;
                        const event = new Event('change');
                            select.dispatchEvent(event);
                        }
                    } else if (td && td.querySelector('input[type="checkbox"]')) {
                        const checkbox = td.querySelector('input[type="checkbox"]');
                        if (checkbox) {
                            checkbox.checked = !!value;
                        }
                    } else if (td && td.querySelector('input[type="text"]')) {
                        const input = td.querySelector('input[type="text"]');
                        if (input) {
                            input.value = value;
                        }
                    } else if (td && (td.isContentEditable || td.contentEditable === 'true')) {
                        td.textContent = value;
                        applyXOColorCoding(td);
                    } else if (td) {
                        td.textContent = value;
                    }
                }
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
        // After filling all cells, set Inspected By in the first row's last cell
        if (lot.inspected_by) {
            setTimeout(() => {
                const firstRow = tbody.querySelector('tr');
                if (firstRow) {
                    const inspectedByCell = firstRow.lastElementChild;
                    console.log('Setting Inspected By cell (last cell):', inspectedByCell, 'to', lot.inspected_by);
                    inspectedByCell.textContent = lot.inspected_by;
                }
            }, 200);
        }
        table.appendChild(tbody);
        tablesContainer.appendChild(table);
        
        // Apply Accept/Reject row disable state after table is loaded
            setTimeout(() => {
            applyAcceptRejectRowDisable(table);
        }, 300);
        
        // Update IPQC table after this table is loaded
        setTimeout(() => {
            renderIPQCDefectsTable();
        }, 500);
        
        return table;
    }

    // Apply Accept/Reject row disable state to a table
    function applyAcceptRejectRowDisable(table) {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const acceptRejectSelect = row.querySelector('select');
            if (acceptRejectSelect) {
                const selectedValue = acceptRejectSelect.value;
                const cells = row.querySelectorAll('td[data-field]');
                
                if (selectedValue === 'Accept' || selectedValue === 'Reject' || selectedValue === 'Rework') {
                    // Disable all X/O input cells in this row except Glossy, CT, and GSM
                    cells.forEach(cell => {
                        const fieldName = cell.dataset.field;
                        // Always keep Glossy, CT, Film Weight GSM, and Paper Core fields enabled at all times
                        // Only disable X/O fields (not Accept/Reject, Defect Name, Remarks, Inspected By, Glossy, CT, GSM, Paper Core)
                        if (fieldName && !['accept_reject', 'defect_name', 'remarks', 'inspected_by', 'glossy', 'ct_appearance', 'film_weight_gsm', 'paper_core_dia_id', 'paper_core_dia_od'].includes(fieldName)) {
                    cell.contentEditable = false;
                        }
                    });
                } else {
                    // Re-enable all X/O input cells in this row
                    cells.forEach(cell => {
                        const fieldName = cell.dataset.field;
                        // Only re-enable X/O fields
                        if (fieldName && !['accept_reject', 'defect_name', 'remarks', 'inspected_by'].includes(fieldName)) {
                            cell.contentEditable = true;
                        }
                    });
                }
            }
        });
    }

    // Save a specific lot table to Supabase using its form_id - Updated for individual JSONB columns
    async function saveLotTableToSupabase(table) {
        if (!table) return;
        const formId = table.dataset.formId;
        if (!formId) return;
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        const rows = tbody.rows;
        
        // Initialize JSONB objects for individual columns
        const rollWeights = {};
        const rollWidths = {};
        const filmWeightsGsm = {};
        const thicknessData = {};
        const rollDiameters = {};
        const acceptRejectStatus = {};
        const defectNames = {};
        const filmAppearance = {};
        const printingQuality = {};
        const rollAppearance = {};
        const paperCoreData = {};
        const timeData = {};
        const remarksData = {};
        
        let inspectedBy = '';
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const cells = row.querySelectorAll('td[data-field]');
            const rollPosition = (i + 1).toString();
            
            cells.forEach(cell => {
                const fieldName = cell.dataset.field;
                if (!fieldName) return;
                
                let value = '';
                if (cell.querySelector('select')) {
                    value = cell.querySelector('select').value;
                } else if (cell.querySelector('input')) {
                    value = cell.querySelector('input').checked;
                } else {
                    value = cell.textContent;
                }
                
                if (fieldName === 'inspected_by' && i === 0) {
                    inspectedBy = value;
                } else if (fieldName === 'arm' && i === 0) {
                    armValue = value;
                } else {
                    // Map field names to JSONB columns
                    switch (fieldName) {
                        case 'roll_weight':
                            rollWeights[rollPosition] = value;
                            break;
                        case 'roll_width_mm':
                            rollWidths[rollPosition] = value;
                            break;
                        case 'film_weight_gsm':
                            filmWeightsGsm[rollPosition] = value;
                            break;
                        case 'thickness':
                            thicknessData[rollPosition] = value;
                            break;
                        case 'roll_dia':
                            rollDiameters[rollPosition] = value;
                            break;
                        case 'accept_reject':
                            acceptRejectStatus[rollPosition] = value;
                            break;
                        case 'defect_name':
                            defectNames[rollPosition] = value;
                            break;
                        case 'remarks':
                            remarksData[rollPosition] = value;
                            break;
                        // Film appearance fields
                        case 'lines_strips':
                        case 'glossy':
                        case 'film_color':
                        case 'pin_hole':
                        case 'patch_mark':
                        case 'odour':
                        case 'ct_appearance':
                            if (!filmAppearance[rollPosition]) {
                                filmAppearance[rollPosition] = {};
                            }
                            filmAppearance[rollPosition][fieldName] = value;
                            break;
                        // Printing quality fields
                        case 'print_color':
                        case 'mis_print':
                        case 'dirty_print':
                        case 'tape_test':
                        case 'centralization':
                            if (!printingQuality[rollPosition]) {
                                printingQuality[rollPosition] = {};
                            }
                            printingQuality[rollPosition][fieldName] = value;
                            break;
                        // Roll appearance fields
                        case 'wrinkles':
                        case 'prs':
                        case 'roll_curve':
                        case 'core_misalignment':
                        case 'others':
                            if (!rollAppearance[rollPosition]) {
                                rollAppearance[rollPosition] = {};
                            }
                            rollAppearance[rollPosition][fieldName] = value;
                            break;
                        // Paper core fields
                        case 'paper_core_dia_id':
                        case 'paper_core_dia_od':
                            if (!paperCoreData[rollPosition]) {
                                paperCoreData[rollPosition] = {};
                            }
                            paperCoreData[rollPosition][fieldName === 'paper_core_dia_id' ? 'id' : 'od'] = value;
                            break;
                        // Time fields
                        case 'hour':
                        case 'minute':
                            if (!timeData[rollPosition]) {
                                timeData[rollPosition] = {};
                            }
                            timeData[rollPosition][fieldName] = value;
                            break;
                    }
                }
            });
        }
        
        // Calculate summary from the extracted data
        const summary = calculateSummaryFromJSONB({
            rollWeights,
            rollWidths,
            acceptRejectStatus
        });
        
        // Update row in Supabase with individual JSONB columns
        const { error } = await supabase
            .from('inline_inspection_form_master_2')
            .update({ 
                roll_weights: rollWeights,
                roll_widths: rollWidths,
                film_weights_gsm: filmWeightsGsm,
                thickness_data: thicknessData,
                roll_diameters: rollDiameters,
                accept_reject_status: acceptRejectStatus,
                defect_names: defectNames,
                film_appearance: filmAppearance,
                printing_quality: printingQuality,
                roll_appearance: rollAppearance,
                paper_core_data: paperCoreData,
                time_data: timeData,
                remarks_data: remarksData,
                inspected_by: inspectedBy,
                arm: armValue,
                updated_at: getISTTimestamp(),
                accepted_rolls: summary.accepted_rolls,
                rejected_rolls: summary.rejected_rolls,
                rework_rolls: summary.rework_rolls,
                kiv_rolls: summary.kiv_rolls,
                total_rolls: summary.total_rolls,
                accepted_weight: summary.accepted_weight,
                rejected_weight: summary.rejected_weight,
                rework_weight: summary.rework_weight,
                kiv_weight: summary.kiv_weight
            })
            .eq('form_id', formId);
        if (error) {
            console.error('Error saving lot: ' + error.message);
        } else {
            console.log('Lot saved successfully to individual JSONB columns');
        }
    }

    // On page load, fetch all lots for this traceability_code and render tables - Updated for individual JSONB columns
    async function loadAllLots() {
        if (!traceabilityCode) return;
        // Clear existing tables
        tablesContainer.innerHTML = '';
        // Fetch all lots
        const { data: lots, error } = await supabase
            .from('inline_inspection_form_master_2')
            .select('*')
            .eq('traceability_code', traceabilityCode)
            .eq('lot_letter', lotLetter)
            .order('created_at', { ascending: true });
        console.log('Fetched lots:', lots);
        console.log('Number of lots found:', lots ? lots.length : 0);
        if (error) {
            alert('Error loading lots: ' + error.message);
            return;
        }
        if (!lots || lots.length === 0) {
            // No lots found, create a new one with empty JSONB columns
            const form_id = crypto.randomUUID();
            await supabase
                .from('inline_inspection_form_master_2')
                .insert([{
                    form_id: form_id,
                    traceability_code: traceabilityCode,
                    lot_letter: lotLetter,
                    lot_no: '01', // Set initial lot number to 01
                    roll_weights: {},
                    roll_widths: {},
                    film_weights_gsm: {},
                    thickness_data: {},
                    roll_diameters: {},
                    accept_reject_status: {},
                    defect_names: {},
                    film_appearance: {},
                    printing_quality: {},
                    roll_appearance: {},
                    paper_core_data: {},
                    time_data: {},
                    remarks_data: {},
                    total_rolls: 0,
                    accepted_rolls: 0,
                    rejected_rolls: 0,
                    rework_rolls: 0,
                    kiv_rolls: 0,
                    accepted_weight: 0,
                    rejected_weight: 0,
                    rework_weight: 0,
                    kiv_weight: 0,
                    created_at: getISTTimestamp(),
                    updated_at: getISTTimestamp()
                }]);
            // Now reload to show the new table
            return await loadAllLots();
        }
        // Fix existing lots that have null lot_no
        for (const lot of lots) {
            if (!lot.lot_no || lot.lot_no === null) {
                console.log('Fixing lot with null lot_no:', lot.id);
                // Update the lot to have lot_no '01' if it's the first lot
                const lotIndex = lots.indexOf(lot);
                const newLotNo = (lotIndex + 1).toString().padStart(2, '0');
                await supabase
                    .from('inline_inspection_form_master_2')
                    .update({ lot_no: newLotNo })
                    .eq('id', lot.id);
                // Update the lot object for rendering
                lot.lot_no = newLotNo;
            }
        }
        
        // Clear the container before repopulating
        tablesContainer.innerHTML = '';
        lots.forEach((lot, index) => {
            console.log(`Rendering lot ${index + 1}:`, lot);
            // Calculate number of rolls from JSONB data
            let rollCount = Object.keys(lot.accept_reject_status || {}).length;
            
            // If this is a new lot (empty JSONB data), use total_rolls field
            if (rollCount === 0 && lot.total_rolls > 0) {
                rollCount = lot.total_rolls;
                console.log('New lot detected, using total_rolls:', rollCount);
            }
            
            console.log(`Creating table for lot ${index + 1} with ${rollCount} rows`);
            createLotTable(lot, rollCount);
        });
        // Ensure Add Next Lot button is only appended once at the end
        if (addNewTableBtn && addNewTableBtn.parentNode !== tablesContainer) {
            tablesContainer.appendChild(addNewTableBtn);
        }
        // Fix: Apply color coding and update summary after reload
        applyColorCodingToTable();
        updateSummaryTable();
        updateFastEntryTabOrder(); // <-- Ensure tab order is set after reload
        addLockCheckboxListeners(); // <-- Ensure checkbox listeners are set after reload
        
        // ===== FILL NA VALUES FOR NON-PRINTED FORMS =====
        // After tables are loaded, check if this is a non-printed form and fill NA values
        if (isNonPrintedForm) {
            console.log('Non-printed form detected - filling NA values in existing tables');
            fillNAValuesForNonPrintedForm();
        }
        
        // In loadAllLots, after repopulating tables, re-enable Add Rows only for the first table if it is empty
        const tables = tablesContainer.querySelectorAll('table');
        if (tables.length > 0) {
            const firstTable = tables[0];
            const tbody = firstTable.querySelector('tbody');
            if (tbody && tbody.rows.length === 0) {
                addRowsBtn.disabled = false;
            } else {
                addRowsBtn.disabled = true;
            }
        }
        // After all lots are loaded and tables are rendered, show defects summary
        // 1. Aggregate all rolls from all lots using JSONB data
        let allRolls = [];
        lots.forEach(lot => {
            // Reconstruct rolls from individual JSONB columns
            const rollPositions = Object.keys(lot.accept_reject_status || {});
            rollPositions.forEach(position => {
                const roll = {
                    roll_position: parseInt(position),
                    roll_weight: lot.roll_weights?.[position] || '',
                    roll_width_mm: lot.roll_widths?.[position] || '',
                    film_weight_gsm: lot.film_weights_gsm?.[position] || '',
                    thickness: lot.thickness_data?.[position] || '',
                    roll_dia: lot.roll_diameters?.[position] || '',
                    accept_reject: lot.accept_reject_status?.[position] || '',
                    defect_name: lot.defect_names?.[position] || '',
                    remarks: lot.remarks_data?.[position] || '',
                    // Film appearance fields
                    lines_strips: lot.film_appearance?.[position]?.lines_strips || '',
                    glossy: lot.film_appearance?.[position]?.glossy || '',
                    film_color: lot.film_appearance?.[position]?.film_color || '',
                    pin_hole: lot.film_appearance?.[position]?.pin_hole || '',
                    patch_mark: lot.film_appearance?.[position]?.patch_mark || '',
                    odour: lot.film_appearance?.[position]?.odour || '',
                    ct_appearance: lot.film_appearance?.[position]?.ct_appearance || '',
                    // Printing quality fields
                    print_color: lot.printing_quality?.[position]?.print_color || '',
                    mis_print: lot.printing_quality?.[position]?.mis_print || '',
                    dirty_print: lot.printing_quality?.[position]?.dirty_print || '',
                    tape_test: lot.printing_quality?.[position]?.tape_test || '',
                    centralization: lot.printing_quality?.[position]?.centralization || '',
                    // Roll appearance fields
                    wrinkles: lot.roll_appearance?.[position]?.wrinkles || '',
                    prs: lot.roll_appearance?.[position]?.prs || '',
                    roll_curve: lot.roll_appearance?.[position]?.roll_curve || '',
                    core_misalignment: lot.roll_appearance?.[position]?.core_misalignment || '',
                    others: lot.roll_appearance?.[position]?.others || '',
                    // Paper core fields
                    paper_core_dia_id: lot.paper_core_data?.[position]?.id || '',
                    paper_core_dia_od: lot.paper_core_data?.[position]?.od || '',
                    // Time fields
                    hour: lot.time_data?.[position]?.hour || '',
                    minute: lot.time_data?.[position]?.minute || ''
                };
                allRolls.push(roll);
            });
        });
        // 2. Count occurrences of each unique defect_name (ignore empty/blank)
        const defectCounts = {};
        allRolls.forEach(roll => {
            const defect = (roll.defect_name || '').trim();
            if (defect) {
                defectCounts[defect] = (defectCounts[defect] || 0) + 1;
            }
        });
        // 3. Render the summary table beside the summary table, inside the same parent container
        let summaryTable = document.getElementById('defectsSummaryTable');
        let summaryTableContainer = document.getElementById('summaryTableContainer');
        if (!summaryTableContainer) {
            // Find the parent of the existing summary table (if any)
            const existingSummary = document.querySelector('#dynamicSummaryTableContainer')?.parentNode;
            summaryTableContainer = document.createElement('div');
            summaryTableContainer.id = 'summaryTableContainer';
            summaryTableContainer.style.display = 'flex';
            summaryTableContainer.style.justifyContent = 'center';
            summaryTableContainer.style.gap = '48px';
            summaryTableContainer.style.margin = '32px auto 0 auto';
            // Move the existing summary table into the container
            const dynamicSummary = document.getElementById('dynamicSummaryTableContainer');
            if (dynamicSummary && existingSummary) {
                existingSummary.replaceChild(summaryTableContainer, dynamicSummary);
                summaryTableContainer.appendChild(dynamicSummary);
            } else {
                document.body.appendChild(summaryTableContainer);
            }
        }
        if (!summaryTable) {
            summaryTable = document.createElement('table');
            summaryTable.id = 'defectsSummaryTable';
            summaryTable.className = 'min-w-[300px] w-auto text-xs text-center border-collapse border border-gray-700 bg-white';
        }
        let html = '<thead><tr style="height: 30px;"><th style="border: 1px solid #9ca3af;">Total Defects</th><th style="border: 1px solid #9ca3af;">Count</th></tr></thead><tbody>';
        if (Object.keys(defectCounts).length === 0) {
            html += '<tr style="height: 30px;"><td colspan="2" style="border: 1px solid #9ca3af;">No defects found in this shift.</td></tr>';
        } else {
            Object.entries(defectCounts).forEach(([defect, count]) => {
                html += `<tr style="height: 30px;"><td style="border: 1px solid #9ca3af;">${defect}</td><td style="border: 1px solid #9ca3af;">${count}</td></tr>`;
            });
        }
        html += '</tbody>';
        summaryTable.innerHTML = html;
        // Append the defects summary table to the container if not already present
        if (!summaryTableContainer.contains(summaryTable)) {
            summaryTableContainer.appendChild(summaryTable);
        }

    }

    // On initial load
    await loadAllLots();
    addSaveListeners(); // <-- Ensure new table cells are hooked up for saving
    // Update Add Next Lot button state after loading all lots
    updateAddNextLotButtonState();
    
    // Render summary tables after data is loaded
    setTimeout(() => {
        renderDefectsSummaryTable();
        renderIPQCDefectsTable();
        renderStatisticsTable();
        renderProductionNoSummaryTable();
    }, 1000);

    // ===== MULTI-LOT SUPPORT END =====

    // Add this after loadAllLots and after tables are rendered
    function renderDefectsSummaryTable() {
        // Aggregate all rolls from all lots in the DOM
        let allRolls = [];
        const tables = tablesContainer.querySelectorAll('table');
        tables.forEach(table => {
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            Array.from(tbody.rows).forEach(row => {
                const rollData = {};
                row.querySelectorAll('td[data-field]').forEach(cell => {
                    const field = cell.dataset.field;
                    if (field) rollData[field] = cell.textContent.trim();
                });
                allRolls.push(rollData);
            });
        });
        // Count occurrences of each unique defect_name (ignore empty/blank)
        const defectCounts = {};
        allRolls.forEach(roll => {
            const defect = (roll.defect_name || '').trim();
            if (defect) {
                defectCounts[defect] = (defectCounts[defect] || 0) + 1;
            }
        });
        // Render the summary table beside the summary table, inside the same parent container
        let summaryTable = document.getElementById('defectsSummaryTable');
        let summaryTableContainer = document.getElementById('summaryTableContainer');
        if (!summaryTableContainer) {
            // Find the parent of the existing summary table (if any)
            const existingSummary = document.querySelector('#dynamicSummaryTableContainer')?.parentNode;
            summaryTableContainer = document.createElement('div');
            summaryTableContainer.id = 'summaryTableContainer';
            summaryTableContainer.style.display = 'flex';
            summaryTableContainer.style.justifyContent = 'center';
            summaryTableContainer.style.gap = '48px';
            summaryTableContainer.style.margin = '32px auto 0 auto';
            // Move the existing summary table into the container
            const dynamicSummary = document.getElementById('dynamicSummaryTableContainer');
            if (dynamicSummary && existingSummary) {
                existingSummary.replaceChild(summaryTableContainer, dynamicSummary);
                summaryTableContainer.appendChild(dynamicSummary);
            } else {
                document.body.appendChild(summaryTableContainer);
            }
        }
        if (!summaryTable) {
            summaryTable = document.createElement('table');
            summaryTable.id = 'defectsSummaryTable';
            summaryTable.className = 'min-w-[300px] w-auto text-xs text-center border-collapse border border-gray-700 bg-white';
        }
        let html = '<thead><tr style="height: 30px;"><th style="border: 1px solid #9ca3af;">Total Defects</th><th style="border: 1px solid #9ca3af;">Count</th></tr></thead><tbody>';
        if (Object.keys(defectCounts).length === 0) {
            html += '<tr style="height: 30px;"><td colspan="2" style="border: 1px solid #9ca3af;">No defects found in this shift.</td></tr>';
        } else {
            Object.entries(defectCounts).forEach(([defect, count]) => {
                html += `<tr style="height: 30px;"><td style="border: 1px solid #9ca3af;">${defect}</td><td style="border: 1px solid #9ca3af;">${count}</td></tr>`;
            });
        }
        html += '</tbody>';
        summaryTable.innerHTML = html;
        if (!summaryTableContainer.contains(summaryTable)) {
            summaryTableContainer.appendChild(summaryTable);
        }
    }

    // Render IPQC Defects Table - defects found by QC personnel
    async function renderIPQCDefectsTable() {
        // Debounce the function to prevent excessive updates
        if (ipqcUpdateTimeout) {
            clearTimeout(ipqcUpdateTimeout);
        }
        
        ipqcUpdateTimeout = setTimeout(() => {
            renderIPQCDefectsTableInternal();
        }, 300); // 300ms debounce
    }
    
    async function renderIPQCDefectsTableInternal() {
        // Aggregate all rolls from all lots in the DOM
        let allRolls = [];
        const tables = tablesContainer.querySelectorAll('table');
        
        // Count defects from tables where first row inspector is from Quality Control department
        const ipqcDefectCounts = {};
        
        // Use cached QC inspectors instead of querying database every time
        const qcInspectors = qcInspectorsCache;
        
        console.log('QC Inspectors Cache:', qcInspectors); // Debug log
        
        // Process each table separately to check first row inspector
        tables.forEach((table, tableIndex) => {
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            
            const rows = Array.from(tbody.rows);
            if (rows.length === 0) return;
            
            // Check if first row's inspector is from Quality Control department
            const firstRow = rows[0];
            const firstRowInspector = firstRow.querySelector('td[data-field="inspected_by"]')?.textContent.trim() || '';
            
            console.log(`Table ${tableIndex} - First row inspector: "${firstRowInspector}"`); // Debug log
            
            // Only process this table's defects if first row inspector is from QC department
            if (firstRowInspector && qcInspectors.includes(firstRowInspector)) {
                console.log(`Processing table ${tableIndex} - Inspector "${firstRowInspector}" is QC`); // Debug log
                
                // Process all rows in this table
                rows.forEach((row, rowIndex) => {
                    const rollData = {};
                    row.querySelectorAll('td[data-field]').forEach(cell => {
                        const field = cell.dataset.field;
                        if (field) rollData[field] = cell.textContent.trim();
                    });
                    
                    const defect = (rollData.defect_name || '').trim();
                    if (defect) {
                        console.log(`Found defect in table ${tableIndex}, row ${rowIndex}: "${defect}"`); // Debug log
                        if (!ipqcDefectCounts[defect]) {
                            ipqcDefectCounts[defect] = 0;
                        }
                        ipqcDefectCounts[defect]++;
                    }
                });
            } else {
                console.log(`Skipping table ${tableIndex} - Inspector "${firstRowInspector}" is not QC`); // Debug log
            }
        });
        
        console.log('IPQC Defect Counts:', ipqcDefectCounts); // Debug log
        
        // Render the IPQC defects table
        let ipqcTable = document.getElementById('ipqcDefectsTable');
        let summaryTableContainer = document.getElementById('summaryTableContainer');
        
        if (!ipqcTable) {
            ipqcTable = document.createElement('table');
            ipqcTable.id = 'ipqcDefectsTable';
            ipqcTable.className = 'min-w-[300px] w-auto text-xs text-center border-collapse border border-gray-700 bg-white';
        }
        
        let html = '<thead><tr style="height: 30px;"><th style="border: 1px solid #9ca3af;">IPQC Defects</th><th style="border: 1px solid #9ca3af;">Count</th></tr></thead><tbody>';
        if (Object.keys(ipqcDefectCounts).length === 0) {
            html += '<tr style="height: 30px;"><td colspan="2" style="border: 1px solid #9ca3af;">No QC defects found in this shift.</td></tr>';
        } else {
            Object.entries(ipqcDefectCounts).forEach(([defect, count]) => {
                html += `<tr style="height: 30px;"><td style="border: 1px solid #9ca3af;">${defect}</td><td style="border: 1px solid #9ca3af;">${count}</td></tr>`;
            });
        }
        html += '</tbody>';
        ipqcTable.innerHTML = html;
        
        // Ensure summaryTableContainer exists
        if (!summaryTableContainer) {
            // Create summaryTableContainer if it doesn't exist
            const existingSummary = document.querySelector('#dynamicSummaryTableContainer')?.parentNode;
            summaryTableContainer = document.createElement('div');
            summaryTableContainer.id = 'summaryTableContainer';
            summaryTableContainer.style.display = 'flex';
            summaryTableContainer.style.justifyContent = 'center';
            summaryTableContainer.style.gap = '48px';
            summaryTableContainer.style.margin = '32px auto 0 auto';
            
            if (existingSummary) {
                const dynamicSummary = document.getElementById('dynamicSummaryTableContainer');
                if (dynamicSummary) {
                    existingSummary.replaceChild(summaryTableContainer, dynamicSummary);
                    summaryTableContainer.appendChild(dynamicSummary);
                }
            } else {
                document.body.appendChild(summaryTableContainer);
            }
        }
        
        // Add to the same container as the main defects table
        if (summaryTableContainer && !summaryTableContainer.contains(ipqcTable)) {
            summaryTableContainer.appendChild(ipqcTable);
        }
    }
    // Call this after loadAllLots
    renderDefectsSummaryTable();
    
    // Render IPQC table after all tables are loaded and user data is fetched
    setTimeout(() => {
        renderIPQCDefectsTable();
        renderStatisticsTable();
    }, 2000);
    
    // Also render IPQC table after user data is fetched
    setTimeout(() => {
        renderIPQCDefectsTable();
        renderStatisticsTable();
    }, 3000);
    
    // Optimized event listeners for IPQC table updates
    let defectUpdateTimeout = null;
    let inspectorUpdateTimeout = null;
    
    // Attach dynamic update on input/change in defect_name cells with debouncing
    if (tablesContainer) {
        tablesContainer.addEventListener('input', function(e) {
            if (e.target && e.target.dataset && e.target.dataset.field === 'defect_name') {
                // Debounce defect name updates
                if (defectUpdateTimeout) {
                    clearTimeout(defectUpdateTimeout);
                }
                defectUpdateTimeout = setTimeout(() => {
                renderDefectsSummaryTable();
                    renderIPQCDefectsTable();
                    renderStatisticsTable();
                }, 500); // 500ms debounce for defect updates
            }
            
            // Also update IPQC table when inspector changes
            if (e.target && e.target.dataset && e.target.dataset.field === 'inspected_by') {
                if (inspectorUpdateTimeout) {
                    clearTimeout(inspectorUpdateTimeout);
                }
                inspectorUpdateTimeout = setTimeout(() => {
                    renderIPQCDefectsTable();
                }, 500); // 500ms debounce for inspector updates
            }
            
            // Update statistics table when Accept/Reject/KIV/Rework status changes
            if (e.target && e.target.dataset && ['accept_reject'].includes(e.target.dataset.field)) {
                if (defectUpdateTimeout) {
                    clearTimeout(defectUpdateTimeout);
                }
                defectUpdateTimeout = setTimeout(() => {
                    renderStatisticsTable();
                }, 100); // Faster response for Accept/Reject changes
            }
            
            // Also update when Accept/Reject dropdown is cleared or reset
            if (e.target && e.target.tagName === 'SELECT' && e.target.closest('td[data-field="accept_reject"]')) {
                if (defectUpdateTimeout) {
                    clearTimeout(defectUpdateTimeout);
                }
                defectUpdateTimeout = setTimeout(() => {
                    renderStatisticsTable();
                }, 100);
            }
        });
        
        tablesContainer.addEventListener('change', function(e) {
            if (e.target && e.target.dataset && e.target.dataset.field === 'defect_name') {
                if (defectUpdateTimeout) {
                    clearTimeout(defectUpdateTimeout);
                }
                defectUpdateTimeout = setTimeout(() => {
                    renderDefectsSummaryTable();
                    renderIPQCDefectsTable();
                    renderStatisticsTable();
                }, 500);
            }
            
            if (e.target && e.target.dataset && e.target.dataset.field === 'inspected_by') {
                if (inspectorUpdateTimeout) {
                    clearTimeout(inspectorUpdateTimeout);
                }
                inspectorUpdateTimeout = setTimeout(() => {
                    renderIPQCDefectsTable();
                }, 500);
            }
            
            // Update statistics table when Accept/Reject/KIV/Rework status changes
            if (e.target && e.target.dataset && ['accept_reject'].includes(e.target.dataset.field)) {
                if (defectUpdateTimeout) {
                    clearTimeout(defectUpdateTimeout);
                }
                defectUpdateTimeout = setTimeout(() => {
                    renderStatisticsTable();
                }, 100); // Faster response for Accept/Reject changes
            }
            
            // Also update when Accept/Reject dropdown is cleared or reset
            if (e.target && e.target.tagName === 'SELECT' && e.target.closest('td[data-field="accept_reject"]')) {
                if (defectUpdateTimeout) {
                    clearTimeout(defectUpdateTimeout);
                }
                defectUpdateTimeout = setTimeout(() => {
                    renderStatisticsTable();
                }, 100);
            }
        });
    }

    // 1. Fetch all defects from Supabase on page load
    let defectSuggestions = [];
    (async function fetchAllDefects() {
        const { data, error } = await supabase.from('all_defects').select('defect_name').eq('is_active', true);
        if (!error && data) {
            defectSuggestions = data.map(d => d.defect_name);
        }
    })();

    // 2. Fetch users from specific departments for "Inspected By" field
    let userSuggestions = [];
    (async function fetchAllUsers() {
        const { data, error } = await supabase.from('users').select('full_name, department');
        if (!error && data) {
            // Filter users by specific departments: Quality Control, Production, Quality Assurance
            const allowedDepartments = [
                'quality control',
                'production', 
                'quality assurance',
                'qc',
                'qa'
            ];
            
            userSuggestions = data
                .filter(user => {
                    if (!user.department || !user.full_name) return false;
                    const dept = user.department.toLowerCase();
                    return allowedDepartments.some(allowed => dept.includes(allowed));
                })
                .map(u => u.full_name)
                .filter(name => name && name.trim() !== '');
            
            // Cache QC inspectors with more flexible department matching
            qcInspectorsCache = data
                .filter(user => {
                    if (!user.department) return false;
                    const dept = user.department.toLowerCase();
                    return dept.includes('quality control') || 
                           dept.includes('qc') || 
                           dept.includes('quality') ||
                           dept.includes('ipqc') ||
                           dept.includes('inspection');
                })
                .map(user => user.full_name);
            
            console.log('Filtered users for "Inspected By":', userSuggestions); // Debug log
            console.log('QC Inspectors found:', qcInspectorsCache); // Debug log
        }
    })();

    // 2. Autocomplete logic for defect_name cells
    function showDefectAutocomplete(cell, filter = null) {
        // Remove any existing dropdown
        document.querySelectorAll('.defect-autocomplete-dropdown').forEach(el => el.remove());
        const inputValue = cell.textContent.trim().toLowerCase();
        
        // If filter is provided and cell is empty, show filtered suggestions
        if (filter && inputValue.length === 0) {
            const filteredMatches = defectSuggestions.filter(d => 
                d.toLowerCase().includes(filter.toLowerCase()) && d.trim() !== ''
            );
            if (filteredMatches.length === 0) return;
            showDefectDropdown(cell, filteredMatches);
            return;
        }
        
        // Normal autocomplete behavior
        if (inputValue.length === 0) return; // Only show dropdown if user has typed something
        const matches = defectSuggestions.filter(d => d.toLowerCase().startsWith(inputValue) && d.trim() !== '');
        if (matches.length === 0) return;
        showDefectDropdown(cell, matches);
    }
    
    // Helper function to show defect dropdown
    function showDefectDropdown(cell, matches) {
        const cellRect = cell.getBoundingClientRect();
        const dropdown = document.createElement('div');
        dropdown.className = 'defect-autocomplete-dropdown';
        dropdown.style.position = 'fixed';
        dropdown.style.left = cellRect.left + 'px';
        dropdown.style.top = cellRect.bottom + 'px';
        dropdown.style.minWidth = cellRect.width + 'px';
        dropdown.style.background = '#eaf4fb'; // Light blue background
        dropdown.style.border = '1px solid #bbb';
        dropdown.style.zIndex = 10000;
        dropdown.style.maxHeight = '180px';
        dropdown.style.overflowY = 'auto';
        dropdown.style.fontSize = '14px'; // Match table cell font size
        matches.forEach(defect => {
            const item = document.createElement('div');
            item.textContent = defect;
            item.style.padding = '6px 12px';
            item.style.cursor = 'pointer';
            item.addEventListener('mousedown', function(e) {
                e.preventDefault();
                cell.textContent = defect;
                cell.dispatchEvent(new Event('input', { bubbles: true }));
                // Close dropdown immediately on selection
                document.querySelectorAll('.defect-autocomplete-dropdown').forEach(el => el.remove());
            });
            item.style.background = '#eaf4fb'; // Light blue by default
            item.addEventListener('mouseenter', function() {
                item.style.background = '#b3d8f5'; // Slightly darker blue on hover
            });
            item.addEventListener('mouseleave', function() {
                item.style.background = '#eaf4fb'; // Revert to light blue
            });
            dropdown.appendChild(item);
        });
        document.body.appendChild(dropdown);
        // Remove dropdown on blur or click elsewhere
        function removeDropdown(e) {
            if (!dropdown.contains(e.target) && e.target !== cell) {
                dropdown.remove();
                document.removeEventListener('mousedown', removeDropdown);
            }
        }
        setTimeout(() => {
            document.addEventListener('mousedown', removeDropdown);
        }, 0);
    }

    // 3. Autocomplete logic for inspected_by cells
    function showInspectorAutocomplete(cell) {
        // Remove any existing dropdown
        document.querySelectorAll('.inspector-autocomplete-dropdown').forEach(el => el.remove());
        const inputValue = cell.textContent.trim().toLowerCase();
        if (inputValue.length === 0) return; // Only show dropdown if user has typed something
        const matches = userSuggestions.filter(u => u.toLowerCase().includes(inputValue) && u.trim() !== '');
        if (matches.length === 0) return;
        const cellRect = cell.getBoundingClientRect();
        const dropdown = document.createElement('div');
        dropdown.className = 'inspector-autocomplete-dropdown';
        dropdown.style.position = 'fixed';
        dropdown.style.left = cellRect.left + 'px';
        dropdown.style.top = cellRect.bottom + 'px';
        dropdown.style.minWidth = cellRect.width + 'px';
        dropdown.style.background = '#eaf4fb'; // Light blue background
        dropdown.style.border = '1px solid #bbb';
        dropdown.style.zIndex = 10000;
        dropdown.style.maxHeight = '180px';
        dropdown.style.overflowY = 'auto';
        dropdown.style.fontSize = '14px'; // Match table cell font size
        matches.forEach(user => {
            const item = document.createElement('div');
            item.textContent = user;
            item.style.padding = '6px 12px';
            item.style.cursor = 'pointer';
            item.addEventListener('mousedown', function(e) {
                e.preventDefault();
                cell.textContent = user;
                cell.dispatchEvent(new Event('input', { bubbles: true }));
                // Close dropdown immediately on selection
                document.querySelectorAll('.inspector-autocomplete-dropdown').forEach(el => el.remove());
            });
            item.style.background = '#eaf4fb'; // Light blue by default
            item.addEventListener('mouseenter', function() {
                item.style.background = '#b3d8f5'; // Slightly darker blue on hover
            });
            item.addEventListener('mouseleave', function() {
                item.style.background = '#eaf4fb'; // Revert to light blue
            });
            dropdown.appendChild(item);
        });
        document.body.appendChild(dropdown);
        // Remove dropdown on blur or click elsewhere
        function removeDropdown(e) {
            if (!dropdown.contains(e.target) && e.target !== cell) {
                dropdown.remove();
                document.removeEventListener('mousedown', removeDropdown);
            }
        }
        setTimeout(() => {
            document.addEventListener('mousedown', removeDropdown);
        }, 0);
    }

    // 3. Attach event listeners to tablesContainer for defect_name and inspected_by cells
    if (tablesContainer) {
        tablesContainer.addEventListener('focusin', function(e) {
            if (e.target && e.target.dataset && e.target.dataset.field === 'defect_name') {
                showDefectAutocomplete(e.target);
            }
            if (e.target && e.target.dataset && e.target.dataset.field === 'inspected_by') {
                showInspectorAutocomplete(e.target);
            }
        });
        tablesContainer.addEventListener('input', function(e) {
            if (e.target && e.target.dataset && e.target.dataset.field === 'defect_name') {
                showDefectAutocomplete(e.target);
            }
            if (e.target && e.target.dataset && e.target.dataset.field === 'inspected_by') {
                showInspectorAutocomplete(e.target);
            }
        });
        // Optional: Hide dropdown on scroll
        window.addEventListener('scroll', function() {
            document.querySelectorAll('.defect-autocomplete-dropdown, .inspector-autocomplete-dropdown').forEach(el => el.remove());
        });
    }

    // Ensure tablesContainer has position: relative in CSS
    if (tablesContainer) {
        tablesContainer.style.position = 'relative';
    }

    // Add event listeners for delete table overlay
    const cancelDeleteTableBtn = document.getElementById('cancelDeleteTableBtn');
    const confirmDeleteTableBtn = document.getElementById('confirmDeleteTableBtn');
    
    // Function to show success message overlay
    function showSuccessMessage(title, message) {
        const overlay = document.getElementById('successMessageOverlay');
        const titleElement = document.getElementById('successMessageTitle');
        const messageElement = document.getElementById('successMessageText');
        
        titleElement.textContent = title;
        messageElement.textContent = message;
        overlay.classList.remove('hidden');
    }
    
    // Add event listener for success message close button
    const closeSuccessMessageBtn = document.getElementById('closeSuccessMessageBtn');
    if (closeSuccessMessageBtn) {
        closeSuccessMessageBtn.addEventListener('click', function() {
            const overlay = document.getElementById('successMessageOverlay');
            overlay.classList.add('hidden');
            // Auto-refresh the page after clicking OK on success message
            window.location.reload();
        });
    }
    
    if (cancelDeleteTableBtn) {
        cancelDeleteTableBtn.addEventListener('click', function() {
            const overlay = document.getElementById('deleteTableConfirmationOverlay');
            overlay.classList.add('hidden');
        });
    }
    
    if (confirmDeleteTableBtn) {
        confirmDeleteTableBtn.addEventListener('click', async function() {
            const table = window.currentDeleteTable;
            const deleteTableButton = window.currentDeleteTableButton;
            const fillOButton = window.currentFillOButton;
            const clearOButton = window.currentClearOButton;
            
            if (!table) return;
            
            // Check if this is the main table (first table)
            const tables = tablesContainer.querySelectorAll('table');
            const isMainTable = tables.length > 0 && table === tables[0];
            
            if (isMainTable) {
                // For main table, only clear the rows
                const tbody = table.querySelector('tbody');
                if (tbody) {
                    // Clear all rows completely (like newly added table)
                    tbody.innerHTML = '';
                    
                    // Clear all Supabase data to zero (like newly added table)
                    const formId = table.dataset.formId;
                    if (formId) {
                        const { error } = await supabase
                            .from('inline_inspection_form_master_2')
                            .update({
                                roll_weights: {},
                                roll_widths: {},
                                film_weights_gsm: {},
                                thickness_data: {},
                                roll_diameters: {},
                                accept_reject_status: {},
                                defect_names: {},
                                film_appearance: {},
                                printing_quality: {},
                                roll_appearance: {},
                                paper_core_data: {},
                                time_data: {},
                                remarks_data: {},
                                total_rolls: 0,
                                accepted_rolls: 0,
                                rejected_rolls: 0,
                                rework_rolls: 0,
                                kiv_rolls: 0,
                                accepted_weight: 0,
                                rejected_weight: 0,
                                rework_weight: 0,
                                kiv_weight: 0,
                                lot_no: null, // Reset lot number to null when no rows
                                updated_at: getISTTimestamp()
                            })
                            .eq('form_id', formId);
                        
                        if (error) {
                            console.error('Error clearing Supabase data:', error);
                        }
                    }
                    
                    // Update summary table
                    updateSummaryTable();
                    
                    showSuccessMessage('Success!', 'Main table rows cleared successfully!');
                    
                    // Page will refresh when user clicks OK on success message
                }
            } else {
                // For other tables, delete the entire table
                // Delete from Supabase using formId
                const formId = table.dataset.formId;
                if (formId) {
                    const { error } = await supabase
                        .from('inline_inspection_form_master_2')
                        .delete()
                        .eq('form_id', formId);
                    if (error) {
                        alert('Error deleting table from Supabase: ' + error.message);
                        return;
                    }
                }
                
                // Remove the table and its associated elements from UI
                table.remove();
                
                // Remove the Fill O button, Clear O button, and Delete Table button
                if (fillOButton) fillOButton.remove();
                if (clearOButton) clearOButton.remove();
                if (deleteTableButton) deleteTableButton.remove();
                
                // Remove the separator if it exists
                const separator = tablesContainer.querySelector('div[style*="dotted"]');
                if (separator) {
                    separator.remove();
                }
                

                
                // Reorder lot numbers after deletion
                await reorderLotNumbers();
                
                showSuccessMessage('Success!', 'Table deleted successfully!');
                
                // Page will refresh when user clicks OK on success message
            }
            
            // Hide the overlay
            const overlay = document.getElementById('deleteTableConfirmationOverlay');
            overlay.classList.add('hidden');
        });
    }

    // Reorder lot numbers after table deletion
    async function reorderLotNumbers() {
        try {
            // Fetch all lots for this traceability_code and lot_letter
            const { data: lots, error } = await supabase
                .from('inline_inspection_form_master_2')
                .select('*')
                .eq('traceability_code', traceabilityCode)
                .eq('lot_letter', lotLetter)
                .order('created_at', { ascending: true });
            
            if (error) {
                console.error('Error fetching lots for reordering:', error);
                return;
            }
            
            // Update lot numbers sequentially
            for (let i = 0; i < lots.length; i++) {
                const lot = lots[i];
                const newLotNo = (i + 1).toString().padStart(2, '0');
                
                if (lot.lot_no !== newLotNo) {
                    console.log(`Updating lot ${lot.id} from ${lot.lot_no} to ${newLotNo}`);
                    await supabase
                        .from('inline_inspection_form_master_2')
                        .update({ lot_no: newLotNo })
                        .eq('id', lot.id);
                }
            }
            
            console.log('Lot numbers reordered successfully');
        } catch (error) {
            console.error('Error reordering lot numbers:', error);
        }
    }

    // Add this function to ensure first table gets lot number "01"
    function ensureFirstTableHasLotNumber() {
        const tables = tablesContainer.querySelectorAll('table');
        if (tables.length === 0) return;
        
        const firstTable = tables[0];
        const tbody = firstTable.querySelector('tbody');
        if (!tbody || tbody.rows.length === 0) return;
        
        // Check if the first table has a lot number in the first row
        const firstRow = tbody.querySelector('tr');
        if (!firstRow) return;
        
        const cells = firstRow.querySelectorAll('td');
        if (cells.length > 2) {
            const lotNoCell = cells[2];
            const currentLotNo = lotNoCell.textContent.trim();
            
            // If no lot number is set in first row, set it to "01"
            if (!currentLotNo || currentLotNo === '') {
                lotNoCell.textContent = '01';
            }
            
            // Clear lot number from all other rows
            const allRows = tbody.querySelectorAll('tr');
            for (let i = 1; i < allRows.length; i++) {
                const row = allRows[i];
                const rowCells = row.querySelectorAll('td');
                if (rowCells.length > 2) {
                    rowCells[2].textContent = ''; // Clear lot number from non-first rows
                }
            }
            
            // Update database with lot number "01"
            setTimeout(async () => {
                const tableRef = tbody.closest('table');
                if (tableRef && tableRef.dataset && tableRef.dataset.formId) {
                    // Update the database to set lot_no to "01"
                    const { error } = await supabase
                        .from('inline_inspection_form_master_2')
                        .update({ lot_no: '01' })
                        .eq('form_id', tableRef.dataset.formId);
                    
                    if (error) {
                        console.error('Error updating lot number:', error);
                    } else {
                        console.log('Lot number updated to 01 in database');
                    }
                    
                    // Also save the table data
                    saveLotToSupabase(tableRef);
                }
            }, 100);
        }
    }

    // Add this function to enable/disable Add Next Lot button based on main table rows
    function updateAddNextLotButtonState() {
        const mainTable = tablesContainer.querySelector('table');
        if (!mainTable) return;
        
        const tbody = mainTable.querySelector('tbody');
        if (!tbody) return;
        
        const rowCount = tbody.rows.length;
        
        if (!addNewTableBtn) return; // Exit if button not yet created
        
        if (rowCount > 0) {
            // Enable the button if main table has rows
            addNewTableBtn.disabled = false;
            addNewTableBtn.style.opacity = '1';
            addNewTableBtn.style.cursor = 'pointer';
        } else {
            // Disable the button if main table is empty
            addNewTableBtn.disabled = true;
            addNewTableBtn.style.opacity = '0.5';
            addNewTableBtn.style.cursor = 'not-allowed';
        }
    }

    // Update Add Next Lot button state after data is loaded
    setTimeout(() => {
        updateAddNextLotButtonState();
    }, 200);

    // Manual trigger for IPQC table (for debugging)
    window.triggerIPQCTable = function() {
        console.log('Manually triggering IPQC table render...');
        renderIPQCDefectsTable();
    };
    
    // Debug function to check QC inspectors
    window.checkQCInspectors = function() {
        console.log('QC Inspectors Cache:', qcInspectorsCache);
        console.log('All tables:', document.querySelectorAll('#tablesContainer table').length);
        document.querySelectorAll('#tablesContainer table').forEach((table, index) => {
            const firstRow = table.querySelector('tbody tr');
            const inspector = firstRow?.querySelector('td[data-field="inspected_by"]')?.textContent.trim();
            console.log(`Table ${index}: Inspector = "${inspector}"`);
        });
    };

    // Calculate and display min, max, average values for roll weight, cut width, GSM
    function renderStatisticsTable() {
        const tables = tablesContainer.querySelectorAll('table');
        const allRolls = [];
        
        // Collect all roll data from all tables
        tables.forEach(table => {
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            
            const rows = Array.from(tbody.rows);
            rows.forEach(row => {
                const rollData = {};
                row.querySelectorAll('td[data-field]').forEach(cell => {
                    const field = cell.dataset.field;
                    if (field) {
                        // Check if it's a dropdown (select element)
                        const select = cell.querySelector('select');
                        if (select) {
                            rollData[field] = select.value.trim();
                        } else {
                            rollData[field] = cell.textContent.trim();
                        }
                    }
                });
                
                // Only include rolls that have Accept/Reject/KIV/Rework status selected
                const acceptRejectStatus = rollData.accept_reject;
                if (acceptRejectStatus && ['Accept', 'Reject', 'Rework', 'KIV'].includes(acceptRejectStatus)) {
                    // Only include rolls with valid data and selected status
                    if (rollData.roll_weight || rollData.roll_width_mm || rollData.film_weight_gsm || rollData.roll_dia || rollData.thickness) {
                        allRolls.push(rollData);
                    }
                }
            });
        });
        
        // Calculate statistics
        const rollWeights = allRolls.map(r => parseFloat(r.roll_weight)).filter(w => !isNaN(w) && w > 0);
        const cutWidths = allRolls.map(r => parseFloat(r.roll_width_mm)).filter(w => !isNaN(w) && w > 0);
        const gsmValues = allRolls.map(r => parseFloat(r.film_weight_gsm)).filter(g => !isNaN(g) && g > 0);
        const rollDiameters = allRolls.map(r => parseFloat(r.roll_dia)).filter(d => !isNaN(d) && d > 0);
        const thicknessValues = allRolls.map(r => parseFloat(r.thickness)).filter(t => !isNaN(t) && t > 0);
        
        const stats = {
            roll_weight: {
                min: rollWeights.length > 0 ? Math.min(...rollWeights) : 0,
                max: rollWeights.length > 0 ? Math.max(...rollWeights) : 0,
                avg: rollWeights.length > 0 ? (rollWeights.reduce((a, b) => a + b, 0) / rollWeights.length) : 0,
                count: rollWeights.length
            },
            cut_width: {
                min: cutWidths.length > 0 ? Math.min(...cutWidths) : 0,
                max: cutWidths.length > 0 ? Math.max(...cutWidths) : 0,
                avg: cutWidths.length > 0 ? (cutWidths.reduce((a, b) => a + b, 0) / cutWidths.length) : 0,
                count: cutWidths.length
            },
            gsm: {
                min: gsmValues.length > 0 ? Math.min(...gsmValues) : 0,
                max: gsmValues.length > 0 ? Math.max(...gsmValues) : 0,
                avg: gsmValues.length > 0 ? (gsmValues.reduce((a, b) => a + b, 0) / gsmValues.length) : 0,
                count: gsmValues.length
            },
            roll_dia: {
                min: rollDiameters.length > 0 ? Math.min(...rollDiameters) : 0,
                max: rollDiameters.length > 0 ? Math.max(...rollDiameters) : 0,
                avg: rollDiameters.length > 0 ? (rollDiameters.reduce((a, b) => a + b, 0) / rollDiameters.length) : 0,
                count: rollDiameters.length
            },
            thickness: {
                min: thicknessValues.length > 0 ? Math.min(...thicknessValues) : 0,
                max: thicknessValues.length > 0 ? Math.max(...thicknessValues) : 0,
                avg: thicknessValues.length > 0 ? (thicknessValues.reduce((a, b) => a + b, 0) / thicknessValues.length) : 0,
                count: thicknessValues.length
            }
        };
        
        // Create or update statistics table
        let statsTable = document.getElementById('statisticsTable');
        if (!statsTable) {
            statsTable = document.createElement('table');
            statsTable.id = 'statisticsTable';
            statsTable.className = 'min-w-[300px] w-auto text-xs text-center border-collapse border border-gray-700 bg-white';
        }
        
        let html = `
            <thead>
                <tr style="height: 30px;">
                    <th colspan="4" style="background-color: #f3f4f6; font-weight: bold; border: 1px solid #9ca3af;">Statistics</th>
                </tr>
                <tr style="height: 25px;">
                    <th style="width: 80px; border: 1px solid #9ca3af;">Parameter</th>
                    <th style="width: 60px; border: 1px solid #9ca3af;">Min</th>
                    <th style="width: 60px; border: 1px solid #9ca3af;">Max</th>
                    <th style="width: 60px; border: 1px solid #9ca3af;">Avg</th>
                </tr>
            </thead>
            <tbody>
                <tr style="height: 25px;">
                    <td style="font-weight: bold; border: 1px solid #9ca3af;">Roll Weight</td>
                    <td style="border: 1px solid #9ca3af;">${stats.roll_weight.min.toFixed(2)}</td>
                    <td style="border: 1px solid #9ca3af;">${stats.roll_weight.max.toFixed(2)}</td>
                    <td style="border: 1px solid #9ca3af;">${stats.roll_weight.avg.toFixed(2)}</td>
                </tr>
                <tr style="height: 25px;">
                    <td style="font-weight: bold; border: 1px solid #9ca3af;">Cut Width</td>
                    <td style="border: 1px solid #9ca3af;">${stats.cut_width.min.toFixed(0)}</td>
                    <td style="border: 1px solid #9ca3af;">${stats.cut_width.max.toFixed(0)}</td>
                    <td style="border: 1px solid #9ca3af;">${stats.cut_width.avg.toFixed(0)}</td>
                </tr>
                <tr style="height: 25px;">
                    <td style="font-weight: bold; border: 1px solid #9ca3af;">GSM</td>
                    <td style="border: 1px solid #9ca3af;">${stats.gsm.min.toFixed(2)}</td>
                    <td style="border: 1px solid #9ca3af;">${stats.gsm.max.toFixed(2)}</td>
                    <td style="border: 1px solid #9ca3af;">${stats.gsm.avg.toFixed(2)}</td>
                </tr>
                <tr style="height: 25px;">
                    <td style="font-weight: bold; border: 1px solid #9ca3af;">Roll θ</td>
                    <td style="border: 1px solid #9ca3af;">${stats.roll_dia.min.toFixed(0)}</td>
                    <td style="border: 1px solid #9ca3af;">${stats.roll_dia.max.toFixed(0)}</td>
                    <td style="border: 1px solid #9ca3af;">${stats.roll_dia.avg.toFixed(0)}</td>
                </tr>
                <tr style="height: 25px;">
                    <td style="font-weight: bold; border: 1px solid #9ca3af;">Thickness</td>
                    <td style="border: 1px solid #9ca3af;">${stats.thickness.min.toFixed(2)}</td>
                    <td style="border: 1px solid #9ca3af;">${stats.thickness.max.toFixed(2)}</td>
                    <td style="border: 1px solid #9ca3af;">${stats.thickness.avg.toFixed(2)}</td>
                </tr>
            </tbody>
        `;
        
        statsTable.innerHTML = html;
        
        // Add to summary table container
        let summaryTableContainer = document.getElementById('summaryTableContainer');
        if (!summaryTableContainer) {
            // Create summaryTableContainer if it doesn't exist
            const existingSummary = document.querySelector('#dynamicSummaryTableContainer')?.parentNode;
            summaryTableContainer = document.createElement('div');
            summaryTableContainer.id = 'summaryTableContainer';
            summaryTableContainer.style.display = 'flex';
            summaryTableContainer.style.justifyContent = 'center';
            summaryTableContainer.style.gap = '48px';
            summaryTableContainer.style.margin = '32px auto 0 auto';
            
            if (existingSummary) {
                const dynamicSummary = document.getElementById('dynamicSummaryTableContainer');
                if (dynamicSummary) {
                    existingSummary.replaceChild(summaryTableContainer, dynamicSummary);
                    summaryTableContainer.appendChild(dynamicSummary);
                }
            } else {
                document.body.appendChild(summaryTableContainer);
            }
        }
        
        // Add statistics table at the end (right side)
        if (summaryTableContainer && !summaryTableContainer.contains(statsTable)) {
            summaryTableContainer.appendChild(statsTable);
        }
    }

    // Render Production No Summary Table
    function renderProductionNoSummaryTable() {
        // Get the main Production No from the form header (only the first one, not production_no_2)
        const productionNoElement = document.getElementById('production_no');
        let mainProductionNo = '';
        
        if (productionNoElement && productionNoElement.textContent) {
            const fullText = productionNoElement.textContent.trim();
            // Split by comma and take only the first production number
            const productionNumbers = fullText.split(',').map(p => p.trim()).filter(p => p && p !== '[Production No.]');
            mainProductionNo = productionNumbers[0] || '';
        }
        
        // Extract additional Production Nos from remarks and track continuous process
        const productionNoData = {};
        const tables = tablesContainer.querySelectorAll('table');
        
        // Initialize with main Production No if it exists
        if (mainProductionNo && mainProductionNo !== '[Production No.]') {
            productionNoData[mainProductionNo] = { rolls: 0, totalKg: 0 };
        }
        
        // Process all tables sequentially to track Production No changes across the entire shift
        let currentProductionNo = mainProductionNo;
        let totalRollsProcessed = 0;
        
        // Process all tables in order (shift-wide continuous tracking)
        tables.forEach((table, tableIndex) => {
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            
            const rows = Array.from(tbody.rows);
            console.log(`Processing Table ${tableIndex + 1} with ${rows.length} rows, current Production No: ${currentProductionNo}`);
            
            // Process each row in the table
            rows.forEach((row, rowIndex) => {
                const cells = row.querySelectorAll('td[data-field]');
                let rollWeight = 0;
                let remarks = '';
                let productionNoChanged = false;
                
                // Check for Production No change in remarks first
                cells.forEach(cell => {
                    const field = cell.dataset.field;
                    if (!field) return;
                    
                    if (field === 'remarks') {
                        remarks = cell.textContent.trim();
                        // Look for Production No patterns in remarks
                        const patterns = [
                            /PRD:\s*([A-Z0-9]+)/i,           // PRD: UBS25PR026
                            /Production:\s*([A-Z0-9]+)/i,     // Production: UBS25PR026
                            /Prod:\s*([A-Z0-9]+)/i,          // Prod: UBS25PR026
                            /([A-Z]{2,3}\d{2}[A-Z]{2}\d{3})/ // Direct format like UBS25PR026
                        ];
                        
                        for (const pattern of patterns) {
                            const match = remarks.match(pattern);
                            if (match && match[1] !== currentProductionNo) {
                                console.log(`Production No changed from ${currentProductionNo} to ${match[1]} at Table ${tableIndex + 1}, Row ${rowIndex + 1}`);
                                currentProductionNo = match[1];
                                productionNoChanged = true;
                                break;
                            }
                        }
                    } else if (field === 'roll_weight') {
                        rollWeight = parseFloat(cell.textContent.trim()) || 0;
                    }
                });
                
                // Count roll for current Production No (if weight > 0)
                if (currentProductionNo && currentProductionNo !== '[Production No.]' && rollWeight > 0) {
                    if (!productionNoData[currentProductionNo]) {
                        productionNoData[currentProductionNo] = { rolls: 0, totalKg: 0 };
                    }
                    productionNoData[currentProductionNo].rolls++;
                    productionNoData[currentProductionNo].totalKg += rollWeight;
                    totalRollsProcessed++;
                    
                    console.log(`Added roll to ${currentProductionNo}: weight=${rollWeight}, total rolls=${productionNoData[currentProductionNo].rolls}, total kg=${productionNoData[currentProductionNo].totalKg.toFixed(2)}`);
                }
            });
        });
        
        console.log('Production No Summary - Total rolls processed:', totalRollsProcessed);
        console.log('Production No Data:', productionNoData);
        
        // Render the Production No summary table
        let productionNoTable = document.getElementById('productionNoSummaryTable');
        let summaryTableContainer = document.getElementById('summaryTableContainer');
        
        if (!productionNoTable) {
            productionNoTable = document.createElement('table');
            productionNoTable.id = 'productionNoSummaryTable';
            productionNoTable.className = 'min-w-[300px] w-auto text-xs text-center border-collapse border border-gray-700 bg-white';
        }
        
        let html = `
            <thead>
                <tr style="height: 30px;">
                    <th colspan="3" style="background-color: #f3f4f6; font-weight: bold; border: 1px solid #9ca3af;">Production No Summary</th>
                </tr>
                <tr style="height: 25px;">
                    <th style="width: 120px; border: 1px solid #9ca3af;">Production No</th>
                    <th style="width: 60px; border: 1px solid #9ca3af;">Rolls</th>
                    <th style="width: 80px; border: 1px solid #9ca3af;">Total KG</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        if (Object.keys(productionNoData).length === 0) {
            html += '<tr style="height: 25px;"><td colspan="3" style="border: 1px solid #9ca3af;">No Production No data found.</td></tr>';
        } else {
            Object.entries(productionNoData).forEach(([productionNo, data]) => {
                html += `
                    <tr style="height: 25px;">
                        <td style="border: 1px solid #9ca3af;">${productionNo}</td>
                        <td style="border: 1px solid #9ca3af;">${data.rolls}</td>
                        <td style="border: 1px solid #9ca3af;">${data.totalKg.toFixed(2)}</td>
                    </tr>
                `;
            });
        }
        
        html += '</tbody>';
        productionNoTable.innerHTML = html;
        
        // Add to summary table container
        if (summaryTableContainer && !summaryTableContainer.contains(productionNoTable)) {
            summaryTableContainer.appendChild(productionNoTable);
        }
    }
});
