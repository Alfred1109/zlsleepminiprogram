const { getBluetoothManager } = require('../../../utils/bluetoothManager');

// 获取应用实例
const app = getApp();
let bluetoothManager = null;

Page({
  data: {
    devices: [], // 扫描到的设备列表
    scanning: false, // 是否正在扫描
    deviceIdMap: {}, // 设备ID映射表，避免重复添加
    filterHeadphones: false, // 是否只显示耳机设备
    filterBTPrefix: false, // 是否只显示BT开头的设备
    loadingVisible: false, // 是否显示加载提示
    searchTimeout: null, // 搜索超时定时器
    hasSpecialDevices: false, // 是否发现了特殊设备
    specialDevices: [], // 特殊设备列表
    normalDevices: [], // 普通设备列表
    bluetoothState: '未知', // 蓝牙状态
    errorMsg: '', // 错误信息
    lastDevice: null, // 最近发现的设备
    enableExtraLogging: false // 是否启用额外日志
  },

  onLoad: function(options) {
    // 确保蓝牙管理器正确初始化
    bluetoothManager = app.globalData.bluetoothManager || getBluetoothManager();
    
    // 确保全局实例也正确设置
    if (!app.globalData.bluetoothManager) {
      app.globalData.bluetoothManager = bluetoothManager;
    }
    
    // 页面加载时初始化
    this.resetDeviceList();
    // 检查蓝牙状态
    this.checkBluetoothState();
  },

  onShow: function() {
    // 页面显示时重置设备列表，避免缓存
    this.resetDeviceList();
    // 检查蓝牙状态
    this.checkBluetoothState();
  },

  /**
   * 重置设备列表
   */
  resetDeviceList() {
    this.setData({
      devices: [],
      deviceIdMap: {},
      scanning: false,
      hasSpecialDevices: false,
      specialDevices: [],
      normalDevices: [],
      errorMsg: '',
      lastDevice: null
    });
  },

  /**
   * 检查蓝牙状态
   */
  checkBluetoothState() {
    this.setData({
      bluetoothState: '检查中...',
      errorMsg: ''
    });
    
    // 先尝试初始化蓝牙适配器，然后获取状态
    wx.openBluetoothAdapter({
      mode: 'central',
      success: () => {
        // 初始化成功后获取状态
        wx.getBluetoothAdapterState({
          success: (res) => {
            console.log('蓝牙适配器状态:', res);
            let stateText = '可用';
            if (!res.available) {
              stateText = '不可用';
              this.setData({ errorMsg: '蓝牙不可用，请检查蓝牙是否开启' });
            } else {
              if (res.discovering) {
                stateText += ' (正在搜索)';
              }
              // 显示更多适配器信息
              stateText += `，已发现${res.devices ? res.devices.length : 0}个设备`;
            }
            this.setData({
              bluetoothState: stateText
            });
          },
          fail: (err) => {
            console.error('获取蓝牙适配器状态失败:', err);
            this.setData({
              bluetoothState: '获取失败',
              errorMsg: '获取蓝牙适配器状态失败: ' + JSON.stringify(err)
            });
            
            // 如果是因为未初始化失败，尝试重新初始化
            if (err.errCode === 10000 || err.errCode === 10001) {
              console.log('尝试重新初始化蓝牙适配器');
              setTimeout(() => {
                // 尝试关闭再重新打开
                try {
                  wx.closeBluetoothAdapter({
                    complete: () => {
                      setTimeout(() => this.checkBluetoothState(), 1000);
                    }
                  });
                } catch (e) {
                  console.error('关闭蓝牙适配器失败:', e);
                }
              }, 1000);
            }
          }
        });
      },
      fail: (err) => {
        console.error('初始化蓝牙适配器失败:', err);
        
        // 根据错误码提供更详细的信息
        let errorMessage = '蓝牙初始化失败';
        let stateText = '初始化失败';
        
        switch(err.errCode) {
          case 10001:
            errorMessage += '：蓝牙未打开';
            stateText = '蓝牙未打开';
            break;
          case 10002:
            errorMessage += '：没有找到蓝牙设备';
            stateText = '无蓝牙设备';
            break;
          case 10003:
            errorMessage += '：连接失败';
            stateText = '连接失败';
            break;
          case 10004:
            errorMessage += '：没有找到特征值';
            stateText = '无特征值';
            break;
          case 10005:
            errorMessage += '：没有找到服务';
            stateText = '无服务';
            break;
          case 10006:
            errorMessage += '：蓝牙已断开';
            stateText = '已断开';
            break;
          case 10007:
            errorMessage += '：特征值不支持此操作';
            stateText = '操作不支持';
            break;
          case 10008:
            errorMessage += '：系统异常';
            stateText = '系统异常';
            break;
          case 10009:
            errorMessage += '：系统不支持蓝牙';
            stateText = '不支持蓝牙';
            break;
          case 10012:
            errorMessage += '：蓝牙操作不可用';
            stateText = '操作不可用';
            break;
          case 10013:
            errorMessage += '：蓝牙连接超时';
            stateText = '连接超时';
            break;
          default:
            errorMessage += `：${err.errMsg || '未知错误'}`;
            break;
        }
        
        this.setData({
          bluetoothState: stateText,
          errorMsg: errorMessage
        });
        
        // 提示用户打开蓝牙
        if (err.errCode === 10001) {
          wx.showModal({
            title: '提示',
            content: '请打开手机蓝牙后再试',
            showCancel: false
          });
        }
      }
    });
  },

  /**
   * 启用或禁用额外日志
   */
  onToggleExtraLogging() {
    const newValue = !this.data.enableExtraLogging;
    this.setData({
      enableExtraLogging: newValue
    });
    
    // 更新蓝牙管理器的日志设置
    if (bluetoothManager) {
      bluetoothManager.extraLogging = newValue;
      console.log(`额外日志已${newValue ? '启用' : '禁用'}`);
    }
  },

  /**
   * 开始扫描设备
   */
  startScan() {
    this.resetDeviceList();
    
    this.setData({ 
      scanning: true,
      loadingVisible: true,
      errorMsg: ''
    });

    // 再次确保蓝牙管理器已正确初始化
    if (!bluetoothManager) {
      bluetoothManager = app.globalData.bluetoothManager || getBluetoothManager();
      // 确保全局实例也正确设置
      if (!app.globalData.bluetoothManager) {
        app.globalData.bluetoothManager = bluetoothManager;
      }
    }

    // 设置过滤条件
    bluetoothManager.setFilterHeadphones(this.data.filterHeadphones);
    bluetoothManager.setFilterBTPrefix(this.data.filterBTPrefix);
    
    // 设置额外日志
    bluetoothManager.extraLogging = this.data.enableExtraLogging;
    
    // 清除之前的超时定时器
    if (this.data.searchTimeout) {
      clearTimeout(this.data.searchTimeout);
    }
    
    // 设置超时定时器，20秒后自动停止扫描
    const timeoutId = setTimeout(() => {
      this.stopScan();
      // 提示用户扫描完成
      wx.showToast({
        title: '扫描完成',
        icon: 'success'
      });
    }, 20000);
    
    this.setData({ searchTimeout: timeoutId });

    // 确保蓝牙适配器关闭再重新打开，避免之前的状态影响
    try {
      wx.closeBluetoothAdapter({
        complete: () => {
          setTimeout(() => {
            // 重新初始化蓝牙适配器
            wx.openBluetoothAdapter({
              mode: 'central',
              success: (res) => {
                console.log('蓝牙适配器初始化成功:', res);
                this.setData({ bluetoothState: '已初始化' });
                
                // 等待适配器初始化完成
                setTimeout(() => {
                  // 开始扫描设备
                  bluetoothManager.startScan(this.onDeviceFound.bind(this))
                    .then(() => {
                      console.log('开始扫描设备');
                      this.setData({ bluetoothState: '扫描中' });
                      
                      // 获取已发现的设备
                      setTimeout(() => {
                        this.syncExistingDevices();
                      }, 1000);
                    })
                    .catch(err => {
                      console.error('扫描设备失败:', err);
                      this.setData({ 
                        scanning: false,
                        loadingVisible: false,
                        bluetoothState: '扫描失败',
                        errorMsg: '扫描失败: ' + JSON.stringify(err)
                      });
                      
                      wx.showModal({
                        title: '扫描失败',
                        content: '请确保蓝牙已开启，并授予小程序蓝牙权限',
                        showCancel: false
                      });
                    });
                }, 500); // 等待500ms确保适配器初始化完成
              },
              fail: (err) => {
                console.error('蓝牙适配器初始化失败:', err);
                this.setData({ 
                  scanning: false,
                  loadingVisible: false,
                  bluetoothState: '初始化失败',
                  errorMsg: '蓝牙初始化失败: ' + JSON.stringify(err)
                });
                
                // 提示用户打开蓝牙
                wx.showModal({
                  title: '提示',
                  content: '请打开手机蓝牙后再试',
                  showCancel: false
                });
              }
            });
          }, 500); // 等待500ms确保之前的适配器完全关闭
        }
      });
    } catch (e) {
      console.error('关闭蓝牙适配器失败:', e);
      // 直接尝试打开适配器
      wx.openBluetoothAdapter({
        mode: 'central',
        success: (res) => {
          console.log('蓝牙适配器直接初始化成功:', res);
          this.setData({ bluetoothState: '已初始化' });
          
          // 立即开始扫描
          bluetoothManager.startScan(this.onDeviceFound.bind(this))
            .then(() => {
              console.log('开始扫描设备');
              this.setData({ bluetoothState: '扫描中' });
              
              // 获取已发现的设备（可能有些设备已经在bluetoothManager中了）
              setTimeout(() => {
                this.syncExistingDevices();
              }, 1000);
            })
            .catch(err => {
              console.error('扫描设备失败:', err);
              this.setData({ 
                scanning: false,
                loadingVisible: false,
                bluetoothState: '扫描失败',
                errorMsg: '扫描失败: ' + JSON.stringify(err)
              });
            });
        },
        fail: (err) => {
          console.error('蓝牙适配器直接初始化失败:', err);
          this.setData({ 
            scanning: false,
            loadingVisible: false,
            bluetoothState: '初始化失败',
            errorMsg: '蓝牙初始化失败: ' + JSON.stringify(err)
          });
          
          wx.showModal({
            title: '提示',
            content: '蓝牙初始化失败，请确保设备蓝牙已开启',
            showCancel: false
          });
        }
      });
    }
  },

  /**
   * 停止扫描设备
   */
  stopScan() {
    // 清除超时定时器
    if (this.data.searchTimeout) {
      clearTimeout(this.data.searchTimeout);
      this.setData({ searchTimeout: null });
    }
    
    this.setData({
      scanning: false,
      loadingVisible: false
    });
    
    // 确保蓝牙管理器已经初始化
    if (!bluetoothManager) {
      bluetoothManager = app.globalData.bluetoothManager || getBluetoothManager();
    }
    
    if (bluetoothManager) {
      bluetoothManager.stopScan()
        .then(() => {
          console.log('停止扫描设备');
          this.checkBluetoothState();
        })
        .catch(err => {
          console.error('停止扫描失败:', err);
          this.setData({
            errorMsg: '停止扫描失败: ' + JSON.stringify(err)
          });
          // 即使停止失败也要检查状态
          this.checkBluetoothState();
        });
    } else {
      console.error('蓝牙管理器未初始化，无法停止扫描');
      this.setData({
        errorMsg: '蓝牙管理器未初始化，无法停止扫描'
      });
      this.checkBluetoothState();
    }
  },

  /**
   * 检查设备是否为特殊设备
   * @param {Object} device 设备对象
   * @returns {Boolean} 是否为特殊设备
   */
  async isSpecialDevice(device) {
    if (!device) return false;
    
    try {
      // 使用后台白名单系统判断是否为特殊设备
      const { getDeviceWhitelistManager } = require('../../utils/deviceWhitelist');
      const whitelistManager = getDeviceWhitelistManager();
      
      const macAddress = device.macAddress || '';
      const deviceName = device.name || '';
      
      // 调用白名单验证
      const verification = await whitelistManager.verifyDevice(macAddress, deviceName);
      
      // 白名单中的设备都视为特殊设备（推荐设备）
      return verification.is_whitelisted;
      
    } catch (error) {
      console.warn('白名单验证失败，使用兜底逻辑:', error);
      
      // 兜底逻辑：仅保留核心测试设备
      const fallbackSpecialNames = ['BT-Music', 'medsleep'];
      return fallbackSpecialNames.some(name => 
        device.name && device.name.toLowerCase().includes(name.toLowerCase())
      );
    }
  },

  /**
   * 发现设备回调
   * @param {Object} device 设备对象
   */
  onDeviceFound(device) {
    if (!device) {
      console.warn('收到空设备对象');
      return;
    }
    
    console.log('✅ 发现设备:', device.name, device.deviceId);
    console.log('✅ 设备MAC地址:', device.macAddress);
    
    // 先同步处理设备添加，再异步检查特殊设备
    this._handleDeviceFoundSync(device);
    
    // 更新最近发现的设备
    this.setData({
      lastDevice: {
        name: device.name || '未命名',
        deviceId: device.deviceId || '未知ID'
      }
    });
    
    // 检查设备是否已存在
    if (this.data.deviceIdMap[device.deviceId]) {
      // 如果已存在，检查是否需要更新名称
      const devices = this.data.devices;
      const index = devices.findIndex(d => d.deviceId === device.deviceId);
      
      if (index !== -1) {
        // 如果设备名称更新了，更新设备列表
        if (devices[index].name !== device.name) {
          devices[index].name = device.name;
          this.setData({ devices });
          
          // 更新特殊设备和普通设备列表
          this.updateDeviceLists();
        }
      }
      return;
    }
    
    // 添加设备到列表
    const newDevices = this.data.devices.concat([device]);
    const newDeviceIdMap = { ...this.data.deviceIdMap };
    newDeviceIdMap[device.deviceId] = true;
    
    // 计算是否有特殊设备（基于白名单）
    let hasSpecialDevices = this.data.hasSpecialDevices;
    if (isSpecial) {
      hasSpecialDevices = true;
    }
    
    // 按信号强度排序
    newDevices.sort((a, b) => (b.RSSI || -100) - (a.RSSI || -100));
    
    this.setData({
      devices: newDevices,
      deviceIdMap: newDeviceIdMap,
      hasSpecialDevices: hasSpecialDevices,
      bluetoothState: '扫描中 (' + newDevices.length + ')'
    }, () => {
      // 在设备列表更新后，更新特殊设备和普通设备列表
      this.updateDeviceLists();
    });
    
    // 异步检查特殊设备并处理自动连接
    this._handleSpecialDeviceCheck(device);
  },

  /**
   * 同步处理设备发现
   * @param {Object} device 设备对象
   */
  _handleDeviceFoundSync(device) {
    // 更新最近发现的设备
    this.setData({
      lastDevice: {
        name: device.name || '未命名',
        deviceId: device.deviceId
      }
    });
    
    // 检查是否已存在该设备
    const devices = this.data.devices;
    const index = devices.findIndex(d => d.deviceId === device.deviceId);
    
    if (index >= 0) {
      // 设备已存在，更新信息
      if (devices[index].name !== device.name) {
        devices[index].name = device.name;
        this.setData({ devices });
        
        // 更新设备列表
        this.updateDeviceLists();
      }
      return;
    }
    
    // 添加设备到列表
    const newDevices = this.data.devices.concat([device]);
    const newDeviceIdMap = { ...this.data.deviceIdMap };
    newDeviceIdMap[device.deviceId] = true;
    
    // 按信号强度排序
    newDevices.sort((a, b) => (b.RSSI || -100) - (a.RSSI || -100));
    
    this.setData({
      devices: newDevices,
      deviceIdMap: newDeviceIdMap,
      bluetoothState: '扫描中 (' + newDevices.length + ')'
    }, () => {
      // 在设备列表更新后，更新设备分类
      this.updateDeviceLists();
    });
  },

  /**
   * 异步处理特殊设备检查
   * @param {Object} device 设备对象
   */
  async _handleSpecialDeviceCheck(device) {
    try {
      const isSpecial = await this.isSpecialDevice(device);
      console.log('是否特殊设备:', isSpecial);
      
      if (isSpecial) {
        // 更新有特殊设备标识
        this.setData({ hasSpecialDevices: true });
        
        // 如果开启了自动连接
        if (app.globalData.autoConnectSpecialDevice) {
          console.log('发现特殊设备，准备自动连接:', device.name);
          this.connectDevice(device);
        }
      }
    } catch (error) {
      console.error('特殊设备检查失败:', error);
    }
  },

  /**
   * 同步bluetoothManager中已存在的设备
   */
  syncExistingDevices() {
    console.log('🔄 同步已存在的设备...');
    
    // 获取bluetoothManager中的设备列表
    const existingDevices = bluetoothManager.getDevices ? bluetoothManager.getDevices() : bluetoothManager.devices || [];
    
    console.log('📋 bluetoothManager中的设备数量:', existingDevices.length);
    
    existingDevices.forEach(device => {
      if (device && device.deviceId) {
        console.log('🔍 检查设备:', device.name, device.deviceId);
        
        // 检查这个设备是否已经在页面的设备列表中
        const exists = this.data.devices.find(d => d.deviceId === device.deviceId);
        
        if (!exists) {
          console.log('➕ 添加遗漏的设备:', device.name);
          // 强制触发设备发现回调
          this.onDeviceFound(device);
        }
      }
    });
  },
  
  /**
   * 更新特殊设备和普通设备列表
   */
  async updateDeviceLists() {
    const devices = this.data.devices;
    const specialDevices = [];
    const normalDevices = [];
    
    // 异步检查每个设备是否为特殊设备
    for (const device of devices) {
      const isSpecial = await this.isSpecialDevice(device);
      if (isSpecial) {
        specialDevices.push(device);
      } else {
        normalDevices.push(device);
      }
    }
    
    this.setData({
      specialDevices: specialDevices,
      normalDevices: normalDevices
    });
  },

  /**
   * 连接设备
   * @param {Object} e 事件对象
   */
  onDeviceTap(e) {
    const deviceId = e.currentTarget.dataset.deviceId;
    const device = this.data.devices.find(d => d.deviceId === deviceId);
    
    if (!device) {
      wx.showToast({
        title: '设备不存在',
        icon: 'none'
      });
      return;
    }
    
    this.connectDevice(device);
  },
  
  /**
   * 连接指定设备
   * @param {Object} device 设备对象
   */
  connectDevice(device) {
    if (!device || !device.deviceId) {
      wx.showToast({
        title: '无效设备',
        icon: 'none'
      });
      return;
    }
    
    // 显示连接中提示
    wx.showLoading({
      title: '连接设备中...',
      mask: true
    });
    
    // 先停止扫描
    this.stopScan();
    
    console.log(`开始连接设备: ${device.name || '未知设备'}, ID: ${device.deviceId}`);
    
    // 连接设备
    bluetoothManager.connectDevice(
      device.deviceId,
      // 连接成功回调
      (res) => {
        wx.hideLoading();
        wx.showToast({
          title: '连接成功',
          icon: 'success'
        });
        
        // 存储已连接设备信息到全局数据
        app.globalData.connectedDevice = {
          deviceId: device.deviceId,
          name: device.name || '未知设备',
          macAddress: device.macAddress || '',
          timestamp: new Date().getTime()
        };
        
        // 将设备信息存储到本地缓存
        wx.setStorage({
          key: 'bindDevice',
          data: {
            deviceId: device.deviceId,
            name: device.name || '未知设备',
            macAddress: device.macAddress || ''
          }
        });
        
        console.log('已连接设备:', app.globalData.connectedDevice);
        
        // 延长等待时间，确保连接稳定
        setTimeout(() => {
          wx.navigateTo({
            url: '../control/control'
          });
        }, 3000); // 增加到3秒
      },
      // 断开连接回调
      (err) => {
        console.error('设备连接断开:', err);
        wx.showToast({
          title: '设备已断开',
          icon: 'none'
        });
      }
    ).catch(err => {
      wx.hideLoading();
      console.error('连接设备失败:', err);
      
      this.setData({
        errorMsg: '连接失败: ' + JSON.stringify(err)
      });
      
      wx.showModal({
        title: '连接失败',
        content: '请确保设备在范围内并处于可连接状态',
        showCancel: false
      });
    });
  },

  /**
   * 切换是否只显示耳机设备
   */
  onToggleFilterHeadphones() {
    this.setData({
      filterHeadphones: !this.data.filterHeadphones
    });
    
    if (this.data.scanning) {
      // 如果正在扫描，重新开始扫描
      this.stopScan();
      setTimeout(() => {
        this.startScan();
      }, 500);
    }
  },
  
  /**
   * 切换是否只显示BT开头的设备
   */
  onToggleFilterBTPrefix() {
    this.setData({
      filterBTPrefix: !this.data.filterBTPrefix
    });
    
    if (this.data.scanning) {
      // 如果正在扫描，重新开始扫描
      this.stopScan();
      setTimeout(() => {
        this.startScan();
      }, 500);
    }
  }
}) 