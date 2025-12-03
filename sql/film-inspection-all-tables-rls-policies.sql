-- =====================================================
-- RLS (Row Level Security) Policies for All Film Inspection Form Tables
-- =====================================================
-- Restricts access to Quality Control (QC) and Quality Assurance (QA) department users only
-- This ensures only authorized QC/QA personnel can CREATE, READ, UPDATE, and DELETE records
-- Applied to all P&G and UC film inspection form tables

-- =====================================================
-- P&G FILM INSPECTION FORM TABLES
-- =====================================================

-- ========== Table: 168_16cp_kranti ==========
ALTER TABLE "168_16cp_kranti" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "QC/QA users can view 168_16cp_kranti records" ON "168_16cp_kranti";
DROP POLICY IF EXISTS "QC/QA users can insert 168_16cp_kranti records" ON "168_16cp_kranti";
DROP POLICY IF EXISTS "QC/QA users can update 168_16cp_kranti records" ON "168_16cp_kranti";
DROP POLICY IF EXISTS "QC/QA users can delete 168_16cp_kranti records" ON "168_16cp_kranti";

CREATE POLICY "QC/QA users can view 168_16cp_kranti records" ON "168_16cp_kranti"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can insert 168_16cp_kranti records" ON "168_16cp_kranti"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can update 168_16cp_kranti records" ON "168_16cp_kranti"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can delete 168_16cp_kranti records" ON "168_16cp_kranti"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

-- ========== Table: 168_16c_white ==========
ALTER TABLE "168_16c_white" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "QC/QA users can view 168_16c_white records" ON "168_16c_white";
DROP POLICY IF EXISTS "QC/QA users can insert 168_16c_white records" ON "168_16c_white";
DROP POLICY IF EXISTS "QC/QA users can update 168_16c_white records" ON "168_16c_white";
DROP POLICY IF EXISTS "QC/QA users can delete 168_16c_white records" ON "168_16c_white";

CREATE POLICY "QC/QA users can view 168_16c_white records" ON "168_16c_white"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can insert 168_16c_white records" ON "168_16c_white"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can update 168_16c_white records" ON "168_16c_white"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can delete 168_16c_white records" ON "168_16c_white"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

-- ========== Table: 168_18c_white_jeddah ==========
ALTER TABLE "168_18c_white_jeddah" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "QC/QA users can view 168_18c_white_jeddah records" ON "168_18c_white_jeddah";
DROP POLICY IF EXISTS "QC/QA users can insert 168_18c_white_jeddah records" ON "168_18c_white_jeddah";
DROP POLICY IF EXISTS "QC/QA users can update 168_18c_white_jeddah records" ON "168_18c_white_jeddah";
DROP POLICY IF EXISTS "QC/QA users can delete 168_18c_white_jeddah records" ON "168_18c_white_jeddah";

CREATE POLICY "QC/QA users can view 168_18c_white_jeddah records" ON "168_18c_white_jeddah"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can insert 168_18c_white_jeddah records" ON "168_18c_white_jeddah"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can update 168_18c_white_jeddah records" ON "168_18c_white_jeddah"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can delete 168_18c_white_jeddah records" ON "168_18c_white_jeddah"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

-- ========== Table: 168_18c_white ==========
ALTER TABLE "168_18c_white" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "QC/QA users can view 168_18c_white records" ON "168_18c_white";
DROP POLICY IF EXISTS "QC/QA users can insert 168_18c_white records" ON "168_18c_white";
DROP POLICY IF EXISTS "QC/QA users can update 168_18c_white records" ON "168_18c_white";
DROP POLICY IF EXISTS "QC/QA users can delete 168_18c_white records" ON "168_18c_white";

CREATE POLICY "QC/QA users can view 168_18c_white records" ON "168_18c_white"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can insert 168_18c_white records" ON "168_18c_white"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can update 168_18c_white records" ON "168_18c_white"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can delete 168_18c_white records" ON "168_18c_white"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

-- ========== Table: 176_18cp_ww ==========
ALTER TABLE "176_18cp_ww" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "QC/QA users can view 176_18cp_ww records" ON "176_18cp_ww";
DROP POLICY IF EXISTS "QC/QA users can insert 176_18cp_ww records" ON "176_18cp_ww";
DROP POLICY IF EXISTS "QC/QA users can update 176_18cp_ww records" ON "176_18cp_ww";
DROP POLICY IF EXISTS "QC/QA users can delete 176_18cp_ww records" ON "176_18cp_ww";

CREATE POLICY "QC/QA users can view 176_18cp_ww records" ON "176_18cp_ww"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can insert 176_18cp_ww records" ON "176_18cp_ww"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can update 176_18cp_ww records" ON "176_18cp_ww"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can delete 176_18cp_ww records" ON "176_18cp_ww"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

-- ========== Table: 234_18_micro_white ==========
ALTER TABLE "234_18_micro_white" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "QC/QA users can view 234_18_micro_white records" ON "234_18_micro_white";
DROP POLICY IF EXISTS "QC/QA users can insert 234_18_micro_white records" ON "234_18_micro_white";
DROP POLICY IF EXISTS "QC/QA users can update 234_18_micro_white records" ON "234_18_micro_white";
DROP POLICY IF EXISTS "QC/QA users can delete 234_18_micro_white records" ON "234_18_micro_white";

CREATE POLICY "QC/QA users can view 234_18_micro_white records" ON "234_18_micro_white"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can insert 234_18_micro_white records" ON "234_18_micro_white"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can update 234_18_micro_white records" ON "234_18_micro_white"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can delete 234_18_micro_white records" ON "234_18_micro_white"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

-- ========== Table: 214_18_micro_white ==========
ALTER TABLE "214_18_micro_white" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "QC/QA users can view 214_18_micro_white records" ON "214_18_micro_white";
DROP POLICY IF EXISTS "QC/QA users can insert 214_18_micro_white records" ON "214_18_micro_white";
DROP POLICY IF EXISTS "QC/QA users can update 214_18_micro_white records" ON "214_18_micro_white";
DROP POLICY IF EXISTS "QC/QA users can delete 214_18_micro_white records" ON "214_18_micro_white";

CREATE POLICY "QC/QA users can view 214_18_micro_white records" ON "214_18_micro_white"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can insert 214_18_micro_white records" ON "214_18_micro_white"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can update 214_18_micro_white records" ON "214_18_micro_white"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can delete 214_18_micro_white records" ON "214_18_micro_white"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

-- ========== Table: 102_18c_micro_white ==========
ALTER TABLE "102_18c_micro_white" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "QC/QA users can view 102_18c_micro_white records" ON "102_18c_micro_white";
DROP POLICY IF EXISTS "QC/QA users can insert 102_18c_micro_white records" ON "102_18c_micro_white";
DROP POLICY IF EXISTS "QC/QA users can update 102_18c_micro_white records" ON "102_18c_micro_white";
DROP POLICY IF EXISTS "QC/QA users can delete 102_18c_micro_white records" ON "102_18c_micro_white";

CREATE POLICY "QC/QA users can view 102_18c_micro_white records" ON "102_18c_micro_white"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can insert 102_18c_micro_white records" ON "102_18c_micro_white"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can update 102_18c_micro_white records" ON "102_18c_micro_white"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can delete 102_18c_micro_white records" ON "102_18c_micro_white"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

-- =====================================================
-- UC FILM INSPECTION FORM TABLES
-- =====================================================

-- ========== Table: uc-18gsm-250p-abqr ==========
ALTER TABLE "uc-18gsm-250p-abqr" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "QC/QA users can view uc-18gsm-250p-abqr records" ON "uc-18gsm-250p-abqr";
DROP POLICY IF EXISTS "QC/QA users can insert uc-18gsm-250p-abqr records" ON "uc-18gsm-250p-abqr";
DROP POLICY IF EXISTS "QC/QA users can update uc-18gsm-250p-abqr records" ON "uc-18gsm-250p-abqr";
DROP POLICY IF EXISTS "QC/QA users can delete uc-18gsm-250p-abqr records" ON "uc-18gsm-250p-abqr";

CREATE POLICY "QC/QA users can view uc-18gsm-250p-abqr records" ON "uc-18gsm-250p-abqr"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can insert uc-18gsm-250p-abqr records" ON "uc-18gsm-250p-abqr"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can update uc-18gsm-250p-abqr records" ON "uc-18gsm-250p-abqr"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can delete uc-18gsm-250p-abqr records" ON "uc-18gsm-250p-abqr"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

-- ========== Table: uc-18gsm-290p-abqr ==========
ALTER TABLE "uc-18gsm-290p-abqr" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "QC/QA users can view uc-18gsm-290p-abqr records" ON "uc-18gsm-290p-abqr";
DROP POLICY IF EXISTS "QC/QA users can insert uc-18gsm-290p-abqr records" ON "uc-18gsm-290p-abqr";
DROP POLICY IF EXISTS "QC/QA users can update uc-18gsm-290p-abqr records" ON "uc-18gsm-290p-abqr";
DROP POLICY IF EXISTS "QC/QA users can delete uc-18gsm-290p-abqr records" ON "uc-18gsm-290p-abqr";

CREATE POLICY "QC/QA users can view uc-18gsm-290p-abqr records" ON "uc-18gsm-290p-abqr"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can insert uc-18gsm-290p-abqr records" ON "uc-18gsm-290p-abqr"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can update uc-18gsm-290p-abqr records" ON "uc-18gsm-290p-abqr"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can delete uc-18gsm-290p-abqr records" ON "uc-18gsm-290p-abqr"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

-- ========== Table: uc-18gsm-290np-abqr ==========
ALTER TABLE "uc-18gsm-290np-abqr" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "QC/QA users can view uc-18gsm-290np-abqr records" ON "uc-18gsm-290np-abqr";
DROP POLICY IF EXISTS "QC/QA users can insert uc-18gsm-290np-abqr records" ON "uc-18gsm-290np-abqr";
DROP POLICY IF EXISTS "QC/QA users can update uc-18gsm-290np-abqr records" ON "uc-18gsm-290np-abqr";
DROP POLICY IF EXISTS "QC/QA users can delete uc-18gsm-290np-abqr records" ON "uc-18gsm-290np-abqr";

CREATE POLICY "QC/QA users can view uc-18gsm-290np-abqr records" ON "uc-18gsm-290np-abqr"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can insert uc-18gsm-290np-abqr records" ON "uc-18gsm-290np-abqr"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can update uc-18gsm-290np-abqr records" ON "uc-18gsm-290np-abqr"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can delete uc-18gsm-290np-abqr records" ON "uc-18gsm-290np-abqr"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

-- ========== Table: uc-18gsm-250w-bfqr ==========
ALTER TABLE "uc-18gsm-250w-bfqr" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "QC/QA users can view uc-18gsm-250w-bfqr records" ON "uc-18gsm-250w-bfqr";
DROP POLICY IF EXISTS "QC/QA users can insert uc-18gsm-250w-bfqr records" ON "uc-18gsm-250w-bfqr";
DROP POLICY IF EXISTS "QC/QA users can update uc-18gsm-250w-bfqr records" ON "uc-18gsm-250w-bfqr";
DROP POLICY IF EXISTS "QC/QA users can delete uc-18gsm-250w-bfqr records" ON "uc-18gsm-250w-bfqr";

CREATE POLICY "QC/QA users can view uc-18gsm-250w-bfqr records" ON "uc-18gsm-250w-bfqr"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can insert uc-18gsm-250w-bfqr records" ON "uc-18gsm-250w-bfqr"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can update uc-18gsm-250w-bfqr records" ON "uc-18gsm-250w-bfqr"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can delete uc-18gsm-250w-bfqr records" ON "uc-18gsm-250w-bfqr"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

-- ========== Table: uc-18gsm-210w-bfqr ==========
ALTER TABLE "uc-18gsm-210w-bfqr" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "QC/QA users can view uc-18gsm-210w-bfqr records" ON "uc-18gsm-210w-bfqr";
DROP POLICY IF EXISTS "QC/QA users can insert uc-18gsm-210w-bfqr records" ON "uc-18gsm-210w-bfqr";
DROP POLICY IF EXISTS "QC/QA users can update uc-18gsm-210w-bfqr records" ON "uc-18gsm-210w-bfqr";
DROP POLICY IF EXISTS "QC/QA users can delete uc-18gsm-210w-bfqr records" ON "uc-18gsm-210w-bfqr";

CREATE POLICY "QC/QA users can view uc-18gsm-210w-bfqr records" ON "uc-18gsm-210w-bfqr"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can insert uc-18gsm-210w-bfqr records" ON "uc-18gsm-210w-bfqr"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can update uc-18gsm-210w-bfqr records" ON "uc-18gsm-210w-bfqr"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can delete uc-18gsm-210w-bfqr records" ON "uc-18gsm-210w-bfqr"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

-- ========== Table: uc-16gsm-165w ==========
ALTER TABLE "uc-16gsm-165w" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "QC/QA users can view uc-16gsm-165w records" ON "uc-16gsm-165w";
DROP POLICY IF EXISTS "QC/QA users can insert uc-16gsm-165w records" ON "uc-16gsm-165w";
DROP POLICY IF EXISTS "QC/QA users can update uc-16gsm-165w records" ON "uc-16gsm-165w";
DROP POLICY IF EXISTS "QC/QA users can delete uc-16gsm-165w records" ON "uc-16gsm-165w";

CREATE POLICY "QC/QA users can view uc-16gsm-165w records" ON "uc-16gsm-165w"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can insert uc-16gsm-165w records" ON "uc-16gsm-165w"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can update uc-16gsm-165w records" ON "uc-16gsm-165w"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

CREATE POLICY "QC/QA users can delete uc-16gsm-165w records" ON "uc-16gsm-165w"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (users.department = 'Quality Control' OR users.department = 'Quality Assurance')
        )
    );

-- =====================================================
-- SUMMARY OF TABLES PROTECTED
-- =====================================================
-- P&G TABLES (7):
--   1. 168_16cp_kranti
--   2. 168_16c_white
--   3. 168_18c_white_jeddah
--   4. 168_18c_white
--   5. 176_18cp_ww
--   6. 234_18_micro_white
--   7. 214_18_micro_white
--   8. 102_18c_micro_white
--
-- UC TABLES (6):
--   1. uc-18gsm-250p-abqr
--   2. uc-18gsm-290p-abqr
--   3. uc-18gsm-290np-abqr
--   4. uc-18gsm-250w-bfqr
--   5. uc-18gsm-210w-bfqr
--   6. uc-16gsm-165w
--
-- TOTAL: 14 Film Inspection Form Tables Protected
-- ACCESS RESTRICTED TO: Quality Control & Quality Assurance Department Users Only
-- =====================================================