// 前后端数据模型映射器
// 确保前后端数据格式一致

/**
 * 用户数据映射
 */
const UserMapper = {
  /**
   * 后端用户数据转前端格式
   * @param {object} backendUser - 后端用户数据
   * @returns {object} 前端用户数据格式
   */
  fromBackend(backendUser) {
    if (!backendUser) return null;
    
    return {
      id: backendUser.id,
      username: backendUser.username,
      nickname: backendUser.nickname || backendUser.username,
      avatarUrl: backendUser.avatar_url || '',
      phone: backendUser.phone || '',
      isGuest: backendUser.is_guest || false,
      openid: backendUser.openid || '',
      unionid: backendUser.unionid || '',
      deviceId: backendUser.device_id || '',
      
      // 订阅信息
      subscriptionType: backendUser.subscription_type || 'free',
      subscriptionStatus: backendUser.subscription_status || 'inactive',
      subscriptionStartDate: backendUser.subscription_start_date,
      subscriptionEndDate: backendUser.subscription_end_date,
      trialUsed: backendUser.trial_used || false,
      trialEndDate: backendUser.trial_end_date,
      
      // 权限
      permissions: backendUser.permissions || ['user'],
      roleId: backendUser.role_id,
      
      // 时间戳
      createdAt: backendUser.created_at,
      lastLogin: backendUser.last_login,
      registerTime: backendUser.register_time
    };
  },

  /**
   * 前端用户数据转后端格式
   * @param {object} frontendUser - 前端用户数据
   * @returns {object} 后端用户数据格式
   */
  toBackend(frontendUser) {
    if (!frontendUser) return null;
    
    return {
      id: frontendUser.id,
      username: frontendUser.username,
      nickname: frontendUser.nickname,
      avatar_url: frontendUser.avatarUrl,
      phone: frontendUser.phone,
      is_guest: frontendUser.isGuest,
      openid: frontendUser.openid,
      unionid: frontendUser.unionid,
      device_id: frontendUser.deviceId,
      subscription_type: frontendUser.subscriptionType,
      subscription_status: frontendUser.subscriptionStatus,
      subscription_start_date: frontendUser.subscriptionStartDate,
      subscription_end_date: frontendUser.subscriptionEndDate,
      trial_used: frontendUser.trialUsed,
      trial_end_date: frontendUser.trialEndDate,
      permissions: frontendUser.permissions,
      role_id: frontendUser.roleId
    };
  }
};

/**
 * 音乐数据映射
 */
const MusicMapper = {
  /**
   * 后端音乐数据转前端格式
   * @param {object} backendMusic - 后端音乐数据
   * @returns {object} 前端音乐数据格式
   */
  fromBackend(backendMusic) {
    if (!backendMusic) return null;
    
    return {
      id: backendMusic.id,
      title: backendMusic.title || backendMusic.name || '未知音乐',
      name: backendMusic.name || backendMusic.title || '未知音乐',
      
      // 文件信息 - 优先使用带token的url字段
      url: backendMusic.url || backendMusic.file_url || backendMusic.path,
      path: backendMusic.file_path || backendMusic.path,
      backupPath: backendMusic.backup_path,
      fileName: backendMusic.file_name,
      fileSize: backendMusic.file_size,
      
      // 音频属性
      duration: backendMusic.duration_seconds || backendMusic.duration || 0,
      durationSeconds: backendMusic.duration_seconds || backendMusic.duration || 0,
      audioFormat: backendMusic.audio_format || 'mp3',
      
      // 音乐特征
      tempo: backendMusic.tempo,
      keySignature: backendMusic.key_signature,
      timeSignature: backendMusic.time_signature,
      style: backendMusic.style || 'healing',
      
      // 分类信息
      category: backendMusic.category || backendMusic.category_name || '未分类',
      categoryId: backendMusic.category_id,
      tags: backendMusic.tags || [],
      
      // 封面图片
      image: backendMusic.image || backendMusic.cover || '/assets/images/default-image.png',
      cover: backendMusic.cover || backendMusic.image,
      
      // 状态信息
      status: backendMusic.status || 'unknown',
      storageType: backendMusic.storage_type || 'local',
      
      // 生成参数（AI音乐）
      generationParams: backendMusic.generation_params,
      assessmentId: backendMusic.assessment_id,
      
      // 异步任务信息
      celeryTaskId: backendMusic.celery_task_id,
      errorMessage: backendMusic.error_message,
      
      // 时间戳
      createdAt: backendMusic.created_at,
      completedAt: backendMusic.completed_at,
      
      // 播放统计
      playCount: backendMusic.play_count || 0,
      plays: backendMusic.plays || backendMusic.play_count || 0,
      
      // 扩展字段
      type: backendMusic.type || 'music',
      source: backendMusic.source || 'unknown',
      isUserGenerated: backendMusic.is_user_generated || false,
      expiresAt: backendMusic.expires_at
    };
  },

  /**
   * 前端音乐数据转后端格式
   * @param {object} frontendMusic - 前端音乐数据
   * @returns {object} 后端音乐数据格式
   */
  toBackend(frontendMusic) {
    if (!frontendMusic) return null;
    
    return {
      id: frontendMusic.id,
      title: frontendMusic.title || frontendMusic.name,
      name: frontendMusic.name || frontendMusic.title,
      file_path: frontendMusic.path || frontendMusic.url,
      file_url: frontendMusic.url,
      backup_path: frontendMusic.backupPath,
      file_size: frontendMusic.fileSize,
      duration_seconds: frontendMusic.durationSeconds || frontendMusic.duration,
      audio_format: frontendMusic.audioFormat,
      tempo: frontendMusic.tempo,
      key_signature: frontendMusic.keySignature,
      time_signature: frontendMusic.timeSignature,
      style: frontendMusic.style,
      category_id: frontendMusic.categoryId,
      image: frontendMusic.image || frontendMusic.cover,
      status: frontendMusic.status,
      storage_type: frontendMusic.storageType,
      generation_params: frontendMusic.generationParams,
      assessment_id: frontendMusic.assessmentId,
      type: frontendMusic.type,
      expires_at: frontendMusic.expiresAt
    };
  }
};

/**
 * 评测数据映射
 */
const AssessmentMapper = {
  /**
   * 后端评测数据转前端格式
   */
  fromBackend(backendAssessment) {
    if (!backendAssessment) return null;
    
    return {
      id: backendAssessment.id,
      userId: backendAssessment.user_id,
      scaleId: backendAssessment.scale_id,
      scaleName: backendAssessment.scale_name,
      
      // 得分信息
      totalScore: backendAssessment.total_score,
      maxScore: backendAssessment.max_score,
      scorePercentage: backendAssessment.score_percentage,
      
      // 情绪参数
      valenceScore: backendAssessment.valence_score,
      arousalScore: backendAssessment.arousal_score,
      dominanceScore: backendAssessment.dominance_score,
      
      // 结果信息
      interpretation: backendAssessment.interpretation,
      therapyGoals: backendAssessment.therapy_goals,
      detailedResults: backendAssessment.detailed_results,
      
      // 状态
      status: backendAssessment.status || 'in_progress',
      
      // 时间戳
      createdAt: backendAssessment.created_at,
      completedAt: backendAssessment.completed_at,
      
      // 关联数据
      answers: backendAssessment.answers,
      generatedMusic: backendAssessment.generated_music
    };
  },

  /**
   * 前端评测数据转后端格式
   */
  toBackend(frontendAssessment) {
    if (!frontendAssessment) return null;
    
    return {
      id: frontendAssessment.id,
      user_id: frontendAssessment.userId,
      scale_id: frontendAssessment.scaleId,
      total_score: frontendAssessment.totalScore,
      valence_score: frontendAssessment.valenceScore,
      arousal_score: frontendAssessment.arousalScore,
      dominance_score: frontendAssessment.dominanceScore,
      interpretation: frontendAssessment.interpretation,
      therapy_goals: frontendAssessment.therapyGoals,
      detailed_results: frontendAssessment.detailedResults,
      status: frontendAssessment.status
    };
  }
};

/**
 * 分类数据映射（支持新的music_categories字段）
 */
const CategoryMapper = {
  /**
   * 后端分类数据转前端格式
   */
  fromBackend(backendCategory) {
    if (!backendCategory) return null;
    
    return {
      // 🔧 统一字段名称（优先使用新字段）
      id: backendCategory.category_id || backendCategory.id,
      categoryId: backendCategory.category_id || backendCategory.id,
      name: backendCategory.category_name || backendCategory.name,
      categoryName: backendCategory.category_name || backendCategory.name,
      code: backendCategory.category_code || backendCategory.code,
      categoryCode: backendCategory.category_code || backendCategory.code,
      
      // 保持兼容性的字段
      description: backendCategory.description,
      icon: backendCategory.icon || backendCategory.emoji_code,
      emojiCode: backendCategory.emoji_code,
      tags: backendCategory.tags || [],
      musicCount: backendCategory.music_count || backendCategory.count || 0,
      count: backendCategory.count || backendCategory.music_count || 0,
      
      // 新字段：映射相关
      weight: backendCategory.weight,
      isPrimary: backendCategory.is_primary,
      
      // 存储配置
      storageInfo: backendCategory.storage_info,
      qiniuPrefix: backendCategory.storage_info?.qiniu_prefix,
      localPath: backendCategory.storage_info?.local_path,
      autoCache: backendCategory.storage_info?.auto_cache,
      
      // 扩展字段
      type: backendCategory.type || 'audio_file',
      isActive: backendCategory.is_active !== false
    };
  },
  
  /**
   * 前端分类数据转后端格式
   */
  toBackend(frontendCategory) {
    if (!frontendCategory) return null;
    
    return {
      category_id: frontendCategory.categoryId || frontendCategory.id,
      category_name: frontendCategory.categoryName || frontendCategory.name,
      category_code: frontendCategory.categoryCode || frontendCategory.code,
      description: frontendCategory.description,
      icon: frontendCategory.icon,
      weight: frontendCategory.weight,
      is_primary: frontendCategory.isPrimary
    };
  }
};

/**
 * 设备数据映射
 */
const DeviceMapper = {
  /**
   * 后端设备数据转前端格式
   */
  fromBackend(backendDevice) {
    if (!backendDevice) return null;
    
    return {
      id: backendDevice.id,
      userId: backendDevice.user_id,
      deviceType: backendDevice.device_type,
      deviceName: backendDevice.device_name,
      deviceModel: backendDevice.device_model,
      macAddress: backendDevice.mac_address,
      
      // 音频配置
      audioProfile: backendDevice.audio_profile,
      
      // 连接状态
      lastConnected: backendDevice.last_connected,
      isActive: backendDevice.is_active,
      batteryLevel: backendDevice.battery_level,
      
      // 使用统计
      totalUsageHours: backendDevice.total_usage_hours,
      connectionCount: backendDevice.connection_count,
      
      // 时间戳
      createdAt: backendDevice.created_at
    };
  }
};

/**
 * 订阅数据映射
 */
const SubscriptionMapper = {
  /**
   * 后端订阅数据转前端格式
   */
  fromBackend(backendSub) {
    if (!backendSub) return null;
    
    return {
      id: backendSub.id,
      userId: backendSub.user_id,
      planType: backendSub.plan_type || backendSub.subscription_type,
      status: backendSub.status || backendSub.subscription_status,
      startDate: backendSub.start_date || backendSub.subscription_start_date,
      endDate: backendSub.end_date || backendSub.subscription_end_date,
      autoRenew: backendSub.auto_renew,
      
      // 试用信息
      trialUsed: backendSub.trial_used,
      trialEndDate: backendSub.trial_end_date,
      
      // 价格信息
      price: backendSub.price,
      currency: backendSub.currency || 'CNY',
      
      // 时间戳
      createdAt: backendSub.created_at,
      updatedAt: backendSub.updated_at
    };
  }
};

/**
 * 统一数据映射器
 */
const DataMapper = {
  User: UserMapper,
  Music: MusicMapper,
  Assessment: AssessmentMapper,
  Category: CategoryMapper,
  Device: DeviceMapper,
  Subscription: SubscriptionMapper,
  
  /**
   * 批量映射数据
   * @param {array} dataList - 数据列表
   * @param {object} mapper - 映射器
   * @param {string} direction - 映射方向 'fromBackend' | 'toBackend'
   * @returns {array} 映射后的数据列表
   */
  mapList(dataList, mapper, direction = 'fromBackend') {
    if (!Array.isArray(dataList)) return [];
    
    return dataList.map(item => mapper[direction](item)).filter(item => item !== null);
  },

  /**
   * 安全映射（忽略错误）
   * @param {any} data - 原始数据
   * @param {object} mapper - 映射器
   * @param {string} direction - 映射方向
   * @returns {any} 映射后的数据或null
   */
  safeMap(data, mapper, direction = 'fromBackend') {
    try {
      return mapper[direction](data);
    } catch (error) {
      console.warn('数据映射失败:', error);
      return null;
    }
  }
};

module.exports = {
  DataMapper,
  UserMapper,
  MusicMapper,
  AssessmentMapper,
  CategoryMapper,
  DeviceMapper,
  SubscriptionMapper
};
