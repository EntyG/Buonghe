export interface ImageItem {
  id: string;
  path: string;
  name?: string;
  time_in_seconds?: number;
  score?: number;
  // Legacy fields for backward compatibility
  time?: string;
  videoId?: string;
  videoName?: string;
  frameNumber?: number;
  // Temporal search position
  temporalPosition?: 'before' | 'now' | 'after';
}

export interface VideoGroup {
  videoId: string;
  videoName: string;
  frames: ImageItem[];
}

export interface ClusterResult {
  cluster_name: string;
  url: string | null;
  image_list: ImageItem[];
}

export type ClusterMode = "timeline" | "location" | "moment" | "video";

export interface SearchResponse {
  status: string;
  state_id: string;
  results: ClusterResult[];
  mode: ClusterMode;
}

export interface RephraseResponse {
  status: string;
  variants: string[];
  message_ref: string;
}
