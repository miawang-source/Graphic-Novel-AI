"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Download, 
  Save, 
  Copy, 
  Plus, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Upload,
  Trash2,
  ImageIcon,
  Loader2
} from "lucide-react"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"
import { DraggableCanvas } from "@/components/DraggableCanvas"

interface CanvasImage {
  id: string
  src: string
  x: number
  y: number
  width: number
  height: number
  selected: boolean
  originalFile?: File
  materialId?: string
}

interface CanvasState {
  images: CanvasImage[]
  scale: number
  offsetX: number
  offsetY: number
}

export default function CanvasPage() {
  const [canvasState, setCanvasState] = useState<CanvasState>({
    images: [],
    scale: 1,
    offsetX: 0,
    offsetY: 0
  })
  
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [showMaterialLibrary, setShowMaterialLibrary] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveImageData, setSaveImageData] = useState<string | null>(null)

  // 调整大小相关状态
  const [isResizing, setIsResizing] = useState(false)
  const [resizeImageId, setResizeImageId] = useState<string | null>(null)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })

  // 画布拖拽状态
  const [isCanvasDragging, setIsCanvasDragging] = useState(false)
  const [canvasDragStart, setCanvasDragStart] = useState({ x: 0, y: 0, offsetX: 0, offsetY: 0 })

  const canvasRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const addImageToCanvas = useCallback((src: string, materialId?: string, file?: File) => {
    // 创建临时图片元素来获取原始尺寸
    const img = new Image()
    img.onload = () => {
      // 计算新图片的位置（横向排列，不重叠）
      const existingImages = canvasState.images
      let newX = 50 // 起始位置
      let newY = 50

      if (existingImages.length > 0) {
        // 找到最右边的图片位置
        const rightmostImage = existingImages.reduce((rightmost, current) =>
          (current.x + current.width) > (rightmost.x + rightmost.width) ? current : rightmost
        )
        newX = rightmostImage.x + rightmostImage.width + 20 // 添加20px间距
        newY = rightmostImage.y // 保持同一水平线
      }

      // 统一图片显示尺寸策略（类似Figma）
      const standardSize = 300 // 标准显示尺寸
      let displayWidth = standardSize
      let displayHeight = standardSize

      // 根据图片的宽高比调整尺寸，保持比例
      const aspectRatio = img.naturalWidth / img.naturalHeight

      if (aspectRatio > 1) {
        // 横图：固定宽度，调整高度
        displayWidth = standardSize
        displayHeight = standardSize / aspectRatio
      } else {
        // 竖图或正方形：固定高度，调整宽度
        displayHeight = standardSize
        displayWidth = standardSize * aspectRatio
      }

      const newImage: CanvasImage = {
        id: materialId || (Date.now().toString() + Math.random().toString(36).substr(2, 9)),
        src,
        x: newX,
        y: newY,
        width: displayWidth,
        height: displayHeight,
        selected: true,
        originalFile: file,
        materialId
      }

      setCanvasState(prev => ({
        ...prev,
        images: [...prev.images.map(img => ({ ...img, selected: false })), newImage]
      }))

      // 同步更新选中图片列表
      setSelectedImages([newImage.id])

      setSelectedImages([newImage.id])
      console.log('Added image to canvas:', newImage)
    }

    img.src = src
  }, [canvasState.images])

  // 从URL参数获取初始图片（只执行一次）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const materialId = urlParams.get('materialId')
      const imageUrl = urlParams.get('imageUrl')

      console.log('URL params:', { materialId, imageUrl })

      if (materialId && imageUrl) {
        const newImage: CanvasImage = {
          id: materialId,
          src: decodeURIComponent(imageUrl),
          x: 100,
          y: 100,
          width: 200,
          height: 200,
          selected: true,
          materialId
        }

        setCanvasState(prev => ({
          ...prev,
          images: [newImage]
        }))

        setSelectedImages([materialId])
        console.log('Added initial image from URL:', newImage)
      }
    }
  }, []) // 只执行一次
  


  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return
    
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          if (e.target?.result) {
            addImageToCanvas(e.target.result as string, undefined, file)
          }
        }
        reader.readAsDataURL(file)
      }
    })
  }
  
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const files = event.dataTransfer.files
    
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          if (e.target?.result) {
            addImageToCanvas(e.target.result as string, undefined, file)
          }
        }
        reader.readAsDataURL(file)
      }
    })
  }
  
  const handleImageClick = (imageId: string, event: React.MouseEvent) => {
    console.log('[DEBUG] Image clicked:', {
      imageId,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      currentSelected: selectedImages
    })

    let newSelectedImages: string[]

    if (event.ctrlKey || event.metaKey) {
      // 多选（最多3张图片，符合Gemini 2.5 Flash Image Preview的限制）
      if (selectedImages.includes(imageId)) {
        // 取消选中
        newSelectedImages = selectedImages.filter(id => id !== imageId)
      } else if (selectedImages.length < 3) {
        // 添加到选中列表
        newSelectedImages = [...selectedImages, imageId]
      } else {
        // 已达到最大选择数量，替换最早选中的
        newSelectedImages = [...selectedImages.slice(1), imageId]
      }
    } else {
      // 单选
      newSelectedImages = [imageId]
    }

    // 更新选中图片列表
    setSelectedImages(newSelectedImages)

    // 更新图片选中状态（使用新的选中列表）
    setCanvasState(prev => ({
      ...prev,
      images: prev.images.map(img => ({
        ...img,
        selected: newSelectedImages.includes(img.id)
      }))
    }))
  }

  // 新的图片移动处理函数（用于DnD Kit）
  const handleImageMove = (imageId: string, deltaX: number, deltaY: number) => {
    setCanvasState(prev => ({
      ...prev,
      images: prev.images.map(img => {
        if (img.id === imageId || selectedImages.includes(img.id)) {
          return {
            ...img,
            x: Math.max(0, img.x + deltaX),
            y: Math.max(0, img.y + deltaY)
          }
        }
        return img
      })
    }))
  }

  const handleMouseUp = () => {
    setIsResizing(false)
    setResizeImageId(null)
    setIsCanvasDragging(false)
  }

  // 调整大小处理函数
  const handleResizeStart = (imageId: string, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const image = canvasState.images.find(img => img.id === imageId)
    if (!image) return

    setIsResizing(true)
    setResizeImageId(imageId)
    setResizeStart({
      x: event.clientX,
      y: event.clientY,
      width: image.width,
      height: image.height
    })
  }

  const handleResizeMove = (event: React.MouseEvent) => {
    if (!isResizing || !resizeImageId) return

    const deltaX = event.clientX - resizeStart.x
    const deltaY = event.clientY - resizeStart.y

    // 使用对角线距离来计算缩放比例，保持宽高比
    const diagonal = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    const scaleFactor = 1 + (diagonal * (deltaX > 0 ? 1 : -1)) / 200 // 调整敏感度

    const newWidth = Math.max(50, resizeStart.width * scaleFactor) // 最小宽度50px
    const newHeight = Math.max(50, resizeStart.height * scaleFactor) // 最小高度50px

    setCanvasState(prev => ({
      ...prev,
      images: prev.images.map(img => {
        if (img.id === resizeImageId) {
          return {
            ...img,
            width: newWidth,
            height: newHeight
          }
        }
        return img
      })
    }))
  }

  // 画布拖拽处理函数
  const handleCanvasMouseDown = (event: React.MouseEvent) => {
    // 只有在点击空白区域时才开始画布拖拽
    if (event.target === event.currentTarget) {
      setIsCanvasDragging(true)
      setCanvasDragStart({
        x: event.clientX,
        y: event.clientY,
        offsetX: canvasState.offsetX,
        offsetY: canvasState.offsetY
      })
      // 阻止默认行为，避免选择文本等
      event.preventDefault()
    }
  }

  // 调整大小和画布拖拽的鼠标移动处理
  const handleCanvasMouseMove = (event: React.MouseEvent) => {
    if (isResizing) {
      handleResizeMove(event)
    } else if (isCanvasDragging) {
      const deltaX = event.clientX - canvasDragStart.x
      const deltaY = event.clientY - canvasDragStart.y

      // 使用requestAnimationFrame优化性能
      requestAnimationFrame(() => {
        setCanvasState(prev => ({
          ...prev,
          offsetX: canvasDragStart.offsetX + deltaX,
          offsetY: canvasDragStart.offsetY + deltaY
        }))
      })
    }
  }
  
  const deleteSelectedImages = () => {
    setCanvasState(prev => ({
      ...prev,
      images: prev.images.filter(img => !selectedImages.includes(img.id))
    }))
    setSelectedImages([])
  }
  
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("请输入提示词")
      return
    }
    
    if (selectedImages.length === 0) {
      toast.error("请选择至少一张图片")
      return
    }
    
    setIsGenerating(true)
    
    try {
      // 获取选中图片的数据
      const selectedImageData = canvasState.images
        .filter(img => selectedImages.includes(img.id))
        .map(img => img.src)
      
      const response = await fetch('/api/image-generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: selectedImageData,
          prompt: prompt.trim()
        })
      })
      
      if (!response.ok) {
        throw new Error('生成失败')
      }
      
      const data = await response.json()
      console.log('Generation response:', data)

      if (data.success && data.imageUrl) {
        // 检查是否是重试成功的消息
        if (data.message && data.message.includes('重试成功')) {
          toast.success("图片生成成功（重试后成功）")
        } else {
          toast.success("图片生成成功")
        }
        // 添加生成的图片到画布
        addImageToCanvas(data.imageUrl)
        toast.success(data.message || "图片生成完成")
        setPrompt("") // 清空提示词
      } else {
        // 显示详细的错误信息用于调试
        console.error('Generation failed:', data)
        const errorMessage = data.message || data.error || '生成失败'
        toast.error(errorMessage)

        // 如果有原始响应，也在控制台显示
        if (data.rawResponse) {
          console.log('Raw API response:', data.rawResponse)
        }
        if (data.fullResponse) {
          console.log('Full API response:', data.fullResponse)
        }
      }
      
    } catch (error) {
      console.error('Generation error:', error)
      toast.error(error instanceof Error ? error.message : '生成失败')
    } finally {
      setIsGenerating(false)
    }
  }
  
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 顶部工具栏 */}
      <div className="bg-white border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">AI画布</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCanvasState(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 3) }))}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCanvasState(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.3) }))}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCanvasState(prev => ({ ...prev, scale: 1, offsetX: 0, offsetY: 0 }))}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            上传图片
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowMaterialLibrary(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            从素材库添加
          </Button>

          {selectedImages.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={deleteSelectedImages}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      
      {/* 画布区域 */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={canvasRef}
          className="w-full h-full relative"
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            cursor: isCanvasDragging ? 'grabbing' : 'grab'
          }}
        >
          <DraggableCanvas
            images={canvasState.images}
            selectedImages={selectedImages}
            scale={canvasState.scale}
            offsetX={canvasState.offsetX}
            offsetY={canvasState.offsetY}
            onImageMove={handleImageMove}
            onImageSelect={handleImageClick}
            onImageSave={(src) => {
              setSaveImageData(src)
              setShowSaveDialog(true)
            }}
            onResizeStart={handleResizeStart}
            onDrop={handleDrop}
            onCanvasMouseDown={handleCanvasMouseDown}
          >
            {/* 无限网格背景 */}
            <div
              className="fixed inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
                `,
                backgroundSize: `${20 * canvasState.scale}px ${20 * canvasState.scale}px`,
                backgroundPosition: `${canvasState.offsetX * canvasState.scale}px ${canvasState.offsetY * canvasState.scale}px`,
                zIndex: -1
              }}
            />
          </DraggableCanvas>
        </div>
        
        {/* 提示词输入区域 */}
        {selectedImages.length > 0 && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-4xl px-6">
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6">
              {/* 状态标签区域 */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="px-3 py-1">
                    已选中 {selectedImages.length} 张图片
                  </Badge>
                  {selectedImages.length === 2 && (
                    <Badge variant="outline" className="text-xs text-blue-600 px-2 py-1">
                      支持双图生成
                    </Badge>
                  )}
                  {selectedImages.length === 3 && (
                    <Badge variant="outline" className="text-xs text-orange-600 px-2 py-1">
                      已达到最大选择数量
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  Ctrl+点击选择多张图片
                </div>
              </div>

              {/* 输入区域 */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <Textarea
                    placeholder={selectedImages.length === 1
                      ? "输入提示词，基于选中的图片生成新图片..."
                      : `输入提示词，基于选中的${selectedImages.length}张图片生成新图片...`}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-[80px] resize-none text-base leading-relaxed"
                    maxLength={500}
                  />
                  <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                    <span>支持中文提示词，描述如何结合图片</span>
                    <span>{prompt.length}/500</span>
                  </div>
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="self-start px-8 py-3 h-auto"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      生成中...
                    </>
                  ) : (
                    "生成图片"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />
      
      {/* 素材库对话框 */}
      <MaterialLibraryDialog 
        open={showMaterialLibrary}
        onOpenChange={setShowMaterialLibrary}
        onSelectMaterial={(material) => {
          addImageToCanvas(material.image_url, material.id)
          setShowMaterialLibrary(false)
        }}
      />
      
      {/* 保存对话框 */}
      <SaveImageDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        imageData={saveImageData}
        onSave={() => {
          setShowSaveDialog(false)
          setSaveImageData(null)
        }}
      />

      <Toaster />
    </div>
  )
}

// 素材库对话框组件
function MaterialLibraryDialog({
  open,
  onOpenChange,
  onSelectMaterial
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectMaterial: (material: any) => void
}) {
  const [materials, setMaterials] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")

  const fetchMaterials = async (subcategory?: string) => {
    setLoading(true)
    try {
      const url = subcategory ? `/api/materials?subcategory=${subcategory}` : "/api/materials"
      const response = await fetch(url)
      if (!response.ok) throw new Error("Failed to fetch materials")
      const data = await response.json()
      setMaterials(data)
    } catch (error) {
      console.error("Error fetching materials:", error)
      setMaterials([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchMaterials()
    }
  }, [open])

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
    if (category) {
      fetchMaterials(category)
    } else {
      fetchMaterials()
    }
  }

  const filteredMaterials = materials.filter(material =>
    !searchTerm ||
    material.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.tags?.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const categories = [
    { value: "", label: "全部" },
    { value: "ancient-male", label: "古代男" },
    { value: "ancient-female", label: "古代女" },
    { value: "modern-male", label: "现代男" },
    { value: "modern-female", label: "现代女" },
    { value: "fantasy", label: "架空" },
    { value: "ancient-residence", label: "古代住宅" },
    { value: "ancient-location", label: "古代场所" },
    { value: "modern-residence", label: "现代住宅" },
    { value: "modern-location", label: "现代场所" },
    { value: "nature", label: "自然" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>选择素材</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 mb-4">
          <Select value={selectedCategory} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="选择分类" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="搜索素材..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="ml-2">加载中...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredMaterials.map((material) => (
                <Card
                  key={material.id}
                  className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
                  onClick={() => onSelectMaterial(material)}
                >
                  <div className="aspect-[3/4] bg-muted overflow-hidden">
                    {material.image_url ? (
                      <img
                        src={material.image_url}
                        alt={material.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-sm font-medium truncate">{material.title}</p>
                    {material.tags && material.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {material.tags.slice(0, 2).map((tag: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// 保存图片对话框组件
function SaveImageDialog({
  open,
  onOpenChange,
  imageData,
  onSave
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageData: string | null
  onSave: () => void
}) {
  const [selectedCategory, setSelectedCategory] = useState("")
  const [title, setTitle] = useState("")
  const [tags, setTags] = useState("")
  const [chinesePrompt, setChinesePrompt] = useState("")
  const [englishPrompt, setEnglishPrompt] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const categories = [
    { value: "ancient-male", label: "古代男" },
    { value: "ancient-female", label: "古代女" },
    { value: "modern-male", label: "现代男" },
    { value: "modern-female", label: "现代女" },
    { value: "fantasy", label: "架空" },
    { value: "ancient-residence", label: "古代住宅" },
    { value: "ancient-location", label: "古代场所" },
    { value: "modern-residence", label: "现代住宅" },
    { value: "modern-location", label: "现代场所" },
    { value: "nature", label: "自然" },
  ]

  const handleAnalyze = async () => {
    if (!imageData) return

    setIsAnalyzing(true)
    try {
      // 将base64转换为File对象
      const response = await fetch(imageData)
      const blob = await response.blob()
      const file = new File([blob], "canvas-image.png", { type: "image/png" })

      const formData = new FormData()
      formData.append("file", file)
      formData.append("category", "temp")

      const analyzeResponse = await fetch("/api/analyze-material", {
        method: "POST",
        body: formData,
      })

      if (!analyzeResponse.ok) {
        throw new Error("分析失败")
      }

      const data = await analyzeResponse.json()

      if (data.success && data.analysis) {
        setTitle(data.analysis.title || "")
        setTags(data.analysis.tags?.join(", ") || "")
        setChinesePrompt(data.analysis.chinese_prompt || "")
        setEnglishPrompt(data.analysis.english_prompt || "")
        toast.success("AI分析完成")
      } else {
        throw new Error("分析结果格式错误")
      }
    } catch (error) {
      console.error("Analysis error:", error)
      toast.error("AI分析失败")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!selectedCategory || !title.trim()) {
      toast.error("请选择分类并输入标题")
      return
    }

    if (!imageData) return

    setIsSaving(true)
    try {
      // 将base64转换为File对象
      const response = await fetch(imageData)
      const blob = await response.blob()
      const file = new File([blob], `${title}.png`, { type: "image/png" })

      const formData = new FormData()
      formData.append("file", file)
      formData.append("category", selectedCategory)
      formData.append("tags", tags)
      formData.append("chinese_prompt", chinesePrompt)
      formData.append("english_prompt", englishPrompt)

      const saveResponse = await fetch("/api/analyze-material", {
        method: "POST",
        body: formData,
      })

      if (!saveResponse.ok) {
        throw new Error("保存失败")
      }

      const data = await saveResponse.json()

      if (data.success) {
        toast.success("图片保存成功")
        onSave()
        // 重置表单
        setSelectedCategory("")
        setTitle("")
        setTags("")
        setChinesePrompt("")
        setEnglishPrompt("")
      } else {
        throw new Error(data.error || "保存失败")
      }
    } catch (error) {
      console.error("Save error:", error)
      toast.error(error instanceof Error ? error.message : "保存失败")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>保存图片到素材库</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 图片预览 */}
          {imageData && (
            <div className="flex justify-center">
              <img
                src={imageData}
                alt="Preview"
                className="max-w-48 max-h-48 object-contain rounded-lg border"
              />
            </div>
          )}

          {/* AI分析按钮 */}
          <div className="flex justify-center">
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !imageData}
              variant="outline"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  AI分析中...
                </>
              ) : (
                "AI自动分析"
              )}
            </Button>
          </div>

          {/* 分类选择 */}
          <div>
            <label className="text-sm font-medium">分类 *</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 标题 */}
          <div>
            <label className="text-sm font-medium">标题 *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入图片标题"
            />
          </div>

          {/* 标签 */}
          <div>
            <label className="text-sm font-medium">标签</label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="输入标签，用逗号分隔"
            />
          </div>

          {/* 中文提示词 */}
          <div>
            <label className="text-sm font-medium">中文提示词</label>
            <Textarea
              value={chinesePrompt}
              onChange={(e) => setChinesePrompt(e.target.value)}
              placeholder="输入中文描述"
              rows={3}
            />
          </div>

          {/* 英文提示词 */}
          <div>
            <label className="text-sm font-medium">英文提示词</label>
            <Textarea
              value={englishPrompt}
              onChange={(e) => setEnglishPrompt(e.target.value)}
              placeholder="输入英文描述"
              rows={3}
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !selectedCategory || !title.trim()}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  保存中...
                </>
              ) : (
                "保存到素材库"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
