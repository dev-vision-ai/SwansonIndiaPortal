const XlsxPopulate = require('xlsx-populate');
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

module.exports = function(app, createAuthenticatedSupabaseClient) {
  // Quality Alert Form Excel Export Endpoint
  app.get('/export-quality-alert', async (req, res) => {
    try {
      // Get authenticated Supabase client using JWT from request
      const supabase = createAuthenticatedSupabaseClient(req);
      
      // Get query parameters for specific alert
      const { alert_id } = req.query;

      // 1. Fetch data from Supabase - filter by specific alert if ID provided
      let query = supabase.from('quality_alerts').select(`
        *,
        users ( full_name, department )
      `);

      if (alert_id) {
        // Export specific alert
        query = query.eq('id', alert_id);
      }
      // If no parameters, export all alerts (existing behavior)

      const { data, error } = await query;
      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).send('Error fetching data');
      }

      if (!data || data.length === 0) {
        return res.status(404).send('No data found for the specified alert(s)');
      }

      // 2. Load the client's Excel template
      const templatePath = path.join(__dirname, 'templates', 'quality-alert-form.xlsx');

      // Check if template file exists
      if (!fs.existsSync(templatePath)) {
        console.error('Template file not found:', templatePath);
        return res.status(500).send('Excel template file not found');
      }

      const workbook = new ExcelJS.Workbook();
      try {
        await workbook.xlsx.readFile(templatePath);
      } catch (templateError) {
        console.error('Error loading template:', templateError);
        return res.status(500).send(`Error loading Excel template: ${templateError.message}`);
      }

      // 3. Get the first worksheet (or specify by name if needed)
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        console.error('No worksheets found in template');
        return res.status(500).send('Template worksheet not found');
      }

      // 4. Find the starting row for data insertion
      let dataStartRow = 10;

      // Find the first empty row or row with specific marker
      for (let row = 1; row <= 50; row++) {
        const cell = worksheet.getCell(`A${row}`);
        if (!cell.value || cell.value.toString().trim() === '') {
          dataStartRow = row;
          break;
        }
      }

      // 5. Process each alert and map to Excel
      data.forEach((alert, alertIndex) => {
        const currentRow = dataStartRow + (alertIndex * 15); // Assuming ~15 rows per alert

        if (currentRow > worksheet.rowCount) {
          // Add more rows if needed
          worksheet.addRows(currentRow - worksheet.rowCount);
        }

        // Map alert data to Excel cells
        worksheet.getCell(`A${currentRow}`).value = 'Alert ID:';
        worksheet.getCell(`B${currentRow}`).value = alert.id || '';

        worksheet.getCell(`A${currentRow + 1}`).value = 'Incident Title:';
        worksheet.getCell(`B${currentRow + 1}`).value = alert.incidenttitle || '';

        worksheet.getCell(`A${currentRow + 2}`).value = 'Date of Occurrence:';
        worksheet.getCell(`B${currentRow + 2}`).value = alert.incidentdate ? formatDateToDDMMYYYY(alert.incidentdate) : '';

        worksheet.getCell(`A${currentRow + 3}`).value = 'Time of Occurrence:';
        worksheet.getCell(`B${currentRow + 3}`).value = alert.incidenttime ? formatTimeToHHMM(alert.incidenttime) : '';

        worksheet.getCell(`A${currentRow + 4}`).value = 'Responsible Department:';
        worksheet.getCell(`B${currentRow + 4}`).value = alert.responsibledept || '';

        worksheet.getCell(`A${currentRow + 5}`).value = 'Location/Machine:';
        worksheet.getCell(`B${currentRow + 5}`).value = alert.locationarea || '';

        worksheet.getCell(`A${currentRow + 6}`).value = 'Type of Abnormality:';
        worksheet.getCell(`B${currentRow + 6}`).value = alert.abnormalitytype || '';

        worksheet.getCell(`A${currentRow + 7}`).value = 'Potential Quality Risk:';
        worksheet.getCell(`B${currentRow + 7}`).value = alert.qualityrisk || '';

        worksheet.getCell(`A${currentRow + 8}`).value = 'Kept in View:';
        worksheet.getCell(`B${currentRow + 8}`).value = alert.keptinview || '';

        worksheet.getCell(`A${currentRow + 9}`).value = 'Incident Description:';
        worksheet.getCell(`B${currentRow + 9}`).value = alert.incidentdesc || '';

        // Product details (if applicable)
        if (alert.productcode || alert.rollid || alert.lotno || alert.rollpositions) {
          worksheet.getCell(`A${currentRow + 10}`).value = 'Product Code:';
          worksheet.getCell(`B${currentRow + 10}`).value = alert.productcode || '';

          worksheet.getCell(`A${currentRow + 11}`).value = 'Roll ID:';
          worksheet.getCell(`B${currentRow + 11}`).value = alert.rollid || '';

          worksheet.getCell(`A${currentRow + 12}`).value = 'Lot No:';
          worksheet.getCell(`B${currentRow + 12}`).value = alert.lotno || '';

          worksheet.getCell(`A${currentRow + 13}`).value = 'Roll Positions:';
          worksheet.getCell(`B${currentRow + 13}`).value = alert.rollpositions || '';

          worksheet.getCell(`A${currentRow + 14}`).value = 'Lot Time:';
          worksheet.getCell(`B${currentRow + 14}`).value = alert.lottime ? formatTimeToHHMM(alert.lottime) : '';

          worksheet.getCell(`A${currentRow + 15}`).value = 'Shift:';
          worksheet.getCell(`B${currentRow + 15}`).value = alert.shift || '';
        }

        // Action taken details
        if (alert.actiontaken || alert.whoaction || alert.whenactiondate || alert.statusaction) {
          worksheet.getCell(`D${currentRow}`).value = 'Immediate Action:';
          worksheet.getCell(`E${currentRow}`).value = alert.actiontaken || '';

          worksheet.getCell(`D${currentRow + 1}`).value = 'Action By:';
          worksheet.getCell(`E${currentRow + 1}`).value = alert.whoaction || '';

          worksheet.getCell(`D${currentRow + 2}`).value = 'Action Date:';
          worksheet.getCell(`E${currentRow + 2}`).value = alert.whenactiondate ? formatDateToDDMMYYYY(alert.whenactiondate) : '';

          worksheet.getCell(`D${currentRow + 3}`).value = 'Action Status:';
          worksheet.getCell(`E${currentRow + 3}`).value = alert.statusaction || '';
        }

        // User information
        worksheet.getCell(`D${currentRow + 4}`).value = 'Reported By:';
        worksheet.getCell(`E${currentRow + 4}`).value = alert.users?.full_name || 'Unknown';

        worksheet.getCell(`D${currentRow + 5}`).value = 'User Department:';
        worksheet.getCell(`E${currentRow + 5}`).value = alert.users?.department || 'N/A';

        worksheet.getCell(`D${currentRow + 6}`).value = 'Timestamp:';
        worksheet.getCell(`E${currentRow + 6}`).value = alert.timestamp ? formatDateToDDMMYYYY(alert.timestamp) : '';

        worksheet.getCell(`D${currentRow + 7}`).value = 'Submission Status:';
        worksheet.getCell(`E${currentRow + 7}`).value = alert.submission_status || '';
      });

      // 6. Add password protection to the workbook and protect all worksheets
      workbook.password = '2256';

      // Protect all worksheets with password
      workbook.worksheets.forEach(worksheet => {
        worksheet.protect('2256', {
          selectLockedCells: false,
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
      });

      // 7. Save the workbook to a buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Generate filename
      let filename = 'Quality_Alerts_Export';
      if (alert_id) {
        filename = `Quality_Alert_${alert_id}`;
      } else {
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        filename = `Quality_Alerts_Export_${timestamp}`;
      }
      filename += '.xlsx';

      // 8. Send the buffer as a response
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.send(buffer);

    } catch (error) {
      console.error('Error in quality alert export:', error);
      res.status(500).send(`Error exporting quality alert report: ${error.message}`);
    }
  });
};
