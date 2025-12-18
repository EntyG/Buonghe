import axios from "axios";
import {
  SearchResponse,
  ClusterMode,
  RephraseResponse,
  ClusterResult,
} from "./types";

const BASE_URL = process.env.REACT_APP_BASE_URL || "http://14.225.217.119:8082";
export const BASE_IMAGE_URL =
  process.env.REACT_APP_BASE_IMAGE_URL || "http://14.225.217.119:8081";

// Honey backend (AI chat + TTS for Live2D)
export const HONEY_BE_URL =
  process.env.REACT_APP_HONEY_BE_URL || "http://localhost:3001";

// ═══════════════════════════════════════════════════════════════════════
// MOCK MODE - Set to false when retrieval backend is working
// This only affects retrieval BE, Honey BE (miku AI) remains real
// ═══════════════════════════════════════════════════════════════════════
const USE_MOCK_RETRIEVAL = false;

// Random image services for mock data
const RANDOM_IMAGE_SERVICES = [
  (w: number, h: number, seed: number) => `https://picsum.photos/seed/${seed}/${w}/${h}`,
];

// Mock movie names for testing
const MOCK_MOVIES = [
  { id: "L01_V001", name: "The Dark Knight", year: 2008 },
  { id: "L01_V002", name: "Inception", year: 2010 },
  { id: "L02_V003", name: "Interstellar", year: 2014 },
  { id: "L03_V001", name: "The Matrix", year: 1999 },
  { id: "L04_V005", name: "Pulp Fiction", year: 1994 },
];

// Helper: Generate mock image items with random images
const generateMockImages = (count: number, clusterSeed: number = 0) => {
  const images = [];
  const movie = MOCK_MOVIES[clusterSeed % MOCK_MOVIES.length];
  
  for (let i = 0; i < count; i++) {
    const seed = clusterSeed * 100 + i + Date.now() % 1000;
    const imageUrl = RANDOM_IMAGE_SERVICES[0](320, 180, seed);
    const timeInSeconds = Math.floor(Math.random() * 7200); // 0-2 hours
    
    images.push({
      id: `mock_${seed}`,
      path: imageUrl, // Use full URL as path for mock
      score: 0.95 - i * 0.02,
      // Add mock metadata
      name: `Frame ${seed}`,
      time_in_seconds: timeInSeconds,
      // Movie info for display
      videoId: movie.id,
      videoName: `${movie.name} (${movie.year})`,
      frameNumber: Math.floor(timeInSeconds * 24), // Assume 24fps
    });
  }
  return images;
};

// Helper: Generate mock temporal search results (scenes with before/now/after)
const generateMockTemporalResults = (): SearchResponse => {
  const clusters: ClusterResult[] = [];
  const sceneCount = Math.floor(Math.random() * 3) + 3; // 3-5 scenes

  for (let i = 0; i < sceneCount; i++) {
    const movie = MOCK_MOVIES[i % MOCK_MOVIES.length];
    const baseTime = Math.floor(Math.random() * 6000) + 600; // 10min to 110min
    
    // Each scene has 3 frames: before, now, after (consecutive timestamps)
    const sceneImages = [];
    const labels = ['Before', 'Now', 'After'];
    
    for (let j = 0; j < 3; j++) {
      const seed = i * 1000 + j + Date.now() % 1000;
      const imageUrl = RANDOM_IMAGE_SERVICES[0](320, 180, seed);
      const timeInSeconds = baseTime + (j - 1) * 5; // -5s, 0s, +5s from base
      
      sceneImages.push({
        id: `temporal_${seed}`,
        path: imageUrl,
        score: 0.95 - i * 0.05,
        name: `${labels[j]}`,
        time_in_seconds: timeInSeconds,
        videoId: movie.id,
        videoName: `${movie.name} (${movie.year})`,
        frameNumber: Math.floor(timeInSeconds * 24),
        // Custom field to identify position in temporal sequence
        temporalPosition: labels[j].toLowerCase() as 'before' | 'now' | 'after',
      });
    }
    
    clusters.push({
      cluster_name: `Scene ${i + 1} - ${movie.name}`,
      url: null,
      image_list: sceneImages,
    });
  }

  return {
    results: clusters,
    state_id: `mock_temporal_${Date.now()}`,
    mode: "moment",
    status: "success",
  };
};

// Helper: Generate mock search results
const generateMockSearchResults = (query: string, mode: ClusterMode): SearchResponse => {
  const clusters: ClusterResult[] = [];

  const clusterCount = Math.floor(Math.random() * 3) + 3; // 3-5 clusters
  for (let i = 0; i < clusterCount; i++) {
    const imageCount = Math.floor(Math.random() * 6) + 4; // 4-9 images
    clusters.push({
      cluster_name: `Results ${i + 1}`,
      url: null,
      image_list: generateMockImages(imageCount, i),
    });
  }

  return {
    results: clusters,
    state_id: `mock_state_${Date.now()}`,
    mode: "moment", // Always use moment mode
    status: "success",
  };
};

// Helper: Simulate network delay
const mockDelay = (ms: number = 300) => new Promise((r) => setTimeout(r, ms));

export const searchClusters = async (
  query: string,
  mode: ClusterMode,
  collection: string = "clip_production_1024",
  state_id?: string,
  top_k: number = 32
): Promise<SearchResponse> => {
  // MOCK MODE: Return fake data for testing
  if (USE_MOCK_RETRIEVAL) {
    console.log("[MOCK] searchClusters:", { query, mode, collection });
    await mockDelay(400);
    return generateMockSearchResults(query, mode);
  }

  const payload: any = {
    text: query,
    mode,
    collection,
    top_k,
  };

  console.log(payload);
  const res = await axios.post(`${BASE_URL}/api/text`, payload);
  return res.data as SearchResponse;
};

export const getRephraseSuggestions = async (
  text: string,
  message_ref: string
): Promise<RephraseResponse> => {
  // MOCK MODE
  if (USE_MOCK_RETRIEVAL) {
    console.log("[MOCK] getRephraseSuggestions:", { text });
    await mockDelay(200);
    return {
      status: "success",
      variants: [
        `${text} in a movie scene`,
        `cinematic shot of ${text}`,
        `${text} closeup view`,
      ],
      message_ref,
    };
  }

  const res = await axios.post(`${BASE_URL}/api/rephrase`, {
    text,
    "target_lang": "en",
    message_ref,
  });
  return res.data as RephraseResponse;
};

export const postChatFilter = async (payload: any): Promise<any> => {
  // MOCK MODE
  if (USE_MOCK_RETRIEVAL) {
    console.log("[MOCK] postChatFilter:", payload);
    await mockDelay(400);
    return generateMockSearchResults("filtered", "moment");
  }

  const res = await axios.post(`${BASE_URL}/api/filter`, payload);
  return res.data;
};

// Filter search payload interface (simplified to only OCR and Genre)
export interface FilterSearchPayload {
  mode: string;
  filters: {
    ocr: string[];
    genre: string[];
  };
  text: string;  // Optional visual description
  top_k: number;
}

// Helper: Generate mock filter search results with filter info in cluster names
const generateMockFilterResults = (payload: FilterSearchPayload): SearchResponse => {
  const clusters: ClusterResult[] = [];
  const { filters, text } = payload;
  
  // Build description of applied filters (only OCR and Genre)
  const filterParts: string[] = [];
  if (filters.ocr?.length) filterParts.push(`OCR: "${filters.ocr.join(', ')}"`);
  if (filters.genre?.length) filterParts.push(`Genre: ${filters.genre.join(', ')}`);
  
  const filterDescription = filterParts.length > 0 
    ? filterParts.join(' | ') 
    : 'No filters';
  
  const clusterCount = Math.floor(Math.random() * 3) + 2; // 2-4 clusters
  for (let i = 0; i < clusterCount; i++) {
    const imageCount = Math.floor(Math.random() * 5) + 3; // 3-7 images
    const movie = MOCK_MOVIES[i % MOCK_MOVIES.length];
    
    clusters.push({
      cluster_name: `${movie.name} - ${text || 'Filtered Results'}`,
      url: null,
      image_list: generateMockImages(imageCount, i + Date.now() % 100),
    });
  }

  console.log(`[MOCK] Filter search - Text: "${text}", Filters: ${filterDescription}`);

  return {
    results: clusters,
    state_id: `mock_filter_${Date.now()}`,
    mode: "moment",
    status: "success",
  };
};

/**
 * Filter search - search with metadata filters (subtitle, OCR, object, genre)
 */
export const filterSearch = async (
  payload: FilterSearchPayload,
  collection: string = "clip_production_1024",
  state_id?: string
): Promise<SearchResponse> => {
  // MOCK MODE
  if (USE_MOCK_RETRIEVAL) {
    console.log("[MOCK] filterSearch:", payload);
    await mockDelay(500);
    return generateMockFilterResults(payload);
  }

  // Real API call
  const requestPayload = {
    ...payload,
    collection
  };

  const res = await axios.post(`${BASE_URL}/api/filter`, requestPayload);
  return res.data as SearchResponse;
};

export const visualSearch = async (
  file: File,
  mode: ClusterMode,
  collection: string = "clip_production_1024",
  state_id?: string
): Promise<SearchResponse> => {
  // MOCK MODE
  if (USE_MOCK_RETRIEVAL) {
    console.log("[MOCK] visualSearch:", { fileName: file.name, mode });
    await mockDelay(600);
    return generateMockSearchResults("visual search", mode);
  }

  const formData = new FormData();
  formData.append("file", file);

  // Only include state_id if it's provided and not empty

  const response = await axios.post<SearchResponse>(
    `${BASE_URL}/api/visual`,
    formData,
    {
      headers: {
        // Let axios set Content-Type automatically for FormData
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data;
};

export interface TemporalSearchInput {
  text: string;
}

export const temporalSearch = async (
  inputs: [TemporalSearchInput, TemporalSearchInput, TemporalSearchInput],
  collection: string = "clip_production_1024",
  state_id?: string
): Promise<SearchResponse> => {
  // MOCK MODE
  if (USE_MOCK_RETRIEVAL) {
    console.log("[MOCK] temporalSearch:", { inputs: inputs.map(i => i.text) });
    await mockDelay(700);
    return generateMockTemporalResults(); // Use temporal-specific mock
  }

  // Map inputs to before, now, after (order from UI)
  const [beforeInput, nowInput, afterInput] = inputs;

  const payload: any = {
    before: beforeInput,
    now: nowInput,
    after: afterInput,
    top_k: 32
  };

  const res = await axios.post<SearchResponse>(`${BASE_URL}/api/temporal`, payload);
  return res.data;
};

// ═══════════════════════════════════════════════════════════════════════
// Honey Backend API (AI Chat + TTS for Live2D Avatar - miku)
// ═══════════════════════════════════════════════════════════════════════

// Search types that miku can classify
export type SearchType = "TEXT" | "TEMPORAL" | "FILTER" | "IMAGE" | "NONE";

// Temporal query structure for TEMPORAL searches
export interface TemporalQuery {
  before: string | null;  // Scene description before the main event
  now: string | null;     // Main event being searched
  after: string | null;   // Scene description after the main event
}

// Filter query structure for FILTER searches (simplified to only OCR and Genre)
export interface FilterQuery {
  ocr: string[];       // Text visible on screen
  genre: string[];     // Video genres/categories
}

export interface MikuSmartChatResponse {
  success: boolean;
  data: {
    userMessage: string;
    // Query classification
    isSearchQuery: boolean;
    searchType: SearchType;  // TEXT, TEMPORAL, FILTER, IMAGE, or NONE
    searchQuery: string | null;  // Optimized query for retrieval, null if chat-only
    temporalQuery: TemporalQuery | null;  // Structured temporal query for TEMPORAL type
    filterQuery: FilterQuery | null;  // Filter metadata for FILTER type
    intent: "SEARCH" | "CHAT";
    // miku's response
    mikuResponse: {
      text: string;
      mood: string;
    };
    // Audio data
    audio: {
      url: string;
      duration: number;
    } | null;
    avatar: {
      mood: string;
      expression: string;
      lipSync: Array<{
        time: number;
        value: number;
        phoneme?: string;
      }>;
      gestures: string[];
      duration: number;
    };
    sessionId: string;
    useFallbackAudio: boolean;
  };
}

/**
 * Smart chat with miku - classifies query and returns search parameters
 * Flow: User message → miku classifies → responds + optional searchQuery + searchType
 * @param message - User's text message
 * @param sessionId - Session ID for conversation context
 */
export const smartChatWithMiku = async (
  message: string,
  sessionId: string = "default"
): Promise<MikuSmartChatResponse> => {
  const response = await axios.post(`${HONEY_BE_URL}/api/speech/chat/smart`, {
    message,
    sessionId,
  });
  return response.data as MikuSmartChatResponse;
};

/**
 * Visual search reaction response from miku
 */
export interface MikuVisualReactionResponse {
  success: boolean;
  data: {
    mikuResponse: {
      text: string;
      mood: string;
    };
    audio: {
      url: string;
      duration: number;
    } | null;
    avatar: {
      mood: string;
      expression: string;
      lipSync: Array<{
        time: number;
        value: number;
        phoneme?: string;
      }>;
      gestures: string[];
      duration: number;
    };
    sessionId: string;
    useFallbackAudio: boolean;
  };
}

/**
 * Get miku's reaction to visual search results
 * Called after visual search completes to get voice response
 * @param resultCount - Number of images found
 * @param clusterCount - Number of clusters/scenes found
 * @param sessionId - Session ID for conversation context
 */
export const getVisualSearchReaction = async (
  resultCount: number,
  clusterCount: number,
  sessionId: string = "default"
): Promise<MikuVisualReactionResponse> => {
  const response = await axios.post(`${HONEY_BE_URL}/api/speech/react/visual`, {
    resultCount,
    clusterCount,
    sessionId,
  });
  return response.data as MikuVisualReactionResponse;
};

/**
 * Smart search flow:
 * 1. Send query to miku (honey-be) for classification
 * 2. Based on searchType, call the appropriate retrieval backend endpoint
 * 3. Return both miku's response and search results (if applicable)
 */
export interface SmartSearchResult {
  mikuResponse: MikuSmartChatResponse;
  search: SearchResponse | null;  // null if it was just a chat query
  searchType: SearchType;
}

export const smartSearch = async (
  query: string,
  mode: ClusterMode,
  collection: string = "clip_production_1024",
  state_id?: string,
  top_k: number = 32,
  sessionId: string = "default"
): Promise<SmartSearchResult> => {
  // Step 1: Ask miku to classify and respond
  const mikuResponse = await smartChatWithMiku(query, sessionId);
  const { isSearchQuery, searchType, searchQuery, temporalQuery, filterQuery } = mikuResponse.data;
  
  // Step 2: If it's a search query, call the appropriate retrieval backend
  let searchResult: SearchResponse | null = null;
  
  if (isSearchQuery) {
    console.log(`🔍 miku classified: ${searchType} search`);
    
    try {
      switch (searchType) {
        case "TEXT":
          // Standard text search
          if (searchQuery) {
            searchResult = await searchClusters(searchQuery, mode, collection, state_id, top_k);
          }
          break;
          
        case "TEMPORAL":
          // Temporal search with before/now/after structure
          if (temporalQuery) {
            console.log("⏰ Temporal search with structured query:", temporalQuery);
            
            // Convert to TemporalSearchInput array [before, now, after]
            const temporalInputs: [TemporalSearchInput, TemporalSearchInput, TemporalSearchInput] = [
              { text: temporalQuery.before || "" },
              { text: temporalQuery.now || searchQuery || "" },
              { text: temporalQuery.after || "" }
            ];
            
            searchResult = await temporalSearch(temporalInputs, collection, state_id);
          } else if (searchQuery) {
            // Fallback: use searchQuery as the "now" event
            console.log("⏰ Temporal search fallback - using single query as 'now' event");
            const fallbackInputs: [TemporalSearchInput, TemporalSearchInput, TemporalSearchInput] = [
              { text: "" },
              { text: searchQuery },
              { text: "" }
            ];
            searchResult = await temporalSearch(fallbackInputs, collection, state_id);
          }
          break;
          
        case "FILTER":
          // Filter search with metadata filters (OCR and Genre only)
          if (filterQuery) {
            console.log("🔧 Filter search with:", { searchQuery, filterQuery });
            
            // Build filter payload matching backend API
            const filterPayload = {
              mode: "moment",
              filters: {
                ocr: filterQuery.ocr || [],
                genre: filterQuery.genre || [],
              },
              text: searchQuery || "",  // Visual description (optional)
              top_k,
            };
            
            searchResult = await filterSearch(filterPayload, collection, state_id);
          } else if (searchQuery) {
            // No filter data, fall back to text search
            console.log("🔧 Filter search fallback to text search");
            searchResult = await searchClusters(searchQuery, mode, collection, state_id, top_k);
          }
          break;
          
        case "IMAGE":
          // Image search will be handled separately (user uploads image)
          console.log("🖼️ Image search requested - waiting for image upload");
          searchResult = null;
          break;
          
        default:
          if (searchQuery) {
            searchResult = await searchClusters(searchQuery, mode, collection, state_id, top_k);
          }
      }
    } catch (err) {
      console.error("Search backend error:", err);
      searchResult = { results: [], state_id: state_id || "", mode, status: "error" };
    }
  } else {
    console.log(`💬 Miku identified chat-only intent, skipping search`);
  }

  return {
    mikuResponse,
    search: searchResult,
    searchType,
  };
};
