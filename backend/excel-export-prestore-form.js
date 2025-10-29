const XlsxPopulate = require('xlsx-populate');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://ufczydnvscaicygwlmhz.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmY3p5ZG52c2NhaWN5Z3dsbWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg5NDYsImV4cCI6MjA1OTc5NDk0Nn0.0TUriXYvPuml-Jzr9v1jvcuzKjh-cZgnZhYKkQEj3t0'
);

module.exports = function(app) {
  // Pre-Store Form Excel Export Endpoint
  app.get('/api/download-prestore-excel/:formId', async (req, res) => {
    try {
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

      // 3. Load the workbook
      const workbook = await XlsxPopulate.fromFileAsync(templatePath);

      // Try to get the first worksheet safely
      let worksheet = workbook.sheet(0);
      if (!worksheet) {
        const worksheetNames = workbook.sheets().map(ws => ws.name());
        if (worksheetNames.length > 0) {
          worksheet = workbook.sheet(worksheetNames[0]);
        }
      }
      if (!worksheet) {
        console.error(`No worksheet found in ${templateFileName} template`);
        return res.status(500).send(`No worksheet found in ${templateFileName} template`);
      }

      // 4. Map pre-store data to Excel cells
      // Product and Production Information Section
      if (data.production_order) {
        worksheet.cell('B4').value(data.production_order);
      }

      // Handle customer field - may not exist in all tables
      if (data.customer) {
        let customerValue = data.customer;
        if (data.location) {
          customerValue = `${data.customer} (${data.location})`;
        }
        worksheet.cell('B5').value(customerValue);
      } else if (data.product_code) {
        worksheet.cell('B5').value(data.product_code);
      }

      // Handle standard_packing field - may not exist in all tables
      if (data.standard_packing) {
        worksheet.cell('B6').value(data.standard_packing);
      }

      if (data.product_code) {
        worksheet.cell('G4').value(data.product_code);
      }

      if (data.specification) {
        worksheet.cell('G5').value(data.specification);
      }

      if (data.quantity) {
        worksheet.cell('O4').value(`${data.quantity} Rolls`);
      }

      // Handle batch field - may not exist in all tables
      if (data.batch) {
        worksheet.cell('O5').value(data.batch);
      }

      if (data.production_date) {
        const prodDate = new Date(data.production_date);
        const formattedProdDate = `${String(prodDate.getDate()).padStart(2, '0')}/${String(prodDate.getMonth() + 1).padStart(2, '0')}/${prodDate.getFullYear()}`;
        worksheet.cell('T4').value(formattedProdDate);
      }

      if (data.inspection_date) {
        const inspDate = new Date(data.inspection_date);
        const formattedInspDate = `${String(inspDate.getDate()).padStart(2, '0')}/${String(inspDate.getMonth() + 1).padStart(2, '0')}/${inspDate.getFullYear()}`;
        worksheet.cell('T5').value(formattedInspDate);
      }

      // Handle pallet_size field - may not exist in all tables
      if (data.pallet_size !== undefined) {
        worksheet.cell('P6').value(data.pallet_size || 'N/A');
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
        worksheet.cell('C9').value(getStatusSymbol(data.pallet_list));
      }

      if (data.product_label !== undefined) {
        worksheet.cell('P9').value(getStatusSymbol(data.product_label));
      }

      if (data.wrapping !== undefined) {
        worksheet.cell('C10').value(getStatusSymbol(data.wrapping));
      }

      if (data.layer_pad !== undefined) {
        worksheet.cell('P10').value(getStatusSymbol(data.layer_pad));
      }

      if (data.contamination !== undefined) {
        worksheet.cell('C11').value(getStatusSymbol(data.contamination));
      }

      if (data.kraft_paper !== undefined) {
        worksheet.cell('P11').value(getStatusSymbol(data.kraft_paper));
      }

      if (data.no_damage !== undefined) {
        worksheet.cell('C12').value(getStatusSymbol(data.no_damage));
      }

      if (data.pallet !== undefined) {
        worksheet.cell('P12').value(getStatusSymbol(data.pallet));
      }

      // Handle prestore fields - may not exist in all tables
      if (data.prestore_done_by !== undefined) {
        worksheet.cell('A29').value(data.prestore_done_by || 'N/A');
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
          worksheet.cell(`A${rowNum}`).value(rowTexts[i].trim());
        }
      }

      if (data.prestore_ref_no !== undefined) {
        worksheet.cell('V3').value(data.prestore_ref_no || 'N/A');
      }

      // 5. Set response headers for file download
      const productCode = data.product_code || 'UNKNOWN';
      const batchNo = data.batch || data.production_order || data.lot_no || formId;
      const filename = `Pre-Store-${productCode}-${batchNo}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

      // 6. Write the workbook to response
      const buffer = await workbook.outputAsync();
      res.send(buffer);
      res.end();

    } catch (error) {
      console.error('Error generating Pre-Store Excel file:', error);
      res.status(500).send('Error generating Pre-Store Excel file');
    }
  });
};