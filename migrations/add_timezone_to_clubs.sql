-- Add timezone field to clubs
ALTER TABLE clubs 
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Europe/Moscow';
