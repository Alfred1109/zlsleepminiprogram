// components/static-waveform/static-waveform.js
// 静态音频波形预览组件

Component({
  properties: {
    // 是否正在播放（影响颜色和进度）
    isPlaying: {
      type: Boolean,
      value: false,
      observer: 'onPlayingStateChange'
    },
    
    // 播放进度 0-100
    progress: {
      type: Number,
      value: 0,
      observer: 'onProgressChange'
    },
    
    // 波形条数量
    barCount: {
      type: Number,
      value: 80
    },
    
    // 波形样式主题
    theme: {
      type: String,
      value: 'healing' // healing, energetic, calm
    },

    // 音乐时长（秒），用于生成对应的波形
    duration: {
      type: Number,
      value: 180, // 默认3分钟
      observer: 'onMusicInfoChange'
    },

    // 音乐ID，用于生成每首歌独特的波形
    musicId: {
      type: String,
      value: '',
      observer: 'onMusicInfoChange'
    },

    // 音乐名称，用于生成特征波形
    musicName: {
      type: String,
      value: '',
      observer: 'onMusicInfoChange'
    },

    // 音乐类型，影响波形特征
    musicType: {
      type: String,
      value: '',
      observer: 'onMusicInfoChange'
    }
  },

  data: {
    waveformData: [],
    canvasContext: null,
    canvasWidth: 0,
    canvasHeight: 0,
    isInitialized: false
  },

  lifetimes: {
    attached() {
      console.log('静态波形组件已加载')
      // 延迟初始化，确保DOM已渲染
      setTimeout(() => {
        this.initCanvas()
      }, 100)
    },

    ready() {
      // 组件完全准备好后，确保已初始化
      if (!this.data.isInitialized) {
        setTimeout(() => {
          this.initCanvas()
        }, 200)
      }
    },

    detached() {
      console.log('静态波形组件已卸载')
    }
  },

  methods: {
    /**
     * 初始化画布 - Canvas 1.0 API
     */
    initCanvas() {
      console.log('开始初始化静态波形Canvas...')
      
      // 使用Canvas 1.0 API
      const ctx = wx.createCanvasContext('static-waveform-canvas', this)
      
      if (!ctx) {
        console.error('静态波形Canvas上下文创建失败')
        return
      }
      
      console.log('静态波形Canvas上下文创建成功')
      
      // 获取Canvas尺寸
      const query = this.createSelectorQuery().in(this)
      query.select('.static-waveform-canvas')
        .boundingClientRect()
        .exec((res) => {
          console.log('静态波形Canvas尺寸查询结果:', res)
          
          if (res && res[0]) {
            const { width, height } = res[0]
            console.log('静态波形Canvas尺寸:', { width, height })
            
            this.setData({
              canvasContext: ctx,
              canvasWidth: width,
              canvasHeight: height,
              isInitialized: true
            }, () => {
              console.log('静态波形Canvas初始化完成，生成波形数据')
              this.generateStaticWaveform()
            })
            
            console.log('静态波形Canvas初始化成功')
          } else {
            console.error('无法获取静态波形Canvas尺寸')
          }
        })
    },

    /**
     * 播放状态变化处理
     */
    onPlayingStateChange(isPlaying) {
      console.log('静态波形播放状态变化:', isPlaying)
      this.drawWaveform()
    },

    /**
     * 进度变化处理
     */
    onProgressChange(progress) {
      this.drawWaveform()
    },

    /**
     * 音乐信息变化处理（音乐切换时重新生成波形）
     */
    onMusicInfoChange() {
      if (this.data.isInitialized) {
        console.log('音乐信息变化，重新生成波形:', {
          musicId: this.properties.musicId,
          musicName: this.properties.musicName,
          duration: this.properties.duration
        })
        this.generateStaticWaveform()
      }
    },

    /**
     * 生成静态波形数据（基于音乐特征生成独特波形）
     */
    generateStaticWaveform() {
      const waveformData = []
      const barCount = this.properties.barCount
      const duration = this.properties.duration
      const musicId = this.properties.musicId
      const musicName = this.properties.musicName
      const musicType = this.properties.musicType
      
      console.log('生成静态波形数据:', { musicId, musicName, barCount, duration })
      
      // 基于音乐ID生成随机种子，确保同一首歌总是生成相同的波形
      const seed = this.generateSeed(musicId || musicName || 'default')
      let randomIndex = 0
      
      for (let i = 0; i < barCount; i++) {
        const position = i / barCount
        
        // 使用种子随机数，确保波形稳定
        const random1 = this.seededRandom(seed + randomIndex++)
        const random2 = this.seededRandom(seed + randomIndex++)
        const random3 = this.seededRandom(seed + randomIndex++)
        
        // 主波形：基于音乐特征的基础频率
        const mainFreq = this.getMusicFrequency(musicType)
        const mainWave = Math.sin(position * Math.PI * mainFreq) * 40
        
        // 细节波形：基于音乐名称hash的高频变化  
        const detailFreq = this.getDetailFrequency(musicName)
        const detailWave = Math.sin(position * Math.PI * detailFreq) * 20
        
        // 个性化变化：基于音乐特征的变化
        const personalVariation = (random1 - 0.5) * this.getVariationIntensity(musicType)
        
        // 强度变化：根据音乐类型调整起伏模式
        const intensityFactor = this.getIntensityFactor(position, musicType)
        
        // 节拍特征：某些类型音乐添加节拍感
        const rhythmFactor = this.getRhythmFactor(position, musicType, random2)
        
        let height = 30 + (mainWave + detailWave + personalVariation + rhythmFactor) * intensityFactor
        
        // 根据主题和类型调整波形特征
        height = this.adjustHeightByTheme(height, musicType, random3)
        
        waveformData.push(Math.max(10, Math.min(90, height)))
      }
      
      this.setData({ waveformData }, () => {
        this.drawWaveform()
      })
      
      console.log('静态波形数据生成完成，音乐:', musicName)
    },

    /**
     * 生成基于字符串的数字种子
     */
    generateSeed(str) {
      let hash = 0
      if (str.length === 0) return hash
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // 转为32位整数
      }
      return Math.abs(hash)
    },

    /**
     * 基于种子的伪随机数生成器
     */
    seededRandom(seed) {
      const x = Math.sin(seed) * 10000
      return x - Math.floor(x)
    },

    /**
     * 根据音乐类型获取主频率
     */
    getMusicFrequency(musicType) {
      const typeMap = {
        '白噪音': 6,
        '自然音': 8,
        '脑波音乐': 4,
        'AI音乐': 10,
        '疗愈音乐': 7,
        'healing': 7,
        'energetic': 12,
        'calm': 5
      }
      return typeMap[musicType] || 8
    },

    /**
     * 根据音乐名称获取细节频率
     */
    getDetailFrequency(musicName) {
      if (!musicName) return 32
      const nameHash = this.generateSeed(musicName)
      return 20 + (nameHash % 20) // 20-40之间
    },

    /**
     * 根据音乐类型获取变化强度
     */
    getVariationIntensity(musicType) {
      const intensityMap = {
        '白噪音': 25,
        '自然音': 30,
        '脑波音乐': 15,
        'AI音乐': 35,
        '疗愈音乐': 20,
        'energetic': 40,
        'calm': 15
      }
      return intensityMap[musicType] || 20
    },

    /**
     * 获取节拍因子
     */
    getRhythmFactor(position, musicType, random) {
      const rhythmTypes = ['AI音乐', 'energetic']
      if (!rhythmTypes.includes(musicType)) return 0
      
      // 添加节拍感
      const beatPattern = Math.sin(position * Math.PI * 16) * 15
      return random > 0.7 ? beatPattern : 0
    },

    /**
     * 根据主题调整高度
     */
    adjustHeightByTheme(height, musicType, random) {
      switch (this.properties.theme) {
        case 'energetic':
          height += random > 0.6 ? random * 25 : 0
          break
        case 'calm':
          height = height * 0.7 + 20
          break
        case 'healing':
        default:
          height = height * 0.85 + 15
          break
      }
      
      // 音乐类型微调
      if (musicType === '白噪音') {
        height += (random - 0.5) * 10 // 增加随机性
      } else if (musicType === '脑波音乐') {
        height = height * 0.8 + 25 // 更平缓
      }
      
      return height
    },

    /**
     * 根据位置和音乐类型获取强度因子（模拟音乐的起伏）
     */
    getIntensityFactor(position, musicType) {
      let baseFactor
      
      // 根据音乐类型调整起伏模式
      switch (musicType) {
        case '白噪音':
          // 白噪音相对平稳
          baseFactor = 0.7 + Math.sin(position * Math.PI * 2) * 0.2
          break
        case '脑波音乐':
          // 脑波音乐缓慢变化
          baseFactor = 0.6 + Math.sin(position * Math.PI * 1.5) * 0.3
          break
        case 'AI音乐':
        case 'energetic':
          // AI音乐和活力音乐有明显高潮
          if (position >= 0.2 && position <= 0.8) {
            baseFactor = 0.9 + Math.sin((position - 0.2) * Math.PI * 2) * 0.4
          } else {
            baseFactor = 0.5 + position * 0.4
          }
          break
        default:
          // 默认模式（疗愈音乐等）
          if (position < 0.1) {
            baseFactor = 0.4 + position * 6
          } else if (position >= 0.3 && position <= 0.7) {
            baseFactor = 1.0 + Math.sin((position - 0.3) * Math.PI * 2.5) * 0.3
          } else if (position > 0.85) {
            baseFactor = 1.0 - (position - 0.85) * 3
          } else {
            baseFactor = 0.8 + Math.sin(position * Math.PI * 6) * 0.2
          }
      }
      
      return Math.max(0.2, Math.min(1.2, baseFactor))
    },

    /**
     * 绘制静态波形
     */
    drawWaveform() {
      const { canvasContext, canvasWidth, canvasHeight, waveformData } = this.data
      
      if (!canvasContext || !canvasWidth || !canvasHeight || !waveformData.length) {
        console.log('静态波形绘制条件不满足')
        return
      }

      const ctx = canvasContext
      const width = canvasWidth
      const height = canvasHeight
      const progress = this.properties.progress
      const isPlaying = this.properties.isPlaying
      
      // 清空画布
      ctx.clearRect(0, 0, width, height)
      
      const barWidth = width / waveformData.length
      const maxHeight = height * 0.8
      const progressPosition = (progress / 100) * width
      
      // 根据主题和播放状态设置颜色
      const playedColor = this.getPlayedColor()
      const unplayedColor = this.getUnplayedColor()
      
      // 绘制波形条
      waveformData.forEach((barData, index) => {
        const barHeight = (barData / 100) * maxHeight
        const x = index * barWidth
        const y = height - barHeight
        
        // 根据播放进度决定颜色
        const barCenterX = x + barWidth / 2
        const color = barCenterX <= progressPosition ? playedColor : unplayedColor
        
        ctx.setFillStyle(color)
        ctx.fillRect(x + 1, y, barWidth - 2, barHeight)
      })
      
      // 绘制播放进度线
      if (isPlaying && progress > 0) {
        ctx.setStrokeStyle('#FFFFFF')
        ctx.setLineWidth(2)
        ctx.beginPath()
        ctx.moveTo(progressPosition, 0)
        ctx.lineTo(progressPosition, height)
        ctx.stroke()
      }
      
      // Canvas 1.0需要显式draw
      ctx.draw()
      
      // 只在进度发生较大变化时输出日志（每10%输出一次）
      const progressStep = Math.floor(progress / 10) * 10
      if (!this.data.lastLoggedProgress || this.data.lastLoggedProgress !== progressStep) {
        if (progressStep === 0 || progressStep % 20 === 0) { // 每20%输出一次
          console.log('📊 静态波形绘制，进度:', progressStep + '%')
        }
        this.setData({ lastLoggedProgress: progressStep })
      }
    },

    /**
     * 获取已播放部分的颜色
     */
    getPlayedColor() {
      const isPlaying = this.properties.isPlaying
      
      if (!isPlaying) {
        return '#BDBDBD' // 暂停时的灰色
      }
      
      switch (this.properties.theme) {
        case 'energetic':
          return '#FF6B6B'
        case 'calm':
          return '#A8E6CF'
        case 'healing':
        default:
          return '#5D9E7E'
      }
    },

    /**
     * 获取未播放部分的颜色
     */
    getUnplayedColor() {
      return 'rgba(255, 255, 255, 0.3)' // 半透明白色
    },

    /**
     * 点击波形跳转
     */
    onCanvasTap(e) {
      const { x } = e.detail
      const { canvasWidth } = this.data
      
      if (canvasWidth && x >= 0) {
        const progress = (x / canvasWidth) * 100
        
        this.triggerEvent('seek', {
          progress: Math.max(0, Math.min(100, progress))
        })
        
        console.log('静态波形点击定位:', progress.toFixed(1) + '%')
      }
    }
  }
})
