import { supabase } from '../supabase-config.js';
import { showToast, storePendingToast } from './toast.js';

/**
 * MJR ACTION MODULE
 * Handles Maintenance Job Requisition Action form functionality including:
 * - Form data loading and population for view/edit modes
 * - Dynamic equipment dropdowns with area-based filtering
 * - Schedule calculation and validation
 * - Roller equipment field management
 * - Form submission and validation
 */

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================

const CONFIG = {
    FACILITY_AREAS: [
        'Production Corridor', 'Warehouse Corridor', 'Dock Area', 'Building Surrounding',
        'RM Warehouse #1', 'RM Warehouse #2', 'Utility Area', 'Terrace Area', 'Security Gate'
    ],
    STYLES: {
        FACILITY_BG: '#e0f2fe',
        READONLY_BG: '#f3f4f6',
        VIEW_BG: '#f5f5f5',
        GROUP_LABEL_COLOR: '#002E7D',
        DROPDOWN_ARROW: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23666\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6,9 12,15 18,9\'%3e%3c/polyline%3e%3c/svg%3e")'
    },
    ROLLER_TYPES: ['Rubber Roller', 'Emboss Roller', 'Rubber roller', 'Emboss roller'],
    DISABLED_EDIT_FIELDS: ['reqDept', 'requestorName']
};

// ==========================================
// STATE MANAGEMENT
// ==========================================

const State = {
    userId: null,
    elements: null, // Cached DOM elements

    /** Initialize and cache all form elements */
    initElements() {
        if (this.elements) return this.elements;

        const ids = [
            'maintenanceForm', 'reqDept', 'reqDeptHOD', 'requestorName',
            'equipmentName', 'equipmentNo', 'equipmentInstallDate',
            'occurDate', 'occurTime', 'requisitionNo', 'machineNo',
            'requireCompletionDate', 'completionTime', 'existingCondition',
            'correction', 'rootCause', 'technicianName', 'materialRetrieval',
            'cleaningInspection', 'scheduleStartDate', 'scheduleStartTime',
            'scheduleEndDate', 'scheduleEndTime', 'totalHrs',
            'inspectionRemarks', 'inspectionAccepted', 'inspectionRejected',
            'inspectionCheckedBy', 'cleanRetrCheckedBy', 'purchaseReqNo', 'costIncurred'
        ];

        this.elements = {};
        ids.forEach(id => this.elements[id] = document.getElementById(id));
        return this.elements;
    },

    /** Get schedule-related elements */
    get scheduleElements() {
        const els = this.initElements();
        return {
            startDate: els.scheduleStartDate,
            startTime: els.scheduleStartTime,
            endDate: els.scheduleEndDate,
            endTime: els.scheduleEndTime,
            totalHrs: els.totalHrs
        };
    }
};

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Check
    State.userId = await getLoggedInUserId();
    if (!State.userId) {
        window.location.href = '/';
        return;
    }

    // 2. Cache DOM & Setup UI
    State.initElements();
    setupAutoExpandTextareas();
    setupAutoCapitalization();
    injectSpinnerCSS();

    // Track where user came from for back button functionality
    // Only update if referrer is not the current page to avoid loops on reload
    if (document.referrer && !document.referrer.includes('mjr-action.html')) {
        sessionStorage.setItem('mjrFormPrevPage', document.referrer);
    }

    // Expose back navigation globally
    window.handleBackNavigation = function () {
        const prev = sessionStorage.getItem('mjrFormPrevPage');
        if (prev && !prev.includes('mjr-action.html')) {
            window.location.href = prev;
        } else {
            // Fallback based on typical path
            if (document.referrer && document.referrer.includes('mjr-table.html')) {
                window.location.href = '../html/mjr-table.html';
            } else if (document.referrer && document.referrer.includes('emp-mjr-table.html')) {
                window.location.href = '../html/emp-mjr-table.html';
            } else {
                window.location.href = '../html/employee-dashboard.html';
            }
        }
    };

    // 3. Core Functionality (Parallel)
    setupScheduleCalculation();
    setupDynamicRollerFields();
    await setupAreaMachineDropdown();

    // 4. Handle URL parameters (view/edit modes)
    await handleUrlParameters();

    // 5. Event Listeners
    setupFormEventListeners();

    // 6. Initial total hours display
    setTimeout(() => updateTotalHoursDisplay(), 100);
});

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/** Auto-expand textareas to fit content */
function setupAutoExpandTextareas() {
    document.querySelectorAll('textarea').forEach(textarea => {
        textarea.removeAttribute('rows');
    });

    // Legacy global trigger for compatibility
    window.triggerTextareaExpand = () => { };
}

/**
 * Auto-capitalize first letter of each word
 * @param {string} str - Input string
 * @returns {string} - Capitalized string
 */
function capitalizeWords(str) {
    return str.replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Setup auto-capitalization for specific input fields
 */
function setupAutoCapitalization() {
    const fieldsToCapitalize = ['equipmentName', 'technicianName', 'cleanRetrCheckedBy', 'inspectionCheckedBy'];

    fieldsToCapitalize.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function (e) {
                const cursorPos = this.selectionStart;
                const oldValue = this.value;
                const newValue = capitalizeWords(oldValue);

                if (oldValue !== newValue) {
                    this.value = newValue;
                    // Restore cursor position
                    this.setSelectionRange(cursorPos, cursorPos);
                }
            });
        }
    });
}

/** Convert yyyy-mm-dd to dd/mm/yyyy for display */
function formatDateForDisplay(dateString) {
    if (!dateString) return '';
    if (dateString.includes('/') && dateString.length === 10) return dateString;
    if (dateString.includes('-') && dateString.length === 10) {
        const [y, m, d] = dateString.split('-');
        return `${d}/${m}/${y}`;
    }
    try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        }
    } catch { }
    return dateString;
}

/** Convert dd/mm/yyyy to yyyy-mm-dd for HTML date inputs */
function formatDateForHTMLInput(dateString) {
    if (!dateString) return '';
    if (dateString.includes('-') && dateString.length === 10) return dateString;
    if (dateString.includes('/')) {
        const [d, m, y] = dateString.split('/');
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return '';
}

/** Convert various date formats to yyyy-mm-dd for database */
function formatDateForDatabase(dateString) {
    if (!dateString) return null;
    if (dateString.includes('-') && dateString.length === 10) return dateString;
    if (dateString.includes('/') && dateString.length === 10) {
        const [d, m, y] = dateString.split('/');
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
    } catch { }
    return dateString;
}

/** Check if equipment is a roller type */
function isRollerEquipment(name) {
    return name && CONFIG.ROLLER_TYPES.some(type => name.includes(type));
}

/** Generate UUID v4 */
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

// ==========================================
// AUTHENTICATION
// ==========================================

let cachedUserId = null;

async function getLoggedInUserId() {
    if (cachedUserId !== null) return cachedUserId;
    const { data: { user } } = await supabase.auth.getUser();
    cachedUserId = user?.id || null;
    return cachedUserId;
}

// ==========================================
// AREA/MACHINE DROPDOWN
// ==========================================

/**
 * Initialize area/machine dropdown with facility separation
 */
async function setupAreaMachineDropdown() {
    const select = State.elements.machineNo;
    if (!select) return;

    try {
        const { data, error } = await supabase
            .from('mt_machines_and_equipments_masterdata')
            .select('installation_area')
            .not('installation_area', 'is', null)
            .order('installation_area');

        if (error) return;

        const uniqueAreas = [...new Set(data.map(i => i.installation_area))]
            .filter(a => a?.trim())
            .sort();

        select.innerHTML = '<option value="">Select Area / Machine</option>';

        // 1. Machine Areas
        uniqueAreas.filter(a => !CONFIG.FACILITY_AREAS.includes(a)).forEach(area => {
            select.appendChild(createOption(area, area));
        });

        // 2. Separator
        if (uniqueAreas.length > 0) {
            const sep = createOption('── GENERAL FACILITIES ──', '', true);
            sep.style.fontWeight = 'bold';
            sep.style.color = CONFIG.STYLES.GROUP_LABEL_COLOR;
            select.appendChild(sep);
        }

        // 3. Facility Areas
        CONFIG.FACILITY_AREAS.forEach(area => {
            const opt = createOption(area, area);
            opt.style.backgroundColor = CONFIG.STYLES.FACILITY_BG;
            select.appendChild(opt);
        });

        select.addEventListener('change', handleAreaChange);

    } catch (e) { console.error('Area dropdown error:', e); }
}

/** Create option element helper */
function createOption(text, value, disabled = false) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    opt.disabled = disabled;
    return opt;
}

/** Handle area selection change */
async function handleAreaChange() {
    const selectedArea = State.elements.machineNo?.value;
    const isFacility = CONFIG.FACILITY_AREAS.includes(selectedArea);
    const label = document.querySelector('label[for="equipmentName"]');

    clearEquipmentFields();

    if (isFacility) {
        // Facility Mode
        resetEquipmentField();
        if (label) label.textContent = "Asset Name / Item:";

        const nameField = document.getElementById('equipmentName');
        if (nameField) {
            nameField.placeholder = "e.g. Roof, Floor, Window, Main Gate, Pipe Line";
            nameField.focus();
        }
        setReadonlyState('equipmentNo', true, "N/A for Facilities");
        setReadonlyState('equipmentInstallDate', true, "N/A for Facilities");

    } else if (selectedArea) {
        // Machine Mode
        if (label) label.textContent = "Equipment Name:";
        setReadonlyState('equipmentNo', false, "Equipment ID");
        setReadonlyState('equipmentInstallDate', false, "Installation Date");
        await populateEquipmentDropdown(selectedArea);

    } else {
        // Default
        if (label) label.textContent = "Equipment Name:";
        setReadonlyState('equipmentNo', false, "Equipment ID");
        setReadonlyState('equipmentInstallDate', false, "Installation Date");
        resetEquipmentField();
    }
}

/** Set readonly state with styling */
function setReadonlyState(fieldId, isReadonly, placeholder) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.readOnly = isReadonly;
    el.placeholder = placeholder || '';
    el.style.backgroundColor = isReadonly ? CONFIG.STYLES.READONLY_BG : '';
    if (isReadonly) el.value = '';
}

/** Clear equipment-related fields */
function clearEquipmentFields() {
    ['equipmentName', 'equipmentNo', 'equipmentInstallDate'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.tagName === 'INPUT') {
            el.value = '';
        } else {
            const input = el.querySelector('input');
            if (input) input.value = '';
        }
    });
}

/** Reset equipment field to simple input */
function resetEquipmentField() {
    const field = document.getElementById('equipmentName');
    if (!field || field.tagName === 'INPUT') return;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'equipmentName';
    input.name = 'equipmentName';
    input.placeholder = 'Select or Type Equipment';
    input.required = true;
    input.className = field.className;
    input.style.cssText = field.style.cssText;

    field.parentNode.replaceChild(input, field);
    State.elements.equipmentName = input;
}

// ==========================================
// EQUIPMENT DROPDOWN (TYPE-AHEAD)
// ==========================================

/** Populate equipment dropdown with type-ahead */
async function populateEquipmentDropdown(area) {
    const nameField = document.getElementById('equipmentName');
    if (!nameField) return;

    try {
        const { data, error } = await supabase
            .from('mt_machines_and_equipments_masterdata')
            .select('equipment_name, equipment_identification_no, equipment_installation_date')
            .eq('installation_area', area)
            .order('equipment_name');

        if (error || !data) return;

        // Create container
        const container = document.createElement('div');
        container.className = 'custom-equipment-dropdown';
        container.style.cssText = 'position: relative; width: 100%;';

        // Create input
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'equipmentName';
        input.name = 'equipmentName';
        input.placeholder = 'Select or Type Equipment';
        input.required = true;
        input.style.cssText = nameField.style.cssText;
        Object.assign(input.style, {
            cursor: 'text',
            backgroundImage: CONFIG.STYLES.DROPDOWN_ARROW,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            backgroundSize: '16px',
            paddingRight: '30px'
        });

        // Inject placeholder style once
        if (!document.getElementById('equipment-placeholder-style')) {
            const style = document.createElement('style');
            style.id = 'equipment-placeholder-style';
            style.textContent = '#equipmentName::placeholder { color: #999 !important; opacity: 1 !important; }';
            document.head.appendChild(style);
        }

        // Create dropdown list
        const list = document.createElement('div');
        list.className = 'equipment-dropdown-list';
        list.style.cssText = `
            position: absolute; top: 100%; left: 0; right: 0;
            background: white; border: 1px solid #ddd; border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            max-height: 400px; overflow-y: auto; z-index: 1000; display: none;
        `;

        // Clear Selection option
        const clearOpt = createDropdownOption('Clear Selection');
        clearOpt.style.color = '#666';
        clearOpt.style.fontStyle = 'italic';
        clearOpt.onclick = () => {
            input.value = '';
            document.getElementById('equipmentNo').value = '';
            document.getElementById('equipmentInstallDate').value = '';
            list.style.display = 'none';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        };
        list.appendChild(clearOpt);

        // Equipment options
        data.forEach(eq => {
            const opt = createDropdownOption(eq.equipment_name, eq.equipment_identification_no);
            opt.dataset.equipmentName = eq.equipment_name;
            opt.dataset.equipmentNo = eq.equipment_identification_no || '';
            opt.dataset.installDate = eq.equipment_installation_date || '';

            opt.onclick = () => {
                input.value = eq.equipment_name;
                list.style.display = 'none';

                const noField = document.getElementById('equipmentNo');
                if (noField && eq.equipment_identification_no) noField.value = eq.equipment_identification_no;

                const dateField = document.getElementById('equipmentInstallDate');
                if (dateField && eq.equipment_installation_date) dateField.value = formatDateForDisplay(eq.equipment_installation_date);

                input.dispatchEvent(new Event('input', { bubbles: true }));
            };

            list.appendChild(opt);
        });

        container.appendChild(input);
        container.appendChild(list);
        nameField.parentNode.replaceChild(container, nameField);
        State.elements.equipmentName = input;

        // Event listeners
        input.addEventListener('input', () => filterDropdownOptions(list, input.value));
        input.addEventListener('click', () => list.style.display = 'block');
        input.addEventListener('focus', () => list.style.display = 'block');
        document.addEventListener('click', e => {
            if (!container.contains(e.target)) list.style.display = 'none';
        });

    } catch (e) { console.error('Equipment dropdown error:', e); }
}

/** Create dropdown option element */
function createDropdownOption(name, subtext = null) {
    const opt = document.createElement('div');
    opt.className = 'dropdown-option';
    opt.style.cssText = 'padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #eee; font-size: 14px;';

    const nameDiv = document.createElement('div');
    nameDiv.textContent = name;
    nameDiv.style.cssText = 'font-weight: 500; color: #333;';
    opt.appendChild(nameDiv);

    if (subtext) {
        const subDiv = document.createElement('div');
        subDiv.textContent = subtext;
        subDiv.style.cssText = 'font-size: 12px; color: #666; margin-top: 2px;';
        opt.appendChild(subDiv);
    }

    opt.onmouseenter = () => opt.style.backgroundColor = '#f8f9fa';
    opt.onmouseleave = () => opt.style.backgroundColor = 'white';

    return opt;
}

/** Filter dropdown options based on input */
function filterDropdownOptions(list, filter) {
    const lowerFilter = filter.toLowerCase();
    list.querySelectorAll('.dropdown-option').forEach(opt => {
        if (opt.textContent === 'Clear Selection') {
            opt.style.display = filter ? 'none' : 'block';
            return;
        }
        const name = opt.dataset.equipmentName?.toLowerCase() || '';
        const id = opt.dataset.equipmentNo?.toLowerCase() || '';
        opt.style.display = (name.includes(lowerFilter) || id.includes(lowerFilter)) ? 'block' : 'none';
    });
    list.style.display = 'block';
}

// ==========================================
// SCHEDULE CALCULATION
// ==========================================

function setupScheduleCalculation() {
    const els = State.scheduleElements;
    if (!els.startDate || !els.startTime || !els.endDate || !els.endTime || !els.totalHrs) return;

    const update = () => updateTotalHoursDisplay();
    ['change', 'input'].forEach(evt => {
        els.startDate.addEventListener(evt, update);
        els.startTime.addEventListener(evt, update);
        els.endDate.addEventListener(evt, update);
        els.endTime.addEventListener(evt, update);
    });
}

function updateTotalHoursDisplay(sDateStr, sTimeStr, eDateStr, eTimeStr) {
    const els = State.scheduleElements;
    if (!els.totalHrs) return;

    const sDate = sDateStr || els.startDate?.value;
    const sTime = sTimeStr || els.startTime?.value;
    const eDate = eDateStr || els.endDate?.value;
    const eTime = eTimeStr || els.endTime?.value;

    if (sDate && sTime && eDate && eTime) {
        try {
            const start = new Date(`${sDate} ${sTime}`);
            const end = new Date(`${eDate} ${eTime}`);
            if (end > start) {
                const diffMin = Math.floor((end - start) / 60000);
                const h = Math.floor(diffMin / 60);
                const m = diffMin % 60;
                els.totalHrs.value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                return;
            }
        } catch { }
    }
    els.totalHrs.value = '00:00';
}

// ==========================================
// URL PARAMETER HANDLING
// ==========================================

async function handleUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const action = params.get('action');

    if (!id) return;

    try {
        const userId = await getLoggedInUserId();
        const { data: profile } = await supabase
            .from('users')
            .select('department, user_level, is_admin')
            .eq('id', userId)
            .single();

        const canBypassLock = profile && (
            (profile.department === 'Maintenance' && parseInt(profile.user_level, 10) === 1) ||
            (profile.is_admin === true)
        );

        const { data, error } = await supabase
            .from('mt_job_requisition_master')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            showToast('Error loading requisition data', 'error');
            return;
        }

        if (data) {
            // Check if user came from emp-mjr-table (employee view)
            const referrer = document.referrer || sessionStorage.getItem('mjrFormPrevPage') || '';
            const isFromEmpTable = referrer.includes('emp-mjr-table.html');

            if (data.submission_status === 'completed' && !canBypassLock) {
                // If status is completed, force full read-only mode for everyone EXCEPT power users
                disableAllFormFields();
                populateFormFields(data);
            } else if (isFromEmpTable) {
                // Employee accessing from their table - only allow inspection section editing
                await enableInspectionSectionOnly();
                populateFormFields(data);
            } else if (action === 'view') {
                disableAllFormFields();
                populateFormFields(data);
            } else if (action === 'edit' || (canBypassLock && action !== 'view')) {
                // Power users can edit even if completed (unless explicitly viewing)
                enableFormFieldsForEdit();
                populateFormFields(data);
            }
        }
    } catch (e) {
        showToast('Error loading requisition data', 'error');
    }
}

// ==========================================
// FORM POPULATION
// ==========================================

function populateFormFields(data) {
    const els = State.initElements();

    // Field mappings: formId -> dbField with value
    const mappings = {
        reqDept: data.reqdept,
        reqDeptHOD: data.reqdepthod,
        requestorName: data.requestorname,
        equipmentName: data.equipmentname,
        equipmentNo: data.equipmentno,
        equipmentInstallDate: data.equipmentinstalldate ? formatDateForDisplay(data.equipmentinstalldate) : '',
        requisitionNo: data.requisitionno,
        machineNo: data.machineno,
        occurDate: data.occurdate,
        occurTime: data.occurtime,
        requireCompletionDate: data.requirecompletiondate,
        completionTime: data.completiontime,
        existingCondition: data.existingcondition,
        purchaseReqNo: data.purchasereqno,
        costIncurred: data.costincurred != null ? String(data.costincurred) : '',
        correction: data.correction,
        rootCause: data.rootcause,
        technicianName: data.technicianname,
        materialRetrieval: data.materialretrieval,
        cleaningInspection: data.cleaninginspection,
        scheduleStartDate: data.schedulestartdate ? formatDateForHTMLInput(data.schedulestartdate) : '',
        scheduleStartTime: data.schedulestarttime || '',
        scheduleEndDate: data.scheduleenddate ? formatDateForHTMLInput(data.scheduleenddate) : '',
        scheduleEndTime: data.scheduleendtime || '',
        totalHrs: formatTotalHours(data.totalhours),
        inspectionRemarks: data.inspectionremarks,
        inspectionCheckedBy: data.inspectioncheckedby,
        cleanRetrCheckedBy: data.cleanretrcheckedby
    };

    Object.entries(mappings).forEach(([id, value]) => {
        const el = els[id];
        if (!el) return;
        if (el.type === 'checkbox') el.checked = Boolean(value);
        else if (el.type === 'date') el.value = formatDateForHTMLInput(value);
        else el.value = value || '';
    });

    // JSON fields
    if (data.breakdowncodes) populateCheckboxes('breakdownCode', data.breakdowncodes, 'code');
    if (data.poweroptions) populateCheckboxes('powerOption', data.poweroptions);
    if (data.machineoptions) populateCheckboxes('machineOption', data.machineoptions);
    if (data.handleby) populateCheckboxes('handleBy', data.handleby, 'handle');
    if (data.materials_used) populateMaterialsUsed(data.materials_used);

    // Inspection result
    if (data.inspectionresult) {
        if (els.inspectionAccepted) els.inspectionAccepted.checked = data.inspectionresult === 'Accepted';
        if (els.inspectionRejected) els.inspectionRejected.checked = data.inspectionresult === 'Rejected';
    }

    // Roller fields
    if (data.equipmentname && els.equipmentName) {
        els.equipmentName.value = data.equipmentname;
        els.equipmentName.dispatchEvent(new Event('input', { bubbles: true }));

        if (data.recoatingdate) {
            const rc = document.getElementById('recoatingDate');
            if (rc) rc.value = data.recoatingdate;
        }
        if (data.regrindingdate) {
            const rg = document.getElementById('regrindingDate');
            if (rg) rg.value = data.regrindingdate;
        }
    }

    // Trigger dynamic height expansion for loaded content
    if (window.triggerTextareaExpand) {
        window.triggerTextareaExpand();
    }
}

/** Format total hours for display */
function formatTotalHours(hours) {
    if (!hours) return '00:00';
    if (typeof hours === 'string') return hours;
    if (typeof hours === 'number') {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return '00:00';
}

/** Populate checkboxes from various data formats */
function populateCheckboxes(name, data, prefix = '') {
    if (!data) return;

    let opts = typeof data === 'string' ? (() => { try { return JSON.parse(data); } catch { return null; } })() : data;
    if (!opts) return;

    if (Array.isArray(opts)) {
        opts.forEach(item => {
            const variations = [item, prefix ? `${prefix}${item}` : null, prefix ? `${prefix}${item.toUpperCase()}` : null].filter(Boolean);
            for (const id of variations) {
                const cb = document.getElementById(id);
                if (cb) { cb.checked = true; break; }
            }
        });
    } else if (typeof opts === 'object') {
        Object.entries(opts).forEach(([key, checked]) => {
            let cb = document.getElementById(key);
            if (!cb && prefix) cb = document.getElementById(`${prefix}${key.toUpperCase()}`);
            if (cb) cb.checked = Boolean(checked);
        });
    }
}

/** Populate materials used table */
function populateMaterialsUsed(materials) {
    if (!Array.isArray(materials)) return;
    materials.forEach((m, i) => {
        const idx = i + 1;
        const mat = document.getElementById(`materialUsed${idx}`);
        const spec = document.getElementById(`specification${idx}`);
        const qtyU = document.getElementById(`quantityUsed${idx}`);
        const qtyR = document.getElementById(`quantityRetrieved${idx}`);

        if (mat) mat.value = m.material || '';
        if (spec) spec.value = m.specification || '';
        if (qtyU) qtyU.value = m.quantity_used || '';
        if (qtyR) qtyR.value = m.quantity_retrieved || '';
    });
}

// ==========================================
// FORM MODE MANAGEMENT
// ==========================================

function disableAllFormFields() {
    const form = document.getElementById('maintenanceForm');
    if (!form) return;

    form.querySelectorAll('input, select, textarea').forEach(el => {
        // Common: remove any read-only/disabled gray background
        el.style.backgroundColor = '';
        el.style.cursor = 'default';

        if (el.type === 'checkbox' || el.type === 'radio') {
            // Make unclickable but keep visual contrast (don't use disabled=true which fades them)
            el.onclick = (e) => e.preventDefault();
            el.style.pointerEvents = 'none';
        } else if (el.tagName === 'SELECT') {
            el.disabled = true;
            // Attempt to preserve visual fidelity
            el.style.opacity = '1';
            el.style.color = 'inherit';
        } else {
            el.readOnly = true;
        }
    });

    const submitBtn = form.querySelector('button[type="submit"]');
    const deleteBtn = form.querySelector('.delete-btn');
    if (submitBtn) submitBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';
}

function enableFormFieldsForEdit() {
    const form = document.getElementById('maintenanceForm');
    if (!form) return;

    form.querySelectorAll('input, select, textarea').forEach(el => {
        if (!CONFIG.DISABLED_EDIT_FIELDS.includes(el.id)) {
            el.readOnly = false;
            el.style.backgroundColor = '';
            el.style.cursor = '';
        }
    });

    const submitBtn = form.querySelector('button[type="submit"]');
    const deleteBtn = form.querySelector('.delete-btn');
    if (submitBtn) { submitBtn.style.display = 'block'; submitBtn.textContent = 'Update MJR'; }
    if (deleteBtn) deleteBtn.style.display = 'block';
}

/**
 * Enable only the Inspection Result section for employee editing
 * Used when employees access the form from emp-mjr-table to approve/reject
 */
async function enableInspectionSectionOnly() {
    const form = document.getElementById('maintenanceForm');
    if (!form) return;

    // First, disable all fields
    form.querySelectorAll('input, select, textarea').forEach(el => {
        el.style.backgroundColor = '';
        el.style.cursor = 'default';

        if (el.type === 'checkbox' || el.type === 'radio') {
            el.onclick = (e) => e.preventDefault();
            el.style.pointerEvents = 'none';
        } else if (el.tagName === 'SELECT') {
            el.disabled = true;
            el.style.opacity = '1';
            el.style.color = 'inherit';
        } else {
            el.readOnly = true;
        }
    });

    // Enable only inspection section fields
    const inspectionAccepted = document.getElementById('inspectionAccepted');
    const inspectionRejected = document.getElementById('inspectionRejected');
    const inspectionCheckedBy = document.getElementById('inspectionCheckedBy');

    if (inspectionAccepted) {
        const wasChecked = inspectionAccepted.checked; // Preserve state
        inspectionAccepted.disabled = false;
        inspectionAccepted.style.pointerEvents = 'auto';
        inspectionAccepted.style.cursor = 'pointer';
        // Remove the preventDefault handler by cloning the element
        const newAccepted = inspectionAccepted.cloneNode(true);
        newAccepted.checked = wasChecked; // Restore state
        inspectionAccepted.parentNode.replaceChild(newAccepted, inspectionAccepted);

        // Update State cache if it exists
        if (State.elements) State.elements.inspectionAccepted = newAccepted;
    }
    if (inspectionRejected) {
        const wasChecked = inspectionRejected.checked; // Preserve state
        inspectionRejected.disabled = false;
        inspectionRejected.style.pointerEvents = 'auto';
        inspectionRejected.style.cursor = 'pointer';
        // Remove the preventDefault handler by cloning the element
        const newRejected = inspectionRejected.cloneNode(true);
        newRejected.checked = wasChecked; // Restore state
        inspectionRejected.parentNode.replaceChild(newRejected, inspectionRejected);

        // Update State cache if it exists
        if (State.elements) State.elements.inspectionRejected = newRejected;
    }
    if (inspectionCheckedBy) {
        inspectionCheckedBy.readOnly = false;
        inspectionCheckedBy.style.cursor = 'text';

        // Auto-populate with current user's name immediately
        (async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile, error } = await supabase
                        .from('users')
                        .select('full_name')
                        .eq('id', user.id)
                        .single();

                    if (!error && profile && profile.full_name && !inspectionCheckedBy.value) {
                        // Only set if field is empty (preserve existing data)
                        inspectionCheckedBy.value = profile.full_name;
                    }
                }
            } catch (error) {
                console.error('Error fetching user name:', error);
            }
        })();
    }

    // Show submit button as "Update MJR"
    const submitBtn = form.querySelector('button[type="submit"]');
    const deleteBtn = form.querySelector('.delete-btn');
    if (submitBtn) {
        submitBtn.style.display = 'block';
        submitBtn.textContent = 'Update MJR';
    }
    if (deleteBtn) {
        deleteBtn.style.display = 'none'; // Hide delete for employees
    }

    // Re-attach mutex event listeners for the cloned checkboxes
    const acceptedCheckbox = document.getElementById('inspectionAccepted');
    const rejectedCheckbox = document.getElementById('inspectionRejected');

    if (acceptedCheckbox && rejectedCheckbox) {
        acceptedCheckbox.addEventListener('change', function () {
            if (this.checked) rejectedCheckbox.checked = false;
        });
        rejectedCheckbox.addEventListener('change', function () {
            if (this.checked) acceptedCheckbox.checked = false;
        });
    }
}

// ==========================================
// FORM EVENT LISTENERS
// ==========================================

function setupFormEventListeners() {
    const els = State.initElements();

    // Inspection radio mutex
    if (els.inspectionAccepted && els.inspectionRejected) {
        els.inspectionAccepted.addEventListener('change', function () {
            if (this.checked) els.inspectionRejected.checked = false;
        });
        els.inspectionRejected.addEventListener('change', function () {
            if (this.checked) els.inspectionAccepted.checked = false;
        });
    }

    const form = els.maintenanceForm;
    if (!form) return;

    // Delete button
    const deleteBtn = document.querySelector('.delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', handleDeleteClick);
    }

    // Form submission
    form.addEventListener('submit', handleFormSubmit);
}

async function handleDeleteClick() {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
        showToast('No MJR record found to delete.', 'error');
        return;
    }

    if (!window.confirm('Are you sure you want to delete this MJR record? This action cannot be undone.')) return;

    try {
        showUploadOverlay(0, null, 'deleting...');
        const { error } = await supabase.from('mt_job_requisition_master').delete().eq('id', id);
        hideUploadOverlay();

        if (error) throw error;

        showToast('MJR record deleted successfully!', 'success');
        setTimeout(() => {
            // Redirect back to appropriate page based on stored history or referrer
            const prevPage = sessionStorage.getItem('mjrFormPrevPage');
            const referrer = document.referrer;

            if (prevPage) {
                window.location.href = prevPage;
            } else if (referrer && referrer.includes('emp-mjr-table.html')) {
                window.location.href = '../html/emp-mjr-table.html';
            } else if (referrer && referrer.includes('mjr-table.html')) {
                window.location.href = '../html/mjr-table.html';
            } else {
                // Fallback to employee dashboard for safety
                window.location.href = '../html/employee-dashboard.html';
            }
        }, 1500);
    } catch (e) {
        hideUploadOverlay();
        showToast('Error deleting record: ' + e.message, 'error');
    }
}

async function handleFormSubmit(event) {
    event.preventDefault();

    const params = new URLSearchParams(window.location.search);
    const existingId = params.get('id');
    const action = params.get('action');
    const els = State.initElements();

    // Check if this is an employee inspection update (from emp-mjr-table)
    const referrer = document.referrer || sessionStorage.getItem('mjrFormPrevPage') || '';
    const isEmployeeInspection = referrer.includes('emp-mjr-table.html') && existingId;

    // Skip full validation for employee inspection mode
    if (!isEmployeeInspection && !validateForm()) return;

    showUploadOverlay(0, null, 'submitting...');
    updateUploadProgress(0);

    try {
        let insertData;

        if (isEmployeeInspection) {
            // Employee inspection mode - only update inspection fields
            // Get fresh references (elements may have been cloned)
            const acceptedCheckbox = document.getElementById('inspectionAccepted');
            const rejectedCheckbox = document.getElementById('inspectionRejected');
            const checkedByField = document.getElementById('inspectionCheckedBy');

            // Get the checked by value - ensure it's not empty
            const checkedByValue = capitalizeWords(checkedByField?.value?.trim() || '');

            if (!checkedByValue) {
                hideUploadOverlay();
                showToast('Checked By field cannot be empty', 'warning');
                return;
            }

            insertData = {
                inspectionresult: null,
                inspectioncheckedby: checkedByValue,
                submission_status: 'completed' // Mark as completed when employee inspects
            };

            // Set inspection result
            if (acceptedCheckbox?.checked) insertData.inspectionresult = 'Accepted';
            else if (rejectedCheckbox?.checked) insertData.inspectionresult = 'Rejected';

            // Validate that at least one inspection option is selected
            if (!insertData.inspectionresult) {
                hideUploadOverlay();
                showToast('Please select Accepted or Rejected', 'warning');
                return;
            }

        } else {
            // Full form submission mode
            insertData = {
                form_type: 'action',
                timestamp: new Date().toISOString(),
                submission_status: 'submitted',
                user_id: State.userId
            };

            // Field mapping
            const fieldMap = {
                reqDept: 'reqdept', reqDeptHOD: 'reqdepthod', requestorName: 'requestorname',
                equipmentName: 'equipmentname', equipmentNo: 'equipmentno', equipmentInstallDate: 'equipmentinstalldate',
                occurDate: 'occurdate', occurTime: 'occurtime', requisitionNo: 'requisitionno',
                machineNo: 'machineno', requireCompletionDate: 'requirecompletiondate', completionTime: 'completiontime',
                existingCondition: 'existingcondition', correction: 'correction', rootCause: 'rootcause',
                technicianName: 'technicianname', materialRetrieval: 'materialretrieval', cleaningInspection: 'cleaninginspection',
                scheduleStartDate: 'schedulestartdate', scheduleStartTime: 'schedulestarttime',
                scheduleEndDate: 'scheduleenddate', scheduleEndTime: 'scheduleendtime', totalHrs: 'totalhours',
                inspectionRemarks: 'inspectionremarks', inspectionCheckedBy: 'inspectioncheckedby',
                cleanRetrCheckedBy: 'cleanretrcheckedby', purchaseReqNo: 'purchasereqno', costIncurred: 'costincurred'
            };

            const dateFields = ['occurDate', 'requireCompletionDate', 'scheduleStartDate', 'scheduleEndDate', 'equipmentInstallDate'];
            const fieldsToCapitalize = ['equipmentName', 'technicianName', 'cleanRetrCheckedBy', 'inspectionCheckedBy'];

            Object.entries(fieldMap).forEach(([formId, dbField]) => {
                const el = els[formId];
                if (!el) return;
                let value = el.value?.trim() || null;

                if (value && dateFields.includes(formId)) value = formatDateForDatabase(value);
                if (value && fieldsToCapitalize.includes(formId)) value = capitalizeWords(value);
                if (formId === 'costIncurred' && value) value = parseFloat(value);

                insertData[dbField] = value;
            });

            // Complex fields
            insertData.breakdowncodes = collectCheckboxValues('breakdownCode');
            insertData.poweroptions = collectCheckboxValues('powerOption');
            insertData.machineoptions = collectCheckboxValues('machineOption');
            insertData.handleby = collectCheckboxValues('handleBy');
            insertData.materials_used = collectMaterialsUsed();

            // Inspection result
            if (els.inspectionAccepted?.checked) insertData.inspectionresult = 'Accepted';
            else if (els.inspectionRejected?.checked) insertData.inspectionresult = 'Rejected';
            else insertData.inspectionresult = null;

            // Roller fields
            if (isRollerEquipment(insertData.equipmentname)) {
                const rc = document.getElementById('recoatingDate')?.value;
                const rg = document.getElementById('regrindingDate')?.value;
                if (rc) insertData.recoatingdate = formatDateForDatabase(rc);
                if (rg) insertData.regrindingdate = formatDateForDatabase(rg);
            }
        }

        updateUploadProgress(50);

        let result;
        if (existingId) {
            // Update existing record (for both edit mode and employee inspection updates)
            // Only remove user_id if it exists (it won't exist in employee inspection mode)
            const updateData = insertData.user_id ? (() => {
                const { user_id, ...rest } = insertData;
                return rest;
            })() : insertData;

            result = await supabase.from('mt_job_requisition_master').update(updateData).eq('id', existingId);
        } else {
            // Create new record
            insertData.id = generateUUID();
            result = await supabase.from('mt_job_requisition_master').insert([insertData]);
        }

        if (result.error) {
            console.error('Supabase error:', result.error);
            throw result.error;
        }

        updateUploadProgress(100);
        setTimeout(() => {
            hideUploadOverlay();
            showToast(existingId ? 'Maintenance Request updated successfully!' : 'Maintenance Request submitted successfully!', 'success');
            if (!existingId) State.elements.maintenanceForm.reset();
            setTimeout(() => {
                // Redirect back to appropriate page based on stored history or referrer
                const prevPage = sessionStorage.getItem('mjrFormPrevPage');
                const referrer = document.referrer;

                if (prevPage) {
                    window.location.href = prevPage;
                } else if (referrer && referrer.includes('emp-mjr-table.html')) {
                    window.location.href = '../html/emp-mjr-table.html';
                } else if (referrer && referrer.includes('mjr-table.html')) {
                    window.location.href = '../html/mjr-table.html';
                } else {
                    // Fallback to employee dashboard for safety
                    window.location.href = '../html/employee-dashboard.html';
                }
            }, 1500);
        }, 500);

    } catch (e) {
        console.error('Submit error:', e);
        hideUploadOverlay();
        showToast('Error: ' + e.message, 'error');
    }
}

// ==========================================
// FORM VALIDATION
// ==========================================

function validateForm() {
    const els = State.initElements();

    const requiredFields = [
        { id: 'reqDept', label: 'Req. Dept.' },
        { id: 'requestorName', label: 'Requestor Name' },
        { id: 'machineNo', label: 'Area / Machine' },
        { id: 'equipmentName', label: 'Equipment Name' },
        { id: 'occurDate', label: 'Date' },
        { id: 'occurTime', label: 'Time' },
        { id: 'requireCompletionDate', label: 'Completion Date' },
        { id: 'completionTime', label: 'Completion Time' },
        { id: 'existingCondition', label: 'Condition' }
    ];

    const missing = requiredFields.filter(f => !els[f.id]?.value?.trim()).map(f => f.label);
    if (missing.length) {
        showToast(`Please fill in: ${missing.join(', ')}.`, 'warning');
        return false;
    }

    // Breakdown code check
    if (!document.querySelectorAll('input[name="breakdownCode"]:checked').length) {
        showToast('Please select at least one breakdown code.', 'warning');
        return false;
    }

    // Schedule validation
    const sDate = els.scheduleStartDate?.value;
    const sTime = els.scheduleStartTime?.value;
    const eDate = els.scheduleEndDate?.value;
    const eTime = els.scheduleEndTime?.value;

    if (sDate && sTime && eDate && eTime) {
        const start = new Date(`${sDate} ${sTime}`);
        const end = new Date(`${eDate} ${eTime}`);
        if (start >= end) {
            showToast('Schedule end time must be after start time.', 'warning');
            return false;
        }
    }

    return true;
}

// ==========================================
// DATA COLLECTION HELPERS
// ==========================================

/** Collect checked values into an array */
function collectCheckboxValues(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
        .map(cb => (cb.value && cb.value !== 'on') ? cb.value : cb.id);
}

function collectMaterialsUsed() {
    const materials = [];
    for (let i = 1; i <= 8; i++) {
        const mat = document.getElementById(`materialUsed${i}`)?.value?.trim();
        const spec = document.getElementById(`specification${i}`)?.value?.trim();
        const qtyU = document.getElementById(`quantityUsed${i}`)?.value?.trim();
        const qtyR = document.getElementById(`quantityRetrieved${i}`)?.value?.trim();

        if (mat || spec || qtyU || qtyR) {
            materials.push({
                material: mat || '',
                specification: spec || '',
                quantity_used: qtyU || '',
                quantity_retrieved: qtyR || ''
            });
        }
    }
    return materials;
}

// ==========================================
// ROLLER FIELDS
// ==========================================

function setupDynamicRollerFields() {
    const rollerFields = document.getElementById('rollerFields');
    if (!rollerFields) return;

    const toggle = () => {
        const input = document.getElementById('equipmentName');
        if (!input) return;

        const isRoller = isRollerEquipment(input.value?.trim());
        rollerFields.style.display = isRoller ? 'block' : 'none';

        if (!isRoller) {
            const rc = document.getElementById('recoatingDate');
            const rg = document.getElementById('regrindingDate');
            if (rc) rc.value = '';
            if (rg) rg.value = '';
        }
    };

    toggle();

    // Event delegation for dynamic input
    document.addEventListener('input', e => {
        if (e.target?.id === 'equipmentName') toggle();
    });
    document.addEventListener('change', e => {
        if (e.target?.id === 'equipmentName') toggle();
    });

    // Periodic check for auto-fill
    if (window.rollerFieldsInterval) clearInterval(window.rollerFieldsInterval);
    window.rollerFieldsInterval = setInterval(toggle, 500);
}

// ==========================================
// UPLOAD OVERLAY
// ==========================================

function showUploadOverlay(progress = 0, onCancel = null, message = 'uploading...') {
    let overlay = document.getElementById('image-upload-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'image-upload-overlay';
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div class="spinner-blur-bg"></div>
        <div class="spinner-content">
            <div class="spinner"></div>
            <div class="progress-text"><span id="upload-progress">${progress}</span>% ${message}</div>
            <button class="cancel-upload-btn" id="cancel-upload-btn" title="Cancel">&times;</button>
        </div>
    `;
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const cancelBtn = document.getElementById('cancel-upload-btn');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            if (onCancel) onCancel();
            hideUploadOverlay();
        };
    }
}

function updateUploadProgress(progress) {
    const el = document.getElementById('upload-progress');
    if (el) el.textContent = progress;
}

function hideUploadOverlay() {
    const overlay = document.getElementById('image-upload-overlay');
    if (overlay) {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function injectSpinnerCSS() {
    if (document.getElementById('spinner-overlay-style')) return;
    const style = document.createElement('style');
    style.id = 'spinner-overlay-style';
    style.textContent = `
#image-upload-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    z-index: 9999; display: none; align-items: center; justify-content: center;
}
.spinner-blur-bg {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(255,255,255,0.7); backdrop-filter: blur(4px); z-index: 1;
}
.spinner-content {
    position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center;
    background: rgba(255,255,255,0.95); border-radius: 12px;
    padding: 32px 40px 24px; box-shadow: 0 4px 32px rgba(0,0,0,0.12);
}
.spinner {
    border: 6px solid #e4e4e4; border-top: 6px solid #002E7D;
    border-radius: 50%; width: 48px; height: 48px;
    animation: spin 1s linear infinite; margin-bottom: 18px;
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.progress-text { font-size: 1.2rem; color: #002E7D; margin-bottom: 18px; }
.cancel-upload-btn {
    position: absolute; top: 8px; right: 8px; background: #fff; border: none;
    font-size: 2rem; color: #d32f2f; cursor: pointer; border-radius: 50%;
    width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
    transition: background 0.2s;
}
.cancel-upload-btn:hover { background: #ffeaea; }
`;
    document.head.appendChild(style);
}