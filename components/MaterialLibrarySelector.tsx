"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Image as ImageIcon, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Material {
  id: string
  title: string
  image_url: string
  category_type: string
  subcategory?: string
  tags?: string[]
  chinese_prompt?: string
  english_prompt?: string
}

interface MaterialLibrarySelectorProps {
  onSelect: (imageUrl: string, material: Material) => void
  selectedImageUrl?: string
  trigger?: React.ReactNode
  mode?: "single" | "multiple"
  maxSelection?: number
  selectedImages?: string[]
}

export function MaterialLibrarySelector({
  onSelect,
  selectedImageUrl,
  trigger,
  mode = "single",
  maxSelection = 4,
  selectedImages = [],
}: MaterialLibrarySelectorProps) {
  const [open, setOpen] = useState(false)
  const [materials, setMaterials] = useState<Material[]>([])
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all")

  // 分类配置
  const categories = [
    { value: "all", label: "全部" },
    { value: "character", label: "角色" },
    { value: "scene", label: "场景" },
    { value: "fusion", label: "融合图片" },
  ]

  const subcategories: Record<string, { value: string; label: string }[]> = {
    character: [
      { value: "all", label: "全部" },
      { value: "ancient-male", label: "古代男" },
      { value: "ancient-female", label: "古代女" },
      { value: "modern-male", label: "现代男" },
      { value: "modern-female", label: "现代女" },
      { value: "fantasy", label: "奇幻" },
    ],
    scene: [
      { value: "all", label: "全部" },
      { value: "ancient-residence", label: "古代住宅" },
      { value: "ancient-location", label: "古代场所" },
      { value: "modern-residence", label: "现代住宅" },
      { value: "modern-location", label: "现代场所" },
      { value: "nature", label: "自然" },
    ],
    fusion: [
      { value: "all", label: "全部" },
      { value: "project-1", label: "项目1" },
      { value: "project-2", label: "项目2" },
      { value: "project-3", label: "项目3" },
      { value: "project-4", label: "项目4" },
      { value: "project-5", label: "项目5" },
    ],
  }

  // 加载素材
  useEffect(() => {
    if (open) {
      loadMaterials()
    }
  }, [open, selectedCategory, selectedSubcategory])

  // 搜索过滤
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredMaterials(materials)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = materials.filter((material) => {
      const titleMatch = material.title?.toLowerCase().includes(query)
      const tagsMatch = material.tags?.some((tag) => tag.toLowerCase().includes(query))
      const promptMatch =
        material.chinese_prompt?.toLowerCase().includes(query) ||
        material.english_prompt?.toLowerCase().includes(query)
      return titleMatch || tagsMatch || promptMatch
    })
    setFilteredMaterials(filtered)
  }, [searchQuery, materials])

  const loadMaterials = async () => {
    setLoading(true)
    try {
      let url = "/api/materials"
      const params = new URLSearchParams()

      // 如果选择了具体分类（不是"全部"），则添加分类筛选
      if (selectedCategory !== "all") {
        params.append("categoryType", selectedCategory)
        
        // 如果选择了子分类且不是"全部"，则添加子分类筛选
        if (selectedSubcategory !== "all") {
          params.append("subcategory", selectedSubcategory)
        }
      }
      // 如果是"全部"，则不添加任何筛选参数，显示所有素材

      if (params.toString()) {
        url += `?${params.toString()}`
      }

      const response = await fetch(url)
      if (!response.ok) throw new Error("加载素材失败")

      const data = await response.json()
      setMaterials(data)
      setFilteredMaterials(data)
    } catch (error) {
      console.error("加载素材失败:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (material: Material) => {
    if (mode === "multiple") {
      // 多选模式
      if (selectedImages.includes(material.image_url)) {
        // 已选中，不做处理（由父组件处理取消选择）
        return
      }
      if (selectedImages.length >= maxSelection) {
        alert(`最多只能选择${maxSelection}张图片`)
        return
      }
    }

    onSelect(material.image_url, material)

    if (mode === "single") {
      setOpen(false)
    }
  }

  const isSelected = (imageUrl: string) => {
    if (mode === "multiple") {
      return selectedImages.includes(imageUrl)
    }
    return selectedImageUrl === imageUrl
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <ImageIcon className="w-4 h-4 mr-2" />
            从素材库选择
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="left" className="w-[600px] sm:w-[700px] p-0">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle>选择素材</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-full">
          {/* 分类标签 */}
          <div className="px-6 space-y-4 pb-4 border-b">
            {/* 搜索栏 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索素材..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* 分类标签 */}
            <Tabs 
              value={selectedCategory} 
              onValueChange={(value) => {
                setSelectedCategory(value)
                setSelectedSubcategory("all") // 切换大分类时重置子分类
              }} 
              className="w-full"
            >
              <TabsList className="w-full grid grid-cols-4">
                {categories.map((cat) => (
                  <TabsTrigger key={cat.value} value={cat.value} className="text-xs">
                    {cat.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* 子分类 */}
            {selectedCategory !== "all" && subcategories[selectedCategory] && (
              <div className="flex gap-2 flex-wrap">
                {subcategories[selectedCategory].map((sub) => (
                  <Button
                    key={sub.value}
                    variant={selectedSubcategory === sub.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSubcategory(sub.value)}
                    className="text-xs"
                  >
                    {sub.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* 素材网格 */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMaterials.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                <p className="text-sm">暂无素材</p>
                <p className="text-xs mt-1">请尝试其他分类或搜索</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 p-4">
                {filteredMaterials.map((material) => (
                  <div
                    key={material.id}
                    className={cn(
                      "relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all",
                      isSelected(material.image_url)
                        ? "border-primary ring-2 ring-primary"
                        : "border-transparent hover:border-gray-300"
                    )}
                    onClick={() => handleSelect(material)}
                  >
                    {/* 图片 */}
                    <div className="aspect-square bg-muted">
                      <img
                        src={material.image_url}
                        alt={material.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = "/placeholder.svg"
                        }}
                      />
                    </div>

                    {/* 选中标记 */}
                    {isSelected(material.image_url) && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}

                    {/* 信息覆盖层 */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                      <p className="text-white text-xs font-medium truncate">{material.title}</p>
                      {material.tags && material.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {material.tags.slice(0, 2).map((tag, idx) => (
                            <Badge key={idx} variant="secondary" className="text-[10px] px-1 py-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
