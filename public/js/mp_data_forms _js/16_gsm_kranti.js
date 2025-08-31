import { supabase } from '../../supabase-config.js';

document.addEventListener('DOMContentLoaded', function() {
    // Page 1 elements
    const addRowsBtn = document.getElementById('addNewRowsBtn');
    const numRowsInput = document.getElementById('numRowsInput');
    const testingTableBody = document.getElementById('testingTableBody');
    const rowCountDisplay = document.getElementById('rowCountDisplay');

               // Page 2 elements
           const addRowsBtn2 = document.getElementById('addNewRowsBtn2');
           const numRowsInput2 = document.getElementById('numRowsInput2');
           const testingTableBody2 = document.getElementById('testingTableBody2');
           const rowCountDisplay2 = document.getElementById('rowCountDisplay2');
           
           // Page 3 elements
           const addRowsBtn3 = document.getElementById('addNewRowsBtn3');
           const numRowsInput3 = document.getElementById('numRowsInput3');
           const testingTableBody3 = document.getElementById('testingTableBody3');
           const rowCountDisplay3 = document.getElementById('rowCountDisplay3');
           
           // Page 4 elements
           const addRowsBtn4 = document.getElementById('addNewRowsBtn4');
           const numRowsInput4 = document.getElementById('numRowsInput4');
           const testingTableBody4 = document.getElementById('testingTableBody4');
           const rowCountDisplay4 = document.getElementById('rowCountDisplay4');

           if (!addRowsBtn || !numRowsInput || !testingTableBody || !addRowsBtn2 || !numRowsInput2 || !testingTableBody2 || !addRowsBtn3 || !numRowsInput3 || !testingTableBody3 || !addRowsBtn4 || !numRowsInput4 || !testingTableBody4) {
           return;
       }

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

           // Initialize
       updateRowCount();
       updateRowCount2();
       updateRowCount3();
       updateRowCount4();

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

           // Add rows button for Page 2 (syncs with all pages)
       addRowsBtn2.addEventListener('click', function() {
           const n = parseInt(numRowsInput2.value, 10) || 1;
           addRowsToTable(testingTableBody, n);
           addRowsToTable(testingTableBody2, n);
           addRowsToTable(testingTableBody3, n);
           addRowsToTable(testingTableBody4, n);
           updateRowCount();
           updateRowCount2();
           updateRowCount3();
           updateRowCount4();
       });

           // Function to add rows to any table
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

                    // Add new empty rows
            for (let i = 0; i < n; i++) {
                const tr = document.createElement('tr');
                
                // Determine number of columns based on table body ID
                let columnCount;
                if (tableBody.id === 'testingTableBody2' || tableBody.id === 'testingTableBody3') {
                    columnCount = 15;
                                 } else if (tableBody.id === 'testingTableBody4') {
                     columnCount = 9;
                 } else {
                    columnCount = 10;
                }
                
                for (let j = 0; j < columnCount; j++) {
                    const td = document.createElement('td');
                    td.className = 'border border-gray-400 px-3 py-2 text-center';
                    td.style.fontSize = '13px';
                    
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'w-full bg-transparent outline-none border-none focus:outline-none focus:ring-0 focus:border-none text-center';
                    input.style.fontSize = '13px';
                    input.value = '';
                    input.placeholder = '';
                    td.appendChild(input);
                    tr.appendChild(td);
                }
                
                tableBody.appendChild(tr);
            }

           // Re-add summary rows
           summaryRows.forEach(row => {
               tableBody.appendChild(row);
           });
       }

           // Add rows button for Page 3 (syncs with all pages)
       addRowsBtn3.addEventListener('click', function() {
           const n = parseInt(numRowsInput3.value, 10) || 1;
           addRowsToTable(testingTableBody, n);
           addRowsToTable(testingTableBody2, n);
           addRowsToTable(testingTableBody3, n);
           addRowsToTable(testingTableBody4, n);
           updateRowCount();
           updateRowCount2();
           updateRowCount3();
           updateRowCount4();
       });
       
       // Add rows button for Page 4 (syncs with all pages)
       addRowsBtn4.addEventListener('click', function() {
           const n = parseInt(numRowsInput4.value, 10) || 1;
           addRowsToTable(testingTableBody, n);
           addRowsToTable(testingTableBody2, n);
           addRowsToTable(testingTableBody3, n);
           addRowsToTable(testingTableBody4, n);
           updateRowCount();
           updateRowCount2();
           updateRowCount3();
           updateRowCount4();
       });
       
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
});
