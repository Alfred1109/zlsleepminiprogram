/**
 * 统一音乐管理器
 * 与后端统一配置保持一致，简化前端数据源管理
 */

class UnifiedMusicManager {
  constructor() {
    this.categories = []
    this.categoryMap = new Map()
    this.api = require('./api')
    this.brainwaveGenerator = require('./brainwaveGenerator')
    
    // 移除缓存配置 - 现在直接从服务器获取数据
    
    console.log('统一音乐管理器初始化')
  }

  /**
   * 初始化管理器 - 直接从服务器获取最新数据
   */
  async init() {
    try {
      console.log('初始化统一音乐管理器...')
      
      // 直接从服务器获取最新分类数据
      await this.refreshCategories()
      
      console.log('统一音乐管理器初始化完成')
      return true
    } catch (error) {
      console.error('统一音乐管理器初始化失败:', error)
      this.useDefaultCategories()
      return false
    }
  }

  /**
   * 从服务器获取分类数据 - 无缓存版本（添加详细调试）
   */
  async refreshCategories() {
    try {
      console.log('=== 开始从服务器获取分类数据 ===')
      
      // 检查网络配置
      const { getCurrentConfig } = require('./config')
      const config = getCurrentConfig()
      console.log('📡 当前API配置:', {
        API_BASE_URL: config.API_BASE_URL,
        STATIC_BASE_URL: config.STATIC_BASE_URL,
        DEBUG: config.DEBUG,
        TIMEOUT: config.TIMEOUT
      })
      
      // 添加时间戳防止浏览器缓存
      const timestamp = Date.now()
      const requestUrl = `/music/categories?t=${timestamp}`
      
      console.log('🌐 发起API请求:', requestUrl)
      console.log('⏰ 请求时间:', new Date().toLocaleString())
      
      const response = await this.api.request({
        url: requestUrl,
        method: 'GET',
        showLoading: false,
        timeout: 15000 // 增加超时时间
      })

      console.log('📨 收到API响应:', {
        response: response,
        success: response?.success,
        dataType: typeof response?.data,
        dataLength: Array.isArray(response?.data) ? response.data.length : 'not array'
      })

      if (response && response.success && response.data) {
        this.categories = response.data
        this.buildCategoryMap()
        
        console.log('✅ 分类数据获取成功:', {
          count: this.categories.length,
          categories: this.categories.map(cat => ({ id: cat.id, name: cat.name }))
        })
        return true
      } else {
        console.error('❌ 服务器返回数据异常:', {
          response: response,
          hasResponse: !!response,
          hasSuccess: response?.success,
          hasData: !!response?.data
        })
        this.useDefaultCategories()
        return false // 改为返回false表示失败
      }
    } catch (error) {
      console.error('💥 获取分类数据失败:', {
        error: error,
        message: error.message,
        stack: error.stack
      })
      this.useDefaultCategories()
      return false // 改为返回false表示失败
    }
  }

  /**
   * 根据分类获取音乐或脑波配置
   */
  async getMusicByCategory(categoryId, options = {}) {
    try {
      const category = this.getCategoryById(categoryId)
      if (!category) {
        throw new Error(`分类 ${categoryId} 不存在`)
      }
      


      // 列表模式：返回该分类下的多条音乐（用于分类页）
      if (options.format === 'list') {
        console.log('列表模式获取分类音乐: ', categoryId, category.name)

        // 🎯 优先从数据库获取音乐列表
        try {
          const dbMusicResult = await this.api.request({
            url: `/preset-music/category/${categoryId}`,
            method: 'GET',
            showLoading: options.showLoading !== false,
            loadingText: options.loadingText || '加载音乐中...'
          })

          if (dbMusicResult && dbMusicResult.success && dbMusicResult.data && Array.isArray(dbMusicResult.data)) {
            console.log(`[UnifiedMusicManager] 分类${categoryId}使用数据库音乐列表: ${dbMusicResult.data.length}首`)
            
            // 过滤掉无效音乐（static路径文件不存在）
            const validMusic = dbMusicResult.data.filter(music => this.isValidMusicFile(music))
            
            if (validMusic.length === 0) {
              console.warn(`[UnifiedMusicManager] 分类${categoryId}数据库音乐全部无效，使用七牛云文件`)
              throw new Error('数据库音乐全部无效')
            }
            
            const limited = typeof options.limit === 'number' ? validMusic.slice(0, options.limit) : validMusic
            const processed = limited.map(music => ({
              id: music.id || `db_${categoryId}_${Date.now()}_${Math.random()}`,
              title: music.title || music.name || '未知音乐',
              name: music.title || music.name || '未知音乐',
              url: music.url || music.file_path,  // 优先使用带token的url
              path: music.url || music.file_path,
              image: this.fixImagePath(music.cover_image) || '/images/default-music-cover.svg',
              duration: music.duration || 0,
              category: category.name || '音乐',
              description: music.description || '',
              healing_resource_id: music.healing_resource_id,
              source: 'database_list',
              available: music.available
            }))
            return processed
          }
        } catch (error) {
          console.warn(`[UnifiedMusicManager] 分类${categoryId}数据库音乐获取失败:`, error)
        }

        // 🥈 回退：从七牛云获取文件列表
        console.log(`[UnifiedMusicManager] 分类${categoryId}数据库无音乐，使用七牛云文件`)
        
        // 归一化分类代码，兼容后端 /qiniu/categories/<code>/files 接口
        const normalizeCode = (cat) => {
          const codeFromCat = (cat && (cat.code || cat.scale_type || cat.type)) || ''
          const idToCode = {
            1: 'natural_sound',
            2: 'white_noise',
            3: 'brainwave',
            4: 'ai_music',
            5: 'healing' // 后端映射中使用 healing
          }
          let code = codeFromCat || idToCode[categoryId] || 'healing'
          if (code === 'healing_resource') code = 'healing'
          return code
        }

        const categoryCode = normalizeCode(category)
        console.log('使用七牛云文件列表: ', categoryId, categoryCode)

        const listResp = await this.api.request({
          url: `/music/qiniu/categories/${categoryCode}/files`,
          method: 'GET',
          showLoading: options.showLoading !== false,
          loadingText: options.loadingText || '加载文件中...'
        })

        if (listResp && listResp.success && listResp.data && Array.isArray(listResp.data.files)) {
          const files = listResp.data.files
          const limited = typeof options.limit === 'number' ? files.slice(0, options.limit) : files
          const processed = limited.map(f => ({
            id: f.id || `qiniu_${Date.now()}_${Math.random()}`,
            title: f.name || '未知音乐',
            name: f.name || '未知音乐',
            url: f.url,
            path: f.url,
            image: '/images/default-music-cover.svg',
            duration: 0,
            category: category.name || categoryCode,
            description: '',
            source: 'qiniu_list'
          }))
          return processed
        } else {
          console.warn('分类列表接口无数据，回退为单曲模式')
          // 回退为单曲模式
        }
      }

      // 单曲模式：获取随机单条（用于首页/随机播放）
      console.log(`获取分类 ${categoryId} (${category.name}) 的音乐...`)
      const response = await this.api.request({
        url: `/music/random/${categoryId}`,
        method: 'GET',
        showLoading: options.showLoading !== false,
        loadingText: options.loadingText || '获取音乐中...'
      })

      if (response && response.success && response.data) {
        const musicData = response.data

        console.log('后端返回音频数据:', {
          title: musicData.title,
          url: musicData.url,
          available: musicData.available,
          source: musicData.source
        })

        // 验证音频URL是否有效
        if (this.isValidAudioUrl(musicData.url)) {
          console.log('后端返回有效音频数据:', musicData.title)
          // 处理音频文件数据
          return this.processAudioFile(musicData)
        } else {
          console.warn('后端返回的音频URL无效，尝试修复或回退:', {
            url: musicData.url,
            title: musicData.title,
            available: musicData.available,
            error: musicData.access_error
          })
          
          // 尝试修复URL或获取备用URL
          const fixedAudioData = await this.tryFixAudioUrl(musicData, categoryId)
          if (fixedAudioData) {
            console.log('URL修复成功，使用修复后的音频:', fixedAudioData.title)
            return this.processAudioFile(fixedAudioData)
          }
          
          // 如果修复失败，抛出友好的错误信息
          throw new Error(`音频暂时无法访问: ${musicData.access_error || '服务器正在处理中，请稍后再试'}`)
        }
      } else {
        const errorMsg = response?.message || response?.error || '获取音乐失败'
        console.error('后端返回错误:', response)
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('获取分类音乐失败:', error)

      // 检查是否是分类中没有音乐资源的错误
      if (error.message && error.message.includes('没有音乐资源')) {
        console.warn(`分类 ${categoryId} 中没有音乐资源，尝试智能回退`)
        
        // 尝试获取其他分类的音乐作为替代（只在选项允许时）
        if (options.allowFallback !== false) {
          const fallbackCategories = [1, 5, 4, 2] // 按优先级排序的备选分类
          for (const fallbackCategoryId of fallbackCategories) {
            if (fallbackCategoryId !== categoryId) {
              try {
                console.log(`智能回退：尝试从分类 ${fallbackCategoryId} 获取音乐...`)
                const fallbackResult = await this.getMusicByCategory(fallbackCategoryId, { 
                  allowFallback: false,
                  showLoading: false 
                })
                
                // 为回退音乐添加说明
                if (fallbackResult) {
                  fallbackResult.isFallback = true
                  fallbackResult.originalCategory = this.getCategoryName(categoryId)
                  fallbackResult.description = `由于${this.getCategoryName(categoryId)}暂时无可用内容，为您推荐${fallbackResult.category}音乐`
                  
                  console.log(`智能回退成功：从分类 ${fallbackCategoryId} 获得音乐`)
                  return fallbackResult
                }
              } catch (fallbackError) {
                console.warn(`分类 ${fallbackCategoryId} 回退失败:`, fallbackError.message)
              }
            }
          }
        }
        
        // 如果所有回退都失败，创建本地备用音频
        try {
          const localFallback = this.createLocalFallbackAudio(categoryId, '备用音频')
          if (localFallback) {
            console.log('使用本地备用音频作为最后回退')
            return localFallback
          }
        } catch (localError) {
          console.warn('本地备用音频创建失败:', localError)
        }
      }

      // 如果是音频访问相关的错误，提供更友好的提示
      if (error.message && (
        error.message.includes('音频URL无效') || 
        error.message.includes('音频暂时无法访问') ||
        error.message.includes('暂时无法访问')
      )) {
        console.warn(`分类 ${categoryId} 音频访问问题`)
        throw new Error(`该分类音频正在更新中，请选择其他分类或稍后再试`)
      }

      // 网络相关错误
      if (error.message && (
        error.message.includes('网络') || 
        error.message.includes('timeout') ||
        error.message.includes('请求失败')
      )) {
        throw new Error(`网络连接不稳定，请检查网络后重试`)
      }

      // 其他未知错误，提供通用的友好提示
      const categoryName = this.getCategoryName(categoryId)
      throw new Error(`${categoryName}暂时无法加载，请尝试其他分类或稍后再试`)
    }
  }



  /**
   * 验证音频URL是否有效（优化版）
   */
  isValidAudioUrl(url) {
    if (!url || typeof url !== 'string') {
      console.warn('音频URL为空或非字符串:', url)
      return false
    }

    // 检查是否为明显无效的示例URL
    const invalidPatterns = [
      'example.com',
      'placeholder',
      'localhost:3000',
      'test.mp3',
      'demo.wav'
    ]
    
    for (const pattern of invalidPatterns) {
      if (url.includes(pattern)) {
        console.warn('检测到无效URL模式:', url, pattern)
        return false
      }
    }

    // 检查是否为相对路径（小程序内资源）
    if (url.startsWith('/') && !url.startsWith('//')) {
      console.log('检测到相对路径，视为有效:', url)
      return true
    }

    // 检查是否为合法的URL格式
    try {
      const urlObj = new URL(url)
      
      // 检查协议是否为http或https
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        console.warn('URL协议不支持:', urlObj.protocol)
        return false
      }

      // 检查是否为七牛云域名（使用正确可用的域名）
      const validDomains = [
        'medsleep.cn',
        'cdn.medsleep.cn'
      ]
      
      const isValidDomain = validDomains.some(domain => 
        urlObj.hostname.includes(domain)
      )
      
      if (isValidDomain) {
        console.log('检测到七牛云域名，视为有效:', urlObj.hostname)
        return true
      }

      // 对于其他域名，进行基本的格式检查
      if (urlObj.hostname && urlObj.hostname.length > 0) {
        console.log('URL格式基本有效:', url)
        return true
      }

      return false
    } catch (e) {
      console.warn('URL格式检查失败，但仍可能有效:', url, e.message)
      // 放宽处理：即使URL解析失败，如果包含音频文件扩展名，也视为可能有效
      const audioExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg']
      const hasAudioExtension = audioExtensions.some(ext => 
        url.toLowerCase().includes(ext)
      )
      
      if (hasAudioExtension) {
        console.log('包含音频扩展名，视为可能有效:', url)
        return true
      }
      
      return false
    }
  }

  /**
   * 尝试修复无效的音频URL
   */
  async tryFixAudioUrl(musicData, categoryId) {
    try {
      console.log('尝试修复音频URL:', musicData.url)
      
      // 1. 尝试重新请求后端获取新的URL
      if (musicData.id) {
        try {
          console.log('尝试重新从后端获取音频URL...')
          const response = await this.api.request({
            url: `/music/random/${categoryId}`,
            method: 'GET',
            showLoading: false
          })
          
          if (response && response.success && response.data && 
              response.data.url && this.isValidAudioUrl(response.data.url)) {
            console.log('重新获取音频URL成功')
            return response.data
          }
        } catch (e) {
          console.warn('重新获取音频URL失败:', e)
        }
      }
      
      // 2. 尝试使用本地备用音频
      console.log('尝试使用本地备用音频...')
      const fallbackAudio = this.createLocalFallbackAudio(categoryId, musicData.title)
      if (fallbackAudio && this.isValidAudioUrl(fallbackAudio.url)) {
        console.log('使用本地备用音频成功')
        return fallbackAudio
      }
      
      // 3. 尝试修复七牛云URL（如果是七牛云URL）
      if (musicData.url && musicData.url.includes('medsleep.cn')) {
        console.log('尝试修复七牛云URL...')
        const fixedUrl = this.fixQiniuUrl(musicData.url)
        if (fixedUrl && this.isValidAudioUrl(fixedUrl)) {
          console.log('七牛云URL修复成功')
          return {
            ...musicData,
            url: fixedUrl
          }
        }
      }
      
      return null
    } catch (error) {
      console.error('URL修复失败:', error)
      return null
    }
  }

  /**
   * 修复七牛云URL
   */
  fixQiniuUrl(originalUrl) {
    try {
      console.log('🔄 URL修复已改为通过后端刷新，不再手动处理token')
      // 不再手动处理token，而是通过后端API重新获取
      // 这个方法保留兼容性，但建议使用 handleCdnAuthError 进行URL刷新
      
      // 如果是完整的URL，先尝试原样返回
      if (originalUrl.startsWith('http') && originalUrl.includes('medsleep.cn')) {
        console.log('返回原始URL，让后端处理token刷新')
        return originalUrl
      }
      
      return null
    } catch (error) {
      console.error('修复七牛云URL失败:', error)
      return null
    }
  }

  /**
   * 创建本地备用音频
   */
  createLocalFallbackAudio(categoryId, originalTitle) {
    try {
      // 根据分类提供本地备用音频路径
      const localAudioMap = {
        1: [ // 自然音
          { title: '雨声', url: '/assets/audio/natural_sounds/rain.mp3' },
          { title: '海浪声', url: '/assets/audio/natural_sounds/ocean.mp3' },
          { title: '森林声', url: '/assets/audio/natural_sounds/forest.mp3' }
        ],
        2: [ // 白噪音
          { title: '粉红噪音', url: '/assets/audio/white_noise/pink.mp3' },
          { title: '白噪音', url: '/assets/audio/white_noise/white.mp3' },
          { title: '褐色噪音', url: '/assets/audio/white_noise/brown.mp3' }
        ],
        4: [ // AI音乐
          { title: 'AI疗愈音乐', url: '/assets/audio/ai_music/healing.mp3' }
        ],
        5: [ // 疗愈资源
          { title: '疗愈冥想', url: '/assets/audio/healing/meditation.mp3' }
        ]
      }
      
      const categoryAudios = localAudioMap[categoryId] || []
      if (categoryAudios.length === 0) {
        return null
      }
      
      // 随机选择一个本地音频
      const selectedAudio = categoryAudios[Math.floor(Math.random() * categoryAudios.length)]
      
      return {
        id: `local_fallback_${categoryId}_${Date.now()}`,
        title: selectedAudio.title,
        url: selectedAudio.url,
        category: this.getCategoryName(categoryId),
        category_id: categoryId,
        type: 'audio_file',
        source: 'local_fallback',
        description: `本地备用音频 - ${selectedAudio.title}`,
        created_at: new Date().toISOString()
      }
    } catch (error) {
      console.error('创建本地备用音频失败:', error)
      return null
    }
  }

  /**
   * 根据分类ID获取分类名称
   */
  getCategoryName(categoryId) {
    const category = this.getCategoryById(categoryId)
    return category ? category.name : '未知分类'
  }

  /**
   * 处理音频文件数据
   */
  processAudioFile(audioData) {
    let audioUrl = audioData.url
    
    // 如果是相对路径，转换为完整URL
    if (audioUrl && audioUrl.startsWith('/')) {
      try {
        const { getCurrentConfig } = require('./config')
        const config = getCurrentConfig()
        const baseUrl = config.STATIC_BASE_URL || config.API_BASE_URL.replace('/api', '')
        audioUrl = `${baseUrl}${audioUrl}`
        console.log('转换音频URL:', audioData.url, '->', audioUrl)
      } catch (error) {
        console.warn('URL转换失败，使用原始URL:', error)
        audioUrl = audioData.url
      }
    }
    
    return {
      id: `audio_${audioData.id}`,
      name: audioData.title,
      description: audioData.description,
      category: audioData.category,
      type: 'audio_file',
      
      // 音频URL（完整URL）
      path: audioUrl,
      url: audioUrl,
      
      // 界面显示用
      image: this.getAudioImage(audioData.category_id, audioData.title),
      
      // 标记为音频文件类型
      isBrainwave: false,
      isAudioFile: true,
      
      // 创建时间
      createdAt: audioData.created_at
    }
  }

  /**
   * 获取回退音乐（本地）- 已禁用虚假URL回退
   */
  getFallbackMusic(categoryId) {
    console.log(`分类 ${categoryId} 没有可用音乐，不使用虚假URL回退`)
    
    // 不再使用包含 example.com 的虚假URL作为回退
    // 直接抛出友好的错误提示
    const categoryNames = {
      1: '自然音',
      2: '白噪音', 
      3: '脑波音频',
      4: 'AI音乐',
      5: '疗愈资源'
    }
    
    const categoryName = categoryNames[categoryId] || '该分类'
    throw new Error(`${categoryName}暂无可用内容，请选择其他分类或稍后再试`)
  }

  // createDefaultAudio 方法已移除，不再使用虚假URL



  /**
   * 获取音频文件对应的图片
   */
  getAudioImage(categoryId, title) {
    // 使用小程序内置默认图片，避免404错误
    const defaultImage = '/assets/images/default-image.png'
    
    const categoryImages = {
      1: { // 自然音
        '雨声': defaultImage,
        '海浪声': defaultImage,
        '森林声': defaultImage,
        '鸟鸣声': defaultImage,
        'default': defaultImage
      },
      2: { // 白噪音
        '粉红噪音': defaultImage,
        '褐色噪音': defaultImage,
        '白噪音': defaultImage,
        'default': defaultImage
      },
      4: { // AI音乐
        'default': defaultImage
      },
      5: { // 疗愈资源
        'default': defaultImage
      }
    }
    
    const categoryImageMap = categoryImages[categoryId] || categoryImages[1]
    return categoryImageMap[title] || categoryImageMap['default']
  }

  // 缓存相关方法已移除 - 现在直接从服务器获取数据

  /**
   * 使用默认分类
   */
  useDefaultCategories() {
    console.log('🚨🚨🚨 使用默认分类配置 - API请求失败！🚨🚨🚨')
    this.categories = [
      {
        id: 1,
        name: '自然音(默认)',
        code: 'natural_sound',
        description: '大自然的真实声音',
        icon: '🌿',
        type: 'audio_file',
        count: 1
      },
      {
        id: 2,
        name: '白噪音(默认)',
        code: 'white_noise', 
        description: '各种频率的白噪音',
        icon: '🔊',
        type: 'audio_file',
        count: 1
      },
      {
        id: 3,
        name: '抑郁疗愈(默认)',
        code: 'brainwave',
        description: '不同频率的脑波音频',
        icon: '🧠',
        type: 'audio_file',
        count: 1
      },
      {
        id: 5,
        name: '疗愈资源(默认)',
        code: 'healing_resource',
        description: '专业的疗愈资源',
        icon: '💚',
        type: 'audio_file',
        count: 1
      }
      // 注意：移除了ID=4的AI音乐分类（单独收费，不在UI中显示）
    ]
    this.buildCategoryMap()
  }

  /**
   * 构建分类映射
   */
  buildCategoryMap() {
    this.categoryMap.clear()
    this.categories.forEach(category => {
      this.categoryMap.set(category.id, category)
    })
  }

  /**
   * 获取所有分类
   */
  getAllCategories() {
    return [...this.categories]
  }

  /**
   * 根据ID获取分类
   */
  getCategoryById(id) {
    return this.categoryMap.get(id) || null
  }

  // 缓存方法已移除

  /**
   * 强制刷新分类数据（绕过缓存）
   */
  async forceRefreshFromServer() {
    try {
      console.log('强制从服务器刷新分类数据（绕过所有缓存）...')
      
      // 清除缓存
      this.clearCache()
      
      // 直接调用服务器API，添加时间戳防止缓存
      const timestamp = Date.now()
      const response = await this.api.request({
        url: `/music/categories?t=${timestamp}`,
        method: 'GET',
        showLoading: false
      })

      if (response && response.success && response.data) {
        this.categories = response.data
        this.buildCategoryMap()
        
        // 保存到缓存
        await this.saveToCache()
        
        console.log('强制刷新分类数据成功:', this.categories.length)
        return {
          success: true,
          data: this.categories,
          message: '分类数据已从服务器更新'
        }
      } else {
        console.warn('强制刷新返回数据异常:', response)
        throw new Error('服务器返回数据异常')
      }
    } catch (error) {
      console.error('强制刷新分类数据失败:', error)
      return {
        success: false,
        error: error.message || '强制刷新失败',
        message: '无法从服务器获取最新分类数据'
      }
    }
  }

  /**
   * 检查音乐文件是否有效
   */
  isValidMusicFile(music) {
    if (!music || !music.file_path) return false
    
    // 过滤掉static路径的无效文件
    if (music.file_path.startsWith('static/')) {
      console.warn(`[UnifiedMusicManager] 过滤无效音乐: ${music.title} (${music.file_path})`)
      return false
    }
    
    // 过滤掉不可用的音乐
    if (music.available === false) {
      console.warn(`[UnifiedMusicManager] 过滤不可用音乐: ${music.title}`)
      return false
    }
    
    return true
  }

  /**
   * 修复图片路径（转换错误的/static/路径）
   */
  fixImagePath(imagePath) {
    if (!imagePath) return null
    
    // 修复后端返回的错误路径：/static/images/ → /images/
    if (imagePath.startsWith('/static/images/')) {
      return imagePath.replace('/static/images/', '/images/')
    }
    
    // 修复后端返回的错误路径：/static/ → /
    if (imagePath.startsWith('/static/')) {
      return imagePath.replace('/static/', '/')
    }
    
    return imagePath
  }

  // 缓存信息方法已移除
}

// 创建全局实例
const unifiedMusicManager = new UnifiedMusicManager()

module.exports = {
  UnifiedMusicManager,
  unifiedMusicManager
}
