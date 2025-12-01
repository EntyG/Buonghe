import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../redux/store";
import {
  addMessage,
  ChatMessage,
  setSuggestions,
} from "../../redux/slices/chatSlice";
import { getRephraseSuggestions, TemporalSearchInput } from "../../api";
import {
  ChatContainer,
  MessagesList,
  SuggestionList,
} from "./ChatBox.styles";
import { Button, Box, TextField, Typography } from "@mui/material";
import { storedImageToFile } from "../../utils/imageUtils";
import { ensureFpsLoadedFor, frameToMs } from "../../utils/keyframeMap";

interface ChatBoxProps {
  onSearch: (message: ChatMessage) => void;
  onVisualSearch?: (imageFile: File) => Promise<void>;
  onTemporalSearch?: (inputs: [TemporalSearchInput, TemporalSearchInput, TemporalSearchInput]) => Promise<void>;
  onTemporalModeChange?: (isEnabled: boolean) => void;
  onFeedbackReSearch?: (positive: string[], negative: string[]) => Promise<void>;
  onCommandRun?: (msg: ChatMessage) => Promise<void>;
}
const ChatBox: React.FC<ChatBoxProps> = ({ 
  onSearch, 
  onVisualSearch, 
  onTemporalSearch, 
  onTemporalModeChange, 
  onFeedbackReSearch, 
  onCommandRun
}) => {
  const dispatch = useDispatch();
  const messages = useSelector((state: RootState) => state.chat.messages);
  const [loading, setLoading] = useState(false);

  const MAX_CHARS = 1000;

  const handleSendMessage = async (messageText: string, state_id: string) => {
    if (!messageText.trim() || messageText.length > MAX_CHARS) return;
    
    const message_ref = uuidv4();
    const newMessage: ChatMessage = {
      message_ref,
      text: messageText.trim(),
      state_id: state_id || "",
      suggestions: [],
      searchType: 'text',
      searchData: {
        query: messageText.trim(),
      },
    };
    
    dispatch(addMessage(newMessage));
    onSearch(newMessage);
    setLoading(true);
    
    try {
      const res = await getRephraseSuggestions(messageText.trim(), message_ref);
      dispatch(
        setSuggestions({ message_ref, suggestions: res.variants || [] })
      );
    } catch {
      dispatch(setSuggestions({ message_ref, suggestions: [] }));
    } finally {
      setLoading(false);
    }
  };

  // Handle re-search based on message type
  const handleReSearch = async (msg: ChatMessage) => {
    if (msg.searchType === 'text') {
      // Text search - just call onSearch with the original query
      await handleSendMessage(msg.searchData?.query || msg.text, msg.state_id);
    } else if (msg.searchType === 'command' && typeof onCommandRun === 'function') {
      // Command re-run (e.g. /filter)
      try {
        await onCommandRun(msg);
      } catch (e) {
        console.error('Command re-run failed', e);
      }
    } else if (msg.searchType === 'visual' && onVisualSearch && msg.searchData?.image) {
      // Visual search - convert stored image back to File and call onVisualSearch
      const imageFile = storedImageToFile(msg.searchData.image);
      await onVisualSearch(imageFile);
    } else if (msg.searchType === 'temporal' && onTemporalSearch && onTemporalModeChange && msg.searchData?.temporal) {
      // Temporal search - enable temporal mode, convert images, and call onTemporalSearch
      onTemporalModeChange(true);
      
      const temporalData = msg.searchData.temporal;
      const inputs: [TemporalSearchInput, TemporalSearchInput, TemporalSearchInput] = [
        {
          type: temporalData.before.type,
          content: temporalData.before.type === 'image' && temporalData.before.image
            ? storedImageToFile(temporalData.before.image)
            : temporalData.before.text || '',
        },
        {
          type: temporalData.now.type,
          content: temporalData.now.type === 'image' && temporalData.now.image
            ? storedImageToFile(temporalData.now.image)
            : temporalData.now.text || '',
        },
        {
          type: temporalData.after.type,
          content: temporalData.after.type === 'image' && temporalData.after.image
            ? storedImageToFile(temporalData.after.image)
            : temporalData.after.text || '',
        },
      ];
      
      await onTemporalSearch(inputs);
    } else if (msg.searchType === 'feedback' && onFeedbackReSearch && msg.searchData?.feedback) {
      // Feedback search - call onFeedbackReSearch with stored positive/negative arrays
      const { positive, negative } = msg.searchData.feedback;
      await onFeedbackReSearch(positive, negative);
    }
  };

  const handleSuggestionClick = async (
    suggestion: string,
    state_id: string
  ) => {
    await handleSendMessage(suggestion, state_id);
  };

  // Converter (time MM:SS <-> frame <-> ms) placed above the history in the left panel
  const [convVideoId, setConvVideoId] = useState<string>("");
  const [convFps, setConvFps] = useState<string>("25");
  const [convTime, setConvTime] = useState<string>("");
  const [convFrame, setConvFrame] = useState<string>("");
  const [convMs, setConvMs] = useState<string>("");
  const [convLastChanged, setConvLastChanged] = useState<'time' | 'frame' | 'ms' | null>(null);

  // Helper function to parse MM:SS format to seconds
  const parseTimeToSeconds = (timeStr: string): number | null => {
    if (!timeStr || !timeStr.trim()) return null;
    
    // Handle MM:SS format
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const secondsStr = parts[1].trim();
      // Allow partial input like "6:" or "6:3" but don't convert until valid
      if (secondsStr === '') return null; // User is still typing
      const seconds = parseInt(secondsStr, 10);
      if (!isNaN(minutes) && !isNaN(seconds) && minutes >= 0 && seconds >= 0 && seconds < 60) {
        return minutes * 60 + seconds;
      }
    } else if (parts.length === 1 && timeStr.includes(':')) {
      // User typed "6:" - don't convert yet
      return null;
    }
    
    // Don't treat single number as seconds - require MM:SS format
    return null;
  };

  // Helper function to format seconds to MM:SS format
  const formatSecondsToTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Keep time/frame/ms in sync depending on which field was last changed.
  // Prefer using keyframe map functions if a videoId is provided.
  useEffect(() => {
    const run = async () => {
      if (convLastChanged === 'time') {
        const seconds = parseTimeToSeconds(convTime || '');
        if (seconds === null) return;
        let fpsNum = parseFloat(convFps) || 25;
        if (convVideoId) {
          try {
            const info = await ensureFpsLoadedFor(convVideoId);
            if (info && info.fps && info.fps > 0) fpsNum = info.fps;
          } catch (e) {
            // ignore and fallback
          }
        }
        const f = Math.round(seconds * fpsNum);
        const ms = seconds * 1000;
        setConvFrame(String(f));
        setConvMs(String(Math.round(ms)));
        return;
      }

      if (convLastChanged === 'frame') {
        const f = parseInt(convFrame || '0', 10);
        if (isNaN(f)) return;
        if (convVideoId) {
          try {
            const ms = await frameToMs(convVideoId, f);
            if (ms != null) {
              const seconds = ms / 1000;
              setConvTime(formatSecondsToTime(seconds));
              setConvMs(String(Math.round(ms)));
              return;
            }
          } catch (e) {
            // ignore and fallback
          }
        }
        const fpsNum = parseFloat(convFps) || 25;
        const seconds = f / fpsNum;
        const ms = seconds * 1000;
        setConvTime(formatSecondsToTime(seconds));
        setConvMs(String(Math.round(ms)));
        return;
      }

      if (convLastChanged === 'ms') {
        const ms = parseFloat(convMs || '0');
        if (isNaN(ms) || ms < 0) return;
        const seconds = ms / 1000;
        let fpsNum = parseFloat(convFps) || 25;
        if (convVideoId) {
          try {
            const info = await ensureFpsLoadedFor(convVideoId);
            if (info && info.fps && info.fps > 0) fpsNum = info.fps;
          } catch (e) {
            // ignore and fallback
          }
        }
        const f = Math.round(seconds * fpsNum);
        setConvTime(formatSecondsToTime(seconds));
        setConvFrame(String(f));
        return;
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convTime, convFrame, convMs, convFps, convLastChanged, convVideoId]);

  // When videoId changes, try to load FPS from keyframe map. If not found, keep default '25'.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!convVideoId) {
        setConvFps('25');
        return;
      }
      try {
        const info = await ensureFpsLoadedFor(convVideoId);
        if (!cancelled) {
          if (info && info.fps && info.fps > 0) setConvFps(String(info.fps));
          else setConvFps('25');
        }
      } catch (e) {
        if (!cancelled) setConvFps('25');
      }
    };
    load();
    return () => { cancelled = true; };
  }, [convVideoId]);

  return (
    <ChatContainer>
      {/* Converter UI: placed above the history list, below any top buttons */}
      <Box sx={{ mb: 1 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              label="Video ID"
              value={convVideoId}
              onChange={(e) => setConvVideoId(e.target.value)}
              size="small"
              sx={{ minWidth: 160 }}
            />
            <TextField
              label="FPS"
              value={convFps}
              disabled
              size="small"
              sx={{ width: 120 }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              label="Frame"
              value={convFrame}
              onChange={(e) => { setConvFrame(e.target.value); setConvLastChanged('frame'); }}
              size="small"
              sx={{ width: 120 }}
            />
            <TextField
              label="MS"
              value={convMs}
              onChange={(e) => { setConvMs(e.target.value); setConvLastChanged('ms'); }}
              placeholder="394000"
              size="small"
              sx={{ width: 120 }}
            />
            <TextField
              label="Time (MM:SS)"
              value={convTime}
              onChange={(e) => { setConvTime(e.target.value); setConvLastChanged('time'); }}
              placeholder="6:34"
              size="small"
              sx={{ width: 120 }}
              helperText="Format: MM:SS"
            />
          </Box>
        </Box>
      </Box>

      {/* Divider */}
      <Box sx={{ borderTop: "1px solid", borderColor: "divider", my: 1 }} />

      <MessagesList>
        {messages.slice().reverse().map((msg) => (
          <div key={msg.message_ref} style={{ marginBottom: "16px" }}>
            <div style={{ 
              background: "var(--message-bg, #f8f9fa)", 
              padding: "12px", 
              borderRadius: "12px",
              marginBottom: "8px",
              color: "var(--message-text, #222)"
            }}>
              <div style={{ 
                fontSize: "0.85rem", 
                color: "var(--message-meta, #6c757d)", 
                marginBottom: "4px" 
              }}>
                ID: {msg.message_ref.slice(0, 8)}
              </div>
              <div style={{ wordWrap: "break-word" }}>
                {msg.searchType === 'command' ? (() => {
                  const cmd = msg.text || '/filter';
                  const filters = msg.searchData?.filters;
                  const textQuery = msg.searchData?.text;
                  if (!filters) return cmd;
                  const parts: string[] = [];
                  if (textQuery) parts.push(`text{${textQuery}}`);
                  if (filters.ocr && filters.ocr.length) parts.push(`ocr{${filters.ocr.join(', ')}}`);
                  if (filters.objects && filters.objects.length) parts.push(`objects{${filters.objects.join(', ')}}`);
                  if (filters.subtitle && filters.subtitle.length) parts.push(`subtitle{${filters.subtitle.join(', ')}}`);
                  return `${cmd} ${parts.join(' ')}`;
                })() : msg.text}
              </div>
              <Button
                size="small"
                style={{ 
                  marginTop: "8px",
                  fontSize: "0.75rem",
                  minWidth: "auto",
                  padding: "4px 8px"
                }}
                onClick={() => handleReSearch(msg)}
                title="Re-search this message"
              >
                🔄 Re-search
              </Button>
            </div>
            
            {msg.suggestions && msg.suggestions.length > 0 && (
              <div style={{ marginLeft: "12px" }}>
                <div style={{ 
                  fontSize: "0.8rem", 
                  color: "var(--message-meta, #6c757d)", 
                  marginBottom: "4px" 
                }}>
                  Suggestions:
                </div>
                <SuggestionList>
                  {msg.suggestions.map((s, i) => (
                    <li
                      key={i}
                      style={{
                        cursor: "pointer",
                        textDecoration: "underline",
                        padding: "2px 0",
                        wordWrap: "break-word"
                      }}
                      onClick={() => handleSuggestionClick(s, msg.state_id)}
                    >
                      {s}
                    </li>
                  ))}
                </SuggestionList>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ 
            color: "var(--message-warning)", 
            fontStyle: "italic",
            padding: "8px 12px"
          }}>
            Getting suggestions...
          </div>
        )}
      </MessagesList>
      
  {/* Input moved to top bar - left panel only shows history */}
    </ChatContainer>
  );
};

export default ChatBox;
