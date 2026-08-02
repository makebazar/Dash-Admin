-- Add vk_link and preferred_contact to crm_contacts

ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS vk_link TEXT;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS preferred_contact VARCHAR(30);
