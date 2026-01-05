import { supabase } from '../supabase-config.js';

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
    
    if (!fromDateVal || !toDateVal) return alert('Please select both from and to dates.');
    
    // Validate date range
    if (fromDateVal > toDateVal) {
        return alert('From date cannot be later than to date.');
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
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Loading Report...</td></tr>`;
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

    } catch (err) {
        console.error('Report Error:', err);
        tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-red-500">Error loading report: ${err.message}</td></tr>`;
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
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-gray-500">No data found.</td></tr>`;
        return;
    }

    // Filter zeroes and ensure numeric values
    const filteredData = data.filter(row => {
        const totAvail = Number(row.total_available) || 0;
        const issue = Number(row.issue_qty) || 0;
        const mc1 = Number(row.used_mc1) || 0;
        const mc2 = Number(row.used_mc2) || 0;
        const mc3 = Number(row.used_mc3) || 0;
        const balance = Number(row.closing_balance) || 0;
        
        return totAvail !== 0 || issue !== 0 || mc1 !== 0 || mc2 !== 0 || mc3 !== 0 || balance !== 0;
    });

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-gray-500">No activity found for this period.</td></tr>`;
        return;
    }

    // Calculate totals using reduce for robustness
    const totals = filteredData.reduce((acc, row) => {
        acc.tot_avail += Number(row.total_available) || 0;
        acc.issue += Number(row.issue_qty) || 0;
        acc.mc1 += Number(row.used_mc1) || 0;
        acc.mc2 += Number(row.used_mc2) || 0;
        acc.mc3 += Number(row.used_mc3) || 0;
        acc.balance += Number(row.closing_balance) || 0;
        return acc;
    }, { tot_avail: 0, issue: 0, mc1: 0, mc2: 0, mc3: 0, balance: 0 });

    tbody.innerHTML = filteredData.map(row => {
        return `
            <tr>
                <td class="font-medium text-gray-700 text-left pl-3">${row.material_name}</td>
                <td class="bg-blue-50 font-semibold text-blue-800">${formatNum(row.total_available)}</td>
                <td>${formatNum(row.issue_qty)}</td>
                <td>${formatNum(row.used_mc1)}</td>
                <td>${formatNum(row.used_mc2)}</td>
                <td>${formatNum(row.used_mc3)}</td>
                <td class="font-bold bg-yellow-50 text-gray-800">${formatNum(row.closing_balance)}</td>
            </tr>
        `;
    }).join('');

    // Update Footer with correct IDs matching your HTML
    tfoot.innerHTML = `
        <tr class="bg-gray-100 font-bold">
            <td class="text-right pr-3 py-2">TOTAL:</td>
            <td class="font-bold text-blue-900">${formatNum(totals.tot_avail)}</td>
            <td class="font-bold">${formatNum(totals.issue)}</td>
            <td class="font-bold">${formatNum(totals.mc1)}</td>
            <td class="font-bold">${formatNum(totals.mc2)}</td>
            <td class="font-bold">${formatNum(totals.mc3)}</td>
            <td class="font-bold bg-yellow-100 text-yellow-900">${formatNum(totals.balance)}</td>
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
    if (headers.length >= 7) {
        headers[1].innerHTML = `Total Available (${uom})<br><span class="text-[9px] font-normal lowercase">(Opening + New Issues)</span>`;
        headers[2].innerHTML = `Issued (${uom})<br><span class="text-[9px] font-normal lowercase">(Selected Date)</span>`;
        headers[3].innerHTML = `Used M/C 1 (${uom})`;
        headers[4].innerHTML = `Used M/C 2 (${uom})`;
        headers[5].innerHTML = `Used M/C 3 (${uom})`;
        headers[6].innerHTML = `Balance (Store) (${uom})`;
    }
    
    // Update page title
    const titleMap = {
        'raw': 'Raw Materials Reconciliation Report',
        'packing': 'Packing Materials Reconciliation Report', 
        'printing': 'Printing Materials Reconciliation Report'
    };
    document.querySelector('.header-title').textContent = titleMap[category] || 'Material Reconciliation Report';
}
