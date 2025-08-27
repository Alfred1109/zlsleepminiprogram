// components/brainwave-realtime/brainwave-realtime.js
// 实时脑波可视化组件 - 结合音频分析和脑波特征

Component({
  properties: {
    // 脑波类型
    brainwaveType: {
      type: String,
      value: 'theta', // delta, theta, alpha, beta
      observer: 'onBrainwaveTypeChange'
    },
    
    // 是否正在播放
    isPlaying: {
      type: Boolean,
      value: false,
      observer: 'onPlayingStateChange'
    },
    
    // 音频上下文（如果有的话）
    audioContext: {
      type: Object,
      value: null
    },
    
    // 脑波播放器（如果有的话）
    brainwavePlayer: {
      type: Object,
      value: null
    }
  },

  data: {
    canvas: null,
    ctx: null,
    animationId: null,
    waveformData: [],
    brainwaveConfig: {
      delta: { baseFreq: 2, amplitude: 0.8, color: '#4A90E2', name: '深度睡眠' },
      theta: { baseFreq: 6, amplitude: 0.7, color: '#5D9E7E', name: '放松冥想' },
      alpha: { baseFreq: 10, amplitude: 0.6, color: '#F5A623', name: '轻度放松' },
      beta: { baseFreq: 20, amplitude: 0.5, color: '#D0021B', name: '专注状态' }
    },
    startTime: 0,
    devicePixelRatio: null, // 缓存设备像素比
    isAnimating: false // 防止重复动画
  },

  lifetimes: {
    attached() {
      console.log('实时脑波组件已加载')
      this.setData({ 
        startTime: Date.now(),
        isAnimating: false,
        devicePixelRatio: null
      })
      // 初始化波形数据
      this.generateWaveformData()
      // 延迟初始化画布，确保DOM已准备好
      setTimeout(() => {
        this.initCanvas()
      }, 100)
      
      // 确保立即开始绘制
      setTimeout(() => {
        if (!this.data.isAnimating) {
          this.startAnimation()
        }
      }, 500)
    },

    detached() {
      console.log('实时脑波组件卸载')
      this.cleanup()
    },

    ready() {
      console.log('实时脑波组件ready')
      // 组件完全准备好后，确保开始动画
      if (!this.data.isAnimating && !this.data.animationId) {
        setTimeout(() => {
          console.log('ready: 启动动画')
          this.startAnimation()
        }, 300)
      }
      
      // 强制触发一次重绘，确保波形显示
      setTimeout(() => {
        if (this.data.ctx && this.data.canvas) {
          console.log('ready: 强制重绘波形')
          console.log('画布信息:', { 
            width: this.data.canvas.width, 
            height: this.data.canvas.height,
            waveformDataLength: this.data.waveformData.length
          })
          this.drawWaveform()
        }
      }, 500)
    }
  },

  methods: {
    /**
     * 初始化画布
     */
    initCanvas() {
      const query = this.createSelectorQuery()
      query.select('#brainwave-canvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0]) return

                  const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        
        // 使用新的API替代弃用的wx.getSystemInfoSync
        wx.getWindowInfo({
          success: (windowInfo) => {
            const dpr = windowInfo.pixelRatio || 1
            canvas.width = res[0].width * dpr
            canvas.height = res[0].height * dpr
            ctx.scale(dpr, dpr)
            
            this.setData({ canvas, ctx })
            
            console.log('画布初始化完成:', { 
              width: canvas.width, 
              height: canvas.height, 
              dpr 
            })
            
            // 开始绘制
            this.startAnimation()
          },
          fail: () => {
            // 降级处理，使用默认值
            const dpr = 2
            canvas.width = res[0].width * dpr
            canvas.height = res[0].height * dpr
            ctx.scale(dpr, dpr)
            
            this.setData({ canvas, ctx })
            
            console.log('画布初始化完成(降级):', { 
              width: canvas.width, 
              height: canvas.height, 
              dpr 
            })
            
            // 开始绘制
            this.startAnimation()
          }
        })
        })
    },

    /**
     * 脑波类型变化处理
     */
    onBrainwaveTypeChange() {
      if (this.data.ctx) {
        this.generateWaveformData()
      }
    },

    /**
     * 播放状态变化处理
     */
    onPlayingStateChange(isPlaying) {
      console.log('播放状态变化:', isPlaying)
      if (isPlaying) {
        this.startAnimation()
      } else {
        this.stopAnimation()
      }
    },

    /**
     * 生成波形数据
     */
    generateWaveformData() {
      const config = this.data.brainwaveConfig[this.properties.brainwaveType]
      const pointCount = 200
      const waveformData = []
      
      // 生成初始静态波形
      for (let i = 0; i < pointCount; i++) {
        const x = i / pointCount
        const staticWave = Math.sin(2 * Math.PI * config.baseFreq * x) * config.amplitude
        waveformData.push(staticWave)
      }
      
      console.log(`生成${this.properties.brainwaveType}波形数据:`, pointCount, '个点', '数据范围:', Math.min(...waveformData), 'to', Math.max(...waveformData))
      this.setData({ waveformData })
      
      // 立即绘制一次
      setTimeout(() => {
        this.drawWaveform()
      }, 100)
    },

    /**
     * 开始动画
     */
    startAnimation() {
      if (this.data.animationId || this.data.isAnimating) return

      this.setData({ isAnimating: true })

      const animate = () => {
        // 检查组件是否还在动画状态
        if (!this.data.isAnimating) {
          console.log('动画已停止')
          this.setData({ animationId: null })
          return
        }

        // 如果画布未初始化，尝试重新初始化
        if (!this.data.ctx || !this.data.canvas) {
          console.log('画布未初始化，尝试重新初始化...')
          setTimeout(() => {
            if (this.data.isAnimating) {
              this.initCanvas()
            }
          }, 100)
          return
        }

        try {
          // 确保有波形数据
          if (this.data.waveformData.length === 0) {
            this.generateWaveformData()
          }
          
          // 更新和绘制波形
          this.updateWaveform()
          this.drawWaveform()
        } catch (error) {
          console.error('波形绘制错误:', error)
          this.stopAnimation()
          return
        }
        
        // 动态调整帧率：播放时60fps，静态时15fps
        const fps = this.properties.isPlaying ? 60 : 15
        const frameTime = 1000 / fps
        
        const animationId = requestAnimationFrame ? 
          requestAnimationFrame(animate) : 
          setTimeout(animate, frameTime)
        
        this.setData({ animationId })
      }

      animate()
    },

    /**
     * 停止动画
     */
    stopAnimation() {
      console.log('停止波形动画')
      this.setData({ isAnimating: false })
      
      if (this.data.animationId) {
        if (cancelAnimationFrame) {
          cancelAnimationFrame(this.data.animationId)
        } else {
          clearTimeout(this.data.animationId)
        }
        this.setData({ animationId: null })
      }
    },

    /**
     * 更新波形数据
     */
    updateWaveform() {
      const { brainwaveType, isPlaying } = this.properties
      const config = this.data.brainwaveConfig[brainwaveType]
      const time = (Date.now() - this.data.startTime) / 1000
      const waveformData = [...this.data.waveformData]
      
      // 移除第一个点
      waveformData.shift()
      
      let newPoint = 0
      
              if (isPlaying) {
        // 生成基于脑波频率的实时波形
        const baseWave = Math.sin(2 * Math.PI * config.baseFreq * time * 0.2) * config.amplitude
        const harmonics = Math.sin(2 * Math.PI * config.baseFreq * 2 * time * 0.2) * (config.amplitude * 0.3)
        
        // 添加一些随机变化使波形更自然
        const noise = (Math.random() - 0.5) * 0.2 * config.amplitude
        
        newPoint = baseWave + harmonics + noise
        
        // 如果有音频上下文，尝试结合真实音频数据
        if (this.properties.audioContext && this.tryGetAudioData) {
          const audioData = this.tryGetAudioData()
          if (audioData) {
            newPoint = newPoint * 0.7 + audioData * 0.3 // 混合脑波和音频数据
          }
        }
      } else {
        // 静态状态：缓慢的基础波形
        newPoint = Math.sin(2 * Math.PI * config.baseFreq * time * 0.05) * (config.amplitude * 0.5)
      }
      
      waveformData.push(newPoint)
      this.setData({ waveformData })
    },

    /**
     * 尝试获取音频数据（如果支持的话）
     */
    tryGetAudioData() {
      // 这里可以尝试从音频上下文获取实时数据
      // 由于小程序限制，可能无法实现，返回 null
      return null
    },

    /**
     * 绘制波形
     */
    drawWaveform() {
      const { ctx, canvas, waveformData } = this.data
      if (!ctx || !canvas) {
        // 只在首次失败时输出警告
        if (!this.data.hasLoggedCanvasWarn) {
          console.warn('🖼️ 脑波画布或上下文未准备好', { ctx: !!ctx, canvas: !!canvas })
          this.setData({ hasLoggedCanvasWarn: true })
        }
        return
      }
      
      if (!waveformData.length) {
        // 只在首次数据为空时输出警告
        if (!this.data.hasLoggedDataWarn) {
          console.warn('📊 脑波数据为空，长度:', waveformData.length)
          this.setData({ hasLoggedDataWarn: true })
        }
        // 如果没有数据，生成一些测试数据
        this.generateWaveformData()
        return
      }

      try {
        // 使用缓存的像素比例或获取新值
        const dpr = this.data.devicePixelRatio || this.getDevicePixelRatio()
        const width = canvas.width / dpr
        const height = canvas.height / dpr
        const centerY = height / 2
        const amplitude = height * 0.4

        // 只在首次绘制时输出日志
        if (!this.data.hasLoggedBrainwaveDraw) {
          console.log('🧠 脑波实时绘制开始:', { width, height, dataLength: waveformData.length, amplitude })
          this.setData({ hasLoggedBrainwaveDraw: true })
        }

        // 清空画布
        ctx.clearRect(0, 0, width, height)
        
        // 填充背景色
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
        ctx.fillRect(0, 0, width, height)

        // 获取当前脑波配置
        const config = this.data.brainwaveConfig[this.properties.brainwaveType]
        const isPlaying = this.properties.isPlaying

        // 设置样式
        ctx.lineWidth = isPlaying ? 3 : 2
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        // 先绘制简单的测试波形确保基本功能正常
        ctx.strokeStyle = config.color
        ctx.lineWidth = 3
        ctx.beginPath()
        
        const stepX = width / (waveformData.length - 1)
        for (let i = 0; i < waveformData.length; i++) {
          const x = i * stepX
          const y = centerY + waveformData[i] * amplitude
          
          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }
        ctx.stroke()
        
        // 绘制中心线
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, centerY)
        ctx.lineTo(width, centerY)
        ctx.stroke()
        
        console.log('简化波形绘制完成，数据点数:', waveformData.length)
      } catch (error) {
        console.error('绘制波形时出错:', error)
        // 重新初始化画布
        setTimeout(() => {
          if (this.data.isAnimating) {
            this.initCanvas()
          }
        }, 1000)
      }
    },

    /**
     * 绘制单个波形
     */
    drawWave(ctx, data, width, centerY, amplitude, color, opacity) {
      if (!data || data.length === 0) {
        console.warn('波形数据为空，无法绘制')
        return
      }
      
      console.log('绘制波形线条:', { dataLength: data.length, width, centerY, amplitude, color, opacity })
      
      const pointSpacing = width / (data.length - 1)
      
      // 创建渐变
      const gradient = ctx.createLinearGradient(0, 0, width, 0)
      gradient.addColorStop(0, this.hexToRgba(color, opacity * 0.3))
      gradient.addColorStop(0.5, this.hexToRgba(color, opacity))
      gradient.addColorStop(1, this.hexToRgba(color, opacity * 0.3))
      
      ctx.strokeStyle = gradient
      ctx.lineWidth = opacity > 0.5 ? 4 : 3 // 增加线条粗细
      ctx.beginPath()
      
      data.forEach((point, index) => {
        const x = index * pointSpacing
        const y = centerY + point * amplitude
        
        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      
      ctx.stroke()
      console.log('波形线条绘制完成')
      
      // 添加波形填充区域，增强视觉效果
      if (opacity > 0.5) {
        ctx.fillStyle = this.hexToRgba(color, opacity * 0.2)
        ctx.beginPath()
        data.forEach((point, index) => {
          const x = index * pointSpacing
          const y = centerY + point * amplitude
          
          if (index === 0) {
            ctx.moveTo(x, centerY)
            ctx.lineTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        })
        ctx.lineTo(width, centerY)
        ctx.closePath()
        ctx.fill()
        console.log('波形填充绘制完成')
      }
    },

    /**
     * 将十六进制颜色转换为 RGBA
     */
    hexToRgba(hex, alpha) {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    },

    /**
     * 点击波形切换脑波类型
     */
    onCanvasTap() {
      const types = ['delta', 'theta', 'alpha', 'beta']
      const currentIndex = types.indexOf(this.properties.brainwaveType)
      const nextIndex = (currentIndex + 1) % types.length
      
      this.triggerEvent('brainwaveChange', {
        type: types[nextIndex],
        config: this.data.brainwaveConfig[types[nextIndex]]
      })
    },

    /**
     * 获取设备像素比（使用新API）
     */
    getDevicePixelRatio() {
      if (this.data.devicePixelRatio) {
        return this.data.devicePixelRatio
      }

      // 使用新的API获取设备信息
      try {
        const windowInfo = wx.getWindowInfoSync()
        const dpr = windowInfo.pixelRatio || 2
        this.setData({ devicePixelRatio: dpr })
        return dpr
      } catch (error) {
        console.warn('获取设备信息失败，使用默认值:', error)
        const dpr = 2
        this.setData({ devicePixelRatio: dpr })
        return dpr
      }
    },

    /**
     * 测试绘制方法
     */
    testDraw() {
      console.log('开始测试绘制')
      const { ctx, canvas } = this.data
      if (!ctx || !canvas) {
        console.warn('测试绘制失败：画布未准备好')
        return
      }
      
      try {
        const dpr = this.data.devicePixelRatio || this.getDevicePixelRatio()
        const width = canvas.width / dpr
        const height = canvas.height / dpr
        
        console.log('测试绘制画布信息:', { width, height, dpr })
        
        // 清空画布
        ctx.clearRect(0, 0, width, height)
        
        // 绘制测试矩形
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'
        ctx.fillRect(10, 10, width - 20, height - 20)
        
        // 绘制测试线条
        ctx.strokeStyle = '#00FF00'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(0, height/2)
        ctx.lineTo(width, height/2)
        ctx.stroke()
        
        // 绘制测试波形
        ctx.strokeStyle = '#0000FF'
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let i = 0; i < width; i += 5) {
          const y = height/2 + Math.sin(i * 0.1) * 20
          if (i === 0) {
            ctx.moveTo(i, y)
          } else {
            ctx.lineTo(i, y)
          }
        }
        ctx.stroke()
        
        console.log('测试绘制完成')
      } catch (error) {
        console.error('测试绘制错误:', error)
      }
    },

    /**
     * 清理资源
     */
    cleanup() {
      this.stopAnimation()
      this.setData({
        canvas: null,
        ctx: null,
        animationId: null,
        isAnimating: false
      })
    }
  }
})
