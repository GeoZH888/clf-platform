// RAG Service - Retrieval-Augmented Generation
// Used by AI Agents to query knowledge base

class RAGService {
  constructor(supabase) {
    this.supabase = supabase;
    this.config = null;
  }

  // Load RAG configuration
  async loadConfig() {
    if (!this.supabase) return null;
    
    try {
      const { data } = await this.supabase
        .from('dwxz_rag_config')
        .select('*')
        .limit(1)
        .single();
      
      this.config = data;
      return data;
    } catch (err) {
      console.error('Failed to load RAG config:', err);
      return null;
    }
  }

  // Create embedding for text
  async createEmbedding(text) {
    if (!this.config?.embedding_api_key) {
      console.warn('No embedding API key configured');
      return null;
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.embedding_api_key}`
        },
        body: JSON.stringify({
          model: this.config.embedding_model || 'text-embedding-3-small',
          input: text
        })
      });

      const data = await response.json();
      return data.data?.[0]?.embedding || null;
    } catch (err) {
      console.error('Embedding error:', err);
      return null;
    }
  }

  // Search for relevant chunks using keywords (fallback when no embedding)
  async keywordSearch(query, options = {}) {
    const { knowledgeBaseIds, topK = 5, hskLevels } = options;
    
    try {
      // Extract keywords from query
      const keywords = query
        .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '') // Remove punctuation
        .split(/\s+/)
        .filter(k => k.length > 1);

      if (keywords.length === 0) return [];

      let queryBuilder = this.supabase
        .from('dwxz_rag_chunks')
        .select('*, rag_documents(title, title_zh, category, hsk_levels)')
        .limit(topK);

      // Filter by knowledge base if specified
      if (knowledgeBaseIds?.length > 0) {
        queryBuilder = queryBuilder.in('knowledge_base_id', knowledgeBaseIds);
      }

      // Search using OR conditions for keywords
      const orConditions = keywords.map(k => `content.ilike.%${k}%`).join(',');
      queryBuilder = queryBuilder.or(orConditions);

      const { data, error } = await queryBuilder;
      
      if (error) throw error;

      // Filter by HSK level if specified
      let results = data || [];
      if (hskLevels?.length > 0) {
        results = results.filter(chunk => {
          const docLevels = chunk.rag_documents?.hsk_levels || [];
          return hskLevels.some(l => docLevels.includes(l));
        });
      }

      // Calculate simple relevance score based on keyword matches
      results = results.map(chunk => {
        const content = chunk.content.toLowerCase();
        const matchCount = keywords.filter(k => content.includes(k.toLowerCase())).length;
        return {
          ...chunk,
          score: matchCount / keywords.length
        };
      });

      // Sort by score
      results.sort((a, b) => b.score - a.score);

      return results.slice(0, topK);
    } catch (err) {
      console.error('Keyword search error:', err);
      return [];
    }
  }

  // Vector similarity search (if embeddings available)
  async vectorSearch(queryEmbedding, options = {}) {
    const { knowledgeBaseIds, topK = 5, threshold = 0.7 } = options;
    
    // Note: Full vector search requires pgvector extension in Supabase
    // This is a simplified implementation that stores embeddings as JSON
    // For production, use Supabase's built-in vector similarity search
    
    try {
      let queryBuilder = this.supabase
        .from('dwxz_rag_chunks')
        .select('*, rag_documents(title, title_zh, category, hsk_levels)')
        .not('embedding', 'is', null)
        .limit(topK * 3); // Get more and filter by similarity

      if (knowledgeBaseIds?.length > 0) {
        queryBuilder = queryBuilder.in('knowledge_base_id', knowledgeBaseIds);
      }

      const { data, error } = await queryBuilder;
      
      if (error) throw error;

      // Calculate cosine similarity
      const results = (data || [])
        .map(chunk => {
          const embedding = chunk.embedding;
          if (!embedding || !Array.isArray(embedding)) return { ...chunk, score: 0 };
          
          const score = this.cosineSimilarity(queryEmbedding, embedding);
          return { ...chunk, score };
        })
        .filter(chunk => chunk.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return results;
    } catch (err) {
      console.error('Vector search error:', err);
      return [];
    }
  }

  // Calculate cosine similarity between two vectors
  cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Main query function - combines vector and keyword search
  async query(userQuery, options = {}) {
    const startTime = Date.now();
    
    // Load config if not loaded
    if (!this.config) {
      await this.loadConfig();
    }

    const topK = options.topK || this.config?.search_top_k || 5;
    const threshold = options.threshold || this.config?.similarity_threshold || 0.7;

    let chunks = [];

    // Try vector search first if we have embedding API key
    if (this.config?.embedding_api_key) {
      try {
        const queryEmbedding = await this.createEmbedding(userQuery);
        if (queryEmbedding) {
          chunks = await this.vectorSearch(queryEmbedding, { ...options, topK, threshold });
        }
      } catch (err) {
        console.warn('Vector search failed, falling back to keyword search');
      }
    }

    // Fallback to keyword search if no results
    if (chunks.length === 0) {
      chunks = await this.keywordSearch(userQuery, { ...options, topK });
    }

    const retrievalTime = Date.now() - startTime;

    return {
      chunks,
      retrievalTime,
      method: chunks.length > 0 && chunks[0].embedding ? 'vector' : 'keyword'
    };
  }

  // Build context string from retrieved chunks
  buildContext(chunks) {
    if (!chunks || chunks.length === 0) {
      return '没有找到相关参考资料。';
    }

    return chunks.map((chunk, i) => {
      const source = chunk.rag_documents?.title_zh || chunk.rag_documents?.title || '未知来源';
      return `【来源${i + 1}: ${source}】\n${chunk.content}`;
    }).join('\n\n---\n\n');
  }

  // Generate prompt with RAG context
  buildRAGPrompt(userQuery, chunks, options = {}) {
    const context = this.buildContext(chunks);
    const template = this.config?.system_prompt_template || `你是大卫学中文的智能助手。请根据以下参考资料回答用户问题。

## 参考资料
{context}

## 用户问题
{question}

## 回答要求
- 基于参考资料回答，如果资料中没有相关信息，请说明
- 使用用户的语言回答
- 如果涉及中文教学，提供拼音和解释
- 回答要准确、简洁、有帮助`;

    return template
      .replace('{context}', context)
      .replace('{question}', userQuery);
  }

  // Full RAG query with response generation
  async queryWithGeneration(userQuery, aiService, options = {}) {
    // Get relevant chunks
    const { chunks, retrievalTime, method } = await this.query(userQuery, options);
    
    // Build prompt with context
    const prompt = this.buildRAGPrompt(userQuery, chunks, options);
    
    // Generate response using AI service
    const genStartTime = Date.now();
    const response = await aiService.chat([
      { role: 'user', content: prompt }
    ]);
    const generationTime = Date.now() - genStartTime;

    // Log the query (optional)
    if (this.supabase && options.userId) {
      try {
        await this.supabase.from('dwxz_rag_query_logs').insert([{
          user_id: options.userId,
          query: userQuery,
          knowledge_base_ids: options.knowledgeBaseIds,
          retrieved_chunks: chunks.map(c => ({
            id: c.id,
            score: c.score,
            preview: c.content.substring(0, 100)
          })),
          retrieval_time_ms: retrievalTime,
          generated_response: response?.content || response,
          generation_time_ms: generationTime
        }]);
      } catch (err) {
        console.warn('Failed to log RAG query:', err);
      }
    }

    return {
      response: response?.content || response,
      chunks,
      retrievalTime,
      generationTime,
      method
    };
  }

  // Check if RAG is properly configured
  async isConfigured() {
    if (!this.config) {
      await this.loadConfig();
    }
    
    // Check if there are any documents
    const { count } = await this.supabase
      .from('dwxz_rag_documents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    return {
      hasConfig: !!this.config,
      hasEmbeddingKey: !!this.config?.embedding_api_key,
      documentCount: count || 0,
      isReady: count > 0
    };
  }
}

// Export singleton factory
let ragServiceInstance = null;

export const getRAGService = (supabase) => {
  if (!ragServiceInstance && supabase) {
    ragServiceInstance = new RAGService(supabase);
  }
  return ragServiceInstance;
};

export default RAGService;
