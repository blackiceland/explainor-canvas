CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE knowledge (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE beats (
    name TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    params JSONB NOT NULL DEFAULT '{}',
    example_yaml TEXT,
    category TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE layouts (
    name TEXT PRIMARY KEY,
    slots JSONB NOT NULL,
    description TEXT NOT NULL,
    example_yaml TEXT,
    embedding vector(1536),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE scenes (
    id TEXT PRIMARY KEY,
    project TEXT NOT NULL,
    layout TEXT REFERENCES layouts(name),
    theme TEXT NOT NULL DEFAULT 'dark',
    config JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    render_count INT DEFAULT 0,
    last_rendered TIMESTAMP
);

CREATE TABLE content (
    id SERIAL PRIMARY KEY,
    scene_id TEXT REFERENCES scenes(id) ON DELETE CASCADE,
    lang TEXT NOT NULL DEFAULT 'en',
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(scene_id, lang, key)
);

CREATE INDEX knowledge_embedding_idx ON knowledge 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX beats_embedding_idx ON beats 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

CREATE INDEX layouts_embedding_idx ON layouts 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);

CREATE INDEX knowledge_category_idx ON knowledge(category);
CREATE INDEX knowledge_tags_idx ON knowledge USING GIN(tags);
CREATE INDEX beats_category_idx ON beats(category);
CREATE INDEX scenes_project_idx ON scenes(project);
CREATE INDEX content_scene_lang_idx ON content(scene_id, lang);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_updated_at
    BEFORE UPDATE ON knowledge
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER scenes_updated_at
    BEFORE UPDATE ON scenes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

