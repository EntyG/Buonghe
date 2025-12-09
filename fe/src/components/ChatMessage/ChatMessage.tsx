import React from 'react';
import { ChatMessage as ChatMessageType } from '../../redux/slices/chatSlice';
import { ClusterResult, ImageItem } from '../../types';
import {
  UserMessage,
  BotMessage,
  BotMessageContent,
  MessageMeta,
  QuickActions,
  QuickActionChip,
} from '../../App.chatbot.styles';
import { Box, IconButton, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ChatResultsGrid from './ChatResultsGrid';

interface ChatMessageProps {
  message: ChatMessageType;
  results?: ClusterResult[];
  mode?: string;
  isLoading?: boolean;
  botResponse?: string;
  wasSearchQuery?: boolean;
  apiSearchType?: string; // API search type (TEXT, TEMPORAL, etc.)
  onReSearch?: (msg: ChatMessageType) => void;
  onSuggestionClick?: (suggestion: string, stateId: string) => void;
  onImageClick?: (item: ImageItem) => void;
  onFeedback?: (imageId: string, type: 'positive' | 'negative' | null) => void;
  feedbackMap?: Map<string, 'positive' | 'negative'>;
}

// Get search type display name
const getSearchTypeLabel = (searchType?: string) => {
  switch (searchType) {
    case 'text': return '🔍 Text Search';
    case 'visual': return '🖼️ Visual Search';
    case 'temporal': return '⏱️ Temporal Search';
    case 'feedback': return '👍 Feedback Search';
    case 'command': return '⚡ Command';
    default: return '🔍 Search';
  }
};

const ChatMessageComponent: React.FC<ChatMessageProps> = ({
  message,
  results,
  mode = 'moment',
  isLoading = false,
  botResponse,
  wasSearchQuery = true,
  apiSearchType,
  onReSearch,
  onSuggestionClick,
  onImageClick,
  onFeedback,
  feedbackMap,
}) => {
  // Format the message text for display
  const getDisplayText = () => {
    if (message.searchType === 'command') {
      const filters = message.searchData?.filters;
      const textQuery = message.searchData?.text;
      if (!filters) return message.text;
      
      const parts: string[] = [];
      if (textQuery) parts.push(`Text: "${textQuery}"`);
      if (filters.ocr?.length) parts.push(`OCR: ${filters.ocr.join(', ')}`);
      if (filters.genre?.length) parts.push(`Genre: ${filters.genre.join(', ')}`);
      
      return parts.join(' | ') || message.text;
    }
    return message.text;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* User Message */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <UserMessage>
          {/* Show image for visual search */}
          {message.searchType === 'visual' && message.searchData?.image ? (
            <Box
              component="img"
              src={message.searchData.image.dataUrl}
              alt="Visual search"
              sx={{
                maxWidth: 200,
                maxHeight: 150,
                borderRadius: 1,
                objectFit: 'contain',
              }}
            />
          ) : (
            getDisplayText()
          )}
        </UserMessage>
        {/* Only show meta info for search queries */}
        {wasSearchQuery && (
          <MessageMeta>
            <span>{getSearchTypeLabel(message.searchType)}</span>
            {message.state_id && (
              <Tooltip title="Re-search">
                <IconButton 
                  size="small" 
                  onClick={() => onReSearch?.(message)}
                  sx={{ 
                    p: 0.5,
                    color: 'inherit',
                    '&:hover': { color: 'primary.main' }
                  }}
                >
                  <RefreshIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            )}
          </MessageMeta>
        )}
      </Box>

      {/* Bot Response - only show when not loading */}
      {!isLoading && (
        <BotMessage>
          <BotMessageContent>
            <>
              {/* Bot text response */}
              {botResponse && <p>{botResponse}</p>}
              
              {/* Results count summary */}
              {results && results.length > 0 && (
                <p style={{ marginBottom: 8 }}>
                  Found {results.reduce((acc, c) => acc + c.image_list.length, 0)} matching frames
                </p>
              )}
              
              {/* Results grid */}
              {results && results.length > 0 && (
                <ChatResultsGrid
                  results={results}
                  mode={mode}
                  compact={true}
                  maxImages={12}
                  searchType={apiSearchType || message.searchType}
                  onImageClick={onImageClick}
                  onFeedback={onFeedback}
                  feedbackMap={feedbackMap}
                />
              )}
              
              {/* No results message - only show for actual searches */}
              {wasSearchQuery && results && results.length === 0 && (
                <p style={{ color: '#f87171' }}>
                  No matching frames found. Try a different search query.
                </p>
              )}
            </>
          </BotMessageContent>

        {/* Suggestions as quick actions */}
        {message.suggestions && message.suggestions.length > 0 && (
          <Box sx={{ mt: 1.5, ml: 0 }}>
            <Box sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1 }}>
              Try these alternatives:
            </Box>
            <QuickActions>
              {message.suggestions.map((suggestion, idx) => (
                <QuickActionChip
                  key={idx}
                  onClick={() => onSuggestionClick?.(suggestion, message.state_id)}
                >
                  {suggestion}
                </QuickActionChip>
              ))}
            </QuickActions>
          </Box>
        )}
        </BotMessage>
      )}
    </Box>
  );
};

export default ChatMessageComponent;
