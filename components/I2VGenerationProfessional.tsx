"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Upload,
  Video,
  ImageIcon,
  Settings,
  Download,
  Plus,
  X,
  Clock,
  ChevronRight,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MaterialLibrarySelector } from "@/components/MaterialLibrarySelector"

// 视频任务类型
interface VideoTask {
  id: string
  task_id: string
  status: string
  progress: number
  model: string
  mode: string
  prompt: string
  duration: number
  resolution: string
  aspect_ratio: string
  video_url: string | null
  thumbnail_url: string | null
  created_at: string
  source_image_url?: string
}

export function I2VGenerationProfessional() {
  // 模型选择
  const [selectedModel, setSelectedModel] = useState<"doubao" | "kling" | "vidu">("doubao")
  
  // 生成模式
  const [mode, setMode] = useState<"single" | "dual" | "multi">("single")
  const [firstFrameImage, setFirstFrameImage] = useState<string | null>(null)
  const [lastFrameImage, setLastFrameImage] = useState<string | null>(null)
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  
  // 提示词
  const [positivePrompt, setPositivePrompt] = useState("")
  const [negativePrompt, setNegativePrompt] = useState("")
  
  // 生成参数
  const [duration, setDuration] = useState(5)
  const [resolution, setResolution] = useState<"480p" | "720p" | "1080p">("720p")
  const [motionIntensity, setMotionIntensity] = useState<"small" | "medium" | "large">("medium")
  const [batchSize, setBatchSize] = useState(1)
  const [cameraMovement, setCameraMovement] = useState<"fixed" | "free">("free")
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9">("16:9")
  
  // 高级配置
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [seed, setSeed] = useState<number | null>(null)
  const [cfgScale, setCfgScale] = useState(7)
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedVideos, setGeneratedVideos] = useState<VideoTask[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [pollingTasks, setPollingTasks] = useState<Set<string>>(new Set())

  // 加载历史记录
  const loadHistory = async (): Promise<VideoTask[]> => {
    setIsLoadingHistory(true)
    try {
      const response = await fetch("/api/i2v/history?limit=20")
      const data = await response.json()
      if (data.success && data.data) {
        setGeneratedVideos(data.data)
        return data.data as VideoTask[]
      }
      return []
    } catch (error) {
      console.error("加载历史记录失败:", error)
      return []
    } finally {
      setIsLoadingHistory(false)
    }
  }

  // 轮询任务状态
  const pollTaskStatus = async (taskId: string) => {
    const maxAttempts = 120 // 10分钟超时
    let attempts = 0

    const poll = async () => {
      try {
        attempts++
        const response = await fetch(`/api/i2v/status?task_id=${taskId}`)
        const data = await response.json()

        if (response.ok && data.success) {
          const { status } = data.data

          // 刷新历史记录以获取最新状态
          await loadHistory()

          if (status === "completed" || status === "failed") {
            // 任务完成，从轮询列表移除
            setPollingTasks(prev => {
              const next = new Set(prev)
              next.delete(taskId)
              return next
            })
            return
          }
        }

        // 继续轮询
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000)
        } else {
          // 超时，停止轮询
          setPollingTasks(prev => {
            const next = new Set(prev)
            next.delete(taskId)
            return next
          })
        }
      } catch (error) {
        console.error("[轮询] 错误:", error)
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000)
        }
      }
    }

    setTimeout(poll, 3000)
  }

  // 开始轮询某个任务
  const startPolling = (taskId: string) => {
    setPollingTasks(prev => {
      if (prev.has(taskId)) return prev // 已经在轮询
      const next = new Set(prev)
      next.add(taskId)
      pollTaskStatus(taskId)
      return next
    })
  }

  // 组件加载时获取历史记录，并恢复未完成任务的轮询
  useEffect(() => {
    const init = async () => {
      const tasks = await loadHistory()
      // 找出所有进行中的任务，恢复轮询
      tasks.forEach((task: VideoTask) => {
        if (task.status === "pending" || task.status === "processing") {
          startPolling(task.task_id)
        }
      })
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 快速模板
  const promptTemplates = [
    { label: "基础模板", prompt: "人物眼神微微变化，嘴角轻微上扬，头发随风飘动，背景虚化" },
    { label: "人物微表情", prompt: "人物表情自然变化，眼神灵动，微笑，头部轻微转动" },
    { label: "空镜头", prompt: "镜头缓慢推进，画面稳定，光影变化自然" },
    { label: "动作场景", prompt: "人物动作流畅，肢体自然摆动，环境氛围感强" },
    { label: "微表情特写", prompt: "面部表情细腻变化，眼神聚焦，嘴角微动" },
    { label: "环境氛围", prompt: "环境光影变化，氛围感强，细节丰富" },
    { label: "多图参考", prompt: "参考多张图片的风格和动作，生成连贯的视频" },
    { label: "电影级质感", prompt: "电影级画面质感，光影层次丰富，色彩饱和度高" },
  ]

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "first" | "last" | "reference") => {
    const files = e.target.files
    if (!files) return

    if (type === "reference") {
      Array.from(files).forEach((file) => {
        const reader = new FileReader()
        reader.onload = (event) => {
          const imageUrl = event.target?.result as string
          setReferenceImages((prev) => [...prev, imageUrl])
        }
        reader.readAsDataURL(file)
      })
    } else {
      const file = files[0]
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string
        if (type === "first") {
          setFirstFrameImage(imageUrl)
        } else {
          setLastFrameImage(imageUrl)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleGenerate = async () => {
    if (mode === "single" && !firstFrameImage) {
      alert("请上传首帧图片")
      return
    }
    if (mode === "dual" && (!firstFrameImage || !lastFrameImage)) {
      alert("请上传首帧和尾帧图片")
      return
    }
    if (mode === "multi" && referenceImages.length < 2) {
      alert("多图参考模式需要至少2张图片")
      return
    }
    if (!positivePrompt) {
      alert("请输入正向提示词")
      return
    }

    setIsGenerating(true)
    
    try {
      const response = await fetch("/api/i2v/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: selectedModel,
          mode,
          sourceImageUrl: firstFrameImage,
          endFrameImageUrl: mode === "dual" ? lastFrameImage : null,
          referenceImages: mode === "multi" ? referenceImages : [],
          prompt: positivePrompt,
          negativePrompt,
          duration,
          motionIntensity,
          batchSize,
          cameraFixed: cameraMovement === "fixed",
          aspectRatio,
          resolution,
          seed,
          cfgScale,
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "生成失败")
      }

      // 立即刷新历史记录显示新任务
      await loadHistory()

      // 为每个任务启动轮询
      const taskIds = data.data.task_ids || [data.data.task_id]
      taskIds.forEach((taskId: string) => {
        startPolling(taskId)
      })

    } catch (error) {
      alert(`提交失败: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">图生视频配置</h2>
        <p className="text-sm text-muted-foreground">专业的AI视频生成工具</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：配置区 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 模型选择 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">选择模型</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedModel("doubao")}
                  className={cn(
                    "w-full flex items-center justify-between p-2.5 border-2 rounded-lg transition-all text-left",
                    selectedModel === "doubao"
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎬</span>
                    <div>
                      <div className="text-sm font-medium">Seedance</div>
                      <div className="text-xs text-muted-foreground">单图、双图、多图</div>
                    </div>
                  </div>
                  {selectedModel === "doubao" && (
                    <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </button>

                <button
                  onClick={() => setSelectedModel("kling")}
                  className={cn(
                    "w-full flex items-center justify-between p-2.5 border-2 rounded-lg transition-all text-left opacity-50 cursor-not-allowed",
                    "border-gray-200"
                  )}
                  disabled
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">✨</span>
                    <div>
                      <div className="text-sm font-medium flex items-center gap-2">
                        Kling
                        <span className="text-xs px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">即将上线</span>
                      </div>
                      <div className="text-xs text-muted-foreground">单图</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedModel("vidu")}
                  className={cn(
                    "w-full flex items-center justify-between p-2.5 border-2 rounded-lg transition-all text-left opacity-50 cursor-not-allowed",
                    "border-gray-200"
                  )}
                  disabled
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎥</span>
                    <div>
                      <div className="text-sm font-medium flex items-center gap-2">
                        Vidu
                        <span className="text-xs px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">即将上线</span>
                      </div>
                      <div className="text-xs text-muted-foreground">单图、双图</div>
                    </div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* 生成模式选择 */}
          <Card>
            <CardHeader>
              <CardTitle>生成模式</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setMode("single")}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border-2 rounded-lg transition-all",
                    mode === "single"
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <ImageIcon className="w-8 h-8 mb-2" />
                  <div className="text-sm font-medium">首帧图片</div>
                  <div className="text-xs text-muted-foreground">单图生成</div>
                </button>

                <button
                  onClick={() => setMode("dual")}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border-2 rounded-lg transition-all",
                    mode === "dual"
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="flex gap-1 mb-2">
                    <ImageIcon className="w-6 h-6" />
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-medium">首尾帧</div>
                  <div className="text-xs text-muted-foreground">过渡动画</div>
                </button>

                <button
                  onClick={() => setMode("multi")}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border-2 rounded-lg transition-all",
                    mode === "multi"
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    <ImageIcon className="w-5 h-5" />
                    <ImageIcon className="w-5 h-5" />
                    <ImageIcon className="w-5 h-5" />
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium">多图参考</div>
                  <div className="text-xs text-muted-foreground">2+图片</div>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* 图片上传区 */}
          <Card>
            <CardHeader>
              <CardTitle>图片上传</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === "single" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">请选择首帧图片</label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                    {firstFrameImage ? (
                      <div className="relative inline-block">
                        <img src={firstFrameImage} alt="首帧" className="max-h-64 rounded" />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => setFirstFrameImage(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <label className="cursor-pointer block">
                          <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                          <p className="text-sm font-medium mb-1">点击上传图片</p>
                          <p className="text-xs text-muted-foreground">支持 JPG、PNG 格式</p>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageUpload(e, "first")}
                          />
                        </label>
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">或</span>
                          </div>
                        </div>
                        <MaterialLibrarySelector
                          onSelect={(imageUrl) => setFirstFrameImage(imageUrl)}
                          trigger={
                            <Button variant="outline" className="w-full">
                              <ImageIcon className="w-4 h-4 mr-2" />
                              从素材库选择
                            </Button>
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {mode === "dual" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">请选择首帧图片</label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary transition-colors">
                      {firstFrameImage ? (
                        <div className="relative">
                          <img src={firstFrameImage} alt="首帧" className="max-h-48 rounded mx-auto" />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1"
                            onClick={() => setFirstFrameImage(null)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="cursor-pointer block">
                            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-xs mb-2">上传首帧</p>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleImageUpload(e, "first")}
                            />
                          </label>
                          <MaterialLibrarySelector
                            onSelect={(imageUrl) => setFirstFrameImage(imageUrl)}
                            trigger={
                              <Button variant="ghost" size="sm" className="w-full text-xs">
                                素材库
                              </Button>
                            }
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">请选择尾帧图片</label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary transition-colors">
                      {lastFrameImage ? (
                        <div className="relative">
                          <img src={lastFrameImage} alt="尾帧" className="max-h-48 rounded mx-auto" />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1"
                            onClick={() => setLastFrameImage(null)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="cursor-pointer block">
                            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-xs mb-2">上传尾帧</p>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleImageUpload(e, "last")}
                            />
                          </label>
                          <MaterialLibrarySelector
                            onSelect={(imageUrl) => setLastFrameImage(imageUrl)}
                            trigger={
                              <Button variant="ghost" size="sm" className="w-full text-xs">
                                素材库
                              </Button>
                            }
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {mode === "multi" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">上传参考图片（2-4张）</label>
                  <div className="grid grid-cols-4 gap-2">
                    {/* 显示4个位置，已上传的显示图片，未上传的显示虚线框 */}
                    {[0, 1, 2, 3].map((index) => {
                      const hasImage = referenceImages[index]
                      return (
                        <div key={index} className="relative">
                          {hasImage ? (
                            // 已上传的图片
                            <div className="relative border rounded-lg p-1 h-24">
                              <img
                                src={referenceImages[index]}
                                alt={`参考${index + 1}`}
                                className="w-full h-full object-cover rounded"
                              />
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute -top-1 -right-1 w-5 h-5 p-0 rounded-full"
                                onClick={() =>
                                  setReferenceImages(referenceImages.filter((_, i) => i !== index))
                                }
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            // 空位置 - 虚线框
                            <label className="border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors h-24 bg-muted/30">
                              <div className="text-center">
                                <Plus className="w-6 h-6 mx-auto text-muted-foreground" />
                                <p className="text-xs text-muted-foreground mt-1">图{index + 1}</p>
                              </div>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleImageUpload(e, "reference")}
                              />
                            </label>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex justify-center">
                    <MaterialLibrarySelector
                      mode="single"
                      selectedImages={referenceImages}
                      onSelect={(imageUrl) => {
                        if (referenceImages.length < 4 && !referenceImages.includes(imageUrl)) {
                          setReferenceImages([...referenceImages, imageUrl])
                        }
                      }}
                      trigger={
                        <Button variant="outline" size="sm" disabled={referenceImages.length >= 4}>
                          <ImageIcon className="w-4 h-4 mr-2" />
                          从素材库选择 ({referenceImages.length}/4)
                        </Button>
                      }
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 豆包高级配置 */}
          <Card>
            <CardHeader className="cursor-pointer" onClick={() => setShowAdvanced(!showAdvanced)}>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  高级配置
                </CardTitle>
                <ChevronRight className={cn("w-5 h-5 transition-transform", showAdvanced && "rotate-90")} />
              </div>
            </CardHeader>
            {showAdvanced && (
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">分辨率</label>
                  <Select value={resolution} onValueChange={(v: any) => setResolution(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="480p">480p (标清)</SelectItem>
                      <SelectItem value="720p">720p (高清) - 推荐</SelectItem>
                      <SelectItem value="1080p">1080p (全高清)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">注意：1080p 在 Seedance 1.5 pro 和参考图模式下不支持</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">宽高比</label>
                  <Select value={aspectRatio} onValueChange={(v: any) => setAspectRatio(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9 (横屏)</SelectItem>
                      <SelectItem value="9:16">9:16 (竖屏)</SelectItem>
                      <SelectItem value="1:1">1:1 (方形)</SelectItem>
                      <SelectItem value="4:3">4:3 (传统横屏)</SelectItem>
                      <SelectItem value="3:4">3:4 (传统竖屏)</SelectItem>
                      <SelectItem value="21:9">21:9 (超宽屏)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {resolution === "480p" && aspectRatio === "16:9" && "像素: 864×480 (1.0) / 864×496 (1.5)"}
                    {resolution === "720p" && aspectRatio === "16:9" && "像素: 1248×704 (1.0) / 1280×720 (1.5)"}
                    {resolution === "1080p" && aspectRatio === "16:9" && "像素: 1920×1088 (仅1.0)"}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">镜头运动</label>
                  <Select value={cameraMovement} onValueChange={(v: any) => setCameraMovement(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">自由运动</SelectItem>
                      <SelectItem value="fixed">固定镜头</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">固定镜头会在提示词中追加固定摄像头指令</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">随机种子 (可选)</label>
                  <Input
                    type="number"
                    placeholder="留空则随机 (-1)"
                    value={seed || ""}
                    onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : null)}
                    min="-1"
                    max={Math.pow(2, 32) - 1}
                  />
                  <p className="text-xs text-muted-foreground">
                    相同种子会生成类似结果，-1 或留空表示随机
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">CFG Scale: {cfgScale}</label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={cfgScale}
                    onChange={(e) => setCfgScale(Number(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    控制提示词遵循程度，值越高越严格遵循提示词
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* 生成参数 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                生成参数
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  视频时长
                </label>
                <Select value={duration.toString()} onValueChange={(v) => setDuration(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2秒</SelectItem>
                    <SelectItem value="3">3秒</SelectItem>
                    <SelectItem value="4">4秒</SelectItem>
                    <SelectItem value="5">5秒 (推荐)</SelectItem>
                    <SelectItem value="6">6秒</SelectItem>
                    <SelectItem value="7">7秒</SelectItem>
                    <SelectItem value="8">8秒</SelectItem>
                    <SelectItem value="9">9秒</SelectItem>
                    <SelectItem value="10">10秒</SelectItem>
                    <SelectItem value="11">11秒</SelectItem>
                    <SelectItem value="12">12秒</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">支持 2-12 秒，时长越长成本越高</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">运动幅度</label>
                <Select value={motionIntensity} onValueChange={(v: any) => setMotionIntensity(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">小 - 微动作</SelectItem>
                    <SelectItem value="medium">中等 - 适中动作</SelectItem>
                    <SelectItem value="large">大 - 明显动作</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">控制画面中物体的运动幅度</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">生成数量（多次抽卡）</label>
                <Select value={batchSize.toString()} onValueChange={(v) => setBatchSize(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1个版本 - 生成1个版本</SelectItem>
                    <SelectItem value="2">2个版本</SelectItem>
                    <SelectItem value="3">3个版本</SelectItem>
                    <SelectItem value="4">4个版本</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* 快速模板 */}
          <Card>
            <CardHeader>
              <CardTitle>快速模板</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {promptTemplates.map((template, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => setPositivePrompt(template.prompt)}
                    className="text-xs"
                  >
                    {template.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 提示词 */}
          <Card>
            <CardHeader>
              <CardTitle>正向提示词</CardTitle>
              <CardDescription>描述画面中的动作、表情、镜头运动等细节</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="人物眼神微微变化，嘴角轻微上扬，头发随风飘动，背景虚化"
                value={positivePrompt}
                onChange={(e) => setPositivePrompt(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>负向提示词</CardTitle>
              <CardDescription>描述你不想要的效果（可选）</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="描述不想要的内容或效果..."
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                rows={2}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-2">描述你不希望出现的内容或效果</p>
            </CardContent>
          </Card>

          {/* 生成按钮 */}
          <Button
            size="lg"
            className="w-full"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                生成中...
              </>
            ) : (
              <>
                <Video className="w-5 h-5 mr-2" />
                开始生成视频
              </>
            )}
          </Button>
        </div>

        {/* 右侧：生成结果 */}
        <div className="space-y-6">
          <Card className="flex flex-col max-h-[calc(100vh-120px)]">
            <CardHeader className="flex flex-row items-center justify-between flex-shrink-0">
              <div>
                <CardTitle>生成历史</CardTitle>
                <CardDescription>所有生成任务的历史记录</CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={loadHistory}
                disabled={isLoadingHistory}
              >
                <RefreshCw className={cn("w-4 h-4", isLoadingHistory && "animate-spin")} />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {isLoadingHistory && generatedVideos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-50" />
                  <p className="text-sm">加载中...</p>
                </div>
              ) : generatedVideos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">暂无生成记录</p>
                  <p className="text-xs mt-1">配置参数后点击生成</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {generatedVideos.map((video) => (
                    <div key={video.id} className="border rounded-lg p-3 space-y-3">
                      {/* 视频预览 */}
                      <div className="aspect-video bg-gray-100 rounded overflow-hidden">
                        {video.status === "completed" && video.video_url ? (
                          <video
                            src={`/api/i2v/proxy-video?url=${encodeURIComponent(video.video_url)}`}
                            poster={video.thumbnail_url || video.source_image_url}
                            controls
                            autoPlay
                            muted
                            loop
                            playsInline
                            className="w-full h-full object-cover"
                          />
                        ) : video.status === "failed" ? (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-red-50">
                            <X className="w-8 h-8 text-red-500 mb-2" />
                            <p className="text-sm text-red-600">生成失败</p>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                            <p className="text-sm text-muted-foreground">
                              {video.status === "processing" ? "生成中..." : "排队中..."}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* 任务信息标签 */}
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {/* 模型标签 */}
                          <Badge variant="secondary" className="text-xs">
                            🎬 {video.model === "doubao" ? "Seedance" : video.model}
                          </Badge>
                          
                          {/* 模式标签 */}
                          <Badge variant="outline" className="text-xs">
                            {video.mode === "single" && "📷 首帧"}
                            {video.mode === "dual" && "🎞️ 首尾帧"}
                            {video.mode === "multi" && "🖼️ 多图参考"}
                          </Badge>

                          {/* 时长标签 */}
                          {video.duration && (
                            <Badge variant="outline" className="text-xs">
                              ⏱️ {video.duration}秒
                            </Badge>
                          )}

                          {/* 分辨率标签 */}
                          {video.resolution && (
                            <Badge variant="outline" className="text-xs">
                              📺 {video.resolution}
                            </Badge>
                          )}

                          {/* 状态标签 */}
                          <Badge 
                            variant={video.status === "completed" ? "default" : video.status === "failed" ? "destructive" : "secondary"} 
                            className="text-xs"
                          >
                            {video.status === "completed" && "✓ 完成"}
                            {video.status === "failed" && "✗ 失败"}
                            {video.status === "processing" && "⏳ 生成中"}
                            {video.status === "pending" && "⏳ 等待中"}
                          </Badge>
                        </div>

                        {/* 提示词 */}
                        {video.prompt && (
                          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                            <p className="line-clamp-2">{video.prompt}</p>
                          </div>
                        )}

                        {/* 底部操作栏 */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            {video.created_at && (
                              <span>{new Date(video.created_at).toLocaleString('zh-CN', { 
                                month: '2-digit', 
                                day: '2-digit', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}</span>
                            )}
                          </div>
                          {video.status === "completed" && video.video_url && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7"
                              onClick={() => {
                                const link = document.createElement('a')
                                link.href = `/api/i2v/proxy-video?url=${encodeURIComponent(video.video_url!)}&download=1`
                                link.download = `video-${video.task_id}.mp4`
                                document.body.appendChild(link)
                                link.click()
                                document.body.removeChild(link)
                              }}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              下载
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
