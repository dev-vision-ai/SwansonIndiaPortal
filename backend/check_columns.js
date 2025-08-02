const { createClient } = require('@supabase/supabase-js');

// Use the same Supabase configuration as server.js
const supabase = createClient(
  'https://ufczydnvscaicygwlmhz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmY3p5ZG52c2NhaWN5Z3dsbWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg5NDYsImV4cCI6MjA1OTc5NDk0Nn0.0TUriXYvPuml-Jzr9v1jvcuzKjh-cZgnZhYKkQEj3t0'
);

async function checkColumns() {
    try {
        console.log('Checking columns in inline_inspection_form_master_2 table...');
        
        const { data, error } = await supabase
            .from('inline_inspection_form_master_2')
            .select('*')
            .limit(1);
            
        if (error) {
            console.error('Error:', error);
            return;
        }
        
        if (data && data.length > 0) {
            const columns = Object.keys(data[0]).sort();
            console.log('\n=== ACTUAL COLUMNS IN inline_inspection_form_master_2 ===');
            console.log('Total columns:', columns.length);
            console.log('\nColumns:');
            columns.forEach((col, index) => {
                console.log(`${index + 1}. ${col}`);
            });
            
            // Check for JSONB columns
            const jsonbColumns = columns.filter(col => 
                col.includes('roll_') || 
                col.includes('film_') || 
                col.includes('thickness_') || 
                col.includes('accept_') || 
                col.includes('defect_') || 
                col.includes('appearance') || 
                col.includes('quality') || 
                col.includes('core_') || 
                col.includes('time_') || 
                col.includes('remarks_')
            );
            
            console.log('\n=== JSONB COLUMNS ===');
            jsonbColumns.forEach((col, index) => {
                console.log(`${index + 1}. ${col}`);
            });
            
            console.log('\n=== REGULAR COLUMNS ===');
            const regularColumns = columns.filter(col => !jsonbColumns.includes(col));
            regularColumns.forEach((col, index) => {
                console.log(`${index + 1}. ${col}`);
            });
            
        } else {
            console.log('No data found in table');
        }
        
    } catch (err) {
        console.error('Error:', err);
    }
}

checkColumns(); 