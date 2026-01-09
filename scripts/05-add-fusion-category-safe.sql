-- 数据库迁移脚本：添加融合图片分类（安全版本）
-- 执行日期：2025-01-08
-- 说明：为materials表的category_type添加融合图片分类，使用固定的项目列表
-- 修复：允许现有数据的subcategory为NULL

-- 1. 修改category_type枚举，添加'fusion'类型
ALTER TABLE materials 
DROP CONSTRAINT IF EXISTS materials_category_type_check;

ALTER TABLE materials 
ADD CONSTRAINT materials_category_type_check 
CHECK (category_type IN ('character', 'scene', 'fusion'));

-- 2. 修改subcategory约束，添加融合图片的固定项目列表
-- 重要：允许subcategory为NULL，以兼容现有数据
ALTER TABLE materials 
DROP CONSTRAINT IF EXISTS materials_subcategory_check;

ALTER TABLE materials 
ADD CONSTRAINT materials_subcategory_check 
CHECK (
  -- 允许subcategory为NULL（兼容现有数据）
  subcategory IS NULL
  OR
  -- 角色类可以使用指定的subcategory
  (category_type = 'character' AND subcategory IN ('ancient-male', 'ancient-female', 'modern-male', 'modern-female', 'fantasy'))
  OR
  -- 场景类可以使用指定的subcategory
  (category_type = 'scene' AND subcategory IN ('ancient-residence', 'ancient-location', 'modern-residence', 'modern-location', 'nature'))
  OR
  -- 融合图片类使用固定的项目列表
  (category_type = 'fusion' AND subcategory IN ('project-1', 'project-2', 'project-3', 'project-4', 'project-5'))
);

-- 3. 添加注释
COMMENT ON CONSTRAINT materials_category_type_check ON materials IS '素材大分类：character(角色), scene(场景), fusion(融合图片)';
COMMENT ON CONSTRAINT materials_subcategory_check ON materials IS '素材细分类：角色和场景使用固定枚举值，融合图片使用项目编号（project-1 到 project-5），允许为NULL';

-- 4. 验证迁移
SELECT 
  constraint_name, 
  check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name IN ('materials_category_type_check', 'materials_subcategory_check');

-- 5. 查看当前分类统计
SELECT 
  category_type,
  subcategory,
  COUNT(*) as count
FROM materials
GROUP BY category_type, subcategory
ORDER BY category_type, subcategory;

-- 6. 检查NULL值的记录
SELECT 
  category_type,
  COUNT(*) as null_count
FROM materials
WHERE subcategory IS NULL
GROUP BY category_type;

-- 7. 使用说明
-- 融合图片素材的插入示例：
-- INSERT INTO materials (title, category_type, subcategory, image_url, tags, chinese_prompt, english_prompt)
-- VALUES ('融合图片1', 'fusion', 'project-1', 'https://...', ARRAY['融合', 'AI生成'], '中文提示词', 'English prompt');
-- 
-- INSERT INTO materials (title, category_type, subcategory, image_url, tags, chinese_prompt, english_prompt)
-- VALUES ('融合图片2', 'fusion', 'project-2', 'https://...', ARRAY['融合', 'AI生成'], '中文提示词', 'English prompt');
-- 
-- 注意：
-- 1. fusion类型的素材只能使用 project-1 到 project-5 这5个固定项目
-- 2. 现有的character和scene类型的素材可以保持subcategory为NULL
-- 3. 新插入的素材建议都设置subcategory值

-- 8. （可选）更新现有NULL值的记录
-- 如果需要为现有的NULL记录设置默认值，可以执行以下语句：
-- 
-- UPDATE materials 
-- SET subcategory = 'ancient-male' 
-- WHERE category_type = 'character' AND subcategory IS NULL AND tags @> ARRAY['古代男'];
-- 
-- UPDATE materials 
-- SET subcategory = 'modern-male' 
-- WHERE category_type = 'character' AND subcategory IS NULL AND tags @> ARRAY['现代男'];
-- 
-- 等等...（根据实际情况调整）

