import { supabase } from '../supabase-config.js';

// ===== TABLE ROUTING HELPER FUNCTION =====
function getTableNameForMachine(mcNo) {
    // Normalize mc_no to handle different formats (01, 1, MC01, etc.)
    let normalizedMcNo = mcNo?.toString().replace(/[^0-9]/g, '') || '';
    
    // Ensure it's 2 digits with leading zero
    if (normalizedMcNo.length === 1) {
        normalizedMcNo = '0' + normalizedMcNo;
    }
    
    // Route based on machine number
    if (normalizedMcNo === '01') return 'inline_inspection_form_master_1';
    if (normalizedMcNo === '02') return 'inline_inspection_form_master_2';
    if (normalizedMcNo === '03') return 'inline_inspection_form_master_3';
    
    // Default to table_2 for any other machine numbers
    return 'inline_inspection_form_master_2';
}

// Move this to the very top of the file
const tablesContainer = document.getElementById('tablesContainer');

// Global variables that need to be declared early
let addNewTableBtn = null;
let ipqcUpdateTimeout = null;
let qcInspectorsCache = [];

// ────────────────────────────────────────────────────────────────
// KEEP-ALIVE: Prevent session expiry during long form sessions
// Runs every 25 min - forces silent token refresh
// ────────────────────────────────────────────────────────────────
setInterval(async () => {
    try {
        await supabase.auth.getSession();  // Triggers refresh if needed
        console.log('Session ping: still active');  // Remove if you don't want logs
    } catch (err) {
        console.warn('Keep-alive failed:', err);
        // Optional: alert('Session issue - save work and refresh');
    }
}, 25 * 60 * 1000);  // 25 minutes

// Bonus: Listen for auth changes (add this too for better logout handling)
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
        alert('Session expired. Log in again.');
        window.location.href = 'inline-inspection-forms-list.html';  // Or your login page
    }
});

// ===== IST TIMESTAMP UTILITY =====
function getISTTimestamp() {
    return new Date().toISOString(); 
}

// ===== PRODUCT SPECIFICATIONS (OOS VALIDATION) =====
let currentProductSpecs = null;

async function fetchProductSpecs(prodCode) {
    try {
        if (!prodCode) return null;
        
        const { data: product, error } = await supabase
            .from('inline_products_master')
            .select('lsl_width, tgt_width, usl_width, lsl_weight, tgt_weight, usl_weight, lsl_gsm, tgt_gsm, usl_gsm, lsl_roll_dia, tgt_roll_dia, usl_roll_dia, lsl_thickness, tgt_thickness, usl_thickness, lsl_ct, tgt_ct, usl_ct, lsl_paper_core_id, tgt_paper_core_id, usl_paper_core_id, lsl_paper_core_od, tgt_paper_core_od, usl_paper_core_od')
            .eq('prod_code', prodCode)
            .single();
        
        if (error || !product) {
            console.warn('Product specs not found for:', prodCode);
            return null;
        }
        
        currentProductSpecs = {
            width: { lsl: product.lsl_width, tgt: product.tgt_width, usl: product.usl_width },
            weight: { lsl: product.lsl_weight, tgt: product.tgt_weight, usl: product.usl_weight },
            gsm: { lsl: product.lsl_gsm, tgt: product.tgt_gsm, usl: product.usl_gsm },
            rollDia: { lsl: product.lsl_roll_dia, tgt: product.tgt_roll_dia, usl: product.usl_roll_dia },
            thickness: { lsl: product.lsl_thickness, tgt: product.tgt_thickness, usl: product.usl_thickness },
            ct: { lsl: product.lsl_ct, tgt: product.tgt_ct, usl: product.usl_ct },
            paperCoreId: { lsl: product.lsl_paper_core_id, tgt: product.tgt_paper_core_id, usl: product.usl_paper_core_id },
            paperCoreOd: { lsl: product.lsl_paper_core_od, tgt: product.tgt_paper_core_od, usl: product.usl_paper_core_od }
        };
        
        return currentProductSpecs;
    } catch (error) {
        console.error('Error fetching product specs:', error);
        return null;
    }
}

// Check if value is within spec - returns null if no specs, true if in spec, false if OOS
function isWithinSpec(value, paramType) {
    if (!currentProductSpecs || !value) return null;
    
    const spec = currentProductSpecs[paramType];
    if (!spec || spec.lsl === null) return null;
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return null;
    
    return numValue >= spec.lsl && numValue <= spec.usl;
}

// Apply OOS styling to cell - ONLY RED for OOS, NO color otherwise
function applyOOSStyle(cell, paramType) {
    const value = cell.textContent.trim();
    const isInSpec = isWithinSpec(value, paramType);
    
    // Reset styling - remove ALL colors
    cell.style.color = '';
    cell.style.backgroundColor = '';
    cell.style.fontWeight = '';
    
    // ONLY apply red if value is OUT OF SPEC
    if (isInSpec === false) {
        cell.style.color = '#dc2626'; // Red text
        cell.style.backgroundColor = '#fee2e2'; // Light red background
        cell.style.fontWeight = 'bold';
    }
    // If in spec or no specs available - NO styling at all
}

// ===== CONSOLIDATED FIELD VALIDATION & FORMATTING =====
// Centralized validation for all field types
const fieldValidationRules = {
    'roll_weight': { allowDecimal: true, maxBeforeDecimal: 2, maxAfterDecimal: 2, maxTotal: 2 },
    'roll_width_mm': { allowDecimal: false, maxTotal: 3 },
    'film_weight_gsm': { allowDecimal: true, maxBeforeDecimal: 2, maxAfterDecimal: 1, maxTotal: 2 },
    'thickness': { allowDecimal: false, maxTotal: 2 },
    'roll_dia': { allowDecimal: false, maxTotal: 3 },
    'paper_core_dia_id': { allowDecimal: true, maxBeforeDecimal: 3, maxAfterDecimal: 1, maxTotal: 3 },
    'paper_core_dia_od': { allowDecimal: false, maxTotal: 3 },
    'hour': { allowDecimal: false, maxTotal: 2, maxValue: 23 },
    'minute': { allowDecimal: false, maxTotal: 2, maxValue: 59 },
    'lot_no': { allowDecimal: false, maxTotal: 2 },
    'roll_position': { allowDecimal: false, maxTotal: 2 },
    'arm': { type: 'letters', maxTotal: 1 },
    'glossy': { allowDecimal: true, maxBeforeDecimal: 2, maxAfterDecimal: 1, maxTotal: 2 },
    'lines_strips': { type: 'xo', maxTotal: 1 },
    'film_color': { type: 'xo', maxTotal: 1 },
    'pin_hole': { type: 'xo', maxTotal: 1 },
    'patch_mark': { type: 'xo', maxTotal: 1 },
    'odour': { type: 'xo', maxTotal: 1 },
    'ct_appearance': { type: 'ct', maxTotal: 3 },  // 2 letters (NA, OK) OR 2-3 digits (12, 100)
    'print_color': { type: 'xo', maxTotal: 1 },
    'mis_print': { type: 'xo', maxTotal: 1 },
    'dirty_print': { type: 'xo', maxTotal: 1 },
    'tape_test': { type: 'xo', maxTotal: 1 },
    'centralization': { type: 'xo', maxTotal: 1 },
    'wrinkles': { type: 'xo', maxTotal: 1 },
    'prs': { type: 'xo', maxTotal: 1 },
    'roll_curve': { type: 'xo', maxTotal: 1 },
    'core_misalignment': { type: 'xo', maxTotal: 1 },
    'others': { type: 'xo', maxTotal: 1 },
    'inspected_by': { type: 'letters', maxTotal: 50 }  // Only letters allowed, max 50 characters
};

// Validate and format field input
function validateFieldInput(text, field) {
    const rules = fieldValidationRules[field];
    if (!rules) return text; // No rules = allow as-is
    
    // Handle X/O fields
    if (rules.type === 'xo') {
        text = text.replace(/[^OXox]/g, '').toUpperCase();
        return text.substring(0, rules.maxTotal);
    }
    
    // Handle CT field (2 letters like "NA", "OK" OR 2-3 digits like "12", "100")
    if (rules.type === 'ct') {
        const isLetters = /^[A-Za-z]+$/.test(text);
        const isNumbers = /^[0-9]+$/.test(text);
        
        if (isLetters) {
            // Only letters - max 2
            text = text.replace(/[^A-Za-z]/g, '').toUpperCase();
            text = text.substring(0, 2);
        } else if (isNumbers) {
            // Only numbers - min 2, max 3
            text = text.replace(/[^0-9]/g, '');
            text = text.substring(0, 3);
        } else if (text === '') {
            // Empty is fine
            return '';
        } else {
            // Mixed letters and numbers - reject, clear
            return '';
        }
        
        return text;
    }
    
    // Handle alphanumeric fields (text + numbers)
    if (rules.type === 'alphanumeric') {
        text = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        return text.substring(0, rules.maxTotal);
    }
    
    // Handle letter fields (e.g., Arm - only A or B)
    if (rules.type === 'letters') {
        if (field === 'arm') {
            // Arm field: only allow A or B
            text = text.replace(/[^ABab]/g, '').toUpperCase();
        } else if (field === 'inspected_by') {
            // Inspected By field: allow letters and spaces for names (preserve case)
            text = text.replace(/[^A-Za-z\s]/g, '');
        } else {
            // Other letter fields: allow A-Z
            text = text.replace(/[^A-Za-z]/g, '').toUpperCase();
        }
        return text.substring(0, rules.maxTotal);
    }
    
    // Handle numeric/decimal fields
    if (rules.allowDecimal) {
        // Allow Glossy to be either numeric or single X/O
        if (field === 'glossy') {
            const cleanedXO = text.replace(/[^XOxo]/g, '').toUpperCase();
            const hasDigits = /[0-9]/.test(text);
            
            // If only X/O detected, return that (preserve existing X/O from DB)
            if (cleanedXO.length > 0 && !hasDigits) {
                return cleanedXO.substring(0, 1);
            }
            // Otherwise, process as normal decimal
        }
        text = text.replace(/[^0-9.]/g, '');
        
        // Ensure only one decimal point
        const parts = text.split('.');
        if (parts.length > 2) {
            text = parts[0] + '.' + parts.slice(1).join('');
        }
        
        // Format with decimal limits (APPLY LIMITS FIRST)
        if (parts.length === 2) {
            const beforeDecimal = parts[0].substring(0, rules.maxBeforeDecimal);
            const afterDecimal = parts[1].substring(0, rules.maxAfterDecimal);
            text = beforeDecimal + '.' + afterDecimal;
        } else {
            text = parts[0].substring(0, rules.maxBeforeDecimal);
        }
        
        // THEN remove leading zeros (except for decimal like 0.25)
        if (text.startsWith('0') && text.length > 1 && !text.startsWith('0.')) {
            text = text.substring(1);
        }
    } else {
        // Numeric only (no decimal)
        text = text.replace(/[^0-9]/g, '');
        
        // APPLY LIMITS FIRST
        text = text.substring(0, rules.maxTotal);
        
        // Apply max value constraint if exists (for hour, minute)
        if (rules.maxValue && text.length > 0) {
            const value = parseInt(text);
            if (value > rules.maxValue) {
                text = rules.maxValue.toString();
            }
        }
        
        // THEN remove leading zeros (BUT NOT FOR TIME FIELDS - hour, minute, lot_no, roll_position)
        const timeFields = ['hour', 'minute', 'lot_no', 'roll_position'];
        if (!timeFields.includes(field) && text.startsWith('0') && text.length > 1) {
            text = text.substring(1);
        }
    }
    
    return text;
}

// Check if field allows decimal point as first character
function allowsDecimalFirst(field) {
    const rules = fieldValidationRules[field];
    return rules && rules.allowDecimal ? false : false; // Never allow decimal as first char
}

// ===== CLOCK FUNCTIONALITY =====
let clockInterval = null;

// ===== PRODUCT SPECIFICATIONS FUNCTIONALITY =====
async function loadProductSpecs(prodCode) {
    try {
        if (!prodCode || prodCode === '[Prod. Code]' || prodCode.startsWith('[')) {
            clearProductSpecs();
            return;
        }
        
        // Clean product code (remove brackets if any)
        const cleanProdCode = prodCode.replace(/[\[\]]/g, '').trim();
        
        if (!cleanProdCode) {
            clearProductSpecs();
            return;
        }
        
        console.log('📦 Loading product specs for:', cleanProdCode);
        
        const { data: product, error } = await supabase
            .from('inline_products_master')
            .select('lsl_weight, tgt_weight, usl_weight, lsl_gsm, tgt_gsm, usl_gsm, lsl_roll_dia, tgt_roll_dia, usl_roll_dia, lsl_width, tgt_width, usl_width, lsl_thickness, tgt_thickness, usl_thickness')
            .eq('prod_code', cleanProdCode)
            .single();
        
        if (error) {
            console.warn('⚠️ Product not found:', cleanProdCode, error);
            clearProductSpecs();
            return;
        }
        
        if (!product) {
            console.warn('⚠️ No product data returned for:', cleanProdCode);
            clearProductSpecs();
            return;
        }
        
        // Populate product specs table with correct column names
        // Format roll weight to two decimal places when numeric (e.g., 13.50)
        document.getElementById('weight_lsl').textContent = (product.lsl_weight !== null && product.lsl_weight !== undefined && product.lsl_weight !== '') ? (isFinite(Number(product.lsl_weight)) ? parseFloat(product.lsl_weight).toFixed(2) : product.lsl_weight) : '-';
        document.getElementById('weight_tgt').textContent = (product.tgt_weight !== null && product.tgt_weight !== undefined && product.tgt_weight !== '') ? (isFinite(Number(product.tgt_weight)) ? parseFloat(product.tgt_weight).toFixed(2) : product.tgt_weight) : '-';
        document.getElementById('weight_usl').textContent = (product.usl_weight !== null && product.usl_weight !== undefined && product.usl_weight !== '') ? (isFinite(Number(product.usl_weight)) ? parseFloat(product.usl_weight).toFixed(2) : product.usl_weight) : '-';
        
        // GSM with 1 decimal place
        document.getElementById('gsm_lsl').textContent = product.lsl_gsm ? parseFloat(product.lsl_gsm).toFixed(1) : '-';
        document.getElementById('gsm_tgt').textContent = product.tgt_gsm ? parseFloat(product.tgt_gsm).toFixed(1) : '-';
        document.getElementById('gsm_usl').textContent = product.usl_gsm ? parseFloat(product.usl_gsm).toFixed(1) : '-';
        
        document.getElementById('rolldia_lsl').textContent = product.lsl_roll_dia || '-';
        document.getElementById('rolldia_tgt').textContent = product.tgt_roll_dia || '-';
        document.getElementById('rolldia_usl').textContent = product.usl_roll_dia || '-';
        
        document.getElementById('width_lsl').textContent = product.lsl_width || '-';
        document.getElementById('width_tgt').textContent = product.tgt_width || '-';
        document.getElementById('width_usl').textContent = product.usl_width || '-';
        
        document.getElementById('thickness_lsl').textContent = product.lsl_thickness || '-';
        document.getElementById('thickness_tgt').textContent = product.tgt_thickness || '-';
        document.getElementById('thickness_usl').textContent = product.usl_thickness || '-';
        
        console.log('✅ Product specs loaded successfully');
    } catch (error) {
        console.error('❌ Error loading product specs:', error);
        clearProductSpecs();
    }
}

function clearProductSpecs() {
    const specs = ['weight', 'gsm', 'rolldia', 'width', 'thickness'];
    specs.forEach(spec => {
        document.getElementById(`${spec}_lsl`).textContent = '-';
        document.getElementById(`${spec}_tgt`).textContent = '-';
        document.getElementById(`${spec}_usl`).textContent = '-';
    });
}

// ===== TEAM MEMBERS FUNCTIONALITY (Replaced with Product Specs) =====
function populateTeamMembers(formData) {
    try {
        // Load product specifications based on prod_code from form data
        let prodCode = formData.prod_code;
        
        // If prod_code is a placeholder or empty, try to get it from the page
        if (!prodCode || prodCode === '[Prod. Code]' || prodCode.startsWith('[')) {
            const prodCodeElement = document.getElementById('prod_code');
            if (prodCodeElement) {
                prodCode = prodCodeElement.textContent.trim();
            }
        }
        
        // Load the product specs if we have a valid product code
        if (prodCode && prodCode !== '[Prod. Code]') {
            loadProductSpecs(prodCode);
        } else {
            clearProductSpecs();
        }
    } catch (error) {
        console.error('❌ Error in populateTeamMembers:', error);
        clearProductSpecs();
    }
}

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
        
        // Clock started successfully
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
        // Clock stopped successfully
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
            // Try to refresh the session first
            console.log('User not found, attempting session refresh...');
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError || !refreshData.user) {
                console.log('Session refresh failed, redirecting to login');
                // Prevent multiple redirects
                if (!window.redirectingToAuth) {
                    window.redirectingToAuth = true;
                    window.location.replace('auth.html');
                }
                return false;
            }
            
            console.log('Session refreshed successfully');
            lastSessionCheck = Date.now();
            return true;
        }
        lastSessionCheck = Date.now();
        return true;
    } catch (error) {
        console.error('Session validation error:', error);
        // Prevent multiple redirects
        if (!window.redirectingToAuth) {
            window.redirectingToAuth = true;
            window.location.replace('auth.html');
        }
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
    }, 10 * 60 * 1000); // Check every 10 minutes
    
    intervals.add(sessionCheckInterval);
}

// Extra Safety: Session keep-alive to prevent edge cases with longer expiry
// In your DOMContentLoaded or init function
setInterval(async () => {
    try {
        await supabase.auth.getSession();  // Triggers silent refresh if needed
        console.log('Session ping: still active');
    } catch (err) {
        console.warn('Session ping failed:', err);
    }
}, 25 * 60 * 1000);  // Every 25 minutes

// Also add listener for better UX:
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
        alert('Your session has expired. Please log in again to continue.');
        window.location.href = 'auth.html';  // Adjust to your login route
    }
});

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
    <th rowspan="2" class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Lot No.</th>
    <th rowspan="2" class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Roll Position</th>
    <th rowspan="2" class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Arm</th>
    <th rowspan="2" class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:40px; min-width:40px; max-width:40px; font-size: 11px;">
        Roll Weight
        <span style="display: inline-block; transform: rotate(-180deg); writing-mode: initial;">
            <input type="checkbox" id="rollWeightLock" style="vertical-align: middle; margin-left: 4px; margin-bottom: 40px;">
            <span style="font-size: 16px; vertical-align: top; margin-left: 2px;">🔒</span>
        </span>
    </th>
    <th rowspan="2" class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:35px; min-width:35px; max-width:35px; font-size: 11px;">Roll Width (mm)</th>
    <th rowspan="2" class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:35px; min-width:35px; max-width:35px; font-size: 11px;">Film Weight (GSM)</th>
    <th rowspan="2" class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:35px; min-width:35px; max-width:35px; font-size: 11px;">Thickness</th>
    <th rowspan="2" class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:35px; min-width:35px; max-width:35px; font-size: 11px;">
        Roll θ
        <span style="display: inline-block; transform: rotate(-180deg); writing-mode: initial;">
            <input type="checkbox" id="rollThetaLock" style="vertical-align: middle; margin-left: 4px; margin-bottom: 80px;">
            <span style="font-size: 16px; vertical-align: top; margin-left: 2px;">🔒</span>
        </span>
    </th>
    <th colspan="2" class="border border-gray-300 px-1 py-0.5" style="font-size: 11px;">Paper Core θ</th>
    <th colspan="7" class="border border-gray-300 px-1 py-0.5" style="font-size: 11px;">Film Appearance</th>
    <th colspan="5" class="border border-gray-300 px-1 py-0.5" style="font-size: 11px;">Printing</th>
    <th colspan="4" class="border border-gray-300 px-1 py-0.5" style="font-size: 11px;">Roll Appearance</th>
    <th rowspan="2" class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:28px; min-width:28px; max-width:28px; font-size: 11px;">Others</th>
    <th rowspan="2" class="border border-gray-300 px-1 py-0.5" style="width:45px; min-width:45px; max-width:45px; font-size: 11px;">Accept / Reject</th>
    <th rowspan="2" class="border border-gray-300 px-1 py-0.5" style="width:80px; min-width:80px; max-width:80px; font-size: 11px;">Defect Name</th>
    <th rowspan="2" class="border border-gray-300 px-1 py-0.5" style="width:80px; min-width:80px; max-width:80px; font-size: 11px;">PI Changed</th>
    <th rowspan="2" class="border border-gray-300 px-1 py-0.5" style="width:80px; min-width:80px; max-width:80px; font-size: 11px;">Inspected By</th>
</tr>
<tr>
    <th class="border border-gray-300 px-1 py-0.5" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Hr.</th>
    <th class="border border-gray-300 px-1 py-0.5" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Min.</th>
    <th class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Paper Core θ (ID)</th>
    <th class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Paper Core θ (OD)</th>
    <th class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Lines/Strips</th>
    <th class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Glossy</th>
    <th class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Film Color</th>
    <th class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Pin Hole</th>
    <th class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Patch Mark</th>
    <th class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Odour</th>
    <th class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">CT</th>
    <th class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Print Color</th>
    <th class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Mis Print</th>
    <th class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Dirty Print</th>
    <th class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Tape Test</th>
    <th class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Centralization</th>
    <th class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Wrinkles</th>
    <th class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">PRS</th>
    <th class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Roll Curve</th>
    <th class="border border-gray-300 px-1 py-0.5 vertical-header" style="width:25px; min-width:25px; max-width:25px; font-size: 11px;">Core Misalignment</th>
</tr>
</thead>
`;

document.addEventListener('DOMContentLoaded', async function() {
    // Start session monitoring
    startSessionMonitoring();
    
    // Start the clock
    startClock();
    
    // ===== SESSION RESTORATION =====
    // Try to restore session from storage if not already authenticated
    try {
        const storedSession = localStorage.getItem('supabase.auth.session') || sessionStorage.getItem('supabase.auth.session');
        if (storedSession) {
            const sessionData = JSON.parse(storedSession);
            if (sessionData && sessionData.access_token) {
                // Set the session in Supabase client
                await supabase.auth.setSession({
                    access_token: sessionData.access_token,
                    refresh_token: sessionData.refresh_token
                });
                console.log('Session restored from storage');
            }
        }
    } catch (error) {
        console.warn('Failed to restore session from storage:', error);
        // Clear invalid session data
        localStorage.removeItem('supabase.auth.session');
        sessionStorage.removeItem('supabase.auth.session');
    }
    
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

    // Add process scrap tracking
    let processScrapValue = '';
    const scrapStorageKey = `scrap_${traceabilityCode}_${lotLetter}`;
    
    // Initial load from localStorage as fallback
    const savedScrap = localStorage.getItem(scrapStorageKey);
    if (savedScrap !== null && savedScrap !== '') {
        processScrapValue = parseFloat(savedScrap).toFixed(2);
    } else {
        processScrapValue = '';
    }
    // If in view mode, disable all editing functionality
    if (viewMode) {
        // Add view-only indicator immediately
        const viewOnlyIndicator = document.createElement('div');
        viewOnlyIndicator.id = 'viewOnlyIndicator';
        viewOnlyIndicator.className = 'fixed top-12 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-3 py-1.5 rounded-md shadow-lg z-50 text-center';
        viewOnlyIndicator.innerHTML = `
            <div class="flex items-center gap-1.5 text-xs">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                </svg>
                <span class="font-semibold">READ-ONLY MODE</span>
            </div>
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
            // Load all lots for this traceability_code from all machine tables
            const tables = ['inline_inspection_form_master_1', 'inline_inspection_form_master_2', 'inline_inspection_form_master_3'];
            let allLots = [];
            
            for (const tableName of tables) {
                const { data: lots, error } = await supabase
                    .from(tableName)
                    .select('*')
                    .eq('traceability_code', traceabilityCode)
                    .eq('lot_letter', lotLetter)
                    .order('created_at', { ascending: true });
                
                if (error) {
                    console.error(`Error loading from ${tableName}:`, error);
                    continue;
                }
                
                if (lots && lots.length > 0) {
                    allLots = allLots.concat(lots);
                }
            }
            
            if (allLots.length > 0) {
                    // Use the oldest lot for header section
                    const formData = allLots[0];
                    
                    // Update processScrapValue from DB if available
                    if (formData.process_scrap !== undefined && formData.process_scrap !== null) {
                        // Store as string with 2 decimals to preserve trailing zeros like .60
                        processScrapValue = parseFloat(formData.process_scrap).toFixed(2);
                        // Sync back to localStorage for consistency
                        localStorage.setItem(scrapStorageKey, processScrapValue);
                    } else {
                        // If it's null or undefined, keep it blank
                        processScrapValue = '';
                        localStorage.setItem(scrapStorageKey, '');
                    }
                
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
                                // Auto-saving production_no_2 - need to find the correct table
                                const mcNo = formData.mc_no;
                                const tableName = getTableNameForMachine(mcNo);
                                
                                const { error } = await supabase
                                    .from(tableName)
                                    .update({ production_no_2: newValue })
                                    .eq('traceability_code', traceabilityCode)
                                    .eq('lot_letter', lotLetter);
                                
                                if (error) {
                                    console.error('Error auto-saving production_no_2:', error);
                                } else {
                                    // production_no_2 auto-saved successfully
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
                // Form type detected
                document.getElementById('year').textContent = formData.year || '[Year]';
                document.getElementById('month').textContent = formData.month || '[Month]';
                document.getElementById('date').textContent = formData.date || '[Date]';
                document.getElementById('mc_no').textContent = formData.mc_no || '[M/C No.]';
                document.getElementById('shift').textContent = formData.shift || '[Shift]';
                
                // Populate team members data
                populateTeamMembers(formData);
                
                // ===== FETCH PRODUCT SPECIFICATIONS FOR OOS VALIDATION =====
                const prodCode = formData.prod_code;
                if (prodCode && prodCode !== '[Prod. Code]') {
                    await fetchProductSpecs(prodCode);
                }
                
                // Data loading is now handled by loadAllLots() function
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error loading form: ' + error.message);
        }
    }

    // Submit button removed per user request
    
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
                
                // Disable all input fields except form type checkboxes (keep them visible in view mode)
                const inputFields = document.querySelectorAll('input');
                inputFields.forEach(input => {
                    // Keep form type checkboxes enabled and visible in view mode
                    if (input.id === 'printed' || input.id === 'non_printed' || input.id === 'ct') {
                        input.disabled = false;
                        input.style.opacity = '1';
                        input.style.pointerEvents = 'none'; // Prevent interaction but keep visible
                    } else {
                        input.disabled = true;
                    }
                });
                
                // Disable all buttons except back button
                const buttons = document.querySelectorAll('button');
                buttons.forEach(button => {
                    if (!button.classList.contains('header-back-button')) {
                        button.disabled = true;
                    }
                });
                
                        // View mode: Disabled all interactive elements
                
                // Apply color coding for X/O values in view mode
                // View mode: Applying color coding for X/O values
                
                // Optimized color coding for view mode - single pass through all tables
                const tables = document.querySelectorAll('table');
                const inspectionFields = [
                    'lines_strips', 'glossy', 'film_color', 'pin_hole', 'patch_mark', 'odour',
                    'ct_appearance', 'print_color', 'mis_print', 'dirty_print', 'tape_test', 'centralization',
                    'wrinkles', 'prs', 'roll_curve', 'core_misalignment', 'others'
                ];
                
                tables.forEach(table => {
                    const tbody = table.querySelector('tbody');
                    if (!tbody) return;
                    
                    const rows = tbody.rows;
                    for (let r = 0; r < rows.length; r++) {
                        const row = rows[r];
                        const cells = row.querySelectorAll('td[data-field]');
                        
                        cells.forEach(cell => {
                            const fieldName = cell.dataset.field;
                            
                            // Apply X/O color coding to inspection fields
                            if (inspectionFields.includes(fieldName)) {
                                applyXOColorCoding(cell);
                            }
                            
                            // Apply Accept/Reject color coding
                            if (fieldName === 'accept_reject') {
                                const select = cell.querySelector('select');
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
                                    
                                    if (bgColor) {
                                        cell.style.backgroundColor = bgColor;
                                        cell.style.color = fgColor;
                                        select.style.backgroundColor = bgColor;
                                        select.style.color = fgColor;
                                        
                                        // Also apply to Roll Position cell in same row
                                        const rollPosCell = row.querySelector('td[data-field="roll_position"]');
                                        if (rollPosCell) {
                                            rollPosCell.style.backgroundColor = bgColor;
                                            rollPosCell.style.color = fgColor;
                                        }
                                    }
                                }
                            }
                        });
                    }
                });
                
                // View mode: Color coding applied
            }, 100); // Reduced delay for better performance
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

    function createCell(contentEditable = true, rowspan = 1, isDropdown = false, colIndex = null, isFirstRow = false, rowIndex = 0) {
        const td = document.createElement('td');
        td.className = 'border border-gray-300 px-0.5 py-0.5';
        td.style.fontSize = '11px';
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
                // Pre-filled NA in column
            }
        }
        
        // Special handling for "Inspected By" column (32) - only first and second rows should be editable
        if (colIndex === 32 && !isFirstRow) {
            // Allow editing in first row (rowIndex = 0) and second row (rowIndex = 1)
            if (rowIndex !== 1) {
                contentEditable = false;
                // No gray styling - keep it looking normal but uneditable
            }
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
                    // console.log('Select change blocked - in view mode');
                    e.preventDefault();
                    return;
                }
                
                const table = select.closest('table');
                const formId = table?.dataset?.formId;
                const allTables = Array.from(document.querySelectorAll('#tablesContainer table'));
                const tableIndex = allTables.indexOf(table);
                // Cell change event in table
                
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
                    
                    // Clear defect name when changed to default (empty)
                    const defectNameCell = row ? row.querySelector('td[data-field="defect_name"]') : null;
                    if (defectNameCell) {
                        defectNameCell.textContent = '';
                        defectNameCell.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    
                    // Update summary table immediately
                    updateSummaryTable();
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
                    
                                            // Auto-cleared defect name and changed X to O for Accept status (remarks preserved)
                }
                
                // Save the Accept/Reject selection to database immediately
                setTimeout(() => {
                    saveLotTableToSupabase(table);
                    // Also update summary table after save
                    updateSummaryTable();
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
                    e.preventDefault();
                    return;
                }
                
                const table = td.closest('table');
                const formId = table?.dataset?.formId;
                const allTables = Array.from(document.querySelectorAll('#tablesContainer table'));
                const tableIndex = allTables.indexOf(table);
                
                const field = td.dataset.field;
                let text = td.textContent;
                
                // ===== USE CONSOLIDATED VALIDATION =====
                text = validateFieldInput(text, field);
                
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
                
                // ===== APPLY REAL-TIME OOS VALIDATION (INSTANTLY WHILE TYPING) =====
                const oosMappings = {
                    'roll_weight': 'weight',
                    'roll_width_mm': 'width',
                    'film_weight_gsm': 'gsm',
                    'roll_dia': 'rollDia',
                    'thickness': 'thickness',
                    'ct_appearance': 'ct',
                    'paper_core_dia_id': 'paperCoreId',
                    'paper_core_dia_od': 'paperCoreOd'
                };
                
                if (field in oosMappings && text.trim() !== '') {
                    applyOOSStyle(td, oosMappings[field]);  // Real-time validation while typing
                } else if (field in oosMappings && text.trim() === '') {
                    // Clear OOS styling if value is cleared
                    td.style.color = '';
                    td.style.backgroundColor = '';
                    td.style.fontWeight = '';
                }
                
                updateSummaryTable();
            });
            
            // ===== PREVENT INVALID CHARACTERS ON KEYPRESS =====
            td.addEventListener('keypress', function(e) {
                if (viewMode) {
                    e.preventDefault();
                    return;
                }
                
                const field = td.dataset.field;
                const rules = fieldValidationRules[field];
                if (!rules || !rules.allowDecimal) return;
                
                // Block decimal point if field is empty or already has decimal
                if (e.key === '.') {
                    const currentText = td.textContent.trim();
                    
                    if (currentText === '' || currentText.includes('.')) {
                        e.preventDefault();
                    }
                }
            });
            
            // Also capitalize when user finishes typing (blur event)
            td.addEventListener('blur', function(e) {
                if (viewMode) {
                    // console.log('Blur blocked - in view mode');
                    return;
                }
                
                const table = td.closest('table');
                const formId = table?.dataset?.formId;
                const allTables = Array.from(document.querySelectorAll('#tablesContainer table'));
                const tableIndex = allTables.indexOf(table);
                // Cell blur event in table
                let text = td.textContent;
                const capitalizedText = capitalizeText(text);
                
                if (text !== capitalizedText) {
                    td.textContent = capitalizedText;
                    text = capitalizedText;
                }
                
                // ===== VALIDATE & REJECT INVALID VALUES =====
                const field = td.dataset.field;
                const numericFields = ['roll_weight', 'roll_width_mm', 'film_weight_gsm', 'thickness', 'roll_dia', 'paper_core_dia_id', 'paper_core_dia_od', 'hour', 'minute', 'lot_no', 'roll_position'];
                
                if (numericFields.includes(field)) {
                    // For numeric fields, reject if:
                    // - Only contains decimal point(s)
                    // - Only contains whitespace
                    // - Empty
                    const cleanedValue = text.replace(/[^0-9]/g, ''); // Remove all non-numeric chars
                    
                    if (!cleanedValue || cleanedValue.length === 0) {
                        // Clear the cell if only decimal or invalid
                        td.textContent = '';
                        text = '';
                    }
                }
                
                // Apply color coding for X/O values
                applyXOColorCoding(td);
                
                // ===== RE-APPLY OOS VALIDATION AFTER BLUR TO PRESERVE STYLING =====
                const oosMappings = {
                    'roll_weight': 'weight',
                    'roll_width_mm': 'width',
                    'film_weight_gsm': 'gsm',
                    'roll_dia': 'rollDia',
                    'thickness': 'thickness',
                    'ct_appearance': 'ct',
                    'paper_core_dia_id': 'paperCoreId',
                    'paper_core_dia_od': 'paperCoreOd'
                };
                
                if (field in oosMappings && text.trim() !== '') {
                    applyOOSStyle(td, oosMappings[field]);  // Preserve OOS styling after blur
                } else if (field in oosMappings && text.trim() === '') {
                    // Clear OOS styling if value is cleared
                    td.style.color = '';
                    td.style.backgroundColor = '';
                    td.style.fontWeight = '';
                }
                
                applyColorCodingToTable();
                updateSummaryTable();
                
                // ===== SAVE LOT_NO WHEN EDITED =====
                if (field === 'lot_no') {
                    const table = td.closest('table');
                    if (table) {
                        setTimeout(() => {
                            saveLotToSupabase(table);
                        }, 100);
                    }
                }
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
            const rowIndex = tbody.rows.length; // Current row index
                for (let col = 0; col < totalColumns; col++) {
                const td = createCell(true, 1, col === dropdownIndex, col, isFirstRow, rowIndex);
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
        // Update Add Rows button state after clearing rows
        updateAddRowsButtonState();
    }
    
    // ===== INSPECTED BY ROW FUNCTION =====


    // ===== DEBOUNCED SAVE FUNCTION =====
    let saveTimeout = null;
    
    function debouncedSave(table) {
        if (viewMode) {
            // console.log('Save blocked - in view mode');
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
            // console.log('Save blocked - in view mode');
            return;
        }
        
        if (!table || !table.dataset || !table.dataset.formId) {
            console.warn('saveLotToSupabase: No table or formId provided!', table);
            return;
        }
        const formId = table.dataset.formId;
        
        // Get mc_no to determine the correct table
        const mcNoElement = document.getElementById('mc_no');
        const mcNo = mcNoElement ? mcNoElement.textContent.trim() : '';
        const tableName = getTableNameForMachine(mcNo);
        
        // Determine table index for main row check
        const allTables = Array.from(document.querySelectorAll('#tablesContainer table'));
        const tableIndex = allTables.indexOf(table);
        
        let sampleCell = '';
        try {
            sampleCell = table.querySelector('tbody tr td')?.textContent || '';
        } catch (e) {}
        // saveLotToSupabase debug info
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
        let lotNo = '';
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
                } else if (fieldName === 'inspected_by' && i === 1) {
                    // For second row, combine with first row
                    if (value && value.trim()) {
                        inspectedBy = inspectedBy ? `${inspectedBy}, ${value}` : value;
                    }
                } else if (fieldName === 'arm' && i === 0) {
                    armValue = value;
                } else if (fieldName === 'lot_no' && i === 0) {
                    lotNo = value;
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
        
        // Saving to individual JSONB columns
        
        // Update row in Supabase with individual JSONB columns
        const { error } = await supabase
            .from(tableName)
            .update({ 
                lot_no: lotNo,
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
                // Only update process_scrap in the main row of the form (tableIndex 0)
                // We use NULL if empty to distinguish from explicit 0
                ...(tableIndex === 0 ? { process_scrap: processScrapValue === '' ? null : Number(processScrapValue) } : {}),
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
            .eq('form_id', formId)
            .eq('traceability_code', traceabilityCode)
            .eq('lot_letter', lotLetter);
        if (error) {
            console.error(`Error saving lot (Index: ${tableIndex}) to ${tableName}:`, error);
            alert('Error saving lot: ' + error.message);
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
            // console.log('Save blocked - in view mode');
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
            // console.log('Save blocked - in view mode');
            return;
        }
        
        // This is now deprecated - use saveLotToSupabase instead
        // console.log('Table save is deprecated. Use saveLotToSupabase instead.');
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
        
        // In view mode, also apply X/O color coding to preserve it
        if (viewMode) {
            const inspectionFields = [
                'lines_strips', 'glossy', 'film_color', 'pin_hole', 'patch_mark', 'odour',
                'ct_appearance', 'print_color', 'mis_print', 'dirty_print', 'tape_test', 'centralization',
                'wrinkles', 'prs', 'roll_curve', 'core_misalignment', 'others'
            ];
            
            const cells = tbody.querySelectorAll('td[data-field]');
            cells.forEach(cell => {
                const fieldName = cell.dataset.field;
                if (inspectionFields.includes(fieldName)) {
                    applyXOColorCoding(cell);
                }
            });
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
                // Clear OOS styling when cell is cleared
                fieldCell.style.color = '';
                fieldCell.style.backgroundColor = '';
                fieldCell.style.fontWeight = '';
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
                    // Clear OOS styling when cell is cleared
                    fieldCell.style.color = '';
                    fieldCell.style.backgroundColor = '';
                    fieldCell.style.fontWeight = '';
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
            'prs': 'PRS',
            'glossy': 'Glossy',
            'patch_mark': 'Patch Mark',
            'odour': 'Odd Smell',
            'tape_test': 'Tape Test Failure',
            'centralization': 'Print Position OOS',
            'print_color': 'Print Colour OOS'
        };

        if (xFieldName === 'film_color') {
            // Show opacity-related defect suggestions when Film Color has X
            showDefectAutocomplete(defectNameCell, 'opacity');
            return;
        }

        if (xFieldName === 'roll_curve') {
            // Offer specific roll curve defect options
            showRollCurveDefectOptions(defectNameCell);
            return;
        }
        
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

    function showRollCurveDefectOptions(defectNameCell) {
        const options = ['Edge Curve', 'Concave / Convex'];
        showDefectDropdown(defectNameCell, options);
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
                // console.log('Form type updated from UI - Non-printed:', isNonPrintedForm);
            }
        }
        // console.log('Add Rows clicked - Current isNonPrintedForm:', isNonPrintedForm);
        const n = parseInt(numRowsInput.value, 10) || 1;
        addRows(n);
        afterTableStructureChange();
        // Ensure first table has lot number "01"
        ensureFirstTableHasLotNumber();
        // Update Add Next Lot button state
        if (addNewTableBtn) {
            updateAddNextLotButtonState();
        }
        // Update Add Rows button state after adding rows
        updateAddRowsButtonState();
        // Only save if we're not loading data and have a traceability_code
        if (traceabilityCode && !window.isLoadingData) {
            try {
                // Save new rows as JSONB lot data
                // console.log('Adding', n, 'new rows');
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
            // console.log('Tables found for saving:', tables);
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
    // Add this function to calculate summary data
    function calculateSummaryData() {
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

        return {
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
        };
    }

    // Add this function to render the summary table dynamically
    function renderSummaryTable(summary) {
        const container = document.getElementById('dynamicSummaryTableContainer');
        if (!container) return;

        // Calculate Yield
        const totalWeight = parseFloat(summary.totalWeight);
        const acceptedWeight = parseFloat(summary.acceptedWeight);
        const scrap = parseFloat(processScrapValue) || 0;
        
        const totalInputWeight = totalWeight + scrap;
        const yieldPercent = totalInputWeight > 0 
            ? ((acceptedWeight / totalInputWeight) * 100).toFixed(2) 
            : '0.00';

        container.innerHTML = `
            <table class="min-w-[400px] w-auto text-xs text-center border-collapse border border-gray-700 bg-white">
                <tbody>
                    <tr style="height: 30px;"><td style="border: 1px solid #9ca3af;">Accepted Rolls</td><td style="border: 1px solid #9ca3af;">${summary.acceptedCount} Rolls</td><td style="border: 1px solid #9ca3af;">${summary.acceptedWeight} KG</td></tr>
                    <tr style="height: 30px;"><td style="border: 1px solid #9ca3af;">Rejected Rolls</td><td style="border: 1px solid #9ca3af;">${summary.rejectedCount} Rolls</td><td style="border: 1px solid #9ca3af;">${summary.rejectedWeight} KG</td></tr>
                    <tr style="height: 30px;"><td style="border: 1px solid #9ca3af;">Rolls Rejected for Rework</td><td style="border: 1px solid #9ca3af;">${summary.reworkCount} Rolls</td><td style="border: 1px solid #9ca3af;">${summary.reworkWeight} KG</td></tr>
                    <tr style="height: 30px;"><td style="border: 1px solid #9ca3af;">KIV Rolls</td><td style="border: 1px solid #9ca3af;">${summary.kivCount} Rolls</td><td style="border: 1px solid #9ca3af;">${summary.kivWeight} KG</td></tr>
                    <tr style="height: 30px;"><td style="border: 1px solid #9ca3af;"><b>Total Produced</b></td><td style="border: 1px solid #9ca3af;">${summary.totalCount} Rolls</td><td style="border: 1px solid #9ca3af;">${summary.totalWeight} KG</td></tr>
                    <tr style="height: 30px; background-color: #fefce8;"><td style="border: 1px solid #9ca3af;"><b>Process Scrap</b></td><td style="border: 1px solid #9ca3af;">-</td><td style="border: 1px solid #9ca3af; font-weight: bold;"><span id="processScrapInput" contenteditable="${!viewMode}" style="display: inline-block; min-width: 40px; outline: none;">${processScrapValue || ''}</span> <span contenteditable="false" style="color: black; margin-left: 4px;">KG</span></td></tr>
                    <tr style="height: 30px; background-color: #f0fdf4; font-weight: bold;"><td style="border: 1px solid #9ca3af;">Production Yield</td><td colspan="2" style="border: 1px solid #9ca3af; color: #166534;" id="yieldDisplayCell">${yieldPercent}%</td></tr>
                </tbody>
            </table>
        `;

        // Add event listener to the scrap input
        const scrapInput = document.getElementById('processScrapInput');
        if (scrapInput && !viewMode) {
            scrapInput.addEventListener('input', (e) => {
                processScrapValue = e.target.textContent.trim();
                
                // Save to localStorage
                if (scrapStorageKey) {
                    localStorage.setItem(scrapStorageKey, processScrapValue);
                }
                // Update yield without full re-render to preserve focus
                updateYieldInTable();
            });

            // Trigger DB save on blur
            scrapInput.addEventListener('blur', async (e) => {
                let numericValue = e.target.textContent.trim();
                
                if (numericValue !== '') {
                    // Only format if there's a value (including 0)
                    const formattedValue = parseFloat(numericValue).toFixed(2);
                    e.target.textContent = formattedValue;
                    processScrapValue = formattedValue;
                } else {
                    // Keep it blank if empty
                    e.target.textContent = '';
                    processScrapValue = '';
                }
                
                const tables = Array.from(document.querySelectorAll('#tablesContainer table'));
                if (tables.length > 0) {
                    await saveLotToSupabase(tables[0]);
                }
            });

            // Prevent new lines in contenteditable
            scrapInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    scrapInput.blur();
                }
            });
        }
    }

    function updateYieldInTable() {
        const yieldDisplayCell = document.getElementById('yieldDisplayCell');
        if (!yieldDisplayCell) return;
        
        const summary = calculateSummaryData();
        const totalWeight = parseFloat(summary.totalWeight);
        const acceptedWeight = parseFloat(summary.acceptedWeight);
        const scrap = parseFloat(processScrapValue) || 0;
        
        const totalInputWeight = totalWeight + scrap;
        const yieldPercent = totalInputWeight > 0 
            ? ((acceptedWeight / totalInputWeight) * 100).toFixed(2) 
            : '0.00';
            
        yieldDisplayCell.textContent = `${yieldPercent}%`;
    }

    // Update updateSummaryTable to use renderSummaryTable
    function updateSummaryTable() {
        const summary = calculateSummaryData();
        renderSummaryTable(summary);
        
        // Update ALL summary tables
        renderDefectsSummaryTable();
        renderProductionNoSummaryTable();
        renderIPQCDefectsTable();
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
    updateDeleteButtonVisibility(); // Initialize delete button visibility
    updateAddRowsButtonState(); // Initialize Add Rows button state
    
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
                        tr.appendChild(createCell(true, 1, false, col, isFirstRow, i));
                    } else if (mergedIndices.includes(col)) {
                        tr.appendChild(createCell(true, n, false, col, isFirstRow, i));
                    } else if (col === 3) {
                        const td = createCell(true, 1, false, col, isFirstRow, i);
                        td.textContent = '1';
                        tr.appendChild(td);
                    } else if (col === dropdownIndex) {
                        tr.appendChild(createCell(false, 1, true, col, isFirstRow, i));
                    } else if (col > 4 && col < 31 && col !== dropdownIndex) {
                        tr.appendChild(createCell(true, 1, false, col, isFirstRow, i));
                    }
                }
            } else {
                // Subsequent rows: skip merged cells
                for (let col = 0; col < totalColumns; col++) {
                    if (col === 31 || col === 32) {
                        tr.appendChild(createCell(true, 1, false, col, isFirstRow, i));
                    } else if (col === 3) {
                        const td = createCell(true, 1, false, col, isFirstRow, i);
                        td.textContent = (i + 1).toString();
                        tr.appendChild(td);
                    } else if (col === dropdownIndex) {
                        tr.appendChild(createCell(false, 1, true, col, isFirstRow, i));
                    } else if (!mergedIndices.includes(col) && col > 4 && col < 31 && col !== dropdownIndex) {
                        tr.appendChild(createCell(true, 1, false, col, isFirstRow, i));
                    }
                }
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        return table;
    }

    // ===== DUPLICATE LOT NUMBER DETECTION =====
    async function checkForDuplicateLotNumber(traceabilityCode, lotLetter, lotNumber) {
        try {
            // Get the correct table name from the current form
            const mcNoElement = document.getElementById('mc_no');
            const mcNo = mcNoElement ? mcNoElement.textContent.trim() : '02';
            const tableName = getTableNameForMachine(mcNo);

            // Only check the current table (not all three tables) to avoid slow queries
            const { data: existingLots, error } = await supabase
                .from(tableName)
                .select('id, form_id, lot_no, created_at, status')
                .eq('traceability_code', traceabilityCode)
                .eq('lot_letter', lotLetter)
                .eq('lot_no', lotNumber);

            if (error) {
                console.error(`Error checking for duplicate lot numbers:`, error);
                return { hasDuplicates: false, duplicates: [] };
            }

            // Check if any duplicates were found
            if (existingLots && existingLots.length > 0) {
                return {
                    hasDuplicates: true,
                    duplicates: existingLots,
                    message: `⚠️ DUPLICATE LOT DETECTED!\n\nLot Number: ${lotNumber}\nTraceability Code: ${traceabilityCode}\nLot Letter: ${lotLetter}\n\nFound ${existingLots.length} existing record(s) with the same lot number.\n\nThis could cause data conflicts. Please verify before proceeding.`
                };
            }

            return { hasDuplicates: false, duplicates: [] };
        } catch (error) {
            console.error('Error in duplicate lot number check:', error);
            return { hasDuplicates: false, duplicates: [] };
        }
    }

    // Function to show duplicate warning modal
    function showDuplicateWarningModal(duplicateInfo) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-family: Arial, sans-serif;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 10px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        `;
        
        const title = document.createElement('h2');
        title.textContent = '🚨 DUPLICATE LOT NUMBER WARNING';
        title.style.cssText = `
            color: #d32f2f;
            margin: 0 0 20px 0;
            font-size: 18px;
            font-weight: bold;
        `;
        
        const message = document.createElement('div');
        message.innerHTML = duplicateInfo.message.replace(/\n/g, '<br>');
        message.style.cssText = `
            margin: 20px 0;
            line-height: 1.5;
            color: #333;
        `;
        
        // Add details about existing records
        if (duplicateInfo.duplicates.length > 0) {
            const detailsTitle = document.createElement('h3');
            detailsTitle.textContent = 'Existing Records:';
            detailsTitle.style.cssText = `
                color: #1976d2;
                margin: 20px 0 10px 0;
                font-size: 16px;
            `;
            
            const detailsList = document.createElement('ul');
            detailsList.style.cssText = `
                margin: 10px 0;
                padding-left: 20px;
            `;
            
            duplicateInfo.duplicates.forEach((lot, index) => {
                const listItem = document.createElement('li');
                const createdAt = new Date(lot.created_at).toLocaleString();
                listItem.innerHTML = `
                    <strong>Record ${index + 1}:</strong><br>
                    Form ID: ${lot.form_id}<br>
                    Status: ${lot.status}<br>
                    Created: ${createdAt}
                `;
                listItem.style.cssText = `
                    margin: 8px 0;
                    padding: 8px;
                    background: #f5f5f5;
                    border-radius: 4px;
                `;
                detailsList.appendChild(listItem);
            });
            
            message.appendChild(detailsTitle);
            message.appendChild(detailsList);
        }
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 15px;
            justify-content: flex-end;
            margin-top: 25px;
        `;
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '❌ Cancel';
        cancelBtn.style.cssText = `
            padding: 10px 20px;
            background: #f44336;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        `;
        cancelBtn.onclick = () => {
            document.body.removeChild(modal);
        };
        
        const proceedBtn = document.createElement('button');
        proceedBtn.textContent = '⚠️ Proceed Anyway';
        proceedBtn.style.cssText = `
            padding: 10px 20px;
            background: #ff9800;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
        `;
        proceedBtn.onclick = () => {
            document.body.removeChild(modal);
            // Return a promise that resolves to true to indicate user wants to proceed
            if (window.duplicateCheckCallback) {
                window.duplicateCheckCallback(true);
            }
        };
        
        buttonContainer.appendChild(cancelBtn);
        buttonContainer.appendChild(proceedBtn);
        
        modalContent.appendChild(title);
        modalContent.appendChild(message);
        modalContent.appendChild(buttonContainer);
        modal.appendChild(modalContent);
        
        document.body.appendChild(modal);
        
        // Return a promise that resolves when user makes a choice
        return new Promise((resolve) => {
            window.duplicateCheckCallback = (proceed) => {
                resolve(proceed);
                delete window.duplicateCheckCallback;
            };
            
            // Also resolve on cancel button click
            cancelBtn.onclick = () => {
                document.body.removeChild(modal);
                resolve(false);
            };
        });
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
                        // console.log(`Filled NA for ${fieldName} in row ${row.rowIndex}`);
                    }
                });
            });
            
            // If we filled any NA values, save the entire table
            if (naFilledCount > 0) {
                // console.log(`Filled ${naFilledCount} NA values, triggering table save...`);
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
                        // console.log('Building roll', position, '- Non-printed form:', isNonPrintedForm, '- NA value:', naValue);
        
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
        // Prevent duplicate table creation
        if (addNewTableBtn.disabled) {
            return; // Already processing
        }
        
        // Disable button during operation
        addNewTableBtn.disabled = true;
        const originalText = addNewTableBtn.textContent;
        addNewTableBtn.textContent = 'Creating...';
        // Double-check form type from UI if not set from database
        if (isNonPrintedForm === false) {
            const nonPrintedCheckbox = document.getElementById('non_printed');
            if (nonPrintedCheckbox && nonPrintedCheckbox.checked) {
                isNonPrintedForm = true;
                // console.log('Form type updated from UI for Add Next Lot - Non-printed:', isNonPrintedForm);
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
        
        // Check for duplicate lot number before proceeding
        const duplicateCheck = await checkForDuplicateLotNumber(traceabilityCode, lotLetter, nextLotNumber);
        
        if (duplicateCheck.hasDuplicates) {
            // Show warning modal and wait for user decision
            const userWantsToProceed = await showDuplicateWarningModal(duplicateCheck);
            
            if (!userWantsToProceed) {
                // User cancelled, re-enable button and return
                addNewTableBtn.disabled = false;
                addNewTableBtn.textContent = originalText;
                return;
            }
            // User chose to proceed anyway, continue with creation
        }
        
        const rolls = [];
        for (let i = 1; i <= rowCount; i++) {
            rolls.push(buildEmptyRoll(i, nextLotNumber));
        }
        
        // Get mc_no to determine the correct table
        const mcNoElement = document.getElementById('mc_no');
        const mcNo = mcNoElement ? mcNoElement.textContent.trim() : '02'; // Default to 02 if not found
        let tableName = getTableNameForMachine(mcNo);
        
        // If there are existing lots already loaded, use their table instead (to avoid creating duplicates in different tables)
        const existingTables = tablesContainer.querySelectorAll('table');
        if (existingTables.length > 0) {
            // Get the table name from the data attribute or determine from existing data
            const firstTable = existingTables[0];
            const formId = firstTable.getAttribute('data-form-id');
            if (formId) {
                // Try to find which table this form_id belongs to, AND verify traceability_code and lot_letter match
                const tables = ['inline_inspection_form_master_1', 'inline_inspection_form_master_2', 'inline_inspection_form_master_3'];
                for (const checkTable of tables) {
                    const { data: checkData } = await supabase
                        .from(checkTable)
                        .select('id')
                        .eq('form_id', formId)
                        .eq('traceability_code', traceabilityCode)
                        .eq('lot_letter', lotLetter)
                        .limit(1);
                    if (checkData && checkData.length > 0) {
                        tableName = checkTable;
                        break;
                    }
                }
            }
        }
        
        // Insert new row in Supabase with individual JSONB columns
        const formObject = {
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
        };
        delete formObject.form_id;
        const { error } = await supabase
            .from(tableName)
            .insert([formObject]);
        if (error) {
            alert('Error creating new lot: ' + error.message);
            // Re-enable button on error
            addNewTableBtn.disabled = false;
            addNewTableBtn.textContent = originalText;
            return;
        }
        
        // Reload all lots (to show the new table)
        // console.log('Reloading lots after creating new lot...');
        await loadAllLots();
        
        // Ensure new table is properly set up
        setTimeout(() => {
        addSaveListeners(); // <-- Ensure new table cells are hooked up for saving
            updateAddNextLotButtonState();
            updateTableSpacing(); // <-- Add table spacing update
            
        // Scroll to the new lot's table
            const tables = tablesContainer.querySelectorAll('table');
            if (tables.length > 0) {
                const newTable = tables[tables.length - 1];
                // console.log('New table found:', newTable);
                newTable.scrollIntoView({ behavior: 'smooth', block: 'center' });
                saveLotToSupabase(newTable);
            }
        }, 500); // Increased timeout to ensure everything is loaded
        
        // Re-enable button after operation
        addNewTableBtn.disabled = false;
        addNewTableBtn.textContent = originalText;
        });
    }

    // Helper to manage Add Rows button state - enable only when first table is empty
    function updateAddRowsButtonState() {
        if (!addRowsBtn) return;
        
        const tables = tablesContainer.querySelectorAll('table');
        if (tables.length === 0) {
            // No tables exist, enable Add Rows button
            addRowsBtn.disabled = false;
            addRowsBtn.style.opacity = '1';
            addRowsBtn.style.cursor = 'pointer';
            return;
        }
        
        // Check if the first table (main table) is empty
        const firstTable = tables[0];
        const tbody = firstTable.querySelector('tbody');
        
        if (tbody && tbody.rows.length === 0) {
            // First table is empty, enable Add Rows button
            addRowsBtn.disabled = false;
            addRowsBtn.style.opacity = '1';
            addRowsBtn.style.cursor = 'pointer';
        } else {
            // First table has rows, disable Add Rows button
            addRowsBtn.disabled = true;
            addRowsBtn.style.opacity = '0.5';
            addRowsBtn.style.cursor = 'not-allowed';
        }
    }

    // Helper to manage delete button visibility - only show on latest table
    function updateDeleteButtonVisibility() {
        const tables = tablesContainer.querySelectorAll('table');
        
        // Remove all existing delete buttons (more specific selector to avoid conflicts)
        const deleteButtons = tablesContainer.querySelectorAll('button');
        deleteButtons.forEach(button => {
            if (button.textContent === 'Delete Table') {
                button.remove();
            }
        });
        
        // Add delete button only to the latest table (last table in the list)
        if (tables.length > 0 && !viewMode) {
            const latestTable = tables[tables.length - 1];
            
            // Check if there's already a delete button for this table
            const existingDeleteButton = latestTable.previousElementSibling;
            if (existingDeleteButton && existingDeleteButton.textContent === 'Delete Table') {
                return; // Already exists, don't create another one
            }
            
            // Create delete button for the latest table
            const deleteTableButton = document.createElement('button');
            deleteTableButton.textContent = 'Delete Table';
            deleteTableButton.className = 'bg-red-500 hover:bg-red-700 text-white font-bold py-0.5 px-1.5 rounded mb-1 text-xs ml-1';
            deleteTableButton.onclick = function() {
                // Store the table reference for the overlay
                window.currentDeleteTable = latestTable;
                window.currentDeleteTableButton = deleteTableButton;
                
                // Find the associated Fill O and Clear O buttons for this table
                const tableIndex = Array.from(tables).indexOf(latestTable);
                const allButtons = tablesContainer.querySelectorAll('button');
                let fillOButton = null;
                let clearOButton = null;
                
                // Find buttons that belong to this table (they should be positioned before the table)
                let buttonIndex = 0;
                for (let i = 0; i < allButtons.length; i++) {
                    const button = allButtons[i];
                    if (button.textContent === 'Fill O' || button.textContent === 'Clear O') {
                        if (buttonIndex === tableIndex * 2) { // Each table has 2 buttons (Fill O, Clear O)
                            fillOButton = button;
                        } else if (buttonIndex === tableIndex * 2 + 1) {
                            clearOButton = button;
                        }
                        buttonIndex++;
                    }
                }
                
                window.currentFillOButton = fillOButton;
                window.currentClearOButton = clearOButton;
                
                // Show the custom overlay
                const overlay = document.getElementById('deleteTableConfirmationOverlay');
                const title = document.getElementById('deleteTableConfirmationTitle');
                const message = document.getElementById('deleteTableConfirmationMessage');
                
                // Check if this is the main table (first table)
                const isMainTable = tables.length > 0 && latestTable === tables[0];
                
                if (isMainTable) {
                    title.textContent = 'Confirm Main Table Clear';
                    message.textContent = 'Are you sure you want to clear all rows from the main table? This action cannot be undone.';
                } else {
                    title.textContent = 'Confirm Table Deletion';
                    message.textContent = 'Are you sure you want to delete this table? This action cannot be undone.';
                }
                
                overlay.classList.remove('hidden');
            };
            
            // Insert the delete button before the latest table
            latestTable.parentNode.insertBefore(deleteTableButton, latestTable);
        }
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
    // REMOVED: Duplicate event listener that was causing duplicate table creation
    // updateTableSpacing will be called from within the main Add Next Lot handler

    // ===== KEYBOARD NAVIGATION FUNCTIONALITY =====
    function setupKeyboardNavigation() {
        if (viewMode) {
            // console.log('Keyboard navigation disabled - in view mode');
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
    
    // ===== PERIODIC DUPLICATE CHECK =====
    // Check for existing duplicates when page loads
    async function checkExistingDuplicates() {
        if (!traceabilityCode || !lotLetter) return;
        
        try {
            const allLots = [];
            const tables = ['inline_inspection_form_master_1', 'inline_inspection_form_master_2', 'inline_inspection_form_master_3'];
            
            for (const tableName of tables) {
                const { data: lots, error } = await supabase
                    .from(tableName)
                    .select('id, form_id, lot_no, created_at, status')
                    .eq('traceability_code', traceabilityCode)
                    .eq('lot_letter', lotLetter)
                    .order('lot_no');
                    
                if (error) {
                    console.error(`Error checking for existing duplicates in ${tableName}:`, error);
                    continue;
                }
                
                if (lots && lots.length > 0) {
                    // Add table name to each lot for reference
                    lots.forEach(lot => lot.table_name = tableName);
                    allLots.push(...lots);
                }
            }
            
            if (!allLots || allLots.length === 0) return;
            
            // Group by lot_no to find duplicates
            const lotGroups = {};
            allLots.forEach(lot => {
                if (!lotGroups[lot.lot_no]) {
                    lotGroups[lot.lot_no] = [];
                }
                lotGroups[lot.lot_no].push(lot);
            });
            
            // Check for duplicates
            const duplicates = [];
            Object.entries(lotGroups).forEach(([lotNo, lots]) => {
                if (lots.length > 1) {
                    duplicates.push({
                        lot_no: lotNo,
                        records: lots
                    });
                }
            });
            
            if (duplicates.length > 0) {
                // Show a less intrusive notification about existing duplicates
                showExistingDuplicatesNotification(duplicates);
            }
        } catch (error) {
            console.error('Error in periodic duplicate check:', error);
        }
    }
    
    // Function to show notification about existing duplicates
    function showExistingDuplicatesNotification(duplicates) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 15px;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            font-family: Arial, sans-serif;
        `;
        
        const title = document.createElement('div');
        title.textContent = '⚠️ Existing Duplicates Found';
        title.style.cssText = `
            font-weight: bold;
            color: #856404;
            margin-bottom: 8px;
            font-size: 14px;
        `;
        
        const message = document.createElement('div');
        message.textContent = `Found ${duplicates.length} lot number(s) with duplicate records. Check the console for details.`;
        message.style.cssText = `
            color: #856404;
            font-size: 12px;
            line-height: 1.4;
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 5px;
            right: 8px;
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: #856404;
        `;
        closeBtn.onclick = () => {
            document.body.removeChild(notification);
        };
        
        notification.appendChild(closeBtn);
        notification.appendChild(title);
        notification.appendChild(message);
        
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 10000);
        
        // Log details to console
        console.warn('🚨 EXISTING DUPLICATES FOUND:', duplicates);
        duplicates.forEach(dup => {
            console.warn(`Lot ${dup.lot_no} has ${dup.records.length} records:`, dup.records);
        });
    }
    
    // Run duplicate check after page loads
    setTimeout(checkExistingDuplicates, 2000);



    // ===== FILL O FUNCTIONALITY =====
    const fillORequiredFieldChecks = [
        { field: 'hour', label: 'Hour (Row 1)', firstRowOnly: true },
        { field: 'minute', label: 'Minute (Row 1)', firstRowOnly: true },
        { field: 'lot_no', label: 'Lot Number', firstRowOnly: true },
        { field: 'arm', label: 'Arm', firstRowOnly: true },
        { field: 'inspected_by', label: 'Inspected By', firstRowOnly: true },
        { field: 'roll_weight', label: 'Roll Weight', allRows: true },
        { field: 'roll_width_mm', label: 'Roll Width', allRows: true },
        { field: 'thickness', label: 'Thickness', allRows: true },
        { field: 'roll_dia', label: 'Roll θ', allRows: true }
    ];

    function getFillOCellValue(cell) {
        if (!cell) return '';
        const input = cell.querySelector('input');
        if (input) return (input.value || '').trim();
        const select = cell.querySelector('select');
        if (select) return (select.value || '').trim();
        return (cell.textContent || '').trim();
    }

    function clearFillORequiredHighlights(table) {
        if (!table) return;
        table.querySelectorAll('.required-field').forEach(cell => {
            cell.classList.remove('required-field');
        });
    }

    function isPrintedProduct() {
        const checkbox = document.getElementById('printed') || document.querySelector('input[name="printed"]');
        return checkbox ? checkbox.checked : false;
    }

    function validateFirstRowBeforeFillO(table) {
        if (!table) return { valid: true };
        clearFillORequiredHighlights(table);
        const tbody = table.querySelector('tbody');
        if (!tbody) return { valid: true };

        const rows = tbody.querySelectorAll('tr');
        if (rows.length === 0) return { valid: true };

        const missingCells = [];
        const missingColumnNames = new Set(); // To collect unique column names only

        // Check first row only fields
        const firstRow = rows[0];
        fillORequiredFieldChecks.forEach(check => {
            if (check.firstRowOnly) {
                const cell = firstRow.querySelector(`td[data-field="${check.field}"]`);
                if (!cell) return;
                const value = getFillOCellValue(cell);
                if (!value) {
                    missingCells.push(cell);
                    missingColumnNames.add(check.label);
                }
            }
        });

        // Check all rows fields
        fillORequiredFieldChecks.forEach(check => {
            if (check.allRows) {
                rows.forEach((row, rowIndex) => {
                    const cell = row.querySelector(`td[data-field="${check.field}"]`);
                    if (!cell) return;
                    const value = getFillOCellValue(cell);
                    if (!value) {
                        missingCells.push(cell);
                        missingColumnNames.add(check.label); // Only add column name, not row number
                    }
                });
            }
        });

        // Check CT appearance for printed products (first row only)
        if (isPrintedProduct()) {
            const ctCell = firstRow.querySelector('td[data-field="ct_appearance"]');
            const ctValue = getFillOCellValue(ctCell);
            if (!ctValue) {
                missingCells.push(ctCell);
                missingColumnNames.add('CT Appearance');
            }
        }

        if (missingColumnNames.size === 0) return { valid: true };

        missingCells.forEach(cell => {
            cell.classList.add('required-field');
        });

        const lotNoCell = firstRow.querySelector('td[data-field="lot_no"]');
        const lotNoValue = getFillOCellValue(lotNoCell);
        const allTables = Array.from(tablesContainer.querySelectorAll('table'));
        const tableIndex = allTables.indexOf(table);
        const tableLabel = lotNoValue ? `Lot ${lotNoValue}` : `Table ${tableIndex + 1}`;
        const fieldList = Array.from(missingColumnNames).join(', ');
        return {
            valid: false,
            message: `${tableLabel} is missing some required data in :\n${fieldList}\n\nPlease check`
        };
    }

    function validateTablesBeforeFillO(tables) {
        const errors = [];
        tables.forEach(table => {
            const result = validateFirstRowBeforeFillO(table);
            if (!result.valid) {
                errors.push(result.message);
            }
        });
        return {
            valid: errors.length === 0,
            message: errors.join('\n')
        };
    }

    function showValidationModal(message) {
        // Create modal overlay
        const modalOverlay = document.createElement('div');
        modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            max-width: 380px;
            width: 90%;
            text-align: center;
        `;

        // Create message container
        const messageContainer = document.createElement('div');
        messageContainer.style.cssText = `
            margin: 0 0 20px 0;
            font-size: 16px;
            line-height: 1.5;
            text-align: center;
        `;

        // Parse the message - format: "Lot XX is missing some required data in :\nfield1, field2, field3\n\nPlease check"
        const lines = message.split('\n');
        const headerText = lines[0]; // "Lot XX is missing some required data in :"
        const fieldsText = lines[1]; // "Roll Width, Thickness, Roll θ"
        const footerText = lines[3]; // "Please check"

        // Extract lot number from headerText (e.g., "Lot 04 is missing..." -> "Lot No. 04")
        const lotMatch = headerText.match(/^Lot\s+\d+/);
        const lotNumberText = lotMatch ? lotMatch[0].replace(/^Lot\s+/, 'Lot No. ') : '';
        const restOfHeader = headerText.replace(lotMatch ? lotMatch[0] + ' ' : '', '');

        // Create header element - only lot number gets yellow background
        const headerElement = document.createElement('div');
        headerElement.style.cssText = `
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            flex-wrap: wrap;
        `;
        
        if (lotNumberText) {
            const lotSpan = document.createElement('span');
            lotSpan.textContent = lotNumberText;
            lotSpan.style.cssText = `
                font-weight: bold;
                background-color: #FFEB3B;
                padding: 4px 8px;
                border-radius: 4px;
                color: #000;
            `;
            headerElement.appendChild(lotSpan);
            
            const restSpan = document.createElement('span');
            restSpan.textContent = restOfHeader;
            restSpan.style.cssText = `
                font-weight: bold;
            `;
            headerElement.appendChild(restSpan);
        } else {
            headerElement.textContent = headerText;
            headerElement.style.fontWeight = 'bold';
        }

        // Create fields element (red, bold)
        const fieldsElement = document.createElement('div');
        fieldsElement.textContent = fieldsText;
        fieldsElement.style.cssText = `
            color: #dc2626;
            font-weight: bold;
            margin-bottom: 10px;
        `;

        // Create footer element (normal black)
        const footerElement = document.createElement('div');
        footerElement.textContent = footerText;
        footerElement.style.cssText = `
            color: #000000;
            font-weight: normal;
        `;

        // Assemble message container
        messageContainer.appendChild(headerElement);
        messageContainer.appendChild(fieldsElement);
        messageContainer.appendChild(footerElement);

        // Create OK button
        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.style.cssText = `
            background-color: #dc2626;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
        `;

        // Add hover effect
        okButton.onmouseover = () => okButton.style.backgroundColor = '#b91c1c';
        okButton.onmouseout = () => okButton.style.backgroundColor = '#dc2626';

        // Close modal function
        const closeModal = () => {
            document.body.removeChild(modalOverlay);
        };

        // Add click handler to OK button
        okButton.onclick = closeModal;

        // Add click handler to overlay (close when clicking outside)
        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        };

        // Assemble modal
        modalContent.appendChild(messageContainer);
        modalContent.appendChild(okButton);
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);

        // Focus the OK button
        okButton.focus();
    }

    function handleFillOValidationError(button, originalText, message) {
        showValidationModal(message);
        button.textContent = 'Validation Failed';
        button.style.backgroundColor = '#ef4444';
        button.disabled = false;
        setTimeout(() => {
            button.textContent = originalText;
            button.style.backgroundColor = '';
        }, 2000);
    }

    // ===== MIGRATION FUNCTION - Convert old data to JSONB =====
    async function migrateOldDataToJSONB() {
        if (!traceabilityCode) return;
        
        try {
            // console.log('Starting migration of old data to JSONB...');
            
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
                // console.log('Found', oldData.length, 'old rows to migrate');
                
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
                // Migration function deprecated - using new JSONB structure
                
                if (saveError) {
                    console.error('Error saving migrated data:', saveError);
                } else {
                    // console.log('Successfully migrated old data to JSONB');
                    
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
                        // console.log('Old individual rows deleted');
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
        // Using new JSONB structure - no migration needed
    }

    // ===== MULTI-LOT SUPPORT START =====

    // Helper to create a table for a lot, given its data and form_id
    function createLotTable(lot, nRows = 0) {
        // createLotTable called
        
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
        
        // Rolls reconstructed
        
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
            fillOButton.className = 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-0.5 px-1.5 rounded mb-1 text-xs mr-1';
        fillOButton.onclick = async function() {
            // Disable button during operation
            fillOButton.disabled = true;
            const originalText = fillOButton.textContent;
            fillOButton.textContent = 'Processing...';
            const validation = validateFirstRowBeforeFillO(table);
            if (!validation.valid) {
                handleFillOValidationError(fillOButton, originalText, validation.message);
                return;
            }
            
            try {
                const rows = table.querySelectorAll('tbody tr');
                let hasChanges = false;
                
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
                            // Apply color coding
                            applyXOColorCoding(td);
                            // Restore original editable state
                            td.contentEditable = wasEditable;
                            hasChanges = true;
                        }
                    });
                });
                
                // After filling O values, update Accept/Reject status for each row
                if (hasChanges) {
                    const rows = table.querySelectorAll('tbody tr');
                    rows.forEach(row => {
                        // Check if this row has any X values
                        const xoFields = [
                            'lines_strips', 'glossy', 'film_color', 'pin_hole', 'patch_mark', 'odour',
                            'print_color', 'mis_print', 'dirty_print', 'tape_test', 'centralization',
                            'wrinkles', 'prs', 'roll_curve', 'core_misalignment', 'others'
                        ];
                        
                        let hasX = false;
                        let hasO = false;
                        let totalXOFilled = 0;
                        
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
                        
                        // Find the Accept/Reject dropdown in the same row
                        const acceptRejectCell = row.querySelector('td[data-field="accept_reject"]');
                        if (acceptRejectCell) {
                            const acceptRejectSelect = acceptRejectCell.querySelector('select');
                            if (acceptRejectSelect) {
                                // Auto-update Accept/Reject based on X/O fields
                                if (hasX) {
                                    // If ANY field has X, set to Reject
                                    acceptRejectSelect.value = 'Reject';
                                    acceptRejectSelect.dispatchEvent(new Event('change', { bubbles: true }));
                                } else if (hasO && totalXOFilled > 0) {
                                    // If ALL filled fields are O (no X found), set to Accept
                                    acceptRejectSelect.value = 'Accept';
                                    acceptRejectSelect.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            }
                        }
                    });
                }
                
                // Only save if there were changes
                if (hasChanges && table.dataset.formId) {
                    await saveLotToSupabase(table);
                }
                
                // Update summary table once after all changes
                updateSummaryTable();
                
                // Show success confirmation
                fillOButton.textContent = 'Saved!';
                fillOButton.style.backgroundColor = '#10b981'; // green
                setTimeout(() => {
                    fillOButton.textContent = originalText;
                    fillOButton.style.backgroundColor = ''; // reset to original
                    fillOButton.disabled = false;
                }, 1000);
                
            } catch (error) {
                console.error('Error in Fill O operation:', error);
                fillOButton.textContent = 'Error!';
                fillOButton.style.backgroundColor = '#ef4444'; // red
                setTimeout(() => {
                    fillOButton.textContent = originalText;
                    fillOButton.style.backgroundColor = ''; // reset to original
                    fillOButton.disabled = false;
                }, 2000);
            }
        };
        tablesContainer.appendChild(fillOButton);
            
            // Add Clear O button
            const clearOButton = document.createElement('button');
            clearOButton.textContent = 'Clear O';
            clearOButton.className = 'bg-green-500 hover:bg-green-700 text-white font-bold py-0.5 px-1.5 rounded mb-1 text-xs';
            clearOButton.onclick = async function() {
                // Disable button during operation
                clearOButton.disabled = true;
                const originalText = clearOButton.textContent;
                clearOButton.textContent = 'Processing...';
                
                try {
                    const rows = table.querySelectorAll('tbody tr');
                    let hasChanges = false;
                    const rowsWithAcceptStatus = new Set(); // Track rows that had Accept status
                    
                    // First pass: Clear O values and track which rows had Accept status
                    rows.forEach((row, rowIndex) => {
                        const cells = row.querySelectorAll('td');
                        let rowHadOValues = false;
                        
                        // Check Accept/Reject status BEFORE clearing O values
                        const acceptRejectCell = row.querySelector('td[data-field="accept_reject"]');
                        if (acceptRejectCell) {
                            const acceptRejectSelect = acceptRejectCell.querySelector('select');
                            if (acceptRejectSelect && acceptRejectSelect.value === 'Accept') {
                                // This row had Accept status, mark it for reset
                                rowsWithAcceptStatus.add(rowIndex);
                            }
                        }
                        
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
                                // Apply color coding
                                applyXOColorCoding(td);
                                // Restore original editable state
                                td.contentEditable = wasEditable;
                                hasChanges = true;
                            }
                        });
                    });
                    
                    // Second pass: Reset Accept/Reject status only for rows that had Accept status
                    if (hasChanges) {
                        rows.forEach((row, rowIndex) => {
                            // Only reset Accept/Reject if this row had Accept status
                            if (rowsWithAcceptStatus.has(rowIndex)) {
                                const acceptRejectCell = row.querySelector('td[data-field="accept_reject"]');
                                if (acceptRejectCell) {
                                    const acceptRejectSelect = acceptRejectCell.querySelector('select');
                                    if (acceptRejectSelect) {
                                        // Reset Accept/Reject to default only for rows that had Accept status
                                        acceptRejectSelect.value = '';
                                        acceptRejectSelect.dispatchEvent(new Event('change', { bubbles: true }));
                                    }
                                }
                            }
                        });
                    }
                    
                    // Only save if there were changes
                    if (hasChanges && table.dataset.formId) {
                        await saveLotToSupabase(table);
                    }
                    
                    // Update summary table once after all changes
                    updateSummaryTable();
                    
                    // Show success confirmation
                    clearOButton.textContent = 'Saved!';
                    clearOButton.style.backgroundColor = '#10b981'; // green
                    setTimeout(() => {
                        clearOButton.textContent = originalText;
                        clearOButton.style.backgroundColor = ''; // reset to original
                        clearOButton.disabled = false;
                    }, 1000);
                    
                } catch (error) {
                    console.error('Error in Clear O operation:', error);
                    clearOButton.textContent = 'Error!';
                    clearOButton.style.backgroundColor = '#ef4444'; // red
                    setTimeout(() => {
                        clearOButton.textContent = originalText;
                        clearOButton.style.backgroundColor = ''; // reset to original
                        clearOButton.disabled = false;
                    }, 2000);
                }
            };
            tablesContainer.appendChild(clearOButton);

        // Delete button will be added by updateDeleteButtonVisibility() after all tables are created
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
        
        // Rolls reconstructed from JSONB
        const numRows = Math.max(rolls.length, nRows);
        
        // Always add the correct number of rows
        for (let i = 0; i < numRows; i++) {
            const tr = document.createElement('tr');
            const isFirstRow = (i === 0); // First row in this table
            for (let col = 0; col < totalColumns; col++) {
                const td = createCell(true, 1, col === dropdownIndex, col, isFirstRow, i);
                if (col === 3) td.textContent = (i + 1).toString();
                
                // Set lot number for first row if no rolls data (new lot)
                if (col === 2 && isFirstRow && rolls.length === 0) {
                    td.textContent = lot.lot_no || '';
                    // Setting lot number for new table
                }
                // Set arm for first row if no rolls data (new lot)
                else if (col === 4 && isFirstRow && rolls.length === 0) {
                    td.textContent = lot.arm || '';
                    // Setting arm for new table
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
                    
                    // Handle inspected_by for first and second rows separately
                    if (col === 32 && i > 1) {
                        value = ''; // Clear inspected_by for rows beyond second
                    } else if (col === 32 && i === 0) {
                        // First row: show first inspector name (before comma)
                        const names = (lot.inspected_by || '').split(',');
                        value = names[0]?.trim() || '';
                    } else if (col === 32 && i === 1) {
                        // Second row: show second inspector name (after comma)
                        const names = (lot.inspected_by || '').split(',');
                        value = names[1]?.trim() || '';
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
        // After filling all cells, set Inspected By in both first and second rows
        if (lot.inspected_by) {
            setTimeout(() => {
                const rows = tbody.querySelectorAll('tr');
                if (rows.length > 0) {
                    // Set first row with first inspector name
                    const firstRow = rows[0];
                    const firstRowInspectedByCell = firstRow.lastElementChild;
                    const names = lot.inspected_by.split(',');
                    firstRowInspectedByCell.textContent = names[0]?.trim() || '';
                    
                    // Set second row with second inspector name (if exists)
                    if (rows.length > 1) {
                        const secondRow = rows[1];
                        const secondRowInspectedByCell = secondRow.lastElementChild;
                        secondRowInspectedByCell.textContent = names[1]?.trim() || '';
                    }
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
        
        // Get mc_no to determine the correct table (DON'T query all tables)
        const mcNoElement = document.getElementById('mc_no');
        const mcNo = mcNoElement ? mcNoElement.textContent.trim() : '';
        const targetTable = getTableNameForMachine(mcNo);
        
        if (!targetTable) {
            console.error('Could not determine target table for machine number:', mcNo);
            return;
        }
        
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
            .from(targetTable)
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
            .eq('form_id', formId)
            .eq('traceability_code', traceabilityCode)
            .eq('lot_letter', lotLetter);
        if (error) {
            console.error('Error saving lot: ' + error.message);
        } else {
            // Lot saved successfully to individual JSONB columns
        }
    }

    // On page load, fetch all lots for this traceability_code and render tables - Updated for individual JSONB columns
    async function loadAllLots() {
        if (!traceabilityCode) return;
        
        try {
            // Clear existing tables
            tablesContainer.innerHTML = '';
            
            // Fetch all lots from all tables IN PARALLEL (not sequentially)
            const tables = ['inline_inspection_form_master_1', 'inline_inspection_form_master_2', 'inline_inspection_form_master_3'];
            const queryPromises = tables.map(tableName => 
                supabase
                    .from(tableName)
                    .select('*')
                    .eq('traceability_code', traceabilityCode)
                    .eq('lot_letter', lotLetter)
                    .order('created_at', { ascending: true })
            );
            
            const results = await Promise.all(queryPromises);
            let allLots = [];
            
            results.forEach((result, index) => {
                if (result.error) {
                    console.error(`Error loading lots from ${tables[index]}:`, result.error);
                } else if (result.data && result.data.length > 0) {
                    allLots = allLots.concat(result.data);
                }
            });
        
        // Sort all lots by creation time
        allLots.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        if (allLots.length === 0) {
            // No lots found, create a new one with empty JSONB columns
            // Get mc_no to determine the correct table
            const mcNoElement = document.getElementById('mc_no');
            const mcNo = mcNoElement ? mcNoElement.textContent.trim() : '02'; // Default to 02 if not found
            const tableName = getTableNameForMachine(mcNo);
            
            const formObject = {
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
            };
            delete formObject.form_id;
            await supabase
                .from(tableName)
                .insert([formObject]);
            // Now reload to show the new table
            return await loadAllLots();
        }
        // Fix existing lots that have null lot_no
        for (const lot of allLots) {
            if (!lot.lot_no || lot.lot_no === null) {
                // console.log('Fixing lot with null lot_no:', lot.id);
                // Update the lot to have lot_no '01' if it's the first lot
                const lotIndex = allLots.indexOf(lot);
                const newLotNo = (lotIndex + 1).toString().padStart(2, '0');
                await supabase
                    .from(allLots[lotIndex].table_name || 'inline_inspection_form_master_2')
                    .update({ lot_no: newLotNo })
                    .eq('id', lot.id);
                // Update the lot object for rendering
                lot.lot_no = newLotNo;
            }
        }
        
        // Clear the container before repopulating
        tablesContainer.innerHTML = '';
        allLots.forEach((lot, index) => {
            // Rendering lot
            // Calculate number of rolls from JSONB data
            let rollCount = Object.keys(lot.accept_reject_status || {}).length;
            
            // If this is a new lot (empty JSONB data), use total_rolls field
            if (rollCount === 0 && lot.total_rolls > 0) {
                rollCount = lot.total_rolls;
                // New lot detected
            }
            
            // Creating table for lot
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
        
        // ===== RE-APPLY OOS VALIDATION AFTER DATA LOAD =====
        setTimeout(() => {
            const tables = tablesContainer.querySelectorAll('table');
            tables.forEach(table => {
                const tbody = table.querySelector('tbody');
                if (!tbody) return;
                
                const rows = tbody.querySelectorAll('tr');
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td[data-field]');
                    cells.forEach(cell => {
                        const field = cell.dataset.field;
                        
                        // Map field names to OOS parameter types
                        const oosMappings = {
                            'roll_weight': 'weight',
                            'roll_width_mm': 'width',
                            'film_weight_gsm': 'gsm',
                            'roll_dia': 'rollDia',
                            'thickness': 'thickness',
                            'ct_appearance': 'ct',
                            'paper_core_dia_id': 'paperCoreId',
                            'paper_core_dia_od': 'paperCoreOd'
                        };
                        
                        if (field in oosMappings) {
                            applyOOSStyle(cell, oosMappings[field]);
                        }
                    });
                });
            });
        }, 100);
        
        // Update delete button visibility - only show on latest table
        updateDeleteButtonVisibility();
        
        // ===== FILL NA VALUES FOR NON-PRINTED FORMS =====
        // After tables are loaded, check if this is a non-printed form and fill NA values
        if (isNonPrintedForm) {
            // Non-printed form detected
            fillNAValuesForNonPrintedForm();
        }
        
        // Update Add Rows button state after loading all tables
        updateAddRowsButtonState();
        // After all lots are loaded and tables are rendered, show defects summary
        // 1. Aggregate all rolls from all lots using JSONB data
        let allRolls = [];
        allLots.forEach(lot => {
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
        } catch (error) {
            console.error('Error loading lots:', error);
        }
    }

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
        
        // QC Inspectors Cache
        
        // Process each table separately to check first row inspector
        tables.forEach((table, tableIndex) => {
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            
            const rows = Array.from(tbody.rows);
            if (rows.length === 0) return;
            
            // Check if first row's inspector is from Quality Control department
            const firstRow = rows[0];
            const firstRowInspector = firstRow.querySelector('td[data-field="inspected_by"]')?.textContent.trim() || '';
            
            // Table inspector check
            
            // Only process this table's defects if first row inspector is from QC department
            if (firstRowInspector && qcInspectors.includes(firstRowInspector)) {
                // Processing QC table // Debug log
                
                // Process all rows in this table
                rows.forEach((row, rowIndex) => {
                    const rollData = {};
                    row.querySelectorAll('td[data-field]').forEach(cell => {
                        const field = cell.dataset.field;
                        if (field) rollData[field] = cell.textContent.trim();
                    });
                    
                    const defect = (rollData.defect_name || '').trim();
                    if (defect) {
                        // Found defect
                        if (!ipqcDefectCounts[defect]) {
                            ipqcDefectCounts[defect] = 0;
                        }
                        ipqcDefectCounts[defect]++;
                    }
                });
            } else {
                // Skipping non-QC table // Debug log
            }
        });
        
        // IPQC Defect Counts
        
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
            
                    // Users filtered for Inspected By
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
        dropdown.style.maxHeight = '120px';
        dropdown.style.overflowY = 'auto';
        dropdown.style.fontSize = '11px'; // Match compact table cell font size
        matches.forEach(defect => {
            const item = document.createElement('div');
            item.textContent = defect;
            item.style.padding = '4px 8px';
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
        dropdown.style.maxHeight = '120px';
        dropdown.style.overflowY = 'auto';
        dropdown.style.fontSize = '11px'; // Match compact table cell font size
        matches.forEach(user => {
            const item = document.createElement('div');
            item.textContent = user;
            item.style.padding = '4px 8px';
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
            if (e.target && e.target.dataset && e.target.dataset.field === 'remarks') {
                // Debounce the update to avoid too frequent calls
                clearTimeout(window.remarksUpdateTimeout);
                window.remarksUpdateTimeout = setTimeout(() => {
                    updateProductionNo2FromRemarks();
                }, 500); // Wait 500ms after user stops typing
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
    
    // Function to update Production No. 2 & 3 field based on all remarks
    function updateProductionNo2FromRemarks() {
        const tables = tablesContainer.querySelectorAll('table');
        const allProductionNosFromRemarks = new Set();
        
        // Collect all production numbers from all remarks across all tables
        tables.forEach((table, tableIndex) => {
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            
            const rows = Array.from(tbody.rows);
            
            rows.forEach((row, rowIndex) => {
                const cells = row.querySelectorAll('td[data-field]');
                
                cells.forEach(cell => {
                    const field = cell.dataset.field;
                    if (field === 'remarks') {
                        const remarks = cell.textContent.trim();
                        const patterns = [
                            /PRD:\s*([A-Z0-9]+)/i,
                            /Production:\s*([A-Z0-9]+)/i,
                            /Prod:\s*([A-Z0-9]+)/i,
                            /([A-Z]{2,3}\d{2}[A-Z]{2}\d{3})/
                        ];
                        
                        for (const pattern of patterns) {
                            const matches = remarks.matchAll(new RegExp(pattern.source, 'gi'));
                            for (const match of matches) {
                                if (match[1]) {
                                    allProductionNosFromRemarks.add(match[1]);
                                }
                            }
                        }
                    }
                });
            });
        });
        
        // Update Production No. 2 & 3 field based on all collected production numbers
        const productionNo2Field = document.getElementById('production_no_2');
        if (productionNo2Field) {
            const currentValue = productionNo2Field.value.trim();
            const existingNos = currentValue ? currentValue.split(',').map(n => n.trim()) : [];
            const allProductionNosArray = Array.from(allProductionNosFromRemarks);
            
            if (allProductionNosArray.length > 0) {
                // Add new production numbers that aren't already in the field
                const newNos = allProductionNosArray.filter(no => !existingNos.includes(no));
                const removedNos = existingNos.filter(no => !allProductionNosArray.includes(no));
                
                if (newNos.length > 0 || removedNos.length > 0) {
                    const updatedValue = allProductionNosArray.join(', ');
                    productionNo2Field.value = updatedValue;
                    // Trigger auto-save
                    const event = new Event('input', { bubbles: true });
                    productionNo2Field.dispatchEvent(event);
                    
                    if (newNos.length > 0) {
                        // console.log('🔄 Auto-populated Production No. 2 & 3 from remarks:', newNos.join(', '));
                    }
                    if (removedNos.length > 0) {
                        // console.log('🗑️ Removed from Production No. 2 & 3:', removedNos.join(', '));
                    }
                    
                    // Update Production No Summary table to reflect changes
                    renderProductionNoSummaryTable();
                }
            } else {
                // If no production numbers found in any remarks, clear the field
                if (existingNos.length > 0) {
                    productionNo2Field.value = '';
                    // Trigger auto-save
                    const event = new Event('input', { bubbles: true });
                    productionNo2Field.dispatchEvent(event);
                    // console.log('🗑️ Cleared Production No. 2 & 3 - no production numbers found in any remarks');
                    
                    // Update Production No Summary table to reflect changes
                    renderProductionNoSummaryTable();
                }
            }
        }
    }

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
                        // First, find which table contains this form_id
                        const tables = ['inline_inspection_form_master_1', 'inline_inspection_form_master_2', 'inline_inspection_form_master_3'];
                        let targetTable = null;
                        
                        for (const tableName of tables) {
                            const { data: existingRecord, error } = await supabase
                                .from(tableName)
                                .select('id')
                                .eq('form_id', formId)
                                .single();
                                
                            if (!error && existingRecord) {
                                targetTable = tableName;
                                break;
                            }
                        }
                        
                        if (targetTable) {
                            // VERIFY the record exists and matches before clearing
                            const { data: recordToClear, error: fetchError } = await supabase
                                .from(targetTable)
                                .select('id, form_id, traceability_code, lot_letter, lot_no')
                                .eq('form_id', formId)
                                .eq('traceability_code', traceabilityCode)
                                .eq('lot_letter', lotLetter)
                                .single();

                            if (fetchError || !recordToClear) {
                                console.error('Record verification failed for clear:', fetchError);
                                alert('Error: Could not verify the record to clear. Please check if it exists.');
                                return;
                            }

                            // Log what we're about to clear for safety
                            console.log('Clearing record:', {
                                table: targetTable,
                                form_id: recordToClear.form_id,
                                traceability_code: recordToClear.traceability_code,
                                lot_letter: recordToClear.lot_letter,
                                lot_no: recordToClear.lot_no
                            });

                            const { error } = await supabase
                                .from(targetTable)
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
                                .eq('form_id', formId)
                                .eq('traceability_code', traceabilityCode)
                                .eq('lot_letter', lotLetter);
                            
                            if (error) {
                                console.error('Error clearing Supabase data:', error);
                            }
                        } else {
                            console.error('Could not find table containing form_id for main table clear:', formId);
                        }
                    }
                    
                    // Update summary table
                    updateSummaryTable();
                    
                    // Update delete button visibility after clearing main table
                    updateDeleteButtonVisibility();
                    
                    // Re-enable Add Rows button since main table is now empty
                    updateAddRowsButtonState();
                    
                    showSuccessMessage('Success!', 'Main table rows cleared successfully!');
                    
                    // Page will refresh when user clicks OK on success message
                }
            } else {
                // For other tables, delete the entire table
                // Delete from Supabase using formId
                const formId = table.dataset.formId;
                if (formId) {
                    // Get mc_no to determine the correct table
                    const mcNoElement = document.getElementById('mc_no');
                    const mcNo = mcNoElement ? mcNoElement.textContent.trim() : '';
                    const targetTable = getTableNameForMachine(mcNo);

                    if (targetTable) {
                        // VERIFY the record exists and matches before deleting
                        const { data: recordToDelete, error: fetchError } = await supabase
                            .from(targetTable)
                            .select('id, form_id, traceability_code, lot_letter, lot_no')
                            .eq('form_id', formId)
                            .eq('traceability_code', traceabilityCode)
                            .eq('lot_letter', lotLetter)
                            .single();

                        if (fetchError || !recordToDelete) {
                            console.error('Record verification failed:', fetchError);
                            alert('Error: Could not verify the record to delete. Please check if it exists.');
                            return;
                        }

                        // Log what we're about to delete for safety
                        console.log('Deleting record:', {
                            table: targetTable,
                            form_id: recordToDelete.form_id,
                            traceability_code: recordToDelete.traceability_code,
                            lot_letter: recordToDelete.lot_letter,
                            lot_no: recordToDelete.lot_no
                        });

                        const { error } = await supabase
                            .from(targetTable)
                            .delete()
                            .eq('form_id', formId)
                            .eq('traceability_code', traceabilityCode)
                            .eq('lot_letter', lotLetter);

                        if (error) {
                            alert('Error deleting table from Supabase: ' + error.message);
                            return;
                        }
                    } else {
                        console.error('Could not determine target table for machine:', mcNo);
                        alert('Error: Could not determine the correct table for deletion.');
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
                

                
                // Don't automatically reorder lot numbers - user has control over them
                // await reorderLotNumbers();
                
                // Update delete button visibility after deletion
                updateDeleteButtonVisibility();
                
                // Update Add Rows button state in case main table was deleted
                updateAddRowsButtonState();
                
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
            // Fetch all lots from all tables for this traceability_code and lot_letter
            const tables = ['inline_inspection_form_master_1', 'inline_inspection_form_master_2', 'inline_inspection_form_master_3'];
            let allLots = [];
            
            for (const tableName of tables) {
                const { data: lots, error } = await supabase
                    .from(tableName)
                    .select('*')
                    .eq('traceability_code', traceabilityCode)
                    .eq('lot_letter', lotLetter)
                    .order('created_at', { ascending: true });
                
                if (error) {
                    console.error(`Error fetching lots from ${tableName} for reordering:`, error);
                    continue;
                }
                
                if (lots && lots.length > 0) {
                    // Add table name to each lot for reference
                    lots.forEach(lot => lot.table_name = tableName);
                    allLots = allLots.concat(lots);
                }
            }
            
            // Sort all lots by creation time
            allLots.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            
            // Update lot numbers sequentially across all tables
            for (let i = 0; i < allLots.length; i++) {
                const lot = allLots[i];
                const newLotNo = (i + 1).toString().padStart(2, '0');
                
                if (lot.lot_no !== newLotNo) {
                    // console.log(`Updating lot ${lot.id} from ${lot.lot_no} to ${newLotNo} in table ${lot.table_name}`);
                    await supabase
                        .from(lot.table_name)
                        .update({ lot_no: newLotNo })
                        .eq('id', lot.id);
                }
            }
            
            // console.log('Lot numbers reordered successfully across all tables');
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
                    // First, find which table contains this form_id
                    const tables = ['inline_inspection_form_master_1', 'inline_inspection_form_master_2', 'inline_inspection_form_master_3'];
                    let targetTable = null;
                    
                    for (const tableName of tables) {
                        const { data: existingRecord, error } = await supabase
                            .from(tableName)
                            .select('id')
                            .eq('form_id', tableRef.dataset.formId)
                            .single();
                            
                        if (!error && existingRecord) {
                            targetTable = tableName;
                            break;
                        }
                    }
                    
                    if (targetTable) {
                        // Update the database to set lot_no to "01"
                        const { error } = await supabase
                            .from(targetTable)
                            .update({ lot_no: '01' })
                            .eq('form_id', tableRef.dataset.formId);
                        
                        if (error) {
                            console.error('Error updating lot number:', error);
                        } else {
                            // console.log('Lot number updated to 01 in database');
                        }
                        
                        // Also save the table data
                        saveLotToSupabase(tableRef);
                    } else {
                        console.error('Could not find table containing form_id for lot number update:', tableRef.dataset.formId);
                    }
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
        // console.log('Manually triggering IPQC table render...');
        renderIPQCDefectsTable();
    };
    
    // Debug function to check QC inspectors
    window.checkQCInspectors = function() {
        // console.log('QC Inspectors Cache:', qcInspectorsCache);
        // console.log('All tables:', document.querySelectorAll('#tablesContainer table').length);
        document.querySelectorAll('#tablesContainer table').forEach((table, index) => {
            const firstRow = table.querySelector('tbody tr');
            const inspector = firstRow?.querySelector('td[data-field="inspected_by"]')?.textContent.trim();
            // console.log(`Table ${index}: Inspector = "${inspector}"`);
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
                    <td style="border: 1px solid #9ca3af;">${stats.thickness.min.toFixed(0)}</td>
                    <td style="border: 1px solid #9ca3af;">${stats.thickness.max.toFixed(0)}</td>
                    <td style="border: 1px solid #9ca3af;">${stats.thickness.avg.toFixed(0)}</td>
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
        
        // Collect all production numbers from all remarks across all tables for summary
        const allProductionNosFromRemarks = new Set();
        
        // First pass: collect all production numbers from all remarks
        tables.forEach((table, tableIndex) => {
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            
            const rows = Array.from(tbody.rows);
            
            rows.forEach((row, rowIndex) => {
                const cells = row.querySelectorAll('td[data-field]');
                
                cells.forEach(cell => {
                    const field = cell.dataset.field;
                    if (field === 'remarks') {
                        const remarks = cell.textContent.trim();
                        const patterns = [
                            /PRD:\s*([A-Z0-9]+)/i,
                            /Production:\s*([A-Z0-9]+)/i,
                            /Prod:\s*([A-Z0-9]+)/i,
                            /([A-Z]{2,3}\d{2}[A-Z]{2}\d{3})/
                        ];
                        
                        for (const pattern of patterns) {
                            const matches = remarks.matchAll(new RegExp(pattern.source, 'gi'));
                            for (const match of matches) {
                                if (match[1]) {
                                    allProductionNosFromRemarks.add(match[1]);
                                }
                            }
                        }
                    }
                });
            });
        });
        
        // Add all production numbers from remarks to the summary data
        allProductionNosFromRemarks.forEach(prodNo => {
            if (!productionNoData[prodNo]) {
                productionNoData[prodNo] = { rolls: 0, totalKg: 0 };
            }
        });
        
        // Process all tables in order (shift-wide continuous tracking)
        tables.forEach((table, tableIndex) => {
            const tbody = table.querySelector('tbody');
            if (!tbody) return;
            
            const rows = Array.from(tbody.rows);
            // Processing table
            
            // Process each row in the table
            rows.forEach((row, rowIndex) => {
                const cells = row.querySelectorAll('td[data-field]');
                let rollWeight = 0;
                let remarks = '';
                let productionNoChanged = false;
                
                // Check for Production No change in remarks and collect roll weight
                cells.forEach(cell => {
                    const field = cell.dataset.field;
                    if (!field) return;
                    
                    if (field === 'remarks') {
                        remarks = cell.textContent.trim();
                        // Look for Production No patterns in remarks for tracking
                        const patterns = [
                            /PRD:\s*([A-Z0-9]+)/i,           // PRD: UBS25PR026
                            /Production:\s*([A-Z0-9]+)/i,     // Production: UBS25PR026
                            /Prod:\s*([A-Z0-9]+)/i,          // Prod: UBS25PR026
                            /([A-Z]{2,3}\d{2}[A-Z]{2}\d{3})/ // Direct format like UBS25PR026
                        ];
                        
                        // Update current production number for tracking
                        for (const pattern of patterns) {
                            const match = remarks.match(pattern);
                            if (match && match[1] !== currentProductionNo) {
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
                    
                    // Added roll to production
                }
            });
        });
        
        // Production No Summary completed
        
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
