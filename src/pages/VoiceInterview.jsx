import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { submitAnswer, endInterview } from "../lib/api";

export default function VoiceInterview() {
  const location = useLocation();
  const navigate = useNavigate();

  const data = location.state ?? null;

  const setup = data?.setup ?? {
    role: "Interview",
    type: "Voice",
    length: "Medium",
  };
  const sessionId = data?.sessionId ?? null;
  const initialQuestion = data?.question ?? "";
  const micGranted = data?.micGranted ?? false;

  const recognitionRef = useRef(null);
  const recognitionActiveRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const speakFallbackRef = useRef(null);
  const answerRef = useRef("");
  const transcriptEndRef = useRef(null);
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);
  const lastSpokenQuestionRef = useRef("");

  const SpeechRecognition = useMemo(() => {
    if (typeof window === "undefined") return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }, []);

  const recognitionSupported = !!SpeechRecognition;

  const [question, setQuestion] = useState(initialQuestion);
  const [answer, setAnswer] = useState("");
  const [transcript, setTranscript] = useState(
    initialQuestion ? [{ speaker: "Interviewer", text: initialQuestion }] : []
  );
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [callStatus, setCallStatus] = useState(
    !data
      ? "Missing interview data"
      : micGranted
      ? "Connecting..."
      : "Microphone unavailable"
  );

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  function clearSilenceTimer() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  function clearSpeakFallback() {
    if (speakFallbackRef.current) {
      clearTimeout(speakFallbackRef.current);
      speakFallbackRef.current = null;
    }
  }

  function stopRecognition() {
    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.error("stop recognition failed:", err);
    }
  }

  function startRecognition() {
    if (!recognitionRef.current) return;
    if (!recognitionSupported) return;
    if (!micGranted) return;
    if (!sessionId) return;
    if (loadingRef.current) return;
    if (recognitionActiveRef.current) return;

    try {
      setCallStatus("Listening...");
      recognitionRef.current.start();
    } catch (err) {
      console.error("start recognition failed:", err);
    }
  }

  async function handleAutoSubmit() {
    const trimmed = answerRef.current.trim();
    if (!trimmed || loadingRef.current || !sessionId) return;

    clearSilenceTimer();
    stopRecognition();
    setLoading(true);
    setCallStatus("Sending response...");

    const userLine = { speaker: "You", text: trimmed };
    setTranscript((prev) => [...prev, userLine]);
    setAnswer("");
    answerRef.current = "";

    try {
      const response = await submitAnswer({
        sessionId,
        answer: trimmed,
      });

      if (!mountedRef.current) return;

      if (response?.done) {
        setCallStatus("Ending call...");
        const feedback = await endInterview(sessionId);
        if (!mountedRef.current) return;

        navigate("/debrief", {
          state: {
            ...feedback,
            setup,
            role: setup?.role,
            type: setup?.type,
            length: setup?.length,
          },
        });

        return;
      }

      const nextQuestion = response?.question ?? "Can you tell me a bit more?";
      setQuestion(nextQuestion);

      if (Array.isArray(response?.transcript) && response.transcript.length > 0) {
        setTranscript(response.transcript);
      } else {
        setTranscript((prev) => [
          ...prev,
          { speaker: "Interviewer", text: nextQuestion },
        ]);
      }

      setCallStatus("Connected");
    } catch (error) {
      console.error(error);
      setCallStatus("Connection issue");
      alert("Could not submit answer.");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearSilenceTimer();
      clearSpeakFallback();
      try {
        window.speechSynthesis?.cancel();
      } catch {}
      try {
        recognitionRef.current?.stop();
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (!recognitionSupported || !data) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      recognitionActiveRef.current = true;
      setIsListening(true);
      setCallStatus("Listening...");
    };

    recognition.onend = () => {
      recognitionActiveRef.current = false;
      setIsListening(false);

      if (!loadingRef.current && mountedRef.current) {
        setCallStatus("Waiting...");
      }
    };

    recognition.onerror = (event) => {
      console.error("speech recognition error:", event.error);

      recognitionActiveRef.current = false;
      setIsListening(false);

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setCallStatus("Microphone permission blocked");
      } else if (event.error === "aborted") {
        setCallStatus("Restarting mic...");
      } else {
        setCallStatus("Mic error");
      }
    };

    recognition.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalChunk += text + " ";
        } else {
          interimChunk += text + " ";
        }
      }

      if (finalChunk.trim()) {
        answerRef.current = `${answerRef.current} ${finalChunk}`.trim();
      }

      const liveText = `${answerRef.current} ${interimChunk}`.trim();
      setAnswer(liveText);

      clearSilenceTimer();

      if (liveText) {
        silenceTimerRef.current = setTimeout(() => {
          handleAutoSubmit();
        }, 1800);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {}
    };
  }, [SpeechRecognition, recognitionSupported, data]);

  useEffect(() => {
    if (!data) return;
    if (!question || !window.speechSynthesis) return;

    if (lastSpokenQuestionRef.current === question) {
      return;
    }
    lastSpokenQuestionRef.current = question;

    setAnswer("");
    answerRef.current = "";
    clearSilenceTimer();
    clearSpeakFallback();
    stopRecognition();

    setCallStatus("Interviewer speaking...");

    const utterance = new SpeechSynthesisUtterance(question);
    utterance.lang = "en-US";
    utterance.volume = 1;
    utterance.rate = 1;
    utterance.pitch = 1;

    const beginListening = () => {
      clearSpeakFallback();

      if (micGranted && recognitionSupported) {
        setCallStatus("Starting microphone...");
        setTimeout(() => {
          startRecognition();
        }, 250);
      } else if (!recognitionSupported) {
        setCallStatus("Speech recognition not supported");
      } else {
        setCallStatus("Microphone unavailable");
      }
    };

    utterance.onend = beginListening;

    utterance.onerror = (e) => {
      console.error("speech synthesis error:", e);
      beginListening();
    };

    try {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 50);
    } catch (e) {
      console.error("speech synthesis start failed:", e);
      beginListening();
    }

    const estimatedMs = Math.max(2500, question.split(/\s+/).length * 450);
    speakFallbackRef.current = setTimeout(() => {
      beginListening();
    }, estimatedMs);

    return () => {
      clearSpeakFallback();
      try {
        window.speechSynthesis.cancel();
      } catch {}
    };
  }, [question, micGranted, recognitionSupported, data]);

  useEffect(() => {
    if (!transcriptListRef.current) return;
    transcriptListRef.current.scrollTop = transcriptListRef.current.scrollHeight;
  }, [transcript, answer]);

  if (!data) {
    return <Navigate to="/" replace />;
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>HireSim Call</p>
            <h1 style={styles.title}>Phone Interview</h1>
            <p style={styles.subtext}>
              Speak naturally. The interviewer will ask a question, then the app
              will listen and move to the next one automatically.
            </p>
          </div>

          <div style={styles.statusWrap}>
            <div
              style={{
                ...styles.statusDot,
                ...(isListening ? styles.statusDotActive : {}),
              }}
            />
            <span style={styles.statusText}>{callStatus}</span>
          </div>
        </div>

        <div style={styles.infoRow}>
          <div style={styles.infoCard}>
            <p style={styles.infoLabel}>Role</p>
            <p style={styles.infoValue}>{setup.role}</p>
          </div>
          <div style={styles.infoCard}>
            <p style={styles.infoLabel}>Type</p>
            <p style={styles.infoValue}>{setup.type}</p>
          </div>
          <div style={styles.infoCard}>
            <p style={styles.infoLabel}>Length</p>
            <p style={styles.infoValue}>
              {setup.length
                ? setup.length.charAt(0).toUpperCase() + setup.length.slice(1)
                : "Standard"}
            </p>
          </div>
        </div>

        {!recognitionSupported && (
          <p style={styles.warning}>
            This browser does not support speech recognition well for this feature.
          </p>
        )}

        {!micGranted && (
          <p style={styles.warning}>
            Microphone permission was not granted before entering the interview.
          </p>
        )}

        <div style={styles.currentQuestionBox}>
          <p style={styles.currentQuestionLabel}>Current Question</p>
          <p style={styles.currentQuestion}>{question}</p>
        </div>

        <div style={styles.liveAnswerBox}>
          <p style={styles.liveAnswerLabel}>Your live response</p>
          <p style={styles.liveAnswerText}>
            {answer || (isListening ? "Listening..." : "Waiting for speech...")}
          </p>
        </div>

        <div style={styles.transcriptBox}>
          <h2 style={styles.transcriptTitle}>Call Transcript</h2>
          <div ref={transcriptListRef} style={styles.transcriptList}>
            {transcript.map((line, index) => (
              <div
                key={index}
                style={
                  line.speaker === "You"
                    ? styles.userBubbleWrap
                    : styles.botBubbleWrap
                }
              >
                <div
                  style={
                    line.speaker === "You" ? styles.userBubble : styles.botBubble
                  }
                >
                  <p style={styles.bubbleSpeaker}>{line.speaker}</p>
                  <p style={styles.bubbleText}>{line.text}</p>
                </div>
              </div>
            ))}

            {answer && (
              <div style={styles.userBubbleWrap}>
                <div style={styles.userBubbleGhost}>
                  <p style={styles.bubbleSpeaker}>You</p>
                  <p style={styles.bubbleText}>{answer}</p>
                </div>
              </div>
            )}

            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "24px",
    background:
      "radial-gradient(circle at top, #172554 0%, #0f172a 45%, #020617 100%)",
  },

  card: {
    width: "100%",
    maxWidth: "960px",
    background: "rgba(15, 23, 42, 0.92)",
    borderRadius: "28px",
    padding: "32px",
    border: "1px solid rgba(148, 163, 184, 0.14)",
    boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
    backdropFilter: "blur(8px)",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    flexWrap: "wrap",
    marginBottom: "24px",
  },

  eyebrow: {
    margin: 0,
    fontSize: "0.8rem",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#60a5fa",
    fontWeight: 700,
  },

  title: {
    margin: "8px 0 10px 0",
    fontSize: "2rem",
    color: "#f8fafc",
  },

  subtext: {
    margin: 0,
    color: "#94a3b8",
    lineHeight: 1.6,
    maxWidth: "650px",
  },

  statusWrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    borderRadius: "999px",
    background: "rgba(30, 41, 59, 0.9)",
    border: "1px solid rgba(96, 165, 250, 0.25)",
  },

  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    background: "#60a5fa",
    boxShadow: "0 0 0 rgba(96, 165, 250, 0)",
  },

  statusDotActive: {
    boxShadow: "0 0 16px rgba(96, 165, 250, 0.95)",
  },

  statusText: {
    color: "#dbeafe",
    fontWeight: 700,
    fontSize: "0.95rem",
  },

  infoRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px",
    marginBottom: "18px",
  },

  infoCard: {
    border: "1px solid rgba(148, 163, 184, 0.14)",
    borderRadius: "18px",
    padding: "16px",
    background: "rgba(2, 6, 23, 0.65)",
  },

  infoLabel: {
    margin: 0,
    color: "#60a5fa",
    fontSize: "0.8rem",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 700,
  },

  infoValue: {
    margin: "8px 0 0 0",
    color: "#f8fafc",
    fontSize: "1rem",
    fontWeight: 600,
  },

  warning: {
    background: "rgba(124, 45, 18, 0.18)",
    color: "#fdba74",
    border: "1px solid rgba(251, 146, 60, 0.35)",
    borderRadius: "12px",
    padding: "12px 14px",
    marginBottom: "16px",
  },

  currentQuestionBox: {
    borderRadius: "20px",
    padding: "22px",
    background: "linear-gradient(135deg, #1d4ed8 0%, #0f172a 100%)",
    color: "white",
    marginBottom: "18px",
    border: "1px solid rgba(96, 165, 250, 0.28)",
    boxShadow: "0 14px 32px rgba(29, 78, 216, 0.22)",
  },

  currentQuestionLabel: {
    margin: 0,
    fontSize: "0.8rem",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#bfdbfe",
    fontWeight: 700,
  },

  currentQuestion: {
    margin: "10px 0 0 0",
    fontSize: "1.2rem",
    lineHeight: 1.6,
    color: "#eff6ff",
  },

  liveAnswerBox: {
    border: "1px solid rgba(148, 163, 184, 0.14)",
    borderRadius: "16px",
    padding: "16px",
    background: "rgba(2, 6, 23, 0.7)",
    marginBottom: "22px",
  },

  liveAnswerLabel: {
    margin: 0,
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "#60a5fa",
  },

  liveAnswerText: {
    margin: "10px 0 0 0",
    color: "#e2e8f0",
    minHeight: "24px",
    lineHeight: 1.6,
  },

  transcriptBox: {
    border: "1px solid rgba(148, 163, 184, 0.14)",
    borderRadius: "20px",
    padding: "20px",
    background: "rgba(2, 6, 23, 0.72)",
    height: "420px",
    display: "flex",
    flexDirection: "column",
  },

  transcriptTitle: {
    marginTop: 0,
    marginBottom: "16px",
    fontSize: "1.1rem",
    color: "#f8fafc",
  },

  transcriptList: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    display: "grid",
    gap: "12px",
  },

  botBubbleWrap: {
    display: "flex",
    justifyContent: "flex-start",
  },

  userBubbleWrap: {
    display: "flex",
    justifyContent: "flex-end",
  },

  botBubble: {
    maxWidth: "78%",
    background: "rgba(15, 23, 42, 0.95)",
    border: "1px solid rgba(96, 165, 250, 0.16)",
    borderRadius: "16px",
    padding: "12px 14px",
  },

  userBubble: {
    maxWidth: "78%",
    background: "linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)",
    border: "1px solid rgba(147, 197, 253, 0.35)",
    borderRadius: "16px",
    padding: "12px 14px",
  },

  userBubbleGhost: {
    maxWidth: "78%",
    background: "rgba(30, 64, 175, 0.18)",
    border: "1px dashed rgba(96, 165, 250, 0.45)",
    borderRadius: "16px",
    padding: "12px 14px",
  },

  bubbleSpeaker: {
    margin: 0,
    fontSize: "0.8rem",
    fontWeight: 700,
    color: "#93c5fd",
  },

  bubbleText: {
    margin: "6px 0 0 0",
    color: "#f8fafc",
    lineHeight: 1.6,
  },
};