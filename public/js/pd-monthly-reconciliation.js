import { supabase } from '../supabase-config.js';
import { showToast, storePendingToast } from './toast.js';

let isProcessing = false;

document.addEventListener('DOMContentLoaded', () => {
    // Set default to current date for both from and to dates
    const fromDateInput = document.getElementById('fromDate');
    const toDateInput = document.getElementById('toDate');
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    fromDateInput.value = currentDate;
    toDateInput.value = currentDate;

    // Initialize table headers
    updateTableHeaders();

    // Load initial data
    generateReport();

    // Event Listeners
    document.getElementById('generateBtn').addEventListener('click', generateReport);
    document.getElementById('materialCategory').addEventListener('change', updateTableHeaders);
    document.getElementById('printBtn').addEventListener('click', () => window.print());
});

async function generateReport() {
    if (isProcessing) return;

    const fromDateVal = document.getElementById('fromDate').value;
    const toDateVal = document.getElementById('toDate').value;
    const categoryVal = document.getElementById('materialCategory').value;
    const generateBtn = document.getElementById('generateBtn');

    if (!fromDateVal || !toDateVal) return showToast('Please select both from and to dates.', 'warning');

    // Validate date range
    if (fromDateVal > toDateVal) {
        return showToast('From date cannot be later than to date.', 'warning');
    }

    const tbody = document.getElementById('reportBody');
    const tfoot = document.getElementById('reportFooter');

    try {
        isProcessing = true;
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.textContent = 'Generating...';
        }

        // Show loading state
        tbody.innerHTML = `<tr><td colspan="10" class="py-8 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Loading Report...</td></tr>`;
        tfoot.classList.add('hidden');

        // Use the selected dates directly
        const startDate = fromDateVal;
        const endDate = toDateVal;

        // Call the SQL Function with category filter
        const { data, error } = await supabase.rpc('get_material_reconciliation_report', {
            p_start_date: startDate,
            p_end_date: endDate,
            p_category: categoryVal
        });

        if (error) throw error;

        renderTable(data, categoryVal);

        // Fetch and render scrap, rolls, and reject data separately
        await fetchAndRenderScrapSummary(startDate, endDate);
        await fetchAndRenderRollsSummary(startDate, endDate);
        await fetchAndRenderRejectSummaries(startDate, endDate);

    } catch (err) {
        console.error('Report Error:', err);
        showToast('Error loading report: ' + err.message, 'error');
        tbody.innerHTML = `<tr><td colspan="10" class="py-4 text-center text-red-500">Error loading report: ${err.message}</td></tr>`;
    } finally {
        isProcessing = false;
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate Report';
        }
    }
}

function renderTable(data, category) {
    const tbody = document.getElementById('reportBody');
    const tfoot = document.getElementById('reportFooter');

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="py-8 text-center text-gray-500">No data found.</td></tr>`;
        return;
    }

    // Filter zeroes and ensure numeric values
    const filteredData = data.filter(row => {
        const totAvail = Number(row.total_available) || 0;
        const issue = Number(row.issue_qty) || 0;
        const mc1 = Number(row.used_mc1) || 0;
        const mc2 = Number(row.used_mc2) || 0;
        const mc3 = Number(row.used_mc3) || 0;
        const loose1 = Number(row.loose_mc1) || 0;
        const loose2 = Number(row.loose_mc2) || 0;
        const loose3 = Number(row.loose_mc3) || 0;
        const balance = Number(row.closing_balance) || 0;

        return totAvail !== 0 || issue !== 0 || mc1 !== 0 || mc2 !== 0 || mc3 !== 0 ||
            loose1 !== 0 || loose2 !== 0 || loose3 !== 0 || balance !== 0;
    });

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="py-8 text-center text-gray-500">No activity found for this period.</td></tr>`;
        return;
    }

    // Calculate totals using reduce for robustness
    const totals = filteredData.reduce((acc, row) => {
        acc.tot_avail += Number(row.total_available) || 0;
        acc.issue += Number(row.issue_qty) || 0;
        acc.mc1 += Number(row.used_mc1) || 0;
        acc.mc2 += Number(row.used_mc2) || 0;
        acc.mc3 += Number(row.used_mc3) || 0;
        acc.loose1 += Number(row.loose_mc1) || 0;
        acc.loose2 += Number(row.loose_mc2) || 0;
        acc.loose3 += Number(row.loose_mc3) || 0;
        acc.balance += Number(row.closing_balance) || 0;
        return acc;
    }, { tot_avail: 0, issue: 0, mc1: 0, mc2: 0, mc3: 0, loose1: 0, loose2: 0, loose3: 0, balance: 0 });

    tbody.innerHTML = filteredData.map(row => {
        return `
            <tr class="bg-white hover:bg-gray-50 border-b border-gray-200">
                <td class="font-medium text-gray-700 text-left pl-3 py-2 border-r border-gray-300">${row.material_name}</td>
                <td class="col-highlight-available py-2 border-r border-gray-300">${formatNum(row.total_available)}</td>
                <td class="py-2 border-r border-gray-300">${formatNum(row.issue_qty)}</td>
                <td class="py-2 border-r border-gray-300">${formatNum(row.used_mc1)}</td>
                <td class="py-2 border-r border-gray-300">${formatNum(row.used_mc2)}</td>
                <td class="py-2 border-r border-gray-300">${formatNum(row.used_mc3)}</td>
                <td class="col-highlight-loose py-2 border-r border-gray-300">${formatNum(row.loose_mc1)}</td>
                <td class="col-highlight-loose py-2 border-r border-gray-300">${formatNum(row.loose_mc2)}</td>
                <td class="col-highlight-loose py-2 border-r border-gray-300">${formatNum(row.loose_mc3)}</td>
                <td class="col-highlight-balance py-2">${formatNum(row.closing_balance)}</td>
            </tr>
        `;
    }).join('');

    // Update Footer with correct IDs matching your HTML
    tfoot.innerHTML = `
        <tr class="bg-gray-100 font-bold border-t-2 border-gray-400">
            <td class="text-left pl-3 py-3 border-r border-gray-300 uppercase tracking-wider">TOTAL:</td>
            <td class="text-center py-3 border-r border-gray-300 col-highlight-available">${formatNum(totals.tot_avail)}</td>
            <td class="text-center py-3 border-r border-gray-300">${formatNum(totals.issue)}</td>
            <td class="text-center py-3 border-r border-gray-300">${formatNum(totals.mc1)}</td>
            <td class="text-center py-3 border-r border-gray-300">${formatNum(totals.mc2)}</td>
            <td class="text-center py-3 border-r border-gray-300">${formatNum(totals.mc3)}</td>
            <td class="text-center py-3 border-r border-gray-300 col-highlight-loose" style="font-weight: 700 !important;">${formatNum(totals.loose1)}</td>
            <td class="text-center py-3 border-r border-gray-300 col-highlight-loose" style="font-weight: 700 !important;">${formatNum(totals.loose2)}</td>
            <td class="text-center py-3 border-r border-gray-300 col-highlight-loose" style="font-weight: 700 !important;">${formatNum(totals.loose3)}</td>
            <td class="text-center py-3 bg-yellow-100 text-yellow-900 border-l border-gray-400 font-extrabold">${formatNum(totals.balance)}</td>
        </tr>
    `;

    tfoot.classList.remove('hidden');
}

function formatNum(val) {
    const num = parseFloat(val);
    // If it's zero, show '0.00' in light gray instead of just a dash
    if (isNaN(num) || num === 0) return `<span class="text-gray-300">0.00</span>`;
    return num.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function updateTableHeaders() {
    const category = document.getElementById('materialCategory').value;
    const uom = category === 'packing' ? 'Nos' : 'Kgs';

    // Update table headers with correct UOM
    const headers = document.querySelectorAll('#reconciliationTable thead th');
    if (headers.length >= 10) {
        headers[1].innerHTML = `Total Available (${uom})<br><span class="text-[9px] font-normal lowercase">(Opening + New Issues)</span>`;
        headers[2].innerHTML = `Issued (${uom})<br><span class="text-[9px] font-normal lowercase">(Selected Date)</span>`;
        headers[3].innerHTML = `Used M/C 1 (${uom})`;
        headers[4].innerHTML = `Used M/C 2 (${uom})`;
        headers[5].innerHTML = `Used M/C 3 (${uom})`;
        headers[6].innerHTML = `Loose M/C 1 (${uom})<br><span class="text-[9px] font-normal text-orange-600">(Unpacked)</span>`;
        headers[7].innerHTML = `Loose M/C 2 (${uom})<br><span class="text-[9px] font-normal text-orange-600">(Unpacked)</span>`;
        headers[8].innerHTML = `Loose M/C 3 (${uom})<br><span class="text-[9px] font-normal text-orange-600">(Unpacked)</span>`;
        headers[9].innerHTML = `Balance (Store) (${uom})`;
    }

    // Update page title
    const titleMap = {
        'raw': 'Raw Materials Reconciliation Report',
        'packing': 'Packing Materials Reconciliation Report',
        'printing': 'Printing Materials Reconciliation Report'
    };
    document.querySelector('.header-title').textContent = titleMap[category] || 'Material Reconciliation Report';
}

// --- SECOND TABLE: Scrap Summary ---
async function fetchAndRenderScrapSummary(startDate, endDate) {
    const machineBody = document.getElementById('machineScrapBody');
    const individualBody = document.getElementById('individualScrapBody');
    const tfoot = document.getElementById('scrapFooter');

    try {
        const loadingHtml = `<tr><td colspan="5" class="py-8 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Loading...</td></tr>`;
        machineBody.innerHTML = loadingHtml;
        individualBody.innerHTML = loadingHtml;
        tfoot.classList.add('hidden');

        // Fetch scrap data from pd_daily_log
        const { data, error } = await supabase
            .from('pd_daily_log')
            .select('total_scrap, pd_material_consumption_records!inner(machine_no, production_date)')
            .gte('pd_material_consumption_records.production_date', startDate)
            .lte('pd_material_consumption_records.production_date', endDate);

        if (error) throw error;

        if (!data || data.length === 0) {
            const emptyHtml = `<tr><td colspan="5" class="py-8 text-center text-gray-400 italic">No data found.</td></tr>`;
            machineBody.innerHTML = emptyHtml;
            individualBody.innerHTML = emptyHtml;
            return;
        }

        // Define scrap categories
        const machineTypes = [
            'total_scrap', 'machine_scrap',
            'resin_bag_scrap_detail', 'process_waste', 'in_house_use'
        ];
        const individualTypes = ['qc_scrap', 'rewinded_scrap', 'others'];

        const typeLabels = {
            'total_scrap': 'Total Scrap',
            'machine_scrap': 'Machine Scrap',
            'qc_scrap': 'QC Scrap',
            'resin_bag_scrap_detail': 'Resin Bag Scrap',
            'rewinded_scrap': 'Rewinded Scrap',
            'process_waste': 'Process Waste',
            'in_house_use': 'In House Use',
            'others': 'Others'
        };

        const summary = {};
        const allTypes = [...machineTypes, ...individualTypes];
        allTypes.forEach(type => {
            summary[type] = { mc1: 0, mc2: 0, mc3: 0, total: 0 };
        });

        data.forEach(record => {
            const machine = String(record.pd_material_consumption_records?.machine_no || '').trim();
            const mcKey = machine === '1' || machine === '01' ? 'mc1' :
                machine === '2' || machine === '02' ? 'mc2' :
                    machine === '3' || machine === '03' ? 'mc3' : null;

            const scrapData = record.total_scrap || {};

            // Map each scrap value
            machineTypes.forEach(type => {
                // Support both new 'total_scrap' key and old 'resin_scrap' key for backward compatibility
                let val = 0;
                if (type === 'total_scrap') {
                    val = parseFloat(scrapData.total_scrap) || parseFloat(scrapData.resin_scrap) || 0;
                } else {
                    val = parseFloat(scrapData[type]) || 0;
                }

                if (mcKey) summary[type][mcKey] += val;
                summary[type].total += val;
            });

            individualTypes.forEach(type => {
                const val = parseFloat(scrapData[type]) || 0;
                summary[type].total += val;
            });
        });

        // Render Machine-wise Table
        let machineHtml = '';
        machineTypes.forEach(type => {
            const vals = summary[type];
            machineHtml += `
                <tr class="bg-white hover:bg-gray-50 border-b border-gray-200">
                    <td class="font-medium text-gray-700 text-left pl-3 py-2.5 border-r border-gray-300">${typeLabels[type]}</td>
                    <td class="text-center py-2.5 border-r border-gray-300">${formatNum(vals.mc1)}</td>
                    <td class="text-center py-2.5 border-r border-gray-300">${formatNum(vals.mc2)}</td>
                    <td class="text-center py-2.5 border-r border-gray-300">${formatNum(vals.mc3)}</td>
                    <td class="text-center py-2.5 font-bold col-highlight-scrap">${formatNum(vals.total)}</td>
                </tr>
            `;
        });

        // Render Individual/Global Table
        let individualHtml = '';
        individualTypes.forEach(type => {
            const vals = summary[type];
            individualHtml += `
                <tr class="bg-white hover:bg-gray-50 border-b border-gray-200">
                    <td class="font-medium text-gray-700 text-left pl-3 py-2.5 border-r border-gray-300">${typeLabels[type]}</td>
                    <td colspan="3" class="text-center py-2.5 border-r border-gray-300 text-gray-400 italic">Not machine specific</td>
                    <td class="text-center py-2.5 font-bold col-highlight-scrap" style="background-color: #fff1f2 !important; color: #9f1239 !important;">${formatNum(vals.total)}</td>
                </tr>
            `;
        });

        document.getElementById('machineScrapBody').innerHTML = machineHtml;
        document.getElementById('individualScrapBody').innerHTML = individualHtml;
        tfoot.classList.remove('hidden');

    } catch (err) {
        console.error('Scrap Summary Error:', err);
        const errorHtml = `<tr><td colspan="5" class="py-4 text-center text-red-500">Error loading data.</td></tr>`;
        machineBody.innerHTML = errorHtml;
        individualBody.innerHTML = errorHtml;
    }
}

// --- THIRD TABLE: Rolls Summary ---
async function fetchAndRenderRollsSummary(startDate, endDate) {
    const tbody = document.getElementById('rollsBody');
    const tfoot = document.getElementById('rollsFooter');

    try {
        tbody.innerHTML = `<tr><td colspan="8" class="py-10 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Loading rolls data...</td></tr>`;
        tfoot.classList.add('hidden');

        // Fetch rolls data from pd_daily_log
        const { data, error } = await supabase
            .from('pd_daily_log')
            .select('produced_rolls, produced_kgs_actual, accepted_rolls_nos, accepted_rolls_actual, rejected_rolls, rejected_kgs_actual, pd_material_consumption_records!inner(machine_no, production_date)')
            .gte('pd_material_consumption_records.production_date', startDate)
            .lte('pd_material_consumption_records.production_date', endDate);

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="py-10 text-center text-gray-500">No rolls data found for selected period.</td></tr>`;
            return;
        }

        // Aggregate rolls data by machine
        const machines = {
            'mc1': { name: 'M/C 1', prodRolls: 0, prodKgs: 0, accRolls: 0, accKgs: 0, rejRolls: 0, rejKgs: 0, totalKgs: 0 },
            'mc2': { name: 'M/C 2', prodRolls: 0, prodKgs: 0, accRolls: 0, accKgs: 0, rejRolls: 0, rejKgs: 0, totalKgs: 0 },
            'mc3': { name: 'M/C 3', prodRolls: 0, prodKgs: 0, accRolls: 0, accKgs: 0, rejRolls: 0, rejKgs: 0, totalKgs: 0 }
        };

        const grandTotal = { prodRolls: 0, prodKgs: 0, accRolls: 0, accKgs: 0, rejRolls: 0, rejKgs: 0, totalKgs: 0 };

        data.forEach(record => {
            const machine = String(record.pd_material_consumption_records?.machine_no || '').trim();
            const mcKey = machine === '1' || machine === '01' ? 'mc1' :
                machine === '2' || machine === '02' ? 'mc2' :
                    machine === '3' || machine === '03' ? 'mc3' : null;

            if (!mcKey) return;

            const m = machines[mcKey];

            // Aggregation
            const pr = parseInt(record.produced_rolls) || 0;
            const pk = parseFloat(record.produced_kgs_actual) || 0;
            const ar = parseInt(record.accepted_rolls_nos) || 0;
            const ak = parseFloat(record.accepted_rolls_actual) || 0;
            const rr = parseInt(record.rejected_rolls) || 0;
            const rk = parseFloat(record.rejected_kgs_actual) || 0;

            m.prodRolls += pr; m.prodKgs += pk;
            m.accRolls += ar; m.accKgs += ak;
            m.rejRolls += rr; m.rejKgs += rk;
            m.totalKgs += pk;

            grandTotal.prodRolls += pr; grandTotal.prodKgs += pk;
            grandTotal.accRolls += ar; grandTotal.accKgs += ak;
            grandTotal.rejRolls += rr; grandTotal.rejKgs += rk;
            grandTotal.totalKgs += pk;
        });

        // Render table rows
        let html = '';
        ['mc1', 'mc2', 'mc3'].forEach(key => {
            const m = machines[key];
            html += `
                <tr class="bg-white hover:bg-gray-50 border-b border-gray-200">
                    <td class="font-bold text-gray-800 text-left pl-3 py-2.5 border-r border-gray-300 bg-gray-50">${m.name}</td>
                    <td class="text-center py-2.5 border-r border-gray-300">${m.accRolls}</td>
                    <td class="text-center py-2.5 border-r border-gray-300">${formatNum(m.accKgs)}</td>
                    <td class="text-center py-2.5 border-r border-gray-300 font-semibold text-gray-600">${m.prodRolls}</td>
                    <td class="text-center py-2.5 border-r border-gray-300 font-semibold text-gray-600">${formatNum(m.prodKgs)}</td>
                    <td class="text-center py-2.5 border-r border-gray-300 text-red-600">${m.rejRolls}</td>
                    <td class="text-center py-2.5 border-r border-gray-300 text-red-600">${formatNum(m.rejKgs)}</td>
                    <td class="text-center py-2.5 col-highlight-rolls">${formatNum(m.totalKgs)}</td>
                </tr>
            `;
        });

        // Add Grand Total Row
        html += `
            <tr class="bg-gray-100 font-bold border-t-2 border-gray-400">
                <td class="text-left pl-3 py-3 border-r border-gray-300 uppercase tracking-wider">Grand Total</td>
                <td class="text-center py-3 border-r border-gray-300">${grandTotal.accRolls}</td>
                <td class="text-center py-3 border-r border-gray-300">${formatNum(grandTotal.accKgs)}</td>
                <td class="text-center py-3 border-r border-gray-300">${grandTotal.prodRolls}</td>
                <td class="text-center py-3 border-r border-gray-300">${formatNum(grandTotal.prodKgs)}</td>
                <td class="text-center py-3 border-r border-gray-300">${grandTotal.rejRolls}</td>
                <td class="text-center py-3 border-r border-gray-300">${formatNum(grandTotal.rejKgs)}</td>
                <td class="text-center py-3 bg-blue-900 text-white">${formatNum(grandTotal.totalKgs)}</td>
            </tr>
        `;

        tbody.innerHTML = html;
        tfoot.classList.remove('hidden');

    } catch (err) {
        console.error('Rolls Summary Error:', err);
        tbody.innerHTML = `<tr><td colspan="8" class="py-4 text-center text-red-500">Error loading rolls data.</td></tr>`;
    }
}



// --- FOURTH & FIFTH TABLES: Reject Summaries ---
async function fetchAndRenderRejectSummaries(startDate, endDate) {
    const transferBody = document.getElementById('transferBody');
    const issuedBody = document.getElementById('issuedBody');

    try {
        transferBody.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Loading transfer data...</td></tr>`;
        issuedBody.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Loading issued data...</td></tr>`;

        // Fetch reject data from pd_daily_log
        const { data, error } = await supabase
            .from('pd_daily_log')
            .select('reject_transfer_data, reject_issued_data, pd_material_consumption_records!inner(production_date)')
            .gte('pd_material_consumption_records.production_date', startDate)
            .lte('pd_material_consumption_records.production_date', endDate);

        if (error) throw error;

        if (!data || data.length === 0) {
            const noDataHtml = `<tr><td colspan="3" class="py-8 text-center text-gray-500">No data found for selected period.</td></tr>`;
            transferBody.innerHTML = noDataHtml;
            issuedBody.innerHTML = noDataHtml;
            return;
        }

        // Aggregate Transfer Data
        const transferSummary = {};
        const issuedSummary = {};

        data.forEach(record => {
            // Process Transfers
            const transfers = record.reject_transfer_data || [];
            transfers.forEach(row => {
                const prod = (row.product || 'Unknown').trim();
                const defect = (row.defect || 'N/A').trim();
                const qty = parseFloat(row.qty) || 0;
                if (qty === 0 && !prod) return;

                const key = `${prod}|${defect}`;
                if (!transferSummary[key]) {
                    transferSummary[key] = { product: prod, defect: defect, total: 0 };
                }
                transferSummary[key].total += qty;
            });

            // Process Issued
            const issued = record.reject_issued_data || [];
            issued.forEach(row => {
                const prod = (row.product || 'Unknown').trim();
                const defect = (row.defect || 'N/A').trim();
                const qty = parseFloat(row.qty) || 0;
                if (qty === 0 && !prod) return;

                const key = `${prod}|${defect}`;
                if (!issuedSummary[key]) {
                    issuedSummary[key] = { product: prod, defect: defect, total: 0 };
                }
                issuedSummary[key].total += qty;
            });
        });

        // Render Transfer Table
        const transferRows = Object.values(transferSummary).sort((a, b) => a.product.localeCompare(b.product));
        if (transferRows.length === 0) {
            transferBody.innerHTML = `<tr><td colspan="3" class="py-8 text-center text-gray-500">No transfer records found.</td></tr>`;
        } else {
            transferBody.innerHTML = transferRows.map(row => `
                <tr class="bg-white hover:bg-gray-50">
                    <td class="font-medium text-gray-700 text-left pl-3 py-2 border-r border-b border-gray-300">${row.product}</td>
                    <td class="text-center py-2 border-r border-b border-gray-300 font-semibold text-gray-600">${row.defect}</td>
                    <td class="text-center py-2 border-b border-gray-300 col-highlight-transfer">${formatNum(row.total)}</td>
                </tr>
            `).join('');
        }

        // Render Issued Table
        const issuedRows = Object.values(issuedSummary).sort((a, b) => a.product.localeCompare(b.product));
        if (issuedRows.length === 0) {
            issuedBody.innerHTML = `<tr><td colspan="3" class="py-8 text-center text-gray-500">No issued records found.</td></tr>`;
        } else {
            issuedBody.innerHTML = issuedRows.map(row => `
                <tr class="bg-white hover:bg-gray-50">
                    <td class="font-medium text-gray-700 text-left pl-3 py-2 border-r border-b border-gray-300">${row.product}</td>
                    <td class="text-center py-2 border-r border-b border-gray-300 font-semibold text-gray-600">${row.defect}</td>
                    <td class="text-center py-2 border-b border-gray-300 col-highlight-issued">${formatNum(row.total)}</td>
                </tr>
            `).join('');
        }

    } catch (err) {
        console.error('Reject Summaries Error:', err);
        const errorHtml = `<tr><td colspan="3" class="py-4 text-center text-red-500">Error loading reject data.</td></tr>`;
        transferBody.innerHTML = errorHtml;
        issuedBody.innerHTML = errorHtml;
    }
}
