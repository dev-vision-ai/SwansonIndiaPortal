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

    // Load initial data
    generateReport();

    // Event Listeners
    document.getElementById('generateBtn').addEventListener('click', generateReport);
    document.getElementById('printBtn').addEventListener('click', () => window.print());
});

async function generateReport() {
    if (isProcessing) return;

    const fromDateVal = document.getElementById('fromDate').value;
    const toDateVal = document.getElementById('toDate').value;
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

        // Call the SQL Function
        const { data, error } = await supabase.rpc('get_material_reconciliation_report', {
            p_start_date: startDate,
            p_end_date: endDate
        });

        if (error) throw error;

        renderTable(data);

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

function renderTable(data) {
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

    // Update Footer
    tfoot.innerHTML = `
        <tr>
            <td class="text-right pr-3 py-2">TOTAL:</td>
            <td class="font-bold">${formatNum(totals.tot_avail)}</td>
            <td class="font-bold">${formatNum(totals.issue)}</td>
            <td class="font-bold">${formatNum(totals.mc1)}</td>
            <td class="font-bold">${formatNum(totals.mc2)}</td>
            <td class="font-bold">${formatNum(totals.mc3)}</td>
            <td class="font-bold bg-yellow-100">${formatNum(totals.balance)}</td>
        </tr>
    `;
    
    tfoot.classList.remove('hidden');
}

function formatNum(val) {
    const num = parseFloat(val);
    if (!num || num === 0) return '-';
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
