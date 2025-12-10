import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';
import {
  ChatbotLayout,
  Live2DPanel,
  Live2DContainer,
  CharacterInfo,
  MoodIndicator,
  ChatPanel,
  ChatHeader,
  HeaderTitle,
  HeaderControls,
  MessagesContainer,
  InputArea,
  InputContainer,
  ChatTextarea,
  SendButtonStyled,
  InputActions,
  WelcomeScreen,
  WelcomeIcon,
  QuickActions,
  QuickActionChip,
  TypingIndicator,
} from '../../App.chatbot.styles';
import { RootState } from '../../redux/store';
import {
  addMessage,
  setSuggestions,
  setMessageStateId,
  ChatMessage,
} from '../../redux/slices/chatSlice';
import { ClusterResult, ClusterMode, ImageItem } from '../../types';
import {
  getRephraseSuggestions,
  visualSearch,
  smartSearch,
  getVisualSearchReaction,
  MikuSmartChatResponse,
  SearchType,
  HONEY_BE_URL,
} from '../../api';
import { generateBotResponse, generateGreeting } from '../../utils/botPersonality';
import { fileToStoredImage, storedImageToFile } from '../../utils/imageUtils';
import Live2DCanvas from '../Live2DModel/Live2DCanvas';
import ChatMessageComponent from '../ChatMessage/ChatMessage';

// MUI Components
import {
  Box,
  IconButton,
  CircularProgress,
  Tooltip,
  Modal,
  Fade,
  Button,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MovieIcon from '@mui/icons-material/Movie';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ImageIcon from '@mui/icons-material/Image';

interface ConversationItem {
  id: string;
  message: ChatMessage;
  results?: ClusterResult[];
  botResponse?: string;
  isLoading?: boolean;
  mikuResponse?: MikuSmartChatResponse['data'] | null;  // AI response with voice data
  wasSearchQuery?: boolean;  // Whether this triggered a search
  searchType?: SearchType;  // Type of search: TEXT, TEMPORAL, FILTER, IMAGE, NONE
}

interface ChatbotViewProps {
  dark: boolean;
  onToggleTheme: () => void;
}

// Fixed to SigLip2 model
const SEARCH_MODEL = 'siglip2_production_1152';

const ChatbotView: React.FC<ChatbotViewProps> = ({
  dark,
  onToggleTheme,
}) => {
  const dispatch = useDispatch();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const messages = useSelector((state: RootState) => state.chat.messages);
  
  // State
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode] = useState<ClusterMode>('moment'); // Fixed to moment mode
  const [latestStateId, setLatestStateId] = useState('');
  const [feedbackMap, setFeedbackMap] = useState<Map<string, 'positive' | 'negative'>>(new Map());
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [pastedImage, setPastedImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chatSessionId] = useState(() => `session_${Date.now()}`);  // Unique session for AI chat
  
  // Image zoom modal state
  const [zoomedImage, setZoomedImage] = useState<{ url: string; item: ImageItem } | null>(null);
  
  // Live2D state
  const live2dRef = useRef<any>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [currentMood, setCurrentMood] = useState('neutral');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Handle model ready
  const handleModelReady = useCallback(() => {
    setIsModelReady(true);
    setCurrentMood('neutral');
    setTimeout(() => setCurrentMood('neutral'), 2000);
  }, []);

  // Update mood with animation
  const updateMood = useCallback((newMood: string) => {
    setCurrentMood(newMood);
    if (live2dRef.current?.setMood) {
      live2dRef.current.setMood(newMood);
    }
  }, []);

  // Play audio from miku response and cleanup after playback
  const playMikuAudio = useCallback((audioUrl: string, lipSyncData?: any[]) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    // Extract filename for cleanup
    const filename = audioUrl.split('/').pop();
    
    audio.onplay = () => {
      setIsSpeaking(true);
      if (live2dRef.current?.startSpeaking) {
        live2dRef.current.startSpeaking(lipSyncData);
      }
    };
    
    audio.onended = () => {
      setIsSpeaking(false);
      if (live2dRef.current?.stopSpeaking) {
        live2dRef.current.stopSpeaking();
      }
      
      // Delete audio file after playback to save disk space
      if (filename && filename.startsWith('elevenlabs-tts-')) {
        fetch(`${HONEY_BE_URL}/api/speech/audio/${filename}`, { method: 'DELETE' })
          .catch(err => console.warn('Audio cleanup failed:', err));
      }
    };
    
    audio.onerror = () => {
      setIsSpeaking(false);
      console.warn('Audio playback error');
    };
    
    audio.play().catch(err => {
      console.warn('Audio autoplay blocked:', err);
      setIsSpeaking(false);
    });
  }, []);

  // Handle text input - smart classification by miku
  const handleSearch = async (query: string, stateId?: string) => {
    if (!query.trim()) return;

    const message_ref = uuidv4();
    const newMessage: ChatMessage = {
      message_ref,
      text: query.trim(),
      state_id: stateId || latestStateId || '',
      suggestions: [],
      searchType: 'text',
      searchData: { query: query.trim() },
    };

    dispatch(addMessage(newMessage));
    
    // Add to conversations with loading state
    const convId = uuidv4();
    setConversations(prev => [...prev, {
      id: convId,
      message: newMessage,
      isLoading: true,
    }]);
    
    setInput('');
    setLoading(true);
    updateMood('thinking');

    try {
      // Smart search: miku classifies query first, then retrieval if needed
      const { mikuResponse, search: searchResult, searchType } = await smartSearch(
        query.trim(),
        mode,
        SEARCH_MODEL,
        stateId || latestStateId || undefined,
        256,
        chatSessionId
      );

      const mikuData = mikuResponse.data;
      const wasSearch = mikuData.isSearchQuery && searchResult !== null;

      // Update conversation with results and miku's response
      setConversations(prev => prev.map(c => 
        c.id === convId 
          ? { 
              ...c, 
              results: searchResult?.results || [], 
              botResponse: mikuData.mikuResponse.text, 
              mikuResponse: mikuData,
              wasSearchQuery: wasSearch,
              searchType: searchType,
              isLoading: false 
            }
          : c
      ));

      // Update state only if there was a search
      if (searchResult) {
        setLatestStateId(searchResult.state_id);
      }
      
      updateMood(mikuData.mikuResponse.mood || 'neutral');

      // Play miku's voice if available
      if (mikuData.audio?.url && !mikuData.useFallbackAudio) {
        // Audio URL from honey-be is relative, prepend the server URL
        const fullAudioUrl = mikuData.audio.url.startsWith('http') 
          ? mikuData.audio.url 
          : `${HONEY_BE_URL}${mikuData.audio.url}`;
        playMikuAudio(fullAudioUrl, mikuData.avatar?.lipSync);
      }

      // Get suggestions only if it was a search query
      if (wasSearch && mikuData.searchQuery) {
        try {
          const sugRes = await getRephraseSuggestions(mikuData.searchQuery, message_ref);
          dispatch(setSuggestions({ message_ref, suggestions: sugRes.variants || [] }));
          
          // Update conversation with suggestions
          setConversations(prev => prev.map(c => 
            c.id === convId 
              ? { 
                  ...c, 
                  message: { ...c.message, suggestions: sugRes.variants || [] } 
                }
              : c
          ));
        } catch {
          dispatch(setSuggestions({ message_ref, suggestions: [] }));
        }
      }

    } catch (e) {
      console.error('Smart search error:', e);
      setConversations(prev => prev.map(c => 
        c.id === convId 
          ? { 
              ...c, 
              results: [], 
              botResponse: "Oops! Something went wrong. Please try again.",
              isLoading: false 
            }
          : c
      ));
      updateMood('sad');
    } finally {
      setLoading(false);
    }
  };

  // Handle visual search
  const handleVisualSearch = async (imageFile: File) => {
    const storedImage = await fileToStoredImage(imageFile);
    
    const message_ref = uuidv4();
    const newMessage: ChatMessage = {
      message_ref,
      text: '', // Empty text, will show image instead
      suggestions: [],
      state_id: latestStateId,
      searchType: 'visual',
      searchData: { image: storedImage },
    };
    
    dispatch(addMessage(newMessage));
    
    const convId = uuidv4();
    setConversations(prev => [...prev, {
      id: convId,
      message: newMessage,
      isLoading: true,
    }]);
    
    setPastedImage(null);
    setLoading(true);
    updateMood('thinking');

    try {
      // Step 1: Perform visual search
      const res = await visualSearch(imageFile, mode, SEARCH_MODEL, latestStateId);
      
      const totalImages = res.results.reduce((acc, c) => acc + c.image_list.length, 0);
      
      // Step 2: Get miku's reaction with voice
      let botText = '';
      let mood = 'happy';
      
      try {
        const reactionResponse = await getVisualSearchReaction(
          totalImages,
          res.results.length,
          chatSessionId
        );
        
        const reactionData = reactionResponse.data;
        botText = reactionData.mikuResponse.text;
        mood = reactionData.mikuResponse.mood || 'happy';
        
        // Play miku's voice if available
        if (reactionData.audio?.url && !reactionData.useFallbackAudio) {
          const fullAudioUrl = reactionData.audio.url.startsWith('http') 
            ? reactionData.audio.url 
            : `${HONEY_BE_URL}${reactionData.audio.url}`;
          // Avatar lipSync has visemes nested inside
          const lipSyncData = (reactionData.avatar as any)?.lipSync?.visemes;
          playMikuAudio(fullAudioUrl, lipSyncData);
        }
      } catch (reactionError) {
        console.warn('⚠️ Could not get Miku reaction, using fallback:', reactionError);
        // Fallback to static response if miku is unavailable
        const fallback = generateBotResponse('visual', totalImages, res.results.length);
        botText = fallback.text;
        mood = fallback.mood;
      }

      setConversations(prev => prev.map(c => 
        c.id === convId 
          ? { 
              ...c, 
              results: res.results, 
              botResponse: botText, 
              isLoading: false,
              wasSearchQuery: true,
              searchType: 'IMAGE' as const,
            }
          : c
      ));

      setLatestStateId(res.state_id);
      updateMood(mood);

      if (res.state_id) {
        dispatch(setMessageStateId({ message_ref, state_id: res.state_id }));
      }
    } catch (e) {
      console.error('Visual search error:', e);
      setConversations(prev => prev.map(c => 
        c.id === convId 
          ? { ...c, results: [], botResponse: "I couldn't analyze that image. Try another one!", isLoading: false }
          : c
      ));
      updateMood('sad');
    } finally {
      setLoading(false);
    }
  };

  // Handle submit
  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (pastedImage) {
      handleVisualSearch(pastedImage);
    } else if (input.trim()) {
      handleSearch(input.trim());
    }
  };

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Handle paste for images
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          setPastedImage(file);
          break;
        }
      }
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string, stateId: string) => {
    handleSearch(suggestion, stateId);
  };

  // Handle re-search
  const handleReSearch = async (msg: ChatMessage) => {
    if (msg.searchType === 'text') {
      await handleSearch(msg.searchData?.query || msg.text, msg.state_id);
    } else if (msg.searchType === 'visual' && msg.searchData?.image) {
      const imageFile = storedImageToFile(msg.searchData.image);
      await handleVisualSearch(imageFile);
    }
  };

  // Handle feedback
  const handleFeedbackChange = (imageId: string, type: 'positive' | 'negative' | null) => {
    setFeedbackMap(prev => {
      const newMap = new Map(prev);
      if (type === null) {
        newMap.delete(imageId);
      } else {
        newMap.set(imageId, type);
      }
      return newMap;
    });
  };

  // Handle image click - open zoom modal
  const handleImageClick = (item: ImageItem, imageUrl?: string) => {
    // For mock mode, path contains the full URL
    const url = imageUrl || (item.path.startsWith('http') ? item.path : `${item.path}${item.id}.webp`);
    setZoomedImage({ url, item });
  };

  // Close zoom modal
  const handleCloseZoom = () => {
    setZoomedImage(null);
  };

  // Quick action suggestions
  const quickActions = conversations.length === 0 ? [
    'a woman stretch the bow then fire an arrow but then it missed', //temporal
    'a man holding 2 pills one red, one blue', //text
    'describe yourself', //normal chat
    'a man wearing a hat which have the text "New York" on it' //filter
  ] : [];

  return (
    <ChatbotLayout>
      {/* Live2D Panel (Left) */}
      <Live2DPanel>
        <MoodIndicator $mood={currentMood}>
          {currentMood.charAt(0).toUpperCase() + currentMood.slice(1)}
          {isSpeaking && ' 🗣️'}
        </MoodIndicator>
        
        <Live2DContainer>
          {!isModelReady && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                bgcolor: 'rgba(0,0,0,0.5)',
              }}
            >
              <CircularProgress size={48} />
              <Box sx={{ mt: 2, color: 'text.secondary' }}>Loading Miku...</Box>
            </Box>
          )}
          <Live2DCanvas
            ref={live2dRef}
            mood={currentMood}
            isSpeaking={isSpeaking}
            onReady={handleModelReady}
          />
        </Live2DContainer>
        
        <CharacterInfo>
          <h3>Hatsune Miku</h3>
          <p>Your Movie Retrieval Assistant</p>
        </CharacterInfo>
      </Live2DPanel>

      {/* Main Chat Panel */}
      <ChatPanel>
        {/* Header */}
        <ChatHeader>
          <HeaderTitle>
            <h1>Movie Search Chat</h1>
          </HeaderTitle>
          
          <HeaderControls>
            <Tooltip title={dark ? 'Light Mode' : 'Dark Mode'}>
              <IconButton onClick={onToggleTheme} size="small">
                {dark ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
          </HeaderControls>
        </ChatHeader>

        {/* Messages Area */}
        <MessagesContainer>
          {conversations.length === 0 ? (
            <WelcomeScreen>
              <WelcomeIcon>🎬</WelcomeIcon>
              <h2>Welcome!</h2>
              <p>{generateGreeting()}</p>
              
              {quickActions.length > 0 && (
                <>
                  <Box sx={{ fontSize: '0.9rem', color: 'text.secondary', mb: 2 }}>
                    Try one of these searches:
                  </Box>
                  <QuickActions>
                    {quickActions.map((action, idx) => (
                      <QuickActionChip
                        key={idx}
                        onClick={() => handleSearch(action)}
                      >
                        {action}
                      </QuickActionChip>
                    ))}
                  </QuickActions>
                </>
              )}
            </WelcomeScreen>
          ) : (
            <>
              {conversations.map((conv) => (
                <ChatMessageComponent
                  key={conv.id}
                  message={conv.message}
                  results={conv.results}
                  mode={mode}
                  isLoading={conv.isLoading}
                  botResponse={conv.botResponse}
                  wasSearchQuery={conv.wasSearchQuery}
                  apiSearchType={conv.searchType}
                  onReSearch={handleReSearch}
                  onSuggestionClick={handleSuggestionClick}
                  onImageClick={handleImageClick}
                  onFeedback={handleFeedbackChange}
                  feedbackMap={feedbackMap}
                />
              ))}
              
              {loading && (
                <TypingIndicator>
                  <span></span>
                  <span></span>
                  <span></span>
                </TypingIndicator>
              )}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </MessagesContainer>

        {/* Input Area */}
        <InputArea>
          {/* Pasted image preview */}
          {pastedImage && (
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                component="img"
                src={URL.createObjectURL(pastedImage)}
                alt="Pasted"
                sx={{
                  width: 80,
                  height: 60,
                  objectFit: 'cover',
                  borderRadius: 1,
                  border: '2px solid',
                  borderColor: 'primary.main',
                }}
              />
              <Box sx={{ flex: 1, fontSize: '0.9rem', color: 'text.secondary' }}>
                Image ready for visual search
              </Box>
              <IconButton size="small" onClick={() => setPastedImage(null)}>
                ✕
              </IconButton>
            </Box>
          )}
          
          <InputContainer onSubmit={handleSubmit}>
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && file.type.startsWith('image/')) {
                  setPastedImage(file);
                  setInput('');
                }
                e.target.value = ''; // Reset to allow same file selection
              }}
            />
            
            {/* Image upload button */}
            <Tooltip title="Upload image for visual search">
              <IconButton
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || !!pastedImage}
                sx={{
                  color: 'text.secondary',
                  mr: 0.5,
                  '&:hover': { color: 'primary.main' },
                }}
              >
                <ImageIcon />
              </IconButton>
            </Tooltip>
            
            <ChatTextarea
              ref={textareaRef}
              value={pastedImage ? '' : input}
              onChange={(e) => !pastedImage && setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={pastedImage ? "Press Enter to search with image..." : "Describe what you're looking for..."}
              rows={1}
              disabled={loading || !!pastedImage}
              style={pastedImage ? { cursor: 'not-allowed', opacity: 0.6 } : undefined}
            />
            
            <SendButtonStyled
              type="submit"
              $disabled={loading || (!input.trim() && !pastedImage)}
              disabled={loading || (!input.trim() && !pastedImage)}
            >
              {loading ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <SendIcon />
              )}
            </SendButtonStyled>
          </InputContainer>
          
          <InputActions>
            <Box sx={{ fontSize: '0.75rem', color: 'text.secondary', opacity: 0.7 }}>
              Paste image (Ctrl+V) for visual search • Describe scenes naturally
            </Box>
            {feedbackMap.size > 0 && (
              <Box sx={{ ml: 'auto', fontSize: '0.8rem', color: 'text.secondary' }}>
                {feedbackMap.size} feedback selections
              </Box>
            )}
          </InputActions>
        </InputArea>
      </ChatPanel>

      {/* Image Zoom Modal */}
      <Modal
        open={!!zoomedImage}
        onClose={handleCloseZoom}
        closeAfterTransition
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Fade in={!!zoomedImage}>
          <Box
            sx={{
              position: 'relative',
              width: '95vw',
              maxWidth: '1400px',
              maxHeight: '95vh',
              outline: 'none',
              bgcolor: 'background.paper',
              borderRadius: 2,
              boxShadow: 24,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {zoomedImage && (
              <>
                {/* Image container with close button */}
                <Box sx={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#000' }}>
                  {/* Close button - overlapping the image */}
                  <IconButton
                    onClick={handleCloseZoom}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      bgcolor: 'rgba(0,0,0,0.6)',
                      color: 'white',
                      zIndex: 10,
                      width: 32,
                      height: 32,
                      backdropFilter: 'blur(4px)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      '&:hover': { 
                        bgcolor: 'rgba(0,0,0,0.8)',
                        transform: 'scale(1.1)',
                      },
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 18 }} />
                  </IconButton>

                  {/* Image */}
                  <Box
                    component="img"
                    src={zoomedImage.url}
                    alt={zoomedImage.item.name || 'Zoomed image'}
                    sx={{
                      width: '100%',
                      height: 'calc(95vh - 100px)',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                </Box>

                {/* Movie Info Bar */}
                <Box
                  sx={{
                    p: 2,
                    bgcolor: 'rgba(0,0,0,0.8)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                  }}
                >
                  {/* Left: Movie info */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <MovieIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                      <Typography variant="subtitle1" fontWeight={600}>
                        {zoomedImage.item.videoName || 'Unknown Movie'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, color: 'grey.400' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <AccessTimeIcon sx={{ fontSize: 16 }} />
                        <Typography variant="body2">
                          {zoomedImage.item.time_in_seconds !== undefined
                            ? `${Math.floor(zoomedImage.item.time_in_seconds / 3600)}:${String(Math.floor((zoomedImage.item.time_in_seconds % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(zoomedImage.item.time_in_seconds % 60)).padStart(2, '0')}`
                            : 'N/A'}
                        </Typography>
                      </Box>
                      {zoomedImage.item.frameNumber && (
                        <Typography variant="body2">
                          Frame #{zoomedImage.item.frameNumber}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Right: Open Movie button */}
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<PlayArrowIcon />}
                    onClick={() => {
                      // TODO: Replace with actual movie URL when backend is ready
                      const movieUrl = `https://example.com/watch/${zoomedImage.item.videoId || 'movie'}?t=${zoomedImage.item.time_in_seconds || 0}`;
                      window.open(movieUrl, '_blank');
                    }}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                    }}
                  >
                    Open Movie
                  </Button>
                </Box>
              </>
            )}
          </Box>
        </Fade>
      </Modal>
    </ChatbotLayout>
  );
};

export default ChatbotView;
