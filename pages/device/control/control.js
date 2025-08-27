const { getBluetoothManager } = require('../../../utils/bluetoothManager');

Page({
  data: {
    deviceInfo: null, // 设备信息
    isConnected: false, // 是否已连接
    isPowered: false, // 是否已开机
    currentMode: 'sleep', // 当前模式：sleep(助眠), relax(放松), focus(专注)
    volume: 50, // 音量：0-100
    brightness: 70, // 亮度：0-100
    timer: 30, // 定时器：分钟
    isSettingTimer: false, // 是否正在设置定时器
    timerOptions: [15, 30, 45, 60, 90, 120], // 定时器选项（分钟）
  },

  onLoad: function(options) {
    console.log('control页面加载');
    
    // 获取蓝牙管理器实例
    this.bluetoothManager = getBluetoothManager();
    
    // 获取设备信息
    this.getDeviceInfo();
    
    // 设置接收数据回调
    this.bluetoothManager.onReceiveData(this.handleReceivedData.bind(this));
    
    // 启动连接监测定时器
    this.startConnectionMonitor();
    
    // 启动设备初始化序列
    this.initDeviceSequence();
  },

  // 设备初始化序列
  initDeviceSequence: function() {
    console.log('开始设备初始化序列');
    
    // 显示初始化中提示
    wx.showLoading({
      title: '正在初始化设备...',
      mask: true
    });
    
    // 步骤1：确保连接状态
    setTimeout(() => {
      if (!this.bluetoothManager.getConnectionStatus()) {
        console.log('设备未连接，尝试重新连接');
        this.reconnectDevice(() => {
          // 连接成功后继续
          this.continueDeviceInit();
        });
      } else {
        // 已连接，继续初始化
        this.continueDeviceInit();
      }
    }, 500);
  },
  
  // 继续设备初始化
  continueDeviceInit: function() {
    console.log('连接已确认，继续初始化');
    
    // 步骤2：延迟一段时间后获取设备状态
    setTimeout(() => {
      // 获取设备状态
      this.requestDeviceStatus();
      
      // 隐藏加载提示
      wx.hideLoading();
      
      // 显示成功提示
      wx.showToast({
        title: '设备已连接',
        icon: 'success',
        duration: 1500
      });
    }, 1000);
  },
  
  // 重新连接设备(带回调)
  reconnectDevice: function(successCallback) {
    if (!this.data.deviceInfo) {
      console.error('无设备信息，无法重连');
      return;
    }
    
    console.log('开始重新连接设备:', this.data.deviceInfo.deviceId);
    
    // 显示连接中提示
    if (!wx.showLoading) {
      wx.showLoading({
        title: '正在连接设备...',
        mask: true
      });
    }
    
    this.bluetoothManager.connectDevice(
      this.data.deviceInfo.deviceId,
      // 连接成功回调
      (res) => {
        console.log('重新连接成功:', res);
        
        // 隐藏加载提示
        try {
          wx.hideLoading();
        } catch (e) {}
        
        this.setData({
          isConnected: true
        });
        
        // 如果有成功回调则执行
        if (typeof successCallback === 'function') {
          successCallback();
        } else {
          // 获取设备状态
          this.requestDeviceStatus();
        }
      },
      // 断开连接回调
      (res) => {
        console.log('断开连接:', res);
        this.setData({
          isConnected: false
        });
        
        wx.showToast({
          title: '设备已断开连接',
          icon: 'none'
        });
      }
    )
    .catch((err) => {
      console.error('重新连接失败:', err);
      
      // 隐藏加载提示
      try {
        wx.hideLoading();
      } catch (e) {}
      
      wx.showToast({
        title: '连接失败，请返回重试',
        icon: 'none'
      });
    });
  },

  onShow: function() {
    // 检查设备连接状态
    this.checkConnectionStatus();
  },

  onHide: function() {
    // 页面隐藏时，清除定时器
    if (this.connectionMonitorTimer) {
      clearInterval(this.connectionMonitorTimer);
      this.connectionMonitorTimer = null;
    }
  },

  onUnload: function() {
    // 页面卸载时，移除数据接收回调和清除定时器
    this.bluetoothManager.onReceiveData(null);
    
    if (this.connectionMonitorTimer) {
      clearInterval(this.connectionMonitorTimer);
      this.connectionMonitorTimer = null;
    }
  },

  // 启动连接监测
  startConnectionMonitor: function() {
    // 清除可能存在的旧定时器
    if (this.connectionMonitorTimer) {
      clearInterval(this.connectionMonitorTimer);
    }
    
    // 每5秒检查一次连接状态
    this.connectionMonitorTimer = setInterval(() => {
      const isConnected = this.bluetoothManager.getConnectionStatus();
      
      // 如果状态发生变化
      if (isConnected !== this.data.isConnected) {
        this.setData({
          isConnected: isConnected
        });
        
        if (isConnected) {
          console.log('设备已连接');
          // 发送保持连接的心跳包
          this.sendHeartbeat();
          // 获取设备状态
          this.requestDeviceStatus();
        } else {
          console.log('设备已断开');
          // 尝试自动重连
          this.reconnectDevice();
        }
      } else if (isConnected) {
        // 定期发送心跳包保持连接
        this.sendHeartbeat();
      }
    }, 5000);
  },

  // 发送心跳包保持连接
  sendHeartbeat: function() {
    if (!this.data.isConnected) return;
    
    // 发送心跳命令
    // 命令格式：[0xAA, 0xFF, 0x00, 0x00, 0xAB]
    this.bluetoothManager.sendData([0xAA, 0xFF, 0x00, 0x00, 0xAB])
      .then(() => {
        console.log('心跳包发送成功');
      })
      .catch((err) => {
        console.error('心跳包发送失败:', err);
      });
  },

  // 获取设备信息
  getDeviceInfo: function() {
    wx.getStorage({
      key: 'bindDevice',
      success: (res) => {
        this.setData({
          deviceInfo: res.data
        });
      },
      fail: () => {
        wx.showToast({
          title: '未找到设备信息',
          icon: 'none'
        });
        
        // 返回上一页
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    });
  },

  // 检查设备连接状态
  checkConnectionStatus: function() {
    const isConnected = this.bluetoothManager.getConnectionStatus();
    
    this.setData({
      isConnected: isConnected
    });
    
    if (isConnected) {
      // 获取设备状态
      this.requestDeviceStatus();
    } else {
      // 尝试重新连接
      this.reconnectDevice();
    }
  },

  // 请求设备状态
  requestDeviceStatus: function() {
    if (!this.data.isConnected) return;
    
    console.log('尝试获取设备状态');
    
    // 设备可能使用的几种不同协议格式
    const protocols = [
      // 原始命令格式
      [0xAA, 0x01, 0x00, 0x00, 0xAB],
      // 替代格式1 - 部分设备可能使用这种格式
      [0xAA, 0x01, 0xFF, 0xFF, 0xAB],
      // 替代格式2 - BT-Music设备可能的查询命令
      [0xFE, 0x01, 0x00, 0x00, 0xFF],
      // 通用查询格式
      [0xFF, 0xFF, 0x01]
    ];
    
    // 使用tryNextProtocol递归尝试不同的协议
    const tryNextProtocol = (index = 0) => {
      if (index >= protocols.length) {
        console.error('所有协议格式均尝试失败');
        
        wx.showToast({
          title: '获取设备状态失败',
          icon: 'none'
        });
        return;
      }
      
      console.log(`尝试协议 ${index+1}/${protocols.length}:`, protocols[index]);
      
      // 发送获取状态命令
      this.bluetoothManager.sendData(protocols[index])
        .then(() => {
          console.log(`协议 ${index+1} 请求发送成功，等待设备响应`);
          
          // 记录当前协议索引，用于后续成功识别
          this.lastProtocolIndex = index;
          
          // 设置一个超时，如果5秒内没有收到响应，尝试下一个协议
          this.statusResponseTimeout = setTimeout(() => {
            console.log(`协议 ${index+1} 未收到响应，尝试下一个协议`);
            tryNextProtocol(index + 1);
          }, 1000);
        })
        .catch((err) => {
          console.error(`协议 ${index+1} 请求失败:`, err);
          
          // 如果发送失败，立即尝试下一个协议
          setTimeout(() => {
            tryNextProtocol(index + 1);
          }, 200);
        });
    };
    
    // 开始尝试第一个协议
    tryNextProtocol();
  },

  // 处理接收到的数据
  handleReceivedData: function(data) {
    console.log('接收到数据:', data);
    
    // 清除协议尝试超时定时器
    if (this.statusResponseTimeout) {
      clearTimeout(this.statusResponseTimeout);
      this.statusResponseTimeout = null;
    }
    
    // 检查基本数据格式
    if (data.length < 3) {
      console.error('数据太短，无法解析');
      return;
    }
    
    // 尝试多种数据格式解析
    let isValidData = false;
    
    // 格式1: [0xAA, cmd, data1, data2, 0xAB]
    if (data.length >= 5 && data[0] === 0xAA && data[data.length - 1] === 0xAB) {
      isValidData = true;
      const cmd = data[1];
      const data1 = data[2];
      const data2 = data[3];
      
      this._processCommand(cmd, data1, data2);
    } 
    // 格式2: [0xFE, cmd, data1, data2, 0xFF]
    else if (data.length >= 5 && data[0] === 0xFE && data[data.length - 1] === 0xFF) {
      isValidData = true;
      const cmd = data[1];
      const data1 = data[2];
      const data2 = data[3];
      
      this._processCommand(cmd, data1, data2);
    }
    // 格式3: 任何以0xFF开头或结尾的数据包尝试解析
    else if ((data[0] === 0xFF || data[data.length - 1] === 0xFF) && data.length >= 3) {
      isValidData = true;
      // 假设命令在第二个字节，数据在后续字节
      const cmd = data[1];
      const data1 = data.length > 2 ? data[2] : 0;
      const data2 = data.length > 3 ? data[3] : 0;
      
      this._processCommand(cmd, data1, data2);
    }
    
    if (!isValidData) {
      console.warn('接收到未知格式数据，尝试通用解析');
      // 通用解析 - 假设第一个字节是命令，后续是数据
      if (data.length >= 2) {
        const cmd = data[0];
        const data1 = data.length > 1 ? data[1] : 0;
        const data2 = data.length > 2 ? data[2] : 0;
        
        this._processCommand(cmd, data1, data2);
      }
    }
  },
  
  // 处理解析后的命令
  _processCommand: function(cmd, data1, data2) {
    console.log('处理命令:', cmd, '数据:', data1, data2);
    
    switch (cmd) {
      case 0x01: // 状态响应
        this.setData({
          isPowered: (data1 & 0x01) === 0x01,
          currentMode: this.parseMode(data1 >> 1 & 0x03),
          volume: data2 & 0x7F,
          brightness: data1 >> 3 & 0x7F
        });
        break;
      case 0x02: // 定时器响应
        this.setData({
          timer: data1
        });
        break;
      default:
        console.log('未知命令:', cmd);
        // 尝试通用解析 - 如果data1看起来像是一个开关状态(0或1)
        if (data1 === 0 || data1 === 1) {
          this.setData({
            isPowered: data1 === 1
          });
        }
    }
  },

  // 解析模式
  parseMode: function(modeCode) {
    switch (modeCode) {
      case 0:
        return 'sleep';
      case 1:
        return 'relax';
      case 2:
        return 'focus';
      default:
        return 'sleep';
    }
  },

  // 获取模式代码
  getModeCode: function(mode) {
    switch (mode) {
      case 'sleep':
        return 0;
      case 'relax':
        return 1;
      case 'focus':
        return 2;
      default:
        return 0;
    }
  },

  // 电源开关
  togglePower: function() {
    if (!this.data.isConnected) {
      this.showNotConnectedToast();
      return;
    }
    
    const newPowerState = !this.data.isPowered;
    
    // 发送电源命令
    // 命令格式：[0xAA, 0x10, state, 0x00, 0xAB]
    // state: 0x01(开), 0x00(关)
    this.bluetoothManager.sendData([0xAA, 0x10, newPowerState ? 0x01 : 0x00, 0x00, 0xAB])
      .then(() => {
        console.log('发送电源命令成功');
        this.setData({
          isPowered: newPowerState
        });
      })
      .catch((err) => {
        console.error('发送电源命令失败:', err);
        
        wx.showToast({
          title: '操作失败，请重试',
          icon: 'none'
        });
      });
  },

  // 切换模式
  changeMode: function(e) {
    if (!this.data.isConnected || !this.data.isPowered) {
      this.showNotReadyToast();
      return;
    }
    
    const mode = e.currentTarget.dataset.mode;
    
    // 发送模式命令
    // 命令格式：[0xAA, 0x11, mode, 0x00, 0xAB]
    // mode: 0x00(sleep), 0x01(relax), 0x02(focus)
    this.bluetoothManager.sendData([0xAA, 0x11, this.getModeCode(mode), 0x00, 0xAB])
      .then(() => {
        console.log('发送模式命令成功');
        this.setData({
          currentMode: mode
        });
      })
      .catch((err) => {
        console.error('发送模式命令失败:', err);
        
        wx.showToast({
          title: '操作失败，请重试',
          icon: 'none'
        });
      });
  },

  // 调整音量
  changeVolume: function(e) {
    if (!this.data.isConnected || !this.data.isPowered) {
      this.showNotReadyToast();
      return;
    }
    
    const volume = e.detail.value;
    
    // 发送音量命令
    // 命令格式：[0xAA, 0x12, volume, 0x00, 0xAB]
    // volume: 0-100
    this.bluetoothManager.sendData([0xAA, 0x12, volume, 0x00, 0xAB])
      .then(() => {
        console.log('发送音量命令成功');
      })
      .catch((err) => {
        console.error('发送音量命令失败:', err);
        
        wx.showToast({
          title: '操作失败，请重试',
          icon: 'none'
        });
        
        // 恢复原来的值
        this.setData({
          volume: this.data.volume
        });
      });
  },

  // 调整亮度
  changeBrightness: function(e) {
    if (!this.data.isConnected || !this.data.isPowered) {
      this.showNotReadyToast();
      return;
    }
    
    const brightness = e.detail.value;
    
    // 发送亮度命令
    // 命令格式：[0xAA, 0x13, brightness, 0x00, 0xAB]
    // brightness: 0-100
    this.bluetoothManager.sendData([0xAA, 0x13, brightness, 0x00, 0xAB])
      .then(() => {
        console.log('发送亮度命令成功');
      })
      .catch((err) => {
        console.error('发送亮度命令失败:', err);
        
        wx.showToast({
          title: '操作失败，请重试',
          icon: 'none'
        });
        
        // 恢复原来的值
        this.setData({
          brightness: this.data.brightness
        });
      });
  },

  // 显示定时器选择
  showTimerPicker: function() {
    if (!this.data.isConnected || !this.data.isPowered) {
      this.showNotReadyToast();
      return;
    }
    
    this.setData({
      isSettingTimer: true
    });
  },

  // 隐藏定时器选择
  hideTimerPicker: function() {
    this.setData({
      isSettingTimer: false
    });
  },

  // 设置定时器
  setTimer: function(e) {
    const timer = parseInt(e.currentTarget.dataset.time);
    
    // 发送定时器命令
    // 命令格式：[0xAA, 0x14, timer, 0x00, 0xAB]
    // timer: 分钟数
    this.bluetoothManager.sendData([0xAA, 0x14, timer, 0x00, 0xAB])
      .then(() => {
        console.log('发送定时器命令成功');
        this.setData({
          timer: timer,
          isSettingTimer: false
        });
        
        wx.showToast({
          title: `已设置${timer}分钟后关闭`,
          icon: 'none'
        });
      })
      .catch((err) => {
        console.error('发送定时器命令失败:', err);
        
        wx.showToast({
          title: '设置失败，请重试',
          icon: 'none'
        });
      });
  },

  // 显示未连接提示
  showNotConnectedToast: function() {
    wx.showToast({
      title: '设备未连接，请重新连接',
      icon: 'none'
    });
  },

  // 显示设备未就绪提示
  showNotReadyToast: function() {
    if (!this.data.isConnected) {
      this.showNotConnectedToast();
    } else if (!this.data.isPowered) {
      wx.showToast({
        title: '请先打开设备电源',
        icon: 'none'
      });
    }
  },

  // 返回设备绑定页
  goToBindPage: function() {
    wx.navigateTo({
      url: '/pages/device/bind/bind'
    });
  }
}); 