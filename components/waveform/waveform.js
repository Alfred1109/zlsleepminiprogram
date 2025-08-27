// components/waveform/waveform.js
// 音乐波形图组件

Component({
  properties: {
    // 播放进度 (0-100)
    progress: {
      type: Number,
      value: 0
    },
    
    // 是否正在播放
    isPlaying: {
      type: Boolean,
      value: false
    },
    
    // 音乐类型 (用于不同的波形样式)
    musicType: {
      type: String,
      value: 'healing', // healing, relaxing, energetic, meditative
      // 确保值的有效性
      observer: function(newVal) {
        if (!newVal || typeof newVal !== 'string') {
          this.setData({
            musicType: 'healing'
          })
        }
      }
    },
    
    // 波形数据 (可选，如果不提供则生成随机波形)
    customWaveform: {
      type: Array,
      value: []
    }
  },

  data: {
    waveformData: []
  },

  lifetimes: {
    attached() {
      this.generateWaveform()
    }
  },

  observers: {
    'customWaveform': function(newVal) {
      if (newVal && newVal.length > 0) {
        this.setData({
          waveformData: newVal
        })
      } else {
        this.generateWaveform()
      }
    },
    
    'musicType': function(newVal) {
      // 根据音乐类型调整波形特征
      this.generateWaveform()
    }
  },

  methods: {
    /**
     * 生成波形数据
     */
    generateWaveform() {
      const { musicType } = this.properties
      const barCount = 60 // 波形条数
      const waveformData = []
      
      // 确保musicType是有效的字符串
      const safeType = musicType || 'healing'
      
      for (let i = 0; i < barCount; i++) {
        let height
        
        // 根据音乐类型生成不同特征的波形
        switch (safeType) {
          case 'relaxing':
            // 放松音乐：波形较平缓
            height = this.generateRelaxingWave(i, barCount)
            break
            
          case 'energetic':
            // 活力音乐：波形变化较大
            height = this.generateEnergeticWave(i, barCount)
            break
            
          case 'meditative':
            // 冥想音乐：波形规律性强
            height = this.generateMeditativeWave(i, barCount)
            break
            
          case 'healing':
          default:
            // 疗愈音乐：波形温和有节奏
            height = this.generateHealingWave(i, barCount)
            break
        }
        
        waveformData.push(Math.max(15, Math.min(100, height)))
      }
      
      this.setData({
        waveformData
      })
    },

    /**
     * 生成放松音乐波形
     */
    generateRelaxingWave(index, total) {
      const base = 30 + Math.sin(index * 0.1) * 15
      const noise = (Math.random() - 0.5) * 10
      return base + noise
    },

    /**
     * 生成活力音乐波形
     */
    generateEnergeticWave(index, total) {
      const base = 50 + Math.sin(index * 0.2) * 25
      const spike = Math.random() > 0.8 ? Math.random() * 30 : 0
      const noise = (Math.random() - 0.5) * 15
      return base + spike + noise
    },

    /**
     * 生成冥想音乐波形
     */
    generateMeditativeWave(index, total) {
      const base = 40
      const wave1 = Math.sin(index * 0.15) * 20
      const wave2 = Math.sin(index * 0.05) * 10
      return base + wave1 + wave2
    },

    /**
     * 生成疗愈音乐波形
     */
    generateHealingWave(index, total) {
      const base = 35 + Math.sin(index * 0.12) * 20
      const harmonics = Math.sin(index * 0.3) * 8 + Math.sin(index * 0.08) * 12
      const noise = (Math.random() - 0.5) * 8
      return base + harmonics + noise
    },

    /**
     * 点击波形跳转到指定位置
     */
    onWaveformTap(e) {
      const { currentTarget } = e
      const { offsetX } = e.detail
      const { width } = currentTarget.getBoundingClientRect()
      
      if (width > 0) {
        const progress = (offsetX / width) * 100
        
        // 触发自定义事件，通知父组件
        this.triggerEvent('seek', {
          progress: Math.max(0, Math.min(100, progress))
        })
      }
    },

    /**
     * 更新波形样式类
     */
    getWaveformClass() {
      const { musicType } = this.properties
      return `waveform-container ${musicType}`
    }
  }
})
