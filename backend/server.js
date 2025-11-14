const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration for frontend - production URLs and local development
app.use(cors({
  origin: [
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://localhost:3000',
    'https://swanson-india-portal.vercel.app',
    'https://swanson-india-portal-9achzdpnx.vercel.app',
    'https://swanson-ind-git-aaaf01-swanson-plastics-india-pvt-ltds-projects.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));

app.use(express.json());

// Supabase configuration from environment variables
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://ufczydnvscaicygwlmhz.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmY3p5ZG52c2NhaWN5Z3dsbWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg5NDYsImV4cCI6MjA1OTc5NDk0Nn0.0TUriXYvPuml-Jzr9v1jvcuzKjh-cZgnZhYKkQEj3t0'
);

// Keep-alive system to prevent cold starts
setInterval(() => {
  try {
    // Additional memory cleanup to prevent cold starts
    if (global.gc) {
      global.gc();
    }
  } catch (error) {
    console.log('Keep-alive error:', error.message);
  }
}, 5 * 60 * 1000); // Every 5 minutes

// Keep-alive endpoint to prevent cold starts
app.get('/ping', async (req, res) => {
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  // Perform a light database query to keep connections warm
  try {
    await supabase
      .from('inline_inspection_form_master_2')
      .select('id')
      .limit(1);
  } catch (dbError) {
    console.log('Ping database error:', dbError.message);
  }

  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    uptimeFormatted: `${days} days, ${hours} hours, ${minutes} minutes`,
    server: 'Swanson India Portal Backend',
    version: '1.0.0',
    memory: process.memoryUsage(),
    platform: process.platform,
    nodeVersion: process.version,
    database: 'connected'
  });
});

// Additional keep-alive endpoint for external services
app.get('/keep-alive', (req, res) => {
  res.json({
    status: 'awake',
    message: 'Server is actively kept alive',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Import export modules
const inlineExportModule = require('./excel-export-inline-inspection-form');
const pgExportModule = require('./excel-export-film-inspection-form-P&G');
const ucExportModule = require('./excel-export-film-inspection-form-UC');
const mjrExportModule = require('./excel-export-MJR-form');
const qualityAlertExportModule = require('./excel-export-quality-alert-form');
const prestoreExportModule = require('./excel-export-prestore-form');

// Import document converter module
const { registerDocumentConverterRoutes } = require('./doc-converter');

// Initialize export modules
inlineExportModule(app);
pgExportModule(app);
ucExportModule(app);
mjrExportModule(app);
qualityAlertExportModule(app);
prestoreExportModule(app);

// Initialize document converter routes
registerDocumentConverterRoutes(app);


console.log(`🚀 Server starting on port ${PORT}`);
console.log(`📊 Excel export: http://localhost:${PORT}/export`);
console.log(`📥 Prestore Excel export: http://localhost:${PORT}/api/download-prestore-excel/:formId`);

app.listen(PORT, () => {
  console.log(`✅ Swanson India Portal Backend running on port ${PORT}`);
  console.log(`🌐 Frontend URLs configured for CORS`);
  console.log(`🗄️  Database: Supabase connected`);
  console.log(`📋 Total endpoints: 28 (3 system + 25 export)`);
});
