import { supabase } from '../supabase-config.js';

let jobCostRecords = [];

document.addEventListener('DOMContentLoaded', () => {
    // Setup back button
    const backBtn = document.querySelector('.header-back-button');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            window.location.href = 'stock-report.html';
        });
    }

    // Add page fade-in effect
    document.body.classList.add('page-fade-in');

    // Initialize form
    initializeJobCostRecord();

    // Setup button listeners
    const addRowBtn = document.getElementById('addRowBtn');
    if (addRowBtn) addRowBtn.addEventListener('click', addNewRow);
    const addRowsBtn = document.getElementById('addRowsBtn');
    if (addRowsBtn) addRowsBtn.addEventListener('click', () => addNewRow());
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveJobCostRecord);
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportToExcel);
});

function initializeJobCostRecord() {
    console.log('Job Cost Record page initialized');
    
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
}

function addNewRow() {
    const tbody = document.getElementById('jobCostTableBody');
    const rowIndex = tbody.rows.length;
    
    const row = tbody.insertRow();
    row.innerHTML = `
        <td class="border border-gray-400 px-3 py-2" data-field="shift" contenteditable="true"></td>
        <td class="border border-gray-400 px-3 py-2" data-field="supervisor" contenteditable="true"></td>
        <td class="border border-gray-400 px-3 py-2" data-field="operator" contenteditable="true"></td>
        <td class="border border-gray-400 px-3 py-2" data-field="production_instruction_no" contenteditable="true"></td>
        <td class="border border-gray-400 px-3 py-2" data-field="production_code" contenteditable="true"></td>
        <td class="border border-gray-400 px-3 py-2" data-field="raw_material_type" contenteditable="true"></td>
        <td class="border border-gray-400 px-3 py-2" data-field="qty_resin" contenteditable="true"></td>
        <td class="border border-gray-400 px-3 py-2" data-field="qty_issued" contenteditable="true"></td>
        <td class="border border-gray-400 px-3 py-2" data-field="qty_used" contenteditable="true"></td>
        <td class="border border-gray-400 px-3 py-2" data-field="qty_balance" contenteditable="true"></td>
        <td class="border border-gray-400 px-3 py-2" data-field="carry_forward" contenteditable="true"></td>
        <td class="border border-gray-400 px-3 py-2" data-field="pc_rl" contenteditable="true"></td>
        <td class="border border-gray-400 px-3 py-2" data-field="rejected_roll" contenteditable="true"></td>
        <td class="border border-gray-400 px-3 py-2" data-field="scrap" contenteditable="true"></td>
        <td class="border border-gray-400 px-3 py-2" data-field="std_wt" contenteditable="true"></td>
        <td class="border border-gray-400 px-3 py-2" data-field="product_accept" contenteditable="true"></td>
        <td class="border border-gray-400 px-3 py-2" data-field="total_product_reject" contenteditable="true"></td>
    `;
}

async function saveJobCostRecord() {
    const machine = document.getElementById('machine').value;
    const date = document.getElementById('date').value;
    const shift = document.querySelector('input[name="shift"]:checked')?.value;
    const customer = document.getElementById('customer').value;
    const prod_no_1 = document.getElementById('prod_no_1')?.value || '';
    const prod_no_2 = document.getElementById('prod_no_2')?.value || '';
    const prod_no_3 = document.getElementById('prod_no_3')?.value || '';
    const prod_code_1 = document.getElementById('prod_code_1')?.value || '';
    const prod_code_2 = document.getElementById('prod_code_2')?.value || '';
    const supervisor = document.getElementById('supervisor')?.value || '';
    const operator = document.getElementById('operator')?.value || '';
    // thickness_gsm, width_mm, length_m removed from form
    const line_speed = document.getElementById('line_speed').value;
    const product_type = document.getElementById('product_type')?.value;
    
    if (!machine || !date || !shift || !customer) {
        alert('Please fill in Machine, Date, Shift, and Customer');
        return;
    }

    const tbody = document.getElementById('jobCostTableBody');
    const rows = [];

    tbody.querySelectorAll('tr').forEach((tr, idx) => {
        const map = {};
        tr.querySelectorAll('[data-field]').forEach(el => {
            const k = el.dataset.field || '';
            if (k) map[k] = el.innerText.trim();
        });
        rows.push({
            shift: map['shift'] || '',
            supervisor: map['supervisor'] || '',
            operator: map['operator'] || '',
            production_instruction_no: map['production_instruction_no'] || '',
            production_code: map['production_code'] || '',
            raw_material_type: map['raw_material_type'] || '',
            qty_resin: map['qty_resin'] || '',
            qty_issued: map['qty_issued'] || '',
            qty_used: map['qty_used'] || '',
            qty_balance: map['qty_balance'] || '',
            carry_forward: map['carry_forward'] || '',
            pc_rl: map['pc_rl'] || '',
            rejected_roll: map['rejected_roll'] || '',
            scrap: map['scrap'] || '',
            std_wt: map['std_wt'] || '',
            product_accept: map['product_accept'] || '',
            total_product_reject: map['total_product_reject'] || '',
        });
    });

    try {
        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            alert('User not authenticated');
            return;
        }

        const recordData = {
            user_id: user.data.user.id,
            machine,
            date,
            shift,
            customer,
            // backward-compatible single prod_no (use prod_no_1)
            prod_no: prod_no_1 || prod_no_2 || prod_no_3 || '',
            prod_no_1,
            prod_no_2,
            prod_no_3,
            // keep prod_code for backward compatibility
            prod_code: prod_code_1 || prod_code_2 || '',
            prod_code_1,
            prod_code_2,
            supervisor,
            operator,
            product_type,
            line_speed,
            rows: JSON.stringify(rows),
            created_at: new Date().toISOString(),
        };

        // Save to Supabase (you'll need to create the table first)
        // const { data, error } = await supabase
        //     .from('job_cost_records')
        //     .insert([recordData]);

        // if (error) throw error;

        alert('Job Cost Record saved successfully!');
        console.log('Saved:', recordData);
    } catch (error) {
        console.error('Error saving:', error);
        alert('Error saving record: ' + error.message);
    }
}

function exportToExcel() {
    // Placeholder for Excel export functionality
    alert('Excel export functionality coming soon!');
}