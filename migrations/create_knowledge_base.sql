-- Knowledge Base Migration

-- Knowledge Base Categories (Themes/Sub-themes)
CREATE TABLE IF NOT EXISTS kb_categories (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES kb_categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50), -- Lucide icon name
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for club filtering
CREATE INDEX IF NOT EXISTS idx_kb_categories_club ON kb_categories(club_id);
-- Index for hierarchical structure
CREATE INDEX IF NOT EXISTS idx_kb_categories_parent ON kb_categories(parent_id);

-- Knowledge Base Articles
CREATE TABLE IF NOT EXISTS kb_articles (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES kb_categories(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL, -- HTML content from rich text editor
    "order" INTEGER DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for club and category filtering
CREATE INDEX IF NOT EXISTS idx_kb_articles_club ON kb_articles(club_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON kb_articles(category_id);

-- Add permission for managing knowledge base
-- Since we don't have a central permission list table, we just insert into role_permissions for existing roles
-- But for now, owners and admins have full access by default in the API logic.
