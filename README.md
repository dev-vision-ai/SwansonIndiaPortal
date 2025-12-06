# Swanson India Portal

A comprehensive full-stack employee management and quality control system for Swanson Plastics India Pvt Ltd. Features real-time form submission, multi-lot inspection data management, Excel export capabilities, and role-based admin controls.

**Version**: 2.0.0  
**Last Updated**: December 2025

---

## 🌟 Key Features

### 🔐 Authentication & Authorization
- Employee login with email (`{empCode}@swanson.in`)
- Role-based access control (Employee, Admin, QC Manager, MT Manager)
- Remember Me functionality for persistent login
- Secure password management via Supabase Auth
- Back button protection after authentication

### 📋 Forms & Data Collection
- **Inline Inspection Forms**: Multi-lot roll inspection with JSONB data storage
- **Quality Alerts**: Product quality issue tracking and management
- **Safety Incidents**: Safety event reporting with detailed analytics
- **Film Inspection Forms**: Product-specific inspection templates (P&G, UC, etc.)
- **Machine History**: Machine maintenance and history tracking
- **Fire Extinguisher Management**: Equipment inspection and tracking
- **Goods Received Notes (GRN)**: Material receiving and validation
- **Purchase Requisitions**: Procurement request management
- **Document Management**: Document review and approval workflows

### 📊 Data Management & Analysis
- **Real-time Summaries**: Auto-updating defects, production, and IPQC summaries
- **Multi-lot Support**: Handle multiple inspection lots per production run
- **Duplicate Detection**: Automatic detection and warning for duplicate lot numbers
- **OOS (Out of Specification) Validation**: Real-time cell validation with visual feedback
- **Parallel Data Loading**: Optimized database queries using Promise.all()
- **Instant Loading**: Removed delays for 500ms+ performance targets

### 💾 Excel Export Pipeline
- **Multiple Export Formats**: Inline inspection, quality alerts, pre-store forms, MJR forms
- **Template Population**: ExcelJS-based Excel template population with formatting
- **Stream Download**: Binary file streaming for efficient downloads
- **Cell Formatting**: Color coding, borders, fonts, and styling preservation

### 🎨 User Interface
- **Responsive Design**: Mobile-first CSS with breakpoints for all devices
- **Real-time Table Updates**: DOM-based table rendering with live editing
- **Visual Feedback**: Color-coded cells for data validation (red for OOS, yellow for warnings)
- **Form Navigation**: Keyboard shortcuts (Tab, Enter, Arrow keys) for fast data entry
- **Loading States**: Removed loading spinners for instant UI feedback

### 👨‍💼 Admin Features
- **MT Admin Dashboard**: Machine and team management
- **QC Admin Dashboard**: Quality control and defects monitoring
- **ADHR Admin Dashboard**: Administrative and HR functions
- **User Management**: Employee data and role assignment
- **System Configuration**: Global settings and parameters

---

## 🛠️ Technology Stack

### Frontend
- **Languages**: HTML5, CSS3, JavaScript (ES6+)
- **Framework**: Vanilla JS (No framework dependencies)
- **Module System**: ES Modules
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Supabase Realtime Subscriptions

### Backend
- **Runtime**: Node.js (v16+)
- **Framework**: Express.js
- **File Processing**: ExcelJS, XLSX, XLSX-Populate
- **Database Client**: Supabase JavaScript Client
- **Utilities**: uuid, nodemon (dev)

### Database
- **Platform**: Supabase (PostgreSQL Cloud)
- **Security**: Row-Level Security (RLS) policies
- **Timestamps**: TIMESTAMP WITH TIME ZONE (IST offset: 5.5 hours)
- **Data Types**: JSONB for inspection data, TEXT for remarks, INT for counts

### Deployment
- **Frontend**: Vercel (Automatic CI/CD on master branch push)
- **Backend**: Vercel or Render (Standalone deployable)
- **CDN**: Vercel CDN for static assets
- **Environment**: Production-grade deployment pipeline

---

## 📁 Project Structure

```
SwansonIndiaPortal/
│
├── backend/                                    # Node.js Express Backend
│   ├── server.js                              # Main entry point (Express server)
│   ├── package.json                           # Backend dependencies
│   ├── README.md                              # Backend documentation
│   ├── excel-export-inline-inspection-form.js # Inline inspection Excel export
│   ├── excel-export-quality-alert-form.js     # Quality alert Excel export
│   ├── excel-export-prestore-form.js          # Pre-store form Excel export
│   ├── excel-export-MJR-form.js               # MJR form Excel export
│   ├── excel-export-film-inspection-form-UC.js    # Film inspection (UC) Excel export
│   ├── excel-export-film-inspection-form-P&G.js   # Film inspection (P&G) Excel export
│   └── templates/                             # Excel template files
│       ├── Inline-inspection-form.xlsx
│       ├── Quality-alert-form.xlsx
│       ├── Pre-store-form.xlsx
│       └── [Other form templates...]
│
├── public/                                    # Frontend Static Files
│   ├── index.html                            # Main landing page
│   ├── supabase-config.js                    # Supabase client configuration
│   ├── assets/                               # Static assets
│   │   ├── slideshow/                        # Slideshow images
│   │   └── slideshow-767/                    # Mobile slideshow images
│   ├── css/                                  # Stylesheets
│   │   ├── common-header.css                 # Common header styles
│   │   ├── index.css                         # Landing page styles
│   │   ├── auth.css                          # Authentication page styles
│   │   ├── employee-dashboard.css            # Employee dashboard styles
│   │   ├── admin-mt.css                      # MT Admin dashboard styles
│   │   ├── admin-qc.css                      # QC Admin dashboard styles
│   │   ├── inline-responsive.css             # Inline inspection responsive styles
│   │   ├── quality-alert.css                 # Quality alert form styles
│   │   ├── safety-incident.css               # Safety incident styles
│   │   ├── goods-received-notes.css          # GRN form styles
│   │   └── [Other form stylesheets...]
│   ├── html/                                 # HTML Pages
│   │   ├── auth.html                         # Login/Auth page
│   │   ├── employee-dashboard.html           # Employee dashboard
│   │   ├── admin-mt.html                     # MT Admin dashboard
│   │   ├── admin-qc.html                     # QC Admin dashboard
│   │   ├── inline-inspection-form.html       # Inline inspection form
│   │   ├── inline-inspection-data.html       # Inline inspection data viewer
│   │   ├── quality-alert.html                # Quality alert form
│   │   ├── safety-incident.html              # Safety incident form
│   │   ├── goods-received-notes-table.html   # GRN list
│   │   ├── purchase-requisition-list.html    # Purchase requisition list
│   │   ├── fire-extinguisher-inspection-form.html  # Fire extinguisher form
│   │   └── [Other form pages...]
│   └── js/                                   # JavaScript Files
│       ├── auth.js                           # Authentication logic
│       ├── employee-dashboard.js             # Employee dashboard functionality
│       ├── admin-mt.js                       # MT Admin dashboard functionality
│       ├── admin-qc.js                       # QC Admin dashboard functionality
│       ├── inline-inspection-form.js         # Inline inspection form (2700+ lines)
│       ├── inline-inspection-data-simple.js  # Multi-lot data management (6000+ lines)
│       ├── quality-alert.js                  # Quality alert form logic
│       ├── safety-incident.js                # Safety incident form logic
│       ├── fire-extinguisher-mgmt.js         # Fire extinguisher management
│       └── [Other form JavaScript files...]
│
├── sql/                                      # Database Schema & Migrations
│   ├── grn-schema.sql                        # GRN table schema with RLS policies
│   ├── dcc-schema.sql                        # DCC table schema
│   ├── film-inspection-all-tables-rls-policies.sql  # Film inspection RLS policies
│   ├── quality_alerts-rls-modify.sql         # Quality alerts RLS modifications
│   ├── grn-migration.sql                     # GRN migration script
│   └── setup-warehouse-user.sql              # Warehouse user setup
│
├── documents/                                # Project Documentation
│   └── Jobs/                                 # Job postings and management
│
├── .github/                                  # GitHub Configuration
│   └── copilot-instructions.md               # AI Coding Assistant Instructions
│
├── vercel.json                               # Vercel Deployment Configuration
├── package.json                              # Root package.json
├── README.md                                 # This file
└── .gitignore                                # Git ignore rules
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v16.x or higher
- **npm**: v7.x or higher (or yarn)
- **Supabase Account**: With project access and API keys
- **Git**: For version control
- **VS Code** (recommended): With Live Server extension for frontend development

### Installation Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/dev-vision-ai/SwansonIndiaPortal.git
   cd SwansonIndiaPortal
   ```

2. **Install Root Dependencies**
   ```bash
   npm install
   ```

3. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   cd ..
   ```

4. **Configure Supabase**
   - Edit `public/supabase-config.js`
   - Add your Supabase URL and anon key:
   ```javascript
   const SUPABASE_URL = 'https://xxxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJxxxxx...';
   ```

5. **Set Environment Variables** (Backend)
   - Create `.env` file in `backend/` directory:
   ```env
   NODE_ENV=development
   PORT=3000
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_ANON_KEY=eyJxxxxx...
   FRONTEND_URL=http://localhost:5500
   ```

6. **Start Development**
   ```bash
   # Terminal 1: Start backend (from root)
   npm run dev
   
   # Terminal 2: Start frontend (from public/ folder)
   # Use VS Code Live Server extension on public/index.html
   # Or: python -m http.server 5500
   ```

7. **Access the Application**
   - Frontend: `http://localhost:5500`
   - Backend: `http://localhost:3000`

---

## 📝 Development Workflow

### Running Locally

```bash
# Root directory - starts backend on port 3000
npm run dev

# Separate terminal - start frontend
# Use VS Code Live Server extension or http server
```

### Code Structure Conventions

**Frontend (Vanilla JS + ES Modules)**
- All JS files use ES6+ syntax with async/await
- Import pattern: `import { supabase } from '../supabase-config.js'`
- Each form is self-contained in a single file (1000-3000+ lines)
- Memory management: Track intervals/timeouts in `Set` objects with cleanup functions

**Backend (Node.js/Express)**
- Single `server.js` entry point
- Modular Excel exports in separate files (`excel-export-*.js`)
- Routes pattern: `app.get('/export?traceability_code=...')`
- Keep-alive: `/ping` and `/keep-alive` endpoints for preventing cold starts

**Database (Supabase/PostgreSQL)**
- Tables use snake_case naming
- JSONB columns for flexible data structures
- RLS policies enforce row-level access control
- Timestamps: Always `TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
- IST offset: 5.5 hours (hardcoded in utility functions)

### Key Utilities & Functions

**Authentication** (`supabase-config.js`)
```javascript
signIn(email, password)        // Login user
signOut()                      // Logout user
updatePassword(newPassword)    // Change password
getUser()                      // Get current user
```

**Timestamps** (Used in all forms)
```javascript
getISTTimestamp()              // Returns IST-adjusted timestamp
formatDateToDDMMYYYY(date)     // Format: DD/MM/YYYY
formatTimeToHHMM(time)         // Format: HH:MM
```

**Database Operations** (Supabase)
```javascript
supabase.from('table').select('*')              // Fetch data
supabase.from('table').insert([data])           // Insert rows
supabase.from('table').update(data).eq('id', id) // Update rows
supabase.from('table').delete().eq('id', id)    // Delete rows
```

---

## 📊 Form-Specific Documentation

### Inline Inspection Form (`inline-inspection-form.js` & `inline-inspection-data-simple.js`)
- **Size**: 6000+ lines of code
- **Database Tables**: `inline_inspection_form_master_1`, `inline_inspection_form_master_2`, `inline_inspection_form_master_3`
- **Data Storage**: Individual JSONB columns for roll data (weights, widths, diameters, etc.)
- **Features**:
  - Multi-lot support with automatic lot number generation
  - Duplicate lot detection with warning modals (Lot No. text highlighted in yellow)
  - Real-time summary tables (defects, production, IPQC, statistics)
  - OOS (Out of Specification) validation with color coding
  - Parallel database loading using Promise.all()
  - Keyboard navigation for fast data entry (Tab, Enter, Arrow keys)
  - Auto-fill functionality for printing-related fields
  - Non-printed form support with NA value pre-filling

**Key Features**:
- **Loading Performance**: Instant 500ms+ loading (removed spinners and delays)
- **Multi-lot Reload**: `loadAllLots()` function with parallel queries across 3 tables
- **Add Next Lot Button**: Creates new lot and auto-reloads all data
- **Fill O Button**: Batch auto-fill with comprehensive validation
- **Delete Table**: Remove latest lot with confirmation modal
- **Validation Modal**: Yellow-highlighted "Lot No. XX" with missing field details

### Quality Alert Form (`quality-alert.js`)
- **Database Table**: `quality_alerts`
- **Features**: Real-time alert tracking, status management, statistical reporting
- **Export**: Quality alerts to Excel with formatting

### Safety Incident Form (`safety-incident.js`)
- **Database Table**: `safety_incidents`
- **Features**: Incident reporting, severity tracking, trend analysis
- **Admin View**: Comprehensive safety analytics

### Film Inspection Forms
- **Location**: `public/js/film-inspection-forms-js/` (product-specific)
- **Examples**: 16-gsm-168-white.js, etc.
- **Pattern**: Each form registers routes and handles product-specific export

---

## 💾 Excel Export Pipeline

### How It Works

1. **Frontend Triggers Export**
   ```javascript
   // Fetch from backend with query parameters
   fetch('http://localhost:3000/export?traceability_code=TC001&lot_letter=A')
   ```

2. **Backend Processes**
   - Loads Excel template from `backend/templates/`
   - Queries Supabase for form data
   - Populates template cells with data using ExcelJS
   - Sets formatting (colors, borders, fonts)
   - Streams binary response

3. **Frontend Receives**
   - Binary Excel file in response
   - Automatic download via blob + link

### Supported Exports
- Inline Inspection Form
- Quality Alert Form
- Pre-Store Form
- MJR Form
- Film Inspection Forms (P&G, UC)

---

## 🔐 Database Architecture

### Key Tables

**inline_inspection_form_master_1/2/3**
- Separated by machine number (01, 02, 03)
- Columns: JSONB data for roll details, timestamps, status
- RLS: Row-level security by traceability_code

**quality_alerts**
- Product quality issues with categorization
- Status tracking (Open, In Progress, Resolved)
- Statistical aggregation for reporting

**safety_incidents**
- Incident details with severity levels
- Root cause analysis and corrective actions
- Trend analysis across time periods

**goods_received_notes**
- Material receiving records with supplier info
- Item-level tracking with quantities
- Quality acceptance/rejection

### Row-Level Security (RLS)

All sensitive tables have RLS policies enforcing:
- Employees can only access their own data
- Admins have full access
- Department heads can access team data

---

## 🌐 Deployment

### Vercel Deployment (Frontend)

1. **Push to Master Branch**
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin master
   ```

2. **Automatic Deployment**
   - Vercel automatically builds and deploys
   - Environment variables configured in Vercel dashboard
   - Live URL: https://swanson-ind-git-aaaf01-swanson-plastics-india-pvt-ltds-projects.vercel.app

3. **Vercel Configuration** (`vercel.json`)
   - Routes frontend requests to static files
   - Proxies `/api/*` requests to backend
   - Sets environment variables

### Backend Deployment

**Option 1: Vercel Serverless**
```bash
vercel deploy backend/server.js --prod
```

**Option 2: Render Standalone**
```bash
git push origin master  # Render auto-deploys from git
```

**Option 3: Local VPS**
```bash
npm install
PORT=3000 npm start
```

### Environment Variables (Production)

**Vercel Dashboard Settings**
```
SUPABASE_URL=production_url
SUPABASE_ANON_KEY=production_key
FRONTEND_URL=https://your-domain.com
PORT=3000
```

---

## 🧪 Testing & Debugging

### Syntax Validation
```bash
node -c public/js/inline-inspection-data-simple.js
```

### Console Debugging
- All forms use `console.error()` for error logging
- Database operations wrap in try/catch blocks
- Check browser DevTools → Console for error messages

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| 406 Not Acceptable | Removed non-existent columns from select queries (e.g., form_id) |
| Memory leaks | Implement `cleanupResources()` before page unload |
| Excel export fails | Verify template file exists in `backend/templates/` |
| Supabase connection error | Check URL and API key in `supabase-config.js` |
| Form data not saving | Verify RLS policies and authentication context |
| Timezone mismatches | Always use `getISTTimestamp()` utility |

---

## 📱 Browser Support

- **Chrome**: Latest 2 versions
- **Firefox**: Latest 2 versions
- **Safari**: Latest 2 versions
- **Edge**: Latest 2 versions
- **Mobile**: Responsive design for iOS and Android

---

## 🔄 Performance Optimizations

### Frontend
- ✅ Instant 500ms+ loading (removed setTimeout delays)
- ✅ Parallel database queries using Promise.all()
- ✅ Removed loading spinners for faster UX
- ✅ DOM-based rendering with efficient updates
- ✅ Keyboard shortcuts for fast data entry

### Backend
- ✅ Keep-alive endpoints prevent cold starts
- ✅ Parallel Excel template processing
- ✅ Stream downloads for large files
- ✅ Efficient database queries with proper indexing

### Database
- ✅ JSONB for flexible schema
- ✅ RLS policies for security without extra queries
- ✅ Indexed columns for fast lookups
- ✅ Connection pooling via Supabase

---

## 📚 Additional Resources

### Documentation Files
- `backend/README.md` - Backend-specific documentation
- `.github/copilot-instructions.md` - AI Assistant instructions
- `sql/*.sql` - Database schema files

### External Resources
- [Supabase Documentation](https://supabase.com/docs)
- [Express.js Guide](https://expressjs.com/)
- [ExcelJS Documentation](https://github.com/exceljs/exceljs)
- [Vercel Documentation](https://vercel.com/docs)

---

## 🤝 Contributing

1. **Fork the Repository**
   ```bash
   git clone https://github.com/dev-vision-ai/SwansonIndiaPortal.git
   ```

2. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Commit Changes**
   ```bash
   git commit -m "Add feature: your feature description"
   ```

4. **Push to Branch**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open Pull Request**
   - Provide clear description of changes
   - Reference related issues
   - Include testing notes

### Code Standards
- Use ES6+ syntax (arrow functions, destructuring, async/await)
- Always wrap async operations in try/catch
- Add JSDoc comments for functions
- Use consistent naming conventions
- Keep functions focused on single responsibility

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) file for details.

---

## 👥 Development Team

**Swanson Plastics India Pvt Ltd**
- Development Team: Full-stack development and maintenance
- Quality Control Team: Testing and validation
- Management Team: Project oversight and direction

---

## 📞 Support & Contact

For technical support, feature requests, or bug reports:
- **Email**: development@swanson.in
- **Internal Portal**: Access via employee dashboard
- **Documentation**: See `.github/copilot-instructions.md`

---

## 🗂️ Changelog

### Version 2.0.0 (December 2025)
- ✅ Instant loading optimization (removed spinners, setTimeout delays)
- ✅ Fixed 406 Not Acceptable error (removed non-existent form_id column)
- ✅ Enhanced validation modal with yellow background for lot numbers
- ✅ Cleaned up all commented-out code for maintainability
- ✅ Comprehensive README documentation update

### Version 1.0.0 (Initial Release)
- ✅ Full form management system
- ✅ Multi-lot inspection support
- ✅ Excel export functionality
- ✅ Role-based access control
- ✅ Real-time data updates

---

**Project Status**: ✅ Active & Maintained  
**Last Updated**: December 7, 2025  
**Current Version**: 2.0.0
