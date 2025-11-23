const XlsxPopulate = require('xlsx-populate');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration from environment variables
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://ufczydnvscaicygwlmhz.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmY3p5ZG52c2NhaWN5Z3dsbWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg5NDYsImV4cCI6MjA1OTc5NDk0Nn0.0TUriXYvPuml-Jzr9v1jvcuzKjh-cZgnZhYKkQEj3t0'
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

module.exports = function(app) {
  // 168-16CP Kranti Film Inspection Form Excel Export Endpoint
app.get('/export-168-16cp-kranti-form', async (req, res) => {
  try {
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
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      worksheet = workbook.sheet('Page1');
    } catch (error) {
      console.log('Error loading template:', error.message);
      workbook = await XlsxPopulate.fromBlankAsync();
      const page1Worksheet = workbook.addSheet('Page1');
      worksheet = page1Worksheet;
    }

    // 4. Map data to Excel cells
    
    // Product Code (C4)
    worksheet.cell('C4').value(data.product_code || '');
    
    // Specification (C5) 
    worksheet.cell('C5').value(data.specification || '');
    
    // Production Order (H4)
    worksheet.cell('H4').value(data.production_order || '');
    
    // Purchase Order (H5)
    worksheet.cell('H5').value(data.purchase_order || '');
    
    // Machine (K4)
    worksheet.cell('K4').value(data.machine_no || '');
    
    // Quantity (K5) - Add "Rolls" text like prestore form
    worksheet.cell('K5').value(data.quantity ? `${data.quantity} Rolls` : '');
    
    // Production Date (N4) - format as DD/MM/YYYY
    worksheet.cell('N4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');
    
    // Inspection Date (N5) - format as DD/MM/YYYY  
    worksheet.cell('N5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
    
    // Inspected By (B41)
    worksheet.cell('B41').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B42) - format as DD/MM/YYYY
    worksheet.cell('B42').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (M41)
    worksheet.cell('M41').value(data.verified_by || 'Not Verified');

    // Verified Date (M42) - format as DD/MM/YYYY
    worksheet.cell('M42').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (O3)
    worksheet.cell('O3').value(data.film_insp_form_ref_no || '');
    
    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;
      
      // Basic Weight Equipment (D6)
      worksheet.cell('D6').value(equipment.basic_weight || '');
      
      // Thickness Equipment (F6)
      worksheet.cell('F6').value(equipment.thickness || '');
      
      // Opacity Equipment (H6)
      worksheet.cell('H6').value(equipment.opacity || '');
      
      // COF Equipment (J6)
      worksheet.cell('J6').value(equipment.cof || '');
      
      // Cut Width Equipment (L6)
      worksheet.cell('L6').value(equipment.cut_width || '');
      
      // Color Equipment (N6) - Use unprinted equipment for both unprinted and printed
      // Since both use the same equipment type (X-RITE), use unprinted equipment ID
      worksheet.cell('N6').value(equipment.color_unprinted || '');
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
          worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`A${row}`).value(''); // Empty row
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
          worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`B${row}`).value(''); // Empty row
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
          worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`C${row}`).value(''); // Empty row
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
          worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`D${row}`).value('');
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
          worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`F${row}`).value('');
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
          worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`H${row}`).value('');
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
          worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`J${row}`).value('');
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
          worksheet.cell(`L${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`L${row}`).value('');
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
          worksheet.cell(`N${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`N${row}`).value('');
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
          worksheet.cell(`O${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`O${row}`).value('');
        }
      }
    }

    // Note: xlsx-populate doesn't support calcProperties like ExcelJS
    // Formulas will be calculated when the file is opened in Excel
    
    // Note: xlsx-populate handles formula calculation differently
    // No need for dummy cell manipulation
    

    // Map Page 2 data if Page2 worksheet exists
    const page2Worksheet = workbook.sheet('Page2');
    if (page2Worksheet) {
      // Inspected By (B42)
      page2Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');

      // Inspection Date (B43) - format as DD/MM/YYYY
      page2Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

      // Verified By (M42)
      page2Worksheet.cell('M42').value(data.verified_by || 'Not Verified');

      // Verified Date (M43) - format as DD/MM/YYYY
      page2Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

      // Film Inspection Form Ref No (O3)
      page2Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');
      
      // Equipment data for Page 2 (D6)
      if (data.equipment_used && data.equipment_used.page2) {
        page2Worksheet.cell('D6').value(data.equipment_used.page2.common || '');
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
            page2Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`D${row}`).value(''); // Preserve empty values
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
            page2Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`E${row}`).value(''); // Preserve empty values
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
            page2Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`F${row}`).value(''); // Preserve empty values
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
            page2Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`H${row}`).value(''); // Preserve empty values
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
            page2Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`I${row}`).value(''); // Preserve empty values
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
            page2Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`J${row}`).value(''); // Preserve empty values
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
            page2Worksheet.cell(`L${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`L${row}`).value(''); // Preserve empty values
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
            page2Worksheet.cell(`M${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`M${row}`).value(''); // Preserve empty values
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
            page2Worksheet.cell(`N${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`N${row}`).value(''); // Preserve empty values
          }
          row--;
        }
      }
      
    } else {
    }

    // Map Page 3 data if Page3 worksheet exists
    const page3Worksheet = workbook.sheet('Page3');
    if (page3Worksheet) {
      // Inspected By (B42)
      page3Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');

      // Inspection Date (B43) - format as DD/MM/YYYY
      page3Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

      // Verified By (M42)
      page3Worksheet.cell('M42').value(data.verified_by || 'Not Verified');

      // Verified Date (M43) - format as DD/MM/YYYY
      page3Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

      // Film Inspection Form Ref No (O3)
      page3Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');
      
      // Equipment data for Page 3 (D6)
      if (data.equipment_used && data.equipment_used.page3) {
        page3Worksheet.cell('D6').value(data.equipment_used.page3.common || '');
      }
      
      // Page 3 data mapping - Elongation CD, Force CD, and Modulus data - fill from bottom up
      // Elongation CD 1 data to column D (D9-D38)
      if (data.page3_elongation_cd_1) {
        const elongationData = data.page3_elongation_cd_1;
        const dataValues = Object.values(elongationData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page3Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
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
          page3Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
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
          page3Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
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
          page3Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
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
          page3Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
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
          page3Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
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
          page3Worksheet.cell(`L${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
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
          page3Worksheet.cell(`M${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
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
          page3Worksheet.cell(`N${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
          row--;
        }
      }
      
    } else {
    }

    // Map Page 4 data if Page4 worksheet exists
    const page4Worksheet = workbook.sheet('Page4');
    if (page4Worksheet) {
      // Inspected By (B42)
      page4Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');

      // Inspection Date (B43) - format as DD/MM/YYYY
      page4Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

      // Verified By (M42)
      page4Worksheet.cell('M42').value(data.verified_by || 'Not Verified');

      // Verified Date (M43) - format as DD/MM/YYYY
      page4Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

      // Film Inspection Form Ref No (O3)
      page4Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');
      
      // Equipment data for Page 4 (D6)
      if (data.equipment_used && data.equipment_used.page4) {
        page4Worksheet.cell('D6').value(data.equipment_used.page4.gloss || '');
      }
      
      // Page 4 data mapping - Gloss and PG Quality data - fill from bottom up
      // Gloss 1 data to column D (D9-D38)
      if (data.page4_gloss_1) {
        const glossData = data.page4_gloss_1;
        const dataValues = Object.values(glossData); // Don't filter empty values
        let row = 38;
        
        for (let i = dataValues.length - 1; i >= 0 && row >= 9; i--) {
          const numValue = parseFloat(dataValues[i]);
          page4Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
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
          page4Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
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
          page4Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
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
          page4Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[i]);
          row--;
        }
      }
      
    } else {
    }

    // 5. Set response headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Generate filename with standardized format: FIF-{product_code}-
    const productCode = data.product_code || 'UNKNOWN';
    const filename = `FIF-${productCode}-.xlsx`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // 6. Write the workbook to response
    const buffer = await workbook.outputAsync();
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
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      worksheet = workbook.sheet('Page1');
    } catch (error) {
      console.log('Error loading template:', error.message);
      workbook = await XlsxPopulate.fromBlankAsync();
      const page1Worksheet = workbook.addSheet('Page1');
      worksheet = page1Worksheet;
    }

    // 3. Map data to Excel cells

    // Product Code (B4)
    worksheet.cell('B4').value(data.product_code || '');

    // Specification (B5)
    worksheet.cell('B5').value(data.specification || '');

    // Production Order (G4)
    worksheet.cell('G4').value(data.production_order || '');

    // Purchase Order (G5)
    worksheet.cell('G5').value(data.purchase_order || '');

    // Machine (J4)
    worksheet.cell('J4').value(data.machine_no || '');

    // Quantity (J5) - Add "Rolls" text like prestore form
    worksheet.cell('J5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (N4) - format as DD/MM/YYYY
    worksheet.cell('N4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Inspection Date (N5) - format as DD/MM/YYYY
    worksheet.cell('N5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Inspected By (B41)
    worksheet.cell('B41').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B42) - format as DD/MM/YYYY
    worksheet.cell('B42').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (L41)
    worksheet.cell('L41').value(data.verified_by || 'Not Verified');

    // Verified Date (L42) - format as DD/MM/YYYY
    worksheet.cell('L42').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (O3)
    worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Basic Weight Equipment (D6)
      worksheet.cell('D6').value(equipment.basic_weight || '');

      // Thickness Equipment (G6)
      worksheet.cell('G6').value(equipment.thickness || '');

      // Opacity Equipment (J6)
      worksheet.cell('J6').value(equipment.opacity || '');

      // COF Equipment (M6)
      worksheet.cell('M6').value(equipment.cof || '');
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
          worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`A${row}`).value(''); // Empty row
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
          worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`B${row}`).value(''); // Empty row
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
          worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`C${row}`).value(''); // Empty row
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
          worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`D${row}`).value('');
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
          worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`G${row}`).value('');
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
          worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`J${row}`).value('');
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
          worksheet.cell(`M${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`M${row}`).value('');
        }
      }
    }


    // Map Page 2 data if Page2 worksheet exists
    const page2Worksheet = workbook.sheet('Page2');
    if (page2Worksheet) {
      // Copy header info to Page 2
      page2Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page2Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page2Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page2Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page2Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 2 (D6)
      if (data.equipment_used && data.equipment_used.page2) {
        page2Worksheet.cell('D6').value(data.equipment_used.page2.common || '');
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
            page2Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`D${row}`).value('');
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
            page2Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`E${row}`).value('');
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
            page2Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`F${row}`).value('');
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
            page2Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`H${row}`).value('');
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
            page2Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`I${row}`).value('');
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
            page2Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`J${row}`).value('');
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
            page2Worksheet.cell(`L${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`L${row}`).value('');
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
            page2Worksheet.cell(`M${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`M${row}`).value('');
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
            page2Worksheet.cell(`N${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`N${row}`).value('');
          }
          row--;
        }
      }
    }

    // Map Page 3 data if Page3 worksheet exists
    const page3Worksheet = workbook.sheet('Page3');
    if (page3Worksheet) {
      // Copy header info to Page 3
      page3Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page3Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page3Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page3Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page3Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 3 (D6)
      if (data.equipment_used && data.equipment_used.page3) {
        page3Worksheet.cell('D6').value(data.equipment_used.page3.common || '');
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
            page3Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`D${row}`).value('');
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
            page3Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`E${row}`).value('');
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
            page3Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`F${row}`).value('');
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
            page3Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`H${row}`).value('');
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
            page3Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`I${row}`).value('');
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
            page3Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`J${row}`).value('');
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
            page3Worksheet.cell(`L${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`L${row}`).value('');
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
            page3Worksheet.cell(`M${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`M${row}`).value('');
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
            page3Worksheet.cell(`N${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`N${row}`).value('');
          }
          row--;
        }
      }
    }

    // Map Page 4 data if Page4 worksheet exists
    const page4Worksheet = workbook.sheet('Page4');
    if (page4Worksheet) {
      // Copy header info to Page 4
      page4Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page4Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page4Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page4Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page4Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 4 (D6, L6)
      if (data.equipment_used && data.equipment_used.page4) {
        page4Worksheet.cell('D6').value(data.equipment_used.page4.color_common || '');
        page4Worksheet.cell('L6').value(data.equipment_used.page4.gloss || '');
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
            page4Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`D${row}`).value('');
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
            page4Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`F${row}`).value('');
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
            page4Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`H${row}`).value('');
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
            page4Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`J${row}`).value('');
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
            page4Worksheet.cell(`L${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`L${row}`).value('');
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
            page4Worksheet.cell(`M${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`M${row}`).value('');
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
            page4Worksheet.cell(`N${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`N${row}`).value('');
          }
          row--;
        }
      }
    }

    // Map Page 5 data if Page5 worksheet exists
    const page5Worksheet = workbook.sheet('Page5');
    if (page5Worksheet) {
      // Copy header info to Page 5
      page5Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page5Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page5Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page5Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page5Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 5 (D6)
      if (data.equipment_used && data.equipment_used.page5) {
        page5Worksheet.cell('D6').value(data.equipment_used.page5.common || '');
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
            page5Worksheet.cell(`D${row}`).value(value);
          } else {
            page5Worksheet.cell(`D${row}`).value('');
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
    const buffer = await workbook.outputAsync();
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
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      worksheet = workbook.sheet('Page1');
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
    worksheet.cell('B4').value(cleanedProductCode);

    // Specification (B5)
    worksheet.cell('B5').value(data.specification || '');

    // Production Order (F4)
    worksheet.cell('F4').value(data.production_order || '');

    // Purchase Order (F5)
    worksheet.cell('F5').value(data.purchase_order || '');

    // Machine (J4)
    worksheet.cell('J4').value(data.machine_no || '');

    // Quantity (J5) - Add "Rolls" text like prestore form
    worksheet.cell('J5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (N4) - format as DD/MM/YYYY
    worksheet.cell('N4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Inspection Date (N5) - format as DD/MM/YYYY
    worksheet.cell('N5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Inspected By (B41)
    worksheet.cell('B41').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B42) - format as DD/MM/YYYY
    worksheet.cell('B42').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (L41)
    worksheet.cell('L41').value(data.verified_by || 'Not Verified');

    // Verified Date (L42) - format as DD/MM/YYYY
    worksheet.cell('L42').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (O3)
    worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Basic Weight Equipment (D6)
      worksheet.cell('D6').value(equipment.basic_weight || '');

      // Thickness Equipment (G6)
      worksheet.cell('G6').value(equipment.thickness || '');

      // Opacity Equipment (J6)
      worksheet.cell('J6').value(equipment.opacity || '');

      // COF Equipment (M6)
      worksheet.cell('M6').value(equipment.cof || '');
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
          worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`A${row}`).value(''); // Empty row
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
          worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`B${row}`).value(''); // Empty row
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
          worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`C${row}`).value(''); // Empty row
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
          worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`D${row}`).value('');
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
          worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`G${row}`).value('');
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
          worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`J${row}`).value('');
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
          worksheet.cell(`M${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`M${row}`).value('');
        }
      }
    }

    // PAGE 2 DATA MAPPING - APE-168(18)C (Jeddah) Page 2 data (Elongation & Force MD)
    const hasPage2Data = data.page2_elongation_md_1 || data.page2_force_md_1 || data.page2_force_5p_md_1;

    if (hasPage2Data) {

      // Create Page2 sheet if it doesn't exist
      try {
        page2Worksheet = workbook.sheet('Page2');
      } catch (error) {
        // Page2 sheet doesn't exist, create it
        page2Worksheet = workbook.addSheet('Page2');
      }

      // Equipment data for Page 2 (D6)
      if (data.equipment_used && data.equipment_used.page2) {
        page2Worksheet.cell('D6').value(data.equipment_used.page2.common || '');
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
          page2Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`E${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`L${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`M${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`N${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }

        // Add personnel information to Page 2
        page2Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
        page2Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
        page2Worksheet.cell('L42').value(data.verified_by || 'Not Verified');
        page2Worksheet.cell('L43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
        page2Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');
      }
    }

    // PAGE 3 DATA MAPPING - APE-168(18)C (Jeddah) Page 3 data (Elongation & Force CD, Modulus)
    const hasPage3Data = data.page3_elongation_cd_1 || data.page3_force_cd_1 || data.page3_modulus_1;

    if (hasPage3Data) {

      // Create Page3 sheet if it doesn't exist
      let page3Worksheet;
      try {
        page3Worksheet = workbook.sheet('Page3');
      } catch (error) {
        // Page3 sheet doesn't exist, create it
        page3Worksheet = workbook.addSheet('Page3');
      }

      // Equipment data for Page 3 (D6)
      if (data.equipment_used && data.equipment_used.page3) {
        page3Worksheet.cell('D6').value(data.equipment_used.page3.common || '');
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
          page3Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`E${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`L${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`M${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`N${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }

        // Add personnel information to Page 3
        page3Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
        page3Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
        page3Worksheet.cell('L42').value(data.verified_by || 'Not Verified');
        page3Worksheet.cell('L43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
        page3Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');
      }
    }

    // PAGE 4 DATA MAPPING - APE-168(18)C (Jeddah) Page 4 data (Color & Gloss)
    const hasPage4Data = data.page4_color_l || data.page4_color_a || data.page4_color_b ||
                         data.page4_color_delta_e || data.page4_gloss_1 || data.page4_gloss_2 || data.page4_gloss_3;

    if (hasPage4Data) {

      // Create Page4 sheet if it doesn't exist
      let page4Worksheet;
      try {
        page4Worksheet = workbook.sheet('Page4');
      } catch (error) {
        // Page4 sheet doesn't exist, create it
        page4Worksheet = workbook.addSheet('Page4');
      }

      // Equipment data for Page 4 (D6, L6)
      if (data.equipment_used && data.equipment_used.page4) {
        page4Worksheet.cell('D6').value(data.equipment_used.page4.color_common || '');
        page4Worksheet.cell('L6').value(data.equipment_used.page4.gloss || '');
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
          page4Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`L${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`M${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`N${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }

        // Add personnel information to Page 4
        page4Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
        page4Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
        page4Worksheet.cell('L42').value(data.verified_by || 'Not Verified');
        page4Worksheet.cell('L43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
        page4Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');
      }
    }

    // PAGE 5 DATA MAPPING - APE-168(18)C (Jeddah) Page 5 data (PG Quality)
    if (data.page5_pg_quality) {

      // Create Page5 sheet if it doesn't exist
      let page5Worksheet;
      try {
        page5Worksheet = workbook.sheet('Page5');
      } catch (error) {
        // Page5 sheet doesn't exist, create it
        page5Worksheet = workbook.addSheet('Page5');
      }

      // PG Quality data to column D (D9-D38)
      const pgQualityData = data.page5_pg_quality;

      const dataValues = [];
      for (let i = 1; i <= 30; i++) {
        const key = i.toString();
        const value = pgQualityData[key];
        if (value && value !== '' && value !== null && value !== undefined) {
          dataValues.push(value);
        } else {
          dataValues.push('');
        }
      }

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        page5Worksheet.cell(`D${row}`).value(dataValues[dataIndex] || '');
      }

      // Add personnel information to Page 5
      page5Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page5Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page5Worksheet.cell('L42').value(data.verified_by || 'Not Verified');
      page5Worksheet.cell('L43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page5Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');
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
      const buffer = await workbook.outputAsync();
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
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      worksheet = workbook.sheet('Page1');
    } catch (error) {
      console.log('Error loading template:', error.message);
      console.log('Error stack:', error.stack);
      return res.status(500).send(`Error loading template: ${error.message}`);
    }

    // 3. Map data to Excel cells

    // Product Code (B4)
    worksheet.cell('B4').value(data.product_code || '');

    // Specification (B5)
    worksheet.cell('B5').value(data.specification || '');

    // Production Order (F4)
    worksheet.cell('F4').value(data.production_order || '');

    // Purchase Order (F5)
    worksheet.cell('F5').value(data.purchase_order || '');

    // Machine (J4)
    worksheet.cell('J4').value(data.machine_no || '');

    // Quantity (J5) - Add "Rolls" text like prestore form
    worksheet.cell('J5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (N4) - format as DD/MM/YYYY
    worksheet.cell('N4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Inspection Date (N5) - format as DD/MM/YYYY
    worksheet.cell('N5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Inspected By (B41)
    worksheet.cell('B41').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B42) - format as DD/MM/YYYY
    worksheet.cell('B42').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (L41)
    worksheet.cell('L41').value(data.verified_by || 'Not Verified');

    // Verified Date (L42) - format as DD/MM/YYYY
    worksheet.cell('L42').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (O3)
    worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Basic Weight Equipment (D6)
      worksheet.cell('D6').value(equipment.basic_weight || '');

      // Thickness Equipment (G6)
      worksheet.cell('G6').value(equipment.thickness || '');

      // Opacity Equipment (J6)
      worksheet.cell('J6').value(equipment.opacity || '');

      // COF Equipment (M6)
      worksheet.cell('M6').value(equipment.cof || '');
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
          worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`A${row}`).value(''); // Empty row
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
          worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`B${row}`).value(''); // Empty row
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
          worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`C${row}`).value(''); // Empty row
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
          worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`D${row}`).value('');
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
          worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`G${row}`).value('');
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
          worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`J${row}`).value('');
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
          worksheet.cell(`M${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`M${row}`).value('');
        }
      }
    }

    // PAGE 2 DATA MAPPING - APE-168(18)C White Page 2 data (Elongation & Force MD)
    const hasPage2Data = data.page2_elongation_md_1 || data.page2_force_md_1 || data.page2_force_5p_md_1;

    if (hasPage2Data) {

      // Create Page2 sheet if it doesn't exist
      try {
        page2Worksheet = workbook.sheet('Page2');
      } catch (error) {
        // Page2 sheet doesn't exist, create it
        page2Worksheet = workbook.addSheet('Page2');
      }

      // Equipment data for Page 2 (D6)
      if (data.equipment_used && data.equipment_used.page2) {
        page2Worksheet.cell('D6').value(data.equipment_used.page2.common || '');
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
          page2Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`E${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`L${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`M${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`N${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Add personnel information to Page 2
      page2Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page2Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page2Worksheet.cell('L42').value(data.verified_by || 'Not Verified');
      page2Worksheet.cell('L43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page2Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');
    }

    // PAGE 3 DATA MAPPING - APE-168(18)C White Page 3 data (Elongation & Force CD, Modulus)
    const hasPage3Data = data.page3_elongation_cd_1 || data.page3_force_cd_1 || data.page3_modulus_1;

    if (hasPage3Data) {

      // Create Page3 sheet if it doesn't exist
      let page3Worksheet;
      try {
        page3Worksheet = workbook.sheet('Page3');
      } catch (error) {
        // Page3 sheet doesn't exist, create it
        page3Worksheet = workbook.addSheet('Page3');
      }

      // Equipment data for Page 3 (D6)
      if (data.equipment_used && data.equipment_used.page3) {
        page3Worksheet.cell('D6').value(data.equipment_used.page3.common || '');
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
          page3Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`E${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`L${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`M${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`N${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Add personnel information to Page 3
      page3Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page3Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page3Worksheet.cell('L42').value(data.verified_by || 'Not Verified');
      page3Worksheet.cell('L43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page3Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');
    }

    // PAGE 4 DATA MAPPING - APE-168(18)C White Page 4 data (Color & Gloss)
    const hasPage4Data = data.page4_color_l || data.page4_color_a || data.page4_color_b ||
                         data.page4_color_delta_e || data.page4_gloss_1 || data.page4_gloss_2 || data.page4_gloss_3;

    if (hasPage4Data) {

      // Create Page4 sheet if it doesn't exist
      let page4Worksheet;
      try {
        page4Worksheet = workbook.sheet('Page4');
      } catch (error) {
        // Page4 sheet doesn't exist, create it
        page4Worksheet = workbook.addSheet('Page4');
      }

      // Equipment data for Page 4 (D6, L6)
      if (data.equipment_used && data.equipment_used.page4) {
        page4Worksheet.cell('D6').value(data.equipment_used.page4.color_common || '');
        page4Worksheet.cell('L6').value(data.equipment_used.page4.gloss || '');
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
          page4Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`L${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`M${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`N${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }

      // Add personnel information to Page 4
      page4Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page4Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page4Worksheet.cell('L42').value(data.verified_by || 'Not Verified');
      page4Worksheet.cell('L43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page4Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');
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
      const buffer = await workbook.outputAsync();
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
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      worksheet = workbook.sheet('Page1');
    } catch (error) {
      console.log('Error loading template:', error.message);
      workbook = await XlsxPopulate.fromBlankAsync();
      const page1Worksheet = workbook.addSheet('Page1');
      worksheet = page1Worksheet;
    }

    // 3. Map data to Excel cells

    // Product Code (B4)
    worksheet.cell('B4').value(data.product_code || '');

    // Specification (B5)
    worksheet.cell('B5').value(data.specification || '');

    // Production Order (G4)
    worksheet.cell('G4').value(data.production_order || '');

    // Purchase Order (G5)
    worksheet.cell('G5').value(data.purchase_order || '');

    // Machine (J4)
    worksheet.cell('J4').value(data.machine_no || '');

    // Quantity (J5) - Add "Rolls" text like prestore form
    worksheet.cell('J5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (N4) - format as DD/MM/YYYY
    worksheet.cell('N4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Inspection Date (N5) - format as DD/MM/YYYY
    worksheet.cell('N5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Inspected By (B41)
    worksheet.cell('B41').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B42) - format as DD/MM/YYYY
    worksheet.cell('B42').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (M41)
    worksheet.cell('M41').value(data.verified_by || 'Not Verified');

    // Verified Date (M42) - format as DD/MM/YYYY
    worksheet.cell('M42').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (O3)
    worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      // Parse JSON data if it's a string, otherwise use as is
      const equipment = typeof data.equipment_used.page1 === 'string'
        ? JSON.parse(data.equipment_used.page1)
        : data.equipment_used.page1;

      // Basic Weight Equipment (D6)
      worksheet.cell('D6').value(equipment.basic_weight || '');

      // Thickness Equipment (F6)
      worksheet.cell('F6').value(equipment.thickness || '');

      // Opacity Equipment (H6)
      worksheet.cell('H6').value(equipment.opacity || '');

      // COF Equipment (J6)
      worksheet.cell('J6').value(equipment.cof || '');

      // Cut Width Equipment (L6)
      worksheet.cell('L6').value(equipment.cut_width || '');

      // Color Equipment (N6)
      worksheet.cell('N6').value(equipment.color_unprinted || '');
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
          worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`A${row}`).value(''); // Empty row
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
          worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`B${row}`).value(''); // Empty row
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
          worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`C${row}`).value(''); // Empty row
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
          worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`D${row}`).value('');
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
          worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`F${row}`).value('');
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
          worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`H${row}`).value('');
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
          worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`J${row}`).value('');
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
          worksheet.cell(`L${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`L${row}`).value('');
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
          worksheet.cell(`N${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`N${row}`).value('');
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
          worksheet.cell(`O${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          worksheet.cell(`O${row}`).value('');
        }
      }
    }

    // Map Page 2 data if Page2 worksheet exists
    const page2Worksheet = workbook.sheet('Page2');
    if (page2Worksheet) {
      // Copy header info to Page 2
      page2Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page2Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page2Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page2Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page2Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 2 (D6)
      if (data.equipment_used && data.equipment_used.page2) {
        page2Worksheet.cell('D6').value(data.equipment_used.page2.common || '');
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
            page2Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`D${row}`).value('');
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
            page2Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`E${row}`).value('');
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
            page2Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`F${row}`).value('');
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
            page2Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`H${row}`).value('');
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
            page2Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`I${row}`).value('');
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
            page2Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`J${row}`).value('');
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
            page2Worksheet.cell(`L${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`L${row}`).value('');
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
            page2Worksheet.cell(`M${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`M${row}`).value('');
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
            page2Worksheet.cell(`N${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page2Worksheet.cell(`N${row}`).value('');
          }
          row--;
        }
      }
    }

    // Map Page 3 data if Page3 worksheet exists
    const page3Worksheet = workbook.sheet('Page3');
    if (page3Worksheet) {
      // Copy header info to Page 3
      page3Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page3Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page3Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page3Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page3Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 3 (D6)
      if (data.equipment_used && data.equipment_used.page3) {
        page3Worksheet.cell('D6').value(data.equipment_used.page3.common || '');
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
            page3Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`D${row}`).value('');
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
            page3Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`E${row}`).value('');
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
            page3Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`F${row}`).value('');
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
            page3Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`H${row}`).value('');
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
            page3Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`I${row}`).value('');
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
            page3Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`J${row}`).value('');
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
            page3Worksheet.cell(`L${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`L${row}`).value('');
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
            page3Worksheet.cell(`M${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`M${row}`).value('');
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
            page3Worksheet.cell(`N${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page3Worksheet.cell(`N${row}`).value('');
          }
          row--;
        }
      }
    }

    // Map Page 4 data if Page4 worksheet exists
    const page4Worksheet = workbook.sheet('Page4');
    if (page4Worksheet) {
      // Copy header info to Page 4
      page4Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page4Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page4Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page4Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page4Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 4 (D6)
      if (data.equipment_used && data.equipment_used.page4) {
        page4Worksheet.cell('D6').value(data.equipment_used.page4.gloss || '');
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
            page4Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`D${row}`).value('');
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
            page4Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`E${row}`).value('');
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
            page4Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : value);
          } else {
            page4Worksheet.cell(`F${row}`).value('');
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
    const buffer = await workbook.outputAsync();
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
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      worksheet = workbook.sheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.sheet('Page2');
      } catch (error) {
        // Page2 sheet doesn't exist, create it by copying Page1 structure
        page2Worksheet = workbook.addSheet('Page2');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      workbook = await XlsxPopulate.fromBlankAsync();
      const page1Worksheet = workbook.addSheet('Page1');
      worksheet = page1Worksheet;
      page2Worksheet = workbook.addSheet('Page2');
      console.log('Created both Page1 and Page2 sheets');
    }

    // 3. Map data to Excel cells

    // Product Code (C4)
    worksheet.cell('C4').value(data.product_code || '');

    // Specification (C5)
    worksheet.cell('C5').value(data.specification || '');

    // Production Order (F4)
    worksheet.cell('F4').value(data.production_order || '');

    // Purchase Order (F5)
    worksheet.cell('F5').value(data.purchase_order || '');

    // Machine (H4)
    worksheet.cell('H4').value(data.machine_no || '');

    // Quantity (H5) - Add "Rolls" text like prestore form
    worksheet.cell('H5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (L4) - format as DD/MM/YYYY
    worksheet.cell('L4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Inspection Date (L5) - format as DD/MM/YYYY
    worksheet.cell('L5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Inspected By (B42)
    worksheet.cell('B42').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B43) - format as DD/MM/YYYY (duplicate for verification)
    worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (I42)
    worksheet.cell('I42').value(data.verified_by || 'Not Verified');

    // Verified Date (I43) - format as DD/MM/YYYY
    worksheet.cell('I43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (L3)
    worksheet.cell('L3').value(data.film_insp_form_ref_no || '');

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Basic Weight Equipment (D6)
      worksheet.cell('D6').value(equipment.basic_weight || '');

      // COF Equipment (E6) - Template shows COF in column E
      worksheet.cell('E6').value(equipment.cof_rr || equipment.cof_rs || '');

      // Opacity Equipment (G6) - Template shows Opacity in column G
      worksheet.cell('G6').value(equipment.opacity || '');

      // Modulus Equipment (H6) - Template shows Modulus in column H
      worksheet.cell('H6').value(equipment.modulus || '');

      // Gloss Equipment (L6) - Template shows Gloss in column L
      worksheet.cell('L6').value(equipment.gloss || '');
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
          worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`A${row}`).value(''); // Empty row
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
          worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`B${row}`).value(''); // Empty row
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
          worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`C${row}`).value(''); // Empty row
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
        worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
        worksheet.cell(`G${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
        worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
        worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
        worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
        worksheet.cell(`L${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
        worksheet.cell(`E${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
        worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
        page2Worksheet = workbook.sheet('Page2');
      } catch (error) {
        // Page2 sheet doesn't exist, create it
        page2Worksheet = workbook.addSheet('Page2');
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
          page2Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`E${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`G${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`K${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page2Worksheet.cell(`D${row}`).value('');
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
          page2Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page2Worksheet.cell(`E${row}`).value('');
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
          page2Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page2Worksheet.cell(`F${row}`).value('');
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
          page2Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page2Worksheet.cell(`G${row}`).value('');
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
        page2Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
        page2Worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
        page2Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
        page2Worksheet.cell(`K${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
    } else {
    }
    // Map Page 2 headers if Page2 sheet exists
    if (page2Worksheet) {
      console.log('Mapping Page 2 headers');

      // Inspected By (B41)
      page2Worksheet.cell('B41').value(data.prepared_by || 'Unknown User');

      // Inspection Date (B42) - format as DD/MM/YYYY
      page2Worksheet.cell('B42').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

      // Verified By (I41)
      page2Worksheet.cell('I41').value(data.verified_by || 'Not Verified');

      // Verified Date (I42) - format as DD/MM/YYYY
      page2Worksheet.cell('I42').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

      // Film Inspection Form Ref No (K3)
      page2Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');

      console.log('Page 2 headers mapped successfully');
    }

    // Map Page 2 equipment data if Page2 sheet exists
    if (page2Worksheet && data.equipment_used && data.equipment_used.page2) {
      console.log('Mapping Page 2 equipment data');

      const page2Equipment = data.equipment_used.page2;

      // UTM Machine (D6) - For force measurements
      page2Worksheet.cell('D6').value(page2Equipment.force || '');

      // Spectro Photometer (H6) - For color measurements
      page2Worksheet.cell('H6').value(page2Equipment.colour || '');

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
    const buffer = await workbook.outputAsync();
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
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      worksheet = workbook.sheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.sheet('Page2');
      } catch (error) {
        // Page2 sheet doesn't exist, create it by copying Page1 structure
        page2Worksheet = workbook.addSheet('Page2');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      workbook = await XlsxPopulate.fromBlankAsync();
      const page1Worksheet = workbook.addSheet('Page1');
      worksheet = page1Worksheet;
      page2Worksheet = workbook.addSheet('Page2');
      console.log('Created both Page1 and Page2 sheets');
    }

    // 3. Map data to Excel cells

    // Product Code (C4)
    worksheet.cell('C4').value(data.product_code || '');

    // Specification (C5)
    worksheet.cell('C5').value(data.specification || '');

    // Production Order (F4)
    worksheet.cell('F4').value(data.production_order || '');

    // Purchase Order (F5)
    worksheet.cell('F5').value(data.purchase_order || '');

    // Machine (H4)
    worksheet.cell('H4').value(data.machine_no || '');

    // Quantity (H5) - Add "Rolls" text like prestore form
    worksheet.cell('H5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (L4) - format as DD/MM/YYYY
    worksheet.cell('L4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Inspection Date (L5) - format as DD/MM/YYYY
    worksheet.cell('L5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Inspected By (B42)
    worksheet.cell('B42').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B43) - format as DD/MM/YYYY (duplicate for verification)
    worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (I42)
    worksheet.cell('I42').value(data.verified_by || 'Not Verified');

    // Verified Date (I43) - format as DD/MM/YYYY
    worksheet.cell('I43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (L3)
    worksheet.cell('L3').value(data.film_insp_form_ref_no || '');

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Basic Weight Equipment (D6)
      worksheet.cell('D6').value(equipment.basic_weight || '');

      // COF Equipment (E6) - Template shows COF in column E
      worksheet.cell('E6').value(equipment.cof_rr || equipment.cof_rs || '');

      // Opacity Equipment (G6) - Template shows Opacity in column G
      worksheet.cell('G6').value(equipment.opacity || '');

      // Modulus Equipment (H6) - Template shows Modulus in column H
      worksheet.cell('H6').value(equipment.modulus || '');

      // Gloss Equipment (L6) - Template shows Gloss in column L
      worksheet.cell('L6').value(equipment.gloss || '');
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
          worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`A${row}`).value(''); // Empty row
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
          worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`B${row}`).value(''); // Empty row
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
          worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          worksheet.cell(`C${row}`).value(''); // Empty row
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
        worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
        worksheet.cell(`G${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
        worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
        worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
        worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
        worksheet.cell(`L${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`E${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`G${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`K${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }
    } else {
    }

    // Map Page 2 headers if Page2 sheet exists
    if (page2Worksheet) {
      console.log('Mapping Page 2 headers');

      // Inspected By (B41)
      page2Worksheet.cell('B41').value(data.prepared_by || 'Unknown User');

      // Inspection Date (B42) - format as DD/MM/YYYY
      page2Worksheet.cell('B42').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

      // Verified By (I41)
      page2Worksheet.cell('I41').value(data.verified_by || 'Not Verified');

      // Verified Date (I42) - format as DD/MM/YYYY
      page2Worksheet.cell('I42').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

      // Film Inspection Form Ref No (K3)
      page2Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');

      console.log('Page 2 headers mapped successfully');
    }

    // Map Page 2 equipment data if Page2 sheet exists
    if (page2Worksheet && data.equipment_used && data.equipment_used.page2) {
      console.log('Mapping Page 2 equipment data');

      const page2Equipment = data.equipment_used.page2;

      // UTM Machine (D6) - For force measurements
      page2Worksheet.cell('D6').value(page2Equipment.force || '');

      // Spectro Photometer (H6) - For color measurements
      page2Worksheet.cell('H6').value(page2Equipment.colour || '');

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
    const buffer = await workbook.outputAsync();
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
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      page1Worksheet = workbook.sheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.sheet('Page2');
      } catch (error) {
        // Page2 sheet doesn't exist, create it by copying Page1 structure
        page2Worksheet = workbook.addSheet('Page2');
      }

      // Create or get Page3 sheet for Page 3 data
      try {
        page3Worksheet = workbook.sheet('Page3');
      } catch (error) {
        // Page3 sheet doesn't exist, create it
        page3Worksheet = workbook.addSheet('Page3');
      }

      // Create or get Page4 sheet for Page 4 data
      try {
        page4Worksheet = workbook.sheet('Page4');
      } catch (error) {
        // Page4 sheet doesn't exist, create it
        page4Worksheet = workbook.addSheet('Page4');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      workbook = await XlsxPopulate.fromBlankAsync();
      page1Worksheet = workbook.addSheet('Page1');
      page2Worksheet = workbook.addSheet('Page2');
      page3Worksheet = workbook.addSheet('Page3');
      page4Worksheet = workbook.addSheet('Page4');
    }

    // 3. Map data to Excel cells for Page 1
    if (page1Worksheet) {
      // Product Code (B4)
      page1Worksheet.cell('B4').value(data.product_code || '');

      // Specification (B5)
      page1Worksheet.cell('B5').value(data.specification || '');

      // Production Order (F4)
      page1Worksheet.cell('F4').value(data.production_order || '');

      // Purchase Order (F5)
      page1Worksheet.cell('F5').value(data.purchase_order || '');

      // Machine (J4)
      page1Worksheet.cell('J4').value(data.machine_no || '');

      // Quantity (J5) - Add "Rolls" text like prestore form
      page1Worksheet.cell('J5').value(data.quantity ? `${data.quantity} Rolls` : '');

      // Production Date (N4) - format as DD/MM/YYYY
      page1Worksheet.cell('N4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

      // Inspection Date (N5) - format as DD/MM/YYYY
      page1Worksheet.cell('N5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

      // Inspected By (B41)
      page1Worksheet.cell('B41').value(data.prepared_by || 'Unknown User');

      // Inspection Date (B42) - format as DD/MM/YYYY (duplicate for verification)
      page1Worksheet.cell('B42').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

      // Verified By (L41)
      page1Worksheet.cell('L41').value(data.verified_by || 'Not Verified');

      // Verified Date (L42) - format as DD/MM/YYYY
      page1Worksheet.cell('L42').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

      // Film Inspection Form Ref No (O3)
      page1Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Map equipment data to Excel cells
      if (data.equipment_used && data.equipment_used.page1) {
        const equipment = data.equipment_used.page1;

        // Basic Weight Equipment (D6)
        page1Worksheet.cell('D6').value(equipment.basic_weight || '');

        // Thickness Equipment (G6)
        page1Worksheet.cell('G6').value(equipment.thickness || '');

        // Opacity Equipment (J6)
        page1Worksheet.cell('J6').value(equipment.opacity || '');

        // COF Equipment (M6)
        page1Worksheet.cell('M6').value(equipment.cof || '');
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
          page1Worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`A${row}`).value(''); // Empty row
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
          page1Worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`B${row}`).value(''); // Empty row
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
          page1Worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`C${row}`).value(''); // Empty row
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
        page1Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
        page1Worksheet.cell(`G${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
        page1Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
        page1Worksheet.cell(`M${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
      }
    }

    // Now handle PAGE 2, 3, and 4 data mapping - WHITE-102(18) has 4 pages total

    // Map Page 2 data if Page2 worksheet exists
    if (page2Worksheet) {
      // Copy header info to Page 2
      page2Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page2Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page2Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page2Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page2Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 2 (D6)
      if (data.equipment_used && data.equipment_used.page2) {
        page2Worksheet.cell('D6').value(data.equipment_used.page2.common || '');
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
          page2Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`E${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`L${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`M${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page2Worksheet.cell(`N${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }
    }

    // Map Page 3 data if Page3 worksheet exists
    if (page3Worksheet) {
      // Copy header info to Page 3
      page3Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page3Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page3Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page3Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page3Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 3 (D6)
      if (data.equipment_used && data.equipment_used.page3) {
        page3Worksheet.cell('D6').value(data.equipment_used.page3.common || '');
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
          page3Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`E${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`I${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`L${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`M${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page3Worksheet.cell(`N${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }
    }
    // Map Page 4 data if Page4 worksheet exists
    if (page4Worksheet) {
      // Copy header info to Page 4
      page4Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page4Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page4Worksheet.cell('M42').value(data.verified_by || 'Not Verified');
      page4Worksheet.cell('M43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page4Worksheet.cell('O3').value(data.film_insp_form_ref_no || '');

      // Equipment data for Page 4 (D6, L6)
      if (data.equipment_used && data.equipment_used.page4) {
        page4Worksheet.cell('D6').value(data.equipment_used.page4.color_common || '');
        page4Worksheet.cell('L6').value(data.equipment_used.page4.gloss || '');
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
          page4Worksheet.cell(`D${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`F${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`H${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`J${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`L${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`M${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`N${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`M${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
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
          page4Worksheet.cell(`N${row}`).value(convertToNumber(dataValues[dataIndex] || ''));
        }
      }
    }

    // 4. Generate and send the Excel file
    const buffer = await workbook.outputAsync();
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

