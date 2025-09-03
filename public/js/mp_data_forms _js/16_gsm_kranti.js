// Supabase integration for auto-saving to database
import { supabase } from '../../supabase-config.js';

document.addEventListener('DOMContentLoaded', function() {
    // ===== SESSION INITIALIZATION =====
    // Load session variables from sessionStorage (set by film_inspection_list.js)
    const sessionFormId = sessionStorage.getItem('currentFormId');
    const sessionLotNo = sessionStorage.getItem('currentLotNo');
    const sessionProductCode = sessionStorage.getItem('currentProductCode');
    
    if (sessionFormId && sessionLotNo) {
        // Set these as current session variables
        window.currentFormId = sessionFormId;
        window.currentLotNo = sessionLotNo;
    }

    // Page 1 elements
    const addRowsBtn = document.getElementById('addNewRowsBtn');
    const deleteRowsBtn = document.getElementById('deleteRowsBtn');
    const numRowsInput = document.getElementById('numRowsInput');
    const testingTableBody = document.getElementById('testingTableBody');
    const rowCountDisplay = document.getElementById('rowCountDisplay');

               // Page 2 elements
           const testingTableBody2 = document.getElementById('testingTableBody2');
           const rowCountDisplay2 = document.getElementById('rowCountDisplay2');
           
           // Page 3 elements
           const testingTableBody3 = document.getElementById('testingTableBody3');
           const rowCountDisplay3 = document.getElementById('rowCountDisplay3');
           
           // Page 4 elements
           const testingTableBody4 = document.getElementById('testingTableBody4');
           const rowCountDisplay4 = document.getElementById('rowCountDisplay4');

           if (!addRowsBtn || !deleteRowsBtn || !numRowsInput || !testingTableBody || !testingTableBody2 || !testingTableBody3 || !testingTableBody4) {
           return;
       }
       
       // Header form elements
       const productCodeInput = document.querySelector('input[placeholder="Enter Product Code"]');
       const productionOrderInput = document.querySelector('input[placeholder="Enter Prod. Order"]');
       const machineInput = document.querySelector('input[placeholder="Enter Machine"]');
       const productionDateInput = document.querySelector('input[type="date"]:nth-of-type(1)');
       const specificationInput = document.querySelector('input[placeholder="Enter Specification"]');
       const poInput = document.querySelector('input[placeholder="Enter PO"]');
       const quantityInput = document.querySelector('input[placeholder="Enter Quantity"]');
       
       // Try multiple selectors for inspection date
       let inspectionDateInput = document.querySelector('input[type="date"]:nth-of-type(2)');
       if (!inspectionDateInput) {
           inspectionDateInput = document.querySelector('input[placeholder*="Inspection"]');
       }
       if (!inspectionDateInput) {
           inspectionDateInput = document.querySelector('input[placeholder*="inspection"]');
       }
       if (!inspectionDateInput) {
           // Try to find by looking for the second date input after production date
           const allDateInputs = document.querySelectorAll('input[type="date"]');
           inspectionDateInput = allDateInputs[1] || null;
       }
       


       // ===== AUTO-SAVE TO DATABASE (LIKE INLINE INSPECTION FORM) =====
       
       // Track current form session to prevent multiple rows
       // Use global variables set from sessionStorage
       let currentFormId = sessionFormId || null; // Store current form_id (UUID) for updates
       let currentLotNo = sessionLotNo || null;  // Store current lot_no for updates
       

       
       // Auto-save all form data to database (debounced)
       async function autoSaveToDatabase() {
           try {
               // Get header form data
               const headerData = {
                   product_code: productCodeInput?.value || '',
                   production_order: productionOrderInput?.value || '',
                   machine_no: machineInput?.value || '',
                   production_date: productionDateInput?.value || null,
                   inspection_date: inspectionDateInput?.value || null,
                   specification: specificationInput?.value || '',
                   purchase_order: poInput?.value || '',
                   quantity: quantityInput?.value ? parseInt(quantityInput.value) : null,
                   lot_no: currentLotNo || generateLotNumber(), // Use existing or generate new
                   // Don't overwrite ref_no and prepared_by if updating existing form
                   ...(currentFormId ? {} : {
                       ref_no: generateRefNumber(),
                       prepared_by: 'User'
                   })
               };
               
               // Get table data and convert to JSONB format
               const tableData = {
                   // Sample Identification: Convert to JSONB arrays for each column
                   // These are the 3 columns under Sample No. header
                   lot_and_roll: convertColumnToJSONB(testingTableBody, 0),      // Lot & Roll (HTML column 0)
                   roll_id: convertColumnToJSONB(testingTableBody, 1),           // Roll ID (HTML column 1)
                   lot_time: convertColumnToJSONB(testingTableBody, 2),          // Lot Time (HTML column 2)
                   
                   // Page 1: Convert to JSONB arrays for each column
                   // HTML: Sample No (colspan="3"), Basic Weight (GSM), Thickness, Opacity, COF, Cut Width, Color Delta Unprinted, Color Delta Printed
                   // HTML columns: 0(Sample No), 1(Basic Weight), 2(Thickness), 3(Opacity), 4(COF), 5(Cut Width), 6(Color Unprinted), 7(Color Printed)
                   page1_basic_weight: convertColumnToJSONB(testingTableBody, 3), // Basic Weight (GSM) - HTML column 3
                   page1_thickness: convertColumnToJSONB(testingTableBody, 4),   // Thickness - HTML column 4
                   page1_opacity: convertColumnToJSONB(testingTableBody, 5),     // Opacity - HTML column 5
                   page1_cof_kinetic: convertColumnToJSONB(testingTableBody, 6), // COF Kinetic - HTML column 6
                   page1_cut_width: convertColumnToJSONB(testingTableBody, 7),   // Cut Width - HTML column 7
                   page1_color_delta_unprinted: convertColumnToJSONB(testingTableBody, 8), // Color Delta Unprinted - HTML column 8
                   page1_color_delta_printed: convertColumnToJSONB(testingTableBody, 9),   // Color Delta Printed - HTML column 9
                   
                   // Page 2: Convert to JSONB arrays for each column
                   // HTML: Sample No (colspan="3"), Elongation MD (colspan="4"), Force MD (colspan="4"), Force 5% MD (colspan="4")
                   // HTML columns: 0(Sample No), 1(Elongation1), 2(Elongation2), 3(Elongation3), 4(ElongationAve), 5(Force1), 6(Force2), 7(Force3), 8(ForceAve), 9(Force5%1), 10(Force5%2), 11(Force5%3), 12(Force5%Ave)
                   page2_elongation_md_1: convertColumnToJSONB(testingTableBody2, 3),     // Elongation MD 1 - HTML column 3
                   page2_elongation_md_2: convertColumnToJSONB(testingTableBody2, 4),     // Elongation MD 2 - HTML column 4
                   page2_elongation_md_3: convertColumnToJSONB(testingTableBody2, 5),     // Elongation MD 3 - HTML column 5
                   page2_force_md_1: convertColumnToJSONB(testingTableBody2, 7),          // Force MD 1 - HTML column 7
                   page2_force_md_2: convertColumnToJSONB(testingTableBody2, 8),          // Force MD 2 - HTML column 8
                   page2_force_md_3: convertColumnToJSONB(testingTableBody2, 9),          // Force MD 3 - HTML column 9
                   page2_force_5p_md_1: convertColumnToJSONB(testingTableBody2, 11),     // Force 5% MD 1 - HTML column 11
                   page2_force_5p_md_2: convertColumnToJSONB(testingTableBody2, 12),     // Force 5% MD 2 - HTML column 12
                   page2_force_5p_md_3: convertColumnToJSONB(testingTableBody2, 13),     // Force 5% MD 3 - HTML column 13
                   
                   // Page 3: Convert to JSONB arrays for each column
                   // HTML: Sample No (colspan="3"), Elongation CD (colspan="4"), Force CD (colspan="4"), Modulus (colspan="3")
                   // HTML columns: 0(Sample No), 1(Elongation1), 2(Elongation2), 3(Elongation3), 4(ElongationAve), 5(Force1), 6(Force2), 7(Force3), 8(ForceAve), 9(Modulus1), 10(Modulus2), 11(Modulus3)
                   page3_elongation_cd_1: convertColumnToJSONB(testingTableBody3, 3),     // Elongation CD 1 - HTML column 3
                   page3_elongation_cd_2: convertColumnToJSONB(testingTableBody3, 4),     // Elongation CD 2 - HTML column 4
                   page3_elongation_cd_3: convertColumnToJSONB(testingTableBody3, 5),     // Elongation CD 3 - HTML column 5
                   page3_force_cd_1: convertColumnToJSONB(testingTableBody3, 7),          // Force CD 1 - HTML column 7
                   page3_force_cd_2: convertColumnToJSONB(testingTableBody3, 8),          // Force CD 2 - HTML column 8
                   page3_force_cd_3: convertColumnToJSONB(testingTableBody3, 9),          // Force CD 3 - HTML column 9
                   page3_modulus_1: convertColumnToJSONB(testingTableBody3, 11),          // Modulus 1 - HTML column 11
                   page3_modulus_2: convertColumnToJSONB(testingTableBody3, 12),          // Modulus 2 - HTML column 12
                   page3_modulus_3: convertColumnToJSONB(testingTableBody3, 13),          // Modulus 3 - HTML column 13
                   
                   // Page 4: Convert to JSONB arrays for each column
                   // HTML: Sample No (colspan="3"), Gloss (colspan="3"), PG Quality
                   // HTML columns: 0(Sample No), 1(Gloss1), 2(Gloss2), 3(Gloss3), 4(PG Quality)
                           page4_gloss_1: convertColumnToJSONB(testingTableBody4, 3),            // Gloss 1 - HTML column 3
        page4_gloss_2: convertColumnToJSONB(testingTableBody4, 4),            // Gloss 2 - HTML column 4
        page4_gloss_3: convertColumnToJSONB(testingTableBody4, 5),            // Gloss 3 - HTML column 5
        page4_pg_quality: convertColumnToJSONB(testingTableBody4, 7),         // PG Quality - HTML column 7
               };
               
               // Combine header and table data
               const completeData = { ...headerData, ...tableData };
               

               
               // Upsert data into Supabase (update if exists, insert if new)
               let result;
               if (currentFormId) {
                   // Update existing record
                   result = await supabase
                       .from('168_16cp_kranti')
                       .update(completeData)
                       .eq('form_id', currentFormId)
                       .select('form_id');
               } else {
                   // Insert new record
                   result = await supabase
                       .from('168_16cp_kranti')
                       .insert([completeData])
                       .select('form_id');
               }
               
               const { data, error } = result;
               
               if (error) {
                   console.error('Supabase error:', error);
                   return;
               }
               
               // Store form_id and lot_no for future updates
               if (data && data.length > 0) {
                   currentFormId = data[0].form_id; // Now stores UUID
                   currentLotNo = headerData.lot_no;
               }
               

           } catch (error) {
               console.error('Error auto-saving to Supabase:', error);
           }
       }
       
       // Debounced auto-save function (like inline inspection form)
       function debouncedAutoSave() {
           clearTimeout(saveTimeout);
           saveTimeout = setTimeout(autoSaveToDatabase, 1000); // 1 second delay like inline inspection
       }
       
       // Update existing debouncedSave to use database instead of localStorage
       function debouncedSave() {
           clearTimeout(saveTimeout);
           saveTimeout = setTimeout(autoSaveToDatabase, 1000); // 1 second delay as requested
       }
       
       // Get table data (excluding summary rows)
       function getTableData(tableBody) {
           const rows = Array.from(tableBody.querySelectorAll('tr'));
           const dataRows = rows.filter(row => {
               const firstCell = row.querySelector('td');
               return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
           });
           
           return dataRows.map(row => {
               const inputs = row.querySelectorAll('input');
               return Array.from(inputs).map(input => input.value);
           });
       }
       
              // Load table data
       function loadTableData(tableBody, data) {
           if (!data || data.length === 0) return;
           
           // Find the first summary row (Average row) to insert data rows before it
           const summaryRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
               const firstCell = row.querySelector('td');
               return firstCell && ['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
           });
           
           if (summaryRows.length === 0) return;
           
           const firstSummaryRow = summaryRows[0]; // Average row
           
           data.forEach(rowData => {
               const tr = document.createElement('tr');
               tr.className = 'border border-gray-800 px-3 py-2 text-center';
               
                               rowData.forEach(cellValue => {
                    const td = document.createElement('td');
                    td.className = 'testing-table-cell';
                    td.style.fontSize = '13px';
                   
                   const input = document.createElement('input');
                   input.type = 'text';
                   input.className = 'testing-input';
                   input.value = cellValue;
                   
                   // Add event listener for automatic average calculation
                   input.addEventListener('input', function() {
                       // Only calculate row averages for Pages 2, 3, 4 (not Page 1)
                       if (tableBody.id !== 'testingTableBody') {
                           calculateRowAverages(tr, tableBody);
                       }
                       // Also calculate summary statistics for vertical Ave columns (Page 2 & 3 only)
                       if (tableBody.id === 'testingTableBody2' || tableBody.id === 'testingTableBody3') {
                           calculateSummaryStatistics(tableBody);
                       }
                       // Calculate individual column stats for Page 1 (only the changed column)
                       if (tableBody.id === 'testingTableBody') {
                           const inputIndex = Array.from(tr.querySelectorAll('input')).indexOf(input);
                           calculatePage1ColumnStats(tableBody, inputIndex);
                       }
                       
                       // Auto-save to database after each change (debounced)
                       debouncedSave();
                   });
                   
                   td.appendChild(input);
                   tr.appendChild(td);
               });
               
               // Insert the row BEFORE the first summary row (Average row)
               tableBody.insertBefore(tr, firstSummaryRow);
               
               // Add highlighting functionality to the loaded row
               addHighlightingToRow(tr);
           });
           
           // Recalculate summary statistics for Pages 2, 3 and 4 after loading data
           if (tableBody.id === 'testingTableBody2' || tableBody.id === 'testingTableBody3' || tableBody.id === 'testingTableBody4') {
               calculateSummaryStatistics(tableBody);
           }
       }
       
       // Clear data rows (excluding summary rows)
       function clearDataRows(tableBody) {
           const rows = Array.from(tableBody.querySelectorAll('tr'));
           rows.forEach(row => {
               const firstCell = row.querySelector('td');
               if (firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                   row.remove();
               }
           });
       }
       
       // Show notification
       function showNotification(message, type = 'info') {
           // Create notification element
           const notification = document.createElement('div');
           notification.className = `fixed top-20 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm ${
               type === 'success' ? 'bg-green-500 text-white' :
               type === 'error' ? 'bg-red-500 text-white' :
               'bg-blue-500 text-white'
           }`;
           notification.textContent = message;
           
           // Add to page
           document.body.appendChild(notification);
           
           // Remove after 3 seconds
           setTimeout(() => {
               notification.remove();
           }, 3000);
       }
       

       
       // Convert a table column to JSONB format (exactly like screenshot)
       function convertColumnToJSONB(tableBody, columnIndex) {
           const rows = Array.from(tableBody.querySelectorAll('tr'));
           const dataRows = rows.filter(row => {
               const firstCell = row.querySelector('td');
               return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
           });
           

           
           const jsonbObject = {};
           // Create JSONB object with all row numbers (1, 2, 3, 4, 5, 6, 7, etc.)
           for (let i = 1; i <= dataRows.length; i++) {
               const rowIndex = i - 1;
               const row = dataRows[rowIndex];
               
               // Find the input element for this specific column based on table type
               let inputElement = null;
               
               if (tableBody.id === 'testingTableBody') {
                   // Page 1: Basic structure with 3 sample columns + 7 data columns
                   // DOM columns: 0(Sample1), 1(Sample2), 2(Sample3), 3(Basic Weight), 4(Thickness), 5(Opacity), 6(COF), 7(Cut Width), 8(Color Unprinted), 9(Color Printed)
                   // Input indices: 0(Sample1), 1(Sample2), 2(Sample3), 3(Basic Weight), 4(Thickness), 5(Opacity), 6(COF), 7(Cut Width), 8(Color Unprinted), 9(Color Printed)
                   if (columnIndex === 0) {
                       // Sample Number column - find input in first column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[0] || null;
                   } else if (columnIndex === 1) {
                       // Lot Number column - find input in second column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[1] || null;
                   } else if (columnIndex === 2) {
                       // Roll Number column - find input in third column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[2] || null;
                   } else {
                       // Data columns - find input element (column index = input index)
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[columnIndex] || null;
                   }
               } else if (tableBody.id === 'testingTableBody2' || tableBody.id === 'testingTableBody3') {
                   // Page 2 & 3: 3 sample columns + 12 data columns
                   // DOM columns: 0(Sample1), 1(Sample2), 2(Sample3), 3(Elongation1), 4(Elongation2), 5(Elongation3), 6(ElongationAve), 7(Force1), 8(Force2), 9(Force3), 10(ForceAve), 11(Force5%1), 12(Force5%2), 13(Force5%3), 14(Force5%Ave)
                   // Input indices: 0(Sample1), 1(Sample2), 2(Sample3), 3(Elongation1), 4(Elongation2), 5(Elongation3), 6(ElongationAve), 7(Force1), 8(Force2), 9(Force3), 10(ForceAve), 11(Force5%1), 12(Force5%2), 13(Force5%3), 14(Force5%Ave)
                   if (columnIndex === 0) {
                       // Sample Number column - find input in first column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[0] || null;
                   } else if (columnIndex === 1) {
                       // Lot Number column - find input in second column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[1] || null;
                   } else if (columnIndex === 2) {
                       // Roll Number column - find input in third column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[2] || null;
                   } else {
                       // Data columns - find input element (column index = input index)
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[columnIndex] || null;
                   }
               } else if (tableBody.id === 'testingTableBody4') {
                   // Page 4: 3 sample columns + 5 data columns
                   // DOM columns: 0(Sample1), 1(Sample2), 2(Sample3), 3(Gloss1), 4(Gloss2), 5(Gloss3), 6(PG Quality), 7
                   // Input indices: 0(Sample1), 1(Sample2), 2(Sample3), 3(Gloss1), 4(Gloss2), 5(Gloss3), 6(PG Quality)
                   if (columnIndex === 0) {
                       // Sample Number column - find input in first column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[0] || null;
                   } else if (columnIndex === 1) {
                       // Lot Number column - find input in second column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[1] || null;
                   } else if (columnIndex === 2) {
                       // Roll Number column - find input in third column
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[2] || null;
                   } else {
                       // Data columns - find input element (column index = input index)
                       const inputs = row.querySelectorAll('input');
                       inputElement = inputs[columnIndex] || null;
                   }
               }
               
               if (inputElement && inputElement.value && inputElement.value.trim() !== '') {
                   jsonbObject[String(i)] = inputElement.value.trim(); // Actual value
               } else {
                   jsonbObject[String(i)] = ""; // Empty string
               }
           }
           
                          return Object.keys(jsonbObject).length > 0 ? jsonbObject : null;
       }
       
       // Generate unique lot number
       function generateLotNumber() {
           const timestamp = new Date().getTime();
           const random = Math.floor(Math.random() * 1000);
           return `LOT_${timestamp}_${random}`;
       }
       
       // Generate unique reference number
       function generateRefNumber() {
           const timestamp = new Date().getTime();
           const random = Math.floor(Math.random() * 1000);
           return `REF_${timestamp}_${random}`;
       }
       
       // Clear current form session (for new form)
       function clearFormSession() {
           currentFormId = null; // Clear UUID
           currentLotNo = null;
           console.log('Form session cleared - ready for new form');
       }
       
       // ===== CELL HIGHLIGHTING FUNCTIONALITY =====
       
       // Track currently highlighted cell
       let highlightedCell = null;
       
       // Function to clear cell highlighting
       function clearCellHighlighting() {
           if (highlightedCell) {
               highlightedCell.classList.remove('highlighted');
               highlightedCell = null;
           }
       }
       
       // Function to highlight a cell
       function highlightCell(cell) {
           // Remove previous highlight
           if (highlightedCell) {
               highlightedCell.classList.remove('highlighted');
           }
           
           // Add new highlight
           if (cell) {
               cell.classList.add('highlighted');
               highlightedCell = cell;
               
               // Focus the input inside the cell for keyboard navigation
               const input = cell.querySelector('input');
               if (input) {
                   input.focus();
               }
           } else {
               highlightedCell = null;
           }
       }
       
       // Function to add click highlighting to all cells (excluding summary rows)
       function addCellHighlighting() {
           const allTables = [testingTableBody, testingTableBody2, testingTableBody3, testingTableBody4];
           
           allTables.forEach((tableBody, tableIndex) => {
               const cells = tableBody.querySelectorAll('td');
               
               cells.forEach((cell, cellIndex) => {
                   // Check if this cell is in a summary row (Average, Min, Max)
                   const row = cell.closest('tr');
                   const firstCellInRow = row.querySelector('td');
                   const isSummaryRow = firstCellInRow && ['Average', 'Minimum', 'Maximum'].includes(firstCellInRow.textContent.trim());
                   
                   // Skip summary rows - no highlighting or events
                   if (isSummaryRow) {
                       return;
                   }
                   
                   // Remove any existing event listeners
                   cell.replaceWith(cell.cloneNode(true));
                   
                   // Get the fresh cell reference
                   const freshCell = tableBody.querySelectorAll('td')[cellIndex];
                   
                   // Add click event
                   freshCell.addEventListener('click', function(e) {
                       e.preventDefault();
                       highlightCell(this);
                   });
                   
                   // Add keyboard navigation to inputs
                   const input = freshCell.querySelector('input');
                   if (input) {
                       input.addEventListener('keydown', function(e) {
                           handleKeyboardNavigation(e, freshCell);
                       });
                   }
               });
           });
       }
       
       // Function to handle keyboard navigation
       function handleKeyboardNavigation(e, currentCell) {
           const allTables = [testingTableBody, testingTableBody2, testingTableBody3, testingTableBody4];
           let allCells = [];
           
           // Collect all cells from all tables (excluding summary rows)
           allTables.forEach(tableBody => {
               const cells = Array.from(tableBody.querySelectorAll('td'));
               // Filter out cells in summary rows
               const dataCells = cells.filter(cell => {
                   const row = cell.closest('tr');
                   const firstCellInRow = row.querySelector('td');
                   return !firstCellInRow || !['Average', 'Minimum', 'Maximum'].includes(firstCellInRow.textContent.trim());
               });
               allCells = allCells.concat(dataCells);
           });
           
           const currentIndex = allCells.indexOf(currentCell);
           let nextCell = null;
           
           // Define columns per row for each table type
           const getColumnsPerRow = (tableBody) => {
               if (tableBody.id === 'testingTableBody') return 10;      // Page 1: 10 columns
               if (tableBody.id === 'testingTableBody2') return 15;     // Page 2: 15 columns  
               if (tableBody.id === 'testingTableBody3') return 15;     // Page 3: 15 columns
               if (tableBody.id === 'testingTableBody4') return 8;      // Page 4: 8 columns
               return 10; // Default fallback
           };
           
           // Get the current table and its column count
           const currentTable = currentCell.closest('tbody');
           const columnsPerRow = getColumnsPerRow(currentTable);
           
           switch(e.key) {
               case 'Tab':
                   e.preventDefault();
                   // Stay within current page for Tab navigation
                   const tabTable = currentCell.closest('tbody');
                   const tabTableCells = Array.from(tabTable.querySelectorAll('td')).filter(cell => {
                       const row = cell.closest('tr');
                       const firstCellInRow = row.querySelector('td');
                       return !firstCellInRow || !['Average', 'Minimum', 'Maximum'].includes(firstCellInRow.textContent.trim());
                   });
                   
                   const tabTableIndex = tabTableCells.indexOf(currentCell);
                   
                   if (e.shiftKey) {
                       // Shift + Tab: move to previous cell within current page
                       nextCell = tabTableIndex > 0 ? tabTableCells[tabTableIndex - 1] : tabTableCells[tabTableCells.length - 1];
                   } else {
                       // Tab: move to next cell within current page
                       nextCell = tabTableIndex < tabTableCells.length - 1 ? tabTableCells[tabTableIndex + 1] : tabTableCells[0];
                   }
                   break;
                   
               case 'ArrowUp':
                   e.preventDefault();
                   // Find cell above (move up by columns per row) but stay within current page
                   const upTable = currentCell.closest('tbody');
                   const upTableCells = Array.from(upTable.querySelectorAll('td')).filter(cell => {
                       const row = cell.closest('tr');
                       const firstCellInRow = row.querySelector('td');
                       return !firstCellInRow || !['Average', 'Minimum', 'Maximum'].includes(firstCellInRow.textContent.trim());
                   });
                   
                   const upTableIndex = upTableCells.indexOf(currentCell);
                   const upColumnsPerRow = getColumnsPerRow(upTable);
                   
                   // Move to row above within the same table
                   const upRowIndex = upTableIndex - upColumnsPerRow;
                   if (upRowIndex >= 0) {
                       nextCell = upTableCells[upRowIndex];
                   } else {
                       // If at first row of current table, stay in the same cell
                       nextCell = currentCell;
                   }
                   break;
                   
               case 'ArrowDown':
                   e.preventDefault();
                   // Find cell below (move down by columns per row) but stay within current page
                   const downTable = currentCell.closest('tbody');
                   const downTableCells = Array.from(downTable.querySelectorAll('td')).filter(cell => {
                       const row = cell.closest('tr');
                       const firstCellInRow = row.querySelector('td');
                       return !firstCellInRow || !['Average', 'Minimum', 'Maximum'].includes(firstCellInRow.textContent.trim());
                   });
                   
                   const downTableIndex = downTableCells.indexOf(currentCell);
                   const downColumnsPerRow = getColumnsPerRow(downTable);
                   
                   // Move to row below within the same table
                   const downRowIndex = downTableIndex + downColumnsPerRow;
                   if (downRowIndex < downTableCells.length) {
                       nextCell = downTableCells[downRowIndex];
                   } else {
                       // If at last row of current table, stay in the same cell
                       nextCell = currentCell;
                   }
                   break;
                   
               case 'ArrowLeft':
                   e.preventDefault();
                   // Move to previous cell but stay within current page
                   const leftTable = currentCell.closest('tbody');
                   const leftTableCells = Array.from(leftTable.querySelectorAll('td')).filter(cell => {
                       const row = cell.closest('tr');
                       const firstCellInRow = row.querySelector('td');
                       return !firstCellInRow || !['Average', 'Minimum', 'Maximum'].includes(firstCellInRow.textContent.trim());
                   });
                   
                   const leftTableIndex = leftTableCells.indexOf(currentCell);
                   
                   // Move to previous cell within the same table
                   if (leftTableIndex > 0) {
                       nextCell = leftTableCells[leftTableIndex - 1];
                   } else {
                       // If at first cell of current table, stay in the same cell
                       nextCell = currentCell;
                   }
                   break;
                   
               case 'ArrowRight':
                   e.preventDefault();
                   // Move to next cell but stay within current page
                   const rightTable = currentCell.closest('tbody');
                   const rightTableCells = Array.from(rightTable.querySelectorAll('td')).filter(cell => {
                       const row = cell.closest('tr');
                       const firstCellInRow = row.querySelector('td');
                       return !firstCellInRow || !['Average', 'Minimum', 'Maximum'].includes(firstCellInRow.textContent.trim());
                   });
                   
                   const rightTableIndex = rightTableCells.indexOf(currentCell);
                   
                   // Move to next cell within the same table
                   if (rightTableIndex < rightTableCells.length - 1) {
                       nextCell = rightTableCells[rightTableIndex + 1];
                   } else {
                       // If at last cell of current table, stay in the same cell
                       nextCell = currentCell;
                   }
                   break;
                   
               case 'Enter':
                   e.preventDefault();
                   // Move to cell below (next row) but stay within current page
                   const enterTable = currentCell.closest('tbody');
                   const enterTableCells = Array.from(enterTable.querySelectorAll('td')).filter(cell => {
                       const row = cell.closest('tr');
                       const firstCellInRow = row.querySelector('td');
                       return !firstCellInRow || !['Average', 'Minimum', 'Maximum'].includes(firstCellInRow.textContent.trim());
                   });
                   
                   const enterTableIndex = enterTableCells.indexOf(currentCell);
                   const enterColumnsPerRow = getColumnsPerRow(enterTable);
                   
                   // Move to next row within the same table
                   const nextRowIndex = enterTableIndex + enterColumnsPerRow;
                   if (nextRowIndex < enterTableCells.length) {
                       nextCell = enterTableCells[nextRowIndex];
                   } else {
                       // If at last row of current table, stay in the same cell
                       nextCell = currentCell;
                   }
                   break;
           }
           
           if (nextCell) {
               highlightCell(nextCell);
           }
       }
       
       // Function to add highlighting to new rows (excluding summary rows)
       function addHighlightingToRow(row) {
           // Check if this row is a summary row (Average, Min, Max)
           const firstCellInRow = row.querySelector('td');
           const isSummaryRow = firstCellInRow && ['Average', 'Minimum', 'Maximum'].includes(firstCellInRow.textContent.trim());
           
           // Skip summary rows - no highlighting or events
           if (isSummaryRow) {
               return;
           }
           
           const cells = row.querySelectorAll('td');
           cells.forEach(cell => {
               cell.addEventListener('click', function() {
                   highlightCell(this);
               });
               
               // Add keyboard navigation to inputs
               const input = cell.querySelector('input');
               if (input) {
                   input.addEventListener('keydown', function(e) {
                       handleKeyboardNavigation(e, cell);
                   });
               }
           });
       }
       
       // Enhanced debounced save with memory management
       let saveTimeout = null;
       
       // This function is now replaced by the new debouncedSave that saves to database

    // Update row count for Page 1
    function updateRowCount() {
        const dataRows = testingTableBody.querySelectorAll('tr').length - 3;
        rowCountDisplay.textContent = `Rows: ${Math.max(0, dataRows)}`;
    }

           // Update row count for Page 2
       function updateRowCount2() {
           const dataRows = testingTableBody2.querySelectorAll('tr').length - 3;
           rowCountDisplay2.textContent = `Rows: ${Math.max(0, dataRows)}`;
       }
       
       // Update row count for Page 3
       function updateRowCount3() {
           const dataRows = testingTableBody3.querySelectorAll('tr').length - 3;
           rowCountDisplay3.textContent = `Rows: ${Math.max(0, dataRows)}`;
       }
       
       // Update row count for Page 4
       function updateRowCount4() {
           const dataRows = testingTableBody4.querySelectorAll('tr').length - 3;
           rowCountDisplay4.textContent = `Rows: ${Math.max(0, dataRows)}`;
       }

         // Load data from database when page loads
         async function loadDataFromDatabase() {
             try {
                 // Check if we have a current form session
                 if (currentFormId) {
                     const { data, error } = await supabase
                         .from('168_16cp_kranti')
                         .select('*')
                         .eq('form_id', currentFormId)
                         .single();
                     
                     if (error) {
                         console.log('No existing data found or error:', error.message);
                         return;
                     }
                     
                     if (data) {
                         // Set session variables from loaded data
                         currentFormId = data.form_id;
                         currentLotNo = data.lot_no;
                         loadTableDataFromDatabase(data);
                     }
                 }
             } catch (error) {
                 console.error('Error loading data from database:', error);
             }
         }
         
         // Load table data from database into the form
         function loadTableDataFromDatabase(dbData) {
             // Load header data
             if (dbData.product_code && productCodeInput) productCodeInput.value = dbData.product_code;
             if (dbData.production_order && productionOrderInput) productionOrderInput.value = dbData.production_order;
             if (dbData.machine_no && machineInput) machineInput.value = dbData.machine_no;
             if (dbData.production_date && productionDateInput) {
                 // Convert ISO date to yyyy-MM-dd format for HTML date input
                 const date = new Date(dbData.production_date);
                 const formattedDate = date.toISOString().split('T')[0]; // yyyy-MM-dd format
                 productionDateInput.value = formattedDate;
             }
             if (dbData.specification && specificationInput) specificationInput.value = dbData.specification;
             if (dbData.purchase_order && poInput) poInput.value = dbData.purchase_order;
             if (dbData.quantity && quantityInput) quantityInput.value = dbData.quantity;
             if (dbData.inspection_date && inspectionDateInput) {
                 // Convert ISO date to yyyy-MM-dd format for HTML date input
                 const date = new Date(dbData.inspection_date);
                 const formattedDate = date.toISOString().split('T')[0]; // yyyy-MM-dd format
                 inspectionDateInput.value = formattedDate;
             }
             
             // Load Sample Identification data (the 3 columns under Sample No. header)
             if (dbData.lot_and_roll) loadColumnDataToTable(testingTableBody, 0, dbData.lot_and_roll);
             if (dbData.roll_id) loadColumnDataToTable(testingTableBody, 1, dbData.roll_id);
             if (dbData.lot_time) loadColumnDataToTable(testingTableBody, 2, dbData.lot_time);
             
             // Load Page 1 data
             if (dbData.page1_basic_weight) loadColumnDataToTable(testingTableBody, 3, dbData.page1_basic_weight);
             if (dbData.page1_thickness) loadColumnDataToTable(testingTableBody, 4, dbData.page1_thickness);
             if (dbData.page1_opacity) loadColumnDataToTable(testingTableBody, 5, dbData.page1_opacity);
             if (dbData.page1_cof_kinetic) loadColumnDataToTable(testingTableBody, 6, dbData.page1_cof_kinetic);
             if (dbData.page1_cut_width) loadColumnDataToTable(testingTableBody, 7, dbData.page1_cut_width);
             if (dbData.page1_color_delta_unprinted) loadColumnDataToTable(testingTableBody, 8, dbData.page1_color_delta_unprinted);
             if (dbData.page1_color_delta_printed) loadColumnDataToTable(testingTableBody, 9, dbData.page1_color_delta_printed);
             
             // Load Page 2 data
             if (dbData.page2_elongation_md_1) loadColumnDataToTable(testingTableBody2, 3, dbData.page2_elongation_md_1);
             if (dbData.page2_elongation_md_2) loadColumnDataToTable(testingTableBody2, 4, dbData.page2_elongation_md_2);
             if (dbData.page2_elongation_md_3) loadColumnDataToTable(testingTableBody2, 5, dbData.page2_elongation_md_3);
             if (dbData.page2_force_md_1) loadColumnDataToTable(testingTableBody2, 7, dbData.page2_force_md_1);
             if (dbData.page2_force_md_2) loadColumnDataToTable(testingTableBody2, 8, dbData.page2_force_md_2);
             if (dbData.page2_force_md_3) loadColumnDataToTable(testingTableBody2, 9, dbData.page2_force_md_3);
             if (dbData.page2_force_5p_md_1) loadColumnDataToTable(testingTableBody2, 11, dbData.page2_force_5p_md_1);
             if (dbData.page2_force_5p_md_2) loadColumnDataToTable(testingTableBody2, 12, dbData.page2_force_5p_md_2);
             if (dbData.page2_force_5p_md_3) loadColumnDataToTable(testingTableBody2, 13, dbData.page2_force_5p_md_3);
             
             // Load Page 3 data
             if (dbData.page3_elongation_cd_1) loadColumnDataToTable(testingTableBody3, 3, dbData.page3_elongation_cd_1);
             if (dbData.page3_elongation_cd_2) loadColumnDataToTable(testingTableBody3, 4, dbData.page3_elongation_cd_2);
             if (dbData.page3_elongation_cd_3) loadColumnDataToTable(testingTableBody3, 5, dbData.page3_elongation_cd_3);
             if (dbData.page3_force_cd_1) loadColumnDataToTable(testingTableBody3, 7, dbData.page3_force_cd_1);
             if (dbData.page3_force_cd_2) loadColumnDataToTable(testingTableBody3, 8, dbData.page3_force_cd_2);
             if (dbData.page3_force_cd_3) loadColumnDataToTable(testingTableBody3, 9, dbData.page3_force_cd_3);
             if (dbData.page3_modulus_1) loadColumnDataToTable(testingTableBody3, 11, dbData.page3_modulus_1);
             if (dbData.page3_modulus_2) loadColumnDataToTable(testingTableBody3, 12, dbData.page3_modulus_2);
             if (dbData.page3_modulus_3) loadColumnDataToTable(testingTableBody3, 13, dbData.page3_modulus_3);
             
             // Load Page 4 data
                     if (dbData.page4_gloss_1) loadColumnDataToTable(testingTableBody4, 3, dbData.page4_gloss_1);
        if (dbData.page4_gloss_2) loadColumnDataToTable(testingTableBody4, 4, dbData.page4_gloss_2);
        if (dbData.page4_gloss_3) loadColumnDataToTable(testingTableBody4, 5, dbData.page4_gloss_3);
        if (dbData.page4_pg_quality) loadColumnDataToTable(testingTableBody4, 7, dbData.page4_pg_quality);
             
             // Populate Sample Identification columns across ALL pages (Page 1 editable, others uneditable)
             populateSampleColumnsAcrossAllPages(dbData);
             
             // Add real-time sync listeners to Page 1 sample columns
             addRealTimeSyncListeners();
             
             // Update row counts and recalculate statistics
             updateRowCount();
             updateRowCount2();
             updateRowCount3();
             updateRowCount4();
             
             // Delay statistics calculations to reduce CPU spike during data loading
             setTimeout(() => {
                 // Recalculate all statistics asynchronously
                 calculatePage1ColumnStats(testingTableBody);
                 calculateSummaryStatistics(testingTableBody2);
                 calculateSummaryStatistics(testingTableBody3);
                 calculateSummaryStatistics(testingTableBody4);
                 
                 // Recalculate ALL row averages for Pages 2, 3, 4 after data loads
                 recalculateAllRowAverages();
                 
                 // Force recalculation of summary statistics to populate Average/Min/Max rows
                 forceRecalculateAllSummaryStatistics();
                 
                 // Ensure all summary rows remain uneditable after data loads
                 makeSummaryRowsUneditable();
             }, 300); // 300ms delay after data loading
             

         }
         
         // Function to populate Sample Identification columns across ALL pages (Page 1 editable, others uneditable)
         function populateSampleColumnsAcrossAllPages(dbData) {
             // Get all table bodies
             const allTableBodies = [testingTableBody, testingTableBody2, testingTableBody3, testingTableBody4];
             
             allTableBodies.forEach((tableBody, tableIndex) => {
                 // Get data rows (excluding summary rows)
                 const dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                     const firstCell = row.querySelector('td');
                     return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                 });
                 
                 // Populate Sample Identification columns for each row
                 dataRows.forEach((row, rowIndex) => {
                     const inputs = row.querySelectorAll('input');
                     
                     // Column 0: Lot & Roll
                     if (inputs[0] && dbData.lot_and_roll && dbData.lot_and_roll[String(rowIndex + 1)]) {
                         inputs[0].value = dbData.lot_and_roll[String(rowIndex + 1)];
                         
                         // Only make uneditable for Pages 2, 3, 4 (keep Page 1 editable)
                         if (tableIndex > 0) { // tableIndex 0 = Page 1, 1+ = Pages 2,3,4
                             inputs[0].readOnly = true; // Make uneditable
                             inputs[0].style.backgroundColor = 'transparent'; // Normal transparent background
                             inputs[0].style.color = '#000000'; // Normal black text
                         }
                     }
                     
                     // Column 1: Roll ID
                     if (inputs[1] && dbData.roll_id && dbData.roll_id[String(rowIndex + 1)]) {
                         inputs[1].value = dbData.roll_id[String(rowIndex + 1)];
                         
                         // Only make uneditable for Pages 2, 3, 4 (keep Page 1 editable)
                         if (tableIndex > 0) { // tableIndex 0 = Page 1, 1+ = Pages 2,3,4
                             inputs[1].readOnly = true; // Make uneditable
                             inputs[1].style.backgroundColor = 'transparent'; // Normal transparent background
                             inputs[1].style.color = '#000000'; // Normal black text
                         }
                     }
                     
                     // Column 2: Lot Time
                     if (inputs[2] && dbData.lot_time && dbData.lot_time[String(rowIndex + 1)]) {
                         inputs[2].value = dbData.lot_time[String(rowIndex + 1)];
                         
                         // Only make uneditable for Pages 2, 3, 4 (keep Page 1 editable)
                         if (tableIndex > 0) { // tableIndex 0 = Page 1, 1+ = Pages 2,3,4
                             inputs[2].readOnly = true; // Make uneditable
                             inputs[2].style.backgroundColor = 'transparent'; // Normal transparent background
                             inputs[2].style.color = '#000000'; // Normal black text
                         }
                     }
                 });
             });
         }
         
         // Function to sync sample data changes from Page 1 to all other pages in real-time
         function syncSampleDataToOtherPages(rowIndex, columnIndex, newValue) {
             // Get other table bodies (Pages 2, 3, 4)
             const otherTableBodies = [testingTableBody2, testingTableBody3, testingTableBody4];
             
             otherTableBodies.forEach(tableBody => {
                 // Get data rows (excluding summary rows)
                 const dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                     const firstCell = row.querySelector('td');
                     return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                 });
                 
                 // Update the corresponding row and column
                 if (dataRows[rowIndex]) {
                     const inputs = dataRows[rowIndex].querySelectorAll('input');
                     if (inputs[columnIndex]) {
                         inputs[columnIndex].value = newValue;
                     }
                 }
             });
         }
         
         // Function to add real-time sync event listeners to Page 1 sample columns
         function addRealTimeSyncListeners() {
             // Get data rows from Page 1 (excluding summary rows)
             const dataRows = Array.from(testingTableBody.querySelectorAll('tr')).filter(row => {
                 const firstCell = row.querySelector('td');
                 return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
             });
             
             // Add event listeners to sample identification columns (0, 1, 2)
             dataRows.forEach((row, rowIndex) => {
                 const inputs = row.querySelectorAll('input');
                 
                 // Add listeners to first 3 columns (sample identification)
                 for (let colIndex = 0; colIndex < 3; colIndex++) {
                     if (inputs[colIndex]) {
                         // Remove existing listeners to avoid duplicates
                         if (inputs[colIndex]._syncHandler) {
                             inputs[colIndex].removeEventListener('input', inputs[colIndex]._syncHandler);
                         }
                         
                         // Create new sync handler
                         inputs[colIndex]._syncHandler = function() {
                             // Sync this change to all other pages immediately
                             syncSampleDataToOtherPages(rowIndex, colIndex, this.value);
                         };
                         
                         // Add the event listener
                         inputs[colIndex].addEventListener('input', inputs[colIndex]._syncHandler);
                     }
                 }
             });
         }
         
         // Function to make all summary rows (Average, Minimum, Maximum) and vertical Ave columns uneditable
         function makeSummaryRowsUneditable() {
             // Get all table bodies
             const allTableBodies = [testingTableBody, testingTableBody2, testingTableBody3, testingTableBody4];
             
             allTableBodies.forEach(tableBody => {
                 // Get all rows
                 const rows = tableBody.querySelectorAll('tr');
                 
                 rows.forEach(row => {
                     const firstCell = row.querySelector('td');
                     
                     // Check if this is a summary row (Average, Minimum, Maximum)
                     if (firstCell && ['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                         // Get all inputs in this summary row
                         const inputs = row.querySelectorAll('input');
                         
                         // Make all inputs in summary row uneditable
                         inputs.forEach(input => {
                             input.readOnly = true;
                             input.style.backgroundColor = 'transparent'; // Normal background
                             input.style.color = '#000000'; // Normal black text
                             input.style.fontWeight = 'normal'; // Normal font weight for summary rows
                         });
                     } else {
                         // This is a data row - protect vertical Ave columns
                         const inputs = row.querySelectorAll('input');
                         
                         if (tableBody.id === 'testingTableBody2') {
                             // Page 2: Protect columns 6, 10, 14 (Elongation Ave, Force Ave, Force 5% Ave)
                             if (inputs[6]) makeInputUneditable(inputs[6]); // Elongation Ave
                             if (inputs[10]) makeInputUneditable(inputs[10]); // Force Ave
                             if (inputs[14]) makeInputUneditable(inputs[14]); // Force 5% Ave
                         } else if (tableBody.id === 'testingTableBody3') {
                             // Page 3: Protect columns 6, 10, 14 (Elongation Ave, Force Ave, Modulus Ave)
                             if (inputs[6]) makeInputUneditable(inputs[6]); // Elongation Ave
                             if (inputs[10]) makeInputUneditable(inputs[10]); // Force Ave
                             if (inputs[14]) makeInputUneditable(inputs[14]); // Modulus Ave
                         } else if (tableBody.id === 'testingTableBody4') {
                             // Page 4: Protect column 6 (Gloss Ave)
                             if (inputs[6]) makeInputUneditable(inputs[6]); // Gloss Ave
                         }
                     }
                 });
             });
         }
         
         // Helper function to make an input uneditable with consistent styling
         function makeInputUneditable(input) {
             input.readOnly = true;
             input.style.backgroundColor = 'transparent'; // Normal background
             input.style.color = '#000000'; // Normal black text
             input.style.fontWeight = 'normal'; // Normal font weight
         }
         
         // Function to force recalculation of all summary statistics to populate Average/Min/Max rows
         function forceRecalculateAllSummaryStatistics() {
             // Force recalculation for all pages that have summary statistics
             const tableBodies = [testingTableBody2, testingTableBody3, testingTableBody4];
             
             tableBodies.forEach(tableBody => {
                 // Get all data rows (excluding summary rows)
                 const dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                     const firstCell = row.querySelector('td');
                     return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                 });
                 
                 if (dataRows.length > 0) {
                     // Force recalculation of summary statistics
                     calculateSummaryStatistics(tableBody);
                     
                     // Also recalculate row averages to ensure Ave columns are populated
                     dataRows.forEach(row => {
                         calculateRowAverages(row, tableBody);
                     });
                 }
             });
             
             // Also recalculate Page 1 column statistics
             calculatePage1ColumnStats(testingTableBody);
         }
         
         // Function to recalculate ALL row averages for Pages 2, 3, 4 after data loads
         function recalculateAllRowAverages() {
             // Get all table bodies for Pages 2, 3, 4
             const tableBodies = [testingTableBody2, testingTableBody3, testingTableBody4];
             
             tableBodies.forEach(tableBody => {
                 // Get all data rows (excluding summary rows)
                 const dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                     const firstCell = row.querySelector('td');
                     return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                 });
                 
                 // Recalculate averages for each row
                 dataRows.forEach(row => {
                     calculateRowAverages(row, tableBody);
                 });
             });
         }
         
         // Load column data from JSONB into table inputs
         function loadColumnDataToTable(tableBody, inputIndex, jsonbData) {
             if (!jsonbData || typeof jsonbData !== 'object') return;
             
             // Get all data rows (excluding summary rows)
             const dataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                 const firstCell = row.querySelector('td');
                 return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
             });
             
             // Calculate how many rows we need based on the data
             const maxRowNumber = Math.max(...Object.keys(jsonbData).map(key => parseInt(key)));
             const rowsNeeded = maxRowNumber;
             
             // Add rows if we don't have enough
             while (dataRows.length < rowsNeeded) {
                 addRowsToTable(tableBody, 1);
                 // Re-get data rows after adding
                 const newDataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                     const firstCell = row.querySelector('td');
                     return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                 });
                 // Update our reference
                 dataRows.length = 0;
                 dataRows.push(...newDataRows);
             }
             
             // Load data for each row
             Object.keys(jsonbData).forEach(rowKey => {
                 const rowIndex = parseInt(rowKey) - 1; // Convert "1", "2", "3" to 0, 1, 2
                 if (rowIndex >= 0 && rowIndex < dataRows.length) {
                     const row = dataRows[rowIndex];
                     
                     // Handle different column types based on table structure
                     if (inputIndex === 0) {
                         // Sample Number column - update input value
                         const inputs = row.querySelectorAll('input');
                         if (inputs[0]) inputs[0].value = jsonbData[rowKey];
                     } else if (inputIndex === 1) {
                         // Lot Number column - update input value
                         const inputs = row.querySelectorAll('input');
                         if (inputs[1]) inputs[1].value = jsonbData[rowKey];
                     } else if (inputIndex === 2) {
                         // Roll Number column - update input value
                         const inputs = row.querySelectorAll('input');
                         if (inputs[2]) inputs[2].value = jsonbData[rowKey];
                     } else {
                         // Input columns - find and update input value (column index = input index)
                         const inputs = row.querySelectorAll('input');
                         if (inputs[inputIndex]) {
                             inputs[inputIndex].value = jsonbData[rowKey];
                         }
                     }
                 }
             });
       }

           // Initialize
       updateRowCount();
       updateRowCount2();
       updateRowCount3();
       updateRowCount4();
         
         // Make all summary rows uneditable from the start
         makeSummaryRowsUneditable();
         
         // Load existing data from database if available
         loadDataFromDatabase();
       
       // Add event listeners to existing input fields for average calculation
       addAverageCalculationListeners();
       
       // Delay initial calculations to reduce CPU spike on page load
       setTimeout(() => {
           // Calculate initial summary statistics asynchronously
       calculateSummaryStatistics(testingTableBody2);
       calculateSummaryStatistics(testingTableBody3);
       calculatePage1ColumnStats(testingTableBody);
       }, 500); // 500ms delay to let page settle
       
       // Form is ready - data will be auto-saved to database as user types
       
       // Add cell highlighting functionality to existing cells
       addCellHighlighting();
       
       // Add click outside functionality to remove highlighting
       document.addEventListener('click', function(e) {
           // Check if click is outside any table cell
           const isTableCell = e.target.closest('td') || e.target.closest('th');
           const isTableInput = e.target.classList.contains('testing-input');
           
           // If click is outside table cells and not on table inputs, remove highlighting
           if (!isTableCell && !isTableInput) {
               clearCellHighlighting();
           }
       });

           // Add rows button for Page 1 (syncs with all pages)
       addRowsBtn.addEventListener('click', function() {
           const n = parseInt(numRowsInput.value, 10) || 1;
           addRowsToTable(testingTableBody, n);
           addRowsToTable(testingTableBody2, n);
           addRowsToTable(testingTableBody3, n);
           addRowsToTable(testingTableBody4, n);
           updateRowCount();
           updateRowCount2();
           updateRowCount3();
           updateRowCount4();
       });
       


       // Delete rows button for Page 1 (syncs with all pages) - deletes one row at a time
       deleteRowsBtn.addEventListener('click', function() {
           deleteRowsFromTable(testingTableBody, 1);
           deleteRowsFromTable(testingTableBody2, 1);
           deleteRowsFromTable(testingTableBody3, 1);
           deleteRowsFromTable(testingTableBody4, 1);
           updateRowCount();
           updateRowCount2();
           updateRowCount3();
           updateRowCount4();
       });







           // Function to add rows to any table (like inline inspection form)
       function addRowsToTable(tableBody, n) {
           // Remove summary rows temporarily
           const summaryRows = [];
           const rows = Array.from(tableBody.querySelectorAll('tr'));
           rows.forEach(row => {
               const firstCell = row.querySelector('td');
               if (firstCell && ['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                   summaryRows.push(row);
                   row.remove();
               }
           });

           // Get existing data rows to determine next lot number
           const existingDataRows = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
               const firstCell = row.querySelector('td');
               return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
           });
           
           // Determine lot number (like inline inspection form)
           let lotNumber = '01'; // Default for first lot
           if (existingDataRows.length > 0) {
               // Get the last lot number and increment
               const lastRow = existingDataRows[existingDataRows.length - 1];
               const lotCell = lastRow.querySelector('td:nth-child(2)'); // Second column is lot number
               if (lotCell && lotCell.textContent.trim()) {
                   const lastLotNum = parseInt(lotCell.textContent.trim());
                   if (!isNaN(lastLotNum)) {
                       lotNumber = String(lastLotNum + 1).padStart(2, '0');
                   }
               }
           }

                    // Add new empty rows
            for (let i = 0; i < n; i++) {
                const tr = document.createElement('tr');
                
                // Determine number of columns based on table body ID
                let columnCount;
                if (tableBody.id === 'testingTableBody2' || tableBody.id === 'testingTableBody3') {
                    columnCount = 15;
                                 } else if (tableBody.id === 'testingTableBody4') {
                     columnCount = 8;
                 } else {
                    columnCount = 10;
                }
                
                for (let j = 0; j < columnCount; j++) {
                    const td = document.createElement('td');
                   td.className = 'testing-table-cell';
                    td.style.fontSize = '13px';
                    
                   if (j === 0) {
                       // First column: Lot & Roll - make it an input field instead of auto-generated
                    const input = document.createElement('input');
                    input.type = 'text';
                       input.className = 'testing-input';
                       input.value = '';
                       input.placeholder = '';
                       
                       // Add event listener for auto-save to database
                       input.addEventListener('input', function() {
                           // Auto-save to database after each change (debounced)
                           debouncedSave();
                       });
                       
                       // Add real-time sync listener for Page 1 sample columns
                       if (tableBody.id === 'testingTableBody') {
                           input.addEventListener('input', function() {
                               // Get the row index and sync to other pages
                               const rowIndex = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                                   const firstCell = row.querySelector('td');
                                   return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                               }).indexOf(tr);
                               if (rowIndex !== -1) {
                                   syncSampleDataToOtherPages(rowIndex, 0, this.value);
                               }
                           });
                       }
                       
                       td.appendChild(input);
                   } else if (j === 1) {
                       // Second column: Roll ID - make it an input field instead of auto-generated
                       const input = document.createElement('input');
                       input.type = 'text';
                       input.className = 'testing-input';
                       input.value = '';
                       input.placeholder = '';
                       
                       // Add event listener for auto-save to database
                       input.addEventListener('input', function() {
                           // Auto-save to database after each change (debounced)
                           debouncedSave();
                       });
                       
                       // Add real-time sync listener for Page 1 sample columns
                       if (tableBody.id === 'testingTableBody') {
                           input.addEventListener('input', function() {
                               // Get the row index and sync to other pages
                               const rowIndex = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                                   const firstCell = row.querySelector('td');
                                   return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                               }).indexOf(tr);
                               if (rowIndex !== -1) {
                                   syncSampleDataToOtherPages(rowIndex, 1, this.value);
                               }
                           });
                       }
                       
                       td.appendChild(input);
                   } else if (j === 2) {
                       // Third column: Lot Time - make it an input field
                       const input = document.createElement('input');
                       input.type = 'text';
                       input.className = 'testing-input';
                       input.value = '';
                       input.placeholder = '';
                       
                       // Add event listener for auto-save to database
                       input.addEventListener('input', function() {
                           // Auto-save to database after each change (debounced)
                           debouncedSave();
                       });
                       
                       // Add real-time sync listener for Page 1 sample columns
                       if (tableBody.id === 'testingTableBody') {
                           input.addEventListener('input', function() {
                               // Get the row index and sync to other pages
                               const rowIndex = Array.from(tableBody.querySelectorAll('tr')).filter(row => {
                                   const firstCell = row.querySelector('td');
                                   return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
                               }).indexOf(tr);
                               if (rowIndex !== -1) {
                                   syncSampleDataToOtherPages(rowIndex, 2, this.value);
                               }
                           });
                       }
                       
                       td.appendChild(input);
                   } else {
                       // Other columns: Input fields
                       const input = document.createElement('input');
                       input.type = 'text';
                       input.className = 'testing-input';
                    input.value = '';
                    input.placeholder = '';
                    
                    // Add event listener for automatic average calculation
                    input.addEventListener('input', function() {
                        // Only calculate row averages for Pages 2, 3, 4 (not Page 1)
                        if (tableBody.id !== 'testingTableBody') {
                            calculateRowAverages(tr, tableBody);
                        }
                        // Also calculate summary statistics for vertical Ave columns (Page 2 & 3 only)
                        if (tableBody.id === 'testingTableBody2' || tableBody.id === 'testingTableBody3') {
                            calculateSummaryStatistics(tableBody);
                        }
                        // Calculate individual column stats for Page 1 (only the changed column)
                        if (tableBody.id === 'testingTableBody') {
                            const inputIndex = Array.from(tr.querySelectorAll('input')).indexOf(input);
                            calculatePage1ColumnStats(tableBody, inputIndex);
                        }
                           
                           // Force immediate recalculation of ALL summary statistics for instant sync
                           setTimeout(() => {
                               forceRecalculateAllSummaryStatistics();
                           }, 50); // Small delay to ensure current calculations complete first
                           
                           // Auto-save to database after each change (debounced)
                           debouncedSave();
                    });
                    
                    td.appendChild(input);
                   }
                   
                    tr.appendChild(td);
                }
                
                tableBody.appendChild(tr);
               
               // Add highlighting functionality to the new row
               addHighlightingToRow(tr);
            }

           // Re-add summary rows
           summaryRows.forEach(row => {
               tableBody.appendChild(row);
           });
           
           // Clear cache since table structure changed
           clearTableCache(tableBody);
           
           // Recalculate summary statistics for Pages 2, 3 and 4 after adding rows
           if (tableBody.id === 'testingTableBody2' || tableBody.id === 'testingTableBody3' || tableBody.id === 'testingTableBody4') {
               calculateSummaryStatistics(tableBody);
           }
           
           // Ensure summary rows remain uneditable after adding new rows
           makeSummaryRowsUneditable();
           
           // Force immediate recalculation of ALL summary statistics across all pages
           forceRecalculateAllSummaryStatistics();
           
           // Save the updated table state to database after adding rows
           debouncedSave();
       }

       // Function to delete rows from any table
       function deleteRowsFromTable(tableBody, n) {
           // Get all data rows (excluding summary rows)
           const allRows = Array.from(tableBody.querySelectorAll('tr'));
           const dataRows = allRows.filter(row => {
               const firstCell = row.querySelector('td');
               return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
           });
           

           
           // Delete the last n rows
           const rowsToDelete = Math.min(n, dataRows.length);
           for (let i = 0; i < rowsToDelete; i++) {
               const rowToDelete = dataRows[dataRows.length - 1 - i];
               if (rowToDelete) {
    
                   rowToDelete.remove();
               }
           }
           

           
           // Save the updated table state to database after deleting rows
           
           // Force immediate save to ensure deleted data is removed from database
           setTimeout(() => {
               debouncedSave();
           }, 100);
           
           // Clear cache since table structure changed
           clearTableCache(tableBody);
           
           // Recalculate summary statistics for Pages 2, 3 and 4 after deleting rows
           if (tableBody.id === 'testingTableBody2' || tableBody.id === 'testingTableBody3' || tableBody.id === 'testingTableBody4') {
               calculateSummaryStatistics(tableBody);
           }
           
           // Force immediate recalculation of ALL summary statistics across all pages
           forceRecalculateAllSummaryStatistics();
           
           // Also use debounced save for efficiency
           debouncedSave();
       }

       // Function to calculate averages for each row
       function calculateRowAverages(row, tableBody) {
           const cells = row.querySelectorAll('td');
           const inputs = row.querySelectorAll('input');
           

           
           // Only process Pages 2, 3, 4 (Page 1 doesn't have subgroups)
           if (tableBody.id === 'testingTableBody') {
               return; // Page 1 doesn't have subgroups
           }
           
           // Determine which table we're working with based on tableBody ID
           if (tableBody.id === 'testingTableBody2') {
               // Page 2: Elongation@ Break(%) MD, Force~Tensile Strength@Break(N)MD, Force~Tensile Strength@Break 5% (N)MD
               // Columns: Sample No (3 cols), Elongation MD (4 cols), Force MD (4 cols), Force 5% MD (4 cols)
                   calculateSubgroupAverage(inputs, 3, 6, 'testingTableBody2'); // Elongation MD: cols 3,4,5 -> Ave at 6
                   calculateSubgroupAverage(inputs, 7, 10, 'testingTableBody2'); // Force MD: cols 7,8,9 -> Ave at 10
                   calculateSubgroupAverage(inputs, 11, 14, 'testingTableBody2'); // Force 5% MD: cols 11,12,13 -> Ave at 14
           } else if (tableBody.id === 'testingTableBody3') {
               // Page 3: Elongation@ Break (%) CD, Force~Tensile Strength@Break (N) CD, Modulus Fresh @ 2%
               // Columns: Sample No (3 cols), Elongation CD (4 cols), Force CD (4 cols), Modulus (4 cols)
                   calculateSubgroupAverage(inputs, 3, 6, 'testingTableBody3'); // Elongation CD: cols 3,4,5 -> Ave at 6
                   calculateSubgroupAverage(inputs, 7, 10, 'testingTableBody3'); // Force CD: cols 7,8,9 -> Ave at 10
                   calculateSubgroupAverage(inputs, 11, 14, 'testingTableBody3'); // Modulus: cols 11,12,13 -> Ave at 14
           } else if (tableBody.id === 'testingTableBody4') {
               // Page 4: Gloss (Gloss unit), PG Quality System Requirements
               // Columns: Sample No (3 cols), Gloss (4 cols), PG Quality (1 col)
                   calculateSubgroupAverage(inputs, 3, 6, 'testingTableBody4'); // Gloss: cols 3,4,5 -> Ave at 6
               // PG Quality column doesn't have average calculation
           }
       }

       // Function to calculate average for a subgroup of 3 columns
       function calculateSubgroupAverage(inputs, startIndex, aveIndex, tableBodyId) {
           if (aveIndex >= inputs.length) return;
           
           // Get values and track which ones have actual data
           const val1 = inputs[startIndex].value.trim();
           const val2 = inputs[startIndex + 1].value.trim();
           const val3 = inputs[startIndex + 2].value.trim();
           

           
           // Only calculate if at least one value is entered
           if (val1 !== '' || val2 !== '' || val3 !== '') {
               // Parse only non-empty values and count them
               let sum = 0;
               let count = 0;
               
               if (val1 !== '') {
                   sum += parseFloat(val1);
                   count++;
               }
               if (val2 !== '') {
                   sum += parseFloat(val2);
                   count++;
               }
               if (val3 !== '') {
                   sum += parseFloat(val3);
                   count++;
               }
               
               // Calculate average only of cells that have data
               const average = sum / count;
               
                               // Apply specific formatting based on column position for Page 2 and Page 3
                let formattedValue;
                if (tableBodyId === 'testingTableBody2') {
                    // Page 2: Specific formatting
                    if (aveIndex === 6) {
                        // Elongation@ Break(%) MD Ave: 3 digits, no decimals (000)
                        formattedValue = Math.round(average).toString();
                    } else if (aveIndex === 10) {
                        // Force~Tensile Strength@Break(N)MD Ave: 2 digits + 1 decimal (00.0)
                        formattedValue = average.toFixed(1);
                    } else if (aveIndex === 14) {
                        // Force~Tensile Strength@Break 5% (N)MD Ave: 1 digit + 1 decimal (0.0)
                        formattedValue = average.toFixed(1);
                    } else {
                        formattedValue = average.toFixed(3);
                    }
                } else if (tableBodyId === 'testingTableBody3') {
                    // Page 3: Specific formatting
                    if (aveIndex === 6) {
                        // Elongation@ Break (%) CD Ave: 3 digits, no decimals (000)
                        formattedValue = Math.round(average).toString();
                    } else if (aveIndex === 10) {
                        // Force~Tensile Strength@Break (N) CD Ave: 1 digit + 1 decimal (0.0)
                        formattedValue = average.toFixed(1);
                    } else if (aveIndex === 14) {
                        // Modulus Fresh @ 2% Ave: 2 digits + 1 decimal (00.0)
                        formattedValue = average.toFixed(1);
                    } else {
                        formattedValue = average.toFixed(3);
                    }
                } else if (tableBodyId === 'testingTableBody4') {
                    // Page 4: Specific formatting
                    if (aveIndex === 6) {
                        // Gloss Ave: 1 digit + 1 decimal (0.0)
                        formattedValue = average.toFixed(1);
                    } else {
                        formattedValue = average.toFixed(3);
                    }
                } else {
                    // Default formatting for other pages
                    formattedValue = average.toFixed(3);
                }
               
               inputs[aveIndex].value = formattedValue;
           } else {
               inputs[aveIndex].value = '';
           }
       }

       // Function to add event listeners to existing input fields
       function addAverageCalculationListeners() {
           // Add listeners to all existing input fields in all tables
           const allTables = [testingTableBody, testingTableBody2, testingTableBody3, testingTableBody4];
           
           allTables.forEach(tableBody => {
               const rows = tableBody.querySelectorAll('tr');
               rows.forEach(row => {
                   const inputs = row.querySelectorAll('input');
                   inputs.forEach(input => {
                       input.addEventListener('input', function() {
                           // Only calculate row averages for Pages 2, 3, 4 (not Page 1)
                           if (tableBody.id !== 'testingTableBody') {
                               calculateRowAverages(row, tableBody);
                           }
                           // Also calculate summary statistics for vertical Ave columns (Page 2, 3 & 4)
                           if (tableBody.id === 'testingTableBody2' || tableBody.id === 'testingTableBody3' || tableBody.id === 'testingTableBody4') {
                               calculateSummaryStatistics(tableBody);
                           }
                           // Calculate individual column stats for Page 1 (only the changed column)
                           if (tableBody.id === 'testingTableBody') {
                               const inputIndex = Array.from(row.querySelectorAll('input')).indexOf(input);
                               calculatePage1ColumnStats(tableBody, inputIndex);
                           }
                           
                           // Force immediate recalculation of ALL summary statistics for instant sync
                           setTimeout(() => {
                               forceRecalculateAllSummaryStatistics();
                           }, 50); // Small delay to ensure current calculations complete first
                           
                           // Auto-save to database after each change (debounced)
                           debouncedSave();
                       });
                   });
               });
           });
       }

       // Function to calculate summary statistics (Average, Min, Max) for vertical Ave columns
       // ONLY for Page 2, 3 & 4
       function calculateSummaryStatistics(tableBody) {
           // Only process Page 2, 3 and 4
           if (tableBody.id !== 'testingTableBody2' && tableBody.id !== 'testingTableBody3' && tableBody.id !== 'testingTableBody4') {
               return;
           }
           
           const rows = tableBody.querySelectorAll('tr');
           const dataRows = Array.from(rows).filter(row => {
               const firstCell = row.querySelector('td');
               return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
           });
           
           if (dataRows.length === 0) return;
           
           // Calculate for Ave columns based on table type
           if (tableBody.id === 'testingTableBody4') {
               // Page 4: Sample No (3 cols), Gloss (4 cols: 1,2,3,Ave), PG Quality (1 col)
               // Only one Ave column at position 6
               calculateVerticalAveStats(dataRows, [6], tableBody);
           } else {
               // Page 2 & 3: 3 Ave columns (positions 6, 10, 14)
               // Page 2: Sample No (3 cols), Elongation MD (4 cols: 1,2,3,Ave), Force MD (4 cols: 1,2,3,Ave), Force 5% MD (4 cols: 1,2,3,Ave)
               // Page 3: Sample No (3 cols), Elongation CD (4 cols: 1,2,3,Ave), Force CD (4 cols: 1,2,3,Ave), Modulus (4 cols: 1,2,3,Ave)
           calculateVerticalAveStats(dataRows, [6, 10, 14], tableBody);
           }
       }

       // Function to calculate individual column statistics for Page 1
       function calculatePage1ColumnStats(tableBody, changedColumnIndex = null) {
           if (tableBody.id !== 'testingTableBody') {
               return;
           }
           
           const rows = tableBody.querySelectorAll('tr');
           const dataRows = Array.from(rows).filter(row => {
               const firstCell = row.querySelector('td');
               return firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim());
           });
           
           if (dataRows.length === 0) return;
           
           // Page 1 data rows: Sample No (3 cols), Basic Weight, Thickness, Opacity, COF Kinetic, Cut Width, Color-Delta E (Unprinted), Color-Delta E (Printed)
           // Page 1 summary rows: [Average/Min/Max label (colspan=3), Basic Weight, Thickness, Opacity, COF Kinetic, Cut Width, Color-Delta E (Unprinted), Color-Delta E (Printed)]
           // Summary row has 8 <td> elements: [0=label, 1=Basic Weight, 2=Thickness, 3=Opacity, 4=COF, 5=Cut Width, 6=Color1, 7=Color2]
           const summaryColumnIndices = [1, 2, 3, 4, 5, 6, 7];
           const inputColumnIndices = [3, 4, 5, 6, 7, 8, 9]; // Input columns in data rows (after Sample No colspan=3)
           
           // If a specific column changed, only update that column
           if (changedColumnIndex !== null) {
               const columnIndex = inputColumnIndices.indexOf(changedColumnIndex);
               if (columnIndex !== -1) {
                   const inputColIndex = inputColumnIndices[columnIndex];
                   const summaryColIndex = summaryColumnIndices[columnIndex];
                   const values = [];
                   
                   // Collect values from this input column
                   dataRows.forEach(row => {
                       const inputs = row.querySelectorAll('input');
                       if (inputs[inputColIndex] && inputs[inputColIndex].value.trim() !== '') {
                           const value = parseFloat(inputs[inputColIndex].value);
                           if (!isNaN(value)) {
                               values.push(value);
                           }
                       }
                   });
                   
                   // Calculate statistics
                   if (values.length > 0) {
                       const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
                       const min = Math.min(...values);
                       const max = Math.max(...values);
                       
                       // Format based on column type
                       let avgFormatted, minFormatted, maxFormatted;
                       
                       if (summaryColIndex === 1) { // Basic Weight
                           avgFormatted = avg.toFixed(2);
                           minFormatted = min.toFixed(2);
                           maxFormatted = max.toFixed(2);
                       } else if (summaryColIndex === 2) { // Thickness
                           avgFormatted = avg.toFixed(3);
                           minFormatted = min.toFixed(3);
                           maxFormatted = max.toFixed(3);
                       } else if (summaryColIndex === 3) { // Opacity
                           avgFormatted = avg.toFixed(1);
                           minFormatted = min.toFixed(1);
                           maxFormatted = max.toFixed(1);
                       } else if (summaryColIndex === 4) { // COF Kinetic
                           avgFormatted = avg.toFixed(2);
                           minFormatted = min.toFixed(2);
                           maxFormatted = max.toFixed(2);
                       } else if (summaryColIndex === 5) { // Cut Width
                           avgFormatted = avg.toFixed(0);
                           minFormatted = min.toFixed(0);
                           maxFormatted = max.toFixed(0);
                       } else { // Color-Delta E columns
                           avgFormatted = avg.toFixed(2);
                           minFormatted = min.toFixed(2);
                           maxFormatted = max.toFixed(2);
                       }
                       
                       // Update summary rows
                       updatePage1SummaryRow(tableBody, 'Average', summaryColIndex, avgFormatted);
                       updatePage1SummaryRow(tableBody, 'Minimum', summaryColIndex, minFormatted);
                       updatePage1SummaryRow(tableBody, 'Maximum', summaryColIndex, maxFormatted);
                   } else {
                       // No data, set to 0 with appropriate formatting
                       let zeroFormatted;
                       if (summaryColIndex === 1) { // Basic Weight
                           zeroFormatted = '0.00';
                       } else if (summaryColIndex === 2) { // Thickness
                           zeroFormatted = '0.000';
                       } else if (summaryColIndex === 3) { // Opacity
                           zeroFormatted = '0.0';
                       } else if (summaryColIndex === 4) { // COF Kinetic
                           zeroFormatted = '0.00';
                       } else if (summaryColIndex === 5) { // Cut Width
                           zeroFormatted = '0';
                       } else { // Color-Delta E columns
                           zeroFormatted = '0.00';
                       }
                       
                       updatePage1SummaryRow(tableBody, 'Average', summaryColIndex, zeroFormatted);
                       updatePage1SummaryRow(tableBody, 'Minimum', summaryColIndex, zeroFormatted);
                       updatePage1SummaryRow(tableBody, 'Maximum', summaryColIndex, zeroFormatted);
                   }
               }
               return;
           } else {
               // Calculate all columns initially
               inputColumnIndices.forEach((inputColIndex, index) => {
                   const summaryColIndex = summaryColumnIndices[index];
                   const values = [];
                   
                   // Collect values from this input column
                   dataRows.forEach(row => {
                       const inputs = row.querySelectorAll('input');
                       if (inputs[inputColIndex] && inputs[inputColIndex].value.trim() !== '') {
                           const value = parseFloat(inputs[inputColIndex].value);
                           if (!isNaN(value)) {
                               values.push(value);
                           }
                       }
                   });
                   
                   // Calculate statistics
                   if (values.length > 0) {
                       const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
                       const min = Math.min(...values);
                       const max = Math.max(...values);
                       
                       // Format based on column type
                       let avgFormatted, minFormatted, maxFormatted;
                       
                       if (summaryColIndex === 1) { // Basic Weight
                           avgFormatted = avg.toFixed(2);
                           minFormatted = min.toFixed(2);
                           maxFormatted = max.toFixed(2);
                       } else if (summaryColIndex === 2) { // Thickness
                           avgFormatted = avg.toFixed(3);
                           minFormatted = min.toFixed(3);
                           maxFormatted = max.toFixed(3);
                       } else if (summaryColIndex === 3) { // Opacity
                           avgFormatted = avg.toFixed(1);
                           minFormatted = min.toFixed(1);
                           maxFormatted = max.toFixed(1);
                       } else if (summaryColIndex === 4) { // COF Kinetic
                           avgFormatted = avg.toFixed(2);
                           minFormatted = min.toFixed(2);
                           maxFormatted = max.toFixed(2);
                       } else if (summaryColIndex === 5) { // Cut Width
                           avgFormatted = avg.toFixed(0);
                           minFormatted = min.toFixed(0);
                           maxFormatted = max.toFixed(0);
                       } else { // Color-Delta E columns
                           avgFormatted = avg.toFixed(2);
                           minFormatted = min.toFixed(2);
                           maxFormatted = max.toFixed(2);
                       }
                       
                       // Update summary rows
                       updatePage1SummaryRow(tableBody, 'Average', summaryColIndex, avgFormatted);
                       updatePage1SummaryRow(tableBody, 'Minimum', summaryColIndex, minFormatted);
                       updatePage1SummaryRow(tableBody, 'Maximum', summaryColIndex, maxFormatted);
                   } else {
                       // No data, set to 0 with appropriate formatting
                       let zeroFormatted;
                       if (summaryColIndex === 1) { // Basic Weight
                           zeroFormatted = '0.00';
                       } else if (summaryColIndex === 2) { // Thickness
                           zeroFormatted = '0.000';
                       } else if (summaryColIndex === 3) { // Opacity
                           zeroFormatted = '0.0';
                       } else if (summaryColIndex === 4) { // COF Kinetic
                           zeroFormatted = '0.00';
                       } else if (summaryColIndex === 5) { // Cut Width
                           zeroFormatted = '0';
                       } else { // Color-Delta E columns
                           zeroFormatted = '0.00';
                       }
                       
                       updatePage1SummaryRow(tableBody, 'Average', summaryColIndex, zeroFormatted);
                       updatePage1SummaryRow(tableBody, 'Minimum', summaryColIndex, zeroFormatted);
                       updatePage1SummaryRow(tableBody, 'Maximum', summaryColIndex, zeroFormatted);
                   }
               });
           }
           
           // If no specific column, calculate all columns (for initial load)
           for (let i = 0; i < summaryColumnIndices.length; i++) {
               const inputColIndex = inputColumnIndices[i];
               const summaryColIndex = summaryColumnIndices[i];
               const values = [];
               
               // Collect values from this input column
               dataRows.forEach(row => {
                   const inputs = row.querySelectorAll('input');
                   if (inputs[inputColIndex] && inputs[inputColIndex].value.trim() !== '') {
                       const value = parseFloat(inputs[inputColIndex].value);
                       if (!isNaN(value)) {
                           values.push(value);
                       }
                   }
               });
               
               // Calculate statistics
               if (values.length > 0) {
                   const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
                   const min = Math.min(...values);
                   const max = Math.max(...values);
                   
                   // Format based on column type
                   let avgFormatted, minFormatted, maxFormatted;
                   
                   if (summaryColIndex === 1) { // Basic Weight
                       avgFormatted = avg.toFixed(2);
                       minFormatted = min.toFixed(2);
                       maxFormatted = max.toFixed(2);
                   } else if (summaryColIndex === 2) { // Thickness
                       avgFormatted = avg.toFixed(3);
                       minFormatted = min.toFixed(3);
                       maxFormatted = max.toFixed(3);
                   } else if (summaryColIndex === 3) { // Opacity
                       avgFormatted = avg.toFixed(1);
                       minFormatted = min.toFixed(1);
                       maxFormatted = max.toFixed(1);
                   } else if (summaryColIndex === 4) { // COF Kinetic
                       avgFormatted = avg.toFixed(2);
                       minFormatted = min.toFixed(2);
                       maxFormatted = max.toFixed(2);
                   } else if (summaryColIndex === 5) { // Cut Width
                       avgFormatted = avg.toFixed(0);
                       minFormatted = min.toFixed(0);
                       maxFormatted = max.toFixed(0);
                   } else { // Color-Delta E columns
                       avgFormatted = avg.toFixed(2);
                       minFormatted = min.toFixed(2);
                       maxFormatted = max.toFixed(2);
                   }
                   
                   // Update summary rows
                   updatePage1SummaryRow(tableBody, 'Average', summaryColIndex, avgFormatted);
                   updatePage1SummaryRow(tableBody, 'Minimum', summaryColIndex, minFormatted);
                   updatePage1SummaryRow(tableBody, 'Maximum', summaryColIndex, maxFormatted);
               } else {
                   // No data, set to 0 with appropriate formatting
                   let zeroFormatted;
                   if (summaryColIndex === 1) { // Basic Weight
                       zeroFormatted = '0.00';
                   } else if (summaryColIndex === 2) { // Thickness
                       zeroFormatted = '0.000';
                   } else if (summaryColIndex === 3) { // Opacity
                       zeroFormatted = '0.0';
                   } else if (summaryColIndex === 4) { // COF Kinetic
                       zeroFormatted = '0.00';
                   } else if (summaryColIndex === 5) { // Cut Width
                       zeroFormatted = '0';
                   } else { // Color-Delta E columns
                       zeroFormatted = '0.00';
                   }
                   
                   updatePage1SummaryRow(tableBody, 'Average', summaryColIndex, zeroFormatted);
                   updatePage1SummaryRow(tableBody, 'Minimum', summaryColIndex, zeroFormatted);
                   updatePage1SummaryRow(tableBody, 'Maximum', summaryColIndex, zeroFormatted);
               }
           }
       }

       // Function to update Page 1 summary rows
       function updatePage1SummaryRow(tableBody, rowType, columnIndex, value) {
           const rows = tableBody.querySelectorAll('tr');
           rows.forEach(row => {
               const firstCell = row.querySelector('td');
               if (firstCell && firstCell.textContent.trim() === rowType) {
                   const cells = row.querySelectorAll('td');
                   if (cells[columnIndex]) {
                       cells[columnIndex].textContent = value;
                   }
               }
           });
       }

       // Function to calculate statistics for specific Ave column positions
       function calculateVerticalAveStats(dataRows, avePositions, tableBody) {
           avePositions.forEach(avePos => {
               const values = [];
               
               // Collect all values from this Ave column across all data rows
               dataRows.forEach(row => {
                   const inputs = row.querySelectorAll('input');
                   if (inputs[avePos] && inputs[avePos].value) {
                       const value = parseFloat(inputs[avePos].value);
                       if (!isNaN(value)) {
                           values.push(value);
                       }
                   }
               });
               
               if (values.length > 0) {
                   // Calculate Average, Min, Max
                   const average = values.reduce((sum, val) => sum + val, 0) / values.length;
                   const minimum = Math.min(...values);
                   const maximum = Math.max(...values);
                   
                   // Map data Ave column position to summary column position
                   let summaryColPos;
                   if (tableBody.id === 'testingTableBody4') {
                       // Page 4: Only one Ave column at position 6 -> Summary column 2 (after merged Gloss columns)
                       if (avePos === 6) summaryColPos = 2; // Gloss Ave
                   } else {
                       // Page 2 & 3: 3 Ave columns (positions 6, 10, 14) -> Summary columns: [2, 4, 6] (after merging)
                       // Column 6 (Elongation Ave) -> Summary column 2
                       // Column 10 (Force Ave) -> Summary column 4  
                       // Column 14 (Force 5% Ave) -> Summary column 6
                       if (avePos === 6) summaryColPos = 2;      // Elongation Ave
                       else if (avePos === 10) summaryColPos = 4; // Force Ave
                       else if (avePos === 14) summaryColPos = 6; // Force 5% Ave
                   }
                   
                   // Update the summary rows with proper formatting for Page 2
                   let avgFormatted, minFormatted, maxFormatted;
                   
                                        if (tableBody.id === 'testingTableBody2') {
                         // Page 2: Apply specific formatting
                         if (avePos === 6) {
                             // Elongation Ave: 3 digits, no decimals (000)
                             avgFormatted = Math.round(average).toString();
                             minFormatted = Math.round(minimum).toString();
                             maxFormatted = Math.round(maximum).toString();
                         } else if (avePos === 10) {
                             // Force Ave: 2 digits + 1 decimal (00.0)
                             avgFormatted = average.toFixed(1);
                             minFormatted = minimum.toFixed(1);
                             maxFormatted = maximum.toFixed(1);
                         } else if (avePos === 14) {
                             // Force 5% Ave: 1 digit + 1 decimal (0.0)
                             avgFormatted = average.toFixed(1);
                             minFormatted = minimum.toFixed(1);
                             maxFormatted = maximum.toFixed(1);
                         } else {
                             // Default formatting
                             avgFormatted = average.toFixed(3);
                             minFormatted = minimum.toFixed(3);
                             maxFormatted = maximum.toFixed(3);
                         }
                                              } else if (tableBody.id === 'testingTableBody3') {
                             // Page 3: Apply specific formatting
                             if (avePos === 6) {
                                 // Elongation Ave: 3 digits, no decimals (000)
                                 avgFormatted = Math.round(average).toString();
                                 minFormatted = Math.round(minimum).toString();
                                 maxFormatted = Math.round(maximum).toString();
                             } else if (avePos === 10) {
                                 // Force Ave: 1 digit + 1 decimal (0.0)
                                 avgFormatted = average.toFixed(1);
                                 minFormatted = minimum.toFixed(1);
                                 maxFormatted = maximum.toFixed(1);
                             } else if (avePos === 14) {
                                 // Modulus Ave: 2 digits + 1 decimal (00.0)
                                 avgFormatted = average.toFixed(1);
                                 minFormatted = minimum.toFixed(1);
                                 maxFormatted = maximum.toFixed(1);
                             } else {
                                 // Default formatting
                                 avgFormatted = average.toFixed(3);
                                 minFormatted = minimum.toFixed(3);
                                 maxFormatted = maximum.toFixed(3);
                             }
                         } else if (tableBody.id === 'testingTableBody4') {
                             // Page 4: Apply specific formatting
                             if (avePos === 6) {
                                 // Gloss Ave: 1 digit + 1 decimal (0.0)
                                 avgFormatted = average.toFixed(1);
                                 minFormatted = minimum.toFixed(1);
                                 maxFormatted = maximum.toFixed(1);
                             } else {
                                 // Default formatting
                                 avgFormatted = average.toFixed(3);
                                 minFormatted = minimum.toFixed(3);
                                 maxFormatted = maximum.toFixed(3);
                             }
                         } else {
                             // Other pages: Default formatting
                             avgFormatted = average.toFixed(3);
                             minFormatted = minimum.toFixed(3);
                             maxFormatted = maximum.toFixed(3);
                         }
                   
                   updateSummaryRow(tableBody, 'Average', summaryColPos, avgFormatted);
                   updateSummaryRow(tableBody, 'Minimum', summaryColPos, minFormatted);
                   updateSummaryRow(tableBody, 'Maximum', summaryColPos, maxFormatted);
               } else {
                   // Clear summary rows if no data
                   let summaryColPos;
                   if (tableBody.id === 'testingTableBody4') {
                       // Page 4: Only one Ave column at position 6 -> Summary column 2 (after merged Gloss columns)
                       if (avePos === 6) summaryColPos = 2; // Gloss Ave
                   } else {
                       // Page 2 & 3: 3 Ave columns (positions 6, 10, 14) -> Summary columns: [2, 4, 6] (after merging)
                       // Column 6 (Elongation Ave) -> Summary column 2
                       // Column 10 (Force Ave) -> Summary column 4  
                       // Column 14 (Force 5% Ave) -> Summary column 6
                       if (avePos === 6) summaryColPos = 2;      // Elongation Ave
                       else if (avePos === 10) summaryColPos = 4; // Force Ave
                       else if (avePos === 14) summaryColPos = 6; // Force 5% Ave
                   }
                   // Set default values with proper formatting for Page 2
                   let defaultAvg, defaultMin, defaultMax;
                   
                                        if (tableBody.id === 'testingTableBody2') {
                         // Page 2: Apply specific formatting
                         if (avePos === 6) {
                             // Elongation Ave: 3 digits, no decimals (000)
                             defaultAvg = '0';
                             defaultMin = '0';
                             defaultMax = '0';
                         } else if (avePos === 10) {
                             // Force Ave: 2 digits + 1 decimal (00.0)
                             defaultAvg = '0.0';
                             defaultMin = '0.0';
                             defaultMax = '0.0';
                         } else if (avePos === 14) {
                             // Force 5% Ave: 1 digit + 1 decimal (0.0)
                             defaultAvg = '0.0';
                             defaultMin = '0.0';
                             defaultMax = '0.0';
                         } else {
                             // Default formatting
                             defaultAvg = '0.000';
                             defaultMin = '0.000';
                             defaultMax = '0.000';
                         }
                                              } else if (tableBody.id === 'testingTableBody3') {
                             // Page 3: Apply specific formatting
                             if (avePos === 6) {
                                 // Elongation Ave: 3 digits, no decimals (000)
                                 defaultAvg = '0';
                                 defaultMin = '0';
                                 defaultMax = '0';
                             } else if (avePos === 10) {
                                 // Force Ave: 1 digit + 1 decimal (0.0)
                                 defaultAvg = '0.0';
                                 defaultMin = '0.0';
                                 defaultMax = '0.0';
                             } else if (avePos === 14) {
                                 // Modulus Ave: 2 digits + 1 decimal (00.0)
                                 defaultAvg = '0.0';
                                 defaultMin = '0.0';
                                 defaultMax = '0.0';
                             } else {
                                 // Default formatting
                                 defaultAvg = '0.000';
                                 defaultMin = '0.000';
                                 defaultMax = '0.000';
                             }
                         } else if (tableBody.id === 'testingTableBody4') {
                             // Page 4: Apply specific formatting
                             if (avePos === 6) {
                                 // Gloss Ave: 1 digit + 1 decimal (0.0)
                                 defaultAvg = '0.0';
                                 defaultMin = '0.0';
                                 defaultMax = '0.0';
                             } else {
                                 // Default formatting
                                 defaultAvg = '0.000';
                                 defaultMin = '0.000';
                                 defaultMax = '0.000';
                             }
                         } else {
                             // Other pages: Default formatting
                             defaultAvg = '0.000';
                             defaultMin = '0.000';
                             defaultMax = '0.000';
                         }
                   
                   updateSummaryRow(tableBody, 'Average', summaryColPos, defaultAvg);
                   updateSummaryRow(tableBody, 'Minimum', summaryColPos, defaultMin);
                   updateSummaryRow(tableBody, 'Maximum', summaryColPos, defaultMax);
               }
           });
       }

       // Function to update a specific cell in summary rows
       function updateSummaryRow(tableBody, rowType, columnIndex, value) {
           const rows = tableBody.querySelectorAll('tr');
           rows.forEach(row => {
               const firstCell = row.querySelector('td');
               if (firstCell && firstCell.textContent.trim() === rowType) {
                   const cells = row.querySelectorAll('td');
                   if (cells[columnIndex]) {
                       cells[columnIndex].textContent = value;
                   }
               }
           });
       }


       

       
       // Clear form (clears all pages)
       const clearBtn = document.querySelector('button[type="reset"]');
       if (clearBtn) {
           clearBtn.addEventListener('click', function() {
               // Clear Page 1
               const rows = Array.from(testingTableBody.querySelectorAll('tr'));
               rows.forEach(row => {
                   const firstCell = row.querySelector('td');
                   if (firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                       row.remove();
                   }
               });
               
               // Clear Page 2
               const rows2 = Array.from(testingTableBody2.querySelectorAll('tr'));
               rows2.forEach(row => {
                   const firstCell = row.querySelector('td');
                   if (firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                       row.remove();
                   }
               });
               
               // Clear Page 3
               const rows3 = Array.from(testingTableBody3.querySelectorAll('tr'));
               rows3.forEach(row => {
                   const firstCell = row.querySelector('td');
                   if (firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                       row.remove();
                   }
               });
               
               // Clear Page 4
               const rows4 = Array.from(testingTableBody4.querySelectorAll('tr'));
               rows4.forEach(row => {
                   const firstCell = row.querySelector('td');
                   if (firstCell && !['Average', 'Minimum', 'Maximum'].includes(firstCell.textContent.trim())) {
                       row.remove();
                   }
               });
               
               updateRowCount();
               updateRowCount2();
               updateRowCount3();
               updateRowCount4();
           });
       }
       
       // Function to clear cached data rows when table structure changes
       function clearTableCache(tableBody) {
           if (tableBody._cachedDataRows) {
               delete tableBody._cachedDataRows;
           }
       }
       
       // Function to add rows to any table (like inline inspection form)

});
