// 统一响应格式处理器
// 确保前后端响应格式一致

/**
 * 标准响应格式
 * {
 *   success: boolean,
 *   data: any,
 *   error?: string,
 *   code?: string,
 *   timestamp?: number
 * }
 */

/**
 * 格式化成功响应
 * @param {any} data - 响应数据
 * @param {string} message - 成功消息（可选）
 * @returns {object} 格式化后的响应
 */
function formatSuccess(data, message = null) {
  return {
    success: true,
    data: data,
    message: message,
    timestamp: Date.now()
  };
}

/**
 * 格式化错误响应
 * @param {string} error - 错误信息
 * @param {string} code - 错误代码（可选）
 * @param {any} details - 错误详情（可选）
 * @param {number} statusCode - HTTP状态码（可选）
 * @returns {object} 格式化后的错误响应
 */
function formatError(error, code = null, details = null, statusCode = null) {
  const result = {
    success: false,
    error: error,
    code: code,
    details: details,
    timestamp: Date.now()
  };
  
  // 🚀 保留statusCode以便错误处理逻辑使用
  if (statusCode !== null && statusCode !== undefined) {
    result.statusCode = statusCode;
  }
  
  return result;
}

/**
 * 标准化API响应
 * 处理不同格式的后端响应，统一为标准格式
 * @param {any} response - 原始响应
 * @returns {object} 标准化后的响应
 */
function standardizeResponse(response) {
  // 已经是标准格式
  if (response && typeof response.success === 'boolean') {
    return response;
  }

  // 处理直接返回数据的情况
  if (response && typeof response === 'object' && !response.hasOwnProperty('success')) {
    return formatSuccess(response);
  }

  // 处理错误情况
  if (!response) {
    return formatError('无响应数据');
  }

  // 处理字符串响应
  if (typeof response === 'string') {
    return formatSuccess({ message: response });
  }

  // 兜底返回
  return formatSuccess(response);
}

/**
 * 错误类型映射
 */
const ERROR_TYPES = {
  NETWORK_ERROR: '网络连接失败',
  HTTP_ERROR: 'HTTP请求错误',
  BUSINESS_ERROR: '业务逻辑错误',
  AUTH_ERROR: '认证失败',
  VALIDATION_ERROR: '参数验证失败',
  SERVER_ERROR: '服务器内部错误',
  TIMEOUT_ERROR: '请求超时',
  UNKNOWN_ERROR: '未知错误'
};

/**
 * 标准化错误处理
 * @param {Error|any} error - 错误对象
 * @returns {object} 标准化错误响应
 */
function standardizeError(error) {
  if (!error) {
    return formatError(ERROR_TYPES.UNKNOWN_ERROR, 'UNKNOWN_ERROR');
  }

  // 处理Error对象
  if (error instanceof Error) {
    const errorCode = error.code || 'UNKNOWN_ERROR';
    const errorMessage = error.message || ERROR_TYPES.UNKNOWN_ERROR;
    
    // 根据错误代码确定错误类型
    let standardMessage = errorMessage;
    if (ERROR_TYPES[errorCode]) {
      standardMessage = ERROR_TYPES[errorCode];
    }

    return formatError(
      standardMessage, 
      errorCode, 
      {
        originalMessage: errorMessage,
        stack: error.stack
      },
      error.statusCode  // 🚀 保留statusCode（如果存在）
    );
  }

  // 处理字符串错误
  if (typeof error === 'string') {
    return formatError(error, 'STRING_ERROR');
  }

  // 处理对象错误
  if (typeof error === 'object') {
    return formatError(
      error.message || error.error || '请求失败',
      error.code || 'OBJECT_ERROR',
      error,
      error.statusCode  // 🚀 保留原始的statusCode
    );
  }

  // 兜底处理
  return formatError(
    ERROR_TYPES.UNKNOWN_ERROR, 
    'UNKNOWN_ERROR', 
    error,
    error && error.statusCode  // 🚀 尝试保留statusCode
  );
}

/**
 * HTTP状态码到错误类型的映射
 */
const HTTP_ERROR_MAP = {
  400: { type: 'VALIDATION_ERROR', message: '请求参数错误' },
  401: { type: 'AUTH_ERROR', message: '认证失败，请重新登录' },
  403: { type: 'AUTH_ERROR', message: '权限不足' },
  404: { type: 'HTTP_ERROR', message: '请求的资源不存在' },
  408: { type: 'TIMEOUT_ERROR', message: '请求超时' },
  429: { type: 'HTTP_ERROR', message: '请求频率过高，请稍后重试' },
  500: { type: 'SERVER_ERROR', message: '服务器内部错误' },
  502: { type: 'SERVER_ERROR', message: '网关错误' },
  503: { type: 'SERVER_ERROR', message: '服务暂时不可用' },
  504: { type: 'TIMEOUT_ERROR', message: '网关超时' }
};

/**
 * 根据HTTP状态码标准化错误
 * @param {number} statusCode - HTTP状态码
 * @param {string} originalMessage - 原始错误消息
 * @returns {object} 标准化错误响应
 */
function standardizeHttpError(statusCode, originalMessage = '') {
  const errorInfo = HTTP_ERROR_MAP[statusCode] || {
    type: 'HTTP_ERROR',
    message: `HTTP错误 ${statusCode}`
  };

  return formatError(
    originalMessage || errorInfo.message,
    errorInfo.type,
    { statusCode, originalMessage },
    statusCode  // 🚀 传递statusCode到顶层
  );
}

/**
 * 响应拦截器
 * 在API调用返回时自动标准化响应格式
 * @param {any} response - 原始响应
 * @param {object} options - 选项
 * @returns {object} 标准化响应
 */
function responseInterceptor(response, options = {}) {
  const { autoFormat = true, logErrors = true } = options;

  try {
    // 成功响应标准化
    const standardResponse = autoFormat ? standardizeResponse(response) : response;
    
    // 记录成功响应（调试模式）
    if (options.debug) {
      console.log('API响应:', standardResponse);
    }

    return standardResponse;
  } catch (error) {
    // 处理标准化过程中的错误
    if (logErrors) {
      console.error('响应标准化失败:', error);
    }

    return formatError('响应处理失败', 'RESPONSE_FORMAT_ERROR', error);
  }
}

/**
 * 错误拦截器
 * 在API调用出错时自动标准化错误格式
 * @param {any} error - 原始错误
 * @param {object} options - 选项
 * @returns {object} 标准化错误响应
 */
function errorInterceptor(error, options = {}) {
  const { logErrors = true, showToast = false } = options;

  const standardError = standardizeError(error);

  // 记录错误
  if (logErrors) {
    console.error('API错误:', standardError);
  }

  // 显示错误提示
  if (showToast && wx.showToast) {
    wx.showToast({
      title: standardError.error,
      icon: 'none',
      duration: 2000
    });
  }

  return standardError;
}

/**
 * 数据验证辅助函数
 */
const DataValidator = {
  /**
   * 验证必需字段
   * @param {object} data - 数据对象
   * @param {array} requiredFields - 必需字段列表
   * @returns {object|null} 验证错误或null
   */
  validateRequired(data, requiredFields) {
    if (!data || typeof data !== 'object') {
      return formatError('数据格式错误', 'VALIDATION_ERROR');
    }

    for (const field of requiredFields) {
      if (!data.hasOwnProperty(field) || data[field] === null || data[field] === undefined) {
        return formatError(`缺少必需字段: ${field}`, 'VALIDATION_ERROR');
      }
    }

    return null;
  },

  /**
   * 验证数据类型
   * @param {any} value - 值
   * @param {string} expectedType - 期望类型
   * @param {string} fieldName - 字段名
   * @returns {object|null} 验证错误或null
   */
  validateType(value, expectedType, fieldName) {
    const actualType = typeof value;
    if (actualType !== expectedType) {
      return formatError(
        `字段 ${fieldName} 类型错误，期望 ${expectedType}，实际 ${actualType}`,
        'VALIDATION_ERROR'
      );
    }
    return null;
  }
};

module.exports = {
  formatSuccess,
  formatError,
  standardizeResponse,
  standardizeError,
  standardizeHttpError,
  responseInterceptor,
  errorInterceptor,
  DataValidator,
  ERROR_TYPES,
  HTTP_ERROR_MAP
};
