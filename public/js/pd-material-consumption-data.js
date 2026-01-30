import { supabase } from '../supabase-config.js';
import { showToast, storePendingToast } from './toast.js';

/**
 * Generate a UUID v4 string
 * Uses crypto.randomUUID() if available, otherwise fallback implementation
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

let currentHeaderId = null;
let materialData = [];
let dailyLogData = {}; // Separate object for rolls, scrap, etc.
let materialsCatalog = [];
let productsCatalog = [];
let defectsCatalog = [];
let tempIdCounter = 0;
let currentProductTgtWeight = 0;
let currentTraceabilityCode = '';
let isSaving = false; // Safety lock
let isProcessing = false; // Global processing lock

// ===== UNIFIED NUMERIC UTILITIES =====
const NumericUtils = {
  parse: (val) => {
    if (!val) return 0;
    const num = parseFloat(String(val).replace(/[^0-9.-]/g, '').trim());
    return isNaN(num) ? 0 : num;
  },
  
  sum: (array, key) => {
    if (!Array.isArray(array)) return 0;
    return array.reduce((sum, item) => sum + (NumericUtils.parse(item[key]) || 0), 0);
  },
  
  format: (num, decimals = 2) => {
    const parsed = NumericUtils.parse(num);
    return parsed.toFixed(decimals);
  },
  
  validate: (value, columnName = 'Value') => {
    const trimmed = String(value).trim();
    if (trimmed === '-') return true; // Allow placeholder dash
    const num = parseFloat(trimmed);
    if (isNaN(num)) {
      console.warn(`Invalid input for ${columnName}: ${value}`);
      return false;
    }
    if (num < 0) {
      console.warn(`${columnName} cannot be negative: ${num}`);
      return false;
    }
    return true;
  }
};

// ===== ERROR HANDLING UTILITY =====
async function executeWithErrorHandling(asyncFn, errorContext = 'Operation') {
  try {
    return await asyncFn();
  } catch (error) {
    console.error(`${errorContext} Error:`, error);
    // In future, could show user notification here
    throw error;
  }
}

// ===== MATERIAL CATALOG CACHE (O(1) lookups) =====
class MaterialCatalogCache {
  constructor() {
    this.cache = new Map();
    this.lastUpdateTime = 0;
    this.cacheValidityMs = 5 * 60 * 1000; // 5-minute cache
  }
  
  build(catalog) {
    this.cache.clear();
    catalog.forEach(item => {
      this.cache.set(item.id, item);
    });
    this.lastUpdateTime = Date.now();
  }
  
  get(materialId) {
    return this.cache.get(materialId) || null;
  }
  
  isExpired() {
    return Date.now() - this.lastUpdateTime > this.cacheValidityMs;
  }
  
  size() {
    return this.cache.size;
  }
}

// ===== RESOURCE MANAGER (Memory cleanup) =====
class ResourceManager {
  constructor() {
    this.intervals = new Set();
    this.timeouts = new Set();
    this.listeners = [];
  }
  
  addInterval(intervalId) {
    this.intervals.add(intervalId);
    return intervalId;
  }
  
  addTimeout(timeoutId) {
    this.timeouts.add(timeoutId);
    return timeoutId;
  }
  
  addListener(element, event, handler) {
    this.listeners.push({ element, event, handler });
    return handler;
  }
  
  cleanup() {
    // Clear intervals
    this.intervals.forEach(intervalId => clearInterval(intervalId));
    this.intervals.clear();
    // Clear timeouts
    this.timeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.timeouts.clear();
    // Remove listeners
    this.listeners.forEach(({ element, event, handler }) => {
      if (element) element.removeEventListener(event, handler);
    });
    this.listeners = [];
  }
}

const resourceManager = new ResourceManager();
const catalogCache = new MaterialCatalogCache();

/**
 * Debounce utility function - delays function execution until typing stops
 * @param {Function} func - Function to debounce
 * @param {number} wait - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Direct aliases - eliminates wrapper function overhead
const parseNum = (val) => NumericUtils.parse(val);
const validateNumericInput = (value, columnName) => {
  if (!NumericUtils.validate(value, columnName)) {
    showToast(`Invalid input for ${columnName}. Please enter a valid number.`, 'warning');
    return false;
  }
  return true;
};

function getISTTimestamp() {
  const now = new Date();
  const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return istTime.toISOString();
}

function formatDateToDDMMYYYY(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Computes auto-calculated fields for production totals row
 * AUTO-CALCULATION: produced_rolls = accepted_rolls + rejected_rolls
 * AUTO-CALCULATION: std_weight = rolls × currentProductTgtWeight
 * 
 * IMPORTANT: Reads from dailyLogData object (not DOM) to prevent race conditions
 * Updates read-only cells with computed values
 * 
 * @param {HTMLElement} row - The totals table row element to process
 * DEBUG: If std weights don't update, check if currentProductTgtWeight is set in loadHeaderInfo()
 */
function computeRejectedFromRow(row) {
  if (!row) return;
  
  // Read from dailyLogData (prevents race conditions)
  const accNos = NumericUtils.parse(dailyLogData.accepted_rolls_nos);
  const accActual = NumericUtils.parse(dailyLogData.accepted_rolls_actual);
  const rejNos = NumericUtils.parse(dailyLogData.rejected_rolls);
  const rejActual = NumericUtils.parse(dailyLogData.rejected_kgs_actual);

  // AUTO-CALCULATE: produced = accepted + rejected
  const prodNos = accNos + rejNos;
  const prodStd = prodNos * currentProductTgtWeight;
  const accStd = accNos * currentProductTgtWeight;
  const rejStd = rejNos * currentProductTgtWeight;
  const prodActual = accActual + rejActual;

  // If all inputs empty, clear cells
  const hasData = accNos || accActual || rejNos || rejActual;
  if (!hasData) {
    const cells = [
      '[data-column="produced_kgs_std"]',
      '[data-column="produced_rolls"]',
      '[data-column="produced_kgs_actual"]',
      '[data-column="accepted_rolls_std"]',
      '[data-column="rejected_kgs_std"]'
    ];
    cells.forEach(sel => {
      const cell = row.querySelector(sel);
      if (cell) cell.textContent = '';
    });
    return;
  }

  // Update cells with calculated values
  const updates = {
    '[data-column="produced_kgs_std"]': NumericUtils.format(prodStd),
    '[data-column="accepted_rolls_std"]': NumericUtils.format(accStd),
    '[data-column="rejected_kgs_std"]': NumericUtils.format(rejStd),
    '[data-column="produced_rolls"]': String(Math.round(prodNos)),
    '[data-column="produced_kgs_actual"]': NumericUtils.format(prodActual)
  };

  Object.entries(updates).forEach(([sel, value]) => {
    const cell = row.querySelector(sel);
    if (cell) cell.textContent = value && value !== '0.00' ? value : '';
  });
}

/**
 * Renders main material consumption table and totals summary row
 * 
 * LOGIC:
 * - Maps materialData array to HTML rows with inline formatting
 * - Determines material display name (includes "(Loose)" suffix if applicable)
 * - Calculates available quantity display based on material type (Bags for RM, Nos for PM, etc.)
 * - Renders totals row from dailyLogData with auto-calculated fields (yellow background)
 * - Calls setupAllAutocomplete() at end to enable material lookup dropdown
 * 
 * DEBUG: If available qty shows wrong format, check material_type and is_loose flags
 * DEBUG: If totals don't calculate, verify accepted/rejected values are in dailyLogData
 */
function renderMaterialDataTable() {
  const mainBody = document.getElementById('materialMainBody');
  const totalsBody = document.getElementById('materialTotalsBody');
  if (!mainBody || !totalsBody) return;

    mainBody.innerHTML = materialData.map((record, index) => {
    const qtyUsed = record.qty_used !== undefined && record.qty_used !== null ? record.qty_used : '';
    const noOfBags = record.no_of_bags !== undefined && record.no_of_bags !== null ? record.no_of_bags : '';
    const type = (record.material_type || '').toUpperCase();
    const isRM = type === 'RM' || type.includes('RAW') || type.includes('RESIN');
    const isLoose = record.is_loose === true;
    
    // Ensure we don't double-add (Loose) if it's already in the name string
    const cleanName = (record.material_name || '').replace(/\s*\(Loose\)$/i, '');
    const displayName = isLoose ? `${cleanName} (Loose)` : cleanName;

    // Display logic: show the bag count if it exists, otherwise show dash for non-RM or Loose materials
    const skipBags = !isRM || isLoose;
    const bagDisplay = (noOfBags !== '' && noOfBags !== null && !skipBags) ? noOfBags : ((record.material_name && skipBags) ? '-' : '');
    const isBagEditable = isRM && !isLoose;

    // --- 3. LOOKUP UOM & APPLY COLORS ---
    const catalogItem = catalogCache.get(record.material_id) ||
                       materialsCatalog.find(c => c.id === record.material_id);
    const uomValue = catalogItem ? (catalogItem.uom || '-').toUpperCase() : '-';
    
    let uomClass = 'text-gray-600 bg-gray-50'; // Default
    if (uomValue === 'KGS') uomClass = 'text-blue-700 bg-blue-50';
    else if (uomValue === 'NOS') uomClass = 'text-purple-700 bg-purple-50';
    else if (uomValue === 'MTR' || uomValue === 'MTRS') uomClass = 'text-green-700 bg-green-50';
    else if (uomValue === 'RLS' || uomValue === 'ROLLS') uomClass = 'text-orange-700 bg-orange-50';
    else if (uomValue === 'SET') uomClass = 'text-teal-700 bg-teal-50';

    const uomDisplay = uomValue;

    const avail = parseNum(record.qty_available);
    const typeLower = type.toLowerCase();
    let availDisplay = '';

    if (avail > 0) {
      if ((typeLower === 'rm' || typeLower.includes('raw') || typeLower.includes('resin')) && !isLoose) {
        const availBags = Math.round(avail / 25);
        availDisplay = `${availBags} <span class="text-[10px] text-blue-600 font-bold">(${avail} Kgs)</span>`;
      } else if (typeLower === 'ink' || isLoose) {
        availDisplay = `${avail} <span class="text-[10px] text-green-600 font-bold">(Kgs)</span>`;
      } else if (typeLower === 'pm' || typeLower.includes('packing') || typeLower.includes('pack') || typeLower.includes('pallet') || typeLower.includes('core')) {
        availDisplay = `${avail} <span class="text-[10px] text-purple-600 font-bold">(Nos)</span>`;
      } else {
        availDisplay = avail;
      }
    } else if (record.material_name) {
      // Show 0 if material is selected but no stock found
      availDisplay = `<span class="text-red-500 font-bold">0</span>`;
    }

    return `
      <tr data-index="${index}" data-id="${record.id || 'temp-' + index}">
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs font-semibold">${index + 1}</td>
        
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs font-mono text-blue-600 font-bold bg-blue-50" 
            style="display: none;"
            contenteditable="true" data-column="track_id">${record.track_id || ''}</td>

        <td class="border border-gray-300 px-2 py-1.5 text-xs" contenteditable="true" data-column="material_name">${displayName}</td>
        
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs font-medium" contenteditable="true" data-column="qty_available">${availDisplay || ''}</td>

        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="lot_no">${record.lot_no || ''}</td>

        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs ${!isBagEditable ? 'bg-gray-100 text-gray-500' : ''}" 
            contenteditable="${isBagEditable}" data-column="no_of_bags">${bagDisplay}</td>

        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="qty_used">${qtyUsed}</td>

        <td class="border border-gray-300 px-2 py-1 text-center text-[10px] font-black ${uomClass}" data-column="uom_display">
           ${uomDisplay}
        </td>
      </tr>
    `;
  }).join('');

  // Render totals table rows (single row from dailyLogData)
  let totalsHtml = '';
  const hasTotals = (dailyLogData.produced_rolls && String(dailyLogData.produced_rolls).trim() !== '') ||
                    (dailyLogData.produced_kgs_actual && String(dailyLogData.produced_kgs_actual).trim() !== '') ||
                    (dailyLogData.accepted_rolls_nos && String(dailyLogData.accepted_rolls_nos).trim() !== '') ||
                    (dailyLogData.accepted_rolls_actual && String(dailyLogData.accepted_rolls_actual).trim() !== '') ||
                    (dailyLogData.total_scrap && String(dailyLogData.total_scrap).trim() !== '');

  if (hasTotals) {
    totalsHtml = `
      <tr data-index="0" data-id="log-${currentHeaderId}" data-row-type="log">
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="accepted_rolls_nos">${dailyLogData.accepted_rolls_nos || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="accepted_rolls_actual">${dailyLogData.accepted_rolls_actual || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="accepted_rolls_std">${dailyLogData.accepted_rolls_std || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="rejected_rolls">${dailyLogData.rejected_rolls || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="rejected_kgs_actual">${dailyLogData.rejected_kgs_actual || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="rejected_kgs_std">${dailyLogData.rejected_kgs_std || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="produced_rolls">${dailyLogData.produced_rolls || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="produced_kgs_actual">${dailyLogData.produced_kgs_actual || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="produced_kgs_std">${dailyLogData.produced_kgs_std || ''}</td>
      </tr>
    `;
  }

  // If there are no totals rows, show a single default placeholder row so the table isn't empty
  if (!totalsHtml || totalsHtml.trim() === '') {
    // Make placeholder editable and map to first data row (index 0) so edits are captured
    totalsBody.innerHTML = `
      <tr class="placeholder-row" data-index="0" data-id="placeholder-0" data-row-type="log">
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="accepted_rolls_nos"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="accepted_rolls_actual"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="accepted_rolls_std"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="rejected_rolls"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="rejected_kgs_actual"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="rejected_kgs_std"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="produced_rolls"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="produced_kgs_actual"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="produced_kgs_std"> </td>
      </tr>
    `;
  } else {
    totalsBody.innerHTML = totalsHtml;
  }

  // After render, compute rejected for each totals row so read-only cells show correct values
  Array.from(totalsBody.querySelectorAll('tr')).forEach(tr => computeRejectedFromRow(tr));

  // AT THE VERY BOTTOM OF THIS FUNCTION, BEFORE CLOSING BRACE:
  setupAllAutocomplete();
}

/**
 * Sets up unified event listeners for both material and totals tables
 * 
 * LISTENERS:
 * - blur: Commits cell edits to materialData/dailyLogData model
 * - focus: Shows raw numeric values (e.g., bags instead of "5 (125 Kgs)")
 * - input: Real-time calculations for bags→qty and live balance updates
 * - keydown(Enter): Navigates between rows while committing changes
 * 
 * VALIDATION:
 * - Numeric columns validated on blur
 * - Material name lookup triggered on blur
 * - Loose material detection from "(Loose)" suffix
 * 
 * AUTOMATIC CALCULATIONS:
 * - no_of_bags (RM): qty_used = bags × 25
 * - Accepted/Rejected changed: recomputes produced_rolls and std_weights
 * - qty_used changed: refreshes live balances for all rows in same batch
 * 
 * DEBUG: If balance not updating, check if track_id and is_loose flags match
 * DEBUG: If calculations not triggering, ensure row has proper data-index attribute
 */
function setupTableListeners() {
  const mainBody = document.getElementById('materialMainBody');
  const totalsBody = document.getElementById('materialTotalsBody');
  
  if (!mainBody || !totalsBody) {
    // Retry if DOM not ready - table elements must be present before binding listeners
    const timeoutId = setTimeout(() => setupTableListeners(), 50);
    resourceManager.addTimeout(timeoutId);
    return;
  }

  // Unified blur handler for both table bodies
  const onBlur = (e) => {
    if (e.target.contentEditable !== 'true') return;
    const cell = e.target;
    const row = cell.closest('tr');
    if (!row) return;

    const columnType = cell.dataset.column;
    const rowIndex = parseInt(row.dataset.index, 10);
    const rowType = row.dataset.rowType;
    
    // Safety check: for material rows, ensure materialData[rowIndex] exists
    if (rowType !== 'log' && (isNaN(rowIndex) || !materialData[rowIndex])) return;

    let newValue = cell.textContent.trim();
    
    // Check if it's a log column or a material column
    const isLogColumn = ['produced_rolls', 'produced_kgs_std', 'produced_kgs_actual', 'accepted_rolls_nos', 'accepted_rolls_std', 'accepted_rolls_actual', 'rejected_rolls', 'rejected_kgs_std', 'rejected_kgs_actual'].includes(columnType);

    if (isLogColumn || rowType === 'log') {
      dailyLogData[columnType] = newValue;
    } else {
      if (columnType === 'material_name') {
        const isLooseTyped = newValue.toLowerCase().includes('(loose)');
        if (isLooseTyped) {
          newValue = newValue.replace(/\s*\(Loose\)$/i, '').trim();
          materialData[rowIndex].is_loose = true;
        } else {
          materialData[rowIndex].is_loose = false;
        }
      }
      materialData[rowIndex][columnType] = newValue;
    }

    // Validate numeric columns
    if (isLogColumn || rowType === 'log' || ['no_of_bags', 'qty_available', 'qty_used'].includes(columnType)) {
      const val = cell.textContent.trim();
      const displayColumnName = columnType === 'qty_available' ? 'Opening Qty' : columnType;
      if (val && val !== '-' && !validateNumericInput(val, displayColumnName)) {
        cell.textContent = '';
        if (isLogColumn || rowType === 'log') dailyLogData[columnType] = '';
        else materialData[rowIndex][columnType] = '';
        return;
      }
    }

    // If a log column changed, we might need to recompute other log fields
    if (isLogColumn || rowType === 'log') {
      computeRejectedFromRow(row);
      // After computeRejectedFromRow updates the DOM, sync back to dailyLogData
      const logCols = ['produced_rolls', 'produced_kgs_std', 'produced_kgs_actual', 'accepted_rolls_std', 'rejected_kgs_std'];
      logCols.forEach(col => {
        const c = row.querySelector(`[data-column="${col}"]`);
        if (c) dailyLogData[col] = c.textContent.trim();
      });
      return;
    }

    // If Opening Qty or qty_used changed, update qty_balance in the model
    if (columnType === 'qty_available' || columnType === 'qty_used') {
      let val = parseNum(newValue);
      const type = (materialData[rowIndex].material_type || '').toLowerCase();
      const isLoose = materialData[rowIndex].is_loose === true;
      
      // Conversion logic for qty_available based on material type
      if (columnType === 'qty_available') {
        if (val > 0 && (type === 'rm' || type.includes('raw') || type.includes('resin')) && !isLoose) {
          // Input is in Bags, convert to Kgs
          val = val * 25;
        }
        // For ink (Kgs), PM (Nos), and Loose items (Kgs), val remains as is
        materialData[rowIndex].qty_available = val;
        materialData[rowIndex].qty_available_original = val; // Set original as well
      }

      const avail = parseNum(materialData[rowIndex].qty_available);
      const used = parseNum(materialData[rowIndex].qty_used);
      materialData[rowIndex].qty_balance = avail - used;
      
      // If qty_used changed, refresh live balances for other rows using the same batch
      if (columnType === 'qty_used') {
        refreshLiveBalances(true);
      }
      
      // Update the current cell's visual helper without re-rendering the whole table if we didn't refresh all
      if (columnType === 'qty_available') {
        const typeLower = type.toLowerCase();
        if ((typeLower === 'rm' || typeLower.includes('raw') || typeLower.includes('resin')) && !isLoose && avail > 0) {
          const availBags = Math.round(avail / 25);
          cell.innerHTML = `${availBags} <span class="text-[10px] text-blue-600 font-bold">(${avail} Kgs)</span>`;
        } else if ((typeLower === 'ink' || isLoose) && avail > 0) {
          cell.innerHTML = `${avail} <span class="text-[10px] text-green-600 font-bold">(Kgs)</span>`;
        } else if ((typeLower === 'pm' || typeLower.includes('packing') || typeLower.includes('pack') || typeLower.includes('pallet') || typeLower.includes('core')) && avail > 0) {
          cell.innerHTML = `${avail} <span class="text-[10px] text-purple-600 font-bold">(Nos)</span>`;
        } else {
          cell.textContent = avail || '';
        }
      }
    }

    // If material name changed, lookup catalog and populate material details
    if (columnType === 'material_name') {
      const materialName = newValue;
      if (materialName) {
        // Pass the detected is_loose flag to the lookup function
        lookupMaterialAndPopulateDetails(materialName, rowIndex, null, materialData[rowIndex].is_loose);
      } else {
        materialData[rowIndex].material_id = null;
        materialData[rowIndex].material_type = '';
        materialData[rowIndex].is_loose = false;
        // Just clear the current cell instead of re-rendering everything
        cell.textContent = '';
      }
    }

    // If no_of_bags changed, calculate qty_used (ONLY FOR RM AND NOT LOOSE)
    if (columnType === 'no_of_bags' && newValue) {
      const record = materialData[rowIndex];
      const type = (record.material_type || '').toUpperCase();
      const isLoose = record.is_loose === true;
      
      // Only calculate for Raw Materials (RM) that are NOT loose
      if ((type === 'RM' || type.includes('RAW') || type.includes('RESIN')) && !isLoose) {
        const bags = NumericUtils.parse(newValue);
        const calculatedQty = bags * 25;
        materialData[rowIndex].qty_used = calculatedQty;
        
        // Refresh live balances for other rows using the same batch
        refreshLiveBalances(true);
        
        // Update UI for qty_used cell
        const mainRow = mainBody.querySelector(`tr[data-index="${rowIndex}"]`);
        const qtyUsedCell = mainRow && mainRow.querySelector('[data-column="qty_used"]');
        if (qtyUsedCell) qtyUsedCell.textContent = calculatedQty || '';
      }
    }

    // If accepted or rejected changed in totals table, recompute produced and std weights for that totals row
    if (['accepted_rolls_nos','accepted_rolls_actual','rejected_rolls','rejected_kgs_actual'].includes(columnType)) {
      const totalsRow = totalsBody.querySelector(`tr[data-index="${rowIndex}"]`);
      if (totalsRow) computeRejectedFromRow(totalsRow);
    }
  };

  mainBody.addEventListener('blur', onBlur, true);
  totalsBody.addEventListener('blur', onBlur, true);

  // Focus event to clear helpers and show raw input value
  const onFocus = (e) => {
    const cell = e.target;
    const columnType = cell.dataset.column;
    if (columnType !== 'qty_available') return;

    const row = cell.closest('tr');
    const rowIndex = parseInt(row.dataset.index, 10);
    if (isNaN(rowIndex) || !materialData[rowIndex]) return;

    const record = materialData[rowIndex];
    const type = (record.material_type || '').toLowerCase();
    const isRM = type === 'rm' || type.includes('raw') || type.includes('resin');
    const isLoose = record.is_loose === true;
    const isPM = type === 'pm' || type.includes('packing') || type.includes('pack') || type.includes('pallet') || type.includes('core');
    const val = parseNum(record.qty_available);
    
    if (isRM && !isLoose && val > 0) {
      cell.textContent = Math.round(val / 25);
    } else if (val > 0) {
      cell.textContent = val;
    }
    
    // Select all text on focus for easier editing
    setTimeout(() => {
      const range = document.createRange();
      range.selectNodeContents(cell);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }, 0);
  };

  mainBody.addEventListener('focus', onFocus, true);

  // Real-time calculation for bags -> qty
  mainBody.addEventListener('input', (e) => {
    const col = e.target.dataset.column;
    if (col !== 'no_of_bags' && col !== 'qty_available' && col !== 'qty_used') return;
    
    const cell = e.target;
    const row = cell.closest('tr');
    const rowIndex = parseInt(row.dataset.index, 10);
    if (isNaN(rowIndex) || !materialData[rowIndex]) return;

    const newValue = cell.textContent.trim();
    const type = (materialData[rowIndex].material_type || '').toUpperCase();
    const isLoose = materialData[rowIndex].is_loose === true;
    const isRM = (type === 'RM' || type.includes('RAW') || type.includes('RESIN'));

    if (col === 'no_of_bags') {
      materialData[rowIndex].no_of_bags = newValue;
      if (isRM && !isLoose) {
        const bags = NumericUtils.parse(newValue);
        const calculatedQty = bags * 25;
        materialData[rowIndex].qty_used = calculatedQty;
        
        const qtyUsedCell = row.querySelector('[data-column="qty_used"]');
        if (qtyUsedCell) qtyUsedCell.textContent = calculatedQty || '';
        
        // Dynamic live balance update
        refreshLiveBalances(true);
      }
    } else if (col === 'qty_used') {
      materialData[rowIndex].qty_used = newValue;
      // Dynamic live balance update
      refreshLiveBalances(true);
    } else if (col === 'qty_available') {
      let val = NumericUtils.parse(newValue);
      const typeLower = type.toLowerCase();
      
      if ((typeLower === 'rm' || typeLower.includes('raw') || typeLower.includes('resin')) && !isLoose) {
        // User is typing BAGS for RM, convert to KGS for storage/balance
        val = val * 25;
      }
      
      materialData[rowIndex].qty_available = val;
      
      // Update balance in model
      const used = NumericUtils.parse(materialData[rowIndex].qty_used);
      materialData[rowIndex].qty_balance = val - used;
    }
  });

  // Add Enter key navigation within each body: move to next row same column
  const onKeyDown = (e) => {
    if (e.key !== 'Enter' || e.target.contentEditable !== 'true') return;
    e.preventDefault();
    const currentCell = e.target;

    // Commit current cell value before moving focus
    const columnType = currentCell.dataset.column;
    const currentRow = currentCell.closest('tr');
    const rowIndex = parseInt(currentRow.dataset.index, 10);
    const rowType = currentRow.dataset.rowType;

    if (rowType === 'log') {
      dailyLogData[columnType] = currentCell.textContent.trim();
    } else if (!isNaN(rowIndex) && materialData[rowIndex]) {
      let val = currentCell.textContent.trim();
      
      // If it was material_name, trigger the lookup with (Loose) detection
      if (columnType === 'material_name' && val) {
        const isLooseTyped = val.toLowerCase().includes('(loose)');
        const cleanVal = val.replace(/\s*\(Loose\)$/i, '').trim();
        
        materialData[rowIndex].material_name = cleanVal;
        materialData[rowIndex].is_loose = isLooseTyped;
        
        lookupMaterialAndPopulateDetails(cleanVal, rowIndex, null, isLooseTyped);
      } else {
        materialData[rowIndex][columnType] = val;
      }
    }

    if (!currentRow || !columnType || isNaN(rowIndex)) return;

    const nextIndex = rowIndex + 1;
    // Try focus next cell in same table (main or totals depending on where event came from)
    const container = currentRow.parentElement;
    const nextRow = container.querySelector(`tr[data-index="${nextIndex}"]`);
    if (nextRow) {
      const nextCell = nextRow.querySelector(`[data-column="${columnType}"]`);
      if (nextCell && nextCell.contentEditable === 'true') {
        try {
          nextCell.focus();
          // Small delay to ensure focus is stable and DOM hasn't shifted
          setTimeout(() => {
            if (document.contains(nextCell)) {
              const range = document.createRange();
              range.selectNodeContents(nextCell);
              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }, 0);
        } catch (err) {
          console.warn('Navigation focus error:', err);
        }
      }
    }
  };

  mainBody.addEventListener('keydown', onKeyDown);
  totalsBody.addEventListener('keydown', onKeyDown);
}

/**
 * Material catalog lookup with deduplication and staged data fetching
 * 
 * LOGIC:
 * 1. Checks if same lookup is already in progress (prevents duplicate Supabase calls)
 * 2. Looks in local materialsCatalog first (O(1) if cache built)
 * 3. Falls back to Supabase query only if not found locally
 * 4. Attempts to carry forward from existing table rows (same batch)
 * 5. If not in table, fetches from pd_material_staging (warehouse stock)
 * 6. Auto-assigns track_id and qty_available from staging data
 * 7. Inherits is_loose status from previous row if not explicitly specified
 * 
 * PARAMETERS:
 * - materialName: Full name of material (e.g., "2047G" or "2047G (Loose)")
 * - rowIndex: Index in materialData array (-1 means lookup only, don't update row)
 * - catalogItem: (optional) Pre-fetched catalog record for speed
 * - isLooseChoice: (optional) Explicitly set is_loose flag; if false, checks legacy NULL values
 * 
 * SIDE EFFECTS:
 * - Updates materialData[rowIndex] with material_id, material_type, track_id, lot_no, qty_available
 * - Clears qty_used if not already set
 * - Calls renderMaterialDataTable() when done
 * 
 * DEBUG: If track_id not auto-assigned, check pd_material_staging has records with balance_qty > 0
 * DEBUG: If qty_available shows as 0, verify is_loose flag matches staging records
 */
const lookupInProgress = new Set();
async function lookupMaterialAndPopulateDetails(materialName, rowIndex, catalogItem = null, isLooseChoice = false) {
  if (!materialName || rowIndex === -1) return;
  
  const lookupKey = `${materialName}-${rowIndex}`;
  if (lookupInProgress.has(lookupKey)) return;
  
  try {
    lookupInProgress.add(lookupKey);
    
    // FASTER: Use provided catalogItem or find in local catalog first
    let catalogData = catalogItem;
    if (!catalogData) {
      catalogData = materialsCatalog.find(m => m.material_name === materialName);
    }

    // If still not found locally, only then query Supabase
    if (!catalogData) {
      const { data: catalogArray, error: catalogError } = await supabase
        .from('pd_material_catalog')
        .select('id, material_name, material_category, uom, is_loose')
        .eq('material_name', materialName)
        .eq('is_active', true)
        .limit(1);

      catalogData = catalogArray && catalogArray.length > 0 ? catalogArray[0] : null;

      if (catalogError || !catalogData) {
        console.warn('Material not found in catalog:', materialName);
        return;
      }
    }

    if (rowIndex !== -1 && materialData[rowIndex]) {
      // Clear track_id if material changed
      if (materialData[rowIndex].material_id !== catalogData.id) {
        materialData[rowIndex].track_id = '';
        materialData[rowIndex].lot_no = '';
      }
      materialData[rowIndex].material_id = catalogData.id;
      const type = catalogData.material_category || '';
      materialData[rowIndex].material_type = type;
      materialData[rowIndex].is_loose = isLooseChoice;

      // Automatically fetch the latest available Track ID and Lot No
      try {
        const cleanMaterialName = catalogData.material_name.trim();
        
        // 1. Check if this material already exists in the current table (Carry Forward)
        let existingRow = null;
        // Search backwards from the current row to find the most recent entry of the same material
        for (let i = rowIndex - 1; i >= 0; i--) {
          const row = materialData[i];
          if (!row || !row.material_name) continue;

          const rowCleanName = row.material_name.replace(/\s*\(Loose\)$/i, '').trim();
          if (rowCleanName === cleanMaterialName) {
            const rowIsLoose = row.is_loose === true;
            
            // If the user didn't explicitly specify Loose, or if they did and it matches, carry forward
            if (isLooseChoice === rowIsLoose) {
              existingRow = row;
              break;
            } else if (!isLooseChoice && rowIsLoose) {
              // User typed "2047G" but the previous entry was "2047G (Loose)".
              // Carry forward the "Loose" status as well.
          console.log(`Inheriting 'is_loose' status from previous row for ${cleanMaterialName}`);
              materialData[rowIndex].is_loose = true;
              existingRow = row;
              break;
            }
          }
        }

        if (existingRow) {
          // Carry forward from existing row in table
          materialData[rowIndex].track_id = existingRow.track_id;
          materialData[rowIndex].lot_no = existingRow.lot_no || '';
          materialData[rowIndex].is_loose = existingRow.is_loose === true; // Explicitly carry forward boolean
          
          // The new row starts with whatever was left after the previous row's usage
          const currentTableBalance = parseNum(existingRow.qty_available) - parseNum(existingRow.qty_used);
          materialData[rowIndex].qty_available = Math.max(0, currentTableBalance);
          materialData[rowIndex].qty_available_original = parseNum(existingRow.qty_available_original) || parseNum(existingRow.qty_available);
          
          console.log(`Carried forward balance and is_loose for ${cleanMaterialName} (${materialData[rowIndex].is_loose ? 'Loose' : 'Std'}) from Row ${materialData.indexOf(existingRow) + 1}`);
          renderMaterialDataTable();
          return; // Done
        }

        // 2. If not in table, fetch from staging (Warehouse)
        // We prioritize an exact match on is_loose, falling back to NULL for legacy records
        let stagingData = null;
        let stagingError = null;

        // Try exact match first
        const { data: exactData, error: exactErr } = await supabase
          .from('pd_material_staging')
          .select('track_id, lot_no, balance_qty, is_loose')
          .ilike('material_name', cleanMaterialName)
          .eq('is_active', true)
          .gt('balance_qty', 0)
          .eq('is_loose', isLooseChoice)
          .order('created_at', { ascending: true })
          .limit(1);

        if (exactData && exactData.length > 0) {
          stagingData = exactData[0];
        } else {
          // If no exact match and looking for Std (false), check for NULL values (legacy)
          if (!isLooseChoice) {
            const { data: nullData, error: nullErr } = await supabase
              .from('pd_material_staging')
              .select('track_id, lot_no, balance_qty, is_loose')
              .ilike('material_name', cleanMaterialName)
              .eq('is_active', true)
              .gt('balance_qty', 0)
              .is('is_loose', null)
              .order('created_at', { ascending: true })
              .limit(1);
            
            if (nullData && nullData.length > 0) {
              stagingData = nullData[0];
            }
            stagingError = nullErr;
          } else {
            stagingError = exactErr;
          }
        }

        if (stagingData) {
          materialData[rowIndex].track_id = stagingData.track_id;
          materialData[rowIndex].lot_no = stagingData.lot_no || '';
          materialData[rowIndex].qty_available = Math.max(0, parseNum(stagingData.balance_qty));
          materialData[rowIndex].qty_available_original = parseNum(stagingData.balance_qty);
          
          // ONLY overwrite is_loose if the staging record explicitly says so (not null)
          if (stagingData.is_loose !== null && stagingData.is_loose !== undefined) {
            materialData[rowIndex].is_loose = stagingData.is_loose === true;
          }

          console.log(`Fetched ${cleanMaterialName} (${materialData[rowIndex].is_loose ? 'Loose' : 'Std'}) from Warehouse. Balance: ${stagingData.balance_qty}`);
        } else {
          console.log(`No active stock found in staging for: ${cleanMaterialName} (Loose: ${isLooseChoice})`);
          materialData[rowIndex].track_id = materialData[rowIndex].track_id || generateUUID();
          materialData[rowIndex].qty_available = 0;
          materialData[rowIndex].qty_available_original = 0;
        }
      } catch (err) {
        // Silently handle track_id generation errors - UUID fallback will be used on save
      }

      // If no_of_bags is already entered and it's RM, trigger calculation
      const upperType = type.toUpperCase();
      const isRM = (upperType === 'RM' || upperType.includes('RAW') || upperType.includes('RESIN'));
      if (isRM && !isLooseChoice && materialData[rowIndex].no_of_bags) {
        const bags = NumericUtils.parse(materialData[rowIndex].no_of_bags);
        materialData[rowIndex].qty_used = bags * 25;
      }

      // Refresh the table to show the new UOM and calculated Qty
      renderMaterialDataTable();
    }

  } catch (err) {
    console.error('Error looking up material details:', err);
  } finally {
    lookupInProgress.delete(lookupKey);
  }
}

/**
 * Recalculates available quantities for all material rows by batch
 * 
 * LOGIC:
 * 1. Groups rows by track_id + is_loose status (creates unique batch keys)
 * 2. For each batch, tracks running available quantity as rows consume material
 * 3. Updates qty_available for each row based on what previous rows used
 * 4. Optionally updates DOM without full re-render (skipRender=true)
 * 5. Prevents cursor jumping by not updating focused cells
 * 
 * EXAMPLE:
 * If batch has 1000 Kgs, Row1 uses 250, then Row2 should show 750 available
 * 
 * @param {boolean} skipRender - If true, update DOM for non-focused cells only; if false, full re-render
 * DEBUG: If balances incorrect, verify track_id and is_loose flags are consistent across rows
 */
function refreshLiveBalances(skipRender = false) {
  const mainBody = document.getElementById('materialMainBody');
  if (!mainBody) return;

  // 1. Group rows by track_id and is_loose status
  const batches = {};
  materialData.forEach((row, index) => {
    if (row.track_id && row.material_name) {
      const isLoose = row.is_loose === true;
      const batchKey = `${row.track_id}_${isLoose}`;
      
      if (!batches[batchKey]) {
        batches[batchKey] = {
          original_avail: parseNum(row.qty_available_original) || parseNum(row.qty_available) || 0,
          rows: []
        };
      }
      batches[batchKey].rows.push({ data: row, index });
    }
  });

  // 2. Update each row's opening qty based on what previous rows in the same batch/status used
  Object.keys(batches).forEach(batchKey => {
    const batch = batches[batchKey];
    let runningAvail = batch.original_avail;
    
    batch.rows.forEach(item => {
      const rowData = item.data;
      const rowIndex = item.index;
      
      rowData.qty_available = Math.max(0, runningAvail);
      
      // Update UI for this specific row if it's not the one currently being edited
      if (skipRender) {
        const tr = mainBody.querySelector(`tr[data-index="${rowIndex}"]`);
        const availCell = tr ? tr.querySelector('[data-column="qty_available"]') : null;
        
        // Only update if it's NOT the focused element to avoid jumping cursors
        if (availCell && document.activeElement !== availCell) {
          const type = (rowData.material_type || '').toLowerCase();
          const isLoose = rowData.is_loose === true;
          const avail = rowData.qty_available;
          
          let display = '';
          if (avail > 0) {
            if ((type === 'rm' || type.includes('raw') || type.includes('resin')) && !isLoose) {
              const availBags = Math.round(avail / 25);
              display = `${availBags} <span class="text-[10px] text-blue-600 font-bold">(${avail} Kgs)</span>`;
            } else if (type === 'ink' || isLoose) {
              display = `${avail} <span class="text-[10px] text-green-600 font-bold">(Kgs)</span>`;
            } else if (type === 'pm' || type.includes('packing') || type.includes('pack') || type.includes('pallet') || type.includes('core')) {
              display = `${avail} <span class="text-[10px] text-purple-600 font-bold">(Nos)</span>`;
            } else {
              display = avail;
            }
          } else if (rowData.material_name) {
            display = `<span class="text-red-500 font-bold">0</span>`;
          }
          availCell.innerHTML = display;
        }
      }

      // Always subtract qty_used to get the balance for the NEXT row
      runningAvail -= (parseNum(rowData.qty_used) || 0);
    });
  });

  if (!skipRender) {
    renderMaterialDataTable();
  }
}

/**
 * Adds blank material rows to frontend memory ONLY (no database operations)
 * 
 * LOGIC:
 * - Creates temporary row objects with temp-{UUID} IDs
 * - Rows remain in-memory until saveAllMaterialData() is called
 * - Each row initialized with empty material_name and zero qty_used
 * - Re-renders table to show new blank rows for user input
 * 
 * NOTE: Rows are NOT persisted to database until explicit "Save All" click
 * 
 * @param {number} count - Number of blank rows to add (default: 1)
 * ERRORS: Alerts if no header_id selected or isProcessing flag is true
 */
async function addNewRowsToDatabase(count = 1) {
  if (isProcessing) {
    showToast('Please wait for current operation to complete', 'warning');
    return;
  }

  if (!currentHeaderId) {
    showToast('No header selected. Please create a production header first.', 'warning');
    return;
  }

  // Add blank rows ONLY to frontend memory - NO DATABASE OPERATIONS
  for (let i = 0; i < count; i++) {
    const tempRowId = generateUUID(); // Frontend-only identifier
    
    const blankRow = {
        id: `temp-${tempRowId}`,
        temp_row_id: tempRowId,
        header_id: currentHeaderId,
        row_index: materialData.length, // Set initial row_index for new rows
        track_id: null,
      qty_available: 0,
      material_name: '',
      lot_no: '',
      no_of_bags: '',
      bags_used: 0,
      traceability_code: currentTraceabilityCode,
      qty_used: 0,
      material_id: null,
      material_type: '',
      is_loose: false,
      created_at: getISTTimestamp(),
      updated_at: getISTTimestamp()
    };

    // Add to frontend memory only
    materialData.push(blankRow);
  }

  // Re-render table with new blank rows
  renderMaterialDataTable();
}

/**
 * Forces recalculation of standard weights in totals row after target weight change
 * Called after product change or target weight fetch from inline_products_master
 * 
 * LOGIC:
 * - Waits for DOM render to settle (setTimeout)
 * - Calls computeRejectedFromRow() on all rows in totalsBody
 * - Recomputes std_weight = rolls × currentProductTgtWeight
 * DEBUG: If std weights still show old values, check currentProductTgtWeight was updated
 */
function updateExistingRowsStdWeight() {
  // Waits one tick to ensure DOM render completed
  setTimeout(() => {
    const totalsBody = document.getElementById('materialTotalsBody');
    if (totalsBody) {
      Array.from(totalsBody.querySelectorAll('tr')).forEach(tr => computeRejectedFromRow(tr));
    }
  }, 0);
}


/**
 * Master save function: validates, combines, and persists all consumption + log data
 * 
 * WORKFLOW:
 * 1. Validates: Material names required if qty_used > 0
 * 2. Separates: Rows into "insert new" vs "update existing" lists
 * 3. Calls RPC: submit_consumption_batch() for all material rows
 * 4. Saves: Daily log (production, rejects, downtime) via upsert
 * 5. Clears: Frontend memory and reloads fresh data from database
 * 6. Shows: Success alert and re-enables Save button
 * 
 * VALIDATIONS:
 * - Material name required if qty_used > 0
 * - Track ID generated if missing
 * - No blanks rows saved (filters on material_name)
 * - Reject/downtime rows filtered to exclude blanks
 * 
 * ERROR HANDLING:
 * - Sets isSaving flag to prevent concurrent saves
 * - Disables Save button with spinner during operation
 * - Shows console.error on RPC or DB failures
 * - Re-enables button on error or success
 * 
 * DEBUG: Check console for "Material RPC Error" or "Daily Log Error" details
 * DEBUG: If save fails, verify Supabase RLS policies allow insert/update for current user
 */
async function saveAllMaterialData() {
  if (isSaving || isProcessing) return;
  if (!currentHeaderId) {
    showToast('No header selected', 'warning');
    return;
  }

  try {
    // --- VALIDATION: CHECK IF MATERIAL NAME AND TRACK ID ARE PRESENT FOR ROWS WITH QUANTITY ---
    for (let i = 0; i < materialData.length; i++) {
      const row = materialData[i];
      const qtyUsed = parseNum(row.qty_used);
      if (qtyUsed > 0) {
        if (!row.material_name) {
          showToast(`Row ${i + 1}: Material name is required if quantity is entered.`, 'warning');
          return;
        }
        // track_id is now auto-assigned or generated on the fly. 
        // If it's still missing for some reason, generate one now to avoid database errors.
        if (!row.track_id || row.track_id === 'MANUAL') {
          row.track_id = generateUUID();
        }
      }
    }

    // --- VALIDATION PASSED - NOW SET FLAGS AND DISABLE BUTTON ---
    isSaving = true;
    isProcessing = true;
    const saveBtn = document.getElementById('saveAllMaterialDataBtn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
      saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    // --- SEPARATE ROWS INTO TWO LISTS ---
    const rowsToInsert = materialData.filter(r => {
      const hasMaterial = r.material_name && r.material_name.trim() !== '';
      return hasMaterial && String(r.id).startsWith('temp');
    });

    const rowsToUpdate = materialData.filter(r => 
      r.id && !String(r.id).startsWith('temp')
    );

    // Also check if log data has changed
    const hasLogData = (dailyLogData.produced_rolls && String(dailyLogData.produced_rolls).trim() !== '') ||
                       (dailyLogData.produced_kgs_actual && String(dailyLogData.produced_kgs_actual).trim() !== '') ||
                       (rejectTransferRows && rejectTransferRows.length > 0 && rejectTransferRows[0].product) ||
                       (downtimeRows && downtimeRows.length > 0 && downtimeRows[0].from);

    if (rowsToInsert.length === 0 && rowsToUpdate.length === 0 && !hasLogData) {
      isSaving = false;
      isProcessing = false;
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save fa-xs"></i> Save All';
        saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
      return showToast('No data to save.', 'info');
    }

    // --- CONSOLIDATED SAVE PROCESS (New & Existing Rows via RPC) ---
    const materialPayload = [];
    // Only send rows that have a material name (prevent blank rows in DB)
    const validRows = materialData.filter(r => r.material_name && r.material_name.trim() !== '');
    
    for (const row of validRows) {
      const cat = row.material_name ? materialsCatalog.find(c => c.material_name === row.material_name) : null;
      const visualIndex = materialData.indexOf(row);
      const isTemp = !row.id || String(row.id).startsWith('temp');

      materialPayload.push({
        id: isTemp ? null : row.id, 
        material_id: cat ? cat.id : (row.material_id || null),
        material_name: row.material_name || '',
        material_type: (cat ? cat.material_category : row.material_type) || '',
        is_loose: row.is_loose || false,
        track_id: row.track_id || generateUUID(), 
        lot_no: row.lot_no || '',      
        bags_used: parseNum(row.no_of_bags),
        qty_available: parseNum(row.qty_available),
        qty_used: parseNum(row.qty_used),
        qty_balance: parseNum(row.qty_available) - parseNum(row.qty_used),
        traceability_code: row.traceability_code || currentTraceabilityCode || 'MANUAL',
        row_index: visualIndex
      });
    }

    if (materialPayload.length > 0) {
      const { error: materialError } = await supabase.rpc('submit_consumption_batch', {
        p_header_id: currentHeaderId,
        p_rows: materialPayload
      });
      if (materialError) {
        console.error('Material RPC Error details:', materialError);
        throw materialError;
      }
    }

    // --- SAVE DAILY LOG DATA (Production, Rejects, Downtime) ---
    const processScrapVal = parseNum(document.getElementById('processScrap')?.value);
    const resinScrapVal = parseNum(document.getElementById('resinScrap')?.value);
    const machineScrapVal = parseNum(document.getElementById('machineScrap')?.value);
    const qcScrapVal = parseNum(document.getElementById('qcScrap')?.value);
    const resinBagScrapDetailVal = parseNum(document.getElementById('resinBagScrapDetail')?.value);
    const rewindedScrapVal = parseNum(document.getElementById('rewindedScrap')?.value);
    const processWasteVal = parseNum(document.getElementById('processWaste')?.value);
    const inHouseUseVal = parseNum(document.getElementById('inHouseUse')?.value);
    const othersVal = parseNum(document.getElementById('others')?.value);
    
    // Filter out blank rows from JSONB data before saving
    const validRejectTransfer = (rejectTransferRows || []).filter(r => 
      (r.product && r.product.trim() !== '') || 
      (r.defect && r.defect.trim() !== '') || 
      (r.qty && String(r.qty).trim() !== '')
    );
    const validRejectIssued = (rejectIssuedRows || []).filter(r => 
      (r.product && r.product.trim() !== '') || 
      (r.defect && r.defect.trim() !== '') || 
      (r.qty && String(r.qty).trim() !== '')
    );
    const validDowntime = (downtimeRows || []).filter(r => 
      (r.from && r.from.trim() !== '') || 
      (r.to && r.to.trim() !== '') || 
      (r.description && r.description.trim() !== '')
    );

    const dailyLogPayload = {
      header_id: currentHeaderId,
      produced_rolls: parseNum(dailyLogData.produced_rolls),
      produced_kgs_std: parseNum(dailyLogData.produced_kgs_std),
      produced_kgs_actual: parseNum(dailyLogData.produced_kgs_actual),
      accepted_rolls_nos: parseNum(dailyLogData.accepted_rolls_nos),
      accepted_rolls_actual: parseNum(dailyLogData.accepted_rolls_actual),
      accepted_rolls_std: parseNum(dailyLogData.accepted_rolls_std),
      rejected_rolls: parseNum(dailyLogData.rejected_rolls),
      rejected_kgs_actual: parseNum(dailyLogData.rejected_kgs_actual),
      rejected_kgs_std: parseNum(dailyLogData.rejected_kgs_std),
      total_scrap: {
        process_scrap: processScrapVal,
        resin_scrap: resinScrapVal,
        machine_scrap: machineScrapVal,
        qc_scrap: qcScrapVal,
        resin_bag_scrap_detail: resinBagScrapDetailVal,
        rewinded_scrap: rewindedScrapVal,
        process_waste: processWasteVal,
        in_house_use: inHouseUseVal,
        others: othersVal
      },
      reject_transfer_data: validRejectTransfer,
      reject_issued_data: validRejectIssued,
      downtime_log_data: validDowntime,
      downtime_description: document.getElementById('downtimeDescription')?.value || '',
      updated_at: new Date().toISOString()
    };

    // If we already have a record ID, include it to ensure update instead of insert
    if (dailyLogData.id) {
      dailyLogPayload.id = dailyLogData.id;
    }

    const { data: logResult, error: logError } = await supabase
      .from('pd_daily_log')
      .upsert(dailyLogPayload, { onConflict: 'header_id' })
      .select();

    if (logError) {
      console.error('Daily Log Error details:', logError);
      throw logError;
    }

    if (logResult && logResult[0]) {
      dailyLogData.id = logResult[0].id;
    }

    showToast('All data saved successfully!', 'success');
    materialData = [];
    await loadMaterialData();

  } catch (err) {
    console.error(err);
    showToast('Error: ' + err.message, 'error');
  } finally {
    isSaving = false;
    isProcessing = false;
    const saveBtn = document.getElementById('saveAllMaterialDataBtn');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-save fa-xs"></i> Save All';
      saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
}

/**
 * Deletes the last (bottom) row from material table
 * 
 * LOGIC:
 * 1. If row has temp ID (not yet saved): removes from frontend only
 * 2. If row has real DB ID: deletes from database (trigger auto-refunds stock)
 * 3. Re-renders table to show change
 * 
 * TRIGGER: Database trigger 'trg_refund_stock_on_delete' automatically updates staging balance
 * ERRORS: Alerts if isProcessing flag is true or no rows to delete
 */
async function deleteTopRow() {
  if (isProcessing) {
    showToast('Please wait for current operation to complete', 'warning');
    return;
  }

  if (materialData.length === 0) {
    showToast('No rows to delete', 'info');
    return;
  }

  const lastRow = materialData[materialData.length - 1];

  // If the row has a real ID (not temporary), it exists in the database - delete it from database too
  if (lastRow.id && !lastRow.id.startsWith('temp-')) {
    try {
      // Delete the consumption record
      // The trigger 'trg_refund_stock_on_delete' will automatically refund the stock
      const { error } = await supabase
        .from('pd_material_consumption_data')
        .delete()
        .eq('id', lastRow.id);

      if (error) {
        console.error('Error deleting from database:', error);
        showToast('Failed to delete row from database', 'error');
        return;
      }
    } catch (err) {
      console.error('Error deleting row:', err);
      showToast('Failed to delete row', 'error');
      return;
    }
  }

  // Remove from frontend memory
  materialData.pop();
  renderMaterialDataTable();
}

/**
 * Loads production header info: date, product, machine, shift, spec, customer
 * Also fetches target weight from inline_products_master and updates totals calculations
 * 
 * SIDE EFFECTS:
 * - Populates DOM elements: headerDate, headerProduct, headerMachine, etc.
 * - Sets currentProductTgtWeight for use in std weight calculations
 * - Calls updateExistingRowsStdWeight() if product changed
 * DEBUG: If target weight not found, check product code exists in inline_products_master
 */
async function loadHeaderInfo() {
  if (!currentHeaderId) {
    // Silent return - currentHeaderId should always be set from URL parameter
    return;
  }
  
  try {
    const { data: header, error } = await supabase
      .from('pd_material_consumption_records')
      .select('*')
      .eq('id', currentHeaderId)
      .single();

    if (error) {
      console.error('Error fetching header:', error);
      return;
    }

    if (header) {
      currentTraceabilityCode = header.traceability_code || '';
      document.getElementById('headerDate').textContent = formatDateToDDMMYYYY(header.production_date);
      document.getElementById('headerProduct').textContent = header.product_code || 'N/A';
      document.getElementById('headerMachine').textContent = header.machine_no || 'N/A';
      document.getElementById('headerShift').textContent = header.shift || 'N/A';
      document.getElementById('headerSpecification').textContent = header.specification || 'N/A';
      document.getElementById('headerCustomer').textContent = header.customer || 'N/A';

      // Fetch target weight from inline_products_master based on product code
      if (header.product_code) {
        try {
          const { data: productData, error: productError } = await supabase
            .from('inline_products_master')
            .select('tgt_weight')
            .eq('prod_code', header.product_code)
            .eq('is_active', true)
            .single();

          if (productError) {
            // Product not found - target weight defaults to 0, std weight calculations will show 0
            currentProductTgtWeight = 0;
          } else {
            currentProductTgtWeight = productData?.tgt_weight || 0;
            // Update existing rows with the new target weight
            updateExistingRowsStdWeight();
          }
        } catch (err) {
          console.error('Error fetching product target weight:', err);
          currentProductTgtWeight = 0;
        }
      } else {
        currentProductTgtWeight = 0;
      }

      // Remove legacy downtime summary display from header - we now use pd_daily_log
      // which is handled in loadMaterialData()
    }
  } catch (err) {
    console.error('Error loading header:', err);
  }
}

async function loadMaterialsCatalog() {
  try {
    const { data, error } = await supabase
      .from('pd_material_catalog')
      .select('id, material_name, material_category, uom, is_loose')
      .eq('is_active', true)
      .order('material_name');

    if (error) {
      console.error('Error loading materials:', error);
      return;
    }

    materialsCatalog = data || [];
  } catch (err) {
    console.error('Error loading materials:', err);
  }
}

async function loadProductsCatalog() {
  try {
    const { data, error } = await supabase
      .from('inline_products_master')
      .select('id, prod_code, customer, spec')
      .eq('is_active', true)
      .order('prod_code');

    if (error) {
      console.error('Error loading products catalog:', error);
      return;
    }

    productsCatalog = data || [];
  } catch (err) {
    console.error('Error loading products catalog:', err);
  }
}

async function loadDefectsCatalog() {
  try {
    const { data, error } = await supabase
      .from('all_defects')
      .select('defect_name')
      .order('defect_name');

    if (error) {
      console.error('Error loading defects catalog:', error);
      return;
    }

    defectsCatalog = (data || []).map(d => d.defect_name);
  } catch (err) {
    console.error('Error loading defects catalog:', err);
  }
}

/**
 * Master data loader: fetches consumption data, daily log, and populates all tables
 * 
 * WORKFLOW:
 * 1. Fetches pd_material_consumption_data rows for current header
 * 2. Fetches pd_daily_log record (null if not saved yet)
 * 3. Maps consumption rows, ensuring no_of_bags/bags_used mapped correctly
 * 4. Populates dailyLogData, rejectTransferRows, rejectIssuedRows, downtimeRows
 * 5. Ensures at least one empty row in each table for user input
 * 6. Calls all render functions: renderMaterialDataTable, renderRejectTransferTable, etc.
 * 
 * ERROR HANDLING:
 * - Sets isProcessing flag during load (prevents concurrent operations)
 * - Silently handles missing log data (common on first load)
 * DEBUG: If tables empty, verify currentHeaderId is correct and rows exist in DB
 */
async function loadMaterialData() {
    if(isProcessing) return;
    isProcessing = true;

    try {
        // 1. Fetch Consumption Data (The Saved Rows)
        const { data: consumptionData, error: consumptionError } = await supabase
            .from('pd_material_consumption_data')
            .select('*')
            .eq('header_id', currentHeaderId)
            .order('row_index', {ascending: true});

        if (consumptionError) throw consumptionError;

        // 2. Fetch Daily Log Data
        const { data: logData, error: logError } = await supabase
            .from('pd_daily_log')
            .select('*')
            .eq('header_id', currentHeaderId)
            .maybeSingle();

        // It's okay if logData is null (no log saved yet) - log data optional on first load
        if (logError) {
            // Silent error - log data not critical on first load
        }

        materialData = (consumptionData || []).map(row => {
           // Ensure we pick up the bag count from either column
           const bags = (row.bags_used !== null && row.bags_used !== undefined) ? row.bags_used : row.no_of_bags;
           const mappedRow = {
             ...row,
             no_of_bags: (bags !== null && bags !== undefined) ? bags : '',
             is_loose: row.is_loose === true, // Ensure boolean
             qty_available_original: row.qty_available_original || row.qty_available || 0,
             qty_balance: row.qty_balance !== undefined ? row.qty_balance : (parseNum(row.qty_available) - parseNum(row.qty_used))
           };
           return mappedRow;
         });

        // 3. If log data exists, store it in dailyLogData
        if (logData) {
            dailyLogData = { ...logData };
            
            // Populate other logs
            rejectTransferRows = logData.reject_transfer_data || [];
            rejectIssuedRows = logData.reject_issued_data || [];
            downtimeRows = logData.downtime_log_data || [];
            
            // Populate scrap inputs
            const scrap = logData.total_scrap || {};
            const resinScrapInput = document.getElementById('resinScrap');
            if (resinScrapInput) {
                resinScrapInput.value = scrap.resin_scrap != null ? scrap.resin_scrap : '';
            }

            // Populate additional scrap details
            if (document.getElementById('machineScrap')) document.getElementById('machineScrap').value = scrap.machine_scrap != null ? scrap.machine_scrap : '';
            if (document.getElementById('qcScrap')) document.getElementById('qcScrap').value = scrap.qc_scrap != null ? scrap.qc_scrap : '';
            if (document.getElementById('resinBagScrapDetail')) document.getElementById('resinBagScrapDetail').value = scrap.resin_bag_scrap_detail != null ? scrap.resin_bag_scrap_detail : '';
            if (document.getElementById('rewindedScrap')) document.getElementById('rewindedScrap').value = scrap.rewinded_scrap != null ? scrap.rewinded_scrap : '';
            if (document.getElementById('processWaste')) document.getElementById('processWaste').value = scrap.process_waste != null ? scrap.process_waste : '';
            if (document.getElementById('inHouseUse')) document.getElementById('inHouseUse').value = scrap.in_house_use != null ? scrap.in_house_use : '';
            if (document.getElementById('others')) document.getElementById('others').value = scrap.others != null ? scrap.others : '';

            // Populate downtime description
            const downtimeDescInput = document.getElementById('downtimeDescription');
            if (downtimeDescInput) {
                downtimeDescInput.value = logData.downtime_description || '';
                // Trigger autosize
                const event = new Event('input', { bubbles: true });
                downtimeDescInput.dispatchEvent(event);
            }

            // Update downtime summary display if data exists
            if (logData.downtime_log_data) {
                updateDowntimeSummaryDisplay();
            }
        } else {
            // Reset if no log data found
            dailyLogData = {};
            rejectTransferRows = [];
            rejectIssuedRows = [];
            downtimeRows = [];
        }
        
        // Ensure at least one blank row for editing if empty
        if (rejectTransferRows.length === 0) {
            rejectTransferRows.push({ id: `rtemp-${rejectTransferTempCounter++}`, product: '', defect: '', qty: '' });
        }
        if (rejectIssuedRows.length === 0) {
            rejectIssuedRows.push({ id: `ritemp-${rejectIssuedTempCounter++}`, product: '', defect: '', qty: '' });
        }
        if (downtimeRows.length === 0) {
            downtimeRows.push({ id: `dtemp-${downtimeTempCounter++}`, from: '', to: '', minutes: '', description: '' });
        }

        // 4. Render the tables
        renderMaterialDataTable();
        renderRejectTransferTable();
        renderRejectIssuedTable();
        renderDowntimeTable();

    } catch (err) {
        // Errors logged; execution continues with partial or empty data
    } finally {
        isProcessing = false;
    }
}

// ===== CLEANUP ON PAGE UNLOAD =====
window.addEventListener('beforeunload', () => {
  resourceManager.cleanup();
});

/**
 * PAGE INITIALIZATION: Loads all catalogs, data, and sets up event listeners
 * 
 * SEQUENCE:
 * 1. Validates header ID from URL parameter
 * 2. Loads header info (product, machine, etc.)
 * 3. Loads catalogs: materials, products, defects
 * 4. Loads material data and daily log
 * 5. Sets up all table listeners and autocomplete
 * 6. Attaches button click handlers
 */
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  currentHeaderId = urlParams.get('id');

  if (!currentHeaderId || currentHeaderId === 'undefined' || currentHeaderId.trim() === '') {
    // Missing header ID - redirect to list page
    showToast('Error: No production record ID provided. Please select a record from the list.', 'error');
    window.location.href = 'pd-material-consumption.html';
    return;
  }

  try {
    // Load catalogs before data so lookups work correctly
    await loadHeaderInfo();
    await loadMaterialsCatalog();
    await loadProductsCatalog();
    await loadDefectsCatalog();
    await loadMaterialData();

    // Small delay to ensure DOM is fully ready on first load
    setTimeout(() => {
      try {
        setupTableListeners();
      } catch (err) {
        console.error('Error setting up table listeners:', err);
      }
    }, 100);

    const addRowsBtn = document.getElementById('addNewRowsBtn');
    if (addRowsBtn) {
      addRowsBtn.addEventListener('click', () => {
        if (isProcessing) {
          showToast('Please wait for current operation to complete', 'warning');
          return;
        }
        addNewRowsToDatabase(1);
      });
    }

    const deleteTopBtn = document.getElementById('deleteTopRowBtn');
    if (deleteTopBtn) {
      deleteTopBtn.addEventListener('click', () => {
        if (isProcessing) {
          showToast('Please wait for current operation to complete', 'warning');
          return;
        }
        deleteTopRow();
      });
    }

    const saveAllBtn = document.getElementById('saveAllMaterialDataBtn');
    if (saveAllBtn) {
      saveAllBtn.addEventListener('click', () => {
        if (isProcessing) {
          showToast('Please wait for current operation to complete', 'warning');
          return;
        }
        saveAllMaterialData();
      });
    }

    // Downtime clear handlers (description + start/end)
    const clearDowntimeBtn = document.getElementById('clearDowntimeBtn');

    if (clearDowntimeBtn) {
      clearDowntimeBtn.addEventListener('click', () => {
        const descEl = document.getElementById('downtimeDescription');
        const startEl = document.getElementById('downtimeStart');
        const endEl = document.getElementById('downtimeEnd');
        if (descEl) descEl.value = '';
        if (startEl) startEl.value = '';
        if (endEl) endEl.value = '';
        // Reset autosize height when cleared
        if (descEl) {
          descEl.style.height = '';
        }
      });
    }

    // Autosize textarea for downtimeDescription: grow vertically with content
    const downtimeTextarea = document.getElementById('downtimeDescription');
    const MIN_DOWNTIME_HEIGHT = 96; // px (increased per user request)
    function autosize(el) {
      if (!el) return;
      el.style.height = 'auto';
      const h = Math.max(el.scrollHeight, MIN_DOWNTIME_HEIGHT);
      el.style.height = h + 'px';
    }
    if (downtimeTextarea) {
      // initialize
      autosize(downtimeTextarea);
      downtimeTextarea.addEventListener('input', (e) => autosize(e.target));
    }

    // Add/remove downtime row buttons (if present)
    const addDowntimeBtn = document.getElementById('addDowntimeRowBtn');
    const deleteDowntimeBtn = document.getElementById('deleteDowntimeRowBtn');
    if (addDowntimeBtn) addDowntimeBtn.addEventListener('click', () => addDowntimeRow());
    if (deleteDowntimeBtn) deleteDowntimeBtn.addEventListener('click', () => deleteDowntimeRow());

    // initial one downtime row and listeners if empty
    if (downtimeRows.length === 0) addDowntimeRow();
    setupDowntimeListeners();

    // Reject Transfer buttons
    const addRejectTransferBtn = document.getElementById('addRejectTransferRowBtn');
    const deleteRejectTransferBtn = document.getElementById('deleteRejectTransferRowBtn');
    if (addRejectTransferBtn) addRejectTransferBtn.addEventListener('click', () => addRejectTransferRow());
    if (deleteRejectTransferBtn) deleteRejectTransferBtn.addEventListener('click', () => deleteRejectTransferRow());

    // Reject Issued buttons
    const addRejectIssuedBtn = document.getElementById('addRejectIssuedRowBtn');
    const deleteRejectIssuedBtn = document.getElementById('deleteRejectIssuedRowBtn');
    if (addRejectIssuedBtn) addRejectIssuedBtn.addEventListener('click', () => addRejectIssuedRow());
    if (deleteRejectIssuedBtn) deleteRejectIssuedBtn.addEventListener('click', () => deleteRejectIssuedRow());

    // Initialize reject tables with one empty row each if empty
    if (rejectTransferRows.length === 0) addRejectTransferRow();
    setupRejectTransferListeners();
    if (rejectIssuedRows.length === 0) addRejectIssuedRow();
    setupRejectIssuedListeners();

    // Setup Scrap listeners
    setupScrapListeners();

  } catch (err) {
    console.error('Fatal error during page initialization:', err);
    showToast('Failed to load page. Error: ' + (err.message || JSON.stringify(err)), 'error');
  }
});

/**
 * CLIENT-SIDE DOWNTIME LOG MANAGEMENT
 * Stores downtime rows in memory; persisted via saveDowntimeBtn or saveAllMaterialDataBtn
 */
let downtimeRows = [];
let downtimeTempCounter = 0;

/**
 * Computes duration in minutes between two HH:MM times
 * Handles day-wrap (e.g., 23:00 to 01:00 = 2 hours)
 * @param {string} fromVal - Start time in HH:MM format
 * @param {string} toVal - End time in HH:MM format
 * @returns {string} Duration in minutes, or empty string if invalid
 */
function computeMinutes(fromVal, toVal) {
  if (!fromVal || !toVal) return '';
  // Expecting HH:MM (time input). Create Date objects for today
  const today = new Date();
  const [fh, fm] = fromVal.split(':').map(Number);
  const [th, tm] = toVal.split(':').map(Number);
  if (isNaN(fh) || isNaN(fm) || isNaN(th) || isNaN(tm)) return '';
  const fromDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), fh, fm);
  let toDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), th, tm);
  if (toDate < fromDate) toDate = new Date(toDate.getTime() + 24 * 60 * 60 * 1000); // next day
  const diffMs = toDate - fromDate;
  const mins = Math.round(diffMs / 60000);
  return String(mins);
}

/**
 * Renders downtime table from downtimeRows array
 * Calls updateDowntimeSummaryDisplay() after render
 */
function renderDowntimeTable() {
  const tbody = document.getElementById('downtimeTableBody');
  if (!tbody) return;
  tbody.innerHTML = downtimeRows.map((r, idx) => {
    return `
      <tr data-id="${r.id}">
        <td class="border border-gray-200 px-2 py-1"><input data-row="${idx}" data-col="from" type="time" value="${r.from || ''}" class="w-full text-xs p-1" /></td>
        <td class="border border-gray-200 px-2 py-1"><input data-row="${idx}" data-col="to" type="time" value="${r.to || ''}" class="w-full text-xs p-1" /></td>
        <td class="border border-gray-200 px-2 py-1 text-center text-xs" data-col="minutes">${r.minutes || ''}</td>
        <td class="border border-gray-200 px-2 py-1 text-xs" contenteditable="true" data-col="description" data-row="${idx}">${r.description || ''}</td>
      </tr>
    `;
  }).join('');
  // Update summary whenever the table is rendered
  updateDowntimeSummaryDisplay();
}

/**
 * Adds blank downtime row to memory and re-renders table
 */
function addDowntimeRow() {
  downtimeRows.push({ id: `dtemp-${downtimeTempCounter++}`, from: '', to: '', minutes: '', description: '' });
  renderDowntimeTable();
}

/**
 * Deletes last downtime row and re-renders table
 */
function deleteDowntimeRow() {
  if (downtimeRows.length === 0) return;
  downtimeRows.pop();
  renderDowntimeTable();
}

/**
 * Sets up event listeners for downtime table using event delegation
 * 
 * LISTENERS:
 * - input: Tracks from/to time changes and recomputes minutes
 * - blur: Commits description text to downtimeRows model
 * 
 * AUTO-CALCULATION: Minutes = computeMinutes(from, to)
 */
function setupDowntimeListeners() {
  const tbody = document.getElementById('downtimeTableBody');
  if (!tbody) return;

  tbody.addEventListener('input', (e) => {
    const target = e.target;
    if (target.tagName.toLowerCase() === 'input' && target.dataset && typeof target.dataset.row !== 'undefined') {
      const rowIdx = parseInt(target.dataset.row, 10);
      const col = target.dataset.col;
      if (isNaN(rowIdx)) return;
      if (col === 'from') downtimeRows[rowIdx].from = target.value;
      if (col === 'to') downtimeRows[rowIdx].to = target.value;
      // Recompute minutes
      const mins = computeMinutes(downtimeRows[rowIdx].from, downtimeRows[rowIdx].to);
      downtimeRows[rowIdx].minutes = mins;
      // Update minutes cell
      const rowEl = tbody.querySelectorAll('tr')[rowIdx];
      if (rowEl) {
        const minCell = rowEl.querySelector('[data-col="minutes"]');
        if (minCell) minCell.textContent = mins;
      }
      // refresh summary display
      updateDowntimeSummaryDisplay();
    }
  });

  // Description blur -> update model
  tbody.addEventListener('blur', (e) => {
    const target = e.target;
    if (target && target.dataset && target.dataset.col === 'description') {
      const rowIdx = parseInt(target.dataset.row, 10);
      if (isNaN(rowIdx)) return;
      downtimeRows[rowIdx].description = target.textContent.trim();
      // refresh summary display
      updateDowntimeSummaryDisplay();
    }
  }, true);
}

/**
 * Builds downtime summary text: total minutes header + line-by-line breakdown
 * @returns {Object} { header: "Total downtime minutes: X;", details: "formatted" }
 */
function buildDowntimeSummary() {
  if (!downtimeRows || downtimeRows.length === 0) {
    return { header: `Total downtime minutes: 0;`, details: '' };
  }
  let totalMinutes = 0;
  const lines = [];
  downtimeRows.forEach((r) => {
    const mins = parseInt(r.minutes || '0', 10) || 0;
    totalMinutes += mins;
    const timeRange = (r.from || '--:--') + ' - ' + (r.to || '--:--');
    const desc = r.description ? `: ${r.description}` : '';
    lines.push(`${timeRange} (${mins} min)${desc}`);
  });
  const header = `Total downtime minutes: ${totalMinutes};`;
  const details = lines.join('\n');
  return { header, details };
}

/**
 * Updates downtime summary display and autosizes textarea
 * Called after downtimeRows changes
 */
function updateDowntimeSummaryDisplay() {
  const headerEl = document.getElementById('downtimeSummaryHeader');
  const detailsEl = document.getElementById('downtimeSummaryDetails');
  if (!headerEl || !detailsEl) return;
  const { header, details } = buildDowntimeSummary();
  headerEl.textContent = header;
  detailsEl.value = details;
  autosizeSummaryDetails(detailsEl);
}

/**
 * Auto-grows textarea height to fit content without scrollbar
 */
function autosizeSummaryDetails(el) {
  if (!el) return;
  el.style.height = 'auto';
  const newH = Math.max(el.scrollHeight, 60);
  el.style.height = newH + 'px';
}

/**
 * CLIENT-SIDE REJECT TRANSFER & ISSUED LOG MANAGEMENT
 * Stores rows in memory; persisted via saveAllMaterialDataBtn
 */
let rejectTransferRows = [];
let rejectTransferTempCounter = 0;
let rejectIssuedRows = [];
let rejectIssuedTempCounter = 0;

/**
 * CONSOLIDATED: Factory function eliminates duplicate render code for both reject tables
 */
function renderRejectTable(tableId, rowsArray) {
  const tbody = document.getElementById(tableId);
  if (!tbody) return;
  tbody.innerHTML = rowsArray.map((r, idx) => `
    <tr data-id="${r.id}">
      <td class="border border-gray-200 px-2 py-1 text-xs" contenteditable="true" data-row="${idx}" data-col="product">${r.product || ''}</td>
      <td class="border border-gray-200 px-2 py-1 text-xs" contenteditable="true" data-row="${idx}" data-col="defect">${r.defect || ''}</td>
      <td class="border border-gray-200 px-2 py-1 text-xs text-center" contenteditable="true" data-row="${idx}" data-col="qty">${r.qty || ''}</td>
    </tr>
  `).join('');
}

// Direct delegation to consolidated factory
const renderRejectTransferTable = () => renderRejectTable('rejectTransferTableBody', rejectTransferRows);
const renderRejectIssuedTable = () => renderRejectTable('rejectIssuedTableBody', rejectIssuedRows);

/**
 * Adds blank reject transfer row and re-renders table
 */
function addRejectTransferRow() {
  rejectTransferRows.push({ id: `rtemp-${rejectTransferTempCounter++}`, product: '', defect: '', qty: '' });
  renderRejectTransferTable();
}

/**
 * Deletes last reject transfer row and re-renders table
 */
function deleteRejectTransferRow() {
  if (rejectTransferRows.length === 0) return;
  rejectTransferRows.pop();
  renderRejectTransferTable();
}

// Consolidated listeners - both transfer and issued use same event logic
// See createRejectTableListeners() factory function below



/**
 * Adds blank reject issued row and re-renders table
 */
function addRejectIssuedRow() {
  rejectIssuedRows.push({ id: `ritemp-${rejectIssuedTempCounter++}`, product: '', defect: '', qty: '' });
  renderRejectIssuedTable();
}

/**
 * Deletes last reject issued row and re-renders table
 */
function deleteRejectIssuedRow() {
  if (rejectIssuedRows.length === 0) return;
  rejectIssuedRows.pop();
  renderRejectIssuedTable();
}

/**
 * CONSOLIDATED: Factory consolidates identical logic for both reject table listeners
 * Reduces 100+ lines of duplicate event binding code
 */
function createRejectTableListeners(tableId, rowsArray) {
  const tbody = document.getElementById(tableId);
  if (!tbody) return;

  // Unified blur handler: update model and validate qty
  tbody.addEventListener('blur', (e) => {
    const target = e.target;
    if (!target.hasAttribute('contenteditable') || !target.dataset?.row) return;
    
    const rowIdx = parseInt(target.dataset.row, 10);
    const col = target.dataset.col;
    if (isNaN(rowIdx) || !rowsArray[rowIdx]) return;

    let val = target.textContent.trim();
    if (col === 'qty' && val && isNaN(parseFloat(val))) {
      showToast('Please enter a valid number for Qty', 'warning');
      target.textContent = rowsArray[rowIdx][col] || '';
      return;
    }
    rowsArray[rowIdx][col] = val;
    setTimeout(closeAutocomplete, 200);
  }, true);

  // Unified input handler: trigger autocomplete for product and defect
  tbody.addEventListener('input', (e) => {
    const target = e.target;
    if (!target.hasAttribute('contenteditable') || !target.dataset?.row) return;
    
    const col = target.dataset.col;
    const searchTerm = target.textContent.trim().toLowerCase();
    
    if (!searchTerm) {
      closeAutocomplete();
      return;
    }

    if (col === 'product') {
      const matches = productsCatalog.filter(p => 
        p.prod_code.toLowerCase().includes(searchTerm) || 
        p.customer?.toLowerCase().includes(searchTerm) ||
        p.spec?.toLowerCase().includes(searchTerm)
      ).slice(0, 20);
      showAutocompleteSuggestions(target, matches, 'product');
    } else if (col === 'defect') {
      const matches = defectsCatalog.filter(d => 
        d.toLowerCase().includes(searchTerm)
      ).slice(0, 20);
      showAutocompleteSuggestions(target, matches, 'defect');
    }
  });
}

function setupRejectTransferListeners() {
  createRejectTableListeners('rejectTransferTableBody', rejectTransferRows);
}
function setupRejectIssuedListeners() {
  createRejectTableListeners('rejectIssuedTableBody', rejectIssuedRows);
}

/**
 * AUTOCOMPLETE FUNCTIONALITY
 * Material name, product code, and defect lookup with local filtering
 * No Supabase per keystroke - uses cached catalogs for performance
 */

/**
 * Builds material catalog cache and attaches autocomplete listeners
 * Called after renderMaterialDataTable() to set up new inputs
 * 
 * PERFORMANCE:
 * - Uses cached materialsCatalog (no RPC per keystroke)
 * - Filters locally and shows up to 20 matches
 * - Rebuilds cache from materialsCatalog on each render
 */
function setupAllAutocomplete() {
  // Rebuild cache for O(1) lookups
  if (materialsCatalog.length > 0) {
    catalogCache.build(materialsCatalog);
  }

  // 1. Material Name Autocomplete
  const materialInputs = document.querySelectorAll('td[data-column="material_name"]');
  materialInputs.forEach(td => {
    if (td.dataset.autocompleteActive) return;
    td.dataset.autocompleteActive = "true";

    td.addEventListener('input', (e) => {
      const searchTerm = e.target.textContent.trim().toLowerCase();
      if (searchTerm.length < 1) {
        closeAutocomplete();
        return;
      }

      // FASTER: Filter from local materialsCatalog instead of Supabase RPC
      const matches = materialsCatalog
        .filter(m => m.material_name.toLowerCase().includes(searchTerm))
        .slice(0, 20);

      showAutocompleteSuggestions(td, matches, 'material');
    });

    td.addEventListener('blur', () => {
      setTimeout(closeAutocomplete, 200);
    });
  });
}

/**
 * Shows autocomplete dropdown with suggestions
 * Creates three types of suggestion items based on 'type' parameter
 * 
 * @param {HTMLElement} targetTd - Cell that triggered the autocomplete
 * @param {Array} suggestions - Array of matching items
 * @param {string} type - 'material' | 'product' | 'defect'
 * 
 * STYLING:
 * - Light blue background for standard, orange for loose
 * - Positioned absolutely below target cell
 * - Hover effects for visual feedback
 */
function showAutocompleteSuggestions(targetTd, suggestions, type) {
    closeAutocomplete(); // Close existing

    if (suggestions.length === 0) return;

    // Create Dropdown Container (Div instead of UL)
    const container = document.createElement('div');
    container.id = 'material-autocomplete-list';
    container.className = 'autocomplete-dropdown';
    container.style.cssText = `
        position: absolute;
        background: #eaf4fb;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
    `;
    
    // Position it
    const rect = targetTd.getBoundingClientRect();
    container.style.top = (rect.bottom + window.scrollY) + 'px';
    container.style.left = (rect.left + window.scrollX) + 'px';
    container.style.width = Math.max(rect.width, type === 'track_id' ? 250 : 200) + 'px';

    suggestions.forEach(item => {
        if (type === 'material') {
            // Option 1: Standard Material
            createSuggestionItem(container, item, targetTd, false);
            
            // Option 2: Loose Material (if enabled in catalog)
            if (item.is_loose) {
                createSuggestionItem(container, item, targetTd, true);
            }
        } else if (type === 'product') {
            createProductSuggestionItem(container, item, targetTd);
        } else if (type === 'defect') {
            createDefectSuggestionItem(container, item, targetTd);
        }
    });

    document.body.appendChild(container);
}

/**
 * Creates a product suggestion item (prod_code, customer, spec)
 * Used in reject transfer/issued tables
 */
function createProductSuggestionItem(container, item, targetTd) {
    const suggestionItem = document.createElement('div');
    suggestionItem.className = 'suggestion-item';
    suggestionItem.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #d1e9f9;
        font-size: 13px;
        transition: background 0.2s;
        background: #eaf4fb;
    `;
    
    suggestionItem.innerHTML = `
        <div style="font-weight: 500; color: #333;">${item.prod_code}</div>
        <div style="font-size: 11px; color: #666; margin-top: 2px;">
            ${item.customer || ''} • ${item.spec || ''}
        </div>
    `;
    
    suggestionItem.onmousedown = (e) => {
        e.preventDefault();
        targetTd.textContent = item.prod_code; 
        
        const rowIdx = parseInt(targetTd.dataset.row, 10);
        const tbody = targetTd.closest('tbody');
        if (tbody.id === 'rejectTransferTableBody') {
            rejectTransferRows[rowIdx].product = item.prod_code;
        } else if (tbody.id === 'rejectIssuedTableBody') {
            rejectIssuedRows[rowIdx].product = item.prod_code;
        }
        
        closeAutocomplete();
    };

    suggestionItem.addEventListener('mouseenter', () => {
        suggestionItem.style.backgroundColor = '#bae6fd';
    });
    suggestionItem.addEventListener('mouseleave', () => {
        suggestionItem.style.backgroundColor = '#eaf4fb';
    });

    container.appendChild(suggestionItem);
}

/**
 * Creates a defect suggestion item (just the defect name)
 * Used in reject transfer/issued tables
 */
function createDefectSuggestionItem(container, item, targetTd) {
    const suggestionItem = document.createElement('div');
    suggestionItem.className = 'suggestion-item';
    suggestionItem.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #d1e9f9;
        font-size: 13px;
        transition: background 0.2s;
        background: #eaf4fb;
    `;
    
    suggestionItem.innerHTML = `
        <div style="font-weight: 500; color: #333;">${item}</div>
    `;
    
    suggestionItem.onmousedown = (e) => {
        e.preventDefault();
        targetTd.textContent = item; 
        
        const rowIdx = parseInt(targetTd.dataset.row, 10);
        const tbody = targetTd.closest('tbody');
        if (tbody.id === 'rejectTransferTableBody') {
            rejectTransferRows[rowIdx].defect = item;
        } else if (tbody.id === 'rejectIssuedTableBody') {
            rejectIssuedRows[rowIdx].defect = item;
        }
        
        closeAutocomplete();
    };

    suggestionItem.addEventListener('mouseenter', () => {
        suggestionItem.style.backgroundColor = '#bae6fd';
    });
    suggestionItem.addEventListener('mouseleave', () => {
        suggestionItem.style.backgroundColor = '#eaf4fb';
    });

    container.appendChild(suggestionItem);
}

/**
 * Creates a material suggestion item with category and UOM
 * Shows both standard and loose variants when available
 * 
 * ON SELECTION:
 * 1. Sets materialData model with material_id, material_type, is_loose
 * 2. Updates No of Bags cell (disable if not RM or if loose)
 * 3. Updates UOM cell with color coding
 * 4. Clears track_id (will be auto-assigned by lookup)
 * 5. Calls lookupMaterialAndPopulateDetails() to fetch staging data
 * 6. Auto-focuses next editable cell (bags or qty_used)
 */
function createSuggestionItem(container, item, targetTd, isLoose) {
    const suggestionItem = document.createElement('div');
    suggestionItem.className = 'suggestion-item';
    suggestionItem.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #d1e9f9;
        font-size: 13px;
        transition: background 0.2s;
        background: ${isLoose ? '#fff7ed' : '#eaf4fb'};
    `;
    
    const displayName = isLoose ? `${item.material_name} (Loose)` : item.material_name;
    const subText = `${item.material_category || 'No category'} • ${item.uom || 'No UOM'}`;
    
    suggestionItem.innerHTML = `
        <div style="font-weight: 500; color: #333;">${displayName}</div>
        <div style="font-size: 11px; color: #666; margin-top: 2px;">
            ${subText}
        </div>
    `;
    
    suggestionItem.onmousedown = (e) => {
        e.preventDefault();
        targetTd.textContent = displayName; 
        const row = targetTd.closest('tr');
        const rowIndex = parseInt(row.dataset.index, 10);
        
        if (materialData[rowIndex]) {
            materialData[rowIndex].material_name = item.material_name;
            materialData[rowIndex].material_id = item.id;
            materialData[rowIndex].material_type = item.material_category || '';
            materialData[rowIndex].is_loose = isLoose;
            
            // --- IMMEDIATE UI UPDATE ---
            const mType = (item.material_category || '').toUpperCase();
            const isRM = mType === 'RM' || mType.includes('RAW') || mType.includes('RESIN');
            
            // Update No of Bags Used immediately
            const bagCell = row.querySelector('[data-column="no_of_bags"]');
            if (bagCell) {
                // If it's loose, disable bags even if it's RM
                const skipBags = !isRM || isLoose;
                const bagDisplay = (item.material_name && skipBags) ? '-' : '';
                bagCell.textContent = bagDisplay;
                bagCell.contentEditable = !skipBags;
                
                if (skipBags) {
                    bagCell.classList.add('bg-gray-100', 'text-gray-500');
                    materialData[rowIndex].no_of_bags = '';
                } else {
                    bagCell.classList.remove('bg-gray-100', 'text-gray-500');
                }
            }
            
            // Update UOM immediately & apply colors
            const uomCell = row.querySelector('[data-column="uom_display"]');
            if (uomCell) {
                const uomVal = (item.uom || '-').toUpperCase();
                uomCell.textContent = uomVal;
                
                // Reset classes then add the specific one
                uomCell.className = 'border border-gray-300 px-2 py-1 text-center text-[10px] font-black';
                
                if (uomVal === 'KGS') uomCell.classList.add('text-blue-700', 'bg-blue-50');
                else if (uomVal === 'NOS') uomCell.classList.add('text-purple-700', 'bg-purple-50');
                else if (uomVal === 'MTR' || uomVal === 'MTRS') uomCell.classList.add('text-green-700', 'bg-green-50');
                else if (uomVal === 'RLS' || uomVal === 'ROLLS') uomCell.classList.add('text-orange-700', 'bg-orange-50');
                else if (uomVal === 'SET') uomCell.classList.add('text-teal-700', 'bg-teal-50');
                else uomCell.classList.add('text-gray-600', 'bg-gray-50');
            }

            // Clear Track ID when material changes
            materialData[rowIndex].track_id = '';
            const trackCell = row.querySelector('[data-column="track_id"]');
            if (trackCell) trackCell.textContent = '';
        }
        
        closeAutocomplete();
        lookupMaterialAndPopulateDetails(item.material_name, rowIndex, item, isLoose);
        
        // Focus logic
        const skipBagsFocus = !((item.material_category || '').toUpperCase().includes('RM')) || isLoose;
        const nextCell = skipBagsFocus ? row.querySelector('[data-column="qty_used"]') : row.querySelector('[data-column="no_of_bags"]');
        if (nextCell) nextCell.focus();
    };

    // Add hover effect
    suggestionItem.addEventListener('mouseenter', () => {
        suggestionItem.style.backgroundColor = isLoose ? '#ffedd5' : '#bae6fd';
    });
    suggestionItem.addEventListener('mouseleave', () => {
        suggestionItem.style.backgroundColor = isLoose ? '#fff7ed' : '#eaf4fb';
    });

    container.appendChild(suggestionItem);
}

/**
 * Removes autocomplete dropdown from DOM
 */
function closeAutocomplete() {
    const existing = document.getElementById('material-autocomplete-list');
    if (existing) existing.remove();
}

/**
 * Sets up listeners for process scrap and resin scrap input fields
 * Updates dailyLogData.total_scrap object when values change
 */
function setupScrapListeners() {
    const fields = [
        'resinScrap', 'machineScrap', 'qcScrap', 
        'resinBagScrapDetail', 'rewindedScrap', 'processWaste', 'inHouseUse', 'others'
    ];

    fields.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', (e) => {
                if (!dailyLogData.total_scrap) dailyLogData.total_scrap = {};
                // Map camelCase ID to snake_case key if needed
                const key = id.replace(/([A-Z])/g, "_$1").toLowerCase();
                dailyLogData.total_scrap[key] = e.target.value;
            });
        }
    });
}
