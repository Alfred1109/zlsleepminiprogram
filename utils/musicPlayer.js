/**
 * 音乐播放器工具类
 */

const app = getApp()

class MusicPlayer {
  constructor() {
    this.audioContext = null
    this.currentMusic = null
    this.isPlaying = false
    this.currentTime = 0
    this.duration = 0
    this.volume = 0.7
    this.playMode = 'single' // single, loop, sequence
    this.playlist = []
    this.currentIndex = 0
    
    // 事件监听器
    this.listeners = {
      play: [],
      pause: [],
      stop: [],
      ended: [],
      timeUpdate: [],
      error: []
    }
  }

  /**
   * 初始化播放器
   */
  init() {
    if (this.audioContext) {
      this.destroy()
    }

    this.audioContext = wx.createInnerAudioContext()
    this.setupEventListeners()
    
    // 设置默认音量
    this.audioContext.volume = this.volume
    
    console.log('音乐播放器初始化完成')
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    if (!this.audioContext) return

    // 播放开始
    this.audioContext.onPlay(() => {
      this.isPlaying = true
      this.updateGlobalState()
      this.emit('play', this.currentMusic)
      console.log('🎵 音频事件: 播放开始', this.currentMusic?.title)
    })

    // 暂停
    this.audioContext.onPause(() => {
      this.isPlaying = false
      this.updateGlobalState()
      this.emit('pause', this.currentMusic)
      console.log('音乐暂停')
    })

    // 停止
    this.audioContext.onStop(() => {
      this.isPlaying = false
      this.currentTime = 0
      this.updateGlobalState()
      this.emit('stop', this.currentMusic)
      console.log('音乐停止')
    })

    // 播放结束
    this.audioContext.onEnded(() => {
      this.isPlaying = false
      this.currentTime = 0
      this.updateGlobalState()
      this.emit('ended', this.currentMusic)
      console.log('音乐播放结束')
      
      // 根据播放模式处理
      this.handlePlayModeOnEnded()
    })

    // 时间更新
    this.audioContext.onTimeUpdate(() => {
      this.currentTime = this.audioContext.currentTime
      this.duration = this.audioContext.duration
      this.updateGlobalState()
      this.emit('timeUpdate', {
        currentTime: this.currentTime,
        duration: this.duration
      })
    })

    // 音频数据加载完成
    this.audioContext.onCanplay(() => {
      console.log('🎵 音频事件: 可以播放 (onCanplay)')
      console.log('🎵 音频时长:', this.audioContext.duration, '秒')
    })
    
    // 音频缓冲等待
    this.audioContext.onWaiting(() => {
      console.log('🎵 音频事件: 正在缓冲 (onWaiting)')
    })

    // 错误处理
    this.audioContext.onError((err) => {
      console.error('🎵 音频事件: 播放错误', err)
      
      this.isPlaying = false
      this.updateGlobalState()
      
      // 🔄 检测需要刷新URL的错误类型
      const needsUrlRefresh = this.shouldRefreshUrl(err, this.currentMusic)
      
      if (needsUrlRefresh) {
        console.log('🔄 检测到需要刷新URL的错误，尝试刷新音频URL...')
        this.retryWithRefreshedUrl(this.currentMusic)
      } else {
        this.emit('error', err)
        
        // 调用全局错误处理
        if (app.globalData.handleAudioError) {
          app.globalData.handleAudioError(err)
        }
      }
    })
  }


  /**
   * 加载音乐
   */
  loadMusic(music) {
    if (!this.audioContext) {
      this.init()
    }

    // 确保停止当前播放并重置状态
    if (this.currentMusic && this.currentMusic.src !== music.src) {
      console.log('切换音乐: 从', this.currentMusic.title, '到', music.title)
      this.stop() // 完全停止当前音乐
    }

    // 🌊 检查是否应该使用流式播放
    const finalSrc = this.optimizeAudioSource(music)
    
    this.currentMusic = {
      ...music,
      src: finalSrc
    }
    this.audioContext.src = finalSrc
    this.currentTime = 0
    this._retryCount = 0 // 重置重试计数器
    this.updateGlobalState()
    
    console.log('加载音乐:', music.title)
  }

  /**
   * 🌊 优化音频源 - 智能选择标准/流式播放
   */
  optimizeAudioSource(music) {
    const originalSrc = music.src
    
    // 检查是否应该使用流式播放
    if (this.shouldUseStreamPlayback(music)) {
      const streamSrc = this.buildStreamUrl(music)
      console.log('🌊 大文件优化: 使用流式URL')
      console.log('🌊 原始URL:', originalSrc)
      console.log('🌊 流式URL:', streamSrc)
      return streamSrc
    }
    
    console.log('🎵 标准播放: 使用原始URL:', originalSrc)
    return originalSrc
  }

  /**
   * 🌊 判断是否应该使用流式播放
   */
  shouldUseStreamPlayback(music) {
    // 如果有流式URL，优先使用
    if (music.stream_url) {
      return true
    }
    
    // 如果明确建议使用流式播放
    if (music.use_stream) {
      return true
    }
    
    // 长序列音频类型
    if (music.type === 'longSequence') {
      return true
    }
    
    // 大文件（超过50MB）
    if (music.file_size && music.file_size > 50 * 1024 * 1024) {
      return true
    }
    
    // URL包含long_sequence（历史兼容）
    if (music.src && music.src.includes('long_sequence')) {
      return true
    }
    
    return false
  }

  /**
   * 🌊 构建流式播放URL
   */
  buildStreamUrl(music) {
    // 如果已有流式URL，直接使用
    if (music.stream_url) {
      return music.stream_url
    }

    const app = getApp()
    const baseUrl = app.globalData.apiBaseUrl || 'https://medsleep.cn'
    
    // 如果是长序列音频
    if (music.sessionId) {
      return `${baseUrl}/api/music/long_sequence_stream/${music.sessionId}`
    }
    
    // 如果是静态文件
    if (music.src && music.src.startsWith('/static/')) {
      const filePath = music.src.substring(1) // 移除开头的'/'
      return `${baseUrl}/api/music/stream/${filePath}`
    }
    
    return music.src // 回退到原始URL
  }

  /**
   * 播放音乐
   */
  play(music = null) {
    // 只在首次播放或切换音乐时输出详细日志
    if (!this.lastLoggedMusic || (music && this.lastLoggedMusic !== music.title)) {
      console.log('🎵 MusicPlayer.play() 被调用')
      console.log('🎵 传入音乐:', music?.title || '继续播放')
      console.log('🎵 当前状态:', {
        isPlaying: this.isPlaying,
        currentMusic: this.currentMusic?.title,
        audioContextExists: !!this.audioContext
      })
      this.lastLoggedMusic = music?.title || this.currentMusic?.title
    }
    
    // 如果传入了新音乐，先停止当前播放的音乐，然后加载新音乐
    if (music) {
      // 停止当前播放的音乐，确保同时只有一首在播放
      if (this.isPlaying) {
        console.log('🎵 切换音乐，停止:', this.currentMusic?.title)
        this.audioContext.stop()
      }
      console.log('🎵 加载新音乐:', music.title)
      this.loadMusic(music)
    }

    if (!this.audioContext || !this.currentMusic) {
      console.error('❌ 播放器未初始化或没有音乐')
      console.error('❌ audioContext:', !!this.audioContext)
      console.error('❌ currentMusic:', !!this.currentMusic)
      return
    }

    // 只在首次播放该音乐时输出详细信息
    if (!this.lastPlayedMusic || this.lastPlayedMusic !== this.currentMusic.title) {
      console.log('🎵 开始播放音乐:', this.currentMusic.title)
      console.log('🎵 音频源:', this.currentMusic.src)
      
      // 检查音频文件大小警告
      if (this.currentMusic.src && this.currentMusic.src.includes('long_sequence')) {
        console.warn('⚠️ 长序列音频文件较大，可能需要更长的加载时间')
      }
      this.lastPlayedMusic = this.currentMusic.title
    }
    
    try {
      this.audioContext.play()
      console.log('✅ audioContext.play() 调用成功')
      
      // 延迟检查播放状态，给音频更多加载时间
      setTimeout(() => {
        console.log('🎵 延迟状态检查 (3秒后):', {
          isPlaying: this.isPlaying,
          currentTime: this.currentTime,
          duration: this.duration,
          src: this.audioContext.src
        })
        
        if (!this.isPlaying && this.currentMusic && !this._refreshing) {
          console.warn('⚠️ 音频可能加载失败，尝试智能重试')
          this.intelligentRetry(this.currentMusic)
        }
      }, 3000)
      
    } catch (error) {
      console.error('❌ audioContext.play() 调用失败:', error)
    }
  }

  /**
   * 暂停播放
   */
  pause() {
    if (this.audioContext && this.isPlaying) {
      this.audioContext.pause()
    }
  }

  /**
   * 停止播放
   */
  stop() {
    if (this.audioContext) {
      this.audioContext.stop()
    }
  }

  /**
   * 跳转到指定时间
   */
  seek(time) {
    if (this.audioContext && this.duration > 0) {
      this.audioContext.seek(time)
      this.currentTime = time
      this.updateGlobalState()
    }
  }

  /**
   * 设置音量
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.audioContext) {
      this.audioContext.volume = this.volume
    }
    this.updateGlobalState()
  }

  /**
   * 设置播放模式
   */
  setPlayMode(mode) {
    this.playMode = mode
    console.log('播放模式设置为:', mode)
  }

  /**
   * 设置播放列表
   */
  setPlaylist(playlist, startIndex = 0) {
    this.playlist = playlist
    this.currentIndex = startIndex
    
    if (playlist.length > 0 && startIndex < playlist.length) {
      this.loadMusic(playlist[startIndex])
    }
  }

  /**
   * 下一首
   */
  next() {
    if (this.playlist.length === 0) return

    if (this.playMode === 'sequence') {
      this.currentIndex = (this.currentIndex + 1) % this.playlist.length
    } else {
      this.currentIndex = Math.min(this.currentIndex + 1, this.playlist.length - 1)
    }

    this.play(this.playlist[this.currentIndex])
  }

  /**
   * 上一首
   */
  previous() {
    if (this.playlist.length === 0) return

    if (this.playMode === 'sequence') {
      this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length
    } else {
      this.currentIndex = Math.max(this.currentIndex - 1, 0)
    }

    this.play(this.playlist[this.currentIndex])
  }

  /**
   * 处理播放结束时的模式
   */
  handlePlayModeOnEnded() {
    switch (this.playMode) {
      case 'loop':
        // 单曲循环
        this.play()
        break
      case 'sequence':
        // 列表循环
        this.next()
        break
      case 'single':
      default:
        // 单曲播放，结束后停止
        break
    }
  }

  /**
   * 更新全局状态
   */
  updateGlobalState() {
    app.globalData.musicPlayer = {
      isPlaying: this.isPlaying,
      currentMusic: this.currentMusic,
      currentTime: this.currentTime,
      duration: this.duration,
      volume: this.volume,
      playMode: this.playMode,
      audioContext: this.audioContext
    }
  }

  /**
   * 添加事件监听器
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback)
    }
  }

  /**
   * 移除事件监听器
   */
  off(event, callback) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(callback)
      if (index > -1) {
        this.listeners[event].splice(index, 1)
      }
    }
  }

  /**
   * 触发事件
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error('事件监听器执行错误:', error)
        }
      })
    }
  }

  /**
   * 获取播放状态
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      currentMusic: this.currentMusic,
      currentTime: this.currentTime,
      duration: this.duration,
      volume: this.volume,
      playMode: this.playMode,
      playlist: this.playlist,
      currentIndex: this.currentIndex
    }
  }

  /**
   * 🔍 判断是否需要刷新URL
   */
  shouldRefreshUrl(error, music) {
    if (!music || !music.src) {
      return false
    }
    
    const errMsg = error.errMsg || ''
    const isCdnUrl = music.src.includes('cdn.medsleep.cn')
    
    // 1. 明确的401错误
    if (errMsg.includes('401')) {
      console.log('🔍 检测到401错误')
      return true
    }
    
    // 2. CDN URL的音频解码失败（可能是token过期）
    if (isCdnUrl && errMsg.includes('Unable to decode audio data')) {
      console.log('🔍 检测到CDN URL音频解码失败')
      return true
    }
    
    // 3. CDN URL的网络错误
    if (isCdnUrl && (errMsg.includes('fail') || errMsg.includes('error'))) {
      console.log('🔍 检测到CDN URL网络错误')
      return true
    }
    
    // 4. CDN URL且没有token参数
    if (isCdnUrl && !music.src.includes('token=') && !music.src.includes('e=')) {
      console.log('🔍 检测到CDN URL缺少token参数')
      return true
    }
    
    return false
  }

  /**
   * 🧠 智能重试机制
   */
  async intelligentRetry(music) {
    if (!music || this._retryCount >= 2) {
      console.log('🚫 达到最大重试次数或音乐对象无效，停止重试')
      return
    }
    
    this._retryCount = (this._retryCount || 0) + 1
    console.log(`🔄 智能重试 ${this._retryCount}/2:`, music.title)
    
    // 如果是CDN URL且可能需要token，先尝试刷新URL
    if (music.src && music.src.includes('cdn.medsleep.cn') && music.id && !music.src.includes('token=')) {
      console.log('🔄 检测到CDN URL缺少token，尝试刷新URL')
      await this.retryWithRefreshedUrl(music)
    } else {
      // 否则简单重试播放
      console.log('🔄 简单重试播放')
      try {
        this.audioContext.play()
      } catch (error) {
        console.error('❌ 重试播放失败:', error)
      }
    }
  }

  /**
   * 🔄 使用刷新的URL重试播放
   */
  async retryWithRefreshedUrl(music) {
    // 防止重复刷新
    if (this._refreshing) {
      console.log('🔄 URL刷新中，跳过重复请求')
      return
    }
    
    this._refreshing = true
    
    try {
      console.log('🔄 开始刷新音频URL, musicId:', music.id)
      
      // 动态导入API
      const { MusicAPI } = require('./healingApi')
      
      // 刷新URL，传入原始URL以提取文件路径
      const response = await MusicAPI.refreshAudioUrl(music.id, music.src)
      
      if (response.success && response.data && response.data.url) {
        console.log('✅ URL刷新成功，尝试重新播放')
        
        // 更新音乐URL
        const refreshedMusic = {
          ...music,
          src: response.data.url
        }
        
        // 重新加载并播放
        this.loadMusic(refreshedMusic)
        this.audioContext.play()
        
      } else {
        console.error('❌ URL刷新失败:', response.error || 'Unknown error')
        this.emit('error', { message: 'URL刷新失败', originalError: response.error })
      }
      
    } catch (error) {
      console.error('❌ URL刷新过程出错:', error)
      this.emit('error', { message: 'URL刷新异常', originalError: error })
    } finally {
      this._refreshing = false
    }
  }

  /**
   * 销毁播放器
   */
  destroy() {
    if (this.audioContext) {
      this.audioContext.destroy()
      this.audioContext = null
    }
    
    this.currentMusic = null
    this.isPlaying = false
    this.currentTime = 0
    this.duration = 0
    this.playlist = []
    this.currentIndex = 0
    this._refreshing = false
    this._retryCount = 0
    
    // 清空事件监听器
    Object.keys(this.listeners).forEach(event => {
      this.listeners[event] = []
    })
    
    this.updateGlobalState()
    console.log('音乐播放器已销毁')
  }
}

// 创建全局播放器实例
let globalPlayer = null

/**
 * 获取全局播放器实例
 */
function getGlobalPlayer() {
  if (!globalPlayer) {
    globalPlayer = new MusicPlayer()
    globalPlayer.init()
  }
  return globalPlayer
}

/**
 * 格式化时间
 */
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) {
    return '00:00'
  }
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

module.exports = {
  MusicPlayer,
  getGlobalPlayer,
  formatTime
}
