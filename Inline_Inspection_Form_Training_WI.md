# 🎯 **TRAINING WORK INSTRUCTION (WI)**
## **Inline Inspection Form System - Operator Training Guide**

---

## **📋 TRAINING OBJECTIVE**
This Work Instruction (WI) provides comprehensive training for operators to effectively use the Inline Inspection Form system for quality data collection and traceability.

---

## **📋 TABLE OF CONTENTS**
1. [System Overview](#1-system-overview)
2. [Getting Started](#2-getting-started)
3. [Creating Forms](#3-creating-forms)
4. [Data Entry Process](#4-data-entry-process)
5. [Quality Control Workflow](#5-quality-control-workflow)
6. [Form Submission](#6-form-submission)
7. [Export and Printing](#7-export-and-printing)
8. [Troubleshooting Guide](#8-troubleshooting-guide)
9. [Best Practices](#9-best-practices)
10. [Quick Reference](#10-quick-reference)

---

## **1. SYSTEM OVERVIEW**

### **1.1 What is the Inline Inspection Form System?**
The Inline Inspection Form System is a digital quality control tool that replaces paper-based inspection forms. It ensures:
- ✅ **Accurate data collection** during production
- ✅ **Complete traceability** for every roll
- ✅ **Real-time quality monitoring**
- ✅ **Compliance with ISO 9001:2015 standards**

### **1.2 Key Benefits**
- **No paper forms** - Everything is digital
- **Automatic calculations** - No manual math required
- **Instant summaries** - See quality metrics immediately
- **Easy export** - Print professional reports
- **Data backup** - All information is safely stored

### **1.3 System Components**
- **Form Creation**: Set up inspection parameters
- **Data Entry Grid**: Enter roll-by-roll inspection data
- **Quality Status**: Accept/Reject/Rework/KIV tracking
- **Summary Reports**: Real-time quality metrics
- **Export Function**: Generate Excel reports

---

## **2. GETTING STARTED**

### **2.1 Accessing the System**
1. **Open your web browser** (Chrome, Firefox, or Edge)
2. **Navigate to the application URL**
3. **Log in** with your assigned credentials
4. **Verify you're on the correct page**: "All Inline Inspection Forms"

### **2.2 Understanding the Interface**
The main page shows:
- **Header**: Navigation and logout options
- **Create Button**: "+ Create Inline Inspection Form"
- **Filter Section**: Find existing forms
- **Forms Table**: List of all inspection forms

### **2.3 Navigation Basics**
- **Green Pencil Icon** = Edit form
- **Blue Eye Icon** = View form (read-only)
- **Red Trash Icon** = Delete form
- **Download Icon** = Export to Excel

---

## **3. CREATING FORMS**

### **3.1 Starting a New Form**
1. **Click** the "+ Create Inline Inspection Form" button
2. **Wait** for the form overlay to appear
3. **Fill in** all required information (see sections below)
4. **Click** "Create Inline Inspection Form" to save

### **3.2 Required Information**

#### **Production Details**
| Field | Description | Example |
|-------|-------------|---------|
| **Prod. Code** | Product identification code | INUE1C18-250W |
| **Customer** | Customer name | ABC Company |
| **Spec** | Product specification | 250 GSM Clear Film |
| **Production No.** | Production order number | PO-2025-001 |
| **Production Date** | Date of production | 07/08/2025 |

#### **Process Information**
| Field | Description | Options |
|-------|-------------|---------|
| **Emboss Type** | Type of embossing | Select from dropdown |
| **Printed** | Check if printed | ☐ Yes |
| **Non-Printed** | Check if non-printed | ☐ Yes |
| **CT** | Clear Transparent | ☐ Yes |

#### **Date and Machine Information**
| Field | Format | Example |
|-------|--------|---------|
| **Year** | YYYY | 2025 |
| **Month** | MM | 08 |
| **Date** | DD | 07 |
| **M/C No** | 1, 2, or 3 | 1 |
| **Shift** | A, B, or C | A |

#### **Personnel Information**
| Field | Description | Notes |
|-------|-------------|-------|
| **Supervisor** | Supervisor name(s) | Can enter multiple names |
| **Line Leader** | Line leader name(s) | Can enter multiple names |
| **Operator** | Operator name(s) | Can enter multiple names |
| **QC Inspector** | QC inspector name(s) | Can enter multiple names |

### **3.3 Form Status**
- **Draft**: Form is created but not submitted
- **Submitted**: Form is finalized and ready for export

---

## **4. DATA ENTRY PROCESS**

### **4.1 Accessing Data Entry**
1. **Find your form** in the forms list
2. **Click** the green pencil icon (Edit)
3. **Click** "Enter Data" button
4. **Wait** for the data entry interface to load

### **4.2 Adding Rows for Rolls**
1. **Locate** the "Add Rows" section
2. **Enter** the number of rolls to inspect
3. **Click** "Add Rows" button
4. **Verify** rows are added to the table

### **4.3 Understanding the Data Entry Table**

#### **Column Layout**
| Column | Description | Input Type |
|--------|-------------|------------|
| **Time** | Hour/Minute of inspection | Numeric (00-23, 00-59) |
| **Lot No.** | Lot identification | Auto-filled or manual |
| **Roll Position** | Roll number in lot | Auto-incremented |
| **Arm** | Arm position | Text (A, B, C, etc.) |
| **Roll Weight** | Weight in kg | XX.XX format |
| **Roll Width** | Width in mm | XXX format |
| **Film Weight** | GSM measurement | XX.X format |
| **Thickness** | Thickness measurement | XX format |
| **Roll θ** | Roll diameter | XXX format |
| **Paper Core θ** | Core measurements | XXX.X / XXX format |

### **4.4 Inspection Categories**

#### **Film Appearance Inspection**
Enter **O** (OK) or **X** (Defect) for each item:

| Field | Description | O/X |
|-------|-------------|-----|
| **Lines/Strips** | Surface lines or strips | O or X |
| **Glossy** | Glossy appearance | O or X |
| **Film Color** | Color consistency | O or X |
| **Pin Hole** | Presence of pinholes | O or X |
| **Patch Mark** | Surface patches | O or X |
| **Odour** | Unusual odor | O or X |
| **CT** | Clear transparent quality | O or X |

#### **Printing Quality Inspection**
| Field | Description | O/X |
|-------|-------------|-----|
| **Print Color** | Color accuracy | O or X |
| **Mis Print** | Printing misalignment | O or X |
| **Dirty Print** | Print contamination | O or X |
| **Tape Test** | Adhesion test result | O or X |
| **Centralization** | Print centering | O or X |

#### **Roll Appearance Inspection**
| Field | Description | O/X |
|-------|-------------|-----|
| **Wrinkles** | Surface wrinkles | O or X |
| **PRS** | PRS defects | O or X |
| **Roll Curve** | Roll curvature | O or X |
| **Core Misalignment** | Core positioning | O or X |
| **Others** | Other defects | O or X |

### **4.5 Quality Status Selection**

#### **Status Options**
| Status | Color | Description | Action Required |
|--------|-------|-------------|----------------|
| **Accept** | Green | Roll meets standards | None |
| **Reject** | Red | Roll fails standards | Enter defect name |
| **Rework** | Yellow | Roll needs reprocessing | Enter defect name |
| **KIV** | Blue | Keep in View | Enter defect name |

#### **Status Selection Process**
1. **Click** the dropdown in the "Accept/Reject" column
2. **Select** appropriate status
3. **Note**: Only one status per roll allowed
4. **Important**: When selecting "Accept", defect name and remarks are automatically cleared

### **4.6 Defect Information Entry**

#### **When to Enter Defect Information**
- **Required**: When status is Reject, Rework, or KIV
- **Optional**: When status is Accept (but will be cleared)

#### **PI Changed Information**
- **Optional**: Can be entered for any status
- **Preserved**: Data is maintained when changing status (except to Accept)

#### **Defect Name Entry**
1. **Click** in the "Defect Name" column
2. **Type** the defect name
3. **Use** autocomplete suggestions if available
4. **Common defect names**:
   - Mis Print
   - Dirty Print
   - Pinhole
   - Core Misalignment
   - PRS
   - Wrinkles

#### **PI Changed Entry**
1. **Click** in the "PI Changed" column
2. **Type** additional details
3. **Include** specific observations
4. **Note**: PI Changed data is preserved when changing status (except to Accept)

### **4.7 Inspector Information**
- **Inspected By**: Enter your name (only editable for first row)
- **This field** applies to all rolls in the lot

---

## **5. QUALITY CONTROL WORKFLOW**

### **5.1 Understanding Color Coding**

#### **Status Color Indicators**
- **🟢 Green**: Accept status
- **🔴 Red**: Reject status  
- **🟡 Yellow**: Rework status
- **🔵 Blue**: KIV status
- **🔴 Red text on light red**: X values in inspection fields

#### **Visual Feedback**
- **Color changes** help identify quality issues quickly
- **Row highlighting** shows status at a glance
- **Summary updates** in real-time

### **5.2 Using Quality Tools**

#### **Fill O Button**
**Purpose**: Automatically fill empty inspection fields with "O"
**When to use**:
- Most rolls are acceptable
- Quick data entry needed
- Standard quality conditions

**Steps**:
1. **Click** "Fill O" button
2. **Verify** O values are added correctly
3. **Review** and adjust as needed

#### **Clear O Button**
**Purpose**: Remove "O" values from inspection fields
**When to use**:
- Need to re-enter inspection data
- Quality issues detected
- Manual inspection required

**Steps**:
1. **Click** "Clear O" button
2. **Re-enter** inspection data manually
3. **Verify** all entries are correct

#### **Lock Features**
**Roll Weight Lock**:
- **Check** the lock checkbox
- **Enable** fast entry for roll weights
- **Use** Tab key to navigate between weight fields

**Roll θ Lock**:
- **Check** the lock checkbox  
- **Enable** fast entry for roll diameters
- **Use** Tab key to navigate between diameter fields

### **5.3 Data Validation**

#### **Automatic Validation**
The system checks:
- **Numeric ranges** for measurements
- **Required fields** for rejected items
- **Status consistency** (only one per roll)
- **Date formats** and validity

#### **Manual Validation Checklist**
Before submission, verify:
- ✅ **All measurements** are within expected ranges
- ✅ **Defect names** are entered for rejected items
- ✅ **PI Changed** data is complete where needed
- ✅ **Inspector name** is entered
- ✅ **Summary calculations** are correct

### **5.4 Summary Table Understanding**

#### **Summary Information**
The summary table shows:
- **Accepted Rolls**: Count and total weight
- **Rejected Rolls**: Count and total weight
- **Rework Rolls**: Count and total weight
- **KIV Rolls**: Count and total weight
- **Total Rolls**: Sum of all categories
- **Total Weight**: Sum of all weights

#### **Using Summary Data**
- **Monitor** quality trends during shift
- **Verify** calculations are accurate
- **Identify** quality issues quickly
- **Report** metrics to supervisors

---

## **6. FORM SUBMISSION**

### **6.1 Pre-Submission Review**

#### **Final Checklist**
Before submitting, ensure:
- ✅ **All required fields** are completed
- ✅ **Defect names** are entered for rejected items
- ✅ **Measurements** are within valid ranges
- ✅ **Summary calculations** are correct
- ✅ **Inspector name** is entered
- ✅ **PI Changed** data is complete where needed

#### **Data Verification**
1. **Review** each roll entry
2. **Check** status selections
3. **Verify** defect information
4. **Check** PI Changed data
5. **Confirm** summary totals

### **6.2 Submission Process**

#### **Submitting the Form**
1. **Click** "Submit" button
2. **Wait** for confirmation message
3. **Verify** status changes to "Submitted"
4. **Note**: Form becomes read-only after submission

#### **Post-Submission Actions**
- **Form status** changes from "Draft" to "Submitted"
- **Editing** is disabled for submitted forms
- **Export** becomes available
- **Audit trail** is maintained

### **6.3 Form Status Management**

#### **Status Types**
- **Draft**: Can be edited and modified
- **Submitted**: Finalized and ready for export
- **Exported**: Has been downloaded as Excel

#### **Status Changes**
- **Draft → Submitted**: Final submission
- **Submitted → Exported**: Excel download
- **No reverse**: Cannot change submitted forms

---

## **7. EXPORT AND PRINTING**

### **7.1 Exporting to Excel**

#### **Export Process**
1. **Find** your submitted form in the list
2. **Click** the download icon
3. **Wait** for processing (up to 1 minute)
4. **File downloads** automatically
5. **Open** the Excel file

#### **Export Features**
- **Professional formatting** matches DCC template
- **All data** included in correct cells
- **Calculations** automatically performed
- **Traceability codes** included
- **Quality metrics** summarized

### **7.2 File Management**

#### **File Naming**
- **Format**: `inspection_form_YYMMDDMS_LL.xlsx`
- **Example**: `inspection_form_2508071A_01.xlsx`
- **Includes**: Traceability code and lot letter

#### **File Storage**
- **Save** to designated folder
- **Backup** important files
- **Organize** by date and shift
- **Maintain** digital records

### **7.3 Printing Process**

#### **Print Preparation**
1. **Open** the Excel file
2. **Review** all data is correct
3. **Check** page layout settings
4. **Verify** print quality

#### **Print Requirements**
- **Paper**: A4 size
- **Orientation**: Portrait
- **Quality**: Standard or higher
- **Copies**: As required by procedure

#### **Print Verification**
- **Check** all data is visible
- **Verify** calculations are correct
- **Ensure** professional appearance
- **Confirm** matches DCC template

### **7.4 Filing and Documentation**

#### **Physical Filing**
- **Print** completed forms
- **File** in designated location
- **Organize** by date and shift
- **Maintain** filing system

#### **Digital Backup**
- **Keep** Excel files as backup
- **Store** in secure location
- **Maintain** file organization
- **Follow** data retention policy

---

## **8. TROUBLESHOOTING GUIDE**

### **8.1 Common Issues and Solutions**

#### **System Access Issues**

**Problem**: Cannot log in
**Solution**:
1. Check internet connection
2. Verify username and password
3. Clear browser cache
4. Try different browser

**Problem**: Page loads slowly
**Solution**:
1. Check internet speed
2. Close other browser tabs
3. Refresh the page
4. Wait for loading to complete

#### **Data Entry Issues**

**Problem**: Cannot enter data
**Solution**:
1. Check if form is in "Submitted" status
2. Verify you have edit permissions
3. Refresh the page
4. Contact supervisor if needed

**Problem**: Data not saving
**Solution**:
1. Check internet connection
2. Verify all required fields are filled
3. Try refreshing the page
4. Save again

**Problem**: Wrong field formats
**Solution**:
1. Use correct format (XX.XX for weights)
2. Remove leading zeros
3. Check numeric ranges
4. Use decimal points correctly

#### **Quality Control Issues**

**Problem**: Cannot select Accept/Reject status
**Solution**:
1. Ensure only one status per roll
2. Check if form is editable
3. Verify dropdown is working
4. Try clicking different areas

**Problem**: Defect name not required
**Solution**:
1. Check if status is Reject/Rework/KIV
2. Enter defect name in correct field
3. Verify autocomplete is working
4. Type defect name manually

**Problem**: Color coding not working
**Solution**:
1. Refresh the page
2. Check browser compatibility
3. Verify JavaScript is enabled
4. Try different browser

#### **Export Issues**

**Problem**: Export fails
**Solution**:
1. Wait for processing to complete
2. Check file download settings
3. Try refreshing the page
4. Contact IT support if needed

**Problem**: Excel file corrupted
**Solution**:
1. Try downloading again
2. Check file size
3. Verify download completed
4. Use different browser

### **8.2 Error Messages and Meanings**

| Error Message | Meaning | Action |
|---------------|---------|--------|
| "Error saving form" | Network or server issue | Check connection and try again |
| "Invalid data" | Field format incorrect | Check input format and ranges |
| "Export failed" | Server processing issue | Wait and try again |
| "Form not found" | Form may be deleted | Check form list |
| "Permission denied" | Access rights issue | Contact supervisor |

### **8.3 Getting Help**

#### **When to Contact Support**
- **System down** for more than 5 minutes
- **Data loss** or corruption
- **Cannot access** forms
- **Export failures** after multiple attempts
- **Security concerns**

#### **Information to Provide**
- **Error message** (exact text)
- **Steps taken** before error
- **Browser** and version
- **Time** of occurrence
- **Form details** (if applicable)

---

## **9. BEST PRACTICES**

### **9.1 Data Entry Best Practices**

#### **Accuracy First**
- **Double-check** all measurements
- **Verify** status selections
- **Review** defect names
- **Confirm** calculations

#### **Efficiency Tips**
- **Use** "Fill O" for standard quality
- **Use** lock features for fast entry
- **Save** frequently during entry
- **Review** data before submission

#### **Quality Control**
- **Inspect** each roll thoroughly
- **Document** all defects clearly
- **Use** consistent terminology
- **Add** helpful remarks

### **9.2 Time Management**

#### **Shift Planning**
- **Start** data entry early in shift
- **Update** throughout production
- **Review** before shift end
- **Submit** before leaving

#### **Efficient Workflow**
- **Prepare** forms before production
- **Enter** data as rolls are inspected
- **Use** quality tools appropriately
- **Complete** forms promptly

### **9.3 Communication**

#### **Team Coordination**
- **Inform** supervisors of quality issues
- **Share** defect trends with team
- **Report** system problems immediately
- **Coordinate** with QC inspectors

#### **Documentation**
- **Record** all quality observations
- **Note** unusual conditions
- **Document** process changes
- **Maintain** clear remarks

### **9.4 Compliance**

#### **Quality Standards**
- **Follow** established procedures
- **Maintain** ISO 9001:2015 compliance
- **Ensure** traceability for all rolls
- **Document** quality decisions

#### **Data Integrity**
- **Enter** accurate measurements
- **Use** correct status codes
- **Maintain** complete records
- **Preserve** audit trail

---

## **10. QUICK REFERENCE**

### **10.1 Keyboard Shortcuts**

| Action | Shortcut | Description |
|--------|----------|-------------|
| **Tab** | Tab key | Move to next field |
| **Save** | Ctrl+S | Save current form |
| **Refresh** | F5 | Refresh page |
| **Print** | Ctrl+P | Print current page |

### **10.2 Field Formats**

| Field | Format | Example |
|-------|--------|---------|
| **Roll Weight** | XX.XX | 25.50 |
| **Roll Width** | XXX | 250 |
| **Film Weight** | XX.X | 25.5 |
| **Thickness** | XX | 25 |
| **Roll θ** | XXX | 250 |
| **Paper Core ID** | XXX.X | 25.5 |
| **Paper Core OD** | XXX | 250 |

### **10.3 Status Codes**

| Status | Use When | Action Required |
|--------|----------|----------------|
| **Accept** | Roll meets standards | None |
| **Reject** | Roll fails standards | Enter defect name |
| **Rework** | Roll needs reprocessing | Enter defect name |
| **KIV** | Keep in View | Enter defect name |

### **10.4 Quality Tools**

| Tool | Purpose | When to Use |
|------|---------|-------------|
| **Fill O** | Auto-fill OK values | Standard quality |
| **Clear O** | Remove OK values | Re-inspection needed |
| **Weight Lock** | Fast weight entry | Multiple weights |
| **θ Lock** | Fast diameter entry | Multiple diameters |

### **10.5 Contact Information**

| Issue Type | Contact | Method |
|------------|---------|--------|
| **System Problems** | IT Support | Phone/Email |
| **Quality Issues** | QC Supervisor | In-person |
| **Process Questions** | Line Supervisor | In-person |
| **Training Needs** | Training Coordinator | Email |

---

## **📚 TRAINING COMPLETION**

### **✅ Training Checklist**
- [ ] **Read** all sections of this WI
- [ ] **Understood** system overview and benefits
- [ ] **Practiced** form creation process
- [ ] **Learned** data entry procedures
- [ ] **Mastered** quality control workflow
- [ ] **Understood** submission process
- [ ] **Practiced** export and printing
- [ ] **Reviewed** troubleshooting guide
- [ ] **Understood** best practices
- [ ] **Familiarized** with quick reference

### **🎯 Training Objectives Met**
- ✅ **Operate** the Inline Inspection Form system independently
- ✅ **Enter** accurate quality data
- ✅ **Use** quality control tools effectively
- ✅ **Submit** forms correctly
- ✅ **Export** and print reports
- ✅ **Troubleshoot** common issues
- ✅ **Follow** best practices
- ✅ **Maintain** compliance standards

### **📋 Next Steps**
1. **Complete** hands-on training session
2. **Practice** with sample data
3. **Demonstrate** proficiency to supervisor
4. **Begin** independent operation
5. **Report** any issues immediately

---

**🎉 Congratulations! You are now trained to use the Inline Inspection Form System effectively and efficiently.**

**📞 Remember: When in doubt, ask your supervisor or refer to this Work Instruction.**

---

**📄 This Work Instruction is a living document. Updates will be provided as the system evolves.**

**📅 Training Date: ___________**
**👤 Trainee Name: ___________**
**✅ Supervisor Approval: ___________**
