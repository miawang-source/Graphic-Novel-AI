-- Enable RLS on all tables
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a demo app)
-- In production, you would want more restrictive policies

-- Scripts policies
CREATE POLICY "Allow public read access on scripts" ON scripts
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert on scripts" ON scripts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on scripts" ON scripts
    FOR UPDATE USING (true);

-- Characters policies
CREATE POLICY "Allow public read access on characters" ON characters
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert on characters" ON characters
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on characters" ON characters
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete on characters" ON characters
    FOR DELETE USING (true);

-- Scenes policies
CREATE POLICY "Allow public read access on scenes" ON scenes
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert on scenes" ON scenes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on scenes" ON scenes
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete on scenes" ON scenes
    FOR DELETE USING (true);

-- Materials policies
CREATE POLICY "Allow public read access on materials" ON materials
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert on materials" ON materials
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on materials" ON materials
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete on materials" ON materials
    FOR DELETE USING (true);
