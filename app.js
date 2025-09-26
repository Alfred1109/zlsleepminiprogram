// app.js
// 导入蓝牙管理器
const { getBluetoothManager } = require('./utils/bluetoothManager');
const brainwaveGenerator = require('./utils/brainwaveGenerator');
// const networkDiagnostic = require('./utils/networkDiagnostic'); // 已移除网络诊断模块

const AuthService = require('./services/AuthService');
const bus = require('./utils/eventEmitter');

App({
  onLaunch: async function (options) {
    console.log('小程序启动参数:', options)
    
    // 处理二维码跳转场景
    if (options.query && options.query.scene) {
      this.handleProductQR(options.query.scene);
    }
    this.handleSceneNavigation(options)

    // 注入全局拦截：定位/屏蔽包含 total_fee/totol_fee/支付JSAPI/缺少参数 的用户可见提示
    try {
      const keywords = ['total_fee', 'totol_fee', '支付jsapi', '缺少参数']
      if (typeof wx !== 'undefined') {
        // 拦截 showToast
        if (typeof wx.showToast === 'function' && !wx.__patchedShowToast) {
          const __origShowToast = wx.showToast
          wx.showToast = function(opts = {}) {
            try {
              const title = (opts && opts.title) ? String(opts.title).toLowerCase() : ''
              if (keywords.some(k => title.includes(k))) {
                console.warn('🚧 捕获到包含敏感关键词的 showToast，屏蔽用户可见文本。原始参数:', opts)
                console.warn(new Error('showToast 调用堆栈（用于定位来源）').stack)
                // 统一替换为友好提示
                const patched = { ...opts, title: '支付参数异常，请稍后重试或联系客服', icon: opts.icon || 'none' }
                return __origShowToast.call(wx, patched)
              }
            } catch (_) {}
            return __origShowToast.call(wx, opts)
          }
          wx.__patchedShowToast = true
        }
        // 拦截 showModal
        if (typeof wx.showModal === 'function' && !wx.__patchedShowModal) {
          const __origShowModal = wx.showModal
          wx.showModal = function(opts = {}) {
            try {
              const content = (opts && opts.content) ? String(opts.content).toLowerCase() : ''
              const title = (opts && opts.title) ? String(opts.title).toLowerCase() : ''
              if (keywords.some(k => content.includes(k) || title.includes(k))) {
                console.warn('🚧 捕获到包含敏感关键词的 showModal，屏蔽用户可见文本。原始参数:', opts)
                console.warn(new Error('showModal 调用堆栈（用于定位来源）').stack)
                const patched = {
                  ...opts,
                  title: '支付服务提示',
                  content: '支付参数异常，请稍后重试或联系客服',
                  icon: undefined
                }
                return __origShowModal.call(wx, patched)
              }
            } catch (_) {}
            return __origShowModal.call(wx, opts)
          }
          wx.__patchedShowModal = true
        }
      }
    } catch (e) {
      console.warn('全局提示拦截注入失败（非致命）:', e)
    }

    // 初始化全局主题（优先读取用户偏好）
    try {
      const savedTheme = wx.getStorageSync('user_preferred_theme') || 'default'
      this.globalData.currentTheme = savedTheme
      // 兜底：当无详细themeConfig时，至少提供class
      this.globalData.themeConfig = this.globalData.themeConfig || { class: (savedTheme === 'default' ? '' : savedTheme) }
    } catch (e) {
      console.warn('加载用户偏好主题失败:', e)
    }

    // 真机调试时先完成IP检测，再设置API配置
    await this.initDevelopmentIP()

    // 动态设置API基础URL（此时IP检测已完成）
    try {
      const { getApiBaseUrl } = require('./utils/config')
      this.globalData.apiBaseUrl = getApiBaseUrl()
    } catch (e) {
      console.warn('API配置设置失败:', e)
      this.globalData.apiBaseUrl = 'https://medsleep.cn' // 兜底配置
    }

    // 强制刷新API配置（确保真机环境使用正确的IP地址）
    try {
      const { refreshApiConfig } = require('./utils/api')
      refreshApiConfig()
    } catch (e) {
      console.warn('API配置刷新失败:', e)
    }

    // 异步初始化设置管理器（不阻塞启动）
    const { settingsManager } = require('./utils/settingsManager')
    this.globalData.settingsManager = settingsManager
    settingsManager.init().then(() => {
      console.log('设置管理器初始化完成')
    }).catch(e => {
      console.warn('设置管理器初始化失败:', e)
    })

    // 初始化认证系统
    this.globalData.bus = bus
    this.initAuth()
    


    // 初始化蓝牙管理器
    this.globalData.bluetoothManager = getBluetoothManager();

    // 检查是否有缓存的已连接设备
    const cachedDevice = wx.getStorageSync('connectedDevice');
    if (cachedDevice && cachedDevice.deviceId && new Date().getTime() - cachedDevice.timestamp < 24 * 60 * 60 * 1000) {
      // 如果有缓存的设备并且缓存时间少于24小时，将其设置为已连接设备
      this.globalData.connectedDevice = cachedDevice;

      // 尝试自动重连
      setTimeout(() => {
        this.tryReconnect(cachedDevice);
      }, 1000);
    }

    // 监听小程序切前台事件
    wx.onAppShow(() => {
      // 如果有已连接设备但连接状态为未连接，尝试重连
      if (this.globalData.connectedDevice && !this.globalData.bluetoothManager.isConnected) {
        this.tryReconnect(this.globalData.connectedDevice);
      }
    });
    
    // 初始化脑电波生成器
    this.globalData.brainwaveGenerator = brainwaveGenerator;
    
    // 初始化全局音频管理
    this.initGlobalAudio();
    
    // 初始化全局播放器
    this.initGlobalMusicPlayer();

    // 网络诊断功能已移除，应用启动更快更简洁
  },

  /**
   * 小程序从后台进入前台时触发
   */
  onShow: function (options) {
    console.log('小程序前台显示参数:', options)
    
    // 处理二维码跳转场景（从后台重新打开时）
    if (options.scene === 1047 && options.query && options.query.scene) {
      this.handleProductQR(options.query.scene);
    }
    this.handleSceneNavigation(options)
  },

  /**
   * 处理商品二维码场景
   */
  handleProductQR: function(scene) {
    console.log('🛍️ 处理商品二维码:', scene);

    wx.request({
      url: 'https://medsleep.cn/api/qr/resolve',
      method: 'POST',
      data: { scene: scene },
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        if (res.data.success) {
          const data = res.data.data;
          
          // 保存销售员信息
          wx.setStorageSync('seller_info', data.seller);
          
          // 直接跳转到商品详情页
          wx.navigateTo({
            url: `/pages/product/detail/detail?id=${data.productId}&from=qr&seller=${data.seller.id}`
          });
        } else {
          console.error('解析失败:', res.data.error);
          wx.switchTab({ url: '/pages/index/index' });
        }
      }
    });
  },

  /**
   * 处理二维码扫描跳转场景
   */
  handleSceneNavigation: function (options) {
    console.log('处理场景导航:', options)
    
    // 检查是否有场景值（二维码扫描进入）
    if (options && options.scene) {
      console.log('检测到二维码场景值:', options.scene)
      
      // 延迟处理，确保小程序完全启动
      setTimeout(() => {
        this.processQRCodeScene(options.scene, options.query || {})
      }, 1000)
    }
    
    // 检查是否有query参数（其他方式进入）
    if (options && options.query) {
      console.log('检测到query参数:', options.query)
      
      // 如果query中直接包含productId，立即跳转
      if (options.query.productId) {
        setTimeout(() => {
          this.navigateToProduct(options.query.productId, options.query)
        }, 1000)
      }
    }
  },

  /**
   * 处理二维码场景值
   */
  processQRCodeScene: function (scene, query) {
    console.log('解析二维码场景值:', scene, query)
    
    try {
      // 如果scene是数字，不应该直接当作商品ID，因为API的商品ID是PHYSICAL_XXX格式
      if (/^\d+$/.test(scene)) {
        console.log('场景值为纯数字，但API商品ID不是数字格式，跳过直接处理:', scene)
        // 不直接处理，继续后续的解析逻辑
      }
      
      // 如果scene包含特定格式，解析商品ID
      // 例如：QR20250926145233C4CA423866FE2B75 这种格式
      if (scene && scene.length > 0) {
        // 尝试从scene中提取商品ID
        // 这里需要根据您后端生成二维码的规则来解析
        
        // 方案1: 尝试匹配PHYSICAL_XXX格式的商品ID
        const physicalMatches = scene.match(/(PHYSICAL_\d+)/i)
        if (physicalMatches && physicalMatches[1]) {
          console.log('从场景值中提取到商品ID:', physicalMatches[1])
          this.navigateToProduct(physicalMatches[1], query)
          return
        }
        
        // 方案2: 如果scene末尾包含数字，尝试映射到PHYSICAL_XXX格式
        const numberMatches = scene.match(/(\d+)$/)
        if (numberMatches && numberMatches[1]) {
          const numericId = numberMatches[1]
          // 将数字ID映射到PHYSICAL格式 (例如: 001 -> PHYSICAL_001)
          const mappedId = `PHYSICAL_${numericId.padStart(3, '0')}`
          console.log('从场景值末尾提取到数字ID，映射为:', numericId, '->', mappedId)
          this.navigateToProduct(mappedId, query)
          return
        }
        
        // 方案2: 如果需要调用后端API解析scene
        this.resolveSceneFromServer(scene, query)
      }
    } catch (error) {
      console.error('解析二维码场景值失败:', error)
      // 解析失败时跳转到首页
      wx.reLaunch({
        url: '/pages/index/index'
      })
    }
  },

  /**
   * 从服务器解析场景值
   */
  resolveSceneFromServer: function (scene, query) {
    console.log('调用服务器解析场景值:', scene)
    
    // 调用后端API解析scene获取商品ID
    wx.request({
      url: `${this.globalData.apiBaseUrl}/api/qr/resolve`,
      method: 'POST',
      data: {
        scene: scene
      },
      header: {
        'Content-Type': 'application/json'
      },
      success: (res) => {
        console.log('服务器解析场景值结果:', res.data)
        
        if (res.data && res.data.success && res.data.data) {
          const { productId, type } = res.data.data
          
          if (type === 'product' && productId) {
            this.navigateToProduct(productId, query)
          } else {
            // 其他类型的跳转处理
            console.log('场景值解析为其他类型:', type)
            wx.reLaunch({
              url: '/pages/index/index'
            })
          }
        } else {
          console.warn('服务器解析场景值失败:', res.data)
          wx.reLaunch({
            url: '/pages/index/index'
          })
        }
      },
      fail: (error) => {
        console.error('调用服务器解析场景值失败:', error)
        wx.reLaunch({
          url: '/pages/index/index'
        })
      }
    })
  },

  /**
   * 跳转到商品详情页
   */
  navigateToProduct: function (productId, extraParams = {}) {
    console.log('跳转到商品详情页:', productId, extraParams)
    
    if (!productId) {
      console.error('商品ID无效')
      return
    }
    
    // 构建跳转URL
    const params = [`id=${productId}`]
    
    // 添加额外的追踪参数
    if (extraParams.source) {
      params.push(`source=${extraParams.source}`)
    } else {
      params.push('source=qrcode')
    }
    
    if (extraParams.referrer) {
      params.push(`referrer=${extraParams.referrer}`)
    }
    
    const url = `/pages/product/detail/detail?${params.join('&')}`
    console.log('构建的跳转URL:', url)
    
    // 执行跳转
    wx.reLaunch({
      url: url,
      success: () => {
        console.log('跳转商品详情页成功')
      },
      fail: (error) => {
        console.error('跳转商品详情页失败:', error)
        // 跳转失败时回到首页
        wx.reLaunch({
          url: '/pages/index/index'
        })
      }
    })
  },
  
  /**
   * 初始化全局音频管理
   */
  initGlobalAudio: function() {
    // 设置全局音频错误处理
    this.globalData.audioErrorCount = 0;

    // 不再预加载测试音频，避免解码错误
    // 音频系统将在实际使用时初始化
    console.log('全局音频管理初始化完成');
    
    // 设置全局音频错误处理函数
    this.globalData.handleAudioError = (err) => {
      console.error('全局音频错误处理:', err);

      // 增加错误计数
      this.globalData.audioErrorCount++;

      // 分析错误类型
      let errorType = 'unknown';
      let errorMessage = '音频播放失败';

      if (err && err.errMsg) {
        const errMsg = err.errMsg.toLowerCase();
        if (errMsg.includes('decode') || errMsg.includes('unable to decode')) {
          errorType = 'decode';
          errorMessage = '音频格式不支持或文件损坏';
        } else if (errMsg.includes('network') || errMsg.includes('timeout')) {
          errorType = 'network';
          errorMessage = '网络连接失败，请检查网络';
        } else if (errMsg.includes('permission')) {
          errorType = 'permission';
          errorMessage = '音频权限被拒绝';
        } else if (errMsg.includes('not found') || errMsg.includes('404')) {
          errorType = 'notfound';
          errorMessage = '音频文件不存在';
        }
      }

      // 记录错误类型
      console.log(`音频错误类型: ${errorType}, 错误次数: ${this.globalData.audioErrorCount}`);

      // 如果错误次数过多，显示详细提示
      if (this.globalData.audioErrorCount > 3) {
        wx.showModal({
          title: '音频播放问题',
          content: `${errorMessage}。建议尝试其他音频文件或检查网络连接。`,
          confirmText: '知道了',
          showCancel: false
        });

        // 重置计数器
        this.globalData.audioErrorCount = 0;
      }

      return err;
    };
  },

  /**
   * 初始化全局音乐播放器
   */
  initGlobalMusicPlayer: function() {
    try {
      const { getGlobalPlayer } = require('./utils/musicPlayer');
      const globalPlayer = getGlobalPlayer();
      
      // 将全局播放器实例保存到全局数据中
      this.globalData.globalMusicPlayer = globalPlayer;
      
      console.log('全局音乐播放器初始化完成');
      
      // 设置全局播放器状态更新回调
      globalPlayer.on('play', () => {
        console.log('全局播放器状态: 播放中');
      });
      
      globalPlayer.on('pause', () => {
        console.log('全局播放器状态: 已暂停');
      });
      
      globalPlayer.on('stop', () => {
        console.log('全局播放器状态: 已停止');
      });
      
    } catch (error) {
      console.error('全局音乐播放器初始化失败:', error);
    }
  },
  
  /**
   * 尝试重新连接设备
   * @param {Object} device 设备信息
   */
  tryReconnect: function(device) {
    if (!device || !device.deviceId) {
      return;
    }
    
    console.log('尝试重新连接设备:', device.name);
    
    this.globalData.bluetoothManager.connectDevice(
      device.deviceId,
      // 连接成功回调
      (res) => {
        console.log('设备重连成功:', res);
        wx.showToast({
          title: '设备已连接',
          icon: 'success',
          duration: 2000
        });
      },
      // 断开连接回调
      (err) => {
        console.log('设备连接断开:', err);
      }
    ).catch(err => {
      console.log('设备重连失败:', err);
    });
  },
  
  /**
   * 创建增强的音频上下文
   * 包含错误处理和自动重试机制
   * @param {Object} options - 配置选项
   * @returns {Object} - 增强的音频上下文
   */
  createEnhancedAudio: function(options = {}) {
    const audioContext = wx.createInnerAudioContext();
    const self = this;
    
    // 设置基本属性
    if (options.src) {
      audioContext.src = options.src;
    }
    
    if (options.loop !== undefined) {
      audioContext.loop = options.loop;
    }
    
    if (options.volume !== undefined) {
      audioContext.volume = options.volume;
    }
    
    // 增强错误处理
    audioContext.onError((err) => {
      // 调用全局错误处理
      self.globalData.handleAudioError(err);
      
      // 调用自定义错误处理
      if (options.onError) {
        options.onError(err);
      }
    });
    
    // 添加其他事件监听
    if (options.onPlay) {
      audioContext.onPlay(options.onPlay);
    }
    
    if (options.onEnded) {
      audioContext.onEnded(options.onEnded);
    }
    
    if (options.onPause) {
      audioContext.onPause(options.onPause);
    }
    
    if (options.onStop) {
      audioContext.onStop(options.onStop);
    }
    
    return audioContext;
  },

  /**
   * 初始化认证系统
   */
  async initAuth() {
    try {
      await AuthService.ensureValidToken().catch(() => null)
      const currentUser = AuthService.getCurrentUser()
      if (currentUser) {
        this.globalData.isLoggedIn = true
        this.globalData.userInfo = currentUser
        console.log('用户已登录:', currentUser.username || currentUser.id)
      } else {
        console.log('未获取到用户信息，处于游客或未登录状态')
      }

      // 监听登录状态变更
      bus.on('auth:changed', ({ status }) => {
        console.log('auth 状态变更:', status)
        if (status === 'logged_out') {
          this.globalData.isLoggedIn = false
          this.globalData.userInfo = null
          wx.reLaunch({ url: '/pages/login/login' })
        } else if (status === 'logged_in') {
          this.globalData.isLoggedIn = true
          this.globalData.userInfo = AuthService.getCurrentUser()
        }
      })
    } catch (error) {
      console.error('认证系统初始化失败:', error)
    }
  },

  /**
   * 检查页面访问权限
   */
  checkPageAccess(pagePath) {
    const AuthService = require('./services/AuthService')
    return !!AuthService.getCurrentUser()
  },

  /**
   * 获取当前用户信息
   */
  getCurrentUser() {
    const AuthService = require('./services/AuthService')
    return AuthService.getCurrentUser()
  },

  /**
   * 强制用户登录
   */
  forceLogin(redirectUrl) {
    const AuthService = require('./services/AuthService')
    AuthService.logout().then(() => {
      const loginUrl = redirectUrl ? 
        `/pages/login/login?redirect=${encodeURIComponent(redirectUrl)}` : 
        '/pages/login/login'
      wx.reLaunch({ url: loginUrl })
    })
  },

  globalData: {
    userInfo: null,
    isLoggedIn: false, // 登录状态
    bluetoothManager: null, // 蓝牙管理器实例
    connectedDevice: null, // 当前连接的设备
    brainwaveGenerator: null, // 脑电波生成器
    audioErrorCount: 0, // 音频错误计数
    handleAudioError: null, // 全局音频错误处理函数
    autoConnectSpecialDevice: true, // 是否自动连接特殊设备（如BT-Music）

    // 全局主题系统
    currentTheme: 'default',
    themeConfig: {
      name: '🌸 默认主题',
      desc: '温暖平衡的疗愈配色',
      class: '',
      colors: {
        primary: '#C0A9BD',
        brand: '#FF6B35',
        healing: '#7DD3C0'
      }
    },

    // AI疗愈系统相关
    apiBaseUrl: '', // 动态配置，在initDevelopmentIP中设置
    isLoggedIn: false, // 登录状态
    currentAssessment: null, // 当前评测信息
    currentMusic: null, // 当前播放的音乐
    longSequenceSession: null, // 长序列会话

    // 音乐播放器状态（保留以兼容性，但实际使用globalMusicPlayer）
    musicPlayer: {
      isPlaying: false,
      currentMusic: null,
      currentTime: 0,
      duration: 0,
      audioContext: null
    },
    
    // 全局音乐播放器实例
    globalMusicPlayer: null,

    appSettings: {
      theme: 'light', // 主题设置
      volume: 0.7, // 音量
      autoSleep: 30, // 自动休眠时间（分钟）
      vibrationEnabled: true, // 震动开关
      notificationEnabled: true // 通知开关
    },

    // 新增：主题切换系统
    currentTheme: 'default',
    themeConfig: null,
    themeListeners: [],
    
    // 全局主题广播方法
    broadcastThemeChange: function(theme, config) {
      console.log('🎨 广播主题变更:', theme)
      
      // 更新所有已打开的页面
      const pages = getCurrentPages()
      pages.forEach(page => {
        if (page && page.setData && page.data) {
          const hasThemeFields = page.data.hasOwnProperty('currentTheme') || 
                                page.data.hasOwnProperty('themeClass') ||
                                page.data.hasOwnProperty('themeConfig')
          
          if (hasThemeFields) {
            page.setData({
              currentTheme: theme,
              themeClass: config?.class || '',
              themeConfig: config
            })
            console.log('✅ 已更新页面主题:', page.route || 'unknown')
          }
        }
      })
      
      // 通过事件总线通知
      if (typeof wx !== 'undefined') {
        wx.$emitter = wx.$emitter || {
          listeners: {},
          on(event, callback) {
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(callback);
          },
          emit(event, data) {
            if (this.listeners[event]) {
              this.listeners[event].forEach(callback => {
                try { callback(data); } catch (e) { console.error('主题事件错误:', e); }
              });
            }
          }
        }
        
        wx.$emitter.emit('themeChanged', { theme, config })
      }
    }
  },

  /**
   * 初始化统一登录管理器
   */
  initUnifiedLoginManager: function() {
    try {
      // 检查当前登录状态
      const isLoggedIn = AuthService.isLoggedIn()
      const currentUser = AuthService.getCurrentUser()
      
      // 更新全局状态
      this.globalData.isLoggedIn = isLoggedIn
      this.globalData.userInfo = currentUser
      
      // 使用 AuthService 的事件监听替代
      const AuthService = require('./services/AuthService')
      AuthService.on('auth:changed', (user) => {
        this.globalData.isLoggedIn = !!user
        this.globalData.userInfo = user
        console.log('全局登录状态更新:', user ? user.username : '未登录')
      })
      
      console.log('统一登录管理器初始化完成')
      console.log('当前登录状态:', isLoggedIn)
      if (currentUser) {
        console.log('当前用户:', currentUser.username)
      }
      
    } catch (error) {
      console.error('统一登录管理器初始化失败:', error)
    }
  },

  /**
   * 获取认证服务实例
   */
  getAuthService: function() {
    return require('./services/AuthService')
  },

  /**
   * 网络诊断功能已移除
   * 改用API调用时的优雅降级处理，提升用户体验
   */

  /**
   * 初始化开发环境IP检测（真机调试专用）
   */
  initDevelopmentIP: async function() {
    try {
      // 检查是否为调试环境
      const accountInfo = wx.getAccountInfoSync()
      const isDebug = accountInfo.miniProgram.envVersion !== 'release'
      
      if (!isDebug) {
        console.log('生产环境，跳过IP检测')
        return
      }

      // 检查是否启用IP自动检测
      const { getCurrentConfig } = require('./utils/config')
      const config = getCurrentConfig()
      
      if (!config.ENABLE_IP_DETECTION) {
        console.log('IP自动检测已禁用，强制清理所有IP缓存')
        // 强制清理所有IP相关缓存
        this.forceCleanIPCache()
        return
      }

      console.log('检测到调试环境，启动IP自动检测...')
      
      // 清理可能的错误IP缓存
      this.clearInvalidIPCache()
      
      // 同步检测IP，确保在API配置前完成
      const ipDetector = require('./utils/ipDetector')
      try {
        const detectedIP = await ipDetector.detectDevelopmentIP()
        if (detectedIP) {
          console.log('✅ 自动检测到开发机IP:', detectedIP)
          
          // 保存检测结果供后续使用
          wx.setStorageSync('auto_detected_ip', {
            ip: detectedIP,
            timestamp: Date.now(),
            autoDetected: true
          })
          
          // 立即更新全局API配置
          this.updateGlobalApiConfig(detectedIP)
          
          console.log('💡 IP检测完成，已应用到API配置中')
        } else {
          console.warn('⚠️ 未能自动检测到开发机IP，将使用默认配置')
        }
      } catch (error) {
        console.warn('IP自动检测失败:', error)
      }
      
    } catch (error) {
      console.warn('初始化IP检测失败:', error)
    }
  },

  /**
   * 强制清理所有IP缓存（用于禁用IP检测时）
   */
  forceCleanIPCache: function() {
    try {
      console.log('强制清理所有IP相关缓存...')
      const allIPKeys = [
        'auto_detected_ip', 
        'dev_server_ip', 
        'custom_api_url',
        'api_base_url_cache',
        'detected_server_ip',
        'ip_detection_cache'
      ]
      
      let clearedCount = 0
      allIPKeys.forEach(key => {
        try {
          wx.removeStorageSync(key)
          clearedCount++
        } catch (e) {
          console.warn(`清理缓存 ${key} 失败:`, e)
        }
      })
      
      console.log(`强制清理完成，共清理 ${clearedCount} 个IP缓存项`)
      
      // 重置全局API配置为默认值
      const { getCurrentConfig } = require('./utils/config')
      const config = getCurrentConfig()
      this.globalData.apiBaseUrl = config.API_BASE_URL
      console.log('已重置API地址为默认值:', config.API_BASE_URL)
      
    } catch (error) {
      console.error('强制清理IP缓存失败:', error)
    }
  },

  /**
   * 清理无效的IP缓存
   */
  clearInvalidIPCache: function() {
    try {
      // 清理可能的错误IP缓存
      const cacheKeys = ['auto_detected_ip', 'dev_server_ip', 'custom_api_url']
      let clearedCount = 0
      
      cacheKeys.forEach(key => {
        try {
          const cached = wx.getStorageSync(key)
          if (cached) {
            // 检查是否为明显错误的IP（保护用户的有效IP：192.168.124.3 和 192.168.124.7）
            const ipToCheck = cached.ip || cached
            if (typeof ipToCheck === 'string' && 
                (ipToCheck.includes('192.168.1.100') || 
                 ipToCheck.includes('192.168.0.100') ||
                 ipToCheck === '127.0.0.1') &&
                !ipToCheck.includes('192.168.124.3') &&
                !ipToCheck.includes('192.168.124.7')) {
              console.log(`🧹 清理错误IP缓存 ${key}:`, ipToCheck)
              wx.removeStorageSync(key)
              clearedCount++
            }
          }
        } catch (e) {
          console.warn(`清理缓存${key}时出错:`, e)
        }
      })
      
      if (clearedCount > 0) {
        console.log(`✅ 已清理 ${clearedCount} 个无效IP缓存`)
      } else {
        console.log('✅ IP缓存检查完成，无需清理')
      }
    } catch (error) {
      console.warn('清理IP缓存失败:', error)
    }
  },

  /**
   * 更新全局API配置
   */
  updateGlobalApiConfig: function(detectedIP) {
    try {
      console.log(`🔄 正在更新API配置为IP: ${detectedIP}`)
      
      // 1. 更新全局数据中的API基础URL
      const { getApiBaseUrl } = require('./utils/config')
      const newApiBaseUrl = getApiBaseUrl() // 此时会使用新检测到的IP
      this.globalData.apiBaseUrl = newApiBaseUrl
      
      console.log('📝 已更新 globalData.apiBaseUrl:', newApiBaseUrl)
      
      // 2. 强制刷新API模块配置
      try {
        const { refreshApiConfig } = require('./utils/api')
        refreshApiConfig()
        console.log('🔄 API模块配置已刷新')
      } catch (e) {
        console.warn('API模块配置刷新失败:', e)
      }
      
      // 3. 强制刷新网络管理器配置
      try {
        const networkManager = require('./utils/networkManager')
        if (networkManager.updateConfig) {
          networkManager.updateConfig()
          console.log('🔄 网络管理器配置已刷新')
        }
      } catch (e) {
        console.warn('网络管理器配置刷新失败:', e)
      }
      
      console.log(`✅ API配置更新完成，新IP: ${detectedIP}`)
      
    } catch (error) {
      console.error('更新API配置失败:', error)
    }
  }
})
