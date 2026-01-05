import { supabase } from '../supabase-config.js';

let currentHeaderId = null;
let materialData = [];
let materialsCatalog = [];
let tempIdCounter = 0;
let currentProductTgtWeight = 0;
let isSaving = false; // Safety lock
let isProcessing = false; // Global processing lock
let activeStockMaterialIds = new Set(); // Stores IDs of materials currently in staging

// Debounce utility function
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

// Debounced auto-save function for individual rows
const debouncedSaveRow = debounce(async (rowElement) => {
  const rowId = rowElement.dataset.id;
  if (!rowId || rowId.startsWith('temp')) return; // Don't save temp rows

  const rowIndex = Array.from(rowElement.parentNode.children).indexOf(rowElement);
  if (rowIndex === -1 || !materialData[rowIndex]) return;

  const rowData = materialData[rowIndex];
  
  // Don't save if material_id is not set (required field)
  if (!rowData.material_id) {
    console.log('Skipping auto-save: material_id not set for row', rowId);
    return;
  }
  
  // Build update payload from current row data
  const updatePayload = {
    material_id: rowData.material_id, // Required, already validated above
    material_name: rowData.material_name || '',
    material_type: rowData.material_type || '',
    qty_used: parseNum(rowData.qty_used) || 0,
    produced_rolls: parseNum(rowData.produced_rolls) || 0,
    produced_kgs_std: parseNum(rowData.produced_kgs_std) || 0,
    produced_kgs_actual: parseNum(rowData.produced_kgs_actual) || 0,
    accepted_rolls_nos: parseNum(rowData.accepted_rolls_nos) || 0,
    accepted_rolls_std: parseNum(rowData.accepted_rolls_std) || 0,
    accepted_rolls_actual: parseNum(rowData.accepted_rolls_actual) || 0,
    rejected_rolls: parseNum(rowData.rejected_rolls) || 0,
    rejected_kgs_std: parseNum(rowData.rejected_kgs_std) || 0,
    rejected_kgs_actual: parseNum(rowData.rejected_kgs_actual) || 0,
    total_scrap: parseNum(rowData.total_scrap) || 0,
    updated_at: getISTTimestamp()
  };

  try {
    const { error } = await supabase
      .from('pd_material_consumption_data')
      .update(updatePayload)
      .eq('id', rowId);

    if (error) {
      console.error('Auto-save error:', error);
      // Could show a subtle notification here
    } else {
      console.log('Auto-saved row:', rowId);
    }
  } catch (err) {
    console.error('Auto-save failed:', err);
  }
}, 1000); // 1 second debounce

function parseNum(val) {
  if (!val) return 0;
  const num = parseFloat(String(val).replace(/[^0-9.-]/g, '').trim());
  return isNaN(num) ? 0 : num;
}

function validateNumericInput(value, columnName) {
  const num = parseFloat(String(value).trim());
  if (isNaN(num)) {
    alert(`Invalid input for ${columnName}. Please enter a valid number.`);
    return false;
  }
  if (num < 0) {
    alert(`${columnName} cannot be negative.`);
    return false;
  }
  return true;
}

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

// NEW LOGIC: Calculate Produced Rolls = Accepted Rolls + Rejected Rolls
// Also compute std weights: std_weight = rolls × target_weight
function computeRejectedFromRow(row) {
  if (!row) return;
  const getRaw = (sel) => {
    const el = row.querySelector(sel);
    return el ? String(el.textContent || '').trim() : '';
  };

  const accNosRaw = getRaw('[data-column="accepted_rolls_nos"]');
  const accActualRaw = getRaw('[data-column="accepted_rolls_actual"]');

  const rejNosRaw = getRaw('[data-column="rejected_rolls"]');
  const rejActualRaw = getRaw('[data-column="rejected_kgs_actual"]');

  // Get the accepted and rejected numbers
  const accNos = parseNum(accNosRaw);
  const rejNos = parseNum(rejNosRaw);

  // AUTO-CALCULATE: produced = accepted + rejected
  const prodNos = accNos + rejNos;
  const prodStd = prodNos * currentProductTgtWeight;

  // Accepted std weight
  const accStd = accNos * currentProductTgtWeight;

  // Rejected std weight
  const rejStd = rejNos * currentProductTgtWeight;

  // If all related inputs are empty, do not display anything
  if (!accNosRaw && !accActualRaw && !rejNosRaw && !rejActualRaw) {
    const prodStdCell = row.querySelector('[data-column="produced_kgs_std"]');
    const prodNosCell = row.querySelector('[data-column="produced_rolls"]');
    const prodActualCell = row.querySelector('[data-column="produced_kgs_actual"]');
    const accStdCell = row.querySelector('[data-column="accepted_rolls_std"]');
    const rejStdCell = row.querySelector('[data-column="rejected_kgs_std"]');
    if (prodNosCell) prodNosCell.textContent = '';
    if (prodActualCell) prodActualCell.textContent = '';
    if (prodStdCell) prodStdCell.textContent = '';
    if (accStdCell) accStdCell.textContent = '';
    if (rejStdCell) rejStdCell.textContent = '';
    return;
  }

  const accActual = parseNum(accActualRaw);
  const rejActual = parseNum(rejActualRaw);

  // AUTO-CALCULATE: produced_actual = accepted_actual + rejected_actual
  const prodActual = accActual + rejActual;

  // Update all std weight cells
  const prodStdCell = row.querySelector('[data-column="produced_kgs_std"]');
  const accStdCell = row.querySelector('[data-column="accepted_rolls_std"]');
  const rejStdCell = row.querySelector('[data-column="rejected_kgs_std"]');

  if (prodStdCell) prodStdCell.textContent = isNaN(prodStd) || prodStd === 0 ? '' : prodStd.toFixed(2);
  if (accStdCell) accStdCell.textContent = isNaN(accStd) || accStd === 0 ? '' : accStd.toFixed(2);
  if (rejStdCell) rejStdCell.textContent = isNaN(rejStd) || rejStd === 0 ? '' : rejStd.toFixed(2);

  // AUTO-UPDATE: produced_rolls and produced_kgs_actual (read-only display)
  const prodNosCell = row.querySelector('[data-column="produced_rolls"]');
  const prodActualCell = row.querySelector('[data-column="produced_kgs_actual"]');

  if (prodNosCell) prodNosCell.textContent = isNaN(prodNos) || prodNos === 0 ? '' : String(Math.round(prodNos));
  if (prodActualCell) prodActualCell.textContent = isNaN(prodActual) || prodActual === 0 ? '' : prodActual.toFixed(2);
}

function renderMaterialDataTable() {
  const mainBody = document.getElementById('materialMainBody');
  const totalsBody = document.getElementById('materialTotalsBody');
  if (!mainBody || !totalsBody) return;

  mainBody.innerHTML = materialData.map((record, index) => {
    
    // --- FIX START: SHOW TOTAL WAREHOUSE STOCK INSTEAD OF BATCH STOCK ---
    
    let qtyAvail = parseFloat(record.qty_available) || 0; // Default to DB value
    const qtyUsed = parseFloat(record.qty_used) || 0;

    // If we have live stock data, calculate the 'Whole Available' view
    if (record.material_id && globalStockMap[record.material_id] !== undefined) {
         const currentTotalStockInWarehouse = globalStockMap[record.material_id];
         
         // Logic: The 'globalStockMap' is the Live Balance (After Consumption).
         // To show the User what was available *before* they typed this number,
         // we add the Used Qty back to the Current Total.
         
         if (record.id && !String(record.id).startsWith('temp')) {
             // Saved Row: Add back the used amount to show the "Opening Total"
             qtyAvail = currentTotalStockInWarehouse + qtyUsed;
         } else {
             // Temp Row: Usage not deducted yet, so Current Total is the Opening Total
             qtyAvail = currentTotalStockInWarehouse; 
         }
    }
    // --- FIX END ---

    const balance = qtyAvail - qtyUsed; // This is Instock

    // --- 1. COLOR CODING LOGIC (Traffic Light) ---
    let cellClass = 'bg-green-100 text-green-800'; // Default Green
    let percentLeft = 0;

    if (qtyAvail > 0) {
        percentLeft = (balance / qtyAvail) * 100;
    }

    if (balance <= 0.01) {
        // Empty (0%) -> RED
        cellClass = 'bg-red-100 text-red-700 font-bold';
    } else if (percentLeft < 50) {
        // Less than half -> ORANGE
        cellClass = 'bg-orange-100 text-orange-800 font-semibold';
    }
    // (Else stays Green)

    // --- 2. BADGE LOGIC (For New Column) ---
    let alertBadge = '';

    // --- 3. LOOKUP UOM (Needed for alerts too) ---
    // We look for the material in the global catalog to get its UOM (Kgs/Nos)
    const catalogItem = materialsCatalog.find(c => c.id === record.material_id);
    // Default to 'KG' if not found. If 'Kgs' or 'KG', display 'KG'. If 'Nos', display 'NOS'.
    const uomForAlerts = catalogItem && catalogItem.uom ? 
        (catalogItem.uom.toLowerCase() === 'nos' ? 'NOS' : 'KG') : 'KG';

    // Show Badge if Empty (Red) OR Low (Orange < 50%)
    if ((balance <= 0.01 || percentLeft < 50) && record.id && !String(record.id).startsWith('temp')) {
        const factoryStock = globalStockMap[record.material_id] || 0;

        if (factoryStock > 0) {
          alertBadge = `
            <div class="inline-flex items-center h-6 px-2 py-0.5 leading-none text-xs font-semibold text-green-700">
              <i class="fas fa-cubes mr-1 text-xs"></i> In-stock: ${factoryStock.toLocaleString()} ${uomForAlerts}
            </div>`;
        } else {
           alertBadge = `
            <div class="inline-flex items-center h-6 px-2 py-0.5 leading-none text-xs font-semibold text-red-700">
              <i class="fas fa-exclamation-triangle mr-1 text-xs"></i> In-stock: 0 ${uomForAlerts}
            </div>`;
        }
    }

    // --- 1. BUILD DROPDOWN OPTIONS ---
    let lotOptionsHtml = '<option value="" data-balance="0">-- Select Lot --</option>';
    let savedLotFoundInList = false;

    // A. Add "Live" Available Lots from Staging
    if (record.available_lots && record.available_lots.length > 0) {
        record.available_lots.forEach(lot => {
            // Check if this is the selected one
            const isSelected = (record.track_id === lot.id);
            if (isSelected) savedLotFoundInList = true;

            lotOptionsHtml += `<option value="${lot.id}" data-balance="${lot.balance_qty}" ${isSelected ? 'selected' : ''}>
                                    ${lot.lot_no} (${lot.balance_qty} kg)
                               </option>`;
        });
    }

    // B. CRITICAL FIX: If the saved lot is NOT in the "Available" list (e.g., it's fully consumed/0kg),
    // we MUST add it manually so the user sees what they saved.
    if (record.track_id && !savedLotFoundInList && record.lot_no) {
        // We use the saved 'qty_available' as the historical balance snapshot
        lotOptionsHtml += `<option value="${record.track_id}" data-balance="${record.qty_available}" selected>
                                ${record.lot_no} (USED/EMPTY)
                           </option>`;
    }

    // --- 3. LOOKUP UOM ---
    // We look for the material in the global catalog to get its UOM (Kgs/Nos)
    // Default to '-' if not found. If 'Kgs' or 'KG', display 'KGS'. If 'Nos', display 'NOS'.
    const uomDisplay = catalogItem ? (catalogItem.uom || '-').toUpperCase() : '-';

    return `
      <tr data-index="${index}" data-id="${record.id || 'temp-' + index}">
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs font-semibold">${index + 1}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-xs" contenteditable="true" data-column="material_name">${record.material_name || ''}</td>

        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-white p-0">
            <select class="w-full h-full text-xs bg-transparent outline-none text-blue-700 font-mono" 
                    data-column="track_id_select"
                    onchange="handleInternalLotSelection(this, ${index})">
                ${lotOptionsHtml}
            </select>
        </td>

        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-gray-50" contenteditable="false" data-column="qty_available">${qtyAvail.toFixed(2)}</td>

        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="qty_used">${qtyUsed || ''}</td>

        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs ${cellClass}" contenteditable="false" data-column="balance">
            ${balance.toFixed(2)}
        </td>

        <td class="border border-gray-300 px-2 py-1 text-center align-middle w-20 overflow-hidden whitespace-nowrap truncate">
          ${alertBadge}
        </td>

        <td class="border border-gray-300 px-2 py-1 text-center text-xs font-bold text-gray-600 bg-gray-50">
           ${uomDisplay}
        </td>
      </tr>
    `;
  }).join('');

  // Render totals table rows (remaining columns) only for rows that have totals data
  let totalsHtml = '';
  materialData.forEach((record, index) => {
    const hasTotals = (record.produced_rolls && String(record.produced_rolls).trim() !== '') ||
                      (record.produced_kgs_actual && String(record.produced_kgs_actual).trim() !== '') ||
                      (record.accepted_rolls_nos && String(record.accepted_rolls_nos).trim() !== '') ||
                      (record.accepted_rolls_actual && String(record.accepted_rolls_actual).trim() !== '') ||
                      (record.total_scrap && String(record.total_scrap).trim() !== '');

    if (!hasTotals) return; // skip creating an empty totals row for this index

    totalsHtml += `
      <tr data-index="${index}" data-id="${record.id || 'temp-' + index}">
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="produced_rolls">${record.produced_rolls || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="produced_kgs_actual">${record.produced_kgs_actual || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="produced_kgs_std">${record.produced_kgs_std || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="accepted_rolls_nos">${record.accepted_rolls_nos || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="accepted_rolls_actual">${record.accepted_rolls_actual || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="accepted_rolls_std">${record.accepted_rolls_std || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="rejected_rolls">${record.rejected_rolls || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="rejected_kgs_actual">${record.rejected_kgs_actual || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="rejected_kgs_std">${record.rejected_kgs_std || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="total_scrap">${record.total_scrap || ''}</td>
      </tr>
    `;
  });
  // If there are no totals rows, show a single default placeholder row so the table isn't empty
  if (!totalsHtml || totalsHtml.trim() === '') {
    // Make placeholder editable and map to first data row (index 0) so edits are captured
    totalsBody.innerHTML = `
      <tr class="placeholder-row" data-index="0" data-id="placeholder-0">
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="produced_rolls"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="produced_kgs_actual"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="produced_kgs_std"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="accepted_rolls_nos"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="accepted_rolls_actual"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="accepted_rolls_std"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="rejected_rolls"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="rejected_kgs_actual"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="rejected_kgs_std"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="total_scrap"> </td>
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

function setupTableListeners() {
  const mainBody = document.getElementById('materialMainBody');
  const totalsBody = document.getElementById('materialTotalsBody');
  
  if (!mainBody || !totalsBody) {
    console.warn('Table bodies not found. Retrying in 50ms...');
    setTimeout(() => setupTableListeners(), 50);
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
    if (isNaN(rowIndex) || !materialData[rowIndex]) return;

    const newValue = cell.textContent.trim();
    materialData[rowIndex][columnType] = newValue;

    // Validate numeric columns
    if (['qty_used', 'produced_rolls', 'produced_kgs_std', 'produced_kgs_actual', 'accepted_rolls_nos', 'accepted_rolls_std', 'accepted_rolls_actual', 'rejected_rolls', 'rejected_kgs_std', 'rejected_kgs_actual', 'total_scrap'].includes(columnType)) {
      if (cell.textContent.trim() && !validateNumericInput(cell.textContent, columnType)) {
        cell.textContent = '';
        return;
      }
    }

    // If material name changed, lookup catalog and populate available qty (affects main row)
    if (columnType === 'material_name') {
      const materialName = newValue;
      if (materialName) {
        lookupMaterialAndPopulateAvailable(materialName, mainBody.querySelector(`tr[data-index="${rowIndex}"]`), rowIndex);
      } else {
        const mainRow = mainBody.querySelector(`tr[data-index="${rowIndex}"]`);
        const qtyAvailCell = mainRow && mainRow.querySelector('[data-column="qty_available"]');
        const balanceCell = mainRow && mainRow.querySelector('[data-column="balance"]');
        if (qtyAvailCell) qtyAvailCell.textContent = '0';
        if (balanceCell) balanceCell.textContent = '0.00';
        materialData[rowIndex].qty_available = 0;
      }
    }

    // If qty_used changed in main table, update balance cell in main row
    if (columnType === 'qty_used') {
      const mainRow = mainBody.querySelector(`tr[data-index="${rowIndex}"]`);
      const qtyAvailCell = mainRow && mainRow.querySelector('[data-column="qty_available"]');
      const balanceCell = mainRow && mainRow.querySelector('[data-column="balance"]');
      if (qtyAvailCell && balanceCell) {
        const qtyAvail = parseNum(qtyAvailCell.textContent);
        const qtyUsed = parseNum(newValue);
        const balance = qtyAvail - qtyUsed;
        balanceCell.textContent = balance.toFixed(2);
        materialData[rowIndex].qty_balance = balance;
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

  // --- NEW: Handle Dropdown Changes Securely ---
  mainBody.addEventListener('change', (e) => {
    // Only run if the changed element is our Dropdown
    if (e.target.dataset.column === 'track_id_select') {
        const selectEl = e.target;
        const row = selectEl.closest('tr');
        if (!row) return;

        // Get the row index safely from the HTML
        const rowIndex = parseInt(row.dataset.index, 10);
        
        // Call the logic directly (No need for window.handleLotSelection anymore)
        handleInternalLotSelection(selectEl, rowIndex);
    }
  });

  // Add Enter key navigation within each body: move to next row same column
  const onKeyDown = (e) => {
    if (e.key !== 'Enter' || e.target.contentEditable !== 'true') return;
    e.preventDefault();
    const currentCell = e.target;
    const currentRow = currentCell.closest('tr');
    const columnType = currentCell.dataset.column;
    if (!currentRow || !columnType) return;
    const rowIndex = parseInt(currentRow.dataset.index, 10);
    if (isNaN(rowIndex)) return;

    const nextIndex = rowIndex + 1;
    // Try focus next cell in same table (main or totals depending on where event came from)
    const container = currentRow.parentElement;
    const nextRow = container.querySelector(`tr[data-index="${nextIndex}"]`);
    if (nextRow) {
      const nextCell = nextRow.querySelector(`[data-column="${columnType}"]`);
      if (nextCell && nextCell.contentEditable === 'true') {
        nextCell.focus();
        const range = document.createRange();
        range.selectNodeContents(nextCell);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  mainBody.addEventListener('keydown', onKeyDown);
  totalsBody.addEventListener('keydown', onKeyDown);
}

// Lookup material and populate TOTAL available quantity (Sum of all batches)
async function lookupMaterialAndPopulateAvailable(materialName, row, rowIndex) {
  try {
    // 1. Get Material ID - REMOVED .single() to avoid 406 error
    const { data: catalogArray, error: catalogError } = await supabase
      .from('pd_material_catalog')
      .select('id, material_name, material_category, uom')
      .eq('material_name', materialName)
      .eq('is_active', true)
      .limit(1); // Use limit(1) instead of .single()

    const catalogData = catalogArray && catalogArray.length > 0 ? catalogArray[0] : null;

    if (catalogError || !catalogData) {
      console.warn('Material not found in catalog:', materialName);
      updateRowCells(row, rowIndex, 0, null, []);
      return;
    }

    // 2. Fetch ALL Available Batches for this specific ID
    const { data: stagingData, error: stagingError } = await supabase
      .from('pd_material_staging')
      .select('id, lot_no, balance_qty')
      .eq('material_id', catalogData.id)
      .eq('status', 'Available')
      .gt('balance_qty', 0)
      .order('created_at', { ascending: true }); // FIFO

    if (stagingError) {
      updateRowCells(row, rowIndex, 0, catalogData, []);
      return;
    }

    // 3. Calculate Total & Prepare List
    const totalAvailable = stagingData.reduce((sum, batch) => sum + (batch.balance_qty || 0), 0);

    // 4. Update UI
    updateRowCells(row, rowIndex, totalAvailable, catalogData, stagingData);

  } catch (err) {
    console.error('Error looking up material:', err);
    updateRowCells(row, rowIndex, 0, null, []);
  }
}

// Updated Helper to save the list to memory
function updateRowCells(row, rowIndex, qty, catalogData, availableLots = []) {
  const qtyAvailCell = row.querySelector('[data-column="qty_available"]');
  const balanceCell = row.querySelector('[data-column="balance"]');
  
  if (qtyAvailCell) qtyAvailCell.textContent = qty.toFixed(2);
  if (balanceCell) balanceCell.textContent = qty.toFixed(2);

  if (rowIndex !== -1 && materialData[rowIndex]) {
    materialData[rowIndex].qty_available = qty;
    materialData[rowIndex].available_lots = availableLots; // <--- SAVE THE LIST HERE
    if (catalogData) {
      materialData[rowIndex].material_id = catalogData.id;
      materialData[rowIndex].material_type = catalogData.material_category;
    }
    // Refresh the table to show the new Dropdown options
    renderMaterialDataTable();
  }
}

// Handle lot selection from dropdown
// Make globally accessible for inline onchange handler
window.handleInternalLotSelection = function(selectEl, rowIndex) {
    if (!selectEl || !materialData[rowIndex]) return;

    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const trackId = selectEl.value;
    
    // Safety check: ensure text exists before splitting
    const lotText = selectedOption.text ? selectedOption.text.split(' (')[0] : ''; 
    const specificBalance = parseFloat(selectedOption.getAttribute('data-balance')) || 0;

    console.log(`Row ${rowIndex} Selected:`, { trackId, lotText, balance: specificBalance });
    console.log(`BEFORE - materialData[${rowIndex}].lot_no:`, materialData[rowIndex].lot_no);

    // 1. Update Memory (Critical for persistence)
    materialData[rowIndex].track_id = trackId;
    materialData[rowIndex].lot_no = lotText;
    
    console.log(`AFTER - materialData[${rowIndex}].lot_no:`, materialData[rowIndex].lot_no);
    
    // 2. Update UI - Balance Calculation
    const row = selectEl.closest('tr');
    const qtyAvailCell = row.querySelector('[data-column="qty_available"]');
    const balanceCell = row.querySelector('[data-column="balance"]');
    const usedInput = row.querySelector('[data-column="qty_used"]');
    
    if (qtyAvailCell && balanceCell && usedInput) {
        // We use the TOTAL available (displayed in cell) for the calculation 
        // to prevent the "jumping numbers" confusion
        const totalAvailable = parseFloat(qtyAvailCell.textContent) || 0;
        const currentUsed = parseFloat(usedInput.textContent || usedInput.value) || 0;
        
        // Update Balance
        balanceCell.textContent = (totalAvailable - currentUsed).toFixed(2);
        
        // Visual Feedback
        balanceCell.classList.add('bg-blue-50');
        setTimeout(() => balanceCell.classList.remove('bg-blue-50'), 300);
    }
};

async function saveRecordToDatabase(record) {
  try {
    if (!currentHeaderId) {
      alert('No header selected');
      return;
    }

    record.header_id = currentHeaderId;
    record.updated_at = getISTTimestamp();

    let result;
    if (record.id && !String(record.id).startsWith('temp')) {
      result = await supabase
        .from('pd_material_consumption_data')
        .update(record)
        .eq('id', record.id)
        .select();
    } else {
      const { id, ...payload } = record;
      result = await supabase
        .from('pd_material_consumption_data')
        .insert([payload])
        .select();
    }

    const { data: saved, error } = result;
    if (error) {
      console.error('Save error:', error);
      alert('Error saving row');
      return;
    }

    if (saved && saved.length > 0) {
      Object.assign(record, saved[0]);
    }

    alert('Row saved successfully!');
  } catch (err) {
    console.error('Save error:', err);
    alert('Error saving row');
  }
}

function addNewRows(count = 1) {
  for (let i = 0; i < count; i++) {
    materialData.push({
      id: `temp-${tempIdCounter++}`,
      material_id: null, // Will be resolved from catalog when material_name is entered
      material_name: '',
      material_type: '', // Will be resolved from catalog
      qty_available: 0,
      qty_used: '',
      produced_rolls: '',
      produced_kgs_std: '', // Will be calculated as rolls × target_weight
      produced_kgs_actual: '',
      accepted_rolls_nos: '',
      accepted_rolls_std: '', // Will be calculated as rolls × target_weight
      accepted_rolls_actual: '',
      rejected_rolls: '',
      rejected_kgs_std: '', // Will be calculated as (produced - accepted) × target_weight
      rejected_kgs_actual: '',
      total_scrap: ''
    });
  }
  renderMaterialDataTable();
}

// Insert blank rows directly into database
// Insert blank rows directly into database
async function addNewRowsToDatabase(count = 1) {
  if (isProcessing) {
    alert('Please wait for current operation to complete');
    return;
  }

  if (!currentHeaderId) {
    alert('No header selected. Please create a production header first.');
    return;
  }

  // Get traceability_code from header
  let headerTraceabilityCode = null;
  try {
    const { data: header, error } = await supabase
      .from('pd_material_consumption_records')
      .select('traceability_code')
      .eq('id', currentHeaderId)
      .single();

    if (error) {
      console.error('Error fetching header:', error);
      alert('Error fetching header information: ' + error.message);
      return;
    }

    headerTraceabilityCode = header.traceability_code;
  } catch (err) {
    console.error('Error fetching header:', err);
    alert('Error fetching header information');
    return;
  }

  // Add blank rows ONLY to frontend memory - NO DATABASE OPERATIONS
  for (let i = 0; i < count; i++) {
    const tempRowId = crypto.randomUUID(); // Frontend-only identifier
    
    const blankRow = {
      id: `temp-${tempRowId}`, // <--- THIS WAS MISSING! FIX ADDED HERE.
      temp_row_id: tempRowId,
      header_id: currentHeaderId,
      // material_id remains null until material is selected from catalog
      material_name: '',
      material_type: '',
      // track_id will be set when material is selected and FIFO lookup is performed
      traceability_code: headerTraceabilityCode,
      qty_available: 0,
      qty_used: 0,
      qty_balance: 0,
      produced_rolls: 0,
      produced_kgs_std: 0,
      produced_kgs_actual: 0,
      accepted_rolls_nos: 0,
      accepted_rolls_std: 0,
      accepted_rolls_actual: 0,
      rejected_rolls: 0,
      rejected_kgs_std: 0,
      rejected_kgs_actual: 0,
      total_scrap: 0,
      created_at: getISTTimestamp(),
      updated_at: getISTTimestamp()
    };

    // Add to frontend memory only
    materialData.push(blankRow);
  }

  // Re-render table with new blank rows
  renderMaterialDataTable();

  console.log(`Added ${count} blank row(s) to frontend memory`);
}

function updateExistingRowsStdWeight() {
  // Recalculate std weights for all existing rows based on current rolls × target weight
  // This will be called after renderMaterialDataTable to update the DOM
  setTimeout(() => {
    const totalsBody = document.getElementById('materialTotalsBody');
    if (totalsBody) {
      Array.from(totalsBody.querySelectorAll('tr')).forEach(tr => computeRejectedFromRow(tr));
    }
  }, 0);
}

async function saveSingleRow(rowIndex) {
  if (!currentHeaderId) {
    alert('No header selected');
    return;
  }

  const row = materialData[rowIndex];
  if (!row) {
    alert('Row not found');
    return;
  }

  // Validate the row
  const materialName = row.material_name && row.material_name.trim();
  const qtyUsed = parseNum(row.qty_used);

  if (!materialName) {
    alert(`Row ${rowIndex + 1}: Material name is required`);
    return;
  }

  if (qtyUsed <= 0) {
    alert(`Row ${rowIndex + 1}: Quantity used must be greater than 0`);
    return;
  }

  try {
    // A. Lookup Material ID from Catalog
    const { data: catalogData, error: catalogError } = await supabase
      .from('pd_material_catalog')
      .select('id, material_name, material_category')
      .eq('material_name', materialName)
      .eq('is_active', true)
      .single();

    if (catalogError || !catalogData) {
      alert(`Row ${rowIndex + 1}: Material "${materialName}" not found in catalog`);
      return;
    }

    // 2. VALIDATE SELECTION
    // Instead of searching DB, we trust the Dropdown Selection (track_id)
    console.log(`[SAVE DEBUG] Row ${rowIndex}: track_id=${row.track_id}, lot_no=${row.lot_no}`);
    
    if (!row.track_id || !row.lot_no) {
        alert(`Row ${rowIndex + 1}: Please select a Lot Number from the dropdown.`);
        return;
    }

    // 3. FETCH THAT SPECIFIC BATCH
    const { data: stagingData, error: stagingError } = await supabase
        .from('pd_material_staging')
        .select('id, balance_qty, consumed_qty, status, issued_qty') // <--- ADD issued_qty
        .eq('id', row.track_id)
        .single();

    if (stagingError || !stagingData) {
        alert(`Row ${rowIndex + 1}: Selected Lot not found in system (it might be finished).`);
        return;
    }

    // 4. CHECK BALANCE & SAVE
    const screenBalance = stagingData.balance_qty;
    const currentConsumed = stagingData.consumed_qty || 0;

    if (qtyUsed > screenBalance) {
        // BLOCK THEM if they try to use more than the bag has
        alert(`Row ${rowIndex + 1}: Error! You entered ${qtyUsed} KG, but this specific bag (Lot ${row.lot_no}) only has ${screenBalance} KG.`);
        return;
    }

    // D. Check if this is an existing row or new row
    const isExistingRow = row.id && !row.id.startsWith('temp');

    if (isExistingRow) {
      // UPDATE EXISTING ROW
      const consumptionRow = {
        header_id: currentHeaderId,
        material_id: catalogData.id,
        material_name: materialName,
        material_type: catalogData.material_category,
        track_id: stagingData.id,
        traceability_code: row.traceability_code,
        lot_no: row.lot_no, // <--- SAVE THE LOT NO
        qty_available: screenBalance,
        qty_used: qtyUsed,
        qty_balance: screenBalance - qtyUsed,
        produced_rolls: parseNum(row.produced_rolls),
        produced_kgs_std: parseNum(row.produced_kgs_std),
        produced_kgs_actual: parseNum(row.produced_kgs_actual),
        accepted_rolls_nos: parseNum(row.accepted_rolls_nos),
        accepted_rolls_std: parseNum(row.accepted_rolls_std),
        accepted_rolls_actual: parseNum(row.accepted_rolls_actual),
        rejected_rolls: parseNum(row.rejected_rolls),
        rejected_kgs_std: parseNum(row.rejected_kgs_std),
        rejected_kgs_actual: parseNum(row.rejected_kgs_actual),
        total_scrap: parseNum(row.total_scrap),
        row_index: rowIndex, // <--- Add this line
        updated_at: getISTTimestamp()
      };

      // Update existing row
      const { data: updatedData, error: updateError } = await supabase
        .from('pd_material_consumption_data')
        .update(consumptionRow)
        .eq('id', row.id)
        .select()
        .single();

      if (updateError) {
        alert(`Row ${rowIndex + 1}: Failed to update - ${updateError.message}`);
        return;
      }

      // CALCULATE SMART STATUS
      const newBalance = screenBalance - qtyUsed;
      const initialIssued = stagingData.issued_qty || 1; // prevent divide by zero
      let newStatus = 'Available';

      if (newBalance <= 0) {
          newStatus = 'Out of Stock';
      } else if (newBalance <= (initialIssued * 0.20)) {
          newStatus = 'Low Stock'; // < 20%
      }

      // Update staging balance
      const { error: stagingUpdateError } = await supabase
        .from('pd_material_staging')
        .update({
          balance_qty: newBalance,
          consumed_qty: currentConsumed + qtyUsed,
          status: newStatus // <--- Saving Correct Status
        })
        .eq('id', stagingData.id);

      if (stagingUpdateError) {
        console.error('Failed to update staging balance:', stagingUpdateError);
      }

      alert(`Row ${rowIndex + 1} updated successfully!`);

    } else {
      // INSERT NEW ROW using RPC
      const rpcPayload = [{
        material_id: catalogData.id,
        track_id: stagingData.id,
        material_name: materialName,
        material_type: catalogData.material_category,
        traceability_code: row.traceability_code,
        lot_no: row.lot_no,
        qty_available: 0, // Server will calculate this
        qty_used: qtyUsed,
        qty_balance: 0,   // Server will calculate this
        // Stats - include totals data
        produced_rolls: parseNum(row.produced_rolls),
        produced_kgs_std: parseNum(row.produced_kgs_std),
        produced_kgs_actual: parseNum(row.produced_kgs_actual),
        accepted_rolls_nos: parseNum(row.accepted_rolls_nos),
        accepted_rolls_actual: parseNum(row.accepted_rolls_actual),
        accepted_rolls_std: parseNum(row.accepted_rolls_std),
        rejected_rolls: parseNum(row.rejected_rolls),
        rejected_kgs_actual: parseNum(row.rejected_kgs_actual),
        rejected_kgs_std: parseNum(row.rejected_kgs_std),
        total_scrap: parseNum(row.total_scrap),
        row_index: rowIndex // <--- Add this line
      }];

      console.log('[SAVE DEBUG] RPC Payload lot_no:', rpcPayload[0].lot_no);

      const { error } = await supabase.rpc('submit_consumption_batch', {
        p_header_id: currentHeaderId,
        p_rows: rpcPayload
      });

      if (error) throw error;

      alert(`Row ${rowIndex + 1} saved successfully!`);
    }

    // Reload page data to reflect changes
    materialData = [];
    await loadMaterialData();

  } catch (err) {
    console.error('Save Error:', err);
    alert('Error saving row: ' + err.message);
  }
}

async function saveAllMaterialData() {
  if (isSaving || isProcessing) return;
  if (!currentHeaderId) return alert('No header selected');

  const saveBtn = document.getElementById('saveAllMaterialDataBtn');

  try {
    isSaving = true;
    isProcessing = true;
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
      saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    // --- SEPARATE ROWS INTO TWO LISTS ---
    const rowsToInsert = materialData.filter(r => 
      r.material_name && String(r.id).startsWith('temp') && Number(r.qty_used) > 0
    );

    const rowsToUpdate = materialData.filter(r => 
      r.id && !String(r.id).startsWith('temp')
    );

    if (rowsToInsert.length === 0 && rowsToUpdate.length === 0) {
      return alert('No data to save.');
    }

    // --- PROCESS 1: INSERT NEW ROWS ---
    if (rowsToInsert.length > 0) {
      const rpcPayload = [];
      for (const row of rowsToInsert) {
        if (!row.track_id || !row.lot_no) throw new Error(`Row "${row.material_name}" missing Lot No.`);
        
        const { data: catArray } = await supabase.from('pd_material_catalog')
          .select('id, material_category').eq('material_name', row.material_name).limit(1);
        
        const cat = catArray && catArray.length > 0 ? catArray[0] : null;
        if (!cat) throw new Error(`Material "${row.material_name}" not found in catalog.`);

        // FIND THE VISUAL INDEX IN THE MAIN TABLE
        const visualIndex = materialData.indexOf(row);

        rpcPayload.push({
          material_id: cat.id,
          material_name: row.material_name,
          material_type: cat.material_category,
          track_id: row.track_id,
          lot_no: row.lot_no,
          traceability_code: row.traceability_code,
          qty_used: parseFloat(row.qty_used),
          produced_rolls: parseNum(row.produced_rolls),
          produced_kgs_std: parseNum(row.produced_kgs_std),
          produced_kgs_actual: parseNum(row.produced_kgs_actual),
          accepted_rolls_nos: parseNum(row.accepted_rolls_nos),
          accepted_rolls_actual: parseNum(row.accepted_rolls_actual),
          accepted_rolls_std: parseNum(row.accepted_rolls_std),
          rejected_rolls: parseNum(row.rejected_rolls),
          rejected_kgs_actual: parseNum(row.rejected_kgs_actual),
          rejected_kgs_std: parseNum(row.rejected_kgs_std),
          total_scrap: parseNum(row.total_scrap),
          row_index: visualIndex // <--- SEND VISUAL ORDER TO DB
        });
      }

      const { error } = await supabase.rpc('submit_consumption_batch', {
        p_header_id: currentHeaderId,
        p_rows: rpcPayload
      });
      if (error) throw error;
    }

    // --- PROCESS 2: UPDATE EXISTING ROWS ---
    if (rowsToUpdate.length > 0) {
      for (const row of rowsToUpdate) {
        // FIND THE VISUAL INDEX IN THE MAIN TABLE
        const visualIndex = materialData.indexOf(row);

        const updatePayload = {
          produced_rolls: parseNum(row.produced_rolls),
          produced_kgs_std: parseNum(row.produced_kgs_std),
          produced_kgs_actual: parseNum(row.produced_kgs_actual),
          accepted_rolls_nos: parseNum(row.accepted_rolls_nos),
          accepted_rolls_actual: parseNum(row.accepted_rolls_actual),
          accepted_rolls_std: parseNum(row.accepted_rolls_std),
          rejected_rolls: parseNum(row.rejected_rolls),
          rejected_kgs_actual: parseNum(row.rejected_kgs_actual),
          rejected_kgs_std: parseNum(row.rejected_kgs_std),
          total_scrap: parseNum(row.total_scrap),
          row_index: visualIndex, // <--- UPDATE INDEX FOR EXISTING ROWS TOO
          updated_at: getISTTimestamp()
        };

        const { error } = await supabase
          .from('pd_material_consumption_data')
          .update(updatePayload)
          .eq('id', row.id);
          
        if (error) console.error(`Failed to update row ${row.id}`, error);
      }
    }

    alert('✅ All data saved successfully!');
    materialData = [];
    await loadMaterialData();

  } catch (err) {
    console.error(err);
    alert('Error: ' + err.message);
  } finally {
    isSaving = false;
    isProcessing = false;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-save fa-xs"></i> Save All';
      saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
}

async function deleteTopRow() {
  if (isProcessing) {
    alert('Please wait for current operation to complete');
    return;
  }

  if (materialData.length === 0) {
    alert('No rows to delete');
    return;
  }

  // Get the last row (top row in display order since we reverse the array)
  const lastRow = materialData[materialData.length - 1];

  // If the row has a real ID (not temporary), it exists in the database - delete it from database too
  if (lastRow.id && !lastRow.id.startsWith('temp-')) {
    try {
      const { error } = await supabase
        .from('pd_material_consumption_data')
        .delete()
        .eq('id', lastRow.id);

      if (error) {
        console.error('Error deleting from database:', error);
        alert('Failed to delete row from database');
        return;
      }

      console.log('Deleted row from database:', lastRow.id);
    } catch (err) {
      console.error('Error deleting row:', err);
      alert('Failed to delete row');
      return;
    }
  }

  // Remove from frontend memory
  materialData.pop();
  renderMaterialDataTable();

  console.log('Deleted top row from frontend memory');
}

async function loadHeaderInfo() {
  if (!currentHeaderId) {
    console.error('loadHeaderInfo: currentHeaderId is undefined or empty');
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
      console.log('Attempted to fetch with ID:', currentHeaderId);
      return;
    }

    if (header) {
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
            console.warn('Error fetching product target weight:', productError);
            currentProductTgtWeight = 0;
          } else {
            currentProductTgtWeight = productData?.tgt_weight || 0;
            console.log('Loaded target weight for product', header.product_code, ':', currentProductTgtWeight);
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

      // If header contains a precomputed downtime summary, split to header/details and show
      const headerEl = document.getElementById('downtimeSummaryHeader');
      const detailsEl = document.getElementById('downtimeSummaryDetails');
      if (header.downtime_summary && (headerEl || detailsEl)) {
        const raw = header.downtime_summary;
        const parts = raw.split('\n');
        const first = parts.shift() || '';
        const rest = parts.join('\n') || '';
        // If the stored header still contains 'Entries:', strip it for backward compatibility
        const normalizedFirst = first.replace(/^Entries:\s*\d+;\s*/i, '').replace(/Total minutes:/i, 'Total downtime minutes:');
        if (headerEl) headerEl.textContent = normalizedFirst;
        if (detailsEl) {
          detailsEl.value = rest;
          autosizeSummaryDetails(detailsEl);
        }
      }
    }
  } catch (err) {
    console.error('Error loading header:', err);
  }
}

async function loadMaterialsCatalog() {
  try {
    const { data, error } = await supabase
      .from('pd_material_catalog')
      .select('id, material_name, material_category, uom')
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

// Load IDs of all materials that actually have stock in Staging
async function loadActiveStockMaterials() {
    try {
        const { data, error } = await supabase
            .from('pd_material_staging')
            .select('material_id')
            .eq('status', 'Available')
            .gt('balance_qty', 0);

        if (data) {
            // Create a fast lookup Set
            activeStockMaterialIds = new Set(data.map(item => item.material_id));
            console.log('Active Stock Materials loaded:', activeStockMaterialIds.size);
        }
    } catch (err) {
        console.error('Error loading active stock:', err);
    }
}

async function loadMaterialData() {
    if(isProcessing) return;
    isProcessing = true;

    try {
        // 1. Fetch Consumption Data (The Saved Rows)
        const { data, error } = await supabase
            .from('pd_material_consumption_data')
            .select('*')
            .eq('header_id', currentHeaderId)
            .order('row_index', {ascending: true}); // <--- CHANGED FROM 'created_at' TO 'row_index'

        if (error) throw error;
        materialData = data || [];
        
        // 2. Extract Unique Material IDs to fetch their dropdown options
        const materialIds = [...new Set(materialData.map(r => r.material_id).filter(Boolean))];

        if(materialIds.length > 0) {
            // 3. Fetch Staging Data (The Dropdown Options)
            const { data: stockData, error: stockError } = await supabase
                .from('pd_material_staging')
                .select('id, material_id, lot_no, balance_qty, status') // Fetch details needed for dropdown
                .in('material_id', materialIds)
                .gt('balance_qty', 0) // Only get batches with stock
                .eq('status', 'Available')
                .order('created_at', { ascending: true }); // FIFO order

            if (!stockError && stockData) {
                // 4. Map Stock to Global Map AND attach to rows
                globalStockMap = {};
                
                // Group batches by Material ID
                const batchesByMaterial = {};
                stockData.forEach(batch => {
                    // Update Global Total Stock Map
                    if (!globalStockMap[batch.material_id]) globalStockMap[batch.material_id] = 0;
                    globalStockMap[batch.material_id] += batch.balance_qty;

                    // Group for Dropdowns
                    if (!batchesByMaterial[batch.material_id]) batchesByMaterial[batch.material_id] = [];
                    batchesByMaterial[batch.material_id].push(batch);
                });

                // 5. Attach "available_lots" to each row in memory
                materialData.forEach(row => {
                    if (row.material_id && batchesByMaterial[row.material_id]) {
                        row.available_lots = batchesByMaterial[row.material_id];
                    } else {
                        row.available_lots = [];
                    }
                });
            }
        }
        
        // 6. Render the table (Now with dropdowns populated!)
        renderMaterialDataTable();

    } catch (err) {
        console.error('Error loading data:', err);
    } finally {
        isProcessing = false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  currentHeaderId = urlParams.get('id');

  console.log('URL Parameters:', {
    full_url: window.location.href,
    search: window.location.search,
    id_param: currentHeaderId,
    all_params: Object.fromEntries(urlParams)
  });

  if (!currentHeaderId || currentHeaderId === 'undefined' || currentHeaderId.trim() === '') {
    console.error('Invalid or missing header ID. Redirecting...');
    alert('❌ Error: No production record ID provided. Please select a record from the list.');
    window.location.href = 'pd-material-consumption.html';
    return;
  }

  try {
    await Promise.all([
      loadHeaderInfo(),
      loadMaterialsCatalog(),
      loadMaterialData(),
      loadActiveStockMaterials() // <--- ADD THIS
    ]);

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
          alert('Please wait for current operation to complete');
          return;
        }
        addNewRowsToDatabase(1);
      });
    }

    const deleteTopBtn = document.getElementById('deleteTopRowBtn');
    if (deleteTopBtn) {
      deleteTopBtn.addEventListener('click', () => {
        if (isProcessing) {
          alert('Please wait for current operation to complete');
          return;
        }
        deleteTopRow();
      });
    }

    const saveAllBtn = document.getElementById('saveAllMaterialDataBtn');
    if (saveAllBtn) {
      saveAllBtn.addEventListener('click', () => {
        if (isProcessing) {
          alert('Please wait for current operation to complete');
          return;
        }
        saveAllMaterialData();
      });
    }

    // Downtime save/clear handlers (description + start/end)
    const saveDowntimeBtn = document.getElementById('saveDowntimeBtn');
    const clearDowntimeBtn = document.getElementById('clearDowntimeBtn');

    if (saveDowntimeBtn) {
      saveDowntimeBtn.addEventListener('click', async () => {
        const descEl = document.getElementById('downtimeDescription');
        const desc = descEl ? (descEl.value || '').trim() : null;

        // Build a summary object from the log rows
        const { header: summaryHeader, details: summaryDetails } = buildDowntimeSummary();

        // If there is no free-text and no rows, warn
        if (desc === null && (!downtimeRows || downtimeRows.length === 0)) {
          alert('No downtime description or log entries to save.');
          return;
        }

        try {
          if (!currentHeaderId) {
            alert('No header selected to attach downtime');
            return;
          }

          // Save combined summary string (header + newline + details) for backward compatibility
          const combinedSummary = summaryHeader + (summaryDetails ? '\n' + summaryDetails : '');

          const payload = {
            downtime_description: desc || null,
            downtime_summary: combinedSummary || null,
            updated_at: getISTTimestamp()
          };

          const { data, error } = await supabase
            .from('pd_material_consumption_records')
            .update(payload)
            .eq('id', currentHeaderId);

          if (error) {
            console.error('Error saving downtime:', error);
            alert('Error saving downtime');
            return;
          }

          const msg = document.getElementById('downtimeSavedMsg');
          if (msg) {
            msg.classList.remove('hidden');
            setTimeout(() => msg.classList.add('hidden'), 2000);
          }

          // Ensure summary display is up-to-date
          updateDowntimeSummaryDisplay();
        } catch (err) {
          console.error(err);
          alert('Error saving downtime');
        }
      });
    }

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

    // initial one downtime row
    addDowntimeRow();
    setupDowntimeListeners();

  } catch (err) {
    console.error('Fatal error during page initialization:', err);
    alert('❌ Failed to load page. Error: ' + (err.message || JSON.stringify(err)));
  }
});

// Downtime log client-side management
let downtimeRows = [];
let downtimeTempCounter = 0;

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

function addDowntimeRow() {
  downtimeRows.push({ id: `dtemp-${downtimeTempCounter++}`, from: '', to: '', minutes: '', description: '' });
  renderDowntimeTable();
}

function deleteDowntimeRow() {
  if (downtimeRows.length === 0) return;
  downtimeRows.pop();
  renderDowntimeTable();
}

// Setup downtime table listeners (delegation)
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

// Build a structured downtime summary: header and details
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

function updateDowntimeSummaryDisplay() {
  const headerEl = document.getElementById('downtimeSummaryHeader');
  const detailsEl = document.getElementById('downtimeSummaryDetails');
  if (!headerEl || !detailsEl) return;
  const { header, details } = buildDowntimeSummary();
  headerEl.textContent = header;
  detailsEl.value = details;
  // autosize details textarea to fit content without scrollbar
  autosizeSummaryDetails(detailsEl);
}

function autosizeSummaryDetails(el) {
  if (!el) return;
  el.style.height = 'auto';
  const newH = Math.max(el.scrollHeight, 60);
  el.style.height = newH + 'px';
}

// Initialize downtime area with one empty row and listeners
document.addEventListener('DOMContentLoaded', () => {
  // only initialize if the table exists
  const addBtn = document.getElementById('addDowntimeRowBtn');
  const delBtn = document.getElementById('deleteDowntimeRowBtn');
  if (addBtn) addBtn.addEventListener('click', () => addDowntimeRow());
  if (delBtn) delBtn.addEventListener('click', () => deleteDowntimeRow());
  // initial one row
  addDowntimeRow();
  setupDowntimeListeners();
});

// --- STOCK INDICATOR LOGIC (Now integrated into loadMaterialData) ---
let globalStockMap = {};

// --- AUTOCOMPLETE LOGIC ---

// 1. Setup listeners on all Material Name inputs
function setupAllAutocomplete() {
    const inputs = document.querySelectorAll('td[data-column="material_name"]');
    inputs.forEach(td => {
        // Prevent duplicate listeners
        if (td.dataset.autocompleteActive) return;
        td.dataset.autocompleteActive = "true";

        td.addEventListener('input', debounce(async (e) => {
            const searchTerm = e.target.textContent.trim();
            if (searchTerm.length < 1) {
                closeAutocomplete();
                return;
            }

            // A. Search Catalog for the name
            const { data: catalogMatches } = await supabase
                .from('pd_material_catalog')
                .select('id, material_name')
                .ilike('material_name', `%${searchTerm}%`)
                .limit(20);

            if (!catalogMatches) return;

            // B. SMART FILTER: Only show items that exist in 'activeStockMaterialIds'
            //    (Or items that allow negative stock if you have such a policy, but usually strict is better)
            const validSuggestions = catalogMatches.filter(item => activeStockMaterialIds.has(item.id));

            showAutocompleteSuggestions(td, validSuggestions);
        }, 300));

        // Close on blur (delayed to allow click)
        td.addEventListener('blur', () => {
            setTimeout(closeAutocomplete, 200);
        });
    });
}

// 2. Show the Dropdown
function showAutocompleteSuggestions(targetTd, suggestions) {
    closeAutocomplete(); // Close existing

    if (suggestions.length === 0) return;

    // Create Dropdown
    const ul = document.createElement('ul');
    ul.className = 'autocomplete-dropdown absolute bg-white border border-gray-300 shadow-lg z-50 max-h-48 overflow-y-auto rounded text-xs';
    ul.id = 'material-autocomplete-list';
    
    // Position it
    const rect = targetTd.getBoundingClientRect();
    ul.style.top = (rect.bottom + window.scrollY) + 'px';
    ul.style.left = (rect.left + window.scrollX) + 'px';
    ul.style.width = rect.width + 'px';

    suggestions.forEach(item => {
        const li = document.createElement('li');
        li.className = 'px-2 py-1.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 text-gray-700';
        li.innerHTML = `<strong>${item.material_name}</strong> <span class="text-[10px] text-green-600 ml-1">(In Stock)</span>`;
        
        li.onmousedown = (e) => {
            e.preventDefault(); // Stop the cell from closing
            
            // 1. SET THE FULL NAME (e.g., Change "204" to "2047G")
            targetTd.textContent = item.material_name; 
            
            const row = targetTd.closest('tr');
            const rowIndex = parseInt(row.dataset.index, 10);
            
            // 2. SAVE TO MEMORY
            if (materialData[rowIndex]) {
                materialData[rowIndex].material_name = item.material_name;
            }

            closeAutocomplete();
            
            // 3. FORCE THE LOOKUP (This fills the Qty and Lot No Dropdown)
            lookupMaterialAndPopulateAvailable(item.material_name, row, rowIndex);
            
            // 4. MOVE CURSOR TO NEXT CELL (Optional but helpful)
            const nextCell = row.querySelector('[data-column="qty_used"]');
            if (nextCell) nextCell.focus();
        };
        ul.appendChild(li);
    });

    document.body.appendChild(ul);
}

function closeAutocomplete() {
    const existing = document.getElementById('material-autocomplete-list');
    if (existing) existing.remove();
}
