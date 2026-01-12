const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

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

// Helper function to format time to HH:MM (remove seconds if present)
function formatTimeToHHMM(timeString) {
  if (!timeString) return '';
  // If already in HH:MM format, return as is
  if (timeString.length === 5) return timeString;
  // Otherwise, split by : and take only hours and minutes
  return timeString.split(':').slice(0, 2).join(':');
}

// Helper function to convert value to number for Excel
function convertToNumber(value) {
  if (value === '' || value === null || value === undefined) return '';
  const numValue = parseFloat(value);
  return !isNaN(numValue) ? numValue : value;
}

// Helper function to apply password protection using ExcelJS
async function applyPasswordProtection(workbook) {
  try {
    // LOCK ALL cells in all worksheets - this prevents editing without password
    workbook.worksheets.forEach(worksheet => {
      worksheet.eachRow(row => {
        row.eachCell(cell => {
          cell.protection = { locked: true, hidden: false };
        });
      });
    });
    
    // Apply sheet protection with password - locked cells cannot be edited
    workbook.worksheets.forEach(worksheet => {
      worksheet.protect('2256', {
        selectLockedCells: false,
        selectUnlockedCells: false,
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
    });
    
    // Write to buffer with password protection
    return await workbook.xlsx.writeBuffer();
  } catch (error) {
    console.error('Error applying password protection:', error);
    throw error;
  }
}

module.exports = function(app, createAuthenticatedSupabaseClient) {
  // 168-16CP Kranti Film Inspection Form Excel Export Endpoint
app.get('/export-168-16cp-kranti-form', async (req, res) => {
  try {
    // Get authenticated Supabase client using JWT from request
    const supabase = createAuthenticatedSupabaseClient(req);
    
    // Get form_id parameter
    const { form_id } = req.query;
    
    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    // 1. Fetch data from Supabase for the specific form
    const { data, error } = await supabase
      .from('168_16cp_kranti')
      .select('*')
      .eq('form_id', form_id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).send('Error fetching data from database');
    }

    if (!data) {
      return res.status(404).send('Form not found');
    }


    // 2. Load the template
    const templatePath = path.join(__dirname, 'templates', '168-16cp-kranti.xlsx');
    
    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }
    
    let workbook;
    let worksheet;
    
    // Load the template file
    try {
      workbook = await (async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(templatePath); return wb; })();
      worksheet = workbook.getWorksheet('Page1');
    } catch (error) {
      console.log('Error loading template:', error.message);
      workbook = await XlsxPopulate.fromBlankAsync();
      const page1Worksheet = workbook.addWorksheet('Page1');
      worksheet = page1Worksheet;
    }

    // 4. Map data to Excel cells
    
    // Product Code (C4)
    worksheet.getCell('C4').value = data.product_code || '';
    
    // Specification (C5) 
    worksheet.getCell('C5').value = data.specification || '';
    
    // Production Order (H4)
    worksheet.getCell('H4').value = data.production_order || '';
    
    // Purchase Order (H5)
    worksheet.getCell('H5').value = data.purchase_order || '';
    
    // Machine (K4)
    worksheet.getCell('K4').value = data.machine_no || '';
    
    // Quantity (K5) - Add "Rolls" text like prestore form
    worksheet.getCell('K5').value = data.quantity ? `${data.quantity} Rolls` : '';
    
    // Production Date (N4) - format as DD/MM/YYYY
    worksheet.getCell('N4').value = data.production_date ? formatDateToDDMMYYYY(data.production_date) : '';
    
    // Inspection Date (N5) - format as DD/MM/YYYY  
    worksheet.getCell('N5').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
    
    // Inspected By (B41)
    worksheet.getCell('B41').value = data.prepared_by || 'Unknown User';

    // Inspection Date (B42) - format as DD/MM/YYYY
    worksheet.getCell('B42').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Verified By (M41)
    worksheet.getCell('M41').value = data.verified_by || 'Not Verified';

    // Verified Date (M42) - format as DD/MM/YYYY
    worksheet.getCell('M42').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';

    // Film Inspection Form Ref No (O3)
    worksheet.getCell('O3').value = data.ref_no || '';
    
    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;
      
      // Basic Weight Equipment (D6)
      worksheet.getCell('D6').value = equipment.basic_weight || '';
      
      // Thickness Equipment (F6)
      worksheet.getCell('F6').value = equipment.thickness || '';
      
      // Opacity Equipment (H6)
      worksheet.getCell('H6').value = equipment.opacity || '';
      
      // COF Equipment (J6)
      worksheet.getCell('J6').value = equipment.cof || '';
      
      // Cut Width Equipment (L6)
      worksheet.getCell('L6').value = equipment.cut_width || '';
      
      // Color Equipment (N6) - Use unprinted equipment for both unprinted and printed
      // Since both use the same equipment type (X-RITE), use unprinted equipment ID
      worksheet.getCell('N6').value = equipment.color_unprinted || '';
    }
    
    // Map sample data to the correct columns
    
    // Sample data should go in rows 8-37 (30 rows) - preserve HTML form structure
    // Top rows (8-25): Historical data, Bottom rows (26-37): Fresh data
    // Lot & Roll data to Sample No. column (A8-A37)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');
      
      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`A${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`A${row}`).value = ''; // Empty row
        }
      }
    }
    
    // Roll ID data to column B (B8-B37) - preserve HTML form structure
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`B${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`B${row}`).value = ''; // Empty row
        }
      }
    }

    // Lot Time data to column C (C8-C37) - preserve HTML form structure
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`C${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`C${row}`).value = ''; // Empty row
        }
      }
    }
    
    // Map page1 data to the measurement columns - preserve HTML form structure
    // Basic Weight data to column D (D8-D37)
    if (data.page1_basis_weight) {
      const basicWeightData = data.page1_basis_weight;
      const dataValues = Object.values(basicWeightData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`D${row}`).value = '';
        }
      }
    }
    
    // Thickness data to column F (F8-F37)
    if (data.page1_thickness) {
      const thicknessData = data.page1_thickness;
      const dataValues = Object.values(thicknessData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`F${row}`).value = '';
        }
      }
    }
    
    // Opacity data to column H (H8-H37)
    if (data.page1_opacity) {
      const opacityData = data.page1_opacity;
      const dataValues = Object.values(opacityData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`H${row}`).value = '';
        }
      }
    }
    
    // COF data to column J (J8-J37)
    if (data.page1_cof_kinetic) {
      const cofData = data.page1_cof_kinetic;
      const dataValues = Object.values(cofData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`J${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`J${row}`).value = '';
        }
      }
    }
    
    // Cut Width data to column L (L8-L37)
    if (data.page1_cut_width) {
      const cutWidthData = data.page1_cut_width;
      const dataValues = Object.values(cutWidthData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`L${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`L${row}`).value = '';
        }
      }
    }
    
    // Color Unprinted data to column N (N8-N37)
    if (data.page1_color_delta_unprinted) {
      const colorUnprintedData = data.page1_color_delta_unprinted;
      const dataValues = Object.values(colorUnprintedData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`N${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`N${row}`).value = '';
        }
      }
    }
    
    // Color-Delta E (Printed Film) data to column O (O8-O37)
    if (data.page1_color_delta_printed) {
      const colorPrintedData = data.page1_color_delta_printed;
      const dataValues = Object.values(colorPrintedData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`O${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`O${row}`).value = '';
        }
      }
    }

    // Note: xlsx-populate doesn't support calcProperties like ExcelJS
    // Formulas will be calculated when the file is opened in Excel
    
    // Note: xlsx-populate handles formula calculation differently
    // No need for dummy cell manipulation
    

    // Map Page 2 data if Page2 worksheet exists
    const page2Worksheet = workbook.getWorksheet('Page2');
    if (page2Worksheet) {
      // Inspected By (B42)
      page2Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';

      // Inspection Date (B43) - format as DD/MM/YYYY
      page2Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

      // Verified By (M42)
      page2Worksheet.getCell('M42').value = data.verified_by || 'Not Verified';

      // Verified Date (M43) - format as DD/MM/YYYY
      page2Worksheet.getCell('M43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';

      // Film Inspection Form Ref No (O3)
      page2Worksheet.getCell('O3').value = data.ref_no || '';
      
      // Equipment data for Page 2 (D6)
      if (data.equipment_used && data.equipment_used.page2) {
        page2Worksheet.getCell('D6').value = data.equipment_used.page2.common || '';
      }
      
      // Page 2 data mapping - Elongation MD and Force MD data - fill from bottom up
      // Elongation MD 1 data to column D (D9-D38)
      if (data.page2_elongation_md_1) {
        const elongationData = data.page2_elongation_md_1;
        const dataValues = Object.values(elongationData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`D${row}`).value = ''; // Preserve empty values
          }
          row--;
        }
      }
      
      // Elongation MD 2 data to column E (E9-E38) - fill from bottom up
      if (data.page2_elongation_md_2) {
        const elongationData = data.page2_elongation_md_2;
        const dataValues = Object.values(elongationData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`E${row}`).value = ''; // Preserve empty values
          }
          row--;
        }
      }
      
      // Elongation MD 3 data to column F (F9-F38) - fill from bottom up
      if (data.page2_elongation_md_3) {
        const elongationData = data.page2_elongation_md_3;
        const dataValues = Object.values(elongationData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`F${row}`).value = ''; // Preserve empty values
          }
          row--;
        }
      }
      
      // Force MD 1 data to column H (H9-H38) - fill from bottom up
      if (data.page2_force_md_1) {
        const forceData = data.page2_force_md_1;
        const dataValues = Object.values(forceData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`H${row}`).value = ''; // Preserve empty values
          }
          row--;
        }
      }
      
      // Force MD 2 data to column I (I9-I38) - fill from bottom up
      if (data.page2_force_md_2) {
        const forceData = data.page2_force_md_2;
        const dataValues = Object.values(forceData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`I${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`I${row}`).value = ''; // Preserve empty values
          }
          row--;
        }
      }
      
      // Force MD 3 data to column J (J9-J38) - fill from bottom up
      if (data.page2_force_md_3) {
        const forceData = data.page2_force_md_3;
        const dataValues = Object.values(forceData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`J${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`J${row}`).value = ''; // Preserve empty values
          }
          row--;
        }
      }
      
      // Force 5% MD 1 data to column L (L9-L38) - fill from bottom up
      if (data.page2_force_5p_md_1) {
        const force5pData = data.page2_force_5p_md_1;
        const dataValues = Object.values(force5pData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`L${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`L${row}`).value = ''; // Preserve empty values
          }
          row--;
        }
      }
      
      // Force 5% MD 2 data to column M (M9-M38) - fill from bottom up
      if (data.page2_force_5p_md_2) {
        const force5pData = data.page2_force_5p_md_2;
        const dataValues = Object.values(force5pData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`M${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`M${row}`).value = ''; // Preserve empty values
          }
          row--;
        }
      }
      
      // Force 5% MD 3 data to column N (N9-N38) - fill from bottom up
      if (data.page2_force_5p_md_3) {
        const force5pData = data.page2_force_5p_md_3;
        const dataValues = Object.values(force5pData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`N${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`N${row}`).value = ''; // Preserve empty values
          }
          row--;
        }
      }
      
    } else {
    }

    // Map Page 3 data if Page3 worksheet exists
    const page3Worksheet = workbook.getWorksheet('Page3');
    if (page3Worksheet) {
      // Inspected By (B42)
      page3Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';

      // Inspection Date (B43) - format as DD/MM/YYYY
      page3Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

      // Verified By (M42)
      page3Worksheet.getCell('M42').value = data.verified_by || 'Not Verified';

      // Verified Date (M43) - format as DD/MM/YYYY
      page3Worksheet.getCell('M43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';

      // Film Inspection Form Ref No (O3)
      page3Worksheet.getCell('O3').value = data.ref_no || '';
      
      // Equipment data for Page 3 (D6)
      if (data.equipment_used && data.equipment_used.page3) {
        page3Worksheet.getCell('D6').value = data.equipment_used.page3.common || '';
      }
      
      // Page 3 data mapping - Elongation CD, Force CD, and Modulus data - fill from bottom up
      // Elongation CD 1 data to column D (D9-D38)
      if (data.page3_elongation_cd_1) {
        const elongationData = data.page3_elongation_cd_1;
        const dataValues = Object.values(elongationData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page3Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[i];
          row--;
        }
      }
      
      // Elongation CD 2 data to column E (E9-E38) - fill from bottom up
      if (data.page3_elongation_cd_2) {
        const elongationData = data.page3_elongation_cd_2;
        const dataValues = Object.values(elongationData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page3Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[i];
          row--;
        }
      }
      
      // Elongation CD 3 data to column F (F9-F38) - fill from bottom up
      if (data.page3_elongation_cd_3) {
        const elongationData = data.page3_elongation_cd_3;
        const dataValues = Object.values(elongationData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page3Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[i];
          row--;
        }
      }
      
      // Force CD 1 data to column H (H9-H38) - fill from bottom up
      if (data.page3_force_cd_1) {
        const forceData = data.page3_force_cd_1;
        const dataValues = Object.values(forceData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page3Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : dataValues[i];
          row--;
        }
      }
      
      // Force CD 2 data to column I (I9-I38) - fill from bottom up
      if (data.page3_force_cd_2) {
        const forceData = data.page3_force_cd_2;
        const dataValues = Object.values(forceData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page3Worksheet.getCell(`I${row}`).value = !isNaN(numValue) ? numValue : dataValues[i];
          row--;
        }
      }
      
      // Force CD 3 data to column J (J9-J38) - fill from bottom up
      if (data.page3_force_cd_3) {
        const forceData = data.page3_force_cd_3;
        const dataValues = Object.values(forceData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page3Worksheet.getCell(`J${row}`).value = !isNaN(numValue) ? numValue : dataValues[i];
          row--;
        }
      }
      
      // Modulus 1 data to column L (L9-L38) - fill from bottom up
      if (data.page3_modulus_1) {
        const modulusData = data.page3_modulus_1;
        const dataValues = Object.values(modulusData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page3Worksheet.getCell(`L${row}`).value = !isNaN(numValue) ? numValue : dataValues[i];
          row--;
        }
      }
      
      // Modulus 2 data to column M (M9-M38) - fill from bottom up
      if (data.page3_modulus_2) {
        const modulusData = data.page3_modulus_2;
        const dataValues = Object.values(modulusData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page3Worksheet.getCell(`M${row}`).value = !isNaN(numValue) ? numValue : dataValues[i];
          row--;
        }
      }
      
      // Modulus 3 data to column N (N9-N38) - fill from bottom up
      if (data.page3_modulus_3) {
        const modulusData = data.page3_modulus_3;
        const dataValues = Object.values(modulusData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page3Worksheet.getCell(`N${row}`).value = !isNaN(numValue) ? numValue : dataValues[i];
          row--;
        }
      }
      
    } else {
    }

    // Map Page 4 data if Page4 worksheet exists
    const page4Worksheet = workbook.getWorksheet('Page4');
    if (page4Worksheet) {
      // Inspected By (B42)
      page4Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';

      // Inspection Date (B43) - format as DD/MM/YYYY
      page4Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

      // Verified By (M42)
      page4Worksheet.getCell('M42').value = data.verified_by || 'Not Verified';

      // Verified Date (M43) - format as DD/MM/YYYY
      page4Worksheet.getCell('M43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';

      // Film Inspection Form Ref No (O3)
      page4Worksheet.getCell('O3').value = data.ref_no || '';
      
      // Equipment data for Page 4 (D6)
      if (data.equipment_used && data.equipment_used.page4) {
        page4Worksheet.getCell('D6').value = data.equipment_used.page4.gloss || '';
      }
      
      // Page 4 data mapping - Gloss and PG Quality data - fill from bottom up
      // Gloss 1 data to column D (D9-D38)
      if (data.page4_gloss_1) {
        const glossData = data.page4_gloss_1;
        const dataValues = Object.values(glossData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page4Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[i];
          row--;
        }
      }
      
      // Gloss 2 data to column E (E9-E38) - fill from bottom up
      if (data.page4_gloss_2) {
        const glossData = data.page4_gloss_2;
        const dataValues = Object.values(glossData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page4Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[i];
          row--;
        }
      }
      
      // Gloss 3 data to column F (F9-F38) - fill from bottom up
      if (data.page4_gloss_3) {
        const glossData = data.page4_gloss_3;
        const dataValues = Object.values(glossData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page4Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[i];
          row--;
        }
      }
      
      // PG Quality data to column H (H9-H38) - fill from bottom up
      if (data.page4_pg_quality) {
        const pgQualityData = data.page4_pg_quality;
        const dataValues = Object.values(pgQualityData).filter(value => value !== null && value !== undefined && value !== '');
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page4Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : dataValues[i];
          row--;
        }
      }
      
    } else {
    }

    // 5. Apply password protection using hybrid approach
    const buffer = await applyPasswordProtection(workbook);
    
    // 6. Set response headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Generate filename with standardized format: FIF-{product_code}-
    const productCode = data.product_code || 'UNKNOWN';
    const filename = `FIF-${productCode}-.xlsx`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // 7. Send the protected workbook to response
    res.send(buffer);

  } catch (error) {
    console.error('Error exporting 168-16CP Kranti form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting 168-16CP Kranti form: ${error.message}`);
  }
});
// APE-168(16)C White Film Inspection Form Excel Export Endpoint
app.get('/export-168-16c-white-form', async (req, res) => {
  try {
    // Get authenticated Supabase client using JWT from request
    const supabase = createAuthenticatedSupabaseClient(req);
    
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    // 1. Fetch data from Supabase for the specific form
    const { data, error } = await supabase
      .from('168_16c_white')
      .select('*')
      .eq('form_id', form_id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).send('Error fetching data from database');
    }

    if (!data) {
      return res.status(404).send('Form not found');
    }

    // 2. Load the template
    const templatePath = path.join(__dirname, 'templates', '168-16c-white.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let worksheet;

    // Load the template file
    try {
      workbook = await (async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(templatePath); return wb; })();
      worksheet = workbook.getWorksheet('Page1');
    } catch (error) {
      console.log('Error loading template:', error.message);
      workbook = await XlsxPopulate.fromBlankAsync();
      const page1Worksheet = workbook.addWorksheet('Page1');
      worksheet = page1Worksheet;
    }

    // 3. Map data to Excel cells

    // Product Code (B4)
    worksheet.getCell('B4').value = data.product_code || '';

    // Specification (B5)
    worksheet.getCell('B5').value = data.specification || '';

    // Production Order (G4)
    worksheet.getCell('G4').value = data.production_order || '';

    // Purchase Order (G5)
    worksheet.getCell('G5').value = data.purchase_order || '';

    // Machine (J4)
    worksheet.getCell('J4').value = data.machine_no || '';

    // Quantity (J5) - Add "Rolls" text like prestore form
    worksheet.getCell('J5').value = data.quantity ? `${data.quantity} Rolls` : '';

    // Production Date (N4) - format as DD/MM/YYYY
    worksheet.getCell('N4').value = data.production_date ? formatDateToDDMMYYYY(data.production_date) : '';

    // Inspection Date (N5) - format as DD/MM/YYYY
    worksheet.getCell('N5').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Inspected By (B41)
    worksheet.getCell('B41').value = data.prepared_by || 'Unknown User';

    // Inspection Date (B42) - format as DD/MM/YYYY
    worksheet.getCell('B42').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Verified By (L41)
    worksheet.getCell('L41').value = data.verified_by || 'Not Verified';

    // Verified Date (L42) - format as DD/MM/YYYY
    worksheet.getCell('L42').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';

    // Film Inspection Form Ref No (O3)
    worksheet.getCell('O3').value = data.ref_no || '';

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Basic Weight Equipment (D6)
      worksheet.getCell('D6').value = equipment.basic_weight || '';

      // Thickness Equipment (G6)
      worksheet.getCell('G6').value = equipment.thickness || '';

      // Opacity Equipment (J6)
      worksheet.getCell('J6').value = equipment.opacity || '';

      // COF Equipment (M6)
      worksheet.getCell('M6').value = equipment.cof || '';
    }

    // Map sample data to the correct columns

    // Sample data should go in rows 8-37 (30 rows) - preserve HTML form structure
    // Top rows (8-25): Historical data, Bottom rows (26-37): Fresh data
    // Lot & Roll data to Sample No. column (A8-A37)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`A${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`A${row}`).value = ''; // Empty row
        }
      }
    }

    // Roll ID data to column B (B8-B37) - preserve HTML form structure
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`B${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`B${row}`).value = ''; // Empty row
        }
      }
    }

    // Lot Time data to column C (C8-C37) - preserve HTML form structure
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`C${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`C${row}`).value = ''; // Empty row
        }
      }
    }

    // Basic Weight data to column D (D8-D37)
    if (data.page1_basis_weight) {
      const basicWeightData = data.page1_basis_weight;
      const dataValues = Object.values(basicWeightData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`D${row}`).value = '';
        }
      }
    }

    // Thickness data to column G (G8-G37)
    if (data.page1_thickness) {
      const thicknessData = data.page1_thickness;
      const dataValues = Object.values(thicknessData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`G${row}`).value = '';
        }
      }
    }

    // Opacity data to column J (J8-J37)
    if (data.page1_opacity) {
      const opacityData = data.page1_opacity;
      const dataValues = Object.values(opacityData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`J${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`J${row}`).value = '';
        }
      }
    }

    // COF data to column M (M8-M37)
    if (data.page1_cof_kinetic) {
      const cofData = data.page1_cof_kinetic;
      const dataValues = Object.values(cofData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`M${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`M${row}`).value = '';
        }
      }
    }


    // Map Page 2 data if Page2 worksheet exists
    const page2Worksheet = workbook.getWorksheet('Page2');
    if (page2Worksheet) {
      // Copy header info to Page 2
      page2Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';
      page2Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page2Worksheet.getCell('M42').value = data.verified_by || 'Not Verified';
      page2Worksheet.getCell('M43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page2Worksheet.getCell('O3').value = data.ref_no || '';

      // Equipment data for Page 2 (D6)
      if (data.equipment_used && data.equipment_used.page2) {
        page2Worksheet.getCell('D6').value = data.equipment_used.page2.common || '';
      }

      // Page 2 data mapping - Elongation MD and Force MD data - fill from bottom up
      // Elongation MD 1 data to column D (D9-D38)
      if (data.page2_elongation_md_1) {
        const elongationData = data.page2_elongation_md_1;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`D${row}`).value = '';
          }
          row--;
        }
      }

      // Elongation MD 2 data to column E (E9-E38)
      if (data.page2_elongation_md_2) {
        const elongationData = data.page2_elongation_md_2;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`E${row}`).value = '';
          }
          row--;
        }
      }

      // Elongation MD 3 data to column F (F9-F38)
      if (data.page2_elongation_md_3) {
        const elongationData = data.page2_elongation_md_3;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`F${row}`).value = '';
          }
          row--;
        }
      }

      // Force MD 1 data to column H (H9-H38)
      if (data.page2_force_md_1) {
        const forceData = data.page2_force_md_1;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`H${row}`).value = '';
          }
          row--;
        }
      }

      // Force MD 2 data to column I (I9-I38)
      if (data.page2_force_md_2) {
        const forceData = data.page2_force_md_2;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`I${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`I${row}`).value = '';
          }
          row--;
        }
      }

      // Force MD 3 data to column J (J9-J38)
      if (data.page2_force_md_3) {
        const forceData = data.page2_force_md_3;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`J${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`J${row}`).value = '';
          }
          row--;
        }
      }

      // Force 5% MD 1 data to column L (L9-L38)
      if (data.page2_force_5p_md_1) {
        const forceData = data.page2_force_5p_md_1;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`L${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`L${row}`).value = '';
          }
          row--;
        }
      }

      // Force 5% MD 2 data to column M (M9-M38)
      if (data.page2_force_5p_md_2) {
        const forceData = data.page2_force_5p_md_2;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`M${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`M${row}`).value = '';
          }
          row--;
        }
      }

      // Force 5% MD 3 data to column N (N9-N38)
      if (data.page2_force_5p_md_3) {
        const forceData = data.page2_force_5p_md_3;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`N${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`N${row}`).value = '';
          }
          row--;
        }
      }
    }

    // Map Page 3 data if Page3 worksheet exists
    const page3Worksheet = workbook.getWorksheet('Page3');
    if (page3Worksheet) {
      // Copy header info to Page 3
      page3Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';
      page3Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page3Worksheet.getCell('M42').value = data.verified_by || 'Not Verified';
      page3Worksheet.getCell('M43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page3Worksheet.getCell('O3').value = data.ref_no || '';

      // Equipment data for Page 3 (D6)
      if (data.equipment_used && data.equipment_used.page3) {
        page3Worksheet.getCell('D6').value = data.equipment_used.page3.common || '';
      }

      // Page 3 data mapping - Elongation CD and Force CD data - fill from bottom up
      // Elongation CD 1 data to column D (D9-D38)
      if (data.page3_elongation_cd_1) {
        const elongationData = data.page3_elongation_cd_1;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page3Worksheet.getCell(`D${row}`).value = '';
          }
          row--;
        }
      }

      // Elongation CD 2 data to column E (E9-E38)
      if (data.page3_elongation_cd_2) {
        const elongationData = data.page3_elongation_cd_2;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page3Worksheet.getCell(`E${row}`).value = '';
          }
          row--;
        }
      }

      // Elongation CD 3 data to column F (F9-F38)
      if (data.page3_elongation_cd_3) {
        const elongationData = data.page3_elongation_cd_3;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page3Worksheet.getCell(`F${row}`).value = '';
          }
          row--;
        }
      }

      // Force CD 1 data to column H (H9-H38)
      if (data.page3_force_cd_1) {
        const forceData = data.page3_force_cd_1;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page3Worksheet.getCell(`H${row}`).value = '';
          }
          row--;
        }
      }

      // Force CD 2 data to column I (I9-I38)
      if (data.page3_force_cd_2) {
        const forceData = data.page3_force_cd_2;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.getCell(`I${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page3Worksheet.getCell(`I${row}`).value = '';
          }
          row--;
        }
      }

      // Force CD 3 data to column J (J9-J38)
      if (data.page3_force_cd_3) {
        const forceData = data.page3_force_cd_3;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.getCell(`J${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page3Worksheet.getCell(`J${row}`).value = '';
          }
          row--;
        }
      }

      // Modulus 1 data to column L (L9-L38)
      if (data.page3_modulus_1) {
        const modulusData = data.page3_modulus_1;
        const dataValues = Object.values(modulusData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.getCell(`L${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page3Worksheet.getCell(`L${row}`).value = '';
          }
          row--;
        }
      }

      // Modulus 2 data to column M (M9-M38)
      if (data.page3_modulus_2) {
        const modulusData = data.page3_modulus_2;
        const dataValues = Object.values(modulusData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.getCell(`M${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page3Worksheet.getCell(`M${row}`).value = '';
          }
          row--;
        }
      }

      // Modulus 3 data to column N (N9-N38)
      if (data.page3_modulus_3) {
        const modulusData = data.page3_modulus_3;
        const dataValues = Object.values(modulusData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.getCell(`N${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page3Worksheet.getCell(`N${row}`).value = '';
          }
          row--;
        }
      }
    }

    // Map Page 4 data if Page4 worksheet exists
    const page4Worksheet = workbook.getWorksheet('Page4');
    if (page4Worksheet) {
      // Copy header info to Page 4
      page4Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';
      page4Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page4Worksheet.getCell('M42').value = data.verified_by || 'Not Verified';
      page4Worksheet.getCell('M43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page4Worksheet.getCell('O3').value = data.ref_no || '';

      // Equipment data for Page 4 (D6, L6)
      if (data.equipment_used && data.equipment_used.page4) {
        page4Worksheet.getCell('D6').value = data.equipment_used.page4.color_common || '';
        page4Worksheet.getCell('L6').value = data.equipment_used.page4.gloss || '';
      }

      // Page 4 data mapping - Color and Gloss data - fill from bottom up
      // Color L data to column D (D9-D38)
      if (data.page4_color_l) {
        const colorData = data.page4_color_l;
        const dataValues = Object.values(colorData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page4Worksheet.getCell(`D${row}`).value = '';
          }
          row--;
        }
      }

      // Color A data to column F (F9-F38)
      if (data.page4_color_a) {
        const colorData = data.page4_color_a;
        const dataValues = Object.values(colorData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page4Worksheet.getCell(`F${row}`).value = '';
          }
          row--;
        }
      }

      // Color B data to column H (H9-H38)
      if (data.page4_color_b) {
        const colorData = data.page4_color_b;
        const dataValues = Object.values(colorData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page4Worksheet.getCell(`H${row}`).value = '';
          }
          row--;
        }
      }

      // Color Delta E data to column J (J9-J38)
      if (data.page4_color_delta_e) {
        const colorData = data.page4_color_delta_e;
        const dataValues = Object.values(colorData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.getCell(`J${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page4Worksheet.getCell(`J${row}`).value = '';
          }
          row--;
        }
      }

      // Gloss 1 data to column L (L9-L38)
      if (data.page4_gloss_1) {
        const glossData = data.page4_gloss_1;
        const dataValues = Object.values(glossData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.getCell(`L${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page4Worksheet.getCell(`L${row}`).value = '';
          }
          row--;
        }
      }

      // Gloss 2 data to column M (M9-M38)
      if (data.page4_gloss_2) {
        const glossData = data.page4_gloss_2;
        const dataValues = Object.values(glossData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.getCell(`M${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page4Worksheet.getCell(`M${row}`).value = '';
          }
          row--;
        }
      }

      // Gloss 3 data to column N (N9-N38)
      if (data.page4_gloss_3) {
        const glossData = data.page4_gloss_3;
        const dataValues = Object.values(glossData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.getCell(`N${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page4Worksheet.getCell(`N${row}`).value = '';
          }
          row--;
        }
      }
    }

    // Map Page 5 data if Page5 worksheet exists
    const page5Worksheet = workbook.getWorksheet('Page5');
    if (page5Worksheet) {
      // Copy header info to Page 5
      page5Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';
      page5Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page5Worksheet.getCell('M42').value = data.verified_by || 'Not Verified';
      page5Worksheet.getCell('M43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page5Worksheet.getCell('O3').value = data.ref_no || '';

      // Equipment data for Page 5 (D6)
      if (data.equipment_used && data.equipment_used.page5) {
        page5Worksheet.getCell('D6').value = data.equipment_used.page5.common || '';
      }

      // Page 5 data mapping - PG Quality data - fill from bottom up
      // PG Quality data to column D (D9-D38)
      if (data.page5_pg_quality) {
        const pgQualityData = data.page5_pg_quality;
        const dataValues = Object.values(pgQualityData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            // Convert to number (0 or 1) to ensure proper number formatting in Excel
            const numValue = parseInt(value);
            page5Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : '';
          } else {
            page5Worksheet.getCell(`D${row}`).value = '';
          }
          row--;
        }
      }
    }

    // 4. Generate filename with standardized format: FIF-{product_code}-
    const productCode = data.product_code || 'UNKNOWN';
    const filename = `FIF-${productCode}-.xlsx`;

    // 5. Set response headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // 6. Write the workbook to response
    const buffer = await applyPasswordProtection(workbook);
    res.send(buffer);

  } catch (error) {
    console.error('Error exporting APE-168(16)C White form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting APE-168(16)C White form: ${error.message}`);
  }
});
// APE-168(18)C (Jeddah) Film Inspection Form Excel Export Endpoint
app.get('/export-168-18c-white-jeddah-form', async (req, res) => {
  try {
    // Get authenticated Supabase client using JWT from request
    const supabase = createAuthenticatedSupabaseClient(req);
    
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    // 1. Fetch data from Supabase for the specific form
    // First try the Jeddah table
    let { data, error } = await supabase
      .from('168_18c_white_jeddah')
      .select('*')
      .eq('form_id', form_id)
      .single();

    // If not found in Jeddah table, try the regular 168 table
    if (error && (error.code === 'PGRST116' || error.message?.includes('No rows found'))) {
      console.log(`Form ${form_id} not found in Jeddah table, trying regular 168 table...`);

      const { data: regularData, error: regularError } = await supabase
        .from('168_18c_white')
        .select('*')
        .eq('form_id', form_id)
        .single();

      if (regularError) {
        console.error('Supabase error in regular table:', regularError);
        return res.status(404).send('Form not found in either Jeddah or regular 168 table');
      }

      if (!regularData) {
        return res.status(404).send('Form not found');
      }

      // Check if this is actually a Jeddah form
      if (regularData.product_code && regularData.product_code.includes('Jeddah')) {
        console.log(`Found form ${form_id} in regular table but it appears to be a Jeddah form. Consider moving it to Jeddah table.`);
      }

      data = regularData;
      error = null;
    }

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).send('Error fetching data from database');
    }

    if (!data) {
      return res.status(404).send('Form not found');
    }


    // 2. Load the template
    const templatePath = path.join(__dirname, 'templates', '168-18c-white-jeddah.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let worksheet;

    // Load the template file
    try {
      workbook = await (async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(templatePath); return wb; })();
      worksheet = workbook.getWorksheet('Page1');
      
      // If Jeddah template doesn't have Page5, try to load from P&G template
      let hasPage5 = false;
      try {
        workbook.getWorksheet('Page5');
        hasPage5 = true;
      } catch (error) {
        // Page5 doesn't exist - will need to create it or skip
        hasPage5 = false;
      }
      
      if (!hasPage5) {
        // Page5 doesn't exist in Jeddah template, copy from P&G template
        const pgTemplatePath = path.join(__dirname, 'templates', 'Inline-inspection-form.xlsx');
        if (fs.existsSync(pgTemplatePath)) {
          try {
            const pgWorkbook = await XlsxPopulate.fromFileAsync(pgTemplatePath);
            const page5Sheet = pgWorkbook.getWorksheet('Page5');
            if (page5Sheet) {
              // Clone the sheet - add a new sheet with same structure
              const newPage5 = workbook.addWorksheet('Page5');
              // Copy dimensions
              page5Sheet.columns().forEach((col, colIndex) => {
                newPage5.column(colIndex + 1).width(col.width());
              });
              // Copy cell values and formatting from original
              page5Sheet.usedRange().forEach(cell => {
                const newCell = newPage5.getCell(cell.address());
                newCell.value(cell.value());
                if (cell.style()) {
                  newCell.style(cell.style());
                }
              });
              console.log('Page5 structure copied from P&G template to Jeddah workbook');
            }
          } catch (pgError) {
            console.log('Could not copy Page5 from P&G template:', pgError.message);
            // Continue - code below will handle missing Page5
          }
        }
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      console.log('Error stack:', error.stack);
      return res.status(500).send(`Error loading template: ${error.message}`);
    }

    // 3. Map data to Excel cells

    // Product Code (B4) - Clean product code for Jeddah (remove "(Jeddah)" part)
    let cleanedProductCode = data.product_code || '';
    if (cleanedProductCode.toLowerCase().includes('jeddah')) {
      cleanedProductCode = cleanedProductCode.replace(/\s*\([^)]*jeddah[^)]*\)/gi, '').trim();
    }
    worksheet.getCell('B4').value = cleanedProductCode;

    // Specification (B5)
    worksheet.getCell('B5').value = data.specification || '';

    // Production Order (F4)
    worksheet.getCell('F4').value = data.production_order || '';

    // Purchase Order (F5)
    worksheet.getCell('F5').value = data.purchase_order || '';

    // Machine (J4)
    worksheet.getCell('J4').value = data.machine_no || '';

    // Quantity (J5) - Add "Rolls" text like prestore form
    worksheet.getCell('J5').value = data.quantity ? `${data.quantity} Rolls` : '';

    // Production Date (N4) - format as DD/MM/YYYY
    worksheet.getCell('N4').value = data.production_date ? formatDateToDDMMYYYY(data.production_date) : '';

    // Inspection Date (N5) - format as DD/MM/YYYY
    worksheet.getCell('N5').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Inspected By (B41)
    worksheet.getCell('B41').value = data.prepared_by || 'Unknown User';

    // Inspection Date (B42) - format as DD/MM/YYYY
    worksheet.getCell('B42').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Verified By (L41)
    worksheet.getCell('L41').value = data.verified_by || 'Not Verified';

    // Verified Date (L42) - format as DD/MM/YYYY
    worksheet.getCell('L42').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';

    // Film Inspection Form Ref No (O3)
    worksheet.getCell('O3').value = data.ref_no || '';

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Basic Weight Equipment (D6)
      worksheet.getCell('D6').value = equipment.basic_weight || '';

      // Thickness Equipment (G6)
      worksheet.getCell('G6').value = equipment.thickness || '';

      // Opacity Equipment (J6)
      worksheet.getCell('J6').value = equipment.opacity || '';

      // COF Equipment (M6)
      worksheet.getCell('M6').value = equipment.cof || '';
    }

    // Map sample data to the correct columns

    // Sample data should go in rows 8-37 (30 rows) - preserve HTML form structure
    // Top rows (8-25): Historical data, Bottom rows (26-37): Fresh data
    // Lot & Roll data to Sample No. column (A8-A37)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`A${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`A${row}`).value = ''; // Empty row
        }
      }
    }

    // Roll ID data to column B (B8-B37) - preserve HTML form structure
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`B${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`B${row}`).value = ''; // Empty row
        }
      }
    }

    // Lot Time data to column C (C8-C37) - preserve HTML form structure
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`C${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`C${row}`).value = ''; // Empty row
        }
      }
    }

    // Basic Weight data to column D (D8-D37)
    if (data.page1_basis_weight) {
      const basicWeightData = data.page1_basis_weight;
      const dataValues = Object.values(basicWeightData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`D${row}`).value = '';
        }
      }
    }

    // Thickness data to column G (G8-G37)
    if (data.page1_thickness) {
      const thicknessData = data.page1_thickness;
      const dataValues = Object.values(thicknessData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`G${row}`).value = '';
        }
      }
    }

    // Opacity data to column J (J8-J37)
    if (data.page1_opacity) {
      const opacityData = data.page1_opacity;
      const dataValues = Object.values(opacityData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`J${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`J${row}`).value = '';
        }
      }
    }

    // COF data to column M (M8-M37)
    if (data.page1_cof_kinetic) {
      const cofData = data.page1_cof_kinetic;
      const dataValues = Object.values(cofData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`M${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`M${row}`).value = '';
        }
      }
    }

    // PAGE 2 DATA MAPPING - APE-168(18)C (Jeddah) Page 2 data (Elongation & Force MD)
    const hasPage2Data = data.page2_elongation_md_1 || data.page2_force_md_1 || data.page2_force_5p_md_1;

    if (hasPage2Data) {

      // Create Page2 sheet if it doesn't exist
      try {
        page2Worksheet = workbook.getWorksheet('Page2');
      } catch (error) {
        // Page2 sheet doesn't exist, create it
        page2Worksheet = workbook.addWorksheet('Page2');
      }

      // Equipment data for Page 2 (D6)
      if (data.equipment_used && data.equipment_used.page2) {
        page2Worksheet.getCell('D6').value = data.equipment_used.page2.common || '';
      }

      // Elongation MD 1 data to column D (D9-D38)
      if (data.page2_elongation_md_1) {
        const elongationMD1Data = data.page2_elongation_md_1;

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationMD1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column D (rows 9-38) on Page2 sheet
        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9; // Convert to 0-based index
          page2Worksheet.getCell(`D${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Elongation MD 2 data to column E (E9-E38)
      if (data.page2_elongation_md_2) {
        const elongationMD2Data = data.page2_elongation_md_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationMD2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`E${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Elongation MD 3 data to column F (F9-F38)
      if (data.page2_elongation_md_3) {
        const elongationMD3Data = data.page2_elongation_md_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationMD3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`F${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force MD 1 data to column H (H9-H38)
      if (data.page2_force_md_1) {
        const forceMD1Data = data.page2_force_md_1;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceMD1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`H${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force MD 2 data to column I (I9-I38)
      if (data.page2_force_md_2) {
        const forceMD2Data = data.page2_force_md_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceMD2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`I${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force MD 3 data to column J (J9-J38)
      if (data.page2_force_md_3) {
        const forceMD3Data = data.page2_force_md_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceMD3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`J${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force 5% MD 1 data to column L (L9-L38)
      if (data.page2_force_5p_md_1) {
        const force5PMD1Data = data.page2_force_5p_md_1;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = force5PMD1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`L${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force 5% MD 2 data to column M (M9-M38)
      if (data.page2_force_5p_md_2) {
        const force5PMD2Data = data.page2_force_5p_md_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = force5PMD2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`M${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force 5% MD 3 data to column N (N9-N38)
      if (data.page2_force_5p_md_3) {
        const force5PMD3Data = data.page2_force_5p_md_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = force5PMD3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`N${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }

        // Add personnel information to Page 2
        page2Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';
        page2Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
        page2Worksheet.getCell('L42').value = data.verified_by || 'Not Verified';
        page2Worksheet.getCell('L43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
        page2Worksheet.getCell('O3').value = data.ref_no || '';
      }
    }

    // PAGE 3 DATA MAPPING - APE-168(18)C (Jeddah) Page 3 data (Elongation & Force CD, Modulus)
    const hasPage3Data = data.page3_elongation_cd_1 || data.page3_force_cd_1 || data.page3_modulus_1;

    if (hasPage3Data) {

      // Create Page3 sheet if it doesn't exist
      let page3Worksheet;
      try {
        page3Worksheet = workbook.getWorksheet('Page3');
      } catch (error) {
        // Page3 sheet doesn't exist, create it
        page3Worksheet = workbook.addWorksheet('Page3');
      }

      // Equipment data for Page 3 (D6)
      if (data.equipment_used && data.equipment_used.page3) {
        page3Worksheet.getCell('D6').value = data.equipment_used.page3.common || '';
      }

      // Elongation CD 1 data to column D (D9-D38)
      if (data.page3_elongation_cd_1) {
        const elongationCD1Data = data.page3_elongation_cd_1;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationCD1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`D${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Elongation CD 2 data to column E (E9-E38)
      if (data.page3_elongation_cd_2) {
        const elongationCD2Data = data.page3_elongation_cd_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationCD2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`E${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Elongation CD 3 data to column F (F9-F38)
      if (data.page3_elongation_cd_3) {
        const elongationCD3Data = data.page3_elongation_cd_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationCD3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`F${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force CD 1 data to column H (H9-H38)
      if (data.page3_force_cd_1) {
        const forceCD1Data = data.page3_force_cd_1;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceCD1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`H${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force CD 2 data to column I (I9-I38)
      if (data.page3_force_cd_2) {
        const forceCD2Data = data.page3_force_cd_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceCD2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`I${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force CD 3 data to column J (J9-J38)
      if (data.page3_force_cd_3) {
        const forceCD3Data = data.page3_force_cd_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceCD3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`J${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Modulus 1 data to column L (L9-L38)
      if (data.page3_modulus_1) {
        const modulus1Data = data.page3_modulus_1;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = modulus1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`L${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Modulus 2 data to column M (M9-M38)
      if (data.page3_modulus_2) {
        const modulus2Data = data.page3_modulus_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = modulus2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`M${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Modulus 3 data to column N (N8-N37)
      if (data.page3_modulus_3) {
        const modulus3Data = data.page3_modulus_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = modulus3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`N${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }

        // Add personnel information to Page 3
        page3Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';
        page3Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
        page3Worksheet.getCell('L42').value = data.verified_by || 'Not Verified';
        page3Worksheet.getCell('L43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
        page3Worksheet.getCell('O3').value = data.ref_no || '';
      }
    }

    // PAGE 4 DATA MAPPING - APE-168(18)C (Jeddah) Page 4 data (Color & Gloss)
    const hasPage4Data = data.page4_color_l || data.page4_color_a || data.page4_color_b ||
                         data.page4_color_delta_e || data.page4_gloss_1 || data.page4_gloss_2 || data.page4_gloss_3;

    if (hasPage4Data) {

      // Create Page4 sheet if it doesn't exist
      let page4Worksheet;
      try {
        page4Worksheet = workbook.getWorksheet('Page4');
      } catch (error) {
        // Page4 sheet doesn't exist, create it
        page4Worksheet = workbook.addWorksheet('Page4');
      }

      // Equipment data for Page 4 (D6, L6)
      if (data.equipment_used && data.equipment_used.page4) {
        page4Worksheet.getCell('D6').value = data.equipment_used.page4.color_common || '';
        page4Worksheet.getCell('L6').value = data.equipment_used.page4.gloss || '';
      }

      // Color L data to column D (D9-D38)
      if (data.page4_color_l) {
        const colorLData = data.page4_color_l;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorLData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`D${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Color A data to column F (F9-F38)
      if (data.page4_color_a) {
        const colorAData = data.page4_color_a;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorAData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`F${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Color B data to column H (H9-H38)
      if (data.page4_color_b) {
        const colorBData = data.page4_color_b;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorBData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`H${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Color Delta E data to column J (J9-J38)
      if (data.page4_color_delta_e) {
        const colorDeltaEData = data.page4_color_delta_e;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorDeltaEData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`J${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Gloss 1 data to column L (L9-L38)
      if (data.page4_gloss_1) {
        const gloss1Data = data.page4_gloss_1;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = gloss1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`L${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Gloss 2 data to column M (M9-M38)
      if (data.page4_gloss_2) {
        const gloss2Data = data.page4_gloss_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = gloss2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`M${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Gloss 3 data to column N (N9-N38)
      if (data.page4_gloss_3) {
        const gloss3Data = data.page4_gloss_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = gloss3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`N${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }

        // Add personnel information to Page 4
        page4Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';
        page4Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
        page4Worksheet.getCell('L42').value = data.verified_by || 'Not Verified';
        page4Worksheet.getCell('L43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
        page4Worksheet.getCell('O3').value = data.ref_no || '';
      }
    }

    // PAGE 5 DATA MAPPING - APE-168(18)C (Jeddah) Page 5 data (PG Quality)
    if (data.page5_pg_quality) {
      // Get Page5 sheet (should exist from template copy above)
      let page5Worksheet;
      try {
        page5Worksheet = workbook.getWorksheet('Page5');
      } catch (error) {
        console.log('Page5 sheet not found, creating blank sheet');
        page5Worksheet = workbook.addWorksheet('Page5');
      }

      // PG Quality data to column D (D9-D38)
      const pgQualityData = data.page5_pg_quality;

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // 0-29
        const key = (dataIndex + 1).toString(); // Convert to 1-30 (matching JSONB object keys)
        const value = pgQualityData[key];
        
        if (value && value !== '' && value !== null && value !== undefined) {
          // Convert to number (0 or 1) to ensure proper number formatting in Excel
          const numValue = parseInt(value);
          page5Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : '';
        } else {
          page5Worksheet.getCell(`D${row}`).value = '';
        }
      }

      // Add personnel information to Page 5
      page5Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';
      page5Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page5Worksheet.getCell('L42').value = data.verified_by || 'Not Verified';
      page5Worksheet.getCell('L43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page5Worksheet.getCell('O3').value = data.ref_no || '';
    }

    // 4. Generate filename and set response headers
    const productCode = data.product_code || 'APE-168(18)C-Jeddah';

    // Clean product code for filename (remove "(Jeddah)" part)
    let cleanedProdCode = productCode;
    if (cleanedProdCode.toLowerCase().includes('jeddah')) {
      cleanedProdCode = cleanedProdCode.replace(/\s*\([^)]*jeddah[^)]*\)/gi, '').trim();
    }

    const filename = `FIF-${cleanedProdCode}-.xlsx`;

    // 5. Set response headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // 6. Write the workbook to response
    try {
      const buffer = await applyPasswordProtection(workbook);
      res.send(buffer);
    } catch (excelError) {
      console.error('Error generating Excel file:', excelError);
      console.error('Error stack:', excelError.stack);
      res.status(500).send(`Error generating Excel file: ${excelError.message}`);
    }

  } catch (error) {
    console.error('Error exporting APE-168(18)C (Jeddah) form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting APE-168(18)C (Jeddah) form: ${error.message}`);
  }
});
// APE-168(18)C White Film Inspection Form Excel Export Endpoint
app.get('/export-168-18c-white-form', async (req, res) => {
  try {
    // Get authenticated Supabase client using JWT from request
    const supabase = createAuthenticatedSupabaseClient(req);
    
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    // 1. Fetch data from Supabase for the specific form
    const { data, error } = await supabase
      .from('168_18c_white')
      .select('*')
      .eq('form_id', form_id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).send('Error fetching data from database');
    }

    if (!data) {
      return res.status(404).send('Form not found');
    }


    // 2. Load the template
    const templatePath = path.join(__dirname, 'templates', '168-18c-white.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let worksheet;

    // Load the template file
    try {
      workbook = await (async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(templatePath); return wb; })();
      worksheet = workbook.getWorksheet('Page1');
    } catch (error) {
      console.log('Error loading template:', error.message);
      console.log('Error stack:', error.stack);
      return res.status(500).send(`Error loading template: ${error.message}`);
    }

    // 3. Map data to Excel cells

    // Product Code (B4)
    worksheet.getCell('B4').value = data.product_code || '';

    // Specification (B5)
    worksheet.getCell('B5').value = data.specification || '';

    // Production Order (F4)
    worksheet.getCell('F4').value = data.production_order || '';

    // Purchase Order (F5)
    worksheet.getCell('F5').value = data.purchase_order || '';

    // Machine (J4)
    worksheet.getCell('J4').value = data.machine_no || '';

    // Quantity (J5) - Add "Rolls" text like prestore form
    worksheet.getCell('J5').value = data.quantity ? `${data.quantity} Rolls` : '';

    // Production Date (N4) - format as DD/MM/YYYY
    worksheet.getCell('N4').value = data.production_date ? formatDateToDDMMYYYY(data.production_date) : '';

    // Inspection Date (N5) - format as DD/MM/YYYY
    worksheet.getCell('N5').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Inspected By (B41)
    worksheet.getCell('B41').value = data.prepared_by || 'Unknown User';

    // Inspection Date (B42) - format as DD/MM/YYYY
    worksheet.getCell('B42').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Verified By (L41)
    worksheet.getCell('L41').value = data.verified_by || 'Not Verified';

    // Verified Date (L42) - format as DD/MM/YYYY
    worksheet.getCell('L42').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';

    // Film Inspection Form Ref No (O3)
    worksheet.getCell('O3').value = data.ref_no || '';

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Basic Weight Equipment (D6)
      worksheet.getCell('D6').value = equipment.basic_weight || '';

      // Thickness Equipment (G6)
      worksheet.getCell('G6').value = equipment.thickness || '';

      // Opacity Equipment (J6)
      worksheet.getCell('J6').value = equipment.opacity || '';

      // COF Equipment (M6)
      worksheet.getCell('M6').value = equipment.cof || '';
    }

    // Map sample data to the correct columns

    // Sample data should go in rows 8-37 (30 rows) - preserve HTML form structure
    // Top rows (8-25): Historical data, Bottom rows (26-37): Fresh data
    // Lot & Roll data to Sample No. column (A8-A37)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`A${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`A${row}`).value = ''; // Empty row
        }
      }
    }

    // Roll ID data to column B (B8-B37) - preserve HTML form structure
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`B${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`B${row}`).value = ''; // Empty row
        }
      }
    }

    // Lot Time data to column C (C8-C37) - preserve HTML form structure
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`C${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`C${row}`).value = ''; // Empty row
        }
      }
    }

    // Basic Weight data to column D (D8-D37)
    if (data.page1_basis_weight) {
      const basicWeightData = data.page1_basis_weight;
      const dataValues = Object.values(basicWeightData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`D${row}`).value = '';
        }
      }
    }

    // Thickness data to column G (G8-G37)
    if (data.page1_thickness) {
      const thicknessData = data.page1_thickness;
      const dataValues = Object.values(thicknessData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`G${row}`).value = '';
        }
      }
    }

    // Opacity data to column J (J8-J37)
    if (data.page1_opacity) {
      const opacityData = data.page1_opacity;
      const dataValues = Object.values(opacityData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`J${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`J${row}`).value = '';
        }
      }
    }

    // COF data to column M (M8-M37)
    if (data.page1_cof_kinetic) {
      const cofData = data.page1_cof_kinetic;
      const dataValues = Object.values(cofData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`M${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`M${row}`).value = '';
        }
      }
    }

    // PAGE 2 DATA MAPPING - APE-168(18)C White Page 2 data (Elongation & Force MD)
    const hasPage2Data = data.page2_elongation_md_1 || data.page2_force_md_1 || data.page2_force_5p_md_1;

    if (hasPage2Data) {

      // Create Page2 sheet if it doesn't exist
      try {
        page2Worksheet = workbook.getWorksheet('Page2');
      } catch (error) {
        // Page2 sheet doesn't exist, create it
        page2Worksheet = workbook.addWorksheet('Page2');
      }

      // Equipment data for Page 2 (D6)
      if (data.equipment_used && data.equipment_used.page2) {
        page2Worksheet.getCell('D6').value = data.equipment_used.page2.common || '';
      }

      // Elongation MD 1 data to column D (D9-D38)
      if (data.page2_elongation_md_1) {
        const elongationMD1Data = data.page2_elongation_md_1;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationMD1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`D${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Elongation MD 2 data to column E (E9-E38)
      if (data.page2_elongation_md_2) {
        const elongationMD2Data = data.page2_elongation_md_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationMD2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`E${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Elongation MD 3 data to column F (F9-F38)
      if (data.page2_elongation_md_3) {
        const elongationMD3Data = data.page2_elongation_md_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationMD3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`F${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force MD 1 data to column H (H9-H38)
      if (data.page2_force_md_1) {
        const forceMD1Data = data.page2_force_md_1;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceMD1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`H${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force MD 2 data to column I (I9-I38)
      if (data.page2_force_md_2) {
        const forceMD2Data = data.page2_force_md_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceMD2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`I${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force MD 3 data to column J (J9-J38)
      if (data.page2_force_md_3) {
        const forceMD3Data = data.page2_force_md_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceMD3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`J${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force 5% MD 1 data to column L (L9-L38)
      if (data.page2_force_5p_md_1) {
        const force5PMD1Data = data.page2_force_5p_md_1;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = force5PMD1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`L${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force 5% MD 2 data to column M (M9-M38)
      if (data.page2_force_5p_md_2) {
        const force5PMD2Data = data.page2_force_5p_md_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = force5PMD2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`M${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force 5% MD 3 data to column N (N9-N38)
      if (data.page2_force_5p_md_3) {
        const force5PMD3Data = data.page2_force_5p_md_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = force5PMD3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`N${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Add personnel information to Page 2
      page2Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';
      page2Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page2Worksheet.getCell('L42').value = data.verified_by || 'Not Verified';
      page2Worksheet.getCell('L43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page2Worksheet.getCell('O3').value = data.ref_no || '';
    }

    // PAGE 3 DATA MAPPING - APE-168(18)C White Page 3 data (Elongation & Force CD, Modulus)
    const hasPage3Data = data.page3_elongation_cd_1 || data.page3_force_cd_1 || data.page3_modulus_1;

    if (hasPage3Data) {

      // Create Page3 sheet if it doesn't exist
      let page3Worksheet;
      try {
        page3Worksheet = workbook.getWorksheet('Page3');
      } catch (error) {
        // Page3 sheet doesn't exist, create it
        page3Worksheet = workbook.addWorksheet('Page3');
      }

      // Equipment data for Page 3 (D6)
      if (data.equipment_used && data.equipment_used.page3) {
        page3Worksheet.getCell('D6').value = data.equipment_used.page3.common || '';
      }

      // Elongation CD 1 data to column D (D9-D38)
      if (data.page3_elongation_cd_1) {
        const elongationCD1Data = data.page3_elongation_cd_1;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationCD1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`D${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Elongation CD 2 data to column E (E9-E38)
      if (data.page3_elongation_cd_2) {
        const elongationCD2Data = data.page3_elongation_cd_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationCD2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`E${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Elongation CD 3 data to column F (F9-F38)
      if (data.page3_elongation_cd_3) {
        const elongationCD3Data = data.page3_elongation_cd_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationCD3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`F${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force CD 1 data to column H (H9-H38)
      if (data.page3_force_cd_1) {
        const forceCD1Data = data.page3_force_cd_1;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceCD1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`H${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force CD 2 data to column I (I9-I38)
      if (data.page3_force_cd_2) {
        const forceCD2Data = data.page3_force_cd_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceCD2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`I${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force CD 3 data to column J (J9-J38)
      if (data.page3_force_cd_3) {
        const forceCD3Data = data.page3_force_cd_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceCD3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`J${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Modulus 1 data to column L (L9-L38)
      if (data.page3_modulus_1) {
        const modulus1Data = data.page3_modulus_1;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = modulus1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`L${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Modulus 2 data to column M (M9-M38)
      if (data.page3_modulus_2) {
        const modulus2Data = data.page3_modulus_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = modulus2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`M${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Modulus 3 data to column N (N8-N37)
      if (data.page3_modulus_3) {
        const modulus3Data = data.page3_modulus_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = modulus3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`N${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Add personnel information to Page 3
      page3Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';
      page3Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page3Worksheet.getCell('L42').value = data.verified_by || 'Not Verified';
      page3Worksheet.getCell('L43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page3Worksheet.getCell('O3').value = data.ref_no || '';
    }

    // PAGE 4 DATA MAPPING - APE-168(18)C White Page 4 data (Color & Gloss)
    const hasPage4Data = data.page4_color_l || data.page4_color_a || data.page4_color_b ||
                         data.page4_color_delta_e || data.page4_gloss_1 || data.page4_gloss_2 || data.page4_gloss_3;

    if (hasPage4Data) {

      // Create Page4 sheet if it doesn't exist
      let page4Worksheet;
      try {
        page4Worksheet = workbook.getWorksheet('Page4');
      } catch (error) {
        // Page4 sheet doesn't exist, create it
        page4Worksheet = workbook.addWorksheet('Page4');
      }

      // Equipment data for Page 4 (D6, L6)
      if (data.equipment_used && data.equipment_used.page4) {
        page4Worksheet.getCell('D6').value = data.equipment_used.page4.color_common || '';
        page4Worksheet.getCell('L6').value = data.equipment_used.page4.gloss || '';
      }

      // Color L data to column D (D9-D38)
      if (data.page4_color_l) {
        const colorLData = data.page4_color_l;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorLData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`D${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Color A data to column F (F9-F38)
      if (data.page4_color_a) {
        const colorAData = data.page4_color_a;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorAData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`F${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Color B data to column H (H9-H38)
      if (data.page4_color_b) {
        const colorBData = data.page4_color_b;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorBData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`H${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Color Delta E data to column J (J9-J38)
      if (data.page4_color_delta_e) {
        const colorDeltaEData = data.page4_color_delta_e;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorDeltaEData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`J${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Gloss 1 data to column L (L9-L38)
      if (data.page4_gloss_1) {
        const gloss1Data = data.page4_gloss_1;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = gloss1Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`L${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Gloss 2 data to column M (M9-M38)
      if (data.page4_gloss_2) {
        const gloss2Data = data.page4_gloss_2;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = gloss2Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`M${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Gloss 3 data to column N (N9-N38)
      if (data.page4_gloss_3) {
        const gloss3Data = data.page4_gloss_3;

        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = gloss3Data[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`N${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Add personnel information to Page 4
      page4Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';
      page4Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page4Worksheet.getCell('L42').value = data.verified_by || 'Not Verified';
      page4Worksheet.getCell('L43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page4Worksheet.getCell('O3').value = data.ref_no || '';
    }

    // NOTE: Skipping Page 5 (PG Quality) as it doesn't exist for 18gsm 168 white form

    // 4. Generate filename and set response headers
    const productCode = data.product_code || 'APE-168(18)C-White';

    const filename = `FIF-${productCode}-.xlsx`;

    // 5. Set response headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // 6. Write the workbook to response
    try {
      const buffer = await applyPasswordProtection(workbook);
      res.send(buffer);
    } catch (excelError) {
      console.error('Error generating Excel file:', excelError);
      console.error('Error stack:', excelError.stack);
      res.status(500).send(`Error generating Excel file: ${excelError.message}`);
    }

  } catch (error) {
    console.error('Error exporting APE-168(18)C White form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting APE-168(18)C White form: ${error.message}`);
  }
});
// APE-176(18)CP(LCC+WW)BS Film Inspection Form Excel Export Endpoint
app.get('/export-176-18cp-ww-form', async (req, res) => {
  try {
    // Get authenticated Supabase client using JWT from request
    const supabase = createAuthenticatedSupabaseClient(req);
    
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    const { data, error } = await supabase
      .from('176_18cp_ww')
      .select('*')
      .eq('form_id', form_id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).send('Error fetching data from database');
    }

    if (!data) {
      return res.status(404).send('Form not found');
    }

    // 2. Load the template
    const templatePath = path.join(__dirname, 'templates', '176-18cp-ww.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let worksheet;

    // Load the template file
    try {
      workbook = await (async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(templatePath); return wb; })();
      worksheet = workbook.getWorksheet('Page1');
    } catch (error) {
      console.log('Error loading template:', error.message);
      workbook = await XlsxPopulate.fromBlankAsync();
      const page1Worksheet = workbook.addWorksheet('Page1');
      worksheet = page1Worksheet;
    }

    // 3. Map data to Excel cells

    // Product Code (B4)
    worksheet.getCell('B4').value = data.product_code || '';

    // Specification (B5)
    worksheet.getCell('B5').value = data.specification || '';

    // Production Order (G4)
    worksheet.getCell('G4').value = data.production_order || '';

    // Purchase Order (G5)
    worksheet.getCell('G5').value = data.purchase_order || '';

    // Machine (J4)
    worksheet.getCell('J4').value = data.machine_no || '';

    // Quantity (J5) - Add "Rolls" text like prestore form
    worksheet.getCell('J5').value = data.quantity ? `${data.quantity} Rolls` : '';

    // Production Date (N4) - format as DD/MM/YYYY
    worksheet.getCell('N4').value = data.production_date ? formatDateToDDMMYYYY(data.production_date) : '';

    // Inspection Date (N5) - format as DD/MM/YYYY
    worksheet.getCell('N5').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Inspected By (B41)
    worksheet.getCell('B41').value = data.prepared_by || 'Unknown User';

    // Inspection Date (B42) - format as DD/MM/YYYY
    worksheet.getCell('B42').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Verified By (M41)
    worksheet.getCell('M41').value = data.verified_by || 'Not Verified';

    // Verified Date (M42) - format as DD/MM/YYYY
    worksheet.getCell('M42').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';

    // Film Inspection Form Ref No (O3)
    worksheet.getCell('O3').value = data.ref_no || '';

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      // Parse JSON data if it's a string, otherwise use as is
      const equipment = typeof data.equipment_used.page1 === 'string'
        ? JSON.parse(data.equipment_used.page1)
        : data.equipment_used.page1;

      // Basic Weight Equipment (D6)
      worksheet.getCell('D6').value = equipment.basic_weight || '';

      // Thickness Equipment (F6)
      worksheet.getCell('F6').value = equipment.thickness || '';

      // Opacity Equipment (H6)
      worksheet.getCell('H6').value = equipment.opacity || '';

      // COF Equipment (J6)
      worksheet.getCell('J6').value = equipment.cof || '';

      // Cut Width Equipment (L6)
      worksheet.getCell('L6').value = equipment.cut_width || '';

      // Color Equipment (N6)
      worksheet.getCell('N6').value = equipment.color_unprinted || '';
    }

    // Map sample data to the correct columns

    // Sample data should go in rows 8-37 (30 rows) - preserve HTML form structure
    // Top rows (8-25): Historical data, Bottom rows (26-37): Fresh data
    // Lot & Roll data to Sample No. column (A8-A37)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`A${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`A${row}`).value = ''; // Empty row
        }
      }
    }

    // Roll ID data to column B (B8-B37) - preserve HTML form structure
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`B${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`B${row}`).value = ''; // Empty row
        }
      }
    }

    // Lot Time data to column C (C8-C37) - preserve HTML form structure
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`C${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`C${row}`).value = ''; // Empty row
        }
      }
    }

    // Map page1 data to the measurement columns - preserve HTML form structure
    // Basic Weight data to column D (D8-D37)
    if (data.page1_basis_weight) {
      const basicWeightData = data.page1_basis_weight;
      const dataValues = Object.values(basicWeightData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`D${row}`).value = '';
        }
      }
    }

    // Thickness data to column F (F8-F37)
    if (data.page1_thickness) {
      const thicknessData = data.page1_thickness;
      const dataValues = Object.values(thicknessData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`F${row}`).value = '';
        }
      }
    }

    // Opacity data to column H (H8-H37)
    if (data.page1_opacity) {
      const opacityData = data.page1_opacity;
      const dataValues = Object.values(opacityData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`H${row}`).value = '';
        }
      }
    }

    // COF Kinetic data to column J (J8-J37)
    if (data.page1_cof_kinetic) {
      const cofData = data.page1_cof_kinetic;
      const dataValues = Object.values(cofData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`J${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`J${row}`).value = '';
        }
      }
    }

    // Cut Width data to column L (L8-L37)
    if (data.page1_cut_width) {
      const cutWidthData = data.page1_cut_width;
      const dataValues = Object.values(cutWidthData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`L${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`L${row}`).value = '';
        }
      }
    }

    // Color Unprinted data to column N (N8-N37)
    if (data.page1_color_delta_unprinted) {
      const colorUnprintedData = data.page1_color_delta_unprinted;
      const dataValues = Object.values(colorUnprintedData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`N${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`N${row}`).value = '';
        }
      }
    }

    // Color-Delta E (Printed Film) data to column O (O8-O37)
    if (data.page1_color_delta_printed) {
      const colorPrintedData = data.page1_color_delta_printed;
      const dataValues = Object.values(colorPrintedData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          worksheet.getCell(`O${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          worksheet.getCell(`O${row}`).value = '';
        }
      }
    }

    // Map Page 2 data if Page2 worksheet exists
    const page2Worksheet = workbook.getWorksheet('Page2');
    if (page2Worksheet) {
      // Copy header info to Page 2
      page2Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';
      page2Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page2Worksheet.getCell('M42').value = data.verified_by || 'Not Verified';
      page2Worksheet.getCell('M43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page2Worksheet.getCell('O3').value = data.ref_no || '';

      // Equipment data for Page 2 (D6)
      if (data.equipment_used && data.equipment_used.page2) {
        page2Worksheet.getCell('D6').value = data.equipment_used.page2.common || '';
      }

      // Page 2 data mapping - Elongation MD and Force MD data - fill from bottom up
      // Elongation MD 1 data to column D (D9-D38)
      if (data.page2_elongation_md_1) {
        const elongationData = data.page2_elongation_md_1;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`D${row}`).value = '';
          }
          row--;
        }
      }

      // Elongation MD 2 data to column E (E9-E38)
      if (data.page2_elongation_md_2) {
        const elongationData = data.page2_elongation_md_2;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`E${row}`).value = '';
          }
          row--;
        }
      }

      // Elongation MD 3 data to column F (F9-F38)
      if (data.page2_elongation_md_3) {
        const elongationData = data.page2_elongation_md_3;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`F${row}`).value = '';
          }
          row--;
        }
      }

      // Force MD 1 data to column H (H9-H38)
      if (data.page2_force_md_1) {
        const forceData = data.page2_force_md_1;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`H${row}`).value = '';
          }
          row--;
        }
      }

      // Force MD 2 data to column I (I9-I38)
      if (data.page2_force_md_2) {
        const forceData = data.page2_force_md_2;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`I${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`I${row}`).value = '';
          }
          row--;
        }
      }

      // Force MD 3 data to column J (J9-J38)
      if (data.page2_force_md_3) {
        const forceData = data.page2_force_md_3;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`J${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`J${row}`).value = '';
          }
          row--;
        }
      }

      // Force 5% MD 1 data to column L (L9-L38)
      if (data.page2_force_5p_md_1) {
        const forceData = data.page2_force_5p_md_1;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`L${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`L${row}`).value = '';
          }
          row--;
        }
      }

      // Force 5% MD 2 data to column M (M9-M38)
      if (data.page2_force_5p_md_2) {
        const forceData = data.page2_force_5p_md_2;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`M${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`M${row}`).value = '';
          }
          row--;
        }
      }

      // Force 5% MD 3 data to column N (N9-N38)
      if (data.page2_force_5p_md_3) {
        const forceData = data.page2_force_5p_md_3;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page2Worksheet.getCell(`N${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page2Worksheet.getCell(`N${row}`).value = '';
          }
          row--;
        }
      }
    }

    // Map Page 3 data if Page3 worksheet exists
    const page3Worksheet = workbook.getWorksheet('Page3');
    if (page3Worksheet) {
      // Copy header info to Page 3
      page3Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';
      page3Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page3Worksheet.getCell('M42').value = data.verified_by || 'Not Verified';
      page3Worksheet.getCell('M43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page3Worksheet.getCell('O3').value = data.ref_no || '';

      // Equipment data for Page 3 (D6)
      if (data.equipment_used && data.equipment_used.page3) {
        page3Worksheet.getCell('D6').value = data.equipment_used.page3.common || '';
      }

      // Page 3 data mapping - Elongation CD and Force CD data - fill from bottom up
      // Elongation CD 1 data to column D (D9-D38)
      if (data.page3_elongation_cd_1) {
        const elongationData = data.page3_elongation_cd_1;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page3Worksheet.getCell(`D${row}`).value = '';
          }
          row--;
        }
      }

      // Elongation CD 2 data to column E (E9-E38)
      if (data.page3_elongation_cd_2) {
        const elongationData = data.page3_elongation_cd_2;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page3Worksheet.getCell(`E${row}`).value = '';
          }
          row--;
        }
      }

      // Elongation CD 3 data to column F (F9-F38)
      if (data.page3_elongation_cd_3) {
        const elongationData = data.page3_elongation_cd_3;
        const dataValues = Object.values(elongationData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page3Worksheet.getCell(`F${row}`).value = '';
          }
          row--;
        }
      }

      // Force CD 1 data to column H (H9-H38)
      if (data.page3_force_cd_1) {
        const forceData = data.page3_force_cd_1;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page3Worksheet.getCell(`H${row}`).value = '';
          }
          row--;
        }
      }

      // Force CD 2 data to column I (I9-I38)
      if (data.page3_force_cd_2) {
        const forceData = data.page3_force_cd_2;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.getCell(`I${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page3Worksheet.getCell(`I${row}`).value = '';
          }
          row--;
        }
      }

      // Force CD 3 data to column J (J9-J38)
      if (data.page3_force_cd_3) {
        const forceData = data.page3_force_cd_3;
        const dataValues = Object.values(forceData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.getCell(`J${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page3Worksheet.getCell(`J${row}`).value = '';
          }
          row--;
        }
      }

      // Modulus 1 data to column L (L9-L38)
      if (data.page3_modulus_1) {
        const modulusData = data.page3_modulus_1;
        const dataValues = Object.values(modulusData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.getCell(`L${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page3Worksheet.getCell(`L${row}`).value = '';
          }
          row--;
        }
      }

      // Modulus 2 data to column M (M9-M38)
      if (data.page3_modulus_2) {
        const modulusData = data.page3_modulus_2;
        const dataValues = Object.values(modulusData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.getCell(`M${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page3Worksheet.getCell(`M${row}`).value = '';
          }
          row--;
        }
      }

      // Modulus 3 data to column N (N9-N38)
      if (data.page3_modulus_3) {
        const modulusData = data.page3_modulus_3;
        const dataValues = Object.values(modulusData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page3Worksheet.getCell(`N${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page3Worksheet.getCell(`N${row}`).value = '';
          }
          row--;
        }
      }
    }

    // Map Page 4 data if Page4 worksheet exists
    const page4Worksheet = workbook.getWorksheet('Page4');
    if (page4Worksheet) {
      // Copy header info to Page 4
      page4Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';
      page4Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page4Worksheet.getCell('M42').value = data.verified_by || 'Not Verified';
      page4Worksheet.getCell('M43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page4Worksheet.getCell('O3').value = data.ref_no || '';

      // Equipment data for Page 4 (D6)
      if (data.equipment_used && data.equipment_used.page4) {
        page4Worksheet.getCell('D6').value = data.equipment_used.page4.gloss || '';
      }

      // Page 4 data mapping - Gloss data only - fill from bottom up
      // Gloss 1 data to column D (D9-D38)
      if (data.page4_gloss_1) {
        const glossData = data.page4_gloss_1;
        const dataValues = Object.values(glossData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page4Worksheet.getCell(`D${row}`).value = '';
          }
          row--;
        }
      }

      // Gloss 2 data to column E (E9-E38)
      if (data.page4_gloss_2) {
        const glossData = data.page4_gloss_2;
        const dataValues = Object.values(glossData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page4Worksheet.getCell(`E${row}`).value = '';
          }
          row--;
        }
      }

      // Gloss 3 data to column F (F9-F38)
      if (data.page4_gloss_3) {
        const glossData = data.page4_gloss_3;
        const dataValues = Object.values(glossData);
        let row = 38;

        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const value = dataValues[i];
          if (value && value !== '') {
            const numValue = parseFloat(value);
            page4Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : value;
          } else {
            page4Worksheet.getCell(`F${row}`).value = '';
          }
          row--;
        }
      }
    }

    // 4. Generate filename with standardized format: FIF-{product_code}-
    const productCode = data.product_code || 'UNKNOWN';
    const filename = `FIF-${productCode}-.xlsx`;

    // 5. Set response headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // 6. Write the workbook to response
    const buffer = await applyPasswordProtection(workbook);
    res.send(buffer);

  } catch (error) {
    console.error('Error exporting APE-176(18)CP(LCC+WW)BS form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting APE-176(18)CP(LCC+WW)BS form: ${error.message}`);
  }
});
// Export 234-18-micro-white form endpoint
app.get('/export-234-18-micro-white-form', async (req, res) => {
  try {
    // Get authenticated Supabase client using JWT from request
    const supabase = createAuthenticatedSupabaseClient(req);
    
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    const { data, error } = await supabase
      .from('234_18_micro_white')
      .select('*')
      .eq('form_id', form_id)
      .single();

    if (error) {
      // Handle case where form doesn't exist in this table
      console.log('Supabase error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });

      if (error.code === 'PGRST116' || error.message?.includes('No rows found') || error.message?.includes('JSON object requested, multiple (or no) rows returned')) {
        console.log(`Form ${form_id} not found in 234_18_micro_white table`);
        return res.status(404).send('Form not found in 234 micro white table');
      }
      console.error('Supabase error:', error);
      return res.status(500).send('Error fetching data from database');
    }

    if (!data) {
      return res.status(404).send('Form not found');
    }


    // 2. Load the template
    const templatePath = path.join(__dirname, 'templates', '234-18-micro-white.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let worksheet;
    let page2Worksheet;

    // Load the template file
    try {
      workbook = await (async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(templatePath); return wb; })();
      worksheet = workbook.getWorksheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.getWorksheet('Page2');
      } catch (error) {
        // Page2 sheet doesn't exist, create it by copying Page1 structure
        page2Worksheet = workbook.addWorksheet('Page2');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      workbook = await XlsxPopulate.fromBlankAsync();
      const page1Worksheet = workbook.addWorksheet('Page1');
      worksheet = page1Worksheet;
      page2Worksheet = workbook.addWorksheet('Page2');
      console.log('Created both Page1 and Page2 sheets');
    }

    // 3. Map data to Excel cells

    // Product Code (C4)
    worksheet.getCell('C4').value = data.product_code || '';

    // Specification (C5)
    worksheet.getCell('C5').value = data.specification || '';

    // Production Order (F4)
    worksheet.getCell('F4').value = data.production_order || '';

    // Purchase Order (F5)
    worksheet.getCell('F5').value = data.purchase_order || '';

    // Machine (H4)
    worksheet.getCell('H4').value = data.machine_no || '';

    // Quantity (H5) - Add "Rolls" text like prestore form
    worksheet.getCell('H5').value = data.quantity ? `${data.quantity} Rolls` : '';

    // Production Date (L4) - format as DD/MM/YYYY
    worksheet.getCell('L4').value = data.production_date ? formatDateToDDMMYYYY(data.production_date) : '';

    // Inspection Date (L5) - format as DD/MM/YYYY
    worksheet.getCell('L5').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Inspected By (B42)
    worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';

    // Inspection Date (B43) - format as DD/MM/YYYY (duplicate for verification)
    worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Verified By (I42)
    worksheet.getCell('I42').value = data.verified_by || 'Not Verified';

    // Verified Date (I43) - format as DD/MM/YYYY
    worksheet.getCell('I43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';

    // Film Inspection Form Ref No (L3)
    worksheet.getCell('L3').value = data.ref_no || '';

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Basic Weight Equipment (D6)
      worksheet.getCell('D6').value = equipment.basic_weight || '';

      // COF Equipment (E6) - Template shows COF in column E
      worksheet.getCell('E6').value = equipment.cof_rr || equipment.cof_rs || '';

      // Opacity Equipment (G6) - Template shows Opacity in column G
      worksheet.getCell('G6').value = equipment.opacity || '';

      // Modulus Equipment (H6) - Template shows Modulus in column H
      worksheet.getCell('H6').value = equipment.modulus || '';

      // Gloss Equipment (L6) - Template shows Gloss in column L
      worksheet.getCell('L6').value = equipment.gloss || '';
    }

    // Map sample data to the correct columns - WHITE-234(18) has only Page 1 and Page 2

    // Sample data should go in rows 9-38 (30 rows) - Updated to match template
    // Top rows (9-27): Historical data, Bottom rows (28-38): Fresh data
    // Lot & Roll data to Sample No. column (A9-A38)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`A${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`A${row}`).value = ''; // Empty row
        }
      }
    }

    // Roll ID data to column B (B9-B38) - Updated to match template
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`B${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`B${row}`).value = ''; // Empty row
        }
      }
    }

    // Lot Time data to column C (C9-C38) - Updated to match template
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`C${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`C${row}`).value = ''; // Empty row
        }
      }
    }

    // PAGE 1 DATA MAPPING - WHITE-234(18) has different field structure
    // Basic Weight data to column D (D9-D38)
    if (data.page1_basis_weight) {
      const basicWeightData = data.page1_basis_weight;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = basicWeightData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column D (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.getCell(`D${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }


    // Opacity data to column G (G9-G38) - Template shows Opacity %
    if (data.page1_opacity) {
      const opacityData = data.page1_opacity;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = opacityData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column G (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.getCell(`G${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }

    // Modulus MD data - Separate columns for each modulus measurement
    // Modulus 1 data to column H (H9-H38)
    if (data.page1_modulus_1) {
      const modulus1Data = data.page1_modulus_1;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = modulus1Data[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column H (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.getCell(`H${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }

    // Modulus 2 data to column I (I9-I38)
    if (data.page1_modulus_2) {
      const modulus2Data = data.page1_modulus_2;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = modulus2Data[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column I (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.getCell(`I${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }

    // Modulus 3 data to column J (J9-J38)
    if (data.page1_modulus_3) {
      const modulus3Data = data.page1_modulus_3;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = modulus3Data[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column J (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.getCell(`J${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }

    // Gloss Level data to column L (L9-L38) - Template shows Gloss Level in column L
    if (data.page1_gloss) {
      const glossData = data.page1_gloss;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = glossData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column L (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.getCell(`L${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }

    // COF RR data to column E (E9-E38) - COF-Kinetic(R-R)
    if (data.page1_cof_kinetic_r_r) {
      const cofRRData = data.page1_cof_kinetic_r_r;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = cofRRData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column E (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.getCell(`E${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }

    // COF RS data to column F (F9-F38) - COF-Kinetic(R-S)
    if (data.page1_cof_kinetic_r_s) {
      const cofRSData = data.page1_cof_kinetic_r_s;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = cofRSData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column F (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.getCell(`F${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }

    // PAGE 2 DATA MAPPING - WHITE-234(18) Page 2 data (Force & Color measurements)
    // Based on template structure, this appears to be Page 2 with Force and Color data
    const hasPage2Data = data.page2_force_elongation_md_5p || data.page2_force_tensile_md ||
                        data.page2_force_elongation_cd_5p || data.page2_force_tensile_cd ||
                        data.page2_color_l || data.page2_color_a || data.page2_color_b || data.page2_color_delta_e;

    if (hasPage2Data) {

      // Create Page2 sheet if it doesn't exist
      try {
        page2Worksheet = workbook.getWorksheet('Page2');
      } catch (error) {
        // Page2 sheet doesn't exist, create it
        page2Worksheet = workbook.addWorksheet('Page2');
      }

      // Force Elongation MD 5% data to column D (D9-D38)
      if (data.page2_force_elongation_md_5p) {
        const forceElongationMD5PData = data.page2_force_elongation_md_5p;

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceElongationMD5PData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column D (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.getCell(`D${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force Tensile MD data to column E (E8-E37)
      if (data.page2_force_tensile_md) {
        const forceTensileMDData = data.page2_force_tensile_md;

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceTensileMDData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column E (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.getCell(`E${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force Elongation CD 5% data to column F (F8-F37)
      if (data.page2_force_elongation_cd_5p) {
        const forceElongationCD5PData = data.page2_force_elongation_cd_5p;

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceElongationCD5PData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column F (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.getCell(`F${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force Tensile CD data to column G (G8-G37)
      if (data.page2_force_tensile_cd) {
        const forceTensileCDData = data.page2_force_tensile_cd;

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceTensileCDData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column G (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.getCell(`G${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Color L data to column H (H8-H37)
      if (data.page2_color_l) {
        const colorLData = data.page2_color_l;

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorLData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column H (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.getCell(`H${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Color A data to column I (I8-I37)
      if (data.page2_color_a) {
        const colorAData = data.page2_color_a;

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorAData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column I (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.getCell(`I${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Color B data to column J (J8-J37)
      if (data.page2_color_b) {
        const colorBData = data.page2_color_b;

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorBData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column J (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.getCell(`J${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Color Delta E data to column K (K8-K37)
      if (data.page2_color_delta_e) {
        const colorDeltaEData = data.page2_color_delta_e;

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorDeltaEData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column K (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.getCell(`K${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Map Page 2 headers
      console.log('Mapping Page 2 headers');

    } else {
    }


    // PAGE 2 DATA MAPPING - WHITE-234(18) corrected mappings
    // Force-elongation-MD@5% data to column D (D8-D37) - WHITE-234(18) Page 2
    if (data.page2_force_elongation_md_5p) {
      const forceElongationMDData = data.page2_force_elongation_md_5p;
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        if (forceElongationMDData[key] && forceElongationMDData[key] !== '') {
          dataValues.push(forceElongationMDData[key]);
        } else {
          dataValues.push('');
        }
      }

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length && dataValues[dataIndex] !== '') {
          const numValue = parseFloat(dataValues[dataIndex]);
          page2Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page2Worksheet.getCell(`D${row}`).value = '';
        }
      }
    }

    // Force-Tensile Strength-MD-peak data to column E (E8-E37) - WHITE-234(18) Page 2
    if (data.page2_force_tensile_md) {
      const forceTensileMDData = data.page2_force_tensile_md;
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        if (forceTensileMDData[key] && forceTensileMDData[key] !== '') {
          dataValues.push(forceTensileMDData[key]);
        } else {
          dataValues.push('');
        }
      }

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length && dataValues[dataIndex] !== '') {
          const numValue = parseFloat(dataValues[dataIndex]);
          page2Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page2Worksheet.getCell(`E${row}`).value = '';
        }
      }
    }

    // Force-elongation-CD@5% data to column F (F8-F37) - WHITE-234(18) Page 2
    if (data.page2_force_elongation_cd_5p) {
      const forceElongationCDData = data.page2_force_elongation_cd_5p;
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        if (forceElongationCDData[key] && forceElongationCDData[key] !== '') {
          dataValues.push(forceElongationCDData[key]);
        } else {
          dataValues.push('');
        }
      }

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length && dataValues[dataIndex] !== '') {
          const numValue = parseFloat(dataValues[dataIndex]);
          page2Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page2Worksheet.getCell(`F${row}`).value = '';
        }
      }
    }

    // Force-Tensile Strength-CD-peak data to column G (G8-G37) - WHITE-234(18) Page 2
    if (data.page2_force_tensile_cd) {
      const forceTensileCDData = data.page2_force_tensile_cd;
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        if (forceTensileCDData[key] && forceTensileCDData[key] !== '') {
          dataValues.push(forceTensileCDData[key]);
        } else {
          dataValues.push('');
        }
      }

      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8;
        if (dataIndex < dataValues.length && dataValues[dataIndex] !== '') {
          const numValue = parseFloat(dataValues[dataIndex]);
          page2Worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page2Worksheet.getCell(`G${row}`).value = '';
        }
      }
    }

    // Color L data to column H (H8-H37)
    if (data.page2_color_l) {
      const colorLData = data.page2_color_l;
      console.log('Page 2 Color L Data:', colorLData);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = colorLData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column H (rows 8-37) on Page2 sheet
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        page2Worksheet.getCell(`H${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }

    // Color A data to column I (I8-I37)
    if (data.page2_color_a) {
      const colorAData = data.page2_color_a;
      console.log('Page 2 Color A Data:', colorAData);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = colorAData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column I (rows 8-37) on Page2 sheet
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        page2Worksheet.getCell(`I${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }

    // Color B data to column J (J8-J37)
    if (data.page2_color_b) {
      const colorBData = data.page2_color_b;
      console.log('Page 2 Color B Data:', colorBData);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = colorBData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column J (rows 8-37) on Page2 sheet
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        page2Worksheet.getCell(`J${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }

    // Color Delta E data to column K (K8-K37)
    if (data.page2_color_delta_e) {
      const colorDeltaEData = data.page2_color_delta_e;
      console.log('Page 2 Color Delta E Data:', colorDeltaEData);

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = colorDeltaEData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column K (rows 8-37) on Page2 sheet
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        page2Worksheet.getCell(`K${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    } else {
    }
    // Map Page 2 headers if Page2 sheet exists
    if (page2Worksheet) {
      console.log('Mapping Page 2 headers');

      // Inspected By (B41)
      page2Worksheet.getCell('B41').value = data.prepared_by || 'Unknown User';

      // Inspection Date (B42) - format as DD/MM/YYYY
      page2Worksheet.getCell('B42').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

      // Verified By (I41)
      page2Worksheet.getCell('I41').value = data.verified_by || 'Not Verified';

      // Verified Date (I42) - format as DD/MM/YYYY
      page2Worksheet.getCell('I42').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';

      // Film Inspection Form Ref No (K3)
      page2Worksheet.getCell('K3').value = data.ref_no || '';

      console.log('Page 2 headers mapped successfully');
    }

    // Map Page 2 equipment data if Page2 sheet exists
    if (page2Worksheet && data.equipment_used && data.equipment_used.page2) {
      console.log('Mapping Page 2 equipment data');

      const page2Equipment = data.equipment_used.page2;

      // UTM Machine (D6) - For force measurements
      page2Worksheet.getCell('D6').value = page2Equipment.force || '';

      // Spectro Photometer (H6) - For color measurements
      page2Worksheet.getCell('H6').value = page2Equipment.colour || '';

      console.log('Page 2 equipment data mapped successfully');
    }

    // 5. Set filename and headers
    // Create filename with format: FIF-ProductCode-.xlsx
    const productCode = data.product_code || '234-18-MICRO-WHITE';
    const filename = `FIF-${productCode}-.xlsx`;

    console.log('Filename:', filename);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // 6. Write the workbook to response
    console.log('About to write workbook to buffer...');
    const buffer = await applyPasswordProtection(workbook);
    console.log('Workbook buffer created, size:', buffer.length);
    res.send(buffer);
    console.log('Response sent successfully');

  } catch (error) {
    console.error('Error exporting WHITE-234(18) form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting WHITE-234(18) form: ${error.message}`);
  }
});

// Export 214-18-micro-white form endpoint
app.get('/export-214-18-micro-white-form', async (req, res) => {
  try {
    // Get authenticated Supabase client using JWT from request
    const supabase = createAuthenticatedSupabaseClient(req);
    
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    const { data, error } = await supabase
      .from('214_18_micro_white')
      .select('*')
      .eq('form_id', form_id)
      .single();

    if (error) {
      // Handle case where form doesn't exist in this table
      console.log('Supabase error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });

      if (error.code === 'PGRST116' || error.message?.includes('No rows found') || error.message?.includes('JSON object requested, multiple (or no) rows returned')) {
        console.log(`Form ${form_id} not found in 214_18_micro_white table`);
        return res.status(404).send('Form not found in 214 micro white table');
      }
      console.error('Supabase error:', error);
      return res.status(500).send('Error fetching data from database');
    }

    if (!data) {
      return res.status(404).send('Form not found');
    }


    // 2. Load the template
    const templatePath = path.join(__dirname, 'templates', '214-18-micro-white.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let worksheet;
    let page2Worksheet;

    // Load the template file
    try {
      workbook = await (async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(templatePath); return wb; })();
      worksheet = workbook.getWorksheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.getWorksheet('Page2');
      } catch (error) {
        // Page2 sheet doesn't exist, create it by copying Page1 structure
        page2Worksheet = workbook.addWorksheet('Page2');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      workbook = await XlsxPopulate.fromBlankAsync();
      const page1Worksheet = workbook.addWorksheet('Page1');
      worksheet = page1Worksheet;
      page2Worksheet = workbook.addWorksheet('Page2');
      console.log('Created both Page1 and Page2 sheets');
    }

    // 3. Map data to Excel cells

    // Product Code (C4)
    worksheet.getCell('C4').value = data.product_code || '';

    // Specification (C5)
    worksheet.getCell('C5').value = data.specification || '';

    // Production Order (F4)
    worksheet.getCell('F4').value = data.production_order || '';

    // Purchase Order (F5)
    worksheet.getCell('F5').value = data.purchase_order || '';

    // Machine (H4)
    worksheet.getCell('H4').value = data.machine_no || '';

    // Quantity (H5) - Add "Rolls" text like prestore form
    worksheet.getCell('H5').value = data.quantity ? `${data.quantity} Rolls` : '';

    // Production Date (L4) - format as DD/MM/YYYY
    worksheet.getCell('L4').value = data.production_date ? formatDateToDDMMYYYY(data.production_date) : '';

    // Inspection Date (L5) - format as DD/MM/YYYY
    worksheet.getCell('L5').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Inspected By (B42)
    worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';

    // Inspection Date (B43) - format as DD/MM/YYYY (duplicate for verification)
    worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Verified By (I42)
    worksheet.getCell('I42').value = data.verified_by || 'Not Verified';

    // Verified Date (I43) - format as DD/MM/YYYY
    worksheet.getCell('I43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';

    // Film Inspection Form Ref No (L3)
    worksheet.getCell('L3').value = data.ref_no || '';

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Basic Weight Equipment (D6)
      worksheet.getCell('D6').value = equipment.basic_weight || '';

      // COF Equipment (E6) - Template shows COF in column E
      worksheet.getCell('E6').value = equipment.cof_rr || equipment.cof_rs || '';

      // Opacity Equipment (G6) - Template shows Opacity in column G
      worksheet.getCell('G6').value = equipment.opacity || '';

      // Modulus Equipment (H6) - Template shows Modulus in column H
      worksheet.getCell('H6').value = equipment.modulus || '';

      // Gloss Equipment (L6) - Template shows Gloss in column L
      worksheet.getCell('L6').value = equipment.gloss || '';
    }

    // Map sample data to the correct columns - WHITE-214(18) has only Page 1 and Page 2

    // Sample data should go in rows 9-38 (30 rows) - Updated to match template
    // Top rows (9-27): Historical data, Bottom rows (28-38): Fresh data
    // Lot & Roll data to Sample No. column (A9-A38)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`A${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`A${row}`).value = ''; // Empty row
        }
      }
    }

    // Roll ID data to column B (B9-B38) - Updated to match template
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`B${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`B${row}`).value = ''; // Empty row
        }
      }
    }

    // Lot Time data to column C (C9-C38) - Updated to match template
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          worksheet.getCell(`C${row}`).value = dataValues[dataIndex];
        } else {
          worksheet.getCell(`C${row}`).value = ''; // Empty row
        }
      }
    }

    // PAGE 1 DATA MAPPING - WHITE-214(18) - Updated to match template structure
    // Basic Weight data to column D (D9-D38)
    if (data.page1_basis_weight) {
      const basicWeightData = data.page1_basis_weight;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = basicWeightData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column D (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.getCell(`D${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }


    // Opacity data to column G (G9-G38) - Template shows Opacity %
    if (data.page1_opacity) {
      const opacityData = data.page1_opacity;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = opacityData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column G (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.getCell(`G${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }

    // Modulus MD data - Separate columns for each modulus measurement
    // Modulus 1 data to column H (H9-H38)
    if (data.page1_modulus_1) {
      const modulus1Data = data.page1_modulus_1;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = modulus1Data[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column H (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.getCell(`H${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }

    // Modulus 2 data to column I (I9-I38)
    if (data.page1_modulus_2) {
      const modulus2Data = data.page1_modulus_2;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = modulus2Data[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column I (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.getCell(`I${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }

    // Modulus 3 data to column J (J9-J38)
    if (data.page1_modulus_3) {
      const modulus3Data = data.page1_modulus_3;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = modulus3Data[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column J (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.getCell(`J${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }

    // Gloss Level data to column L (L9-L38) - Template shows Gloss Level in column L
    if (data.page1_gloss) {
      const glossData = data.page1_gloss;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = glossData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column L (rows 9-38)
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        worksheet.getCell(`L${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }

    // PAGE 2 DATA MAPPING - WHITE-214(18) Page 2 data (Force & Color measurements)
    // Based on your screenshot, this appears to be Page 2 with Force and Color data
    const hasPage2Data = data.page2_force_elongation_md_5p || data.page2_force_tensile_md ||
                        data.page2_force_elongation_cd_5p || data.page2_force_tensile_cd ||
                        data.page2_color_l || data.page2_color_a || data.page2_color_b || data.page2_color_delta_e;

    if (hasPage2Data) {

      // Force Elongation MD 5% data to column D (D8-D37)
      if (data.page2_force_elongation_md_5p) {
        const forceElongationMD5PData = data.page2_force_elongation_md_5p;

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceElongationMD5PData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column D (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.getCell(`D${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force Tensile MD data to column E (E8-E37)
      if (data.page2_force_tensile_md) {
        const forceTensileMDData = data.page2_force_tensile_md;

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceTensileMDData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column E (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.getCell(`E${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force Elongation CD 5% data to column F (F8-F37)
      if (data.page2_force_elongation_cd_5p) {
        const forceElongationCD5PData = data.page2_force_elongation_cd_5p;

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceElongationCD5PData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column F (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.getCell(`F${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force Tensile CD data to column G (G8-G37)
      if (data.page2_force_tensile_cd) {
        const forceTensileCDData = data.page2_force_tensile_cd;

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceTensileCDData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column G (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.getCell(`G${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Color L data to column H (H8-H37)
      if (data.page2_color_l) {
        const colorLData = data.page2_color_l;

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorLData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column H (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.getCell(`H${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Color A data to column I (I8-I37)
      if (data.page2_color_a) {
        const colorAData = data.page2_color_a;

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorAData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column I (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.getCell(`I${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Color B data to column J (J8-J37)
      if (data.page2_color_b) {
        const colorBData = data.page2_color_b;

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorBData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column J (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.getCell(`J${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Color Delta E data to column K (K8-K37)
      if (data.page2_color_delta_e) {
        const colorDeltaEData = data.page2_color_delta_e;

        // Get data in correct order (keys 1-30)
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorDeltaEData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push(''); // Empty cell if no data
          }
        }

        // Fill the Excel column K (rows 8-37) on Page2 sheet
        for (let row = 8; row <= 37; row++) {
          const dataIndex = row - 8; // Convert to 0-based index
          page2Worksheet.getCell(`K${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }
    } else {
    }

    // Map Page 2 headers if Page2 sheet exists
    if (page2Worksheet) {
      console.log('Mapping Page 2 headers');

      // Inspected By (B41)
      page2Worksheet.getCell('B41').value = data.prepared_by || 'Unknown User';

      // Inspection Date (B42) - format as DD/MM/YYYY
      page2Worksheet.getCell('B42').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

      // Verified By (I41)
      page2Worksheet.getCell('I41').value = data.verified_by || 'Not Verified';

      // Verified Date (I42) - format as DD/MM/YYYY
      page2Worksheet.getCell('I42').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';

      // Film Inspection Form Ref No (K3)
      page2Worksheet.getCell('K3').value = data.ref_no || '';

      console.log('Page 2 headers mapped successfully');
    }

    // Map Page 2 equipment data if Page2 sheet exists
    if (page2Worksheet && data.equipment_used && data.equipment_used.page2) {
      console.log('Mapping Page 2 equipment data');

      const page2Equipment = data.equipment_used.page2;

      // UTM Machine (D6) - For force measurements
      page2Worksheet.getCell('D6').value = page2Equipment.force || '';

      // Spectro Photometer (H6) - For color measurements
      page2Worksheet.getCell('H6').value = page2Equipment.colour || '';

      console.log('Page 2 equipment data mapped successfully');
    }

    // 5. Set filename and headers
    // Create filename with format: FIF-ProductCode-BatchNo.xlsx
    const productCode = data.product_code || '214-18-MICRO-WHITE';
    const filename = `FIF-${productCode}-.xlsx`;

    console.log('Filename:', filename);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // 6. Write the workbook to response
    console.log('About to write workbook to buffer...');
    const buffer = await applyPasswordProtection(workbook);
    console.log('Workbook buffer created, size:', buffer.length);
    res.send(buffer);
    console.log('Response sent successfully');

  } catch (error) {
    console.error('Error exporting WHITE-214(18) form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting WHITE-214(18) form: ${error.message}`);
  }
});
// APE-102(18)C White Film Inspection Form Excel Export Endpoint
app.get('/export-102-18c-white-form', async (req, res) => {
  try {
    // Get authenticated Supabase client using JWT from request
    const supabase = createAuthenticatedSupabaseClient(req);
    
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    const { data, error } = await supabase
      .from('102_18c_micro_white')
      .select('*')
      .eq('form_id', form_id)
      .single();

    if (error) {
      // Handle case where form doesn't exist in this table
      console.log('Supabase error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });

      if (error.code === 'PGRST116' || error.message?.includes('No rows found') || error.message?.includes('JSON object requested, multiple (or no) rows returned')) {
        console.log(`Form ${form_id} not found in 102_18c_micro_white table`);
        return res.status(404).send('Form not found in 102 micro white table');
      }
      console.error('Supabase error:', error);
      return res.status(500).send('Error fetching data from database');
    }

    if (!data) {
      return res.status(404).send('Form not found');
    }

    // 2. Load the template
    const templatePath = path.join(__dirname, 'templates', '102-18c-white.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let page1Worksheet;
    let page2Worksheet;
    let page3Worksheet;
    let page4Worksheet;

    // Load the template file
    try {
      workbook = await (async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(templatePath); return wb; })();
      page1Worksheet = workbook.getWorksheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.getWorksheet('Page2');
      } catch (error) {
        // Page2 sheet doesn't exist, create it by copying Page1 structure
        page2Worksheet = workbook.addWorksheet('Page2');
      }

      // Create or get Page3 sheet for Page 3 data
      try {
        page3Worksheet = workbook.getWorksheet('Page3');
      } catch (error) {
        // Page3 sheet doesn't exist, create it
        page3Worksheet = workbook.addWorksheet('Page3');
      }

      // Create or get Page4 sheet for Page 4 data
      try {
        page4Worksheet = workbook.getWorksheet('Page4');
      } catch (error) {
        // Page4 sheet doesn't exist, create it
        page4Worksheet = workbook.addWorksheet('Page4');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      workbook = await XlsxPopulate.fromBlankAsync();
      page1Worksheet = workbook.addWorksheet('Page1');
      page2Worksheet = workbook.addWorksheet('Page2');
      page3Worksheet = workbook.addWorksheet('Page3');
      page4Worksheet = workbook.addWorksheet('Page4');
    }

    // 3. Map data to Excel cells for Page 1
    if (page1Worksheet) {
      // Product Code (B4)
      page1Worksheet.getCell('B4').value = data.product_code || '';

      // Specification (B5)
      page1Worksheet.getCell('B5').value = data.specification || '';

      // Production Order (F4)
      page1Worksheet.getCell('F4').value = data.production_order || '';

      // Purchase Order (F5)
      page1Worksheet.getCell('F5').value = data.purchase_order || '';

      // Machine (J4)
      page1Worksheet.getCell('J4').value = data.machine_no || '';

      // Quantity (J5) - Add "Rolls" text like prestore form
      page1Worksheet.getCell('J5').value = data.quantity ? `${data.quantity} Rolls` : '';

      // Production Date (N4) - format as DD/MM/YYYY
      page1Worksheet.getCell('N4').value = data.production_date ? formatDateToDDMMYYYY(data.production_date) : '';

      // Inspection Date (N5) - format as DD/MM/YYYY
      page1Worksheet.getCell('N5').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

      // Inspected By (B41)
      page1Worksheet.getCell('B41').value = data.prepared_by || 'Unknown User';

      // Inspection Date (B42) - format as DD/MM/YYYY (duplicate for verification)
      page1Worksheet.getCell('B42').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

      // Verified By (L41)
      page1Worksheet.getCell('L41').value = data.verified_by || 'Not Verified';

      // Verified Date (L42) - format as DD/MM/YYYY
      page1Worksheet.getCell('L42').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';

      // Film Inspection Form Ref No (O3)
      page1Worksheet.getCell('O3').value = data.ref_no || '';

      // Map equipment data to Excel cells
      if (data.equipment_used && data.equipment_used.page1) {
        const equipment = data.equipment_used.page1;

        // Basic Weight Equipment (D6)
        page1Worksheet.getCell('D6').value = equipment.basic_weight || '';

        // Thickness Equipment (G6)
        page1Worksheet.getCell('G6').value = equipment.thickness || '';

        // Opacity Equipment (J6)
        page1Worksheet.getCell('J6').value = equipment.opacity || '';

        // COF Equipment (M6)
        page1Worksheet.getCell('M6').value = equipment.cof || '';
      }
    }

    // Map sample data to the correct columns - WHITE-102(18) has Page 1, Page 2, Page 3, and Page 4

    // Sample data should go in rows 8-37 (30 rows) - Updated to match template
    // Top rows (8-26): Historical data, Bottom rows (27-37): Fresh data
    // Lot & Roll data to Sample No. column (A8-A37)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          page1Worksheet.getCell(`A${row}`).value = dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`A${row}`).value = ''; // Empty row
        }
      }
    }

    // Roll ID data to column B (B8-B37) - Updated to match template
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          page1Worksheet.getCell(`B${row}`).value = dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`B${row}`).value = ''; // Empty row
        }
      }
    }

    // Lot Time data to column C (C8-C37) - Updated to match template
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          page1Worksheet.getCell(`C${row}`).value = dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`C${row}`).value = ''; // Empty row
        }
      }
    }

    // PAGE 1 DATA MAPPING - WHITE-102(18) - Updated to match template structure
    // Basic Weight data to column D (D8-D37)
    if (data.page1_basis_weight) {
      const basicWeightData = data.page1_basis_weight;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = basicWeightData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column D (rows 8-37)
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        page1Worksheet.getCell(`D${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }

    // Thickness data to column G (G8-G37)
    if (data.page1_thickness) {
      const thicknessData = data.page1_thickness;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = thicknessData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column G (rows 8-37)
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        page1Worksheet.getCell(`G${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }

    // Opacity data to column J (J8-J37)
    if (data.page1_opacity) {
      const opacityData = data.page1_opacity;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = opacityData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column J (rows 8-37)
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        page1Worksheet.getCell(`J${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }

    // COF Kinetic data to column M (M8-M37)
    if (data.page1_cof_kinetic) {
      const cofKineticData = data.page1_cof_kinetic;

      // Get data in correct order (keys 1-30)
      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = cofKineticData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push(''); // Empty cell if no data
        }
      }

      // Fill the Excel column M (rows 8-37)
      for (let row = 8; row <= 37; row++) {
        const dataIndex = row - 8; // Convert to 0-based index
        page1Worksheet.getCell(`M${row}`).value = convertToNumber(dataValues[dataIndex] || '');
      }
    }

    // Now handle PAGE 2, 3, and 4 data mapping - WHITE-102(18) has 4 pages total

    // Map Page 2 data if Page2 worksheet exists
    if (page2Worksheet) {
      // Copy header info to Page 2
      page2Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';
      page2Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page2Worksheet.getCell('M42').value = data.verified_by || 'Not Verified';
      page2Worksheet.getCell('M43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page2Worksheet.getCell('O3').value = data.ref_no || '';

      // Equipment data for Page 2 (D6)
      if (data.equipment_used && data.equipment_used.page2) {
        page2Worksheet.getCell('D6').value = data.equipment_used.page2.common || '';
      }

      // Page 2 data mapping - Mechanical Properties MD - fill from top down (rows 9-38)
      // Elongation@ Break(%) MD 1 to column D (D9-D38)
      if (data.page2_elongation_md_1) {
        const elongationData = data.page2_elongation_md_1;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`D${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Elongation@ Break(%) MD 2 to column E (E9-E38)
      if (data.page2_elongation_md_2) {
        const elongationData = data.page2_elongation_md_2;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`E${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Elongation@ Break(%) MD 3 to column F (F9-F38)
      if (data.page2_elongation_md_3) {
        const elongationData = data.page2_elongation_md_3;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`F${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Continue with other Page 2 measurements...
      // Force Tensile Strength@Break(N)MD 1: H9-H38
      if (data.page2_force_md_1) {
        const forceData = data.page2_force_md_1;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`H${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force Tensile Strength@Break(N)MD 2: I9-I38
      if (data.page2_force_md_2) {
        const forceData = data.page2_force_md_2;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`I${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force Tensile Strength@Break(N)MD 3: J9-J38
      if (data.page2_force_md_3) {
        const forceData = data.page2_force_md_3;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`J${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force Elongation 5% (N) MD 1: L9-L38
      if (data.page2_force_5p_md_1) {
        const forceData = data.page2_force_5p_md_1;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`L${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force Elongation 5% (N) MD 2: M9-M38
      if (data.page2_force_5p_md_2) {
        const forceData = data.page2_force_5p_md_2;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`M${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force Elongation 5% (N) MD 3: N9-N38
      if (data.page2_force_5p_md_3) {
        const forceData = data.page2_force_5p_md_3;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page2Worksheet.getCell(`N${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }
    }

    // Map Page 3 data if Page3 worksheet exists
    if (page3Worksheet) {
      // Copy header info to Page 3
      page3Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';
      page3Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page3Worksheet.getCell('M42').value = data.verified_by || 'Not Verified';
      page3Worksheet.getCell('M43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page3Worksheet.getCell('O3').value = data.ref_no || '';

      // Equipment data for Page 3 (D6)
      if (data.equipment_used && data.equipment_used.page3) {
        page3Worksheet.getCell('D6').value = data.equipment_used.page3.common || '';
      }

      // Page 3 data mapping - Mechanical Properties CD - fill from top down (rows 9-38)
      // Elongation@ Break (%) CD 1 to column D (D9-D38)
      if (data.page3_elongation_cd_1) {
        const elongationData = data.page3_elongation_cd_1;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`D${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Elongation@ Break (%) CD 2 to column E (E9-E38)
      if (data.page3_elongation_cd_2) {
        const elongationData = data.page3_elongation_cd_2;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`E${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Elongation@ Break (%) CD 3 to column F (F9-F38)
      if (data.page3_elongation_cd_3) {
        const elongationData = data.page3_elongation_cd_3;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = elongationData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`F${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force-Tensile Strength@Break (N) CD 1: H9-H38
      if (data.page3_force_cd_1) {
        const forceData = data.page3_force_cd_1;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`H${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force-Tensile Strength@Break (N) CD 2: I9-I38
      if (data.page3_force_cd_2) {
        const forceData = data.page3_force_cd_2;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`I${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Force-Tensile Strength@Break (N) CD 3: J9-J38
      if (data.page3_force_cd_3) {
        const forceData = data.page3_force_cd_3;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = forceData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`J${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Modulus Web MD Fresh@2% 1: L9-L38
      if (data.page3_modulus_1) {
        const modulusData = data.page3_modulus_1;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = modulusData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`L${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Modulus Web MD Fresh@2% 2: M9-M38
      if (data.page3_modulus_2) {
        const modulusData = data.page3_modulus_2;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = modulusData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`M${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Modulus Web MD Fresh@2% 3: N9-N38
      if (data.page3_modulus_3) {
        const modulusData = data.page3_modulus_3;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = modulusData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page3Worksheet.getCell(`N${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }
    }
    // Map Page 4 data if Page4 worksheet exists
    if (page4Worksheet) {
      // Copy header info to Page 4
      page4Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';
      page4Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page4Worksheet.getCell('M42').value = data.verified_by || 'Not Verified';
      page4Worksheet.getCell('M43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page4Worksheet.getCell('O3').value = data.ref_no || '';

      // Equipment data for Page 4 (D6, L6)
      if (data.equipment_used && data.equipment_used.page4) {
        page4Worksheet.getCell('D6').value = data.equipment_used.page4.color_common || '';
        page4Worksheet.getCell('L6').value = data.equipment_used.page4.gloss || '';
      }

      // Page 4 data mapping - Optical Properties - fill from top down (rows 9-38)
      // Color L to column D (D9-D38)
      if (data.page4_color_l) {
        const colorData = data.page4_color_l;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`D${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Color A to column F (F9-F38)
      if (data.page4_color_a) {
        const colorData = data.page4_color_a;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`F${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Color B to column H (H9-H38)
      if (data.page4_color_b) {
        const colorData = data.page4_color_b;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`H${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Color Delta E to column J (J9-J38)
      if (data.page4_color_delta_e) {
        const colorData = data.page4_color_delta_e;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = colorData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`J${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Gloss 1 data to column L (L9-L38)
      if (data.page4_gloss_1) {
        const glossData = data.page4_gloss_1;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = glossData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`L${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Gloss 2 data to column M (M9-M38)
      if (data.page4_gloss_2) {
        const glossData = data.page4_gloss_2;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = glossData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`M${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Gloss 3 data to column N (N9-N38)
      if (data.page4_gloss_3) {
        const glossData = data.page4_gloss_3;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = glossData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`N${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Gloss Level 2 to column M (M9-M38)
      if (data.page4_gloss_2) {
        const glossData = data.page4_gloss_2;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = glossData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`M${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }

      // Gloss Level 3 to column N (N9-N38)
      if (data.page4_gloss_3) {
        const glossData = data.page4_gloss_3;
        const dataValues = [];
        for (let i = 1; i <= 30; i++) {
          const key = i.toString();
          const value = glossData[key];
          if (value && value !== '' && value !== null && value !== undefined) {
            dataValues.push(value);
          } else {
            dataValues.push('');
          }
        }

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          page4Worksheet.getCell(`N${row}`).value = convertToNumber(dataValues[dataIndex] || '');
        }
      }
    }

    // 4. Generate and send the Excel file
    const buffer = await applyPasswordProtection(workbook);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="FIF-${data.product_code || 'UNKNOWN'}-.xlsx"`);
    res.send(buffer);

  } catch (error) {
    console.error('Error exporting WHITE-102(18) form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting WHITE-102(18) form: ${error.message}`);
  }
});
};


