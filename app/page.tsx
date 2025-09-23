"use client"

import type React from "react"

// 添加CSS动画样式
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `
  document.head.appendChild(style)
}
import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Upload,
  FileText,
  Users,
  ImageIcon,
  Settings,
  Download,
  Copy,
  ChevronLeft,
  ChevronRight,
  Star,
  Grid3X3,
  Palette,
  Trash2,
  Edit,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Character {
  id?: string
  name: string
  role_type: string
  description: any
  tags: string[]
  chinese_prompt: string
  english_prompt: string
  matchedMaterial?: Material
  candidateMaterials?: Material[]
}

interface Material {
  id: string
  title: string
  image_url?: string
  original_filename?: string
  tags?: string[]
  chinese_prompt?: string
  english_prompt?: string
  matchScore?: number
}

interface Script {
  id: number | string
  title: string
}

function MaterialCard({
  material,
  isSelected = false,
  onSelect,
  showScore = false,
}: {
  material: Material
  isSelected?: boolean
  onSelect?: () => void
  showScore?: boolean
}) {
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (material.image_url) {
      const link = document.createElement("a")
      link.href = material.image_url
      link.download = material.original_filename || material.title
      link.click()
    }
  }

  return (
    <div
      className={cn(
        "relative group cursor-pointer rounded-lg overflow-hidden border transition-all duration-200",
        isSelected ? "border-primary ring-2 ring-primary/50" : "border-border hover:border-primary/50",
      )}
      onClick={onSelect}
    >
      <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
        {material.image_url ? (
          <img
            src={material.image_url || "/placeholder.svg"}
            alt={material.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
        )}
      </div>

      {/* 工具栏 */}
      <div className="absolute top-2 right-2 flex gap-1">
        {showScore && material.matchScore && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
            <Star className="w-3 h-3 mr-1" />
            {material.matchScore.toFixed(1)}
          </Badge>
        )}
        <Button
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          variant="secondary"
          onClick={handleDownload}
        >
          <Download className="w-3 h-3" />
        </Button>
      </div>

      {/* 标题 */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2">
        <p className="text-xs font-medium truncate">{material.title}</p>
        {material.tags && material.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {material.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs px-1 py-0 border-white/30 text-white">
                {tag}
              </Badge>
            ))}
            {material.tags.length > 3 && (
              <Badge variant="outline" className="text-xs px-1 py-0 border-white/30 text-white">
                +{material.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CharacterPromptsSection({
  selectedScript,
  setSelectedScript,
  generatedPrompts,
}: {
  selectedScript: string
  setSelectedScript: (script: string) => void
  generatedPrompts?: any
}) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedScriptId, setSelectedScriptId] = useState<string>("")
  // 注释掉素材匹配相关状态
  // const [selectedMaterials, setSelectedMaterials] = useState<{ [key: string]: Material }>({})
  const [expandedPrompt, setExpandedPrompt] = useState<{
    character: Character | null
    type: 'chinese' | 'english' | 'all'
  }>({ character: null, type: 'all' })

  // 删除角色相关状态
  const [characterToDelete, setCharacterToDelete] = useState<Character | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // 辅助函数：截取前5行文本
  const truncateToLines = (text: string, lines: number = 5) => {
    const textLines = text.split('\n')
    if (textLines.length <= lines) return text
    return textLines.slice(0, lines).join('\n')
  }

  // 辅助函数：格式化版本显示
  const formatVersions = (text: string) => {
    // 查找AI标记的版本格式：**版本1：** **版本2：** 等
    const versionPattern = /\*\*版本\d+[：:]\*\*/g

    // 如果找到版本标记，确保版本之间有换行
    if (versionPattern.test(text)) {
      // 在每个版本标记前添加换行（除了第一个）
      return text.replace(/(\*\*版本\d+[：:]\*\*)/g, (match, p1, offset) => {
        // 如果不是第一个版本标记，前面加换行
        return offset > 0 ? '\n' + match : match
      })
    }

    // 如果没有找到标准版本格式，直接返回原文本
    return text
  }

  // 辅助函数：复制文本到剪贴板
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // 简单的成功提示
      const toast = document.createElement('div')
      toast.textContent = '复制成功！'
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
      `
      document.body.appendChild(toast)
      setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in'
        setTimeout(() => document.body.removeChild(toast), 300)
      }, 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  // 删除角色处理函数
  const handleDeleteCharacter = (character: Character, event: React.MouseEvent) => {
    event.stopPropagation() // 防止触发其他点击事件
    setCharacterToDelete(character)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteCharacter = async () => {
    if (!characterToDelete) return

    setIsDeleting(true)
    try {
      // 如果角色有ID，说明已保存到数据库，需要从数据库删除
      if (characterToDelete.id) {
        const response = await fetch(`/api/characters/${characterToDelete.id}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          throw new Error('删除失败')
        }

        const data = await response.json()
        if (!data.success) {
          throw new Error(data.error || '删除失败')
        }
      }

      // 显示成功提示
      const toast = document.createElement('div')
      toast.textContent = '角色删除成功！'
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
      `
      document.body.appendChild(toast)
      setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in'
        setTimeout(() => document.body.removeChild(toast), 300)
      }, 2000)

      // 从当前角色列表中移除已删除的角色
      setCharacters(prevCharacters =>
        prevCharacters.filter(char => {
          // 如果角色有ID，按ID匹配；如果没有ID，按名称匹配
          if (characterToDelete.id) {
            return char.id !== characterToDelete.id
          } else {
            return char.name !== characterToDelete.name
          }
        })
      )

    } catch (error) {
      console.error('Delete error:', error)
      // 显示错误提示
      const toast = document.createElement('div')
      toast.textContent = error instanceof Error ? error.message : '删除失败'
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
      `
      document.body.appendChild(toast)
      setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in'
        setTimeout(() => document.body.removeChild(toast), 300)
      }, 2000)
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
      setCharacterToDelete(null)
    }
  }

  // 根据选中的剧本获取角色数据
  const fetchCharactersByScript = async (scriptId: string) => {
    try {
      const response = await fetch(`/api/characters?script_id=${scriptId}`)
      if (response.ok) {
        const charactersData = await response.json()
        setCharacters(Array.isArray(charactersData) ? charactersData : [])
      }
    } catch (error) {
      console.error("Error fetching characters:", error)
      setCharacters([])
    }
  }

  useEffect(() => {
    if (generatedPrompts) {
      console.log("[DEBUG] CharacterPromptsSection received generatedPrompts:", generatedPrompts)
      const charactersWithDefaults = (generatedPrompts.characters || []).map((char: Character) => ({
        ...char,
        candidateMaterials: char.candidateMaterials || [],
      }))
      console.log("[DEBUG] Characters with defaults:", charactersWithDefaults)

      setCharacters(charactersWithDefaults)
      setSelectedScript(generatedPrompts.scriptTitle)
      setSelectedScriptId("current") // 标记为当前生成内容

      // 仍然需要获取所有剧本列表用于下拉框
      const fetchAllScripts = async () => {
        try {
          const scriptsRes = await fetch("/api/scripts")
          const scriptsData = scriptsRes.ok ? await scriptsRes.json() : []
          setScripts(Array.isArray(scriptsData) ? scriptsData : [])
        } catch (error) {
          console.error("Error fetching scripts:", error)
          setScripts([])
        }
      }
      fetchAllScripts()

      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        const scriptsRes = await fetch("/api/scripts")
        const scriptsData = scriptsRes.ok ? await scriptsRes.json() : []

        setScripts(Array.isArray(scriptsData) ? scriptsData : [])

        if (scriptsData.length > 0) {
          // 默认选择第一个剧本
          const firstScript = scriptsData[0]
          setSelectedScript(firstScript.title)
          setSelectedScriptId(firstScript.id)

          // 获取该剧本的角色数据
          await fetchCharactersByScript(firstScript.id)
        }
      } catch (error) {
        console.error("[v0] Error fetching data:", error)
        setCharacters([])
        setScripts([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [generatedPrompts])

  // 处理剧本选择
  const handleScriptSelect = async (scriptId: string) => {
    if (!scriptId) return

    setSelectedScriptId(scriptId)

    if (scriptId === "current" && generatedPrompts) {
      // 显示当前生成的内容
      const charactersWithDefaults = (generatedPrompts.characters || []).map((char: Character) => ({
        ...char,
        candidateMaterials: char.candidateMaterials || [],
      }))
      setCharacters(charactersWithDefaults)
      setSelectedScript(generatedPrompts.scriptTitle)
      return
    }

    // 根据scriptId查找对应的剧本
    const selectedScript = scripts.find(s => s.id === scriptId)
    if (selectedScript) {
      setSelectedScript(selectedScript.title)
      // 获取该剧本的角色数据
      await fetchCharactersByScript(scriptId)
    }
  }

  // 由于characters已经通过fetchCharactersByScript按script_id过滤，不需要再次过滤
  const filteredCharacters = Array.isArray(characters) ? characters : []

  // 注释掉素材选择处理函数
  // const handleMaterialSelect = (characterName: string, material: Material) => {
  //   setSelectedMaterials((prev) => ({
  //     ...prev,
  //     [characterName]: material,
  //   }))
  // }

  // 注释掉素材显示逻辑
  // const getDisplayMaterial = (character: Character) => {
  //   // 优先返回用户手动选择的素材
  //   if (selectedMaterials[character.name]) {
  //     return selectedMaterials[character.name]
  //   }

  //   // 如果有候选素材，返回评分最高的（第一个）
  //   if (character.candidateMaterials && character.candidateMaterials.length > 0) {
  //     return character.candidateMaterials[0]
  //   }

  //   // 最后才返回matchedMaterial
  //   return character.matchedMaterial
  // }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p>加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">角色提示词</h2>
        </div>

        {/* 剧本选择器 - 放在标题下方，更显眼的位置 */}
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">选择剧本：</span>
            <Select value={selectedScriptId} onValueChange={handleScriptSelect}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="选择剧本" />
              </SelectTrigger>
              <SelectContent>
                {generatedPrompts && (
                  <SelectItem value="current">
                    {generatedPrompts.scriptTitle}
                  </SelectItem>
                )}
                {scripts.map((script) => (
                  <SelectItem key={script.id} value={String(script.id)}>
                    {script.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {filteredCharacters.map((character, index) => {
          // 注释掉素材相关变量
          // const displayMaterial = getDisplayMaterial(character)
          return (
            <Card key={character.id || index} className="overflow-hidden">
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm truncate flex-1 mr-2">{character.name}</CardTitle>
                  <div className="flex gap-1 flex-shrink-0">
                    <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                      {(character as any).role || (character.role_type === "main" ? "主角" : "配角")}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={(e) => handleDeleteCharacter(character, e)}
                      title="删除角色"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-3 pb-3">
                {/* 注释掉素材匹配图片显示部分 */}
                {/* <div className="relative">
                  <div className="aspect-[4/5] bg-muted rounded-md overflow-hidden relative">
                    {displayMaterial?.image_url ? (
                      <img
                        src={displayMaterial.image_url || "/placeholder.svg"}
                        alt={displayMaterial.title || character.name}
                        className="absolute inset-0 w-full h-full object-cover object-top"
                        style={{ display: "block" }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground text-center px-2">暂无匹配素材</p>
                      </div>
                    )}
                  </div>

                  <div className="absolute top-1.5 right-1.5 flex gap-1">
                    {displayMaterial && (
                      <Button
                        size="sm"
                        className="h-5 w-5 p-0"
                        variant="secondary"
                        onClick={() => {
                          if (displayMaterial.image_url) {
                            const link = document.createElement("a")
                            link.href = displayMaterial.image_url
                            link.download = displayMaterial.original_filename || character.name
                            link.click()
                          }
                        }}
                      >
                        <Download className="w-2.5 h-2.5" />
                      </Button>
                    )}

                    {hasCandidates && (
                      <Dialog>
                        <DialogTrigger>
                          <Button size="sm" className="h-5 w-5 p-0" variant="secondary">
                            <Grid3X3 className="w-2.5 h-2.5" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>选择匹配素材 - {character.name}</DialogTitle>
                          </DialogHeader>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                            {character.candidateMaterials.map((material, idx) => (
                              <MaterialCard
                                key={material.id}
                                material={material}
                                isSelected={selectedMaterials[character.name]?.id === material.id}
                                onSelect={() => handleMaterialSelect(character.name, material)}
                                showScore={true}
                              />
                            ))}
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>

                  <div className="absolute bottom-2 left-2">
                    <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                      {displayMaterial ? "匹配素材" : "无匹配"}
                    </Badge>
                  </div>
                </div> */}



                {/* 中文提示词 */}
                <div className="space-y-1 mt-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium text-xs">中文提示词</h5>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0 bg-transparent"
                      onClick={() => setExpandedPrompt({ character, type: 'chinese' })}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </Button>
                  </div>
                  <div className="relative p-2 bg-muted rounded-lg">
                    <div
                      className="text-xs font-mono leading-tight overflow-hidden [&::-webkit-scrollbar]:hidden"
                      style={{
                        maxHeight: '5.5em', // 约5行的高度
                        lineHeight: '1.1em',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none'
                      }}
                      onWheel={(e) => {
                        e.currentTarget.scrollTop += e.deltaY
                      }}
                      dangerouslySetInnerHTML={{
                        __html: formatVersions(character.chinese_prompt)
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br/>')
                      }}
                    />
                  </div>
                </div>

                {/* 英文提示词 */}
                <div className="space-y-1 mt-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium text-xs">English Prompt</h5>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0 bg-transparent"
                      onClick={() => setExpandedPrompt({ character, type: 'english' })}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </Button>
                  </div>
                  <div className="relative p-2 bg-muted rounded-lg">
                    <div
                      className="text-xs font-mono leading-tight overflow-hidden"
                      style={{
                        maxHeight: '5.5em', // 约5行的高度
                        lineHeight: '1.1em',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none'
                      }}
                      onWheel={(e) => {
                        e.currentTarget.scrollTop += e.deltaY
                      }}
                    >
                      {character.english_prompt}
                    </div>
                  </div>
                </div>


              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 提示词详情弹窗 */}
      <Dialog open={!!expandedPrompt.character} onOpenChange={() => setExpandedPrompt({ character: null, type: 'all' })}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-start justify-between">
              <span className="flex-1">提示词详情 - {expandedPrompt.character?.name}</span>
              <div className="flex flex-col items-end gap-2 ml-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (expandedPrompt.character) {
                      const allContent = `角色名称: ${expandedPrompt.character.name}

中文提示词:
${expandedPrompt.character.chinese_prompt}

英文提示词:
${expandedPrompt.character.english_prompt}`
                      copyToClipboard(allContent)
                    }
                  }}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  复制全部
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {expandedPrompt.character && (
            <div className="space-y-6 mt-4">
              {/* 中文提示词 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">中文提示词</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(expandedPrompt.character!.chinese_prompt)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{
                      __html: formatVersions(expandedPrompt.character.chinese_prompt)
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n/g, '<br/>')
                    }}
                  />
                </div>
              </div>

              {/* 英文提示词 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">English Prompt</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(expandedPrompt.character!.english_prompt)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{
                      __html: formatVersions(expandedPrompt.character.english_prompt)
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n/g, '<br/>')
                    }}
                  />
                </div>
              </div>


            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除角色</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              您确定要删除角色 "{characterToDelete?.name}" 吗？
            </p>
            <p className="text-sm text-red-600">
              {characterToDelete?.id
                ? "此操作将永久删除该角色的所有提示词数据，且无法恢复。"
                : "此操作将从当前列表中移除该角色。"
              }
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
                onClick={confirmDeleteCharacter}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
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
    </div>
  )
}

function formatDescription(description: any): string {
  // 直接返回字符串描述，不再解析复杂的嵌套结构
  if (typeof description === "string") {
    return description
  }

  if (typeof description === "object" && description !== null) {
    // 尝试将对象转换为可读的字符串显示
    try {
      return JSON.stringify(description, null, 2)
    } catch {
      return String(description) || "暂无描述"
    }
  }

  return String(description) || "暂无描述"
}

export default function ComicProductionTool() {
  const [activeSection, setActiveSection] = useState("script-analysis")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedScript, setSelectedScript] = useState("仙剑奇侠传")
  const [globalAnalysisResult, setGlobalAnalysisResult] = useState<{
    characters: Array<{ name: string; description: string; role_type: string }>
    scenes: Array<{ name: string; description: string }>
    title: string
    scriptId: string // 添加scriptId到state
  } | null>(null)

  const [generatedCharacterPrompts, setGeneratedCharacterPrompts] = useState<any>(null)
  const [generatedScenePrompts, setGeneratedScenePrompts] = useState<any>(null)

  const menuItems = [
    { id: "script-analysis", label: "剧本解析", icon: FileText },
    { id: "character-prompts", label: "角色提示词", icon: Users },
    { id: "scene-prompts", label: "场景提示词", icon: ImageIcon },
    { id: "canvas-generation", label: "画布生图", icon: Palette },
    { id: "material-library", label: "素材库", icon: ImageIcon },
    { id: "material-upload", label: "素材上传", icon: Upload },
  ]

  const renderContent = () => {
    switch (activeSection) {
      case "script-analysis":
        return (
          <ScriptAnalysisSection
            onNavigate={setActiveSection}
            analysisResult={globalAnalysisResult}
            setAnalysisResult={setGlobalAnalysisResult}
            onGenerateCharacterPrompts={setGeneratedCharacterPrompts}
            onGenerateScenePrompts={setGeneratedScenePrompts}
          />
        )
      case "character-prompts":
        return (
          <CharacterPromptsSection
            selectedScript={selectedScript}
            setSelectedScript={setSelectedScript}
            generatedPrompts={generatedCharacterPrompts}
          />
        )
      case "scene-prompts":
        return (
          <ScenePromptsSection
            selectedScript={selectedScript}
            setSelectedScript={setSelectedScript}
            generatedPrompts={generatedScenePrompts}
          />
        )
      case "canvas-generation":
        return <CanvasGenerationSection />
      case "material-library":
        return <MaterialLibrarySection />
      case "material-upload":
        return <MaterialUploadSection />
      default:
        return (
          <ScriptAnalysisSection
            onNavigate={setActiveSection}
            analysisResult={globalAnalysisResult}
            setAnalysisResult={setGlobalAnalysisResult}
            onGenerateCharacterPrompts={setGeneratedCharacterPrompts}
            onGenerateScenePrompts={setGeneratedScenePrompts}
          />
        )
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <div
        className={`${
          sidebarCollapsed ? "w-16" : "w-64"
        } fixed left-0 top-0 h-screen border-r border-border bg-card transition-all duration-300 flex flex-col z-50`}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
                  <FileText className="w-4 h-4 text-primary-foreground" />
                </div>
                <h1 className="text-lg font-semibold text-foreground">动态漫人设工具</h1>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-2">
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 overflow-y-auto">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <Button
                  key={item.id}
                  variant={activeSection === item.id ? "secondary" : "ghost"}
                  className={`w-full ${sidebarCollapsed ? "justify-center px-2" : "justify-start"}`}
                  onClick={() => setActiveSection(item.id)}
                >
                  <Icon className="w-4 h-4" />
                  {!sidebarCollapsed && <span className="ml-2">{item.label}</span>}
                </Button>
              )
            })}
          </div>
        </nav>

        {/* Settings */}
        <div className="p-2 border-t border-border flex-shrink-0">
          <Button variant="ghost" className={`w-full ${sidebarCollapsed ? "justify-center px-2" : "justify-start"}`}>
            <Settings className="w-4 h-4" />
            {!sidebarCollapsed && <span className="ml-2">设置</span>}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div
        className={`${
          sidebarCollapsed ? "ml-16" : "ml-64"
        } transition-all duration-300 min-h-screen overflow-auto`}
      >
        {renderContent()}
      </div>
    </div>
  )
}

function ScriptAnalysisSection({
  onNavigate,
  analysisResult,
  setAnalysisResult,
  onGenerateCharacterPrompts,
  onGenerateScenePrompts,
}: {
  onNavigate: (section: string) => void
  analysisResult: {
    characters: Array<{ name: string; description: string; role_type: string }>
    scenes: Array<{ name: string; description: string }>
    title: string
    scriptId: string // 添加scriptId到props
  } | null
  setAnalysisResult: (result: any) => void
  onGenerateCharacterPrompts: (prompts: any) => void
  onGenerateScenePrompts: (prompts: any) => void
}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [fileProcessingStatus, setFileProcessingStatus] = useState<"idle" | "processing" | "completed" | "error">("idle")
  const [fileProcessingError, setFileProcessingError] = useState<string>("")
  const [editingCharacter, setEditingCharacter] = useState<number | null>(null)
  const [editingScene, setEditingScene] = useState<number | null>(null)
  const [editingDescription, setEditingDescription] = useState("")
  const [isGeneratingCharacterPrompts, setIsGeneratingCharacterPrompts] = useState(false)
  const [isGeneratingScenePrompts, setIsGeneratingScenePrompts] = useState(false)
  const [selectedModel, setSelectedModel] = useState("")
  const [inputMethod, setInputMethod] = useState<"file" | "text">("file")
  const [textContent, setTextContent] = useState("")
  const [scriptTitle, setScriptTitle] = useState("")

  const availableModels = [
    {
      id: "google/gemini-flash-1.5",
      name: "Google Gemini Flash 1.5 (免费)",
      description: "1M tokens - 快速智能模型，免费使用",
      contextLength: "1M tokens",
      isFree: true
    },
    {
      id: "google/gemini-pro-1.5",
      name: "Google Gemini 1.5 Pro (付费)",
      description: "2M tokens - 多模态模型，支持图像",
      contextLength: "2M tokens",
      isFree: false
    },
    {
      id: "anthropic/claude-3.5-sonnet",
      name: "Claude 3.5 Sonnet (付费)",
      description: "200K tokens - 高质量文本分析",
      contextLength: "200K tokens",
      isFree: false
    }
  ]

  // 设置默认选择第一个模型
  useEffect(() => {
    if (!selectedModel && availableModels.length > 0) {
      setSelectedModel(availableModels[0].id)
    }
  }, [])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // 重置之前的状态
      setUploadedFile(file)
      setFileProcessingStatus("processing")
      setFileProcessingError("")
      setAnalysisResult(null) // 清除之前的分析结果

      try {
        // 验证文件并进行预处理
        await processUploadedFile(file)
        setFileProcessingStatus("completed")
      } catch (error) {
        console.error("File processing error:", error)
        setFileProcessingStatus("error")
        setFileProcessingError(error instanceof Error ? error.message : "文件处理失败")
      }
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const files = event.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      const fileName = file.name.toLowerCase()

      if (
        file.type === "text/plain" ||
        fileName.endsWith(".txt") ||
        fileName.endsWith(".docx")
      ) {
        // 重置之前的状态
        setUploadedFile(file)
        setFileProcessingStatus("processing")
        setFileProcessingError("")
        setAnalysisResult(null) // 清除之前的分析结果

        console.log("[DEBUG] 文件拖拽成功:", {
          name: file.name,
          type: file.type,
          size: file.size
        })

        try {
          await processUploadedFile(file)
          setFileProcessingStatus("completed")
        } catch (error) {
          console.error("File processing error:", error)
          setFileProcessingStatus("error")
          setFileProcessingError(error instanceof Error ? error.message : "文件处理失败")
        }
      } else {
        alert(`不支持的文件格式：${fileName.split('.').pop()?.toUpperCase()}\n\n支持的格式：\n• .txt (纯文本)\n• .docx (Word文档)`)
      }
    }
  }

  // 文件预处理函数
  const processUploadedFile = async (file: File) => {
    const fileName = file.name.toLowerCase()

    if (fileName.endsWith('.docx')) {
      // DOCX文件验证 - 只做基本检查，实际解析在分析时进行
      if (file.size > 50 * 1024 * 1024) { // 50MB限制
        throw new Error('DOCX文件过大，请选择小于50MB的文件')
      }
    } else if (fileName.endsWith('.txt') || file.type === "text/plain") {
      // TXT文件预读取验证
      const content = await file.text()
      if (!content.trim()) {
        throw new Error("文本文件内容为空")
      }
      if (content.length > 1000000) { // 1MB文本限制
        throw new Error('文本文件过大，请选择小于1MB的文件')
      }
    } else {
      throw new Error(`不支持的文件格式：${fileName.split('.').pop()?.toUpperCase()}。请上传 .txt（纯文本）或 .docx（Word文档）格式的文件。`)
    }

    // 模拟处理延迟，让用户看到处理状态
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  const handleAnalyze = async () => {
    console.log("[DEBUG] handleAnalyze started")
    let content = ""
    let title = ""

    if (inputMethod === "file") {
      if (!uploadedFile) {
        alert("请先选择文件")
        return
      }

      if (fileProcessingStatus === "processing") {
        alert("文件正在处理中，请稍候...")
        return
      }

      if (fileProcessingStatus === "error") {
        alert(`文件处理失败：${fileProcessingError}`)
        return
      }

      if (fileProcessingStatus !== "completed") {
        alert("请等待文件处理完成")
        return
      }

      try {
        // 根据文件类型选择不同的解析方法
        const fileName = uploadedFile.name.toLowerCase()

        if (fileName.endsWith('.docx')) {
          // DOCX文件需要服务端处理
          const formData = new FormData()
          formData.append('file', uploadedFile)

          const parseResponse = await fetch('/api/parse-document', {
            method: 'POST',
            body: formData
          })

          if (!parseResponse.ok) {
            const errorData = await parseResponse.json().catch(() => ({}))
            throw new Error(errorData.error || 'DOCX文件解析失败')
          }

          const parseResult = await parseResponse.json()
          content = parseResult.content

          if (!content.trim()) {
            throw new Error('DOCX文件内容为空或无法提取文本内容')
          }

          console.log("[DEBUG] 服务端解析成功:", parseResult.fileInfo)
        } else if (fileName.endsWith('.txt') || uploadedFile.type === "text/plain") {
          // 解析纯文本文件
          content = await uploadedFile.text()

          if (!content.trim()) {
            throw new Error("文本文件内容为空")
          }
        } else {
          throw new Error(`不支持的文件格式：${fileName.split('.').pop()?.toUpperCase()}。请上传 .txt（纯文本）或 .docx（Word文档）格式的文件。`)
        }

        title = uploadedFile.name.replace(/\.[^/.]+$/, "") // 移除文件扩展名

        console.log("[DEBUG] 文档解析成功:", {
          fileName: uploadedFile.name,
          fileType: uploadedFile.type,
          contentLength: content.length,
          contentPreview: content.substring(0, 100) + "..."
        })

      } catch (parseError) {
        console.error("[DEBUG] 文档解析失败:", parseError)
        let errorMessage = "文档解析失败"

        if (parseError instanceof Error) {
          errorMessage = parseError.message
        } else if (typeof parseError === 'string') {
          errorMessage = parseError
        }

        alert(`文档解析失败：${errorMessage}\n\n请确保：\n1. 文件格式正确（支持.txt、.docx）\n2. 文件未损坏\n3. 文件包含可读取的文本内容`)
        return
      }
    } else {
      if (!textContent.trim()) {
        alert("请输入剧本内容")
        return
      }
      if (!scriptTitle.trim()) {
        alert("请输入剧本标题")
        return
      }
      content = textContent.trim()
      title = scriptTitle.trim()
    }

    setIsAnalyzing(true)
    try {
      // 添加前端超时控制（70秒，比后端稍长）
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 70000)

      const response = await fetch("/api/analyze-script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({ content, title, model: selectedModel }),
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `服务器错误: ${response.status}`)
      }

      const result = await response.json()

      console.log("[DEBUG] Analysis result:", result)

      if (result.success) {
        setAnalysisResult({
          ...result.data,
          title: result.title,
          scriptId: result.scriptId, // 设置scriptId
        })

        // 移除弹窗提示，静默处理截断
        // if (result.truncated && result.truncationInfo) {
        //   const truncationMsg = `⚠️ 文本长度提示：...`
        //   alert(truncationMsg)
        // }
      } else {
        console.error("[DEBUG] Analysis failed:", result)
        const errorMessage = result.error || "分析失败，请重试"
        const debugInfo = result.debug ? `\n调试信息: ${JSON.stringify(result.debug, null, 2)}` : ""
        alert(errorMessage + debugInfo)
      }
    } catch (error) {
      console.error("Analysis error:", error)

      let errorMessage = "分析失败，请检查网络连接"
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = "请求超时，请稍后重试或使用更短的文本"
        } else if (error.message.includes('fetch')) {
          errorMessage = "网络连接错误，请检查网络后重试"
        }
      }

      alert(errorMessage)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleGenerateCharacterPrompts = async () => {
    if (!analysisResult) return

    setIsGeneratingCharacterPrompts(true)
    try {
      const response = await fetch("/api/generate-character-prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          characters: analysisResult.characters,
          scriptTitle: analysisResult.title,
          scriptId: analysisResult.scriptId || (analysisResult as any).scriptId, // 使用analysisResult.scriptId
        }),
      })

      const result = await response.json()
      console.log("[DEBUG] Character prompts result:", result)
      if (result.success) {
        console.log("[DEBUG] Generated character prompts data:", result.data)
        onGenerateCharacterPrompts(result.data)
        onNavigate("character-prompts")
      } else {
        alert(result.error || "生成角色提示词失败")
      }
    } catch (error) {
      console.error("Generate character prompts error:", error)
      alert("生成角色提示词失败，请重试")
    } finally {
      setIsGeneratingCharacterPrompts(false)
    }
  }

  const handleGenerateScenePrompts = async () => {
    if (!analysisResult) return

    setIsGeneratingScenePrompts(true)
    try {
      const response = await fetch("/api/generate-scene-prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scenes: analysisResult.scenes,
          scriptTitle: analysisResult.title,
          scriptId: analysisResult.scriptId, // 添加scriptId参数用于数据库更新
        }),
      })

      const result = await response.json()
      if (result.success) {
        onGenerateScenePrompts(result.data)
        onNavigate("scene-prompts")
      } else {
        alert(result.error || "生成场景提示词失败")
      }
    } catch (error) {
      console.error("Generate scene prompts error:", error)
      alert("生成场景提示词失败，请重试")
    } finally {
      setIsGeneratingScenePrompts(false)
    }
  }

  const handleEditCharacter = (index: number) => {
    setEditingCharacter(index)
    const description = analysisResult?.characters[index].description
    setEditingDescription(formatDescription(description) || "")
  }

  const handleSaveCharacter = (index: number) => {
    if (analysisResult) {
      const updatedCharacters = [...analysisResult.characters]
      updatedCharacters[index] = {
        ...updatedCharacters[index],
        description: editingDescription,
      }
      setAnalysisResult({
        ...analysisResult,
        characters: updatedCharacters,
      })
    }
    setEditingCharacter(null)
    setEditingDescription("")
  }

  const handleEditScene = (index: number) => {
    setEditingScene(index)
    const description = analysisResult?.scenes[index].description
    setEditingDescription(formatDescription(description) || "")
  }

  const handleSaveScene = (index: number) => {
    if (analysisResult) {
      const updatedScenes = [...analysisResult.scenes]
      updatedScenes[index] = {
        ...updatedScenes[index],
        description: editingDescription,
      }
      setAnalysisResult({
        ...analysisResult,
        scenes: updatedScenes,
      })
    }
    setEditingScene(null)
    setEditingDescription("")
  }

  const handleCancelEdit = () => {
    setEditingCharacter(null)
    setEditingScene(null)
    setEditingDescription("")
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">剧本解析</h2>
      </div>

      {/* Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle>选择AI模型</CardTitle>
          <CardDescription>选择适合长文本处理的AI模型进行剧本解析</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="选择您想要的AI模型..." />
            </SelectTrigger>
            <SelectContent className="w-72">
              {availableModels.map((model) => (
                <SelectItem key={model.id} value={model.id} className="w-full">
                  <div className="flex flex-col w-full">
                    <div className="flex items-center gap-2 w-full">
                      <span className="font-medium text-sm truncate flex-1">{model.name}</span>
                      {model.isFree && (
                        <Badge variant="secondary" className="text-xs flex-shrink-0">免费</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground truncate w-full">{model.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-2 text-sm text-muted-foreground">
            当前选择: {availableModels.find(m => m.id === selectedModel)?.contextLength} 上下文长度
          </div>
        </CardContent>
      </Card>

      {/* Input Method Selection */}
      <Card>
        <CardHeader>
          <CardTitle>输入方式</CardTitle>
          <CardDescription>选择剧本内容的输入方式</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Button
              variant={inputMethod === "file" ? "default" : "outline"}
              onClick={() => setInputMethod("file")}
              className="flex-1"
            >
              <Upload className="w-4 h-4 mr-2" />
              文件上传
            </Button>
            <Button
              variant={inputMethod === "text" ? "default" : "outline"}
              onClick={() => setInputMethod("text")}
              className="flex-1"
            >
              <FileText className="w-4 h-4 mr-2" />
              直接输入
            </Button>
          </div>

          {inputMethod === "file" ? (
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">拖拽文件到此处或点击上传</p>
              <p className="text-sm text-muted-foreground mb-4">
                支持格式：
                <span className="font-medium text-foreground"> .txt</span>（纯文本）、
                <span className="font-medium text-foreground"> .docx</span>（Word文档）
                <br />
                <span className="text-xs text-muted-foreground mt-1 block">无文件大小限制，自动解析文档内容</span>
              </p>
              <div className="space-y-4">
                <input
                  type="file"
                  accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <Button onClick={() => document.getElementById("file-upload")?.click()} className="cursor-pointer">
                  选择文件
                </Button>
                {uploadedFile && (
                  <div className="text-sm text-muted-foreground flex items-center justify-center gap-2 mt-2">
                    <span>已选择: {uploadedFile.name}</span>
                    {fileProcessingStatus === "processing" && (
                      <div className="flex items-center gap-1 text-blue-600">
                        <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs">处理中...</span>
                      </div>
                    )}
                    {fileProcessingStatus === "completed" && (
                      <div className="flex items-center gap-1 text-green-600">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs">已就绪</span>
                      </div>
                    )}
                    {fileProcessingStatus === "error" && (
                      <div className="flex items-center gap-1 text-red-600">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs">处理失败</span>
                      </div>
                    )}
                  </div>
                )}
                {fileProcessingStatus === "error" && fileProcessingError && (
                  <div className="text-xs text-red-600 mt-1 text-center">
                    错误: {fileProcessingError}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">剧本标题</label>
                <Input
                  value={scriptTitle}
                  onChange={(e) => setScriptTitle(e.target.value)}
                  placeholder="请输入剧本标题..."
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">剧本内容</label>
                <Textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="请输入完整的剧本内容，支持超长文本（最多2M tokens）..."
                  className="w-full min-h-[300px] resize-y"
                  style={{ maxHeight: '600px' }}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  当前字符数: {textContent.length} | 支持超长文本，无字符限制
                </div>
              </div>
            </div>
          )}

          {((inputMethod === "file" && uploadedFile) || (inputMethod === "text" && textContent.trim() && scriptTitle.trim())) && (
            <div className="mt-4 flex justify-center">
              <Button
                onClick={handleAnalyze}
                disabled={
                  isAnalyzing ||
                  (inputMethod === "file" && fileProcessingStatus !== "completed")
                }
                className="px-8 py-2 min-w-[160px]"
              >
                {isAnalyzing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>AI分析中...</span>
                  </div>
                ) : (
                  "开始AI分析"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>


      {analysisResult && (
        <>
          {/* Characters Batch Display */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>提取的人物角色</CardTitle>
                  <CardDescription>
                    《{analysisResult.title}》- 共发现 {analysisResult.characters.length} 个角色
                  </CardDescription>
                </div>
                <Button onClick={handleGenerateCharacterPrompts} disabled={isGeneratingCharacterPrompts}>
                  {isGeneratingCharacterPrompts ? "生成中..." : "前往生成提示词"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analysisResult.characters.map((character, i) => (
                  <div key={i} className="p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{character.name}</h4>
                      <Badge variant="secondary">{character.role_type === "main" ? "主角" : "配角"}</Badge>
                    </div>
                    {editingCharacter === i ? (
                      <div className="space-y-3">
                        <Textarea
                          value={editingDescription}
                          onChange={(e) => setEditingDescription(e.target.value)}
                          rows={3}
                          className="text-sm"
                        />
                        <div className="flex space-x-2">
                          <Button size="sm" onClick={() => handleSaveCharacter(i)}>
                            保存
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground mb-3">
                          {formatDescription(character.description)}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full bg-transparent"
                          onClick={() => handleEditCharacter(i)}
                        >
                          编辑描述
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Scenes Batch Display */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>提取的场景背景</CardTitle>
                  <CardDescription>
                    《{analysisResult.title}》- 共发现 {analysisResult.scenes.length} 个场景
                  </CardDescription>
                </div>
                <Button onClick={handleGenerateScenePrompts} disabled={isGeneratingScenePrompts}>
                  {isGeneratingScenePrompts ? "生成中..." : "前往生成提示词"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analysisResult.scenes.map((scene, i) => (
                  <div key={i} className="p-4 border border-border rounded-lg">
                    <h4 className="font-medium mb-2">{scene.name}</h4>
                    {editingScene === i ? (
                      <div className="space-y-3">
                        <Textarea
                          value={editingDescription}
                          onChange={(e) => setEditingDescription(e.target.value)}
                          rows={3}
                          className="text-sm"
                        />
                        <div className="flex space-x-2">
                          <Button size="sm" onClick={() => handleSaveScene(i)}>
                            保存
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground mb-3">{formatDescription(scene.description)}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full bg-transparent"
                          onClick={() => handleEditScene(i)}
                        >
                          编辑描述
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function ScenePromptsSection({
  selectedScript,
  setSelectedScript,
  generatedPrompts,
}: {
  selectedScript: string
  setSelectedScript: (script: string) => void
  generatedPrompts?: any
}) {
  const [scenes, setScenes] = useState<any[]>([])
  const [scripts, setScripts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPrompt, setExpandedPrompt] = useState<{ scene: any | null; type: 'chinese' | 'english' | 'all' }>({ scene: null, type: 'all' })
  const [selectedScriptId, setSelectedScriptId] = useState<string>("")

  // 根据选中的剧本获取场景数据
  const fetchScenesByScript = async (scriptId: string) => {
    try {
      const response = await fetch(`/api/scenes?script_id=${scriptId}`)
      if (response.ok) {
        const scenesData = await response.json()
        setScenes(Array.isArray(scenesData) ? scenesData : [])
      }
    } catch (error) {
      console.error("Error fetching scenes:", error)
      setScenes([])
    }
  }

  useEffect(() => {
    if (generatedPrompts) {
      console.log("[DEBUG] ScenePromptsSection received generatedPrompts:", generatedPrompts)
      setScenes(generatedPrompts.scenes || [])
      setSelectedScript(generatedPrompts.scriptTitle)
      setSelectedScriptId("current") // 标记为当前生成内容

      // 仍然需要获取所有剧本列表用于下拉框
      const fetchAllScripts = async () => {
        try {
          const scriptsRes = await fetch("/api/scripts")
          const scriptsData = scriptsRes.ok ? await scriptsRes.json() : []
          setScripts(Array.isArray(scriptsData) ? scriptsData : [])
        } catch (error) {
          console.error("Error fetching scripts:", error)
          setScripts([])
        }
      }
      fetchAllScripts()

      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        const scriptsRes = await fetch("/api/scripts")
        const scriptsData = scriptsRes.ok ? await scriptsRes.json() : []

        setScripts(Array.isArray(scriptsData) ? scriptsData : [])

        if (scriptsData.length > 0) {
          // 默认选择第一个剧本
          const firstScript = scriptsData[0]
          setSelectedScript(firstScript.title)
          setSelectedScriptId(firstScript.id)

          // 获取该剧本的场景数据
          await fetchScenesByScript(firstScript.id)
        }
      } catch (error) {
        console.error("[v0] Error fetching scenes data:", error)
        setScenes([])
        setScripts([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [generatedPrompts])

  // 处理剧本选择
  const handleScriptSelect = async (scriptId: string) => {
    if (!scriptId) return

    setSelectedScriptId(scriptId)

    if (scriptId === "current" && generatedPrompts) {
      // 显示当前生成的内容
      setScenes(generatedPrompts.scenes || [])
      setSelectedScript(generatedPrompts.scriptTitle)
      return
    }

    // 根据scriptId查找对应的剧本
    const selectedScript = scripts.find(s => s.id === scriptId)
    if (selectedScript) {
      setSelectedScript(selectedScript.title)
      // 获取该剧本的场景数据
      await fetchScenesByScript(scriptId)
    }
  }

  // 由于scenes已经通过fetchScenesByScript按script_id过滤，不需要再次过滤
  const filteredScenes = Array.isArray(scenes) ? scenes : []

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p>加载中...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">场景提示词</h2>
        </div>

        {/* 剧本选择器 - 放在标题下方，更显眼的位置 */}
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">选择剧本：</span>
            <Select value={selectedScriptId} onValueChange={handleScriptSelect}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="选择剧本" />
              </SelectTrigger>
              <SelectContent>
                {generatedPrompts && (
                  <SelectItem value="current">
                    {generatedPrompts.scriptTitle}
                  </SelectItem>
                )}
                {scripts.map((script) => (
                  <SelectItem key={script.id} value={script.id}>
                    {script.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredScenes.map((scene, index) => (
          <Card key={scene.id || index}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{scene.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* 注释掉素材匹配图片显示部分 */}
              {/* <div className="relative">
                <div className="aspect-[4/3] bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                  {scene.matchedMaterial?.image_url ? (
                    <img
                      src={scene.matchedMaterial.image_url || "/placeholder.svg"}
                      alt={scene.matchedMaterial.title || scene.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <Button
                  size="sm"
                  className="absolute top-1 right-1 h-6 w-6 p-0"
                  variant="secondary"
                  onClick={() => {
                    if (scene.matchedMaterial?.image_url) {
                      const link = document.createElement("a")
                      link.href = scene.matchedMaterial.image_url
                      link.download = scene.matchedMaterial.original_filename || scene.name
                      link.click()
                    }
                  }}
                >
                  <Download className="w-3 h-3" />
                </Button>
                <div className="absolute bottom-1 left-1">
                  <Badge variant="secondary" className="text-xs px-1 py-0">
                    {scene.matchedMaterial ? "匹配素材" : "无匹配"}
                  </Badge>
                </div>
              </div> */}

              {/* 中文提示词 */}
              <div className="space-y-1 mt-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-xs">中文提示词</h5>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 w-6 p-0 bg-transparent"
                    onClick={() => setExpandedPrompt({ scene, type: 'chinese' })}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </Button>
                </div>
                <div className="relative p-2 bg-muted rounded-lg">
                  <div
                    className="text-xs font-mono leading-tight overflow-hidden [&::-webkit-scrollbar]:hidden"
                    style={{
                      maxHeight: '5.5em', // 约5行的高度
                      lineHeight: '1.1em',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none'
                    }}
                    onWheel={(e) => {
                      e.currentTarget.scrollTop += e.deltaY
                    }}
                  >
                    {scene.chinese_prompt}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-1 right-1 h-5 w-5 p-0 opacity-60 hover:opacity-100"
                    onClick={() => navigator.clipboard.writeText(scene.chinese_prompt)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* 英文提示词 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-xs">English Prompt</h5>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 w-6 p-0 bg-transparent"
                    onClick={() => setExpandedPrompt({ scene, type: 'english' })}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </Button>
                </div>
                <div className="relative p-2 bg-muted rounded-lg">
                  <div
                    className="text-xs font-mono leading-tight overflow-hidden [&::-webkit-scrollbar]:hidden"
                    style={{
                      maxHeight: '5.5em', // 约5行的高度
                      lineHeight: '1.1em',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none'
                    }}
                    onWheel={(e) => {
                      e.currentTarget.scrollTop += e.deltaY
                    }}
                  >
                    {scene.english_prompt}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-1 right-1 h-5 w-5 p-0 opacity-60 hover:opacity-100"
                    onClick={() => navigator.clipboard.writeText(scene.english_prompt)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 提示词详情弹窗 */}
      <Dialog open={!!expandedPrompt.scene} onOpenChange={() => setExpandedPrompt({ scene: null, type: 'all' })}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-start justify-between">
              <span className="flex-1">提示词详情 - {expandedPrompt.scene?.name}</span>
              <div className="flex flex-col items-end gap-2 ml-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (expandedPrompt.scene) {
                      const allContent = `场景名称: ${expandedPrompt.scene.name}
场景描述: ${expandedPrompt.scene.description || ''}

中文提示词:
${expandedPrompt.scene.chinese_prompt}

English Prompt:
${expandedPrompt.scene.english_prompt}`
                      navigator.clipboard.writeText(allContent)
                    }
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  复制全部
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {expandedPrompt.scene && (
            <div className="space-y-6">
              {/* 场景描述 */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">场景描述</h3>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm leading-relaxed">{expandedPrompt.scene.description}</p>
                </div>
              </div>

              {/* 中文提示词 */}
              {(expandedPrompt.type === 'chinese' || expandedPrompt.type === 'all') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">中文提示词</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigator.clipboard.writeText(expandedPrompt.scene.chinese_prompt)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-mono leading-relaxed whitespace-pre-wrap">
                      {expandedPrompt.scene.chinese_prompt}
                    </p>
                  </div>
                </div>
              )}

              {/* 英文提示词 */}
              {(expandedPrompt.type === 'english' || expandedPrompt.type === 'all') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">English Prompt</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigator.clipboard.writeText(expandedPrompt.scene.english_prompt)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-mono leading-relaxed whitespace-pre-wrap">
                      {expandedPrompt.scene.english_prompt}
                    </p>
                  </div>
                </div>
              )}

              {/* 注释掉匹配素材部分 */}
              {/* {expandedPrompt.scene.matchedMaterial && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">匹配素材</h3>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-start gap-4">
                      <img
                        src={expandedPrompt.scene.matchedMaterial.image_url}
                        alt={expandedPrompt.scene.matchedMaterial.title}
                        className="w-32 h-24 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium">{expandedPrompt.scene.matchedMaterial.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {expandedPrompt.scene.matchedMaterial.description}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => {
                            const link = document.createElement("a")
                            link.href = expandedPrompt.scene.matchedMaterial.image_url
                            link.download = expandedPrompt.scene.matchedMaterial.original_filename || expandedPrompt.scene.name
                            link.click()
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          下载素材
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )} */}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MaterialLibrarySection() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [materials, setMaterials] = useState<any[]>([])
  const [allMaterials, setAllMaterials] = useState<any[]>([]) // 用于计数的所有素材
  const [loading, setLoading] = useState(false)
  const [materialToDelete, setMaterialToDelete] = useState<any | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchMaterials = async (subcategory?: string) => {
    setLoading(true)
    try {
      const url = subcategory ? `/api/materials?subcategory=${subcategory}` : "/api/materials"
      console.log("[DEBUG] Fetching materials from:", url)

      const response = await fetch(url)
      if (!response.ok) throw new Error("Failed to fetch materials")

      const data = await response.json()
      console.log("[DEBUG] Received materials:", data.length, "items")
      console.log("[DEBUG] Sample material:", data[0])

      setMaterials(data)

      // 如果是获取所有素材（没有筛选），也更新allMaterials用于计数
      if (!subcategory) {
        setAllMaterials(data)
        console.log("[DEBUG] Updated allMaterials with", data.length, "items")
      }
    } catch (error) {
      console.error("Error fetching materials:", error)
      setMaterials([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMaterials()
  }, [])

  const handleCategorySelect = (categoryId: string) => {
    const newCategory = selectedCategory === categoryId ? null : categoryId
    setSelectedCategory(newCategory)

    if (newCategory) {
      fetchMaterials(newCategory) // 直接传递细分类ID
    } else {
      fetchMaterials() // 不传参数，获取所有素材
    }
  }

  const handleDeleteMaterial = async () => {
    if (!materialToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/materials/${materialToDelete.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // 从当前显示的素材列表中移除
        setMaterials(prev => prev.filter(material => material.id !== materialToDelete.id))
        // 从所有素材列表中移除（用于计数）
        setAllMaterials(prev => prev.filter(material => material.id !== materialToDelete.id))
        setShowDeleteConfirm(false)
        setMaterialToDelete(null)

        // 显示成功提示
        const toast = document.createElement('div')
        toast.textContent = '素材删除成功！'
        toast.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          z-index: 9999;
          font-size: 14px;
        `
        document.body.appendChild(toast)
        setTimeout(() => document.body.removeChild(toast), 3000)
      } else {
        console.error('Failed to delete material')
        alert('删除失败，请重试')
      }
    } catch (error) {
      console.error('Error deleting material:', error)
      alert('删除失败，请重试')
    } finally {
      setIsDeleting(false)
    }
  }

  const characterCategories = [
    { id: "ancient-male", name: "古代男", count: allMaterials.filter((m) => m.subcategory === "ancient-male").length },
    { id: "ancient-female", name: "古代女", count: allMaterials.filter((m) => m.subcategory === "ancient-female").length },
    { id: "modern-male", name: "现代男", count: allMaterials.filter((m) => m.subcategory === "modern-male").length },
    { id: "modern-female", name: "现代女", count: allMaterials.filter((m) => m.subcategory === "modern-female").length },
    { id: "fantasy", name: "架空", count: allMaterials.filter((m) => m.subcategory === "fantasy").length },
  ]

  const sceneCategories = [
    { id: "ancient-residence", name: "古代住宅", count: allMaterials.filter((m) => m.subcategory === "ancient-residence").length },
    { id: "ancient-location", name: "古代场所", count: allMaterials.filter((m) => m.subcategory === "ancient-location").length },
    { id: "modern-residence", name: "现代住宅", count: allMaterials.filter((m) => m.subcategory === "modern-residence").length },
    { id: "modern-location", name: "现代场所", count: allMaterials.filter((m) => m.subcategory === "modern-location").length },
    { id: "nature", name: "自然", count: allMaterials.filter((m) => m.subcategory === "nature").length },
  ]

  return (
    <div className="p-6">
      <div className="flex gap-6">
        <div className="w-64 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">角色分类</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {characterCategories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "secondary" : "ghost"}
                  className="w-full justify-between text-sm"
                  onClick={() => handleCategorySelect(category.id)}
                >
                  <span>{category.name}</span>
                  <span className="text-muted-foreground">({category.count})</span>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">场景分类</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {sceneCategories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "secondary" : "ghost"}
                  className="w-full justify-between text-sm"
                  onClick={() => handleCategorySelect(category.id)}
                >
                  <span>{category.name}</span>
                  <span className="text-muted-foreground">({category.count})</span>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex-1">
          {selectedCategory && (
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                已选择分类: {[...characterCategories, ...sceneCategories].find((c) => c.id === selectedCategory)?.name}
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">加载中...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {materials.map((material) => (
                  <div
                    key={material.id}
                    className="group cursor-pointer hover:shadow-md transition-shadow overflow-hidden rounded-lg bg-muted"
                  >
                    <div className="relative aspect-[3/4] bg-muted overflow-hidden rounded-lg">
                      {material.image_url ? (
                        <img
                          src={material.image_url || "/placeholder.svg"}
                          alt={material.title}
                          className="absolute inset-0 w-full h-full object-cover object-top"
                          style={{ display: "block" }}
                        />
                      ) : (
                        <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-100">
                          <ImageIcon className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}

                      {/* 下载按钮 - 悬浮在右上角 */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMaterialToDelete(material)
                            setShowDeleteConfirm(true)
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (material.image_url) {
                              try {
                                // 获取图片数据
                                const response = await fetch(material.image_url)
                                const blob = await response.blob()

                                // 创建下载链接
                                const url = window.URL.createObjectURL(blob)
                                const link = document.createElement("a")
                                link.href = url
                                link.download = material.original_filename || `${material.title}.jpg`
                                document.body.appendChild(link)
                                link.click()

                                // 清理
                                document.body.removeChild(link)
                                window.URL.revokeObjectURL(url)
                              } catch (error) {
                                console.error("下载失败:", error)
                                // 降级到直接链接下载
                                const link = document.createElement("a")
                                link.href = material.image_url
                                link.download = material.original_filename || material.title
                                link.target = "_blank"
                                link.click()
                              }
                            }
                          }}
                        >
                          <Download className="w-3 h-3" />
                        </Button>

                        <Button
                          size="sm"
                          variant="default"
                          onClick={(e) => {
                            e.stopPropagation()
                            // 跳转到画布页面，携带素材信息
                            const params = new URLSearchParams({
                              materialId: material.id,
                              imageUrl: material.image_url || ""
                            })
                            window.open(`/canvas?${params.toString()}`, '_blank')
                          }}
                          title="前往画布编辑"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent h-20" />

                      <div className="absolute inset-x-0 bottom-0 p-3 space-y-1.5">
                        <p className="text-sm font-medium text-white truncate">
                          {material.title || material.original_filename || "未命名素材"}
                        </p>
                        {material.tags && material.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {material.tags.slice(0, 3).map((tag: string, index: number) => (
                              <Badge
                                key={index}
                                variant="secondary"
                                className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30 backdrop-blur-sm"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除素材</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>确定要删除素材 "{materialToDelete?.title || materialToDelete?.original_filename || '未命名素材'}" 吗？</p>
            <p className="text-sm text-muted-foreground">此操作无法撤销。</p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setMaterialToDelete(null)
                }}
                disabled={isDeleting}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteMaterial}
                disabled={isDeleting}
              >
                {isDeleting ? '删除中...' : '确认删除'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MaterialUploadSection() {
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<{
    name: string
    tags: string[]
    chinesePrompt: string
    englishPrompt: string
    file: File
    previewUrl: string
  } | null>(null)
  const [editableTags, setEditableTags] = useState("")
  const [editableChinesePrompt, setEditableChinesePrompt] = useState("")
  const [editableEnglishPrompt, setEditableEnglishPrompt] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      alert("请上传支持的图片格式：.jpg, .png, .webp")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("文件大小不能超过10MB")
      return
    }

    // 检查是否选择了分类
    if (!selectedCategory) {
      alert("请先选择素材分类")
      return
    }

    setIsAnalyzing(true)
    console.log("[v0] Starting material analysis for:", file.name, "with category:", selectedCategory)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("category", "temp") // 临时分类，仅用于AI分析

      const response = await fetch("/api/analyze-material", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`分析失败: ${response.status}`)
      }

      const data = await response.json()
      console.log("[v0] Material analysis completed:", data)

      if (data.success && data.analysis) {
        // 创建图片预览URL
        const previewUrl = URL.createObjectURL(file)

        const analysis = {
          name: file.name,
          tags: data.analysis.tags || [],
          chinesePrompt: data.analysis.chinese_prompt || "",
          englishPrompt: data.analysis.english_prompt || "",
          file: file, // 保存文件对象，用于后续上传
          previewUrl: previewUrl, // 添加预览URL
        }

        setUploadedImage(analysis)
        setEditableTags(analysis.tags.join(", "))
        setEditableChinesePrompt(analysis.chinesePrompt)
        setEditableEnglishPrompt(analysis.englishPrompt)
        // 保持用户选择的分类，不重置
        setShowUploadModal(true)
      } else {
        throw new Error("AI分析返回数据格式错误")
      }
    } catch (error) {
      console.error("[v0] Material analysis error:", error)
      alert(`素材分析失败: ${error instanceof Error ? error.message : "未知错误"}`)
    } finally {
      setIsAnalyzing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleConfirmUpload = async () => {
    if (!uploadedImage || !selectedCategory) {
      alert("请确保已选择分类")
      return
    }

    // 防止重复点击
    if (isUploading) {
      return
    }

    setIsUploading(true)
    console.log("Uploading material with:", {
      name: uploadedImage?.name,
      category: selectedCategory,
      tags: editableTags.split(",").map((tag) => tag.trim()),
      chinesePrompt: editableChinesePrompt,
      englishPrompt: editableEnglishPrompt,
    })

    try {
      const formData = new FormData()
      formData.append("file", uploadedImage.file)
      formData.append("category", selectedCategory)
      formData.append("tags", editableTags)
      formData.append("chinese_prompt", editableChinesePrompt)
      formData.append("english_prompt", editableEnglishPrompt)

      const response = await fetch("/api/analyze-material", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`上传失败: ${response.status}`)
      }

      const data = await response.json()
      console.log("[v0] Material uploaded successfully:", data)

      // 成功提示
      alert("素材上传成功！")

      // 重置状态
      setShowUploadModal(false)
      // 清理预览URL
      if (uploadedImage?.previewUrl) {
        URL.revokeObjectURL(uploadedImage.previewUrl)
      }
      setUploadedImage(null)
      setSelectedCategory("")
      setEditableTags("")
      setEditableChinesePrompt("")
      setEditableEnglishPrompt("")

      // 素材上传成功，用户可以手动刷新素材库页面查看
    } catch (error) {
      console.error("[v0] Material upload error:", error)
      alert(`素材上传失败: ${error instanceof Error ? error.message : "未知错误"}`)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">素材上传</h2>

      <Card>
        <CardHeader>
          <CardTitle>上传素材</CardTitle>
          <CardDescription>上传图片素材，AI将自动提取标签和提示词</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 分类选择 */}
          <div className="mb-6">
            <label className="text-sm font-medium mb-2 block">
              选择素材分类 <span className="text-red-500">*</span>
            </label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择素材分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ancient-male">古代男</SelectItem>
                <SelectItem value="ancient-female">古代女</SelectItem>
                <SelectItem value="modern-male">现代男</SelectItem>
                <SelectItem value="modern-female">现代女</SelectItem>
                <SelectItem value="fantasy">架空</SelectItem>
                <SelectItem value="ancient-residence">古代住宅</SelectItem>
                <SelectItem value="ancient-location">古代场所</SelectItem>
                <SelectItem value="modern-residence">现代住宅</SelectItem>
                <SelectItem value="modern-location">现代场所</SelectItem>
                <SelectItem value="nature">自然</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">拖拽图片到此处或点击上传</p>
            <p className="text-sm text-muted-foreground mb-4">支持 .jpg, .png, .webp 格式</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button onClick={handleImageUpload} disabled={isAnalyzing || !selectedCategory}>
              {isAnalyzing ? "AI分析中..." : selectedCategory ? "选择图片" : "请先选择分类"}
            </Button>
          </div>

          <div className="mt-6 space-y-4">
            <h4 className="font-medium">已上传的素材</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {uploadedImage && (
                <div className="flex items-center space-x-4 p-4 border border-border rounded-lg">
                  <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h4 className="font-medium">{uploadedImage.name}</h4>
                    <p className="text-sm text-muted-foreground">AI分析完成</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {isAnalyzing && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span>AI正在分析图片内容，请稍候...</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={showUploadModal}
        onOpenChange={(open) => {
          // 上传过程中不允许关闭弹窗
          if (!isUploading) {
            if (!open && uploadedImage?.previewUrl) {
              // 弹窗关闭时清理预览URL
              URL.revokeObjectURL(uploadedImage.previewUrl)
            }
            setShowUploadModal(open)
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>确认素材信息</DialogTitle>
            <DialogDescription>AI已自动分析图片并生成标签和提示词，您可以编辑后确认上传</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                {uploadedImage?.previewUrl ? (
                  <img
                    src={uploadedImage.previewUrl}
                    alt={uploadedImage.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <h4 className="font-medium">{uploadedImage?.name}</h4>
                <p className="text-sm text-muted-foreground">AI分析完成</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                分类 <span className="text-red-500">*</span>
              </label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择素材分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ancient-male">古代男</SelectItem>
                  <SelectItem value="ancient-female">古代女</SelectItem>
                  <SelectItem value="modern-male">现代男</SelectItem>
                  <SelectItem value="modern-female">现代女</SelectItem>
                  <SelectItem value="fantasy">架空</SelectItem>
                  <SelectItem value="ancient-residence">古代住宅</SelectItem>
                  <SelectItem value="ancient-location">古代场所</SelectItem>
                  <SelectItem value="modern-residence">现代住宅</SelectItem>
                  <SelectItem value="modern-location">现代场所</SelectItem>
                  <SelectItem value="nature">自然</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">标签 (用逗号分隔)</label>
              <Input
                value={editableTags}
                onChange={(e) => setEditableTags(e.target.value)}
                placeholder="黑衣侠客, 古装, 男性"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">中文提示词</label>
              <Textarea
                value={editableChinesePrompt}
                onChange={(e) => setEditableChinesePrompt(e.target.value)}
                rows={3}
                placeholder="输入中文提示词..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">英文提示词</label>
              <Textarea
                value={editableEnglishPrompt}
                onChange={(e) => setEditableEnglishPrompt(e.target.value)}
                rows={3}
                placeholder="Enter English prompt..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!isUploading) {
                  // 清理预览URL
                  if (uploadedImage?.previewUrl) {
                    URL.revokeObjectURL(uploadedImage.previewUrl)
                  }
                  setShowUploadModal(false)
                }
              }}
              disabled={isUploading}
            >
              取消
            </Button>
            <Button
              onClick={handleConfirmUpload}
              disabled={!selectedCategory || isUploading}
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  上传中...
                </>
              ) : (
                "确认上传"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CanvasGenerationSection() {
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">画布生图工具</h1>
          <p className="text-muted-foreground text-lg">
            拖拽素材到画布，组合创作，一键生成精美图片
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              进入画布工作区
            </CardTitle>
            <CardDescription>
              在画布中自由组合角色和场景素材，创作独特的漫画场景
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="font-semibold">功能特色</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 拖拽式操作，直观易用</li>
                    <li>• 多图层管理，精确控制</li>
                    <li>• 实时预览，所见即所得</li>
                    <li>• 一键导出高清图片</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">支持素材</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 角色素材（古代、现代、架空）</li>
                    <li>• 场景背景（住宅、场所、自然）</li>
                    <li>• 自定义上传的图片素材</li>
                    <li>• AI生成的角色和场景</li>
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button
                  size="lg"
                  className="w-full md:w-auto"
                  onClick={() => {
                    // 在新标签页中打开画布页面
                    window.open('/canvas', '_blank')
                  }}
                >
                  <Palette className="w-4 h-4 mr-2" />
                  打开画布工作区
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">快速开始</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ol className="space-y-2">
                <li>1. 点击"打开画布工作区"</li>
                <li>2. 从素材库选择图片</li>
                <li>3. 拖拽到画布中</li>
                <li>4. 调整位置和大小</li>
                <li>5. 导出最终作品</li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">操作技巧</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="space-y-2">
                <li>• 按住Shift多选图片</li>
                <li>• 拖拽边角调整大小</li>
                <li>• 右键菜单更多选项</li>
                <li>• Ctrl+Z撤销操作</li>
                <li>• 双击图片查看详情</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">导出选项</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="space-y-2">
                <li>• PNG格式（透明背景）</li>
                <li>• JPG格式（压缩优化）</li>
                <li>• 自定义分辨率</li>
                <li>• 高清质量输出</li>
                <li>• 批量导出支持</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
