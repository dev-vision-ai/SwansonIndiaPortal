const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Create service role Supabase client for accessing private buckets
const supabaseServiceRole = createClient(
  process.env.SUPABASE_URL || 'https://ufczydnvscaicygwlmhz.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmY3p5ZG52c2NhaWN5Z3dsbWh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDIxODk0NiwiZXhwIjoyMDU5Nzk0OTQ2fQ.sBcPr-5sHkLxflG9Kkwi4mf4M0VrPdHmk8QzWkSzJi4'
);

// Helper function to format date to DD/MM/YYYY
function formatDateToDDMMYYYY(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Helper function to insert signature image into cell
async function insertSignatureInCell(worksheet, cellRef, userName, supabase) {
  if (!userName) return;
  
  try {
    // Fetch user ID from users table using full_name (case-insensitive match)
    const { data: allUsers, error: userError } = await supabase
      .from('users')
      .select('id, full_name');

    if (userError || !allUsers) {
      console.warn(`Error fetching users from database:`, userError?.message);
      return;
    }

    // Find matching user (case-insensitive)
    const userRecord = allUsers.find(u => 
      u.full_name && u.full_name.trim().toLowerCase() === userName.trim().toLowerCase()
    );

    if (!userRecord) {
      console.warn(`User ID not found for name: ${userName}. Available users: ${allUsers.map(u => u.full_name).join(', ')}`);
      return;
    }

    const userId = userRecord.id;
    const signatureFileName = `${userId}.png`;
    
    console.log(`Attempting to download signature for user ${userName} (ID: ${userId}) as file ${signatureFileName}`);
    
    // Download signature from Supabase Storage (digital-signatures bucket) using service role
    const { data: signatureData, error: downloadError } = await supabaseServiceRole
      .storage
      .from('digital-signatures')
      .download(signatureFileName);

    if (downloadError) {
      console.error(`❌ Download error for ${signatureFileName}:`, JSON.stringify(downloadError));
      return;
    }
    
    if (!signatureData) {
      console.warn(`⚠️ No data returned for ${signatureFileName}`);
      return;
    }
    
    console.log(`✅ Successfully downloaded signature for user ${userName}`);

    // Convert blob to buffer
    const arrayBuffer = await signatureData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Add image to workbook using buffer
    const imageId = worksheet.workbook.addImage({
      buffer: buffer,
      extension: 'png',
    });

    // Insert image into the cell with proper positioning
    // Parse cell reference (e.g., C30)
    const col = cellRef.charCodeAt(0) - 65; // A=0, B=1, C=2, etc.
    const row = parseInt(cellRef.substring(1), 10);

    // Center square (1:1 ratio) image in the cell
    // 95x95 image centered in cell
    worksheet.addImage(imageId, {
      tl: { col: col + 0.15, row: row - 1 + 0.15 }, // Center the 95px image in middle
      ext: { width: 95, height: 95 } // Perfect square 1:1 ratio
    });

    console.log(`Successfully inserted signature for user ${userName} (ID: ${userId}) in cell ${cellRef}`);
  } catch (error) {
    console.error(`Error inserting signature for user ${userName}:`, error.message);
  }
}

module.exports = function(app, createAuthenticatedSupabaseClient) {
  // Pre-Store Form Excel Export Endpoint
  app.get('/api/download-prestore-excel/:formId', async (req, res) => {
    try {
      const supabase = createAuthenticatedSupabaseClient(req);
      
      const { formId } = req.params;
      if (!formId) {
        return res.status(400).send('formId parameter is required');
      }

      // 1. Determine which table this form belongs to and fetch the correct data
      const tables = [
        '168_16c_white',
        '168_16cp_kranti',
        '176_18cp_ww',
        '168_18c_white_jeddah',
        '234_18_micro_white',
        '214_18_micro_white',
        '102_18c_micro_white',
        '168_18c_white',
        'uc-16gsm-165w',
        'uc-18gsm-210w-bfqr',
        'uc-18gsm-250p-abqr',
        'uc-18gsm-290p-abqr',
        'uc-18gsm-290np-abqr',
        'uc-18gsm-250w-bfqr'
      ];

      let data = null;
      let tableName = null;

      for (const table of tables) {
        const { data: result, error } = await supabase
          .from(table)
          .select('*')
          .eq('form_id', formId)
          .maybeSingle();

        if (error) {
          // If the table doesn't exist, Supabase throws an error with code '42P01'.
          // We can ignore this and continue to the next table.
          if (error.code !== '42P01') {
            // For any other unexpected error, we should stop and report it.
            console.error(`Error querying table ${table}:`, error);
            return res.status(500).send(`Error fetching data from table ${table}.`);
          }
        }

        if (result) {
          data = result;
          tableName = table;
          break; // Exit the loop once data is found
        }
      }

      if (!data) {
        console.log(`Form ID ${formId} not found in any of the checked tables.`);
        return res.status(404).send('Form not found in any of the designated tables.');
      }

      // 2. Load the pre-store template (always use the generic template)
      const templateFileName = 'pre-store-form.xlsx';
      const templatePath = path.join(__dirname, 'templates', templateFileName);

      if (!fs.existsSync(templatePath)) {
        console.error(`${templateFileName} template file not found:`, templatePath);
        return res.status(500).send(`${templateFileName} template file not found`);
      }

      // 3. Load the workbook using ExcelJS
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(templatePath);

      // Ensure Excel will recalc formulas on open
      workbook.calcProperties = workbook.calcProperties || {};
      workbook.calcProperties.fullCalcOnLoad = true;

      // Try to get the first worksheet safely
      let worksheet = workbook.worksheets && workbook.worksheets.length > 0 ? workbook.worksheets[0] : null;
      if (!worksheet) {
        const worksheetNames = workbook.worksheets.map(ws => ws.name);
        if (worksheetNames.length > 0) {
          worksheet = workbook.getWorksheet(worksheetNames[0]);
        }
      }
      if (!worksheet) {
        console.error(`No worksheet found in ${templateFileName} template`);
        return res.status(500).send(`No worksheet found in ${templateFileName} template`);
      }

      // 4. Map pre-store data to Excel cells
      // Product and Production Information Section
      if (data.production_order) {
        worksheet.getCell('B4').value = data.production_order;
      }

      // Handle customer field - may not exist in all tables
      if (data.customer) {
        let customerValue = data.customer;
        if (data.location) {
          customerValue = `${data.customer} (${data.location})`;
        }
  worksheet.getCell('B5').value = customerValue;
      } else if (data.product_code) {
        let cleanedProductCode = data.product_code;
        if (cleanedProductCode.toLowerCase().includes('jeddah')) {
          cleanedProductCode = cleanedProductCode.replace(/\s*\([^)]*jeddah[^)]*\)/gi, '').trim();
        }
        worksheet.getCell('B5').value = cleanedProductCode;
      }

      // Handle standard_packing field - may not exist in all tables
      if (data.standard_packing) {
        worksheet.getCell('B6').value = data.standard_packing;
      }

      if (data.product_code) {
        let cleanedProductCode = data.product_code;
        if (cleanedProductCode.toLowerCase().includes('jeddah')) {
          cleanedProductCode = cleanedProductCode.replace(/\s*\([^)]*jeddah[^)]*\)/gi, '').trim();
        }
        worksheet.getCell('G4').value = cleanedProductCode;
      }

      if (data.specification) {
        worksheet.getCell('G5').value = data.specification;
      }

      if (data.quantity) {
        worksheet.getCell('O4').value = `${data.quantity} Rolls`;
      }

      // Handle batch field - may not exist in all tables
      if (data.batch) {
        worksheet.getCell('O5').value = data.batch;
      }

      if (data.production_date) {
        const prodDate = new Date(data.production_date);
        const formattedProdDate = `${String(prodDate.getDate()).padStart(2, '0')}/${String(prodDate.getMonth() + 1).padStart(2, '0')}/${prodDate.getFullYear()}`;
        worksheet.getCell('T4').value = formattedProdDate;
      }

      if (data.inspection_date) {
        const inspDate = new Date(data.inspection_date);
        const formattedInspDate = `${String(inspDate.getDate()).padStart(2, '0')}/${String(inspDate.getMonth() + 1).padStart(2, '0')}/${inspDate.getFullYear()}`;
        worksheet.getCell('T5').value = formattedInspDate;
      }

      // Handle pallet_size field - may not exist in all tables
      if (data.pallet_size !== undefined) {
        worksheet.getCell('P6').value = data.pallet_size || 'N/A';
      }

      // Palletized Finished Goods Status Section
      const getStatusSymbol = (status) => {
        if (status === 'Accept' || status === 'accept' || status === 'Pass' || status === 'pass') {
          return '✓';
        } else if (status === 'Reject' || status === 'reject' || status === 'Fail' || status === 'fail') {
          return '✗';
        } else if (status === 'NA' || status === 'na' || status === 'N/A' || status === 'n/a') {
          return 'N/A';
        }
        return status || 'N/A';
      };

      // Handle pre-store status fields - may not exist in all tables
      if (data.pallet_list !== undefined) {
        worksheet.getCell('C9').value = getStatusSymbol(data.pallet_list);
      }

      if (data.product_label !== undefined) {
        worksheet.getCell('P9').value = getStatusSymbol(data.product_label);
      }

      if (data.wrapping !== undefined) {
        worksheet.getCell('C10').value = getStatusSymbol(data.wrapping);
      }

      if (data.layer_pad !== undefined) {
        worksheet.getCell('P10').value = getStatusSymbol(data.layer_pad);
      }

      if (data.contamination !== undefined) {
        worksheet.getCell('C11').value = getStatusSymbol(data.contamination);
      }

      if (data.kraft_paper !== undefined) {
        worksheet.getCell('P11').value = getStatusSymbol(data.kraft_paper);
      }

      if (data.no_damage !== undefined) {
        worksheet.getCell('C12').value = getStatusSymbol(data.no_damage);
      }

      if (data.pallet !== undefined) {
        worksheet.getCell('P12').value = getStatusSymbol(data.pallet);
      }

      // Handle prestore fields - may not exist in all tables
      if (data.prestore_done_by !== undefined) {
        worksheet.getCell('A29').value = data.prestore_done_by || 'N/A';
      }

      if (data.remarks !== undefined) {
        const maxRows = 9; // From row 14 to 22
        const maxCharsPerRow = 200;
        const continuousText = (data.remarks || '').replace(/\n/g, ' ').trim();
        const words = continuousText.split(' ');
        let currentRowText = '';
        const rowTexts = [];

        words.forEach(word => {
          const testText = currentRowText + (currentRowText ? ' ' : '') + word;
          if (testText.length <= maxCharsPerRow) {
            currentRowText = testText;
          } else {
            if (currentRowText) {
              rowTexts.push(currentRowText);
              currentRowText = word;
            } else {
              rowTexts.push(word);
            }
          }
        });

        if (currentRowText) {
          rowTexts.push(currentRowText);
        }

        for (let i = 0; i < Math.min(rowTexts.length, maxRows); i++) {
          const rowNum = 14 + i;
          worksheet.getCell(`A${rowNum}`).value = rowTexts[i].trim();
        }
      }

      if (data.ref_no !== undefined) {
        worksheet.getCell('V3').value = data.ref_no || 'N/A';
      };

      // Handle verified_by and approved_by fields from the film inspection form
      if (data.verified_by !== undefined) {
        // Insert verified by signature in C30
        if (data.verified_by && data.verified_by.trim() !== '' && data.verified_by !== 'N/A') {
          await insertSignatureInCell(worksheet, 'C30', data.verified_by, supabase);
        }
        // B33: verified_by name text (date on top-dd/mm/yyyy, below username)
        const verifiedDate = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
        const verifiedByName = data.verified_by && data.verified_by.trim() !== '' && data.verified_by !== 'N/A' ? data.verified_by : 'Not Verified';
        worksheet.getCell('B33').value = `(${verifiedDate})\n${verifiedByName}`;
      }

      if (data.approved_by !== undefined) {
        // Insert approved by signature in F30
        if (data.approved_by && data.approved_by.trim() !== '' && data.approved_by !== 'N/A') {
          await insertSignatureInCell(worksheet, 'F30', data.approved_by, supabase);
        }
        // E33: approved_by name text (date on top-dd/mm/yyyy, below username)
        const approvedDate = data.approved_date ? formatDateToDDMMYYYY(data.approved_date) : '';
        const approvedByName = data.approved_by && data.approved_by.trim() !== '' && data.approved_by !== 'N/A' ? data.approved_by : 'Not Approved';
        worksheet.getCell('E33').value = `(${approvedDate})\n${approvedByName}`;
        
        // I33: put user name as Bhushan Dessai (date on top-dd/mm/yyyy, below username)
        worksheet.getCell('I33').value = `(${approvedDate})\nBhushan Dessai`;
      }

      // Always insert signature for user ID c084b422-118e-4fcd-9149-d9d29e621800 in J30
      const fixedUserId = 'c084b422-118e-4fcd-9149-d9d29e621800';
      
      try {
        // Download fixed signature from Supabase Storage
        const { data: fixedSignatureData, error: fixedDownloadError } = await supabase
          .storage
          .from('digital-signatures')
          .download(`${fixedUserId}.png`);
        
        if (fixedSignatureData && !fixedDownloadError) {
          // Convert blob to buffer
          const fixedArrayBuffer = await fixedSignatureData.arrayBuffer();
          const fixedBuffer = Buffer.from(fixedArrayBuffer);

          const imageId = worksheet.workbook.addImage({
            buffer: fixedBuffer,
            extension: 'png',
          });
          
          // Insert fixed signature in J30
          const col = 'J'.charCodeAt(0) - 65; // J=9
          const row = 30;
          worksheet.addImage(imageId, {
            tl: { col: col + 0.15, row: row - 1 + 0.15 },
            ext: { width: 95, height: 95 }
          });
          console.log(`Successfully inserted fixed signature for user ID ${fixedUserId} in cell J30`);
        } else {
          console.warn(`Fixed signature file not found for user ID ${fixedUserId}:`, fixedDownloadError?.message);
        }
      } catch (error) {
        console.error(`Error inserting fixed signature for user ID ${fixedUserId}:`, error.message);
      }

      // Put check mark in D24 if approved
      if (data.approved_by && data.approved_by.trim() !== '' && data.approved_by !== 'N/A' && data.approved_by !== 'Not Approved') {
        worksheet.getCell('D24').value = '✔';
      }

      // 5. Set response headers for file download
      let productCode = data.product_code || 'UNKNOWN';
      // Clean product code for filename (remove "(Jeddah)" part)
      if (productCode.toLowerCase().includes('jeddah')) {
        productCode = productCode.replace(/\s*\([^)]*jeddah[^)]*\)/gi, '').trim();
      }
      const filename = `Pre-Store-${productCode}-.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

  // Protect each worksheet with password
  try {
    for (const ws of workbook.worksheets) {
      try {
        await ws.protect('2256', {
          selectLockedCells: true,
          selectUnlockedCells: true,
          formatCells: false,
          formatColumns: false,
          formatRows: false,
          insertColumns: false,
          insertRows: false,
          insertHyperlinks: false,
          deleteColumns: false,
          deleteRows: false,
          sort: false,
          autoFilter: false,
          pivotTables: false
        });
      } catch (protectErr) {
        console.warn(`Could not protect sheet ${ws.name}:`, protectErr && protectErr.message ? protectErr.message : protectErr);
      }
    }
  } catch (err) {
    console.warn('Error while protecting worksheets:', err && err.message ? err.message : err);
  }

  // 6. Write the workbook to response
  const buffer = await workbook.xlsx.writeBuffer();
  res.send(buffer);
  res.end();

    } catch (error) {
      console.error('Error generating Pre-Store Excel file:', error);
      res.status(500).send('Error generating Pre-Store Excel file');
    }
  });
};