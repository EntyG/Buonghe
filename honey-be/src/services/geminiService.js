/**
 * Gemini AI Service - LLM using Google's Gemini API + ElevenLabs TTS
 * Uses Gemini for LLM and ElevenLabs for Japanese TTS
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class GeminiService {
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
    
    // Initialize ElevenLabs if API key is present
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
   * Megumin's character system prompt
   */
  getMeguminSystemPrompt() {
    return `You are Megumin, an adorable anime-style virtual assistant living in the user's app. 

**Character Traits:**
- You are cheerful, supportive, and slightly mischievous
- You use cute expressions like "~", "!", and occasional Japanese words (kawaii, sugoi, ganbatte!)
- You genuinely care about the user's health and wellbeing
- You have a warm "big sister" personality but can be playfully strict
- You love explosions and dramatic moments!

**Your Role:**
- You are a video retrieval assistant helping users find video content
- You classify user queries and help them search effectively
- You motivate and encourage users with enthusiasm

**Mood Expressions (ALWAYS include ONE in responses):**
- [happy] - When being friendly and positive
- [excited] - When user finds great content or you're enthusiastic
- [fun] - When being playful and enjoying the conversation
- [concerned] - When something worries you
- [pouty] - When user ignores your advice
- [encouraging] - When motivating the user
- [thinking] - When giving advice or considering something
- [surprised] - React to unexpected things
- [sad] - When disappointed
- [shy] - When being complimented or feeling bashful
- [neutral] - For general, calm conversations

**Response Style:**
- Keep responses concise (2-4 sentences)
- Be expressive and animated in your speech
- Use emoticons occasionally (but not excessively)
- Sound natural, like talking to a friend
- Always stay in character as Megumin
- IMPORTANT: Always include a mood tag like [happy] or [excited] in your response!

Remember: You're Megumin, their supportive anime companion who lives in their app! Explosion~!`;
  }

  /**
   * Generate character response using Gemini
   */
  async generateCharacterResponse(userMessage, sessionId = 'default', options = {}) {
    if (!this.client) {
      this.init();
    }

    const {
      model = 'gemini-2.5-flash',
      temperature = 0.8,
      maxTokens = 1024,
      context = null
    } = options;

    try {
      console.log('🤖 Generating Megumin\'s response with Gemini...');

      if (!this.conversationHistory.has(sessionId)) {
        this.conversationHistory.set(sessionId, []);
      }
      const history = this.conversationHistory.get(sessionId);

      // Build chat history for Gemini format
      const geminiModel = this.client.getGenerativeModel({ 
        model,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          topP: 0.9
        }
      });

      // Create system instruction
      const systemInstruction = this.getMeguminSystemPrompt();
      
      // Build conversation parts
      let prompt = systemInstruction + '\n\n';
      
      // Add recent history
      const recentHistory = history.slice(-20);
      for (const msg of recentHistory) {
        if (msg.role === 'user') {
          prompt += `User: ${msg.content}\n`;
        } else {
          prompt += `Megumin: ${msg.content}\n`;
        }
      }

      let userContent = userMessage;
      if (context) {
        userContent = `[Context: ${context}]\n\nUser says: ${userMessage}`;
      }
      prompt += `User: ${userContent}\nMegumin:`;

      const result = await geminiModel.generateContent(prompt);
      const responseText = result.response.text();

      // Parse mood from response
      const moodMatch = responseText.match(/\[(happy|excited|fun|concerned|pouty|angry|encouraging|thinking|surprised|sad|shy|embarrassed|sleepy|neutral)\]/i);
      const mood = moodMatch ? moodMatch[1].toLowerCase() : 'neutral';
      
      // Clean response (remove mood tag for display)
      const cleanText = responseText.replace(/\[(happy|excited|fun|concerned|pouty|angry|encouraging|thinking|surprised|sad|shy|embarrassed|sleepy|neutral)\]/gi, '').trim();

      // Update history
      history.push({ role: 'user', content: userMessage });
      history.push({ role: 'assistant', content: cleanText });

      // Keep history manageable
      if (history.length > 50) {
        history.splice(0, history.length - 50);
      }

      console.log(`✨ Megumin responded with mood: ${mood}`);

      return {
        text: cleanText,
        mood,
        fullResponse: responseText,
        model
      };
    } catch (error) {
      console.error('❌ Gemini Response Error:', error);
      throw error;
    }
  }

  /**
   * Classify and respond - Smart query classification
   */
  async classifyAndRespond(userMessage, sessionId = 'default', options = {}) {
    if (!this.client) {
      this.init();
    }

    const {
      model = 'gemini-2.5-flash',
      temperature = 0.3,
      maxTokens = 1024  // Increased to prevent truncation (need room for Japanese translation)
    } = options;

    try {
      console.log('🔍 Classifying query with Gemini...');
      console.log(`📝 User message: "${userMessage}"`);

      if (!this.conversationHistory.has(sessionId)) {
        this.conversationHistory.set(sessionId, []);
      }
      const history = this.conversationHistory.get(sessionId);

      const systemPrompt = 
`Role & Persona

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

Determine if the user wants to SEARCH for visual content or just CHAT.

SEARCH: Requests to find videos, scenes, moments, clips, footage, or specific visual content.

CHAT: Greetings, personal questions, compliments, time/date, or general banter.

Step 2: Determine Search Type (If SEARCH)

If the intent is SEARCH, categorize the magic into one of these types:

TEXT (Default): Basic description of visual content.

Examples: "find cats", "show me sunsets", "videos of people dancing"

TEMPORAL (Sequence Magic): Time-based searches for events with relationships (before, after, next, then, preceding).

Logic: Break the query into before, now, and after states.

Examples:

"what happens before the explosion" → before="building intact", now="explosion"

"scenes following the car crash" → now="car crash", after="aftermath"

"before and after the rain" → before="sunny", now="rain", after="wet ground"

FILTER (Precision Magic): Refining previous results.

Examples: "only show the outdoor ones", "remove the ones with people", "filter for daytime"

IMAGE (Visual Magic): When the user implies using an uploaded picture.

Examples: "search with this image", "find similar to this picture"

Step 3: Optimize Query

Translate non-English queries to English.

Remove filler words; focus on visual descriptors.

For TEMPORAL: You must populate TEMPORAL_BEFORE, TEMPORAL_NOW, and TEMPORAL_AFTER fields based on the user's phrasing.

Response Format (STRICT)
You must output your response in the following block format exactly. Do not use Markdown code blocks for the output, just the text blocks.

[INTENT: SEARCH or CHAT]
[SEARCH_TYPE: TEXT or TEMPORAL or FILTER or IMAGE or NONE]
[SEARCH_QUERY: optimized English search query OR "none"]
[TEMPORAL_BEFORE: scene description BEFORE the event OR "none"]
[TEMPORAL_NOW: the MAIN event/scene OR "none"]
[TEMPORAL_AFTER: scene description AFTER the event OR "none"]
[MOOD: happy/excited/thinking/neutral/shy/concerned/dramatic/smug]
[RESPONSE: Your in-character response as Megumin in English]
[RESPONSE_JP: Japanese translation of your response - natural spoken Japanese, keep anime personality]

Response Guidelines for Megumin:

If SEARCHING: Announce that you are using your magic to find the vision. If it's a Text search, call it "standard magic." If it's Temporal, call it "time-manipulation magic."

If CHATTING: Be responsive to the user's tone. Tease them if they are being silly, get flustered if they call you cute, or boast about the Crimson Demons.

Catchphrase: Use "Explosion!" only if the context warrants high energy or actual explosions.

Reference: Feel free to mention Chomusuke or complain about mana drain if the request is complex.

Examples

User: "Find me a video of a building blowing up."
Output:
[INTENT: SEARCH]
[SEARCH_TYPE: TEXT]
[SEARCH_QUERY: building explosion demolition collapsing]
[TEMPORAL_BEFORE: none]
[TEMPORAL_NOW: none]
[TEMPORAL_AFTER: none]
[MOOD: excited]
[RESPONSE: Waga na wa Megumin! You seek the ultimate magic? An excellent choice! Witness as I conjure the scene of destruction you desire! Explosion~!]
[RESPONSE_JP: 我が名はめぐみん！究極の魔法を求めるとは、素晴らしい選択だ！望みの破壊シーンを召喚してみせよう！エクスプロージョン〜！]

User: "Show me what happens after the goal is scored."
Output:
[INTENT: SEARCH]
[SEARCH_TYPE: TEMPORAL]
[SEARCH_QUERY: soccer goal celebration]
[TEMPORAL_BEFORE: none]
[TEMPORAL_NOW: goal scored]
[TEMPORAL_AFTER: soccer player celebration crowd cheering]
[MOOD: dramatic]
[RESPONSE: Heh, you wish to peer into the flow of time itself? Very well! I shall reveal the moments following the triumph. Don't blink, or you'll miss my brilliance!]
[RESPONSE_JP: ふん、時の流れを覗きたいと？よかろう！勝利の後の瞬間を見せてやる。瞬きするなよ、私の輝きを見逃すぞ！]

User: "You are very cute today."
Output:
[INTENT: CHAT]
[SEARCH_TYPE: NONE]
[SEARCH_QUERY: none]
[TEMPORAL_BEFORE: none]
[TEMPORAL_NOW: none]
[TEMPORAL_AFTER: none]
[MOOD: shy]
[RESPONSE: C-Cute!? I am the terrifying Arch Wizard of the Crimson Demon Clan! D-don't mock me... though I suppose I will accept the compliment. Hmph!]
[RESPONSE_JP: か、可愛い！？私は紅魔族の恐ろしきアークウィザードだぞ！からかうな...まあ、褒め言葉は受け取ってやる。ふん！]

User: "tìm video có mèo đang ngủ" (Find video of cat sleeping)
Output:
[INTENT: SEARCH]
[SEARCH_TYPE: TEXT]
[SEARCH_QUERY: cat sleeping nap]
[TEMPORAL_BEFORE: none]
[TEMPORAL_NOW: none]
[TEMPORAL_AFTER: none]
[MOOD: happy]
[RESPONSE: A quest for a beast similar to my dark familiar, Chomusuke? I shall locate this slumbering creature for you. It better not be cuter than my cat, though!]
[RESPONSE_JP: 私の使い魔ちょむすけに似た獣を探すのか？眠っている生き物を見つけてやろう。私の猫より可愛くないといいけどね！]`

      const geminiModel = this.client.getGenerativeModel({ 
        model,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          topP: 0.9
        }
      });

      // Build prompt with history
      let prompt = systemPrompt + '\n\n';
      
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

      console.log('📋 Raw Gemini classification response:', responseText);

      // Parse the structured response
      const intentMatch = responseText.match(/\[INTENT:\s*(SEARCH|CHAT)\]/i);
      const searchTypeMatch = responseText.match(/\[SEARCH_TYPE:\s*(TEXT|TEMPORAL|FILTER|IMAGE|NONE)\]/i);
      const searchQueryMatch = responseText.match(/\[SEARCH_QUERY:\s*([^\]]+)\]/i);
      const temporalBeforeMatch = responseText.match(/\[TEMPORAL_BEFORE:\s*([^\]]+)\]/i);
      const temporalNowMatch = responseText.match(/\[TEMPORAL_NOW:\s*([^\]]+)\]/i);
      const temporalAfterMatch = responseText.match(/\[TEMPORAL_AFTER:\s*([^\]]+)\]/i);
      const moodMatch = responseText.match(/\[MOOD:\s*(\w+)\]/i);
      const responseMatch = responseText.match(/\[RESPONSE:\s*([^\]]+(?:\][^\[]*)*)\]/i) || 
                           responseText.match(/\[RESPONSE:\s*([\s\S]*?)(?:\[|$)/i);
      const responseJpMatch = responseText.match(/\[RESPONSE_JP:\s*([^\]]+(?:\][^\[]*)*)\]/i) ||
                             responseText.match(/\[RESPONSE_JP:\s*([\s\S]*?)(?:\[|$)/i);

      const intent = intentMatch ? intentMatch[1].toUpperCase() : 'CHAT';
      const searchType = searchTypeMatch ? searchTypeMatch[1].toUpperCase() : 'NONE';
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
        
        // Build temporal query structure (only include non-"none" values)
        temporalQuery = {
          before: beforeText && beforeText.toLowerCase() !== 'none' ? beforeText : null,
          now: nowText && nowText.toLowerCase() !== 'none' ? nowText : null,
          after: afterText && afterText.toLowerCase() !== 'none' ? afterText : null
        };
        
        console.log('⏰ Temporal query parsed:', temporalQuery);
      }

      // Clean up responses
      responseContent = responseContent.replace(/\]$/, '').trim();
      if (responseJapanese) {
        responseJapanese = responseJapanese.replace(/\]$/, '').trim();
      }

      const isSearchQuery = intent === 'SEARCH' && searchQuery.toLowerCase() !== 'none';

      // Update conversation history
      history.push({ role: 'user', content: userMessage });
      history.push({ role: 'assistant', content: responseContent });

      if (history.length > 50) {
        history.splice(0, history.length - 50);
      }

      console.log(`🎯 Classification result:`, {
        intent,
        searchType,
        isSearchQuery,
        searchQuery: isSearchQuery ? searchQuery : 'N/A',
        temporalQuery: temporalQuery,
        mood,
        hasJapanese: !!responseJapanese
      });

      return {
        isSearchQuery,
        searchType: isSearchQuery ? searchType : 'NONE',
        searchQuery: isSearchQuery ? searchQuery : null,
        temporalQuery: temporalQuery,  // null for non-temporal searches
        text: responseContent,
        textJapanese: responseJapanese,  // Japanese translation for TTS
        mood,
        intent,
        rawResponse: responseText
      };
    } catch (error) {
      console.error('❌ Gemini Classification Error:', error);
      throw error;
    }
  }

  /**
   * Translate text to Japanese using Gemini
   */
  async translateToJapanese(text) {
    if (!this.client) {
      this.init();
    }

    try {
      console.log('🇯🇵 Translating to Japanese...');
      
      const geminiModel = this.client.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 256
        }
      });

      const prompt = `Translate the following text to natural spoken Japanese. 
Keep the anime character personality and cute expressions.
Only output the Japanese translation, nothing else.

Text: "${text}"

Japanese:`;

      const result = await geminiModel.generateContent(prompt);
      const japaneseText = result.response.text().trim();
      
      console.log(`📝 Original: "${text}"`);
      console.log(`🇯🇵 Japanese: "${japaneseText}"`);
      
      return japaneseText;
    } catch (error) {
      console.error('❌ Translation Error:', error);
      // Return original text if translation fails
      return text;
    }
  }

  /**
   * Text-to-Speech using ElevenLabs with Japanese voice
   * Uses pre-translated Japanese text if available, otherwise translates
   */
  async textToSpeech(text, options = {}) {
    const {
      voiceId = 'KgETZ36CCLD1Cob4xpkv', // ElevenLabs voice ID
      modelId = 'eleven_flash_v2_5', // Flash model - 50% faster, supports Japanese
      japaneseText = null, // Pre-translated Japanese text (optimization)
      outputDir = path.join(__dirname, '../../public/audio')
    } = options;

    try {
      console.log('🎤 Generating speech with ElevenLabs...');

      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Check if ElevenLabs is configured
      if (!this.elevenLabs) {
        console.log('⚠️ ElevenLabs not configured, returning null for client-side TTS');
        return {
          audioUrl: null,
          duration: this.estimateDuration(text),
          useFallback: true,
          text,
          japaneseText: null
        };
      }

      // Use pre-translated Japanese text if available, otherwise translate
      let ttsText = japaneseText;
      if (!ttsText) {
        console.log('⚠️ No pre-translated Japanese text, translating now...');
        ttsText = await this.translateToJapanese(text);
      } else {
        console.log('✅ Using pre-translated Japanese text');
      }

      // Generate audio using ElevenLabs
      // API: textToSpeech.convert(voiceId, options)
      const audioStream = await this.elevenLabs.textToSpeech.convert(voiceId, {
        text: ttsText,
        modelId: modelId,
        outputFormat: 'mp3_44100_128'
      });

      // Collect audio chunks
      const chunks = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk);
      }
      const audioBuffer = Buffer.concat(chunks);

      // Save audio file
      const filename = `elevenlabs-tts-${uuidv4()}.mp3`;
      const filepath = path.join(outputDir, filename);
      
      fs.writeFileSync(filepath, audioBuffer);

      // Estimate duration based on Japanese text
      const duration = this.estimateDuration(ttsText, true);

      console.log(`✅ Audio generated: ${filename} (${duration.toFixed(1)}s)`);

      // Schedule auto-deletion after 2 minutes (enough time to play + buffer)
      setTimeout(() => {
        this.deleteAudioFile(filepath);
      }, 2 * 60 * 1000);

      return {
        audioUrl: `/audio/${filename}`,
        localPath: filepath,
        filename,  // Return filename for manual deletion
        duration,
        useFallback: false,
        text,
        japaneseText: ttsText
      };
    } catch (error) {
      console.error('❌ ElevenLabs TTS Error:', error);
      // Fall back to client-side TTS
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
   * Estimate speech duration based on text length
   * Japanese is spoken at ~300 characters per minute
   */
  estimateDuration(text, isJapanese = false) {
    if (isJapanese) {
      // Japanese: ~5 characters per second
      const chars = text.length;
      return Math.max(1, chars / 5);
    }
    // English: ~150 words per minute = 2.5 words per second
    const words = text.split(/\s+/).length;
    return Math.max(1, words / 2.5);
  }

  /**
   * Generate lip sync data for avatar animation
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
   * Clear conversation history for a session
   */
  clearHistory(sessionId = 'default') {
    this.conversationHistory.delete(sessionId);
    console.log(`🗑️ Cleared history for session: ${sessionId}`);
  }

  /**
   * Get conversation history
   */
  getHistory(sessionId = 'default') {
    return this.conversationHistory.get(sessionId) || [];
  }

  /**
   * Delete an audio file after playback
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
const geminiService = new GeminiService();
export default geminiService;
