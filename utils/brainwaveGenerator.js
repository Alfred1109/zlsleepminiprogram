// 脑波频率波形生成算法
const audioContext = wx.createWebAudioContext();

/**
 * 创建基本的双耳节拍脑波
 * @param {number} baseFrequency - 基础频率(Hz)
 * @param {number} beatFrequency - 节拍频率(Hz)
 * @param {number} duration - 持续时间(秒)
 * @param {number} volume - 音量(0-1)
 * @returns {AudioBuffer} - 生成的音频buffer
 */
const createBinauralBeat = (baseFrequency, beatFrequency, duration, volume = 0.5) => {
  // 为提高性能，限制生成的音频长度，实际播放时会循环
  const maxDuration = Math.min(duration, 10); // 最多生成10秒的音频，减少计算量
  
  const sampleRate = audioContext.sampleRate;
  const frameCount = sampleRate * maxDuration;
  const audioBuffer = audioContext.createBuffer(2, frameCount, sampleRate);
  
  // 获取左右声道数据
  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = audioBuffer.getChannelData(1);
  
  // 左声道使用基础频率
  const leftFrequency = baseFrequency;
  // 右声道使用基础频率+节拍频率，产生双耳节拍效果
  const rightFrequency = baseFrequency + beatFrequency;
  
  // 预计算常量，减少循环中的计算量
  const leftCoef = 2 * Math.PI * leftFrequency / sampleRate;
  const rightCoef = 2 * Math.PI * rightFrequency / sampleRate;
  
  // 填充音频数据
  for (let i = 0; i < frameCount; i++) {
    // 使用预计算的系数，减少每次循环的计算量
    leftChannel[i] = Math.sin(i * leftCoef) * volume;
    rightChannel[i] = Math.sin(i * rightCoef) * volume;
  }
  
  return audioBuffer;
};

/**
 * 创建带有淡入淡出效果的脑波
 * @param {AudioBuffer} audioBuffer - 原始音频buffer
 * @param {number} fadeInDuration - 淡入时间(秒)
 * @param {number} fadeOutDuration - 淡出时间(秒)
 * @returns {AudioBuffer} - 处理后的音频buffer
 */
const applyFade = (audioBuffer, fadeInDuration, fadeOutDuration) => {
  const sampleRate = audioBuffer.sampleRate;
  const fadeInSamples = Math.floor(fadeInDuration * sampleRate);
  const fadeOutSamples = Math.floor(fadeOutDuration * sampleRate);
  
  // 处理所有声道
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    const bufferLength = channelData.length;
    
    // 应用淡入效果
    for (let i = 0; i < fadeInSamples; i++) {
      const gain = i / fadeInSamples;
      channelData[i] *= gain;
    }
    
    // 应用淡出效果
    for (let i = 0; i < fadeOutSamples; i++) {
      const gain = (fadeOutSamples - i) / fadeOutSamples;
      channelData[bufferLength - 1 - i] *= gain;
    }
  }
  
  return audioBuffer;
};

/**
 * 创建带有自然变化的脑波
 * @param {AudioBuffer} audioBuffer - 原始音频buffer
 * @param {number} modulationRate - 调制速率(Hz)
 * @param {number} modulationDepth - 调制深度(0-1)
 * @returns {AudioBuffer} - 处理后的音频buffer
 */
const applyModulation = (audioBuffer, modulationRate, modulationDepth) => {
  const sampleRate = audioBuffer.sampleRate;
  
  // 处理所有声道
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    
    // 应用振幅调制
    for (let i = 0; i < channelData.length; i++) {
      const time = i / sampleRate;
      const modulationFactor = 1 - modulationDepth * (0.5 + 0.5 * Math.sin(2 * Math.PI * modulationRate * time));
      channelData[i] *= modulationFactor;
    }
  }
  
  return audioBuffer;
};

/**
 * 创建助眠安神的Delta波
 * @param {number} duration - 持续时间(秒)
 * @returns {AudioBuffer} - 生成的音频buffer
 */
const createDeltaSleepWave = (duration) => {
  // Delta波频率范围: 0.5-4Hz，这里使用2Hz
  const baseFrequency = 200; // 载波频率
  const beatFrequency = 2; // 目标脑波频率
  
  // 创建基础双耳节拍
  let audioBuffer = createBinauralBeat(baseFrequency, beatFrequency, duration, 0.4);
  
  // 应用淡入淡出效果
  audioBuffer = applyFade(audioBuffer, 5, 5);
  
  // 应用缓慢的振幅调制，使声音更自然
  audioBuffer = applyModulation(audioBuffer, 0.05, 0.2);
  
  return audioBuffer;
};

/**
 * 创建助眠安神的Theta波
 * @param {number} duration - 持续时间(秒)
 * @returns {AudioBuffer} - 生成的音频buffer
 */
const createThetaRelaxWave = (duration) => {
  // Theta波频率范围: 4-8Hz，这里使用6Hz
  const baseFrequency = 220; // 载波频率
  const beatFrequency = 6; // 目标脑波频率
  
  // 创建基础双耳节拍
  let audioBuffer = createBinauralBeat(baseFrequency, beatFrequency, duration, 0.35);
  
  // 应用淡入淡出效果
  audioBuffer = applyFade(audioBuffer, 4, 4);
  
  // 应用缓慢的振幅调制
  audioBuffer = applyModulation(audioBuffer, 0.08, 0.25);
  
  return audioBuffer;
};

/**
 * 创建放松状态的Alpha波
 * @param {number} duration - 持续时间(秒)
 * @returns {AudioBuffer} - 生成的音频buffer
 */
const createAlphaRelaxWave = (duration) => {
  // Alpha波频率范围: 8-13Hz，这里使用10Hz
  const baseFrequency = 240; // 载波频率
  const beatFrequency = 10; // 目标脑波频率
  
  // 创建基础双耳节拍
  let audioBuffer = createBinauralBeat(baseFrequency, beatFrequency, duration, 0.3);
  
  // 应用淡入淡出效果
  audioBuffer = applyFade(audioBuffer, 3, 3);
  
  // 应用缓慢的振幅调制
  audioBuffer = applyModulation(audioBuffer, 0.1, 0.15);
  
  return audioBuffer;
};

/**
 * 创建专注状态的Beta波
 * @param {number} duration - 持续时间(秒)
 * @returns {AudioBuffer} - 生成的音频buffer
 */
const createBetaFocusWave = (duration) => {
  // Beta波频率范围: 13-30Hz，这里使用20Hz
  const baseFrequency = 280; // 载波频率
  const beatFrequency = 20; // 目标脑波频率
  
  // 创建基础双耳节拍
  let audioBuffer = createBinauralBeat(baseFrequency, beatFrequency, duration, 0.25);
  
  // 应用淡入淡出效果
  audioBuffer = applyFade(audioBuffer, 2, 2);
  
  // 应用较快的振幅调制，增强专注感
  audioBuffer = applyModulation(audioBuffer, 0.15, 0.1);
  
  return audioBuffer;
};

/**
 * 创建助眠安神组合波 - 特殊设计的Delta和Theta波组合
 * @param {number} duration - 持续时间(秒)
 * @returns {AudioBuffer} - 生成的音频buffer
 */
const createSleepAidWave = (duration) => {
  const sampleRate = audioContext.sampleRate;
  const frameCount = sampleRate * duration;
  const audioBuffer = audioContext.createBuffer(2, frameCount, sampleRate);
  
  // 获取左右声道数据
  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = audioBuffer.getChannelData(1);
  
  // 左声道: Delta波(2Hz)
  const leftBaseFreq = 200;
  const leftBeatFreq = 2;
  
  // 右声道: Theta波(6Hz)
  const rightBaseFreq = 220;
  const rightBeatFreq = 6;
  
  // 填充音频数据
  for (let i = 0; i < frameCount; i++) {
    const time = i / sampleRate;
    
    // 时间相关的音量变化，创建节奏感
    const volumeModulation = 0.8 + 0.2 * Math.sin(2 * Math.PI * 0.1 * time);
    
    // 左声道: Delta波
    leftChannel[i] = 0.4 * Math.sin(2 * Math.PI * leftBaseFreq * time) * volumeModulation;
    
    // 右声道: Theta波
    rightChannel[i] = 0.3 * Math.sin(2 * Math.PI * (rightBaseFreq + rightBeatFreq) * time) * volumeModulation;
    
    // 添加交叉调制，让两个声道互相影响，创造更丰富的声音体验
    if (i > 0) {
      leftChannel[i] += 0.1 * rightChannel[i-1];
      rightChannel[i] += 0.1 * leftChannel[i-1];
    }
  }
  
  // 应用淡入淡出效果
  return applyFade(audioBuffer, 8, 10);
};

/**
 * 根据脑波类型生成对应的波形
 * @param {string} type - 脑波类型
 * @param {Object} params - 参数对象
 * @returns {AudioBuffer} - 生成的音频buffer
 */
const generateBrainwave = (type, params = {}) => {
  const { duration = 60, baseFreq, beatFreq } = params;
  
  switch (type) {
    case 'delta':
      return createDeltaSleepWave(duration);
    case 'theta':
      return createThetaRelaxWave(duration);
    case 'alpha':
      return createAlphaRelaxWave(duration);
    case 'beta':
      return createBetaFocusWave(duration);
    case 'sleep_aid':
      return createSleepAidWave(duration);
    default:
      // 默认创建自定义双耳节拍
      return createBinauralBeat(
        baseFreq || 200,
        beatFreq || 4,
        duration,
        0.4
      );
  }
};

/**
 * 播放脑波音频
 * @param {string} type - 脑波类型
 * @param {Object} params - 参数对象
 * @returns {Object} - 包含控制方法的对象
 */
const playBrainwave = (type, params = {}) => {
  // 使用缓存机制，避免重复生成相同类型的脑波
  if (!playBrainwave.bufferCache) {
    playBrainwave.bufferCache = {};
  }
  
  // 创建缓存键
  const cacheKey = `${type}_${params.baseFreq || 0}_${params.beatFreq || 0}`;
  
  // 检查缓存中是否已有此类型的音频buffer
  let audioBuffer;
  if (playBrainwave.bufferCache[cacheKey]) {
    audioBuffer = playBrainwave.bufferCache[cacheKey];
    // 只在首次使用缓存时输出日志
    if (!playBrainwave.loggedCache) playBrainwave.loggedCache = new Set();
    if (!playBrainwave.loggedCache.has(cacheKey)) {
      console.log('🧠 使用缓存的脑波音频:', type);
      playBrainwave.loggedCache.add(cacheKey);
    }
  } else {
    // 生成新的音频buffer并缓存
    audioBuffer = generateBrainwave(type, params);
    playBrainwave.bufferCache[cacheKey] = audioBuffer;
    console.log('🧠 生成新的脑波音频:', type);
  }
  
  let source = audioContext.createBufferSource();
  const gainNode = audioContext.createGain();
  
  source.buffer = audioBuffer;
  source.loop = true;
  source.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  source.start();
  
  // 创建控制对象
  const controller = {
    stop: () => {
      try {
        source.stop();
      } catch (e) {
        console.log('停止播放时出错:', e);
      }
    },
    setVolume: (volume) => {
      // 使用指数渐变，避免爆音
      gainNode.gain.exponentialRampToValueAtTime(
        volume, 
        audioContext.currentTime + 0.1
      );
    },
    isPaused: false,
    pause: () => {
      if (!controller.isPaused) {
        try {
          source.stop();
          controller.isPaused = true;
        } catch (e) {
          console.log('暂停播放时出错:', e);
        }
      }
    },
    resume: () => {
      if (controller.isPaused) {
        try {
          // 创建新的音频源
          const newSource = audioContext.createBufferSource();
          newSource.buffer = audioBuffer;
          newSource.loop = true;
          newSource.connect(gainNode);
          newSource.start();
          
          // 更新source引用
          source = newSource;
          controller.isPaused = false;
        } catch (e) {
          console.log('恢复播放时出错:', e);
        }
      }
    }
  };
  
  return controller;
};

/**
 * 将脑波音频保存为文件
 * @param {string} type - 脑波类型
 * @param {Object} params - 参数对象
 * @returns {Promise<string>} - 文件路径
 */
const saveBrainwaveToFile = (type, params = {}) => {
  // 注意：在实际应用中，这个功能需要在服务器端实现
  // 微信小程序无法直接将AudioBuffer保存为文件
  // 这里只是一个示例框架
  return new Promise((resolve, reject) => {
    reject(new Error('在小程序环境中无法直接保存AudioBuffer为文件，需要服务器支持'));
  });
};

module.exports = {
  generateBrainwave,
  playBrainwave,
  saveBrainwaveToFile,
  createBinauralBeat,
  createDeltaSleepWave,
  createThetaRelaxWave,
  createAlphaRelaxWave,
  createBetaFocusWave,
  createSleepAidWave
}; 