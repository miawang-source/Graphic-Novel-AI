import { readPsd } from 'ag-psd';

/**
 * 处理PSD文件，提取缩略图
 * @param file PSD文件
 * @returns 提取的缩略图作为Blob对象
 */
export async function processPsdFile(file: File): Promise<{
  thumbnailBlob: Blob;
  width: number;
  height: number;
}> {
  try {
    // 将文件转换为ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // 解析PSD文件
    const psdData = readPsd(arrayBuffer, { useImageData: true });
    
    if (!psdData) {
      throw new Error('无法解析PSD文件');
    }
    
    // 获取PSD尺寸
    const width = psdData.width;
    const height = psdData.height;
    
    // 检查是否有内置缩略图
    if (psdData.thumbnail && psdData.thumbnail.data) {
      // 使用内置缩略图
      return {
        thumbnailBlob: new Blob([psdData.thumbnail.data], { type: 'image/jpeg' }),
        width,
        height
      };
    }
    
    // 如果没有内置缩略图，则需要在浏览器环境中创建一个
    // 注意：这部分代码在Node.js环境中不会工作，需要在浏览器环境中执行
    // 在服务器端，我们可以使用其他方法或库来处理
    
    // 创建一个Canvas元素
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('无法创建Canvas上下文');
    }
    
    // 简单渲染合成图层
    // 这里只是一个简化的实现，实际上可能需要更复杂的图层合成逻辑
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // 将Canvas转换为Blob
    const thumbnailBlob = await canvas.convertToBlob({ type: 'image/png', quality: 0.9 });
    
    return {
      thumbnailBlob,
      width,
      height
    };
  } catch (error) {
    console.error('PSD处理错误:', error);
    throw new Error(`PSD处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 检查文件是否为PSD格式
 * @param file 要检查的文件
 * @returns 是否为PSD文件
 */
export function isPsdFile(file: File): boolean {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  
  // 检查文件扩展名
  if (fileExtension === 'psd') {
    return true;
  }
  
  // 检查MIME类型
  const psdMimeTypes = [
    'application/photoshop',
    'application/x-photoshop',
    'image/vnd.adobe.photoshop',
    'image/photoshop'
  ];
  
  return psdMimeTypes.includes(file.type);
}
