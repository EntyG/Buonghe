# DEVELOPER.md: Buonghe Technical Documentation (Miku Edition)

## 1. Project Overview

- Objective: Frontend for a visual and temporal search system with Hatsune Miku as your AI assistant. It provides a conversational text-based search experience over frames/clusters of videos, lets users switch between clustering modes (moment vs. video), choose the retrieval model (CLIP vs. SigLip2), preview frames, and jump to the source video/time.
- Core Features (Current):
  - Text search with chat-like history and re-search capability
  - Visual search with image paste support
  - Temporal search with before/now/after inputs
  - **Relevance feedback** with like/dislike buttons to refine search results
  - Model switching (CLIP, SigLip2)
  - Mode switching (Moment clustering vs. Video grouping) and server-side mode change
  - Light/Dark theme toggle
  - Image/frame preview modal with quick open to video at timestamp
  - Nearby/related frames retrieval (timeline) for a selected frame
  - Rephrase suggestions for user prompts
  - **Miku Live2D Avatar**: Animated Miku character with lip-sync and expressions

## 2. Tech Stack & Libraries

- Framework: React.js (Create React App structure)
- Language: TypeScript
- State Management: Redux Toolkit (@reduxjs/toolkit) with react-redux Provider for a single `chat` slice; additional UI state is kept locally in `App.tsx` via React hooks
- UI Components: Material UI v7 (@mui/material, @mui/icons-material) for widgets and layout primitives
- Styling: styled-components v6 for custom styled wrappers; MUI theming for palette/typography; emotion is included as a peer dependency for MUI
- API Client: Axios for HTTP requests to the backend
- Testing: Jest + React Testing Library (@testing-library/react, @testing-library/jest-dom)

## 3. Project Structure

High-level tree (src):

- src/
  - api.ts — API functions interacting with the backend
  - App.tsx — App composition, top-level state orchestration
  - App.styles.ts — styled-components for the main layout (left/right panels, top bar)
  - App.css, index.css — global styles (CRA defaults and minor tweaks)
  - index.tsx — React root, wraps `<App />` with Redux Provider
  - reportWebVitals.ts — CRA perf hook (optional)
  - setupTests.ts, react-app-env.d.ts — CRA test/env scaffolding
  - theme.ts — MUI themes and shared color tokens for styled-components
  - types.ts — Shared TypeScript types for API and UI
  - @types/styled.d.ts — styled-components theme typing
  - components/
    - ChatBox/
      - ChatBox.tsx — chat history with per-message suggestions and re-search
      - ChatInput.tsx — top bar input (textarea + search action)
      - ChatBox.styles.ts — styled-components for chat UI and input
    - ClusterList/
      - ClusterList.tsx — renders search results depending on mode (moment/video), modals, related frames dialog
      - ClusterList.styles.ts — wrapper styles
    - ClusterCard/
      - ClusterCard.tsx — small card per cluster with a popup modal to browse all images
      - ClusterCard.styles.ts — styled MUI Card and image list row
    - ImageCard/
      - ImageCard.tsx — reusable image tile with optional caption and fixed ratio support
    - ModeSwitch/
      - ModeSwitch.tsx — switch between `moment` and `video` modes (popover + toggle behaviors)
      - ModeSwitch.styles.ts — styled MUI IconButtons for main/menu buttons
    - ModelSwitch/
      - ModelSwitch.tsx — segmented small buttons for selecting models (not used in `App` currently)
      - ModelToggle.tsx — compact icon toggle to flip between two models (used in `App`)
    - RephraseSuggestions/
      - RephraseSuggestions.tsx — simple suggestion chips list (not currently mounted; ChatBox has inline suggestions)
      - RephraseSuggestions.styles.ts — styles for suggestions
    - SearchBar/
      - SearchBar.tsx — generic search bar (not mounted; superseded by ChatInput in top bar)
      - SearchBar.styles.ts — styles for search bar container
    - ThemeSwitch/
      - ThemeSwitch.tsx — theme toggle button
      - ThemeSwitch.styles.ts — styled IconButton
  - redux/
    - store.ts — Redux store `configureStore` with the `chat` slice
    - slices/chatSlice.ts — chat state, actions and reducers with enhanced message structure
    - selectors/chatSelector.ts — selector helpers
  - utils/
    - videoUtils.ts — helpers to extract video id/name and frame number, and to enhance images with video info
    - imageUtils.ts — utilities to convert File↔StoredImage (base64) for persistent image storage in Redux

Folder purposes:

- components: Reusable UI building blocks; most are styled with a mix of MUI and styled-components.
- redux: Global chat state (message history and suggestions). Non-chat UI state is local to components.
- utils: Pure utility helpers (video metadata extraction, image serialization).
- types: Centralized shared types for API and components.

## 4. State Management

- Store Structure:
  - Root reducer: `{ chat: ChatState }`
  - Chat slice (`redux/slices/chatSlice.ts`):
    - `messages: ChatMessage[]`
      - `ChatMessage`: Enhanced structure with metadata for re-search functionality
      
        ```typescript
        {
          message_ref: string;
          text: string;              // Display text for UI
          suggestions: string[];
          state_id: string;
          searchType: 'text' | 'visual' | 'temporal';  // Type of search performed
          searchData?: {
            query?: string;          // For text search
            image?: StoredImage;     // For visual search (base64 data URL)
            temporal?: {             // For temporal search
              before: { type: 'text'|'image'; text?: string; image?: StoredImage };
              now: { type: 'text'|'image'; text?: string; image?: StoredImage };
              after: { type: 'text'|'image'; text?: string; image?: StoredImage };
            }
          }
        }
        ```
        
      - `StoredImage`: `{ dataUrl: string; fileName: string; fileType: string }` — base64 representation for Redux persistence
    - Reducers:
      - `addMessage(ChatMessage)` — append new message with full metadata
      - `setSuggestions({ message_ref, suggestions })` — attach variants to a message
      - `clearMessages()` — reset chat history
      - `setMessageStateId({ message_ref, state_id })` — update server `state_id` for a given message
    - Selectors:
      - `selectLastMessage(state)` — returns the last chat message if present

- Local UI State (in `App.tsx`):
  - `mode: ClusterMode` — UI and server clustering mode ("moment" | "video")
  - `clusters: SearchResponse["results"]` — current search results
  - `latestStateId: string` — stores the most recent `state_id` returned by the server; used for feature feedback, mode changes, and context restoration (not sent in regular text/visual searches)
  - `isTemporalMode: boolean` — tracks whether temporal search mode is active (disables mode switching)
  - `loading: boolean` — in-flight request guard for search/mode changes
  - `dark: boolean` — theme mode
  - `model: string` — collection/model key, e.g., `clip_production_1024` or `clip_production_1024`

- **State ID (`state_id`) Management**:
  - **Purpose**: The `state_id` is used for **feature feedback** and **restoring previous search context**, not for continuing conversation threads
  - **How it works**:
    - Each search (text or visual) returns a unique `state_id` from the server
    - The app stores this in `latestStateId` (App-level state) and in each message's `state_id` field (Redux store)
    - When you pass a `state_id` with a new query, the backend will **re-rank results** based on the previous state's context
    - This allows users to refine searches or re-search with context from a specific previous query
  - **Current behavior** (as of latest updates):
    - `searchClusters` (text search): Does **NOT** automatically send `state_id` - searches are independent by default
    - `visualSearch` (image search): Sends `state_id` if available to maintain context
    - `changeClusterMode`: Requires `state_id` to re-cluster existing results in a different grouping mode
    - Re-search from chat history: Uses the stored `state_id` from that specific message to restore context

- State Update Flow (typical text search):
  1. User types in ChatInput (top bar) and submits.
  2. `ChatInput` creates a `ChatMessage` with `uuid` as `message_ref` and empty `state_id`, dispatches `addMessage`, and calls `onSearch(newMessage)`.
  3. `App.handleSearch` calls `searchClusters(text, mode, model)` from `api.ts` **without sending `state_id`** - each text search is independent.
  4. On success, `App` updates `clusters`, stores the returned `state_id` in `latestStateId`, and updates `mode` (server may echo/normalize mode).
  5. In parallel, `ChatBox` requests `getRephraseSuggestions(text, message_ref)` and dispatches `setSuggestions` when results arrive.
  6. UI re-renders: `ClusterList` shows results (moment grid or grouped by video). `ChatBox` shows the message with a "Re-search" button and inline suggestions.

- State Update Flow (re-search from history):
  1. User clicks "Re-search" button in the chat history.
  2. `ChatBox.handleReSearch` inspects the message's `searchType` and `searchData`:
     - **Text search**: Creates new text search with original query
     - **Visual search**: Converts stored base64 image back to File and calls `onVisualSearch`
     - **Temporal search**: Enables temporal mode, converts stored images back to Files, and calls `onTemporalSearch` with reconstructed inputs
  3. For temporal re-search, `ChatBox` first calls `onTemporalModeChange(true)` to enable temporal mode UI
  4. The appropriate search handler is called with the original data, preserving the exact search parameters
  5. Results are updated and a new `state_id` is returned for this re-executed search
  6. **Critical**: Images are stored as base64 data URLs in Redux to enable full re-search capability for visual and temporal searches

- State Update Flow (mode change):
  1. User toggles mode in `ModeSwitch`.
  2. `App.handleModeChange` optimistically updates local `mode` and calls `changeClusterMode(latestStateId, newMode)` to request server-side re-clustering.
  3. The backend uses the `state_id` to re-cluster the **existing search results** in the new grouping mode (moment → video or vice versa).
  4. On completion, `clusters` and `mode` are updated; errors are logged and the prior mode remains visible.

- State Update Flow (visual search):
  1. User pastes an image into `ChatInput` (top bar).
  2. `ChatInput` detects the clipboard paste event, extracts the image file, and displays an image preview with a remove button.
  3. User clicks the search button (or presses Enter).
  4. `ChatInput` calls `onVisualSearch(imageFile)` prop with the pasted `File` object.
  5. `App.handleVisualSearch` creates a `ChatMessage` indicating "Visual search based on pasted image", dispatches `addMessage`, and sets `loading` to true.
  6. `App` calls `visualSearch(imageFile, mode, model, latestStateId)` from `api.ts`, which sends the image as `FormData` to `POST /search/visual`.
  7. On success, `App` updates `clusters`, `latestStateId`, and `mode` from the response, and dispatches `setMessageStateId` to bind the message to the server session.
  8. UI re-renders: `ClusterList` shows visual search results. The chat history displays the visual search message.

- State Update Flow (temporal search):
  1. User clicks the temporal mode toggle button (clock icon) in `ChatInput` to enter temporal search mode.
  2. `ChatInput` notifies `App` via `onTemporalModeChange(true)`, which disables the mode switch (moment/video) in the UI.
  3. `ChatInput` displays 3 input boxes labeled "Before", "Now", "After" (left to right), each supporting both text input and image paste.
  4. User fills in the 3 inputs with any combination of text and/or images (at least one must have content).
  5. User clicks "Search Temporal" button.
  6. `ChatInput` calls `onTemporalSearch(inputs)` with an array of 3 `TemporalSearchInput` objects in order: [before, now, after].
  7. `App.handleTemporalSearch` converts any images to base64 for storage, creates a descriptive `ChatMessage` with full metadata, dispatches `addMessage`, and sets `loading` to true.
  8. `App` calls `temporalSearch(inputs, model, latestStateId)` from `api.ts`, which sends `FormData` to `POST /search/visual/temporal` with:
     - `req`: JSON string containing `{ before: {text?}, now: {text?}, after: {text?}, collection, state_id? }`
     - `before_image`, `now_image`, `after_image`: File objects for each image input (if provided)
  9. Backend processes temporal search and returns results clustered by video with exactly 3 frames per video.
  10. On success, `App` updates `clusters`, `latestStateId`, and `mode` (always "video" for temporal results) from the response.
  11. UI re-renders: `ClusterList` shows temporal search results in video mode. The temporal inputs are cleared and ready for next search.
  12. User can toggle back to normal mode, which re-enables the mode switch.
  13. **Re-search capability**: All temporal data (texts and images as base64) are stored in Redux, enabling exact re-execution of temporal searches from chat history.

- State Update Flow (relevance feedback):
  1. User hovers over an image in the search results (moment or video mode).
  2. Two icon buttons appear as an overlay: 👍 Like and 👎 Dislike.
  3. User clicks either button (e.g., Like on a relevant image).
  4. `ClusterList.handleFeedback` calls `sendFeedback(state_id, mode, image_id, feedback, model)` from `api.ts`.
  5. The API sends `POST /search/feedback` with payload:
     - `state_id`: Current search session ID
     - `mode`: Current clustering mode
     - `positive`: Array of liked image IDs (if feedback = 1)
     - `negative`: Array of disliked image IDs (if feedback = -1)
     - `positive_weight`: 0.75 (default)
     - `negative_weight`: -0.15 (default)
     - `collection`: Current model collection
  6. Backend processes the feedback and returns refined search results with re-ranked clusters.
  7. `App` updates `clusters` state with the new results via `onFeedbackUpdate` callback.
  8. UI displays a success notification: "Feedback submitted! Results refined based on your like/dislike."
  9. Results list updates immediately with improved ranking based on user preference.
  10. **Note**: Feedback requires an active `state_id` from a previous search. If no search session exists, a warning is shown.

## 5. Component Breakdown

| Component Name | Location | Responsibilities | Key Props & State |
|---|---|---|---|
| `App.tsx` | `src/` | Top-level composition: manages mode, model, theme, loading, latestStateId, results; wires chat input/history and results list; calls API for text, visual, and temporal search; tracks temporal mode state to disable mode switching. | Local state: `mode`, `clusters`, `latestStateId`, `loading`, `dark`, `model`, `isTemporalMode`; callbacks: `handleSearch`, `handleVisualSearch`, `handleTemporalSearch`, `handleModeChange` |
| `ChatInput.tsx` | `src/components/ChatBox/` | Multi-mode search input in top bar: normal mode (text/single image paste), temporal mode (3 inputs labeled Before/Now/After from left to right with text/image support each); creates `ChatMessage`, dispatches `addMessage`, triggers appropriate search type; handles clipboard paste for images, displays previews with remove options; temporal mode toggle button notifies parent to disable mode switch; requests rephrase suggestions for text queries. | `onSearch(message)`, `onVisualSearch(file)`, `onTemporalSearch(inputs)`, `onTemporalModeChange(boolean)`; local state: `pastedImage`, `isTemporalMode`, `temporalInputs` |
| `ChatBox.tsx` | `src/components/ChatBox/` | Displays chat history with per-message suggestions, intelligent re-search buttons, and auto-scrolling; each message shows its ID and provides a "Re-search" button that executes the correct search type (text/visual/temporal) with original data; for temporal re-search, automatically enables temporal mode and populates inputs; suggestions can be clicked to trigger new text searches. | `onSearch(message)`, `onVisualSearch(file)`, `onTemporalSearch(inputs)`, `onTemporalModeChange(boolean)`; uses Redux `chat.messages`; local `loading` for suggestions |
| `ModeSwitch.tsx` | `src/components/ModeSwitch/` | Compact toggle between `moment` and `video`; right-click opens menu to select explicitly; left-click flips; can be disabled during temporal search mode. | `mode`, `onChange(mode)`, `disabled?` |
| `ModelToggle.tsx` | `src/components/ModelSwitch/` | Simple icon toggle to flip between two model options; used in `App`. | `value`, `options`, `onChange(key)` |
| `ModelSwitch.tsx` | `src/components/ModelSwitch/` | Segmented button group to pick model (not currently used by `App`). | `value`, `options`, `onChange(key)` |
| `ClusterList.tsx` | `src/components/ClusterList/` | Renders results: grid of frames in Moment mode, per-video groups in Video mode; frame modal; nearby frames dialog via `/search/related`; per-video "View All" dialog; **handles relevance feedback** with like/dislike buttons on image hover. | `clusters: ClusterResult[]`, `mode: ClusterMode`, `stateId?: string`, `model?: string`, `onFeedbackUpdate?: (clusters) => void`; local UI state for dialogs, selections, and feedback notifications |
| `ClusterCard.tsx` | `src/components/ClusterCard/` | Shows a cluster row with thumbnails; in video mode opens a modal with all images; supports closer view. | `cluster: ClusterResult`, `mode: string` |
| `ImageCard.tsx` | `src/components/ImageCard/` | Reusable image tile with hover effect and optional caption; supports fixed aspect ratio; **displays like/dislike overlay buttons** when `showFeedback={true}` and user hovers. Visual search icon removed - visual search now initiated via image paste in ChatInput. | `src`, `alt`, `onClick`, `info`, `ratio?`, `showFeedback?`, `onLike?`, `onDislike?` |
| `ThemeSwitch.tsx` | `src/components/ThemeSwitch/` | Theme toggle button used in left panel. | `dark`, `onClick()` |
| `RephraseSuggestions.tsx` | `src/components/RephraseSuggestions/` | Standalone suggestion chips list (not mounted; kept for potential reuse). | `suggestions`, `onSelect` |
| `SearchBar.tsx` | `src/components/SearchBar/` | Generic search bar with MUI `InputBase` (not mounted; replaced by ChatInput). | `value`, `onChange`, `onSearch` |

## 6. API Service Layer

- Location: `src/api.ts`
- Core Functions:
  - `searchClusters(query: string, mode: ClusterMode, collection = "clip_production_1024", state_id?: string, top_k = 1024): Promise<SearchResponse>`
    - POST `${BASE_URL}/search/text` with payload `{ text, mode, collection, top_k }`
    - **Note**: The `state_id` parameter is **not currently sent** to the backend - each text search is independent by default
    - When called from re-search functionality in chat history, the `state_id` from that message could be passed to enable context-based re-ranking
    - Returns `{ status, state_id, results, mode }`
  - `visualSearch(file: File, mode: ClusterMode, collection = "clip_production_1024", state_id?: string): Promise<SearchResponse>`
    - POST `${BASE_URL}/search/visual` with `FormData` containing `files` (image binary), `mode`, `collection`, and optional `state_id`
    - Uses `multipart/form-data` content type (handled automatically by axios)
    - Sends `state_id` if available to maintain search context from previous queries
    - Returns `{ status, state_id, results, mode }`
  - `temporalSearch(inputs: [TemporalSearchInput, TemporalSearchInput, TemporalSearchInput], collection = "clip_production_1024", state_id?: string): Promise<SearchResponse>`
    - POST `${BASE_URL}/search/visual/temporal` with `FormData` containing:
      - `req`: JSON string with simplified schema `{ before: {text?}, now: {text?}, after: {text?}, collection, state_id? }`
      - `before_image`, `now_image`, `after_image`: optional File objects for each temporal position
    - Inputs array order: [before, now, after]
    - Each `TemporalSearchInput` has `type: 'text' | 'image'` and `content: string | File`
    - Uses `multipart/form-data` content type for temporal/sequential search
    - Backend returns results clustered by video with exactly 3 frames per video
    - Mode is automatically set to "video" for temporal results
    - Returns `{ status, state_id, results, mode: "video" }`
  - `sendFeedback(state_id: string, mode: ClusterMode, imageId: string, feedback: 1 | -1, collection = "clip_production_1024"): Promise<SearchResponse>`
    - POST `${BASE_URL}/search/feedback` with payload:
      - `state_id`: Required - session ID from previous search
      - `mode`: Clustering mode (moment/video)
      - `positive`: Array containing `imageId` if `feedback === 1`, else empty
      - `negative`: Array containing `imageId` if `feedback === -1`, else empty
      - `positive_weight`: 0.75 (default boost for liked images)
      - `negative_weight`: -0.15 (default penalty for disliked images)
      - `collection`: Model collection name
    - Used for relevance feedback to refine search results based on user preferences
    - Backend re-ranks results using positive/negative examples
    - Returns updated `{ status, state_id, results, mode }` with refined ranking
  - `getListClusterImages(cluster: ClusterResult): Promise<string[]>`
    - Maps `cluster.image_list` entries to image URLs: `${BASE_IMAGE_URL}/${img.path}${img.id}.webp`
  - `changeClusterMode(state_id: string, mode: ClusterMode): Promise<SearchResponse>`
    - POST `${BASE_URL}/settings/change-cluster` with `{ state_id, mode }` to re-cluster existing results
    - **Requires** `state_id` to identify which search results to re-cluster in the new mode
    - Used when user switches between "moment" and "video" grouping modes
    - POST `${BASE_URL}/settings/change-cluster` to re-cluster on server for an existing session
  - `getRephraseSuggestions(text: string, message_ref: string): Promise<RephraseResponse>`
    - POST `${BASE_URL}/chat/rephrase/suggestion` with `{ text, message_ref }`; returns `{ variants: string[], message_ref, status }`
  - `getRelatedImages(mode: string, image_id: string, collection?: string): Promise<any>`
    - GET `${BASE_URL}/search/related` with `mode`, `image_id`, optional `collection`; used by the UI to show “Nearby frames” for a selected image

- Error Handling:
  - Errors in API calls are caught in components (`App.tsx`, `ChatInput.tsx`, `ChatBox.tsx`, `ClusterList.tsx`) and handled by logging to console, clearing results when appropriate, and suppressing suggestions; there is no global notification slice yet.

## 7. Types and Utilities

- `types.ts`:
  - `ImageItem` — frame metadata; includes `id`, `path`, optional `name`, `time_in_seconds`, `score`, and compatibility fields `time`, `videoId`, `videoName`, `frameNumber`.
  - `ClusterResult` — `{ cluster_name, url, image_list: ImageItem[] }`
  - `ClusterMode` — union: `"timeline" | "location" | "moment" | "video"`
  - `SearchResponse` — `{ status, state_id, results: ClusterResult[], mode }`
  - `RephraseResponse` — `{ status, variants: string[], message_ref }`
- `utils/videoUtils.ts`:
  - `extractVideoInfo(image, clusterName?)` — parse video id/name and frame number from varied id/name/path patterns (e.g., `L27_V001/001313` ⇒ `videoId: V001`, `videoName: L27_V001`)
  - `enhanceImagesWithVideoInfo(images)` — attach parsed `videoId`, `videoName`, and `frameNumber` to each image entry

## 8. Theming and Styling

- MUI themes: `muiTheme` (light) and `muiDarkTheme` (dark) in `theme.ts`.
- Shared color tokens for styled-components: `mainColors` and `darkColors` exported from `theme.ts`, typed via `@types/styled.d.ts`.
- Components frequently mix MUI building blocks with styled-components wrappers for layout and interactive styles.

## 9. Environment Variables

Set via CRA conventions (must be prefixed with `REACT_APP_`):

- `REACT_APP_BASE_URL` — Base URL for API requests (defaults to `http://14.225.217.119:8082` if not set)
- `REACT_APP_BASE_IMAGE_URL` — Base URL for image hosting (defaults to `http://14.225.217.119:8081` if not set)

Notes:

- These are read in `src/api.ts` using `process.env.REACT_APP_*`.
- Update your `.env` or deployment environment accordingly. Do not commit secret values.

## 10. Development Notes

- Build/Run scripts: `start`, `build`, `test` via CRA (`react-scripts`).
- Testing: Use React Testing Library; a basic test ensures the top-bar search is rendered. Add component-level tests for reducers and API consumers as the app grows.
- Data flow tips:
  - **`state_id` management**: The app stores `state_id` from each search response but does NOT automatically send it in subsequent text searches. This means:
    - Each new text search is **independent** by default (fresh results, not contextual)
    - Visual searches **do send** `state_id` to maintain context
    - Mode changes **require** `state_id` to re-cluster existing results
    - Re-search from chat history can use the stored `state_id` to restore context for that specific query
    - The backend uses `state_id` for **feature feedback** and to **re-rank results** based on previous search context when provided
  - Store the `state_id` returned by each search; it enables mode switching and contextual re-ranking when needed.
  - `ClusterList` moment vs. video views rely on accurate `image_list` metadata. `videoUtils.ts` helps normalize inconsistent ids/names.
- Future enhancements (suggested):
  - Add a global notification/alert system (e.g., a `ui` slice) for API error reporting.
  - Migrate API side-effects to RTK Query or thunks for standard request lifecycles.
  - Consolidate duplicate/legacy components (`SearchBar`, `RephraseSuggestions`) if not used.
