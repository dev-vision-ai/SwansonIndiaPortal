// In-Line Inspection Form Table Generator
class InspectionFormGenerator {
    constructor() {
        this.tableContainer = null;
        this.table = null;
        this.tbody = null;
    }

    // Initialize the form generator
    init(containerId = 'main-form-container') {
        this.tableContainer = document.getElementById(containerId);
        if (!this.tableContainer) {
            console.error('Container not found:', containerId);
            return;
        }
        this.generateTable();
    }

    // Generate the complete table structure
    generateTable() {
        // Create table element
        this.table = document.createElement('table');
        this.table.className = 'inspection-table';

        // Add colgroup for column widths
        const colgroup = document.createElement('colgroup');
        // There are 32 columns; set widths for Accept (30), Reject (31), Inspected By (32)
        for (let i = 0; i < 32; i++) {
            const col = document.createElement('col');
            if (i === 29) col.style.width = '60px'; // Accept
            else if (i === 30) col.style.width = '60px'; // Reject
            else if (i === 31) col.style.width = '200px'; // Inspected By
            colgroup.appendChild(col);
        }
        this.table.appendChild(colgroup);

        // Create tbody
        this.tbody = document.createElement('tbody');
        this.table.appendChild(this.tbody);

        // Generate all rows
        this.generateEmptyRow();
        this.generateHeaderRows();
        this.generateEmbossRow();
        this.generateColumnHeaders();
        this.generateInspectionHeaders();

        // Append table to container
        this.tableContainer.appendChild(this.table);
    }

    // Generate empty row with no-border cells
    generateEmptyRow() {
        const row = document.createElement('tr');

        // Create 32 empty cells with no-border styling
        for (let i = 0; i < 32; i++) {
            const cell = document.createElement('td');
            cell.className = 'no-border-col-n no-border';
            if (i >= 30) {
                cell.style.width = '130px';
            }
            row.appendChild(cell);
        }

        this.tbody.appendChild(row);
    }

    // Generate header information rows
    generateHeaderRows() {
        // Customer row
        this.generateHeaderRow('Customer : ', '', 'Printed :', true, 'Year', 'Month', 'Date', 'Machine', 'Shift', 'Date :');

        // Production No row
        this.generateHeaderRow('Production No :', '', 'Non-Printed :', true, '', '', '', '', '', 'Shift :');

        // Prod. Code row
        this.generateHeaderRow('Prod. Code :', '', 'CT :', true, '', '', '', '', '', 'Machine :');

        // Spec. row
        this.generateSpecRow();
    }

    // Generate individual header row
    generateHeaderRow(label1, value1, label2, hasCheckbox, year, month, date, machine, shift, dateLabel) {
        const row = document.createElement('tr');

        // First label
        const cell1 = document.createElement('td');
        cell1.colSpan = 3;
        cell1.textContent = label1;
        row.appendChild(cell1);

        // Value cell
        const cell2 = document.createElement('td');
        cell2.colSpan = 5;
        cell2.textContent = value1;
        row.appendChild(cell2);

        // Empty cell
        const emptyCell = document.createElement('td');
        emptyCell.className = 'no-border-col-i';
        row.appendChild(emptyCell);

        // Second label
        const cell3 = document.createElement('td');
        cell3.colSpan = 3;
        cell3.textContent = label2;
        row.appendChild(cell3);

        // Checkbox
        const checkboxCell = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkboxCell.appendChild(checkbox);
        row.appendChild(checkboxCell);

        // Empty cell
        const emptyCell2 = document.createElement('td');
        emptyCell2.className = 'no-border-col-n no-border';
        row.appendChild(emptyCell2);

        // Year
        const yearCell = document.createElement('td');
        yearCell.colSpan = 2;
        yearCell.textContent = year;
        row.appendChild(yearCell);

        // Month
        const monthCell = document.createElement('td');
        monthCell.colSpan = 2;
        monthCell.textContent = month;
        row.appendChild(monthCell);

        // Date
        const dateCell = document.createElement('td');
        dateCell.colSpan = 2;
        dateCell.textContent = date;
        row.appendChild(dateCell);

        // Machine
        const machineCell = document.createElement('td');
        machineCell.colSpan = 2;
        machineCell.textContent = machine;
        row.appendChild(machineCell);

        // Shift
        const shiftCell = document.createElement('td');
        shiftCell.colSpan = 2;
        shiftCell.textContent = shift;
        row.appendChild(shiftCell);

        // Empty cells
        for (let i = 0; i < 4; i++) {
            const emptyCell3 = document.createElement('td');
            emptyCell3.className = 'no-border-col-n no-border';
            row.appendChild(emptyCell3);
        }

        // Date/Shift label
        const labelCell = document.createElement('td');
        labelCell.colSpan = 2;
        labelCell.textContent = dateLabel;
        row.appendChild(labelCell);

        // Empty cells at end
        const endCell = document.createElement('td');
        endCell.colSpan = 3;
        row.appendChild(endCell);

        this.tbody.appendChild(row);
    }

    // Generate Spec row
    generateSpecRow() {
        const row = document.createElement('tr');

        const labelCell = document.createElement('td');
        labelCell.colSpan = 3;
        labelCell.textContent = 'Spec. :';
        row.appendChild(labelCell);

        const valueCell = document.createElement('td');
        valueCell.colSpan = 5;
        row.appendChild(valueCell);

        this.tbody.appendChild(row);

        // Add empty row for gap
        const gapRow = document.createElement('tr');
        gapRow.className = 'no-border-row';
        // Add enough empty cells to span the table
        for (let i = 0; i < 32; i++) {
            const cell = document.createElement('td');
            cell.className = 'no-border';
            gapRow.appendChild(cell);
        }
        this.tbody.appendChild(gapRow);
    }

    // Generate Emboss row
    generateEmbossRow() {
        const row = document.createElement('tr');

        // Emboss label
        const embossCell = document.createElement('td');
        embossCell.colSpan = 4;
        embossCell.textContent = 'Emboss : ';
        row.appendChild(embossCell);

        // Random checkbox
        const randomCell = document.createElement('td');
        randomCell.colSpan = 3;
        randomCell.innerHTML = 'Random <input type="checkbox">';
        row.appendChild(randomCell);

        // Matte checkbox
        const matteCell = document.createElement('td');
        matteCell.colSpan = 3;
        matteCell.innerHTML = 'Matte <input type="checkbox">';
        row.appendChild(matteCell);

        // Micro checkbox
        const microCell = document.createElement('td');
        microCell.colSpan = 3;
        microCell.innerHTML = 'Micro <input type="checkbox">';
        row.appendChild(microCell);

        // Inspection Item
        const inspectionCell = document.createElement('td');
        inspectionCell.colSpan = 16;
        inspectionCell.textContent = 'Inspection Item';
        row.appendChild(inspectionCell);

        // Others (vertical)
        const othersCell = document.createElement('td');
        othersCell.rowSpan = 3;
        const othersDiv = document.createElement('div');
        othersDiv.className = 'vertical-center';
        othersDiv.textContent = 'Others';
        othersCell.appendChild(othersDiv);
        row.appendChild(othersCell);

        // Accept circle
        const acceptCell = document.createElement('td');
        acceptCell.textContent = 'o';
        acceptCell.style.width = '60px'; // Reduced width
        row.appendChild(acceptCell);

        // Accept label
        const acceptLabelCell = document.createElement('td');
        acceptLabelCell.style.width = '60px'; // Reduced width
        acceptLabelCell.textContent = 'Accept';
        row.appendChild(acceptLabelCell);

        // Inspected By
        const inspectedByCell = document.createElement('td');
        inspectedByCell.rowSpan = 3;
        inspectedByCell.style.width = '200px'; // Increased width
        inspectedByCell.textContent = 'Inspected By';
        row.appendChild(inspectedByCell);

        this.tbody.appendChild(row);
    }

    // Generate column headers
    generateColumnHeaders() {
        const row = document.createElement('tr');

        // Time
        const timeCell = document.createElement('td');
        timeCell.colSpan = 2;
        timeCell.textContent = 'Time';
        row.appendChild(timeCell);

        // Column headers with rowspan
        const columnHeaders = [
            'Lot No.', 'Roll Position', 'Arm', 'Roll Weight', 'Roll Width (mm)',
            'Film Weight (GSM)', 'Lot No.', 'Thickness', 'Roll θ',
            'Paper Core θ (ID)', 'Paper Core θ (OD)'
        ];

        columnHeaders.forEach(header => {
            const cell = document.createElement('td');
            cell.rowSpan = 2;
            const div = document.createElement('div');
            div.className = 'vertical-center';
            div.textContent = header;
            cell.appendChild(div);
            row.appendChild(cell);
        });

        // Film Appearance
        const filmAppearanceCell = document.createElement('td');
        filmAppearanceCell.colSpan = 7;
        filmAppearanceCell.textContent = 'Film Appearance';
        row.appendChild(filmAppearanceCell);

        // Printing
        const printingCell = document.createElement('td');
        printingCell.colSpan = 5;
        printingCell.textContent = 'Printing';
        row.appendChild(printingCell);

        // Roll Appearance
        const rollAppearanceCell = document.createElement('td');
        rollAppearanceCell.colSpan = 4;
        rollAppearanceCell.textContent = 'Roll Appearance';
        row.appendChild(rollAppearanceCell);

        // Reject x
        const rejectCell = document.createElement('td');
        rejectCell.textContent = 'x';
        rejectCell.style.width = '60px'; // Reduced width
        row.appendChild(rejectCell);

        // Reject label
        const rejectLabelCell = document.createElement('td');
        rejectLabelCell.style.width = '60px'; // Reduced width
        rejectLabelCell.textContent = 'Reject';
        row.appendChild(rejectLabelCell);

        this.tbody.appendChild(row);
    }

    // Generate inspection headers
    generateInspectionHeaders() {
        const row = document.createElement('tr');
        row.style.height = '200px';

        // Time headers
        const hourCell = document.createElement('td');
        hourCell.style.transform = 'rotate(-90deg)';
        hourCell.style.whiteSpace = 'nowrap';
        hourCell.style.verticalAlign = 'middle';
        hourCell.textContent = 'Hour';
        row.appendChild(hourCell);

        const minutesCell = document.createElement('td');
        minutesCell.style.transform = 'rotate(-90deg)';
        minutesCell.style.whiteSpace = 'nowrap';
        minutesCell.style.verticalAlign = 'middle';
        minutesCell.textContent = 'Minutes';
        row.appendChild(minutesCell);

        // Film Appearance items
        const filmItems = [
            'Lines / Strips', 'Glossy', 'Film Color', 'Pin Hole',
            'Patch Mark', 'Odour', 'CT'
        ];

        filmItems.forEach(item => {
            const cell = document.createElement('td');
            const div = document.createElement('div');
            div.className = 'vertical-center';
            div.textContent = item;
            cell.appendChild(div);
            row.appendChild(cell);
        });

        // Printing items
        const printingItems = [
            'Print Color', 'Mis Print', 'Dirty Print', 'Tape Test', 'Centralization'
        ];

        printingItems.forEach(item => {
            const cell = document.createElement('td');
            const div = document.createElement('div');
            div.className = 'vertical-center';
            div.textContent = item;
            cell.appendChild(div);
            row.appendChild(cell);
        });

        // Roll Appearance items
        const rollItems = [
            'Wrinkles', 'PRS', 'Roll Curve', 'Core Misalignment'
        ];

        rollItems.forEach(item => {
            const cell = document.createElement('td');
            const div = document.createElement('div');
            div.className = 'vertical-center';
            div.textContent = item;
            cell.appendChild(div);
            row.appendChild(cell);
        });

        // Accept/Reject
        const acceptRejectCell = document.createElement('td');
        acceptRejectCell.style.width = '60px'; // Reduced width
        const acceptRejectDiv = document.createElement('div');
        acceptRejectDiv.className = 'vertical-center';
        acceptRejectDiv.textContent = 'Accept / Reject';
        acceptRejectCell.appendChild(acceptRejectDiv);
        row.appendChild(acceptRejectCell);

        // Defect Name
        const defectCell = document.createElement('td');
        defectCell.style.width = '130px';
        defectCell.textContent = 'Defect Name';
        row.appendChild(defectCell);

        this.tbody.appendChild(row);
    }

    // Add data rows (for actual inspection data)
    addDataRow(data = {}) {
        const row = document.createElement('tr');

        // Time
        const hourCell = document.createElement('td');
        hourCell.textContent = data.hour || '';
        row.appendChild(hourCell);

        const minutesCell = document.createElement('td');
        minutesCell.textContent = data.minutes || '';
        row.appendChild(minutesCell);

        // Basic measurements
        const measurements = [
            data.lotNo, data.rollPosition, data.arm, data.rollWeight,
            data.rollWidth, data.filmWeight, data.lotNo2, data.thickness,
            data.rollTheta, data.paperCoreId, data.paperCoreOd
        ];

        measurements.forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = value || '';
            row.appendChild(cell);
        });

        // Film Appearance checkboxes
        const filmChecks = [
            data.linesStrips, data.glossy, data.filmColor, data.pinHole,
            data.patchMark, data.odour, data.ct
        ];

        filmChecks.forEach(checked => {
            const cell = document.createElement('td');
            const filmCheckbox = document.createElement('input');
            filmCheckbox.type = 'checkbox';
            filmCheckbox.checked = checked || false;
            cell.appendChild(filmCheckbox);
            row.appendChild(cell);
        });

        // Printing checkboxes
        const printingChecks = [
            data.printColor, data.misPrint, data.dirtyPrint, data.tapeTest, data.centralization
        ];

        printingChecks.forEach(checked => {
            const cell = document.createElement('td');
            const printCheckbox = document.createElement('input');
            printCheckbox.type = 'checkbox';
            printCheckbox.checked = checked || false;
            cell.appendChild(printCheckbox);
            row.appendChild(cell);
        });

        // Roll Appearance checkboxes
        const rollChecks = [
            data.wrinkles, data.prs, data.rollCurve, data.coreMisalignment
        ];

        rollChecks.forEach(checked => {
            const cell = document.createElement('td');
            const rollCheckbox = document.createElement('input');
            rollCheckbox.type = 'checkbox';
            rollCheckbox.checked = checked || false;
            cell.appendChild(rollCheckbox);
            row.appendChild(cell);
        });

        // Accept/Reject
        const acceptRejectCell = document.createElement('td');
        const acceptRejectSelect = document.createElement('select');
        const acceptOption = document.createElement('option');
        acceptOption.value = 'accept';
        acceptOption.textContent = 'Accept';
        const rejectOption = document.createElement('option');
        rejectOption.value = 'reject';
        rejectOption.textContent = 'Reject';
        acceptRejectSelect.appendChild(acceptOption);
        acceptRejectSelect.appendChild(rejectOption);
        acceptRejectSelect.value = data.acceptReject || 'accept';
        acceptRejectCell.appendChild(acceptRejectSelect);
        row.appendChild(acceptRejectCell);

        // Defect Name
        const defectCell = document.createElement('td');
        defectCell.textContent = data.defectName || '';
        row.appendChild(defectCell);

        this.tbody.appendChild(row);
        return row;
    }

    // Clear all data rows
    clearDataRows() {
        const rows = this.tbody.querySelectorAll('tr');
        // Remove all rows except the first 8 (header rows)
        for (let i = 8; i < rows.length; i++) {
            rows[i].remove();
        }
    }

    // Save form data
    saveFormData() {
        const formData = {
            customer: this.getInputValue('customer'),
            productionNo: this.getInputValue('productionNo'),
            prodCode: this.getInputValue('prodCode'),
            spec: this.getInputValue('spec'),
            emboss: {
                random: this.getCheckboxValue('emboss-random'),
                matte: this.getCheckboxValue('emboss-matte'),
                micro: this.getCheckboxValue('emboss-micro')
            },
            printed: this.getCheckboxValue('printed'),
            nonPrinted: this.getCheckboxValue('nonPrinted'),
            ct: this.getCheckboxValue('ct'),
            date: this.getInputValue('date'),
            shift: this.getInputValue('shift'),
            machine: this.getInputValue('machine'),
            inspectionData: this.getInspectionData()
        };

        return formData;
    }

    // Helper methods for getting form values
    getInputValue(selector) {
        const element = document.querySelector(`[data-field="${selector}"]`);
        return element ? element.value : '';
    }

    getCheckboxValue(selector) {
        const element = document.querySelector(`[data-field="${selector}"]`);
        return element ? element.checked : false;
    }

    getInspectionData() {
        const dataRows = this.tbody.querySelectorAll('tr:not(:nth-child(-n+8))');
        const inspectionData = [];

        dataRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 0) {
                const rowData = {
                    hour: cells[0]?.textContent || '',
                    minutes: cells[1]?.textContent || '',
                    lotNo: cells[2]?.textContent || '',
                    rollPosition: cells[3]?.textContent || '',
                    arm: cells[4]?.textContent || '',
                    rollWeight: cells[5]?.textContent || '',
                    rollWidth: cells[6]?.textContent || '',
                    filmWeight: cells[7]?.textContent || '',
                    lotNo2: cells[8]?.textContent || '',
                    thickness: cells[9]?.textContent || '',
                    rollTheta: cells[10]?.textContent || '',
                    paperCoreId: cells[11]?.textContent || '',
                    paperCoreOd: cells[12]?.textContent || '',
                    // Film appearance checkboxes
                    linesStrips: cells[13]?.querySelector('input')?.checked || false,
                    glossy: cells[14]?.querySelector('input')?.checked || false,
                    filmColor: cells[15]?.querySelector('input')?.checked || false,
                    pinHole: cells[16]?.querySelector('input')?.checked || false,
                    patchMark: cells[17]?.querySelector('input')?.checked || false,
                    odour: cells[18]?.querySelector('input')?.checked || false,
                    ct: cells[19]?.querySelector('input')?.checked || false,
                    // Printing checkboxes
                    printColor: cells[20]?.querySelector('input')?.checked || false,
                    misPrint: cells[21]?.querySelector('input')?.checked || false,
                    dirtyPrint: cells[22]?.querySelector('input')?.checked || false,
                    tapeTest: cells[23]?.querySelector('input')?.checked || false,
                    centralization: cells[24]?.querySelector('input')?.checked || false,
                    // Roll appearance checkboxes
                    wrinkles: cells[25]?.querySelector('input')?.checked || false,
                    prs: cells[26]?.querySelector('input')?.checked || false,
                    rollCurve: cells[27]?.querySelector('input')?.checked || false,
                    coreMisalignment: cells[28]?.querySelector('input')?.checked || false,
                    // Accept/Reject
                    acceptReject: cells[29]?.querySelector('select')?.value || 'accept',
                    defectName: cells[30]?.textContent || ''
                };
                inspectionData.push(rowData);
            }
        });

        return inspectionData;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const formGenerator = new InspectionFormGenerator();
    formGenerator.init();

    // Make it globally available
    window.inspectionFormGenerator = formGenerator;
    // Removed sample data rows
}); 