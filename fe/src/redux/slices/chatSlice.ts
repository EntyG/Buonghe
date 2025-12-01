import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Define search types
export type SearchType = 'text' | 'visual' | 'temporal' | 'feedback' | 'command';

// Store image as base64 data URL for persistence
export interface StoredImage {
  dataUrl: string; // base64 data URL
  fileName: string;
  fileType: string;
}

export interface TemporalSearchData {
  before: { type: 'text' | 'image'; text?: string; image?: StoredImage };
  now: { type: 'text' | 'image'; text?: string; image?: StoredImage };
  after: { type: 'text' | 'image'; text?: string; image?: StoredImage };
}

export interface FeedbackSearchData {
  positive: string[];
  negative: string[];
}

export interface ChatMessage {
  message_ref: string;
  text: string; // Display text for UI
  suggestions: string[];
  state_id: string;
  
  // Search metadata for re-search functionality
  searchType: SearchType;
  searchData?: {
    // For text search
    query?: string;
    // For visual search
    image?: StoredImage;
    // For temporal search
    temporal?: TemporalSearchData;
    // For feedback search
    feedback?: FeedbackSearchData;
    // For command searches (e.g. /filter)
    text?: string; // Text query for filter commands
    filters?: {
      ocr: string[];
      subtitle: string[];
      objects: string[];
    };
    isFilterAll?: boolean;
  };
}

export interface ChatState {
  messages: ChatMessage[];
}

const initialState: ChatState = {
  messages: [],
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    addMessage: (
      state,
      action: PayloadAction<ChatMessage>
    ) => {
      state.messages.push({ ...action.payload, suggestions: action.payload.suggestions || [] });
    },
    setSuggestions: (
      state,
      action: PayloadAction<{ message_ref: string; suggestions: string[] }>
    ) => {
      const msg = state.messages.find(
        (m) => m.message_ref === action.payload.message_ref
      );
      if (msg) {
        msg.suggestions = action.payload.suggestions;
      }
    },
    clearMessages: (state) => {
      state.messages = [];
    },
    setMessageStateId: (
      state,
      action: PayloadAction<{ message_ref: string; state_id: string }>
    ) => {
      const msg = state.messages.find(
        (m) => m.message_ref === action.payload.message_ref
      );
      if (msg) {
        msg.state_id = action.payload.state_id;
      }
    },
  },
});

export const { addMessage, setSuggestions, clearMessages, setMessageStateId } =
  chatSlice.actions;
export default chatSlice.reducer;
