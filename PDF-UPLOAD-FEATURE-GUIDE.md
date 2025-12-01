# PDF素材上传功能使用指南

## 功能概述

本功能允许用户直接上传PDF格式的素材文件，系统会自动将PDF第一页转换为PNG图片用于展示和AI分析，同时保存原始PDF文件供用户下载使用。

## 主要特性

1. **支持PDF文件上传**：用户可以直接上传`.pdf`格式的文件
2. **自动转换**：后端自动将PDF第一页转换为PNG图片作为封面
3. **双重存储**：
   - 封面图（PNG格式）：用于页面展示和AI分析
   - 原始PDF文件：保存在`originals/`文件夹中供下载
4. **AI分析**：使用转换后的PNG图片进行AI内容分析，生成标签和提示词
5. **PDF下载**：素材卡片上显示专门的红色"PDF"下载按钮
6. **文件标识**：PDF素材在卡片左上角显示红色"PDF"标识

## 技术实现

### 后端处理流程

1. **文件接收**：API接收PDF文件
2. **PDF转换**：使用`pdf-to-img`库将PDF第一页转换为PNG
3. **文件上传**：
   - 原始PDF → `material/originals/` 存储桶
   - 封面PNG → `material/` 存储桶
4. **AI分析**：使用PNG封面进行AI视觉分析
5. **数据库保存**：保存素材信息，包括原始文件URL和file_format='pdf'

### 依赖库

- `pdf-to-img`: PDF转图片
- `sharp`: 图像处理（已有）
- `ag-psd`: PSD文件解析（已有）

### 数据库结构

使用现有字段：
- `original_file_url`: 原始PDF文件的URL
- `file_format`: 文件格式标识（设置为'pdf'）

## 使用说明

### 上传PDF素材

1. 进入"素材上传"页面
2. 选择素材分类（必选）
3. 点击"选择图片"或拖拽PDF文件到上传区域
4. 系统自动处理：
   - 提取PDF第一页并转换为PNG
   - AI分析生成标签和提示词
   - 保存原始PDF文件
5. 可以编辑AI生成的标签和提示词
6. 点击"确认上传"完成上传

### 下载PDF文件

1. 在素材库中找到PDF素材（左上角有红色"PDF"标识）
2. 鼠标悬停在素材卡片上
3. 点击红色"PDF"按钮下载原始PDF文件
4. 或点击普通下载按钮下载PNG封面图

## 文件大小限制

- 普通图片（JPG/PNG/WEBP）：最大10MB
- PSD文件：最大500MB
- PDF文件：最大500MB

## 测试步骤

### 1. 环境检查

确保以下环境变量已配置（在`.env.local`文件中）：
```
NEXT_PUBLIC_SUPABASE_URL=你的Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase匿名密钥
OPENROUTER_API_KEY=你的OpenRouter API密钥
```

### 2. 启动开发服务器

```bash
npm run dev
```

服务器将在 http://localhost:3000 启动

### 3. 测试上传功能

1. 打开浏览器访问 http://localhost:3000
2. 点击"素材上传"标签
3. 选择一个素材分类（如"古代男"）
4. 准备一个测试PDF文件（建议使用包含图片的PDF）
5. 拖拽或选择PDF文件上传
6. 等待AI分析完成（会显示"AI分析中..."）
7. 查看分析结果：
   - 预览图应该显示PDF第一页的内容
   - 标签和提示词应该自动生成
8. 可以编辑标签和提示词
9. 点击"确认上传"

### 4. 测试素材库显示

1. 点击"素材库"标签
2. 选择刚才上传的分类
3. 找到刚上传的PDF素材
4. 检查：
   - 左上角应显示红色"PDF"标识
   - 封面图应正确显示
   - 标签应正确显示

### 5. 测试下载功能

1. 鼠标悬停在PDF素材卡片上
2. 应该看到多个按钮：
   - 红色"PDF"按钮（下载原始PDF）
   - 普通下载按钮（下载PNG封面）
   - 删除按钮
   - 编辑按钮
3. 点击红色"PDF"按钮
4. 应该开始下载原始PDF文件
5. 打开下载的PDF文件，确认内容完整

## 常见问题排查

### PDF转换失败

**症状**：上传PDF时显示"PDF文件处理失败"

**可能原因**：
- PDF文件损坏
- PDF文件过大
- pdf-to-img库安装不完整

**解决方法**：
```bash
# 重新安装依赖
npm install pdf-to-img --save
npm install
```

### AI分析失败

**症状**：PDF上传成功但AI分析失败

**可能原因**：
- OpenRouter API密钥未配置或无效
- 网络连接问题

**解决方法**：
1. 检查`.env.local`中的`OPENROUTER_API_KEY`
2. 查看浏览器控制台和服务器日志获取详细错误

### 下载失败

**症状**：点击PDF按钮无法下载

**可能原因**：
- Supabase存储桶权限问题
- original_file_url未正确保存

**解决方法**：
1. 检查Supabase存储桶是否允许公共读取
2. 在浏览器控制台查看错误信息
3. 检查数据库中的original_file_url字段

### 预览图不显示

**症状**：PDF上传后预览图为空白

**可能原因**：
- PDF第一页为空白
- PDF转PNG失败

**解决方法**：
1. 使用包含内容的PDF文件测试
2. 查看服务器日志中的转换错误信息

## 开发服务器日志

在测试过程中，注意查看服务器控制台输出的调试信息：

```
[DEBUG] File extension: pdf isPSD: false isPDF: true
[DEBUG] Processing PDF file...
[DEBUG] Reading PDF file bytes...
[DEBUG] PDF file size: 123456 bytes
[DEBUG] Converting PDF first page to PNG...
[DEBUG] PDF first page converted successfully, size: 234567 bytes
[DEBUG] Starting material analysis for file: example.png
[DEBUG] Uploading original PDF file to storage: originals/...
[DEBUG] Original PDF uploaded successfully: originals/...
```

## 代码修改总结

### 后端修改（`app/api/analyze-material/route.ts`）

1. 添加`pdf-to-img`导入
2. 添加PDF文件检测逻辑
3. 实现PDF转PNG功能
4. 添加PDF原始文件上传逻辑
5. 支持PDF预览图返回

### 前端修改（`app/page.tsx`）

1. 更新文件类型检查，添加PDF支持
2. 更新文件大小限制（PDF允许500MB）
3. 添加PDF文件accept属性
4. 更新拖拽上传支持PDF
5. 在素材库添加PDF标识显示
6. 添加PDF下载按钮（红色）
7. 添加TypeScript类型支持

## 下一步优化建议

- [ ] 添加PDF多页预览功能
- [ ] 支持选择特定页面作为封面
- [ ] 批量PDF上传
- [ ] PDF文件压缩优化
- [ ] 上传进度条显示
- [ ] 支持更多PDF特性（书签、注释等）

## 技术支持

如有问题，请查看：
- 服务器日志：检查PDF处理错误
- 浏览器控制台：检查前端错误
- Supabase日志：检查存储和数据库错误

---

**注意**：确保你的Supabase存储桶配置正确，并且有足够的存储空间来保存PDF文件。
