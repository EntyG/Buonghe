import geminiService from '../services/geminiService.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Handle WebSocket connection for real-time Megumin chat
 * @param {WebSocket} ws - WebSocket connection
 */
export function handleWebSocketConnection(ws) {
  let sessionId = uuidv4();

  console.log(`🎀 Megumin session started: ${sessionId}`);

  ws.on('message', async (message) => {
    try {
      let data;
      try {
        data = JSON.parse(message);
      } catch {
        return;
      }

      if (!data) return;

      switch (data.type) {
        case 'chat':
        case 'chat_text':
          await handleTextChat(ws, data, sessionId);
          break;

        case 'chat_smart':
          await handleSmartChat(ws, data, sessionId);
          break;

        case 'tts':
          await handleTTS(ws, data);
          break;

        case 'meal_reaction':
          await handleMealReaction(ws, data, sessionId);
          break;

        case 'clear_history':
          geminiService.clearHistory(sessionId);
          ws.send(JSON.stringify({
            type: 'history_cleared',
            sessionId
          }));
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;

        default:
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: `Unknown command: ${data.type}` 
          }));
      }
    } catch (error) {
      console.error('❌ WebSocket message error:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: error.message 
      }));
    }
  });

  ws.on('close', () => {
    console.log(`🎀 Megumin session closed: ${sessionId}`);
  });

  ws.on('error', (error) => {
    console.error(`❌ WebSocket error (${sessionId}):`, error);
  });

  // Send welcome message from Megumin
  ws.send(JSON.stringify({
    type: 'connected',
    sessionId,
    message: 'Megumin is ready to chat! Explosion~!',
    character: {
      name: 'Megumin',
      description: 'Your anime virtual assistant for video retrieval',
      defaultMood: 'happy'
    },
    capabilities: ['chat', 'chat_text', 'chat_smart', 'tts', 'meal_reaction']
  }));
}

/**
 * Handle text chat using Gemini
 */
async function handleTextChat(ws, data, sessionId) {
  try {
    const { message, context } = data;

    if (!message) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Message is required'
      }));
      return;
    }

    console.log(`\n🎀 Text Chat: "${message}"`);

    // Send thinking status
    ws.send(JSON.stringify({
      type: 'processing',
      stage: 'thinking',
      progress: 25,
      message: 'Megumin is thinking...'
    }));

    // Generate response with Gemini
    const llmResult = await geminiService.generateCharacterResponse(
      message,
      sessionId,
      { context }
    );

    ws.send(JSON.stringify({
      type: 'megumin_thinking',
      text: llmResult.text,
      mood: llmResult.mood
    }));

    // Generate TTS
    ws.send(JSON.stringify({
      type: 'processing',
      stage: 'tts',
      progress: 75,
      message: 'Megumin is preparing to speak...'
    }));

    let ttsResult;
    let useFallback = false;

    try {
      ttsResult = await geminiService.textToSpeech(llmResult.text, {
        voice: 'en-US-Neural2-F',
        pitch: 2.0
      });
      useFallback = ttsResult.useFallback || false;
    } catch (ttsError) {
      console.warn('⚠️ TTS failed:', ttsError.message);
      useFallback = true;
      const estimatedDuration = geminiService.estimateDuration(llmResult.text);
      ttsResult = {
        audioUrl: null,
        duration: estimatedDuration
      };
    }

    // Complete
    ws.send(JSON.stringify({
      type: 'processing',
      stage: 'complete',
      progress: 100,
      message: 'Ready!'
    }));

    const avatarData = prepareAvatarData(llmResult, ttsResult);

    ws.send(JSON.stringify({
      type: 'megumin_response',
      userMessage: message,
      meguminResponse: {
        text: llmResult.text,
        mood: llmResult.mood
      },
      audio: useFallback ? null : {
        url: ttsResult.audioUrl,
        duration: ttsResult.duration
      },
      avatar: avatarData,
      sessionId,
      useFallbackAudio: useFallback
    }));

  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      message: error.message
    }));
  }
}

/**
 * Handle smart chat (query classification) using Gemini
 */
async function handleSmartChat(ws, data, sessionId) {
  try {
    const { message } = data;

    if (!message) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Message is required'
      }));
      return;
    }

    console.log(`\n🎀 Smart Chat: "${message}"`);

    // Send thinking status
    ws.send(JSON.stringify({
      type: 'processing',
      stage: 'classifying',
      progress: 25,
      message: 'Megumin is analyzing your request...'
    }));

    // Classify and respond with Gemini
    const llmResult = await geminiService.classifyAndRespond(
      message,
      sessionId
    );

    ws.send(JSON.stringify({
      type: 'megumin_thinking',
      text: llmResult.text,
      mood: llmResult.mood,
      isSearchQuery: llmResult.isSearchQuery,
      searchType: llmResult.searchType,
      searchQuery: llmResult.searchQuery
    }));

    // Generate TTS
    ws.send(JSON.stringify({
      type: 'processing',
      stage: 'tts',
      progress: 75,
      message: 'Megumin is preparing to speak...'
    }));

    let ttsResult;
    let useFallback = false;

    try {
      ttsResult = await geminiService.textToSpeech(llmResult.text, {
        voice: 'en-US-Neural2-F',
        pitch: 2.0
      });
      useFallback = ttsResult.useFallback || false;
    } catch (ttsError) {
      console.warn('⚠️ TTS failed:', ttsError.message);
      useFallback = true;
      const estimatedDuration = geminiService.estimateDuration(llmResult.text);
      ttsResult = {
        audioUrl: null,
        duration: estimatedDuration
      };
    }

    // Complete
    ws.send(JSON.stringify({
      type: 'processing',
      stage: 'complete',
      progress: 100,
      message: 'Ready!'
    }));

    const avatarData = prepareAvatarData(llmResult, ttsResult);

    ws.send(JSON.stringify({
      type: 'megumin_smart_response',
      userMessage: message,
      isSearchQuery: llmResult.isSearchQuery,
      searchType: llmResult.searchType,
      searchQuery: llmResult.searchQuery,
      intent: llmResult.intent,
      meguminResponse: {
        text: llmResult.text,
        mood: llmResult.mood
      },
      audio: useFallback ? null : {
        url: ttsResult.audioUrl,
        duration: ttsResult.duration
      },
      avatar: avatarData,
      sessionId,
      useFallbackAudio: useFallback
    }));

  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      message: error.message
    }));
  }
}

/**
 * Handle TTS only (no LLM)
 */
async function handleTTS(ws, data) {
  try {
    const { text, voice = 'en-US-Neural2-F', pitch = 2.0 } = data;

    if (!text) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Text is required'
      }));
      return;
    }

    ws.send(JSON.stringify({
      type: 'processing',
      stage: 'tts',
      progress: 50,
      message: 'Generating speech...'
    }));

    const ttsResult = await geminiService.textToSpeech(text, { voice, pitch });

    ws.send(JSON.stringify({
      type: 'tts_result',
      audio: ttsResult.useFallback ? null : {
        url: ttsResult.audioUrl,
        duration: ttsResult.duration
      },
      useFallbackAudio: ttsResult.useFallback,
      text
    }));

  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      message: error.message
    }));
  }
}

/**
 * Handle meal reaction
 */
async function handleMealReaction(ws, data, sessionId) {
  try {
    const { mealDescription, isHealthy, calories, nutrients } = data;

    if (!mealDescription) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Meal description is required'
      }));
      return;
    }

    // Build context for Megumin
    const context = `The user is showing their meal: "${mealDescription}". 
    Health assessment: ${isHealthy ? 'This is a healthy choice!' : 'This could be healthier...'}
    ${calories ? `Calories: ~${calories}` : ''}
    ${nutrients ? `Key nutrients: ${nutrients}` : ''}`;

    const message = isHealthy 
      ? "Look at my meal! What do you think?"
      : "I'm about to eat this... don't judge me!";

    // Generate response
    const llmResult = await geminiService.generateCharacterResponse(
      message,
      sessionId,
      { context }
    );

    // Generate TTS
    let ttsResult;
    let useFallback = false;

    try {
      ttsResult = await geminiService.textToSpeech(llmResult.text, {
        voice: 'en-US-Neural2-F',
        pitch: 2.0
      });
      useFallback = ttsResult.useFallback || false;
    } catch (ttsError) {
      useFallback = true;
      const estimatedDuration = geminiService.estimateDuration(llmResult.text);
      ttsResult = {
        audioUrl: null,
        duration: estimatedDuration
      };
    }

    const avatarData = prepareAvatarData(llmResult, ttsResult);

    ws.send(JSON.stringify({
      type: 'meal_reaction',
      meal: mealDescription,
      isHealthy,
      meguminResponse: {
        text: llmResult.text,
        mood: llmResult.mood
      },
      audio: useFallback ? null : {
        url: ttsResult.audioUrl,
        duration: ttsResult.duration
      },
      avatar: avatarData,
      sessionId,
      useFallbackAudio: useFallback
    }));

  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      message: error.message
    }));
  }
}

// ═══════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════

/**
 * Map mood to intensity
 */
function mapMoodToEmotion(mood) {
  const moodMap = {
    'happy': 'happy',
    'excited': 'happy',
    'concerned': 'sad',
    'pouty': 'angry',
    'encouraging': 'happy',
    'thinking': 'normal',
    'surprised': 'happy',
    'sad': 'sad',
    'angry': 'angry',
    'neutral': 'normal'
  };
  return moodMap[mood] || 'normal';
}

/**
 * Prepare avatar animation data
 */
function prepareAvatarData(llmResult, ttsResult) {
  const lipSync = ttsResult.lipSync || geminiService.generateLipSyncData(llmResult.text, ttsResult.duration || 0);
  const mood = llmResult.mood || 'neutral';
  
  return {
    timeline: {
      duration: ttsResult.duration || 0,
      fps: 60
    },
    expression: {
      type: mood,
      intensity: getExpressionIntensity(mood)
    },
    lipSync: {
      visemes: lipSync.visemes || lipSync,
      mouthShapes: lipSync.mouthShapes || {}
    },
    gestures: generateGestureSuggestions(llmResult.text, mood),
    eyeBlinks: generateEyeBlinkTimeline(ttsResult.duration || 0),
    bodyMovement: generateBodyMovement(mood)
  };
}

function getExpressionIntensity(mood) {
  const intensityMap = {
    'happy': 0.8,
    'excited': 1.0,
    'concerned': 0.6,
    'pouty': 0.7,
    'encouraging': 0.7,
    'thinking': 0.4,
    'surprised': 0.9,
    'sad': 0.6,
    'angry': 0.5,
    'neutral': 0.3
  };
  return intensityMap[mood] || 0.5;
}

function generateGestureSuggestions(text, mood) {
  const gestures = [];
  const lowerText = (text || '').toLowerCase();
  
  if (mood === 'excited' || mood === 'happy') {
    gestures.push({ type: 'bounce', time: 0, duration: 500 });
  }
  if (mood === 'pouty') {
    gestures.push({ type: 'puff_cheeks', time: 0, duration: 1000 });
  }
  if (mood === 'thinking') {
    gestures.push({ type: 'head_tilt', time: 0, duration: 800 });
  }
  
  if (lowerText.includes('explosion')) {
    gestures.push({ type: 'dramatic_pose', time: 0, duration: 1000 });
  }
  
  return gestures;
}

function generateEyeBlinkTimeline(durationMs) {
  const blinks = [];
  const avgBlinkInterval = 3500;
  let currentTime = 800;
  
  while (currentTime < durationMs) {
    blinks.push({
      time: currentTime,
      duration: 120
    });
    currentTime += avgBlinkInterval + (Math.random() - 0.5) * 2000;
  }
  
  return blinks;
}

function generateBodyMovement(mood) {
  const movements = {
    'happy': { sway: true, intensity: 0.3 },
    'excited': { bounce: true, sway: true, intensity: 0.6 },
    'concerned': { lean_forward: true, intensity: 0.2 },
    'pouty': { turn_away: true, intensity: 0.3 },
    'encouraging': { lean_forward: true, nod: true, intensity: 0.4 },
    'thinking': { head_tilt: true, intensity: 0.2 },
    'surprised': { jump_back: true, intensity: 0.5 },
    'neutral': { idle: true, intensity: 0.1 }
  };
  
  return movements[mood] || movements['neutral'];
}
