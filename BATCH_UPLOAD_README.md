# 批量上传功能使用说明

## 功能概述

批量上传功能允许用户一次性上传多个素材文件，系统会自动：
1. 将文件加入队列
2. ~~逐个进行AI分析~~ **已禁用AI分析，tags/prompts为空**
3. 上传到Supabase Storage
4. 保存到materials表（tags、chinese_prompt、english_prompt为空值）

**注意：**
- **批量上传不进行AI分析**，以提高上传速度和节省API成本
- **单张上传保留AI分析功能**
- 批量上传的素材可以后续在数据库中手动添加tags和prompts
- 前端会自动隐藏空的tags显示

## 技术实现

### 数据库队列表

```sql
CREATE TABLE material_upload_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL,
  file_name VARCHAR(200) NOT NULL,
  file_size BIGINT NOT NULL,
  file_type VARCHAR(10),
  category_type VARCHAR(20),
  subcategory VARCHAR(30),
  status VARCHAR(20) DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  analysis_result JSONB,
  storage_path TEXT,
  material_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### API端点

1. **POST /api/batch-upload-materials**
   - 接收多个文件和分类
   - 验证文件格式和大小
   - 将文件上传到临时目录
   - 创建队列记录
   - 返回batch_id

2. **POST /api/process-upload-queue**
   - 接收batch_id
   - 处理队列中的pending状态文件
   - 逐个执行：AI分析 → 上传Storage → 保存数据库
   - 更新队列状态

3. **GET /api/batch-upload-status/[batchId]**
   - 查询批次上传进度
   - 返回统计信息和每个文件的状态

## 使用流程

### 前端操作

1. 点击"批量上传"按钮
2. 选择素材分类（如"古代男"）
3. 选择多个文件（支持.jpg, .png, .webp, .psd, .pdf）
4. 点击"开始上传"
5. 实时查看上传进度和每个文件的状态

### 后端处理流程

```
用户选择文件 
  ↓
POST /api/batch-upload-materials
  ↓
文件上传到 temp/{batch_id}/ 目录
  ↓
创建队列记录（status='pending'）
  ↓
POST /api/process-upload-queue
  ↓
逐个处理文件：
  - 更新 status='analyzing' (实际跳过AI分析)
  - ~~AI分析图片内容~~ **已禁用**
  - 更新 status='uploading'
  - 上传到Storage（主文件 + 原始文件）
  - 保存到materials表（tags/prompts为空数组/空字符串）
  - 更新 status='completed'
  ↓
前端轮询 GET /api/batch-upload-status/{batchId}
  ↓
显示实时进度
```

## 文件存储结构

```
material bucket/
├── temp/
│   └── {batch_id}/
│       ├── file1.jpg
│       ├── file2.png
│       └── file3.psd
├── originals/
│   ├── {timestamp}-{random}.psd  (原始PSD文件)
│   └── {timestamp}-{random}.pdf  (原始PDF文件)
└── {timestamp}-{random}.jpg      (缩略图/转换后的图片)
```

## 特性

- ✅ 支持多种格式：.jpg, .png, .webp, .psd, .pdf
- ✅ PSD/PDF自动转换为预览图
- ✅ 保留原始PSD/PDF文件
- ❌ ~~AI自动分析生成标签和提示词~~ **批量上传已禁用AI分析**
- ✅ 实时进度显示
- ✅ 错误处理和重试机制
- ✅ 使用PostgreSQL作为队列，无需额外服务
- ✅ 同一批次使用相同分类
- ✅ 快速上传，无AI分析延迟
- ✅ 前端自动隐藏空tags

## 注意事项

1. **文件大小限制**
   - 普通图片：最大10MB
   - PSD/PDF：最大500MB

2. **并发处理**
   - 文件逐个处理（无AI分析，速度较快）
   - 每个文件处理间隔1秒

3. **临时文件清理**
   - 处理完成后自动删除temp目录中的文件
   - 失败的文件保留在队列中，可手动重试

4. **分类要求**
   - 批量上传时，所有文件使用相同的分类
   - 支持的分类：
     - 人物：古代男、古代女、现代男、现代女、架空
     - 场景：古代住宅、古代场所、现代住宅、现代场所、自然

5. **AI分析**
   - **批量上传：不进行AI分析**，tags/prompts为空
   - **单张上传：保留AI分析功能**
   - 批量上传的素材可后续在数据库中手动添加tags

## 测试建议

1. **小批量测试**：先上传2-3个文件测试流程
2. **检查队列表**：查看material_upload_queue表的记录
3. **验证Storage**：确认文件已上传到Supabase Storage
4. **检查materials表**：确认数据已正确保存
5. **测试错误处理**：上传无效文件，查看错误提示

## 故障排查

### 问题：文件上传失败
- 检查Supabase Storage权限
- 确认SUPABASE_SERVICE_ROLE_KEY已配置
- 查看浏览器控制台错误

### 问题：AI分析失败（仅单张上传）
- 批量上传已禁用AI分析，不会出现此问题
- 单张上传如遇到：检查OPENROUTER_API_KEY是否有效
- 查看API配额是否用尽
- 检查图片格式是否支持

### 问题：队列处理卡住
- 查询material_upload_queue表，检查status
- 手动更新失败记录的status为'pending'
- 重新调用process-upload-queue API

## 性能优化建议

1. **批量大小**：建议每批不超过50个文件
2. **文件预处理**：前端可以先压缩大图片
3. **并发处理**：如需更高性能，可修改为并发处理（注意API限流）
4. **队列清理**：定期清理已完成的队列记录
