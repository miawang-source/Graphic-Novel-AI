'use client'

import React from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  MouseSensor,
  useSensor,
  useSensors,
  DragMoveEvent,
} from '@dnd-kit/core'
import { restrictToParentElement } from '@dnd-kit/modifiers'
import { DraggableImage } from './DraggableImage'

interface CanvasImage {
  id: string
  src: string
  x: number
  y: number
  width: number
  height: number
}

interface DraggableCanvasProps {
  images: CanvasImage[]
  selectedImages: string[]
  scale: number
  offsetX: number
  offsetY: number
  onImageMove: (imageId: string, deltaX: number, deltaY: number) => void
  onImageSelect: (imageId: string, event: React.MouseEvent) => void
  onImageSave: (src: string) => void
  onResizeStart: (imageId: string, event: React.MouseEvent) => void
  onDrop: (event: React.DragEvent) => void
  onCanvasMouseDown?: (event: React.MouseEvent) => void
  children?: React.ReactNode
}

export function DraggableCanvas({
  images,
  selectedImages,
  scale,
  offsetX,
  offsetY,
  onImageMove,
  onImageSelect,
  onImageSave,
  onResizeStart,
  onDrop,
  onCanvasMouseDown,
  children
}: DraggableCanvasProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [dragStartPosition, setDragStartPosition] = React.useState({ x: 0, y: 0 })

  // 配置传感器，确保点击事件优先于拖拽
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 15, // 增加到15px，确保不会干扰点击
        delay: 200,   // 增加到200ms延迟，让点击事件有足够时间处理
        tolerance: 8
      },
    }),
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 15,
        delay: 200,
        tolerance: 8
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setActiveId(active.id as string)
    
    // 记录拖拽开始位置
    const image = images.find(img => img.id === active.id)
    if (image) {
      setDragStartPosition({ x: image.x, y: image.y })
    }
  }

  const handleDragMove = (event: DragMoveEvent) => {
    // 拖拽过程中由DndKit自动处理transform，无需手动更新位置
    // 这样可以获得最佳的性能和流畅度
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { delta } = event

    if (activeId && delta) {
      // 最终位置调整
      const deltaX = delta.x / scale
      const deltaY = delta.y / scale

      // 如果是多选，移动所有选中的图片
      if (selectedImages.includes(activeId)) {
        selectedImages.forEach(imageId => {
          onImageMove(imageId, deltaX, deltaY)
        })
      } else {
        onImageMove(activeId, deltaX, deltaY)
      }
    }

    setActiveId(null)
    setDragStartPosition({ x: 0, y: 0 })
  }

  const activeImage = activeId ? images.find(img => img.id === activeId) : null

  return (
    <DndContext
      sensors={sensors}
      modifiers={[restrictToParentElement]}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div
        className="w-full h-full relative"
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onMouseDown={onCanvasMouseDown}
        style={{
          transform: `scale(${scale}) translate3d(${offsetX}px, ${offsetY}px, 0)`,
          transformOrigin: 'center center',
          cursor: 'inherit',
          willChange: 'transform' // 提示浏览器优化变换
        }}
      >
        {/* 渲染所有图片 */}
        {images.map((image) => (
          <DraggableImage
            key={image.id}
            id={image.id}
            src={image.src}
            x={image.x}
            y={image.y}
            width={image.width}
            height={image.height}
            isSelected={selectedImages.includes(image.id)}
            onSelect={onImageSelect}
            onSave={onImageSave}
            onResizeStart={onResizeStart}
          />
        ))}
        
        {children}
      </div>

      {/* 拖拽时的预览 */}
      <DragOverlay>
        {activeImage ? (
          <div
            className="opacity-80 cursor-grabbing"
            style={{
              width: activeImage.width,
              height: activeImage.height,
            }}
          >
            <img
              src={activeImage.src}
              alt="Dragging"
              className="w-full h-full object-contain rounded-lg"
              draggable={false}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
