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

// External event retrieval API (used for evaluation submission)
export const EVENT_API_URL =
  process.env.REACT_APP_EVENT_API_URL || "https://eventretrieval.oj.io.vn";

export interface LoginResponse {
  id: string;
  username: string;
  role: string;
  sessionId: string;
}

export const loginToEventApi = async (
  username: string,
  password: string
): Promise<LoginResponse> => {
  const res = await axios.post(
    `${EVENT_API_URL}/api/v2/login`,
    { username, password },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data as LoginResponse;
};

export const searchClusters = async (
  query: string,
  mode: ClusterMode,
  collection: string = "clip_production_1024",
  state_id?: string,
  top_k: number = 256
): Promise<SearchResponse> => {
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

/**
 * Fetch list of evaluations for a given sessionId from the event retrieval API
 * The backend expects GET /api/v2/client/evaluation/list with param { session }
 */
export const getEvaluations = async (session: string): Promise<any> => {
  const res = await axios.get(
    `${EVENT_API_URL}/api/v2/client/evaluation/list`,
    {
      params: { session },
    }
  );
  return res.data;
};

/**
 * Submit an evaluation result to the event retrieval API
 * POST /api/v2/submit/{evaluationID}
 * The API expects a JSON body containing at least { session: "<sessionId>", answerSets: [...] }
 */
export const submitEvaluation = async (
  evaluationId: string,
  session: string,
  body: any
): Promise<any> => {
  const payload = {
    ...body,
  };
  const res = await axios.post(
    `${EVENT_API_URL}/api/v2/submit/${evaluationId}?session=${session}`,
    payload,
    {
      headers: { "Content-Type": "application/json" },
    }
  );
  return res.data;
};

/**
 * Push submission result to the event retrieval API
 * GET /submit/push
 * Push the submission result after receiving a successful response
 * @param evaluationId - The evaluation ID
 * @param session - The session ID
 * @param answer - JSON string of the submission payload
 * @param status - Submission status: "CORRECT" or "WRONG"
 */
export const pushSubmission = async (
  evaluationId: string,
  session: string,
  answer: string,
  status: "CORRECT" | "WRONG" | "PARTIALLY_CORRECT"
): Promise<any> => {
  const res = await axios.get(`${BASE_URL}/submit/push`, {
    params: {
      evaluation_id: evaluationId,
      session: session,
      answer: answer,
      status: status,
    },
  });
  return res.data;
};

export const getListClusterImages = async (cluster: ClusterResult) => {
  const urls = cluster.image_list.map((img) => {
    // Construct image URL: BASE_IMAGE_URL + path + id + .jpg
    // Từ response: path = "data/keyframes_preview", id = "/batch1/L22_V017/026000"
    return `${BASE_IMAGE_URL}/${img.path}${img.id}.webp`;
  });
  return urls;
};

export const changeClusterMode = async (
  state_id: string,
  mode: ClusterMode
): Promise<SearchResponse> => {
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
  // collection optional
  const params: any = { mode, image_id };
  if (collection) params.collection = collection;
  const res = await axios.get(`${BASE_URL}/search/related`, { params });
  return res.data;
};

export const postChatFilter = async (payload: any): Promise<any> => {
  const res = await axios.post(`${BASE_URL}/chat/filter`, payload);
  return res.data;
};

export const visualSearch = async (
  file: File,
  mode: ClusterMode,
  collection: string = "clip_production_1024",
  state_id?: string
): Promise<SearchResponse> => {
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
  console.log("Sending feedback:", payload);
  const response = await axios.post(`${BASE_URL}/search/feedback`, payload);
  return response.data as SearchResponse;
};
