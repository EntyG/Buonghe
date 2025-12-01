import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import SearchIcon from "@mui/icons-material/Search";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { useDispatch } from "react-redux";
import {
  addMessage,
  setSuggestions,
  setMessageStateId,
  ChatMessage,
} from "../../redux/slices/chatSlice";
import {
  getRephraseSuggestions,
  TemporalSearchInput,
  postChatFilter,
} from "../../api";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import {
  InputRow,
  InputWrapper,
  TextareaWrapper,
  Input,
  SendButton,
  CharCounter,
} from "./ChatBox.styles";
import {
  Box,
  Typography,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";

interface ChatInputProps {
  onSearch: (message: ChatMessage) => void;
  onVisualSearch: (imageFile: File) => Promise<void>;
  onTemporalSearch: (
    inputs: [TemporalSearchInput, TemporalSearchInput, TemporalSearchInput]
  ) => Promise<void>;
  isTemporalMode: boolean;
  currentStateId?: string;
  onFilterComplete?: (res: any) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSearch,
  onVisualSearch,
  onTemporalSearch,
  isTemporalMode,
  currentStateId,
  onFilterComplete,
}) => {
  const dispatch = useDispatch();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pastedImage, setPastedImage] = useState<File | null>(null);

  // Temporal mode: 3 inputs (text or image for each)
  const [temporalInputs, setTemporalInputs] = useState<
    {
      text: string;
      image: File | null;
    }[]
  >([
    { text: "", image: null },
    { text: "", image: null },
    { text: "", image: null },
  ]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const filterInputRef = useRef<HTMLInputElement | null>(null);
  const ocrInputRef = useRef<HTMLTextAreaElement | null>(null);
  const objectsInputRef = useRef<HTMLTextAreaElement | null>(null);
  const subtitleInputRef = useRef<HTMLTextAreaElement | null>(null);
  const temporalTextareaRefs = [
    useRef<HTMLTextAreaElement>(null),
    useRef<HTMLTextAreaElement>(null),
    useRef<HTMLTextAreaElement>(null),
  ];

  const MAX_CHARS = 1000;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        220
      )}px`;
    }
  }, [input]);

  // Clear inputs when switching modes
  useEffect(() => {
    if (isTemporalMode) {
      // Switching to temporal mode - clear normal input
      setInput("");
      setPastedImage(null);
    } else {
      // Switching to normal mode - clear temporal inputs
      setTemporalInputs([
        { text: "", image: null },
        { text: "", image: null },
        { text: "", image: null },
      ]);
    }
  }, [isTemporalMode]);

  const handleSendMessage = async (messageText: string, state_id: string) => {
    if (!messageText.trim() || messageText.length > MAX_CHARS) return;

    const message_ref = uuidv4();
    const newMessage: ChatMessage = {
      message_ref,
      text: messageText.trim(),
      state_id: state_id || "",
      suggestions: [],
      searchType: "text",
      searchData: {
        query: messageText.trim(),
      },
    };

    dispatch(addMessage(newMessage));
    onSearch(newMessage);
    setInput("");
    setLoading(true);

    try {
      const res = await getRephraseSuggestions(messageText.trim(), message_ref);
      dispatch(
        setSuggestions({ message_ref, suggestions: res.variants || [] })
      );
    } catch {
      dispatch(setSuggestions({ message_ref, suggestions: [] }));
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await handleSendMessage(input, "");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If filter options are active, don't submit the normal text input on Enter
    if (showFilterOptions) return;
    // if command helper is visible let it handle navigation/accept
    if (showCommandHelper) {
      const handled = handleCommandKey(e);
      if (handled) return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          setPastedImage(file);
          break;
        }
      }
    }
  };

  const clearPastedImage = () => {
    setPastedImage(null);
  };

  const handleVisualSubmit = async () => {
    if (!pastedImage) return;

    setLoading(true);
    try {
      await onVisualSearch(pastedImage);
      setPastedImage(null);
    } catch (error) {
      console.error("Visual search submission error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTemporalPaste = (
    index: number,
    e: React.ClipboardEvent<HTMLTextAreaElement>
  ) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const newInputs = [...temporalInputs];
          newInputs[index].image = file;
          setTemporalInputs(newInputs);
          break;
        }
      }
    }
  };

  const clearTemporalImage = (index: number) => {
    const newInputs = [...temporalInputs];
    newInputs[index].image = null;
    setTemporalInputs(newInputs);
  };

  const handleTemporalTextChange = (index: number, value: string) => {
    const newInputs = [...temporalInputs];
    newInputs[index].text = value;
    setTemporalInputs(newInputs);
  };

  const handleTemporalSubmit = async () => {
    // Check if at least one input has content
    const hasContent = temporalInputs.some(
      (inp) => inp.text.trim() || inp.image
    );
    if (!hasContent) return;

    setLoading(true);
    try {
      const inputs: [
        TemporalSearchInput,
        TemporalSearchInput,
        TemporalSearchInput
      ] = temporalInputs.map((inp) => {
        if (inp.image) {
          return { type: "image" as const, content: inp.image };
        } else {
          return { type: "text" as const, content: inp.text.trim() };
        }
      }) as [TemporalSearchInput, TemporalSearchInput, TemporalSearchInput];

      await onTemporalSearch(inputs);

      // Reset temporal inputs
      setTemporalInputs([
        { text: "", image: null },
        { text: "", image: null },
        { text: "", image: null },
      ]);
    } catch (error) {
      console.error("Temporal search submission error:", error);
    } finally {
      setLoading(false);
    }
  };

  const isInputValid = input.trim().length > 0 && input.length <= MAX_CHARS;
  const isTemporalInputValid = temporalInputs.some(
    (inp) => inp.text.trim() || inp.image
  );
  const isNearLimit = input.length > MAX_CHARS * 0.8;

  // Filter UI state
  const [showFilterOptions, setShowFilterOptions] = useState(false);
  const [filterInputs, setFilterInputs] = useState<{
    text: string;
    ocr: string;
    subtitle: string;
    objects: string;
  }>({ text: "", ocr: "", subtitle: "", objects: "" });

  useEffect(() => {
    const v = input.trim();
    if (v.startsWith("/filter")) {
      setShowFilterOptions(true);
    } else {
      setShowFilterOptions(false);
      // if user deleted the command, reset filter UI
      if (!v) {
        setFilterInputs({ text: "", ocr: "", subtitle: "", objects: "" });
      }
    }
  }, [input]);

  // Command helper: show suggestions when user types '/'
  const [showCommandHelper, setShowCommandHelper] = useState(false);
  const COMMANDS = [
    { cmd: "/filter", label: "Filter current query results" },
    { cmd: "/filterall", label: "Filter whole data set" },
  ];
  const [commandIndex, setCommandIndex] = useState(0);

  // Filter commands based on input
  const filteredCommands = COMMANDS.filter((c) =>
    c.cmd.toLowerCase().startsWith(input.toLowerCase())
  );

  useEffect(() => {
    // Show command helper whenever input starts with '/' and has matches
    if (input.startsWith("/") && filteredCommands.length > 0) {
      setShowCommandHelper(true);
      // Reset command index if current index is out of bounds
      if (commandIndex >= filteredCommands.length) {
        setCommandIndex(0);
      }
    } else {
      setShowCommandHelper(false);
    }
  }, [input, filteredCommands.length, commandIndex]);

  const insertCommand = (command: string) => {
    setInput(command + " ");
    setShowCommandHelper(false);
    // focus textarea after a tick
    setTimeout(() => textareaRef.current?.focus(), 10);
  };

  // Helper to render command with bold matching part
  const renderCommandWithHighlight = (cmd: string, searchTerm: string) => {
    if (!searchTerm || searchTerm === "/") return <strong>{cmd}</strong>;

    const matchLength = searchTerm.length;
    const matchPart = cmd.slice(0, matchLength);
    const restPart = cmd.slice(matchLength);

    return (
      <>
        <strong style={{ fontWeight: 900 }}>{matchPart}</strong>
        <strong style={{ fontWeight: 400 }}>{restPart}</strong>
      </>
    );
  };

  const handleCommandKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showCommandHelper || filteredCommands.length === 0) return false;
    const len = filteredCommands.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCommandIndex((i) => (i + 1) % len);
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCommandIndex((i) => (i - 1 + len) % len);
      return true;
    }
    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      const cmd = filteredCommands[commandIndex]?.cmd;
      if (cmd) {
        insertCommand(cmd);
        // Auto-focus OCR input after selecting filter command
        if (cmd.startsWith("/filter")) {
          setTimeout(() => ocrInputRef.current?.focus(), 100);
        }
      }
      return true;
    }
    return false;
  };

  const resetFilterUI = () => {
    setShowFilterOptions(false);
    setFilterInputs({ text: "", ocr: "", subtitle: "", objects: "" });
    setInput("");
  };

  // Handle Enter key in filter inputs for keyboard navigation
  const handleFilterInputKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    type: "ocr" | "objects" | "subtitle"
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      // Navigate to next input or send filters
      if (type === "ocr") {
        objectsInputRef.current?.focus();
      } else if (type === "objects") {
        subtitleInputRef.current?.focus();
      } else if (type === "subtitle") {
        // Send filters when pressing Enter in subtitle field
        handleSendFilter();
      }
    }
  };

  const handleSendFilter = async () => {
    // Collect terms directly from input fields as single elements
    const textInput = filterInputs.text.trim();
    const ocrTerms = filterInputs.ocr.trim() ? [filterInputs.ocr.trim()] : [];
    const objectsTerms = filterInputs.objects.trim() ? [filterInputs.objects.trim()] : [];
    const subtitleTerms = filterInputs.subtitle.trim() ? [filterInputs.subtitle.trim()] : [];

    // at least one filter must have entries
    if (
      !ocrTerms.length &&
      !subtitleTerms.length &&
      !objectsTerms.length
    )
      return;
    setLoading(true);
    try {
      const isFilterAll = input.trim().toLowerCase().startsWith("/filterall");

      // Create and dispatch a command message so it appears in chat history
      const message_ref = uuidv4();
      const commandMessage: ChatMessage = {
        message_ref,
        text: input.trim(),
        state_id: currentStateId || "",
        suggestions: [],
        searchType: "command",
        searchData: {
          text: textInput,
          filters: {
            ocr: ocrTerms,
            subtitle: subtitleTerms,
            objects: objectsTerms,
          },
          isFilterAll: isFilterAll,
        },
      };

      dispatch(addMessage(commandMessage));

      // Build payload and only include non-empty filters
      const filters: any = {};
      if (ocrTerms.length) filters.ocr = ocrTerms;
      if (objectsTerms.length) filters.objects = objectsTerms;
      if (subtitleTerms.length) filters.subtitle = subtitleTerms;

      const payload: any = {
        mode: "moment",
        filters: filters,
      };

      // Logic for /filter vs /filterall
      if (isFilterAll) {
        // /filterall: no text field, no state_id (filter whole dataset)
        payload.top_k = 256;
      } else {
        // /filter: 
        // - If text is provided, use text field (new search with filters)
        // - If text is empty, use state_id (filter current results)
        if (textInput) {
          payload.text = textInput;
          payload.top_k = 256;
        } else if (currentStateId) {
          payload.state_id = currentStateId;
          // Don't add top_k when using state_id
        }
      }

      const res = await postChatFilter(payload);

      // Update the dispatched command message with server state_id if provided
      if (res?.state_id) {
        dispatch(setMessageStateId({ message_ref, state_id: res.state_id }));
      }

      // notify parent so app can reload clusters / update state_id
      if (typeof onFilterComplete === "function") {
        onFilterComplete(res);
      }

      // reset UI
      resetFilterUI();
    } catch (err) {
      console.error("postChatFilter failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <InputRow onSubmit={handleSend} style={{ width: "100%" }}>
      <InputWrapper>
        {isTemporalMode ? (
          // Temporal Search Mode: 3 inputs (now, before, after)
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              width: "100%",
              padding: 2, // <--- Thêm padding
              borderRadius: 2, // <--- Bo tròn góc
              backgroundColor: (theme) =>
                theme.palette.mode === "dark" ? "#2c2d30" : "#f8f9fa", // <--- Thêm màu nền
              border: (theme) =>
                `2px solid ${
                  theme.palette.mode === "dark" ? "#404248" : "#e9ecef"
                }`, // <--- Thêm viền nhẹ
            }}
          >
            <Box sx={{ display: "flex", gap: 1, width: "100%" }}>
              {temporalInputs.map((temporalInput, index) => {
                const labels = ["Before", "Now", "After"];
                const label = labels[index];
                return (
                  <Box key={index} sx={{ flex: 1, minWidth: 0 }}>
                    {temporalInput.image ? (
                      // Image preview
                      <Box
                        sx={{
                          position: "relative",
                          backgroundColor: (theme) =>
                            theme.palette.mode === "dark"
                              ? "#2c2d30"
                              : "#f8f9fa",
                          borderRadius: 1,
                          border: (theme) =>
                            `2px solid ${
                              theme.palette.mode === "dark"
                                ? "#404248"
                                : "#e9ecef"
                            }`,
                          padding: 1,
                          minHeight: 100,
                        }}
                      >
                        <Box
                          sx={{
                            width: "100%",
                            height: 180,
                            borderRadius: 1,
                            overflow: "hidden",
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: "rgba(0,0,0,0.05)",
                          }}
                        >
                          <img
                            src={URL.createObjectURL(temporalInput.image)}
                            alt={label}
                            style={{
                              maxWidth: "100%",
                              maxHeight: "100%",
                              objectFit: "contain",
                            }}
                          />
                          <IconButton
                            onClick={() => clearTemporalImage(index)}
                            disabled={loading}
                            size="small"
                            sx={{
                              position: "absolute",
                              top: 2,
                              right: 2,
                              backgroundColor: "rgba(0,0,0,0.6)",
                              color: "white",
                              "&:hover": {
                                backgroundColor: "rgba(0,0,0,0.8)",
                              },
                              padding: 0.5,
                            }}
                          >
                            <CloseIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Box>
                        <Typography
                          variant="caption"
                          sx={{
                            mt: 0.5,
                            display: "block",
                            textAlign: "center",
                            fontWeight: "bold",
                          }}
                        >
                          {label}
                        </Typography>
                      </Box>
                    ) : (
                      // Text input
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 0.5,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ fontWeight: "bold", px: 1 }}
                        >
                          {label}
                        </Typography>
                        <TextareaWrapper style={{ minHeight: 80 }}>
                          <Input
                            ref={temporalTextareaRefs[index]}
                            value={temporalInput.text}
                            onChange={(e) =>
                              handleTemporalTextChange(index, e.target.value)
                            }
                            onPaste={(e) => handleTemporalPaste(index, e)}
                            placeholder={`${label} (text or paste image)...`}
                            disabled={loading}
                            maxLength={MAX_CHARS}
                            rows={3}
                            style={{ width: "100%", minHeight: 80 }}
                          />
                        </TextareaWrapper>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <IconButton
                onClick={handleTemporalSubmit}
                disabled={loading || !isTemporalInputValid}
                aria-label="temporal search"
                title="Temporal Search"
                sx={{
                  backgroundColor: "primary.main",
                  color: "white",
                  borderRadius: 2,
                  padding: "8px 16px",
                  "&:hover": {
                    backgroundColor: "primary.dark",
                  },
                  "&:disabled": {
                    backgroundColor: "action.disabledBackground",
                  },
                }}
              >
                <SearchIcon />
                <Typography variant="button" sx={{ ml: 1 }}>
                  Search Temporal
                </Typography>
              </IconButton>
            </Box>
          </Box>
        ) : pastedImage ? (
          // Image preview mode
          <Box
            sx={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: 2,
              backgroundColor: (theme) =>
                theme.palette.mode === "dark" ? "#2c2d30" : "#f8f9fa",
              borderRadius: 2,
              border: (theme) =>
                `2px solid ${
                  theme.palette.mode === "dark" ? "#404248" : "#e9ecef"
                }`,
            }}
          >
            <Box
              sx={{
                position: "relative",
                width: 320,
                height: 180,
                borderRadius: 1,
                overflow: "hidden",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(0,0,0,0.05)",
              }}
            >
              <img
                src={URL.createObjectURL(pastedImage)}
                alt="Pasted preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                }}
              />
              <IconButton
                onClick={clearPastedImage}
                disabled={loading}
                size="small"
                sx={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  color: "white",
                  "&:hover": {
                    backgroundColor: "rgba(0,0,0,0.8)",
                  },
                  padding: 0.5,
                }}
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Image ready for visual search
              </Typography>
              <Typography variant="caption" color="text.disabled">
                {pastedImage.name || "pasted-image.png"}
              </Typography>
            </Box>
            <IconButton
              onClick={handleVisualSubmit}
              disabled={loading}
              aria-label="visual search"
              title="Visual Search"
              sx={{
                backgroundColor: "primary.main",
                color: "white",
                borderRadius: 2,
                padding: "8px",
                "&:hover": {
                  backgroundColor: "primary.dark",
                },
                "&:disabled": {
                  backgroundColor: "action.disabledBackground",
                },
              }}
            >
              <SearchIcon />
            </IconButton>
          </Box>
        ) : (
          // Text input mode
          <TextareaWrapper
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <IconButton
              type="button"
              onClick={() => handleSend()}
              disabled={loading || !isInputValid}
              aria-label="search"
              title="Search"
              sx={{
                backgroundColor: "transparent",
                borderRadius: 2,
                padding: "6px",
                color: "inherit",
              }}
            >
              <SearchIcon style={{ width: 18, height: 18 }} />
            </IconButton>

            <Input
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Search or paste an image..."
              disabled={loading}
              maxLength={MAX_CHARS}
              rows={1}
              style={{ flex: 1 }}
            />

            {/* Command helper suggestions */}
            {showCommandHelper && filteredCommands.length > 0 && (
              <Box
                sx={{
                  position: "absolute",
                  top: "50px",
                  left: 50,
                  zIndex: 1200,
                  bgcolor: "background.paper",
                  borderRadius: 1,
                  boxShadow: 3,
                  p: 1,
                  minWidth: 200,
                }}
              >
                {filteredCommands.map((c, idx) => (
                  <Box
                    key={c.cmd}
                    sx={{
                      px: 1,
                      py: 0.5,
                      cursor: "pointer",
                      backgroundColor:
                        idx === commandIndex
                          ? "action.selected"
                          : "transparent",
                      "&:hover": {
                        backgroundColor: "action.hover",
                      },
                    }}
                    onMouseEnter={() => setCommandIndex(idx)}
                    onClick={() => {
                      setCommandIndex(idx);
                      insertCommand(c.cmd);
                      // Auto-focus OCR input after selecting filter command
                      if (c.cmd.startsWith("/filter")) {
                        setTimeout(() => ocrInputRef.current?.focus(), 100);
                      }
                    }}
                  >
                    <Typography variant="body2">
                      {renderCommandWithHighlight(c.cmd, input)} —{" "}
                      <span style={{ color: "#666" }}>{c.label}</span>
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}

            {/* Filter options popover - Redesigned */}
            {showFilterOptions && (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  p: 2,
                  bgcolor: "background.paper",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  width: "100%",
                  maxWidth: 800,
                }}
              >
                {/* Text query input - only show for /filter (not /filterall) */}
                {input.trim().toLowerCase().startsWith("/filter") &&
                  !input.trim().toLowerCase().startsWith("/filterall") && (
                    <Box
                      sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                    >
                      <Typography variant="subtitle2" fontWeight="bold">
                        Text Query (optional)
                      </Typography>
                      <TextField
                        multiline
                        size="small"
                        placeholder="Enter search text (leave empty to filter current results)..."
                        value={filterInputs.text}
                        onChange={(e) =>
                          setFilterInputs((prev) => ({
                            ...prev,
                            text: e.target.value,
                          }))
                        }
                        sx={{
                          "& .MuiInputBase-root": {
                            minHeight: 40,
                            maxHeight: 80,
                            overflow: "auto",
                            alignItems: "flex-start",
                          },
                        }}
                      />
                    </Box>
                  )}

                {/* Single row with 3 filter inputs */}
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 2,
                  }}
                >
                  {/* OCR */}
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                  >
                    <Typography variant="subtitle2" fontWeight="bold">
                      OCR
                    </Typography>
                    <TextField
                      inputRef={ocrInputRef}
                      multiline
                      size="small"
                      placeholder="Enter OCR terms..."
                      value={filterInputs.ocr}
                      onChange={(e) =>
                        setFilterInputs((prev) => ({
                          ...prev,
                          ocr: e.target.value,
                        }))
                      }
                      onKeyDown={(e: any) => handleFilterInputKeyDown(e, "ocr")}
                      sx={{
                        "& .MuiInputBase-root": {
                          minHeight: 40,
                          maxHeight: 80, // Max 3 lines
                          overflow: "auto",
                          alignItems: "flex-start",
                        },
                      }}
                    />
                  </Box>

                  {/* Objects */}
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                  >
                    <Typography variant="subtitle2" fontWeight="bold">
                      Objects
                    </Typography>
                    <TextField
                      inputRef={objectsInputRef}
                      multiline
                      size="small"
                      placeholder="Enter object terms..."
                      value={filterInputs.objects}
                      onChange={(e) =>
                        setFilterInputs((prev) => ({
                          ...prev,
                          objects: e.target.value,
                        }))
                      }
                      onKeyDown={(e: any) =>
                        handleFilterInputKeyDown(e, "objects")
                      }
                      sx={{
                        "& .MuiInputBase-root": {
                          minHeight: 40,
                          maxHeight: 80, // Max 3 lines
                          overflow: "auto",
                          alignItems: "flex-start",
                        },
                      }}
                    />
                  </Box>

                  {/* Subtitle */}
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                  >
                    <Typography variant="subtitle2" fontWeight="bold">
                      Subtitle
                    </Typography>
                    <TextField
                      inputRef={subtitleInputRef}
                      multiline
                      size="small"
                      placeholder="Enter subtitle terms..."
                      value={filterInputs.subtitle}
                      onChange={(e) =>
                        setFilterInputs((prev) => ({
                          ...prev,
                          subtitle: e.target.value,
                        }))
                      }
                      onKeyDown={(e: any) =>
                        handleFilterInputKeyDown(e, "subtitle")
                      }
                      sx={{
                        "& .MuiInputBase-root": {
                          minHeight: 40,
                          maxHeight: 80, // Max 3 lines
                          overflow: "auto",
                          alignItems: "flex-start",
                        },
                      }}
                    />
                  </Box>
                </Box>

                {/* Action buttons */}
                <Box
                  sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}
                >
                  <Button
                    type="button"
                    onClick={resetFilterUI}
                    variant="outlined"
                    sx={{ minWidth: 100 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="contained"
                    onClick={handleSendFilter}
                    disabled={
                      loading ||
                      (!filterInputs.ocr.trim() &&
                        !filterInputs.subtitle.trim() &&
                        !filterInputs.objects.trim())
                    }
                    sx={{
                      minWidth: 150,
                      bgcolor: "#dc3545",
                      color: "white",
                      "&:hover": { bgcolor: "#c82333" },
                      "&:disabled": { bgcolor: "action.disabledBackground" },
                    }}
                  >
                    SEND FILTERS
                  </Button>
                </Box>
              </Box>
            )}

          </TextareaWrapper>
        )}
      </InputWrapper>
    </InputRow>
  );
};

export default ChatInput;
