/**
 * 场景映射服务
 * 负责管理场景与评测量表、音乐类型之间的映射关系
 */

const { get, post } = require('./api')

class SceneMappingService {
  constructor() {
    this.mappings = null
    this.lastFetchTime = null
    this.cacheExpiration = 5 * 60 * 1000 // 5分钟缓存
  }

  /**
   * 获取所有场景映射关系
   * @returns {Promise<Object>} 映射关系数据
   */
  async getMappings(forceRefresh = false) {
    try {
      // 检查缓存是否有效（除非强制刷新）
      if (!forceRefresh && this.mappings && this.lastFetchTime && 
          (Date.now() - this.lastFetchTime < this.cacheExpiration)) {
        console.log('🎯 使用缓存的场景映射关系')
        return this.mappings
      }

      console.log('🔄 从后端获取场景映射关系...')
      
      // 🔧 修复：直接使用专门的映射接口，这是正确的架构设计
      let result
      try {
        // 优先使用专门的映射接口（这个接口就是为映射关系设计的）
        result = await get('/api/scene/mappings')
        console.log('✅ 使用专门的映射接口获取数据成功')
      } catch (mappingApiError) {
        console.log('🔄 映射接口失败，尝试兼容旧路径:', mappingApiError.message)
        try {
          // 兼容旧路径
          result = await get('/scene/mappings')
          console.log('✅ 使用兼容路径获取数据成功')
        } catch (legacyApiError) {
          console.log('🔄 所有映射接口都失败，尝试从场景列表重建映射:', legacyApiError.message)
          // 最后的备选方案：从场景列表重建映射（需要调用详情接口）
          result = await this.buildMappingsFromSceneList()
        }
      }
      
      if (result.success && result.data) {
        this.mappings = result.data
        this.lastFetchTime = Date.now()
        console.log('✅ 场景映射关系获取成功:', this.mappings)
        
        // 调试：打印数据格式
        console.log('🔍 调试映射数据格式:')
        if (this.mappings.sceneToScales) {
          console.log('- sceneToScales[1] 格式:', this.mappings.sceneToScales[1])
          console.log('- sceneToScales[1] 类型:', Array.isArray(this.mappings.sceneToScales[1]) ? 'array' : typeof this.mappings.sceneToScales[1])
          if (Array.isArray(this.mappings.sceneToScales[1]) && this.mappings.sceneToScales[1].length > 0) {
            console.log('- 第一个元素类型:', typeof this.mappings.sceneToScales[1][0])
            console.log('- 第一个元素内容:', this.mappings.sceneToScales[1][0])
          }
        }
        
        return this.mappings
      } else {
        console.warn('⚠️ 后端未返回映射关系，使用默认映射')
        return this.getDefaultMappings()
      }
    } catch (error) {
      console.warn('⚠️ 获取场景映射关系失败，使用默认映射:', error)
      return this.getDefaultMappings()
    }
  }

  /**
   * 根据场景ID获取对应的评测量表类型
   * @param {number|string} sceneId 场景ID  
   * @param {string} sceneName 场景名称（备用）
   * @returns {Promise<Array>} 评测量表类型列表
   */
  async getScaleTypesByScene(sceneId, sceneName = null) {
    const mappings = await this.getMappings()
    
    // 尝试通过场景ID匹配
    if (sceneId && mappings.sceneToScales) {
      const scaleTypes = mappings.sceneToScales[sceneId] || mappings.sceneToScales[String(sceneId)]
      if (scaleTypes && scaleTypes.length > 0) {
        console.log(`🎯 场景${sceneId}映射到评测量表:`, scaleTypes)
        return scaleTypes
      }
    }

    // 尝试通过场景名称匹配
    if (sceneName && mappings.sceneNameToScales) {
      const scaleTypes = mappings.sceneNameToScales[sceneName]
      if (scaleTypes && scaleTypes.length > 0) {
        console.log(`🎯 场景「${sceneName}」映射到评测量表:`, scaleTypes)
        return scaleTypes
      }
    }

    console.log(`⚠️ 场景${sceneId || sceneName}未找到对应的评测量表，返回空数组`)
    return []
  }

  /**
   * 根据场景ID获取对应的音乐类型/标签
   * @param {number|string} sceneId 场景ID
   * @param {string} sceneName 场景名称（备用）
   * @returns {Promise<Array>} 音乐类型/标签列表
   */
  async getMusicTypesByScene(sceneId, sceneName = null) {
    const mappings = await this.getMappings()
    
    // 尝试通过场景ID匹配
    if (sceneId && mappings.sceneToMusic) {
      const musicTypes = mappings.sceneToMusic[sceneId] || mappings.sceneToMusic[String(sceneId)]
      if (musicTypes && musicTypes.length > 0) {
        console.log(`🎯 场景${sceneId}映射到音乐类型:`, musicTypes)
        return musicTypes
      }
    }

    // 尝试通过场景名称匹配
    if (sceneName && mappings.sceneNameToMusic) {
      const musicTypes = mappings.sceneNameToMusic[sceneName]
      if (musicTypes && musicTypes.length > 0) {
        console.log(`🎯 场景「${sceneName}」映射到音乐类型:`, musicTypes)
        return musicTypes
      }
    }

    console.log(`⚠️ 场景${sceneId || sceneName}未找到对应的音乐类型，返回空数组`)
    return []
  }

  /**
   * 检查评测量表是否匹配场景
   * @param {Object} scale 评测量表对象
   * @param {number|string} sceneId 场景ID
   * @param {string} sceneName 场景名称
   * @returns {Promise<boolean>} 是否匹配
   */
  async isScaleMatchingScene(scale, sceneId, sceneName = null) {
    // 🔧 修复：增强数据验证，确保 scale 对象有效
    if (!scale || typeof scale !== 'object' || (!sceneId && !sceneName)) {
      console.warn('⚠️ 无效的量表对象或场景参数:', { scale, sceneId, sceneName })
      return true
    }

    try {
      const mappings = await this.getMappings()
      
      // 检查是否成功获取到映射关系
      if (!mappings || (!mappings.sceneToScales && !mappings.sceneNameToScales)) {
        console.warn('⚠️ 未获取到场景映射关系，显示所有量表')
        return true // 映射关系获取失败时，显示所有
      }
      
      const scaleTypes = await this.getScaleTypesByScene(sceneId, sceneName)
      
      // 如果映射关系存在但该场景没有对应的量表，则不显示任何量表
      if (scaleTypes.length === 0) {
        console.log(`🚫 场景${sceneId || sceneName}没有对应的评测量表，过滤所有量表`)
        return false
      }

      // 🔧 修复：使用统一的字段名称
      const scaleName = scale.scale_name
      const scaleType = scale.scale_type
      
      // 🔧 修复：增加数据验证，确保提取到有效的量表信息
      if (!scaleName) {
        console.warn('⚠️ 无法从量表对象中提取有效名称:', scale)
        return false // 如果无法获取量表名称，不显示
      }
      
      const matches = scaleTypes.some(mappedItem => {
        // 处理后端返回的不同数据格式，提取原始名称（不转换）
        const mappedName = mappedItem.name || mappedItem.scale_name || mappedItem
        
        if (!mappedName) return false
        
        // 1. 精确名称匹配（最优先）
        if (scaleName === mappedName) return true
        
        // 2. 如果有转换逻辑，尝试转换后匹配
        const mappedTypeConverted = this.extractScaleType(mappedItem)
        if (mappedTypeConverted) {
          // 尝试将前端量表名称也转换后匹配
          const scaleNameConverted = this.convertScaleNameToType(scaleName)
          if (scaleNameConverted === mappedTypeConverted) return true
          
          // 也检查scale_type字段
          if (scaleType === mappedTypeConverted) return true
        }
        
        // 3. 模糊匹配（包含关系）
        if (scaleName && mappedName && typeof scaleName === 'string' && typeof mappedName === 'string') {
          if (scaleName.includes(mappedName) || mappedName.includes(scaleName)) return true
        }
        
        return false
      })

      // 🔧 修复：使用正确的变量 scaleName 而不是 scale.name，避免显示 undefined
      console.log(`🔍 量表「${scaleName}」在场景${sceneId || sceneName}中匹配结果:`, {
        前端量表名称: scaleName,
        前端量表类型: scaleType,
        前端原始对象: {
          scale_name: scale.scale_name,
          scale_type: scale.scale_type
        },
        后端映射量表: scaleTypes.map(item => {
          if (typeof item === 'object') {
            return item.scale_name || item.name || item
          }
          return item
        }),
        匹配结果: matches
      })
      return matches
      
    } catch (error) {
      console.error('❌ 场景量表匹配检查失败:', error)
      return true // 出错时显示所有量表
    }
  }

  /**
   * 检查音乐/脑波是否匹配场景（支持新的music_categories字段）
   * @param {Object} music 音乐/脑波对象
   * @param {number|string} sceneId 场景ID
   * @param {string} sceneName 场景名称
   * @returns {Promise<boolean>} 是否匹配
   */
  async isMusicMatchingScene(music, sceneId, sceneName = null) {
    if (!music || (!sceneId && !sceneName)) return true

    // 🔧 更新：优先尝试使用新的场景详情接口
    let musicTypes = []
    try {
      const sceneDetail = await this.getSceneDetail(sceneId || sceneName)
      if (sceneDetail.success && sceneDetail.data && sceneDetail.data.music_categories) {
        // 使用新的music_categories字段
        musicTypes = sceneDetail.data.music_categories
        console.log(`🎵 使用新API获取场景${sceneId || sceneName}的音乐分类:`, musicTypes.map(c => c.category_name))
      } else {
        throw new Error('新API无数据')
      }
    } catch (error) {
      console.log('🔄 新API失败，回退到旧映射逻辑:', error.message)
      // 回退到旧的映射逻辑
      musicTypes = await this.getMusicTypesByScene(sceneId, sceneName)
    }
    
    if (musicTypes.length === 0) return true // 如果没有映射关系，显示所有

    // 获取音乐的类型信息（支持新字段）
    const musicCategories = [
      music.assessment_scale_name,
      music.scale_type,
      music.scale_name,
      music.category,
      music.category_name, // 🔧 新增：支持新字段
      music.category_code, // 🔧 新增：支持新字段
      music.type,
      music.tags
    ].filter(Boolean)

    // 将tags数组展平
    const flatMusicCategories = musicCategories.reduce((acc, item) => {
      if (Array.isArray(item)) {
        acc.push(...item)
      } else {
        acc.push(item)
      }
      return acc
    }, [])

    // 检查是否有匹配的类型（支持新格式）
    const matches = musicTypes.some(mappedItem => {
      // 处理后端返回的不同数据格式
      const mappedType = this.extractMusicType(mappedItem)
      if (!mappedType) return false
      
      return flatMusicCategories.some(musicCategory => {
        if (!musicCategory || !mappedType) return false
        
        // 精确匹配
        if (musicCategory === mappedType) return true
        
        // 模糊匹配（包含关系）
        return musicCategory.includes(mappedType) || mappedType.includes(musicCategory)
      })
    })

    console.log(`🔍 音乐「${music.name || music.title}」在场景${sceneId || sceneName}中匹配:`, matches)
    return matches
  }

  /**
   * 从映射项中提取量表类型（兼容不同数据格式，支持中文名称转换）
   * @param {string|Object} mappedItem 映射项，可能是字符串或对象
   * @returns {string|null} 提取的量表类型
   */
  extractScaleType(mappedItem) {
    if (typeof mappedItem === 'string') {
      const converted = this.convertScaleNameToType(mappedItem)
      console.log('🔍 提取量表类型(字符串):', mappedItem, '->', converted)
      return converted
    }
    
    if (typeof mappedItem === 'object' && mappedItem !== null) {
      // 尝试从不同的字段中提取类型（优先提取name字段，因为它包含具体的量表名称）
      let extracted = mappedItem.scale_type || 
                     mappedItem.name ||     // 将name提前，因为它包含具体量表名称
                     mappedItem.code || 
                     mappedItem.type ||     // type通常是通用类型如"international"，放后面
                     mappedItem.id ||
                     null
      
      // 如果提取的是中文名称，尝试转换为类型代码
      if (extracted && typeof extracted === 'string') {
        const converted = this.convertScaleNameToType(extracted)
        if (converted !== extracted) {
          console.log('🔍 提取量表类型(对象-转换):', {
            原始对象: mappedItem,
            提取字段: extracted,
            转换结果: converted
          })
          return converted
        }
      }
      
      console.log('🔍 提取量表类型(对象):', { 
        原始对象: mappedItem, 
        提取结果: extracted 
      })
      return extracted
    }
    
    console.log('🔍 提取量表类型(未知格式):', mappedItem)
    return null
  }

  /**
   * 将中文量表名称转换为类型代码
   * @param {string} scaleName 量表名称
   * @returns {string} 量表类型代码
   */
  convertScaleNameToType(scaleName) {
    if (!scaleName || typeof scaleName !== 'string') return scaleName
    
    const nameMap = {
      // 汉密尔顿抑郁量表
      '汉密尔顿抑郁量表-17项': 'HAMD-17',
      '汉密尔顿抑郁量表': 'HAMD-17',
      'HAMD-17': 'HAMD-17',
      'Hamilton Depression Rating Scale': 'HAMD-17',
      
      // 广泛性焦虑量表
      '广泛性焦虑量表-7项': 'GAD-7', 
      '广泛性焦虑量表': 'GAD-7',
      'GAD-7': 'GAD-7',
      'Generalized Anxiety Disorder': 'GAD-7',
      
      // 匹兹堡睡眠质量指数
      '匹兹堡睡眠质量指数': 'PSQI',
      'PSQI': 'PSQI',
      'Pittsburgh Sleep Quality Index': 'PSQI',
      
      // 其他可能的量表
      '患者健康问卷-9项': 'PHQ-9',
      'PHQ-9': 'PHQ-9',
      '压力知觉量表': 'PSS',
      'PSS': 'PSS'
    }
    
    // 精确匹配
    if (nameMap[scaleName]) {
      return nameMap[scaleName]
    }
    
    // 模糊匹配（包含关系）
    for (const [key, value] of Object.entries(nameMap)) {
      if (scaleName.includes(key) || key.includes(scaleName)) {
        return value
      }
    }
    
    // 如果没有找到匹配，返回原名称
    return scaleName
  }

  /**
   * 从映射项中提取音乐类型（兼容不同数据格式，支持新字段）
   * @param {string|Object} mappedItem 映射项，可能是字符串或对象
   * @returns {string|null} 提取的音乐类型
   */
  extractMusicType(mappedItem) {
    if (typeof mappedItem === 'string') {
      return mappedItem
    }
    
    if (typeof mappedItem === 'object' && mappedItem !== null) {
      // 🔧 更新：优先使用新的统一字段名
      return mappedItem.category_name ||  // 新字段：音乐分类名称
             mappedItem.category_code ||  // 新字段：音乐分类代码
             mappedItem.music_type ||     // 旧字段：音乐类型
             mappedItem.type || 
             mappedItem.name || 
             mappedItem.category || 
             mappedItem.tag ||
             mappedItem.code || 
             mappedItem.id ||
             null
    }
    
    return null
  }

  /**
   * 从场景列表重建映射关系（通过调用详情接口）
   * 这是当专门的映射接口不可用时的根源解决方案
   * @returns {Promise<Object>} 映射关系数据
   */
  async buildMappingsFromSceneList() {
    console.log('🔨 从场景列表重建映射关系...')
    
    try {
      // 1. 获取场景列表
      const sceneListResult = await get('/api/scene/list')
      if (!sceneListResult.success || !sceneListResult.data) {
        throw new Error('无法获取场景列表')
      }
      
      const sceneList = sceneListResult.data
      console.log('📋 获取到场景列表，数量:', sceneList.length)
      
      // 2. 并行获取每个场景的详情（包含assessment_scales）
      const sceneDetailsPromises = sceneList.map(scene => 
        this.getSceneDetail(scene.id).catch(error => {
          console.warn(`获取场景${scene.id}详情失败:`, error)
          return { success: false, data: null, sceneId: scene.id }
        })
      )
      
      const sceneDetailsResults = await Promise.all(sceneDetailsPromises)
      console.log('📊 场景详情获取完成')
      
      // 3. 构建映射关系
      const sceneToScales = {}
      const sceneToMusic = {}
      const sceneNameToScales = {}
      const sceneNameToMusic = {}
      const scenes = []
      
      sceneList.forEach((scene, index) => {
        scenes.push({
          id: scene.id,
          name: scene.name,
          code: scene.code
        })
        
        const detailResult = sceneDetailsResults[index]
        const sceneIdStr = scene.id.toString()
        
        if (detailResult.success && detailResult.data) {
          // 使用真实的API数据
          const { assessment_scales = [], music_categories = [] } = detailResult.data
          
          sceneToScales[sceneIdStr] = assessment_scales
          sceneToMusic[sceneIdStr] = music_categories
          sceneNameToScales[scene.name] = assessment_scales
          sceneNameToMusic[scene.name] = music_categories
          
          console.log(`✅ 场景 ${scene.name}(ID:${scene.id}) 真实映射:`, 
            `量表${assessment_scales.length}个, 音乐${music_categories.length}个`)
        } else {
          // 后备到默认映射
          const defaultMappings = this.getDefaultMappings()
          sceneToScales[sceneIdStr] = defaultMappings.sceneToScales[scene.id] || []
          sceneToMusic[sceneIdStr] = defaultMappings.sceneToMusic[scene.id] || []
          sceneNameToScales[scene.name] = defaultMappings.sceneNameToScales[scene.name] || []
          sceneNameToMusic[scene.name] = defaultMappings.sceneNameToMusic[scene.name] || []
          
          console.log(`⚠️ 场景 ${scene.name}(ID:${scene.id}) 使用默认映射`)
        }
      })
      
      return {
        success: true,
        data: {
          sceneToScales,
          sceneToMusic,
          sceneNameToScales,
          sceneNameToMusic
        },
        meta: {
          scenes,
          generated_at: new Date().toISOString(),
          total_scenes: sceneList.length,
          build_method: 'scene_details'
        }
      }
      
    } catch (error) {
      console.error('❌ 从场景列表重建映射失败:', error)
      // 最终后备：使用默认映射
      console.log('🔄 使用默认映射作为最终后备')
      return {
        success: true,
        data: this.getDefaultMappings(),
        meta: {
          generated_at: new Date().toISOString(),
          build_method: 'default_fallback'
        }
      }
    }
  }

  /**
   * 获取场景详情（支持新的统一接口）
   * @param {string|number} sceneIdentifier 场景标识符
   * @returns {Promise<Object>} 场景详情
   */
  async getSceneDetail(sceneIdentifier) {
    try {
      // 使用新的统一接口
      const result = await get(`/api/scene/${sceneIdentifier}`)
      
      if (result.success && result.data) {
        return result
      } else {
        throw new Error('场景不存在')
      }
    } catch (error) {
      console.error('获取场景详情失败:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 获取默认映射关系（后备方案）
   * @returns {Object} 默认映射关系
   */
  getDefaultMappings() {
    console.log('📋 使用默认场景映射关系')
    
    return {
      // 场景ID到评测量表类型的映射
      sceneToScales: {
        1: ['HAMD', 'HAMD-17'], // 抑郁症状
        2: ['HAMA', 'GAD-7'], // 焦虑症状
        3: ['PSQI'], // 睡眠问题
        4: ['PSS'], // 压力相关
        5: ['WHOQOL'] // 生活质量
      },
      
      // 场景名称到评测量表类型的映射
      sceneNameToScales: {
        '抑郁疗愈': ['HAMD', 'HAMD-17'],
        '焦虑缓解': ['HAMA', 'GAD-7'],
        '睡眠改善': ['PSQI'],
        '压力释放': ['PSS'],
        '情绪调节': ['HAMD', 'HAMA']
      },
      
      // 场景ID到音乐类型的映射
      sceneToMusic: {
        1: ['HAMD', 'depression', 'mood_lifting'], // 抑郁疗愈
        2: ['HAMA', 'anxiety', 'calming'], // 焦虑缓解
        3: ['PSQI', 'sleep', 'relaxation'], // 睡眠改善
        4: ['PSS', 'stress_relief', 'relaxation'], // 压力释放
        5: ['mood_regulation', 'emotional_balance'] // 情绪调节
      },
      
      // 场景名称到音乐类型的映射
      sceneNameToMusic: {
        '抑郁疗愈': ['HAMD', 'depression', 'mood_lifting'],
        '焦虑缓解': ['HAMA', 'anxiety', 'calming'],
        '睡眠改善': ['PSQI', 'sleep', 'relaxation'],
        '压力释放': ['PSS', 'stress_relief', 'relaxation'],
        '情绪调节': ['mood_regulation', 'emotional_balance']
      }
    }
  }

  /**
   * 清除缓存（用于调试）
   */
  clearCache() {
    this.mappings = null
    this.lastFetchTime = null
    console.log('🗑️ 场景映射缓存已清除')
  }

  /**
   * 强制刷新映射关系
   */
  async forceRefresh() {
    console.log('🔄 强制刷新场景映射关系...')
    this.clearCache()
    return await this.getMappings(true)
  }

  /**
   * 获取调试信息
   */
  getDebugInfo() {
    return {
      hasMappings: !!this.mappings,
      lastFetchTime: this.lastFetchTime,
      cacheAge: this.lastFetchTime ? Date.now() - this.lastFetchTime : null,
      mappingsKeys: this.mappings ? Object.keys(this.mappings) : null,
      sceneCount: this.mappings?.meta?.total_scenes || 0,
      cacheValid: this.lastFetchTime && (Date.now() - this.lastFetchTime < this.cacheExpiration)
    }
  }
}

// 创建单例实例
const sceneMappingService = new SceneMappingService()

// 🔧 修复后立即清除缓存，确保使用新的正确逻辑
sceneMappingService.clearCache()
console.log('🔄 场景映射服务已修复，缓存已清除，将使用正确的API调用优先级')

module.exports = {
  sceneMappingService,
  SceneMappingService
}
