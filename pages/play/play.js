// pages/play/play.js
const { getGlobalPlayer } = require('../../utils/musicPlayer')

Page({
  data: {
    sound: null,
    isPlaying: false,
    duration: 0,
    currentTime: 0,
    volume: 50,
    timerValue: 0,
    isTimerOn: false,
    globalPlayer: null
  },
  onLoad: function (options) {
    // 模拟获取声音数据
    const soundId = options.id
    this.setData({
      sound: {
        id: soundId,
        name: '海浪音',
        cover: 'path/to/ocean_sound.jpg',
        src: 'path/to/ocean_sound.mp3'
      }
    })
    
    // 使用全局播放器而不是创建新的音频上下文
    const globalPlayer = getGlobalPlayer()
    this.setData({ globalPlayer })
    
    // 绑定事件监听器
    this.bindPlayerEvents()
  },

  // 绑定播放器事件
  bindPlayerEvents() {
    const { globalPlayer } = this.data
    if (globalPlayer) {
      globalPlayer.on('play', () => {
        this.setData({ isPlaying: true })
      })
      
      globalPlayer.on('pause', () => {
        this.setData({ isPlaying: false })
      })
      
      globalPlayer.on('stop', () => {
        this.setData({ isPlaying: false })
      })
      
      globalPlayer.on('timeUpdate', (data) => {
        this.setData({
          duration: data.duration,
          currentTime: data.currentTime
        })
      })
    }
  },

  togglePlay: function () {
    const { globalPlayer, sound } = this.data
    if (!globalPlayer) return
    
    if (this.data.isPlaying) {
      globalPlayer.pause()
    } else {
      // 构建音乐数据
      const musicData = {
        id: sound.id,
        title: sound.name,
        src: sound.src,
        type: 'healing_sound'
      }
      globalPlayer.play(musicData)
    }
  },
  
  onTimeUpdate: function () {
    const { globalPlayer } = this.data
    if (globalPlayer) {
      this.setData({
        duration: globalPlayer.duration,
        currentTime: globalPlayer.currentTime
      })
    }
  },
  
  setVolume: function (e) {
    const volume = e.detail.value
    const { globalPlayer } = this.data
    if (globalPlayer) {
      globalPlayer.setVolume(volume / 100)
    }
    this.setData({ volume: volume })
  },
  startTimer: function (e) {
    const minutes = parseInt(e.detail.value)
    this.setData({
      timerValue: minutes,
      isTimerOn: true
    })
  },
  stopTimer: function () {
    this.setData({
      timerValue: 0,
      isTimerOn: false
    })
  },
  onUnload: function () {
    this.audioCtx.destroy()
  },
  // 格式化时间显示
  formatTime: function(seconds) {
    if (isNaN(seconds) || seconds < 0) {
      return '00:00';
    }
    
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    
    return `${min < 10 ? '0' + min : min}:${sec < 10 ? '0' + sec : sec}`;
  },
  // 设置定时器
  setTimer: function(e) {
    const time = parseInt(e.currentTarget.dataset.time);
    this.setData({
      timerValue: time,
      isTimerOn: true
    });
    // 启动定时器逻辑
    this.startTimerCountdown(time);
  },
  // 启动定时器倒计时
  startTimerCountdown: function(minutes) {
    // 清除之前的定时器
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    // 设置倒计时
    let remainingMinutes = minutes;
    this.timerInterval = setInterval(() => {
      remainingMinutes--;
      if (remainingMinutes <= 0) {
        // 时间到，停止播放
        this.stopPlay();
        this.stopTimer();
      } else {
        this.setData({
          timerValue: remainingMinutes
        });
      }
    }, 60000); // 每分钟更新一次
  },
  // 跳转到指定位置
  seek: function(e) {
    const position = e.detail.value;
    // 实现音频跳转逻辑
    // 例如: this.audioContext.seek(position);
    this.setData({
      currentTime: position
    });
  }
})
