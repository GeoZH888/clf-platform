// AI Service Module - 智能服务模块
// Supports: OpenAI, Anthropic (Claude), DeepSeek, Qwen, ERNIE

class AIService {
  constructor(supabase) {
    this.supabase = supabase;
    this.config = null;
    this.configLoaded = false;
  }

  // 从 rag_config 加载配置
  async loadConfig() {
    if (!this.supabase) return null;
    
    try {
      const { data, error } = await this.supabase
        .from('dwxz_rag_config')
        .select('*')
        .limit(1)
        .single();
      
      if (error) {
        console.warn('Failed to load AI config:', error.message);
        return null;
      }
      
      this.config = data;
      this.configLoaded = true;
      return data;
    } catch (err) {
      console.error('Error loading AI config:', err);
      return null;
    }
  }

  // 确保配置已加载
  async ensureConfig() {
    if (!this.configLoaded) {
      await this.loadConfig();
    }
    return this.config;
  }

  // 获取当前活跃的 AI 配置
  async getActiveConfig() {
    const config = await this.ensureConfig();
    if (!config) {
      return {
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKey: null,
        available: false
      };
    }

    const provider = config.ai_provider || 'openai';
    let apiKey = null;
    let model = 'gpt-4o-mini';

    switch (provider) {
      case 'openai':
        apiKey = config.openai_api_key;
        model = config.openai_model || 'gpt-4o-mini';
        break;
      case 'claude':
      case 'anthropic':
        apiKey = config.claude_api_key;
        model = config.claude_model || 'claude-sonnet-4-20250514';
        break;
      case 'deepseek':
        apiKey = config.deepseek_api_key;
        model = config.deepseek_model || 'deepseek-chat';
        break;
      default:
        apiKey = config.openai_api_key;
    }

    return {
      provider,
      model,
      apiKey,
      available: !!apiKey,
      chunkSize: config.chunk_size || 500,
      chunkOverlap: config.chunk_overlap || 50,
      autoProcess: config.auto_process_uploads !== false,
      autoClassify: config.auto_classify_materials !== false,
      embeddingProvider: config.embedding_provider || 'openai',
      embeddingApiKey: config.openai_api_key // embeddings use OpenAI
    };
  }

  // 获取 API base URL
  getBaseUrl(provider) {
    const urls = {
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com',
      claude: 'https://api.anthropic.com',
      deepseek: 'https://api.deepseek.com/v1',
      qwen: 'https://dashscope.aliyuncs.com/api/v1',
      ernie: 'https://aip.baidubce.com'
    };
    return urls[provider] || urls.openai;
  }

  // 通用聊天接口
  async chat(messages, options = {}) {
    const config = await this.getActiveConfig();
    
    if (!config.apiKey) {
      throw new Error('AI API Key not configured. Please ask administrator to configure AI settings.');
    }

    try {
      const provider = options.provider || config.provider;
      
      switch (provider) {
        case 'openai':
        case 'deepseek':
          return await this.callOpenAICompatible(messages, config, options);
        case 'anthropic':
        case 'claude':
          return await this.callAnthropic(messages, config, options);
        default:
          return await this.callOpenAICompatible(messages, config, options);
      }
    } catch (error) {
      console.error('AI API Error:', error);
      throw error;
    }
  }

  // OpenAI 兼容接口 (OpenAI, DeepSeek)
  async callOpenAICompatible(messages, config, options) {
    const baseUrl = this.getBaseUrl(config.provider);
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: options.model || config.model,
        messages,
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API request failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage,
      model: data.model
    };
  }

  // Anthropic Claude 接口
  async callAnthropic(messages, config, options) {
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const chatMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options.model || config.model || 'claude-sonnet-4-20250514',
        max_tokens: options.maxTokens || 2000,
        system: systemMessage,
        messages: chatMessages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }))
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API request failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.content[0]?.text || '',
      usage: data.usage,
      model: data.model
    };
  }

  // ========== 便捷方法 ==========

  // 生成成语信息
  async generateChengyu(chengyu) {
    const messages = [{
      role: 'user',
      content: `请为成语"${chengyu}"提供完整信息，返回JSON格式：

{
  "pinyin": "拼音（带声调，如 yī shí èr niǎo）",
  "literal": "字面意思（英文）",
  "meaning_zh": "中文释义（一句话）",
  "meaning_en": "English meaning",
  "meaning_it": "Significato in italiano",
  "story": "成语故事（100-200字）",
  "story_en": "Story in English (brief)",
  "example": "例句（中文）",
  "example_en": "Example sentence in English",
  "category": "分类：fable/history/strategy/art/culture/communication/nature/character 选一个",
  "hsk_level": "推荐HSK等级：1-6的数字"
}

只返回JSON，不要其他文字。`
    }];

    const result = await this.chat(messages);
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Invalid response format');
  }

  // 分类材料
  async classifyMaterial(text, filename) {
    const sampleText = text.substring(0, 2000);
    
    const messages = [{
      role: 'user',
      content: `Analyze this Chinese language learning material and classify it. Return ONLY a JSON object.

TEXT SAMPLE:
${sampleText}

FILENAME: ${filename}

Classify into:
1. category: One of [textbook, vocabulary, grammar, listening, reading, speaking, writing, culture, exam, other]
2. hskLevels: Array of HSK levels 1-6 this material is suitable for (e.g., [3,4] for intermediate)
3. tags: Array of relevant tags in Chinese (e.g., ["第一课", "日常对话", "购物"])
4. summary: Brief summary in Chinese (50 chars max)
5. confidence: Your confidence 0-1

Respond ONLY with JSON like:
{"category": "vocabulary", "hskLevels": [3,4], "tags": ["生词", "中级词汇"], "summary": "HSK3级词汇表", "confidence": 0.9}`
    }];

    const result = await this.chat(messages);
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { category: 'other', hskLevels: [], tags: [], confidence: 0.5 };
  }

  // 生成摘要
  async generateSummary(content, maxLength = 200) {
    const messages = [{
      role: 'user',
      content: `请用简洁的中文总结以下内容，摘要不超过${maxLength}字：\n\n${content.substring(0, 3000)}`
    }];

    const result = await this.chat(messages);
    return result.content;
  }
}

// 创建单例
let aiServiceInstance = null;

export const getAIService = (supabase) => {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService(supabase);
  } else if (supabase && !aiServiceInstance.supabase) {
    aiServiceInstance.supabase = supabase;
  }
  return aiServiceInstance;
};

export default AIService;
