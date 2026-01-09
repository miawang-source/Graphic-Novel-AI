-- =====================================================
-- 图生视频功能 SQL 脚本
-- 创建视频生成任务表，用于存储生成历史
-- =====================================================

-- 创建视频生成任务表
CREATE TABLE IF NOT EXISTS video_generation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 任务信息
  task_id VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  
  -- 生成参数
  model VARCHAR(50) DEFAULT 'doubao',
  mode VARCHAR(20) DEFAULT 'single',
  prompt TEXT,
  negative_prompt TEXT,
  
  -- 视频参数
  duration INTEGER DEFAULT 5,
  resolution VARCHAR(10) DEFAULT '720p',
  aspect_ratio VARCHAR(10) DEFAULT '16:9',
  fps INTEGER DEFAULT 24,
  camera_fixed BOOLEAN DEFAULT false,
  seed BIGINT DEFAULT -1,
  
  -- 输入图片
  source_image_url TEXT,
  end_frame_image_url TEXT,
  reference_images JSONB DEFAULT '[]',
  
  -- 输出结果
  video_url TEXT,
  thumbnail_url TEXT,
  
  -- 错误信息
  error_message TEXT,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_video_tasks_task_id ON video_generation_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_video_tasks_status ON video_generation_tasks(status);
CREATE INDEX IF NOT EXISTS idx_video_tasks_created_at ON video_generation_tasks(created_at DESC);
