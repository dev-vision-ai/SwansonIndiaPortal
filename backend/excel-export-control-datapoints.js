const XlsxPopulate = require('xlsx-populate');
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

module.exports = function(app, createAuthenticatedSupabaseClient) {
  // Control Datapoints Excel Export Endpoint
  app.get('/export-control-datapoints', async (req, res) => {
    try {
      // Get authenticated Supabase client using JWT from request
      const supabase = createAuthenticatedSupabaseClient(req);

      // Get query parameters for filtering
      const {
        start_date,
        end_date,
        department,
        control_type,
        machine,
        gcas,
        product
      } = req.query;

      // Build query for control datapoints table
      let query = supabase
        .from('control_datapoints')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters if provided
      if (start_date) {
        query = query.gte('created_at', start_date);
      }
      if (end_date) {
        query = query.lte('created_at', end_date);
      }
      if (department) {
        query = query.eq('department', department);
      }
      if (control_type) {
        query = query.eq('control_type', control_type);
      }
      if (machine) {
        query = query.eq('machine', machine);
      }
      if (gcas) {
        query = query.eq('gcas', gcas);
      }
      if (product) {
        query = query.eq('product', product);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).send('Error fetching control datapoints data');
      }

      if (!data || data.length === 0) {
        return res.status(404).send('No control datapoints data found for the specified criteria');
      }

      // Load the Excel template
      const templatePath = path.join(__dirname, 'templates', 'Control-Datapoints.xlsx');

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

      // Get the first worksheet
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        console.error('No worksheets found in template');
        return res.status(500).send('Template worksheet not found');
      }

      // Find the starting row for data insertion
      let dataStartRow = 10;

      // Find the first empty row or row with specific marker
      for (let row = 1; row <= 50; row++) {
        const cell = worksheet.getCell(`A${row}`);
        if (!cell.value || cell.value.toString().trim() === '') {
          dataStartRow = row;
          break;
        }
      }

      // Insert data into the template
      let currentRow = dataStartRow;

      for (const datapoint of data) {
        // Map your datapoint fields to Excel columns
        // Adjust column mappings based on your template structure

        worksheet.getCell(`A${currentRow}`).value = datapoint.id || '';
        worksheet.getCell(`B${currentRow}`).value = datapoint.control_type || '';
        worksheet.getCell(`C${currentRow}`).value = datapoint.department || '';
        worksheet.getCell(`D${currentRow}`).value = datapoint.parameter_name || '';
        worksheet.getCell(`E${currentRow}`).value = convertToNumber(datapoint.target_value);
        worksheet.getCell(`F${currentRow}`).value = convertToNumber(datapoint.actual_value);
        worksheet.getCell(`G${currentRow}`).value = convertToNumber(datapoint.tolerance_min);
        worksheet.getCell(`H${currentRow}`).value = convertToNumber(datapoint.tolerance_max);
        worksheet.getCell(`I${currentRow}`).value = datapoint.status || '';
        worksheet.getCell(`J${currentRow}`).value = datapoint.remarks || '';
        worksheet.getCell(`K${currentRow}`).value = formatDateToDDMMYYYY(datapoint.created_at);
        worksheet.getCell(`L${currentRow}`).value = datapoint.created_by_name || '';

        currentRow++;
      }

      // Set response headers for Excel download
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `Control-Datapoints-Export-${timestamp}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Write the workbook to response
      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      console.error('Export error:', error);
      res.status(500).send('Internal server error during export');
    }
  });
};