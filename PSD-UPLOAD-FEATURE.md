# PSD素材上传功能说明

## 功能概述

本功能允许用户直接上传PSD格式的素材文件，系统会自动提取缩略图用于展示和AI分析，同时保存原始PSD文件供用户下载使用。

## 主要特性

1. **支持PSD文件上传**：用户可以直接上传`.psd`格式的文件
2. **自动缩略图提取**：后端自动从PSD文件中提取合成图像作为缩略图
3. **双重存储**：
   - 缩略图（PNG格式）：用于页面展示和AI分析
   - 原始PSD文件：保存在`originals/`文件夹中供下载
4. **AI分析**：使用提取的缩略图进行AI内容分析，生成标签和提示词
5. **PSD下载**：素材卡片上显示专门的PSD下载按钮
6. **文件标识**：PSD素材在卡片左上角显示紫色"PSD"标识

## 技术实现

### 后端处理流程

1. **文件接收**：API接收PSD文件
2. **PSD解析**：使用`ag-psd`库解析PSD文件
3. **缩略图生成**：使用`canvas`库将PSD图像数据转换为PNG
4. **文件上传**：
   - 原始PSD → `material/originals/` 存储桶
   - 缩略图PNG → `material/` 存储桶
5. **AI分析**：使用缩略图进行AI视觉分析
6. **数据库保存**：保存素材信息，包括原始文件URL

### 依赖库

- `ag-psd`: PSD文件解析
- `canvas`: 图像处理和PNG生成

### 数据库结构

新增字段：
- `original_file_url`: 原始PSD文件的URL
- `file_format`: 文件格式标识（png/jpg/psd等）

## 使用说明

### 上传PSD素材

1. 进入"素材上传"页面
2. 选择素材分类
3. 点击"选择图片"或拖拽PSD文件到上传区域
4. 系统自动处理：
   - 提取缩略图
   - AI分析生成标签和提示词
   - 保存原始PSD文件
5. 可以编辑AI生成的标签和提示词
6. 点击"保存素材"完成上传

### 下载PSD文件

1. 在素材库中找到PSD素材（左上角有紫色"PSD"标识）
2. 鼠标悬停在素材卡片上
3. 点击紫色"PSD"按钮下载原始PSD文件
4. 或点击普通下载按钮下载PNG缩略图

## 文件大小限制

- 普通图片（JPG/PNG/WEBP）：最大10MB
- PSD文件：最大100MB

## 部署步骤

### 1. 安装依赖

```bash
npm install ag-psd canvas
```

### 2. 数据库迁移

在Supabase SQL编辑器中执行`database-migration-psd-support.sql`脚本：

```sql
ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS original_file_url TEXT;

ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS file_format TEXT;
```

### 3. 存储桶配置

确保Supabase Storage中的`material`存储桶：
- 允许公共读取
- 文件大小限制设置为100MB以上
- 创建`originals/`文件夹（可选，代码会自动创建）

### 4. 环境变量

确保以下环境变量已配置：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENROUTER_API_KEY`

### 5. 部署代码

```bash
npm run build
npm run start
```

## 注意事项

1. **Canvas库依赖**：`canvas`库需要系统级依赖，确保服务器环境已安装
2. **内存使用**：处理大型PSD文件可能需要较多内存
3. **处理时间**：PSD文件处理比普通图片慢，需要给用户适当的加载提示
4. **浏览器兼容性**：PSD上传功能在所有现代浏览器中都可用

## 故障排查

### PSD解析失败

- 检查PSD文件是否损坏
- 确保PSD文件包含合成图像数据
- 查看服务器日志获取详细错误信息

### 缩略图生成失败

- 检查canvas库是否正确安装
- 确保服务器有足够内存
- 验证PSD文件的颜色模式（RGB模式最佳）

### 下载失败

- 检查存储桶权限设置
- 验证original_file_url是否正确保存
- 检查网络连接

## 未来改进

- [ ] 支持图层预览
- [ ] 支持选择特定图层导出
- [ ] 批量PSD上传
- [ ] PSD文件压缩优化
- [ ] 进度条显示
- [ ] 支持更多PSD特性（调整图层、效果等）

## 技术支持

如有问题，请查看：
- 服务器日志：检查PSD处理错误
- 浏览器控制台：检查前端错误
- Supabase日志：检查存储和数据库错误

