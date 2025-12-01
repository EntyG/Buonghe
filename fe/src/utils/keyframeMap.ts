// src/utils/frameTimeCalculator.ts

// The data structure we will cache. The key will now be the videoName itself.
type FrameInfo = {
  fps: number | null;
};
const cache: Record<string, FrameInfo> = {};

// Webpack's require.context still dynamically finds and bundles the assets.
const req: any = (require as any).context('../map-keyframes', false, /\.csv$/);

/**
 * Parses only the first data line of a CSV to get the FPS.
 * This helper function remains the same.
 */
const parseFpsFromCsv = (text: string): FrameInfo => {
  const lines = text.split(/\r?\n/);
  const firstDataLine = lines[1] ? lines[1].trim() : null;

  if (!firstDataLine) {
    return { fps: null };
  }
  const cols = firstDataLine.split(',');
  if (cols.length < 3) {
    return { fps: null };
  }
  const fps = parseFloat(cols[2]);
  return { fps: !isNaN(fps) ? fps : null };
};

/**
 * SIMPLIFIED: Ensures the FPS info for a given video is loaded and cached.
 * It uses the videoName directly as the cache key and for the file lookup.
 */
export const ensureFpsLoadedFor = async (videoNameOrId: string): Promise<FrameInfo | null> => {
  // 1. Check cache using the videoName directly. This is much faster.
  if (cache[videoNameOrId]) {
    return cache[videoNameOrId];
  }

  try {
    // 2. Attempt to require the file directly. Webpack will throw an error if not found.
    const url: string = req(`./${videoNameOrId}.csv`);
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Network response was not ok for ${videoNameOrId}.csv`);
    }
    const text = await res.text();

    // 3. Parse the file and store the result in the cache.
    const parsed = parseFpsFromCsv(text);
    cache[videoNameOrId] = parsed;
    return parsed;
  } catch (err) {
    // This block runs if the file doesn't exist or if there's a network error.
    console.error(`Could not find or load keyframe map for '${videoNameOrId}'. File may be missing or named incorrectly.`);
    
    // 4. Cache the failure to prevent repeated failed attempts for the same name.
    cache[videoNameOrId] = { fps: null };
    return { fps: null };
  }
};

/**
 * Calculates milliseconds from frame index. No changes here, but it now
 * benefits from the faster ensureFpsLoadedFor function.
 */
export const frameToMs = async (videoNameOrId: string, frameIdx: number): Promise<number | null> => {
  const frameInfo = await ensureFpsLoadedFor(videoNameOrId);
  
  if (!frameInfo || !frameInfo.fps || frameInfo.fps <= 0) {
    return null;
  }
  
  return Math.round((frameIdx / frameInfo.fps) * 1000);
};


/**
 * Bulk version of frameToMs. Also benefits from the optimization.
 */
export const framesListToMsList = async (videoNameOrId: string, frameIdxs: number[]): Promise<(number | null)[]> => {
  const frameInfo = await ensureFpsLoadedFor(videoNameOrId);

  if (!frameInfo || !frameInfo.fps || frameInfo.fps <= 0) {
    return frameIdxs.map(() => null);
  }

  return frameIdxs.map(idx => Math.round((idx / frameInfo.fps!) * 1000));
};

export default {
  ensureFpsLoadedFor,
  frameToMs,
  framesListToMsList,
};