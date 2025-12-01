import { ImageItem } from "../types";

/**
 * Extracts video information from image data
 * This function handles your specific naming convention like C01_V0150, C02_V0028
 */
export const extractVideoInfo = (image: ImageItem, clusterName?: string): { videoId: string; videoName: string; frameNumber?: number } => {
  let frameNumber: number | undefined;

  // Clean image id (strip leading slashes) and split parts
  const idRaw = image.id ? image.id.replace(/^\/+/, "") : "";
  const idParts = idRaw ? idRaw.split("/") : [];

  // If last part of idParts is numeric, treat as frame number
  if (idParts.length > 0) {
    const last = idParts[idParts.length - 1];
    const numMatch = last.match(/^(\d+)$/);
    if (numMatch) {
      frameNumber = parseInt(numMatch[1], 10);
    }
  }

  // Fallback: try to parse frame from name or path
  if (!frameNumber && image.name) {
    const nameMatch = image.name.match(/(\d+)$/);
    if (nameMatch) frameNumber = parseInt(nameMatch[1], 10);
  }
  if (!frameNumber && image.path) {
    const pathParts = image.path.split("/");
    const fileName = pathParts[pathParts.length - 1];
    const fileMatch = fileName.match(/(\d+)/);
    if (fileMatch) frameNumber = parseInt(fileMatch[1], 10);
  }

  // 1) Prefer clusterName if it matches pattern like "L27_V001" or "K12_V028"
  if (clusterName) {
    const clusterMatch = clusterName.match(/^([A-Za-z0-9]+)_(V\d+)$/i);
    if (clusterMatch) {
      return {
        videoId: clusterMatch[2],
        videoName: clusterName,
        frameNumber,
      };
    }

    // If clusterName itself is like "V0150"
    const videoOnlyMatch = clusterName.match(/^(V\d+)$/i);
    if (videoOnlyMatch) {
      return {
        videoId: videoOnlyMatch[1],
        videoName: `Video ${videoOnlyMatch[1]}`,
        frameNumber,
      };
    }
  }

  // 2) Try to extract from image id parts (e.g., "L27_V001/001313")
  if (idParts.length > 0) {
    const head = idParts[0];
    const headMatch = head.match(/^([A-Za-z0-9]+)_(V\d+)$/i);
    if (headMatch) {
      return {
        videoId: headMatch[2],
        videoName: head,
        frameNumber,
      };
    }
  }

  // 3) Look for V\d+ anywhere in id or name
  if (image.id) {
    const anyVid = image.id.match(/(V\d+)/i);
    if (anyVid) {
      return {
        videoId: anyVid[1],
        videoName: `Video ${anyVid[1]}`,
        frameNumber,
      };
    }
  }

  if (image.name) {
    const anyVid = image.name.match(/(V\d+)/i);
    if (anyVid) {
      return {
        videoId: anyVid[1],
        videoName: `Video ${anyVid[1]}`,
        frameNumber,
      };
    }
  }

  // Fallback: include clusterName if available, otherwise generic unknown
  return {
    videoId: clusterName ? clusterName : "unknown_video",
    videoName: clusterName ? clusterName : "Unknown Video",
    frameNumber,
  };
};

/**
 * Enhances image items with video information
 */
export const enhanceImagesWithVideoInfo = (images: { image: ImageItem; clusterName: string }[]) => {
  return images.map(({ image, clusterName }) => {
    const videoInfo = extractVideoInfo(image, clusterName);
    return {
      image: {
        ...image,
        videoId: videoInfo.videoId,
        videoName: videoInfo.videoName,
        frameNumber: videoInfo.frameNumber
      },
      clusterName
    };
  });
};
