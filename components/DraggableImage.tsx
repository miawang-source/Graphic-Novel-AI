'use client'

import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Download, Save, Archive } from 'lucide-react'

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

interface DraggableImageProps {
  id: string
  src: string
  x: number
  y: number
  width: number
  height: number
  isSelected: boolean
  image: CanvasImage
  onSelect: (id: string, event: React.MouseEvent) => void
  onSave: (src: string) => void
  onDownloadOriginal: (image: CanvasImage) => void
  onSaveToLibrary: (image: CanvasImage) => void
  onResizeStart: (id: string, event: React.MouseEvent) => void
}

export function DraggableImage({
  id,
  src,
  x,
  y,
  width,
  height,
  isSelected,
  image,
  onSelect,
  onSave,
  onDownloadOriginal,
  onSaveToLibrary,
  onResizeStart
}: DraggableImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: id,
    data: {
      type: 'image',
      id: id,
    },
  })

  const style = {
    position: 'absolute' as const,
    left: x,
    top: y,
    width: width,
    height: height,
    // 在拖拽过程中不应用transform，因为位置已经通过实时更新的x, y坐标来处理
    // 这样避免了双重移动和松开鼠标时的"晃动"效果
    transform: 'translate3d(0, 0, 0)',
    userSelect: 'none' as const,
    zIndex: isDragging ? 1000 : 1,
    willChange: isDragging ? 'transform' : 'auto', // 拖拽时启用硬件加速
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-draggable-image="true"
      className={`cursor-pointer ${
        isDragging
          ? 'cursor-grabbing opacity-80'
          : `cursor-grab transition-all duration-150 ${
              isSelected
                ? 'ring-2 ring-blue-500 ring-offset-2'
                : 'hover:ring-1 hover:ring-gray-300'
            }`
      }`}
      onPointerDown={(e) => {
        // 优化拖拽启动，避免与点击冲突
        e.stopPropagation()
      }}
      onClick={(e) => {
        // 只在非拖拽状态下处理点击
        if (!isDragging) {
          console.log('[DEBUG] DraggableImage onClick:', {
            id,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            button: e.button
          })
          onSelect(id, e)
        }
      }}
      {...listeners}
      {...attributes}
    >
      <img
        src={src}
        alt="Canvas image"
        className="w-full h-full object-contain rounded-lg pointer-events-none"
        draggable={false}
      />
      
      {/* 选中时的工具栏和调整手柄 */}
      {isSelected && (
        <>
          {/* 工具栏 */}
          <div className="absolute -top-10 left-0 flex gap-1">
            <Button
              size="sm"
              variant="secondary"
              className="h-6 px-2"
              onClick={(e) => {
                e.stopPropagation()
                onDownloadOriginal(image)
              }}
              title="下载高清原图"
            >
              <Download className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-6 px-2"
              onClick={(e) => {
                e.stopPropagation()
                onSaveToLibrary(image)
              }}
              title="保存到素材库"
            >
              <Archive className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-6 px-2"
              onClick={(e) => {
                e.stopPropagation()
                onSave(src)
              }}
              title="保存图片"
            >
              <Save className="w-3 h-3" />
            </Button>
          </div>
          
          {/* 调整大小手柄（右下角） */}
          <div
            className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-sm cursor-se-resize hover:bg-blue-600 transition-colors"
            onMouseDown={(e) => {
              e.stopPropagation()
              onResizeStart(id, e)
            }}
            style={{
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }}
          />
          
          {/* 四个角的调整点（类似Figma） */}
          <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 border border-white rounded-sm" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 border border-white rounded-sm" />
          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 border border-white rounded-sm" />
        </>
      )}
    </div>
  )
}
