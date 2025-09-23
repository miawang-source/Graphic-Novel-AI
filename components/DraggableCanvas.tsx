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
import { DraggableImage } from './DraggableImage'

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

interface DraggableCanvasProps {
  images: CanvasImage[]
  selectedImages: string[]
  scale: number
  offsetX: number
  offsetY: number
  onImageMove: (imageId: string, deltaX: number, deltaY: number) => void
  onImageSelect: (imageId: string, event: React.MouseEvent) => void
  onImageSave: (src: string) => void
  onImageDownloadOriginal: (image: CanvasImage) => void
  onImageSaveToLibrary: (image: CanvasImage) => void
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
  onImageDownloadOriginal,
  onImageSaveToLibrary,
  onResizeStart,
  onDrop,
  onCanvasMouseDown,
  children
}: DraggableCanvasProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [dragStartPosition, setDragStartPosition] = React.useState({ x: 0, y: 0 })
  const [initialImagePositions, setInitialImagePositions] = React.useState<Record<string, { x: number, y: number }>>({})

  // 配置传感器，优化拖拽响应速度
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // 进一步减少距离，提高响应性
        // 移除delay，实现即时响应
      },
    }),
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 3,
        // 移除delay，实现即时响应
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setActiveId(active.id as string)

    // 记录拖拽开始位置和所有相关图片的初始位置
    const activeImage = images.find(img => img.id === active.id)
    if (activeImage) {
      setDragStartPosition({ x: activeImage.x, y: activeImage.y })

      // 记录所有需要移动的图片的初始位置
      const positions: Record<string, { x: number, y: number }> = {}
      if (selectedImages.includes(active.id as string)) {
        // 多选拖拽：记录所有选中图片的位置
        selectedImages.forEach(imageId => {
          const img = images.find(i => i.id === imageId)
          if (img) {
            positions[imageId] = { x: img.x, y: img.y }
          }
        })
      } else {
        // 单个图片拖拽
        positions[active.id as string] = { x: activeImage.x, y: activeImage.y }
      }
      setInitialImagePositions(positions)
    }
  }

  const handleDragMove = (event: DragMoveEvent) => {
    // 拖拽过程中实时更新图片位置，避免松开鼠标时的"晃动"效果
    const { delta } = event

    if (activeId && delta) {
      const deltaX = delta.x / scale
      const deltaY = delta.y / scale

      // 实时更新图片位置，使用绝对位置而不是累加增量
      if (selectedImages.includes(activeId)) {
        // 多选拖拽：同时移动所有选中的图片
        selectedImages.forEach(imageId => {
          const initialPos = initialImagePositions[imageId]
          if (initialPos) {
            const newX = initialPos.x + deltaX
            const newY = initialPos.y + deltaY
            onImageMove(imageId, newX, newY)
          }
        })
      } else {
        // 单个图片拖拽
        const initialPos = initialImagePositions[activeId]
        if (initialPos) {
          const newX = initialPos.x + deltaX
          const newY = initialPos.y + deltaY
          onImageMove(activeId, newX, newY)
        }
      }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    // 拖拽结束时只需要清理状态，位置已经在handleDragMove中实时更新了
    // 这样避免了松开鼠标时图片从原位置"晃"到新位置的问题
    setActiveId(null)
    setDragStartPosition({ x: 0, y: 0 })
    setInitialImagePositions({})
  }

  const activeImage = activeId ? images.find(img => img.id === activeId) : null

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      // 添加测量配置以确保拖拽在缩放画布上正常工作
      measuring={{
        droppable: {
          strategy: 'always' as const,
        },
      }}
    >
      <div
        className="relative"
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onMouseDown={onCanvasMouseDown}
        style={{
          width: '10000px',
          height: '10000px',
          transform: `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale})`,
          transformOrigin: '0 0',
          cursor: 'inherit',
          willChange: 'transform',
          // 添加网格背景以显示无限画布效果
          backgroundImage: `
            radial-gradient(circle, #e5e7eb 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          backgroundPosition: `${offsetX % 50}px ${offsetY % 50}px`
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
            image={image}
            onSelect={onImageSelect}
            onSave={onImageSave}
            onDownloadOriginal={onImageDownloadOriginal}
            onSaveToLibrary={onImageSaveToLibrary}
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
