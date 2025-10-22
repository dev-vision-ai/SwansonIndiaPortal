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
  // UC Series Film Inspection Form Excel Export Endpoints
// UC-18gsm-250P-ABQR Film Inspection Form Excel Export Endpoint
app.get('/export-uc-18gsm-250p-abqr-form', async (req, res) => {
  try {
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    // 1. Fetch data from Supabase for the specific form
    const { data, error } = await supabase
      .from('uc-18gsm-250p-abqr')
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
    const templatePath = path.join(__dirname, 'templates', 'UC-18gsm-250P-ABQR.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let page1Worksheet;
    let page2Worksheet;
    let page3Worksheet;
    let coaWorksheet;

    // Load the template file
    try {
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      page1Worksheet = workbook.sheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.sheet('Page2');
      } catch (error) {
        page2Worksheet = workbook.addSheet('Page2');
      }

      // Create or get Page3 sheet for Page 3 data
      try {
        page3Worksheet = workbook.sheet('Page3');
      } catch (error) {
        page3Worksheet = workbook.addSheet('Page3');
      }

      // Create or get COA Form sheet for COA data
      try {
        coaWorksheet = workbook.sheet('COA Form');
      } catch (error) {
        coaWorksheet = workbook.addSheet('COA Form');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      return res.status(500).send(`Error loading template: ${error.message}`);
    }

    // 3. Map data to Excel cells for Page 1

    // Product Code (C4)
    page1Worksheet.cell('C4').value(data.product_code || '');

    // Specification (C5)
    page1Worksheet.cell('C5').value(data.specification || '');

    // Production Order (F4)
    page1Worksheet.cell('F4').value(data.production_order || '');

    // Purchase Order (F5)
    page1Worksheet.cell('F5').value(data.purchase_order || '');

    // Machine (H4)
    page1Worksheet.cell('H4').value(data.machine_no || '');

    // Quantity (H5) - Add "Rolls" text like prestore form
    page1Worksheet.cell('H5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (J4) - format as DD/MM/YYYY
    page1Worksheet.cell('J4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Inspection Date (J5) - format as DD/MM/YYYY
    page1Worksheet.cell('J5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Equipment Data for Page 1
    if (data.equipment_used && data.equipment_used.page1) {
        page1Worksheet.cell('D6').value(data.equipment_used.page1.basic_weight || '');
        page1Worksheet.cell('E6').value(data.equipment_used.page1.dial_gauge || '');
        page1Worksheet.cell('F6').value('NA');
        page1Worksheet.cell('G6').value(data.equipment_used.page1.instron || '');
        page1Worksheet.cell('I6').value(data.equipment_used.page1.instron || '');
    }

    // Inspected By (B42)
    page1Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B43) - format as DD/MM/YYYY
    page1Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (J42)
    page1Worksheet.cell('J42').value(data.verified_by || 'Not Verified');

    // Verified Date (J43) - format as DD/MM/YYYY
    page1Worksheet.cell('J43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (K3)
    page1Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Film Weight Equipment (D6) - WHS
      page1Worksheet.cell('D6').value(equipment.film_weight || '');

      // Thickness Equipment (E6) - DTG
      page1Worksheet.cell('E6').value(equipment.thickness || '');

      // Tensile/COF Equipment (G6) - UTM
      page1Worksheet.cell('G6').value(equipment.tensile_break || equipment.cof_rr || '');

      // Elongation/Modulus Equipment (I6) - UTM
      page1Worksheet.cell('I6').value(equipment.tensile_break || equipment.elongation || equipment.modulus_10 || '');
    }

    // Map sample data to the correct columns for Page 1
    // Sample data should go in rows 8-37 (30 rows)

    // Lot & Roll data to Sample No. column (A9-A38)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`A${row}`).value(''); // Empty row
        }
      }
    }

    // Roll ID data to column B (B9-B38)
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`B${row}`).value('');
        }
      }
    }

    // Lot Time data to column C (C9-C38)
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`C${row}`).value('');
        }
      }
    }

    // Page 1 Physical Properties data
    // Basis Weight data to column D (D9-D38)
    if (data.page1_basis_weight) {
      const basisWeightData = data.page1_basis_weight;
      const dataValues = Object.values(basisWeightData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`D${row}`).value('');
        }
      }
    }

    // Thickness data to column E (E9-E38)
    if (data.page1_thickness) {
      const thicknessData = data.page1_thickness;
      const dataValues = Object.values(thicknessData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`E${row}`).value('');
        }
      }
    }

    // Wettability data to column F (F9-F38)
    if (data.page1_wettability) {
      const wettabilityData = data.page1_wettability;
      const dataValues = Object.values(wettabilityData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`F${row}`).value('');
        }
      }
    }

    // COF RR data to column G (G9-G38)
    if (data.page1_cof_rr) {
      const cofRRData = data.page1_cof_rr;
      const dataValues = Object.values(cofRRData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`G${row}`).value('');
        }
      }
    }

    // COF CC data to column H (H9-H38)
    if (data.page1_cof_cc) {
      const cofCCData = data.page1_cof_cc;
      const dataValues = Object.values(cofCCData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`H${row}`).value('');
        }
      }
    }

    // Tensile Break data to column I (I9-I38)
    if (data.page1_tensile_break) {
      const tensileBreakData = data.page1_tensile_break;
      const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`I${row}`).value('');
        }
      }
    }

    // Elongation data to column J (J9-J38)
    if (data.page1_elongation) {
      const elongationData = data.page1_elongation;
      const dataValues = Object.values(elongationData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`J${row}`).value('');
        }
      }
    }

    // Modulus data to column K (K9-K38)
    if (data.page1_modulus) {
      const modulusData = data.page1_modulus;
      const dataValues = Object.values(modulusData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`K${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`K${row}`).value('');
        }
      }
    }

    // PAGE 2 DATA MAPPING - UC-18gsm-250P-ABQR Page 2 data (Mechanical Properties)
    if (page2Worksheet && (data.page2_tensile_break || data.page2_cd_elongation || data.page2_modulus ||
                          data.page2_opacity || data.page2_roll_width || data.page2_diameter)) {

      // Equipment Data for Page 2
      if (data.equipment_used && data.equipment_used.page2) {
        const equipment = data.equipment_used.page2;

        // Tensile Break Equipment (D6) - INSTRON UTM
        page2Worksheet.cell('D6').value(equipment.tensile_break || '');

        // Opacity Equipment (G6) - SPECTROPHOTOMETER
        page2Worksheet.cell('G6').value(equipment.opacity || '');

        // Roll Width Equipment (I6) - STEEL RULER
        page2Worksheet.cell('I6').value(equipment.roll_width || '');

        // Diameter Equipment (K6) - STEEL RULER
        page2Worksheet.cell('K6').value(equipment.diameter || '');
      }

      // Tensile Break data to column D (D11-D40)
      if (data.page2_tensile_break) {
        const tensileBreakData = data.page2_tensile_break;
        const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`D${row}`).value('');
          }
        }
      }

      // CD Elongation data to column E (E11-E40)
      if (data.page2_cd_elongation) {
        const cdElongationData = data.page2_cd_elongation;
        const dataValues = Object.values(cdElongationData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`E${row}`).value('');
          }
        }
      }

      // Modulus data to column F (F11-F40)
      if (data.page2_modulus) {
        const modulusData = data.page2_modulus;
        const dataValues = Object.values(modulusData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`F${row}`).value('');
          }
        }
      }

      // Opacity data to column G (G11-G38)
      if (data.page2_opacity) {
        const opacityData = data.page2_opacity;
        const dataValues = Object.values(opacityData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 38; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`G${row}`).value('');
          }
        }
      }

      // Roll Width data to column I (I11-I40)
      if (data.page2_roll_width) {
        const rollWidthData = data.page2_roll_width;
        const dataValues = Object.values(rollWidthData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`I${row}`).value('');
          }
        }
      }

      // Diameter data to column K (K11-K40)
      if (data.page2_diameter) {
        const diameterData = data.page2_diameter;
        const dataValues = Object.values(diameterData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`K${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`K${row}`).value('');
          }
        }
      }

      // Add personnel information to Page 2
      page2Worksheet.cell('B44').value(data.prepared_by || 'Unknown User');
      page2Worksheet.cell('B45').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page2Worksheet.cell('J44').value(data.verified_by || 'Not Verified');
      page2Worksheet.cell('J45').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page2Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');
    }

    // PAGE 3 DATA MAPPING - UC-18gsm-250P-ABQR Page 3 data (Color Measurements)
    if (page3Worksheet && (data.page3_colour_l || data.page3_colour_a || data.page3_colour_b ||
                          data.page3_delta_e || data.page3_base_film_pink)) {

      // Equipment Data for Page 3
      if (data.equipment_used && data.equipment_used.page3) {
        const equipment = data.equipment_used.page3;

        // Color Equipment (D6) - XRITE/SPECTROPHOTOMETER
        page3Worksheet.cell('D6').value(equipment.colour || '');

        // Color Equipment (H6) - SPECTROPHOTOMETER
        page3Worksheet.cell('H6').value(equipment.colour || '');
      }

      // Color L data to column D (D10-D39)
      if (data.page3_colour_l) {
        const colorLData = data.page3_colour_l;
        const dataValues = Object.values(colorLData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`D${row}`).value('');
          }
        }
      }

      // Color A data to column E (E10-E39)
      if (data.page3_colour_a) {
        const colorAData = data.page3_colour_a;
        const dataValues = Object.values(colorAData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`E${row}`).value('');
          }
        }
      }

      // Color B data to column F (F10-F39)
      if (data.page3_colour_b) {
        const colorBData = data.page3_colour_b;
        const dataValues = Object.values(colorBData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`F${row}`).value('');
          }
        }
      }

      // Delta E data to column G (G10-G39)
      if (data.page3_delta_e) {
        const deltaEData = data.page3_delta_e;
        const dataValues = Object.values(deltaEData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`G${row}`).value('');
          }
        }
      }

      // Base Film Pink data to column H (H10-H39)
      if (data.page3_base_film_pink) {
        const baseFilmPinkData = data.page3_base_film_pink;
        const dataValues = Object.values(baseFilmPinkData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`H${row}`).value('');
          }
        }
      }

      // Add personnel information to Page 3
      page3Worksheet.cell('B43').value(data.prepared_by || 'Unknown User');
      page3Worksheet.cell('B44').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page3Worksheet.cell('J43').value(data.verified_by || 'Not Verified');
      page3Worksheet.cell('J44').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page3Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');
    }

    // COA FORM DATA MAPPING - UC-18gsm-250P-ABQR COA Form sheet
    if (coaWorksheet) {
      console.log('COA Form sheet detected, mapping COA data');

      // Inspected By (C41)
      coaWorksheet.cell('C41').value(data.prepared_by || 'Unknown User');

      // Add other COA fields as needed
      // You can add more COA-specific mappings here
    }

    // 4. Generate filename and set response headers
    const productCode = data.product_code || 'UC-18gsm-250P-ABQR';
    const batchNo = data.film_insp_form_ref_no || form_id;

    const filename = `FIF-${productCode}-${batchNo}.xlsx`;

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
    console.error('Error exporting UC-18gsm-250P-ABQR form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting UC-18gsm-250P-ABQR form: ${error.message}`);
  }
});

// UC-18gsm-290P-ABQR Film Inspection Form Excel Export Endpoint
app.get('/export-uc-18gsm-290p-abqr-form', async (req, res) => {
  try {
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    // 1. Fetch data from Supabase for the specific form
    const { data, error } = await supabase
      .from('uc-18gsm-290p-abqr')
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
    const templatePath = path.join(__dirname, 'templates', 'UC-18gsm-290P-ABQR.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let page1Worksheet;
    let page2Worksheet;
    let page3Worksheet;
    let coaWorksheet;

    // Load the template file
    try {
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      page1Worksheet = workbook.sheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.sheet('Page2');
      } catch (error) {
        page2Worksheet = workbook.addSheet('Page2');
      }

      // Create or get Page3 sheet for Page 3 data
      try {
        page3Worksheet = workbook.sheet('Page3');
      } catch (error) {
        page3Worksheet = workbook.addSheet('Page3');
      }

      // Create or get COA Form sheet for COA data
      try {
        coaWorksheet = workbook.sheet('COA Form');
      } catch (error) {
        coaWorksheet = workbook.addSheet('COA Form');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      return res.status(500).send(`Error loading template: ${error.message}`);
    }

    // 3. Map data to Excel cells for Page 1

    // Product Code (C4)
    page1Worksheet.cell('C4').value(data.product_code || '');

    // Specification (C5)
    page1Worksheet.cell('C5').value(data.specification || '');

    // Production Order (F4)
    page1Worksheet.cell('F4').value(data.production_order || '');

    // Purchase Order (F5)
    page1Worksheet.cell('F5').value(data.purchase_order || '');

    // Machine (H4)
    page1Worksheet.cell('H4').value(data.machine_no || '');

    // Quantity (H5) - Add "Rolls" text like prestore form
    page1Worksheet.cell('H5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (J4) - format as DD/MM/YYYY
    page1Worksheet.cell('J4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Inspection Date (J5) - format as DD/MM/YYYY
    page1Worksheet.cell('J5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Equipment Data for Page 1
    if (data.equipment_used && data.equipment_used.page1) {
        page1Worksheet.cell('D6').value(data.equipment_used.page1.basic_weight || '');
        page1Worksheet.cell('E6').value(data.equipment_used.page1.dial_gauge || '');
        page1Worksheet.cell('F6').value('NA');
        page1Worksheet.cell('G6').value(data.equipment_used.page1.instron || '');
        page1Worksheet.cell('I6').value(data.equipment_used.page1.instron || '');
    }

    // Inspected By (B42)
    page1Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B43) - format as DD/MM/YYYY
    page1Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (J42)
    page1Worksheet.cell('J42').value(data.verified_by || 'Not Verified');

    // Verified Date (J43) - format as DD/MM/YYYY
    page1Worksheet.cell('J43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (K3)
    page1Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Film Weight Equipment (D6) - WHS
      page1Worksheet.cell('D6').value(equipment.film_weight || '');

      // Thickness Equipment (E6) - DTG
      page1Worksheet.cell('E6').value(equipment.thickness || '');

      // Tensile/COF Equipment (G6) - UTM
      page1Worksheet.cell('G6').value(equipment.tensile_break || equipment.cof_rr || '');

      // Elongation/Modulus Equipment (I6) - UTM
      page1Worksheet.cell('I6').value(equipment.tensile_break || equipment.elongation || equipment.modulus_10 || '');
    }

    // Map sample data to the correct columns for Page 1
    // Sample data should go in rows 8-37 (30 rows)

    // Lot & Roll data to Sample No. column (A9-A38)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`A${row}`).value(''); // Empty row
        }
      }
    }

    // Roll ID data to column B (B9-B38)
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`B${row}`).value('');
        }
      }
    }

    // Lot Time data to column C (C9-C38)
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`C${row}`).value('');
        }
      }
    }

    // Page 1 Physical Properties data
    // Basis Weight data to column D (D9-D38)
    if (data.page1_basis_weight) {
      const basisWeightData = data.page1_basis_weight;
      const dataValues = Object.values(basisWeightData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`D${row}`).value('');
        }
      }
    }

    // Thickness data to column E (E9-E38)
    if (data.page1_thickness) {
      const thicknessData = data.page1_thickness;
      const dataValues = Object.values(thicknessData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`E${row}`).value('');
        }
      }
    }

    // Wettability data to column F (F9-F38)
    if (data.page1_wettability) {
      const wettabilityData = data.page1_wettability;
      const dataValues = Object.values(wettabilityData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`F${row}`).value('');
        }
      }
    }

    // COF RR data to column G (G9-G38)
    if (data.page1_cof_rr) {
      const cofRRData = data.page1_cof_rr;
      const dataValues = Object.values(cofRRData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`G${row}`).value('');
        }
      }
    }

    // COF CC data to column H (H9-H38)
    if (data.page1_cof_cc) {
      const cofCCData = data.page1_cof_cc;
      const dataValues = Object.values(cofCCData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`H${row}`).value('');
        }
      }
    }

    // Tensile Break data to column I (I9-I38)
    if (data.page1_tensile_break) {
      const tensileBreakData = data.page1_tensile_break;
      const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`I${row}`).value('');
        }
      }
    }

    // Elongation data to column J (J9-J38)
    if (data.page1_elongation) {
      const elongationData = data.page1_elongation;
      const dataValues = Object.values(elongationData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`J${row}`).value('');
        }
      }
    }

    // Modulus data to column K (K9-K38)
    if (data.page1_modulus) {
      const modulusData = data.page1_modulus;
      const dataValues = Object.values(modulusData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`K${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`K${row}`).value('');
        }
      }
    }

    // PAGE 2 DATA MAPPING - UC-18gsm-290P-ABQR Page 2 data (Mechanical Properties)
    if (page2Worksheet && (data.page2_tensile_break || data.page2_cd_elongation || data.page2_modulus ||
                          data.page2_opacity || data.page2_roll_width || data.page2_diameter)) {

      // Equipment Data for Page 2
      if (data.equipment_used && data.equipment_used.page2) {
        const equipment = data.equipment_used.page2;

        // Tensile Break Equipment (D6) - INSTRON UTM
        page2Worksheet.cell('D6').value(equipment.tensile_break || '');

        // Opacity Equipment (G6) - SPECTROPHOTOMETER
        page2Worksheet.cell('G6').value(equipment.opacity || '');

        // Roll Width Equipment (I6) - STEEL RULER
        page2Worksheet.cell('I6').value(equipment.roll_width || '');

        // Diameter Equipment (K6) - STEEL RULER
        page2Worksheet.cell('K6').value(equipment.diameter || '');
      }

      // Tensile Break data to column D (D11-D40)
      if (data.page2_tensile_break) {
        const tensileBreakData = data.page2_tensile_break;
        const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`D${row}`).value('');
          }
        }
      }

      // CD Elongation data to column E (E11-E40)
      if (data.page2_cd_elongation) {
        const cdElongationData = data.page2_cd_elongation;
        const dataValues = Object.values(cdElongationData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`E${row}`).value('');
          }
        }
      }

      // Modulus data to column F (F11-F40)
      if (data.page2_modulus) {
        const modulusData = data.page2_modulus;
        const dataValues = Object.values(modulusData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`F${row}`).value('');
          }
        }
      }

      // Opacity data to column G (G11-G38)
      if (data.page2_opacity) {
        const opacityData = data.page2_opacity;
        const dataValues = Object.values(opacityData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 38; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`G${row}`).value('');
          }
        }
      }

      // Roll Width data to column I (I11-I40)
      if (data.page2_roll_width) {
        const rollWidthData = data.page2_roll_width;
        const dataValues = Object.values(rollWidthData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`I${row}`).value('');
          }
        }
      }

      // Diameter data to column K (K11-K40)
      if (data.page2_diameter) {
        const diameterData = data.page2_diameter;
        const dataValues = Object.values(diameterData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`K${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`K${row}`).value('');
          }
        }
      }

      // Add personnel information to Page 2
      page2Worksheet.cell('B44').value(data.prepared_by || 'Unknown User');
      page2Worksheet.cell('B45').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page2Worksheet.cell('J44').value(data.verified_by || 'Not Verified');
      page2Worksheet.cell('J45').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page2Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');
    }

    // PAGE 3 DATA MAPPING - UC-18gsm-290P-ABQR Page 3 data (Color Measurements)
    if (page3Worksheet && (data.page3_colour_l || data.page3_colour_a || data.page3_colour_b ||
                          data.page3_delta_e || data.page3_base_film_pink)) {

      // Equipment Data for Page 3
      if (data.equipment_used && data.equipment_used.page3) {
        const equipment = data.equipment_used.page3;

        // Color Equipment (D6) - XRITE/SPECTROPHOTOMETER
        page3Worksheet.cell('D6').value(equipment.colour || '');

        // Color Equipment (H6) - SPECTROPHOTOMETER
        page3Worksheet.cell('H6').value(equipment.colour || '');
      }

      // Color L data to column D (D10-D39)
      if (data.page3_colour_l) {
        const colorLData = data.page3_colour_l;
        const dataValues = Object.values(colorLData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`D${row}`).value('');
          }
        }
      }

      // Color A data to column E (E10-E39)
      if (data.page3_colour_a) {
        const colorAData = data.page3_colour_a;
        const dataValues = Object.values(colorAData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`E${row}`).value('');
          }
        }
      }

      // Color B data to column F (F10-F39)
      if (data.page3_colour_b) {
        const colorBData = data.page3_colour_b;
        const dataValues = Object.values(colorBData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`F${row}`).value('');
          }
        }
      }

      // Delta E data to column G (G10-G39)
      if (data.page3_delta_e) {
        const deltaEData = data.page3_delta_e;
        const dataValues = Object.values(deltaEData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`G${row}`).value('');
          }
        }
      }

      // Base Film Pink data to column H (H10-H39)
      if (data.page3_base_film_pink) {
        const baseFilmPinkData = data.page3_base_film_pink;
        const dataValues = Object.values(baseFilmPinkData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`H${row}`).value('');
          }
        }
      }

      // Add personnel information to Page 3
      page3Worksheet.cell('B43').value(data.prepared_by || 'Unknown User');
      page3Worksheet.cell('B44').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page3Worksheet.cell('J43').value(data.verified_by || 'Not Verified');
      page3Worksheet.cell('J44').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page3Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');
    }

    // COA FORM DATA MAPPING - UC-18gsm-290P-ABQR COA Form sheet
    if (coaWorksheet) {
      console.log('COA Form sheet detected, mapping COA data');

      // Inspected By (C41)
      coaWorksheet.cell('C41').value(data.prepared_by || 'Unknown User');

      // Add other COA fields as needed
      // You can add more COA-specific mappings here
    }

    // 4. Generate filename and set response headers
    const productCode = data.product_code || 'UC-18gsm-290P-ABQR';
    const batchNo = data.film_insp_form_ref_no || form_id;

    const filename = `FIF-${productCode}-${batchNo}.xlsx`;

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
    console.error('Error exporting UC-18gsm-290P-ABQR form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting UC-18gsm-290P-ABQR form: ${error.message}`);
  }
});

// UC-18gsm-290NP-ABQR Film Inspection Form Excel Export Endpoint
app.get('/export-uc-18gsm-290np-abqr-form', async (req, res) => {
  try {
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    // 1. Fetch data from Supabase for the specific form
    const { data, error } = await supabase
      .from('uc-18gsm-290np-abqr')
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
    const templatePath = path.join(__dirname, 'templates', 'UC-18gsm-290NP-ABQR.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let page1Worksheet;
    let page2Worksheet;
    let page3Worksheet;
    let coaWorksheet;

    // Load the template file
    try {
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      page1Worksheet = workbook.sheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.sheet('Page2');
      } catch (error) {
        page2Worksheet = workbook.addSheet('Page2');
      }

      // Create or get Page3 sheet for Page 3 data
      try {
        page3Worksheet = workbook.sheet('Page3');
      } catch (error) {
        page3Worksheet = workbook.addSheet('Page3');
      }

      // Create or get COA Form sheet for COA data
      try {
        coaWorksheet = workbook.sheet('COA Form');
      } catch (error) {
        coaWorksheet = workbook.addSheet('COA Form');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      return res.status(500).send(`Error loading template: ${error.message}`);
    }

    // 3. Map data to Excel cells for Page 1

    // Product Code (C4)
    page1Worksheet.cell('C4').value(data.product_code || '');

    // Specification (C5)
    page1Worksheet.cell('C5').value(data.specification || '');

    // Production Order (F4)
    page1Worksheet.cell('F4').value(data.production_order || '');

    // Purchase Order (F5)
    page1Worksheet.cell('F5').value(data.purchase_order || '');

    // Machine (H4)
    page1Worksheet.cell('H4').value(data.machine_no || '');

    // Quantity (H5) - Add "Rolls" text like prestore form
    page1Worksheet.cell('H5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (J4) - format as DD/MM/YYYY
    page1Worksheet.cell('J4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Inspection Date (J5) - format as DD/MM/YYYY
    page1Worksheet.cell('J5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Equipment Data for Page 1
    if (data.equipment_used && data.equipment_used.page1) {
        page1Worksheet.cell('D6').value(data.equipment_used.page1.basic_weight || '');
        page1Worksheet.cell('E6').value(data.equipment_used.page1.dial_gauge || '');
        page1Worksheet.cell('F6').value('NA');
        page1Worksheet.cell('G6').value(data.equipment_used.page1.instron || '');
        page1Worksheet.cell('I6').value(data.equipment_used.page1.instron || '');
    }

    // Inspected By (B42)
    page1Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B43) - format as DD/MM/YYYY
    page1Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (J42)
    page1Worksheet.cell('J42').value(data.verified_by || 'Not Verified');

    // Verified Date (J43) - format as DD/MM/YYYY
    page1Worksheet.cell('J43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (K3)
    page1Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Film Weight Equipment (D6) - WHS
      page1Worksheet.cell('D6').value(equipment.film_weight || '');

      // Thickness Equipment (E6) - DTG
      page1Worksheet.cell('E6').value(equipment.thickness || '');

      // Tensile/COF Equipment (G6) - UTM
      page1Worksheet.cell('G6').value(equipment.tensile_break || equipment.cof_rr || '');

      // Elongation/Modulus Equipment (I6) - UTM
      page1Worksheet.cell('I6').value(equipment.tensile_break || equipment.elongation || equipment.modulus_10 || '');
    }

    // Map sample data to the correct columns for Page 1
    // Sample data should go in rows 8-37 (30 rows)

    // Lot & Roll data to Sample No. column (A9-A38)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`A${row}`).value(''); // Empty row
        }
      }
    }

    // Roll ID data to column B (B9-B38)
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`B${row}`).value('');
        }
      }
    }

    // Lot Time data to column C (C9-C38)
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`C${row}`).value('');
        }
      }
    }

    // Page 1 Physical Properties data
    // Basis Weight data to column D (D9-D38)
    if (data.page1_basis_weight) {
      const basisWeightData = data.page1_basis_weight;
      const dataValues = Object.values(basisWeightData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`D${row}`).value('');
        }
      }
    }

    // Thickness data to column E (E9-E38)
    if (data.page1_thickness) {
      const thicknessData = data.page1_thickness;
      const dataValues = Object.values(thicknessData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`E${row}`).value('');
        }
      }
    }

    // Wettability data to column F (F9-F38)
    if (data.page1_wettability) {
      const wettabilityData = data.page1_wettability;
      const dataValues = Object.values(wettabilityData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`F${row}`).value('');
        }
      }
    }

    // COF RR data to column G (G9-G38)
    if (data.page1_cof_rr) {
      const cofRRData = data.page1_cof_rr;
      const dataValues = Object.values(cofRRData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`G${row}`).value('');
        }
      }
    }

    // COF CC data to column H (H9-H38)
    if (data.page1_cof_cc) {
      const cofCCData = data.page1_cof_cc;
      const dataValues = Object.values(cofCCData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`H${row}`).value('');
        }
      }
    }

    // Tensile Break data to column I (I9-I38)
    if (data.page1_tensile_break) {
      const tensileBreakData = data.page1_tensile_break;
      const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`I${row}`).value('');
        }
      }
    }

    // Elongation data to column J (J9-J38)
    if (data.page1_elongation) {
      const elongationData = data.page1_elongation;
      const dataValues = Object.values(elongationData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`J${row}`).value('');
        }
      }
    }

    // Modulus data to column K (K9-K38)
    if (data.page1_modulus) {
      const modulusData = data.page1_modulus;
      const dataValues = Object.values(modulusData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`K${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`K${row}`).value('');
        }
      }
    }

    // PAGE 2 DATA MAPPING - UC-18gsm-290NP-ABQR Page 2 data (Mechanical Properties)
    if (page2Worksheet && (data.page2_tensile_break || data.page2_cd_elongation || data.page2_modulus ||
                          data.page2_opacity || data.page2_roll_width || data.page2_diameter)) {

      // Equipment Data for Page 2
      if (data.equipment_used && data.equipment_used.page2) {
        const equipment = data.equipment_used.page2;

        // Tensile Break Equipment (D6) - INSTRON UTM
        page2Worksheet.cell('D6').value(equipment.tensile_break || '');

        // Opacity Equipment (G6) - SPECTROPHOTOMETER
        page2Worksheet.cell('G6').value(equipment.opacity || '');

        // Roll Width Equipment (I6) - STEEL RULER
        page2Worksheet.cell('I6').value(equipment.roll_width || '');

        // Diameter Equipment (K6) - STEEL RULER
        page2Worksheet.cell('K6').value(equipment.diameter || '');
      }

      // Tensile Break data to column D (D11-D40)
      if (data.page2_tensile_break) {
        const tensileBreakData = data.page2_tensile_break;
        const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`D${row}`).value('');
          }
        }
      }

      // CD Elongation data to column E (E11-E40)
      if (data.page2_cd_elongation) {
        const cdElongationData = data.page2_cd_elongation;
        const dataValues = Object.values(cdElongationData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`E${row}`).value('');
          }
        }
      }

      // Modulus data to column F (F11-F40)
      if (data.page2_modulus) {
        const modulusData = data.page2_modulus;
        const dataValues = Object.values(modulusData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`F${row}`).value('');
          }
        }
      }

      // Opacity data to column G (G11-G38)
      if (data.page2_opacity) {
        const opacityData = data.page2_opacity;
        const dataValues = Object.values(opacityData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 38; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`G${row}`).value('');
          }
        }
      }

      // Roll Width data to column I (I11-I40)
      if (data.page2_roll_width) {
        const rollWidthData = data.page2_roll_width;
        const dataValues = Object.values(rollWidthData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`I${row}`).value('');
          }
        }
      }

      // Diameter data to column K (K11-K40)
      if (data.page2_diameter) {
        const diameterData = data.page2_diameter;
        const dataValues = Object.values(diameterData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`K${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`K${row}`).value('');
          }
        }
      }

      // Add personnel information to Page 2
      page2Worksheet.cell('B44').value(data.prepared_by || 'Unknown User');
      page2Worksheet.cell('B45').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page2Worksheet.cell('J44').value(data.verified_by || 'Not Verified');
      page2Worksheet.cell('J45').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page2Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');
    }

    // PAGE 3 DATA MAPPING - UC-18gsm-290NP-ABQR Page 3 data (Color Measurements)
    if (page3Worksheet && (data.page3_colour_l || data.page3_colour_a || data.page3_colour_b ||
                          data.page3_delta_e || data.page3_base_film_pink)) {

      // Equipment Data for Page 3
      if (data.equipment_used && data.equipment_used.page3) {
        const equipment = data.equipment_used.page3;

        // Color Equipment (D6) - XRITE/SPECTROPHOTOMETER
        page3Worksheet.cell('D6').value(equipment.colour || '');

        // Color Equipment (H6) - SPECTROPHOTOMETER
        page3Worksheet.cell('H6').value(equipment.colour || '');
      }

      // Color L data to column D (D10-D39)
      if (data.page3_colour_l) {
        const colorLData = data.page3_colour_l;
        const dataValues = Object.values(colorLData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`D${row}`).value('');
          }
        }
      }

      // Color A data to column E (E10-E39)
      if (data.page3_colour_a) {
        const colorAData = data.page3_colour_a;
        const dataValues = Object.values(colorAData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`E${row}`).value('');
          }
        }
      }

      // Color B data to column F (F10-F39)
      if (data.page3_colour_b) {
        const colorBData = data.page3_colour_b;
        const dataValues = Object.values(colorBData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`F${row}`).value('');
          }
        }
      }

      // Delta E data to column G (G10-G39)
      if (data.page3_delta_e) {
        const deltaEData = data.page3_delta_e;
        const dataValues = Object.values(deltaEData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`G${row}`).value('');
          }
        }
      }

      // Base Film Pink data to column H (H10-H39)
      if (data.page3_base_film_pink) {
        const baseFilmPinkData = data.page3_base_film_pink;
        const dataValues = Object.values(baseFilmPinkData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`H${row}`).value('');
          }
        }
      }

      // Add personnel information to Page 3
      page3Worksheet.cell('B43').value(data.prepared_by || 'Unknown User');
      page3Worksheet.cell('B44').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page3Worksheet.cell('J43').value(data.verified_by || 'Not Verified');
      page3Worksheet.cell('J44').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page3Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');
    }

    // COA FORM DATA MAPPING - UC-18gsm-290NP-ABQR COA Form sheet
    if (coaWorksheet) {
      console.log('COA Form sheet detected, mapping COA data');

      // Inspected By (C41)
      coaWorksheet.cell('C41').value(data.prepared_by || 'Unknown User');

      // Add other COA fields as needed
      // You can add more COA-specific mappings here
    }

    // 4. Generate filename and set response headers
    const productCode = data.product_code || 'UC-18gsm-290NP-ABQR';
    const batchNo = data.film_insp_form_ref_no || form_id;

    const filename = `FIF-${productCode}-${batchNo}.xlsx`;

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
    console.error('Error exporting UC-18gsm-290NP-ABQR form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting UC-18gsm-290NP-ABQR form: ${error.message}`);
  }
});

// UC-18gsm-250W-BFQR Film Inspection Form Excel Export Endpoint
app.get('/export-uc-18gsm-250w-bfqr-form', async (req, res) => {
  try {
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    // 1. Fetch data from Supabase for the specific form
    const { data, error } = await supabase
      .from('uc-18gsm-250w-bfqr')
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
    const templatePath = path.join(__dirname, 'templates', 'UC-18gsm-250W-BFQR.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let page1Worksheet;
    let page2Worksheet;
    let page3Worksheet;
    let coaWorksheet;

    // Load the template file
    try {
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      page1Worksheet = workbook.sheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.sheet('Page2');
      } catch (error) {
        page2Worksheet = workbook.addSheet('Page2');
      }

      // Create or get Page3 sheet for Page 3 data
      try {
        page3Worksheet = workbook.sheet('Page3');
      } catch (error) {
        page3Worksheet = workbook.addSheet('Page3');
      }

      // Create or get COA Form sheet for COA data
      try {
        coaWorksheet = workbook.sheet('COA Form');
      } catch (error) {
        coaWorksheet = workbook.addSheet('COA Form');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      return res.status(500).send(`Error loading template: ${error.message}`);
    }

    // 3. Map data to Excel cells for Page 1

    // Product Code (C4)
    page1Worksheet.cell('C4').value(data.product_code || '');

    // Specification (C5)
    page1Worksheet.cell('C5').value(data.specification || '');

    // Production Order (F4)
    page1Worksheet.cell('F4').value(data.production_order || '');

    // Purchase Order (F5)
    page1Worksheet.cell('F5').value(data.purchase_order || '');

    // Machine (H4)
    page1Worksheet.cell('H4').value(data.machine_no || '');

    // Quantity (H5) - Add "Rolls" text like prestore form
    page1Worksheet.cell('H5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (J4) - format as DD/MM/YYYY
    page1Worksheet.cell('J4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Inspection Date (J5) - format as DD/MM/YYYY
    page1Worksheet.cell('J5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Equipment Data for Page 1
    if (data.equipment_used && data.equipment_used.page1) {
        page1Worksheet.cell('D6').value(data.equipment_used.page1.basic_weight || '');
        page1Worksheet.cell('E6').value(data.equipment_used.page1.dial_gauge || '');
        page1Worksheet.cell('F6').value('NA');
        page1Worksheet.cell('G6').value(data.equipment_used.page1.instron || '');
        page1Worksheet.cell('I6').value(data.equipment_used.page1.instron || '');
    }

    // Inspected By (B42)
    page1Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B43) - format as DD/MM/YYYY
    page1Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (J42)
    page1Worksheet.cell('J42').value(data.verified_by || 'Not Verified');

    // Verified Date (J43) - format as DD/MM/YYYY
    page1Worksheet.cell('J43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (K3)
    page1Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Film Weight Equipment (D6) - WHS
      page1Worksheet.cell('D6').value(equipment.film_weight || '');

      // Thickness Equipment (E6) - DTG
      page1Worksheet.cell('E6').value(equipment.thickness || '');

      // Tensile/COF Equipment (G6) - UTM
      page1Worksheet.cell('G6').value(equipment.tensile_break || equipment.cof_rr || '');

      // Elongation/Modulus Equipment (I6) - UTM
      page1Worksheet.cell('I6').value(equipment.tensile_break || equipment.elongation || equipment.modulus_10 || '');
    }

    // Map sample data to the correct columns for Page 1
    // Sample data should go in rows 8-37 (30 rows)

    // Lot & Roll data to Sample No. column (A9-A38)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

      // Fill all 30 rows to match HTML form structure
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9; // Convert to 0-based index
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`A${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`A${row}`).value(''); // Empty row
        }
      }
    }

    // Roll ID data to column B (B9-B38)
    if (data.roll_id) {
      const rollIdData = data.roll_id;
      const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`B${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`B${row}`).value('');
        }
      }
    }

    // Lot Time data to column C (C9-C38)
    if (data.lot_time) {
      const lotTimeData = data.lot_time;
      const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          page1Worksheet.cell(`C${row}`).value(dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`C${row}`).value('');
        }
      }
    }

    // Page 1 Physical Properties data
    // Basis Weight data to column D (D9-D38)
    if (data.page1_basis_weight) {
      const basisWeightData = data.page1_basis_weight;
      const dataValues = Object.values(basisWeightData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`D${row}`).value('');
        }
      }
    }

    // Thickness data to column E (E9-E38)
    if (data.page1_thickness) {
      const thicknessData = data.page1_thickness;
      const dataValues = Object.values(thicknessData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`E${row}`).value('');
        }
      }
    }

    // Wettability data to column F (F9-F38)
    if (data.page1_wettability) {
      const wettabilityData = data.page1_wettability;
      const dataValues = Object.values(wettabilityData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`F${row}`).value('');
        }
      }
    }

    // COF RR data to column G (G9-G38)
    if (data.page1_cof_rr) {
      const cofRRData = data.page1_cof_rr;
      const dataValues = Object.values(cofRRData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`G${row}`).value('');
        }
      }
    }

    // COF CC data to column H (H9-H38)
    if (data.page1_cof_cc) {
      const cofCCData = data.page1_cof_cc;
      const dataValues = Object.values(cofCCData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`H${row}`).value('');
        }
      }
    }

    // Tensile Break data to column I (I9-I38)
    if (data.page1_tensile_break) {
      const tensileBreakData = data.page1_tensile_break;
      const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`I${row}`).value('');
        }
      }
    }

    // Elongation data to column J (J9-J38)
    if (data.page1_elongation) {
      const elongationData = data.page1_elongation;
      const dataValues = Object.values(elongationData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`J${row}`).value('');
        }
      }
    }

    // Modulus data to column K (K9-K38)
    if (data.page1_modulus) {
      const modulusData = data.page1_modulus;
      const dataValues = Object.values(modulusData).filter(value => value !== null && value !== undefined && value !== '');

      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          const numValue = parseFloat(dataValues[dataIndex]);
          page1Worksheet.cell(`K${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
        } else {
          page1Worksheet.cell(`K${row}`).value('');
        }
      }
    }

    // PAGE 2 DATA MAPPING - UC-18gsm-250W-BFQR Page 2 data (Mechanical Properties)
    if (page2Worksheet && (data.page2_tensile_break || data.page2_cd_elongation || data.page2_modulus ||
                          data.page2_opacity || data.page2_roll_width || data.page2_diameter)) {

      // Equipment Data for Page 2
      if (data.equipment_used && data.equipment_used.page2) {
        const equipment = data.equipment_used.page2;

        // Tensile Break Equipment (D6) - INSTRON UTM
        page2Worksheet.cell('D6').value(equipment.tensile_break || '');

        // Opacity Equipment (G6) - SPECTROPHOTOMETER
        page2Worksheet.cell('G6').value(equipment.opacity || '');

        // Roll Width Equipment (I6) - STEEL RULER
        page2Worksheet.cell('I6').value(equipment.roll_width || '');

        // Diameter Equipment (K6) - STEEL RULER
        page2Worksheet.cell('K6').value(equipment.diameter || '');
      }

      // Tensile Break data to column D (D11-D40)
      if (data.page2_tensile_break) {
        const tensileBreakData = data.page2_tensile_break;
        const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`D${row}`).value('');
          }
        }
      }

      // CD Elongation data to column E (E11-E40)
      if (data.page2_cd_elongation) {
        const cdElongationData = data.page2_cd_elongation;
        const dataValues = Object.values(cdElongationData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`E${row}`).value('');
          }
        }
      }

      // Modulus data to column F (F11-F40)
      if (data.page2_modulus) {
        const modulusData = data.page2_modulus;
        const dataValues = Object.values(modulusData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`F${row}`).value('');
          }
        }
      }

      // Opacity data to column G (G11-G38)
      if (data.page2_opacity) {
        const opacityData = data.page2_opacity;
        const dataValues = Object.values(opacityData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 38; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`G${row}`).value('');
          }
        }
      }

      // Roll Width data to column I (I11-I40)
      if (data.page2_roll_width) {
        const rollWidthData = data.page2_roll_width;
        const dataValues = Object.values(rollWidthData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`I${row}`).value('');
          }
        }
      }

      // Diameter data to column K (K11-K40)
      if (data.page2_diameter) {
        const diameterData = data.page2_diameter;
        const dataValues = Object.values(diameterData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`K${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`K${row}`).value('');
          }
        }
      }

      // Add personnel information to Page 2
      page2Worksheet.cell('B44').value(data.prepared_by || 'Unknown User');
      page2Worksheet.cell('B45').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page2Worksheet.cell('J44').value(data.verified_by || 'Not Verified');
      page2Worksheet.cell('J45').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page2Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');
    }

    // PAGE 3 DATA MAPPING - UC-18gsm-250W-BFQR Page 3 data (Color Measurements)
    if (page3Worksheet && (data.page3_colour_l || data.page3_colour_a || data.page3_colour_b ||
                          data.page3_delta_e || data.page3_base_film_pink)) {

      // Equipment Data for Page 3
      if (data.equipment_used && data.equipment_used.page3) {
        const equipment = data.equipment_used.page3;

        // Color Equipment (D6) - XRITE/SPECTROPHOTOMETER
        page3Worksheet.cell('D6').value(equipment.colour || '');

        // Color Equipment (H6) - SPECTROPHOTOMETER
        page3Worksheet.cell('H6').value(equipment.baseFilm || '');
      }

      // Color L data to column D (D10-D39)
      if (data.page3_colour_l) {
        const colorLData = data.page3_colour_l;
        const dataValues = Object.values(colorLData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`D${row}`).value('');
          }
        }
      }

      // Color A data to column E (E10-E39)
      if (data.page3_colour_a) {
        const colorAData = data.page3_colour_a;
        const dataValues = Object.values(colorAData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`E${row}`).value('');
          }
        }
      }

      // Color B data to column F (F10-F39)
      if (data.page3_colour_b) {
        const colorBData = data.page3_colour_b;
        const dataValues = Object.values(colorBData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`F${row}`).value('');
          }
        }
      }

      // Delta E data to column G (G10-G39)
      if (data.page3_delta_e) {
        const deltaEData = data.page3_delta_e;
        const dataValues = Object.values(deltaEData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`G${row}`).value('');
          }
        }
      }

      // Base Film Pink data to column H (H10-H39)
      if (data.page3_base_film_pink) {
        const baseFilmPinkData = data.page3_base_film_pink;
        const dataValues = Object.values(baseFilmPinkData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`H${row}`).value('');
          }
        }
      }

      // Add personnel information to Page 3
      page3Worksheet.cell('B43').value(data.prepared_by || 'Unknown User');
      page3Worksheet.cell('B44').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page3Worksheet.cell('J43').value(data.verified_by || 'Not Verified');
      page3Worksheet.cell('J44').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page3Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');
    }

    // COA FORM DATA MAPPING - UC-18gsm-250W-BFQR COA Form sheet
    if (coaWorksheet) {
      console.log('COA Form sheet detected, mapping COA data');

      // Inspected By (C41)
      coaWorksheet.cell('C41').value(data.prepared_by || 'Unknown User');

      // Add other COA fields as needed
      // You can add more COA-specific mappings here
    }

    // 4. Generate filename and set response headers
    const productCode = data.product_code || 'UC-18gsm-250W-BFQR';
    const batchNo = data.film_insp_form_ref_no || form_id;

    const filename = `FIF-${productCode}-${batchNo}.xlsx`;

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
    console.error('Error exporting UC-18gsm-250W-BFQR form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting UC-18gsm-250W-BFQR form: ${error.message}`);
  }
});

// UC-18gsm-210W-BFQR Film Inspection Form Excel Export Endpoint
app.get('/export-uc-18gsm-210w-bfqr-form', async (req, res) => {
  try {
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    // 1. Fetch data from Supabase for the specific form
    const { data, error } = await supabase
      .from('uc-18gsm-210w-bfqr')
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
    const templatePath = path.join(__dirname, 'templates', 'UC-18gsm-210W-BFQR.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let page1Worksheet;
    let page2Worksheet;
    let page3Worksheet;
    let coaWorksheet;

    // Load the template file
    try {
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      page1Worksheet = workbook.sheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.sheet('Page2');
      } catch (error) {
        page2Worksheet = workbook.addSheet('Page2');
      }

      // Create or get Page3 sheet for Page 3 data
      try {
        page3Worksheet = workbook.sheet('Page3');
      } catch (error) {
        page3Worksheet = workbook.addSheet('Page3');
      }

      // Create or get COA Form sheet for COA data
      try {
        coaWorksheet = workbook.sheet('COA Form');
      } catch (error) {
        coaWorksheet = workbook.addSheet('COA Form');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      return res.status(500).send(`Error loading template: ${error.message}`);
    }

    // 3. Map data to Excel cells for Page 1

    // Product Code (C4)
    page1Worksheet.cell('C4').value(data.product_code || '');

    // Specification (C5)
    page1Worksheet.cell('C5').value(data.specification || '');

    // Production Order (F4)
    page1Worksheet.cell('F4').value(data.production_order || '');

    // Purchase Order (F5)
    page1Worksheet.cell('F5').value(data.purchase_order || '');

    // Machine (H4)
    page1Worksheet.cell('H4').value(data.machine_no || '');

    // Quantity (H5) - Add "Rolls" text like prestore form
    page1Worksheet.cell('H5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (J4) - format as DD/MM/YYYY
    page1Worksheet.cell('J4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Inspection Date (J5) - format as DD/MM/YYYY
    page1Worksheet.cell('J5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Prepared By (B43)
    page1Worksheet.cell('B43').value(data.prepared_by || 'Unknown User');

    // PAGE 1 DATA MAPPING - UC-18gsm-210W-BFQR Page 1 data (Mechanical Properties)
    if (page1Worksheet && (data.page1_basis_weight || data.page1_thickness || data.page1_wettability ||
                          data.page1_cof_rr || data.page1_cof_cc || data.page1_tensile_break ||
                          data.page1_elongation || data.page1_modulus)) {

      // Equipment Data for Page 1
      if (data.equipment_used && data.equipment_used.page1) {
        const equipment = data.equipment_used.page1;

        // Film Weight Equipment (D6) - WEIGH SCALE
        page1Worksheet.cell('D6').value(equipment.film_weight || '');

        // Thickness Equipment (E6) - DIAL GAUGE
        page1Worksheet.cell('E6').value(equipment.thickness || '');

        // COF Equipment (G6) - INSTRON UTM
        page1Worksheet.cell('G6').value(equipment.cof_rr || equipment.cof_cc || '');

        // Tensile Break Equipment (H6) - INSTRON UTM
        page1Worksheet.cell('H6').value(equipment.tensile_break || '');

        // Elongation Equipment (I6) - INSTRON UTM
        page1Worksheet.cell('I6').value(equipment.elongation || '');

        // Modulus Equipment (J6) - INSTRON UTM
        page1Worksheet.cell('J6').value(equipment.modulus || '');
      }

      // Basis Weight data to column D (D9-D38)
      if (data.page1_basis_weight) {
        const basisWeightData = data.page1_basis_weight;
        const dataValues = Object.values(basisWeightData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page1Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page1Worksheet.cell(`D${row}`).value('');
          }
        }
      }

      // Thickness data to column E (E9-E38)
      if (data.page1_thickness) {
        const thicknessData = data.page1_thickness;
        const dataValues = Object.values(thicknessData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page1Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page1Worksheet.cell(`E${row}`).value('');
          }
        }
      }

      // Wettability data to column F (F9-F38)
      if (data.page1_wettability) {
        const wettabilityData = data.page1_wettability;
        const dataValues = Object.values(wettabilityData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page1Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page1Worksheet.cell(`F${row}`).value('');
          }
        }
      }

      // COF RR data to column G (G9-G38)
      if (data.page1_cof_rr) {
        const cofRRData = data.page1_cof_rr;
        const dataValues = Object.values(cofRRData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page1Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page1Worksheet.cell(`G${row}`).value('');
          }
        }
      }

      // COF CC data to column H (H9-H38)
      if (data.page1_cof_cc) {
        const cofCCData = data.page1_cof_cc;
        const dataValues = Object.values(cofCCData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page1Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page1Worksheet.cell(`H${row}`).value('');
          }
        }
      }

      // Tensile Break data to column I (I9-I38)
      if (data.page1_tensile_break) {
        const tensileBreakData = data.page1_tensile_break;
        const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page1Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page1Worksheet.cell(`I${row}`).value('');
          }
        }
      }

      // Elongation data to column J (J9-J38)
      if (data.page1_elongation) {
        const elongationData = data.page1_elongation;
        const dataValues = Object.values(elongationData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page1Worksheet.cell(`J${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page1Worksheet.cell(`J${row}`).value('');
          }
        }
      }

      // Modulus data to column K (K9-K38)
      if (data.page1_modulus) {
        const modulusData = data.page1_modulus;
        const dataValues = Object.values(modulusData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page1Worksheet.cell(`K${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page1Worksheet.cell(`K${row}`).value('');
          }
        }
      }

      // Add personnel information to Page 1
      page1Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');
      page1Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page1Worksheet.cell('J42').value(data.verified_by || 'Not Verified');
      page1Worksheet.cell('J43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page1Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');
    }

    // PAGE 2 DATA MAPPING - UC-18gsm-210W-BFQR Page 2 data (Mechanical Properties)
    if (page2Worksheet && (data.page2_tensile_break || data.page2_cd_elongation || data.page2_modulus ||
                          data.page2_opacity || data.page2_roll_width || data.page2_diameter)) {

      // Equipment Data for Page 2
      if (data.equipment_used && data.equipment_used.page2) {
        const equipment = data.equipment_used.page2;

        // Tensile Break Equipment (D6) - INSTRON UTM
        page2Worksheet.cell('D6').value(equipment.tensile_break || '');

        // Elongation Equipment (E6) - INSTRON UTM
        page2Worksheet.cell('E6').value(equipment.elongation || '');

        // Modulus Equipment (F6) - INSTRON UTM
        page2Worksheet.cell('F6').value(equipment.modulus || '');

        // Opacity Equipment (G6) - SPECTROPHOTOMETER
        page2Worksheet.cell('G6').value(equipment.opacity || '');

        // Roll Width Equipment (I6) - STEEL RULER
        page2Worksheet.cell('I6').value(equipment.roll_width || '');

        // Diameter Equipment (K6) - STEEL RULER
        page2Worksheet.cell('K6').value(equipment.diameter || '');
      }

      // Tensile Break data to column D (D9-D38)
      if (data.page2_tensile_break) {
        const tensileBreakData = data.page2_tensile_break;
        const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`D${row}`).value('');
          }
        }
      }

      // CD Elongation data to column E (E9-E38)
      if (data.page2_cd_elongation) {
        const cdElongationData = data.page2_cd_elongation;
        const dataValues = Object.values(cdElongationData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`E${row}`).value('');
          }
        }
      }

      // Modulus data to column F (F9-F38)
      if (data.page2_modulus) {
        const modulusData = data.page2_modulus;
        const dataValues = Object.values(modulusData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`F${row}`).value('');
          }
        }
      }

      // Opacity data to column G (G9-G38)
      if (data.page2_opacity) {
        const opacityData = data.page2_opacity;
        const dataValues = Object.values(opacityData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`G${row}`).value('');
          }
        }
      }

      // Roll Width data to column I (I9-I38)
      if (data.page2_roll_width) {
        const rollWidthData = data.page2_roll_width;
        const dataValues = Object.values(rollWidthData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`I${row}`).value('');
          }
        }
      }

      // Diameter data to column K (K9-K38)
      if (data.page2_diameter) {
        const diameterData = data.page2_diameter;
        const dataValues = Object.values(diameterData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`K${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`K${row}`).value('');
          }
        }
      }

      // Add personnel information to Page 2
      page2Worksheet.cell('B44').value(data.prepared_by || 'Unknown User');
      page2Worksheet.cell('B45').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page2Worksheet.cell('J44').value(data.verified_by || 'Not Verified');
      page2Worksheet.cell('J45').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page2Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');
    }

    // PAGE 3 DATA MAPPING - UC-18gsm-210W-BFQR Page 3 data (Color Measurements)
    if (page3Worksheet && (data.page3_colour_l || data.page3_colour_a || data.page3_colour_b ||
                          data.page3_delta_e || data.page3_base_film_pink)) {

      // Equipment Data for Page 3
      if (data.equipment_used && data.equipment_used.page3) {
        const equipment = data.equipment_used.page3;

        // Color Equipment (D6) - XRITE/SPECTROPHOTOMETER
        page3Worksheet.cell('D6').value(equipment.colour || '');

        // Color Equipment (H6) - SPECTROPHOTOMETER
        page3Worksheet.cell('H6').value(equipment.baseFilm || '');
      }

      // Color L data to column D (D10-D39)
      if (data.page3_colour_l) {
        const colorLData = data.page3_colour_l;
        const dataValues = Object.values(colorLData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`D${row}`).value('');
          }
        }
      }

      // Color A data to column E (E10-E39)
      if (data.page3_colour_a) {
        const colorAData = data.page3_colour_a;
        const dataValues = Object.values(colorAData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`E${row}`).value('');
          }
        }
      }

      // Color B data to column F (F10-F39)
      if (data.page3_colour_b) {
        const colorBData = data.page3_colour_b;
        const dataValues = Object.values(colorBData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`F${row}`).value('');
          }
        }
      }

      // Delta E data to column G (G10-G39)
      if (data.page3_delta_e) {
        const deltaEData = data.page3_delta_e;
        const dataValues = Object.values(deltaEData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`G${row}`).value('');
          }
        }
      }

      // Base Film Pink data to column H (H10-H39)
      if (data.page3_base_film_pink) {
        const baseFilmPinkData = data.page3_base_film_pink;
        const dataValues = Object.values(baseFilmPinkData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`H${row}`).value('');
          }
        }
      }

      // Add personnel information to Page 3
      page3Worksheet.cell('B43').value(data.prepared_by || 'Unknown User');
      page3Worksheet.cell('B44').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page3Worksheet.cell('J43').value(data.verified_by || 'Not Verified');
      page3Worksheet.cell('J44').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page3Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');
    }

    // COA FORM DATA MAPPING - UC-18gsm-210W-BFQR COA Form sheet
    if (coaWorksheet) {
      console.log('COA Form sheet detected, mapping COA data');

      // Inspected By (C41)
      coaWorksheet.cell('C41').value(data.prepared_by || 'Unknown User');

      // Add other COA fields as needed
      // You can add more COA-specific mappings here
    }

    // 4. Generate filename and set response headers
    const productCode = data.product_code || 'UC-18gsm-210W-BFQR';
    const batchNo = data.film_insp_form_ref_no || form_id;

    const filename = `FIF-${productCode}-${batchNo}.xlsx`;

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
    console.error('Error exporting UC-18gsm-210W-BFQR form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting UC-18gsm-210W-BFQR form: ${error.message}`);
  }
});

// UC-16gsm-165W Film Inspection Form Excel Export Endpoint
app.get('/export-uc-16gsm-165w-form', async (req, res) => {
  try {
    // Get form_id parameter
    const { form_id } = req.query;

    if (!form_id) {
      return res.status(400).send('form_id parameter is required');
    }

    // 1. Fetch data from Supabase for the specific form
    const { data, error } = await supabase
      .from('uc-16gsm-165w')
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
    const templatePath = path.join(__dirname, 'templates', 'UC-16gsm-165W.xlsx');

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      console.error('Template file does not exist at:', templatePath);
      return res.status(500).send('Template file not found');
    }

    let workbook;
    let page1Worksheet;
    let page2Worksheet;
    let page3Worksheet;
    let coaWorksheet;

    // Load the template file
    try {
      workbook = await XlsxPopulate.fromFileAsync(templatePath);
      page1Worksheet = workbook.sheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.sheet('Page2');
      } catch (error) {
        page2Worksheet = workbook.addSheet('Page2');
      }

      // Create or get Page3 sheet for Page 3 data
      try {
        page3Worksheet = workbook.sheet('Page3');
      } catch (error) {
        page3Worksheet = workbook.addSheet('Page3');
      }

      // Create or get COA Form sheet for COA data
      try {
        coaWorksheet = workbook.sheet('COA Form');
      } catch (error) {
        coaWorksheet = workbook.addSheet('COA Form');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      return res.status(500).send(`Error loading template: ${error.message}`);
    }

    // 3. Map data to Excel cells for Page 1

    // Product Code (C4)
    page1Worksheet.cell('C4').value(data.product_code || '');

    // Specification (C5)
    page1Worksheet.cell('C5').value(data.specification || '');

    // Production Order (F4)
    page1Worksheet.cell('F4').value(data.production_order || '');

    // Purchase Order (F5)
    page1Worksheet.cell('F5').value(data.purchase_order || '');

    // Machine (H4)
    page1Worksheet.cell('H4').value(data.machine_no || '');

    // Quantity (H5) - Add "Rolls" text like prestore form
    page1Worksheet.cell('H5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (J4) - format as DD/MM/YYYY
    page1Worksheet.cell('J4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Inspection Date (J5) - format as DD/MM/YYYY
    page1Worksheet.cell('J5').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Prepared By (B43)
    page1Worksheet.cell('B43').value(data.prepared_by || 'Unknown User');

    // 3. Map data to Excel cells for Page 1

    // Product Code (B4)
    page1Worksheet.cell('B4').value(data.product_code || '');

    // Specification (B5)
    page1Worksheet.cell('B5').value(data.specification || '');

    // Production Order (E4)
    page1Worksheet.cell('E4').value(data.production_order || '');

    // Purchase Order (E5)
    page1Worksheet.cell('E5').value(data.purchase_order || '');

    // Machine (G4)
    page1Worksheet.cell('G4').value(data.machine_no || '');

    // Quantity (G5) - Add "Rolls" text like prestore form
    page1Worksheet.cell('G5').value(data.quantity ? `${data.quantity} Rolls` : '');

    // Production Date (I4) - format as DD/MM/YYYY
    page1Worksheet.cell('I4').value(data.production_date ? formatDateToDDMMYYYY(data.production_date) : '');

    // Personnel Information Section
    // Inspected By (B42)
    page1Worksheet.cell('B42').value(data.prepared_by || 'Unknown User');

    // Inspection Date (B43) - format as DD/MM/YYYY
    page1Worksheet.cell('B43').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');

    // Verified By (J42)
    page1Worksheet.cell('J42').value(data.verified_by || 'Not Verified');

    // Verified Date (J43) - format as DD/MM/YYYY
    page1Worksheet.cell('J43').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');

    // Film Inspection Form Ref No (I3)
    page1Worksheet.cell('I3').value(data.film_insp_form_ref_no || '');

    // Prepared By (for reference in equipment section)
    // Note: data.prepared_by is already mapped above as Inspected By

    // PAGE 1 DATA MAPPING - UC-16gsm-165W Page 1 data (Mechanical Properties)
    if (page1Worksheet && (data.page1_basis_weight || data.page1_thickness || data.page1_cof_rr ||
                          data.page1_tensile_break || data.page1_elongation || data.page1_modulus)) {

      // Equipment Data for Page 1
      if (data.equipment_used && data.equipment_used.page1) {
        const equipment = data.equipment_used.page1;

        // Film Weight Equipment (D6) - WEIGH SCALE
        page1Worksheet.cell('D6').value(equipment.film_weight || '');

        // Thickness Equipment (E6) - DIAL GAUGE
        page1Worksheet.cell('E6').value(equipment.thickness || '');

        // Tensile/Elongation/Modulus Equipment (F6) - INSTRON UTM (shared)
        // Tensile Break Equipment (F6, G6) - INSTRON UTM (tensile break, elongation, modulus now use same equipment)
        const tensileEquipment = equipment.tensile_break || equipment.elongation || equipment.modulus_10 || '';
        page1Worksheet.cell('F6').value(tensileEquipment);
        page1Worksheet.cell('G6').value(tensileEquipment);
      }

      // Basis Weight data to column D (D9-D38)
      if (data.page1_basis_weight) {
        const basisWeightData = data.page1_basis_weight;
        const dataValues = Object.values(basisWeightData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page1Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page1Worksheet.cell(`D${row}`).value('');
          }
        }
      }

      // Thickness data to column E (E9-E38)
      if (data.page1_thickness) {
      const thicknessData = data.page1_thickness;
        const dataValues = Object.values(thicknessData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page1Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page1Worksheet.cell(`E${row}`).value('');
          }
        }
      }

      // COF (R-R) data to column F (F9-F38)
      if (data.page1_cof_rr) {
      const cofData = data.page1_cof_rr;
        const dataValues = Object.values(cofData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page1Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page1Worksheet.cell(`F${row}`).value('');
          }
        }
      }

      // Tensile Break data to column G (G9-G38)
      if (data.page1_tensile_break) {
      const tensileData = data.page1_tensile_break;
        const dataValues = Object.values(tensileData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page1Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page1Worksheet.cell(`G${row}`).value('');
          }
        }
      }

      // MD Elongation Break data to column H (H9-H38)
      if (data.page1_elongation) {
      const elongationData = data.page1_elongation;
        const dataValues = Object.values(elongationData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page1Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page1Worksheet.cell(`H${row}`).value('');
          }
        }
      }

      // 10% Modulus data to column I (I9-I38)
      if (data.page1_modulus) {
      const modulusData = data.page1_modulus;
        const dataValues = Object.values(modulusData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page1Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page1Worksheet.cell(`I${row}`).value('');
          }
        }
      }

      // Add personnel information to Page 1
      page1Worksheet.cell('B44').value(data.prepared_by || 'Unknown User');
      page1Worksheet.cell('B45').value(data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '');
      page1Worksheet.cell('J44').value(data.verified_by || 'Not Verified');
      page1Worksheet.cell('J45').value(data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '');
      page1Worksheet.cell('K3').value(data.film_insp_form_ref_no || '');
    }

    // PAGE 2 DATA MAPPING - UC-16gsm-165W Page 2 data (Mechanical Properties - CD & Others)
    if (page2Worksheet && (data.page2_tensile_break || data.page2_cd_elongation || data.page2_modulus ||
                          data.page2_opacity || data.page2_roll_width || data.page2_diameter)) {

      // Equipment Data for Page 2
      if (data.equipment_used && data.equipment_used.page2) {
        const equipment = data.equipment_used.page2;

        // Combined UTM Equipment (D6, E6, F6) - INSTRON UTM (tensile break, elongation, modulus now use same equipment)
        const utmEquipment = equipment.tensile_break || equipment.cd_elongation || equipment.modulus || '';
        page2Worksheet.cell('D6').value(utmEquipment);
        page2Worksheet.cell('E6').value(utmEquipment);
        page2Worksheet.cell('F6').value(utmEquipment);

        // Opacity Equipment (G6) - SPECTROPHOTOMETER
        page2Worksheet.cell('G6').value(equipment.opacity || '');

        // Roll Width Equipment (I6) - STEEL RULER
        page2Worksheet.cell('I6').value(equipment.roll_width || '');

        // Diameter Equipment (K6) - STEEL RULER
        page2Worksheet.cell('K6').value(equipment.diameter || '');
      }

      // Tensile Break (CD) data to column D (D11-D40)
      if (data.page2_tensile_break) {
        const tensileBreakData = data.page2_tensile_break;
        const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`D${row}`).value('');
          }
        }
      }

      // CD Elongation data to column E (E11-E38)
      if (data.page2_cd_elongation) {
        const cdElongationData = data.page2_cd_elongation;
        const dataValues = Object.values(cdElongationData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 38; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`E${row}`).value('');
          }
        }
      }

      // Modulus (CD) data to column F (F9-F40)
      if (data.page2_modulus) {
        const modulusData = data.page2_modulus;
        const dataValues = Object.values(modulusData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 40; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`F${row}`).value('');
          }
        }
      }

      // Opacity data to column G (G11-G40)
      if (data.page2_opacity) {
        const opacityData = data.page2_opacity;
        const dataValues = Object.values(opacityData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`G${row}`).value('');
          }
        }
      }

      // Roll Width data to column H (H11-H40)
      if (data.page2_roll_width) {
        const rollWidthData = data.page2_roll_width;
        const dataValues = Object.values(rollWidthData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`H${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`H${row}`).value('');
          }
        }
      }

      // Diameter data to column I (I11-I40)
      if (data.page2_diameter) {
      const diameterData = data.page2_diameter;
        const dataValues = Object.values(diameterData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.cell(`I${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page2Worksheet.cell(`I${row}`).value('');
          }
        }
      }

      // Equipment Data for Page 2
      if (data.equipment_used && data.equipment_used.page2) {
        const equipment = data.equipment_used.page2;

        // Tensile Break Equipment (D6) - INSTRON UTM
        page2Worksheet.cell('D6').value(equipment.tensile_break || '');

        // CD Elongation Equipment (E6) - INSTRON UTM
        page2Worksheet.cell('E6').value(equipment.cd_elongation || '');

        // Modulus Equipment (F6) - INSTRON UTM
        page2Worksheet.cell('F6').value(equipment.modulus || '');

        // Opacity Equipment (G6) - SPECTROPHOTOMETER
        page2Worksheet.cell('G6').value(equipment.opacity || '');

        // Roll Width Equipment (I6) - STEEL RULER
        page2Worksheet.cell('I6').value(equipment.roll_width || '');

        // Diameter Equipment (K6) - STEEL RULER
        page2Worksheet.cell('K6').value(equipment.diameter || '');
      }

      // Personnel information only on Page 1 for UC-16gsm-165W
      // (Page 2 personnel info removed as requested)
    }

    // PAGE 3 DATA MAPPING - UC-16gsm-165W Page 3 data (Color Measurements)
    if (page3Worksheet && (data.page3_colour_l || data.page3_colour_a || data.page3_colour_b ||
                          data.page3_delta_e)) {

      // Equipment Data for Page 3
      if (data.equipment_used && data.equipment_used.page3) {
        const equipment = data.equipment_used.page3;

        // Color Equipment (D6) - STM SPECTROPHOTOMETER
        page3Worksheet.cell('D6').value(equipment.colour || '');
      }

      // Color L data to column D (D9-D38)
      if (data.page3_colour_l) {
        const colorLData = data.page3_colour_l;
        const dataValues = Object.values(colorLData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`D${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`D${row}`).value('');
          }
        }
      }

      // Color A data to column E (E9-E38)
      if (data.page3_colour_a) {
        const colorAData = data.page3_colour_a;
        const dataValues = Object.values(colorAData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`E${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`E${row}`).value('');
          }
        }
      }

      // Color B data to column F (F9-F38)
      if (data.page3_colour_b) {
        const colorBData = data.page3_colour_b;
        const dataValues = Object.values(colorBData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`F${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`F${row}`).value('');
          }
        }
      }

      // Delta E data to column G (G9-G38)
      if (data.page3_delta_e) {
        const deltaEData = data.page3_delta_e;
        const dataValues = Object.values(deltaEData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.cell(`G${row}`).value(!isNaN(numValue) ? numValue : dataValues[dataIndex]);
          } else {
            page3Worksheet.cell(`G${row}`).value('');
          }
        }
      }

      // Personnel information only on Page 1 for UC-16gsm-165W
      // (Page 3 personnel info removed as requested)
    }

    // COA FORM DATA MAPPING - UC-16gsm-165W COA Form sheet
    if (coaWorksheet) {
      console.log('COA Form sheet detected, mapping COA data');

      // Inspected By (C41)
      coaWorksheet.cell('C41').value(data.prepared_by || 'Unknown User');

      // Add other COA fields as needed
      // You can add more COA-specific mappings here
    }

    // 4. Generate filename and set response headers
    const productCode = data.product_code || 'UC-16gsm-165W';
    const batchNo = data.film_insp_form_ref_no || form_id;

    const filename = `FIF-${productCode}-${batchNo}.xlsx`;

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
    console.error('Error exporting UC-16gsm-165W form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting UC-16gsm-165W form: ${error.message}`);
  }
});
};
