// pages/categories/categories.js
const { unifiedMusicManager } = require('../../utils/unifiedMusicManager')
const { MusicAPI } = require('../../utils/healingApi')
const AuthService = require('../../services/AuthService')

Page({
  data: {
    categories: [],
    loading: true,
    // 全局播放器相关
    showGlobalPlayer: false,
    isPlaying: false,
    
    // 主题相关
    currentTheme: 'default',
    themeClass: '',
    themeConfig: null
  },

  // 缓存过滤后的分类，避免重复filter操作
  _filteredCategoriesCache: null,
  _lastCategoriesData: null,

  /**
   * 高效获取过滤后的分类（带缓存）
   */
  getFilteredCategories(allCategories) {
    // 检查是否可以使用缓存
    if (this._filteredCategoriesCache && 
        this._lastCategoriesData && 
        JSON.stringify(allCategories) === JSON.stringify(this._lastCategoriesData)) {
      return this._filteredCategoriesCache
    }

    // 执行过滤操作并缓存结果
    const isLongSequenceCategory = (cat) => {
      const name = (cat.name || '').toString().toLowerCase()
      const code = (cat.code || cat.scale_type || cat.type || '').toString().toLowerCase()
      return (
        name.includes('长序列') ||
        (name.includes('long') && name.includes('sequence')) ||
        code.includes('long_sequence') ||
        code.includes('longsequence')
      )
    }
    // 显式屏蔽ID=4、ID=6（长序列冥想），以及名称/code匹配到的长序列类目
    const filtered = allCategories.filter(cat => cat.id !== 4 && cat.id !== 6 && !isLongSequenceCategory(cat))
    try {
      const detectedIds = allCategories
        .filter(isLongSequenceCategory)
        .map(cat => cat.id)
        .filter(id => id !== undefined && id !== null)
      if (detectedIds.length > 0) {
        console.log('[全部分类] 检测到长序列相关分类ID:', detectedIds.join(', '))
      }
    } catch (e) {
      console.warn('[全部分类] 长序列分类检测失败:', e)
    }
    this._filteredCategoriesCache = filtered
    this._lastCategoriesData = allCategories
    return filtered
  },

  onLoad: function (options) {
    console.log('Categories page loaded')
    
    // 初始化主题
    this.initTheme()
    
    // 初始化全局播放器 - 修复全局播放器在分类页面不工作的问题
    this.initGlobalPlayerRef()
    
    // 检查登录状态，未登录时引导用户登录
    if (!AuthService.getCurrentUser()) {
      wx.showModal({
        title: '请先登录',
        content: '访问音乐分类需要先登录账户，立即前往登录页面？',
        showCancel: true,
        cancelText: '取消',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ 
              url: '/pages/login/login?redirect=' + encodeURIComponent('/pages/categories/categories')
            })
          } else {
            // 用户取消登录，返回上一页
            wx.navigateBack()
          }
        }
      })
      return
    }
    
    this.initCategories()
  },
  
  /**
   * 初始化全局播放器引用 - 确保全局播放器在当前页面正常工作
   */
  initGlobalPlayerRef() {
    const app = getApp()
    if (app.globalData) {
      // 设置页面引用，供全局播放器组件使用
      app.globalData.currentPageInstance = this
      console.log('✅ 分类页面 - 全局播放器引用已初始化')
    }
  },

  onShow: function () {
    // 页面显示时刷新数据
    this.refreshCategories()
  },

  // 初始化分类系统
  async initCategories() {
    try {
      this.setData({ loading: true })
      console.log('初始化统一音乐管理器...')
      
      // 初始化统一音乐管理器
      const success = await unifiedMusicManager.init()
      
      if (success) {
        const allCategories = unifiedMusicManager.getAllCategories()
        // 使用缓存方法避免重复filter操作
        const categories = this.getFilteredCategories(allCategories)
        this.setData({
          categories: categories,
          loading: false
        })
        // 同步各自分类的实际音频数
        this.updateActualCounts()
        console.log('分类初始化成功:', categories.length, '(AI音乐分类已过滤)')
      } else {
        throw new Error('统一音乐管理器初始化失败')
      }
    } catch (error) {
      console.error('初始化分类失败:', error)
      this.setData({ 
        loading: false,
        categories: this.getDefaultCategories()
      })
      
      wx.showToast({
        title: '加载失败，使用默认分类',
        icon: 'none'
      })
    }
  },

  // 刷新分类数据
  async refreshCategories() {
    try {
      // 获取当前分类（可能来自缓存）
      const allCategories = unifiedMusicManager.getAllCategories()
      // 使用缓存方法避免重复filter操作
      const categories = this.getFilteredCategories(allCategories)
      
      if (categories.length > 0) {
        this.setData({ categories })
        // 刷新时也对齐实际计数
        this.updateActualCounts()
      }
      
      // 尝试从服务器更新（不阻塞UI）
      unifiedMusicManager.refreshCategories().then(updated => {
        if (updated) {
          const allNewCategories = unifiedMusicManager.getAllCategories()
          const newCategories = this.getFilteredCategories(allNewCategories)
          this.setData({ categories: newCategories })
          this.updateActualCounts()
          console.log('分类数据已更新')
        }
      }).catch(error => {
        console.warn('后台更新分类失败:', error)
      })
      
    } catch (error) {
      console.error('刷新分类失败:', error)
    }
  },

  /**
   * 检查音乐文件是否有效
   */
  isValidMusicFile(music) {
    if (!music || !music.file_path) return false
    
    // 过滤掉static路径的无效文件
    if (music.file_path.startsWith('static/')) {
      console.warn(`[Categories] 过滤无效音乐: ${music.title} (${music.file_path})`)
      return false
    }
    
    // 过滤掉不可用的音乐
    if (music.available === false) {
      console.warn(`[Categories] 过滤不可用音乐: ${music.title}`)
      return false
    }
    
    return true
  },

  /**
   * 将分类对象映射到后端分类代码
   */
  getCategoryCode(category) {
    if (!category) return 'healing'
    if (category.code || category.scale_type || category.type) {
      return category.code || category.scale_type || category.type
    }
    // 无法判断时返回 null，避免全部落到 healing
    return null
  },

  /**
   * 🎯 优先从数据库获取各分类的实际音频数量（与推荐引擎保持一致）
   */
  async updateActualCounts() {
    try {
      const list = this.data.categories || []
      if (!list.length) return
      
      const updated = await Promise.all(list.map(async (cat) => {
        try {
          // 🥇 优先从数据库获取音乐数量
          const dbResult = await MusicAPI.getPresetMusicByCategory(cat.id).catch(error => {
            console.warn(`[Categories] 分类${cat.id}数据库获取失败:`, error)
            return { success: false }
          })
          
          if (dbResult.success && dbResult.data && Array.isArray(dbResult.data)) {
            // 过滤掉无效音乐（static路径文件不存在）
            const validMusic = dbResult.data.filter(music => this.isValidMusicFile(music))
            const dbCount = validMusic.length
            console.log(`[Categories] 分类${cat.name}使用数据库计数: ${dbCount}首 (过滤前${dbResult.data.length}首)`)
            return { ...cat, count: dbCount, source: 'database' }
          }
          
          // 🥈 回退：从七牛云获取文件数量
          console.log(`[Categories] 分类${cat.name}数据库无音乐，使用七牛云计数`)
          const code = this.getCategoryCode(cat)
          if (!code) return { ...cat, count: 0, source: 'fallback' }
          
          const qiniuResult = await MusicAPI.getQiniuFilesByCategory(code).catch(() => ({ success: false }))
          const qiniuCount = qiniuResult && qiniuResult.success && qiniuResult.data && Array.isArray(qiniuResult.data.files) 
            ? qiniuResult.data.files.length 
            : (cat.count || 0)
          
          return { ...cat, count: qiniuCount, source: 'qiniu_fallback' }
          
        } catch (error) {
          console.warn(`[Categories] 分类${cat.name}获取计数失败:`, error)
          return { ...cat, count: cat.count || 0, source: 'error' }
        }
      }))
      
      this.setData({ categories: updated })
      console.log('[Categories] 分类计数更新完成，数据源分布:', updated.map(cat => `${cat.name}: ${cat.count}首(${cat.source})`))
      
    } catch (e) {
      console.warn('更新分类实际数量失败:', e.message)
    }
  },

  // 获取默认分类（当API不可用时）
  getDefaultCategories() {
    return [
      {
        id: 1,
        name: '自然音',
        description: '大自然的真实声音，如雨声、海浪声、森林声',
        icon: '🌿',
        count: 1 // 设置为有内容，避免显示为空分类
      },
      {
        id: 2,
        name: '白噪音',
        description: '各种频率的白噪音，帮助专注和睡眠',
        icon: '🔊',
        count: 1 // 设置为有内容，避免显示为空分类
      },
      {
        id: 3,
        name: '抑郁疗愈',
        description: '不同频率的脑波音频，促进特定脑波状态',
        icon: '🧠',
        count: 1 // 设置为有内容，避免显示为空分类
      },
      {
        id: 5,
        name: '疗愈资源',
        description: '专业的疗愈资源',
        icon: '💚',
        count: 1 // 设置为有内容，避免显示为空分类
      }
      // 注意：移除了ID=4的冥想疗愈分类（AI生成音频，单独收费，不在分类列表显示）
    ]
  },

  // 点击分类（已移动到文件末尾避免重复定义）

  // 随机播放
  async onRandomPlay() {
    // 检查登录状态
    if (!AuthService.getCurrentUser()) {
      wx.showModal({
        title: '请先登录',
        content: '使用智能推荐功能需要先登录账户，立即前往登录页面？',
        showCancel: true,
        cancelText: '取消',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' })
          }
        }
      })
      return
    }
    
    try {
      wx.showLoading({ title: '正在获取音乐...' })
      
      // 随机选择一个有音乐的分类
      const categories = this.data.categories.filter(cat => (cat.count || 0) > 0)
      if (categories.length === 0) {
        wx.hideLoading()
        wx.showToast({
          title: '暂无可播放音乐',
          icon: 'none'
        })
        return
      }
      
      const randomCategory = categories[Math.floor(Math.random() * categories.length)]
      
      // 使用统一音乐管理器获取随机音乐
      const musicData = await unifiedMusicManager.getMusicByCategory(randomCategory.id)
      
      wx.hideLoading()
      
      if (musicData) {
        wx.showToast({
          title: `播放${musicData.name}`,
          icon: 'success'
        })
        
        // 跳转到播放页面
        wx.navigateTo({
          url: `/pages/index/index?musicId=${musicData.id}`
        })
      } else {
        wx.showToast({
          title: '获取音乐失败',
          icon: 'none'
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('随机播放失败:', error)

      // 根据错误类型提供不同的提示
      let errorMessage = '播放失败'
      if (error.message && error.message.includes('没有音乐资源')) {
        errorMessage = '该分类暂无音乐，已为您推荐其他音乐'
      } else if (error.message && error.message.includes('音频URL无效')) {
        errorMessage = '音频文件暂时无法访问'
      }

      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 2000
      })
    }
  },

  // 搜索音乐
  onSearchMusic() {
    // 检查登录状态
    if (!AuthService.getCurrentUser()) {
      wx.showModal({
        title: '请先登录',
        content: '使用搜索音乐功能需要先登录账户，立即前往登录页面？',
        showCancel: true,
        cancelText: '取消',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' })
          }
        }
      })
      return
    }
    
    wx.navigateTo({
      url: '/pages/search/search'
    })
  },

  // 点击分类项
  onCategoryTap(e) {
    // 检查登录状态
    if (!AuthService.getCurrentUser()) {
      wx.showModal({
        title: '请先登录',
        content: '访问分类音乐需要先登录账户，立即前往登录页面？',
        showCancel: true,
        cancelText: '取消',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' })
          }
        }
      })
      return
    }
    
    const category = e.currentTarget.dataset.category
    const categoryId = category?.id || e.currentTarget.dataset.id
    
    console.log('分类页面点击事件:', {
      category,
      categoryId,
      dataset: e.currentTarget.dataset
    });
    
    // 验证分类数据
    if (!category || !categoryId) {
      console.error('分类数据无效:', { category, categoryId });
      wx.showToast({
        title: '分类信息无效',
        icon: 'none'
      });
      return;
    }
    
    // 检查分类是否为空
    if ((category.count || 0) === 0) {
      wx.showModal({
        title: '分类暂无内容',
        content: `${category.name}分类下暂时还没有音乐资源，正在紧急完善中...`,
        showCancel: true,
        cancelText: '知道了',
        confirmText: '查看其他',
        success: (res) => {
          if (res.confirm) {
            // 查找有内容的分类
            const availableCategory = this.data.categories.find(cat => (cat.count || 0) > 0);
            if (availableCategory) {
              wx.navigateTo({
                url: `/pages/music/category/category?categoryId=${availableCategory.id}&categoryName=${encodeURIComponent(availableCategory.name)}`
              });
            } else {
              wx.showToast({
                title: '暂无可用分类',
                icon: 'none'
              });
            }
          }
        }
      });
      return;
    }
    
    console.log('跳转到分类音乐页面:', categoryId, category.name);
    
    // 跳转到分类音乐列表页面，携带该分类的数量作为显示上限
    const limit = category.count && Number.isFinite(category.count) ? category.count : 20
    wx.navigateTo({
      url: `/pages/music/category/category?categoryId=${categoryId}&categoryName=${encodeURIComponent(category.name)}&limit=${limit}`
    });
  },

  // 搜索分类
  onSearch(e) {
    const keyword = e.detail.value
    if (!keyword.trim()) {
      this.refreshCategories()
      return
    }
    
    const filteredCategories = this.data.categories.filter(category => 
      category.name.includes(keyword) || 
      category.description.includes(keyword)
    )
    
    this.setData({
      categories: filteredCategories
    })
  },

  // 加载更多分类
  async loadMoreCategories() {
    try {
      // 这里可以实现分页加载
      console.log('加载更多分类...')
      
      // 使用统一音乐管理器
      const moreCategories = await unifiedMusicManager.getMusicByCategory(1)
      
      if (moreCategories) {
        console.log('获取到音乐:', moreCategories.name)
      }
    } catch (error) {
      console.error('加载更多分类失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  // 清除分类缓存
  clearCache() {
    try {
      unifiedMusicManager.clearCache()
      wx.showToast({
        title: '缓存已清除',
        icon: 'success'
      })
      
      // 重新加载
      this.initCategories()
    } catch (error) {
      console.error('清除缓存失败:', error)
      wx.showToast({
        title: '清除失败',
        icon: 'none'
      })
    }
  },

  // 强制刷新
  async forceRefresh() {
    try {
      this.setData({ loading: true })
      
      const success = await unifiedMusicManager.refreshCategories()
      
      if (success) {
        const categories = unifiedMusicManager.getAllCategories()
        this.setData({
          categories: categories,
          loading: false
        })
        
        wx.showToast({
          title: '刷新成功',
          icon: 'success'
        })
      } else {
        throw new Error('强制刷新失败')
      }
    } catch (error) {
      console.error('强制刷新失败:', error)
      this.setData({ loading: false })
      
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      })
    }
  },

  // 分享页面
  onShareAppMessage() {
    return {
      title: '疗愈 - 发现更多分类',
      path: '/pages/categories/categories',
      imageUrl: '/assets/images/default-image.png'
    }
  },

  // 页面滚动到底部
  onReachBottom() {
    this.loadMoreCategories()
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.forceRefresh().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  // ==================== 全局播放器相关方法 ====================

  // 全局播放器状态变化
  onGlobalPlayerStateChange(e) {
    const { isPlaying } = e.detail
    this.setData({ isPlaying })
  },

  // 下一首
  onNextTrack() {
    console.log('下一首')
    // 可以实现切换到下一首的逻辑
  },

  // 上一首  
  onPreviousTrack() {
    console.log('上一首')
    // 可以实现切换到上一首的逻辑
  },

  // 关闭播放器
  onCloseGlobalPlayer() {
    this.setData({ 
      showGlobalPlayer: false,
      isPlaying: false 
    })
  },

  // 切换播放器显示状态
  onToggleGlobalPlayer(e) {
    console.log('切换全局播放器显示状态', e.detail)
    
    // 检查是否有全局播放器实例和当前播放的音乐
    const app = getApp()
    const globalMusicPlayer = app.globalData.globalMusicPlayer
    const hasMusic = globalMusicPlayer && globalMusicPlayer.currentMusic
    
    console.log('全局播放器状态检查:', {
      hasGlobalPlayer: !!globalMusicPlayer,
      hasCurrentMusic: !!globalMusicPlayer?.currentMusic,
      isPlaying: globalMusicPlayer?.isPlaying,
      currentMusic: globalMusicPlayer?.currentMusic
    })
    
    if (!hasMusic) {
      // 没有音乐在播放时，给用户友好提示
      wx.showToast({
        title: '当前没有音乐播放',
        icon: 'none',
        duration: 2000
      })
      return
    }
    
    // 获取全局播放器组件实例
    const globalPlayerComponent = this.selectComponent('#globalPlayer')
    
    if (globalPlayerComponent) {
      // 同步当前播放音乐信息到组件
      const currentMusic = globalMusicPlayer.currentMusic
      const trackInfo = {
        id: currentMusic.id,
        name: currentMusic.title || currentMusic.name || '未知音乐',
        title: currentMusic.title || currentMusic.name || '未知音乐',
        url: currentMusic.src,
        image: currentMusic.image,
        category: currentMusic.category || '未知分类',
        categoryId: currentMusic.categoryId,
        type: currentMusic.type || 'music',
        duration: currentMusic.duration || 0
      }
      
      console.log('同步音轨信息到全局播放器组件:', trackInfo)
      
      // 直接设置组件的数据
      globalPlayerComponent.setData({
        currentTrack: trackInfo,
        isPlaying: globalMusicPlayer.isPlaying || false,
        duration: globalMusicPlayer.duration || 0,
        currentTime: globalMusicPlayer.currentTime || 0
      })
    }
    
    // 切换播放器显示状态
    const newShowState = !this.data.showGlobalPlayer
    this.setData({ 
      showGlobalPlayer: newShowState
    })
    
    // 触觉反馈
    wx.vibrateShort({
      type: 'light'
    })
    
    console.log('全局播放器显示状态:', newShowState)
    
    // 显示提示
    wx.showToast({
      title: newShowState ? '播放器已显示' : '播放器已隐藏',
      icon: 'none',
      duration: 1500
    })
  },

  // 展开播放器
  onExpandGlobalPlayer(e) {
    const { track } = e.detail
    console.log('展开播放器', track)
    // 可以跳转到详细播放页面
    wx.navigateTo({
      url: '/pages/music/player/player'
    })
  },

  // 播放音乐（通用方法）
  playMusic(musicInfo) {
    console.log('播放音乐:', musicInfo)
    
    // 准备播放器需要的音乐数据格式
    const trackInfo = {
      name: musicInfo.title || musicInfo.name || '未知音乐',
      url: musicInfo.path || musicInfo.audioUrl || musicInfo.url,
      image: musicInfo.image || '/images/default-music-cover.svg',
      category: musicInfo.category || '音乐',
      type: musicInfo.type || 'music',
      id: musicInfo.id || 'temp_' + Date.now(),
      duration: musicInfo.duration || 180
    }
    
    // 显示吸底播放器
    this.setData({
      showGlobalPlayer: true
    })
    
    // 延迟调用播放器
    setTimeout(() => {
      const globalPlayer = this.selectComponent('#globalPlayer')
      if (globalPlayer && globalPlayer.playTrack) {
        globalPlayer.playTrack(trackInfo)
      } else {
        console.warn('Global player组件未找到')
        wx.showToast({
          title: '播放器初始化失败',
          icon: 'none'
        })
      }
    }, 100)
  },

  /**
   * 初始化主题
   */
  initTheme() {
    try {
      const app = getApp();
      if (app.globalData && app.globalData.currentTheme) {
        this.setData({
          currentTheme: app.globalData.currentTheme,
          themeClass: app.globalData.themeConfig?.class || '',
          themeConfig: app.globalData.themeConfig
        });
      }
    } catch (error) {
      console.error('初始化主题失败:', error);
    }
  },

  /**
   * 主题切换事件处理
   */
  onThemeChange(e) {
    try {
      if (!e || !e.detail) return;
      const { theme, config } = e.detail;
      if (!theme || !config) return;
      
      this.setData({
        currentTheme: theme,
        themeClass: config.class || '',
        themeConfig: config
      });
    } catch (error) {
      console.error('主题切换处理失败:', error);
    }
  }
})