// pages/categories/categories.js
const { unifiedMusicManager } = require('../../utils/unifiedMusicManager')

Page({
  data: {
    categories: [],
    loading: true,
    // 全局播放器相关
    showGlobalPlayer: false,
    isPlaying: false
  },

  onLoad: function (options) {
    console.log('Categories page loaded')
    this.initCategories()
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
        const categories = unifiedMusicManager.getAllCategories()
        this.setData({
          categories: categories,
          loading: false
        })
        console.log('分类初始化成功:', categories.length)
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
      const categories = unifiedMusicManager.getAllCategories()
      
      if (categories.length > 0) {
        this.setData({ categories })
      }
      
      // 尝试从服务器更新（不阻塞UI）
      unifiedMusicManager.refreshCategories().then(updated => {
        if (updated) {
          const newCategories = unifiedMusicManager.getAllCategories()
          this.setData({ categories: newCategories })
          console.log('分类数据已更新')
        }
      }).catch(error => {
        console.warn('后台更新分类失败:', error)
      })
      
    } catch (error) {
      console.error('刷新分类失败:', error)
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
        id: 4,
        name: 'AI音乐',
        description: 'AI生成的个性化音乐',
        icon: '🤖',
        count: 1 // 设置为有内容，避免显示为空分类
      },
      {
        id: 5,
        name: '疗愈资源',
        description: '专业的疗愈资源',
        icon: '💚',
        count: 1 // 设置为有内容，避免显示为空分类
      }
    ]
  },

  // 点击分类（已移动到文件末尾避免重复定义）

  // 随机播放
  async onRandomPlay() {
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
    wx.navigateTo({
      url: '/pages/search/search'
    })
  },

  // 点击分类项
  onCategoryTap(e) {
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
    
    // 跳转到分类音乐列表页面
    wx.navigateTo({
      url: `/pages/music/category/category?categoryId=${categoryId}&categoryName=${encodeURIComponent(category.name)}`
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
      imageUrl: '/assets/images/share-category.jpg'
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
  }
})