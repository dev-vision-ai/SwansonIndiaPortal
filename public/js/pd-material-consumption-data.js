import { supabase } from '../supabase-config.js';

let currentHeaderId = null;
let materialData = [];
let materialsCatalog = [];
let tempIdCounter = 0;
let currentProductTgtWeight = 0;
let isSaving = false; // Safety lock
let isProcessing = false; // Global processing lock

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

// Compute rejected values for a row: rejected = produced - accepted
// Also compute std weights: std_weight = rolls × target_weight
function computeRejectedFromRow(row) {
  if (!row) return;
  const getRaw = (sel) => {
    const el = row.querySelector(sel);
    return el ? String(el.textContent || '').trim() : '';
  };

  const prodNosRaw = getRaw('[data-column="produced_rolls"]');
  const prodActualRaw = getRaw('[data-column="produced_kgs_actual"]');

  const accNosRaw = getRaw('[data-column="accepted_rolls_nos"]');
  const accActualRaw = getRaw('[data-column="accepted_rolls_actual"]');

  // Calculate std weights: rolls × target_weight
  const prodNos = parseNum(prodNosRaw);
  const prodStd = prodNos * currentProductTgtWeight;

  const accNos = parseNum(accNosRaw);
  const accStd = accNos * currentProductTgtWeight;

  // If all related inputs are empty, do not display 0 — leave rejected blank
  if (!prodNosRaw && !prodActualRaw && !accNosRaw && !accActualRaw) {
    const prodStdCell = row.querySelector('[data-column="produced_kgs_std"]');
    const accStdCell = row.querySelector('[data-column="accepted_rolls_std"]');
    const rejNosCell = row.querySelector('[data-column="rejected_rolls"]');
    const rejActualCell = row.querySelector('[data-column="rejected_kgs_actual"]');
    const rejStdCell = row.querySelector('[data-column="rejected_kgs_std"]');
    if (prodStdCell) prodStdCell.textContent = '';
    if (accStdCell) accStdCell.textContent = '';
    if (rejNosCell) rejNosCell.textContent = '';
    if (rejActualCell) rejActualCell.textContent = '';
    if (rejStdCell) rejStdCell.textContent = '';
    return;
  }

  const prodActual = parseNum(prodActualRaw);
  const accActual = parseNum(accActualRaw);

  const rejNos = prodNos - accNos;
  const rejActual = prodActual - accActual;
  const rejStd = prodStd - accStd;

  // Update std weight cells
  const prodStdCell = row.querySelector('[data-column="produced_kgs_std"]');
  const accStdCell = row.querySelector('[data-column="accepted_rolls_std"]');
  const rejStdCell = row.querySelector('[data-column="rejected_kgs_std"]');

  if (prodStdCell) prodStdCell.textContent = isNaN(prodStd) || prodStd === 0 ? '' : prodStd.toFixed(2);
  if (accStdCell) accStdCell.textContent = isNaN(accStd) || accStd === 0 ? '' : accStd.toFixed(2);
  if (rejStdCell) rejStdCell.textContent = isNaN(rejStd) || rejStd === 0 ? '' : rejStd.toFixed(2);

  // Update rejected nos and actual (keeping existing logic)
  const rejNosCell = row.querySelector('[data-column="rejected_rolls"]');
  const rejActualCell = row.querySelector('[data-column="rejected_kgs_actual"]');

  if (rejNosCell) rejNosCell.textContent = isNaN(rejNos) || rejNos === 0 ? '' : String(Math.round(rejNos));
  if (rejActualCell) rejActualCell.textContent = isNaN(rejActual) || rejActual === 0 ? '' : rejActual.toFixed(2);
}

function renderMaterialDataTable() {
  const mainBody = document.getElementById('materialMainBody');
  const totalsBody = document.getElementById('materialTotalsBody');
  if (!mainBody || !totalsBody) return;

  mainBody.innerHTML = materialData.map((record, index) => {
    const qtyAvail = parseFloat(record.qty_available) || 0; // This is Opening Balance
    const qtyUsed = parseFloat(record.qty_used) || 0;
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

    // Show Badge if Empty (Red) OR Low (Orange < 50%)
    if ((balance <= 0.01 || percentLeft < 50) && record.id && !String(record.id).startsWith('temp')) {
        const factoryStock = globalStockMap[record.material_id] || 0;

        if (factoryStock > 0) {
          alertBadge = `
            <div class="inline-flex items-center h-6 px-2 py-0.5 leading-none text-xs font-semibold text-green-700">
              <i class="fas fa-cubes mr-1 text-xs"></i> In-stock: ${factoryStock.toLocaleString()} KG
            </div>`;
        } else {
           alertBadge = `
            <div class="inline-flex items-center h-6 px-2 py-0.5 leading-none text-xs font-semibold text-red-700">
              <i class="fas fa-exclamation-triangle mr-1 text-xs"></i> In-stock: 0 KG
            </div>`;
        }
    }

    return `
      <tr data-index="${index}" data-id="${record.id || 'temp-' + index}">
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs font-semibold">${index + 1}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-xs" contenteditable="true" data-column="material_name">${record.material_name || ''}</td>

        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-gray-50" contenteditable="false" data-column="qty_available">${qtyAvail.toFixed(2)}</td>

        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="qty_used">${qtyUsed || ''}</td>

        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs ${cellClass}" contenteditable="false" data-column="balance">
            ${balance.toFixed(2)}
        </td>

        <td class="border border-gray-300 px-2 py-1 text-center align-middle w-20 overflow-hidden whitespace-nowrap truncate">
          ${alertBadge}
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
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="produced_rolls">${record.produced_rolls || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="produced_kgs_actual">${record.produced_kgs_actual || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="produced_kgs_std">${record.produced_kgs_std || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="accepted_rolls_nos">${record.accepted_rolls_nos || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="accepted_rolls_actual">${record.accepted_rolls_actual || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="accepted_rolls_std">${record.accepted_rolls_std || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="rejected_rolls">${record.rejected_rolls || ''}</td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="rejected_kgs_actual">${record.rejected_kgs_actual || ''}</td>
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
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="produced_rolls"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="produced_kgs_actual"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="produced_kgs_std"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="accepted_rolls_nos"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="accepted_rolls_actual"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="accepted_rolls_std"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="rejected_rolls"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="rejected_kgs_actual"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs bg-yellow-100 font-semibold" contenteditable="false" data-column="rejected_kgs_std"> </td>
        <td class="border border-gray-300 px-2 py-1.5 text-center text-xs" contenteditable="true" data-column="total_scrap"> </td>
      </tr>
    `;
  } else {
    totalsBody.innerHTML = totalsHtml;
  }

  // After render, compute rejected for each totals row so read-only cells show correct values
  Array.from(totalsBody.querySelectorAll('tr')).forEach(tr => computeRejectedFromRow(tr));
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

    // If produced/accepted changed in totals table, recompute rejected and std weights for that totals row
    if (['produced_rolls','produced_kgs_actual','accepted_rolls_nos','accepted_rolls_actual'].includes(columnType)) {
      const totalsRow = totalsBody.querySelector(`tr[data-index="${rowIndex}"]`);
      if (totalsRow) computeRejectedFromRow(totalsRow);
    }
  };

  mainBody.addEventListener('blur', onBlur, true);
  totalsBody.addEventListener('blur', onBlur, true);

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
    // 1. Get Material ID
    const { data: catalogData, error: catalogError } = await supabase
      .from('pd_material_catalog')
      .select('id, material_name, material_category, uom')
      .eq('material_name', materialName)
      .eq('is_active', true)
      .single();

    if (catalogError || !catalogData) {
      console.warn('Material not found:', materialName);
      updateRowCells(row, rowIndex, 0, null);
      return;
    }

    // 2. Get ALL Available Batches (Remove .limit(1))
    const { data: stagingData, error: stagingError } = await supabase
      .from('pd_material_staging')
      .select('id, balance_qty')
      .eq('material_id', catalogData.id)
      .eq('status', 'Available')
      .gt('balance_qty', 0);

    if (stagingError) {
      console.error('Staging error:', stagingError);
      updateRowCells(row, rowIndex, 0, catalogData);
      return;
    }

    // 3. SUM IT UP (The Magic Step)
    // 100 (Old) + 350 (New) = 450
    const totalAvailable = stagingData.reduce((sum, batch) => sum + (batch.balance_qty || 0), 0);

    // 4. Update UI with the TOTAL
    updateRowCells(row, rowIndex, totalAvailable, catalogData);

  } catch (err) {
    console.error('Error looking up material:', err);
    updateRowCells(row, rowIndex, 0, null);
  }
}

// Helper to update the screen
function updateRowCells(row, rowIndex, qty, catalogData) {
  const qtyAvailCell = row.querySelector('[data-column="qty_available"]');
  const balanceCell = row.querySelector('[data-column="balance"]');

  // Update Screen
  if (qtyAvailCell) qtyAvailCell.textContent = qty.toFixed(2); // Shows 450.00
  if (balanceCell) balanceCell.textContent = qty.toFixed(2);

  // Update Memory
  if (rowIndex !== -1 && materialData[rowIndex]) {
    materialData[rowIndex].qty_available = qty;
    if (catalogData) {
      materialData[rowIndex].material_id = catalogData.id;
      materialData[rowIndex].material_type = catalogData.material_category;
      // We don't save track_id here anymore because the "Smart Save" calculates it later
    }
  }
}

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
      temp_row_id: tempRowId, // Frontend-only, never sent to DB
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

    // B. FIFO LOOKUP: Find Oldest Available Stock in Staging
    const { data: stagingData, error: stagingError } = await supabase
      .from('pd_material_staging')
      .select('id, balance_qty, consumed_qty, status')
      .eq('material_id', catalogData.id)
      .eq('status', 'Available')
      .gt('balance_qty', 0)
      .order('created_at', { ascending: true })
      .limit(1);

    if (stagingError || !stagingData || stagingData.length === 0) {
      alert(`Row ${rowIndex + 1}: No available stock found for "${materialName}"`);
      return;
    }

    const stagingUUID = stagingData[0].id;
    const screenBalance = stagingData[0].balance_qty;
    const currentConsumed = stagingData[0].consumed_qty || 0;

    // C. Validate Quantity
    if (qtyUsed > screenBalance) {
      alert(`Row ${rowIndex + 1}: Qty Used (${qtyUsed}) exceeds Batch Balance (${screenBalance})`);
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
        track_id: stagingUUID,
        traceability_code: row.traceability_code,
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

      // Update staging balance
      const { error: stagingUpdateError } = await supabase
        .from('pd_material_staging')
        .update({
          balance_qty: screenBalance - qtyUsed,
          consumed_qty: currentConsumed + qtyUsed,
          status: (screenBalance - qtyUsed) <= 0 ? 'Consumed' : 'Available'
        })
        .eq('id', stagingUUID);

      if (stagingUpdateError) {
        console.error('Failed to update staging balance:', stagingUpdateError);
      }

      alert(`Row ${rowIndex + 1} updated successfully!`);

    } else {
      // INSERT NEW ROW using RPC
      const rpcPayload = [{
        material_id: catalogData.id,
        track_id: stagingUUID,
        material_name: materialName,
        material_type: catalogData.material_category,
        traceability_code: row.traceability_code,
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
        total_scrap: parseNum(row.total_scrap)
      }];

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
  // 1. BLOCK DUPLICATE CLICKS AND CONCURRENT OPERATIONS
  if (isSaving || isProcessing) return;

  if (!currentHeaderId) return alert('No header selected');

  const saveBtn = document.getElementById('saveAllMaterialDataBtn');

  try {
    // 2. LOCK THE BUTTON AND SET PROCESSING FLAG
    isSaving = true;
    isProcessing = true;
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
      saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    // 3. Get only the NEW rows that have data
    const newRows = materialData.filter(r =>
      (r.material_name && r.material_name.trim()) &&
      Number(r.qty_used) > 0 &&
      (!r.id || String(r.id).startsWith('temp'))
    );

    if (newRows.length === 0) {
      return alert('No NEW data to save. Existing rows are already saved.');
    }

    // --- SAFETY CHECK START: Group Totals First ---
    const materialTotals = {};
    for (const row of newRows) {
      const name = row.material_name.trim();
      const qty = parseFloat(row.qty_used) || 0;
      if (!materialTotals[name]) materialTotals[name] = 0;
      materialTotals[name] += qty;
    }

    for (const [materialName, totalRequested] of Object.entries(materialTotals)) {
      const { data: cat } = await supabase.from('pd_material_catalog')
        .select('id').eq('material_name', materialName).single();

      if (!cat) throw new Error(`Material "${materialName}" not found.`);

      const { data: allBatches } = await supabase.from('pd_material_staging')
        .select('balance_qty')
        .eq('material_id', cat.id)
        .eq('status', 'Available');

      const liveStock = allBatches?.reduce((sum, b) => sum + (b.balance_qty || 0), 0) || 0;

      if (totalRequested > liveStock) {
        throw new Error(`🚫 STOP! OVER-CONSUMPTION ERROR\n\nMaterial: ${materialName}\nRequesting: ${totalRequested} KG\nAvailable: ${liveStock} KG`);
      }
    }
    // --- SAFETY CHECK END ---

    const rpcPayload = [];
    for (let i = 0; i < newRows.length; i++) {
      const row = newRows[i];
      const materialName = row.material_name.trim();
      const { data: cat } = await supabase.from('pd_material_catalog')
        .select('id, material_category').eq('material_name', materialName).single();

      rpcPayload.push({
        material_id: cat.id,
        material_name: materialName,
        material_type: cat.material_category,
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
        total_scrap: parseNum(row.total_scrap)
      });
    }

    const { error } = await supabase.rpc('submit_consumption_smart_fifo', {
      p_header_id: currentHeaderId,
      p_rows: rpcPayload
    });

    if (error) throw error;

    alert('✅ Saved successfully! Stock updated correctly.');
    materialData = [];
    await loadMaterialData();

  } catch (err) {
    console.error(err);
    alert(err.message);
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

  // If the row has an ID, it exists in the database - delete it from database too
  if (lastRow.id) {
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

async function loadMaterialData() {
  if (!currentHeaderId) {
    console.warn('No currentHeaderId set; skipping material data load');
    return;
  }

  // Prevent concurrent operations
  if (isProcessing) {
    console.warn('Load already in progress, skipping');
    return;
  }

  isProcessing = true;

  try {
    // 1. Fetch consumption data
    const { data: consumptionData, error: consumptionError } = await supabase
      .from('pd_material_consumption_data')
      .select('*')
      .eq('header_id', currentHeaderId)
      .order('created_at', { ascending: false });

    if (consumptionError) {
      console.error('Error loading consumption data:', consumptionError);
      alert('Failed to load material consumption data: ' + (consumptionError.message || JSON.stringify(consumptionError)));
      return;
    }

    materialData = consumptionData || [];

    // 2. Extract unique material_ids from the consumption data
    const materialIds = [...new Set(materialData.map(r => r.material_id).filter(Boolean))];

    // 3. If we have materials, fetch their stock balances immediately
    if (materialIds.length > 0) {
      const { data: stockData, error: stockError } = await supabase
        .from('pd_material_staging')
        .select('material_id, balance_qty')
        .in('material_id', materialIds)
        .eq('status', 'Available');

      if (stockError) {
        console.error('Error loading stock data:', stockError);
        // Continue without stock data rather than failing completely
        globalStockMap = {};
      } else {
        // 4. Create globalStockMap from the results
        globalStockMap = {};
        stockData.forEach(row => {
          if (!globalStockMap[row.material_id]) globalStockMap[row.material_id] = 0;
          globalStockMap[row.material_id] += (row.balance_qty || 0);
        });
      }
    } else {
      // No materials, empty stock map
      globalStockMap = {};
    }

    // 5. Render table once with all data ready
    renderMaterialDataTable();

  } catch (err) {
    console.error('Error loading material data:', err);
    alert('Unexpected error loading material data: ' + err.message);
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
      loadMaterialData()
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
