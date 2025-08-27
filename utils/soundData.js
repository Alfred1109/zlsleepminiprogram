// 声音数据测试集
const naturalSounds = [
  {
    id: 'n1',
    name: '海浪声',
    description: '轻柔的海浪拍打沙滩，带来宁静与放松',
    duration: '60:00',
    plays: 12580,
    image: '/assets/images/default-image.png',
    audioUrl: 'https://example.com/audio/ocean.mp3', // 占位符，将由后端API提供实际URL
    tags: ['放松', '睡眠', '自然']
  },
  {
    id: 'n2',
    name: '雨林雨声',
    description: '热带雨林中的雨滴落在树叶上的声音，伴随着远处的雷声',
    duration: '45:00',
    plays: 8976,
    image: '/assets/images/default-image.png',
    audioUrl: 'https://example.com/audio/rainforest.mp3', // 占位符，将由后端API提供实际URL
    tags: ['放松', '专注', '自然']
  },
  {
    id: 'n3',
    name: '山间溪流',
    description: '清澈的溪水流过鹅卵石，带来清新与活力',
    duration: '50:00',
    plays: 7654,
    image: '/assets/images/default-image.png',
    audioUrl: 'https://example.com/audio/stream.mp3', // 占位符，将由后端API提供实际URL
    tags: ['放松', '冥想', '自然']
  },
  {
    id: 'n4',
    name: '森林鸟鸣',
    description: '清晨森林中各种鸟儿的鸣叫，充满生机',
    duration: '40:00',
    plays: 6543,
    image: '/assets/images/default-image.png',
    audioUrl: 'https://example.com/audio/birds.mp3', // 占位符，将由后端API提供实际URL
    tags: ['唤醒', '放松', '自然']
  },
  {
    id: 'n5',
    name: '篝火声',
    description: '木柴燃烧的噼啪声，温暖而舒适',
    duration: '55:00',
    plays: 5432,
    image: '/assets/images/default-image.png',
    audioUrl: 'https://example.com/audio/fire.mp3', // 占位符，将由后端API提供实际URL
    tags: ['放松', '睡眠', '自然']
  },
  {
    id: 'n6',
    name: '夏夜蝉鸣',
    description: '夏日夜晚的蝉鸣声，带来夏日的宁静与怀旧',
    duration: '45:00',
    plays: 4987,
    image: '/assets/images/default-image.png',
    audioUrl: 'https://example.com/audio/cicada.mp3', // 占位符，将由后端API提供实际URL
    tags: ['放松', '睡眠', '自然']
  },
  {
    id: 'n7',
    name: '城市雨声',
    description: '城市中的雨声，雨滴打在窗户和屋顶的声音',
    duration: '60:00',
    plays: 7823,
    image: '/assets/images/city_rain.jpg',
    audioUrl: 'https://example.com/audio/city_rain.mp3', // 占位符，将由后端API提供实际URL
    tags: ['放松', '睡眠', '自然']
  }
];

const whiteNoise = [
  {
    id: 'w1',
    name: '纯白噪音',
    description: '均衡的白噪音，有效掩盖环境噪音，帮助专注和睡眠',
    duration: '60:00',
    plays: 15678,
    image: '/assets/images/default-image.png',
    audioUrl: 'https://example.com/audio/white_noise.mp3', // 占位符，将由后端API提供实际URL
    tags: ['专注', '睡眠', '噪音']
  },
  {
    id: 'w2',
    name: '粉红噪音',
    description: '低频增强的噪音，更加柔和，适合睡眠',
    duration: '60:00',
    plays: 12345,
    image: '/assets/images/pink_noise.jpg',
    audioUrl: 'https://example.com/audio/pink_noise.mp3', // 占位符，将由后端API提供实际URL
    tags: ['睡眠', '放松', '噪音']
  },
  {
    id: 'w3',
    name: '棕色噪音',
    description: '低频更强的噪音，类似瀑布声，遮盖力更强',
    duration: '60:00',
    plays: 9876,
    image: '/assets/images/brown_noise.jpg',
    audioUrl: 'https://example.com/audio/brown_noise.mp3', // 占位符，将由后端API提供实际URL
    tags: ['睡眠', '放松', '噪音']
  },
  {
    id: 'w4',
    name: '风扇声',
    description: '稳定的风扇运转声，帮助入睡和专注',
    duration: '60:00',
    plays: 8765,
    image: '/assets/images/fan.jpg',
    audioUrl: 'https://example.com/audio/fan.mp3', // 占位符，将由后端API提供实际URL
    tags: ['睡眠', '专注', '噪音']
  },
  {
    id: 'w5',
    name: '空调声',
    description: '空调运行的白噪音，稳定而舒适',
    duration: '60:00',
    plays: 7654,
    image: '/assets/images/ac.jpg',
    audioUrl: 'https://example.com/audio/ac.mp3', // 占位符，将由后端API提供实际URL
    tags: ['睡眠', '放松', '噪音']
  },
  {
    id: 'w6',
    name: '雨声白噪音',
    description: '均匀的雨声白噪音，帮助集中注意力和放松',
    duration: '60:00',
    plays: 9254,
    image: '/assets/images/rain_noise.jpg',
    audioUrl: 'https://example.com/audio/rain_noise.mp3', // 占位符，将由后端API提供实际URL
    tags: ['专注', '放松', '噪音']
  }
];

const brainwaves = [
  {
    id: 'b1',
    name: 'Delta 深度睡眠波',
    description: '0.5-4Hz的脑波频率，促进深度无梦睡眠和身体恢复',
    duration: '45:00',
    plays: 18765,
    image: '/assets/images/delta.jpg',
    audioUrl: 'https://example.com/audio/delta.mp3', // 占位符，将由后端API提供实际URL
    frequency: {
      main: 2, // 主频率(Hz)
      carrier: 200, // 载波频率(Hz)
      type: 'delta'
    },
    tags: ['睡眠', '恢复', '脑波']
  },
  {
    id: 'b2',
    name: 'Theta 放松冥想波',
    description: '4-8Hz的脑波频率，促进放松、冥想和创造性思维',
    duration: '30:00',
    plays: 14532,
    image: '/assets/images/theta.jpg',
    audioUrl: 'https://example.com/audio/theta.mp3', // 占位符，将由后端API提供实际URL
    frequency: {
      main: 6, // 主频率(Hz)
      carrier: 250, // 载波频率(Hz)
      type: 'theta'
    },
    tags: ['冥想', '创造', '脑波']
  },
  {
    id: 'b3',
    name: 'Alpha 轻松清醒波',
    description: '8-13Hz的脑波频率，促进放松清醒状态和注意力',
    duration: '30:00',
    plays: 12543,
    image: '/assets/images/alpha.jpg',
    audioUrl: 'https://example.com/audio/alpha.mp3', // 占位符，将由后端API提供实际URL
    frequency: {
      main: 10, // 主频率(Hz)
      carrier: 300, // 载波频率(Hz)
      type: 'alpha'
    },
    tags: ['放松', '专注', '脑波']
  },
  {
    id: 'b4',
    name: 'Beta 专注清醒波',
    description: '13-30Hz的脑波频率，促进专注、清醒和高效思考',
    duration: '25:00',
    plays: 11876,
    image: '/assets/images/beta.jpg',
    audioUrl: 'https://example.com/audio/beta.mp3', // 占位符，将由后端API提供实际URL
    frequency: {
      main: 20, // 主频率(Hz)
      carrier: 280, // 载波频率(Hz)
      type: 'beta'
    },
    tags: ['专注', '清醒', '脑波']
  },
  {
    id: 'b5',
    name: '助眠安神组合波',
    description: '特别设计的Delta和Theta波组合，帮助快速入睡和安神',
    duration: '60:00',
    plays: 21654,
    image: '/assets/images/sleep_aid.jpg',
    audioUrl: 'https://example.com/audio/sleep_aid.mp3', // 占位符，将由后端API提供实际URL
    frequency: {
      main: [2, 6], // 主频率组合(Hz)
      carrier: 220, // 载波频率(Hz)
      type: 'sleep_aid'
    },
    tags: ['睡眠', '放松', '脑波', '特效']
  },
  {
    id: 'b6',
    name: '深度放松波',
    description: 'Alpha和Theta波的组合，促进深度放松但保持清醒',
    duration: '40:00',
    plays: 16789,
    image: '/assets/images/deep_relax.jpg',
    audioUrl: 'https://example.com/audio/deep_relax.mp3', // 占位符，将由后端API提供实际URL
    frequency: {
      main: [8, 6], // 主频率组合(Hz)
      carrier: 280, // 载波频率(Hz)
      type: 'deep_relax'
    },
    tags: ['放松', '冥想', '脑波', '特效']
  }
];

// 声音分类
const categories = [
  {
    id: 1,
    name: '自然音',
    icon: '/images/categories/nature.png',
    code: 'nature'
  },
  {
    id: 2,
    name: '白噪音',
    icon: '/images/categories/noise.png',
    code: 'noise'
  },
  {
    id: 3,
    name: '脑波频率',
    icon: '/images/categories/brainwave.png',
    code: 'brainwave'
  }
];

// 合并所有声音数据
const sounds = [...naturalSounds, ...whiteNoise, ...brainwaves];

// 按分类获取声音
const getSoundsByCategory = (category, limit = 0) => {
  let result = [];
  
  // 支持通过分类代码或ID获取
  if (typeof category === 'string') {
    // 按分类代码查找
    switch(category) {
      case 'nature':
        result = naturalSounds;
        break;
      case 'noise':
        result = whiteNoise;
        break;
      case 'brainwave':
        result = brainwaves;
        break;
      default:
        // 尝试在所有声音中查找匹配的分类
        result = sounds.filter(sound => 
          sound.tags && sound.tags.some(tag => tag.toLowerCase() === category.toLowerCase())
        );
    }
  } else if (typeof category === 'number') {
    // 按分类ID查找
    const categoryObj = categories.find(cat => cat.id === category);
    if (categoryObj) {
      return getSoundsByCategory(categoryObj.code, limit);
    }
  }
  
  // 如果需要限制数量
  if (limit > 0 && result.length > limit) {
    return result.slice(0, limit);
  }
  
  return result;
};

// 按心情/场景获取声音
const getSoundsByMood = (mood, limit = 6) => {
  if (!mood) return [];
  
  // 根据心情映射到标签
  let tags = [];
  switch(mood.toLowerCase()) {
    case 'sleep':
      tags = ['睡眠', '放松'];
      break;
    case 'meditation':
      tags = ['冥想', '放松'];
      break;
    case 'relax':
      tags = ['放松'];
      break;
    case 'focus':
      tags = ['专注', '清醒'];
      break;
    default:
      tags = [mood]; // 直接使用mood作为标签
  }
  
  // 查找包含任一标签的声音
  const result = sounds.filter(sound => 
    sound.tags && sound.tags.some(tag => 
      tags.some(t => tag.toLowerCase().includes(t.toLowerCase()))
    )
  );
  
  // 如果需要限制数量
  if (limit > 0 && result.length > limit) {
    return result.slice(0, limit);
  }
  
  return result;
};

// 获取推荐声音
const getRecommendedSounds = (limit = 6) => {
  // 按播放次数排序
  const sorted = [...sounds].sort((a, b) => b.plays - a.plays);
  return sorted.slice(0, limit);
};

// 获取每日精选
const getDailyPick = () => {
  // 随机选择一些声音作为每日精选
  return sounds.sort(() => 0.5 - Math.random()).slice(0, 3);
};

// 根据ID获取声音
const getSoundById = (soundId) => {
  return sounds.find(sound => sound.id === soundId);
};

// 搜索声音
const searchSounds = (keyword, limit = 10) => {
  if (!keyword) return [];
  
  keyword = keyword.toLowerCase();
  const result = sounds.filter(sound => 
    sound.name.toLowerCase().includes(keyword) || 
    sound.description.toLowerCase().includes(keyword) ||
    (sound.tags && sound.tags.some(tag => tag.toLowerCase().includes(keyword)))
  );
  
  return limit > 0 ? result.slice(0, limit) : result;
};

// 获取所有分类
const getAllCategories = () => {
  return categories;
};

// 根据ID获取分类
const getCategoryById = (id) => {
  return categories.find(cat => cat.id === id);
};

// 导入文件系统API（如果需要的话）
const fs = wx.getFileSystemManager();

// 导入七牛云统一管理工具
const { qiniuManagerUnified } = require('./qiniuManagerUnified');

/**
 * 获取自然声音列表
 * @returns {Array} 自然声音列表
 */
function getNaturalSounds() {
  // 自然声音音频文件列表
  const naturalSounds = [
    {
      id: 'natural_1',
      name: '幽静寺院的钟声',
      path: 'https://example.com/audio/幽静寺院的钟声.mp3', // 占位符，将由后端API提供实际URL
      image: '/assets/images/default-image.png',
      category: '自然音',
      type: 'natural'
    },
    {
      id: 'natural_2',
      name: '悟道',
      path: 'https://example.com/audio/悟道.mp3', // 占位符，将由后端API提供实际URL
      image: '/assets/images/default-image.png',
      category: '自然音',
      type: 'natural'
    },
    {
      id: 'natural_3',
      name: '心净',
      path: 'https://example.com/audio/心净.mp3', // 占位符，将由后端API提供实际URL
      image: '/assets/images/default-image.png',
      category: '自然音',
      type: 'natural'
    },
    {
      id: 'natural_4',
      name: '颂钵之音',
      path: 'https://example.com/audio/颂钵之音.mp3', // 占位符，将由后端API提供实际URL
      image: '/assets/images/default-image.png',
      category: '自然音',
      type: 'natural'
    },
    {
      id: 'natural_5',
      name: '颂钵集中(雨声)',
      path: 'https://example.com/audio/颂钵集中(雨声).mp3', // 占位符，将由后端API提供实际URL
      image: '/assets/images/default-image.png',
      category: '自然音',
      type: 'natural'
    },
    {
      id: 'natural_6',
      name: '开悟禅道',
      path: 'https://example.com/audio/开悟禅道.mp3', // 占位符，将由后端API提供实际URL
      image: '/assets/images/default-image.png',
      category: '自然音',
      type: 'natural'
    },
    {
      id: 'natural_7',
      name: '禅放松',
      path: 'https://example.com/audio/禅放松.mp3', // 占位符，将由后端API提供实际URL
      image: '/assets/images/default-image.png',
      category: '自然音',
      type: 'natural'
    },
    {
      id: 'natural_8',
      name: '禅放松2',
      path: 'https://example.com/audio/禅放松2.mp3', // 占位符，将由后端API提供实际URL
      image: '/assets/images/default-image.png',
      category: '自然音',
      type: 'natural'
    }
  ];
  
  return naturalSounds;
}

/**
 * 获取随机的自然声音
 * @param {boolean} useQiniu - 是否使用七牛云获取
 * @param {Function} callback - 回调函数，返回随机音频对象
 */
function getRandomNaturalSound(useQiniu = false, callback) {
  if (useQiniu) {
    // 从七牛云统一API获取随机自然音
    qiniuManagerUnified.getRandomNaturalSound(callback);
  } else {
    // 从本地获取随机自然音
    const sounds = getNaturalSounds();
    const randomIndex = Math.floor(Math.random() * sounds.length);
    
    if (typeof callback === 'function') {
      callback(sounds[randomIndex]);
    } else {
      return sounds[randomIndex];
    }
  }
}

/**
 * 从七牛云获取随机自然音（异步）
 * @param {Function} callback - 回调函数，参数为随机音频对象
 */
function getRandomNaturalSoundFromQiniu(callback) {
  // 使用七牛云统一API获取随机自然音
  qiniuManagerUnified.getRandomAudioByCategory('sleep', { showLoading: false })
    .then(audio => {
      if (audio) {
        // 转换为兼容格式
        const randomSound = {
          id: audio.id,
          name: audio.name,
          path: audio.url,
          image: '/assets/images/default-image.png',
          category: '自然音',
          type: 'natural',
          expires_at: audio.expires_at
        };
        
        console.log('从七牛云统一API获取随机自然音:', randomSound.name);
        callback(randomSound);
      } else {
        console.error('从七牛云统一API获取音频失败');
        callback(null);
      }
    })
    .catch(error => {
      console.error('从七牛云统一API获取随机自然音失败:', error);
      callback(null);
    });
}

module.exports = {
  naturalSounds,
  whiteNoise,
  brainwaves,
  getSoundsByCategory,
  getSoundsByMood,
  getRecommendedSounds,
  getDailyPick,
  getSoundById,
  searchSounds,
  categories,
  getAllCategories,
  getCategoryById,
  getNaturalSounds,
  getRandomNaturalSound,
  getRandomNaturalSoundFromQiniu
}; 