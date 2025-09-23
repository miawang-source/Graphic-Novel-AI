-- Add DELETE policies for all tables
-- This script adds the missing DELETE permissions to the RLS policies

-- Scripts DELETE policy
CREATE POLICY "Allow public delete on scripts" ON scripts
    FOR DELETE USING (true);

-- Characters DELETE policy  
CREATE POLICY "Allow public delete on characters" ON characters
    FOR DELETE USING (true);

-- Scenes DELETE policy
CREATE POLICY "Allow public delete on scenes" ON scenes
    FOR DELETE USING (true);

-- Materials DELETE policy
CREATE POLICY "Allow public delete on materials" ON materials
    FOR DELETE USING (true);

-- Verify policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('scripts', 'characters', 'scenes', 'materials')
ORDER BY tablename, policyname;
