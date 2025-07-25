const express = require('express');
const ExcelJS = require('exceljs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 3000;

// Replace with your actual Supabase project URL and service role key
const supabase = createClient(
  'https://ufczydnvscaicygwlmhz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmY3p5ZG52c2NhaWN5Z3dsbWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg5NDYsImV4cCI6MjA1OTc5NDk0Nn0.0TUriXYvPuml-Jzr9v1jvcuzKjh-cZgnZhYKkQEj3t0'
);

app.get('/export', async (req, res) => {
  // 1. Fetch data from Supabase
  const { data, error } = await supabase
    .from('inline_inspection_form_master')
    .select('*');
  if (error) return res.status(500).send('Error fetching data');

  // 2. Create Excel workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Inspection Data');

  // 3. Add headers (customize as needed)
  worksheet.columns = [
    { header: 'ID', key: 'id' },
    { header: 'Traceability Code', key: 'traceability_code' },
    { header: 'Lot Letter', key: 'lot_letter' },
    { header: 'Customer', key: 'customer' },
    { header: 'Inspection Data', key: 'inspection_data' },
    // Add more columns as needed
  ];

  // 4. Add rows
  data.forEach(row => worksheet.addRow(row));

  // 5. Send file to browser
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=inspection_data.xlsx');
  await workbook.xlsx.write(res);
  res.end();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
}); 