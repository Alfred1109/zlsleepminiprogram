// 设备绑定页面
const { getBluetoothManager } = require('../../utils/bluetoothManager')
const bluetoothManager = getBluetoothManager()

Page({
  data: {
    // 历史配对记录
    pairingHistory: [],
    
    // 蓝牙相关
    scanning: false,
    connectedDevices: [],
    discoveredDevices: [],
    selectedBluetoothDeviceId: '',
    
    // 页面状态
    bluetoothEnabled: false
  },

  onLoad() {
    this.initBluetooth()
    this.loadPairingHistory()
  },

  onShow() {
    this.checkConnectedDevices()
  },

  onHide() {
    this.stopBluetoothScan()
  },

  onUnload() {
    this.cleanup()
  },

  // 初始化蓝牙
  async initBluetooth() {
    try {
      await bluetoothManager.checkBluetoothAvailable()
      this.setData({ bluetoothEnabled: true })
      console.log('蓝牙初始化成功')
    } catch (error) {
      console.error('蓝牙初始化失败:', error)
      this.showBluetoothError(error)
    }
  },

  // 加载历史配对记录
  loadPairingHistory() {
    try {
      const pairingHistory = wx.getStorageSync('pairing_history') || []
      // 格式化时间显示
      const formattedHistory = pairingHistory.map(device => ({
        ...device,
        lastConnected: this.formatTime(device.lastConnected)
      }))
      this.setData({ pairingHistory: formattedHistory })
    } catch (error) {
      console.error('加载配对历史失败:', error)
    }
  },

  // 保存配对记录
  savePairingRecord(device) {
    try {
      const history = wx.getStorageSync('pairing_history') || []
      const deviceRecord = {
        deviceId: device.deviceId,
        name: device.name || device.localName || '未知设备',
        macAddress: device.macAddress || device.deviceId,
        typeIcon: this.getDeviceTypeIcon(device),
        lastConnected: Date.now(),
        pairTime: Date.now()
      }

      // 检查是否已存在该设备
      const existingIndex = history.findIndex(item => item.deviceId === device.deviceId)
      
      if (existingIndex >= 0) {
        // 更新现有记录
        history[existingIndex] = deviceRecord
      } else {
        // 添加新记录，最多保留10个
        history.unshift(deviceRecord)
        if (history.length > 10) {
          history.splice(10)
        }
      }

      wx.setStorageSync('pairing_history', history)
      this.loadPairingHistory() // 重新加载显示
    } catch (error) {
      console.error('保存配对记录失败:', error)
    }
  },

  // 获取设备类型图标
  getDeviceTypeIcon(device) {
    const name = (device.name || device.localName || '').toLowerCase()
    
    if (name.includes('bt') || name.includes('music') || name.includes('audio')) {
      return '🎧'
    }
    if (name.includes('speaker') || name.includes('sound')) {
      return '🔊'
    }
    if (name.includes('headphone') || name.includes('earphone')) {
      return '🎧'
    }
    return '📱'
  },

  // 格式化时间显示
  formatTime(timestamp) {
    if (!timestamp) return '未知'
    
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) {
      return '刚刚'
    } else if (minutes < 60) {
      return `${minutes}分钟前`
    } else if (hours < 24) {
      return `${hours}小时前`
    } else if (days < 7) {
      return `${days}天前`
    } else {
      const date = new Date(timestamp)
      return `${date.getMonth() + 1}月${date.getDate()}日`
    }
  },

  // 检查已连接设备
  async checkConnectedDevices() {
    if (!this.data.bluetoothEnabled) return

    try {
      const devices = await bluetoothManager.getConnectedDevices()
      this.setData({ connectedDevices: devices })
      
      // 如果没有选中设备且有已连接设备，自动选中第一个
      if (!this.data.selectedBluetoothDeviceId && devices.length > 0) {
        this.setData({ selectedBluetoothDeviceId: devices[0].deviceId })
        this.saveSelectedDevice(devices[0].deviceId)
      }
    } catch (error) {
      console.error('获取已连接设备失败:', error)
    }
  },

  // 切换蓝牙扫描
  toggleBluetoothScan() {
    if (this.data.scanning) {
      this.stopBluetoothScan()
    } else {
      this.startBluetoothScan()
    }
  },

  // 开始蓝牙扫描
  async startBluetoothScan() {
    if (!this.data.bluetoothEnabled) {
      await this.initBluetooth()
      if (!this.data.bluetoothEnabled) return
    }

    this.setData({ 
      scanning: true,
      discoveredDevices: []
    })

    try {
      await bluetoothManager.startScan({
        onDeviceFound: (device) => {
          console.log('发现设备:', device)
          this.addDiscoveredDevice(device)
        },
        onScanStop: () => {
          console.log('扫描停止')
          this.setData({ scanning: false })
        }
      })

      // 10秒后自动停止扫描
      setTimeout(() => {
        this.stopBluetoothScan()
      }, 10000)

    } catch (error) {
      console.error('开始扫描失败:', error)
      this.setData({ scanning: false })
      this.showBluetoothError(error)
    }
  },

  // 停止蓝牙扫描
  stopBluetoothScan() {
    if (!this.data.scanning) return

    try {
      bluetoothManager.stopScan()
      this.setData({ scanning: false })
    } catch (error) {
      console.error('停止扫描失败:', error)
    }
  },

  // 添加发现的设备
  addDiscoveredDevice(device) {
    const { discoveredDevices } = this.data
    
    // 检查设备是否已存在
    const existingIndex = discoveredDevices.findIndex(d => d.deviceId === device.deviceId)
    
    if (existingIndex >= 0) {
      // 更新已存在的设备信息
      discoveredDevices[existingIndex] = { ...discoveredDevices[existingIndex], ...device }
    } else {
      // 添加新设备
      discoveredDevices.push(device)
    }
    
    this.setData({ discoveredDevices })
  },

  // 连接蓝牙设备
  async connectBluetoothDevice(e) {
    const device = e.currentTarget.dataset.device
    
    // 更新连接状态
    const { discoveredDevices } = this.data
    const deviceIndex = discoveredDevices.findIndex(d => d.deviceId === device.deviceId)
    if (deviceIndex >= 0) {
      discoveredDevices[deviceIndex].connecting = true
      this.setData({ discoveredDevices })
    }

    try {
      await bluetoothManager.connectDevice(device.deviceId)
      
      // 保存配对记录
      this.savePairingRecord(device)
      
      wx.showToast({
        title: '连接成功',
        icon: 'success'
      })

      // 连接成功后刷新已连接设备列表
      setTimeout(() => {
        this.checkConnectedDevices()
      }, 1000)

    } catch (error) {
      console.error('连接设备失败:', error)
      wx.showToast({
        title: '连接失败',
        icon: 'none'
      })
    } finally {
      // 清除连接状态
      if (deviceIndex >= 0) {
        discoveredDevices[deviceIndex].connecting = false
        this.setData({ discoveredDevices })
      }
    }
  },

  // 重连历史设备
  async reconnectDevice(e) {
    const device = e.currentTarget.dataset.device
    
    // 更新连接状态
    const { pairingHistory } = this.data
    const deviceIndex = pairingHistory.findIndex(d => d.deviceId === device.deviceId)
    if (deviceIndex >= 0) {
      pairingHistory[deviceIndex].connecting = true
      this.setData({ pairingHistory })
    }

    try {
      // 首先尝试从已连接设备中找到
      const connectedDevices = await bluetoothManager.getConnectedDevices()
      const connectedDevice = connectedDevices.find(d => d.deviceId === device.deviceId)
      
      if (connectedDevice) {
        // 设备已连接，直接选中
        this.setData({ selectedBluetoothDeviceId: device.deviceId })
        this.saveSelectedDevice(device.deviceId)
        
        wx.showToast({
          title: '设备已连接',
          icon: 'success'
        })
      } else {
        // 设备未连接，尝试重新连接
        await bluetoothManager.connectDevice(device.deviceId)
        
        // 更新配对记录时间
        this.savePairingRecord({
          deviceId: device.deviceId,
          name: device.name,
          macAddress: device.macAddress
        })
        
        wx.showToast({
          title: '重连成功',
          icon: 'success'
        })

        // 刷新已连接设备列表
        setTimeout(() => {
          this.checkConnectedDevices()
        }, 1000)
      }

    } catch (error) {
      console.error('重连设备失败:', error)
      wx.showToast({
        title: '重连失败，请手动连接',
        icon: 'none'
      })
    } finally {
      // 清除连接状态
      if (deviceIndex >= 0) {
        pairingHistory[deviceIndex].connecting = false
        this.setData({ pairingHistory })
      }
    }
  },

  // 清空历史记录
  clearHistory() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有配对历史记录吗？',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.removeStorageSync('pairing_history')
            this.setData({ pairingHistory: [] })
            wx.showToast({
              title: '已清空',
              icon: 'success'
            })
          } catch (error) {
            console.error('清空历史失败:', error)
            wx.showToast({
              title: '清空失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 选择蓝牙设备
  selectBluetoothDevice(e) {
    const deviceId = e.currentTarget.dataset.deviceid
    this.setData({ selectedBluetoothDeviceId: deviceId })
    this.saveSelectedDevice(deviceId)
    
    wx.showToast({
      title: '设备已选中',
      icon: 'success'
    })
  },

  // 保存选中的设备
  saveSelectedDevice(deviceId) {
    try {
      wx.setStorageSync('selected_bluetooth_device', deviceId)
    } catch (error) {
      console.error('保存选中设备失败:', error)
    }
  },

  // 绑定智能设备
  bindSmartDevice(e) {
    const type = e.currentTarget.dataset.type
    
    wx.showModal({
      title: '助眠设备套装',
      content: '助眠设备套装功能正在开发中，将支持智能氛围灯、香薰机、白噪音设备等的统一管理。敬请期待！',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  // 控制设备
  controlDevice(e) {
    const device = e.currentTarget.dataset.device
    
    wx.showActionSheet({
      itemList: ['播放/暂停', '音量调节', '设备信息'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            this.toggleDevicePlayback(device)
            break
          case 1:
            this.adjustDeviceVolume(device)
            break
          case 2:
            this.showDeviceInfo(device)
            break
        }
      }
    })
  },

  // 解绑设备
  unbindDevice(e) {
    const deviceId = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '确认解绑',
      content: '确定要解绑此设备吗？',
      success: (res) => {
        if (res.confirm) {
          this.performUnbindDevice(deviceId)
        }
      }
    })
  },

  // 执行解绑操作
  performUnbindDevice(deviceId) {
    try {
      let { boundDevices } = this.data
      boundDevices = boundDevices.filter(device => device.id !== deviceId)
      
      this.setData({ boundDevices })
      wx.setStorageSync('bound_devices', boundDevices)
      
      wx.showToast({
        title: '解绑成功',
        icon: 'success'
      })
    } catch (error) {
      console.error('解绑设备失败:', error)
      wx.showToast({
        title: '解绑失败',
        icon: 'none'
      })
    }
  },

  // 设备播放控制
  toggleDevicePlayback(device) {
    // 跳转到设备控制页面进行详细控制
    this.goToDeviceControl(device)
  },

  // 音量调节
  adjustDeviceVolume(device) {
    // 跳转到设备控制页面进行详细控制
    this.goToDeviceControl(device)
  },

  // 跳转到设备控制页面
  goToDeviceControl(device) {
    if (!device) {
      wx.showToast({
        title: '设备信息无效',
        icon: 'none'
      })
      return
    }

    // 检查设备连接状态
    if (device.status !== '已连接') {
      wx.showModal({
        title: '设备未连接',
        content: '设备需要先连接才能进行控制，是否前往连接？',
        confirmText: '去连接',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 这里可以添加设备连接逻辑
            wx.showToast({
              title: '请在设备列表中连接设备',
              icon: 'none'
            })
          }
        }
      })
      return
    }

    // 跳转到控制页面，传递设备信息
    wx.navigateTo({
      url: `/pages/device/control/control?deviceId=${device.deviceId}&deviceName=${encodeURIComponent(device.name || '智能设备')}`
    })
  },

  // 显示设备信息
  showDeviceInfo(device) {
    wx.showModal({
      title: '设备信息',
      content: `设备名称：${device.name}\n设备状态：${device.status}\n连接时间：${device.connectTime || '未知'}`,
      showCancel: false,
      confirmText: '确定'
    })
  },

  // 显示蓝牙错误
  showBluetoothError(error) {
    let message = '蓝牙操作失败'
    
    if (error.message) {
      message = error.message
    } else if (typeof error === 'string') {
      message = error
    }
    
    wx.showModal({
      title: '蓝牙错误',
      content: message,
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  // 清理资源
  cleanup() {
    this.stopBluetoothScan()
  }
})
