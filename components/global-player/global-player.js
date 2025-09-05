// 统一底部播放器组件
const app = getApp()
const { getGlobalPlayer } = require('../../utils/musicPlayer')

Component({
  options: {
    multipleSlots: true
  },

  properties: {
    // 是否显示播放器
    visible: {
      type: Boolean,
      value: false
    }
  },

  data: {
    isVisible: false,
    isPlaying: false,
    currentTrack: {},
    currentTime: 0,
    duration: 0,
    progress: 0,
    
    // 播放器状态
    globalPlayer: null,  // 使用全局播放器实例
    
    // 分类管理
    categoryMap: {},
    playingTimer: null,
    isDragging: false,
    shouldAutoPlay: false,
    
    // 定时器相关
    timerEnabled: false,
    showTimerSelector: false,
    selectedTimer: 30, // 默认30分钟
    timerDuration: 0, // 定时器总时长（秒）
    timerRemaining: 0, // 剩余时间（秒）
    timerInterval: null
  },

  lifetimes: {
    attached() {
      console.log('global-player组件已附加')
      this.initAudioContext()
      this.bindGlobalEvents()
    },

    detached() {
      console.log('global-player组件已分离')
      this.cleanup()
    },

    ready() {
      console.log('global-player组件已准备好')
      console.log('组件初始数据:', this.data)
      this.loadCategories()
    }
  },

  observers: {
    'visible': function(newVal) {
      console.log('global-player接收到visible变化:', newVal)
      // 同步外部visible状态到内部isVisible
      this.setData({ isVisible: newVal })
    }
  },

  methods: {
    // 初始化音频上下文
    initAudioContext() {
      // 使用全局播放器实例，确保全局只有一个音频上下文
      const globalPlayer = getGlobalPlayer()
      this.setData({ globalPlayer })
      
      // 清除之前的事件监听器避免重复绑定
      this.unbindGlobalPlayerEvents()
      
      // 全局播放器已在初始化时设置好事件监听器
      console.log('全局播放器初始化完成，使用全局播放器实例')

      // 绑定全局播放器事件
      this.bindGlobalPlayerEvents()
    },

    // 绑定全局播放器事件
    bindGlobalPlayerEvents() {
      const { globalPlayer } = this.data
      if (!globalPlayer) return

      // 为解绑保存同一引用，避免重复绑定导致泄漏
      if (!this._handlers) {
        this._handlers = {
          play: this.onGlobalPlayerPlay.bind(this),
          pause: this.onGlobalPlayerPause.bind(this),
          stop: this.onGlobalPlayerStop.bind(this),
          ended: this.onGlobalPlayerEnded.bind(this),
          timeUpdate: this.onGlobalPlayerTimeUpdate.bind(this),
          error: this.onGlobalPlayerError.bind(this)
        }
      }

      const h = this._handlers
      globalPlayer.on('play', h.play)
      globalPlayer.on('pause', h.pause)
      globalPlayer.on('stop', h.stop)
      globalPlayer.on('ended', h.ended)
      globalPlayer.on('timeUpdate', h.timeUpdate)
      globalPlayer.on('error', h.error)
    },

    // 解绑全局播放器事件
    unbindGlobalPlayerEvents() {
      const { globalPlayer } = this.data
      if (!globalPlayer || !this._handlers) return

      const h = this._handlers
      globalPlayer.off('play', h.play)
      globalPlayer.off('pause', h.pause)
      globalPlayer.off('stop', h.stop)
      globalPlayer.off('ended', h.ended)
      globalPlayer.off('timeUpdate', h.timeUpdate)
      globalPlayer.off('error', h.error)
    },

    // 全局播放器事件处理
    onGlobalPlayerPlay() {
      console.log('🎵 全局播放器事件: 开始播放')
      this.setData({ isPlaying: true })
      // 使用底层timeUpdate事件，不再启动额外计时器，避免重复setData
      console.log('🎵 播放状态更新: isPlaying = true')
      
      // 🆕 记录播放开始
      this.recordGlobalPlayStart();
      
      this.triggerEvent('playStateChange', { 
        isPlaying: true,
        currentTime: this.data.currentTime,
        duration: this.data.duration,
        progress: this.data.progress,
        currentTrack: this.data.currentTrack
      })
    },

    onGlobalPlayerPause() {
      console.log('全局播放器暂停')
      this.setData({ isPlaying: false })
      this.triggerEvent('playStateChange', { 
        isPlaying: false,
        currentTime: this.data.currentTime,
        duration: this.data.duration,
        progress: this.data.progress,
        currentTrack: this.data.currentTrack
      })
    },

    onGlobalPlayerStop() {
      console.log('全局播放器停止')
      
      // 🆕 记录播放结束
      this.recordGlobalPlayEnd();
      
      this.setData({ 
        isPlaying: false,
        currentTime: 0,
        progress: 0
      })
      this.triggerEvent('playStateChange', { 
        isPlaying: false,
        currentTime: 0,
        duration: this.data.duration,
        progress: 0,
        currentTrack: this.data.currentTrack
      })
    },

    onGlobalPlayerEnded() {
      console.log('全局播放器播放结束')
      
      // 🆕 记录播放结束
      this.recordGlobalPlayEnd();
      
      // 检查是否有定时器在运行
      if (this.data.timerEnabled && this.data.timerRemaining > 0) {
        console.log('定时器仍在运行，重新播放当前音乐进行循环播放')
        console.log('剩余定时时间:', this.data.timerRemaining, '秒')
        
        // 重新播放当前音乐（循环播放）
        const { globalPlayer } = this.data
        if (globalPlayer && globalPlayer.currentMusic) {
          globalPlayer.play()
        }
      } else {
        // 没有定时器或定时器已结束，正常切换到下一首
        this.nextTrack()
      }
    },

    onGlobalPlayerTimeUpdate(data) {
      if (this.data.isDragging) return

      const now = Date.now()
      if (!this._lastTimeUpdateAt) this._lastTimeUpdateAt = 0

      const currentTime = data.currentTime || 0
      const duration = data.duration || 0
      const progress = duration > 0 ? (currentTime / duration) * 100 : 0

      // 节流：仅当秒数变化或超过300ms时更新，避免高频setData
      const secondChanged = Math.floor(currentTime) !== Math.floor(this.data.currentTime || 0)
      const timeOk = (now - this._lastTimeUpdateAt) >= 300
      if (!secondChanged && !timeOk) return
      this._lastTimeUpdateAt = now

      // 仅在数值变化时更新，减少无效setData
      const newData = {}
      if (this.data.currentTime !== currentTime) newData.currentTime = currentTime
      if (this.data.duration !== duration) newData.duration = duration
      const safeProgress = Math.max(0, Math.min(100, progress))
      if (this.data.progress !== safeProgress) newData.progress = safeProgress
      if (Object.keys(newData).length) {
        this.setData(newData)
      }

      this.triggerEvent('playStateChange', { 
        isPlaying: this.data.isPlaying,
        currentTime,
        duration,
        progress: safeProgress,
        currentTrack: this.data.currentTrack
      })
    },

    onGlobalPlayerError(error) {
      console.error('全局播放器错误:', error)
      
      // 根据错误类型提供不同的提示
      let errorMsg = '播放出错'
      let isLongSequenceError = false
      
      if (error.errMsg && error.errMsg.includes('no such file')) {
        errorMsg = '音频文件不存在，请重新选择'
      } else if (error.errMsg && error.errMsg.includes('network')) {
        errorMsg = '网络连接失败，请检查网络连接'
      } else if (error.errMsg && error.errMsg.includes('format')) {
        errorMsg = '音频格式不支持'
      } else if (error.errMsg && error.errMsg.includes('request:fail')) {
        errorMsg = '网络请求失败，请检查服务器连接'
      } else if (error.errMsg && error.errMsg.includes('在此服务器上找不到所请求的URL')) {
        // 针对长序列音频404错误的特殊处理
        const currentTrack = this.data.currentTrack
        if (currentTrack && (currentTrack.type === 'longSequence' || 
            (currentTrack.url && currentTrack.url.includes('long_sequence')))) {
          errorMsg = '长序列音频文件不存在，可能生成失败或已过期'
          isLongSequenceError = true
        } else {
          errorMsg = '音频文件不存在，请重新选择'
        }
      } else if (error.errMsg && error.errMsg.includes('401')) {
        errorMsg = '音频访问权限失败，请重试'
      }
      
      // 对于长序列错误，提供更详细的处理选项
      if (isLongSequenceError) {
        wx.showModal({
          title: '长序列音频播放失败',
          content: '音频文件可能生成失败或已过期，请重新生成长序列音频',
          showCancel: true,
          confirmText: '重新生成',
          cancelText: '知道了',
          success: (res) => {
            if (res.confirm) {
              // 跳转到长序列创建页面
              wx.navigateTo({
                url: '/pages/longSequence/create/create'
              })
            }
          }
        })
      } else {
        wx.showToast({
          title: errorMsg,
          icon: 'none',
          duration: 3000
        })
      }
      
      // 播放出错时重置状态
      this.setData({
        isPlaying: false,
        currentTime: 0,
        progress: 0
      })
      this.stopProgressTimer()
      this.triggerEvent('playStateChange', { 
        isPlaying: false,
        currentTime: this.data.currentTime,
        duration: this.data.duration,
        progress: this.data.progress,
        currentTrack: this.data.currentTrack
      })
    },

    /**
     * 检测是否为CDN认证失败错误
     */
    isCdnAuthError(error) {
      if (!error || !error.errMsg) return false
      
      const errorMsg = error.errMsg.toLowerCase()
      
      // 检测各种CDN认证失败的错误模式
      const cdnAuthPatterns = [
        'nsurlerrordomain错误-1013',          // iOS认证失败
        'unable to decode audio data',       // 通用解码失败（通常是401返回HTML）
        '401',                               // HTTP 401错误
        'unauthorized',                      // 未授权错误
        'access denied',                     // 访问被拒绝
        'token expired',                     // Token过期
        'signature not match'                // 签名不匹配
      ]
      
      return cdnAuthPatterns.some(pattern => errorMsg.includes(pattern))
    },

    /**
     * 处理CDN认证失败事件（从MusicPlayer传来）
     */
    onCdnAuthError(eventData) {
      console.error('🔐 收到CDN认证失败事件:', eventData)
      if (eventData.currentMusic) {
        // 转换为当前播放器的track格式
        const currentTrack = {
          id: eventData.currentMusic.id,
          url: eventData.currentMusic.src,
          title: eventData.currentMusic.title,
          type: eventData.currentMusic.type || 'music',
          sessionId: eventData.currentMusic.sessionId  // 长序列需要
        }
        this.handleCdnAuthError(currentTrack)
      }
    },

    /**
     * 处理CDN认证失败 - 自动刷新URL并重新播放
     */
    async handleCdnAuthError(currentTrack) {
      console.log('🔄 处理CDN认证失败，尝试刷新URL:', currentTrack.id)
      
      try {
        wx.showLoading({ title: '刷新播放链接...' })
        
        const { MusicAPI, LongSequenceAPI } = require('../../../utils/healingApi')
        let newUrl = null
        
        // 根据音频类型选择不同的刷新策略
        if (currentTrack.type === 'longSequence' && currentTrack.sessionId) {
          // 长序列音频：刷新长序列URL
          console.log('🔄 刷新长序列URL...')
          const result = await LongSequenceAPI.refreshLongSequenceUrl(currentTrack.sessionId)
          if (result.success && result.data.final_file_path) {
            newUrl = result.data.final_file_path
          }
        } else if (currentTrack.id) {
          // 60秒音频：刷新音频URL
          console.log('🔄 刷新60秒音频URL...')
          const result = await MusicAPI.refreshAudioUrl(currentTrack.id)
          if (result.success && result.data.url) {
            newUrl = result.data.url
          }
        }
        
        wx.hideLoading()
        
        if (newUrl) {
          console.log('✅ URL刷新成功，重新播放:', newUrl)
          
          // 更新track信息并重新播放
          const updatedTrack = {
            ...currentTrack,
            url: newUrl
          }
          
          wx.showToast({
            title: '链接已更新',
            icon: 'success',
            duration: 1000
          })
          
          // 延迟重新播放，给用户看到成功提示
          setTimeout(() => {
            this.playTrack(updatedTrack)
          }, 1200)
          
        } else {
          // 刷新失败，显示错误信息
          console.error('❌ URL刷新失败')
          wx.showModal({
            title: '播放链接已失效',
            content: '无法获取新的播放链接，请重新选择音频或稍后重试',
            showCancel: false,
            confirmText: '知道了'
          })
        }
        
      } catch (error) {
        wx.hideLoading()
        console.error('❌ URL刷新过程出错:', error)
        
        wx.showModal({
          title: '链接刷新失败',
          content: '无法更新播放链接，请检查网络连接后重试',
          showCancel: true,
          confirmText: '重试',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              // 用户选择重试
              this.handleCdnAuthError(currentTrack)
            }
          }
        })
      }
    },

    // 绑定全局事件
    bindGlobalEvents() {
      // 监听全局播放事件
      if (app.globalData) {
        app.globalData.onPlayTrack = this.playTrack.bind(this)
        app.globalData.onPauseTrack = this.pauseTrack.bind(this)
        app.globalData.onStopTrack = this.stopTrack.bind(this)
      }
    },

    // 播放音轨
    playTrack(trackInfo) {
      console.log('播放音轨:', trackInfo)
      
      if (!trackInfo || !trackInfo.url) {
        wx.showToast({
          title: '音频地址无效',
          icon: 'none'
        })
        return
      }

      // 构造完整的音频URL
      let fullUrl = trackInfo.url
      if (!fullUrl.startsWith('http')) {
        if (fullUrl.startsWith('/')) {
          // 绝对路径，直接拼接域名部分
          const baseUrl = app.globalData.apiBaseUrl.replace('/api', '')
          fullUrl = `${baseUrl}${fullUrl}`
        } else {
          // 相对路径，需要添加斜杠
          const baseUrl = app.globalData.apiBaseUrl.replace('/api', '')
          fullUrl = `${baseUrl}/${fullUrl}`
        }
      }

      // 🔍 对长序列音频进行预检查
      if (trackInfo.type === 'longSequence' && trackInfo.sessionId) {
        console.log('🔍 检测到长序列音频，进行文件状态预检查')
        try {
          // 异步检查文件状态，但不阻塞播放
          const { LongSequenceAPI } = require('../../../utils/healingApi')
          LongSequenceAPI.checkLongSequenceFile(trackInfo.sessionId).then(result => {
            if (!result.success || !result.data.exists) {
              console.warn('⚠️ 长序列文件可能不存在，但仍然尝试播放')
            }
          }).catch(error => {
            console.warn('长序列文件检查失败:', error)
          })
        } catch (error) {
          console.warn('长序列文件检查异常:', error)
        }
      }

      const { globalPlayer } = this.data
      
      // 检查globalPlayer是否存在，如果不存在则重新初始化
      if (!globalPlayer) {
        console.warn('globalPlayer未初始化，重新初始化...')
        this.initAudioContext()
        const { globalPlayer: newGlobalPlayer } = this.data
        if (!newGlobalPlayer) {
          console.error('globalPlayer初始化失败')
          wx.showToast({
            title: '音频播放器初始化失败',
            icon: 'none'
          })
          return
        }
      }
      
      // 构建音乐对象
      const musicData = {
        id: trackInfo.id || `track_${Date.now()}`,
        title: trackInfo.name || '未知音乐',
        src: fullUrl,
        duration: trackInfo.duration || 0,
        type: trackInfo.type || 'unknown',
        image: trackInfo.image,
        category: trackInfo.category
      }

      // 检查URL协议，本地开发环境避免HTTPS转换
      const isLocalDev = fullUrl.includes('127.0.0.1') || fullUrl.includes('localhost') || fullUrl.includes('192.168.')
      
      if (fullUrl.startsWith('http://') && !isLocalDev) {
        console.warn('检测到HTTP协议，可能在iOS上被拦截，尝试转为HTTPS')
        const httpsUrl = fullUrl.replace('http://', 'https://')
        console.log('尝试HTTPS URL:', httpsUrl)
        musicData.src = httpsUrl
      } else {
        console.log('使用原始URL（本地开发环境或已是HTTPS）:', fullUrl)
      }

      // 使用全局播放器播放，这会自动停止之前播放的音乐
      console.log('🎵 调用全局播放器播放音乐:', musicData.title)
      console.log('🎵 音乐数据:', musicData)
      console.log('🎵 全局播放器状态:', globalPlayer.getState())
      
      try {
        globalPlayer.play(musicData)
        console.log('✅ 全局播放器 play() 调用成功')
      } catch (error) {
        console.error('❌ 全局播放器 play() 调用失败:', error)
        wx.showToast({
          title: '播放失败: ' + error.message,
          icon: 'none'
        })
        return
      }
      
      // 使用真实的分类名称更新trackInfo
      const realCategoryName = this.getRealCategoryName(trackInfo.category || trackInfo.categoryId)
      const updatedTrackInfo = {
        ...trackInfo,
        category: realCategoryName || trackInfo.category || '未知分类'
      }
      
      this.setData({
        currentTrack: updatedTrackInfo,
        isVisible: true,
        currentTime: 0,
        progress: 0,
        duration: 0
      })
      
      // 如果有定时器在运行，提示用户新歌曲也会受到定时器控制
      if (this.data.timerEnabled && this.data.timerRemaining > 0) {
        console.log('定时器仍在运行，新歌曲将受到定时器控制')
        console.log('剩余定时时间:', this.data.timerRemaining, '秒')
      }
      
      console.log('🎵 播放器状态更新完成:', musicData.title)
      
      // 延迟检查播放状态
      setTimeout(() => {
        console.log('🎵 播放状态检查 (1秒后):', globalPlayer.getState())
      }, 1000)
    },

    // 暂停播放
    pauseTrack() {
      const { globalPlayer } = this.data
      if (globalPlayer) {
        globalPlayer.pause()
      }
    },

    // 停止播放
    stopTrack() {
      const { globalPlayer } = this.data
      if (globalPlayer) {
        globalPlayer.stop()
      }
      this.setData({
        isVisible: false,
        currentTime: 0,
        progress: 0
      })
    },

    // 切换播放/暂停
    togglePlay() {
      const { isPlaying, globalPlayer } = this.data
      
      if (!globalPlayer) return
      
      if (isPlaying) {
        globalPlayer.pause()
      } else {
        globalPlayer.play()
      }
    },

    // 上一首
    previousTrack() {
      this.triggerEvent('previousTrack')
    },

    // 下一首
    nextTrack() {
      this.triggerEvent('nextTrack')
    },

    // 关闭播放器
    closePlayer() {
      this.stopTrack()
      this.triggerEvent('closePlayer')
    },

    // 展开播放器（可以跳转到详细播放页面）
    expandPlayer() {
      this.triggerEvent('expandPlayer', { track: this.data.currentTrack })
    },

    // 测试方法：强制显示播放器
    testShow() {
      console.log('强制显示播放器测试')
      this.setData({
        isVisible: true,
        currentTrack: {
          name: '测试音乐',
          url: 'test',
          image: '/images/default-music-cover.svg'
        }
      })
      console.log('播放器应该已显示，当前数据:', this.data)
    },

    // 开始进度计时器
    startProgressTimer() {
      this.stopProgressTimer()
      
      const timer = setInterval(() => {
        if (this.data.isDragging) return
        
        const { globalPlayer } = this.data
        if (!globalPlayer) return
        
        const currentTime = globalPlayer.currentTime || 0
        const duration = globalPlayer.duration || 0
        const progress = duration > 0 ? (currentTime / duration) * 100 : 0

        this.setData({
          currentTime,
          duration,
          progress
        })
        
        // 触发进度更新事件给首页静态波形
        this.triggerEvent('playStateChange', { 
          isPlaying: this.data.isPlaying,
          currentTime,
          duration,
          progress,
          currentTrack: this.data.currentTrack || {},
          musicId: this.data.currentTrack?.id || '',
          musicName: this.data.currentTrack?.name || '',
          musicType: this.data.currentTrack?.type || ''
        })
      }, 1000)

      this.setData({ playingTimer: timer })
    },

    // 停止进度计时器
    stopProgressTimer() {
      const { playingTimer } = this.data
      if (playingTimer) {
        clearInterval(playingTimer)
        this.setData({ playingTimer: null })
      }
    },

    // 进度条拖拽开始
    onProgressTouchStart(e) {
      this.setData({ isDragging: true })
    },

    // 进度条拖拽
    onProgressTouchMove(e) {
      const { globalPlayer, duration } = this.data
      const query = this.createSelectorQuery()
      
      query.select('.progress-track').boundingClientRect(rect => {
        if (!rect) return
        
        const x = e.touches[0].clientX - rect.left
        const progress = Math.max(0, Math.min(100, (x / rect.width) * 100))
        const currentTime = (progress / 100) * duration
        
        this.setData({ progress, currentTime })
      }).exec()
    },

    // 进度条拖拽结束
    onProgressTouchEnd(e) {
      const { globalPlayer, currentTime } = this.data
      
      if (globalPlayer && globalPlayer.duration > 0) {
        globalPlayer.seek(currentTime)
      }
      
      this.setData({ isDragging: false })
    },

    // 波形跳转处理
    onWaveformSeek(e) {
      const { progress } = e.detail
      const { globalPlayer, duration } = this.data
      
      if (globalPlayer && duration > 0) {
        const seekTime = (progress / 100) * duration
        globalPlayer.seek(seekTime)
        
        this.setData({
          progress: progress,
          currentTime: seekTime
        })
      }
    },

    // 提供给外部调用的跳转方法
    seekToProgress(progress) {
      const { globalPlayer, duration } = this.data
      
      if (globalPlayer && duration > 0) {
        const seekTime = (progress / 100) * duration
        globalPlayer.seek(seekTime)
        
        this.setData({
          progress: progress,
          currentTime: seekTime
        })
        
        console.log('跳转到进度:', progress + '%', '时间:', seekTime + 's')
      }
    },

    /**
     * 加载分类数据
     */
    async loadCategories() {
      try {
        const { categoryManager } = require('../../utils/categoryManager')
        
        // 确保分类管理器已初始化
        await categoryManager.init()
        
        // 获取所有分类并构建映射
        const categories = categoryManager.getAllCategories()
        const categoryMap = {}
        
        categories.forEach(category => {
          // 支持通过ID和旧的分类名称映射
          categoryMap[category.id] = category.name
          categoryMap[category.code] = category.name
          
          // 兼容旧的硬编码分类名称
          if (category.id === 1) {
            categoryMap['自然音'] = category.name
            categoryMap['natural_sound'] = category.name
          } else if (category.id === 2) {
            categoryMap['白噪音'] = category.name
            categoryMap['white_noise'] = category.name
          } else if (category.id === 3) {
            categoryMap['脑波音频'] = category.name
            categoryMap['brainwave'] = category.name
          } else if (category.id === 4) {
            categoryMap['AI音乐'] = category.name
            categoryMap['ai_music'] = category.name
          } else if (category.id === 5) {
            categoryMap['疗愈资源'] = category.name
            categoryMap['healing_resource'] = category.name
          }
        })
        
        this.setData({ categoryMap })
        console.log('全局播放器分类映射加载完成:', categoryMap)
      } catch (error) {
        console.error('加载分类映射失败:', error)
      }
    },

    /**
     * 获取真实的分类名称
     */
    getRealCategoryName(category) {
      if (!category) return null
      
      // 如果是数字，说明是分类ID
      if (typeof category === 'number') {
        return this.data.categoryMap[category] || null
      }
      
      // 如果是字符串，先检查是否有映射
      if (this.data.categoryMap[category]) {
        return this.data.categoryMap[category]
      }
      
      // 如果没有映射，直接返回原值
      return category
    },

    // 格式化时间显示
    formatTime(time) {
      if (!time || isNaN(time)) return '0:00'
      
      const minutes = Math.floor(time / 60)
      const seconds = Math.floor(time % 60)
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    },

    // 切换定时器显示
    toggleTimer() {
      this.setData({ 
        showTimerSelector: !this.data.showTimerSelector 
      });
    },

    // 选择定时时长
    selectTimer(e) {
      const duration = parseInt(e.currentTarget.dataset.duration);
      console.log('选择定时时长:', duration, '分钟');
      
      this.setData({
        selectedTimer: duration,
        timerDuration: duration * 60, // 转换为秒
        timerRemaining: duration * 60,
        timerEnabled: true,
        showTimerSelector: false
      });
      
      // 开始定时器倒计时
      this.startTimer();
      
      wx.showToast({
        title: `定时${duration}分钟`,
        icon: 'success',
        duration: 1500
      });
    },

    // 取消定时器
    cancelTimer() {
      console.log('用户手动取消定时器');
      
      // 停止定时器（但不停止音乐播放）
      this.stopTimer();
      
      // 重置定时器状态
      this.setData({
        timerEnabled: false,
        showTimerSelector: false,
        timerDuration: 0,
        timerRemaining: 0
      });
      
      wx.showToast({
        title: '定时已取消',
        icon: 'success'
      });
    },

    // 开始定时器
    startTimer() {
      this.stopTimer(); // 先停止之前的定时器
      
      const interval = setInterval(() => {
        const remaining = this.data.timerRemaining - 1;
        
        if (remaining <= 0) {
          // 定时结束
          this.onTimerEnd();
        } else {
          this.setData({
            timerRemaining: remaining
          });
        }
      }, 1000);
      
      this.setData({ timerInterval: interval });
    },

    // 停止定时器
    stopTimer() {
      const { timerInterval } = this.data;
      if (timerInterval) {
        clearInterval(timerInterval);
        this.setData({ timerInterval: null });
      }
    },

    // 定时结束处理
    onTimerEnd() {
      console.log('定时播放结束');
      
      // 立即停止音频播放（无论是否在循环播放中）
      const { globalPlayer } = this.data;
      if (globalPlayer) {
        globalPlayer.stop();
      }
      
      // 停止播放器
      this.stopTrack();
      
      // 重置定时器
      this.setData({
        timerEnabled: false,
        timerDuration: 0,
        timerRemaining: 0
      });
      
      // 停止定时器
      this.stopTimer();
      
      // 显示提示
      wx.showToast({
        title: '定时播放结束',
        icon: 'success',
        duration: 2000
      });
      
      // 触发定时结束事件
      this.triggerEvent('timerEnd');
    },

    // 🆕 记录全局播放器播放开始
    recordGlobalPlayStart() {
      try {
        const AuthService = require('../../services/AuthService');
        // 检查用户登录状态
        if (!AuthService.isLoggedIn()) {
          console.log('🎵 用户未登录，跳过播放记录');
          return;
        }

        const currentTrack = this.data.currentTrack;
        if (!currentTrack || !currentTrack.name) {
          console.log('🎵 无当前音轨信息，跳过播放记录');
          return;
        }

        // 记录播放开始时间和信息
        this.currentGlobalPlayRecord = {
          track: currentTrack,
          startTime: Date.now(),
          totalDuration: currentTrack.duration || 60, // 音轨总时长(秒)
        };

        console.log('🎵 全局播放器开始记录播放:', currentTrack.name);
      } catch (error) {
        console.error('🎵 记录全局播放开始失败:', error);
      }
    },

    // 🆕 记录全局播放器播放结束
    recordGlobalPlayEnd() {
      try {
        if (!this.currentGlobalPlayRecord) {
          return;
        }

        const AuthService = require('../../services/AuthService');
        if (!AuthService.isLoggedIn()) {
          return;
        }

        const endTime = Date.now();
        const actualPlayDuration = Math.floor((endTime - this.currentGlobalPlayRecord.startTime) / 1000); // 实际播放时长(秒)
        const track = this.currentGlobalPlayRecord.track;

        // 只记录播放超过5秒的记录
        if (actualPlayDuration < 5) {
          console.log('🎵 全局播放器播放时间过短，跳过记录');
          this.currentGlobalPlayRecord = null;
          return;
        }

        // 计算播放进度
        const playProgress = this.currentGlobalPlayRecord.totalDuration > 0 
          ? Math.min(actualPlayDuration / this.currentGlobalPlayRecord.totalDuration, 1.0)
          : 0.0;

        // 确定内容类型
        let contentType = 'generated_music';
        const trackId = String(track.id || ''); // 🔧 转换为字符串避免类型错误
        
        if (track.type === 'brainwave' || trackId.startsWith('brainwave_')) {
          contentType = 'brainwave';
        } else if (track.type === 'healing_resource' || track.type === 'qiniu_file') {
          contentType = 'healing_resource';
        } else if (track.category && track.category.includes('AI')) {
          contentType = 'generated_music';
        } else if (track.category && (track.category.includes('脑波') || track.category.includes('brainwave'))) {
          contentType = 'brainwave';
        }

        // 创建播放记录
        const playRecordData = {
          content_type: contentType,
          content_id: track.id || 'unknown',
          content_title: track.name || track.title || '未知音乐',
          category_name: track.category || '未知分类',
          category_id: track.categoryId || track.category_id,
          play_duration: actualPlayDuration,
          total_duration: this.currentGlobalPlayRecord.totalDuration,
          play_progress: playProgress,
          device_type: 'miniprogram',
          play_source: 'global_player'
        };

        console.log('🎵 全局播放器记录数据准备提交:', playRecordData);
        console.log('🎵 播放时长:', actualPlayDuration, '秒，进度:', (playProgress * 100).toFixed(1) + '%');
        console.log('🎵 内容类型判断:', {
          trackType: track.type,
          trackId: trackId,
          trackCategory: track.category,
          finalContentType: contentType
        });

        // 调用API记录播放记录
        const api = require('../../utils/api');
        api.request({
          url: '/play-records/',
          method: 'POST',
          data: playRecordData,
          showLoading: false
        }).then((result) => {
          if (result.success) {
            console.log('✅ 全局播放器播放记录创建成功:', result.data);
            console.log('📝 记录ID:', result.data.id);
            console.log('📊 播放数据:', {
              时长: actualPlayDuration + '秒',
              内容: track.name || track.title,
              类型: contentType
            });
            
            // 通知其他页面刷新统计数据
            this.notifyStatsUpdate();
          } else {
            console.warn('❌ 全局播放器播放记录创建失败:', result.error);
            console.warn('❌ 失败的数据:', playRecordData);
          }
        }).catch((error) => {
          console.error('❌ 全局播放器创建播放记录失败:', error);
          console.error('❌ 请求数据:', playRecordData);
        });

        // 清除当前播放记录
        this.currentGlobalPlayRecord = null;

      } catch (error) {
        console.error('🎵 记录全局播放结束失败:', error);
      }
    },

    // 🆕 通知其他页面更新统计数据
    notifyStatsUpdate() {
      try {
        // 使用事件总线通知
        const eventEmitter = require('../../utils/eventEmitter');
        eventEmitter.emit('statsUpdated', {
          timestamp: Date.now(),
          source: 'global_player'
        });

        // 通知个人资料页面更新
        const pages = getCurrentPages();
        pages.forEach(page => {
          if (page.route === 'pages/profile/profile' && page.refreshUserStats) {
            page.refreshUserStats();
          }
        });

        console.log('🎵 全局播放器已通知页面刷新统计数据');
      } catch (error) {
        console.error('🎵 全局播放器通知统计数据更新失败:', error);
      }
    },

    // 清理资源
    cleanup() {
      this.stopTimer() // 清理定时器
      
      // 🆕 清理播放记录
      this.currentGlobalPlayRecord = null;
      
      // 解绑全局播放器事件
      this.unbindGlobalPlayerEvents()
      this._handlers = null
      this._lastTimeUpdateAt = 0
      
      // 清理全局事件
      if (app.globalData) {
        app.globalData.onPlayTrack = null
        app.globalData.onPauseTrack = null
        app.globalData.onStopTrack = null
      }
    }
  }
})
