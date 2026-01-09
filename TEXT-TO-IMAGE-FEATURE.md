# 文生图功能实现文档

## 功能概述

在画布页面添加了两种图片生成模式：
1. **图像编辑模式**：需要选择1-3张图片，基于图片+提示词生成新图片（原有功能）
2. **文生图模式**：无需选择图片，直接通过文字提示词生成图片（新增功能）

## 实现细节

### 1. 后端API修改 (`app/api/image-generation/route.ts`)

#### 新增参数
- `mode`: 生成模式，可选值：
  - `"image-edit"`: 图像编辑模式（默认）
  - `"text-to-image"`: 文生图模式

#### 主要改动
```typescript
// 接收mode参数
const { images, prompt, mode = "image-edit" } = body

// 根据模式验证参数
if (mode === "image-edit" && (!images || images.length === 0)) {
  return NextResponse.json({ error: "图像编辑模式需要选择图片" }, { status: 400 })
}

// 只在有图片时添加图片到消息内容
if (images && images.length > 0) {
  images.forEach((imageData: string) => {
    messageContent.push({
      type: "image_url",
      image_url: { url: imageData }
    })
  })
}
```

### 2. 前端画布页面修改 (`app/canvas/page.tsx`)

#### 新增状态
```typescript
const [generationMode, setGenerationMode] = useState<"image-edit" | "text-to-image">("image-edit")
```

#### UI改动

**模式切换按钮**（位于提示词输入框上方）：
- 图像编辑按钮：切换到图像编辑模式
- 文生图按钮：切换到文生图模式，自动清除图片选择

**状态提示**：
- 图像编辑模式：显示已选中图片数量、支持双图/三图提示
- 文生图模式：显示"文生图模式：直接输入提示词生成图片"

**输入框提示文字**：
- 图像编辑模式：根据选中图片数量显示不同提示
- 文生图模式：显示"输入提示词，直接从文字生成图片..."

**输入框禁用逻辑**：
- 图像编辑模式：未选择图片时禁用
- 文生图模式：始终可用

**生成按钮禁用逻辑**：
- 图像编辑模式：需要提示词 + 至少1张图片
- 文生图模式：只需要提示词

#### 生成逻辑改动
```typescript
const handleGenerate = async () => {
  // 图像编辑模式需要选择图片
  if (generationMode === "image-edit" && selectedImages.length === 0) {
    toast.error("图像编辑模式需要选择至少一张图片")
    return
  }
  
  // 获取选中图片的数据（文生图模式不需要）
  const selectedImageData = generationMode === "image-edit"
    ? canvasState.images
        .filter(img => selectedImages.includes(img.id))
        .map(img => img.src)
    : []
  
  // 发送请求时包含mode参数
  const response = await fetch('/api/image-generation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      images: selectedImageData,
      prompt: prompt.trim(),
      mode: generationMode
    })
  })
}
```

## 使用方法

### 图像编辑模式
1. 点击"图像编辑"按钮（默认模式）
2. 在画布上点击选择1-3张图片（Ctrl+点击多选）
3. 输入提示词，描述如何处理/融合这些图片
4. 点击"生成图片"按钮

### 文生图模式
1. 点击"文生图"按钮
2. 直接在输入框中输入提示词，详细描述想要生成的图片
3. 点击"生成图片"按钮
4. 无需选择任何图片

## 技术说明

### 模型支持
- 使用模型：`google/gemini-2.5-flash-image-preview` (Nano Banana)
- 该模型原生支持：
  - 图生图（Image-to-Image）
  - 文生图（Text-to-Image）
  - 多图融合（Multi-Image Fusion）

### API参数
- `modalities: ["image", "text"]`：启用图片生成功能
- `max_tokens: 4000`：最大token数
- `temperature: 0.7`：生成温度

### 模式切换行为
- 从图像编辑切换到文生图：自动清除所有图片选择
- 从文生图切换到图像编辑：保持当前状态，需要重新选择图片

## 注意事项

1. **图像编辑模式**：
   - 必须选择至少1张图片
   - 最多支持3张图片
   - 提示词用于描述如何处理/融合图片

2. **文生图模式**：
   - 不需要选择图片
   - 提示词应详细描述想要生成的图片内容
   - 生成质量取决于提示词的详细程度

3. **提示词建议**：
   - 支持中文提示词
   - 最多500字符
   - 建议详细描述画面内容、风格、色调等

## 测试建议

### 图像编辑模式测试
- 单图编辑：选择1张图片 + 提示词
- 双图融合：选择2张图片 + 融合提示词
- 三图融合：选择3张图片 + 融合提示词

### 文生图模式测试
- 简单场景：如"一只可爱的猫咪"
- 复杂场景：如"夕阳下的海边，一个女孩坐在沙滩上看书，温暖的色调"
- 特定风格：如"赛博朋克风格的城市夜景"
