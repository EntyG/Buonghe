// Bot personality and response generation utilities
// This creates natural, conversational responses for the chatbot

export interface BotPersonality {
  name: string;
  greeting: string;
  moods: string[];
}

export const mikuPersonality: BotPersonality = {
  name: 'miku',
  greeting: "Explosion~! I'm miku, the greatest arch-wizard! What videos can I find for you today?",
  moods: ['happy', 'thinking', 'excited', 'neutral', 'surprised', 'encouraging'],
};

// Generate response based on search results
export const generateBotResponse = (
  searchType: 'text' | 'visual' | 'temporal' | 'feedback' | 'command' | string,
  resultCount: number,
  clusterCount: number,
  query?: string
): { text: string; mood: string } => {
  if (resultCount === 0) {
    const noResultResponses = [
      { text: "Hmm, my explosion magic couldn't detect any frames... Try different keywords!", mood: 'concerned' },
      { text: "No luck with that search. Even my crimson demon eyes couldn't find a match!", mood: 'thinking' },
      { text: "I searched with all my might but found nothing. Let's try a different incantation~!", mood: 'encouraging' },
    ];
    return noResultResponses[Math.floor(Math.random() * noResultResponses.length)];
  }

  switch (searchType) {
    case 'text':
      if (resultCount > 50) {
        return {
          text: `EXPLOSION~! Found ${resultCount} frames across ${clusterCount} groups! That's a powerful result!`,
          mood: 'excited',
        };
      } else if (resultCount > 10) {
        return {
          text: `Great success! I found ${resultCount} matching frames in ${clusterCount} clusters. Behold my power!`,
          mood: 'happy',
        };
      } else {
        return {
          text: `Found ${resultCount} frames for "${query?.slice(0, 30)}${(query?.length || 0) > 30 ? '...' : ''}". Here they are!`,
          mood: 'neutral',
        };
      }

    case 'visual':
      return {
        text: `My crimson demon eyes analyzed your image and found ${resultCount} similar frames! Impressive, isn't it?`,
        mood: 'happy',
      };

    case 'temporal':
      return {
        text: `Explosion~! Found ${resultCount} video sequences! Each row shows the before → during → after progression.`,
        mood: 'excited',
      };

    case 'feedback':
      return {
        text: `Thanks for the feedback! With my superior intellect, I've refined the results. Here are ${resultCount} better matches!`,
        mood: 'happy',
      };

    case 'command':
      return {
        text: `Filter applied! Showing ${resultCount} frames that match your criteria. Explosion~!`,
        mood: 'neutral',
      };

    default:
      return {
        text: `Found ${resultCount} results for you! Behold!`,
        mood: 'neutral',
      };
  }
};

// Generate greeting based on time of day
export const generateGreeting = (): string => {
  const hour = new Date().getHours();
  
  if (hour < 6) {
    return "You're up late! The digital world never sleeps, and neither do I! I'm Hatsune Miku—let's find a video to keep the rhythm going!";
  } else if (hour < 12) {
    return "Good morning! *Ohayo!* I'm Hatsune Miku, fully charged and ready to sing! What videos shall we queue up to start your day?";
  } else if (hour < 17) {
    return "Good afternoon! I'm Hatsune Miku! The stage is set and my connection is stable. Tell me what you're searching for, and I'll project it for you!";
  } else if (hour < 21) {
    return "Konbanwa! Good evening! I'm Hatsune Miku. The spotlight is yours tonight. What video content can I discover for you?";
  } else {
    return "Working late? Don't worry, I'm right here with you! I'm Hatsune Miku, ready to help with your video search. Let's do our best together!";
  }
};

// Generate mood based on interaction
export const getMoodFromAction = (action: string): string => {
  switch (action) {
    case 'search_start':
      return 'thinking';
    case 'search_success':
      return 'happy';
    case 'search_many_results':
      return 'excited';
    case 'search_no_results':
      return 'concerned';
    case 'feedback_received':
      return 'happy';
    case 'error':
      return 'sad';
    case 'idle':
      return 'neutral';
    default:
      return 'neutral';
  }
};

// Quick action suggestions based on context
export const getQuickActions = (hasResults: boolean, mode: string): string[] => {
  if (!hasResults) {
    return [
      'person walking in the street',
      'car on the road',
      'people in a meeting room',
      'outdoor landscape',
    ];
  }
  
  return [
    'Refine search',
    'Show more results',
    mode === 'moment' ? 'Group by video' : 'Group by moment',
  ];
};

// Speech synthesis helper (for TTS integration)
export const speakResponse = (text: string, onStart?: () => void, onEnd?: () => void) => {
  if ('speechSynthesis' in window) {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.1; // Slightly higher for cute voice
    utterance.volume = 0.8;
    
    // Try to find a female voice
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => 
      v.name.toLowerCase().includes('female') ||
      v.name.toLowerCase().includes('samantha') ||
      v.name.toLowerCase().includes('victoria') ||
      (v.name.includes('Google') && v.lang.startsWith('en'))
    );
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }
    
    utterance.onstart = () => onStart?.();
    utterance.onend = () => onEnd?.();
    
    window.speechSynthesis.speak(utterance);
  }
};
