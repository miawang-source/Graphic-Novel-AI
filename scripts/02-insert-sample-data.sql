-- 移除categories表插入，改为使用新的表结构
-- 插入示例剧本
INSERT INTO scripts (title, content) VALUES
('仙剑奇侠传', '李逍遥是一个客栈小二，偶然遇到了赵灵儿，从此踏上了仙侠之路。故事充满了爱情、友情和冒险。'),
('现代都市爱情', '陈浩是一名程序员，在咖啡厅遇到了设计师林小雨，两人从陌生到相知相爱的都市爱情故事。'),
('武侠江湖', '大侠风清扬行走江湖，路见不平拔刀相助，与各路英雄豪杰结下深厚友谊。');

-- 插入示例角色
WITH script_ids AS (
  SELECT id, title FROM scripts WHERE title IN ('仙剑奇侠传', '现代都市爱情', '武侠江湖')
)
INSERT INTO characters (script_id, name, description, chinese_prompt, english_prompt, role_type)
SELECT 
  s.id,
  c.name,
  c.description,
  c.chinese_prompt,
  c.english_prompt,
  c.role_type
FROM script_ids s
CROSS JOIN (
  VALUES 
    ('李逍遥', '客栈小二，性格开朗活泼，后成为仙剑奇侠', '古装少年，黑发，白色衣服，英俊潇洒，手持仙剑', 'Ancient Chinese young man, black hair, white clothing, handsome, holding fairy sword', 'main'),
    ('赵灵儿', '女娲后人，温柔善良，拥有强大的法力', '古装美女，长发飘逸，蓝色仙裙，仙气飘飘，美丽动人', 'Ancient Chinese beauty, long flowing hair, blue fairy dress, ethereal appearance, beautiful', 'main'),
    ('林月如', '武林世家千金，性格刁蛮任性但内心善良', '古装少女，马尾辫，红色武服，英姿飒爽', 'Ancient Chinese girl, ponytail, red martial arts outfit, heroic appearance', 'supporting')
) AS c(name, description, chinese_prompt, english_prompt, role_type)
WHERE s.title = '仙剑奇侠传'

UNION ALL

SELECT 
  s.id,
  c.name,
  c.description,
  c.chinese_prompt,
  c.english_prompt,
  c.role_type
FROM script_ids s
CROSS JOIN (
  VALUES 
    ('陈浩', '程序员，内向但善良，对技术充满热情', '现代男性，短发，休闲装，戴眼镜，温文尔雅', 'Modern man, short hair, casual wear, glasses, gentle appearance', 'main'),
    ('林小雨', 'UI设计师，活泼开朗，富有创意', '现代女性，长发，时尚装扮，笑容甜美', 'Modern woman, long hair, fashionable outfit, sweet smile', 'main')
) AS c(name, description, chinese_prompt, english_prompt, role_type)
WHERE s.title = '现代都市爱情'

UNION ALL

SELECT 
  s.id,
  c.name,
  c.description,
  c.chinese_prompt,
  c.english_prompt,
  c.role_type
FROM script_ids s
CROSS JOIN (
  VALUES 
    ('风清扬', '武林高手，剑法超群，行侠仗义', '古装大侠，白发，黑色长袍，手持长剑，仙风道骨', 'Ancient Chinese martial artist, white hair, black robe, holding sword, sage-like appearance', 'main')
) AS c(name, description, chinese_prompt, english_prompt, role_type)
WHERE s.title = '武侠江湖';

-- 插入示例场景
WITH script_ids AS (
  SELECT id, title FROM scripts WHERE title IN ('仙剑奇侠传', '现代都市爱情', '武侠江湖')
)
INSERT INTO scenes (script_id, name, description, chinese_prompt, english_prompt)
SELECT 
  s.id,
  sc.name,
  sc.description,
  sc.chinese_prompt,
  sc.english_prompt
FROM script_ids s
CROSS JOIN (
  VALUES 
    ('余杭镇客栈', '李逍遥工作的客栈，古色古香的建筑', '中国古代客栈，木质结构，红灯笼，古朴装饰，热闹氛围', 'Ancient Chinese inn, wooden structure, red lanterns, traditional decoration, lively atmosphere'),
    ('仙灵岛', '赵灵儿的家乡，仙境般的神秘岛屿', '仙境岛屿，云雾缭绕，仙鹤飞舞，桃花盛开，仙气飘飘', 'Mystical island, surrounded by clouds, flying cranes, blooming peach blossoms, ethereal atmosphere'),
    ('锁妖塔', '关押妖怪的古塔，充满危险和神秘', '古代高塔，石质结构，符文密布，阴森恐怖，妖气弥漫', 'Ancient tower, stone structure, covered with runes, eerie and terrifying, demonic aura')
) AS sc(name, description, chinese_prompt, english_prompt)
WHERE s.title = '仙剑奇侠传'

UNION ALL

SELECT 
  s.id,
  sc.name,
  sc.description,
  sc.chinese_prompt,
  sc.english_prompt
FROM script_ids s
CROSS JOIN (
  VALUES 
    ('星巴克咖啡厅', '陈浩和林小雨初次相遇的地方', '现代咖啡厅，温馨装修，木质桌椅，咖啡香气，浪漫氛围', 'Modern coffee shop, cozy decoration, wooden tables and chairs, coffee aroma, romantic atmosphere'),
    ('科技公司办公室', '陈浩工作的互联网公司', '现代办公室，开放式设计，电脑设备，简约风格，忙碌氛围', 'Modern office, open design, computer equipment, minimalist style, busy atmosphere')
) AS sc(name, description, chinese_prompt, english_prompt)
WHERE s.title = '现代都市爱情'

UNION ALL

SELECT 
  s.id,
  sc.name,
  sc.description,
  sc.chinese_prompt,
  sc.english_prompt
FROM script_ids s
CROSS JOIN (
  VALUES 
    ('华山论剑', '武林高手比武的圣地', '华山之巅，悬崖峭壁，云海翻腾，剑气纵横', 'Mount Hua peak, steep cliffs, rolling sea of clouds, sword energy flowing'),
    ('江南客栈', '江湖人士聚集的地方', '江南水乡客栈，小桥流水，古朴雅致，武林氛围', 'Jiangnan inn, small bridges and flowing water, ancient and elegant, martial arts atmosphere')
) AS sc(name, description, chinese_prompt, english_prompt)
WHERE s.title = '武侠江湖';

-- 插入素材数据，使用新的表结构
INSERT INTO materials (title, category_type, image_url, original_filename, file_type, tags, chinese_prompt, english_prompt, download_count) VALUES
-- 角色素材
('英勇大将军', 'character', '/placeholder.svg?height=300&width=200', 'general_001.jpg', 'jpg', ARRAY['古代男', '将军', '盔甲', '英勇'], '古代将军，身穿金色盔甲，手持长剑，威风凛凛', 'Ancient Chinese general, wearing golden armor, holding sword, majestic appearance', 156),
('白发美男', 'character', '/placeholder.svg?height=300&width=200', 'white_hair_man.png', 'png', ARRAY['古代男', '白发', '仙气', '美男'], '古装美男，白发飘逸，蓝色长袍，仙气飘飘', 'Ancient handsome man, flowing white hair, blue robe, ethereal appearance', 203),
('古装白衣', 'character', '/placeholder.svg?height=300&width=200', 'white_dress.jpg', 'jpg', ARRAY['古代女', '白衣', '仙女', '飘逸'], '古装仙女，白色长裙，长发飘逸，仙气十足', 'Ancient fairy, white long dress, flowing hair, ethereal beauty', 189),
('文雅书生', 'character', '/placeholder.svg?height=300&width=200', 'scholar_001.jpg', 'jpg', ARRAY['古代男', '书生', '文雅', '才子'], '古代书生，手持折扇，温文尔雅，才华横溢', 'Ancient scholar, holding fan, gentle and elegant, talented', 134),
('黑衣侠客', 'character', '/placeholder.svg?height=300&width=200', 'black_warrior.png', 'png', ARRAY['古代男', '侠客', '黑衣', '武功'], '黑衣侠客，蒙面黑衣，身手敏捷，神秘莫测', 'Black-clothed warrior, masked, agile, mysterious', 167),
('现代总裁', 'character', '/placeholder.svg?height=300&width=200', 'modern_ceo.jpg', 'jpg', ARRAY['现代男', '总裁', '西装', '成功'], '现代商务男性，黑色西装，成熟稳重，成功人士', 'Modern businessman, black suit, mature and stable, successful', 145),
('甜美少女', 'character', '/placeholder.svg?height=300&width=200', 'sweet_girl.png', 'png', ARRAY['现代女', '少女', '甜美', '可爱'], '现代少女，甜美可爱，时尚装扮，青春活力', 'Modern girl, sweet and cute, fashionable outfit, youthful energy', 198),
('蓝衣仙子', 'character', '/placeholder.svg?height=300&width=200', 'blue_fairy.jpg', 'jpg', ARRAY['架空', '仙子', '蓝衣', '法术'], '蓝衣仙子，法力高强，美丽动人，超凡脱俗', 'Blue fairy, powerful magic, beautiful, transcendent', 176),

-- 场景素材
('城楼之上', 'scene', '/placeholder.svg?height=200&width=300', 'city_tower.jpg', 'jpg', ARRAY['古代住宅', '城楼', '建筑', '宏伟'], '古代城楼，红墙黄瓦，气势宏伟，古典建筑', 'Ancient city tower, red walls and yellow tiles, magnificent, classical architecture', 89),
('古典庭院', 'scene', '/placeholder.svg?height=200&width=300', 'courtyard.png', 'png', ARRAY['古代住宅', '庭院', '园林', '雅致'], '古典庭院，小桥流水，亭台楼阁，雅致精美', 'Classical courtyard, bridges and water, pavilions, elegant and exquisite', 112),
('宅子大门', 'scene', '/placeholder.svg?height=200&width=300', 'mansion_gate.jpg', 'jpg', ARRAY['古代住宅', '大门', '府邸', '威严'], '古代府邸大门，朱红大门，门当户对，威严气派', 'Ancient mansion gate, vermillion door, imposing and dignified', 95),
('古代酒楼', 'scene', '/placeholder.svg?height=200&width=300', 'tavern.jpg', 'jpg', ARRAY['古代场所', '酒楼', '热闹', '江湖'], '古代酒楼，木质结构，热闹非凡，江湖气息', 'Ancient tavern, wooden structure, lively atmosphere, martial arts ambiance', 128),
('竹林小径', 'scene', '/placeholder.svg?height=200&width=300', 'bamboo_path.png', 'png', ARRAY['自然', '竹林', '小径', '清幽'], '竹林深处，石径蜿蜒，清幽静谧，鸟语花香', 'Deep bamboo forest, winding stone path, quiet and serene, birds singing', 156),
('现代公寓', 'scene', '/placeholder.svg?height=200&width=300', 'apartment.jpg', 'jpg', ARRAY['现代住宅', '公寓', '简约', '温馨'], '现代公寓客厅，简约装修，温馨舒适，现代生活', 'Modern apartment living room, minimalist decoration, cozy and comfortable', 143),
('咖啡厅', 'scene', '/placeholder.svg?height=200&width=300', 'coffee_shop.png', 'png', ARRAY['现代场所', '咖啡厅', '浪漫', '休闲'], '现代咖啡厅，温馨装修，浪漫氛围，休闲惬意', 'Modern coffee shop, cozy decoration, romantic atmosphere, leisurely', 167),
('夜景城市', 'scene', '/placeholder.svg?height=200&width=300', 'night_city.jpg', 'jpg', ARRAY['现代场所', '城市', '夜景', '繁华'], '现代都市夜景，霓虹闪烁，车水马龙，繁华都市', 'Modern city night view, neon lights, busy traffic, prosperous city', 134);
