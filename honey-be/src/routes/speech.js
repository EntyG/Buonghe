import express from 'express';
import geminiService from '../services/geminiService.js';
import fs from 'fs';

const router = express.Router();

/**
 * POST /api/speech/tts
 * Convert text to speech using Gemini/Google Cloud TTS
 */
router.post('/tts', async (req, res, next) => {
  try {
    const { 
      text, 
      voice = 'en-US-Neural2-F',
      pitch = 2.0,
      speakingRate = 1.0
    } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log(`📝 TTS Request: "${text.substring(0, 50)}..."`);

    const result = await geminiService.textToSpeech(text, {
      voice,
      pitch,
      speakingRate
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/speech/chat
 * Main chat endpoint: User types → Megumin responds with voice
 * Pipeline: LLM Response → TTS → Avatar Data
 */
router.post('/chat', async (req, res, next) => {
  try {
    const { 
      message,
      sessionId = 'default',
      context = null
    } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`\n🎀 ═══════════════════════════════════════`);
    console.log(`🎀 Megumin Chat: "${message}"`);
    console.log(`🎀 ═══════════════════════════════════════\n`);

    // Step 1: Generate Megumin's Response (Gemini LLM)
    console.log('📍 Step 1/2: Megumin is thinking...');
    const llmResult = await geminiService.generateCharacterResponse(
      message,
      sessionId,
      { context }
    );

    console.log(`🎀 Megumin responds: "${llmResult.text}"`);
    console.log(`😊 Mood: ${llmResult.mood}`);

    // Step 2: Text-to-Speech (Gemini/Google TTS)
    console.log('📍 Step 2/2: Generating Megumin\'s voice...');
    let ttsResult;
    let useFallback = false;
    
    try {
      ttsResult = await geminiService.textToSpeech(llmResult.text, {
        voice: 'en-US-Neural2-F',
        pitch: 2.0
      });
      useFallback = ttsResult.useFallback || false;
    } catch (ttsError) {
      console.warn('⚠️ TTS failed, client will use fallback audio:', ttsError.message);
      useFallback = true;
      const estimatedDuration = geminiService.estimateDuration(llmResult.text);
      ttsResult = {
        audioUrl: null,
        duration: estimatedDuration,
        lipSync: geminiService.generateLipSyncData(llmResult.text, estimatedDuration)
      };
    }

    // Prepare Avatar Animation Data
    const avatarData = prepareAvatarData(llmResult, ttsResult);

    console.log(`\n🎀 ═══════════════════════════════════════`);
    console.log(`🎀 Pipeline Complete! Megumin is ready to speak!`);
    console.log(`🎀 ═══════════════════════════════════════\n`);

    res.json({
      success: true,
      data: {
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
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/speech/chat/text
 * Text-only chat: User types → Megumin responds with voice
 */
router.post('/chat/text', async (req, res, next) => {
  try {
    const { 
      message,
      sessionId = 'default',
      context = null
    } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`\n🎀 Text Chat: "${message}"`);

    // Generate Megumin's response using Gemini
    const llmResult = await geminiService.generateCharacterResponse(
      message,
      sessionId,
      { context }
    );

    // Generate voice using Gemini TTS
    let ttsResult;
    let useFallback = false;
    
    try {
      ttsResult = await geminiService.textToSpeech(llmResult.text, {
        voice: 'en-US-Neural2-F',
        pitch: 2.0
      });
      useFallback = ttsResult.useFallback || false;
    } catch (ttsError) {
      console.warn('⚠️ TTS failed, client will use fallback audio:', ttsError.message);
      useFallback = true;
      const estimatedDuration = geminiService.estimateDuration(llmResult.text);
      ttsResult = {
        audioUrl: null,
        duration: estimatedDuration,
        lipSync: geminiService.generateLipSyncData(llmResult.text, estimatedDuration)
      };
    }

    // Prepare avatar data
    const avatarData = prepareAvatarData(llmResult, ttsResult);

    res.json({
      success: true,
      data: {
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
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/speech/chat/smart
 * Smart chat: Classifies query, responds, and returns search query if needed
 * This is the main endpoint for the dual-backend flow
 */
router.post('/chat/smart', async (req, res, next) => {
  try {
    const { 
      message,
      sessionId = 'default'
    } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`\n🎀 ═══════════════════════════════════════`);
    console.log(`🎀 Megumin Smart Chat: "${message}"`);
    console.log(`🎀 ═══════════════════════════════════════\n`);

    // Step 1: Classify query and generate response using Gemini (includes Japanese translation)
    const llmResult = await geminiService.classifyAndRespond(
      message,
      sessionId
    );

    // Step 2: Generate voice using ElevenLabs TTS with pre-translated Japanese
    let ttsResult;
    let useFallback = false;
    
    try {
      ttsResult = await geminiService.textToSpeech(llmResult.text, {
        japaneseText: llmResult.textJapanese  // Use pre-translated Japanese from LLM response
      });
      useFallback = ttsResult.useFallback || false;
    } catch (ttsError) {
      console.warn('⚠️ TTS failed, client will use fallback:', ttsError.message);
      useFallback = true;
      const estimatedDuration = geminiService.estimateDuration(llmResult.text);
      ttsResult = {
        audioUrl: null,
        duration: estimatedDuration,
        lipSync: geminiService.generateLipSyncData(llmResult.text, estimatedDuration)
      };
    }

    // Step 3: Prepare avatar data
    const avatarData = prepareAvatarData(llmResult, ttsResult);

    res.json({
      success: true,
      data: {
        userMessage: message,
        // Query classification results
        isSearchQuery: llmResult.isSearchQuery,
        searchType: llmResult.searchType,
        searchQuery: llmResult.searchQuery,
        temporalQuery: llmResult.temporalQuery,  // Structured temporal query: { before, now, after }
        intent: llmResult.intent,
        // Megumin's response
        meguminResponse: {
          text: llmResult.text,
          mood: llmResult.mood
        },
        // Audio data
        audio: useFallback ? null : {
          url: ttsResult.audioUrl,
          duration: ttsResult.duration
        },
        avatar: avatarData,
        sessionId,
        useFallbackAudio: useFallback
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/speech/audio/:filename
 * Delete audio file after playback to save disk space
 */
router.delete('/audio/:filename', (req, res) => {
  const { filename } = req.params;
  
  // Security: Only allow deleting elevenlabs-tts files
  if (!filename.startsWith('elevenlabs-tts-') || !filename.endsWith('.mp3')) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid filename' 
    });
  }
  
  const deleted = geminiService.deleteAudioByFilename(filename);
  res.json({
    success: deleted,
    message: deleted ? `Audio file deleted: ${filename}` : 'File not found or already deleted'
  });
});

/**
 * DELETE /api/speech/history/:sessionId
 * Clear conversation history for a session
 */
router.delete('/history/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  geminiService.clearHistory(sessionId);
  res.json({
    success: true,
    message: `Conversation history cleared for session: ${sessionId}`
  });
});

/**
 * POST /api/speech/meal-reaction
 * Special endpoint: Megumin reacts to a meal
 */
router.post('/meal-reaction', async (req, res, next) => {
  try {
    const { 
      mealDescription,
      isHealthy,
      calories,
      nutrients,
      sessionId = 'default'
    } = req.body;

    if (!mealDescription) {
      return res.status(400).json({ error: 'Meal description is required' });
    }

    // Build context for Megumin
    const context = `The user is showing their meal: "${mealDescription}". 
    Health assessment: ${isHealthy ? 'This is a healthy choice!' : 'This could be healthier...'}
    ${calories ? `Calories: ~${calories}` : ''}
    ${nutrients ? `Key nutrients: ${nutrients}` : ''}`;

    // Generate Megumin's reaction
    const message = isHealthy 
      ? "Look at my meal! What do you think?"
      : "I'm about to eat this... don't judge me!";

    const llmResult = await geminiService.generateCharacterResponse(
      message,
      sessionId,
      { context }
    );

    // Generate voice
    let ttsResult;
    let useFallback = false;
    
    try {
      ttsResult = await geminiService.textToSpeech(llmResult.text, {
        voice: 'en-US-Neural2-F',
        pitch: 2.0
      });
      useFallback = ttsResult.useFallback || false;
    } catch (ttsError) {
      console.warn('⚠️ TTS failed, client will use fallback audio:', ttsError.message);
      useFallback = true;
      const estimatedDuration = geminiService.estimateDuration(llmResult.text);
      ttsResult = {
        audioUrl: null,
        duration: estimatedDuration,
        lipSync: geminiService.generateLipSyncData(llmResult.text, estimatedDuration)
      };
    }

    const avatarData = prepareAvatarData(llmResult, ttsResult);

    res.json({
      success: true,
      data: {
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
      }
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════

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

/**
 * Get expression intensity based on mood
 */
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

/**
 * Generate gesture suggestions based on text and mood
 */
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
  if (mood === 'concerned') {
    gestures.push({ type: 'worried_look', time: 0, duration: 600 });
  }
  
  if (lowerText.includes('?')) {
    gestures.push({ type: 'head_tilt', time: 200, duration: 500 });
  }
  if (lowerText.includes('!')) {
    gestures.push({ type: 'emphasis', time: 0, duration: 400 });
  }
  if (lowerText.includes('great') || lowerText.includes('amazing') || lowerText.includes('sugoi')) {
    gestures.push({ type: 'clap', time: 0, duration: 800 });
  }
  if (lowerText.includes('explosion')) {
    gestures.push({ type: 'dramatic_pose', time: 0, duration: 1000 });
  }
  
  return gestures;
}

/**
 * Generate natural eye blink timeline
 */
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

/**
 * Generate body movement based on mood
 */
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

export default router;
