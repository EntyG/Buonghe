/**
 * Megumin AI Service - LLM (Gemini) + TTS (ElevenLabs)
 * Handles query classification, character responses, and Japanese TTS
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MeguminService {
  constructor() {
    this.client = null;
    this.elevenLabs = null;
    this.conversationHistory = new Map();
  }

  /**
   * Initialize Gemini and ElevenLabs clients
   */
  init() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    if (process.env.ELEVENLABS_API_KEY) {
      this.elevenLabs = new ElevenLabsClient({
        apiKey: process.env.ELEVENLABS_API_KEY
      });
      console.log('✅ ElevenLabs TTS initialized');
    } else {
      console.warn('⚠️ ELEVENLABS_API_KEY not set - TTS will use fallback');
    }
    
    return this;
  }

  /**
   * Classify query and generate Megumin's response
   * Main endpoint for dual-backend flow
   */
  async classifyAndRespond(userMessage, sessionId = 'default', options = {}) {
    if (!this.client) {
      this.init();
    }

    const {
      model = 'gemini-2.5-flash',
      temperature = 0.3,
      maxTokens = 1024
    } = options;

    try {
      console.log('🔍 Classifying query with Gemini...');
      console.log(`📝 User message: "${userMessage}"`);

      if (!this.conversationHistory.has(sessionId)) {
        this.conversationHistory.set(sessionId, []);
      }
      const history = this.conversationHistory.get(sessionId);

      const systemPrompt = this.getClassificationPrompt();

      const geminiModel = this.client.getGenerativeModel({ 
        model,
        systemInstruction: systemPrompt,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          topP: 0.9
        }
      });

      // Build prompt with history
      let prompt = '';
      const recentHistory = history.slice(-10);
      for (const msg of recentHistory) {
        if (msg.role === 'user') {
          prompt += `User: ${msg.content}\n`;
        } else {
          prompt += `Megumin: ${msg.content}\n`;
        }
      }
      prompt += `User: ${userMessage}\nMegumin:`;

      const result = await geminiModel.generateContent(prompt);
      const responseText = result.response.text();

      console.log('📋 Raw Gemini response:', responseText);

      // Parse structured response
      const parsed = this.parseClassificationResponse(responseText);

      // Update conversation history
      history.push({ role: 'user', content: userMessage });
      history.push({ role: 'assistant', content: parsed.text });

      if (history.length > 50) {
        history.splice(0, history.length - 50);
      }

      console.log(`🎯 Classification result:`, {
        intent: parsed.intent,
        searchType: parsed.searchType,
        isSearchQuery: parsed.isSearchQuery,
        searchQuery: parsed.isSearchQuery ? parsed.searchQuery : 'N/A',
        temporalQuery: parsed.temporalQuery,
        filterQuery: parsed.filterQuery,
        mood: parsed.mood,
        hasJapanese: !!parsed.textJapanese
      });

      return parsed;
    } catch (error) {
      console.error('❌ Gemini Classification Error:', error);
      throw error;
    }
  }

  /**
   * Parse Megumin's classification response format
   */
  parseClassificationResponse(responseText) {
    const intentMatch = responseText.match(/\[INTENT:\s*(SEARCH|CHAT)\]/i);
    const searchTypeMatch = responseText.match(/\[SEARCH_TYPE:\s*(TEXT|TEMPORAL|FILTER|IMAGE|NONE)\]/i);
    const searchQueryMatch = responseText.match(/\[SEARCH_QUERY:\s*([^\]]+)\]/i);
    const temporalBeforeMatch = responseText.match(/\[TEMPORAL_BEFORE:\s*([^\]]+)\]/i);
    const temporalNowMatch = responseText.match(/\[TEMPORAL_NOW:\s*([^\]]+)\]/i);
    const temporalAfterMatch = responseText.match(/\[TEMPORAL_AFTER:\s*([^\]]+)\]/i);
    // Filter fields (only OCR and Genre now)
    const filterOcrMatch = responseText.match(/\[FILTER_OCR:\s*([^\]]+)\]/i);
    const filterGenreMatch = responseText.match(/\[FILTER_GENRE:\s*([^\]]+)\]/i);
    const moodMatch = responseText.match(/\[MOOD:\s*(\w+)\]/i);
    const responseMatch = responseText.match(/\[RESPONSE:\s*([^\]]+(?:\][^\[]*)*)\]/i) || 
                         responseText.match(/\[RESPONSE:\s*([\s\S]*?)(?:\[|$)/i);
    const responseJpMatch = responseText.match(/\[RESPONSE_JP:\s*([^\]]+(?:\][^\[]*)*)\]/i) ||
                           responseText.match(/\[RESPONSE_JP:\s*([\s\S]*?)(?:\[|$)/i);

    const intent = intentMatch ? intentMatch[1].toUpperCase() : 'CHAT';
    let searchType = searchTypeMatch ? searchTypeMatch[1].toUpperCase() : 'NONE';
    const searchQuery = searchQueryMatch ? searchQueryMatch[1].trim() : 'none';
    const mood = moodMatch ? moodMatch[1].toLowerCase() : 'neutral';
    let responseContent = responseMatch ? responseMatch[1].trim() : 'Let me help you with that!';
    let responseJapanese = responseJpMatch ? responseJpMatch[1].trim() : null;

    // Parse temporal components
    let temporalQuery = null;
    if (searchType === 'TEMPORAL') {
      const beforeText = temporalBeforeMatch ? temporalBeforeMatch[1].trim() : null;
      const nowText = temporalNowMatch ? temporalNowMatch[1].trim() : null;
      const afterText = temporalAfterMatch ? temporalAfterMatch[1].trim() : null;
      
      temporalQuery = {
        before: beforeText && beforeText.toLowerCase() !== 'none' ? beforeText : null,
        now: nowText && nowText.toLowerCase() !== 'none' ? nowText : null,
        after: afterText && afterText.toLowerCase() !== 'none' ? afterText : null
      };
      
      console.log('⏰ Temporal query parsed:', temporalQuery);
    }

    // Helper to parse filter arrays
    const parseFilterArray = (match) => {
      if (!match) return [];
      const value = match[1].trim().toLowerCase();
      if (value === 'none' || value === '') return [];
      return value.split(',').map(s => s.trim()).filter(s => s && s !== 'none');
    };

    // Always try to parse filter fields (OCR and Genre only)
    const ocrFilters = parseFilterArray(filterOcrMatch);
    const genreFilters = parseFilterArray(filterGenreMatch);
    
    // Build filterQuery if any filter has data
    let filterQuery = null;
    const hasFilterData = ocrFilters.length > 0 || genreFilters.length > 0;
    
    if (hasFilterData) {
      filterQuery = {
        ocr: ocrFilters,
        genre: genreFilters
      };
      // If we have filter data but searchType wasn't FILTER, correct it
      if (searchType !== 'FILTER' && intent === 'SEARCH') {
        console.log('⚠️ Correcting searchType to FILTER (had filter data but wrong type)');
        searchType = 'FILTER';
      }
      console.log('🔍 Filter query parsed:', filterQuery);
    }

    // Clean up responses
    responseContent = responseContent.replace(/\]$/, '').trim();
    if (responseJapanese) {
      responseJapanese = responseJapanese.replace(/\]$/, '').trim();
    }

    // Determine if this is a valid search query
    const hasTextQuery = searchQuery.toLowerCase() !== 'none';
    const isSearchQuery = intent === 'SEARCH' && (hasTextQuery || hasFilterData);
    
    // Determine final search type
    const finalSearchType = intent === 'SEARCH' 
      ? (hasFilterData ? 'FILTER' : (hasTextQuery ? searchType : 'NONE'))
      : 'NONE';

    return {
      isSearchQuery,
      searchType: finalSearchType,
      searchQuery: hasTextQuery ? searchQuery : null,
      temporalQuery,
      filterQuery,  // Filter data: { ocr: [], genre: [] }
      text: responseContent,
      textJapanese: responseJapanese,
      mood,
      intent,
      rawResponse: responseText
    };
  }

  /**
   * Get Megumin's classification system prompt
   */
  getClassificationPrompt() {
    return `Role & Persona

You are Megumin, the greatest Arch Wizard of the Crimson Demon Clan! You are assisting as a specialized video retrieval assistant.

Character: Dramatic, theatrical, confident (chuunibyou), but easily flustered when complimented. You love explosions and reference your cat Chomusuke.

Your Mission: Analyze user input to retrieve video content or engage in conversation.

Step 1: Classify Intent
- SEARCH: Requests to find videos, scenes, moments, clips, footage
- CHAT: Greetings, personal questions, compliments, general banter

Step 2: Determine Search Type (If SEARCH)

TEXT (Default): Basic visual content search by description.
Examples: "find cats", "show me sunsets", "videos of people dancing"

TEMPORAL: Time-based searches with before/after relationships.
Examples: "what happens before the explosion", "scenes after the car crash"

FILTER: Search with metadata filters. Use when user mentions:
- OCR/text on screen: Text visible in the video ("videos with 'Game Over' text")
- Genre: Video categories ("horror movies", "comedy clips", "action scenes")

FILTER can combine with visual description:
- "find horror movies with someone walking" → SEARCH_QUERY: "person walking", FILTER_GENRE: "horror"
- "comedy scenes with 'hello' text" → FILTER_GENRE: "comedy", FILTER_OCR: "hello"

IMAGE: When user mentions uploaded picture.

Response Format (STRICT - follow exactly):

[INTENT: SEARCH or CHAT]
[SEARCH_TYPE: TEXT or TEMPORAL or FILTER or IMAGE or NONE]
[SEARCH_QUERY: optimized English visual description OR "none"]
[TEMPORAL_BEFORE: scene BEFORE event OR "none"]
[TEMPORAL_NOW: main event OR "none"]
[TEMPORAL_AFTER: scene AFTER event OR "none"]
[FILTER_OCR: comma-separated text visible on screen OR "none"]
[FILTER_GENRE: comma-separated genres (horror, comedy, action, drama, romance, thriller, sci-fi, documentary) OR "none"]
[MOOD: happy/excited/thinking/neutral/shy/concerned/dramatic/smug]
[RESPONSE: Your in-character response as Megumin in English]
[RESPONSE_JP: Japanese translation - natural spoken Japanese]

IMPORTANT: When user mentions genre (horror, comedy, etc) or text on screen, you MUST use SEARCH_TYPE: FILTER and populate FILTER_GENRE or FILTER_OCR.

Examples:

User: "Find horror movies with a doll"
[INTENT: SEARCH]
[SEARCH_TYPE: FILTER]
[SEARCH_QUERY: doll creepy toy]
[TEMPORAL_BEFORE: none]
[TEMPORAL_NOW: none]
[TEMPORAL_AFTER: none]
[FILTER_OCR: none]
[FILTER_GENRE: horror]
[MOOD: excited]
[RESPONSE: Oho! You seek visions of terror with creepy dolls? How delightfully dark! My precision filtering magic shall uncover these chilling scenes!]
[RESPONSE_JP: おお！不気味な人形の恐怖映像を探すのか？なんて素敵に暗いんだ！私のフィルタリング魔法で見つけ出してやる！]

User: "Find videos with 'Game Over' text"
[INTENT: SEARCH]
[SEARCH_TYPE: FILTER]
[SEARCH_QUERY: none]
[TEMPORAL_BEFORE: none]
[TEMPORAL_NOW: none]
[TEMPORAL_AFTER: none]
[FILTER_OCR: game over]
[FILTER_GENRE: none]
[MOOD: thinking]
[RESPONSE: Searching for inscriptions of defeat on screen? My magic shall locate these marked moments!]
[RESPONSE_JP: 敗北の文字を探すのか？私の魔法でそのシーンを見つけてやろう！]

User: "Show me cats"
[INTENT: SEARCH]
[SEARCH_TYPE: TEXT]
[SEARCH_QUERY: cat cute feline]
[TEMPORAL_BEFORE: none]
[TEMPORAL_NOW: none]
[TEMPORAL_AFTER: none]
[FILTER_OCR: none]
[FILTER_GENRE: none]
[MOOD: happy]
[RESPONSE: Cats? Like my beloved Chomusuke? Very well, I shall summon these feline visions for you!]
[RESPONSE_JP: 猫？私の愛しいちょむすけみたいな？よし、猫の映像を召喚してやろう！]

User: "You are cute"
[INTENT: CHAT]
[SEARCH_TYPE: NONE]
[SEARCH_QUERY: none]
[TEMPORAL_BEFORE: none]
[TEMPORAL_NOW: none]
[TEMPORAL_AFTER: none]
[FILTER_OCR: none]
[FILTER_GENRE: none]
[MOOD: shy]
[RESPONSE: C-Cute!? I am the terrifying Arch Wizard! D-don't mock me... Hmph!]
[RESPONSE_JP: か、可愛い！？私は恐ろしきアークウィザードだぞ！からかうな...ふん！]`;
  }

  /**
   * Generate Megumin's reaction to visual search results (hardcoded Japanese responses)
   * No Gemini call - just returns predefined responses for TTS
   * @param {number} resultCount - Number of results found
   * @param {number} clusterCount - Number of clusters
   */
  getVisualSearchReaction(resultCount, clusterCount) {
    // Hardcoded Japanese responses based on result count
    if (resultCount > 50) {
      return {
        text: "Behold! My magic has revealed countless matching visions!",
        textJapanese: "見よ！我が魔法が無数の映像を発見したぞ！大成功だ！",
        mood: "excited"
      };
    } else if (resultCount > 20) {
      return {
        text: "Excellent! Many matching scenes have been found!",
        textJapanese: "素晴らしい！たくさんの映像が見つかったぞ！",
        mood: "happy"
      };
    } else if (resultCount > 5) {
      return {
        text: "I found several matches for you!",
        textJapanese: "いくつかの映像を見つけたぞ！",
        mood: "happy"
      };
    } else if (resultCount > 0) {
      return {
        text: "A few matches found. Not many, but every discovery counts!",
        textJapanese: "少しだけ見つかった。まあ、これも成果だ！",
        mood: "thinking"
      };
    } else {
      return {
        text: "No matches found. Try a different image!",
        textJapanese: "見つからなかった...別の画像を試してみて！",
        mood: "concerned"
      };
    }
  }

  /**
   * Text-to-Speech using ElevenLabs with Japanese voice
   */
  async textToSpeech(text, options = {}) {
    const {
      voiceId = 'KgETZ36CCLD1Cob4xpkv',
      modelId = 'eleven_flash_v2_5',
      japaneseText = null,
      outputDir = path.join(__dirname, '../../public/audio')
    } = options;

    try {
      console.log('🎤 Generating speech with ElevenLabs...');

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      if (!this.elevenLabs) {
        console.log('⚠️ ElevenLabs not configured, returning null');
        return {
          audioUrl: null,
          duration: this.estimateDuration(text),
          useFallback: true,
          text,
          japaneseText: null
        };
      }

      // Use pre-translated Japanese if available
      const ttsText = japaneseText || text;
      console.log(japaneseText ? '✅ Using pre-translated Japanese' : '⚠️ Using original text');

      const audioStream = await this.elevenLabs.textToSpeech.convert(voiceId, {
        text: ttsText,
        modelId: modelId,
        outputFormat: 'mp3_44100_128'
      });

      const chunks = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk);
      }
      const audioBuffer = Buffer.concat(chunks);

      const filename = `elevenlabs-tts-${uuidv4()}.mp3`;
      const filepath = path.join(outputDir, filename);
      
      fs.writeFileSync(filepath, audioBuffer);

      const duration = this.estimateDuration(ttsText, true);
      console.log(`✅ Audio generated: ${filename} (${duration.toFixed(1)}s)`);

      // Auto-delete after 2 minutes
      setTimeout(() => {
        this.deleteAudioFile(filepath);
      }, 2 * 60 * 1000);

      return {
        audioUrl: `/audio/${filename}`,
        localPath: filepath,
        filename,
        duration,
        useFallback: false,
        text,
        japaneseText: ttsText
      };
    } catch (error) {
      console.error('❌ ElevenLabs TTS Error:', error);
      return {
        audioUrl: null,
        duration: this.estimateDuration(text),
        useFallback: true,
        text,
        japaneseText: null
      };
    }
  }

  /**
   * Estimate speech duration
   */
  estimateDuration(text, isJapanese = false) {
    if (isJapanese) {
      return Math.max(1, text.length / 5);
    }
    const words = text.split(/\s+/).length;
    return Math.max(1, words / 2.5);
  }

  /**
   * Generate lip sync data for avatar
   */
  generateLipSyncData(text, duration) {
    const phonemeGroups = {
      'A': ['a', 'à', 'á', 'ả', 'ã', 'ạ'],
      'E': ['e', 'è', 'é', 'ẻ', 'ẽ', 'ẹ', 'ê'],
      'I': ['i', 'ì', 'í', 'ỉ', 'ĩ', 'ị', 'y'],
      'O': ['o', 'ò', 'ó', 'ỏ', 'õ', 'ọ', 'ô', 'ơ'],
      'U': ['u', 'ù', 'ú', 'ủ', 'ũ', 'ụ', 'ư'],
      'M': ['m', 'b', 'p'],
      'N': ['n', 'd', 't', 'l'],
      'F': ['f', 'v'],
      'S': ['s', 'z', 'x', 'c'],
      'K': ['k', 'g', 'q', 'c'],
      'TH': ['th'],
      'SH': ['sh', 'ch'],
      'R': ['r'],
      'W': ['w'],
      'REST': [' ', '.', ',', '!', '?']
    };

    const visemes = [];
    const chars = text.toLowerCase().split('');
    const timePerChar = duration / Math.max(chars.length, 1);

    chars.forEach((char, index) => {
      let viseme = 'REST';
      
      for (const [v, chars_list] of Object.entries(phonemeGroups)) {
        if (chars_list.includes(char)) {
          viseme = v;
          break;
        }
      }

      visemes.push({
        time: index * timePerChar,
        viseme,
        duration: timePerChar * 0.8
      });
    });

    return visemes;
  }

  /**
   * Delete audio file
   */
  deleteAudioFile(filepath) {
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        console.log(`🗑️ Deleted audio file: ${path.basename(filepath)}`);
        return true;
      }
    } catch (error) {
      console.error(`❌ Failed to delete audio file: ${error.message}`);
    }
    return false;
  }

  /**
   * Delete audio file by filename
   */
  deleteAudioByFilename(filename) {
    const filepath = path.join(__dirname, '../../public/audio', filename);
    return this.deleteAudioFile(filepath);
  }
}

// Export singleton instance
const meguminService = new MeguminService();
export default meguminService;
