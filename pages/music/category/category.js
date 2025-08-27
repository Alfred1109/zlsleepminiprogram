// pages/music/category/category.js
// 分类音乐列表页面
const { unifiedMusicManager } = require('../../../utils/unifiedMusicManager')
const { getGlobalPlayer, formatTime } = require('../../../utils/musicPlayer')

Page({
  data: {
    categoryId: null,
    categoryName: '',
    musicList: [],
    loading: true,
    currentPlayingId: null,
    // 全局播放器相关
    showGlobalPlayer: false,
    isPlaying: false
  },

  onLoad(options) {
    console.log('分类音乐页面加载', options)
    
    const { categoryId, categoryName } = options
    this.setData({
      categoryId: parseInt(categoryId) || 1,
      categoryName: decodeURIComponent(categoryName || '音乐分类')
    })

    this.initPage()
  },

  /**
   * 初始化页面
   */
  async initPage() {
    try {
      // 初始化全局播放器
      this.initPlayer()
      
      // 加载分类音乐
      await this.loadCategoryMusic()
    } catch (error) {
      console.error('页面初始化失败:', error)
      this.showError('初始化失败')
    }
  },

  /**
   * 初始化播放器
   */
  initPlayer() {
    const player = getGlobalPlayer()
    this.setData({ player })

    // 监听播放器事件
    player.on('play', this.onPlayerPlay.bind(this))
    player.on('pause', this.onPlayerPause.bind(this))
    player.on('stop', this.onPlayerStop.bind(this))
  },

  /**
   * 加载分类音乐
   */
  async loadCategoryMusic() {
    this.setData({ loading: true })

    try {
      console.log('加载分类音乐:', this.data.categoryId, this.data.categoryName)
      
      // 使用统一音乐管理器获取分类音乐
      const music = await unifiedMusicManager.getMusicByCategory(this.data.categoryId, {
        limit: 20,
        format: 'list'
      })

      console.log('统一音乐管理器返回数据:', music)

      let musicList = []
      
      if (music) {
        // 检查返回的数据格式
        if (Array.isArray(music)) {
          // 如果是数组，直接使用
          musicList = music
        } else if (typeof music === 'object') {
          // 如果是单个对象，放入数组
          musicList = [music]
        }

        // 处理音乐数据，确保字段正确
        const processedMusic = musicList.map(item => ({
          id: item.id || `category_${this.data.categoryId}_${Date.now()}_${Math.random()}`,
          title: item.title || item.name || '未知音乐',
          name: item.name || item.title || '未知音乐',
          url: item.url || item.path || item.audio_url,
          image: item.image || item.cover_url || '/images/default-music-cover.svg',
          duration: item.duration || 0,
          category: this.data.categoryName,
          description: item.description || '',
          ...item
        }))

        this.setData({
          musicList: processedMusic,
          loading: false
        })

        console.log('分类音乐加载完成:', processedMusic.length)
      } else {
        this.setData({
          musicList: [],
          loading: false
        })
        console.log('该分类暂无音乐')
      }
    } catch (error) {
      console.error('加载分类音乐失败:', error)
      this.setData({
        musicList: [],
        loading: false
      })
      this.showError('加载音乐失败')
    }
  },

  /**
   * 播放音乐
   */
  onPlayMusic(e) {
    const { music } = e.currentTarget.dataset
    console.log('播放音乐:', music)

    if (!music.url) {
      wx.showToast({
        title: '音乐文件不存在',
        icon: 'error'
      })
      return
    }

    this.playMusicWithGlobalPlayer(music)
  },

  /**
   * 使用全局播放器播放音乐
   */
  playMusicWithGlobalPlayer(musicInfo) {
    console.log('使用全局播放器播放音乐:', musicInfo)
    
    // 准备播放器需要的音乐数据格式
    const trackInfo = {
      name: musicInfo.title || musicInfo.name || '未知音乐',
      url: musicInfo.url,
      image: musicInfo.image || '/images/default-music-cover.svg',
      category: this.data.categoryName,
      type: 'category',
      id: musicInfo.id,
      duration: musicInfo.duration || 0
    }
    
    console.log('构建的播放信息:', trackInfo)
    
    // 更新当前播放状态
    this.setData({
      showGlobalPlayer: true,
      currentPlayingId: musicInfo.id
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
   * 播放器事件处理
   */
  onPlayerPlay(music) {
    if (music) {
      this.setData({
        currentPlayingId: music.id,
        isPlaying: true
      })
    }
  },

  onPlayerPause() {
    this.setData({
      isPlaying: false
    })
  },

  onPlayerStop() {
    this.setData({
      currentPlayingId: null,
      isPlaying: false
    })
  },

  /**
   * 全局播放器事件处理
   */
  onGlobalPlayerStateChange(e) {
    const { isPlaying } = e.detail
    this.setData({ isPlaying })
  },

  onNextTrack() {
    console.log('下一首')
    // 实现下一首逻辑
  },

  onPreviousTrack() {
    console.log('上一首')
    // 实现上一首逻辑
  },

  onCloseGlobalPlayer() {
    this.setData({
      showGlobalPlayer: false,
      currentPlayingId: null,
      isPlaying: false
    })
  },

  onExpandGlobalPlayer() {
    const currentMusic = this.data.musicList.find(m => m.id === this.data.currentPlayingId)
    if (currentMusic) {
      wx.navigateTo({
        url: `/pages/music/player/player?musicId=${currentMusic.id}&type=category`
      })
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadCategoryMusic().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 显示错误信息
   */
  showError(message) {
    wx.showToast({
      title: message,
      icon: 'error',
      duration: 2000
    })
  },

  /**
   * 格式化时间
   */
  formatTime(seconds) {
    return formatTime(seconds)
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: `${this.data.categoryName} - AI疗愈`,
      path: `/pages/music/category/category?categoryId=${this.data.categoryId}&categoryName=${encodeURIComponent(this.data.categoryName)}`,
      imageUrl: '/images/share-category.png'
    }
  }
})
