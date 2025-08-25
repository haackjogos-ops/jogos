-- Add skill level column to volleyball_queue table
ALTER TABLE public.volleyball_queue 
ADD COLUMN skill_level text CHECK (skill_level IN ('iniciante', 'intermediario', 'avancado')) DEFAULT 'iniciante';

-- Update existing records to have a default skill level
UPDATE public.volleyball_queue 
SET skill_level = 'iniciante' 
WHERE skill_level IS NULL;