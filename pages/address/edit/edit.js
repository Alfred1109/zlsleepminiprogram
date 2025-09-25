const productApi = require('../../../utils/productApi')

Page({
  data: {
    mode: 'create', // create 或 edit
    addressId: '',
    redirectUrl: '',
    
    // 表单数据
    formData: {
      name: '',
      phone: '',
      province: '',
      city: '',
      district: '',
      detail: '',
      tag: '',
      isDefault: false
    },
    
    // 区域选择
    regionArray: [],
    regionIndex: [0, 0, 0],
    showRegionPicker: false,
    
    // 标签选择
    tagOptions: [
      { value: '', label: '无标签' },
      { value: '家', label: '家' },
      { value: '公司', label: '公司' },
      { value: '学校', label: '学校' },
      { value: '其他', label: '其他' }
    ],
    showTagPicker: false,
    
    // 提交状态
    isSubmitting: false,
    
    // 加载状态
    loading: false
  },

  onLoad(options) {
    console.log('地址编辑页面参数:', options)
    
    const { mode = 'create', id, redirect } = options
    
    this.setData({
      mode,
      addressId: id || '',
      redirectUrl: redirect || ''
    })
    
    // 初始化页面
    this.initPage()
  },

  // 初始化页面
  async initPage() {
    try {
      // 初始化区域数据
      await this.initRegionData()
      
      // 如果是编辑模式，加载地址详情
      if (this.data.mode === 'edit' && this.data.addressId) {
        await this.loadAddressDetail()
      }
    } catch (error) {
      console.error('初始化页面失败:', error)
      wx.showToast({
        title: '初始化失败',
        icon: 'error'
      })
    }
  },

  // 初始化区域数据
  async initRegionData() {
    try {
      // 这里应该从API或本地获取省市区数据
      // 暂时使用模拟数据
      const regionArray = [
        ['北京市', '上海市', '广东省', '浙江省', '江苏省', '四川省'],
        ['北京市', '海淀区', '朝阳区', '西城区', '东城区'],
        ['海淀区', '朝阳区', '西城区', '东城区', '丰台区']
      ]
      
      this.setData({ regionArray })
    } catch (error) {
      console.error('初始化区域数据失败:', error)
    }
  },

  // 加载地址详情
  async loadAddressDetail() {
    this.setData({ loading: true })
    
    try {
      const response = await productApi.getAddressDetail(this.data.addressId)
      
      if (response.success) {
        const addressData = response.data
        
        this.setData({
          formData: {
            name: addressData.name || '',
            phone: addressData.phone || '',
            province: addressData.province || '',
            city: addressData.city || '',
            district: addressData.district || '',
            detail: addressData.detail || '',
            tag: addressData.tag || '',
            isDefault: addressData.isDefault || false
          }
        })
        
        // 更新区域选择器的选中状态
        this.updateRegionIndex()
      } else {
        throw new Error(response.error || '加载地址详情失败')
      }
    } catch (error) {
      console.error('加载地址详情失败:', error)
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'error',
        complete: () => {
          wx.navigateBack()
        }
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 更新区域选择器索引
  updateRegionIndex() {
    const { formData, regionArray } = this.data
    const regionIndex = [0, 0, 0]
    
    // 查找省份索引
    const provinceIndex = regionArray[0].findIndex(item => item === formData.province)
    if (provinceIndex > -1) {
      regionIndex[0] = provinceIndex
    }
    
    // 查找城市索引
    const cityIndex = regionArray[1].findIndex(item => item === formData.city)
    if (cityIndex > -1) {
      regionIndex[1] = cityIndex
    }
    
    // 查找区域索引
    const districtIndex = regionArray[2].findIndex(item => item === formData.district)
    if (districtIndex > -1) {
      regionIndex[2] = districtIndex
    }
    
    this.setData({ regionIndex })
  },

  // 表单输入处理
  onNameInput(e) {
    this.setData({
      'formData.name': e.detail.value
    })
  },

  onPhoneInput(e) {
    this.setData({
      'formData.phone': e.detail.value
    })
  },

  onDetailInput(e) {
    this.setData({
      'formData.detail': e.detail.value
    })
  },

  // 区域选择
  showRegionPicker() {
    this.setData({ showRegionPicker: true })
  },

  hideRegionPicker() {
    this.setData({ showRegionPicker: false })
  },

  onRegionColumnChange(e) {
    const { column, value } = e.detail
    const regionIndex = [...this.data.regionIndex]
    regionIndex[column] = value
    
    // 这里应该根据选择的省市更新下级区域数据
    // 暂时只更新索引
    this.setData({ regionIndex })
  },

  onRegionConfirm(e) {
    const { value } = e.detail
    const { regionArray } = this.data
    
    this.setData({
      regionIndex: value,
      'formData.province': regionArray[0][value[0]],
      'formData.city': regionArray[1][value[1]],
      'formData.district': regionArray[2][value[2]],
      showRegionPicker: false
    })
  },

  // 标签选择
  showTagPicker() {
    this.setData({ showTagPicker: true })
  },

  hideTagPicker() {
    this.setData({ showTagPicker: false })
  },

  onTagSelect(e) {
    const tag = e.currentTarget.dataset.value
    this.setData({
      'formData.tag': tag,
      showTagPicker: false
    })
  },

  // 设为默认地址
  toggleDefault() {
    this.setData({
      'formData.isDefault': !this.data.formData.isDefault
    })
  },

  // 表单验证
  validateForm() {
    const { formData } = this.data
    
    if (!formData.name.trim()) {
      wx.showToast({
        title: '请输入收货人姓名',
        icon: 'error'
      })
      return false
    }
    
    if (!formData.phone.trim()) {
      wx.showToast({
        title: '请输入手机号码',
        icon: 'error'
      })
      return false
    }
    
    // 手机号格式验证
    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(formData.phone)) {
      wx.showToast({
        title: '请输入正确的手机号码',
        icon: 'error'
      })
      return false
    }
    
    if (!formData.province || !formData.city || !formData.district) {
      wx.showToast({
        title: '请选择所在地区',
        icon: 'error'
      })
      return false
    }
    
    if (!formData.detail.trim()) {
      wx.showToast({
        title: '请输入详细地址',
        icon: 'error'
      })
      return false
    }
    
    return true
  },

  // 保存地址
  async saveAddress() {
    if (this.data.isSubmitting) return
    
    if (!this.validateForm()) {
      return
    }
    
    this.setData({ isSubmitting: true })
    
    try {
      const { mode, addressId, formData } = this.data
      
      let response
      if (mode === 'create') {
        response = await productApi.addAddress(formData)
      } else {
        response = await productApi.updateAddress(addressId, formData)
      }
      
      if (response.success) {
        wx.showToast({
          title: mode === 'create' ? '添加成功' : '保存成功',
          icon: 'success',
          success: () => {
            setTimeout(() => {
              if (this.data.redirectUrl) {
                wx.redirectTo({
                  url: decodeURIComponent(this.data.redirectUrl)
                })
              } else {
                wx.navigateBack()
              }
            }, 1500)
          }
        })
      } else {
        throw new Error(response.error || '保存失败')
      }
    } catch (error) {
      console.error('保存地址失败:', error)
      wx.showToast({
        title: error.message || '保存失败，请重试',
        icon: 'error'
      })
    } finally {
      this.setData({ isSubmitting: false })
    }
  },

  // 获取当前位置
  async getCurrentLocation() {
    try {
      wx.showLoading({
        title: '获取位置中...',
        mask: true
      })
      
      // 获取用户授权
      const authResult = await new Promise((resolve) => {
        wx.getSetting({
          success: (res) => {
            if (res.authSetting['scope.userLocation']) {
              resolve(true)
            } else {
              wx.authorize({
                scope: 'scope.userLocation',
                success: () => resolve(true),
                fail: () => resolve(false)
              })
            }
          },
          fail: () => resolve(false)
        })
      })
      
      if (!authResult) {
        wx.showModal({
          title: '需要位置权限',
          content: '获取当前位置需要您的位置权限，请在设置中开启',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting()
            }
          }
        })
        return
      }
      
      // 获取当前位置
      const location = await new Promise((resolve, reject) => {
        wx.getLocation({
          type: 'gcj02',
          success: resolve,
          fail: reject
        })
      })
      
      // 逆地理编码获取地址信息
      // 这里应该调用地图API进行逆地理编码
      // 暂时使用模拟数据
      const addressInfo = {
        province: '北京市',
        city: '北京市',
        district: '海淀区',
        detail: '中关村软件园'
      }
      
      this.setData({
        'formData.province': addressInfo.province,
        'formData.city': addressInfo.city,
        'formData.district': addressInfo.district,
        'formData.detail': addressInfo.detail
      })
      
      // 更新区域选择器
      this.updateRegionIndex()
      
      wx.showToast({
        title: '位置获取成功',
        icon: 'success'
      })
      
    } catch (error) {
      console.error('获取位置失败:', error)
      wx.showToast({
        title: '获取位置失败',
        icon: 'error'
      })
    } finally {
      wx.hideLoading()
    }
  }
})
