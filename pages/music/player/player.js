// pages/music/player/player.js
// 音乐播放器页面
const app = getApp()
const { MusicAPI } = require('../../../utils/healingApi')
const { getGlobalPlayer, formatTime } = require('../../../utils/musicPlayer')

Page({
  data: {
    musicId: null,
    musicType: 'quick', // 'quick' or 'deep'
    musicInfo: null,
    player: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    progress: 0,
    loading: false,
    isFavorite: false,
    isDownloaded: false,
    // 深度脑波专属
    isDeepBrainwave: false,
    isoPhases: null,
    showPhaseInfo: false,
    currentPhase: 'iso',
    phaseProgress: 0,
    phaseLabels: {
      iso: '同质阶段',
      transition: '过渡阶段',
      target: '目标阶段'
    },
    phaseProgressDisplay: '0',
    // 全局播放器相关
    showGlobalPlayer: true,
    globalPlayer: null,
    waveformData: [], // Add this for real waveform data
    
    // 播放列表相关
    showPlaylistModal: false,
    playlist: [],
    currentIndex: 0,
    // 主题相关
    currentTheme: 'default',
    themeClass: '',
    themeConfig: null
  },

  onLoad(options) {
    console.log('音乐播放器页面加载', options)
    
    const musicId = options.musicId
    const typeParam = options.type || ''
    const inferredType = typeParam ? typeParam : (this.data.isDeepBrainwave ? 'deep' : 'quick')
    this.setData({
      musicId: parseInt(musicId),
      musicType: inferredType,
      isDeepBrainwave: inferredType === 'deep'
    })

    this.initTheme()
    this.initGlobalPlayer()
    this.loadMusicInfo()
  },

  onShow() {
    this.updatePlayerState()
    this.checkFavoriteStatus()
    this.checkDownloadStatus()
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
  },

  onUnload() {
    // 页面卸载时清理播放器监听
    if (this.data.player) {
      this.data.player.off('play', this.boundOnPlayerPlay)
      this.data.player.off('pause', this.boundOnPlayerPause)
      this.data.player.off('stop', this.boundOnPlayerStop)
      this.data.player.off('timeUpdate', this.boundOnTimeUpdate)
      this.data.player.off('error', this.boundOnPlayerError)
    }
  },

  /**
   * 初始化全局播放器
   */
  initGlobalPlayer() {
    console.log('初始化全局播放器')
    
    // 获取全局播放器实例（这里只是为了兼容）
    const player = getGlobalPlayer()
    this.setData({ 
      player,
      showGlobalPlayer: true
    })

    // 保存绑定后的函数引用，以便后续正确移除监听
    this.boundOnPlayerPlay = this.onPlayerPlay.bind(this)
    this.boundOnPlayerPause = this.onPlayerPause.bind(this)
    this.boundOnPlayerStop = this.onPlayerStop.bind(this)
    this.boundOnTimeUpdate = this.onTimeUpdate.bind(this)
    this.boundOnPlayerError = this.onPlayerError.bind(this)

    // 监听全局播放器事件（保持原有的监听用于更新UI状态）
    player.on('play', this.boundOnPlayerPlay)
    player.on('pause', this.boundOnPlayerPause)
    player.on('stop', this.boundOnPlayerStop)
    player.on('timeUpdate', this.boundOnTimeUpdate)
    player.on('error', this.boundOnPlayerError)
  },

  /**
   * 加载音乐信息
   */
  async loadMusicInfo() {
    this.setData({ loading: true })

    try {
      const result = await MusicAPI.getMusicStatus(this.data.musicId)
      
      if (result.success) {
        const musicInfo = result.data
        const isDeep = (musicInfo.duration_seconds || 0) >= 600 || musicInfo.type === 'longSequence' || musicInfo.category === '深度脑波'
        const isoPhases = musicInfo.iso_phase_plan ? this.parseIsoPhases(musicInfo.iso_phase_plan) : null
        this.setData({
          musicInfo,
          isDeepBrainwave: isDeep,
          musicType: isDeep ? 'deep' : 'quick',
          isoPhases
        })

        const computedMusicType = this.getMusicType(musicInfo)
        const formattedDuration = this.formatTimeDisplay(musicInfo.duration_seconds || 60)
        this.setData({ computedMusicType, formattedDuration })

        if (musicInfo.waveform_data_path) {
          this.loadWaveformData(musicInfo.waveform_data_path)
        }

        const currentMusic = this.data.player.currentMusic
        if (!currentMusic || currentMusic.id !== this.data.musicId) {
          this.loadMusicToPlayer(musicInfo)
        }
      } else {
        throw new Error(result.error || '获取音乐信息失败')
      }

    } catch (error) {
      console.error('加载音乐信息失败:', error)
      wx.showModal({
        title: '加载失败',
        content: error.message || '无法加载音乐信息',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * Load waveform data from a URL
   */
  loadWaveformData(path) {
    let waveformUrl = path
    if (waveformUrl && !waveformUrl.startsWith('http')) {
      const baseUrl = (app.globalData.apiBaseUrl || 'https://medsleep.cn').replace('/api', '')
      waveformUrl = baseUrl + (waveformUrl.startsWith('/') ? '' : '/') + waveformUrl
    }
    
    wx.request({
      url: waveformUrl,
      success: (res) => {
        if (res.statusCode === 200 && Array.isArray(res.data)) {
          this.setData({ waveformData: res.data })
        } else {
          console.warn('Failed to load or parse waveform data.')
        }
      },
      fail: (err) => {
        console.error('Error fetching waveform data:', err)
      }
    })
  },

  /**
   * 使用全局播放器加载音乐
   */
  loadMusicToPlayer(musicInfo) {
    // 优先使用带token的url字段，回退到file_path
    const audioSource = musicInfo.url || musicInfo.file_path || musicInfo.final_file_path || musicInfo.audio_url
    if (!audioSource && !musicInfo.stream_url) {
      wx.showToast({ title: '音乐文件不存在', icon: 'error' })
      return
    }

    let audioUrl = audioSource
    if (audioUrl && audioUrl.indexOf('/') === 0) {
      const baseUrl = (app.globalData.apiBaseUrl || 'https://medsleep.cn').replace('/api', '')
      audioUrl = baseUrl + audioUrl
    }

    const isDeep = this.data.isDeepBrainwave
    const trackInfo = {
      id: musicInfo.music_id || musicInfo.id,
      name: musicInfo.title || musicInfo.music_name || `脑波 ${musicInfo.id}`,
      title: musicInfo.title || musicInfo.music_title || `脑波 ${musicInfo.id}`,
      url: audioUrl,
      stream_url: musicInfo.stream_url,
      use_stream: musicInfo.use_stream,
      originalSrc: audioUrl,
      image: musicInfo.cover_url || musicInfo.cover_image || '/images/default-music-cover.svg',
      category: isDeep ? '深度脑波' : '快速脑波',
      type: isDeep ? 'longSequence' : 'ai_music',
      duration: musicInfo.duration_seconds || (musicInfo.total_duration_minutes ? musicInfo.total_duration_minutes * 60 : 60),
      file_size: musicInfo.file_size || musicInfo.final_file_size,
      sessionId: musicInfo.session_id || musicInfo.long_sequence_session_id
    }

    console.log('使用全局播放器加载音乐:', trackInfo)

    setTimeout(() => {
      const globalPlayer = this.selectComponent('#globalPlayer')
      if (globalPlayer && globalPlayer.playTrack) {
        globalPlayer.playTrack(trackInfo)
      } else {
        console.warn('Global player组件未找到，降级到本地播放器')
        this.data.player.loadMusic({
          id: trackInfo.id,
          title: trackInfo.title,
          src: trackInfo.url,
          duration: trackInfo.duration,
          type: trackInfo.type
        })
      }
    }, 100)
  },

  /**
   * 更新播放器状态
   */
  updatePlayerState() {
    const state = this.data.player.getState()
    this.setData({
      isPlaying: state.isPlaying,
      currentTime: state.currentTime,
      duration: state.duration,
      volume: state.volume,
      progress: state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0
    })
  },

  /**
   * 播放器事件处理
   */
  onPlayerPlay() {
    this.setData({ isPlaying: true })
  },

  onPlayerPause() {
    this.setData({ isPlaying: false })
  },

  onPlayerStop() {
    this.setData({ 
      isPlaying: false,
      currentTime: 0,
      progress: 0
    })
  },

  onTimeUpdate(data) {
    const progress = data.duration > 0 ? (data.currentTime / data.duration) * 100 : 0
    this.setData({
      currentTime: data.currentTime,
      duration: data.duration,
      progress: progress
    })

    if (this.data.isDeepBrainwave && this.data.isoPhases) {
      this.updateIsoPhase(data.currentTime, data.duration)
    }
  },

  onPlayerError(error) {
    console.error('播放器错误:', error)
    wx.showToast({
      title: '播放失败',
      icon: 'error'
    })
  },

  /**
   * 播放/暂停（模板调用的方法名）
   */
  onPlayPause() {
    return this.onTogglePlay()
  },

  /**
   * 播放/暂停
   */
  onTogglePlay() {
    if (this.data.isPlaying) {
      this.data.player.pause()
    } else {
      if (this.data.musicInfo) {
        this.data.player.play()
      } else {
        wx.showToast({
          title: '音乐未加载',
          icon: 'error'
        })
      }
    }
  },

  /**
   * 停止播放
   */
  onStop() {
    this.data.player.stop()
  },

  /**
   * 进度条拖拽
   */
  onProgressChange(e) {
    const value = e.detail.value
    const seekTime = (value / 100) * this.data.duration
    this.data.player.seek(seekTime)
  },

  /**
   * 音量控制
   */
  onVolumeChange(e) {
    const value = e.detail.value
    const volume = value / 100
    this.data.player.setVolume(volume)
    this.setData({ volume: volume })
  },

  /**
   * 显示/隐藏音量控制
   */
  onToggleVolumeControl() {
    this.setData({
      showVolumeControl: !this.data.showVolumeControl
    })
  },

  /**
   * 上一首（模板调用的方法名）
   */
  onPrevious() {
    wx.showToast({
      title: '暂无上一首',
      icon: 'none'
    })
  },

  /**
   * 下一首（模板调用的方法名）
   */
  onNext() {
    wx.showToast({
      title: '暂无下一首',
      icon: 'none'
    })
  },

  /**
   * 切换循环模式
   */
  onToggleLoop() {
    const isLoop = !this.data.isLoop
    this.setData({ isLoop })
    wx.showToast({
      title: isLoop ? '已开启循环' : '已关闭循环',
      icon: 'none'
    })
  },

  /**
   * 显示播放列表
   */
  onShowPlaylist() {
    // 获取全局播放器实例
    const { getGlobalPlayer } = require('../../../utils/musicPlayer')
    const globalPlayer = getGlobalPlayer()
    const state = globalPlayer.getState()
    
    // 如果有播放列表，显示列表
    if (state.playlist && state.playlist.length > 0) {
      this.setData({
        showPlaylistModal: true,
        playlist: state.playlist,
        currentIndex: state.currentIndex
      })
    } else {
      // 创建包含当前音乐的播放列表
      const currentMusic = this.data.musicData
      if (currentMusic) {
        this.setData({
          showPlaylistModal: true,
          playlist: [currentMusic],
          currentIndex: 0
        })
      } else {
        wx.showToast({
          title: '暂无播放列表',
          icon: 'none'
        })
      }
    }
  },

  /**
   * 关闭播放列表弹窗
   */
  closePlaylistModal() {
    this.setData({
      showPlaylistModal: false
    })
  },

  /**
   * 选择播放列表中的音乐
   */
  selectPlaylistMusic(e) {
    const index = e.currentTarget.dataset.index
    const music = this.data.playlist[index]
    
    if (music) {
      // 使用全局播放器播放选中的音乐
      const { getGlobalPlayer } = require('../../../utils/musicPlayer')
      const globalPlayer = getGlobalPlayer()
      
      // 设置播放列表和当前索引
      globalPlayer.setPlaylist(this.data.playlist, index)
      globalPlayer.play(music)
      
      // 更新界面
      this.setData({
        currentIndex: index,
        showPlaylistModal: false
      })
      
      // 如果是不同的音乐，更新页面数据
      if (music.id !== this.data.musicData?.id) {
        this.setData({
          musicData: music
        })
      }
    }
  },

  /**
   * 下载音乐（模板调用的方法名）
   */
  onDownload() {
    return this.onDownloadMusic()
  },

  /**
   * 添加到收藏
   */
  onAddToFavorites() {
    const isFavorite = !this.data.isFavorite
    this.setData({ isFavorite })
    wx.showToast({
      title: isFavorite ? '已添加到收藏' : '已取消收藏',
      icon: 'success'
    })
  },

  /**
   * 重新生成音乐
   */
  onGenerateNew() {
    wx.showModal({
      title: '重新生成',
      content: '确定要重新生成音乐吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({
            title: '重新生成功能开发中',
            icon: 'none'
          })
        }
      }
    })
  },

  /**
   * 下载音乐
   */
  async onDownloadMusic() {
    if (!this.data.musicInfo) {
      wx.showToast({
        title: '音乐信息未加载',
        icon: 'error'
      })
      return
    }

    try {
      wx.showLoading({ title: '下载中...' })
      
      const result = await MusicAPI.downloadMusic(this.data.musicId)
      
      // 保存到本地
      wx.saveFile({
        tempFilePath: result.tempFilePath,
        success: (res) => {
          wx.showToast({
            title: '下载成功',
            icon: 'success'
          })
          console.log('音乐已保存到:', res.savedFilePath)
        },
        fail: (error) => {
          console.error('保存文件失败:', error)
          wx.showToast({
            title: '保存失败',
            icon: 'error'
          })
        }
      })

    } catch (error) {
      console.error('下载音乐失败:', error)
      wx.showToast({
        title: '下载失败',
        icon: 'error'
      })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 分享音乐
   */
  onShareMusic() {
    wx.showShareMenu({
      withShareTicket: true
    })
  },

  /**
   * 查看音乐详情
   */
  onShowMusicDetails() {
    if (!this.data.musicInfo) return

    const details = [
      '音乐ID: ' + (this.data.musicInfo.music_id || this.data.musicInfo.id),
      '时长: ' + formatTime(this.data.musicInfo.duration_seconds),
      '文件大小: ' + this.formatFileSize(this.data.musicInfo.file_size),
      '生成时间: ' + this.data.musicInfo.created_at,
      '状态: ' + this.data.musicInfo.status
    ]

    if (this.data.musicInfo.tempo) {
      details.push('速度: ' + this.data.musicInfo.tempo + ' BPM')
    }

    if (this.data.musicInfo.key) {
      details.push('调性: ' + this.data.musicInfo.key)
    }

    wx.showModal({
      title: '音乐详情',
      content: details.join('\n'),
      showCancel: false
    })
  },

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (!bytes) return '未知'
    
    if (bytes < 1024) {
      return bytes + ' B'
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB'
    } else {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }
  },

  /**
   * 格式化时间显示
   */
  formatTimeDisplay(seconds) {
    return formatTime(seconds)
  },

  /**
   * 格式化时间
   */
  formatTime(seconds) {
    return formatTime(seconds)
  },

  /**
   * 生成音乐标题
   */
  generateMusicTitle(music) {
    if (!music) return '个性化疗愈音乐'

    if (music.title && music.title !== '个性化疗愈音乐') {
      return music.title
    }

    // 根据评测信息生成标题
    const scaleName = music.assessment_scale_name || '心理评测'
    const mood = music.mood || '疗愈'
    const date = music.assessment_date ? new Date(music.assessment_date) : new Date(music.created_at)
    const monthDay = (date.getMonth() + 1) + '.' + date.getDate()

    return scaleName + '·' + mood + '音乐 ' + monthDay
  },

  /**
   * 格式化评测日期
   */
  formatAssessmentDate(dateString) {
    if (!dateString) return '未知时间'

    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffTime = now - date
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays === 0) {
        return '今天'
      } else if (diffDays === 1) {
        return '昨天'
      } else if (diffDays < 7) {
        return `${diffDays}天前`
      } else {
        const month = date.getMonth() + 1
        const day = date.getDate()
        return `${month}月${day}日`
      }
    } catch (error) {
      return '未知时间'
    }
  },

  /**
   * 获取音乐类型（用于波形图样式）
   */
  getMusicType(music) {
    // 确保总是返回有效的字符串，避免null值
    if (!music) return 'healing'

    const mood = (music.mood || '').toLowerCase()
    const style = (music.music_style || music.style || '').toLowerCase()
    const category = (music.category || '').toLowerCase()

    if (mood.indexOf('放松') !== -1 || style.indexOf('relaxing') !== -1 || category.indexOf('放松') !== -1) {
      return 'relaxing'
    } else if (mood.indexOf('活力') !== -1 || style.indexOf('energetic') !== -1 || category.indexOf('活力') !== -1) {
      return 'energetic'
    } else if (mood.indexOf('冥想') !== -1 || style.indexOf('meditative') !== -1 || category.indexOf('冥想') !== -1) {
      return 'meditative'
    } else {
      return 'healing'
    }
  },

  /**
   * 波形图跳转事件
   */
  onWaveformSeek(e) {
    const progress = e.detail.progress
    this.seekToProgress(progress)
  },

  /**
   * 跳转到指定进度
   */
  seekToProgress(progress) {
    if (this.data.player && this.data.duration > 0) {
      const targetTime = (progress / 100) * this.data.duration
      this.data.player.seek(targetTime)

      this.setData({
        progress: progress,
        currentTime: targetTime
      })
    }
  },

  /**
   * 全局播放器事件处理
   */
  onGlobalPlayerStateChange(e) {
    const isPlaying = e.detail.isPlaying
    this.setData({ isPlaying: isPlaying })
  },

  onNextTrack() {
    console.log('下一首')
  },

  onPreviousTrack() {
    console.log('上一首')
  },

  onCloseGlobalPlayer() {
    wx.navigateBack()
  },

  onExpandGlobalPlayer() {
    console.log('当前已在播放器页面')
  },

  /**
   * 显示音乐库
   */
  onShowMusicLibrary() {
    // 暂时屏蔽音乐库页面，显示提示
    wx.showModal({
      title: '功能暂不可用',
      content: '音乐库功能正在维护中，请稍后再试',
      showCancel: false,
      confirmText: '知道了'
    })
    
    // wx.navigateTo({
    //   url: '/pages/music/library/library'
    // })
  },

  /**
   * 检查收藏状态
   */
  checkFavoriteStatus() {
    if (this.data.musicData && this.data.musicData.id) {
      const isFavorited = favoritesManager.isFavorited(this.data.musicData.id)
      this.setData({ isFavorite: isFavorited })
    }
  },

  /**
   * 检查下载状态
   */
  checkDownloadStatus() {
    if (this.data.musicData && this.data.musicData.id) {
      const isDownloaded = downloadManager.isDownloaded(this.data.musicData.id)
      this.setData({ isDownloaded: isDownloaded })
    }
  },

  /**
   * 切换收藏状态
   */
  async onToggleFavorite() {
    try {
      if (!this.data.musicData) {
        wx.showToast({
          title: '暂无音乐信息',
          icon: 'none'
        })
        return
      }

      const result = await favoritesManager.toggleFavorite({
        id: this.data.musicData.id,
        type: 'music',
        title: this.data.musicData.title || this.data.musicData.name,
        subtitle: this.data.musicData.category || this.data.musicData.mood,
        cover: this.data.musicData.image || this.data.musicData.cover,
        duration: this.data.musicData.duration,
        category: this.data.musicData.category,
        tags: this.data.musicData.tags,
        metadata: {
          ...this.data.musicData,
          mood: this.data.musicData.mood,
          genre: this.data.musicData.genre
        }
      })

      this.setData({ isFavorite: result.isFavorited })
      
      wx.showToast({
        title: result.action === 'added' ? '已添加收藏' : '已取消收藏',
        icon: 'success'
      })

    } catch (error) {
      console.error('收藏操作失败:', error)
      wx.showToast({
        title: error.message || '操作失败',
        icon: 'none'
      })
    }
  },

  /**
   * 下载音乐
   */
  async onDownload() {
    try {
      if (!this.data.musicData) {
        wx.showToast({
          title: '暂无音乐信息',
          icon: 'none'
        })
        return
      }

      // 检查是否已下载
      if (this.data.isDownloaded) {
        wx.showActionSheet({
          itemList: ['播放本地文件', '重新下载', '删除下载'],
          success: (res) => {
            switch (res.tapIndex) {
              case 0:
                this.playLocalFile()
                break
              case 1:
                this.redownloadFile()
                break
              case 2:
                this.deleteDownload()
                break
            }
          }
        })
        return
      }

      // 开始下载
      wx.showLoading({ title: '准备下载...' })

      const downloadItem = await downloadManager.startDownload({
        id: this.data.musicData.id,
        title: this.data.musicData.title || this.data.musicData.name,
        subtitle: this.data.musicData.category || this.data.musicData.mood,
        cover: this.data.musicData.image || this.data.musicData.cover,
        duration: this.data.musicData.duration,
        url: this.data.musicData.url || this.data.musicData.downloadUrl,
        fileSize: this.data.musicData.fileSize || 0,
        fileType: 'audio',
        category: this.data.musicData.category,
        metadata: {
          ...this.data.musicData
        }
      })

      wx.hideLoading()
      this.setData({ isDownloaded: downloadItem.status === 'downloaded' })
      
      wx.showToast({
        title: downloadItem.status === 'downloading' ? '开始下载' : '下载完成',
        icon: 'success'
      })

    } catch (error) {
      wx.hideLoading()
      console.error('下载失败:', error)
      wx.showToast({
        title: error.message || '下载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 播放本地文件
   */
  playLocalFile() {
    const downloadItem = downloadManager.getDownloadItem(this.data.musicData.id)
    if (downloadItem && downloadItem.localPath) {
      // 这里可以设置播放本地文件的逻辑
      wx.showToast({
        title: '正在播放本地文件',
        icon: 'success'
      })
    }
  },

  /**
   * 重新下载
   */
  async redownloadFile() {
    try {
      wx.showLoading({ title: '重新下载中...' })
      await downloadManager.retryDownload(this.data.musicData.id)
      wx.hideLoading()
      wx.showToast({
        title: '重新下载中',
        icon: 'success'
      })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: '重新下载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 删除下载
   */
  async deleteDownload() {
    try {
      wx.showModal({
        title: '删除下载',
        content: '确定要删除这个下载文件吗？',
        success: async (res) => {
          if (res.confirm) {
            await downloadManager.deleteDownload(this.data.musicData.id)
            this.setData({ isDownloaded: false })
            wx.showToast({
              title: '下载已删除',
              icon: 'success'
            })
          }
        }
      })
    } catch (error) {
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      })
    }
  },

  /**
   * 分享
   */
  onShare() {
    this.onShareAppMessage()
  },

  onShareAppMessage() {
    return {
      title: '我在AI疗愈中生成了专属音乐',
      path: '/pages/music/player/player?musicId=' + this.data.musicId + '&type=' + this.data.musicType,
      imageUrl: '/images/share-player.png'
    }
  },

  /**
   * 返回上一页
   */
  onNavigateBack() {
    wx.navigateBack()
  },

  parseIsoPhases(isoPlan) {
    try {
      const phases = typeof isoPlan === 'string' ? JSON.parse(isoPlan) : isoPlan
      return phases || null
    } catch (e) {
      console.error('解析ISO阶段失败:', e)
      return null
    }
  },

  getIsoPhaseLabels() {
    return {
      iso: '同质阶段',
      transition: '过渡阶段',
      target: '目标阶段'
    }
  },

  updateIsoPhase(currentTime, duration) {
    const isoPhases = this.data.isoPhases
    if (!isoPhases || duration <= 0) return

    const { iso_phase, transition_phase, target_phase } = isoPhases
    const total = duration

    const isoDuration = (iso_phase?.duration_minutes || 0) * 60
    const transitionDuration = (transition_phase?.duration_minutes || 0) * 60
    const targetDuration = (target_phase?.duration_minutes || 0) * 60

    const isoEnd = isoDuration
    const transitionEnd = isoDuration + transitionDuration

    let currentPhase = 'iso'
    let phaseProgress = 0

    if (currentTime <= isoEnd) {
      currentPhase = 'iso'
      phaseProgress = isoDuration > 0 ? (currentTime / isoDuration) * 100 : 0
    } else if (currentTime <= transitionEnd) {
      currentPhase = 'transition'
      const progressInTransition = currentTime - isoEnd
      phaseProgress = transitionDuration > 0 ? (progressInTransition / transitionDuration) * 100 : 0
    } else {
      currentPhase = 'target'
      const progressInTarget = currentTime - transitionEnd
      const targetTotal = targetDuration || (total - transitionEnd)
      phaseProgress = targetTotal > 0 ? (progressInTarget / targetTotal) * 100 : 0
    }

    const clamped = Math.min(100, Math.max(0, phaseProgress))
    this.setData({
      currentPhase,
      phaseProgress: clamped,
      phaseProgressDisplay: clamped.toFixed(0)
    })
  },

  onTogglePhaseInfo() {
    this.setData({ showPhaseInfo: !this.data.showPhaseInfo })
  }
})
