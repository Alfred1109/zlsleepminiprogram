// components/realtime-waveform/realtime-waveform.js
// 实时音频波形分析组件

Component({
  properties: {
    // 音频上下文对象
    audioContext: {
      type: Object,
      value: null,
      observer: 'onAudioContextChange'
    },
    
    // 是否正在播放
    isPlaying: {
      type: Boolean,
      value: false,
      observer: 'onPlayingStateChange'
    },
    
    // 波形条数量
    barCount: {
      type: Number,
      value: 60
    },
    
    // 分析器配置
    fftSize: {
      type: Number,
      value: 256
    },
    
    // 刷新频率 (ms)
    refreshRate: {
      type: Number,
      value: 50
    },
    
    // 波形样式主题
    theme: {
      type: String,
      value: 'healing' // healing, energetic, calm
    }
  },

  data: {
    waveformData: [],
    canvasContext: null,
    canvas: null,
    canvasWidth: 0,
    canvasHeight: 0,
    animationId: null,
    analyserNode: null,
    dataArray: null,
    isInitialized: false,
    // 日志控制标志
    hasLoggedDrawStart: false,
    hasLoggedDrawComplete: false
  },

  lifetimes: {
    attached() {
      console.log('实时波形组件已加载')
      // 延迟初始化，确保DOM已渲染
      setTimeout(() => {
        this.initCanvas()
      }, 100)
      
      // 小程序环境直接启动模拟分析，不等待音频上下文
      setTimeout(() => {
        if (!this.data.isInitialized) {
          console.log('小程序环境，直接启动模拟分析模式')
          this.startSimulatedAnalysis()
        }
      }, 1000) // 增加等待时间，确保Canvas初始化完成
    },

    ready() {
      // 组件完全准备好后，确保已初始化
      if (!this.data.isInitialized) {
        console.log('组件ready，强制启动模拟分析')
        this.startSimulatedAnalysis()
      }
    },

    detached() {
      console.log('实时波形组件已卸载')
      this.cleanup()
    }
  },

  methods: {
    /**
     * 初始化画布 - 使用Canvas 1.0 API兼容老版本
     */
    initCanvas() {
      console.log('开始初始化Canvas (兼容模式)...')
      
      // 使用Canvas 1.0 API
      const ctx = wx.createCanvasContext('waveform-canvas', this)
      
      if (!ctx) {
        console.error('Canvas上下文创建失败')
        return
      }
      
      console.log('Canvas上下文创建成功')
      
      // 获取Canvas尺寸
      const query = this.createSelectorQuery().in(this)
      query.select('.waveform-canvas')
        .boundingClientRect()
        .exec((res) => {
          console.log('Canvas尺寸查询结果:', res)
          
          if (res && res[0]) {
            const { width, height } = res[0]
            console.log('Canvas尺寸:', { width, height })
            
            this.setData({
              canvasContext: ctx,
              canvas: { width, height }, // 模拟canvas对象
              canvasWidth: width,
              canvasHeight: height,
              isInitialized: true
            }, () => {
              console.log('Canvas初始化完成，开始绘制初始波形')
              this.generateInitialWaveform()
            })
            
            console.log('Canvas 1.0初始化成功')
          } else {
            console.error('无法获取Canvas尺寸')
          }
        })
    },

    /**
     * 音频上下文变化处理
     */
    onAudioContextChange(newContext, oldContext) {
      console.log('🎵 实时波形：音频上下文变化', {
        新上下文: !!newContext,
        新上下文类型: newContext?.constructor?.name,
        旧上下文: !!oldContext
      })
      
      if (oldContext) {
        this.cleanup()
      }

      if (newContext && this.data.canvasContext) {
        this.initAudioAnalyzer(newContext)
      } else if (newContext) {
        // 如果Canvas还没初始化，延迟处理
        setTimeout(() => {
          if (this.data.canvasContext) {
            this.initAudioAnalyzer(newContext)
          }
        }, 1000)
      }
    },

    /**
     * 播放状态变化处理
     */
    onPlayingStateChange(isPlaying) {
      if (isPlaying && this.data.analyserNode) {
        this.startAnalysis()
      } else {
        this.stopAnalysis()
        this.generateInitialWaveform()
      }
    },

    /**
     * 初始化音频分析器
     */
    initAudioAnalyzer(audioContext) {
      try {
        console.log('🎵 初始化音频分析器')
        console.log('🎵 音频上下文详情:', {
          存在: !!audioContext,
          类型: audioContext?.constructor?.name,
          是否内置音频: audioContext?.constructor?.name === 'InnerAudioContext',
          支持分析器: typeof audioContext?.createAnalyser === 'function'
        })
        
        // 小程序环境直接使用模拟分析，因为Web Audio API不完全支持
        if (audioContext && audioContext.constructor && audioContext.constructor.name === 'InnerAudioContext') {
          console.log('✅ 检测到小程序音频上下文，使用模拟波形分析')
          this.startSimulatedAnalysis()
          return
        }
        
        // 检查是否支持 createAnalyser（主要用于Web环境）
        if (audioContext && typeof audioContext.createAnalyser === 'function') {
          const analyser = audioContext.createAnalyser()
          analyser.fftSize = this.properties.fftSize
          
          const dataArray = new Uint8Array(analyser.frequencyBinCount)
          
          this.setData({
            analyserNode: analyser,
            dataArray: dataArray,
            isInitialized: true
          })
          
          console.log('✅ Web Audio分析器初始化成功')
        } else {
          console.log('⚠️ 当前环境不支持Web Audio分析，使用模拟波形')
          this.startSimulatedAnalysis()
        }
      } catch (error) {
        console.error('❌ 音频分析器初始化失败:', error)
        this.startSimulatedAnalysis()
      }
    },

    /**
     * 开始实时分析
     */
    startAnalysis() {
      if (this.data.animationId) {
        return
      }

      const analyze = () => {
        if (!this.properties.isPlaying) {
          return
        }

        if (this.data.analyserNode && this.data.dataArray) {
          // 真实音频分析
          this.analyzeRealAudio()
        } else {
          // 模拟分析
          this.analyzeSimulatedAudio()
        }

        this.drawWaveform()
        
        const animationId = setTimeout(() => {
          analyze()
        }, this.properties.refreshRate)
        
        this.setData({ animationId })
      }

      analyze()
    },

    /**
     * 停止分析
     */
    stopAnalysis() {
      if (this.data.animationId) {
        clearTimeout(this.data.animationId)
        this.setData({ animationId: null })
      }
    },

    /**
     * 分析真实音频数据
     */
    analyzeRealAudio() {
      const { analyserNode, dataArray } = this.data
      
      analyserNode.getByteFrequencyData(dataArray)
      
      const waveformData = []
      const barCount = this.properties.barCount
      const step = Math.floor(dataArray.length / barCount)
      
      for (let i = 0; i < barCount; i++) {
        const index = i * step
        const value = dataArray[index]
        const height = Math.max(15, (value / 255) * 100)
        waveformData.push(height)
      }
      
      this.setData({ waveformData })
    },

    /**
     * 分析模拟音频数据（当无法获取真实数据时）
     */
    analyzeSimulatedAudio() {
      const waveformData = []
      const time = Date.now() / 1000
      const barCount = this.properties.barCount
      
      for (let i = 0; i < barCount; i++) {
        // 基于时间和位置生成动态波形
        const baseWave = Math.sin((time * 2 + i * 0.2)) * 30
        const detailWave = Math.sin((time * 8 + i * 0.5)) * 15
        const randomNoise = (Math.random() - 0.5) * 10
        
        let height = 40 + baseWave + detailWave + randomNoise
        
        // 根据主题调整波形特征
        switch (this.properties.theme) {
          case 'energetic':
            height += Math.random() > 0.7 ? Math.random() * 20 : 0
            break
          case 'calm':
            height = height * 0.7 + 25
            break
          case 'healing':
          default:
            height = height * 0.8 + 20
            break
        }
        
        waveformData.push(Math.max(15, Math.min(85, height)))
      }
      
      this.setData({ waveformData })
    },

    /**
     * 开始模拟分析（当不支持真实分析时）
     */
    startSimulatedAnalysis() {
      console.log('启动模拟音频分析')
      
      this.setData({
        isInitialized: true,
        analyserNode: null,
        dataArray: null
      })
      
      // 生成初始波形数据
      this.generateInitialWaveform()
      
      // 直接开始分析
      if (this.properties.isPlaying) {
        this.startAnalysis()
      }
      
      // 触发初始化完成事件
      this.triggerEvent('initialized', {
        mode: 'simulated'
      })
      
      console.log('模拟音频分析已启动')
    },

    /**
     * 生成初始静态波形
     */
    generateInitialWaveform() {
      const waveformData = []
      const barCount = this.properties.barCount
      
      for (let i = 0; i < barCount; i++) {
        const height = 20 + Math.sin(i * 0.1) * 10 + (Math.random() - 0.5) * 5
        waveformData.push(Math.max(15, height))
      }
      
      this.setData({ waveformData })
      this.drawWaveform()
    },

    /**
     * 绘制波形 - Canvas 1.0 API版本
     */
    drawWaveform() {
      const { canvasContext, canvasWidth, canvasHeight, waveformData, hasLoggedDrawStart } = this.data
      
      if (!canvasContext || !canvasWidth || !canvasHeight || !waveformData.length) {
        // 只在首次或条件发生变化时输出
        if (!this.data.lastFailCondition || 
            this.data.lastFailCondition !== `${!!canvasContext}-${canvasWidth}-${canvasHeight}-${waveformData?.length || 0}`) {
          console.log('绘制条件不满足:', { 
            canvasContext: !!canvasContext, 
            canvasWidth, 
            canvasHeight,
            dataLength: waveformData?.length || 0 
          })
          this.setData({
            lastFailCondition: `${!!canvasContext}-${canvasWidth}-${canvasHeight}-${waveformData?.length || 0}`
          })
        }
        return
      }

      // 只在首次绘制时输出日志
      if (!hasLoggedDrawStart) {
        console.log('🎵 实时波形开始绘制，数据长度:', waveformData.length)
        this.setData({ hasLoggedDrawStart: true })
      }

      const ctx = canvasContext
      const width = canvasWidth
      const height = canvasHeight
      
      // 清空画布
      ctx.clearRect(0, 0, width, height)
      
      // 设置样式
      const isPlaying = this.properties.isPlaying
      const barWidth = width / waveformData.length
      const maxHeight = height * 0.8
      
      // 根据主题和播放状态设置颜色
      let fillColor = '#5D9E7E' // 默认疗愈绿色
      
      if (isPlaying) {
        switch (this.properties.theme) {
          case 'energetic':
            fillColor = '#FF6B6B'
            break
          case 'calm':
            fillColor = '#A8E6CF'
            break
          case 'healing':
          default:
            fillColor = '#5D9E7E'
            break
        }
      } else {
        fillColor = '#BDBDBD'
      }
      
      ctx.setFillStyle(fillColor)
      
      // 绘制波形条
      waveformData.forEach((barData, index) => {
        const barHeight = (barData / 100) * maxHeight
        const x = index * barWidth
        const y = height - barHeight // 从底部开始绘制
        
        // 绘制矩形波形条
        ctx.fillRect(x + 1, y, barWidth - 2, barHeight)
      })
      
      // Canvas 1.0需要显式draw
      ctx.draw()
      
      // 只在首次绘制完成时输出日志
      if (!this.data.hasLoggedDrawComplete) {
        console.log('✅ 实时波形绘制完成，画布尺寸:', width, 'x', height, '条数:', waveformData.length)
        this.setData({ hasLoggedDrawComplete: true })
      }
    },

    /**
     * 点击波形跳转 - Canvas 1.0版本
     */
    onCanvasTap(e) {
      const { x } = e.detail
      const { canvasWidth } = this.data
      
      if (canvasWidth && x >= 0) {
        const progress = (x / canvasWidth) * 100
        
        this.triggerEvent('seek', {
          progress: Math.max(0, Math.min(100, progress))
        })
        
        console.log('波形点击定位:', progress.toFixed(1) + '%')
      }
    },

    // Canvas 1.0不需要像素比处理

    /**
     * 清理资源
     */
    cleanup() {
      this.stopAnalysis()
      
      if (this.data.analyserNode) {
        try {
          this.data.analyserNode.disconnect()
        } catch (error) {
          console.warn('断开分析器连接失败:', error)
        }
      }
      
      this.setData({
        analyserNode: null,
        dataArray: null,
        isInitialized: false
      })
    }
  }
})
