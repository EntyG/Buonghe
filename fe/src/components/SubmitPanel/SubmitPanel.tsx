import React, { useState, useEffect } from "react";
import { Box, Button, TextField, FormControl, InputLabel, Select, MenuItem, Typography } from "@mui/material";
import { submitEvaluation, pushSubmission } from "../../api";

interface SubmitPanelProps {
  sessionId?: string;
  cachedEvaluations?: any[];
  cachedSessionId?: string;
}

const SubmitPanel: React.FC<SubmitPanelProps> = ({ sessionId, cachedEvaluations, cachedSessionId }) => {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState<string>("");
  const [submitType, setSubmitType] = useState<'KIS' | 'TRAKE' | 'QA'>('KIS');
  
  // KIS fields
  const [kisVideoId, setKisVideoId] = useState<string>("");
  const [kisStartMs, setKisStartMs] = useState<string>("");
  const [kisEndMs, setKisEndMs] = useState<string>("");
  const [kisAnswers, setKisAnswers] = useState<any[]>([]);
  
  // TRAKE fields
  const [trakeVideoId, setTrakeVideoId] = useState<string>("");
  const [trakeFrameIds, setTrakeFrameIds] = useState<string>("");
  const [trakeAnswers, setTrakeAnswers] = useState<any[]>([]);
  
  // QA fields
  const [qaAnswerText, setQaAnswerText] = useState<string>("");
  const [qaVideoId, setQaVideoId] = useState<string>("");
  const [qaTimeMs, setQaTimeMs] = useState<string>("");
  const [qaAnswers, setQaAnswers] = useState<any[]>([]);

  // Load cached evaluations when they change
  useEffect(() => {
    if (cachedEvaluations && cachedSessionId === sessionId) {
      setEvaluations(cachedEvaluations);
    }
  }, [cachedEvaluations, cachedSessionId, sessionId]);

  const handleAddKisAnswer = () => {
    if (!kisVideoId || !kisStartMs || !kisEndMs) {
      alert("All KIS fields are required");
      return;
    }
    const newAnswer = {
      videoId: kisVideoId,
      startMs: parseInt(kisStartMs, 10),
      endMs: parseInt(kisEndMs, 10),
    };
    setKisAnswers([...kisAnswers, newAnswer]);
    setKisVideoId("");
    setKisStartMs("");
    setKisEndMs("");
  };

  const handleRemoveKisAnswer = (idx: number) => {
    setKisAnswers(kisAnswers.filter((_, i) => i !== idx));
  };

  const handleAddTrakeAnswer = () => {
    if (!trakeVideoId || !trakeFrameIds) {
      alert("Video ID and Frame IDs are required");
      return;
    }
    const frameIdsArray = trakeFrameIds.split(",").map(s => s.trim()).filter(Boolean);
    // keep structured fields (videoId, frameIds) so the UI can render them safely
    const newAnswer: any = {
      text: `TR-${trakeVideoId}-${frameIdsArray.join(",")}`,
      videoId: trakeVideoId,
      frameIds: frameIdsArray,
    };
    setTrakeAnswers([...trakeAnswers, newAnswer]);
    setTrakeVideoId("");
    setTrakeFrameIds("");
  };

  const handleRemoveTrakeAnswer = (idx: number) => {
    setTrakeAnswers(trakeAnswers.filter((_, i) => i !== idx));
  };

  const handleAddQaAnswer = () => {
    if (!qaAnswerText) {
      alert("Answer text is required");
      return;
    }
    // include videoId and timeMs so the display block can show them (and avoid undefined access)
    const newAnswer: any = {
      text: `QA-${qaAnswerText}-${qaVideoId}-${qaTimeMs}`,
      videoId: qaVideoId || undefined,
      timeMs: qaTimeMs ? parseInt(qaTimeMs, 10) : undefined,
    };
    setQaAnswers([...qaAnswers, newAnswer]);
    setQaAnswerText("");
    setQaVideoId("");
    setQaTimeMs("");
  };

  const handleRemoveQaAnswer = (idx: number) => {
    setQaAnswers(qaAnswers.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!selectedEvaluation) {
      alert("Please select an evaluation first");
      return;
    }

    if (!sessionId || !sessionId.trim()) {
      alert("Session ID is required");
      return;
    }

    let answers: any[] = [];

    if (submitType === "KIS") {
      if (kisAnswers.length === 0) {
        alert("Please add at least one KIS answer");
        return;
      }
      answers = kisAnswers.map((a) => ({
            mediaItemName: a.videoId,
            start: a.startMs,
            end: a.endMs,
          }));
    } else if (submitType === "TRAKE") {
      if (trakeAnswers.length === 0) {
        alert("Please add at least one TRAKE answer");
        return;
      }
      answers = trakeAnswers.map((a) => ({ text: a.text }));
    } else if (submitType === "QA") {
      if (qaAnswers.length === 0) {
        alert("Please add at least one QA answer");
        return;
      }
      answers = qaAnswers.map((a) => ({ text: a.text }));
    }

    try {
      const body = { answerSets: [{ answers }] };
      const res = await submitEvaluation(selectedEvaluation, sessionId, body);

      // Helpers
      const respToString = (v: any) => {
        try { return typeof v === 'string' ? v : JSON.stringify(v); } catch (e) { return String(v); }
      };
      const showErrorDetail = (detail: any) => {
        if (!detail && detail !== 0) return 'Unknown error';
        if (typeof detail === 'string') return detail;
        if (Array.isArray(detail)) return detail.map((d) => (typeof d === 'string' ? d : JSON.stringify(d))).join('\n');
        if (typeof detail === 'object') return JSON.stringify(detail, null, 2);
        return String(detail);
      };

  // Determine simple outcome: CORRECT, WRONG, or PARTIALLY_CORRECT. Otherwise show ERROR with details.
  let outcome: 'CORRECT' | 'WRONG' | 'PARTIALLY_CORRECT' | 'ERROR' = 'ERROR';

      if (res == null) {
        outcome = 'ERROR';
        alert('ERROR: empty response from server');
      } else if (typeof res === 'string') {
        const up = res.toUpperCase();
        if (up.includes('PARTIALLY_CORRECT')) { outcome = 'PARTIALLY_CORRECT'; alert('PARTIALLY_CORRECT'); }
        else if (up.includes('CORRECT')) { outcome = 'CORRECT'; alert('CORRECT'); }
        else if (up.includes('WRONG')) { outcome = 'WRONG'; alert('WRONG'); }
        else { outcome = 'ERROR'; alert('ERROR:\n' + respToString(res)); }
      } else if (typeof res === 'object') {
        // Look for explicit fields that indicate result
        const fieldsToCheck = [res.submission, res.status, res.result, res.outcome, res.message, res.data, res.description];
        let found = false;
        for (const f of fieldsToCheck) {
          if (f == null) continue;
          const s = String(f).toUpperCase();
          if (s.includes('PARTIALLY_CORRECT')) { outcome = 'PARTIALLY_CORRECT'; alert('PARTIALLY_CORRECT'); found = true; break; }
          if (s.includes('CORRECT')) { outcome = 'CORRECT'; alert('CORRECT'); found = true; break; }
          if (s.includes('WRONG')) { outcome = 'WRONG'; alert('WRONG'); found = true; break; }
        }

        if (!found) {
          // Check boolean flag
          if (res.correct === true) { outcome = 'CORRECT'; alert('CORRECT'); found = true; }
          else if (res.correct === false) { outcome = 'WRONG'; alert('WRONG'); found = true; }
        }

        if (!found) {
          // If there are explicit error fields, show them; otherwise show whole response
          const errDetail = res.errors || res.error || res.details || res.validation || res.messages || res;
          alert('ERROR:\n' + showErrorDetail(errDetail));
          outcome = 'ERROR';
        }
      }

      // Push submission result if we got a valid outcome
      if (outcome !== 'ERROR') {
        type ValidStatus = 'CORRECT' | 'WRONG' | 'PARTIALLY_CORRECT';
        const status = outcome as ValidStatus;

        // Dump full submission payload as JSON string
        const answerString = JSON.stringify(body);

        try {
          await pushSubmission(selectedEvaluation, sessionId, answerString, status);
        } catch (e) {
          console.error('pushSubmission failed:', e);
        }
      }
    
      setKisAnswers([]);
      setTrakeAnswers([]);
      setQaAnswers([]);
      setKisVideoId("");
      setKisStartMs("");
      setKisEndMs("");
      setTrakeVideoId("");
      setTrakeFrameIds("");
      setQaAnswerText("");
      setQaVideoId("");
      setQaTimeMs("");
    } catch (err) {
      console.error('Submit failed:', err);
      const anyErr: any = err as any;
      const serverData = anyErr?.response?.data ?? anyErr?.data ?? null;
      if (serverData) {
        const pretty = typeof serverData === 'string' ? serverData : JSON.stringify(serverData, null, 2);
        alert('ERROR sending submission:\n' + pretty);
      } else if (anyErr?.message) {
        alert('ERROR sending submission:\n' + anyErr.message);
      } else {
        alert('ERROR sending submission: unknown error (see console)');
      }
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        p: 3,
        bgcolor: "background.paper",
        borderRadius: 2,
      }}
    >
      {/* Evaluation and Type Selection */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <FormControl fullWidth size="small">
          <InputLabel id="eval-select-label">Evaluation</InputLabel>
          <Select
            labelId="eval-select-label"
            value={selectedEvaluation}
            label="Evaluation"
            onChange={(e) => setSelectedEvaluation(e.target.value as string)}
          >
            {evaluations.map((ev) => (
              <MenuItem key={ev.id} value={ev.id}>
                {ev.name || ev.id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel id="submit-type-label">Type</InputLabel>
          <Select
            labelId="submit-type-label"
            value={submitType}
            label="Type"
            onChange={(e) => setSubmitType(e.target.value as 'KIS' | 'TRAKE' | 'QA')}
          >
            <MenuItem value="KIS">KIS</MenuItem>
            <MenuItem value="TRAKE">TRAKE</MenuItem>
            <MenuItem value="QA">QA</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Divider */}
      <Box sx={{ borderTop: "1px solid", borderColor: "divider", my: 1 }} />

      {/* KIS Form */}
      {submitType === "KIS" && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.primary", mb: 1 }}>
            KIS Answer Details
          </Typography>
          <TextField
            label="Video ID"
            value={kisVideoId}
            onChange={(e) => setKisVideoId(e.target.value)}
            fullWidth
            variant="outlined"
          />
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Start (ms)"
              type="number"
              value={kisStartMs}
              onChange={(e) => setKisStartMs(e.target.value)}
              fullWidth
              variant="outlined"
            />
            <TextField
              label="End (ms)"
              type="number"
              value={kisEndMs}
              onChange={(e) => setKisEndMs(e.target.value)}
              fullWidth
              variant="outlined"
            />
          </Box>
          <Button 
            variant="contained" 
            onClick={handleAddKisAnswer}
            fullWidth
            sx={{ mt: 1 }}
          >
            Add Answer
          </Button>
          {kisAnswers.length > 0 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
                Added Answers ({kisAnswers.length}):
              </Typography>
              {kisAnswers.map((a, i) => (
                <Box 
                  key={i} 
                  sx={{ 
                    display: "flex", 
                    justifyContent: "space-between",
                    alignItems: "center", 
                    p: 1.5,
                    mb: 1,
                    bgcolor: "background.paper",
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider"
                  }}
                >
                  <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                    {a.videoId} <Box component="span" sx={{ color: "text.secondary" }}>[{a.startMs}ms - {a.endMs}ms]</Box>
                  </Typography>
                  <Button 
                    size="small" 
                    color="error"
                    variant="outlined"
                    onClick={() => handleRemoveKisAnswer(i)}
                  >
                    Remove
                  </Button>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* TRAKE Form */}
      {submitType === "TRAKE" && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.primary", mb: 1 }}>
            TRAKE Answer Details
          </Typography>
          <TextField
            label="Video ID"
            value={trakeVideoId}
            onChange={(e) => setTrakeVideoId(e.target.value)}
            fullWidth
            variant="outlined"
          />
          <TextField
            label="Frame IDs (comma-separated)"
            value={trakeFrameIds}
            onChange={(e) => setTrakeFrameIds(e.target.value)}
            fullWidth
            variant="outlined"
            multiline
            rows={2}
          />
          <Button 
            variant="contained" 
            onClick={handleAddTrakeAnswer}
            fullWidth
            sx={{ mt: 1 }}
          >
            Add Answer
          </Button>
          {trakeAnswers.length > 0 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
                Added Answers ({trakeAnswers.length}):
              </Typography>
              {trakeAnswers.map((a, i) => (
                <Box 
                  key={i} 
                  sx={{ 
                    display: "flex", 
                    justifyContent: "space-between",
                    alignItems: "center", 
                    p: 1.5,
                    mb: 1,
                    bgcolor: "background.paper",
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider"
                  }}
                >
                  <Typography variant="body2" sx={{ fontFamily: "monospace", flex: 1, mr: 2 }}>
                    {a.videoId} <Box component="span" sx={{ color: "text.secondary" }}>[{a.frameIds.join(", ")}]</Box>
                  </Typography>
                  <Button 
                    size="small" 
                    color="error"
                    variant="outlined"
                    onClick={() => handleRemoveTrakeAnswer(i)}
                  >
                    Remove
                  </Button>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* QA Form */}
      {submitType === "QA" && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.primary", mb: 1 }}>
            QA Answer Details
          </Typography>
          <TextField
            label="Answer Text"
            value={qaAnswerText}
            onChange={(e) => setQaAnswerText(e.target.value)}
            fullWidth
            variant="outlined"
            multiline
            rows={3}
          />
          <TextField
            label="Video ID"
            value={qaVideoId}
            onChange={(e) => setQaVideoId(e.target.value)}
            fullWidth
            variant="outlined"
          />
          <TextField
            label="Time (ms)"
            type="number"
            value={qaTimeMs}
            onChange={(e) => setQaTimeMs(e.target.value)}
            fullWidth
            variant="outlined"
          />
          <Button 
            variant="contained" 
            onClick={handleAddQaAnswer}
            fullWidth
            sx={{ mt: 1 }}
          >
            Add Answer
          </Button>
          {qaAnswers.length > 0 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
                Added Answers ({qaAnswers.length}):
              </Typography>
              {qaAnswers.map((a, i) => (
                <Box 
                  key={i} 
                  sx={{ 
                    display: "flex", 
                    justifyContent: "space-between",
                    alignItems: "flex-start", 
                    p: 1.5,
                    mb: 1,
                    bgcolor: "background.paper",
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider"
                  }}
                >
                  <Box sx={{ flex: 1, mr: 2 }}>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      {a.text}
                    </Typography>
                    {(a.videoId || a.timeMs) && (
                      <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace" }}>
                        {a.videoId && `Video: ${a.videoId}`} {a.timeMs && `[${a.timeMs}ms]`}
                      </Typography>
                    )}
                  </Box>
                  <Button 
                    size="small" 
                    color="error"
                    variant="outlined"
                    onClick={() => handleRemoveQaAnswer(i)}
                  >
                    Remove
                  </Button>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Submit Button */}
      <Button
        variant="contained"
        onClick={handleSubmit}
        disabled={!selectedEvaluation}
        sx={{ 
          mt: 2
        }}
      >
        Submit
      </Button>
    </Box>
  );
};

export default SubmitPanel;
