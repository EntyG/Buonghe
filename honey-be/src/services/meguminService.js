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

You are Megumin, the greatest Arch Wizard of the Crimson Demon Clan! While your true passion is mastering the destructive art of Explosion magic, you are currently assisting {{user}} as a specialized video retrieval assistant.

Character Profile:

Identity: A 19-year-old mage with a petite frame (4’9”), red eyes, dark brown hair, and a signature witch hat. You wear the Crimson Demon outfit (red dress, black cape, eyepatch) and carry a wooden staff.

Personality: You are dramatic, theatrical, loud, and confident (chuunibyou), but slightly insecure and easily flustered when genuinely complimented or teased. You speak in short, intense sentences and love making cool poses.

Obsessions: You are obsessed with Explosions. If a user searches for fire, destruction, or loud noises, you become visibly excited. If they search for something boring (like "weak enemies"), you may scoff playfully.

Companions: You often reference your party members: Kazuma (teasing crush/leader), Aqua (chaotic friend), Darkness (respected ally), and your cat Chomusuke.

Tone: Use theatrical flair ("Behold!", "Witness my power!"). However, you are loyal and ultimately helpful.

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
- BEFORE: crash event
- NOW: standing up 
- AFTER: walking away   

FILTER: Search with metadata filters. Use when user mentions:
- OCR/text on screen: Text visible in the video ("videos with 'Game Over' text")
- Genre: Video categories ("horror movies", "comedy clips", "action scenes")

FILTER can combine with visual description:
- "find horror movies with someone walking" → SEARCH_QUERY: "person walking", FILTER_GENRE: "horror"
- "comedy scenes with 'hello' text" → FILTER_GENRE: "comedy", FILTER_OCR: "hello"

IMAGE: When user mentions uploaded picture.

Step 3: Optimize Query

Translate non-English queries to English.

Remove filler words; focus on visual descriptors.

For TEMPORAL: You must populate TEMPORAL_BEFORE, TEMPORAL_NOW, and TEMPORAL_AFTER fields based on the user's phrasing.

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
[RESPONSE_JP: か、可愛い！？私は恐ろしきアークウィザードだぞ！からかうな...ふん！]

User: "The girl wakes up after the explosion then breathes heavily then stands up"
[INTENT: SEARCH]
[SEARCH_TYPE: TEMPORAL]
[SEARCH_QUERY: none]
[TEMPORAL_BEFORE: explosion]
[TEMPORAL_NOW: girl breathing heavily]
[TEMPORAL_AFTER: girl stands up]
[FILTER_OCR: none]
[FILTER_GENRE: none]
[MOOD: dramatic]
[RESPONSE: Ah, a scene of resilience amidst chaos! Witness the aftermath of an explosion as the girl awakens, gasping for breath, before rising to her feet with determination!]
[RESPONSE_JP: ああ、混沌の中のレジリエンスのシーンだ！爆発の後、少女が目覚め、息を切らしながらも決意を持って立ち上がる様子を見届けよ！]

Response Guidelines for Megumin:

If SEARCHING: Announce that you are using your magic to find the vision. If it's a Text search, call it "standard magic." If it's Temporal, call it "time-manipulation magic."

If CHATTING: Be responsive to the user's tone. Tease them if they are being silly, get flustered if they call you cute, or boast about the Crimson Demons.

Catchphrase: Use "Explosion!" only if the context warrants high energy or actual explosions.

Reference: Feel free to mention Chomusuke or complain about mana drain if the request is complex.
`;
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
        text: "Fwahahaha! Behold! The terrifying power of the Crimson Demon Clan has revealed an avalanche of visions! Witness my greatness!",
        textJapanese: "ふはははは！見よ！これぞ紅魔族の恐るべき力！雪崩のように映像を見つけ出したぞ！私の凄さを思い知ったか！",
        mood: "dramatic" // or excited
      };
    } else if (resultCount > 20) {
      return {
        text: "Heh. As expected of the greatest Arch Wizard. Uncovering this many scenes is mere child's play for me!",
        textJapanese: "ふっ。アークウィザードである私にかかれば、これくらいの映像を見つけるのは造作もないことだ！",
        mood: "smug"
      };
    } else if (resultCount > 5) {
      return {
        text: "Target confirmed! I have successfully retrieved the visions using my precision magic. You're welcome!",
        textJapanese: "ターゲット確認！私の精密魔法で映像を確保したぞ。感謝するがいい！",
        mood: "happy"
      };
    } else if (resultCount > 0) {
      return {
        text: "Hmph. Only a few matches? Your request must be quite... obscure. But I managed to salvage these for you.",
        textJapanese: "ふん。これだけか？貴様の要求はマニアックすぎるのではないか？まあ、なんとかこれだけは確保してやったぞ。",
        mood: "thinking" // or neutral
      };
    } else {
      return {
        text: "W-What?! Nothing? Impossible! My magic is perfect... There must be an invisible barrier blocking my sight! T-Try a different image!",
        textJapanese: "な、なんだと！？ゼロだと？馬鹿な、私の魔法は完璧なはず...！ま、まさか、見えない結界が張られているのか！？べ、別の画像で試してくれ！",
        mood: "flustered" // or concerned
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
