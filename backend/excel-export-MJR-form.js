const XlsxPopulate = require('xlsx-populate');
const ExcelJS = require('exceljs');
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

// Helper function to extract breakdown codes from JSONB
function extractBreakdownCodes(breakdowncodes) {
  if (!breakdowncodes) return [];
  if (Array.isArray(breakdowncodes)) return breakdowncodes;
  if (typeof breakdowncodes === 'object') {
    return Object.keys(breakdowncodes).filter(key => breakdowncodes[key] === true || breakdowncodes[key] === 'true');
  }
  return [];
}

// Helper function to calculate total breakdown time for export
function calculateTotalBDTimeForExport(startTime, finishTime) {
  if (!startTime || !finishTime) return 'N/A';

  const start = new Date(`1970-01-01T${startTime}:00`);
  const finish = new Date(`1970-01-01T${finishTime}:00`);

  if (isNaN(start.getTime()) || isNaN(finish.getTime())) return 'N/A';

  const diffMs = finish - start;
  const diffHours = diffMs / (1000 * 60 * 60);

  return diffHours.toFixed(2) + ' hours';
}

// Helper function to get status for export
function getStatusForExport(inspectionresult) {
  if (!inspectionresult) return '';
  switch(inspectionresult.toLowerCase()) {
    case 'pass': return 'O';
    case 'fail': return 'X';
    case 'pending': return '△';
    default: return inspectionresult;
  }
}

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
  // Test endpoint to verify backend is working
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Backend server is running!',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/export-mjr-record/:id',
      '/api/export-machine-history-card',
      '/api/export-roller-history-card',
      '/api/test',
      '/health'
    ]
  });
});
// MT Job Requisition Excel Export Endpoint
app.get('/api/export-mjr-record/:requisitionId', async (req, res) => {
  try {
    const { requisitionId } = req.params;
    console.log('🔄 MJR Export Request - ID:', requisitionId);
    console.log('📋 Request headers:', Object.fromEntries(Object.entries(req.headers).slice(0, 5)));
    console.log('🌐 Request URL:', req.url);

    // 1. Get the MJR record from database
    const { data, error } = await supabase
      .from('mt_job_requisition_master')
      .select('*')
      .eq('id', requisitionId)
      .single();

    if (error) {
      console.error('❌ Database error:', error);
      return res.status(500).json({ error: 'Database error: ' + error.message });
    }

    if (!data) {
      console.error('❌ No data found for ID:', requisitionId);
      return res.status(404).json({ error: 'MJR record not found for ID: ' + requisitionId });
    }

    console.log('✅ Found MJR record:', data.id);
    console.log('📊 Record requisitionno:', data.requisitionno);

    // 2. Load the MJR template
    const templatePath = path.join(__dirname, 'templates', 'maintenance-job-requisition.xlsx');

    // Check if template file exists
    if (!fs.existsSync(templatePath)) {
      console.error('❌ MJR template file not found:', templatePath);
      return res.status(500).json({ error: 'Template file not found at: ' + templatePath });
    }

    console.log('📁 Template file found, loading...');

    // 3. Load and populate the template
    const workbook = await XlsxPopulate.fromFileAsync(templatePath);

    // 4. Map data to template fields (using your specific cell references)
    const sheet = workbook.sheet(0); // First sheet

    // Basic information
    sheet.cell('Q5').value(data.requisitionno || 'N/A'); // Requisition No.
    sheet.cell('D8').value(data.occurdate ? formatDateToDDMMYYYY(data.occurdate) : ''); // Date
    sheet.cell('F23').value(data.requestorname || ''); // Requestor Name
    sheet.cell('C5').value(data.reqdept || ''); // Department
    sheet.cell('Q23').value(data.reqdepthod || ''); // Department HOD
    sheet.cell('C6').value(data.equipmentname || ''); // Equipment Name
    sheet.cell('C7').value(data.equipmentno || ''); // Equipment No.
    sheet.cell('Q6').value(data.machineno || 'N/A'); // Machine No.
    sheet.cell('S34').value(data.purchasereqno || ''); // Purchase Req No.

    // Time information
    sheet.cell('H8').value(formatTimeToHHMM(data.occurtime)); // Occur Time (ensure HH:MM format)
    sheet.cell('V7').value(data.requirecompletiondate ? formatDateToDDMMYYYY(data.requirecompletiondate) : ''); // Required Completion Date
    sheet.cell('V8').value(formatTimeToHHMM(data.completiontime)); // Completion Time (ensure HH:MM format)
    sheet.cell('V42').value(formatTimeToHHMM(data.totalhours)); // Total Hours (ensure HH:MM format)

    // Condition and description
    sheet.cell('C17').value(data.existingcondition || ''); // Existing Condition

    // Action form specific fields (if applicable)
    if (data.form_type === 'action') {
      sheet.cell('C36').value(data.correction || ''); // Correction
      sheet.cell('C37').value(data.technicianname || ''); // Technician Name
      sheet.cell('C38').value(data.materialretrieval || ''); // Material Retrieval
      sheet.cell('C40').value(data.cleaninginspection || ''); // Cleaning Inspection

      // Schedule information
      if (data.schedulestartdate) {
        sheet.cell('D42').value(formatDateToDDMMYYYY(data.schedulestartdate)); // Schedule Start Date
      }
      if (data.schedulestarttime) {
        sheet.cell('H42').value(formatTimeToHHMM(data.schedulestarttime)); // Schedule Start Time (ensure HH:MM)
      }
      if (data.scheduleenddate) {
        sheet.cell('M42').value(formatDateToDDMMYYYY(data.scheduleenddate)); // Schedule End Date
      }
      if (data.scheduleendtime) {
        sheet.cell('Q42').value(formatTimeToHHMM(data.scheduleendtime)); // Schedule End Time (ensure HH:MM)
      }

      // Inspection results - put checkmark symbol based on database value
      if (data.inspectionresult === 'Accepted') {
        sheet.cell('F43').value('✓'); // Put checkmark for Accepted
        sheet.cell('F45').value(''); // Clear rejected field
      } else if (data.inspectionresult === 'Rejected') {
        sheet.cell('F45').value('✓'); // Put checkmark for Rejected
        sheet.cell('F43').value(''); // Clear accepted field
      }

      sheet.cell('C48').value(data.inspectionremarks || ''); // Inspection Remarks
      sheet.cell('E52').value(data.inspectioncheckedby || ''); // Inspected By
      sheet.cell('U39').value(data.cleanretrcheckedby || ''); // Cleaning Verified By
    }

    // Map checkbox and JSONB fields to Excel cells

    // Breakdown Codes
    if (data.breakdowncodes) {
      const breakdownMap = {
        'A': 'F11', 'B': 'I11', 'C': 'L11', 'D': 'O11', 'E': 'R11',
        'F': 'U11', 'G': 'X11', 'H': 'F14', 'I': 'I14', 'J': 'L14',
        'K': 'O14', 'L': 'R14', 'M': 'U14', 'N': 'X14'
      };

      // Handle both array format and object format
      if (Array.isArray(data.breakdowncodes)) {
        // Array format: ['A', 'B', 'C']
        data.breakdowncodes.forEach(code => {
          if (breakdownMap[code]) {
            sheet.cell(breakdownMap[code]).value('✓');
          }
        });
      } else if (typeof data.breakdowncodes === 'object' && data.breakdowncodes !== null) {
        // Object format: {'A': true, 'B': false, 'C': true}
        Object.entries(data.breakdowncodes).forEach(([code, isSelected]) => {
          if (isSelected && breakdownMap[code]) {
            sheet.cell(breakdownMap[code]).value('✓');
          }
        });
      }
    }

    // Power Options
    if (data.poweroptions) {
      const powerMap = {
        'switchOffPower': 'L25',
        'noSwitchPower': 'L28'
      };

      if (Array.isArray(data.poweroptions)) {
        // Array format: ['switchOffPower', 'noSwitchPower']
        data.poweroptions.forEach(option => {
          if (powerMap[option]) {
            sheet.cell(powerMap[option]).value('✓');
          }
        });
      } else if (typeof data.poweroptions === 'object' && data.poweroptions !== null) {
        // Object format: {'switchOffPower': true, 'noSwitchPower': false}
        Object.entries(data.poweroptions).forEach(([option, isSelected]) => {
          if (isSelected && powerMap[option]) {
            sheet.cell(powerMap[option]).value('✓');
          }
        });
      }
    }

    // Machine Options
    if (data.machineoptions) {
      const machineMap = {
        'stopMachine': 'X25',
        'noStopMachine': 'X28'
      };

      if (Array.isArray(data.machineoptions)) {
        // Array format: ['stopMachine', 'noStopMachine']
        data.machineoptions.forEach(option => {
          if (machineMap[option]) {
            sheet.cell(machineMap[option]).value('✓');
          }
        });
      } else if (typeof data.machineoptions === 'object' && data.machineoptions !== null) {
        // Object format: {'stopMachine': true, 'noStopMachine': false}
        Object.entries(data.machineoptions).forEach(([option, isSelected]) => {
          if (isSelected && machineMap[option]) {
            sheet.cell(machineMap[option]).value('✓');
          }
        });
      }
    }

    // Handle By Options
    if (data.handleby) {
      const handleByMap = {
        'MT': 'D32',
        'OTS': 'I32',
        'BT': 'L32'
      };

      if (Array.isArray(data.handleby)) {
        // Array format: ['MT', 'OTS', 'BT']
        data.handleby.forEach(option => {
          if (handleByMap[option]) {
            sheet.cell(handleByMap[option]).value('✓');
          }
        });
      } else if (typeof data.handleby === 'object' && data.handleby !== null) {
        // Object format: {'MT': true, 'OTS': false, 'BT': true}
        Object.entries(data.handleby).forEach(([option, isSelected]) => {
          if (isSelected && handleByMap[option]) {
            sheet.cell(handleByMap[option]).value('✓');
          }
        });
      }
    }

    // Materials Used
    if (data.materials_used && Array.isArray(data.materials_used)) {
      data.materials_used.forEach((material, index) => {
        const row = 45 + index; // Start from row 45
        if (row <= 53) { // Up to row 53 (8 rows total)
          sheet.cell(`I${row}`).value(material.material || '');
          sheet.cell(`O${row}`).value(material.specification || '');
          sheet.cell(`T${row}`).value(material.quantity_used || '');
          sheet.cell(`W${row}`).value(material.quantity_retrieved || '');
        }
      });
    }

    // 5. Generate filename
    const filename = `MJR-${data.requisitionno || data.id}-${new Date().toISOString().split('T')[0]}.xlsx`;
    console.log('📄 Generated filename:', filename);

    // 6. Save to buffer and send
    console.log('🔄 Generating Excel buffer...');
    const buffer = await workbook.outputAsync();
    console.log('✅ Buffer generated, size:', buffer.length, 'bytes');

    // Set headers for Excel file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    console.log('🚀 Sending MJR Excel file:', filename);
    res.send(buffer);
    console.log('✅ Response sent successfully');

  } catch (error) {
    console.error('Error exporting MJR record:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: `Error exporting MJR record: ${error.message}` });
  }
});

// Machine History Card Excel Export Endpoint
app.get('/api/export-machine-history-card', async (req, res) => {
  try {
    console.log('🔄 Machine History Card Export Request (GET)');
    console.log('📋 Request query params:', req.query);

    // 1. Get query parameters for filtering
    const { equipmentName, equipment, fromDate, toDate, status } = req.query;

    // 2. Build query for machine history data
    let query = supabase
      .from('mt_job_requisition_master')
      .select(`
        id,
        requisitionno,
        occurdate,
        occurtime,
        requestorname,
        reqdept,
        equipmentname,
        equipmentno,
        equipmentinstalldate,
        existingcondition,
        technicianname,
        rootcause,
        correction,
        costincurred,
        inspectioncheckedby,
        totalhours,
        completiontime,
        breakdowncodes,
        inspectionresult
      `)
      .order('occurdate', { ascending: true });

    // Apply filters if provided
    if (equipmentName) {
      query = query.eq('equipmentname', equipmentName);
    }
    if (equipment) {
      query = query.eq('equipmentno', equipment);
    }
    if (fromDate) {
      query = query.gte('occurdate', fromDate);
    }
    if (toDate) {
      query = query.lte('occurdate', toDate);
    }
    // Note: Status filtering will be handled in the frontend for now
    // to avoid complex Supabase query syntax issues

    const { data, error } = await query;

    if (error) {
      console.error('❌ Database error:', error);
      return res.status(500).json({ error: 'Database error: ' + error.message });
    }

    if (!data || data.length === 0) {
      console.error('❌ No data found for export');
      return res.status(404).json({ error: 'No machine history data found for export' });
    }

    console.log('✅ Found', data.length, 'records for export');

    // Process the data for export (existing logic continues below)
    await processAndExportData(data, res, 'GET', null, null, null);
  } catch (error) {
    console.error('❌ Error in GET export:', error);
    res.status(500).json({ error: `Error exporting machine history card: ${error.message}` });
  }
});

// POST endpoint for exporting filtered data from frontend
app.post('/api/export-machine-history-card', async (req, res) => {
  try {
    console.log('🔄 Machine History Card Export Request (POST)');
    console.log('📋 Request body:', req.body);

    const { data, filterSummary, selectedEquipmentName, selectedEquipmentId } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.error('❌ No filtered data provided for export');
      return res.status(400).json({ error: 'No filtered data provided for export' });
    }

    // Sort the data by occurdate from oldest to latest
    data.sort((a, b) => new Date(a.occurdate) - new Date(b.occurdate));

    console.log('✅ Received', data.length, 'filtered records for export');
    if (filterSummary) {
      console.log('📊 Filter summary:', filterSummary);
    }
    if (selectedEquipmentName) {
      console.log('🏷️ Selected equipment name:', selectedEquipmentName);
    }

    // Use the filtered data directly
    await processAndExportData(data, res, 'POST', filterSummary, selectedEquipmentName, selectedEquipmentId);
  } catch (error) {
    console.error('❌ Error in POST export:', error);
    res.status(500).json({ error: `Error exporting machine history card: ${error.message}` });
  }
});

// Common function to process and export data (used by both GET and POST)
async function processAndExportData(data, res, method, filterSummary = null, selectedEquipmentName = null, selectedEquipmentId = null) {
  try {
    console.log('🔄 Processing export data for method:', method);
    if (selectedEquipmentName) {
      console.log('🏷️ Equipment name for header:', selectedEquipmentName);
    }

    // 3. Load the machine history card template
    const templatePath = path.join(__dirname, 'templates', 'machine-history-card.xlsx');

    // Check if template file exists
    if (!fs.existsSync(templatePath)) {
      console.error('❌ Machine history card template file not found:', templatePath);
      return res.status(500).json({ error: 'Template file not found at: ' + templatePath });
    }

    console.log('📁 Template file found, loading...');

    // 4. Load and populate the template
    const workbook = await XlsxPopulate.fromFileAsync(templatePath);

    // Get the first sheet (Page1) - try by name first, then by index
    let sheet;
    try {
      sheet = workbook.sheet('Page1');
      console.log('✅ Using sheet by name: Page1');
    } catch (error) {
      console.log('⚠️ Sheet name "Page1" not found, trying by index...');
      sheet = workbook.sheet(0); // Fallback to first sheet by index
      console.log('✅ Using sheet by index: 0');
    }

    // 4. Add equipment name to cell B5 (if provided, otherwise show "All Equipment")
    if (selectedEquipmentName && selectedEquipmentName.trim() !== '') {
      try {
        sheet.cell('B5').value(selectedEquipmentName);
        console.log('✅ Added equipment name to cell B5:', selectedEquipmentName);
      } catch (error) {
        console.error('❌ Error adding equipment name to B5:', error);
      }
    } else {
      try {
        sheet.cell('B5').value('All Equipment');
        console.log('✅ Added "All Equipment" to cell B5 (no specific equipment selected)');
      } catch (error) {
        console.error('❌ Error adding "All Equipment" to B5:', error);
      }
    }

    // 5. Map data to template (starting from row 9, assuming row 1 is headers)
    data.forEach((record, index) => {
      const rowNum = index + 9; // Start from row 9

      // Map the data fields to columns (based on the user's specifications)

      // Column A: Breakdown Date (occurdate)
      if (record.occurdate) {
        try {
        const date = new Date(record.occurdate);
          if (!isNaN(date.getTime())) {
        sheet.cell(`A${rowNum}`).value(date.toLocaleDateString('en-IN'));
          } else {
            sheet.cell(`A${rowNum}`).value('N/A');
          }
        } catch (error) {
          sheet.cell(`A${rowNum}`).value('N/A');
        }
      }

      // Column B: MJR# (requisitionno)
      if (record.requisitionno) {
        sheet.cell(`B${rowNum}`).value(record.requisitionno);
      }

      // Column C: BD CODE (breakdowncodes) - JSONB field
      if (record.breakdowncodes) {
        sheet.cell(`C${rowNum}`).value(extractBreakdownCodes(record.breakdowncodes));
      }

      // Column D: Equipment ID No. (equipmentno)
      if (record.equipmentno) {
        sheet.cell(`D${rowNum}`).value(record.equipmentno);
      }

      // Column E: Equipment Installation Date (equipmentinstalldate)
      if (record.equipmentinstalldate) {
        try {
        const installDate = new Date(record.equipmentinstalldate);
          if (!isNaN(installDate.getTime())) {
        sheet.cell(`E${rowNum}`).value(installDate.toLocaleDateString('en-IN'));
          } else {
            sheet.cell(`E${rowNum}`).value('N/A');
          }
        } catch (error) {
          sheet.cell(`E${rowNum}`).value('N/A');
        }
      }

      // Column F: Breakdown Description (existingcondition)
      if (record.existingcondition) {
        sheet.cell(`F${rowNum}`).value(record.existingcondition);
      }

      // Column G: M/C BD Start Time (occurtime) - format as HH:MM
      if (record.occurtime) {
        // Remove seconds if present (format as HH:MM only)
        const startTime = record.occurtime.length > 5 ? record.occurtime.substring(0, 5) : record.occurtime;
        sheet.cell(`G${rowNum}`).value(startTime);
      }

      // Column H: M/C BD Finish Time (completiontime) - format as HH:MM
      if (record.completiontime) {
        // Remove seconds if present (format as HH:MM only)
        const finishTime = record.completiontime.length > 5 ? record.completiontime.substring(0, 5) : record.completiontime;
        sheet.cell(`H${rowNum}`).value(finishTime);
      }

      // Column I: Total M/C BD Time (calculated field)
      if (record.occurtime && record.completiontime) {
        try {
          // Format times to HH:MM for calculation
          const startTime = record.occurtime.length > 5 ? record.occurtime.substring(0, 5) : record.occurtime;
          const finishTime = record.completiontime.length > 5 ? record.completiontime.substring(0, 5) : record.completiontime;

          // Debug logging
          console.log(`Calculating time for row ${rowNum}: ${startTime} to ${finishTime}`);

          const totalTime = calculateTotalBDTimeForExport(startTime, finishTime);
          console.log(`Total time calculated: ${totalTime}`);

          sheet.cell(`I${rowNum}`).value(totalTime);
        } catch (error) {
          console.error(`Error calculating total time for row ${rowNum}:`, error);
          sheet.cell(`I${rowNum}`).value('N/A');
        }
      }

      // Column J: Root Cause (rootcause)
      if (record.rootcause) {
        sheet.cell(`J${rowNum}`).value(record.rootcause);
      }

      // Column K: Corrective Action (correction) - Note: This field might not be in the current data structure
      // We'll need to add this field to the select query if it exists in the database
      if (record.correction) {
        sheet.cell(`K${rowNum}`).value(record.correction);
      }

      // Column L: Cost Incurred (costincurred) - format as ₹amount
      if (record.costincurred) {
        sheet.cell(`L${rowNum}`).value(`₹${record.costincurred}`);
      }

      // Column M: Done By (technicianname)
      if (record.technicianname) {
        sheet.cell(`M${rowNum}`).value(record.technicianname);
      }

      // Column N: Verify By (inspectioncheckedby)
      if (record.inspectioncheckedby) {
        sheet.cell(`N${rowNum}`).value(record.inspectioncheckedby);
      }

    });

    // 6. Generate Excel buffer
    const buffer = await workbook.outputAsync();
    console.log('✅ Buffer generated, size:', buffer.length, 'bytes');

    // 7. Set response headers for Excel download
    const timestamp = new Date().toISOString().slice(0, 10);
    const recordCount = data.length;
    const methodType = method === 'POST' ? 'Filtered' : 'Full';

    // Create filename with equipment name if available, otherwise "All-Equipment"
    let filename;
    if (selectedEquipmentName && selectedEquipmentName.trim() !== '') {
      // Sanitize equipment name for filename (remove special characters and spaces)
      const sanitizedEquipmentName = selectedEquipmentName.replace(/[^a-zA-Z0-9]/g, '_');
      filename = `Machine-History-Card-${sanitizedEquipmentName}-${timestamp}.xlsx`;
    } else {
      // No specific equipment selected, use "All-Equipment"
      filename = `Machine-History-Card-All-Equipment-${recordCount}-Records-${timestamp}.xlsx`;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    console.log('📤 Sending Excel file:', filename);
    if (filterSummary) {
      console.log('📊 Export Summary:', filterSummary);
    }
    res.send(buffer);

    console.log('✅ Machine history card export completed successfully');

  } catch (error) {
    console.error('❌ Error in processAndExportData:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: `Error exporting machine history card: ${error.message}` });
  }
}

// Helper function to extract breakdown codes from JSONB
function extractBreakdownCodes(breakdowncodes) {
  if (!breakdowncodes) return 'N/A';

  try {
    if (typeof breakdowncodes === 'object' && !Array.isArray(breakdowncodes)) {
      const selectedCodes = Object.keys(breakdowncodes).filter(key => breakdowncodes[key] === true);
      return selectedCodes.length > 0 ? selectedCodes.join(', ') : 'N/A';
    }

    if (Array.isArray(breakdowncodes)) {
      return breakdowncodes.join(', ');
    }

    return breakdowncodes || 'N/A';
  } catch (error) {
    console.error('Error extracting breakdown codes:', error);
    return 'N/A';
  }
}
// Helper function to calculate total breakdown time for export
function calculateTotalBDTimeForExport(startTime, finishTime) {
  if (!startTime || !finishTime) {
    console.log('Missing start or finish time:', { startTime, finishTime });
    return 'N/A';
  }

  try {
    console.log('Input times:', { startTime, finishTime });

    // Ensure times are in HH:MM format
    const startTimeFormatted = startTime.length === 5 ? startTime : startTime.substring(0, 5);
    const finishTimeFormatted = finishTime.length === 5 ? finishTime : finishTime.substring(0, 5);

    console.log('Formatted times:', { startTimeFormatted, finishTimeFormatted });

    const start = new Date(`1970-01-01T${startTimeFormatted}:00`);
    const finish = new Date(`1970-01-01T${finishTimeFormatted}:00`);

    console.log('Parsed dates:', { start, finish });

    if (isNaN(start.getTime()) || isNaN(finish.getTime())) {
      console.log('Invalid date conversion');
      return 'N/A';
    }

    let diffMs = finish.getTime() - start.getTime();
    console.log('Time difference (ms):', diffMs);

    // If finish time is earlier than start time, assume it spans midnight (next day)
    if (diffMs < 0) {
      // Add 24 hours (in milliseconds) to handle next day scenario
      diffMs += 24 * 60 * 60 * 1000;
      console.log('Added 24 hours, new diff (ms):', diffMs);
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    console.log('Final result - Hours:', diffHours, 'Minutes:', diffMinutes);

    if (diffHours > 0 && diffMinutes > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else if (diffHours > 0) {
      return `${diffHours}h`;
    } else {
      return `${diffMinutes}m`;
    }
  } catch (error) {
    console.error('Error calculating total BD time for export:', error);
    return 'N/A';
  }
}

// Helper function to get status for export
function getStatusForExport(inspectionresult) {
  if (!inspectionresult) return 'Pending';

  if (inspectionresult.toLowerCase().includes('accepted') || inspectionresult.toLowerCase().includes('rejected')) {
    return 'Completed';
  }

  return inspectionresult || 'Pending';
}

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
}}