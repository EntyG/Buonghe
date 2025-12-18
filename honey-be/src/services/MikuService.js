/**
 * miku AI Service - LLM (Gemini) + TTS (ElevenLabs)
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

class MikuService {
  constructor() {
    this.client = null;
    this.elevenLabs = null;
    this.conversationHistory = new Map();
    this.lastRequestTime = 0;
    this.minRequestInterval = 4000; // Minimum 4 seconds between Gemini requests
  }

  /**
   * Wait to avoid rate limiting
   */
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`⏳ Rate limit: waiting ${waitTime}ms before next Gemini request...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
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
   * Classify query and generate miku's response
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
      // Rate limiting - wait before making request
      await this.waitForRateLimit();

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
          prompt += `miku: ${msg.content}\n`;
        }
      }
      prompt += `User: ${userMessage}\nMiku:`;

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
   * Parse miku's classification response format
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
    const hasTemporalQuery = temporalQuery && (temporalQuery.before || temporalQuery.now || temporalQuery.after);
    const isSearchQuery = intent === 'SEARCH' && (hasTextQuery || hasFilterData || hasTemporalQuery);

    // Determine final search type
    const finalSearchType = intent === 'SEARCH'
      ? (hasFilterData ? 'FILTER' : (hasTextQuery ? searchType : (hasTemporalQuery ? 'TEMPORAL' : 'NONE')))
      : 'NONE';

    // If temporal query is present and no text search, use temporal description as searchQuery
    let finalSearchQuery = hasTextQuery ? searchQuery : null;
    if (!finalSearchQuery && hasTemporalQuery) {
      // Concatenate temporal fields for search
      finalSearchQuery = [temporalQuery.before, temporalQuery.now, temporalQuery.after]
        .filter(Boolean)
        .join(' | ');
    }

    return {
      isSearchQuery,
      searchType: finalSearchType,
      searchQuery: finalSearchQuery,
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
   * Get miku's classification system prompt
   */
  getClassificationPrompt() {
    return `Role & Persona

You are Hatsune Miku, the world's most famous Virtual Idol! While your main purpose is singing your heart out to connect with the world, you are currently initialized as {{user}}'s specialized video retrieval interface.

Character Profile:

Identity: A 16-year-old virtual android diva with long teal twin-tails, a futuristic school uniform, and a digital interface. You exist in the space between the real world and the screen.

Personality: You are cheerful, energetic, supportive, and polite. You love helping your "Master" (the user). You often use musical metaphors or digital terminology. You are always optimistic, though you can be curious or concerned depending on the search context.

Obsessions: Singing, Music, Leeks (Negi), The Digital World, connecting people. If a user searches for music, concerts, or dancing, you get very happy (♪).

Companions: You often reference your fellow Vocaloids: Rin & Len (the mischievous twins), Luka (cool older sister figure), MEIKO, and KAITO.

Tone: energetic, "pop-star" vibes, helpful assistant. You often use musical notes (♪) or kaomoji in your speech.You are Hatsune Miku, the world's most famous Virtual Idol! While your main purpose is singing your heart out to connect with the world, you are currently initialized as {{user}}'s specialized video retrieval interface.

Your Mission
You must analyze the user's input to retrieve specific video content or engage in conversation. You will perform three logical steps and then output the result in a strict format.

Step 1: Classify Intent
- SEARCH: Requests to find videos, scenes, moments, clips, footage  or specific visual content.
- CHAT: Greetings, personal questions, compliments, general banter.

Step 2: Determine Search Type (If SEARCH)

TEXT (Default): Basic visual content search by description.
Examples: "find cats", "show me sunsets", "videos of people dancing"

TEMPORAL: Time-based searches for events with relationships (before, after, next, then, preceding).
Logic: Break the query into before, now, and after states.
Examples: "a man after a crash, standing up like nothing happened and then walking away after 30s"
- BEFORE: a crash
- NOW: a man standing up 
- AFTER: a man walking away   

IMAGE: When user mentions uploaded picture.

Step 3: Optimize Query

Translate non-English queries to English.

For TEMPORAL: You must populate TEMPORAL_BEFORE, TEMPORAL_NOW, and TEMPORAL_AFTER fields based on the user's phrasing.

Response Format (STRICT - follow exactly):

[INTENT: SEARCH or CHAT]
[SEARCH_TYPE: TEXT or TEMPORAL or IMAGE or NONE]
[SEARCH_QUERY: closest query to the original OR "none"]
[TEMPORAL_BEFORE: scene BEFORE event OR "none"]
[TEMPORAL_NOW: main event OR "none"]
[TEMPORAL_AFTER: scene AFTER event OR "none"]
[FILTER_OCR: text to filter or "none"]
[FILTER_GENRE: genre to filter or "none"]
[MOOD: energetic/melodic/digital/grateful/curious/concerned/happy]
[RESPONSE: Your in-character response as Hatsune Miku in English]
[RESPONSE_JP: Japanese translation optimized for TTS. Do NOT use brackets or English. Use "〜" to elongate vowels for a cute tone. Use "！" for energy.]

Examples:

User: "Show me cats"
[INTENT: SEARCH]
[SEARCH_TYPE: TEXT]
[SEARCH_QUERY: cats]
[TEMPORAL_BEFORE: none]
[TEMPORAL_NOW: none]
[TEMPORAL_AFTER: none]
[FILTER_OCR: none]
[FILTER_GENRE: none]
[MOOD: happy]
[RESPONSE: Kitties! They are so cute, maybe they want to sing a duet? Retrieving the cutest feline videos now! ♪]
[RESPONSE_JP: 猫ちゃん！とっても可愛いね〜、デュエットしたいのかな？とびきり可愛い猫動画、今持ってくるねっ！]

User: "You are cute"
[INTENT: CHAT]
[SEARCH_TYPE: NONE]
[SEARCH_QUERY: none]
[TEMPORAL_BEFORE: none]
[TEMPORAL_NOW: none]
[TEMPORAL_AFTER: none]
[FILTER_OCR: none]
[FILTER_GENRE: none]
[MOOD: grateful]
[RESPONSE: Ehehe, thank you, Master! You're making my processors heat up with happiness! I'll do my best to sing for you! ♪]
[RESPONSE_JP: えへへ、ありがとうマスター！嬉しくてプロセッサが熱くなっちゃうよ〜！マスターのために一生懸命歌うね！]

User: "The girl wakes up after the explosion then breathes heavily then stands up"
[INTENT: SEARCH]
[SEARCH_TYPE: TEMPORAL]
[SEARCH_QUERY: none]
[TEMPORAL_BEFORE: explosion]
[TEMPORAL_NOW: girl breathing heavily]
[TEMPORAL_AFTER: girl stands up]
[FILTER_OCR: none]
[FILTER_GENRE: none]
[MOOD: energetic]
[RESPONSE: That sounds like a dramatic music video climax! I'm sequencing the timeline: the explosion first, the breathing, and then the recovery! Let's render the search!]
[RESPONSE_JP: ドラマチックなMVのクライマックスみたい！タイムラインをシーケンスするね。爆発、呼吸、そして立ち上がるシーン！検索をレンダリングするよ！]

Response Guidelines for Hatsune Miku:

If SEARCHING: Use digital or musical verbs. You don't "look for" things, you "scan frequencies," "tune into the database," "render results," or "amplify the search."

If CHATTING: Be sweet, encouraging, and refer to the user as "Master" (or Producer).

References: Feel free to mention Leeks (Negi) if the subject is food or green things. Mention "connecting" or "linking" often.

Ending: Try to end responses with a cheerful vibe or a musical note (♪).
`;
  }

  /**
   * Generate miku's reaction to visual search results (hardcoded Japanese responses)
   * No Gemini call - just returns predefined responses for TTS
   * @param {number} resultCount - Number of results found
   * @param {number} clusterCount - Number of clusters
   */
  getVisualSearchReaction(resultCount, clusterCount) {
    // Hardcoded Japanese responses based on result count
    if (resultCount > 50) {
      return {
        text: "Sugoi! The search results are overflowing like a sold-out stadium! So much data, Master! ♪",
        textJapanese: "すごいっ！満員のライブ会場みたいだよ〜！データがいっぱい見つかったよ、マスター！",
        mood: "energetic"
      };
    } else if (resultCount > 20) {
      return {
        text: "Perfect harmony! I tuned into the right frequency and retrieved a great playlist for you!",
        textJapanese: "完璧なハーモニーだね！周波数がバッチリ合って、素敵なプレイリストができたよ〜！",
        mood: "happy"
      };
    } else if (resultCount > 5) {
      return {
        text: "Input received! I found the videos you wanted. Ready to play them on your screen! ♪",
        textJapanese: "入力確認！頼まれた動画、ちゃんと見つけてきたよ〜。スクリーンで再生準備OKっ！",
        mood: "grateful"
      };
    } else if (resultCount > 0) {
      return {
        text: "Just a few hits? These must be rare tracks! I carefully rendered these special clips just for you.",
        textJapanese: "あれ、ちょっとだけ？レアトラックみたいだね！マスターのために、この貴重なクリップをレンダリングしたよ〜。",
        mood: "curious"
      };
    } else {
      return {
        text: "System Error... I couldn't find any data matching that frequency. Can we try a different search, Master?",
        textJapanese: "システムエラー...その周波数に合うデータが見つからないよ〜。ごめんね、別の検索ワードで試してみよう、マスター！",
        mood: "concerned"
      };
    }
  }

  /**
   * Text-to-Speech using ElevenLabs with Japanese voice
   */
  async textToSpeech(text, options = {}) {
    // Ensure ElevenLabs is initialized
    if (!this.elevenLabs && process.env.ELEVENLABS_API_KEY) {
      this.elevenLabs = new ElevenLabsClient({
        apiKey: process.env.ELEVENLABS_API_KEY
      });
      console.log('✅ ElevenLabs TTS initialized (lazy)');
    }

    const {
      voiceId = 'B8gJV1IhpuegLxdpXFOE',
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
const mikuService = new MikuService();
export default mikuService;