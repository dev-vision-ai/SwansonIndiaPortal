import { supabase } from '../supabase-config.js';

// Move this to the very top of the file
const tablesContainer = document.getElementById('tablesContainer');

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
    <th rowspan="2" class="border border-gray-300 px-2 py-1" style="width:100px; min-width:100px; max-width:100px;">Remarks</th>
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
    // Assign all DOM elements at the very top
    const rowCountDisplay = document.getElementById('rowCountDisplay');
    const addRowsBtn = document.getElementById('addNewRowsBtn');
    const clearRowsBtn = document.getElementById('clearRowsBtn');
    const numRowsInput = document.getElementById('numRowsInput');
    if (!rowCountDisplay || !addRowsBtn || !clearRowsBtn || !numRowsInput) {
        alert('Error: One or more required DOM elements are missing.');
        return;
    }
    if (addRowsBtn) addRowsBtn.textContent = 'Add Rows';
    // Move all config/constants here
    const totalColumns = 33;
    const mergedIndices = [0, 1, 2, 4, 31]; // Hour, Minutes, Lot No., Arm, Remarks
    const dropdownIndex = 29; // Accept / Reject column
    const dropdownOptions = ["", "Accept", "Reject", "KIV", "Rework"];
    const fixedWidthIndices = {
        10: '40px', 11: '40px', 12: '33px', 13: '33px', 14: '33px', 15: '33px',
        16: '33px', 17: '33px', 18: '33px', 19: '33px', 20: '33px', 21: '33px',
        22: '33px', 23: '33px', 24: '33px', 25: '33px', 26: '33px', 27: '33px',
        28: '33px', 30: '33px', 31: '33px', 32: '80px'
    };
    // All code that uses these variables goes below this line
    
    // ===== LOAD FORM DATA IF FORM ID PROVIDED =====
    const urlParams = new URLSearchParams(window.location.search);
    const traceabilityCode = urlParams.get('traceability_code');
    const lotLetter = urlParams.get('lot_letter');
    console.log('DEBUG: traceabilityCode from URL:', traceabilityCode);
    
    if (traceabilityCode) {
        try {
            // Load all lots for this traceability_code, order by created_at ascending to get the oldest first
            const { data: lots, error } = await supabase
                .from('inline_inspection_form_master')
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
                document.getElementById('production_no').textContent = formData.production_no || '[Production No.]';
                document.getElementById('prod_code').textContent = formData.prod_code || '[Prod. Code]';
                document.getElementById('spec').textContent = formData.spec || '[Spec]';
                document.getElementById('printed').checked = formData.printed || false;
                document.getElementById('non_printed').checked = formData.non_printed || false;
                document.getElementById('ct').checked = formData.ct || false;
                document.getElementById('year').textContent = formData.year || '[Year]';
                document.getElementById('month').textContent = formData.month || '[Month]';
                document.getElementById('date').textContent = formData.date || '[Date]';
                document.getElementById('mc_no').textContent = formData.mc_no || '[M/C No.]';
                document.getElementById('shift').textContent = formData.shift || '[Shift]';
                // Load rolls into the editable grid
                if (formData.inspection_data && formData.inspection_data.rolls) {
                    addRows(formData.inspection_data.rolls.length);
                    setTimeout(() => {
                        const tables = tablesContainer.querySelectorAll('table');
                        tables.forEach(table => {
                            const tbody = table.querySelector('tbody');
                            if (!tbody) return;
                            const rolls = formData.inspection_data.rolls;
                            rolls.forEach((roll, index) => {
                                const row = tbody.rows[index];
                            if (!row) return;
                            const cells = row.querySelectorAll('td[data-field]');
                            cells.forEach(cell => {
                                const fieldName = cell.dataset.field;
                                if (!fieldName) return;
                                const value = roll[fieldName] || '';
                                if (cell.querySelector('select')) {
                                    cell.querySelector('select').value = value;
                                    const event = new Event('change');
                                    cell.querySelector('select').dispatchEvent(event);
                                } else {
                                    cell.textContent = value;
                                    applyXOColorCoding(cell);
                                }
                                });
                            });
                        });
                        updateRowCount();
                        applyColorCodingToTable();
                        updateSummaryTable();
                        // Ensure 'Inspected By' is displayed in the first row after reload
                        if (formData.inspection_data && formData.inspection_data.inspected_by) {
                            const firstTable = tablesContainer.querySelector('table');
                            if (firstTable) {
                                const firstRow = firstTable.querySelector('tbody tr');
                                if (firstRow) {
                                    const inspectedByCell = firstRow.lastElementChild;
                                    console.log('Setting Inspected By cell (last cell):', inspectedByCell, 'to', formData.inspection_data.inspected_by);
                                    inspectedByCell.textContent = formData.inspection_data.inspected_by;
                                }
                            }
                        }
                    }, 100);
                }
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
        console.log('Loading data for traceability_code:', traceabilityCode);
        window.isLoadingData = true;
        await loadInspectionData(traceabilityCode);
        window.isLoadingData = false;
    }

    function updateRowCount(tbody) {
        if (!tbody || !tbody.rows) return;
        const dataRows = Array.from(tbody.rows);
        if (typeof rowCountDisplay !== 'undefined') {
        rowCountDisplay.textContent = `Rows: ${dataRows.length}`;
        }
    }

    // Removed capitalizeWords function to prevent typing issues

    function createCell(contentEditable = true, rowspan = 1, isDropdown = false, colIndex = null) {
        const td = document.createElement('td');
        td.className = 'border border-gray-300 px-1 py-1';
        // Add word wrap and text center
        td.style.whiteSpace = 'pre-wrap';
        td.style.wordBreak = 'break-word';
        td.style.textAlign = 'center';
        
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
            dropdownOptions.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt || 'Select';
                select.appendChild(option);
            });
            
            select.addEventListener('change', function(e) {
                const table = select.closest('table');
                const formId = table?.dataset?.formId;
                const allTables = Array.from(document.querySelectorAll('#tablesContainer table'));
                const tableIndex = allTables.indexOf(table);
                console.log('[DEBUG] Cell change event in table:', { formId, tableIndex });
                applyColorCodingToTable();
                updateSummaryTable();
            });
            
            td.appendChild(select);
        } else if (contentEditable) {
            td.contentEditable = 'true';
            td.spellcheck = false;
            
            // Capitalize first letter while typing
            td.addEventListener('input', function(e) {
                const table = td.closest('table');
                const formId = table?.dataset?.formId;
                const allTables = Array.from(document.querySelectorAll('#tablesContainer table'));
                const tableIndex = allTables.indexOf(table);
                console.log('[DEBUG] Cell input event in table:', { formId, tableIndex });
                const text = td.textContent;
                const capitalizedText = capitalizeText(text);
                
                if (text !== capitalizedText) {
                    // Preserve cursor position
                    const selection = window.getSelection();
                    const range = selection.getRangeAt(0);
                    const cursorOffset = range.startOffset;
                    
                    td.textContent = capitalizedText;
                    
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
        for (let i = 0; i < n; i++) {
            const tr = document.createElement('tr');
                for (let col = 0; col < totalColumns; col++) {
                const td = createCell(true, 1, col === dropdownIndex, col);
                if (col === 3) td.textContent = (tbody.rows.length + 1).toString();
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
    }
    
    // ===== INSPECTED BY ROW FUNCTION =====


    // ===== DEBOUNCED SAVE FUNCTION =====
    let saveTimeout = null;
    
    function debouncedSave(table) {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        saveTimeout = setTimeout(() => {
            if (!table) table = document.querySelector('#tablesContainer table');
            if (table) saveLotToSupabase(table);
        }, 1000);
    }

    // Defensive saveLotToSupabase
    async function saveLotToSupabase(table) {
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
        const rolls = [];
        let inspectedBy = '';
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const cells = row.querySelectorAll('td[data-field]');
            const rollData = { roll_position: i + 1 };
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
                } else {
                    rollData[fieldName] = value;
                }
                if (value && value !== '') isEmpty = false;
            });
            // Always push the rollData, even if empty
            rolls.push(rollData);
        }
        // Debug: Log the rolls array before saving
        console.log('Saving rolls:', rolls);
        // Build lotData
        const lotData = {
            rolls: rolls,
            inspected_by: inspectedBy,
            summary: calculateSummary(rolls)
        };
        const summary = lotData.summary;
        // Debug: Log the update payload
        console.log({
            inspection_data: lotData,
            updated_at: new Date().toISOString(),
            accepted_rolls: summary.accepted_rolls,
            rejected_rolls: summary.rejected_rolls,
            rework_rolls: summary.rework_rolls,
            kiv_rolls: summary.kiv_rolls,
            total_rolls: summary.total_rolls,
            accepted_weight: summary.accepted_weight,
            rejected_weight: summary.rejected_weight,
            rework_weight: summary.rework_weight,
            kiv_weight: summary.kiv_weight
        });
        // Update row in Supabase
        const { error } = await supabase
            .from('inline_inspection_form_master')
            .update({ 
                inspection_data: lotData, 
                updated_at: new Date().toISOString(),
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
            console.log('Lot saved!');
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
        // This is now deprecated - use saveLotToSupabase instead
        console.log('Individual cell saving is deprecated. Use saveLotToSupabase instead.');
    }

    // ===== BACKWARD COMPATIBILITY - OLD TABLE SAVE =====
    async function saveTable() {
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
            tbody._saveHandler = function() { debouncedSave(table); };
            tbody.addEventListener('input', tbody._saveHandler, true);
            tbody.addEventListener('change', tbody._saveHandler, true);
        });
    }

    // ===== LOCK CHECKBOX FUNCTIONALITY =====
    function getLockCheckboxesForTable(table) {
        const rollWeightLock = table.querySelector('#rollWeightLock');
        const rollThetaLock = table.querySelector('#rollThetaLock');
        return { rollWeightLock, rollThetaLock };
    }

    // Add event listeners
    addRowsBtn.addEventListener('click', async () => {
        const n = parseInt(numRowsInput.value, 10) || 1;
        addRows(n);
        afterTableStructureChange();
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

    clearRowsBtn.addEventListener('click', async () => {
        // Clear all rows from the table
        clearRows();
        
        // Clear JSONB inspection data from Supabase
        if (traceabilityCode && lotLetter) {
            try {
                const { error } = await supabase
                    .from('inline_inspection_form_master')
                    .update({ 
                        inspection_data: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('traceability_code', traceabilityCode)
                    .eq('lot_letter', lotLetter);
                
                if (error) {
                    console.error('Error clearing inspection data from Supabase:', error);
                } else {
                    console.log('Inspection data cleared from Supabase');
                }
            } catch (error) {
                console.error('Error clearing data:', error);
            }
        }
        
        // Update UI
        afterTableStructureChange();
        updateSummaryTable();
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
                    <tr style="height: 30px;"><td>Accepted Rolls</td><td>${summary.acceptedCount} Rolls</td><td>${summary.acceptedWeight} KG</td></tr>
                    <tr style="height: 30px;"><td>Rejected Rolls</td><td>${summary.rejectedCount} Rolls</td><td>${summary.rejectedWeight} KG</td></tr>
                    <tr style="height: 30px;"><td>Rolls Rejected for Rework</td><td>${summary.reworkCount} Rolls</td><td>${summary.reworkWeight} KG</td></tr>
                    <tr style="height: 30px;"><td>KIV Rolls</td><td>${summary.kivCount} Rolls</td><td>${summary.kivWeight} KG</td></tr>
                    <tr style="height: 30px;"><td><b>Total Rolls</b></td><td>${summary.totalCount} Rolls</td><td>${summary.totalWeight} KG</td></tr>
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

    // ===== TAB KEY HANDLER =====
    function handleTabNavigation(e) {
        if (e.key === 'Tab') {
            const currentCell = e.target.closest('td');
            if (!currentCell) return;
            
            const currentTabIndex = parseInt(currentCell.getAttribute('tabindex') || '0');
            const nextTabIndex = e.shiftKey ? currentTabIndex - 1 : currentTabIndex + 1;
            
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
    
    // Add tab navigation listener
    tablesContainer.addEventListener('keydown', handleTabNavigation);
    
    // On page load, fetch and render all lots for the current traceability_code
    if (traceabilityCode) {
        try {
            const { data: lots, error } = await supabase
                .from('inline_inspection_form_master')
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
    
    // Create and style the "Add Next Lot" button
    const addNewTableBtn = document.createElement('button');
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

    // Initially append the button after the first table
    tablesContainer.appendChild(addNewTableBtn);

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
            if (i === 0) {
                // First row: add merged cells
                for (let col = 0; col < totalColumns; col++) {
                    if (col === 31 || col === 32) {
                        tr.appendChild(createCell(true, 1, false, col));
                    } else if (mergedIndices.includes(col)) {
                        tr.appendChild(createCell(true, n, false, col));
                    } else if (col === 3) {
                        const td = createCell(true, 1, false, col);
                        td.textContent = '1';
                        tr.appendChild(td);
                    } else if (col === dropdownIndex) {
                        tr.appendChild(createCell(false, 1, true, col));
                    } else if (col > 4 && col < 31 && col !== dropdownIndex) {
                        tr.appendChild(createCell(true, 1, false, col));
                    }
                }
            } else {
                // Subsequent rows: skip merged cells
                for (let col = 0; col < totalColumns; col++) {
                    if (col === 31 || col === 32) {
                        tr.appendChild(createCell(true, 1, false, col));
                    } else if (col === 3) {
                        const td = createCell(true, 1, false, col);
                        td.textContent = (i + 1).toString();
                        tr.appendChild(td);
                    } else if (col === dropdownIndex) {
                        tr.appendChild(createCell(false, 1, true, col));
                    } else if (!mergedIndices.includes(col) && col > 4 && col < 31 && col !== dropdownIndex) {
                        tr.appendChild(createCell(true, 1, false, col));
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
    function buildEmptyRoll(position) {
        return {
            arm: "",
            prs: "",
            hour: "",
            odour: "",
            glossy: "",
            lot_no: "",
            minute: "",
            others: "",
            remarks: "",
            pin_hole: "",
            roll_dia: "",
            wrinkles: "",
            mis_print: "",
            tape_test: "",
            thickness: "",
            film_color: "",
            patch_mark: "",
            roll_curve: "",
            defect_name: "",
            dirty_print: "",
            print_color: "",
            roll_weight: "",
            lines_strips: "",
            accept_reject: "",
            ct_appearance: "",
            roll_position: position.toString(),
            roll_width_mm: "",
            centralization: "",
            film_weight_gsm: "",
            core_misalignment: "",
            paper_core_dia_id: "",
            paper_core_dia_od: ""
        };
    }

    // Add event listener to the button
    addNewTableBtn.addEventListener('click', async function() {
        // Get the number of rows in the main table (first table)
        const mainTable = tablesContainer.querySelector('table');
        let rowCount = 1;
        if (mainTable) {
            const tbody = mainTable.querySelector('tbody');
            if (tbody) rowCount = tbody.rows.length;
        }
        const rolls = [];
        for (let i = 1; i <= rowCount; i++) {
            rolls.push(buildEmptyRoll(i));
        }
        // Generate new form_id
        const form_id = crypto.randomUUID();
        // Insert new row in Supabase
        const { error } = await supabase
            .from('inline_inspection_form_master')
            .insert([{
                form_id: form_id,
                traceability_code: traceabilityCode,
                lot_letter: lotLetter,
                inspection_data: { rolls: rolls, summary: calculateSummary(rolls) },
                status: 'draft',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }]);
        if (error) {
            alert('Error creating new lot: ' + error.message);
            return;
        }
        // Reload all lots (to show the new table)
        await loadAllLots();
        addSaveListeners(); // <-- Ensure new table cells are hooked up for saving
        // Scroll to the new lot's table
        setTimeout(() => {
            const tables = tablesContainer.querySelectorAll('table');
            if (tables.length > 0) {
                tables[tables.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
                saveLotToSupabase(tables[tables.length - 1]);
            }
        }, 300);
    });

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

    // Change Delete Rows button to Delete Table
    clearRowsBtn.textContent = 'Delete Table';

    // Replace clearRowsBtn click handler to delete the last table (most recent)
    clearRowsBtn.removeEventListener('click', clearRows); // Remove old handler if any
    clearRowsBtn.addEventListener('click', async function() {
        const allTables = tablesContainer.querySelectorAll('table');
        if (allTables.length > 0) {
            const lastTable = allTables[allTables.length - 1];
            // Remove Save button and separator before the table (if present)
            let prev = lastTable.previousSibling;
            // Remove Save button
            if (prev && prev.classList && prev.classList.contains('dynamic-save-btn')) {
                prev.remove();
                prev = lastTable.previousSibling;
            }
            // Remove dotted separator
            if (prev && prev.classList && prev.classList.contains('table-separator')) {
                prev.remove();
            }
            // Delete from Supabase using formId
            const formId = lastTable.dataset.formId;
            if (formId) {
                const { error } = await supabase
                    .from('inline_inspection_form_master')
                    .delete()
                    .eq('form_id', formId);
                if (error) {
                    alert('Error deleting lot from Supabase: ' + error.message);
                }
            }
            lastTable.remove();
        }
        // If no tables remain, create a new empty table
        if (tablesContainer.querySelectorAll('table').length === 0) {
            const newTable = document.createElement('table');
            newTable.className = 'w-full border-collapse';
            // Clone thead from the previous table if possible, else use thead from controls
            let thead = null;
            if (typeof origTable !== 'undefined' && origTable && origTable.querySelector('thead')) {
                thead = origTable.querySelector('thead').cloneNode(true);
            } else if (document.querySelector('thead')) {
                thead = document.querySelector('thead').cloneNode(true);
            }
            if (thead) newTable.appendChild(thead);
            const tbody = document.createElement('tbody');
            newTable.appendChild(tbody);
            tablesContainer.insertBefore(newTable, addNewTableBtn);
            window.tableBody = tbody;
            // REMOVE: addRows(1);
        }
        updateTableSpacing();
    });

    // Initial visibility check
    // updateAddTableBtnVisibility(); // REMOVE THIS LINE

    // Call updateTableSpacing after any table add/remove/restore
    addNewTableBtn.addEventListener('click', updateTableSpacing);
    clearRowsBtn.addEventListener('click', updateTableSpacing);

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
                .from('inline_inspection_form_master')
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
                
                // Save as JSONB
                const { error: saveError } = await supabase
                    .from('inline_inspection_form_master')
                    .update({ 
                        inspection_data: lotData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('traceability_code', traceabilityCode)
                    .eq('lot_letter', lotLetter);
                
                if (saveError) {
                    console.error('Error saving migrated data:', saveError);
                } else {
                    console.log('Successfully migrated old data to JSONB');
                    
                    // Delete old individual rows
                    const { error: deleteError } = await supabase
                        .from('inline_inspection_form_master')
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
        setTimeout(async () => {
            try {
                const { data, error } = await supabase
                    .from('inline_inspection_form_master')
                    .select('inspection_data')
                    .eq('traceability_code', traceabilityCode)
                    .eq('lot_letter', lotLetter);
                
                if (!error && data && !data.inspection_data) {
                    // No JSONB data found, check if we have old individual rows
                    const { data: oldRows, error: oldError } = await supabase
                        .from('inline_inspection_form_master')
                        .select('row_number')
                        .eq('traceability_code', traceabilityCode)
                        .eq('lot_letter', lotLetter)
                        .not('row_number', 'is', null);
                    
                    if (!oldError && oldRows && oldRows.length > 0) {
                        console.log('Found old data format, migrating to JSONB...');
                        await migrateOldDataToJSONB();
                        // Reload the data after migration
                        await loadInspectionData(traceabilityCode);
                    }
                }
            } catch (error) {
                console.error('Error checking for migration:', error);
            }
        }, 1000); // Wait 1 second after page load
    }

    // ===== MULTI-LOT SUPPORT START =====

    // Helper to create a table for a lot, given its data and form_id
    function createLotTable(lot, nRows = 0) {
        console.log('createLotTable called with lot:', lot);
        // Insert a dotted separator before each table except the first
        if (tablesContainer.childElementCount > 0) {
            const separator = document.createElement('div');
            separator.style.borderTop = '2px dotted #888';
            separator.style.margin = '32px 0 24px 0';
            separator.style.width = '100%';
            tablesContainer.appendChild(separator);
        }
        // Add Fill O button
        const fillOButton = document.createElement('button');
        fillOButton.textContent = 'Fill O';
        fillOButton.className = 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-0.5 px-2 rounded mb-2 text-sm';
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
                        td.isContentEditable &&
                        !td.querySelector('select') &&
                        !td.querySelector('input') &&
                        td.textContent.trim() === ''
                    ) {
                        td.textContent = 'O';
                        td.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                });
            });
        };
        tablesContainer.appendChild(fillOButton);
        const table = document.createElement('table');
        table.className = 'w-full border-collapse mt-6';
        table.style.border = '2px solid #000';
        table.style.borderCollapse = 'collapse';
        table.dataset.formId = lot.form_id;
        // Build thead (copy from your HTML structure)
        const thead = document.createElement('thead');
        thead.innerHTML = lotTheadHTML.replace(/<thead>|<\/thead>/g, '');
        table.appendChild(thead);
        // Build tbody
        const tbody = document.createElement('tbody');
        const rolls = lot.inspection_data && lot.inspection_data.rolls ? lot.inspection_data.rolls : [];
        console.log('Rolls to render:', rolls);
        const numRows = Math.max(rolls.length, nRows);
        // Always add the correct number of rows
        for (let i = 0; i < numRows; i++) {
            const tr = document.createElement('tr');
            for (let col = 0; col < totalColumns; col++) {
                const td = createCell(true, 1, col === dropdownIndex, col);
                if (col === 3) td.textContent = (i + 1).toString();
                // If there is data for this row, fill it
                if (rolls[i]) {
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
                    const value = rolls[i][fieldName] || '';
                    if (td.querySelector('select')) {
                        td.querySelector('select').value = value;
                        const event = new Event('change');
                        td.querySelector('select').dispatchEvent(event);
                    } else if (td.querySelector('input[type="checkbox"]')) {
                        td.querySelector('input[type="checkbox"]').checked = !!value;
                    } else if (td.querySelector('input[type="text"]')) {
                        td.querySelector('input[type="text"]').value = value;
                    } else if (td.isContentEditable || td.contentEditable === 'true') {
                        td.textContent = value;
                        applyXOColorCoding(td);
                    } else {
                        td.textContent = value;
                    }
                }
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
        // After filling all cells, set Inspected By in the first row's last cell
        if (lot.inspection_data && lot.inspection_data.inspected_by) {
            setTimeout(() => {
                const firstRow = tbody.querySelector('tr');
                if (firstRow) {
                    const inspectedByCell = firstRow.lastElementChild;
                    console.log('Setting Inspected By cell (last cell):', inspectedByCell, 'to', lot.inspection_data.inspected_by);
                    inspectedByCell.textContent = lot.inspection_data.inspected_by;
                }
            }, 200);
        }
        table.appendChild(tbody);
        tablesContainer.appendChild(table);
        return table;
    }

    // Save a specific lot table to Supabase using its form_id
    async function saveLotTableToSupabase(table) {
        const formId = table.dataset.formId;
        if (!formId) return;
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        const rows = tbody.rows;
        const rolls = [];
        let inspectedBy = '';
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const cells = row.querySelectorAll('td[data-field]');
            const rollData = { roll_position: i + 1 };
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
                } else {
                    rollData[fieldName] = value;
                }
            });
            rolls.push(rollData);
        }
        // Build lotData
        const lotData = {
            rolls: rolls,
            inspected_by: inspectedBy,
            summary: calculateSummary(rolls)
        };
        // Update row in Supabase
        const { error } = await supabase
            .from('inline_inspection_form_master')
            .update({ inspection_data: lotData, updated_at: new Date().toISOString() })
            .eq('form_id', formId);
        if (error) {
            alert('Error saving lot: ' + error.message);
        } else {
            alert('Lot saved!');
        }
    }

    // On page load, fetch all lots for this traceability_code and render tables
    async function loadAllLots() {
        if (!traceabilityCode) return;
        // Clear existing tables
        tablesContainer.innerHTML = '';
        // Fetch all lots
        const { data: lots, error } = await supabase
            .from('inline_inspection_form_master')
            .select('*')
            .eq('traceability_code', traceabilityCode)
            .eq('lot_letter', lotLetter)
            .order('created_at', { ascending: true });
        console.log('Fetched lots:', lots);
        if (error) {
            alert('Error loading lots: ' + error.message);
            return;
        }
        if (!lots || lots.length === 0) {
            // No lots found, create a new one
            const form_id = crypto.randomUUID();
            await supabase
                .from('inline_inspection_form_master')
                .insert([{
                    form_id: form_id,
                    traceability_code: traceabilityCode,
                    lot_letter: lotLetter,
                    inspection_data: { rolls: [], summary: {} },
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }]);
            // Now reload to show the new table
            return await loadAllLots();
        }
        // Clear the container before repopulating
        tablesContainer.innerHTML = '';
        lots.forEach(lot => {
            console.log('Rendering lot:', lot);
            createLotTable(lot, lot.inspection_data && lot.inspection_data.rolls ? lot.inspection_data.rolls.length : 0);
        });
        // Ensure Add Next Lot button is only appended once at the end
        if (addNewTableBtn.parentNode !== tablesContainer) {
            tablesContainer.appendChild(addNewTableBtn);
        }
        // Fix: Apply color coding and update summary after reload
        applyColorCodingToTable();
        updateSummaryTable();
        updateFastEntryTabOrder(); // <-- Ensure tab order is set after reload
        addLockCheckboxListeners(); // <-- Ensure checkbox listeners are set after reload
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
        // 1. Aggregate all rolls from all lots
        let allRolls = [];
        lots.forEach(lot => {
            if (lot.inspection_data && Array.isArray(lot.inspection_data.rolls)) {
                allRolls = allRolls.concat(lot.inspection_data.rolls);
            }
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
        let html = '<thead><tr style="height: 30px;"><th>Defect Name</th><th>Count</th></tr></thead><tbody>';
        if (Object.keys(defectCounts).length === 0) {
            html += '<tr style="height: 30px;"><td colspan="2">No defects found in this shift.</td></tr>';
        } else {
            Object.entries(defectCounts).forEach(([defect, count]) => {
                html += `<tr style="height: 30px;"><td>${defect}</td><td>${count}</td></tr>`;
            });
        }
        html += '</tbody>';
        summaryTable.innerHTML = html;
        // Append the defects summary table to the container if not already present
        if (!summaryTableContainer.contains(summaryTable)) {
            summaryTableContainer.appendChild(summaryTable);
        }
        // Add separator between summary tables if not present
        let separator = document.getElementById('summaryTableSeparator');
        if (!separator) {
            separator = document.createElement('div');
            separator.id = 'summaryTableSeparator';
            separator.style.width = '2px';
            separator.style.background = '#bbb';
            separator.style.margin = '0 24px';
            separator.style.alignSelf = 'stretch';
            // Insert separator between the two tables
            if (summaryTableContainer.children.length === 1) {
                summaryTableContainer.appendChild(separator);
            } else if (summaryTableContainer.children.length === 2 && !summaryTableContainer.contains(separator)) {
                summaryTableContainer.insertBefore(separator, summaryTableContainer.children[1]);
            }
        }
    }

    // On initial load
    await loadAllLots();
    addSaveListeners(); // <-- Ensure new table cells are hooked up for saving

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
        let html = '<thead><tr style="height: 30px;"><th>Defect Name</th><th>Count</th></tr></thead><tbody>';
        if (Object.keys(defectCounts).length === 0) {
            html += '<tr style="height: 30px;"><td colspan="2">No defects found in this shift.</td></tr>';
        } else {
            Object.entries(defectCounts).forEach(([defect, count]) => {
                html += `<tr style="height: 30px;"><td>${defect}</td><td>${count}</td></tr>`;
            });
        }
        html += '</tbody>';
        summaryTable.innerHTML = html;
        if (!summaryTableContainer.contains(summaryTable)) {
            summaryTableContainer.appendChild(summaryTable);
        }
    }
    // Call this after loadAllLots
    renderDefectsSummaryTable();
    // Attach dynamic update on input/change in defect_name cells
    if (tablesContainer) {
        tablesContainer.addEventListener('input', function(e) {
            if (e.target && e.target.dataset && e.target.dataset.field === 'defect_name') {
                renderDefectsSummaryTable();
            }
        }, true);
    }

    // 1. Fetch all defects from Supabase on page load
    let defectSuggestions = [];
    (async function fetchAllDefects() {
        const { data, error } = await supabase.from('all_defects').select('defect_name').eq('is_active', true);
        if (!error && data) {
            defectSuggestions = data.map(d => d.defect_name);
        }
    })();

    // 2. Autocomplete logic for defect_name cells
    function showDefectAutocomplete(cell) {
        // Remove any existing dropdown
        document.querySelectorAll('.defect-autocomplete-dropdown').forEach(el => el.remove());
        const inputValue = cell.textContent.trim().toLowerCase();
        if (inputValue.length === 0) return; // Only show dropdown if user has typed something
        const matches = defectSuggestions.filter(d => d.toLowerCase().startsWith(inputValue) && d.trim() !== '');
        if (matches.length === 0) return;
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

    // 3. Attach event listeners to tablesContainer for defect_name cells
    if (tablesContainer) {
        tablesContainer.addEventListener('focusin', function(e) {
            if (e.target && e.target.dataset && e.target.dataset.field === 'defect_name') {
                showDefectAutocomplete(e.target);
            }
        });
        tablesContainer.addEventListener('input', function(e) {
            if (e.target && e.target.dataset && e.target.dataset.field === 'defect_name') {
                showDefectAutocomplete(e.target);
            }
        });
        // Optional: Hide dropdown on scroll
        window.addEventListener('scroll', function() {
            document.querySelectorAll('.defect-autocomplete-dropdown').forEach(el => el.remove());
        });
    }

    // Ensure tablesContainer has position: relative in CSS
    if (tablesContainer) {
        tablesContainer.style.position = 'relative';
    }
}); 