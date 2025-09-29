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
    
    // 🔧 关键修复：使用原生播放器而不是WebAudio
    this.audioContext.useWebAudioAPI = false
    
    // 🔧 修复音频无声音问题：确保音频可以后台播放
    try {
      this.audioContext.sessionCategory = 'playback'
      this.audioContext.playbackState = 'playing'
    } catch (error) {
      console.warn('设置音频会话属性失败:', error)
    }
    
    // 🎵 优化音频播放设置
    this.audioContext.obeyMuteSwitch = false  // 忽略静音开关
    this.audioContext.autoplay = true         // 启用自动播放
    this.audioContext.startTime = 0           // 从头开始播放
    this.audioContext.playbackRate = 1.0      // 正常播放速度
    
    // 🎯 根本问题修复：静态音频文件不需要认证头
    // 小程序音频上下文不支持自定义header，这是好事，避免了认证头问题
    
    this.setupEventListeners()
    
    // 设置默认音量
    this.audioContext.volume = this.volume
    
    // 🔧 调试音频初始化状态
    console.log('音乐播放器初始化完成，音量:', this.volume, '音频上下文:', !!this.audioContext)
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
      console.log('🔊 音频状态:', {
        音量: this.audioContext.volume,
        时长: this.audioContext.duration,
        当前时间: this.audioContext.currentTime,
        音频源: this.audioContext.src
      })
      
      // 🔍 诊断音频文件问题
      if (isNaN(this.audioContext.duration)) {
        console.error('❌ 音频文件时长异常(NaN)，可能文件损坏或格式不支持')
        console.error('🔍 音频文件URL:', this.audioContext.src)
        console.error('💡 建议检查后端生成的音频文件是否正常')
        
        // 尝试手动下载测试文件完整性
        console.log('📥 开始下载测试音频文件...')
        wx.downloadFile({
          url: this.audioContext.src,
          timeout: 30000, // 30秒超时
          success: (res) => {
            console.log('📥 音频文件下载测试成功:', {
              临时文件: res.tempFilePath,
              状态码: res.statusCode,
              文件大小: res.totalBytesWritten || 'unknown'
            })
            
            // 测试临时文件是否能播放
            const testAudio = wx.createInnerAudioContext()
            testAudio.src = res.tempFilePath
            testAudio.onCanplay(() => {
              console.log('✅ 下载的音频文件可以播放!')
              console.log('💡 问题确认：URL可访问，文件完整，问题在于小程序直接流式播放这个大文件')
              console.log('🔧 解决方案：应该使用下载后播放模式')
              testAudio.destroy()
            })
            testAudio.onError((err) => {
              console.error('❌ 下载的音频文件也无法播放，文件本身有问题:', err)
              testAudio.destroy()
            })
          },
          fail: (err) => {
            console.error('❌ 音频文件下载测试失败:', err)
            console.error('💡 这说明URL本身不可访问或网络有问题')
            
            // 尝试简单的HEAD请求测试
            wx.request({
              url: this.audioContext.src,
              method: 'HEAD',
              timeout: 10000,
              success: (res) => {
                console.log('✅ HEAD请求成功，文件存在:', res)
              },
              fail: (err) => {
                console.error('❌ HEAD请求也失败，确认文件不存在:', err)
              }
            })
          }
        })
      }
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
      
      // 🔧 修复：只有当音频上下文能提供有效时长时才更新
      if (this.audioContext.duration && !isNaN(this.audioContext.duration)) {
        this.duration = this.audioContext.duration
      } else if (!this.duration || this.duration <= 0) {
        // 如果预设时长也无效，尝试从当前音乐对象获取
        if (this.currentMusic && this.currentMusic.duration > 0) {
          this.duration = this.currentMusic.duration
        }
      }
      
      this.updateGlobalState()
      this.emit('timeUpdate', {
        currentTime: this.currentTime,
        duration: this.duration
      })
    })

    // 音频数据加载完成
    this.audioContext.onCanplay(() => {
      console.log('🎵 音频事件: 可以播放 (onCanplay)')
      console.log('🎵 音频上下文时长:', this.audioContext.duration, '秒')
      
      // 🔧 修复：更新时长信息
      if (this.audioContext.duration && !isNaN(this.audioContext.duration)) {
        this.duration = this.audioContext.duration
        console.log('🎵 使用音频上下文时长:', this.duration, '秒')
      } else if (this.currentMusic && this.currentMusic.duration > 0) {
        this.duration = this.currentMusic.duration
        console.log('🎵 音频上下文时长无效，使用预设时长:', this.duration, '秒')
      }
      
      // 清除加载超时检测
      if (this._loadTimeout) {
        clearTimeout(this._loadTimeout)
        this._loadTimeout = null
      }
    })
    
    // 音频缓冲等待
    this.audioContext.onWaiting(() => {
      console.log('🎵 音频事件: 正在缓冲 (onWaiting)')
    })

    // 错误处理
    this.audioContext.onError((err) => {
      console.error('🎵 音频事件: 播放错误', err)
      console.error('🔍 详细错误信息:', {
        错误码: err.errCode,
        错误信息: err.errMsg,
        音频源: this.audioContext?.src,
        音频音量: this.audioContext?.volume,
        是否静音: this.audioContext?.volume === 0
      })
      
      this.isPlaying = false
      this.updateGlobalState()
      
      // 清除加载超时检测
      if (this._loadTimeout) {
        clearTimeout(this._loadTimeout)
        this._loadTimeout = null
      }
      
      // 🔍 深度分析错误原因
      console.error('🔍 音频播放错误深度分析:')
      console.error('  - 错误信息:', err.errMsg)
      console.error('  - 错误码:', err.errCode)
      console.error('  - 音频URL:', this.currentMusic?.src)
      console.error('  - 是否流式:', this.currentMusic?.src?.includes('stream'))
      console.error('  - 原始URL:', this.currentMusic?.originalSrc)
      
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
      src: finalSrc,
      originalSrc: music.src  // 🔧 保存原始URL作为回退
    }
    this.currentTime = 0
    this._retryCount = 0 // 重置重试计数器
    
    // 🔧 修复：预设音频时长（解决流式播放时长NaN问题）
    if (music.duration && music.duration > 0) {
      console.log('🎵 使用预设时长:', music.duration, '秒')
      this.duration = music.duration
    } else {
      this.duration = 0 // 等待onCanplay或onTimeUpdate更新
    }
    
    this.updateGlobalState()
    
    console.log('加载音乐:', music.title)
    console.log('🔍 音频URL:', finalSrc)
    
    // 🎯 检查是否需要下载后播放
    const needsDownload = this.shouldUseDownloadPlayback(music)
    
    if (needsDownload) {
      console.log('📥 检测到大文件，使用下载后播放模式')
      console.log('📥 下载URL:', finalSrc)
      
      // 标记为下载模式，不直接设置src
      this._isDownloadMode = true
      this._downloadUrl = finalSrc
      this.audioContext.src = '' // 暂时清空src
      
      console.log('✅ 下载模式已启用，播放时将先下载文件')
    } else {
      // 🌊 流式播放：直接设置src，边下载边播放
      console.log('🌊 流式音频播放，边下载边播放')
      this.audioContext.src = finalSrc
      this._isDownloadMode = false
    }
    
    // 记录详细信息用于调试
    console.log('🎯 音频播放模式:', {
      最终URL: finalSrc,
      需要下载: needsDownload,
      下载模式: this._isDownloadMode,
      URL类型: finalSrc.includes('/static/') ? '静态文件' : finalSrc.includes('/api/') ? 'API接口' : '其他'
    })
    
    // 🎯 流式播放超时设置：流式音频只需要等待开始播放
    const loadTimeout = 15000 // 统一15秒超时，流式播放不需要等待完整下载
    
    this._loadTimeout = setTimeout(() => {
      if (this.duration === 0 && this.currentTime === 0) {
        console.warn('⚠️ 音频加载超时，可能URL无效或网络问题')
        console.warn('⚠️ 问题URL:', finalSrc)
        console.warn('⚠️ 超时时间:', loadTimeout + 'ms')
        
        // 触发错误处理
        this.emit('error', {
          errMsg: '音频加载超时，请检查网络连接',
          errCode: 'LOAD_TIMEOUT',
          src: finalSrc
        })
      }
    }, loadTimeout)
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
   * 🌊 继续使用流式播放，您说得对，流式播放就是为大文件设计的
   */
  shouldUseDownloadPlayback(music) {
    // 🎯 暂时禁用下载模式，专注解决URL访问问题
    console.log('🌊 继续使用流式播放模式')
    return false
  }

  /**
   * 🌊 流式播放判断 - 长序列音频启用流式播放
   */
  shouldUseStreamPlayback(music) {
    // 🎯 长序列音频使用流式播放
    if (music.sessionId || 
        (music.src && (music.src.includes('long_sequence') || music.src.includes('long-sequence'))) ||
        music.stream_url) {
      console.log('🌊 检测到长序列音频，启用流式播放')
      return true
    }
    
    // 🎯 大文件音频使用流式播放（>5MB 估算）
    if (music.duration && music.duration > 300) { // 大于5分钟的音频
      console.log('🌊 检测到大文件音频，启用流式播放')
      return true
    }
    
    return false
  }

  /**
   * 🌊 构建流式播放URL
   */
  buildStreamUrl(music) {
    const app = getApp()
    const baseUrl = app.globalData.apiBaseUrl || 'https://medsleep.cn'
    
    // 🔧 优先使用后端提供的流式URL
    if (music.stream_url) {
      // 如果是相对路径，构建完整URL
      if (music.stream_url.startsWith('/')) {
        const fullStreamUrl = `${baseUrl}${music.stream_url}`
        console.log('🌊 使用后端流式URL:', fullStreamUrl)
        return fullStreamUrl
      }
      // 如果已经是完整URL，直接使用
      console.log('🌊 使用后端完整流式URL:', music.stream_url)
      return music.stream_url
    }
    
    // 🔧 回退：如果是长序列音频但没有提供stream_url
    if (music.sessionId) {
      const fallbackUrl = `${baseUrl}/api/music/long_sequence_stream/${music.sessionId}`
      console.log('🌊 使用回退流式URL:', fallbackUrl)
      return fallbackUrl
    }
    
    // 🔧 回退：如果是静态文件
    if (music.src && (music.src.startsWith('/static/') || music.src.includes('/static/'))) {
      let filePath
      if (music.src.startsWith('/static/')) {
        filePath = music.src.substring(1) // 移除开头的'/'
      } else {
        // 处理完整URL，提取static路径部分
        const staticIndex = music.src.indexOf('/static/')
        filePath = music.src.substring(staticIndex + 1) // 提取static/...部分
      }
      const staticStreamUrl = `${baseUrl}/api/music/stream/${filePath}`
      console.log('🌊 使用静态文件流式URL:', staticStreamUrl)
      console.log('🌊 原始URL:', music.src)
      console.log('🌊 提取路径:', filePath)
      return staticStreamUrl
    }
    
    console.log('🌊 无法构建流式URL，使用原始URL:', music.src)
    return music.src // 回退到原始URL
  }

  /**
   * 🔍 测试流式API连通性 - 深度诊断版本
   */
  async testStreamingApi(streamUrl) {
    try {
      console.log('🔍 开始深度测试流式API:', streamUrl)
      
      // 获取认证头
      const AuthService = require('../services/AuthService')
      let headers = { 'Content-Type': 'application/json' }
      
      if (AuthService.isLoggedIn()) {
        try {
          headers = await AuthService.addAuthHeader(headers)
          console.log('🔍 已添加认证头')
        } catch (error) {
          console.warn('🔍 获取认证头失败:', error)
        }
      }
      
      // 🔍 第一步：HEAD请求检查API状态
      console.log('🔍 步骤1: HEAD请求检查API状态...')
      wx.request({
        url: streamUrl,
        method: 'HEAD',
        header: headers,
        timeout: 10000,
        success: (res) => {
          console.log('🔍 HEAD请求结果:', {
            statusCode: res.statusCode,
            headers: res.header,
            contentType: res.header['content-type'] || res.header['Content-Type'],
            contentLength: res.header['content-length'] || res.header['Content-Length']
          })
          
          if (res.statusCode === 200) {
            // 🔍 第二步：实际下载前几KB数据验证
            console.log('🔍 步骤2: 下载前1KB数据验证...')
            this.testStreamDataDownload(streamUrl, headers)
          } else {
            console.error('❌ HEAD请求失败，状态码:', res.statusCode)
            // 🔍 即使HEAD失败，也尝试直接下载测试
            console.log('🔍 HEAD失败，直接尝试下载测试...')
            this.testStreamDataDownload(streamUrl, headers)
          }
        },
        fail: (err) => {
          console.error('❌ HEAD请求失败:', err)
          console.log('🔍 HEAD请求超时，可能是流式API不支持HEAD方法')
          console.log('🔍 尝试直接下载测试流式数据...')
          // 🔍 HEAD失败时直接尝试下载
          this.testStreamDataDownload(streamUrl, headers)
        }
      })
      
    } catch (error) {
      console.error('❌ 流式API测试异常:', error)
    }
  }

  /**
   * 🔍 验证音频URL可访问性
   */
  async verifyAudioUrl(audioUrl) {
    console.log('🔍 开始验证音频URL可访问性:', audioUrl)
    
    try {
      // 获取认证头（如果需要）
      const AuthService = require('../services/AuthService')
      let headers = {}
      
      if (AuthService.isLoggedIn() && audioUrl.includes('medsleep.cn')) {
        try {
          headers = await AuthService.addAuthHeader(headers)
        } catch (error) {
          console.warn('🔍 获取认证头失败:', error)
        }
      }
      
      // 🔍 尝试多种访问方式
      console.log('🔍 尝试访问方式1: 带认证头的HEAD请求')
      wx.request({
        url: audioUrl,
        method: 'HEAD',
        header: headers,
        timeout: 10000,
        success: (res) => {
          console.log('🔍 带认证头HEAD请求结果:', {
            URL: audioUrl,
            状态码: res.statusCode,
            内容类型: res.header['content-type'] || res.header['Content-Type'],
            文件大小: res.header['content-length'] || res.header['Content-Length'],
            响应头: res.header
          })
          
          if (res.statusCode === 200) {
            const contentType = res.header['content-type'] || res.header['Content-Type'] || ''
            if (contentType.includes('audio') || contentType.includes('wav') || contentType.includes('mp3')) {
              console.log('✅ 带认证头访问成功，文件存在且格式正确')
            } else {
              console.log('⚠️ 带认证头访问成功，但内容类型:', contentType)
            }
          } else {
            console.error('❌ 带认证头访问失败，状态码:', res.statusCode)
            // 🔍 尝试不带认证头访问
            this.verifyAudioUrlWithoutAuth(audioUrl)
          }
        },
        fail: (err) => {
          console.error('❌ 带认证头访问失败:', err)
          console.error('❌ URL:', audioUrl)
          // 🔍 尝试不带认证头访问
          this.verifyAudioUrlWithoutAuth(audioUrl)
        }
      })
    } catch (error) {
      console.error('❌ 音频URL验证异常:', error)
    }
  }

  /**
   * 🔍 验证音频URL可访问性（不带认证头）
   */
  verifyAudioUrlWithoutAuth(audioUrl) {
    console.log('🔍 尝试访问方式2: 不带认证头的HEAD请求')
    
    wx.request({
      url: audioUrl,
      method: 'HEAD',
      header: { 'Content-Type': 'application/json' },
      timeout: 10000,
      success: (res) => {
        console.log('🔍 不带认证头HEAD请求结果:', {
          URL: audioUrl,
          状态码: res.statusCode,
          内容类型: res.header['content-type'] || res.header['Content-Type'],
          文件大小: res.header['content-length'] || res.header['Content-Length'],
          响应头: res.header
        })
        
        if (res.statusCode === 200) {
          const contentType = res.header['content-type'] || res.header['Content-Type'] || ''
          if (contentType.includes('audio') || contentType.includes('wav') || contentType.includes('mp3')) {
            console.log('✅ 不带认证头访问成功！问题可能是认证头导致的')
            console.log('💡 建议：音频播放时不要添加认证头')
          } else {
            console.log('⚠️ 不带认证头访问成功，但内容类型:', contentType)
          }
        } else if (res.statusCode === 404) {
          console.error('❌ 静态文件确实不存在 (404)')
          console.error('💡 建议：检查后端文件保存路径和Nginx静态文件配置')
        } else {
          console.error('❌ 不带认证头访问也失败，状态码:', res.statusCode)
        }
        
        // 🔍 尝试GET请求获取更多信息
        this.verifyAudioUrlWithGet(audioUrl)
      },
      fail: (err) => {
        console.error('❌ 不带认证头访问也失败:', err)
        console.error('💡 这确认了文件或服务器配置有问题')
        
        // 🔍 尝试GET请求获取更多信息
        this.verifyAudioUrlWithGet(audioUrl)
      }
    })
  }

  /**
   * 🔍 使用GET请求进一步验证（获取前几个字节）
   */
  verifyAudioUrlWithGet(audioUrl) {
    console.log('🔍 尝试访问方式3: GET请求验证文件内容')
    
    // 尝试下载文件的前几KB
    const downloadTask = wx.downloadFile({
      url: audioUrl,
      timeout: 15000,
      success: (res) => {
        console.log('🔍 GET下载测试结果:', {
          URL: audioUrl,
          状态码: res.statusCode,
          临时文件: res.tempFilePath,
          文件存在: !!res.tempFilePath
        })
        
        if (res.statusCode === 200 && res.tempFilePath) {
          // 检查文件大小
          wx.getFileInfo({
            filePath: res.tempFilePath,
            success: (fileInfo) => {
              console.log('🎯 文件下载成功!', {
                文件大小: fileInfo.size + ' bytes',
                文件路径: res.tempFilePath
              })
              
              if (fileInfo.size > 1000) {
                console.log('🎯🎯🎯 根本问题找到了！')
                console.log('✅ 文件存在且可以下载，但音频播放器无法直接访问')
                console.log('💡 可能原因: 需要特殊的音频流服务或CORS配置')
                console.log('💡 解决方案: 使用下载后播放，或修复服务器音频流配置')
              } else {
                console.error('❌ 下载的文件太小，可能是错误页面')
              }
              
              // 清理临时文件
              wx.removeSavedFile({ filePath: res.tempFilePath })
            },
            fail: (err) => {
              console.error('❌ 无法获取下载文件信息:', err)
            }
          })
        } else {
          console.error('❌ GET下载也失败，状态码:', res.statusCode)
          console.error('🎯 最终结论：音频文件确实不存在于服务器上')
        }
      },
      fail: (err) => {
        console.error('❌ GET下载失败:', err)
        console.error('🎯 最终结论：服务器配置或网络问题')
      }
    })
  }

  /**
   * 🔍 测试流式数据下载
   */
  testStreamDataDownload(streamUrl, headers) {
    console.log('🔍 开始测试流式数据下载...')
    console.log('🚨 关键诊断：这个测试将确定是小程序问题还是后端问题')
    
    // 使用下载API测试实际数据传输
    const downloadTask = wx.downloadFile({
      url: streamUrl,
      header: headers,
      timeout: 30000, // 增加到30秒超时
      success: (res) => {
        console.log('🔍 流式数据下载测试结果:', {
          statusCode: res.statusCode,
          tempFilePath: res.tempFilePath,
          文件存在: !!res.tempFilePath
        })
        
        if (res.statusCode === 200 && res.tempFilePath) {
          // 检查下载的文件大小
          wx.getFileInfo({
            filePath: res.tempFilePath,
            success: (fileInfo) => {
              console.log('🎯 流式数据下载测试结果分析:')
              console.log('  文件大小:', fileInfo.size + ' bytes')
              console.log('  文件路径:', res.tempFilePath)
              
              if (fileInfo.size > 1000000) { // 大于1MB
                console.log('🎯🎯🎯 诊断结果：后端API正常工作！')
                console.log('✅ 流式API可以下载完整音频文件')
                console.log('❌ 问题是：小程序音频播放器无法处理流式URL')
                console.log('💡 建议解决方案：')
                console.log('   1. 使用下载后播放的方式')
                console.log('   2. 或者检查音频播放器的流式支持配置')
              } else if (fileInfo.size > 1000) {
                console.log('⚠️ 流式API返回部分数据，可能是缓冲问题')
                console.log('💡 建议：检查后端流式API的实现方式')
              } else {
                console.error('❌ 流式API返回的文件太小，可能是错误响应')
                console.error('🎯 诊断结果：后端流式API有问题')
              }
            },
            fail: (err) => {
              console.error('❌ 无法获取下载文件信息:', err)
            }
          })
        } else if (res.statusCode === 404) {
          console.error('🎯🎯🎯 诊断结果：后端流式API不存在！')
          console.error('❌ 流式API返回404，需要检查后端路由配置')
        } else {
          console.error('🎯 诊断结果：后端流式API有问题')
          console.error('❌ 状态码:', res.statusCode)
        }
      },
      fail: (err) => {
        console.error('❌ 流式数据下载失败:', err)
        
        if (err.errMsg && err.errMsg.includes('timeout')) {
          console.error('🎯🎯🎯 诊断结果：后端流式API响应太慢！')
          console.error('💡 可能原因：')
          console.error('   1. 后端流式API处理逻辑有性能问题')
          console.error('   2. 音频文件生成或读取过程太慢')
          console.error('   3. 服务器资源不足')
        } else {
          console.error('🎯 诊断结果：网络或服务器配置问题')
        }
      }
    })
    
    // 监听下载进度
    downloadTask.onProgressUpdate((res) => {
      if (res.totalBytesWritten > 0) {
        console.log('🔍 流式下载进度:', {
          已下载: res.totalBytesWritten + ' bytes',
          总大小: res.totalBytesExpectedToWrite + ' bytes',
          进度: res.progress + '%'
        })
        
        // 如果有下载进度，说明连接是通的
        if (res.totalBytesWritten > 100000) { // 下载超过100KB
          console.log('✅ 流式API连接正常，正在传输数据...')
        }
      }
    })
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
      
      // 🔧 修复：检查音频URL的有效性
      if (music && music.src) {
        console.log('🔍 音频URL检查:', {
          URL: music.src,
          包含token: music.src.includes('token=') || music.src.includes('e='),
          是CDN: music.src.includes('cdn.medsleep.cn'),
          是流式: music.src.includes('stream'),
          协议: music.src.startsWith('https') ? 'HTTPS' : music.src.startsWith('http') ? 'HTTP' : '相对路径'
        })
        
        // 🎯 跳过URL验证，避免认证头干扰
        console.log('🎯 跳过URL验证，静态文件无需认证头')
      }
      
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

    // 🎯 检查是否需要先下载（已禁用下载模式）
    if (this._isDownloadMode && this._downloadUrl) {
      console.log('📥 下载模式：需要先下载音频文件')
      this.downloadAndPlay()
      return
    }
    
    console.log('🎵 开始播放，音频src已准备:', this.currentMusic.src)

    // 只在首次播放该音乐时输出详细信息
    if (!this.lastPlayedMusic || this.lastPlayedMusic !== this.currentMusic.title) {
      console.log('🎵 开始播放音乐:', this.currentMusic.title)
      console.log('🎵 音频源:', this.currentMusic.src)
      
      // 检查音频文件大小警告
      if (this.currentMusic.src && this.currentMusic.src.includes('long_sequence')) {
        console.warn('⚠️ 长序列音频文件较大，可能需要更长的加载时间')
        
        // 🔍 针对长序列音频，快速检测URL是否可访问
        console.log('🔍 快速检测长序列音频URL可访问性...')
        wx.request({
          url: this.currentMusic.src,
          method: 'HEAD',
          timeout: 5000,
          success: (res) => {
            console.log('✅ 长序列音频URL检测成功:', {
              状态码: res.statusCode,
              内容类型: res.header['content-type'] || res.header['Content-Type'],
              文件大小: res.header['content-length'] || res.header['Content-Length']
            })
          },
          fail: (err) => {
            console.error('❌ 长序列音频URL检测失败:', err)
            console.error('💡 这可能解释了为什么设置audioContext.src会timeout')
          }
        })
      }
      
      this.lastPlayedMusic = this.currentMusic.title
    }
    
    try {
      // 🔧 播放前确保音量和状态正确
      this.audioContext.volume = this.volume
      console.log('🔊 播放前音量检查:', this.audioContext.volume)
      
      this.audioContext.play()
      console.log('✅ audioContext.play() 调用成功')
      
      // 智能延迟检查：根据音频类型调整检查时间
      const isStreamingAudio = this.currentMusic.src && (
        this.currentMusic.src.includes('/api/music/long_sequence_stream/') || 
        this.currentMusic.src.includes('stream') || 
        this.shouldUseStreamPlayback(this.currentMusic)
      )
      const checkDelay = isStreamingAudio ? 10000 : 3000 // 流式音频10秒后检查，普通音频3秒后检查
      
      setTimeout(() => {
        const delayLabel = isStreamingAudio ? '(10秒后-流式音频)' : '(3秒后-普通音频)'
        console.log(`🎵 延迟状态检查 ${delayLabel}:`, {
          isPlaying: this.isPlaying,
          currentTime: this.currentTime,
          duration: this.duration,
          src: this.audioContext.src,
          isStreamingAudio: isStreamingAudio
        })
        
        // 检查音频是否真正在播放：
        // 1. 状态显示未播放，或
        // 2. 状态显示播放但时长为0（加载失败），或
        // 3. 状态显示播放但延迟检查后进度仍为0（可能卡住）
        const audioFailed = !this.isPlaying || 
                           (this.isPlaying && this.duration === 0) ||
                           (this.isPlaying && this.currentTime === 0)
        
        if (audioFailed && this.currentMusic && !this._refreshing) {
          console.warn('⚠️ 音频可能加载失败，尝试智能重试')
          console.warn('⚠️ 失败原因:', {
            notPlaying: !this.isPlaying,
            zeroDuration: this.duration === 0,
            zeroProgress: this.currentTime === 0,
            isStreamingAudio: isStreamingAudio
          })
          
          // 🎯 立即解决方案：如果是流式音频失败，尝试切换到静态文件
          if (isStreamingAudio && this.currentMusic.originalSrc) {
            console.log('🎯 检测到流式音频播放失败，尝试切换到静态文件播放')
            console.log('🔄 从流式URL:', this.currentMusic.src)
            console.log('🔄 切换到静态URL:', this.currentMusic.originalSrc)
            
            // 直接切换到静态文件
            this.currentMusic.src = this.currentMusic.originalSrc
            this.audioContext.src = this.currentMusic.originalSrc
            
            // 重新播放
            try {
              this.audioContext.play()
              console.log('✅ 已切换到静态文件播放')
              
              wx.showToast({
                title: '已切换到直接播放模式',
                icon: 'success',
                duration: 2000
              })
            } catch (error) {
              console.error('❌ 静态文件播放也失败:', error)
              this.intelligentRetry(this.currentMusic)
            }
          } else {
            this.intelligentRetry(this.currentMusic)
          }
        }
      }, checkDelay)
      
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
   * 📥 下载音频文件并播放
   */
  async downloadAndPlay() {
    console.log('📥 开始下载音频文件:', this._downloadUrl)
    
    wx.showLoading({ title: '正在加载音频...' })
    
    try {
      // 获取认证头
      const AuthService = require('../services/AuthService')
      let headers = {}
      
      if (AuthService.isLoggedIn()) {
        try {
          headers = await AuthService.addAuthHeader(headers)
          console.log('📥 已添加认证头进行下载')
        } catch (error) {
          console.warn('📥 获取认证头失败:', error)
        }
      }
      
      // 下载音频文件
      const downloadTask = wx.downloadFile({
        url: this._downloadUrl,
        header: headers,
        timeout: 60000, // 60秒超时
        success: (res) => {
          wx.hideLoading()
          
          if (res.statusCode === 200 && res.tempFilePath) {
            console.log('✅ 音频下载成功:', res.tempFilePath)
            
            // 设置下载的临时文件为音频源
            this.audioContext.src = res.tempFilePath
            this._downloadedFilePath = res.tempFilePath
            
            // 播放下载的文件
            try {
              this.audioContext.play()
              console.log('✅ 下载的音频开始播放')
              
              wx.showToast({
                title: '音频加载完成',
                icon: 'success',
                duration: 1500
              })
            } catch (error) {
              console.error('❌ 播放下载的音频失败:', error)
              this.emit('error', { message: '播放下载的音频失败', originalError: error })
            }
          } else {
            console.error('❌ 音频下载失败，状态码:', res.statusCode)
            this.emit('error', { message: '音频下载失败', statusCode: res.statusCode })
          }
        },
        fail: (err) => {
          wx.hideLoading()
          console.error('❌ 音频下载失败:', err)
          this.emit('error', { message: '音频下载失败', originalError: err })
        }
      })
      
      // 显示下载进度
      downloadTask.onProgressUpdate((res) => {
        const progress = Math.round(res.progress)
        console.log('📥 下载进度:', progress + '%')
        
        if (progress > 0) {
          wx.showLoading({ title: `加载中 ${progress}%` })
        }
      })
      
    } catch (error) {
      wx.hideLoading()
      console.error('❌ 下载过程异常:', error)
      this.emit('error', { message: '下载过程异常', originalError: error })
    }
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
    this._pendingSrc = null
    this._isStreamingLoad = false
    this._isDownloadMode = false
    this._downloadUrl = null
    
    // 清理下载的临时文件
    if (this._downloadedFilePath) {
      try {
        wx.removeSavedFile({ filePath: this._downloadedFilePath })
        console.log('🧹 已清理下载的临时文件')
      } catch (error) {
        console.warn('清理临时文件失败:', error)
      }
      this._downloadedFilePath = null
    }
    
    // 清理超时定时器
    if (this._loadTimeout) {
      clearTimeout(this._loadTimeout)
      this._loadTimeout = null
    }
    
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
