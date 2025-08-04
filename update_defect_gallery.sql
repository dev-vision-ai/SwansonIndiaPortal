-- SQL to update defect gallery table with new defect list
-- First, remove all existing defects
DELETE FROM all_defects;

-- Reset the sequence (if using auto-increment)
-- ALTER SEQUENCE all_defects_id_seq RESTART WITH 1;

-- Insert the new defect list
INSERT INTO all_defects (defect_name, is_active) VALUES
('Die Line', true),
('Tiger Strips', true),
('Zebra Line', true),
('Fold Line', true),
('Glossy', true),
('Colour Variation', true),
('Low Opacity', true),
('High Opacity', true),
('Pin Hole', true),
('Fish Eye', true),
('Dot Mark', true),
('Patch Mark', true),
('Shining Mark', true),
('Odd Smell', true),
('CT OSS', true),
('Print Artwork OOS', true),
('Print Colour OOS', true),
('Mis Print', true),
('Dirty Print', true),
('Tape Test Failure', true),
('Centralisation OOS', true),
('Soft Wrinkle', true),
('Hard Wrinkle', true),
('PRS', true),
('Concave/Convex', true),
('Edge Curve', true),
('Core Misallighment', true),
('Over Weight', true),
('Under Weight', true),
('High Cut Width', true),
('Low Cut Width', true),
('High Roll Dia', true),
('Low Roll Dia', true),
('Soft Roll', true),
('Insect', true),
('Loose Winding', true),
('QA/QC Check', true),
('Oil Drop', true),
('Low Thickness', true),
('High Thickness', true),
('High GSM', true),
('Thick spot', true),
('Poor Slitting', true),
('Surging', true),
('Cut/Tear', true),
('Roll Dirty', true),
('Mold /Moisture', true),
('Starring', true),
('Roll Damage', true),
('Corrugation', true),
('Roll Surface OOS', true),
('Core Damage', true),
('Overlapping', true),
('Low GSM', true),
('Thin Spot', true),
('Short Length', true),
('Stepping', true),
('Slitter Dust', true),
('WDD/PDD Issue', true),
('Roll Diameter Variation', true),
('Roll Roundness', true),
('Print Position OOS', true);

-- Verify the insertion
SELECT COUNT(*) as total_defects FROM all_defects WHERE is_active = true;

-- Show all inserted defects
SELECT defect_name FROM all_defects WHERE is_active = true ORDER BY defect_name; 