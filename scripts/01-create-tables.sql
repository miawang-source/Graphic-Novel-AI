-- 简化分类，直接在materials表中使用枚举
CREATE TABLE IF NOT EXISTS scripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS characters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  chinese_prompt TEXT,
  english_prompt TEXT,
  role_type VARCHAR(20) DEFAULT 'main' CHECK (role_type IN ('main', 'supporting')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scenes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  chinese_prompt TEXT,
  english_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 优化后的素材表
CREATE TABLE IF NOT EXISTS materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  category_type VARCHAR(20) NOT NULL CHECK (category_type IN ('character', 'scene')),
  subcategory VARCHAR(30) CHECK (subcategory IN (
    'ancient-male', 'ancient-female', 'modern-male', 'modern-female', 'fantasy',
    'ancient-residence', 'ancient-location', 'modern-residence', 'modern-location', 'nature'
  )), -- 细分类约束
  image_url TEXT NOT NULL,
  original_filename VARCHAR(200), -- 保留，无命名规范要求
  file_type VARCHAR(10), -- 保留，用于验证和显示
  tags TEXT[],
  chinese_prompt TEXT,
  english_prompt TEXT,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_materials_category_type ON materials(category_type);
CREATE INDEX IF NOT EXISTS idx_materials_subcategory ON materials(subcategory);
CREATE INDEX IF NOT EXISTS idx_materials_tags ON materials USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_characters_script ON characters(script_id);
CREATE INDEX IF NOT EXISTS idx_scenes_script ON scenes(script_id);
