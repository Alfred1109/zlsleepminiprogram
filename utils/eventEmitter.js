// utils/eventEmitter.js
// 轻量级事件总线，兼容微信小程序环境

class EventEmitter {
  constructor() {
    this.events = {}
  }

  on(event, listener) {
    if (!this.events[event]) this.events[event] = []
    this.events[event].push(listener)
  }

  off(event, listener) {
    if (!this.events[event]) return
    this.events[event] = this.events[event].filter(l => l !== listener)
  }

  emit(event, payload) {
    if (!this.events[event]) return
    this.events[event].forEach(fn => {
      try {
        fn(payload)
      } catch (e) {
        console.error('EventEmitter listener error', e)
      }
    })
  }
}

// 单例导出
module.exports = new EventEmitter()
