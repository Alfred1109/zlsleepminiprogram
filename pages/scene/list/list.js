// pages/scene/list/list.js
Page({
  data: {
    scenes: []
  },

  onLoad: function(options) {
    this.initScenes()
  },

  /**
   * 初始化场景数据
   */
  initScenes: function() {
    const scenes = [
      { 
        id: 1, 
        name: '睡眠场景', 
        icon: '😴',
        description: '改善睡眠质量，获得深度休息',
        scaleType: 'PSQI',
        sceneName: '睡眠疗愈'
      },
      { 
        id: 2, 
        name: '专注场景', 
        icon: '🎯',
        description: '提升注意力，增强工作效率',
        scaleType: null,
        sceneName: '专注疗愈'
      },
      { 
        id: 3, 
        name: '抑郁场景', 
        icon: '🌈',
        description: '缓解抑郁情绪，重拾生活希望',
        scaleType: 'HAMD-17',
        sceneName: '抑郁疗愈'
      },
      { 
        id: 4, 
        name: '焦虑场景', 
        icon: '🕊️',
        description: '缓解焦虑紧张，获得内心平静',
        scaleType: 'GAD-7',
        sceneName: '焦虑疗愈'
      }
    ]

    this.setData({
      scenes: scenes
    })
  },

  /**
   * 场景点击事件
   */
  onSceneTap: function(e) {
    const { id, name, scaleType, sceneName } = e.currentTarget.dataset
    
    console.log('点击场景:', { id, name, scaleType, sceneName })
    
    // 跳转到场景详情页面
    wx.navigateTo({
      url: `/pages/scene/detail/detail?sceneId=${id}&sceneName=${encodeURIComponent(name)}&scaleType=${scaleType || ''}&sceneTheme=${encodeURIComponent(sceneName)}`
    })
  }
})
