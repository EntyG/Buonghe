import React, { useState, useEffect, useRef, useCallback } from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StyledThemeProvider } from "styled-components";
import CssBaseline from "@mui/material/CssBaseline";
import { muiTheme, mainColors, muiDarkTheme, darkColors } from "./theme";
import ModeSwitch from "./components/ModeSwitch/ModeSwitch";
import ModelSwitch from "./components/ModelSwitch/ModelSwitch";
import ModelToggle from "./components/ModelSwitch/ModelToggle";
import TemporalSwitch from "./components/TemporalSwitch/TemporalSwitch";
import FeedbackButton from "./components/FeedbackButton/FeedbackButton";
import ClusterList from "./components/ClusterList/ClusterList";
import { ClusterMode, SearchResponse } from "./types";
import { searchClusters, changeClusterMode, visualSearch, temporalSearch, TemporalSearchInput, postChatFilter, getEvaluations, loginToEventApi } from "./api";
import CircularProgress from "@mui/material/CircularProgress";
import { Button, TextField, Select, MenuItem, FormControl, InputLabel, Box, IconButton, Collapse } from "@mui/material";
import { Layout, LeftPanel, RightPanel, RightSidebar, Sidebar, TopBar } from "./App.styles";
import ThemeSwitchButton from "./components/ThemeSwitch/ThemeSwitch";
import ChatInput from "./components/ChatBox/ChatInput";
import ChatBox from "./components/ChatBox/ChatBox";
import SubmitPanel from "./components/SubmitPanel/SubmitPanel";
import { addMessage, ChatMessage, setMessageStateId } from "./redux/slices/chatSlice";
import { useDispatch } from "react-redux";
import { v4 as uuidv4 } from "uuid";
import { fileToStoredImage } from "./utils/imageUtils";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import Live2DCanvas from './components/Live2DModel/Live2DCanvas';

const App: React.FC = () => {
  const dispatch = useDispatch();
  const [mode, setMode] = useState<ClusterMode>("moment");
  const [clusters, setClusters] = useState<SearchResponse["results"]>([]);
  const [latestStateId, setLatestStateId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);
  // model selection: clip or siglip2
  const [model, setModel] = useState<string>("clip_production_1024");
  // temporal mode state - when enabled, mode switch should be disabled
  const [isTemporalMode, setIsTemporalMode] = useState(false);
  // feedback state - map of imageId to feedback type
  const [feedbackMap, setFeedbackMap] = useState<Map<string, 'positive' | 'negative'>>(new Map());

  // Session / evaluation submission UI state (sessionId only; submit UI lives inside ChatInput)
  const [sessionId, setSessionId] = useState<string>("");
  const [loadedSessionId, setLoadedSessionId] = useState<string>("");
  const [loadedEvaluations, setLoadedEvaluations] = useState<any[]>([]);
  const [submitPanelOpen, setSubmitPanelOpen] = useState(true);

  // Live2D model state
  const live2dRef = useRef<any>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [currentMood, setCurrentMood] = useState('neutral');
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Handle model ready
  const handleModelReady = useCallback(() => {
    setIsModelReady(true);
    console.log('Live2D model ready');
  }, []);

  // Load persisted sessionId from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('event_session_id');
      if (stored && stored.trim()) {
        setSessionId(stored);
      }
    } catch (e) {
      console.warn('Unable to read event_session_id from localStorage', e);
    }
  }, []);

  // Manual: Get sessionId on demand
  const handleGetSessionId = async () => {
    try {
      setLoading(true);
      const username = "team019";
      const password = "AfYfdg8qXP";
      const res = await loginToEventApi(username, password);
      if (res?.sessionId) {
        setSessionId(res.sessionId);
        try {
          localStorage.setItem('event_session_id', res.sessionId);
        } catch (e) {
          console.warn('Unable to persist event_session_id to localStorage', e);
        }
        // Clear cached evaluations to avoid mismatch with new session
        setLoadedEvaluations([]);
        setLoadedSessionId("");
      }
    } catch (e) {
      console.error('Failed to get sessionId', e);
      alert('Failed to get sessionId');
    } finally {
      setLoading(false);
    }
  };

  const loadEvaluationsInApp = async () => {
    if (!sessionId || !sessionId.trim()) {
      alert('Please enter a sessionId first');
      return;
    }

    // If already loaded for this session, skip
    if (loadedSessionId === sessionId && loadedEvaluations.length > 0) {
      return;
    }

    try {
      setLoading(true);
      const res = await getEvaluations(sessionId.trim());
      setLoadedEvaluations(Array.isArray(res) ? res : []);
      setLoadedSessionId(sessionId);
    } catch (err) {
      console.error('Failed to load evaluations', err);
      alert('Failed to load evaluations (see console)');
    } finally {
      setLoading(false);
    }
  };

  const MODEL_OPTIONS = [
    { key: "clip_production_1024", label: "CLIP" },
    { key: "siglip2_production_1152", label: "SigLip2" },
    { key: "ensemble", label: "ENS" },
  ];

  const handleSearch = async (messages: ChatMessage) => {
    if (!messages.text.trim()) return;
    setLoading(true);
    try {
      // prefer state_id from the message (if continuing a conversation),
      // otherwise use the latestStateId stored in the app
      const stateIdToUse = messages.state_id && messages.state_id.trim() ? messages.state_id : latestStateId || undefined;
      console.log("=== TEXT SEARCH START ===");
      console.log("Query:", messages.text);
      console.log("Using state_id:", stateIdToUse);
      console.log("Mode:", mode);
      console.log("Model:", model);
      
      const res = await searchClusters(
        messages.text,
        mode,
        model,
        stateIdToUse,
        256
      );
      
      console.log("=== TEXT SEARCH RESPONSE ===");
      console.log("Results count:", res.results?.length || 0);
      console.log("State ID:", res.state_id);
      console.log("Mode:", res.mode);
      
      setClusters(res.results);
      console.log("search results:", res.state_id);
      setLatestStateId(res.state_id);
      setMode(res.mode);
    } catch (e) {
      console.error("Search error:", e);
      setClusters([]);
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = async (newMode: ClusterMode) => {
    console.log("requesting mode change to", newMode);
    // If we don't have a server state_id yet, allow local mode changes immediately
    setMode(newMode);
    setLoading(true);
    try {
      // call backend to change clustering for the existing state_id
      const res = await changeClusterMode(latestStateId, newMode);
      setClusters(res.results)
    } catch (e) {
      console.error("Failed to change cluster mode:", e);
      // leave mode as-is
    } finally {
      setLoading(false);
    }
  };

  const theme = dark ? muiDarkTheme : muiTheme;
  const styledTheme = dark ? darkColors : mainColors;

  const handleVisualSearch = async (imageFile: File) => {
    setLoading(true);
    
    // Store image as base64 for re-search capability
    const storedImage = await fileToStoredImage(imageFile);
    
    const newMessage: ChatMessage = {
      message_ref: uuidv4(),
      text: `Visual search based on pasted image: ${imageFile.name}`,
      suggestions: [],
      state_id: latestStateId,
      searchType: 'visual',
      searchData: {
        image: storedImage,
      },
    };
    dispatch(addMessage(newMessage));
    try {
      console.log("=== VISUAL SEARCH START ===");
      console.log("Image:", imageFile.name);
      console.log("Using state_id:", latestStateId);
      console.log("Mode:", mode);
      console.log("Model:", model);
      
      const response = await visualSearch(imageFile, mode, model, latestStateId);
      
      console.log("=== VISUAL SEARCH RESPONSE ===");
      console.log("Results count:", response.results?.length || 0);
      console.log("State ID:", response.state_id);
      console.log("Mode:", response.mode);
      
      setClusters(response.results);
      setLatestStateId(response.state_id);
      setMode(response.mode);
      if (response.state_id) {
        dispatch(
          setMessageStateId({
            message_ref: newMessage.message_ref,
            state_id: response.state_id,
          })
        );
      }
    } catch (e) {
      console.error("Visual search error:", e);
      setClusters([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTemporalSearch = async (inputs: [TemporalSearchInput, TemporalSearchInput, TemporalSearchInput]) => {
    setLoading(true);
    
    // Store images as base64 for re-search capability
    const [beforeInput, nowInput, afterInput] = inputs;
    
    const temporalData: any = {
      before: { type: beforeInput.type },
      now: { type: nowInput.type },
      after: { type: afterInput.type },
    };
    
    // Convert images to stored format
    if (beforeInput.type === 'image' && beforeInput.content instanceof File) {
      temporalData.before.image = await fileToStoredImage(beforeInput.content);
    } else if (beforeInput.type === 'text') {
      temporalData.before.text = beforeInput.content as string;
    }
    
    if (nowInput.type === 'image' && nowInput.content instanceof File) {
      temporalData.now.image = await fileToStoredImage(nowInput.content);
    } else if (nowInput.type === 'text') {
      temporalData.now.text = nowInput.content as string;
    }
    
    if (afterInput.type === 'image' && afterInput.content instanceof File) {
      temporalData.after.image = await fileToStoredImage(afterInput.content);
    } else if (afterInput.type === 'text') {
      temporalData.after.text = afterInput.content as string;
    }
    
    // Create descriptive message - order is Before, Now, After
    const labels = ['Before', 'Now', 'After'];
    const inputDescriptions = inputs.map((inp, idx) => {
      if (inp.type === 'image' && inp.content instanceof File) {
        return `${labels[idx]}: Image (${inp.content.name})`;
      } else if (inp.type === 'text' && typeof inp.content === 'string' && inp.content.trim()) {
        return `${labels[idx]}: "${inp.content.substring(0, 30)}${inp.content.length > 30 ? '...' : ''}"`;
      }
      return null;
    }).filter(Boolean).join(', ');
    
    const newMessage: ChatMessage = {
      message_ref: uuidv4(),
      text: `Temporal search: ${inputDescriptions}`,
      suggestions: [],
      state_id: latestStateId,
      searchType: 'temporal',
      searchData: {
        temporal: temporalData,
      },
    };
    dispatch(addMessage(newMessage));
    
    try {
      console.log("=== TEMPORAL SEARCH START ===");
      console.log("Inputs:", inputs);
      console.log("Using state_id:", latestStateId);
      console.log("Model:", model);
      
      const response = await temporalSearch(inputs, model, latestStateId);
      
      console.log("=== TEMPORAL SEARCH RESPONSE ===");
      console.log("Results count:", response.results?.length || 0);
      console.log("State ID:", response.state_id);
      console.log("Mode:", response.mode);
      
      // Fix frame order: Backend returns [now, before, after], we need [before, now, after]
      const reorderedResults = response.results.map(cluster => {
        if (cluster.image_list && cluster.image_list.length === 3) {
          // Reorder from [now, before, after] to [before, now, after]
          // Original indices: [0=now, 1=before, 2=after]
          // New order: [1=before, 0=now, 2=after]
          const [now, before, after] = cluster.image_list;
          return {
            ...cluster,
            image_list: [before, now, after]
          };
        }
        return cluster;
      });
      
      setClusters(reorderedResults);
      setLatestStateId(response.state_id);
      // Temporal search always returns mode "video"
      setMode(response.mode);
      if (response.state_id) {
        dispatch(
          setMessageStateId({
            message_ref: newMessage.message_ref,
            state_id: response.state_id,
          })
        );
      }
    } catch (e) {
      console.error("Temporal search error:", e);
      setClusters([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedbackChange = (imageId: string, feedbackType: 'positive' | 'negative' | null) => {
    setFeedbackMap(prevMap => {
      const newMap = new Map(prevMap);
      if (feedbackType === null) {
        newMap.delete(imageId);
      } else {
        newMap.set(imageId, feedbackType);
      }
      return newMap;
    });
  };

  const handleSendFeedback = async () => {
    if (!latestStateId || feedbackMap.size === 0) {
      console.warn("No state ID or feedback to send");
      return;
    }

    try {
      setLoading(true);
      
      // Build positive and negative arrays with '/' prefix
      const positive: string[] = [];
      const negative: string[] = [];
      
      feedbackMap.forEach((type, imageId) => {
        // Ensure imageId starts with '/'
        const formattedId = imageId.startsWith('/') ? imageId : `/${imageId}`;
        if (type === 'positive') {
          positive.push(formattedId);
        } else {
          negative.push(formattedId);
        }
      });

      // Create feedback message for chat history
      const feedbackSummary = `Feedback: Positive: ${positive.length} image${positive.length !== 1 ? 's' : ''}, Negative: ${negative.length} image${negative.length !== 1 ? 's' : ''}`;
      const feedbackMessage: ChatMessage = {
        message_ref: uuidv4(),
        text: feedbackSummary,
        suggestions: [],
        state_id: latestStateId, // Will be updated after API response
        searchType: 'feedback',
        searchData: {
          feedback: {
            positive,
            negative,
          },
        },
      };

      // Dispatch message to Redux
      dispatch(addMessage(feedbackMessage));

      const payload = {
        state_id: latestStateId,
        mode,
        collection: model,
        positive,
        negative,
      };

      console.log("Sending feedback batch:", payload);
      const { sendFeedback } = await import("./api");
      const response = await sendFeedback(payload);
      
      // Update results and state
      setClusters(response.results);
      setLatestStateId(response.state_id);
      
      // Update message with new state_id
      dispatch(setMessageStateId({ 
        message_ref: feedbackMessage.message_ref, 
        state_id: response.state_id 
      }));
      
      // Clear feedback selections
      setFeedbackMap(new Map());
      
      console.log("Feedback sent successfully");
    } catch (error) {
      console.error("Failed to send feedback:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle feedback re-search from chat history
  const handleFeedbackReSearch = async (positive: string[], negative: string[]) => {
    if (!latestStateId) {
      console.warn("No state ID for feedback re-search");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        state_id: latestStateId,
        mode,
        collection: model,
        positive,
        negative,
      };

      console.log("Re-searching with feedback:", payload);
      const { sendFeedback } = await import("./api");
      const response = await sendFeedback(payload);
      
      // Update results and state
      setClusters(response.results);
      setLatestStateId(response.state_id);
      
      console.log("Feedback re-search completed successfully");
    } catch (error) {
      console.error("Failed to re-search with feedback:", error);
    } finally {
      setLoading(false);
    }
  };

  

  // Handle re-running a command-type chat message (e.g. /filter)
  const handleCommandRun = async (msg: ChatMessage) => {
    const filters = msg.searchData?.filters;
    const textQuery = msg.searchData?.text;
    const isFilterAll = !!msg.searchData?.isFilterAll;
    if (!filters) {
      console.warn('No filters found for command run');
      return;
    }

    try {
      setLoading(true);
      
      // Build payload with only non-empty filters
      const filtersPayload: any = {};
      if (filters.ocr && filters.ocr.length) filtersPayload.ocr = filters.ocr;
      if (filters.objects && filters.objects.length) filtersPayload.objects = filters.objects;
      if (filters.subtitle && filters.subtitle.length) filtersPayload.subtitle = filters.subtitle;
      
      const payload: any = {
        mode: 'moment',
        filters: filtersPayload,
      };

      // Logic for /filter vs /filterall
      if (isFilterAll) {
        // /filterall: no text field, no state_id (filter whole dataset)
        payload.top_k = 256;
      } else {
        // /filter: 
        // - If text is provided, use text field (new search with filters)
        // - If text is empty, use state_id (filter current results)
        if (textQuery && textQuery.trim()) {
          payload.text = textQuery.trim();
          payload.top_k = 256;
        } else {
          // prefer the message's stored state_id, otherwise fall back to latestStateId
          const sid = msg.state_id && msg.state_id.trim() ? msg.state_id : latestStateId || undefined;
          if (sid) {
            payload.state_id = sid;
            // Don't add top_k when using state_id
          }
        }
      }

      const res = await postChatFilter(payload);

      // Update clusters and state
      setClusters(res.results);
      setLatestStateId(res.state_id);

      // Update message with returned state_id
      if (res?.state_id) {
        dispatch(setMessageStateId({ message_ref: msg.message_ref, state_id: res.state_id }));
      }
    } catch (err) {
      console.error('Command re-run failed', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MuiThemeProvider theme={theme}>
      <StyledThemeProvider theme={styledTheme}>
        <CssBaseline />
        <Layout>
          <LeftPanel>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px 16px 32px' }}>
              <ModeSwitch mode={mode} onChange={handleModeChange} disabled={isTemporalMode} />
              <TemporalSwitch isActive={isTemporalMode} onChange={() => setIsTemporalMode(!isTemporalMode)} />
              <FeedbackButton 
                feedbackCount={feedbackMap.size} 
                disabled={!latestStateId}
                onClick={handleSendFeedback}
              />
              <ModelToggle value={model} options={MODEL_OPTIONS} onChange={setModel} />
              <ThemeSwitchButton onClick={() => setDark((d) => !d)} dark={dark} />
            </div>
            <ChatBox 
              onSearch={handleSearch} 
              onVisualSearch={handleVisualSearch}
              onTemporalSearch={handleTemporalSearch}
              onTemporalModeChange={setIsTemporalMode}
              onFeedbackReSearch={handleFeedbackReSearch}
              onCommandRun={handleCommandRun}
            />
          </LeftPanel>
          {/* Right Panel - Live2D Model */}
          <RightPanel>
                        <TopBar>
              {/* /submit UI moved into ChatInput */}

              <ChatInput 
                onSearch={handleSearch} 
                onVisualSearch={handleVisualSearch}
                onTemporalSearch={handleTemporalSearch}
                isTemporalMode={isTemporalMode}
                currentStateId={latestStateId}
                onFilterComplete={(res) => {
                  // backend returns new state_id and results similar to search endpoints
                  if (res?.state_id) setLatestStateId(res.state_id);
                  if (res?.results) setClusters(res.results);
                }}
              />
            </TopBar>

            {loading ? (
              <div style={{ textAlign: "center", margin: 32 }}>
                <CircularProgress color="primary" />
              </div>
            ) : (
              <>
                <ClusterList 
                  clusters={clusters} 
                  mode={mode} 
                  stateId={latestStateId}
                  model={model}
                  feedbackMap={feedbackMap}
                  onFeedbackChange={handleFeedbackChange}
                />
              </>
            )}
    
          </RightPanel>

          {/* Right Sidebar - Live2D Model */}
          <RightSidebar>
            <Box
              sx={{
                width: '100%',
                height: '100%',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'background.paper',
                overflow: 'hidden',
              }}
            >
              {/* Loading State */}
              {!isModelReady && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    bgcolor: 'rgba(0,0,0,0.5)',
                  }}
                >
                  <CircularProgress size={48} />
                  <Box sx={{ mt: 2, color: 'text.secondary' }}>Loading Model...</Box>
                </Box>
              )}

              {/* Live2D Canvas */}
              <Box sx={{ flex: 1, position: 'relative', minHeight: 0 }}>
                <Live2DCanvas
                  ref={live2dRef}
                  mood={currentMood}
                  isSpeaking={isSpeaking}
                  onReady={handleModelReady}
                />
              </Box>

              {/* Mood Indicator */}
              {isModelReady && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    px: 2,
                    py: 1,
                    bgcolor: 'rgba(0,0,0,0.6)',
                    borderRadius: 2,
                    color: 'white',
                    fontSize: '0.875rem',
                  }}
                >
                  Mood: {currentMood} {isSpeaking && '🗣️'}
                </Box>
              )}
            </Box>
          </RightSidebar>
        </Layout>
      </StyledThemeProvider>
    </MuiThemeProvider>
  );
};

export default App;
