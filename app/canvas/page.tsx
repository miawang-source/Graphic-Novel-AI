"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
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
  Loader2,
  X
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
    offsetX: -4500, // 初始偏移，让画布中心显示在视口中心
    offsetY: -4500
  })
  
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [showMaterialLibrary, setShowMaterialLibrary] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveImageData, setSaveImageData] = useState<string | null>(null)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [showImageSaveDialog, setShowImageSaveDialog] = useState(false)
  const [currentImageForSave, setCurrentImageForSave] = useState<CanvasImage | null>(null)
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null)
  const [showMaterialDetail, setShowMaterialDetail] = useState(false)

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
      // 计算新图片的位置（在画布中心区域，横向排列）
      const existingImages = canvasState.images
      const canvasCenter = { x: 5000, y: 5000 } // 画布中心位置
      let newX = canvasCenter.x - 150 // 起始位置（图片宽度的一半）
      let newY = canvasCenter.y - 150 // 起始位置（图片高度的一半）

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

  // 处理键盘事件和阻止浏览器默认缩放
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedImages([])
      }
    }

    // 阻止画布区域内的浏览器默认Ctrl+滚轮缩放并处理画布缩放
    const handleWheelCapture = (e: WheelEvent) => {
      if (e.ctrlKey && canvasRef.current?.contains(e.target as Node)) {
        e.preventDefault()
        e.stopPropagation()

        // 执行画布缩放逻辑
        const delta = e.deltaY
        const zoomFactor = delta > 0 ? 0.9 : 1.1
        const newScale = Math.max(0.1, Math.min(5, canvasState.scale * zoomFactor))

        if (newScale !== canvasState.scale) {
          // 获取鼠标在画布容器中的位置
          const rect = canvasRef.current?.getBoundingClientRect()
          if (rect) {
            const mouseX = e.clientX - rect.left
            const mouseY = e.clientY - rect.top

            // 使用“translate 再 scale”的坐标系：screen = (world + offset) * scale
            // 保持鼠标下内容不变 => o' = o + mouse*(1/s' - 1/s)
            // 计算鼠标在画布世界坐标中的位置
            const worldMouseX = (mouseX - canvasState.offsetX) / canvasState.scale
            const worldMouseY = (mouseY - canvasState.offsetY) / canvasState.scale

            // 计算新的偏移量，使鼠标在世界坐标中的位置保持不变
            const newOffsetX = mouseX - worldMouseX * newScale
            const newOffsetY = mouseY - worldMouseY * newScale

            setCanvasState(prev => ({
              ...prev,
              scale: newScale,
              offsetX: newOffsetX,
              offsetY: newOffsetY
            }))
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    // 使用capture阶段监听，确保在React事件之前拦截
    document.addEventListener('wheel', handleWheelCapture, { passive: false, capture: true })

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('wheel', handleWheelCapture, { capture: true })
    }
  }, [canvasState.scale, canvasState.offsetX, canvasState.offsetY])

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
  const handleImageMove = (imageId: string, newX: number, newY: number) => {
    setCanvasState(prev => ({
      ...prev,
      images: prev.images.map(img => {
        if (img.id === imageId) {
          return {
            ...img,
            x: newX,
            y: newY
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

  // 鼠标滚轮缩放处理函数
  const handleWheel = (event: React.WheelEvent) => {
    // 只有按住Ctrl键时才进行缩放
    if (!event.ctrlKey) {
      return // 不阻止默认行为，允许正常滚动
    }

    // 阻止浏览器默认的Ctrl+滚轮缩放行为
    event.preventDefault()
    event.stopPropagation()

    const delta = event.deltaY
    const zoomFactor = delta > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.1, Math.min(5, canvasState.scale * zoomFactor))

    if (newScale !== canvasState.scale) {
      // 获取鼠标在画布容器中的位置
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        const mouseX = event.clientX - rect.left
        const mouseY = event.clientY - rect.top

        // 使用“translate 再 scale”的坐标系：screen = (world + offset) * scale
        // 保持鼠标下内容不变 => o' = o + mouse*(1/s' - 1/s)
        // 计算鼠标在画布世界坐标中的位置
        const worldMouseX = (mouseX - canvasState.offsetX) / canvasState.scale
        const worldMouseY = (mouseY - canvasState.offsetY) / canvasState.scale

        // 计算新的偏移量，使鼠标在世界坐标中的位置保持不变
        const newOffsetX = mouseX - worldMouseX * newScale
        const newOffsetY = mouseY - worldMouseY * newScale

        setCanvasState(prev => ({
          ...prev,
          scale: newScale,
          offsetX: newOffsetX,
          offsetY: newOffsetY
        }))
      }
    }
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
    // 检查是否点击在图片上
    const target = event.target as HTMLElement
    const isClickOnImage = target.tagName === 'IMG' || target.closest('[data-draggable-image]')

    // 只有在点击空白区域时才开始画布拖拽
    if (!isClickOnImage) {
      setIsCanvasDragging(true)
      setCanvasDragStart({
        x: event.clientX,
        y: event.clientY,
        offsetX: canvasState.offsetX,
        offsetY: canvasState.offsetY
      })
      // 阻止默认行为，避免选择文本等
      event.preventDefault()
      // 清除图片选择
      setSelectedImages([])
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

  // 下载画布功能
  const downloadCanvas = async (format: 'png' | 'jpg' | 'webp' = 'png', quality: number = 1.0) => {
    if (!canvasRef.current) return

    try {
      // 创建一个高分辨率临时canvas来渲染画布内容
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // 计算画布的实际内容边界
      const images = canvasState.images
      if (images.length === 0) {
        toast.error('画布中没有图片可以下载')
        return
      }

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

      // 计算所有图片的边界
      images.forEach(img => {
        minX = Math.min(minX, img.x)
        minY = Math.min(minY, img.y)
        maxX = Math.max(maxX, img.x + img.width)
        maxY = Math.max(maxY, img.y + img.height)
      })

      // 添加一些边距
      const padding = 50
      minX -= padding
      minY -= padding
      maxX += padding
      maxY += padding

      const canvasWidth = maxX - minX
      const canvasHeight = maxY - minY

      // 使用高分辨率倍数来提高图片质量
      const scaleFactor = Math.max(window.devicePixelRatio || 1, 2) // 至少2倍分辨率

      canvas.width = canvasWidth * scaleFactor
      canvas.height = canvasHeight * scaleFactor

      // 设置高质量渲染
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // 缩放上下文以匹配高分辨率
      ctx.scale(scaleFactor, scaleFactor)

      // 设置背景色
      if (format === 'jpg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)
      }

      // 渲染所有图片
      const imagePromises = images.map(img => {
        return new Promise<void>((resolve, reject) => {
          const image = new Image()
          image.crossOrigin = 'anonymous'
          image.onload = () => {
            ctx.drawImage(
              image,
              img.x - minX,
              img.y - minY,
              img.width,
              img.height
            )
            resolve()
          }
          image.onerror = reject
          image.src = img.src
        })
      })

      await Promise.all(imagePromises)

      // 转换为blob并下载
      canvas.toBlob((blob) => {
        if (!blob) return

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `canvas-${Date.now()}.${format}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        toast.success(`画布已下载为 ${format.toUpperCase()} 格式`)
      }, `image/${format}`, quality)

    } catch (error) {
      console.error('下载失败:', error)
      toast.error('下载失败，请重试')
    }
  }

  // 下载原图功能（直接下载AI返回的原始图片）
  const downloadOriginalImage = async (image: CanvasImage) => {
    try {
      // 如果图片有原始URL，直接下载
      if (image.src.startsWith('data:')) {
        // 处理base64格式的图片
        const link = document.createElement('a')
        link.href = image.src
        link.download = `original-image-${Date.now()}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        toast.success('原图下载成功！')
      } else {
        // 处理URL格式的图片
        try {
          const response = await fetch(image.src)
          const blob = await response.blob()

          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `original-image-${Date.now()}.png`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)

          toast.success('原图下载成功！')
        } catch (error) {
          console.error('下载原图失败:', error)
          toast.error('下载原图失败，请重试')
        }
      }
    } catch (error) {
      console.error('下载原图失败:', error)
      toast.error('下载原图失败，请重试')
    }
  }



  // 保存单个图片到素材库
  const saveImageToLibrary = (image: CanvasImage) => {
    setCurrentImageForSave(image)
    setShowImageSaveDialog(true)
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
              onClick={() => {
                const rect = canvasRef.current?.getBoundingClientRect()
                setCanvasState(prev => {
                  const newScale = Math.min(prev.scale * 1.2, 3)
                  if (!rect || newScale === prev.scale) return prev
                  const cx = rect.width / 2
                  const cy = rect.height / 2
                  // 计算视口中心在画布世界坐标中的位置
                  const worldCenterX = (cx - prev.offsetX) / prev.scale
                  const worldCenterY = (cy - prev.offsetY) / prev.scale
                  // 计算新的偏移量，使视口中心在世界坐标中的位置保持不变
                  const newOffsetX = cx - worldCenterX * newScale
                  const newOffsetY = cy - worldCenterY * newScale
                  return { ...prev, scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY }
                })
              }}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const rect = canvasRef.current?.getBoundingClientRect()
                setCanvasState(prev => {
                  const newScale = Math.max(prev.scale / 1.2, 0.3)
                  if (!rect || newScale === prev.scale) return prev
                  const cx = rect.width / 2
                  const cy = rect.height / 2
                  // 计算视口中心在画布世界坐标中的位置
                  const worldCenterX = (cx - prev.offsetX) / prev.scale
                  const worldCenterY = (cy - prev.offsetY) / prev.scale
                  // 计算新的偏移量，使视口中心在世界坐标中的位置保持不变
                  const newOffsetX = cx - worldCenterX * newScale
                  const newOffsetY = cy - worldCenterY * newScale
                  return { ...prev, scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY }
                })
              }}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCanvasState(prev => ({ ...prev, scale: 1, offsetX: -4500, offsetY: -4500 }))}
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
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDownloadDialog(true)}
              >
                <Download className="w-4 h-4 mr-2" />
                下载画布
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteSelectedImages}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* 画布区域 */}
      <div className="flex-1 relative overflow-auto">
        <div
          ref={canvasRef}
          className="w-full h-full relative"
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
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
            onImageDownloadOriginal={downloadOriginalImage}
            onImageSaveToLibrary={saveImageToLibrary}
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
      </div>

      {/* 提示词输入区域 - 固定在页面底部 */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-4xl px-6 z-50">
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6">
          {/* 状态标签区域 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="px-3 py-1">
                {selectedImages.length > 0 ? `已选中 ${selectedImages.length} 张图片` : '点击图片开始生成'}
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
              Ctrl+点击选择多张图片 | Ctrl+滚轮缩放画布
            </div>
          </div>

          {/* 输入区域 */}
          <div className="flex gap-4">
            <div className="flex-1">
              <Textarea
                placeholder={selectedImages.length === 0
                  ? "请先选择图片，然后输入提示词进行AI生成..."
                  : selectedImages.length === 1
                  ? "输入提示词，基于选中的图片生成新图片..."
                  : `输入提示词，基于选中的${selectedImages.length}张图片生成新图片...`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[80px] resize-none text-base leading-relaxed"
                maxLength={500}
                disabled={selectedImages.length === 0}
              />
              <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                <span>支持中文提示词，描述如何结合图片</span>
                <span>{prompt.length}/500</span>
              </div>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim() || selectedImages.length === 0}
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
        onShowMaterialDetail={(material) => {
          setSelectedMaterial(material)
          setShowMaterialDetail(true)
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

      {/* 下载对话框 */}
      <DownloadDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        onDownload={downloadCanvas}
      />

      {/* 保存图片到素材库对话框 */}
      <SaveImageToLibraryDialog
        open={showImageSaveDialog}
        onOpenChange={setShowImageSaveDialog}
        image={currentImageForSave}
        onSave={() => {
          setShowImageSaveDialog(false)
          setCurrentImageForSave(null)
        }}
      />

      {/* 图片详情弹窗 - 暂时注释掉 */}
      {/*
      <MaterialDetailDialog
        open={showMaterialDetail}
        onOpenChange={setShowMaterialDetail}
        material={selectedMaterial}
        onSelectMaterial={(material) => {
          addImageToCanvas(material.image_url, material.id)
          setShowMaterialDetail(false)
          setShowMaterialLibrary(false)
        }}
      />
      */}

      <Toaster />
    </div>
  )
}

// 素材库对话框组件
function MaterialLibraryDialog({
  open,
  onOpenChange,
  onSelectMaterial,
  onShowMaterialDetail
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectMaterial: (material: any) => void
  onShowMaterialDetail: (material: any) => void
}) {
  const [materials, setMaterials] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [materialToDelete, setMaterialToDelete] = useState<any>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const fetchMaterials = async (subcategory?: string) => {
    setLoading(true)
    try {
      const url = subcategory ? `/api/materials?subcategory=${subcategory}` : "/api/materials"
      console.log("Fetching materials from:", url)
      const response = await fetch(url, {
        cache: 'no-cache', // 确保不使用缓存
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      if (!response.ok) throw new Error("Failed to fetch materials")
      const data = await response.json()
      console.log("Fetched materials:", data?.length || 0)
      setMaterials(data || [])
    } catch (error) {
      console.error("Error fetching materials:", error)
      setMaterials([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      // 重置状态并重新获取素材
      setMaterials([])
      setSelectedCategory("all")
      setSearchTerm("")
      fetchMaterials()
    }
  }, [open])

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
    if (category && category !== "all") {
      fetchMaterials(category)
    } else {
      fetchMaterials()
    }
  }

  const handleDeleteMaterial = (material: any, event: React.MouseEvent) => {
    event.stopPropagation() // 防止触发选择素材
    setMaterialToDelete(material)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (!materialToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/materials/${materialToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('删除失败')
      }

      const data = await response.json()
      if (data.success) {
        toast.success('素材删除成功')
        // 重新获取素材列表
        if (selectedCategory && selectedCategory !== "all") {
          fetchMaterials(selectedCategory)
        } else {
          fetchMaterials()
        }
      } else {
        throw new Error(data.error || '删除失败')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error(error instanceof Error ? error.message : '删除失败')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      setMaterialToDelete(null)
    }
  }

  const filteredMaterials = materials.filter(material =>
    !searchTerm ||
    material.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.tags?.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const categories = [
    { value: "all", label: "全部" },
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
      <DialogContent className="max-w-6xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>选择素材</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 mb-4 flex-shrink-0">
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

        <div className="flex-1 overflow-y-auto min-h-0">
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
                  className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden relative group"
                  onClick={() => onSelectMaterial(material)}
                >
                  <div className="aspect-[3/4] bg-muted overflow-hidden rounded-t-lg relative">
                    {material.image_url ? (
                      <img
                        src={material.image_url}
                        alt={material.title}
                        className="w-full h-full object-contain bg-white"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}

                    {/* 删除按钮 - 悬浮时显示 */}
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-2 left-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleDeleteMaterial(material, e)}
                      title="删除素材"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
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

        {/* 删除确认弹窗 */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>确认删除</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                您确定要彻底删除素材 "{materialToDelete?.title}" 吗？
              </p>
              <p className="text-sm text-red-600">
                此操作将同时删除数据库记录和存储桶中的文件，且无法恢复。
              </p>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  取消
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      删除中...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      确认删除
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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

// 下载对话框组件
function DownloadDialog({
  open,
  onOpenChange,
  onDownload
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDownload: (format: 'png' | 'jpg' | 'webp', quality: number) => void
}) {
  const [format, setFormat] = useState<'png' | 'jpg' | 'webp'>('png')
  const [quality, setQuality] = useState(100)

  const handleDownload = () => {
    onDownload(format, quality / 100)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>下载画布</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">文件格式</label>
            <Select value={format} onValueChange={(value: 'png' | 'jpg' | 'webp') => setFormat(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="png">PNG (无损压缩，支持透明)</SelectItem>
                <SelectItem value="jpg">JPG (有损压缩，文件更小)</SelectItem>
                <SelectItem value="webp">WebP (现代格式，平衡质量和大小)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(format === 'jpg' || format === 'webp') && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                图片质量: {quality}%
              </label>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>较小文件</span>
                <span>较高质量</span>
              </div>
            </div>
          )}

          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            <p className="font-medium mb-1">格式说明：</p>
            <ul className="text-xs space-y-1">
              <li>• <strong>PNG</strong>: 无损压缩，支持透明背景，适合图标和简单图形</li>
              <li>• <strong>JPG</strong>: 有损压缩，文件较小，适合照片和复杂图像</li>
              <li>• <strong>WebP</strong>: 现代格式，在质量和文件大小间取得良好平衡</li>
            </ul>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              取消
            </Button>
            <Button onClick={handleDownload} className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              下载
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// 保存图片到素材库对话框组件
function SaveImageToLibraryDialog({
  open,
  onOpenChange,
  image,
  onSave
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  image: CanvasImage | null
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
    if (!image) return

    setIsAnalyzing(true)
    try {
      // 创建高分辨率canvas来渲染图片
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // 使用更高的分辨率来保证图片质量
      const scaleFactor = 2 // 2倍分辨率
      canvas.width = image.width * scaleFactor
      canvas.height = image.height * scaleFactor

      // 设置高质量渲染
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // 加载并绘制图片
      const img = new Image()
      img.crossOrigin = 'anonymous'

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          // 使用高分辨率绘制
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve()
        }
        img.onerror = reject
        img.src = image.src
      })

      // 转换为高质量blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
        }, 'image/png', 1.0) // 最高质量
      })

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

    if (!image) return

    setIsSaving(true)
    try {
      // 创建高分辨率canvas来渲染图片
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // 使用更高的分辨率来保证图片质量
      const scaleFactor = 2 // 2倍分辨率
      canvas.width = image.width * scaleFactor
      canvas.height = image.height * scaleFactor

      // 设置高质量渲染
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // 加载并绘制图片
      const img = new Image()
      img.crossOrigin = 'anonymous'

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          // 使用高分辨率绘制
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve()
        }
        img.onerror = reject
        img.src = image.src
      })

      // 转换为高质量blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
        }, 'image/png', 1.0) // 最高质量
      })

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
          {image && (
            <div className="flex justify-center">
              <img
                src={image.src}
                alt="Preview"
                className="max-w-48 max-h-48 object-contain rounded-lg border"
              />
            </div>
          )}

          {/* AI分析按钮 */}
          <div className="flex justify-center">
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !image}
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
          <div className="space-y-2">
            <Label htmlFor="category">分类</Label>
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
          <div className="space-y-2">
            <Label htmlFor="title">标题</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入图片标题"
            />
          </div>

          {/* 标签 */}
          <div className="space-y-2">
            <Label htmlFor="tags">标签</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="输入标签，用逗号分隔"
            />
          </div>

          {/* 中文提示词 */}
          <div className="space-y-2">
            <Label htmlFor="chinese-prompt">中文提示词</Label>
            <Textarea
              id="chinese-prompt"
              value={chinesePrompt}
              onChange={(e) => setChinesePrompt(e.target.value)}
              placeholder="输入中文描述"
              rows={3}
            />
          </div>

          {/* 英文提示词 */}
          <div className="space-y-2">
            <Label htmlFor="english-prompt">英文提示词</Label>
            <Textarea
              id="english-prompt"
              value={englishPrompt}
              onChange={(e) => setEnglishPrompt(e.target.value)}
              placeholder="输入英文描述"
              rows={3}
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !selectedCategory || !title.trim()}
              className="flex-1"
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

// 图片详情弹窗组件
function MaterialDetailDialog({
  open,
  onOpenChange,
  material,
  onSelectMaterial
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  material: any
  onSelectMaterial: (material: any) => void
}) {
  if (!material) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{material.title}</span>
            <Button
              variant="outline"
              onClick={() => onSelectMaterial(material)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              添加到画布
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto">
          {/* 图片预览 */}
          <div className="space-y-4">
            <div className="aspect-[3/4] bg-muted rounded-lg overflow-hidden">
              {material.image_url ? (
                <img
                  src={material.image_url}
                  alt={material.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* 标签 */}
            {material.tags && material.tags.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">标签</h4>
                <div className="flex flex-wrap gap-2">
                  {material.tags.map((tag: string, index: number) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 详细信息 */}
          <div className="space-y-4">
            {/* 基本信息 */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">基本信息</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p><span className="font-medium">分类:</span> {material.subcategory || '未分类'}</p>
                <p><span className="font-medium">创建时间:</span> {material.created_at ? new Date(material.created_at).toLocaleString() : '未知'}</p>
              </div>
            </div>

            {/* 中文提示词 */}
            {material.chinese_prompt && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">中文提示词</h4>
                <div className="p-3 bg-muted rounded-lg text-sm">
                  {material.chinese_prompt}
                </div>
              </div>
            )}

            {/* 英文提示词 */}
            {material.english_prompt && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">英文提示词</h4>
                <div className="p-3 bg-muted rounded-lg text-sm">
                  {material.english_prompt}
                </div>
              </div>
            )}

            {/* 如果没有提示词，显示提示信息 */}
            {!material.chinese_prompt && !material.english_prompt && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">AI分析</h4>
                <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                  暂无AI分析的提示词内容
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
