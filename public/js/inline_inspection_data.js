// Basic editable table logic for inline_inspection_data.html

document.addEventListener('DOMContentLoaded', function() {
    const tableBody = document.getElementById('dataEntryTableBody');
    const addRowsBtn = document.getElementById('addNewRowsBtn');
    const clearRowsBtn = document.getElementById('clearRowsBtn');
    const numRowsInput = document.getElementById('numRowsInput');
    const rowCountDisplay = document.getElementById('rowCountDisplay');

    // Number of columns: 32 (merge 0,1,2,4,31)
    const totalColumns = 32;
    const mergedIndices = [0, 1, 2, 4, 31]; // Hour, Minutes, Lot No., Arm, Inspected By
    const dropdownIndex = 29; // Accept / Reject column
    const dropdownOptions = ["", "Accept", "Reject", "KIV", "Rework"];

    // Fixed width columns (colIndex: width)
    const fixedWidthIndices = {
        10: '40px', // ID
        11: '40px', // OD
        12: '33px', // Lines/Strips
        13: '33px', // Glossy
        14: '33px', // Film Color
        15: '33px', // Pin Hole
        16: '33px', // Patch Mark
        17: '33px', // Odour
        18: '33px', // CT
        19: '33px', // Print Color
        20: '33px', // Mis Print
        21: '33px', // Dirty Print
        22: '33px', // Tape Test
        23: '33px', // Centralization
        24: '33px', // Wrinkles
        25: '33px', // PRS
        26: '33px', // Roll Curve
        27: '33px', // Core Misalignment
        28: '130px', // Others
        30: '130px', // Defect Name
        31: '130px', // Inspected By
    };

    function updateRowCount() {
        rowCountDisplay.textContent = `Rows: ${tableBody.rows.length}`;
    }

    function capitalizeWords(str) {
        return str.replace(/\b\w/g, c => c.toUpperCase());
    }

    function createCell(contentEditable = true, rowspan = 1, isDropdown = false, colIndex = null) {
        const td = document.createElement('td');
        td.className = 'border border-gray-300 px-1 py-1';
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
            // Color logic
            select.addEventListener('change', function() {
                const value = select.value;
                // Use 2D grid to find the Roll Position cell (visual column 3) for this row
                const row = td.parentElement;
                const table = row.parentElement;
                const rows = Array.from(table.children);
                const rowIndex = rows.indexOf(row);
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
                let rollPosCell = null;
                if (grid[rowIndex] && grid[rowIndex][3]) {
                    rollPosCell = grid[rowIndex][3];
                }
                function setColors(bg, fg) {
                    td.style.backgroundColor = bg;
                    td.style.color = fg;
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
            });
            td.appendChild(select);
        } else if (contentEditable) {
            td.contentEditable = 'true';
            td.spellcheck = false;
            td.addEventListener('input', function(e) {
                // Save caret position
                const selection = window.getSelection();
                const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
                const caretOffset = range ? range.startOffset : null;
                // Capitalize words
                const oldText = td.textContent;
                const newText = capitalizeWords(oldText);
                if (oldText !== newText) {
                    td.textContent = newText;
                    // Restore caret position
                    if (range && td.childNodes.length > 0) {
                        const newRange = document.createRange();
                        newRange.setStart(td.childNodes[0], Math.min(caretOffset, td.childNodes[0].length));
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    }
                }
            });
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

    function addRows(n) {
        clearRows();
        for (let i = 0; i < n; i++) {
            const tr = document.createElement('tr');
            if (i === 0) {
                // First row: add merged cells for indices 0,1,2,4,31 with rowspan=n
                for (let col = 0; col < totalColumns; col++) {
                    if (mergedIndices.includes(col)) {
                        tr.appendChild(createCell(true, n, false, col));
                    } else if (col === 3) { // Roll Position (not merged)
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
                // For subsequent rows, skip merged cells, but add Roll Position and others
                for (let col = 0; col < totalColumns; col++) {
                    if (col === 3) { // Roll Position
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
            tableBody.appendChild(tr);
        }
        updateRowCount();
    }

    function clearRows() {
        while (tableBody.firstChild) tableBody.removeChild(tableBody.firstChild);
        updateRowCount();
    }

    // --- Persistence Key ---
    const STORAGE_KEY = 'inlineInspectionTableData';

    // --- Serialize table to array ---
    function serializeTable() {
        const data = [];
        for (let r = 0; r < tableBody.rows.length; r++) {
            const row = tableBody.rows[r];
            const rowData = [];
            for (let c = 0; c < row.cells.length; c++) {
                const cell = row.cells[c];
                let cellData = {
                    text: cell.textContent,
                    rowspan: cell.rowSpan || 1,
                    colspan: cell.colSpan || 1,
                    isDropdown: false,
                    dropdownValue: null
                };
                const select = cell.querySelector('select');
                if (select) {
                    cellData.isDropdown = true;
                    cellData.dropdownValue = select.value;
                }
                rowData.push(cellData);
            }
            data.push(rowData);
        }
        return data;
    }

    // --- Restore table from array ---
    function restoreTable(data) {
        clearRows();
        for (let r = 0; r < data.length; r++) {
            const rowData = data[r];
            const tr = document.createElement('tr');
            for (let c = 0; c < rowData.length; c++) {
                const cellData = rowData[c];
                let td;
                if (cellData.isDropdown) {
                    td = createCell(false, cellData.rowspan, true, c);
                    const select = td.querySelector('select');
                    select.value = cellData.dropdownValue || '';
                } else {
                    td = createCell(true, cellData.rowspan, false, c);
                    td.textContent = capitalizeWords(cellData.text || '');
                }
                if (cellData.colspan && cellData.colspan > 1) td.colSpan = cellData.colspan;
                if (cellData.rowspan && cellData.rowspan > 1) td.rowSpan = cellData.rowspan;
                tr.appendChild(td);
            }
            tableBody.appendChild(tr);
        }
        // --- After all rows are appended, trigger color logic for all dropdowns ---
        const selects = tableBody.querySelectorAll('select');
        selects.forEach(select => {
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        updateRowCount();
    }

    // --- Save to localStorage ---
    function saveTable() {
        const data = serializeTable();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    // --- Load from localStorage ---
    function loadTable() {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            try {
                restoreTable(JSON.parse(data));
            } catch (e) {
                // If error, clear storage and start fresh
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    }

    // --- Persistence for all tables ---
    const ALL_TABLES_KEY = 'inlineInspectionAllTables';

    // Helper to serialize a table's tbody to array
    function serializeTableBody(tbody) {
        const data = [];
        for (let r = 0; r < tbody.rows.length; r++) {
            const row = tbody.rows[r];
            const rowData = [];
            for (let c = 0; c < row.cells.length; c++) {
                const cell = row.cells[c];
                let cellData = {
                    text: cell.textContent,
                    rowspan: cell.rowSpan || 1,
                    colspan: cell.colSpan || 1,
                    isDropdown: false,
                    dropdownValue: null
                };
                const select = cell.querySelector('select');
                if (select) {
                    cellData.isDropdown = true;
                    cellData.dropdownValue = select.value;
                }
                rowData.push(cellData);
            }
            data.push(rowData);
        }
        return data;
    }

    // Helper to restore a table from array (returns tbody)
    function restoreTableBody(data) {
        const tbody = document.createElement('tbody');
        for (let r = 0; r < data.length; r++) {
            const rowData = data[r];
            const tr = document.createElement('tr');
            for (let c = 0; c < rowData.length; c++) {
                const cellData = rowData[c];
                let td;
                if (cellData.isDropdown) {
                    td = createCell(false, cellData.rowspan, true, c);
                    const select = td.querySelector('select');
                    select.value = cellData.dropdownValue || '';
                } else {
                    td = createCell(true, cellData.rowspan, false, c);
                    td.textContent = capitalizeWords(cellData.text || '');
                }
                if (cellData.colspan && cellData.colspan > 1) td.colSpan = cellData.colspan;
                if (cellData.rowspan && cellData.rowspan > 1) td.rowSpan = cellData.rowspan;
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
        // After all rows are appended, trigger color logic for all dropdowns
        const selects = tbody.querySelectorAll('select');
        selects.forEach(select => {
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        return tbody;
    }

    // Save all tables to localStorage
    function saveAllTables() {
        const allTables = [];
        // First table
        allTables.push(serializeTableBody(tableBody));
        // Other tables
        const extraTables = tablesContainer.querySelectorAll('table:not(:first-of-type) tbody');
        extraTables.forEach(tbody => {
            allTables.push(serializeTableBody(tbody));
        });
        localStorage.setItem(ALL_TABLES_KEY, JSON.stringify(allTables));
    }

    // Restore all tables from localStorage
    function restoreAllTables() {
        const data = localStorage.getItem(ALL_TABLES_KEY);
        if (!data) return;
        const allTables = JSON.parse(data);
        // Remove all extra tables
        const extraTables = Array.from(tablesContainer.querySelectorAll('table:not(:first-of-type)'));
        extraTables.forEach(tbl => tbl.remove());
        // Remove all extra Save buttons
        Array.from(tablesContainer.querySelectorAll('.dynamic-save-btn')).forEach(btn => btn.remove());
        // Remove all dotted separators
        Array.from(tablesContainer.querySelectorAll('.table-separator')).forEach(hr => hr.remove());
        // Reference to the first table for formatting
        const origTable = tablesContainer.querySelector('table');
        let firstTableFormatClass = '';
        let firstTableFormatStyle = '';
        if (origTable) {
            firstTableFormatClass = origTable.className;
            firstTableFormatStyle = origTable.style.cssText;
        }
        // Restore first table
        if (allTables.length > 0) {
            const firstTbody = restoreTableBody(allTables[0]);
            // Remove all rows from first table's tbody
            while (tableBody.firstChild) tableBody.removeChild(tableBody.firstChild);
            // Append restored rows
            Array.from(firstTbody.rows).forEach(row => tableBody.appendChild(row));
            // Apply formatting to first table
            if (firstTableFormatClass) tableBody.parentElement.className = firstTableFormatClass;
            if (firstTableFormatStyle) tableBody.parentElement.style.cssText = firstTableFormatStyle;
            tableBody.parentElement.style.border = '2px solid #000';
            tableBody.parentElement.style.borderCollapse = 'collapse';
        }
        // Restore extra tables
        for (let i = 1; i < allTables.length; i++) {
            // Add single dotted separator before each extra table
            const hr = document.createElement('hr');
            hr.className = 'table-separator';
            hr.style.border = 'none';
            hr.style.borderTop = '2px dotted #888';
            hr.style.margin = '24px 0 16px 0';
            tablesContainer.appendChild(hr);
            const newTable = document.createElement('table');
            // Apply formatting to new table
            if (firstTableFormatClass) newTable.className = firstTableFormatClass;
            if (firstTableFormatStyle) newTable.style.cssText = firstTableFormatStyle;
            newTable.style.border = '2px solid #000';
            newTable.style.borderCollapse = 'collapse';
            // Clone thead from the first table
            const origTableForThead = tablesContainer.querySelector('table');
            const thead = origTableForThead ? origTableForThead.querySelector('thead').cloneNode(true) : document.querySelector('thead').cloneNode(true);
            newTable.appendChild(thead);
            // Restore tbody
            const tbody = restoreTableBody(allTables[i]);
            newTable.appendChild(tbody);
            // --- Add Save button for this table ---
            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Save';
            saveBtn.className = 'bg-green-600 hover:bg-green-800 text-white font-bold py-1 px-2 rounded text-sm ml-2 dynamic-save-btn';
            saveBtn.style.marginBottom = '8px';
            saveBtn.addEventListener('click', function() {
                const data = serializeTableBody(tbody);
                console.log('Saving data for this table:', data);
                saveBtn.textContent = 'Saved!';
                setTimeout(() => { saveBtn.textContent = 'Save'; }, 1000);
            });
            tablesContainer.appendChild(saveBtn);
            tablesContainer.appendChild(newTable);
        }
        // Move Add New Table button to bottom
        tablesContainer.appendChild(addNewTableBtn);
        updateAddTableBtnVisibility();
    }

    // --- Hook into UI events ---
    // Save on any cell edit or dropdown change
    function addSaveListeners() {
        tableBody.addEventListener('input', saveTable, true);
        tableBody.addEventListener('change', saveTable, true);
    }

    // --- Add New Table Button ---
    // Create and style the button before using it
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

    // Container for all tables
    let tablesContainer = tableBody.parentElement.parentElement;
    if (!tablesContainer.id) {
        tablesContainer.id = 'tablesContainer';
    }
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

    // --- On load: restore all tables, then add listeners ---
    restoreAllTables();
    addSaveListenersToAllTables();
    // Only add default rows if table is empty after loading
    if (tableBody.rows.length === 0) {
        addRows(1); // or set your preferred default row count
    }
    updateAddTableBtnVisibility();

    // --- Save only on user actions ---
    addRowsBtn.addEventListener('click', function() {
        const n = parseInt(numRowsInput.value, 10) || 1;
        addRows(n);
        saveTable();
    });
    // Change Delete Rows button to Delete Table
    clearRowsBtn.textContent = 'Delete Table';

    // Replace clearRowsBtn click handler to delete the last table (most recent)
    clearRowsBtn.removeEventListener('click', clearRows); // Remove old handler if any
    clearRowsBtn.addEventListener('click', function() {
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
            addRows(1);
        }
        saveAllTables();
        addSaveListenersToAllTables();
        updateAddTableBtnVisibility();
    });

    updateRowCount();

    // Helper to show/hide the button based on first table row count
    function updateAddTableBtnVisibility() {
        addNewTableBtn.style.display = (tableBody.rows.length > 1) ? '' : 'none';
    }

    // --- Hook up save logic to all tables ---
    function addSaveListenersToAllTables() {
        // Remove previous listeners by replacing node (for extra tables)
        const allTbs = tablesContainer.querySelectorAll('table tbody');
        allTbs.forEach(tbody => {
            tbody.addEventListener('input', saveAllTables, true);
            tbody.addEventListener('change', saveAllTables, true);
        });
    }

    // Patch addRows and clearRows to update button visibility and save all tables
    const origAddRows = addRows;
    addRows = function(n) {
        origAddRows(n);
        updateAddTableBtnVisibility();
        saveAllTables();
        addSaveListenersToAllTables();
    };
    const origClearRows = clearRows;
    clearRows = function() {
        origClearRows();
        updateAddTableBtnVisibility();
        saveAllTables();
        addSaveListenersToAllTables();
    };

    // Initial visibility check
    updateAddTableBtnVisibility();

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
                for (let col = 0; col < totalColumns; col++) {
                    if (mergedIndices.includes(col)) {
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
                for (let col = 0; col < totalColumns; col++) {
                    if (col === 3) {
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
        return table;
    }

    // Add event listener to the button
    addNewTableBtn.addEventListener('click', function() {
        // Use the initial row count from the first table
        const n = tableBody.rows.length;
        const newTable = createNewTable(n);
        // Add single dotted separator before each new table (except first)
        if (tablesContainer.querySelectorAll('table').length > 0) {
            const hr = document.createElement('hr');
            hr.className = 'table-separator';
            hr.style.border = 'none';
            hr.style.borderTop = '2px dotted #888';
            hr.style.margin = '24px 0 16px 0';
            tablesContainer.appendChild(hr);
        }
        // --- Add Save button for this table ---
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.className = 'bg-green-600 hover:bg-green-800 text-white font-bold py-1 px-2 rounded text-sm ml-2';
        saveBtn.style.marginBottom = '8px';
        saveBtn.addEventListener('click', function() {
            // Save only this table's data (for now, log to console)
            const tbody = newTable.querySelector('tbody');
            const data = serializeTableBody(tbody);
            // You can implement per-table save logic here
            console.log('Saving data for this table:', data);
            // Optionally, show a visual confirmation
            saveBtn.textContent = 'Saved!';
            setTimeout(() => { saveBtn.textContent = 'Save'; }, 1000);
        });
        tablesContainer.appendChild(saveBtn);
        tablesContainer.appendChild(newTable);
        tablesContainer.appendChild(addNewTableBtn); // Move button below the new table
        saveAllTables();
        addSaveListenersToAllTables();
        afterTableStructureChange(); // <-- Ensure tab logic is updated for all tables
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

    // Call updateTableSpacing after any table add/remove/restore
    // Patch addRows and clearRows to update spacing
    const origAddRows2 = addRows;
    addRows = function(n) {
        origAddRows2(n);
        updateAddTableBtnVisibility();
        saveAllTables();
        addSaveListenersToAllTables();
        updateTableSpacing();
    };
    const origClearRows2 = clearRows;
    clearRows = function() {
        origClearRows2();
        updateAddTableBtnVisibility();
        saveAllTables();
        addSaveListenersToAllTables();
        updateTableSpacing();
    };
    // Also update spacing after adding or deleting a table
    addNewTableBtn.addEventListener('click', updateTableSpacing);
    clearRowsBtn.addEventListener('click', updateTableSpacing);

    // Call after restoring all tables
    restoreAllTables();
    addSaveListenersToAllTables();
    updateTableSpacing();
    // Only add default rows if table is empty after loading
    if (tableBody.rows.length === 0) {
        addRows(1); // or set your preferred default row count
    }
    updateAddTableBtnVisibility();

    // Constants for column indices
    const ROLL_WEIGHT_COL_INDEX = 5;
    const ROLL_THETA_COL_INDEX = 9;

    // --- Add classes to Roll Weight and Roll θ cells for easy selection ---
    function tagSpecialCells() {
        tablesContainer.querySelectorAll('table').forEach(table => {
            // Build a 2D grid of the table (visual cells)
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.rows);
            // Build grid: grid[row][col] = cell
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
            // Remove old classes
            rows.forEach(row => {
                Array.from(row.children).forEach(td => {
                    td.classList.remove('roll-weight-cell', 'roll-theta-cell');
                });
            });
            // Assign classes based on grid
            for (let r = 0; r < grid.length; r++) {
                if (grid[r][ROLL_WEIGHT_COL_INDEX] && grid[r][ROLL_WEIGHT_COL_INDEX].isContentEditable) {
                    grid[r][ROLL_WEIGHT_COL_INDEX].classList.add('roll-weight-cell');
                }
                if (grid[r][ROLL_THETA_COL_INDEX] && grid[r][ROLL_THETA_COL_INDEX].isContentEditable) {
                    grid[r][ROLL_THETA_COL_INDEX].classList.add('roll-theta-cell');
                }
            }
        });
    }

    // --- Fast-entry tab order logic for contentEditable cells, per-table ---
    function getTableFromCell(cell) {
        let el = cell;
        while (el && el.tagName !== 'TABLE') {
            el = el.parentElement;
        }
        return el;
    }

    function getLockCheckboxesForTable(table) {
        // Find checkboxes by class or attribute in thead of this table
        const thead = table.querySelector('thead');
        // Use attribute selector for id ends with 'rollWeightLock' and 'rollThetaLock' (since IDs may be duplicated)
        const rollWeightLockBox = thead.querySelector('input[id$="rollWeightLock"]');
        const rollThetaLockBox = thead.querySelector('input[id$="rollThetaLock"]');
        return { rollWeightLockBox, rollThetaLockBox };
    }

    function getTabbableCells(currentCell) {
        const table = getTableFromCell(currentCell);
        if (!table) return null;
        const { rollWeightLockBox, rollThetaLockBox } = getLockCheckboxesForTable(table);
        let selectors = [];
        if (rollWeightLockBox && rollWeightLockBox.checked) selectors.push('.roll-weight-cell');
        if (rollThetaLockBox && rollThetaLockBox.checked) selectors.push('.roll-theta-cell');
        if (selectors.length === 0) return null;
        // Get all cells in row order, then column order, for this table only
        return Array.from(table.querySelectorAll('tbody tr')).flatMap(tr => {
            return selectors.flatMap(sel => Array.from(tr.querySelectorAll(sel)));
        });
    }

    function handleTabNavigation(e) {
        const active = document.activeElement;
        const tabbable = getTabbableCells(active);
        if (!tabbable || tabbable.length === 0) return;
        const idx = tabbable.indexOf(active);
        if (idx === -1) {
            // If not on a tabbable cell, focus the first
            tabbable[0].focus();
            e.preventDefault();
            return;
        }
        let nextIdx;
        if (!e.shiftKey) {
            nextIdx = (idx + 1) % tabbable.length;
        } else {
            nextIdx = (idx - 1 + tabbable.length) % tabbable.length;
        }
        tabbable[nextIdx].focus();
        e.preventDefault();
    }

    function updateFastEntryTabOrder() {
        tagSpecialCells();
        // Remove tabindex from all contentEditable cells
        tablesContainer.querySelectorAll('td[tabindex]').forEach(td => td.removeAttribute('tabindex'));
        // For each table, set tabindex for its tabbable cells
        tablesContainer.querySelectorAll('table').forEach(table => {
            const { rollWeightLockBox, rollThetaLockBox } = getLockCheckboxesForTable(table);
            let selectors = [];
            if (rollWeightLockBox && rollWeightLockBox.checked) selectors.push('.roll-weight-cell');
            if (rollThetaLockBox && rollThetaLockBox.checked) selectors.push('.roll-theta-cell');
            const allEditable = Array.from(table.querySelectorAll('td[contenteditable="true"]'));
            if (selectors.length === 0) {
                // If neither lock is checked, make all editable cells tabbable
                allEditable.forEach(td => td.setAttribute('tabindex', '0'));
            } else {
                const tabbable = Array.from(table.querySelectorAll('tbody tr')).flatMap(tr => selectors.flatMap(sel => Array.from(tr.querySelectorAll(sel))));
                allEditable.forEach(td => {
                    if (tabbable && tabbable.includes(td)) {
                        td.setAttribute('tabindex', '0');
                    } else {
                        td.setAttribute('tabindex', '-1');
                    }
                });
            }
        });
    }

    // Listen for Tab keydown at the table container level
    tablesContainer.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            const active = document.activeElement;
            const tabbable = getTabbableCells(active);
            if (tabbable && tabbable.length > 0) {
                handleTabNavigation(e);
            }
        }
    }, true);

    // Listen for changes on all lock checkboxes (delegated)
    tablesContainer.addEventListener('change', function(e) {
        if (e.target.matches('input[id$="rollWeightLock"], input[id$="rollThetaLock"]')) {
            updateFastEntryTabOrder();
        }
    });

    // --- Extend createCell to tag Roll Weight and Roll θ inputs ---
    const originalCreateCell = createCell;
    createCell = function(contentEditable = true, rowspan = 1, isDropdown = false, colIndex = null) {
        const td = originalCreateCell(contentEditable, rowspan, isDropdown, colIndex);
        if (!isDropdown && contentEditable && colIndex !== null) {
            const input = td.querySelector('input');
            if (input) {
                if (colIndex === ROLL_WEIGHT_COL_INDEX) input.classList.add('roll-weight-input');
                if (colIndex === ROLL_THETA_COL_INDEX) input.classList.add('roll-theta-input');
            }
        }
        return td;
    };

    // --- Fast-entry tab order logic ---
    // These listeners are now handled by the delegated change listener above
    // if (rollWeightLockBox) rollWeightLockBox.addEventListener('change', updateFastEntryTabOrder);
    // if (rollThetaLockBox) rollThetaLockBox.addEventListener('change', updateFastEntryTabOrder);

    // Call after table modifications
    function afterTableStructureChange() {
        updateAddTableBtnVisibility();
        saveAllTables();
        addSaveListenersToAllTables();
        updateTableSpacing();
        updateFastEntryTabOrder();
    }

    // Patch addRows/clearRows overrides to use new helper
    addRows = function(n) {
        origAddRows2(n);
        afterTableStructureChange();
    };
    clearRows = function() {
        origClearRows2();
        afterTableStructureChange();
    };

    // Update spacing and fast-entry order after add/delete table events
    addNewTableBtn.addEventListener('click', () => {
        updateTableSpacing();
        updateFastEntryTabOrder();
    });
    clearRowsBtn.addEventListener('click', () => {
        updateTableSpacing();
        updateFastEntryTabOrder();
    });

    // Initial fast entry setup
    updateFastEntryTabOrder();
}); 