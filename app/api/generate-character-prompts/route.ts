import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { handleOpenRouterError, validateOpenRouterKey } from "@/lib/api-utils"

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const MODEL = "google/gemini-flash-1.5"

// 解析角色描述，提取关键信息
function parseCharacterDescription(description: string) {
  const info = {
    gender: "",
    age: "",
    occupation: "",
    personality: "",
    hair: "",
    eyes: "",
    face: "",
    body: "",
    outfits: [] as string[]
  }

  // 提取性别和年龄 - 支持多种格式
  const genderMatch = description.match(/性别[：:]([^；，。]+)/) ||
                     description.match(/性别[：:]\s*([^；，。]+)/)
  if (genderMatch && genderMatch[1]) info.gender = genderMatch[1].trim()

  const ageMatch = description.match(/年龄[：:]([^；，。]+)/) ||
                  description.match(/年龄[：:]\s*([^；，。]+)/)
  if (ageMatch && ageMatch[1]) info.age = ageMatch[1].trim()

  // 提取身份职业
  const occupationMatch = description.match(/身份职业[：:]([^；，。]+)/) ||
                         description.match(/身份职业[：:]\s*([^；，。]+)/)
  if (occupationMatch && occupationMatch[1]) info.occupation = occupationMatch[1].trim()

  // 提取性格特质
  const personalityMatch = description.match(/性格特质[：:]([^。；，]+)/) ||
                          description.match(/性格特质[：:]\s*([^。；，]+)/)
  if (personalityMatch && personalityMatch[1]) info.personality = personalityMatch[1].trim()

  // 提取外貌特征
  const hairMatch = description.match(/发型[：:]([^；，。]+)/) ||
                   description.match(/头发[：:]([^；，。]+)/) ||
                   description.match(/发色[：:]([^；，。]+)/)
  if (hairMatch && hairMatch[1]) info.hair = hairMatch[1].trim()

  const eyesMatch = description.match(/眼睛[：:]([^；，。]+)/) ||
                   description.match(/眼部[：:]([^；，。]+)/)
  if (eyesMatch && eyesMatch[1]) info.eyes = eyesMatch[1].trim()

  // 提取面部特征
  const faceMatch = description.match(/面部特征[：:]([^；，。]+)/) ||
                   description.match(/脸型[：:]([^；，。]+)/) ||
                   description.match(/五官[：:]([^；，。]+)/)
  if (faceMatch && faceMatch[1]) info.face = faceMatch[1].trim()

  // 提取身材特征
  const bodyMatch = description.match(/身材[：:]([^；，。]+)/) ||
                   description.match(/体型[：:]([^；，。]+)/) ||
                   description.match(/身材比例[：:]([^；，。]+)/)
  if (bodyMatch && bodyMatch[1]) info.body = bodyMatch[1].trim()

  // 提取服装（修正格式匹配，保留完整描述）
  const outfitMatches = description.match(/服装\d+[：:]([^；。]+)/g)
  if (outfitMatches) {
    info.outfits = outfitMatches.slice(0, 4).map(match => {
      // 保留完整的服装描述，包括场景信息
      return match.replace(/服装\d+[：:]/, '').trim()
    })
  }

  return info
}

// 同义词词典 - 用于特征匹配
const FEATURE_SYNONYMS = {
  // 发色同义词
  hair_color: {
    '黑发': ['黑发', '黑色头发', '黑色长发', '黑色短发', '乌黑的头发', '墨发', '黑丝', '黑色发丝'],
    '金发': ['金发', '金色头发', '金色长发', '金色短发', '金黄色头发', '亚麻色', '淡金色', '蜂蜜色'],
    '银发': ['银发', '银色头发', '银色长发', '银色短发', '银白色头发', '白银色', '月光色'],
    '白发': ['白发', '白色头发', '白色长发', '白色短发', '雪白的头发', '银白色', '霜白色'],
    '棕发': ['棕发', '棕色头发', '棕色长发', '棕色短发', '褐色头发', '咖啡色', '栗色'],
    '红发': ['红发', '红色头发', '红色长发', '红色短发', '火红色', '赤红色', '朱红色'],
    '紫发': ['紫发', '紫色头发', '紫色长发', '紫色短发', '薰衣草色', '深紫色', '淡紫色'],
    '蓝发': ['蓝发', '蓝色头发', '蓝色长发', '蓝色短发', '深蓝色', '天蓝色', '海蓝色'],
    '绿发': ['绿发', '绿色头发', '绿色长发', '绿色短发', '翠绿色', '墨绿色', '浅绿色']
  },

  // 发型同义词
  hair_style: {
    '长发': ['长发', '长头发', '及腰长发', '飘逸长发', '垂肩长发'],
    '短发': ['短发', '短头发', '齐耳短发', '利落短发', '清爽短发'],
    '卷发': ['卷发', '卷曲头发', '波浪卷', '螺旋卷', '自然卷'],
    '直发': ['直发', '直头发', '顺直发', '柔顺直发'],
    '马尾': ['马尾', '马尾辫', '高马尾', '低马尾', '侧马尾'],
    '丸子头': ['丸子头', '包子头', '发髻', '盘发'],
    '双马尾': ['双马尾', '双辫子', '两个马尾', '双尾辫']
  },

  // 眼睛颜色同义词
  eye_color: {
    '黑眼': ['黑眼', '黑色眼睛', '黑色瞳孔', '黑瞳', '墨色眼眸', '深黑色眼睛'],
    '蓝眼': ['蓝眼', '蓝色眼睛', '蓝色瞳孔', '蓝瞳', '海蓝色眼睛', '天蓝色眼眸', '深蓝色眼睛'],
    '绿眼': ['绿眼', '绿色眼睛', '绿色瞳孔', '绿瞳', '翠绿色眼睛', '碧绿色眼眸', '祖母绿眼睛'],
    '灰眼': ['灰眼', '灰色眼睛', '灰色瞳孔', '灰瞳', '银灰色眼睛', '烟灰色眼眸'],
    '棕眼': ['棕眼', '棕色眼睛', '棕色瞳孔', '棕瞳', '琥珀色眼睛', '咖啡色眼眸'],
    '紫眼': ['紫眼', '紫色眼睛', '紫色瞳孔', '紫瞳', '薰衣草色眼睛', '深紫色眼眸'],
    '金眼': ['金眼', '金色眼睛', '金色瞳孔', '金瞳', '琥珀色眼睛', '蜂蜜色眼眸'],
    '红眼': ['红眼', '红色眼睛', '红色瞳孔', '红瞳', '血红色眼睛', '朱红色眼眸'],
    '碧玉眼': ['碧玉的眼睛', '碧玉色眼睛', '翡翠色眼睛', '碧绿色眼睛', '玉色眼眸']
  },

  // 服装颜色同义词
  clothing_color: {
    '蓝色': ['蓝色', '深蓝', '浅蓝', '天蓝', '海蓝', '宝蓝', '靛蓝', '湛蓝'],
    '红色': ['红色', '深红', '浅红', '朱红', '血红', '玫瑰红', '樱桃红', '酒红'],
    '绿色': ['绿色', '深绿', '浅绿', '翠绿', '墨绿', '橄榄绿', '森林绿', '薄荷绿'],
    '紫色': ['紫色', '深紫', '浅紫', '薰衣草紫', '葡萄紫', '茄子紫', '梦幻紫'],
    '黄色': ['黄色', '金黄', '柠檬黄', '鹅黄', '土黄', '橙黄', '明黄'],
    '白色': ['白色', '纯白', '乳白', '象牙白', '珍珠白', '雪白', '米白'],
    '黑色': ['黑色', '纯黑', '墨黑', '炭黑', '漆黑', '深黑'],
    '粉色': ['粉色', '粉红', '樱花粉', '玫瑰粉', '桃粉', '淡粉', '嫩粉'],
    '灰色': ['灰色', '深灰', '浅灰', '银灰', '烟灰', '炭灰', '石灰']
  },

  // 服装类型同义词
  clothing_type: {
    '长裙': ['长裙', '长款裙子', '及踝长裙', '拖地长裙', '飘逸长裙'],
    '短裙': ['短裙', '短款裙子', '迷你裙', '及膝短裙', 'A字短裙'],
    '连衣裙': ['连衣裙', '连身裙', '一体裙', '套装裙'],
    '纱裙': ['纱裙', '薄纱裙', '蓬蓬纱裙', '多层纱裙', '轻纱裙'],
    '襦裙': ['襦裙', '汉服襦裙', '上襦下裙', '齐胸襦裙', '齐腰襦裙'],
    '汉服': ['汉服', '古装', '传统服装', '中式服装', '古代服饰'],
    '古装': ['古装', '古代服装', '传统服饰', '古风服装', '复古装'],
    '现代装': ['现代装', '现代服装', '时装', '当代服饰', '流行服装'],
    '病号服': ['病号服', '医院服', '患者服', '住院服', '医疗服装']
  }
}

// 精确的上下文感知匹配函数
function findSynonymMatches(text: string, category: keyof typeof FEATURE_SYNONYMS): string[] {
  const synonymDict = FEATURE_SYNONYMS[category]
  const matches: string[] = []

  // 根据类别使用不同的匹配策略
  if (category === 'hair_color') {
    // 发色匹配：只在发型相关的上下文中匹配
    const hairSections = [
      // 提取发型相关的段落
      /发型[：:][^；，。【】]*?([^；，。【】]*)/g,
      /头发[：:][^；，。【】]*?([^；，。【】]*)/g,
      /发色[：:][^；，。【】]*?([^；，。【】]*)/g,
    ]

    // 首先提取发型相关的文本段落
    let hairTexts: string[] = []
    for (const regex of hairSections) {
      const sectionMatches = text.matchAll(regex)
      for (const match of sectionMatches) {
        hairTexts.push(match[0])
      }
    }

    // 如果没有找到明确的发型段落，则在整个文本中查找发型关键词
    if (hairTexts.length === 0) {
      const hairKeywordRegex = /(乌黑|黑色|金色|银色|白色|棕色|红色|紫色|蓝色|绿色).{0,5}(长发|短发|头发|发丝|发型)/g
      const keywordMatches = text.matchAll(hairKeywordRegex)
      for (const match of keywordMatches) {
        hairTexts.push(match[0])
      }
    }

    // 在发型相关文本中匹配同义词
    for (const hairText of hairTexts) {
      for (const [mainTerm, synonyms] of Object.entries(synonymDict)) {
        for (const synonym of synonyms) {
          if (hairText.includes(synonym)) {
            matches.push(mainTerm)
            break
          }
        }
      }
    }

    // 如果还是没有匹配到，尝试直接匹配完整的发色词汇（但排除服装描述）
    if (matches.length === 0) {
      // 排除服装相关的段落
      const clothingSections = [
        /服装[：:][^；，。【】]*?([^；，。【】]*)/g,
        /衣服[：:][^；，。【】]*?([^；，。【】]*)/g,
        /裙子[：:][^；，。【】]*?([^；，。【】]*)/g,
        /【服装细节】[^【]*?/g,
      ]

      let cleanText = text
      for (const regex of clothingSections) {
        cleanText = cleanText.replace(regex, '')
      }

      for (const [mainTerm, synonyms] of Object.entries(synonymDict)) {
        for (const synonym of synonyms) {
          if (cleanText.includes(synonym)) {
            matches.push(mainTerm)
            break
          }
        }
      }
    }
  } else if (category === 'clothing_color') {
    // 服装颜色匹配：只在服装相关的上下文中匹配
    const clothingContexts = [
      /服装[：:][^；，。]*?([^；，。]*)/g,
      /衣服[：:][^；，。]*?([^；，。]*)/g,
      /裙子[：:][^；，。]*?([^；，。]*)/g,
      /(蓝色|绿色|红色|黄色|紫色|黑色|白色|粉色).*?(裙|衣|服|装)/g,
      /(裙|衣|服|装).*?(蓝色|绿色|红色|黄色|紫色|黑色|白色|粉色)/g
    ]

    for (const [mainTerm, synonyms] of Object.entries(synonymDict)) {
      for (const regex of clothingContexts) {
        const contextMatches = text.matchAll(regex)
        for (const match of contextMatches) {
          const context = match[0]
          for (const synonym of synonyms) {
            if (context.includes(synonym)) {
              matches.push(mainTerm)
              break
            }
          }
        }
      }
    }
  } else {
    // 其他类别使用简单匹配
    for (const [mainTerm, synonyms] of Object.entries(synonymDict)) {
      for (const synonym of synonyms) {
        if (text.includes(synonym)) {
          matches.push(mainTerm)
          break
        }
      }
    }
  }

  return [...new Set(matches)] // 去重
}

// 构建用户提示词
// 检测服装时代背景
function detectOutfitEraFromDescription(outfits: string[]) {
  const ancientKeywords = ['古代', '古装', '汉服', '唐装', '宋装', '明装', '清装', '古风', '传统', '宫廷', '皇帝', '公主', '侍郎', '国公', '长袍', '龙袍', '凤冠', '步摇', '鲛人', '公主装', '侍郎府', '宫女', '皇子']
  const modernKeywords = ['现代', '西装', '衬衫', '牛仔', 'T恤', '连衣裙', '休闲', '正装', '商务', '时尚', '潮流', '病号服', '制服']

  let ancientCount = 0
  let modernCount = 0

  outfits.forEach(outfit => {
    const text = outfit.toLowerCase()
    ancientKeywords.forEach(keyword => {
      if (text.includes(keyword)) ancientCount++
    })
    modernKeywords.forEach(keyword => {
      if (text.includes(keyword)) modernCount++
    })
  })

  if (ancientCount > modernCount) return 'ancient'
  if (modernCount > ancientCount) return 'modern'
  return 'mixed'
}

function buildUserPrompt(character: any) {
  const info = parseCharacterDescription(character.description)

  let prompt = "Generate concise manga-style art prompts for character: " + character.name + "\n\n"
  prompt += "Character Type: " + (character.role_type === "main" ? "protagonist" : "supporting character") + "\n"

  // 基本信息
  if (info.gender) prompt += "Gender: " + info.gender + "\n"
  if (info.age) prompt += "Age: " + info.age + "\n"
  if (info.occupation) prompt += "Occupation: " + info.occupation + "\n"
  if (info.personality) prompt += "Personality: " + info.personality + "\n"

  // 外貌特征
  if (info.hair) prompt += "Hair: " + info.hair + "\n"
  if (info.eyes) prompt += "Eyes: " + info.eyes + "\n"
  if (info.face) prompt += "Face: " + info.face + "\n"
  if (info.body) prompt += "Body: " + info.body + "\n"

  // 检测时代背景
  const eraType = detectOutfitEraFromDescription(info.outfits)
  if (eraType !== 'mixed') {
    prompt += "Era Context: " + (eraType === 'ancient' ? "Ancient Chinese setting" : "Modern setting") + "\n"
  }

  if (info.outfits.length > 0) {
    prompt += "\nOutfit Details:\n"
    info.outfits.forEach((outfit, index) => {
      prompt += `Version ${index + 1}: ${outfit}\n`
    })
  }

  prompt += "\nPlease create manga-style prompts based on these exact details. "
  prompt += "Include ALL the character features (gender, age, appearance, personality) in the base prompt. "
  prompt += "IMPORTANT: Add era context (古代/ancient or 现代/modern) to the base character description. "
  prompt += "For outfits, use the EXACT descriptions provided above - do not create new outfit descriptions. "
  prompt += "Generate both Chinese and English prompts with outfit versions matching the provided descriptions."

  return prompt
}

// 从AI响应中解析提示词
function parseAIResponse(aiResponse: string, characterName: string) {
  // 提取完整的中文提示词（包含服装版本）
  let chinesePrompt = ""

  // 提取从"中文提示词："到"英文提示词："之间的所有内容
  const chineseSection = aiResponse.match(/中文提示词[：:]\s*\n?([\s\S]*?)(?=英文提示词|$)/i)
  if (chineseSection) {
    chinesePrompt = chineseSection[1].trim()
    // 清理多余的空行，特别是服装版本部分的空行
    // 先处理"服装版本："后面的空行
    chinesePrompt = chinesePrompt.replace(/(\*\*服装版本[：:]\*\*)\s*\n\s*(\*\*版本)/g, '$1\n$2')
    // 然后处理其他多余的空行
    chinesePrompt = chinesePrompt.replace(/\n\s*\n/g, '\n')
  } else {
    // 备用方案：只提取第一行
    const chineseMatch = aiResponse.match(/中文提示词[：:]\s*\n?([^\n*]+)/i) ||
                        aiResponse.match(/漫画风格[，,]([^\n*]+)/i)
    if (chineseMatch) {
      chinesePrompt = chineseMatch[1].trim()
    }
  }

  // 提取完整的英文提示词（包含服装版本）
  let englishPrompt = ""

  // 提取从"英文提示词："到结尾的所有内容
  const englishSection = aiResponse.match(/英文提示词[：:]\s*\n?([\s\S]*?)$/i)
  if (englishSection) {
    englishPrompt = englishSection[1].trim()
    // 清理多余的空行，特别是服装版本部分的空行
    englishPrompt = englishPrompt.replace(/(\*\*Outfit Versions[：:]\*\*)\s*\n\s*\n/g, '$1\n')
    englishPrompt = englishPrompt.replace(/\n\s*\n/g, '\n')
  } else {
    // 备用方案：只提取第一行
    const englishMatch = aiResponse.match(/英文提示词[：:]\s*\n?([^\n*]+)/i) ||
                        aiResponse.match(/manga style[,，]\s*([^\n*]+)/i)
    if (englishMatch) {
      englishPrompt = englishMatch[1].trim()
    }
  }

  return {
    chinese_prompt: chinesePrompt || ("漫画风格，" + characterName + "，动漫角色"),
    english_prompt: englishPrompt || ("manga style, " + characterName + ", anime character"),
    ai_response: aiResponse
  }
}

// 同义词词典
const synonyms = {
  "男": ["男性", "男子", "男人", "男角", "male", "man"],
  "女": ["女性", "女子", "女人", "女角", "female", "woman"],
  "古装": ["古代", "古风", "传统", "古典", "古代服装", "ancient", "traditional"],
  "现代": ["当代", "现代装", "时尚", "modern", "contemporary"],
  "黑发": ["黑色头发", "乌黑", "黑色长发", "black hair"],
  "长发": ["长头发", "飘逸长发", "long hair"],
  "白衣": ["白色衣服", "白色服装", "white clothes"],
  "仙女": ["仙子", "仙人", "神仙", "fairy", "immortal"],
  "将军": ["武将", "军官", "统帅", "general", "commander"],
  "书生": ["文人", "学者", "读书人", "scholar", "student"]
}

// 计算两个词的相似度
function calculateWordSimilarity(word1: string, word2: string): number {
  if (!word1 || !word2) return 0

  const w1 = word1.toLowerCase().trim()
  const w2 = word2.toLowerCase().trim()

  if (w1 === w2) return 10
  if (w1.includes(w2) || w2.includes(w1)) return 8

  for (const [key, values] of Object.entries(synonyms)) {
    if ((key === w1 || values.includes(w1)) && (key === w2 || values.includes(w2))) {
      return 7
    }
  }

  if (w1.length >= 2 && w2.length >= 2) {
    let commonChars = 0
    for (let i = 0; i < Math.min(w1.length, w2.length); i++) {
      if (w1[i] === w2[i]) commonChars++
    }
    if (commonChars >= 2) return Math.min(5, commonChars)
  }

  return 0
}

// 性别检测函数
function detectGender(text: string): string | null {
  const maleKeywords = ["男", "男性", "男子", "男人", "将军", "书生", "侠客", "王子", "皇子", "公子", "少爷", "male", "man", "boy", "prince"]
  const femaleKeywords = ["女", "女性", "女子", "女人", "仙女", "公主", "皇女", "小姐", "女士", "少女", "female", "woman", "girl", "princess", "lady"]

  const lowerText = text.toLowerCase()

  const maleMatches = maleKeywords.filter(keyword => lowerText.includes(keyword.toLowerCase()))
  const femaleMatches = femaleKeywords.filter(keyword => lowerText.includes(keyword.toLowerCase()))

  if (maleMatches.length > femaleMatches.length) return "male"
  if (femaleMatches.length > maleMatches.length) return "female"
  return null
}

// 素材匹配函数（使用新的同义词匹配系统）
async function findMatchingMaterial(promptData: any, supabase: any) {
  try {
    const { data: materials, error } = await supabase
      .from("materials")
      .select("*")
      .eq("category_type", "character")

    if (error || !materials || materials.length === 0) {
      return null
    }

    // 使用与 findMultipleMatchingMaterials 相同的逻辑
    const allPromptText = [
      promptData.chinese_prompt || "",
      promptData.english_prompt || "",
      promptData.character_description || "",
      ...(promptData.tags || [])
    ].join(" ")

    const promptGender = detectGender(allPromptText)

    const scoredMaterials = materials.map((material: any) => {
      let totalScore = 0

      const allMaterialText = [
        material.chinese_prompt || "",
        material.english_prompt || "",
        material.title || "",
        ...(material.tags || [])
      ].join(" ")

      const materialGender = detectGender(allMaterialText)

      // 性别匹配（最高权重）
      if (promptGender && materialGender) {
        if (promptGender === materialGender) {
          totalScore += 50
        } else {
          totalScore -= 150
        }
      }

      // 使用同义词匹配系统进行特征匹配
      const promptHairColors = findSynonymMatches(allPromptText, 'hair_color')
      const materialHairColors = findSynonymMatches(allMaterialText, 'hair_color')

      const promptEyeColors = findSynonymMatches(allPromptText, 'eye_color')
      const materialEyeColors = findSynonymMatches(allMaterialText, 'eye_color')

      const promptClothingColors = findSynonymMatches(allPromptText, 'clothing_color')
      const materialClothingColors = findSynonymMatches(allMaterialText, 'clothing_color')

      const promptClothingTypes = findSynonymMatches(allPromptText, 'clothing_type')
      const materialClothingTypes = findSynonymMatches(allMaterialText, 'clothing_type')

      // 发色匹配（超高权重）
      for (const promptHair of promptHairColors) {
        if (materialHairColors.includes(promptHair)) {
          totalScore += 50
        } else if (materialHairColors.length > 0) {
          totalScore -= 80 // 发色冲突严重惩罚
        }
      }

      // 眼色匹配（高权重）
      for (const promptEye of promptEyeColors) {
        if (materialEyeColors.includes(promptEye)) {
          totalScore += 40
        } else if (materialEyeColors.length > 0) {
          totalScore -= 30 // 眼色冲突惩罚
        }
      }

      // 服装颜色匹配（中等权重）
      for (const promptColor of promptClothingColors) {
        if (materialClothingColors.includes(promptColor)) {
          totalScore += 35
        } else if (materialClothingColors.length > 0) {
          totalScore -= 25 // 服装颜色冲突惩罚
        }
      }

      // 服装类型匹配（中等权重）
      for (const promptType of promptClothingTypes) {
        if (materialClothingTypes.includes(promptType)) {
          totalScore += 30
        }
      }

      return {
        ...material,
        score: totalScore
      }
    })

    // 返回最高分的素材
    const bestMatch = scoredMaterials
      .filter((material: any) => material.score > 15)
      .sort((a: any, b: any) => b.score - a.score)[0]

    return bestMatch || null
  } catch (error) {
    console.error("Error in findMatchingMaterial:", error)
    return null
  }
}

// 提取服装信息的辅助函数
function extractOutfitInfo(promptText: string) {
  const outfits = []

  // 提取版本1-4的服装信息
  for (let i = 1; i <= 4; i++) {
    const versionMatch = promptText.match(new RegExp(`\\*\\*版本${i}[：:]\\*\\*([^\\n*]+)`, 'i'))
    if (versionMatch) {
      outfits.push({
        version: i,
        description: versionMatch[1].trim()
      })
    }
  }

  return outfits
}

// 检测服装时代类型
function detectOutfitEra(outfitDescription: string) {
  const ancientKeywords = ['古代', '古装', '汉服', '唐装', '宋装', '明装', '清装', '古风', '传统', '宫廷', '皇帝', '公主', '侍郎', '国公', '长袍', '龙袍', '凤冠', '步摇']
  const modernKeywords = ['现代', '西装', '衬衫', '牛仔', 'T恤', '连衣裙', '休闲', '正装', '商务', '时尚', '潮流']

  const text = outfitDescription.toLowerCase()

  let ancientScore = 0
  let modernScore = 0

  ancientKeywords.forEach(keyword => {
    if (text.includes(keyword)) ancientScore++
  })

  modernKeywords.forEach(keyword => {
    if (text.includes(keyword)) modernScore++
  })

  if (ancientScore > modernScore) return 'ancient'
  if (modernScore > ancientScore) return 'modern'
  return 'neutral'
}



// 多素材匹配函数（优化版 - 使用剧本解析信息）
async function findMultipleMatchingMaterials(promptData: any, supabase: any, limit = 6) {
  try {
    const { data: materials, error } = await supabase
      .from("materials")
      .select("*")
      .eq("category_type", "character")

    if (error || !materials || materials.length === 0) {
      return []
    }

    // 优先使用剧本解析的详细信息，而不是精简后的美术提示词
    const characterInfo = parseCharacterDescription(promptData.character_description || "")

    const allPromptText = [
      promptData.character_description || "",  // 原始剧本信息权重最高
      promptData.chinese_prompt || "",
      promptData.english_prompt || "",
      ...(promptData.tags || [])
    ].join(" ")

    const promptGender = detectGender(allPromptText)
    const promptOutfits = extractOutfitInfo(allPromptText)

    // 提取关键外貌特征用于高权重匹配
    const keyFeatures = {
      hair: characterInfo.hair || "",
      colors: [] as string[],
      clothing: characterInfo.outfits.join(" ")
    }

    // 从描述中提取颜色信息
    const colorMatches = allPromptText.match(/(蓝色|绿色|红色|黄色|紫色|黑色|白色|粉色|橙色|灰色|青色)/g)
    if (colorMatches) {
      keyFeatures.colors = [...new Set(colorMatches)]
    }

    // 调试信息
    console.log("=== 角色解析信息 ===")
    console.log("角色描述:", promptData.character_description)
    console.log("解析结果:", characterInfo)
    console.log("性别:", promptGender)
    console.log("完整文本:", allPromptText.substring(0, 300))

    // 测试同义词匹配
    console.log("=== 同义词匹配测试 ===")
    console.log("测试文本:", allPromptText.substring(0, 100))
    console.log("发色匹配:", findSynonymMatches(allPromptText, 'hair_color'))
    console.log("发型匹配:", findSynonymMatches(allPromptText, 'hair_style'))
    console.log("眼色匹配:", findSynonymMatches(allPromptText, 'eye_color'))
    console.log("服装颜色匹配:", findSynonymMatches(allPromptText, 'clothing_color'))
    console.log("服装类型匹配:", findSynonymMatches(allPromptText, 'clothing_type'))

    const scoredMaterials = materials.map((material: any) => {
      let totalScore = 0

      const allMaterialText = [
        material.chinese_prompt || "",
        material.english_prompt || "",
        material.title || "",
        ...(material.tags || [])
      ].join(" ")

      const materialGender = detectGender(allMaterialText)

      // 1. 性别匹配（最高权重）
      if (promptGender && materialGender) {
        if (promptGender === materialGender) {
          totalScore += 50  // 提高性别匹配权重
        } else {
          totalScore -= 150  // 性别不匹配严重扣分
        }
      }

      // 2. 外貌特征匹配（超高权重）
      let appearanceScore = 0

      const promptKeywords = [
        ...(promptData.tags || []),
        ...(promptData.chinese_prompt || "").split(/[，。、\s]+/).filter((word: string) => word.length > 1),
        ...(promptData.character_description || "").split(/[，。、\s]+/).filter((word: string) => word.length > 1)
      ]

      const materialKeywords = [
        ...(material.tags || []),
        ...(material.chinese_prompt || "").split(/[，。、\s]+/).filter((word: string) => word.length > 1)
      ]

      // 使用同义词词典进行特征提取
      const promptHairColors = findSynonymMatches(allPromptText, 'hair_color')
      const promptHairStyles = findSynonymMatches(allPromptText, 'hair_style')
      const promptEyeColors = findSynonymMatches(allPromptText, 'eye_color')
      const promptClothingColors = findSynonymMatches(allPromptText, 'clothing_color')
      const promptClothingTypes = findSynonymMatches(allPromptText, 'clothing_type')

      const materialHairColors = findSynonymMatches(allMaterialText, 'hair_color')
      const materialHairStyles = findSynonymMatches(allMaterialText, 'hair_style')
      const materialEyeColors = findSynonymMatches(allMaterialText, 'eye_color')
      const materialClothingColors = findSynonymMatches(allMaterialText, 'clothing_color')
      const materialClothingTypes = findSynonymMatches(allMaterialText, 'clothing_type')

      // 发色匹配（最高权重）
      for (const hairColor of promptHairColors) {
        if (materialHairColors.includes(hairColor)) {
          appearanceScore += 50  // 发色匹配超高分
        }
      }

      // 发型匹配（高权重）
      for (const hairStyle of promptHairStyles) {
        if (materialHairStyles.includes(hairStyle)) {
          appearanceScore += 35  // 发型匹配高分
        }
      }

      // 眼睛颜色匹配（高权重）
      for (const eyeColor of promptEyeColors) {
        if (materialEyeColors.includes(eyeColor)) {
          appearanceScore += 40  // 眼色匹配高分
        }
      }

      // 发色冲突惩罚（严重扣分）
      if (promptHairColors.length > 0 && materialHairColors.length > 0) {
        const hasCommonHairColor = promptHairColors.some(color => materialHairColors.includes(color))
        if (!hasCommonHairColor) {
          appearanceScore -= 80  // 发色完全不匹配严重扣分
        }
      }

      // 眼色冲突惩罚
      if (promptEyeColors.length > 0 && materialEyeColors.length > 0) {
        const hasCommonEyeColor = promptEyeColors.some(color => materialEyeColors.includes(color))
        if (!hasCommonEyeColor) {
          appearanceScore -= 30  // 眼色不匹配扣分
        }
      }

      // 服装颜色匹配（高权重）
      for (const clothingColor of promptClothingColors) {
        if (materialClothingColors.includes(clothingColor)) {
          appearanceScore += 30  // 服装颜色匹配高分
        }
      }

      // 服装类型匹配（高权重）
      for (const clothingType of promptClothingTypes) {
        if (materialClothingTypes.includes(clothingType)) {
          appearanceScore += 35  // 服装类型匹配高分
        }
      }

      // 服装颜色冲突惩罚
      if (promptClothingColors.length > 0 && materialClothingColors.length > 0) {
        const hasCommonClothingColor = promptClothingColors.some(color => materialClothingColors.includes(color))
        if (!hasCommonClothingColor) {
          appearanceScore -= 25  // 服装颜色不匹配扣分
        }
      }

      totalScore += appearanceScore

      // 调试信息 - 显示匹配的特征
      console.log("特征匹配详情:", {
        material_id: material.id,
        promptHairColors,
        materialHairColors,
        promptEyeColors,
        materialEyeColors,
        promptClothingColors,
        materialClothingColors,
        promptClothingTypes,
        materialClothingTypes,
        appearanceScore
      })

      // 3. 服装匹配（中等权重）
      let outfitScore = 0
      if (promptOutfits.length > 0) {
        // 优先匹配版本1，然后版本2，以此类推
        for (const outfit of promptOutfits) {
          const outfitEra = detectOutfitEra(outfit.description)
          const materialEra = detectOutfitEra(allMaterialText)

          let versionScore = 0

          // 时代匹配（降低权重）
          if (outfitEra === materialEra && outfitEra !== 'neutral') {
            versionScore += 5  // 从15降低到5
          }

          // 服装关键词匹配（主要权重）
          const outfitKeywords = outfit.description.split(/[，。、\s]+/).filter((word: string) => word.length > 1)
          for (const outfitKeyword of outfitKeywords) {
            let bestOutfitScore = 0
            for (const materialKeyword of materialKeywords) {
              const similarity = calculateWordSimilarity(outfitKeyword, materialKeyword)
              bestOutfitScore = Math.max(bestOutfitScore, similarity)
            }
            versionScore += bestOutfitScore * 1.5  // 提高服装关键词权重
          }

          // 版本优先级：版本1权重最高，但如果版本1匹配度很低，优先考虑版本2
          const versionWeight = outfit.version === 1 ? 1.3 : (outfit.version === 2 ? 1.5 : 1.0)  // 版本2权重提高
          outfitScore = Math.max(outfitScore, versionScore * versionWeight)  // 取最高分而不是累加
        }
      }
      totalScore += outfitScore

      // 4. 其他关键词匹配（基础权重）
      const allExtractedFeatures = [
        ...promptHairColors,
        ...promptHairStyles,
        ...promptEyeColors,
        ...promptClothingColors,
        ...promptClothingTypes
      ]

      for (const promptKeyword of promptKeywords) {
        // 只对非特征关键词进行通用匹配
        const isFeatureKeyword = allExtractedFeatures.some((feature: string) =>
          promptKeyword.includes(feature) || feature.includes(promptKeyword)
        )

        if (!isFeatureKeyword) {
          let bestWordScore = 0
          for (const materialKeyword of materialKeywords) {
            const similarity = calculateWordSimilarity(promptKeyword, materialKeyword)
            bestWordScore = Math.max(bestWordScore, similarity)
          }
          totalScore += bestWordScore * 0.3  // 进一步降低基础关键词权重
        }
      }

      return {
        ...material,
        score: totalScore
      }
    })

    return scoredMaterials
      .filter((material: any) => material.score > 15)  // 提高最低分数要求
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, limit)
  } catch (error) {
    console.error("Error in findMultipleMatchingMaterials:", error)
    return []
  }
}

const ART_PROMPT_SYSTEM = "你是一个专业的AI美术角色提示词生成器，专门为lora、可灵、即梦、nano banana等AI绘图平台生成简洁有效的漫画风格提示词。\n\n核心要求：\n1. 必须使用提供的角色信息：严格基于用户提供的角色特征（性别、年龄、外貌、性格等）生成提示词\n2. 简洁明了：提示词要简洁，重点突出人物特征和服装特征\n3. 漫画风格：专注于漫画、动漫风格，避免写实、照片、3D风格\n4. 核心要素：人物特征（性别、年龄、发型、眼神、身材、面部特征）+ 服装特征（颜色、款式、材质）\n5. 服装版本：使用用户提供的确切服装描述，不要自己编造\n6. 时代背景：必须在角色描述中明确标注时代背景（古代/现代），例如：\n   - 古代角色：\"一个古代中国的美丽女子\" \"古风贵妃\" \"古代君主\"\n   - 现代角色：\"一个现代都市女性\" \"现代商务男士\" \"年轻的现代学生\"\n\n输出格式（必须严格遵循，保持与示例一致）：\n\n中文提示词：\n漫画风格，角色名，[古代/现代][性别]，[年龄]，[详细外貌特征]，[性格特质]\n\n**服装版本：**\n**版本1：** [用户提供的服装1描述]\n**版本2：** [用户提供的服装2描述]\n**版本3：** [用户提供的服装3描述]\n\n英文提示词：\nmanga style, character name, [ancient/modern] [gender], [age], [detailed appearance], [personality traits]\n\n**Outfit Versions:**\n**Version 1:** [user provided outfit 1 description]\n**Version 2:** [user provided outfit 2 description]\n**Version 3:** [user provided outfit 3 description]"

export async function POST(request: NextRequest) {
  try {
    console.log("=== API调用开始 ===")
    const { characters, scriptTitle, scriptId } = await request.json()
    console.log("接收到的参数:", { scriptTitle, scriptId })
    console.log("接收到的角色数据:", characters.map((c: any) => ({ name: c.name, description: c.description })))

    if (!characters || !Array.isArray(characters)) {
      return NextResponse.json({ success: false, error: "无效的角色数据" }, { status: 400 })
    }

    const supabase = createServerClient()

    const generatedPrompts = []
    let finalScriptId = scriptId

    for (const character of characters) {
      try {
        console.log("[DEBUG] Processing character:", character.name)

        const userPrompt = buildUserPrompt(character)
        console.log("[DEBUG] User prompt for", character.name + ":", userPrompt)

        // 调用AI生成提示词
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + OPENROUTER_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              {
                role: "system",
                content: ART_PROMPT_SYSTEM,
              },
              {
                role: "user",
                content: userPrompt,
              },
            ],
            temperature: 0.7,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = handleOpenRouterError(response, errorData)
          throw new Error(errorMessage)
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content

        if (!content) {
          throw new Error("No content received from AI")
        }

        console.log("[DEBUG] AI response for " + character.name + ":", content)

        // 解析AI响应
        const promptData = parseAIResponse(content, character.name)
        
        console.log("[DEBUG] Parsed prompts for " + character.name + ":", promptData)

        // 素材匹配
        const matchingData = {
          tags: [character.role_type === "main" ? "主角" : "配角", "动漫风格"],
          chinese_prompt: promptData.chinese_prompt,
          english_prompt: promptData.english_prompt,
          character_name: character.name,
          character_description: character.description,
        }

        const matchedMaterial = await findMatchingMaterial(matchingData, supabase)
        const multipleMaterials = await findMultipleMatchingMaterials(matchingData, supabase, 3)

        // 保存到数据库
        if (finalScriptId) {
          const { data: existingCharacter } = await supabase
            .from("characters")
            .select("id")
            .eq("script_id", finalScriptId)
            .eq("name", character.name)
            .single()

          const characterData = {
            description: character.description,
            role_type: character.role_type,
            chinese_prompt: promptData.chinese_prompt,
            english_prompt: promptData.english_prompt,
          }

          if (existingCharacter) {
            const { error: updateError } = await supabase
              .from("characters")
              .update(characterData)
              .eq("id", existingCharacter.id)

            if (updateError) {
              console.error("Failed to update character " + character.name + ":", updateError)
            }
          } else {
            const { error: insertError } = await supabase.from("characters").insert({
              script_id: finalScriptId,
              name: character.name,
              ...characterData,
            })

            if (insertError) {
              console.error("Failed to insert character " + character.name + ":", insertError)
            }
          }
        }

        generatedPrompts.push({
          name: character.name,
          role_type: character.role_type,
          description: character.description,
          chinese_prompt: promptData.chinese_prompt,
          english_prompt: promptData.english_prompt,
          ai_response: promptData.ai_response, // 完整的AI响应用于前端显示
          matchedMaterial: matchedMaterial,
          candidateMaterials: multipleMaterials,
        })
      } catch (error) {
        console.error("Error generating prompt for " + character.name + ":", error)
        generatedPrompts.push({
          name: character.name,
          role_type: character.role_type,
          description: character.description,
          chinese_prompt: "漫画风格，" + character.name + "，动漫角色",
          english_prompt: character.name + ", anime style, high quality",
          ai_response: "生成失败，请重试",
          matchedMaterial: null,
          candidateMaterials: [],
        })
      }
    }

    console.log("[DEBUG] Generated prompts:", generatedPrompts.length)

    // 保存到Characters表
    try {
      // 先删除该剧本的旧角色数据（只有当finalScriptId有效时才删除）
      if (finalScriptId && finalScriptId !== 'undefined') {
        const { error: deleteError } = await supabase
          .from("characters")
          .delete()
          .eq("script_id", finalScriptId)

        if (deleteError) {
          console.error("Failed to delete old characters:", deleteError)
        } else {
          console.log("[DEBUG] Deleted old characters for script:", finalScriptId)
        }
      }

      // 插入新的角色数据 - 根据实际表结构调整字段
      const charactersToInsert = generatedPrompts.map(character => ({
        script_id: finalScriptId,
        name: character.name,
        description: character.description,
        chinese_prompt: character.chinese_prompt,
        english_prompt: character.english_prompt,
        created_at: new Date().toISOString()
      }))

      console.log("[DEBUG] 准备插入的角色数据:", {
        finalScriptId,
        charactersCount: charactersToInsert.length,
        firstCharacter: charactersToInsert[0]
      })

      const { error: insertError } = await supabase
        .from("characters")
        .insert(charactersToInsert)

      if (insertError) {
        console.error("Failed to save characters:", insertError)
      } else {
        console.log("[DEBUG] Characters saved successfully:", charactersToInsert.length)
      }
    } catch (charactersError) {
      console.error("Error saving characters:", charactersError)
    }

    // 保存到历史记录表
    try {
      const { error: historyError } = await supabase
        .from("character_prompts_history")
        .insert({
          script_title: scriptTitle,
          script_id: finalScriptId,
          characters: generatedPrompts,
          created_at: new Date().toISOString()
        })

      if (historyError) {
        console.error("Failed to save character prompts history:", historyError)
      } else {
        console.log("[DEBUG] Character prompts history saved successfully")
      }
    } catch (historyError) {
      console.error("Error saving character prompts history:", historyError)
    }

    return NextResponse.json({
      success: true,
      data: {
        scriptTitle,
        scriptId: finalScriptId,
        characters: generatedPrompts,
      },
    })
  } catch (error) {
    console.error("Generate character prompts error:", error)
    return NextResponse.json({ success: false, error: "生成角色提示词失败" }, { status: 500 })
  }
}
