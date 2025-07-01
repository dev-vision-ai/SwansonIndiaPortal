// JavaScript for 16gsm_kranti.html

const PAGE2_DATA_KEY = 'filmInspectionTableDataPage2';
const PAGE4_DATA_KEY = 'filmInspectionTableDataPage4';

document.addEventListener('DOMContentLoaded', function() {
    const TABLE_DATA_KEY = 'filmInspectionTableData';

    // Decimal formatting and restriction config for each column
    const decimalConfig = [
        null, // Sample No. (no restriction)
        2,    // GSM
        3,    // Thickness
        1,    // Opacity
        2,    // COF Kinetic
        0,    // Cut Width (integer only, no decimals)
        2,    // Color-Delta E (Unprinted Film)
        2     // Color-Delta E (Printed Film)
    ];

    function restrictAndFormatInput(input, decimals) {
        input.addEventListener('input', function(e) {
            let value = input.value;
            if (decimals === 0) {
                // Integer only (for Cut Width)
                value = value.replace(/[^0-9]/g, '');
            } else {
                // Allow only numbers and one dot
                value = value.replace(/[^0-9.]/g, '');
                // Only one dot
                const parts = value.split('.');
                if (parts.length > 2) {
                    value = parts[0] + '.' + parts.slice(1).join('');
                }
                // Restrict decimal places
                if (decimals !== null && value.includes('.')) {
                    const [intPart, decPart] = value.split('.');
                    value = intPart + '.' + decPart.slice(0, decimals);
                }
            }
            input.value = value;
        });
        // Format on blur or Enter
        input.addEventListener('blur', function() {
            if (decimals !== null && input.value !== '') {
                if (decimals === 0) {
                    input.value = parseInt(input.value, 10) || '';
                } else {
                    input.value = parseFloat(input.value).toFixed(decimals);
                }
            }
        });
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && decimals !== null && input.value !== '') {
                if (decimals === 0) {
                    input.value = parseInt(input.value, 10) || '';
                } else {
                    input.value = parseFloat(input.value).toFixed(decimals);
                }
            }
        });
    }

    loadTableData(); // Load data when the page loads
    calculateAndDisplayAggregates(); // Calculate and display aggregates on load

    // --- Add one row by default if none exist ---
    (function ensureAtLeastOneRow() {
        const tableBody = document.querySelector('table tbody');
        if (tableBody) {
            const rows = Array.from(tableBody.rows);
            let startIndex = -1;
            let endIndex = -1;
            for (let i = 0; i < rows.length; i++) {
                if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Sample No.')) {
                    startIndex = i + 1;
                }
                if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Average')) {
                    endIndex = i;
                    break;
                }
            }
            let rowCount = 0;
            if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
                rowCount = endIndex - startIndex;
            }
            if (rowCount === 0) {
                addDynamicRowToPage1();
            }
        }
    })();

    // Function to update the displayed row count
    function updateRowCount() {
        const tableBody = document.querySelector('table tbody');
        if (tableBody) {
            const rows = Array.from(tableBody.rows);
            let startIndex = -1;
            let endIndex = -1;

            for (let i = 0; i < rows.length; i++) {
                if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Sample No.')) {
                    startIndex = i + 1;
                }
                if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Average')) {
                    endIndex = i;
                    break;
                }
            }

            let rowCount = 0;
            if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
                rowCount = endIndex - startIndex;
            }
            const rowCountDisplay = document.getElementById('rowCountDisplay');
            if (rowCountDisplay) {
                rowCountDisplay.textContent = `Rows: ${rowCount}`;
            }
        }
    }

    // Function to save table data to localStorage
    function saveTableData() {
        const tableBody = document.querySelector('table tbody');
        if (tableBody) {
            const rows = Array.from(tableBody.rows);
            const dynamicRowsData = [];

            // Determine the range of dynamic rows
            let startIndex = -1;
            let endIndex = -1;

            for (let i = 0; i < rows.length; i++) {
                if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Sample No.')) {
                    startIndex = i + 1; // Rows after 'Sample No.'
                }
                if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Average')) {
                    endIndex = i; // Rows before 'Average'
                    break;
                }
            }

            if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
                for (let i = startIndex; i < endIndex; i++) {
                    const rowData = [];
                    const cells = Array.from(rows[i].cells);
                    cells.forEach(cell => {
                        const input = cell.querySelector('input');
                        rowData.push(input ? input.value : cell.textContent);
                    });
                    dynamicRowsData.push(rowData);
                }
            }

            const allTableData = {
                dynamicRows: dynamicRowsData
            };
            localStorage.setItem(TABLE_DATA_KEY, JSON.stringify(allTableData));
            updateRowCount(); // Update count after saving
            calculateAndDisplayAggregates();
        }
    }

    // Function to load table data from localStorage
    function loadTableData() {
        const savedData = localStorage.getItem(TABLE_DATA_KEY);
        if (savedData) {
            const allTableData = JSON.parse(savedData);
            const dynamicRowsData = allTableData.dynamicRows || [];

            const tableBody = document.querySelector('table tbody');
            if (tableBody) {
                let averageRow = null;
                let minRow = null;
                let maxRow = null;

                for (let i = 0; i < tableBody.rows.length; i++) {
                    if (tableBody.rows[i].cells[0] && tableBody.rows[i].cells[0].textContent.includes('Average')) {
                        averageRow = tableBody.rows[i];
                    } else if (tableBody.rows[i].cells[0] && tableBody.rows[i].cells[0].textContent.includes('Minimum')) {
                        minRow = tableBody.rows[i];
                    } else if (tableBody.rows[i].cells[0] && tableBody.rows[i].cells[0].textContent.includes('Maximum')) {
                        maxRow = tableBody.rows[i];
                    }
                }

                // Clear existing dynamic rows before loading new ones
                let startIndex = -1;
                let endIndex = -1;
                const rows = Array.from(tableBody.rows);

                for (let i = 0; i < rows.length; i++) {
                    if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Sample No.')) {
                        startIndex = i + 1;
                    }
                    if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Average')) {
                        endIndex = i;
                        break;
                    }
                }

                if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
                    for (let i = endIndex - 1; i >= startIndex; i--) {
                        tableBody.deleteRow(i);
                    }
                }

                if (averageRow) {
                    const insertIndex = Array.from(tableBody.rows).indexOf(averageRow);
                    // Insert loaded rows in reverse so the first saved row is at the top
                    for (let idx = dynamicRowsData.length - 1; idx >= 0; idx--) {
                        const rowData = dynamicRowsData[idx];
                        const newRow = tableBody.insertRow(insertIndex);
                        // Sample No. subgroup: 3 columns, each with its own input
                        for (let j = 0; j < 3; j++) {
                            const td = document.createElement('td');
                            td.className = 'border border-gray-500 p-2 text-center';
                            td.colSpan = 1;
                            const input = document.createElement('input');
                            input.type = 'text';
                            input.style.width = '110px';
                            input.style.height = '100%';
                            input.style.border = 'none';
                            input.style.background = 'none';
                            input.style.outline = 'none';
                            input.style.textAlign = 'center';
                            input.style.padding = '0 4px';
                            input.style.boxSizing = 'border-box';
                            input.className = '';
                            let value = (rowData[j] || '');
                            input.value = value;
                            input.addEventListener('input', saveTableData);
                            td.style.width = '50px';
                            td.style.overflow = 'visible';
                            td.appendChild(input);
                            newRow.appendChild(td);
                        }
                        // The rest: GSM, Thickness, Opacity, COF Kinetic, New Column 1, New Column 2, New Column 3 (each spans 3 columns)
                        for (let i = 1; i <= 7; i++) {
                            const td = document.createElement('td');
                            td.className = 'border border-gray-500 p-2 text-center';
                            td.colSpan = 3;
                            const input = document.createElement('input');
                            input.type = 'text';
                            input.style.width = '100%';
                            input.style.height = '100%';
                            input.style.border = 'none';
                            input.style.background = 'none';
                            input.style.outline = 'none';
                            input.style.textAlign = 'center';
                            input.style.padding = '0 4px';
                            input.style.boxSizing = 'border-box';
                            input.className = '';
                            let value = rowData[3 + (i - 1)] || '';
                            if (decimalConfig[i] !== null && value !== '') {
                                value = parseFloat(value).toFixed(decimalConfig[i]);
                            }
                            input.value = value;
                            if (decimalConfig[i] !== null) restrictAndFormatInput(input, decimalConfig[i]);
                            input.addEventListener('input', saveTableData);
                            td.appendChild(input);
                            newRow.appendChild(td);
                        }
                    }
                } else {
                    console.warn('Could not find the "Average" row to load new rows.');
                }


            }
            updateRowCount(); // Update count after loading
            calculateAndDisplayAggregates(); // Calculate and display aggregates after loading data
        }
    }

    // Function to calculate and display aggregates (Average, Min, Max)
    function calculateAndDisplayAggregates() {
        const tableBody = document.querySelector('table tbody');
        if (!tableBody) return;

        const rows = Array.from(tableBody.rows);
        let startIndex = -1;
        let endIndex = -1;

        for (let i = 0; i < rows.length; i++) {
            if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Sample No.')) {
                startIndex = i + 1;
            }
            if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Average')) {
                endIndex = i;
                break;
            }
        }

        if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
            // No dynamic rows or aggregate rows found
            return;
        }

        const dynamicRows = rows.slice(startIndex, endIndex);
        const numColumnsToCalculate = 7; // Now includes Cut Width and both Color-Delta E columns

        // Initialize arrays to hold values for each column
        const columnValues = Array.from({ length: numColumnsToCalculate }, () => []);

        dynamicRows.forEach(row => {
            // Start from the second cell (index 1) as the first is 'Sample No.'
            // Column indices for the values we want to calculate (Basic Weight, Thickness, Opacity, COF Kinetic, Cut Width, Color-Delta E Unprinted, Color-Delta E Printed)
            // These correspond to the input fields in the HTML structure
            const valueCellIndices = [3, 4, 5, 6, 7, 8, 9]; // These are the actual cell indices in the dynamic rows for the data columns

            valueCellIndices.forEach((cellIdx, i) => {
                const cell = row.cells[cellIdx];
                if (cell) {
                    const input = cell.querySelector('input');
                    const value = parseFloat(input ? input.value : ''); // Always get value from input
                    if (!isNaN(value)) {
                        columnValues[i].push(value);
                    }
                }
            });
        });

        let averageRow = null;
        let minRow = null;
        let maxRow = null;

        for (let i = 0; i < rows.length; i++) {
            if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Average')) {
                averageRow = rows[i];
            } else if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Minimum')) {
                minRow = rows[i];
            } else if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Maximum')) {
                maxRow = rows[i];
            }
        }

        // Populate the aggregate rows
        if (averageRow && minRow && maxRow) {
            // The structure is Sample No. (colspan 3), then 7 data columns (each colspan 3)
            // The aggregate rows have 8 cells: Label, then 7 data columns
            const aggregateCellIndices = [1, 2, 3, 4, 5, 6, 7]; // These are the actual cell indices in the aggregate rows

            for (let i = 0; i < numColumnsToCalculate; i++) {
                const avg = columnValues[i].length > 0 ? columnValues[i].reduce((a, b) => a + b, 0) / columnValues[i].length : 0;
                const min = columnValues[i].length > 0 ? Math.min(...columnValues[i]) : 0;
                const max = columnValues[i].length > 0 ? Math.max(...columnValues[i]) : 0;

                // For Cut Width (i === 4), show as integer with no trailing zeros, and show '0' if no data
                if (i === 4) {
                    if (averageRow.cells[aggregateCellIndices[i]])
                        averageRow.cells[aggregateCellIndices[i]].textContent = columnValues[i].length > 0 ? Math.round(avg).toString() : '0';
                    if (minRow.cells[aggregateCellIndices[i]])
                        minRow.cells[aggregateCellIndices[i]].textContent = columnValues[i].length > 0 ? Math.round(min).toString() : '0';
                    if (maxRow.cells[aggregateCellIndices[i]])
                        maxRow.cells[aggregateCellIndices[i]].textContent = columnValues[i].length > 0 ? Math.round(max).toString() : '0';
                } else {
                    if (averageRow.cells[aggregateCellIndices[i]])
                        averageRow.cells[aggregateCellIndices[i]].textContent = avg.toFixed(decimalConfig[i + 1]);
                    if (minRow.cells[aggregateCellIndices[i]])
                        minRow.cells[aggregateCellIndices[i]].textContent = min.toFixed(decimalConfig[i + 1]);
                    if (maxRow.cells[aggregateCellIndices[i]])
                        maxRow.cells[aggregateCellIndices[i]].textContent = max.toFixed(decimalConfig[i + 1]);
                }
            }
        }
    }

    // Function to populate fields with data
    function populateFilmInspectionForm(data) {
        if (!data) {
            console.warn('No data provided to populate film inspection form.');
            return;
        }

        document.getElementById('productCode').textContent = data.productCode || '';
        document.getElementById('piNo').textContent = data.piNo || '';
        document.getElementById('machine').textContent = data.machine || '';
        document.getElementById('productionDate').textContent = data.productionDate || '';
        document.getElementById('specification').textContent = data.specification || '';
        document.getElementById('po').textContent = data.po || '';
        document.getElementById('quantity').textContent = data.quantity || '';
        document.getElementById('inspectionDate').textContent = data.inspectionDate || '';
        document.getElementById('testingEquipment1').textContent = data.testingEquipment1 || '';
        document.getElementById('testingEquipment2').textContent = data.testingEquipment2 || '';
        document.getElementById('testingEquipment3').textContent = data.testingEquipment3 || '';
        document.getElementById('testingEquipment4').textContent = data.testingEquipment4 || '';
    }

    // Example usage: Assume filmInspectionData is available globally or fetched
    // In a real application, you would fetch this data, e.g., from an API:

    const addNewRowsBtn = document.getElementById('addNewRowsBtn');
    const numRowsInput = document.getElementById('numRowsInput');
    if (addNewRowsBtn) {
        addNewRowsBtn.addEventListener('click', function() {
            const tableBody = document.querySelector('table tbody');
            if (tableBody) {
                let averageRow = null;
                for (let i = 0; i < tableBody.rows.length; i++) {
                    if (tableBody.rows[i].cells[0] && tableBody.rows[i].cells[0].textContent.includes('Average')) {
                        averageRow = tableBody.rows[i];
                        break;
                    }
                }
                if (averageRow) {
                    const insertIndex = Array.from(tableBody.rows).indexOf(averageRow);
                    let numRows = 1;
                    if (numRowsInput && !isNaN(parseInt(numRowsInput.value))) {
                        numRows = Math.max(1, parseInt(numRowsInput.value));
                    }
                    for (let n = 0; n < numRows; n++) {
                        const newRow = tableBody.insertRow(insertIndex);
                        // Sample No. subgroup: 3 columns, each with its own input
                        for (let j = 0; j < 3; j++) {
                            const td = document.createElement('td');
                            td.className = 'border border-gray-500 p-2 text-center';
                            td.colSpan = 1;
                            const input = document.createElement('input');
                            input.type = 'text';
                            input.style.width = '110px';
                            input.style.height = '100%';
                            input.style.border = 'none';
                            input.style.background = 'none';
                            input.style.outline = 'none';
                            input.style.textAlign = 'center';
                            input.style.padding = '0 4px';
                            input.style.boxSizing = 'border-box';
                            input.className = '';
                            input.value = '';
                            input.addEventListener('input', saveTableData);
                            td.appendChild(input);
                            newRow.appendChild(td);
                        }
                        // The rest: GSM, Thickness, Opacity, COF Kinetic, New Column 1, New Column 2, New Column 3 (each spans 3 columns)
                        for (let i = 1; i <= 7; i++) {
                            const td = document.createElement('td');
                            td.className = 'border border-gray-500 p-2 text-center';
                            td.colSpan = 3;
                            const input = document.createElement('input');
                            input.type = 'text';
                            input.style.width = '100%';
                            input.style.height = '100%';
                            input.style.border = 'none';
                            input.style.background = 'none';
                            input.style.outline = 'none';
                            input.style.textAlign = 'center';
                            input.style.padding = '0 4px';
                            input.style.boxSizing = 'border-box';
                            input.className = '';
                            input.value = '';
                            if (decimalConfig[i] !== null) restrictAndFormatInput(input, decimalConfig[i]);
                            input.addEventListener('input', saveTableData);
                            td.appendChild(input);
                            newRow.appendChild(td);
                        }
                    }
                    saveTableData();
                    calculateAndDisplayAggregates();
                    updateRowCount();
                    syncPage2RowsWithPage1();
                    syncPage3RowsWithPage1();
                } else {
                    console.warn('Could not find the "Average" row to insert new rows.');
                }
            }
        });
    }

    // In a real application, you would fetch this data, e.g., from an API:
    /*
    fetch('/api/film-inspection-data')
        .then(response => response.json())
        .then(data => populateFilmInspectionForm(data))
        .catch(error => console.error('Error fetching film inspection data:', error));
    */

    const clearRowsBtn = document.getElementById('clearRowsBtn');
    if (clearRowsBtn) {
        clearRowsBtn.addEventListener('click', function() {
            const tableBody = document.querySelector('table tbody');
            if (tableBody) {
                let startIndex = -1;
                let endIndex = -1;

                const rows = Array.from(tableBody.rows);

                for (let i = 0; i < rows.length; i++) {
                    if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Sample No.')) {
                        startIndex = i + 1;
                    }
                    if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Average')) {
                        endIndex = i;
                        break;
                    }
                }

                if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
                    // Remove only the last dynamically added row
                    const lastDynamicRowIndex = endIndex - 1;
                    if (lastDynamicRowIndex >= startIndex) {
                        tableBody.deleteRow(lastDynamicRowIndex);
                        saveTableData();
                        calculateAndDisplayAggregates();
                        updateRowCount(); // Update count after clearing
                        syncPage2RowsWithPage1();
                    }
                }
            }
        });
    }

    // Add event listener for keyboard navigation and aggregate calculation
    const tableBody = document.querySelector('table tbody');
    if (tableBody) {
        tableBody.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent default Enter key behavior (e.g., form submission)

                const target = event.target;
                if (target.tagName === 'INPUT') {
                    const currentCell = target.closest('td');
                    const currentRow = target.closest('tr');
                    const cellsInRow = Array.from(currentRow.querySelectorAll('td input'));
                    const currentCellIndex = cellsInRow.indexOf(target);

                    // Determine the range of dynamic rows
                    const rows = Array.from(tableBody.rows);
                    let startIndex = -1;
                    let endIndex = -1;

                    for (let i = 0; i < rows.length; i++) {
                        if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Sample No.')) {
                            startIndex = i + 1;
                        }
                        if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Average')) {
                            endIndex = i;
                            break;
                        }
                    }

                    const dynamicRows = rows.slice(startIndex, endIndex);
                    const currentRowIndexInDynamic = dynamicRows.indexOf(currentRow);

                    if (currentRowIndexInDynamic !== -1) {
                        // Try to move to the next cell in the same column
                        let nextInput = null;
                        if (currentRowIndexInDynamic + 1 < dynamicRows.length) {
                            const nextRow = dynamicRows[currentRowIndexInDynamic + 1];
                            const nextRowInputs = Array.from(nextRow.querySelectorAll('td input'));
                            if (currentCellIndex < nextRowInputs.length) {
                                nextInput = nextRowInputs[currentCellIndex];
                            }
                        }

                        if (nextInput) {
                            nextInput.focus();
                        } else {
                            // If no next row in the same column, move to the first cell of the next column
                            const nextColumnIndex = currentCellIndex + 1;
                            if (nextColumnIndex < cellsInRow.length) {
                                // Find the first input in the next column of the current row
                                const nextColumnInput = cellsInRow[nextColumnIndex];
                                if (nextColumnInput) {
                                    nextColumnInput.focus();
                                }
                            } else {
                                // If at the end of the row, move to the first cell of the next dynamic row
                                if (currentRowIndexInDynamic + 1 < dynamicRows.length) {
                                    const nextRow = dynamicRows[currentRowIndexInDynamic + 1];
                                    const firstInputInNextRow = nextRow.querySelector('td input');
                                    if (firstInputInNextRow) {
                                        firstInputInNextRow.focus();
                                    }
                                }
                            }
                        }
                    }
                }
                // Always recalculate aggregates on Enter press
                calculateAndDisplayAggregates();
            }
        });
    }

    // --- PAGE 2 ROW SYNC LOGIC ---
    function saveTableDataPage2() {
        const page2TableBody = document.getElementById('page2TableBody');
        if (page2TableBody) {
            const rows = Array.from(page2TableBody.children);
            const dynamicRowsData = [];
            rows.forEach(tr => {
                const rowData = [];
                const tds = Array.from(tr.children);
                tds.forEach((td, idx) => {
                    const input = td.querySelector('input');
                    rowData.push(input ? input.value : td.textContent);
                });
                dynamicRowsData.push(rowData);
            });
            localStorage.setItem(PAGE2_DATA_KEY, JSON.stringify({ dynamicRows: dynamicRowsData }));
        }
    }

    // Format Page 2 inputs after loading/restoring data
    function formatPage2Inputs() {
        const page2TableBody = document.getElementById('page2TableBody');
        if (!page2TableBody) return;
        const rows = Array.from(page2TableBody.children);
        rows.forEach(tr => {
            const tds = Array.from(tr.children);
            // Elongation@ Break (%) columns 1,2,3 (indices 3,4,5) and Ave (6)
            [3,4,5,6].forEach(idx => {
                const input = tds[idx]?.querySelector('input');
                if (input && input.value) {
                    let val = input.value.replace(/\D/g, '');
                    if (val.length > 3) val = val.slice(0, 3);
                    input.value = val;
                }
            });
            // Force-Tensile Strength@Break columns 1,2,3 (indices 7,8,9) and Ave (10): 2 digits before, 1 after decimal
            [7,8,9,10].forEach(idx => {
                const input = tds[idx]?.querySelector('input');
                if (input && input.value) {
                    let val = input.value.replace(/[^0-9.]/g, '');
                    const parts = val.split('.');
                    if (parts.length > 2) {
                        val = parts[0] + '.' + parts.slice(1).join('');
                    }
                    if (val.includes('.')) {
                        const [intPart, decPart] = val.split('.');
                        val = intPart.slice(0, 2) + '.' + (decPart ? decPart.slice(0, 1) : '');
                    } else {
                        val = val.slice(0, 2);
                    }
                    input.value = val;
                }
            });
            // Force-Tensile Strength@Break 5% columns 1,2,3 (indices 11,12,13) and Ave (14): 1 digit before, 1 after decimal
            [11,12,13,14].forEach(idx => {
                const input = tds[idx]?.querySelector('input');
                if (input && input.value) {
                    let val = input.value.replace(/[^0-9.]/g, '');
                    const parts = val.split('.');
                    if (parts.length > 2) {
                        val = parts[0] + '.' + parts.slice(1).join('');
                    }
                    if (val.includes('.')) {
                        const [intPart, decPart] = val.split('.');
                        val = intPart.slice(0, 1) + '.' + (decPart ? decPart.slice(0, 1) : '');
                    } else {
                        val = val.slice(0, 1);
                    }
                    input.value = val;
                }
            });
        });
    }

    // Call formatPage2Inputs after restoring or syncing data
    function restoreTableDataPage2() {
        const savedData = localStorage.getItem(PAGE2_DATA_KEY);
        const page2TableBody = document.getElementById('page2TableBody');
        if (!page2TableBody || !savedData) return;
        const allTableData = JSON.parse(savedData);
        const dynamicRowsData = allTableData.dynamicRows || [];
        const rows = Array.from(page2TableBody.children);
        for (let r = 0; r < rows.length; r++) {
            const rowData = dynamicRowsData[r] || [];
            const tds = Array.from(rows[r].children);
            for (let c = 0; c < tds.length; c++) {
                const input = tds[c].querySelector('input');
                if (input && rowData[c] !== undefined) {
                    input.value = rowData[c];
                }
            }
        }
        formatPage2Inputs(); // Format after restoring
    }

    function syncPage2RowsWithPage1() {
        const page1TableBody = document.querySelector('table tbody');
        const page2TableBody = document.getElementById('page2TableBody');
        if (!page1TableBody || !page2TableBody) return;
        // Count dynamic rows in Page 1 (between Sample No. and Average)
        let startIndex = -1;
        let endIndex = -1;
        const rows = Array.from(page1TableBody.rows);
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Sample No.')) {
                startIndex = i + 1;
            }
            if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Average')) {
                endIndex = i;
                break;
            }
        }
        let rowCount = 0;
        if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
            rowCount = endIndex - startIndex;
        }
        // Get Sample No. values from Page 1
        const sampleNoValues = [];
        for (let r = startIndex; r < endIndex; r++) {
            const tr = rows[r];
            const tds = Array.from(tr.cells);
            const values = [];
            for (let i = 0; i < 3; i++) {
                const input = tds[i]?.querySelector('input');
                values.push(input ? input.value : '');
            }
            sampleNoValues.push(values);
        }
        // Clear Page 2 rows
        page2TableBody.innerHTML = '';
        // Add the same number of rows to Page 2
        for (let r = 0; r < rowCount; r++) {
            const tr = document.createElement('tr');
            // Sample No. cells (3 columns)
            for (let s = 0; s < 3; s++) {
                const tdSample = document.createElement('td');
                tdSample.className = 'border border-gray-500 p-2 text-center';
                const inputSample = document.createElement('input');
                inputSample.type = 'text';
                inputSample.style.width = '110px';
                inputSample.style.border = 'none';
                inputSample.style.outline = 'none';
                inputSample.style.textAlign = 'center';
                inputSample.style.padding = '0 2px';
                inputSample.style.boxSizing = 'border-box';
                inputSample.readOnly = true;
                inputSample.style.background = '#f3f4f6';
                inputSample.style.cursor = 'not-allowed';
                // Set value from Page 1
                inputSample.value = sampleNoValues[r]?.[s] || '';
                tdSample.appendChild(inputSample);
                tr.appendChild(tdSample);
            }
            // 3 test types × 4 columns each = 12 cells
            for (let i = 0; i < 12; i++) {
                const td = document.createElement('td');
                td.className = 'border border-gray-500 p-2 text-center';
                const input = document.createElement('input');
                input.type = 'text';
                input.style.width = '100%';
                input.style.border = 'none';
                input.style.outline = 'none';
                input.style.textAlign = 'center';
                input.style.padding = '0 2px';
                input.style.boxSizing = 'border-box';
                input.addEventListener('input', saveTableDataPage2);
                td.appendChild(input);
                tr.appendChild(td);
            }
            page2TableBody.appendChild(tr);
        }
        // Restore data after building rows
        restoreTableDataPage2();
        // Trim localStorage data to match current row count
        (function trimPage2LocalStorage() {
            const savedData = localStorage.getItem(PAGE2_DATA_KEY);
            const page2TableBody = document.getElementById('page2TableBody');
            if (!page2TableBody || !savedData) return;
            const allTableData = JSON.parse(savedData);
            const dynamicRowsData = allTableData.dynamicRows || [];
            const rows = Array.from(page2TableBody.children);
            if (dynamicRowsData.length > rows.length) {
                allTableData.dynamicRows = dynamicRowsData.slice(0, rows.length);
                localStorage.setItem(PAGE2_DATA_KEY, JSON.stringify(allTableData));
            }
        })();
        // Update row count display for Page 2
        const rowCountDisplay2 = document.getElementById('rowCountDisplay2');
        if (rowCountDisplay2) {
            rowCountDisplay2.textContent = `Rows: ${rowCount}`;
        }
        attachPage2InputListeners();
        autoCalculateRowAveragesPage2();
        calculateAndDisplayAggregatesPage2();
        formatPage2Inputs(); // Format after syncing
    }
    // --- END PAGE 2 ROW SYNC LOGIC ---

    function autoCalculateRowAveragesPage2() {
        const page2TableBody = document.getElementById('page2TableBody');
        if (!page2TableBody) return;
        const rows = Array.from(page2TableBody.children);
        rows.forEach(tr => {
            const tds = Array.from(tr.children);
            // For each group: (0-2, 3), (4-6, 7), (8-10, 11)
            [
                [0,1,2,3], // Elongation@ Break (%)
                [4,5,6,7], // Force-Tensile Strength@Break
                [8,9,10,11] // Force-Tensile Strength@Break 5%
            ].forEach(([i1,i2,i3,aveIdx], groupIdx) => {
                const inputs = [tds[i1+3], tds[i2+3], tds[i3+3]].map(td => td.querySelector('input'));
                const aveInput = tds[aveIdx+3].querySelector('input');
                if (aveInput) {
                    const vals = inputs.map(inp => parseFloat(inp && inp.value ? inp.value : ''));
                    const nums = vals.filter(v => !isNaN(v));
                    if (nums.length > 0) {
                        let avg = nums.reduce((a,b) => a+b, 0) / nums.length;
                        if (groupIdx === 0) {
                            // Elongation@ Break (%) - integer, 3 digits
                            aveInput.value = Math.round(avg).toString().padStart(3, '0');
                        } else if (groupIdx === 1) {
                            // Force-Tensile Strength@Break - up to 2 digits before, 1 after decimal
                            let val = avg.toFixed(1);
                            let parts = val.split('.');
                            val = parts[0].slice(0,2) + (parts[1] ? '.' + parts[1].slice(0,1) : '');
                            aveInput.value = val;
                        } else if (groupIdx === 2) {
                            // Force-Tensile Strength@Break 5% - 1 digit before, 1 after decimal
                            let val = avg.toFixed(1);
                            let parts = val.split('.');
                            val = parts[0].slice(0,1) + '.' + (parts[1] ? parts[1].slice(0,1) : '');
                            aveInput.value = val;
                        }
                    } else {
                        // No data: show 0 with correct formatting
                        if (groupIdx === 0) {
                            aveInput.value = '000';
                        } else {
                            aveInput.value = '0.0';
                        }
                    }
                }
            });
        });
    }

    // Restrict input for Page 2 columns
    function restrictPage2Inputs() {
        const page2TableBody = document.getElementById('page2TableBody');
        if (!page2TableBody) return;
        const rows = Array.from(page2TableBody.children);
        rows.forEach(tr => {
            const tds = Array.from(tr.children);
            // Make Sample No. columns (indices 0,1,2) readonly
            [0,1,2].forEach(idx => {
                const input = tds[idx]?.querySelector('input');
                if (input) {
                    input.readOnly = true;
                    input.style.background = '#f3f4f6'; // Optional: visually indicate readonly
                    input.style.cursor = 'not-allowed';
                }
            });
            // Elongation@ Break (%) columns 1,2,3 (indices 3,4,5) and Ave (6)
            [3,4,5,6].forEach(idx => {
                const input = tds[idx]?.querySelector('input');
                if (input) {
                    input.maxLength = 3;
                    input.addEventListener('input', function(e) {
                        let val = input.value.replace(/\D/g, '');
                        if (val.length > 3) val = val.slice(0, 3);
                        input.value = val;
                    });
                }
            });
            // Force-Tensile Strength@Break columns 1,2,3 (indices 7,8,9) and Ave (10): 2 digits before, 1 after decimal
            [7,8,9,10].forEach(idx => {
                const input = tds[idx]?.querySelector('input');
                if (input) {
                    input.addEventListener('input', function(e) {
                        let val = input.value.replace(/[^0-9.]/g, '');
                        const parts = val.split('.');
                        if (parts.length > 2) {
                            val = parts[0] + '.' + parts.slice(1).join('');
                        }
                        if (val.includes('.')) {
                            const [intPart, decPart] = val.split('.');
                            val = intPart.slice(0, 2) + '.' + (decPart ? '.' + decPart.slice(0, 1) : '');
                        } else {
                            val = val.slice(0, 2);
                        }
                        input.value = val;
                    });
                }
            });
            // Force-Tensile Strength@Break 5% columns 1,2,3 (indices 11,12,13) and Ave (14): 1 digit before, 1 after decimal
            [11,12,13,14].forEach(idx => {
                const input = tds[idx]?.querySelector('input');
                if (input) {
                    input.addEventListener('input', function(e) {
                        let val = input.value.replace(/[^0-9.]/g, '');
                        const parts = val.split('.');
                        if (parts.length > 2) {
                            val = parts[0] + '.' + parts.slice(1).join('');
                        }
                        if (val.includes('.')) {
                            const [intPart, decPart] = val.split('.');
                            val = intPart.slice(0, 1) + '.' + (decPart ? decPart.slice(0, 1) : '');
                        } else {
                            val = val.slice(0, 1);
                        }
                        input.value = val;
                    });
                }
            });
        });
    }

    // Patch attachPage2InputListeners to call restrictPage2Inputs after row creation
    function attachPage2InputListeners() {
        const page2TableBody = document.getElementById('page2TableBody');
        if (!page2TableBody) return;
        page2TableBody.querySelectorAll('input').forEach(input => {
            input.removeEventListener('input', calculateAndDisplayAggregatesPage2);
            input.addEventListener('input', function() {
                autoCalculateRowAveragesPage2();
                setTimeout(calculateAndDisplayAggregatesPage2, 0); // Ensure aggregates update after row averages
                saveTableDataPage2();
            });
            // Enable Enter key to move to the cell below
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    const td = input.closest('td');
                    const tr = input.closest('tr');
                    if (!td || !tr) return;
                    const cellIndex = Array.from(tr.children).indexOf(td);
                    const rows = Array.from(page2TableBody.children);
                    const rowIndex = rows.indexOf(tr);
                    if (rowIndex < rows.length - 1) {
                        const nextRow = rows[rowIndex + 1];
                        const nextTd = nextRow.children[cellIndex];
                        if (nextTd) {
                            const nextInput = nextTd.querySelector('input');
                            if (nextInput) {
                                nextInput.focus();
                                nextInput.select();
                                e.preventDefault();
                            }
                        }
                    }
                }
            });
        });
        restrictPage2Inputs(); // Enforce restrictions after listeners are attached
    }

    // Robustly find and update the aggregate rows for Page 2
    function calculateAndDisplayAggregatesPage2() {
        const page2TableBody = document.getElementById('page2TableBody');
        if (!page2TableBody) return;
        let table = page2TableBody.closest('table');
        if (!table) return;
        // Find the aggregate rows: they are the next 3 <tr>s after the tbody in the table
        let avgRow = null, minRow = null, maxRow = null;
        let foundTbody = false;
        let trCount = 0;
        for (let i = 0; i < table.rows.length; i++) {
            const row = table.rows[i];
            if (row === page2TableBody.lastElementChild?.parentElement) {
                foundTbody = true;
                trCount = 0;
                continue;
            }
            if (foundTbody) {
                if (trCount === 0) avgRow = row;
                else if (trCount === 1) minRow = row;
                else if (trCount === 2) maxRow = row;
                trCount++;
                if (trCount === 3) break;
            }
        }
        if (!avgRow || !minRow || !maxRow) {
            // Fallback: try to find by label
            for (let i = 0; i < table.rows.length; i++) {
                const row = table.rows[i];
                if (row.cells[0]?.textContent.includes('Average')) avgRow = row;
                if (row.cells[0]?.textContent.includes('Minimum')) minRow = row;
                if (row.cells[0]?.textContent.includes('Maximum')) maxRow = row;
            }
        }
        if (!avgRow || !minRow || !maxRow) return;
        // Gather values for each of the 12 data columns (skip first 3 Sample No. columns)
        const rows = Array.from(page2TableBody.children);
        const numColumnsToCalculate = 12;
        // Initialize arrays to hold values for each column
        const columnValues = Array.from({ length: numColumnsToCalculate }, () => []);
        rows.forEach(row => {
            const tds = Array.from(row.children);
            for (let i = 0; i < numColumnsToCalculate; i++) {
                // The data columns start at index 3 (after 3 Sample No. columns)
                const cell = tds[3 + i];
                if (cell) {
                    const input = cell.querySelector('input');
                    let value = input ? input.value : '';
                    // Only include if not a display zero (000 or 0.0)
                    if (value !== '' && value !== '000' && value !== '0.0') {
                        const num = parseFloat(value);
                        if (!isNaN(num)) {
                            columnValues[i].push(num);
                        }
                    }
                }
            }
        });
        // Find the first data cell index in the aggregate rows (should be 3, but let's find it robustly)
        let firstDataCellIdx = 0;
        for (let i = 0; i < avgRow.cells.length; i++) {
            if (avgRow.cells[i].colSpan === 1) {
                firstDataCellIdx = i;
                break;
            }
        }
        // Indices of 'Ave' columns in the data section (0-based relative to data columns)
        const aveIndices = [3, 7, 11];
        // Populate the aggregate rows
        for (let i = 0; i < numColumnsToCalculate; i++) {
            // Only fill 'Ave' columns, blank for others
            if (aveIndices.includes(i)) {
            const avg = columnValues[i].length > 0 ? columnValues[i].reduce((a, b) => a + b, 0) / columnValues[i].length : 0;
            const min = columnValues[i].length > 0 ? Math.min(...columnValues[i]) : 0;
            const max = columnValues[i].length > 0 ? Math.max(...columnValues[i]) : 0;
                let avgDisplay = '', minDisplay = '', maxDisplay = '';
                if (i === 3) { // Elongation@ Break (%) - integer, 3 digits
                    avgDisplay = columnValues[i].length > 0 ? Math.round(avg).toString().padStart(3, '0') : '000';
                    minDisplay = columnValues[i].length > 0 ? Math.round(min).toString().padStart(3, '0') : '000';
                    maxDisplay = columnValues[i].length > 0 ? Math.round(max).toString().padStart(3, '0') : '000';
                } else { // Force-Tensile Strength columns - 1 decimal
                    avgDisplay = columnValues[i].length > 0 ? avg.toFixed(1) : '0.0';
                    minDisplay = columnValues[i].length > 0 ? min.toFixed(1) : '0.0';
                    maxDisplay = columnValues[i].length > 0 ? max.toFixed(1) : '0.0';
                }
                if (avgRow.cells[firstDataCellIdx + i]) avgRow.cells[firstDataCellIdx + i].textContent = avgDisplay;
                if (minRow.cells[firstDataCellIdx + i]) minRow.cells[firstDataCellIdx + i].textContent = minDisplay;
                if (maxRow.cells[firstDataCellIdx + i]) maxRow.cells[firstDataCellIdx + i].textContent = maxDisplay;
            } else {
                if (avgRow.cells[firstDataCellIdx + i]) avgRow.cells[firstDataCellIdx + i].textContent = '';
                if (minRow.cells[firstDataCellIdx + i]) minRow.cells[firstDataCellIdx + i].textContent = '';
                if (maxRow.cells[firstDataCellIdx + i]) maxRow.cells[firstDataCellIdx + i].textContent = '';
            }
        }
    }

    // Also call once on page load
    syncPage2RowsWithPage1();

    // --- Add row logic as a reusable function ---
    function addDynamicRowToPage1() {
        const tableBody = document.querySelector('table tbody');
        if (tableBody) {
            let averageRow = null;
            for (let i = 0; i < tableBody.rows.length; i++) {
                if (tableBody.rows[i].cells[0] && tableBody.rows[i].cells[0].textContent.includes('Average')) {
                    averageRow = tableBody.rows[i];
                    break;
                }
            }
            if (averageRow) {
                const insertIndex = Array.from(tableBody.rows).indexOf(averageRow);
                const newRow = tableBody.insertRow(insertIndex);
                // Sample No. subgroup: 3 columns, each with its own input
                for (let j = 0; j < 3; j++) {
                    const td = document.createElement('td');
                    td.className = 'border border-gray-500 p-2 text-center';
                    td.colSpan = 1;
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.style.width = '110px';
                    input.style.height = '100%';
                    input.style.border = 'none';
                    input.style.background = 'none';
                    input.style.outline = 'none';
                    input.style.textAlign = 'center';
                    input.style.padding = '0 4px';
                    input.style.boxSizing = 'border-box';
                    input.className = '';
                    input.value = '';
                    input.addEventListener('input', saveTableData);
                    td.appendChild(input);
                    newRow.appendChild(td);
                }
                // The rest: GSM, Thickness, Opacity, COF Kinetic, New Column 1, New Column 2, New Column 3 (each spans 3 columns)
                for (let i = 1; i <= 7; i++) {
                    const td = document.createElement('td');
                    td.className = 'border border-gray-500 p-2 text-center';
                    td.colSpan = 3;
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.style.width = '100%';
                    input.style.height = '100%';
                    input.style.border = 'none';
                    input.style.background = 'none';
                    input.style.outline = 'none';
                    input.style.textAlign = 'center';
                    input.style.padding = '0 4px';
                    input.style.boxSizing = 'border-box';
                    input.className = '';
                    input.value = '';
                    if (decimalConfig[i] !== null) restrictAndFormatInput(input, decimalConfig[i]);
                    input.addEventListener('input', saveTableData);
                    td.appendChild(input);
                    newRow.appendChild(td);
                }
                saveTableData();
                calculateAndDisplayAggregates();
                updateRowCount();
                syncPage2RowsWithPage1();
                syncPage3RowsWithPage1();
            }
        }
    }

    // === PAGE 3 LOGIC (independent, mirrors Page 2) ===
    const PAGE3_DATA_KEY = 'filmInspectionTableDataPage3';

    // --- PAGE 3 ROW SYNC LOGIC ---
    function saveTableDataPage3() {
        const page3TableBody = document.getElementById('page3TableBody');
        if (page3TableBody) {
            const rows = Array.from(page3TableBody.children);
            const dynamicRowsData = [];
            rows.forEach(tr => {
                const rowData = [];
                const tds = Array.from(tr.children);
                tds.forEach((td, idx) => {
                    const input = td.querySelector('input');
                    rowData.push(input ? input.value : td.textContent);
                });
                dynamicRowsData.push(rowData);
            });
            localStorage.setItem(PAGE3_DATA_KEY, JSON.stringify({ dynamicRows: dynamicRowsData }));
        }
    }

    function formatPage3Inputs() {
        const page3TableBody = document.getElementById('page3TableBody');
        if (!page3TableBody) return;
        const rows = Array.from(page3TableBody.children);
        rows.forEach(tr => {
            const tds = Array.from(tr.children);
            // Elongation@ Break (%) columns 1,2,3 (indices 3,4,5) and Ave (6)
            [3,4,5,6].forEach(idx => {
                const input = tds[idx]?.querySelector('input');
                if (input && input.value) {
                    let val = input.value.replace(/\D/g, '');
                    if (val.length > 3) val = val.slice(0, 3);
                    input.value = val;
                }
            });
            // Force-Tensile Strength@Break columns 1,2,3 (indices 7,8,9) and Ave (10): 2 digits before, 1 after decimal
            [7,8,9,10].forEach(idx => {
                const input = tds[idx]?.querySelector('input');
                if (input && input.value) {
                    let val = input.value.replace(/[^0-9.]/g, '');
                    const parts = val.split('.');
                    if (parts.length > 2) {
                        val = parts[0] + '.' + parts.slice(1).join('');
                    }
                    if (val.includes('.')) {
                        const [intPart, decPart] = val.split('.');
                        val = intPart.slice(0, 2) + '.' + (decPart ? decPart.slice(0, 1) : '');
                    } else {
                        val = val.slice(0, 2);
                    }
                    input.value = val;
                }
            });
            // Modulus columns 1,2,3 and Ave (indices 11,12,13,14): 2 digits before, 1 after decimal
            [11,12,13,14].forEach(idx => {
                const input = tds[idx]?.querySelector('input');
                if (input && input.value) {
                    let val = input.value.replace(/[^0-9.]/g, '');
                    const parts = val.split('.');
                    if (parts.length > 2) {
                        val = parts[0] + '.' + parts.slice(1).join('');
                    }
                    if (val.includes('.')) {
                        const [intPart, decPart] = val.split('.');
                        val = intPart.slice(0, 2) + '.' + (decPart ? decPart.slice(0, 1) : '');
                    } else {
                        val = val.slice(0, 2);
                    }
                    input.value = val;
                }
            });
        });
    }

    function restoreTableDataPage3() {
        const savedData = localStorage.getItem(PAGE3_DATA_KEY);
        const page3TableBody = document.getElementById('page3TableBody');
        if (!page3TableBody || !savedData) return;
        const allTableData = JSON.parse(savedData);
        const dynamicRowsData = allTableData.dynamicRows || [];
        const rows = Array.from(page3TableBody.children);
        for (let r = 0; r < rows.length; r++) {
            const rowData = dynamicRowsData[r] || [];
            const tds = Array.from(rows[r].children);
            for (let c = 3; c < tds.length; c++) { // Only restore test columns, not Sample No.
                const input = tds[c].querySelector('input');
                if (input && rowData[c] !== undefined) {
                    input.value = rowData[c];
                }
            }
        }
        formatPage3Inputs(); // Format after restoring
    }

    function restrictPage3Inputs() {
        const page3TableBody = document.getElementById('page3TableBody');
        if (!page3TableBody) return;
        const rows = Array.from(page3TableBody.children);
        rows.forEach(tr => {
            const tds = Array.from(tr.children);
            // Make Sample No. columns (indices 0,1,2) readonly
            [0,1,2].forEach(idx => {
                const input = tds[idx]?.querySelector('input');
                if (input) {
                    input.readOnly = true;
                    input.style.background = '#f3f4f6';
                    input.style.cursor = 'not-allowed';
                }
            });
            // Elongation@ Break (%) columns 1,2,3 (indices 3,4,5) and Ave (6)
            [3,4,5,6].forEach(idx => {
                const input = tds[idx]?.querySelector('input');
                if (input) {
                    input.maxLength = 3;
                    input.addEventListener('input', function(e) {
                        let val = input.value.replace(/\D/g, '');
                        if (val.length > 3) val = val.slice(0, 3);
                        input.value = val;
                    });
                }
            });
            // Force-Tensile Strength@Break columns 1,2,3 (indices 7,8,9) and Ave (10): 2 digits before, 1 after decimal
            [7,8,9,10].forEach(idx => {
                const input = tds[idx]?.querySelector('input');
                if (input) {
                    input.addEventListener('input', function(e) {
                        let val = input.value.replace(/[^0-9.]/g, '');
                        const parts = val.split('.');
                        if (parts.length > 2) {
                            val = parts[0] + '.' + parts.slice(1).join('');
                        }
                        if (val.includes('.')) {
                            const [intPart, decPart] = val.split('.');
                            val = intPart.slice(0, 2) + '.' + (decPart ? decPart.slice(0, 1) : '');
                        } else {
                            val = val.slice(0, 2);
                        }
                        input.value = val;
                    });
                }
            });
            // Modulus columns 1,2,3 and Ave (indices 11,12,13,14): 2 digits before, 1 after decimal
            [11,12,13,14].forEach(idx => {
                const input = tds[idx]?.querySelector('input');
                if (input) {
                    input.addEventListener('input', function(e) {
                        let val = input.value.replace(/[^0-9.]/g, '');
                        const parts = val.split('.');
                        if (parts.length > 2) {
                            val = parts[0] + '.' + parts.slice(1).join('');
                        }
                        if (val.includes('.')) {
                            const [intPart, decPart] = val.split('.');
                            val = intPart.slice(0, 2) + '.' + (decPart ? decPart.slice(0, 1) : '');
                        } else {
                            val = val.slice(0, 2);
                        }
                        input.value = val;
                    });
                }
            });
        });
    }

    function attachPage3InputListeners() {
        const page3TableBody = document.getElementById('page3TableBody');
        if (!page3TableBody) return;
        page3TableBody.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', function() {
                autoCalculateRowAveragesPage3();
                setTimeout(calculateAndDisplayAggregatesPage3, 0);
                saveTableDataPage3();
            });
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    const td = input.closest('td');
                    const tr = input.closest('tr');
                    if (!td || !tr) return;
                    const cellIndex = Array.from(tr.children).indexOf(td);
                    const rows = Array.from(page3TableBody.children);
                    const rowIndex = rows.indexOf(tr);
                    if (rowIndex < rows.length - 1) {
                        const nextRow = rows[rowIndex + 1];
                        const nextTd = nextRow.children[cellIndex];
                        if (nextTd) {
                            const nextInput = nextTd.querySelector('input');
                            if (nextInput) {
                                nextInput.focus();
                                nextInput.select();
                                e.preventDefault();
                            }
                        }
                    }
                }
            });
        });
        restrictPage3Inputs();
    }

    function autoCalculateRowAveragesPage3() {
        const page3TableBody = document.getElementById('page3TableBody');
        if (!page3TableBody) return;
        const rows = Array.from(page3TableBody.children);
        rows.forEach(tr => {
            const tds = Array.from(tr.children);
            [
                [0,1,2,3],
                [4,5,6,7],
                [8,9,10,11]
            ].forEach(([i1,i2,i3,aveIdx], groupIdx) => {
                const inputs = [tds[i1+3], tds[i2+3], tds[i3+3]].map(td => td.querySelector('input'));
                const aveInput = tds[aveIdx+3].querySelector('input');
                if (aveInput) {
                    const vals = inputs.map(inp => parseFloat(inp && inp.value ? inp.value : ''));
                    const nums = vals.filter(v => !isNaN(v));
                    if (nums.length > 0) {
                        let avg = nums.reduce((a,b) => a+b, 0) / nums.length;
                        if (groupIdx === 0) {
                            aveInput.value = Math.round(avg).toString().padStart(3, '0');
                        } else if (groupIdx === 1) {
                            let val = avg.toFixed(1);
                            let parts = val.split('.');
                            val = parts[0].slice(0,2) + (parts[1] ? '.' + parts[1].slice(0,1) : '');
                            aveInput.value = val;
                        } else if (groupIdx === 2) {
                            // Modulus: up to 2 digits before decimal, 1 after
                            let val = avg.toFixed(1);
                            let parts = val.split('.');
                            val = parts[0].slice(0,2) + (parts[1] ? '.' + parts[1].slice(0,1) : '');
                            aveInput.value = val;
                        }
                    } else {
                        if (groupIdx === 0) {
                            aveInput.value = '000';
                        } else {
                            aveInput.value = '0.0';
                        }
                    }
                }
            });
        });
    }

    function calculateAndDisplayAggregatesPage3() {
        const page3TableBody = document.getElementById('page3TableBody');
        if (!page3TableBody) return;
        let table = page3TableBody.closest('table');
        if (!table) return;
        let avgRow = null, minRow = null, maxRow = null;
        let foundTbody = false;
        let trCount = 0;
        for (let i = 0; i < table.rows.length; i++) {
            const row = table.rows[i];
            if (row === page3TableBody.lastElementChild?.parentElement) {
                foundTbody = true;
                trCount = 0;
                continue;
            }
            if (foundTbody) {
                if (trCount === 0) avgRow = row;
                else if (trCount === 1) minRow = row;
                else if (trCount === 2) maxRow = row;
                trCount++;
                if (trCount === 3) break;
            }
        }
        if (!avgRow || !minRow || !maxRow) {
            for (let i = 0; i < table.rows.length; i++) {
                const row = table.rows[i];
                if (row.cells[0]?.textContent.includes('Average')) avgRow = row;
                if (row.cells[0]?.textContent.includes('Minimum')) minRow = row;
                if (row.cells[0]?.textContent.includes('Maximum')) maxRow = row;
            }
        }
        if (!avgRow || !minRow || !maxRow) return;
        const rows = Array.from(page3TableBody.children);
        const numColumnsToCalculate = 12;
        const columnValues = Array.from({ length: numColumnsToCalculate }, () => []);
        rows.forEach(row => {
            const tds = Array.from(row.children);
            for (let i = 0; i < numColumnsToCalculate; i++) {
                const cell = tds[3 + i];
                if (cell) {
                    const input = cell.querySelector('input');
                    let value = input ? input.value : '';
                    if (value !== '' && value !== '000' && value !== '0.0') {
                        const num = parseFloat(value);
                        if (!isNaN(num)) {
                            columnValues[i].push(num);
                        }
                    }
                }
            }
        });
        let firstDataCellIdx = 0;
        for (let i = 0; i < avgRow.cells.length; i++) {
            if (avgRow.cells[i].colSpan === 1) {
                firstDataCellIdx = i;
                break;
            }
        }
        const aveIndices = [3, 7, 11];
        for (let i = 0; i < numColumnsToCalculate; i++) {
            if (aveIndices.includes(i)) {
                const avg = columnValues[i].length > 0 ? columnValues[i].reduce((a, b) => a + b, 0) / columnValues[i].length : 0;
                const min = columnValues[i].length > 0 ? Math.min(...columnValues[i]) : 0;
                const max = columnValues[i].length > 0 ? Math.max(...columnValues[i]) : 0;
                let avgDisplay = '', minDisplay = '', maxDisplay = '';
                if (i === 3) {
                    avgDisplay = columnValues[i].length > 0 ? Math.round(avg).toString().padStart(3, '0') : '000';
                    minDisplay = columnValues[i].length > 0 ? Math.round(min).toString().padStart(3, '0') : '000';
                    maxDisplay = columnValues[i].length > 0 ? Math.round(max).toString().padStart(3, '0') : '000';
                } else {
                    avgDisplay = columnValues[i].length > 0 ? avg.toFixed(1) : '0.0';
                    minDisplay = columnValues[i].length > 0 ? min.toFixed(1) : '0.0';
                    maxDisplay = columnValues[i].length > 0 ? max.toFixed(1) : '0.0';
                }
                if (avgRow.cells[firstDataCellIdx + i]) avgRow.cells[firstDataCellIdx + i].textContent = avgDisplay;
                if (minRow.cells[firstDataCellIdx + i]) minRow.cells[firstDataCellIdx + i].textContent = minDisplay;
                if (maxRow.cells[firstDataCellIdx + i]) maxRow.cells[firstDataCellIdx + i].textContent = maxDisplay;
            } else {
                if (avgRow.cells[firstDataCellIdx + i]) avgRow.cells[firstDataCellIdx + i].textContent = '';
                if (minRow.cells[firstDataCellIdx + i]) minRow.cells[firstDataCellIdx + i].textContent = '';
                if (maxRow.cells[firstDataCellIdx + i]) maxRow.cells[firstDataCellIdx + i].textContent = '';
            }
        }
    }

    // --- PAGE 3 SYNC FROM PAGE 1 SAMPLE NO. ---
    function syncPage3RowsWithPage1() {
        const page1TableBody = document.querySelector('table tbody');
        const page3TableBody = document.getElementById('page3TableBody');
        if (!page1TableBody || !page3TableBody) return;
        let startIndex = -1;
        let endIndex = -1;
        const rows = Array.from(page1TableBody.rows);
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Sample No.')) {
                startIndex = i + 1;
            }
            if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Average')) {
                endIndex = i;
                break;
            }
        }
        let rowCount = 0;
        if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
            rowCount = endIndex - startIndex;
        }
        const sampleNoValues = [];
        for (let r = startIndex; r < endIndex; r++) {
            const tr = rows[r];
            const tds = Array.from(tr.cells);
            const values = [];
            for (let i = 0; i < 3; i++) {
                const input = tds[i]?.querySelector('input');
                values.push(input ? input.value : '');
            }
            sampleNoValues.push(values);
        }
        page3TableBody.innerHTML = '';
        for (let r = 0; r < rowCount; r++) {
            const tr = document.createElement('tr');
            for (let s = 0; s < 3; s++) {
                const tdSample = document.createElement('td');
                tdSample.className = 'border border-gray-500 p-2 text-center';
                const inputSample = document.createElement('input');
                inputSample.type = 'text';
                inputSample.style.width = '110px';
                inputSample.style.border = 'none';
                inputSample.style.outline = 'none';
                inputSample.style.textAlign = 'center';
                inputSample.style.padding = '0 2px';
                inputSample.style.boxSizing = 'border-box';
                inputSample.readOnly = true;
                inputSample.style.background = '#f3f4f6';
                inputSample.style.cursor = 'not-allowed';
                inputSample.value = sampleNoValues[r]?.[s] || '';
                tdSample.appendChild(inputSample);
                tr.appendChild(tdSample);
            }
            for (let i = 0; i < 12; i++) {
                const td = document.createElement('td');
                td.className = 'border border-gray-500 p-2 text-center';
                const input = document.createElement('input');
                input.type = 'text';
                input.style.width = '100%';
                input.style.border = 'none';
                input.style.outline = 'none';
                input.style.textAlign = 'center';
                input.style.padding = '0 2px';
                input.style.boxSizing = 'border-box';
                input.addEventListener('input', saveTableDataPage3);
                td.appendChild(input);
                tr.appendChild(td);
            }
            page3TableBody.appendChild(tr);
        }
        restoreTableDataPage3();
        // Trim localStorage data to match current row count
        (function trimPage3LocalStorage() {
            const savedData = localStorage.getItem(PAGE3_DATA_KEY);
            const page3TableBody = document.getElementById('page3TableBody');
            if (!page3TableBody || !savedData) return;
            const allTableData = JSON.parse(savedData);
            const dynamicRowsData = allTableData.dynamicRows || [];
            const rows = Array.from(page3TableBody.children);
            if (dynamicRowsData.length > rows.length) {
                allTableData.dynamicRows = dynamicRowsData.slice(0, rows.length);
                localStorage.setItem(PAGE3_DATA_KEY, JSON.stringify(allTableData));
            }
        })();
        const rowCountDisplay3 = document.getElementById('rowCountDisplay3');
        if (rowCountDisplay3) {
            rowCountDisplay3.textContent = `Rows: ${rowCount}`;
        }
        attachPage3InputListeners();
        autoCalculateRowAveragesPage3();
        calculateAndDisplayAggregatesPage3();
        formatPage3Inputs();
    }

    // --- INITIALIZE PAGE 3 ON LOAD ---
    syncPage3RowsWithPage1();

    // --- PAGE 1 ROWS CHANGES SHOULD ALSO SYNC PAGE 3 ---
    const observer3 = new MutationObserver(syncPage3RowsWithPage1);
    const page1TableBody3 = document.querySelector('table tbody');
    if (page1TableBody3) {
        observer3.observe(page1TableBody3, { childList: true, subtree: true });
    }

    // --- PAGE 1 ROWS CHANGES SHOULD ALSO SYNC PAGE 4 ---
    const observer4 = new MutationObserver(syncPage4RowsWithPage1);
    const page1TableBody4 = document.querySelector('table tbody');
    if (page1TableBody4) {
        observer4.observe(page1TableBody4, { childList: true, subtree: true });
    }

    // --- PAGE 4 DYNAMIC ROW SYNC (ONLY) ---
    function syncPage4RowsWithPage1() {
        const page1TableBody = document.querySelector('table tbody');
        const page4TableBody = document.getElementById('page4TableBody');
        if (!page1TableBody || !page4TableBody) return;
        let startIndex = -1;
        let endIndex = -1;
        const rows = Array.from(page1TableBody.rows);
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Sample No.')) {
                startIndex = i + 1;
            }
            if (rows[i].cells[0] && rows[i].cells[0].textContent.includes('Average')) {
                endIndex = i;
                break;
            }
        }
        let rowCount = 0;
        if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
            rowCount = endIndex - startIndex;
        }
        const sampleNoValues = [];
        for (let r = startIndex; r < endIndex; r++) {
            const tr = rows[r];
            const tds = Array.from(tr.cells);
            const values = [];
            for (let i = 0; i < 3; i++) {
                const input = tds[i]?.querySelector('input');
                values.push(input ? input.value : '');
            }
            sampleNoValues.push(values);
        }
        page4TableBody.innerHTML = '';
        for (let r = 0; r < rowCount; r++) {
            const tr = document.createElement('tr');
            // Sample No. cells (readonly, 3 columns)
            for (let s = 0; s < 3; s++) {
                const tdSample = document.createElement('td');
                tdSample.className = 'border border-gray-500 p-2 text-center';
                const inputSample = document.createElement('input');
                inputSample.type = 'text';
                inputSample.style.width = '110px';
                inputSample.style.border = 'none';
                inputSample.style.outline = 'none';
                inputSample.style.textAlign = 'center';
                inputSample.style.padding = '0 2px';
                inputSample.style.boxSizing = 'border-box';
                inputSample.readOnly = true;
                inputSample.style.background = '#f3f4f6';
                inputSample.style.cursor = 'not-allowed';
                inputSample.value = sampleNoValues[r]?.[s] || '';
                tdSample.appendChild(inputSample);
                tr.appendChild(tdSample);
            }
            // Gloss columns 1,2,3, Ave
            for (let i = 0; i < 4; i++) {
                const td = document.createElement('td');
                td.className = 'border border-gray-500 p-2 text-center';
                const input = document.createElement('input');
                input.type = 'text';
                input.style.width = '100%';
                input.style.border = 'none';
                input.style.outline = 'none';
                input.style.textAlign = 'center';
                input.style.padding = '0 2px';
                input.style.boxSizing = 'border-box';
                // If this is the Ave column (i === 3), set default to '0.0'
                if (i === 3) input.value = '0.0';
                td.appendChild(input);
                tr.appendChild(td);
            }
            // PG Quality System Requirements column (colspan=3, single input)
            const tdPG = document.createElement('td');
            tdPG.className = 'border border-gray-500 p-2 text-center';
            tdPG.colSpan = 3;
            const inputPG = document.createElement('input');
            inputPG.type = 'text';
            inputPG.style.width = '100%';
            inputPG.style.border = 'none';
            inputPG.style.outline = 'none';
            inputPG.style.textAlign = 'center';
            inputPG.style.padding = '0 2px';
            inputPG.style.boxSizing = 'border-box';
            tdPG.appendChild(inputPG);
            tr.appendChild(tdPG);
            page4TableBody.appendChild(tr);
        }
        const rowCountDisplay4 = document.getElementById('rowCountDisplay4');
        if (rowCountDisplay4) {
            rowCountDisplay4.textContent = `Rows: ${rowCount}`;
        }
        // After syncing, restore saved data into the new table structure
        restoreTableDataPage4();
        // Trim localStorage data to match current row count
        (function trimPage4LocalStorage() {
            const savedData = localStorage.getItem(PAGE4_DATA_KEY);
            const page4TableBody = document.getElementById('page4TableBody');
            if (!page4TableBody || !savedData) return;
            const dynamicRowsData = JSON.parse(savedData);
            const rows = Array.from(page4TableBody.rows);
            if (dynamicRowsData.length > rows.length) {
                const trimmed = dynamicRowsData.slice(0, rows.length);
                localStorage.setItem(PAGE4_DATA_KEY, JSON.stringify(trimmed));
            }
        })();
        // --- ADD THIS BLOCK: Attach listeners and recalc for new rows ---
        attachPage4InputListeners();
        restrictPage4Inputs();
        autoCalculateRowAveragesPage4();
        calculateAndDisplayAggregatesPage4();
    }
    // --- INITIALIZE PAGE 4 DYNAMIC ROWS ON LOAD ---
    syncPage4RowsWithPage1();

    // --- PAGE 4 DATA PERSISTENCE, VALIDATION, AUTO-CALCULATION, AGGREGATES ---
    function saveTableDataPage4() {
        const page4TableBody = document.getElementById('page4TableBody');
        if (!page4TableBody) return;
        const rows = Array.from(page4TableBody.rows);
        const dynamicRowsData = [];
        for (const row of rows) {
            const rowData = [];
            const cells = Array.from(row.cells);
            for (const cell of cells) {
                const input = cell.querySelector('input');
                rowData.push(input ? input.value : cell.textContent);
            }
            dynamicRowsData.push(rowData);
        }
        localStorage.setItem(PAGE4_DATA_KEY, JSON.stringify(dynamicRowsData));
        calculateAndDisplayAggregatesPage4();
    }

    function restoreTableDataPage4() {
        const savedData = localStorage.getItem(PAGE4_DATA_KEY);
        if (!savedData) return;
        const dynamicRowsData = JSON.parse(savedData);
        const page4TableBody = document.getElementById('page4TableBody');
        if (!page4TableBody) return;
        const rows = Array.from(page4TableBody.rows);
        for (let r = 0; r < Math.min(rows.length, dynamicRowsData.length); r++) {
            const rowData = dynamicRowsData[r];
            const cells = Array.from(rows[r].children);
            for (let c = 0; c < Math.min(cells.length, rowData.length); c++) {
                const input = cells[c].querySelector('input');
                if (input) {
                    input.value = rowData[c] !== '' ? rowData[c] : (c === 6 ? '0.0' : '');
                }
            }
        }
        calculateAndDisplayAggregatesPage4();
    }

    function restrictPage4Inputs() {
        const page4TableBody = document.getElementById('page4TableBody');
        if (!page4TableBody) return;
        const rows = Array.from(page4TableBody.rows);
        for (const row of rows) {
            const cells = Array.from(row.children);
            // Gloss columns (1,2,3,Ave): only 2 digits before decimal, 1 after
            for (let i = 3; i <= 6; i++) {
                const input = cells[i]?.querySelector('input');
                if (input) {
                    input.addEventListener('input', function() {
                        let value = input.value.replace(/[^0-9.]/g, '');
                        const parts = value.split('.');
                        if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('');
                        if (value.includes('.')) {
                            const [intPart, decPart] = value.split('.');
                            value = intPart.slice(0, 2) + '.' + (decPart ? decPart.slice(0, 1) : '');
                        } else {
                            value = value.slice(0, 2);
                        }
                        input.value = value;
                    });
                    input.addEventListener('blur', function() {
                        if (input.value !== '' && !isNaN(input.value)) input.value = parseFloat(input.value).toFixed(1);
                    });
                    // Enter key navigation
                    input.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter') {
                            const td = input.closest('td');
                            const tr = input.closest('tr');
                            if (!td || !tr) return;
                            const cellIndex = Array.from(tr.parentElement.children).indexOf(tr);
                            const colIndex = i;
                            const rows = Array.from(page4TableBody.rows);
                            const rowIndex = rows.indexOf(tr);
                            if (rowIndex < rows.length - 1) {
                                const nextRow = rows[rowIndex + 1];
                                const nextTd = nextRow.cells[colIndex];
                                if (nextTd) {
                                    const nextInput = nextTd.querySelector('input');
                                    if (nextInput) {
                                        nextInput.focus();
                                        nextInput.select();
                                        e.preventDefault();
                                    }
                                }
                            }
                        }
                    });
                }
            }
            // PG Quality System columns: only 0 or 1
            for (let i = 7; i < 10; i++) {
                const input = cells[i]?.querySelector('input');
                if (input) {
                    input.addEventListener('input', function() {
                        input.value = input.value.replace(/[^01]/g, '');
                        if (input.value.length > 1) input.value = input.value[0];
                    });
                    // Enter key navigation
                    input.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter') {
                            const tr = input.closest('tr');
                            if (!tr) return;
                            const rows = Array.from(page4TableBody.rows);
                            const rowIndex = rows.indexOf(tr);
                            if (rowIndex < rows.length - 1) {
                                const nextRow = rows[rowIndex + 1];
                                const nextInput = nextRow.cells[i]?.querySelector('input');
                                if (nextInput) {
                                    nextInput.focus();
                                    nextInput.select();
                                    e.preventDefault();
                                }
                            }
                        }
                    });
                }
            }
        }
    }

    function autoCalculateRowAveragesPage4() {
        const page4TableBody = document.getElementById('page4TableBody');
        if (!page4TableBody) return;
        const rows = Array.from(page4TableBody.rows);
        for (const row of rows) {
            const cells = Array.from(row.children);
            // Gloss columns 1,2,3 (inputs at 3,4,5)
            let sum = 0, count = 0;
            for (let i = 3; i < 6; i++) {
                const input = cells[i]?.querySelector('input');
                if (input && input.value !== '' && !isNaN(input.value)) {
                    sum += parseFloat(input.value);
                    count++;
                }
            }
            const aveInput = cells[6]?.querySelector('input');
            if (aveInput) {
                aveInput.readOnly = true;
                aveInput.style.cursor = 'not-allowed';
                aveInput.value = count > 0 ? (sum / count).toFixed(1) : '0';
            }
        }
    }

    function calculateAndDisplayAggregatesPage4() {
        const page4TableBody = document.getElementById('page4TableBody');
        if (!page4TableBody) return;
        const rows = Array.from(page4TableBody.rows);
        // Find the table and header row
        const page4Table = page4TableBody.closest('table');
        if (!page4Table) return;
        // Find the header row with 'Ave'
        let aveHeaderIdx = -1;
        const headerRows = page4Table.querySelectorAll('tr');
        for (let i = 0; i < headerRows.length; i++) {
            const cells = Array.from(headerRows[i].cells);
            for (let j = 0; j < cells.length; j++) {
                if (cells[j].textContent.trim() === 'Ave') {
                    aveHeaderIdx = j;
                    break;
                }
            }
            if (aveHeaderIdx !== -1) break;
        }
        if (aveHeaderIdx === -1) return;
        // Collect Ave values from data rows
        const aveValues = [];
        for (const row of rows) {
            const aveInput = row.cells[aveHeaderIdx]?.querySelector('input');
            if (aveInput && aveInput.value !== '' && !isNaN(aveInput.value)) {
                const val = parseFloat(aveInput.value);
                if (val !== 0) {
                    aveValues.push(val);
                }
            }
        }
        // Find the aggregate rows by label
        let avgRow = null, minRow = null, maxRow = null;
        for (let i = 0; i < page4Table.rows.length; i++) {
            const row = page4Table.rows[i];
            if (row.cells[0]?.textContent.includes('Average')) avgRow = row;
            if (row.cells[0]?.textContent.includes('Minimum')) minRow = row;
            if (row.cells[0]?.textContent.includes('Maximum')) maxRow = row;
        }
        // Find the Ave cell in the aggregate rows by matching the header
        function setAgg(row, value) {
            if (!row) return;
            let cellIdx = -1;
            let colCount = 0;
            for (let i = 0; i < row.cells.length; i++) {
                // Skip colspan
                const colspan = parseInt(row.cells[i].getAttribute('colspan') || '1', 10);
                if (colCount === aveHeaderIdx) {
                    cellIdx = i;
                    break;
                }
                colCount += colspan;
            }
            if (cellIdx !== -1) row.cells[cellIdx].textContent = value;
        }
        setAgg(avgRow, aveValues.length ? (aveValues.reduce((a,b)=>a+b,0)/aveValues.length).toFixed(1) : '0.0');
        setAgg(minRow, aveValues.length ? Math.min(...aveValues).toFixed(1) : '0.0');
        setAgg(maxRow, aveValues.length ? Math.max(...aveValues).toFixed(1) : '0.0');
    }

    function attachPage4InputListeners() {
        const page4TableBody = document.getElementById('page4TableBody');
        if (!page4TableBody) return;
        const rows = Array.from(page4TableBody.rows);
        for (const row of rows) {
            const cells = Array.from(row.children);
            // Gloss columns (1,2,3)
            for (let i = 3; i < 6; i++) {
                const input = cells[i]?.querySelector('input');
                if (input) {
                    input.addEventListener('input', function() {
                        autoCalculateRowAveragesPage4();
                        saveTableDataPage4();
                    });
                    input.addEventListener('blur', function() {
                        autoCalculateRowAveragesPage4();
                        saveTableDataPage4();
                    });
                }
            }
            // PG Quality System columns
            for (let i = 7; i < 10; i++) {
                const input = cells[i]?.querySelector('input');
                if (input) {
                    input.addEventListener('input', saveTableDataPage4);
                }
            }
        }
    }

    // --- INITIALIZE PAGE 4 ON LOAD ---
    syncPage4RowsWithPage1();
    restoreTableDataPage4();
    attachPage4InputListeners();
    restrictPage4Inputs();
    autoCalculateRowAveragesPage4();
    calculateAndDisplayAggregatesPage4();

});