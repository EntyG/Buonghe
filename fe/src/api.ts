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
// This only affects retrieval BE, Honey BE (Megumin AI) remains real
// ═══════════════════════════════════════════════════════════════════════
const USE_MOCK_RETRIEVAL = true;

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
  top_k: number = 256
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
  const res = await axios.post(`${BASE_URL}/search/text`, payload);
  return res.data as SearchResponse;
};

export const getListClusterImages = async (cluster: ClusterResult) => {
  const urls = cluster.image_list.map((img) => {
    // MOCK MODE: path contains full URL
    if (USE_MOCK_RETRIEVAL || img.path.startsWith("http")) {
      return img.path;
    }
    // Real mode: Construct image URL: BASE_IMAGE_URL + path + id + .jpg
    return `${BASE_IMAGE_URL}/${img.path}${img.id}.webp`;
  });
  return urls;
};

export const changeClusterMode = async (
  state_id: string,
  mode: ClusterMode
): Promise<SearchResponse> => {
  // MOCK MODE
  if (USE_MOCK_RETRIEVAL) {
    console.log("[MOCK] changeClusterMode:", { state_id, mode });
    await mockDelay(200);
    return generateMockSearchResults("mode change", mode);
  }

  const res = await axios.post(`${BASE_URL}/settings/change-cluster`, {
    state_id,
    mode,
  });
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

  const res = await axios.post(`${BASE_URL}/chat/rephrase/suggestion`, {
    text,
    message_ref,
  });
  return res.data as RephraseResponse;
};

export const getRelatedImages = async (
  mode: string,
  image_id: string,
  collection?: string
): Promise<any> => {
  // MOCK MODE
  if (USE_MOCK_RETRIEVAL) {
    console.log("[MOCK] getRelatedImages:", { mode, image_id });
    await mockDelay(300);
    return { results: generateMockImages(8, Math.floor(Math.random() * 1000)) };
  }

  // collection optional
  const params: any = { mode, image_id };
  if (collection) params.collection = collection;
  const res = await axios.get(`${BASE_URL}/search/related`, { params });
  return res.data;
};

export const postChatFilter = async (payload: any): Promise<any> => {
  // MOCK MODE
  if (USE_MOCK_RETRIEVAL) {
    console.log("[MOCK] postChatFilter:", payload);
    await mockDelay(400);
    return generateMockSearchResults("filtered", "moment");
  }

  const res = await axios.post(`${BASE_URL}/chat/filter`, payload);
  return res.data;
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
  formData.append("files", file);
  formData.append("mode", mode);
  formData.append("collection", collection);

  // Only include state_id if it's provided and not empty
  if (state_id && state_id.trim()) {
    formData.append("state_id", state_id);
  }

  const response = await axios.post<SearchResponse>(
    `${BASE_URL}/search/visual`,
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
  type: "text" | "image";
  content: string | File;
}

export const temporalSearch = async (
  inputs: [TemporalSearchInput, TemporalSearchInput, TemporalSearchInput],
  collection: string = "clip_production_1024",
  state_id?: string
): Promise<SearchResponse> => {
  // MOCK MODE
  if (USE_MOCK_RETRIEVAL) {
    console.log("[MOCK] temporalSearch:", { inputs: inputs.map(i => i.content) });
    await mockDelay(700);
    return generateMockTemporalResults(); // Use temporal-specific mock
  }

  const formData = new FormData();

  // Map inputs to before, now, after (order from UI)
  const [beforeInput, nowInput, afterInput] = inputs;

  // Simple schema matching backend expectations
  const reqData: any = {
    collection,
  };

  // Add text descriptions for each position
  if (
    beforeInput.type === "text" &&
    typeof beforeInput.content === "string" &&
    beforeInput.content.trim()
  ) {
    reqData.before = { text: beforeInput.content };
  }
  if (
    nowInput.type === "text" &&
    typeof nowInput.content === "string" &&
    nowInput.content.trim()
  ) {
    reqData.now = { text: nowInput.content };
  }
  if (
    afterInput.type === "text" &&
    typeof afterInput.content === "string" &&
    afterInput.content.trim()
  ) {
    reqData.after = { text: afterInput.content };
  }

  // Add state_id if provided
  if (state_id && state_id.trim()) {
    reqData.state_id = state_id;
  }

  // Append req as JSON string
  formData.append("req", JSON.stringify(reqData));

  // Append images with specific names
  if (beforeInput.type === "image" && beforeInput.content instanceof File) {
    formData.append("before_image", beforeInput.content);
  }
  if (nowInput.type === "image" && nowInput.content instanceof File) {
    formData.append("now_image", nowInput.content);
  }
  if (afterInput.type === "image" && afterInput.content instanceof File) {
    formData.append("after_image", afterInput.content);
  }

  const response = await axios.post<SearchResponse>(
    `${BASE_URL}/search/visual/temporal`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data;
};

/**
 * Send relevance feedback to improve search results
 * @param payload - Feedback payload containing state_id, mode, collection, positive and negative image IDs
 * @returns Updated search results with refined ranking
 */
export const sendFeedback = async (payload: {
  state_id: string;
  mode: ClusterMode;
  collection: string;
  positive: string[];
  negative: string[];
}): Promise<SearchResponse> => {
  // MOCK MODE
  if (USE_MOCK_RETRIEVAL) {
    console.log("[MOCK] sendFeedback:", payload);
    await mockDelay(400);
    return generateMockSearchResults("feedback refined", payload.mode);
  }

  console.log("Sending feedback:", payload);
  const response = await axios.post(`${BASE_URL}/search/feedback`, payload);
  return response.data as SearchResponse;
};

// ═══════════════════════════════════════════════════════════════════════
// Honey Backend API (AI Chat + TTS for Live2D Avatar - Megumin)
// ═══════════════════════════════════════════════════════════════════════

// Search types that Megumin can classify
export type SearchType = "TEXT" | "TEMPORAL" | "FILTER" | "IMAGE" | "NONE";

// Temporal query structure for TEMPORAL searches
export interface TemporalQuery {
  before: string | null;  // Scene description before the main event
  now: string | null;     // Main event being searched
  after: string | null;   // Scene description after the main event
}

export interface MeguminSmartChatResponse {
  success: boolean;
  data: {
    userMessage: string;
    // Query classification
    isSearchQuery: boolean;
    searchType: SearchType;  // TEXT, TEMPORAL, FILTER, IMAGE, or NONE
    searchQuery: string | null;  // Optimized query for retrieval, null if chat-only
    temporalQuery: TemporalQuery | null;  // Structured temporal query for TEMPORAL type
    intent: "SEARCH" | "CHAT";
    // Megumin's response
    meguminResponse: {
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
 * Smart chat with Megumin - classifies query and returns search parameters
 * Flow: User message → Megumin classifies → responds + optional searchQuery + searchType
 * @param message - User's text message
 * @param sessionId - Session ID for conversation context
 */
export const smartChatWithMegumin = async (
  message: string,
  sessionId: string = "default"
): Promise<MeguminSmartChatResponse> => {
  const response = await axios.post(`${HONEY_BE_URL}/api/speech/chat/smart`, {
    message,
    sessionId,
  });
  return response.data as MeguminSmartChatResponse;
};

/**
 * Smart search flow:
 * 1. Send query to Megumin (honey-be) for classification
 * 2. Based on searchType, call the appropriate retrieval backend endpoint
 * 3. Return both Megumin's response and search results (if applicable)
 */
export interface SmartSearchResult {
  meguminResponse: MeguminSmartChatResponse;
  search: SearchResponse | null;  // null if it was just a chat query
  searchType: SearchType;
}

export const smartSearch = async (
  query: string,
  mode: ClusterMode,
  collection: string = "clip_production_1024",
  state_id?: string,
  top_k: number = 256,
  sessionId: string = "default"
): Promise<SmartSearchResult> => {
  // Step 1: Ask Megumin to classify and respond
  const meguminResponse = await smartChatWithMegumin(query, sessionId);
  const { isSearchQuery, searchType, searchQuery, temporalQuery } = meguminResponse.data;
  
  // Step 2: If it's a search query, call the appropriate retrieval backend
  let searchResult: SearchResponse | null = null;
  
  if (isSearchQuery && searchQuery) {
    console.log(`🔍 Megumin classified: ${searchType} search, query: "${searchQuery}"`);
    
    try {
      switch (searchType) {
        case "TEXT":
          // Standard text search
          searchResult = await searchClusters(searchQuery, mode, collection, state_id, top_k);
          break;
          
        case "TEMPORAL":
          // Temporal search with before/now/after structure
          if (temporalQuery) {
            console.log("⏰ Temporal search with structured query:", temporalQuery);
            
            // Convert to TemporalSearchInput array [before, now, after]
            const temporalInputs: [TemporalSearchInput, TemporalSearchInput, TemporalSearchInput] = [
              { type: "text", content: temporalQuery.before || "" },
              { type: "text", content: temporalQuery.now || searchQuery },  // Fallback to searchQuery if now is null
              { type: "text", content: temporalQuery.after || "" }
            ];
            
            searchResult = await temporalSearch(temporalInputs, collection, state_id);
          } else {
            // Fallback: use searchQuery as the "now" event
            console.log("⏰ Temporal search fallback - using single query as 'now' event");
            const fallbackInputs: [TemporalSearchInput, TemporalSearchInput, TemporalSearchInput] = [
              { type: "text", content: "" },
              { type: "text", content: searchQuery },
              { type: "text", content: "" }
            ];
            searchResult = await temporalSearch(fallbackInputs, collection, state_id);
          }
          break;
          
        case "FILTER":
          // TODO: Call filter endpoint when available
          // Filter requires existing state_id
          console.log("🔧 Filter requested - using text search as fallback");
          searchResult = await searchClusters(searchQuery, mode, collection, state_id, top_k);
          break;
          
        case "IMAGE":
          // Image search will be handled separately (user uploads image)
          console.log("🖼️ Image search requested - waiting for image upload");
          searchResult = null;
          break;
          
        default:
          searchResult = await searchClusters(searchQuery, mode, collection, state_id, top_k);
      }
    } catch (err) {
      console.error("Search backend error:", err);
      searchResult = { results: [], state_id: state_id || "", mode, status: "error" };
    }
  } else {
    console.log(`💬 Megumin identified chat-only intent, skipping search`);
  }

  return {
    meguminResponse,
    search: searchResult,
    searchType,
  };
};
