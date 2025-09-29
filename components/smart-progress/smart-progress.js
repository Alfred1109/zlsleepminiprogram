// 🚀 智能进度显示组件 - 异步优化版本
Component({
  properties: {
    // 是否显示进度条
    visible: {
      type: Boolean,
      value: false
    },
    // 当前进度 (0-100)
    progress: {
      type: Number,
      value: 0
    },
    // 当前阶段文本
    phase: {
      type: String,
      value: '准备中...'
    },
    // 进度条类型：'line' | 'circle' | 'steps'
    type: {
      type: String,
      value: 'line'
    },
    // 主题色
    color: {
      type: String,
      value: '#4F98F7'
    },
    // 是否显示百分比
    showPercent: {
      type: Boolean,
      value: true
    },
    // 是否显示动画
    animate: {
      type: Boolean,
      value: true
    },
    // 总步骤数（用于steps类型）
    totalSteps: {
      type: Number,
      value: 5
    }
  },

  data: {
    // 内部进度值，用于动画
    internalProgress: 0,
    // 动画定时器
    animationTimer: null,
    // 阶段步骤映射
    phaseSteps: [
      { name: '初始化项目', range: [0, 15] },
      { name: '分析评测数据', range: [15, 35] },
      { name: '设计ISO阶段', range: [35, 55] },
      { name: '生成音频内容', range: [55, 85] },
      { name: '合成最终文件', range: [85, 100] }
    ],
    currentStepIndex: 0
  },

  observers: {
    'progress': function(newProgress) {
      this.updateProgress(newProgress)
    },
    'visible': function(visible) {
      if (visible) {
        this.startProgressAnimation()
      } else {
        this.stopProgressAnimation()
      }
    }
  },

  lifetimes: {
    attached() {
      console.log('🚀 智能进度组件已附加')
    },
    
    detached() {
      this.stopProgressAnimation()
    }
  },

  methods: {
    /**
     * 🚀 更新进度值 - 带平滑动画
     */
    updateProgress(targetProgress) {
      if (!this.data.animate) {
        this.setData({ 
          internalProgress: targetProgress,
          currentStepIndex: this.getCurrentStepIndex(targetProgress)
        })
        return
      }

      // 平滑动画更新
      const currentProgress = this.data.internalProgress
      const diff = targetProgress - currentProgress
      
      if (Math.abs(diff) < 0.1) return // 差异太小，不需要动画

      const duration = Math.min(Math.abs(diff) * 20, 1000) // 最长1秒动画
      const steps = Math.max(Math.floor(duration / 50), 5) // 最少5步
      const stepSize = diff / steps
      
      let currentStep = 0
      
      const animate = () => {
        if (currentStep >= steps) {
          this.setData({ 
            internalProgress: targetProgress,
            currentStepIndex: this.getCurrentStepIndex(targetProgress)
          })
          return
        }
        
        const newProgress = currentProgress + (stepSize * currentStep)
        this.setData({ 
          internalProgress: Math.max(0, Math.min(100, newProgress)),
          currentStepIndex: this.getCurrentStepIndex(newProgress)
        })
        
        currentStep++
        setTimeout(animate, 50)
      }
      
      animate()
    },

    /**
     * 🚀 获取当前步骤索引
     */
    getCurrentStepIndex(progress) {
      for (let i = 0; i < this.data.phaseSteps.length; i++) {
        const [min, max] = this.data.phaseSteps[i].range
        if (progress >= min && progress <= max) {
          return i
        }
      }
      return this.data.phaseSteps.length - 1
    },

    /**
     * 🚀 启动进度动画效果
     */
    startProgressAnimation() {
      if (this.data.animationTimer) return
      
      // 添加微妙的呼吸效果
      let opacity = 1
      let direction = -1
      
      const breatheAnimation = () => {
        opacity += direction * 0.02
        if (opacity <= 0.7) direction = 1
        if (opacity >= 1) direction = -1
        
        this.setData({ progressOpacity: opacity })
      }
      
      this.setData({
        animationTimer: setInterval(breatheAnimation, 100)
      })
    },

    /**
     * 🚀 停止进度动画
     */
    stopProgressAnimation() {
      if (this.data.animationTimer) {
        clearInterval(this.data.animationTimer)
        this.setData({ animationTimer: null })
      }
    },

    /**
     * 🚀 重置进度
     */
    reset() {
      this.setData({
        internalProgress: 0,
        currentStepIndex: 0
      })
    },

    /**
     * 🚀 格式化进度百分比
     */
    formatPercent(progress) {
      return Math.round(progress) + '%'
    },

    /**
     * 🚀 获取当前步骤信息
     */
    getCurrentStepInfo() {
      const index = this.data.currentStepIndex
      if (index >= 0 && index < this.data.phaseSteps.length) {
        return this.data.phaseSteps[index]
      }
      return { name: '处理中...', range: [0, 100] }
    },

    /**
     * 🚀 计算进度条宽度
     */
    getProgressWidth(progress) {
      return Math.max(0, Math.min(100, progress)) + '%'
    },

    /**
     * 🚀 获取进度条颜色
     */
    getProgressColor(progress) {
      if (progress < 25) return '#FF6B6B' // 红色：起始阶段
      if (progress < 50) return '#FFB347' // 橙色：处理阶段
      if (progress < 75) return '#4F98F7' // 蓝色：生成阶段
      return '#50C878' // 绿色：完成阶段
    },

    /**
     * 🚀 触发进度变化事件
     */
    onProgressChange(e) {
      this.triggerEvent('progresschange', {
        progress: this.data.internalProgress,
        phase: this.data.phase,
        stepIndex: this.data.currentStepIndex
      })
    },

    /**
     * 🚀 手动设置进度（用于外部调用）
     */
    setProgress(progress, phase) {
      this.setData({
        progress: progress,
        phase: phase || this.data.phase
      })
      this.updateProgress(progress)
    }
  }
})
