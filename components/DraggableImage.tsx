'use client'

import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Download, Save } from 'lucide-react'

interface DraggableImageProps {
  id: string
  src: string
  x: number
  y: number
  width: number
  height: number
  isSelected: boolean
  onSelect: (id: string, event: React.MouseEvent) => void
  onSave: (src: string) => void
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
  onSelect,
  onSave,
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
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : 'translate3d(0, 0, 0)',
    userSelect: 'none' as const,
    zIndex: isDragging ? 1000 : 1,
    willChange: isDragging ? 'transform' : 'auto', // 拖拽时启用硬件加速
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`cursor-pointer ${
        isDragging
          ? 'cursor-grabbing opacity-80'
          : `cursor-grab transition-all duration-150 ${
              isSelected
                ? 'ring-2 ring-blue-500 ring-offset-2'
                : 'hover:ring-1 hover:ring-gray-300'
            }`
      }`}
      onClick={(e) => {
        // 确保点击事件优先于拖拽
        e.preventDefault()
        e.stopPropagation()
        console.log('[DEBUG] DraggableImage onClick:', {
          id,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          button: e.button
        })
        onSelect(id, e)
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
            <Button size="sm" variant="secondary" className="h-6 px-2">
              <Download className="w-3 h-3" />
            </Button>
            <Button 
              size="sm" 
              variant="secondary" 
              className="h-6 px-2"
              onClick={(e) => {
                e.stopPropagation()
                onSave(src)
              }}
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
