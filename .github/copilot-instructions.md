# Swanson India Portal - AI Coding Instructions

## Initial Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- Git
- Supabase account with project access
- VS Code with Live Server extension

### Quick Start
1. Clone the repository: `git clone <repo-url>`
2. Install dependencies: `npm install && cd backend && npm install`
3. Configure Supabase credentials in `public/supabase-config.js`
4. Start development: `npm run dev` (backend) + Live Server on `public/index.html` (frontend)

### Coding Standards
- **Clean Code**: Write readable, maintainable code with clear variable names
- **ES6+ Features**: Use modern JavaScript (arrow functions, async/await, destructuring)
- **Error Handling**: Always wrap async operations in try/catch blocks
- **Comments**: Add JSDoc comments for functions, explain complex logic
- **Consistent Formatting**: Use consistent indentation (2 spaces), semicolons, and naming conventions
- **Modular Code**: Keep functions small and focused on single responsibilities

---

## Architecture Overview

**Swanson India Portal** is a full-stack employee management and quality control system for Swanson Plastics India Pvt Ltd.

### Tech Stack
- **Frontend**: Vanilla JavaScript (ES modules), HTML5, CSS3 - no framework
- **Backend**: Node.js/Express (single `server.js` file pattern)
- **Database**: Supabase (PostgreSQL cloud) with Row-Level Security (RLS)
- **File Processing**: ExcelJS, XLSX, XLSX-Populate (multi-template Excel exports)
- **Deployment**: Vercel (frontend) + standalone Node.js backend

### Key Data Flow
1. Users authenticate via Supabase (email: `{empCode}@swanson.in`)
2. Frontend fetches/submits data to Supabase directly (via `supabase-config.js`)
3. Backend handles Excel export: Supabase → ExcelJS → template population → download
4. Forms are stored in Supabase tables like `inline_inspection_form_master_2`, `safety_incidents`, etc.

---

## Project Structure Conventions

### Frontend (`public/js/`)
- **Single-file forms**: Each form (e.g., `inline-inspection-form.js`, `quality-alert.js`) is self-contained with 1000+ lines
- **Import pattern**: `import { supabase } from '../supabase-config.js'` - all JS files use ES modules
- **Form-specific logic**: Clock management, data validation, table rendering, PDF export
- **Memory leak prevention**: Track intervals/timeouts in `Set` objects, implement `cleanupResources()` before page unload
- **IST timestamps**: Use `getISTTimestamp()` utility for consistent timezone (5.5 hour offset)

### Backend (`backend/`)
- **Modular exports**: Each Excel export is a separate file (`excel-export-*.js`) that registers routes on `app`
- **Routes pattern**: `app.get('/export?traceability_code=...&lot_letter=...')` with optional query filters
- **Supabase in backend**: Instantiated with env vars or hardcoded defaults (same credentials as frontend)
- **Keep-alive logic**: `/ping` and `/keep-alive` endpoints prevent cold starts; includes `setInterval` for garbage collection

### Database (Supabase)
- **RLS Policies**: Tables use Row-Level Security; policies check `auth.uid()` or admin status
- **Naming conventions**: Tables use snake_case (`goods_received_notes`, `grn_items`); columns use lowercase with underscores
- **Timestamps**: Always `TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
- **Triggers**: Auto-update `updated_at` column on modifications

---

## Critical Workflows

### Running Locally
```bash
npm install && cd backend && npm install
npm run dev          # Runs backend/server.js with nodemon on port 3000
# Frontend served via Live Server (public/index.html) on port 5500
```

### Building & Deploying
- **Frontend**: Vercel auto-deploys from `master` branch via `vercel.json` config
- **Backend**: Same repo but also deployable standalone to Render (see `backend/README.md`)
- **Environment variables**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `FRONTEND_URL`, `PORT`

### Excel Export Pipeline
1. Frontend triggers export via HTTP GET `/export?traceability_code=...&lot_letter=...`
2. Backend loads Excel template from `backend/templates/Inline-inspection-form.xlsx`
3. Uses ExcelJS to read template, populate cells with Supabase data, set formatting
4. Streams binary response as `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

---

## Project-Specific Patterns

### Form Submission Pattern
```javascript
// Fetch form data from Supabase
const { data, error } = await supabase.from('inline_inspection_form_master_2').select('*').eq('id', id);

// Insert/update
await supabase.from('table_name').insert(formData); // or .update().eq('id', id)

// Re-render table from updated data
renderTable(data);
```

### Admin Role Access
- Auth check: `const user = await supabase.auth.getUser()`
- Admin verification: Database query to check `is_admin` flag or department membership
- Used in: `admin-adhr.js`, `admin-mt.js`, `admin-qa.js`

### Dynamic Film Inspection Forms
- Product-specific forms in `film-inspection-forms-js/` (e.g., `16-gsm-168-white.js`)
- Each registers routes/handlers but follows same export pattern as inline inspection
- Central list managed in `film-inspection-list.js`

### Common UI Patterns
- **Inline tables**: `renderTable(data)` with HTML template strings
- **Sorting**: `sortData(column)` with global `currentSort` object tracking column + direction
- **Filtering**: `applyFilters(useLocalStorage)` returns filtered subset of `alertsData`
- **Date formatting**: `new Date(dateString).toLocaleDateString()` or backend's `formatDateToDDMMYYYY()`

---

## Important Integration Points

### Supabase Client Configuration
- **File**: `public/supabase-config.js` (hardcoded credentials acceptable for anon key)
- **Exports**: `supabase` client object, `signIn()`, `signOut()`, `updatePassword()`
- **Usage**: Import in all frontend modules; backend re-instantiates with same credentials

### Excel Template Handling
- **Location**: `backend/templates/`
- **Format**: XLSX files with predefined rows, column widths, fonts
- **Pattern**: Load with `ExcelJS.Workbook().xlsx.readFile()`, find data start row, populate row-by-row
- **Utilities**: `formatDateToDDMMYYYY()`, `formatTimeToHHMM()`, `convertToNumber()` for data prep

### Authentication Flow
- Remember Me: Stores `rememberedEmpCode` + `rememberedPassword` in `localStorage`
- Back button prevention: Aggressive `window.history.pushState()` + `popstate` handler on auth page
- Redirect pattern: After login, redirect to role-based dashboard (employee vs. admin)

---

## Common Pitfalls & Solutions

| Issue | Solution |
|-------|----------|
| Memory leaks in long-running forms | Use `intervals` Set, cleanup before `window.unload` |
| Excel export shows "Not a valid OLE stream" | Template must be XLSX (not XLS); use `exceljs` not `xlsx` for writes |
| Supabase credentials in frontend visible | Expected pattern here; separate API key for admin operations in backend-only env var |
| Form data not persisting | Check RLS policies (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) and `auth.uid()` context |
| Timezone mismatches | Always use `getISTTimestamp()` or `TIMESTAMP WITH TIME ZONE DEFAULT NOW()` on backend |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `backend/server.js` | Entry point; initializes Express, CORS, keeps backend warm |
| `public/supabase-config.js` | Supabase client + auth helpers |
| `public/js/inline-inspection-form.js` | Large form with data entry, validation, export, 2700+ lines |
| `backend/excel-export-inline-inspection-form.js` | Excel template population, 1000 lines |
| `sql/grn-schema.sql` | Database schema example with RLS policies |
| `vercel.json` | Vercel build config: routes, static serving, API proxying |

---

## Development Tips

- Use `console.error()` for debugging; functions often wrap errors in `try/catch`
- Frontend forms import styles via `<link>` in HTML, not bundled—check `public/css/`
- Supabase table queries always check `error` after `const { data, error } = await ...`
- Excel exports stream binary; test with curl: `curl "http://localhost:3000/export?..."` > file.xlsx
- IST offset is hardcoded as 5.5 hours; update if deployment timezone changes
