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
  async getMappings() {
    try {
      // 检查缓存是否有效
      if (this.mappings && this.lastFetchTime && 
          (Date.now() - this.lastFetchTime < this.cacheExpiration)) {
        console.log('🎯 使用缓存的场景映射关系')
        return this.mappings
      }

      console.log('🔄 从后端获取场景映射关系...')
      
      // 尝试从后端获取映射关系
      const result = await get('/scene/mappings')
      
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
    if (!scale || (!sceneId && !sceneName)) return true

    const scaleTypes = await this.getScaleTypesByScene(sceneId, sceneName)
    if (scaleTypes.length === 0) return true // 如果没有映射关系，显示所有

    // 检查量表类型是否在映射列表中
    const scaleType = scale.scale_type || scale.type || scale.name
    const matches = scaleTypes.some(mappedItem => {
      // 处理后端返回的不同数据格式
      const mappedType = this.extractScaleType(mappedItem)
      if (!mappedType) return false
      
      // 精确匹配
      if (scaleType === mappedType) return true
      
      // 模糊匹配（包含关系）
      if (scaleType && mappedType) {
        return scaleType.includes(mappedType) || mappedType.includes(scaleType)
      }
      
      return false
    })

    console.log(`🔍 量表「${scale.name}」(${scaleType}) 在场景${sceneId || sceneName}中匹配:`, matches)
    return matches
  }

  /**
   * 检查音乐/脑波是否匹配场景
   * @param {Object} music 音乐/脑波对象
   * @param {number|string} sceneId 场景ID
   * @param {string} sceneName 场景名称
   * @returns {Promise<boolean>} 是否匹配
   */
  async isMusicMatchingScene(music, sceneId, sceneName = null) {
    if (!music || (!sceneId && !sceneName)) return true

    const musicTypes = await this.getMusicTypesByScene(sceneId, sceneName)
    if (musicTypes.length === 0) return true // 如果没有映射关系，显示所有

    // 获取音乐的类型信息
    const musicCategories = [
      music.assessment_scale_name,
      music.scale_type,
      music.scale_name,
      music.category,
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

    // 检查是否有匹配的类型
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
   * 从映射项中提取量表类型（兼容不同数据格式）
   * @param {string|Object} mappedItem 映射项，可能是字符串或对象
   * @returns {string|null} 提取的量表类型
   */
  extractScaleType(mappedItem) {
    if (typeof mappedItem === 'string') {
      console.log('🔍 提取量表类型(字符串):', mappedItem)
      return mappedItem
    }
    
    if (typeof mappedItem === 'object' && mappedItem !== null) {
      // 尝试从不同的字段中提取类型
      const extracted = mappedItem.scale_type || 
                       mappedItem.type || 
                       mappedItem.name || 
                       mappedItem.code || 
                       mappedItem.id ||
                       null
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
   * 从映射项中提取音乐类型（兼容不同数据格式）
   * @param {string|Object} mappedItem 映射项，可能是字符串或对象
   * @returns {string|null} 提取的音乐类型
   */
  extractMusicType(mappedItem) {
    if (typeof mappedItem === 'string') {
      return mappedItem
    }
    
    if (typeof mappedItem === 'object' && mappedItem !== null) {
      // 尝试从不同的字段中提取类型
      return mappedItem.music_type || 
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
   * 获取调试信息
   * @returns {Object} 调试信息
   */
  getDebugInfo() {
    return {
      hasCachedMappings: !!this.mappings,
      lastFetchTime: this.lastFetchTime,
      cacheAge: this.lastFetchTime ? Date.now() - this.lastFetchTime : null,
      cacheValid: this.lastFetchTime && (Date.now() - this.lastFetchTime < this.cacheExpiration)
    }
  }
}

// 创建单例实例
const sceneMappingService = new SceneMappingService()

module.exports = {
  sceneMappingService,
  SceneMappingService
}
