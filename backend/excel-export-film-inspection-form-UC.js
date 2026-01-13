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

// Helper function to format time to HH:MM (remove seconds if present)
function formatTimeToHHMM(timeString) {
  if (!timeString) return '';
  // If already in HH:MM format, return as is
  if (timeString.length === 5) return timeString;
  // Otherwise, split by : and take only hours and minutes
  return timeString.split(':').slice(0, 2).join(':');
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
    // Parse cell reference (e.g., C33)
    const col = cellRef.charCodeAt(0) - 65; // A=0, B=1, C=2, etc.
    const row = parseInt(cellRef.substring(1), 10);

    // Center square (1:1 ratio) image in the cell
    // Excel cells are ~64px wide - 95x95 image centered in middle
    worksheet.addImage(imageId, {
      tl: { col: col + 0.25, row: row - 1 + 0.35 }, // Center the 95px image in middle
      ext: { width: 95, height: 95 } // Perfect square 1:1 ratio
    });

    console.log(`Successfully inserted signature for user ${userName} (ID: ${userId}) in cell ${cellRef}`);
  } catch (error) {
    console.error(`Error inserting signature for user ${userName}:`, error.message);
  }
}

// Helper function to apply password protection using ExcelJS
async function applyPasswordProtection(workbook) {
  try {
    // ExcelJS (v4.x) can produce workbooks that Excel “repairs” when templates
    // contain advanced conditional formatting (DXFs). UC templates include this.
    // Strip conditional formatting before writing to keep the XLSX valid.
    for (const worksheet of workbook.worksheets) {
      if (Array.isArray(worksheet.conditionalFormattings) && worksheet.conditionalFormattings.length > 0) {
        worksheet.conditionalFormattings = [];
      }
    }

    // Apply sheet protection with password (awaited).
    // Note: cells are locked by default in Excel; we avoid touching per-cell
    // protection because it can explode style records and trigger repairs.
    for (const worksheet of workbook.worksheets) {
      await worksheet.protect('2256', {
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
    }

    return await workbook.xlsx.writeBuffer();
  } catch (error) {
    console.error('Error applying password protection:', error);
    throw error;
  }
}

module.exports = function(app, createAuthenticatedSupabaseClient) {
  // UC Series Film Inspection Form Excel Export Endpoints
// UC-18gsm-250P-ABQR Film Inspection Form Excel Export Endpoint
app.get('/export-uc-18gsm-250p-abqr-form', async (req, res) => {
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
      workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(templatePath);
      page1Worksheet = workbook.getWorksheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.getWorksheet('Page2');
      } catch (error) {
        page2Worksheet = workbook.addWorksheet('Page2');
      }

      // Create or get Page3 sheet for Page 3 data
      try {
        page3Worksheet = workbook.getWorksheet('Page3');
      } catch (error) {
        page3Worksheet = workbook.addWorksheet('Page3');
      }

      // Create or get COA Form sheet for COA data
      try {
        coaWorksheet = workbook.getWorksheet('COA Form');
      } catch (error) {
        coaWorksheet = workbook.addWorksheet('COA Form');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      return res.status(500).send(`Error loading template: ${error.message}`);
    }

    // 3. Map data to Excel cells for Page 1

    // Product Code (C4)
    page1Worksheet.getCell('C4').value = data.product_code || '';

    // Specification (C5)
    page1Worksheet.getCell('C5').value = data.specification || '';

    // Production Order (F4)
    page1Worksheet.getCell('F4').value = data.production_order || '';

    // Purchase Order (F5)
  page1Worksheet.getCell('F5').value = data.purchase_order ? data.purchase_order : 'NA';

    // Machine (H4)
    page1Worksheet.getCell('H4').value = data.machine_no || '';

    // Quantity (H5) - Add "Rolls" text like prestore form
    page1Worksheet.getCell('H5').value = data.quantity ? `${data.quantity} Rolls` : '';

    // Production Date (J4) - format as DD/MM/YYYY
    page1Worksheet.getCell('J4').value = data.production_date ? formatDateToDDMMYYYY(data.production_date) : '';

    // Inspection Date (J5) - format as DD/MM/YYYY
    page1Worksheet.getCell('J5').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Equipment Data for Page 1
    if (data.equipment_used && data.equipment_used.page1) {
        page1Worksheet.getCell('D6').value = data.equipment_used.page1.basic_weight || '';
        page1Worksheet.getCell('E6').value = data.equipment_used.page1.dial_gauge || '';
        page1Worksheet.getCell('F6').value = 'NA';
        page1Worksheet.getCell('G6').value = data.equipment_used.page1.instron || '';
        page1Worksheet.getCell('I6').value = data.equipment_used.page1.instron || '';
    }

    // Inspected By (B42)
    page1Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';

    // Inspection Date (B43) - format as DD/MM/YYYY
    page1Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Verified By (J42)
    page1Worksheet.getCell('J42').value = data.verified_by || 'Not Verified';

    // Verified Date (J43) - format as DD/MM/YYYY
    page1Worksheet.getCell('J43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';

    // Film Inspection Form Ref No (K3)
    page1Worksheet.getCell('K3').value = data.ref_no || '';

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Film Weight Equipment (D6) - WHS
      page1Worksheet.getCell('D6').value = equipment.film_weight || '';

      // Thickness Equipment (E6) - DTG
      page1Worksheet.getCell('E6').value = equipment.thickness || '';

      // Tensile/COF Equipment (G6) - UTM
      page1Worksheet.getCell('G6').value = equipment.tensile_break || equipment.cof_rr || '';

      // Elongation/Modulus Equipment (I6) - UTM
      page1Worksheet.getCell('I6').value = equipment.tensile_break || equipment.elongation || equipment.modulus_10 || '';
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
          page1Worksheet.getCell(`A${row}`).value = dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`A${row}`).value = ''; // Empty row
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
          page1Worksheet.getCell(`B${row}`).value = dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`B${row}`).value = '';
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
          page1Worksheet.getCell(`C${row}`).value = dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`C${row}`).value = '';
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
          page1Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`D${row}`).value = '';
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
          page1Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`E${row}`).value = '';
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
          page1Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`F${row}`).value = '';
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
          page1Worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`G${row}`).value = '';
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
          page1Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`H${row}`).value = '';
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
          page1Worksheet.getCell(`I${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`I${row}`).value = '';
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
          page1Worksheet.getCell(`J${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`J${row}`).value = '';
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
          page1Worksheet.getCell(`K${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`K${row}`).value = '';
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
        page2Worksheet.getCell('D6').value = equipment.tensile_break || '';

        // Opacity Equipment (G6) - SPECTROPHOTOMETER
        page2Worksheet.getCell('G6').value = equipment.opacity || '';

        // Roll Width Equipment (I6) - STEEL RULER
        page2Worksheet.getCell('I6').value = equipment.roll_width || '';

        // Diameter Equipment (K6) - STEEL RULER
        page2Worksheet.getCell('K6').value = equipment.diameter || '';
      }

      // Tensile Break data to column D (D11-D40)
      if (data.page2_tensile_break) {
        const tensileBreakData = data.page2_tensile_break;
        const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`D${row}`).value = '';
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
            page2Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`E${row}`).value = '';
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
            page2Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`F${row}`).value = '';
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
            page2Worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`G${row}`).value = '';
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
            page2Worksheet.getCell(`I${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`I${row}`).value = '';
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
            page2Worksheet.getCell(`K${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`K${row}`).value = '';
          }
        }
      }

      // Add personnel information to Page 2
      page2Worksheet.getCell('B44').value = data.prepared_by || 'Unknown User';
      page2Worksheet.getCell('B45').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page2Worksheet.getCell('J44').value = data.verified_by || 'Not Verified';
      page2Worksheet.getCell('J45').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page2Worksheet.getCell('K3').value = data.ref_no || '';
    }

    // PAGE 3 DATA MAPPING - UC-18gsm-250P-ABQR Page 3 data (Color Measurements)
    if (page3Worksheet && (data.page3_colour_l || data.page3_colour_a || data.page3_colour_b ||
                          data.page3_delta_e || data.page3_base_film_pink)) {

      // Equipment Data for Page 3
      if (data.equipment_used && data.equipment_used.page3) {
        const equipment = data.equipment_used.page3;

        // Color Equipment (D6) - XRITE/SPECTROPHOTOMETER
        page3Worksheet.getCell('D6').value = equipment.colour || '';

        // Color Equipment (H6) - SPECTROPHOTOMETER
        page3Worksheet.getCell('H6').value = equipment.colour || '';
      }

      // Color L data to column D (D10-D39)
      if (data.page3_colour_l) {
        const colorLData = data.page3_colour_l;
        const dataValues = Object.values(colorLData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`D${row}`).value = '';
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
            page3Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`E${row}`).value = '';
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
            page3Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`F${row}`).value = '';
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
            page3Worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`G${row}`).value = '';
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
            page3Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`H${row}`).value = '';
          }
        }
      }

      // Add personnel information to Page 3
      page3Worksheet.getCell('B43').value = data.prepared_by || 'Unknown User';
      page3Worksheet.getCell('B44').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page3Worksheet.getCell('J43').value = data.verified_by || 'Not Verified';
      page3Worksheet.getCell('J44').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page3Worksheet.getCell('K3').value = data.ref_no || '';
    }

    // COA FORM DATA MAPPING - UC-18gsm-250P-ABQR COA Form sheet
    if (coaWorksheet) {
      console.log('COA Form sheet detected, mapping COA data');

      // Lot No (B7)
      coaWorksheet.getCell('B7').value = data.lot_no || '';

      // Inspected By - Signature in D41, Date & Name in C42
      const preparedBy = data.prepared_by || 'Unknown User';
      const inspectionDate = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      
      // Insert signature image in D41
      if (data.prepared_by) {
        await insertSignatureInCell(coaWorksheet, 'D41', data.prepared_by, supabase);
      }
      
      // Date and name in C42
      coaWorksheet.getCell('C42').value = `(${inspectionDate})\n${preparedBy}`;

      // Approved By - Signature in G41, Date & Name in F42
      const approvedBy = data.approved_by || 'Not Approved';
      const approvedDate = data.approved_date ? formatDateToDDMMYYYY(data.approved_date) : '';
      
      // Insert signature image in G41
      if (data.approved_by) {
        await insertSignatureInCell(coaWorksheet, 'G41', data.approved_by, supabase);
      }
      
      // Date and name in F42
      coaWorksheet.getCell('F42').value = `(${approvedDate})\n${approvedBy}`;
    }

    // 4. Generate filename and set response headers
    const productCode = data.product_code || 'UC-18gsm-250P-ABQR';
    const batchNo = data.ref_no || form_id;

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
    console.error('Error exporting UC-18gsm-250P-ABQR form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting UC-18gsm-250P-ABQR form: ${error.message}`);
  }
});

// UC-18gsm-290P-ABQR Film Inspection Form Excel Export Endpoint
app.get('/export-uc-18gsm-290p-abqr-form', async (req, res) => {
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
      workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(templatePath);
      page1Worksheet = workbook.getWorksheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.getWorksheet('Page2');
      } catch (error) {
        page2Worksheet = workbook.addWorksheet('Page2');
      }

      // Create or get Page3 sheet for Page 3 data
      try {
        page3Worksheet = workbook.getWorksheet('Page3');
      } catch (error) {
        page3Worksheet = workbook.addWorksheet('Page3');
      }

      // Create or get COA Form sheet for COA data
      try {
        coaWorksheet = workbook.getWorksheet('COA Form');
      } catch (error) {
        coaWorksheet = workbook.addWorksheet('COA Form');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      return res.status(500).send(`Error loading template: ${error.message}`);
    }

    // 3. Map data to Excel cells for Page 1

    // Product Code (C4)
    page1Worksheet.getCell('C4').value = data.product_code || '';

    // Specification (C5)
    page1Worksheet.getCell('C5').value = data.specification || '';

    // Production Order (F4)
    page1Worksheet.getCell('F4').value = data.production_order || '';

    // Purchase Order (F5)
  page1Worksheet.getCell('F5').value = data.purchase_order ? data.purchase_order : 'NA';

    // Machine (H4)
    page1Worksheet.getCell('H4').value = data.machine_no || '';

    // Quantity (H5) - Add "Rolls" text like prestore form
    page1Worksheet.getCell('H5').value = data.quantity ? `${data.quantity} Rolls` : '';

    // Production Date (J4) - format as DD/MM/YYYY
    page1Worksheet.getCell('J4').value = data.production_date ? formatDateToDDMMYYYY(data.production_date) : '';

    // Inspection Date (J5) - format as DD/MM/YYYY
    page1Worksheet.getCell('J5').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Equipment Data for Page 1
    if (data.equipment_used && data.equipment_used.page1) {
        page1Worksheet.getCell('D6').value = data.equipment_used.page1.basic_weight || '';
        page1Worksheet.getCell('E6').value = data.equipment_used.page1.dial_gauge || '';
        page1Worksheet.getCell('F6').value = 'NA';
        page1Worksheet.getCell('G6').value = data.equipment_used.page1.instron || '';
        page1Worksheet.getCell('I6').value = data.equipment_used.page1.instron || '';
    }

    // Inspected By (B42)
    page1Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';

    // Inspection Date (B43) - format as DD/MM/YYYY
    page1Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Verified By (J42)
    page1Worksheet.getCell('J42').value = data.verified_by || 'Not Verified';

    // Verified Date (J43) - format as DD/MM/YYYY
    page1Worksheet.getCell('J43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';

    // Film Inspection Form Ref No (K3)
    page1Worksheet.getCell('K3').value = data.ref_no || '';

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Film Weight Equipment (D6) - WHS
      page1Worksheet.getCell('D6').value = equipment.film_weight || '';

      // Thickness Equipment (E6) - DTG
      page1Worksheet.getCell('E6').value = equipment.thickness || '';

      // Tensile/COF Equipment (G6) - UTM
      page1Worksheet.getCell('G6').value = equipment.tensile_break || equipment.cof_rr || '';

      // Elongation/Modulus Equipment (I6) - UTM
      page1Worksheet.getCell('I6').value = equipment.tensile_break || equipment.elongation || equipment.modulus_10 || '';
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
          page1Worksheet.getCell(`A${row}`).value = dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`A${row}`).value = ''; // Empty row
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
          page1Worksheet.getCell(`B${row}`).value = dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`B${row}`).value = '';
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
          page1Worksheet.getCell(`C${row}`).value = dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`C${row}`).value = '';
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
          page1Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`D${row}`).value = '';
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
          page1Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`E${row}`).value = '';
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
          page1Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`F${row}`).value = '';
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
          page1Worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`G${row}`).value = '';
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
          page1Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`H${row}`).value = '';
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
          page1Worksheet.getCell(`I${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`I${row}`).value = '';
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
          page1Worksheet.getCell(`J${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`J${row}`).value = '';
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
          page1Worksheet.getCell(`K${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`K${row}`).value = '';
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
        page2Worksheet.getCell('D6').value = equipment.tensile_break || '';

        // Opacity Equipment (G6) - SPECTROPHOTOMETER
        page2Worksheet.getCell('G6').value = equipment.opacity || '';

        // Roll Width Equipment (I6) - STEEL RULER
        page2Worksheet.getCell('I6').value = equipment.roll_width || '';

        // Diameter Equipment (K6) - STEEL RULER
        page2Worksheet.getCell('K6').value = equipment.diameter || '';
      }

      // Tensile Break data to column D (D11-D40)
      if (data.page2_tensile_break) {
        const tensileBreakData = data.page2_tensile_break;
        const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`D${row}`).value = '';
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
            page2Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`E${row}`).value = '';
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
            page2Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`F${row}`).value = '';
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
            page2Worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`G${row}`).value = '';
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
            page2Worksheet.getCell(`I${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`I${row}`).value = '';
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
            page2Worksheet.getCell(`K${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`K${row}`).value = '';
          }
        }
      }

      // Add personnel information to Page 2
      page2Worksheet.getCell('B44').value = data.prepared_by || 'Unknown User';
      page2Worksheet.getCell('B45').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page2Worksheet.getCell('J44').value = data.verified_by || 'Not Verified';
      page2Worksheet.getCell('J45').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page2Worksheet.getCell('K3').value = data.ref_no || '';
    }

    // PAGE 3 DATA MAPPING - UC-18gsm-290P-ABQR Page 3 data (Color Measurements)
    if (page3Worksheet && (data.page3_colour_l || data.page3_colour_a || data.page3_colour_b ||
                          data.page3_delta_e || data.page3_base_film_pink)) {

      // Equipment Data for Page 3
      if (data.equipment_used && data.equipment_used.page3) {
        const equipment = data.equipment_used.page3;

        // Color Equipment (D6) - XRITE/SPECTROPHOTOMETER
        page3Worksheet.getCell('D6').value = equipment.colour || '';

        // Color Equipment (H6) - SPECTROPHOTOMETER
        page3Worksheet.getCell('H6').value = equipment.colour || '';
      }

      // Color L data to column D (D10-D39)
      if (data.page3_colour_l) {
        const colorLData = data.page3_colour_l;
        const dataValues = Object.values(colorLData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`D${row}`).value = '';
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
            page3Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`E${row}`).value = '';
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
            page3Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`F${row}`).value = '';
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
            page3Worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`G${row}`).value = '';
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
            page3Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`H${row}`).value = '';
          }
        }
      }

      // Add personnel information to Page 3
      page3Worksheet.getCell('B43').value = data.prepared_by || 'Unknown User';
      page3Worksheet.getCell('B44').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page3Worksheet.getCell('J43').value = data.verified_by || 'Not Verified';
      page3Worksheet.getCell('J44').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page3Worksheet.getCell('K3').value = data.ref_no || '';
    }

    // COA FORM DATA MAPPING - UC-18gsm-290P-ABQR COA Form sheet
    if (coaWorksheet) {
      console.log('COA Form sheet detected, mapping COA data');

      // Lot No (B7)
      coaWorksheet.getCell('B7').value = data.lot_no || '';

      // Inspected By - Signature in D41, Date & Name in C42
      const preparedBy = data.prepared_by || 'Unknown User';
      const inspectionDate = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      
      // Insert signature image in D41
      if (data.prepared_by) {
        await insertSignatureInCell(coaWorksheet, 'D41', data.prepared_by, supabase);
      }
      
      // Date and name in C42
      coaWorksheet.getCell('C42').value = `(${inspectionDate})\n${preparedBy}`;

      // Approved By - Signature in G41, Date & Name in F42
      const approvedBy = data.approved_by || 'Not Approved';
      const approvedDate = data.approved_date ? formatDateToDDMMYYYY(data.approved_date) : '';
      
      // Insert signature image in G41
      if (data.approved_by) {
        await insertSignatureInCell(coaWorksheet, 'G41', data.approved_by, supabase);
      }
      
      // Date and name in F42
      coaWorksheet.getCell('F42').value = `(${approvedDate})\n${approvedBy}`;
    }

    // 4. Generate filename and set response headers
    const productCode = data.product_code || 'UC-18gsm-290P-ABQR';
    const batchNo = data.ref_no || form_id;

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
    console.error('Error exporting UC-18gsm-290P-ABQR form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting UC-18gsm-290P-ABQR form: ${error.message}`);
  }
});

// UC-18gsm-290NP-ABQR Film Inspection Form Excel Export Endpoint
app.get('/export-uc-18gsm-290np-abqr-form', async (req, res) => {
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
      workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(templatePath);
      page1Worksheet = workbook.getWorksheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.getWorksheet('Page2');
      } catch (error) {
        page2Worksheet = workbook.addWorksheet('Page2');
      }

      // Create or get Page3 sheet for Page 3 data
      try {
        page3Worksheet = workbook.getWorksheet('Page3');
      } catch (error) {
        page3Worksheet = workbook.addWorksheet('Page3');
      }

      // Create or get COA Form sheet for COA data
      try {
        coaWorksheet = workbook.getWorksheet('COA Form');
      } catch (error) {
        coaWorksheet = workbook.addWorksheet('COA Form');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      return res.status(500).send(`Error loading template: ${error.message}`);
    }

    // 3. Map data to Excel cells for Page 1

    // Product Code (C4)
    page1Worksheet.getCell('C4').value = data.product_code || '';

    // Specification (C5)
    page1Worksheet.getCell('C5').value = data.specification || '';

    // Production Order (F4)
    page1Worksheet.getCell('F4').value = data.production_order || '';

    // Purchase Order (F5)
  page1Worksheet.getCell('F5').value = data.purchase_order ? data.purchase_order : 'NA';

    // Machine (H4)
    page1Worksheet.getCell('H4').value = data.machine_no || '';

    // Quantity (H5) - Add "Rolls" text like prestore form
    page1Worksheet.getCell('H5').value = data.quantity ? `${data.quantity} Rolls` : '';

    // Production Date (J4) - format as DD/MM/YYYY
    page1Worksheet.getCell('J4').value = data.production_date ? formatDateToDDMMYYYY(data.production_date) : '';

    // Inspection Date (J5) - format as DD/MM/YYYY
    page1Worksheet.getCell('J5').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Equipment Data for Page 1
    if (data.equipment_used && data.equipment_used.page1) {
        page1Worksheet.getCell('D6').value = data.equipment_used.page1.basic_weight || '';
        page1Worksheet.getCell('E6').value = data.equipment_used.page1.dial_gauge || '';
        page1Worksheet.getCell('F6').value = 'NA';
        page1Worksheet.getCell('G6').value = data.equipment_used.page1.instron || '';
        page1Worksheet.getCell('I6').value = data.equipment_used.page1.instron || '';
    }

    // Inspected By (B42)
    page1Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';

    // Inspection Date (B43) - format as DD/MM/YYYY
    page1Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Verified By (J42)
    page1Worksheet.getCell('J42').value = data.verified_by || 'Not Verified';

    // Verified Date (J43) - format as DD/MM/YYYY
    page1Worksheet.getCell('J43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';

    // Film Inspection Form Ref No (K3)
    page1Worksheet.getCell('K3').value = data.ref_no || '';

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Film Weight Equipment (D6) - WHS
      page1Worksheet.getCell('D6').value = equipment.film_weight || '';

      // Thickness Equipment (E6) - DTG
      page1Worksheet.getCell('E6').value = equipment.thickness || '';

      // Tensile/COF Equipment (G6) - UTM
      page1Worksheet.getCell('G6').value = equipment.tensile_break || equipment.cof_rr || '';

      // Elongation/Modulus Equipment (I6) - UTM
      page1Worksheet.getCell('I6').value = equipment.tensile_break || equipment.elongation || equipment.modulus_10 || '';
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
          page1Worksheet.getCell(`A${row}`).value = dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`A${row}`).value = ''; // Empty row
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
          page1Worksheet.getCell(`B${row}`).value = dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`B${row}`).value = '';
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
          page1Worksheet.getCell(`C${row}`).value = dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`C${row}`).value = '';
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
          page1Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`D${row}`).value = '';
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
          page1Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`E${row}`).value = '';
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
          page1Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`F${row}`).value = '';
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
          page1Worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`G${row}`).value = '';
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
          page1Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`H${row}`).value = '';
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
          page1Worksheet.getCell(`I${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`I${row}`).value = '';
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
          page1Worksheet.getCell(`J${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`J${row}`).value = '';
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
          page1Worksheet.getCell(`K${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`K${row}`).value = '';
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
        page2Worksheet.getCell('D6').value = equipment.tensile_break || '';

        // Opacity Equipment (G6) - SPECTROPHOTOMETER
        page2Worksheet.getCell('G6').value = equipment.opacity || '';

        // Roll Width Equipment (I6) - STEEL RULER
        page2Worksheet.getCell('I6').value = equipment.roll_width || '';

        // Diameter Equipment (K6) - STEEL RULER
        page2Worksheet.getCell('K6').value = equipment.diameter || '';
      }

      // Tensile Break data to column D (D11-D40)
      if (data.page2_tensile_break) {
        const tensileBreakData = data.page2_tensile_break;
        const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`D${row}`).value = '';
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
            page2Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`E${row}`).value = '';
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
            page2Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`F${row}`).value = '';
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
            page2Worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`G${row}`).value = '';
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
            page2Worksheet.getCell(`I${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`I${row}`).value = '';
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
            page2Worksheet.getCell(`K${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`K${row}`).value = '';
          }
        }
      }

      // Add personnel information to Page 2
      page2Worksheet.getCell('B44').value = data.prepared_by || 'Unknown User';
      page2Worksheet.getCell('B45').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page2Worksheet.getCell('J44').value = data.verified_by || 'Not Verified';
      page2Worksheet.getCell('J45').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page2Worksheet.getCell('K3').value = data.ref_no || '';
    }

    // PAGE 3 DATA MAPPING - UC-18gsm-290NP-ABQR Page 3 data (Color Measurements)
    if (page3Worksheet && (data.page3_colour_l || data.page3_colour_a || data.page3_colour_b ||
                          data.page3_delta_e || data.page3_base_film_pink)) {

      // Equipment Data for Page 3
      if (data.equipment_used && data.equipment_used.page3) {
        const equipment = data.equipment_used.page3;

        // Color Equipment (D6) - XRITE/SPECTROPHOTOMETER
        page3Worksheet.getCell('D6').value = equipment.colour || '';

        // Color Equipment (H6) - SPECTROPHOTOMETER
        page3Worksheet.getCell('H6').value = equipment.colour || '';
      }

      // Color L data to column D (D10-D39)
      if (data.page3_colour_l) {
        const colorLData = data.page3_colour_l;
        const dataValues = Object.values(colorLData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`D${row}`).value = '';
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
            page3Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`E${row}`).value = '';
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
            page3Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`F${row}`).value = '';
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
            page3Worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`G${row}`).value = '';
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
            page3Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`H${row}`).value = '';
          }
        }
      }

      // Add personnel information to Page 3
      page3Worksheet.getCell('B43').value = data.prepared_by || 'Unknown User';
      page3Worksheet.getCell('B44').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page3Worksheet.getCell('J43').value = data.verified_by || 'Not Verified';
      page3Worksheet.getCell('J44').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page3Worksheet.getCell('K3').value = data.ref_no || '';
    }

    // COA FORM DATA MAPPING - UC-18gsm-290NP-ABQR COA Form sheet
    if (coaWorksheet) {
      console.log('COA Form sheet detected, mapping COA data');

      // Lot No (B7)
      coaWorksheet.getCell('B7').value = data.lot_no || '';

      // Inspected By - Signature in D41, Date & Name in C42
      const preparedBy = data.prepared_by || 'Unknown User';
      const inspectionDate = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      
      // Insert signature image in D41
      if (data.prepared_by) {
        await insertSignatureInCell(coaWorksheet, 'D41', data.prepared_by, supabase);
      }
      
      // Date and name in C42
      coaWorksheet.getCell('C42').value = `(${inspectionDate})\n${preparedBy}`;

      // Approved By - Signature in G41, Date & Name in F42
      const approvedBy = data.approved_by || 'Not Approved';
      const approvedDate = data.approved_date ? formatDateToDDMMYYYY(data.approved_date) : '';
      
      // Insert signature image in G41
      if (data.approved_by) {
        await insertSignatureInCell(coaWorksheet, 'G41', data.approved_by, supabase);
      }
      
      // Date and name in F42
      coaWorksheet.getCell('F42').value = `(${approvedDate})\n${approvedBy}`;
    }

    // 4. Generate filename and set response headers
    const productCode = data.product_code || 'UC-18gsm-290NP-ABQR';
    const batchNo = data.ref_no || form_id;

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
    console.error('Error exporting UC-18gsm-290NP-ABQR form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting UC-18gsm-290NP-ABQR form: ${error.message}`);
  }
});

// UC-18gsm-250W-BFQR Film Inspection Form Excel Export Endpoint
app.get('/export-uc-18gsm-250w-bfqr-form', async (req, res) => {
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
      workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(templatePath);
      page1Worksheet = workbook.getWorksheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.getWorksheet('Page2');
      } catch (error) {
        page2Worksheet = workbook.addWorksheet('Page2');
      }

      // Create or get Page3 sheet for Page 3 data
      try {
        page3Worksheet = workbook.getWorksheet('Page3');
      } catch (error) {
        page3Worksheet = workbook.addWorksheet('Page3');
      }

      // Create or get COA Form sheet for COA data
      try {
        coaWorksheet = workbook.getWorksheet('COA Form');
      } catch (error) {
        coaWorksheet = workbook.addWorksheet('COA Form');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      return res.status(500).send(`Error loading template: ${error.message}`);
    }

    // 3. Map data to Excel cells for Page 1

    // Product Code (C4)
    page1Worksheet.getCell('C4').value = data.product_code || '';

    // Specification (C5)
    page1Worksheet.getCell('C5').value = data.specification || '';

    // Production Order (F4)
    page1Worksheet.getCell('F4').value = data.production_order || '';

    // Purchase Order (F5)
  page1Worksheet.getCell('F5').value = data.purchase_order ? data.purchase_order : 'NA';

    // Machine (H4)
    page1Worksheet.getCell('H4').value = data.machine_no || '';

    // Quantity (H5) - Add "Rolls" text like prestore form
    page1Worksheet.getCell('H5').value = data.quantity ? `${data.quantity} Rolls` : '';

    // Production Date (J4) - format as DD/MM/YYYY
    page1Worksheet.getCell('J4').value = data.production_date ? formatDateToDDMMYYYY(data.production_date) : '';

    // Inspection Date (J5) - format as DD/MM/YYYY
    page1Worksheet.getCell('J5').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Equipment Data for Page 1
    if (data.equipment_used && data.equipment_used.page1) {
        page1Worksheet.getCell('D6').value = data.equipment_used.page1.basic_weight || '';
        page1Worksheet.getCell('E6').value = data.equipment_used.page1.dial_gauge || '';
        page1Worksheet.getCell('F6').value = 'NA';
        page1Worksheet.getCell('G6').value = data.equipment_used.page1.instron || '';
        page1Worksheet.getCell('I6').value = data.equipment_used.page1.instron || '';
    }

    // Inspected By (B42)
    page1Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';

    // Inspection Date (B43) - format as DD/MM/YYYY
    page1Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Verified By (J42)
    page1Worksheet.getCell('J42').value = data.verified_by || 'Not Verified';

    // Verified Date (J43) - format as DD/MM/YYYY
    page1Worksheet.getCell('J43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';

    // Film Inspection Form Ref No (K3)
    page1Worksheet.getCell('K3').value = data.ref_no || '';

    // Map equipment data to Excel cells
    if (data.equipment_used && data.equipment_used.page1) {
      const equipment = data.equipment_used.page1;

      // Film Weight Equipment (D6) - WHS
      page1Worksheet.getCell('D6').value = equipment.film_weight || '';

      // Thickness Equipment (E6) - DTG
      page1Worksheet.getCell('E6').value = equipment.thickness || '';

      // Tensile/COF Equipment (G6) - UTM
      page1Worksheet.getCell('G6').value = equipment.tensile_break || equipment.cof_rr || '';

      // Elongation/Modulus Equipment (I6) - UTM
      page1Worksheet.getCell('I6').value = equipment.tensile_break || equipment.elongation || equipment.modulus_10 || '';
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
          page1Worksheet.getCell(`A${row}`).value = dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`A${row}`).value = ''; // Empty row
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
          page1Worksheet.getCell(`B${row}`).value = dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`B${row}`).value = '';
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
          page1Worksheet.getCell(`C${row}`).value = dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`C${row}`).value = '';
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
          page1Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`D${row}`).value = '';
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
          page1Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`E${row}`).value = '';
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
          page1Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`F${row}`).value = '';
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
          page1Worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`G${row}`).value = '';
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
          page1Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`H${row}`).value = '';
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
          page1Worksheet.getCell(`I${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`I${row}`).value = '';
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
          page1Worksheet.getCell(`J${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`J${row}`).value = '';
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
          page1Worksheet.getCell(`K${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`K${row}`).value = '';
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
        page2Worksheet.getCell('D6').value = equipment.tensile_break || '';

        // Opacity Equipment (G6) - SPECTROPHOTOMETER
        page2Worksheet.getCell('G6').value = equipment.opacity || '';

        // Roll Width Equipment (I6) - STEEL RULER
        page2Worksheet.getCell('I6').value = equipment.roll_width || '';

        // Diameter Equipment (K6) - STEEL RULER
        page2Worksheet.getCell('K6').value = equipment.diameter || '';
      }

      // Tensile Break data to column D (D11-D40)
      if (data.page2_tensile_break) {
        const tensileBreakData = data.page2_tensile_break;
        const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`D${row}`).value = '';
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
            page2Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`E${row}`).value = '';
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
            page2Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`F${row}`).value = '';
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
            page2Worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`G${row}`).value = '';
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
            page2Worksheet.getCell(`I${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`I${row}`).value = '';
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
            page2Worksheet.getCell(`K${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`K${row}`).value = '';
          }
        }
      }

      // Add personnel information to Page 2
      page2Worksheet.getCell('B44').value = data.prepared_by || 'Unknown User';
      page2Worksheet.getCell('B45').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page2Worksheet.getCell('J44').value = data.verified_by || 'Not Verified';
      page2Worksheet.getCell('J45').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page2Worksheet.getCell('K3').value = data.ref_no || '';
    }

    // PAGE 3 DATA MAPPING - UC-18gsm-250W-BFQR Page 3 data (Color Measurements)
    if (page3Worksheet && (data.page3_colour_l || data.page3_colour_a || data.page3_colour_b ||
                          data.page3_delta_e || data.page3_base_film_pink)) {

      // Equipment Data for Page 3
      if (data.equipment_used && data.equipment_used.page3) {
        const equipment = data.equipment_used.page3;

        // Color Equipment (D6) - XRITE/SPECTROPHOTOMETER
        page3Worksheet.getCell('D6').value = equipment.colour || '';

        // Color Equipment (H6) - SPECTROPHOTOMETER
        page3Worksheet.getCell('H6').value = equipment.baseFilm || '';
      }

      // Color L data to column D (D10-D39)
      if (data.page3_colour_l) {
        const colorLData = data.page3_colour_l;
        const dataValues = Object.values(colorLData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`D${row}`).value = '';
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
            page3Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`E${row}`).value = '';
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
            page3Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`F${row}`).value = '';
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
            page3Worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`G${row}`).value = '';
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
            page3Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`H${row}`).value = '';
          }
        }
      }

      // Add personnel information to Page 3
      page3Worksheet.getCell('B43').value = data.prepared_by || 'Unknown User';
      page3Worksheet.getCell('B44').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page3Worksheet.getCell('J43').value = data.verified_by || 'Not Verified';
      page3Worksheet.getCell('J44').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page3Worksheet.getCell('K3').value = data.ref_no || '';
    }

    // COA FORM DATA MAPPING - UC-18gsm-250W-BFQR COA Form sheet
    if (coaWorksheet) {
      console.log('COA Form sheet detected, mapping COA data');

      // Lot No (B7)
      coaWorksheet.getCell('B7').value = data.lot_no || '';

      // Inspected By - Signature in D41, Date & Name in C42
      const preparedBy = data.prepared_by || 'Unknown User';
      const inspectionDate = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      
      // Insert signature image in D41
      if (data.prepared_by) {
        await insertSignatureInCell(coaWorksheet, 'D41', data.prepared_by, supabase);
      }
      
      // Date and name in C42
      coaWorksheet.getCell('C42').value = `(${inspectionDate})\n${preparedBy}`;

      // Approved By - Signature in G41, Date & Name in F42
      const approvedBy = data.approved_by || 'Not Approved';
      const approvedDate = data.approved_date ? formatDateToDDMMYYYY(data.approved_date) : '';
      
      // Insert signature image in G41
      if (data.approved_by) {
        await insertSignatureInCell(coaWorksheet, 'G41', data.approved_by, supabase);
      }
      
      // Date and name in F42
      coaWorksheet.getCell('F42').value = `(${approvedDate})\n${approvedBy}`;
    }

    // 4. Generate filename and set response headers
    const productCode = data.product_code || 'UC-18gsm-250W-BFQR';
    const batchNo = data.ref_no || form_id;

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
    console.error('Error exporting UC-18gsm-250W-BFQR form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting UC-18gsm-250W-BFQR form: ${error.message}`);
  }
});

// UC-18gsm-210W-BFQR Film Inspection Form Excel Export Endpoint
app.get('/export-uc-18gsm-210w-bfqr-form', async (req, res) => {
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
      workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(templatePath);
      page1Worksheet = workbook.getWorksheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.getWorksheet('Page2');
      } catch (error) {
        page2Worksheet = workbook.addWorksheet('Page2');
      }

      // Create or get Page3 sheet for Page 3 data
      try {
        page3Worksheet = workbook.getWorksheet('Page3');
      } catch (error) {
        page3Worksheet = workbook.addWorksheet('Page3');
      }

      // Create or get COA Form sheet for COA data
      try {
        coaWorksheet = workbook.getWorksheet('COA Form');
      } catch (error) {
        coaWorksheet = workbook.addWorksheet('COA Form');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      return res.status(500).send(`Error loading template: ${error.message}`);
    }

    // 3. Map data to Excel cells for Page 1

    // Product Code (C4)
    page1Worksheet.getCell('C4').value = data.product_code || '';

    // Specification (C5)
    page1Worksheet.getCell('C5').value = data.specification || '';

    // Production Order (F4)
    page1Worksheet.getCell('F4').value = data.production_order || '';

    // Purchase Order (F5)
  page1Worksheet.getCell('F5').value = data.purchase_order ? data.purchase_order : 'NA';

    // Machine (H4)
    page1Worksheet.getCell('H4').value = data.machine_no || '';

    // Quantity (H5) - Add "Rolls" text like prestore form
    page1Worksheet.getCell('H5').value = data.quantity ? `${data.quantity} Rolls` : '';

    // Production Date (J4) - format as DD/MM/YYYY
    page1Worksheet.getCell('J4').value = data.production_date ? formatDateToDDMMYYYY(data.production_date) : '';

    // Inspection Date (J5) - format as DD/MM/YYYY
    page1Worksheet.getCell('J5').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Prepared By (B43)
    page1Worksheet.getCell('B43').value = data.prepared_by || 'Unknown User';

    // PAGE 1 DATA MAPPING - UC-18gsm-210W-BFQR Page 1 data (Mechanical Properties)
    // Lot & Roll data to Sample No. column (A9-A38)
    if (data.lot_and_roll) {
      const lotAndRollData = data.lot_and_roll;
      const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');
      for (let row = 9; row <= 38; row++) {
        const dataIndex = row - 9;
        if (dataIndex < dataValues.length) {
          page1Worksheet.getCell(`A${row}`).value = dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`A${row}`).value = '';
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
          page1Worksheet.getCell(`B${row}`).value = dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`B${row}`).value = '';
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
          page1Worksheet.getCell(`C${row}`).value = dataValues[dataIndex];
        } else {
          page1Worksheet.getCell(`C${row}`).value = '';
        }
      }
    }
    if (page1Worksheet && (data.page1_basis_weight || data.page1_thickness || data.page1_wettability ||
                          data.page1_cof_rr || data.page1_cof_cc || data.page1_tensile_break ||
                          data.page1_elongation || data.page1_modulus)) {

      // Equipment Data for Page 1
      if (data.equipment_used && data.equipment_used.page1) {
        const equipment = data.equipment_used.page1;

        // Film Weight Equipment (D6) - WEIGH SCALE
        page1Worksheet.getCell('D6').value = equipment.film_weight || '';

        // Thickness Equipment (E6) - DIAL GAUGE
        page1Worksheet.getCell('E6').value = equipment.thickness || '';

        // COF Equipment (G6) - INSTRON UTM
        page1Worksheet.getCell('G6').value = equipment.cof_rr || equipment.cof_cc || '';

        // Tensile Break Equipment (H6) - INSTRON UTM
        page1Worksheet.getCell('H6').value = equipment.tensile_break || '';

        // Elongation Equipment (I6) - INSTRON UTM
        page1Worksheet.getCell('I6').value = equipment.elongation || '';

        // Modulus Equipment (J6) - INSTRON UTM
        page1Worksheet.getCell('J6').value = equipment.modulus || '';
      }

      // Basis Weight data to column D (D9-D38)
      if (data.page1_basis_weight) {
        const basisWeightData = data.page1_basis_weight;
        const dataValues = Object.values(basisWeightData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page1Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page1Worksheet.getCell(`D${row}`).value = '';
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
            page1Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page1Worksheet.getCell(`E${row}`).value = '';
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
            page1Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page1Worksheet.getCell(`F${row}`).value = '';
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
            page1Worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page1Worksheet.getCell(`G${row}`).value = '';
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
            page1Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page1Worksheet.getCell(`H${row}`).value = '';
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
            page1Worksheet.getCell(`I${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page1Worksheet.getCell(`I${row}`).value = '';
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
            page1Worksheet.getCell(`J${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page1Worksheet.getCell(`J${row}`).value = '';
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
            page1Worksheet.getCell(`K${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page1Worksheet.getCell(`K${row}`).value = '';
          }
        }
      }

      // Add personnel information to Page 1
      page1Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';
      page1Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page1Worksheet.getCell('J42').value = data.verified_by || 'Not Verified';
      page1Worksheet.getCell('J43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page1Worksheet.getCell('K3').value = data.ref_no || '';
    }

    // PAGE 2 DATA MAPPING - UC-18gsm-210W-BFQR Page 2 data (Mechanical Properties)
    if (page2Worksheet && (data.page2_tensile_break || data.page2_cd_elongation || data.page2_modulus ||
                data.page2_opacity || data.page2_roll_width || data.page2_diameter)) {

      // Equipment Data for Page 2
      if (data.equipment_used && data.equipment_used.page2) {
        const equipment = data.equipment_used.page2;

        // Tensile Break Equipment (D6) - INSTRON UTM
        page2Worksheet.getCell('D6').value = equipment.tensile_break || '';

        // Elongation Equipment (E6) - INSTRON UTM
        page2Worksheet.getCell('E6').value = equipment.elongation || '';

        // Modulus Equipment (F6) - INSTRON UTM
        page2Worksheet.getCell('F6').value = equipment.modulus || '';

        // Opacity Equipment (G6) - SPECTROPHOTOMETER
        page2Worksheet.getCell('G6').value = equipment.opacity || '';

        // Roll Width Equipment (I6) - STEEL RULER
        page2Worksheet.getCell('I6').value = equipment.roll_width || '';

        // Diameter Equipment (K6) - STEEL RULER
        page2Worksheet.getCell('K6').value = equipment.diameter || '';
      }

      // Tensile Break data to column D (D11-D40)
      if (data.page2_tensile_break) {
        const tensileBreakData = data.page2_tensile_break;
        const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`D${row}`).value = '';
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
            page2Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`E${row}`).value = '';
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
            page2Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`F${row}`).value = '';
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
            page2Worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`G${row}`).value = '';
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
            page2Worksheet.getCell(`I${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`I${row}`).value = '';
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
            page2Worksheet.getCell(`K${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`K${row}`).value = '';
          }
        }
      }

      // Add personnel information to Page 2
      page2Worksheet.getCell('B44').value = data.prepared_by || 'Unknown User';
      page2Worksheet.getCell('B45').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page2Worksheet.getCell('J44').value = data.verified_by || 'Not Verified';
      page2Worksheet.getCell('J45').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page2Worksheet.getCell('K3').value = data.ref_no || '';
    }

    // PAGE 3 DATA MAPPING - UC-18gsm-210W-BFQR Page 3 data (Color Measurements)
    if (page3Worksheet && (data.page3_colour_l || data.page3_colour_a || data.page3_colour_b ||
                          data.page3_delta_e || data.page3_base_film_pink)) {

      // Equipment Data for Page 3
      if (data.equipment_used && data.equipment_used.page3) {
        const equipment = data.equipment_used.page3;

        // Color Equipment (D6) - XRITE/SPECTROPHOTOMETER
        page3Worksheet.getCell('D6').value = equipment.colour || '';

        // Color Equipment (H6) - SPECTROPHOTOMETER
        page3Worksheet.getCell('H6').value = equipment.baseFilm || '';
      }

      // Color L data to column D (D10-D39)
      if (data.page3_colour_l) {
        const colorLData = data.page3_colour_l;
        const dataValues = Object.values(colorLData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 10; row <= 39; row++) {
          const dataIndex = row - 10;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`D${row}`).value = '';
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
            page3Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`E${row}`).value = '';
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
            page3Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`F${row}`).value = '';
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
            page3Worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`G${row}`).value = '';
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
            page3Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`H${row}`).value = '';
          }
        }
      }

      // Add personnel information to Page 3
      page3Worksheet.getCell('B43').value = data.prepared_by || 'Unknown User';
      page3Worksheet.getCell('B44').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page3Worksheet.getCell('J43').value = data.verified_by || 'Not Verified';
      page3Worksheet.getCell('J44').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      page3Worksheet.getCell('K3').value = data.ref_no || '';
    }

    // COA FORM DATA MAPPING - UC-18gsm-210W-BFQR COA Form sheet
    if (coaWorksheet) {
      console.log('COA Form sheet detected, mapping COA data');

      // Lot No (B7)
      coaWorksheet.getCell('B7').value = data.lot_no || '';

      // Inspected By - Signature in D41, Date & Name in C42
      const preparedBy = data.prepared_by || 'Unknown User';
      const inspectionDate = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      
      // Insert signature image in D41
      if (data.prepared_by) {
        await insertSignatureInCell(coaWorksheet, 'D41', data.prepared_by, supabase);
      }
      
      // Date and name in C42
      coaWorksheet.getCell('C42').value = `(${inspectionDate})\n${preparedBy}`;

      // Approved By - Signature in G41, Date & Name in F42
      const approvedBy = data.approved_by || 'Not Approved';
      const approvedDate = data.approved_date ? formatDateToDDMMYYYY(data.approved_date) : '';
      
      // Insert signature image in G41
      if (data.approved_by) {
        await insertSignatureInCell(coaWorksheet, 'G41', data.approved_by, supabase);
      }
      
      // Date and name in F42
      coaWorksheet.getCell('F42').value = `(${approvedDate})\n${approvedBy}`;
    }

    // 4. Generate filename and set response headers
    const productCode = data.product_code || 'UC-18gsm-210W-BFQR';
    const batchNo = data.ref_no || form_id;

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
    console.error('Error exporting UC-18gsm-210W-BFQR form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting UC-18gsm-210W-BFQR form: ${error.message}`);
  }
});

// UC-16gsm-165W Film Inspection Form Excel Export Endpoint
app.get('/export-uc-16gsm-165w-form', async (req, res) => {
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
      workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(templatePath);
      page1Worksheet = workbook.getWorksheet('Page1');

      // Create or get Page2 sheet for Page 2 data
      try {
        page2Worksheet = workbook.getWorksheet('Page2');
      } catch (error) {
        page2Worksheet = workbook.addWorksheet('Page2');
      }

      // Create or get Page3 sheet for Page 3 data
      try {
        page3Worksheet = workbook.getWorksheet('Page3');
      } catch (error) {
        page3Worksheet = workbook.addWorksheet('Page3');
      }

      // Create or get COA Form sheet for COA data
      try {
        coaWorksheet = workbook.getWorksheet('COA Form');
      } catch (error) {
        coaWorksheet = workbook.addWorksheet('COA Form');
      }
    } catch (error) {
      console.log('Error loading template:', error.message);
      return res.status(500).send(`Error loading template: ${error.message}`);
    }

    // 3. Map data to Excel cells for Page 1

    // Product Code (B4)
    page1Worksheet.getCell('B4').value = data.product_code || '';

    // Specification (B5)
    page1Worksheet.getCell('B5').value = data.specification || '';

    // Film Inspection Form Ref No (I3)
    page1Worksheet.getCell('I3').value = data.ref_no || '';

    // Purchase Order (E5)
  page1Worksheet.getCell('E5').value = data.purchase_order ? data.purchase_order : 'NA';

    // Machine (G4)
    page1Worksheet.getCell('G4').value = data.machine_no || '';

    // Quantity (G5) - Add "Rolls" text like prestore form
    page1Worksheet.getCell('G5').value = data.quantity ? `${data.quantity} Rolls` : '';

    // Production Order (E4)
    page1Worksheet.getCell('E4').value = data.production_order || '';

    // Production Date (I4) - format as DD/MM/YYYY
    page1Worksheet.getCell('I4').value = data.production_date ? formatDateToDDMMYYYY(data.production_date) : '';

    // Inspection Date (I5) - format as DD/MM/YYYY
    page1Worksheet.getCell('I5').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';

    // Personnel Information Section

    // Prepared By (for reference in equipment section)
    // Note: data.prepared_by is already mapped above as Inspected By

    // PAGE 1 DATA MAPPING - UC-16gsm-165W Page 1 data (Mechanical Properties)
    if (page1Worksheet && (data.page1_basis_weight || data.page1_thickness || data.page1_cof_rr ||
                          data.page1_tensile_break || data.page1_elongation || data.page1_modulus)) {

      // Equipment Data for Page 1
      if (data.equipment_used && data.equipment_used.page1) {
        const equipment = data.equipment_used.page1;

        // Film Weight Equipment (D6) - WEIGH SCALE
        page1Worksheet.getCell('D6').value = equipment.film_weight || '';

        // Thickness Equipment (E6) - DIAL GAUGE
        page1Worksheet.getCell('E6').value = equipment.thickness || '';

        // COF Equipment (F6) - COF TESTER
        page1Worksheet.getCell('F6').value = equipment.cof_rr || '';

        // Tensile/Elongation/Modulus Equipment (G6, H6, I6) - INSTRON UTM
        const tensileEquipment = equipment.tensile_break || equipment.elongation || equipment.modulus_10 || '';
        page1Worksheet.getCell('G6').value = tensileEquipment;
        page1Worksheet.getCell('H6').value = tensileEquipment;
        page1Worksheet.getCell('I6').value = tensileEquipment;
      }

      // Lot & Roll data to column A (A9-A38)
      if (data.lot_and_roll) {
        const lotAndRollData = data.lot_and_roll;
        const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            page1Worksheet.getCell(`A${row}`).value = dataValues[dataIndex];
          } else {
            page1Worksheet.getCell(`A${row}`).value = '';
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
            page1Worksheet.getCell(`B${row}`).value = dataValues[dataIndex];
          } else {
            page1Worksheet.getCell(`B${row}`).value = '';
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
            page1Worksheet.getCell(`C${row}`).value = dataValues[dataIndex];
          } else {
            page1Worksheet.getCell(`C${row}`).value = '';
          }
        }
      }

      // Basis Weight data to column D (D9-D38)
      if (data.page1_basis_weight) {
        const basisWeightData = data.page1_basis_weight;
        const dataValues = Object.values(basisWeightData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page1Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page1Worksheet.getCell(`D${row}`).value = '';
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
            page1Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page1Worksheet.getCell(`E${row}`).value = '';
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
            page1Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page1Worksheet.getCell(`F${row}`).value = '';
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
            page1Worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page1Worksheet.getCell(`G${row}`).value = '';
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
            page1Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page1Worksheet.getCell(`H${row}`).value = '';
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
            page1Worksheet.getCell(`I${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page1Worksheet.getCell(`I${row}`).value = '';
          }
        }
      }

      // Add personnel information to Page 1 (corrected cell positions)
      page1Worksheet.getCell('B42').value = data.prepared_by || 'Unknown User';
      page1Worksheet.getCell('B43').value = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      page1Worksheet.getCell('H42').value = data.verified_by || 'Not Verified';
      page1Worksheet.getCell('H43').value = data.verified_date ? formatDateToDDMMYYYY(data.verified_date) : '';
      // FIF Ref No mapped to E4 in header section above
    }

    // PAGE 2 DATA MAPPING - UC-16gsm-165W Page 2 data (Mechanical Properties - CD & Others)
    if (page2Worksheet && (data.page2_tensile_break || data.page2_cd_elongation || data.page2_modulus ||
                          data.page2_opacity || data.page2_roll_width || data.page2_diameter)) {

      // Equipment Data for Page 2
      if (data.equipment_used && data.equipment_used.page2) {
        const equipment = data.equipment_used.page2;

        // Combined UTM Equipment (D6, E6, F6) - INSTRON UTM (tensile break, elongation, modulus now use same equipment)
        const utmEquipment = equipment.tensile_break || equipment.cd_elongation || equipment.modulus || '';
        page2Worksheet.getCell('D6').value = utmEquipment;
        page2Worksheet.getCell('E6').value = utmEquipment;
        page2Worksheet.getCell('F6').value = utmEquipment;

        // Opacity Equipment (G6) - SPECTROPHOTOMETER
        page2Worksheet.getCell('G6').value = equipment.opacity || '';

        // Roll Width Equipment (H6) - STEEL RULER
        page2Worksheet.getCell('H6').value = equipment.roll_width || '';

        // Diameter Equipment (I6) - STEEL RULER
        page2Worksheet.getCell('I6').value = equipment.diameter || '';
      }

      // Lot & Roll data to column A (A11-A40)
      if (data.lot_and_roll) {
        const lotAndRollData = data.lot_and_roll;
        const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            page2Worksheet.getCell(`A${row}`).value = dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`A${row}`).value = '';
          }
        }
      }

      // Roll ID data to column B (B11-B40)
      if (data.roll_id) {
        const rollIdData = data.roll_id;
        const dataValues = Object.values(rollIdData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            page2Worksheet.getCell(`B${row}`).value = dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`B${row}`).value = '';
          }
        }
      }

      // Lot Time data to column C (C11-C40)
      if (data.lot_time) {
        const lotTimeData = data.lot_time;
        const dataValues = Object.values(lotTimeData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            page2Worksheet.getCell(`C${row}`).value = dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`C${row}`).value = '';
          }
        }
      }

      // Tensile Break (CD) data to column D (D11-D40)
      if (data.page2_tensile_break) {
        const tensileBreakData = data.page2_tensile_break;
        const dataValues = Object.values(tensileBreakData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`D${row}`).value = '';
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
            page2Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`E${row}`).value = '';
          }
        }
      }

      // Modulus (CD) data to column F (F11-F40)
      if (data.page2_modulus) {
        const modulusData = data.page2_modulus;
        const dataValues = Object.values(modulusData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 11; row <= 40; row++) {
          const dataIndex = row - 11;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page2Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`F${row}`).value = '';
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
            page2Worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`G${row}`).value = '';
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
            page2Worksheet.getCell(`H${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`H${row}`).value = '';
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
            page2Worksheet.getCell(`I${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page2Worksheet.getCell(`I${row}`).value = '';
          }
        }
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
        page3Worksheet.getCell('D6').value = equipment.colour || '';
      }

      // Lot & Roll data to column A (A9-A38)
      if (data.lot_and_roll) {
        const lotAndRollData = data.lot_and_roll;
        const dataValues = Object.values(lotAndRollData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            page3Worksheet.getCell(`A${row}`).value = dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`A${row}`).value = '';
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
            page3Worksheet.getCell(`B${row}`).value = dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`B${row}`).value = '';
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
            page3Worksheet.getCell(`C${row}`).value = dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`C${row}`).value = '';
          }
        }
      }

      // Color L data to column D (D9-D38)
      if (data.page3_colour_l) {
        const colorLData = data.page3_colour_l;
        const dataValues = Object.values(colorLData).filter(value => value !== null && value !== undefined && value !== '');

        for (let row = 9; row <= 38; row++) {
          const dataIndex = row - 9;
          if (dataIndex < dataValues.length) {
            const numValue = parseFloat(dataValues[dataIndex]);
            page3Worksheet.getCell(`D${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`D${row}`).value = '';
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
            page3Worksheet.getCell(`E${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`E${row}`).value = '';
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
            page3Worksheet.getCell(`F${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`F${row}`).value = '';
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
            page3Worksheet.getCell(`G${row}`).value = !isNaN(numValue) ? numValue : dataValues[dataIndex];
          } else {
            page3Worksheet.getCell(`G${row}`).value = '';
          }
        }
      }

      // Personnel information only on Page 1 for UC-16gsm-165W
      // (Page 3 personnel info removed as requested)
    }

    // COA FORM DATA MAPPING - UC-16gsm-165W COA Form sheet
    if (coaWorksheet) {
      console.log('COA Form sheet detected, mapping COA data');

      // Lot No (B7)
      coaWorksheet.getCell('B7').value = data.lot_no || '';

      // Inspected By - Signature in C33, Name & Date in C34
      const preparedBy = data.prepared_by || 'Unknown User';
      const inspectionDate = data.inspection_date ? formatDateToDDMMYYYY(data.inspection_date) : '';
      
      // Insert signature image in D33
      if (data.prepared_by) {
        await insertSignatureInCell(coaWorksheet, 'D33', data.prepared_by, supabase);
      }
      
      // Date and name in C34
      coaWorksheet.getCell('C34').value = `(${inspectionDate})\n${preparedBy}`;

      // Approved By - Signature in F33, Name & Date in F34
      const approvedBy = data.approved_by || 'Not Approved';
      const approvedDate = data.approved_date ? formatDateToDDMMYYYY(data.approved_date) : '';
      
      // Insert signature image in G33
      if (data.approved_by) {
        await insertSignatureInCell(coaWorksheet, 'G33', data.approved_by, supabase);
      }
      
      // Date and name in F34
      coaWorksheet.getCell('F34').value = `(${approvedDate})\n${approvedBy}`;
    }

    // 4. Generate filename and set response headers
    const productCode = data.product_code || 'UC-16gsm-165W';
    const batchNo = data.ref_no || form_id;

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
    console.error('Error exporting UC-16gsm-165W form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send(`Error exporting UC-16gsm-165W form: ${error.message}`);
  }
});
};
