import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { submitAnswer, endInterview } from "../lib/api";

export default function VideoInterview() {
  const location = useLocation();
  const navigate = useNavigate();

  const data = location.state ?? null;

  const normalizedSetup = {
    role: data?.setup?.role ?? "Interview",
    type: data?.setup?.type ?? "Video",
    length: data?.setup?.length ?? data?.setup?.difficulty ?? "Standard",
  };

  const sessionId = data?.sessionId ?? null;
  const initialQuestion = data?.question ?? "";
  const micGranted = data?.micGranted ?? false;

  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const recognitionRef = useRef(null);
  const recognitionActiveRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const speakFallbackRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const transcriptListRef = useRef(null);
  const answerRef = useRef("");
  const lastSpokenQuestionRef = useRef("");
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);
  const idleVideoRef = useRef(null);
  const talkingVideoRef = useRef(null);
  const speechTokenRef = useRef(0);
  const hasBootedSpeechRef = useRef(false);
  const micEnabledRef = useRef(true);
  const aiSpeakingRef = useRef(Boolean(initialQuestion));

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
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [status, setStatus] = useState(
    !data
      ? "Missing interview data"
      : initialQuestion
      ? "Interviewer speaking..."
      : "Connecting..."
  );
  const [showTranscript, setShowTranscript] = useState(true);
  const [aiSpeaking, setAiSpeaking] = useState(Boolean(initialQuestion));
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  const interviewerSpeaking = aiSpeaking;

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  useEffect(() => {
    aiSpeakingRef.current = aiSpeaking;
  }, [aiSpeaking]);

  useEffect(() => {
    const idle = idleVideoRef.current;
    const talking = talkingVideoRef.current;

    if (idle) {
      idle.load();
      const p = idle.play();
      if (p?.catch) p.catch(() => {});
    }

    if (talking) {
      talking.load();
      const p = talking.play();
      if (p?.catch) p.catch(() => {});
    }
  }, []);

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
    clearSilenceTimer();

    if (!recognitionRef.current) return;

    recognitionActiveRef.current = false;

    try {
      recognitionRef.current.abort();
    } catch (err) {
      try {
        recognitionRef.current.stop();
      } catch (err2) {
        console.error("stop recognition failed:", err2);
      }
    }
  }

  function stopCameraStream() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraReady(false);
  }

  async function startCameraStream() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera not supported in this browser");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (!mountedRef.current || !cameraEnabled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      cameraStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current.play();
          } catch (err) {
            console.error("camera video play failed:", err);
          }
        };
      }

      setCameraReady(true);
      setCameraError("");
    } catch (err) {
      console.error("camera start failed:", err);
      setCameraReady(false);
      setCameraError("Camera unavailable");
    }
  }

  function startRecognition() {
    if (!recognitionRef.current) return;
    if (!recognitionSupported) return;
    if (!micGranted) return;
    if (!micEnabledRef.current) return;
    if (!sessionId) return;
    if (loadingRef.current) return;
    if (recognitionActiveRef.current) return;
    if (aiSpeakingRef.current) return;

    try {
      setStatus("Listening...");
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
    setStatus("Sending response...");

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
        setStatus("Ending interview...");
        const feedback = await endInterview(sessionId);

        if (!mountedRef.current) return;

        navigate("/debrief", {
          state: {
            ...feedback,
            setup: normalizedSetup,
            role: normalizedSetup.role,
            type: normalizedSetup.type,
            length: normalizedSetup.length,
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

      setStatus("Connected");
    } catch (error) {
      console.error(error);
      setStatus("Connection issue");
      alert("Could not submit answer.");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }

  function toggleMic() {
    setMicEnabled((prev) => {
      const next = !prev;
      micEnabledRef.current = next;

      if (!next) {
        clearSilenceTimer();
        stopRecognition();
        setIsListening(false);
        setStatus("Mic muted");
      } else {
        setStatus("Waiting...");

        setTimeout(() => {
          if (
            micEnabledRef.current &&
            !aiSpeakingRef.current &&
            !loadingRef.current &&
            !recognitionActiveRef.current
          ) {
            startRecognition();
          }
        }, 200);
      }

      return next;
    });
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
        recognitionRef.current?.abort();
      } catch {}

      stopCameraStream();
    };
  }, []);

  useEffect(() => {
    if (!data) return;

    if (!cameraEnabled) {
      stopCameraStream();
      return;
    }

    startCameraStream();

    return () => {
      stopCameraStream();
    };
  }, [data, cameraEnabled]);

  useEffect(() => {
    if (!recognitionSupported || !data) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      if (!micEnabledRef.current) {
        try {
          recognition.abort();
        } catch {}
        return;
      }

      recognitionActiveRef.current = true;
      setIsListening(true);
      setStatus("Listening...");
    };

    recognition.onend = () => {
      recognitionActiveRef.current = false;
      setIsListening(false);

      if (!mountedRef.current) return;

      if (!micEnabledRef.current) {
        setStatus("Mic muted");
        return;
      }

      if (!loadingRef.current && !aiSpeakingRef.current) {
        setStatus("Waiting...");
      }
    };

    recognition.onerror = (event) => {
      console.error("speech recognition error:", event.error);
      recognitionActiveRef.current = false;
      setIsListening(false);

      if (!mountedRef.current) return;

      if (!micEnabledRef.current) {
        setStatus("Mic muted");
        return;
      }

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setStatus("Microphone permission blocked");
      } else if (event.error === "aborted") {
        setStatus("Waiting...");
      } else {
        setStatus("Mic error");
      }
    };

    recognition.onresult = (event) => {
      if (!micEnabledRef.current) return;

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

      if (liveText && micEnabledRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          if (micEnabledRef.current) {
            handleAutoSubmit();
          }
        }, 1800);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch {}
    };
  }, [SpeechRecognition, recognitionSupported, data]);

  useEffect(() => {
    if (!window.speechSynthesis) return;

    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    if (!question || !window.speechSynthesis) return;
    if (lastSpokenQuestionRef.current === question) return;

    lastSpokenQuestionRef.current = question;
    speechTokenRef.current += 1;
    const token = speechTokenRef.current;

    setAnswer("");
    answerRef.current = "";
    clearSilenceTimer();
    clearSpeakFallback();
    stopRecognition();

    const beginListening = () => {
      if (speechTokenRef.current !== token) return;

      clearSpeakFallback();
      setAiSpeaking(false);

      if (!micEnabledRef.current) {
        setStatus("Mic muted");
        return;
      }

      if (micGranted && recognitionSupported) {
        setStatus("Starting microphone...");
        setTimeout(() => {
          if (speechTokenRef.current === token) {
            startRecognition();
          }
        }, 250);
      } else if (!recognitionSupported) {
        setStatus("Speech recognition not supported");
      } else {
        setStatus("Microphone unavailable");
      }
    };

   const speakNow = () => {
      if (speechTokenRef.current !== token) return;

      const synth = window.speechSynthesis;
      const voices = synth.getVoices();

      const preferredVoice =
        voices.find((v) => v.name === "Samantha") ||
        voices.find((v) => v.name === "Victoria") ||
        null;

      const utterance = new SpeechSynthesisUtterance(question);
      utterance.lang = "en-US";
      utterance.volume = 1;
      utterance.rate = 1.02;
      utterance.pitch = 1;

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        if (speechTokenRef.current !== token) return;
        setAiSpeaking(true);
        setStatus("Interviewer speaking...");
      };

      utterance.onend = () => {
        beginListening();
      };

      utterance.onerror = (e) => {
        console.error("speech synthesis error:", e);
        beginListening();
      };

      try {
        if (synth.speaking || synth.pending) {
          synth.cancel();
        }

        synth.resume();
        synth.speak(utterance);
      } catch (err) {
        console.error("speech synthesis start failed:", err);
        beginListening();
      }

      const estimatedMs = Math.max(3500, question.split(/\s+/).length * 520);
      speakFallbackRef.current = setTimeout(() => {
        beginListening();
      }, estimatedMs);
    };

    if (!hasBootedSpeechRef.current) {
      hasBootedSpeechRef.current = true;
      speakNow();
    } else {
      speakNow();
    }

    return () => {
      clearSpeakFallback();
    };
  }, [question, micGranted, recognitionSupported, data]);

  useEffect(() => {
    if (!micEnabled) return;

    if (
      !aiSpeaking &&
      !loading &&
      !recognitionActiveRef.current &&
      micGranted &&
      recognitionSupported
    ) {
      const t = setTimeout(() => {
        if (micEnabledRef.current) {
          startRecognition();
        }
      }, 200);

      return () => clearTimeout(t);
    }
  }, [micEnabled, aiSpeaking, loading, micGranted, recognitionSupported]);

  useEffect(() => {
    if (!transcriptListRef.current) return;
    transcriptListRef.current.scrollTop = transcriptListRef.current.scrollHeight;
  }, [transcript, answer]);

  if (!data) {
    return <Navigate to="/" replace />;
  }

  return (
    <main style={styles.page}>
      <div style={styles.backgroundGlowTop} />
      <div style={styles.backgroundGlowBottom} />

      <header style={styles.topBar}>
        <div>
          <p style={styles.meetingEyebrow}>HireSim Video Interview</p>
          <h1 style={styles.meetingTitle}>{normalizedSetup.role}</h1>
          <div style={styles.metaRow}>
            <span style={styles.metaPill}>{normalizedSetup.type}</span>
            <span style={styles.metaPill}>
              {normalizedSetup.length
                ? normalizedSetup.length.charAt(0).toUpperCase() + normalizedSetup.length.slice(1)
                : "Standard"}
            </span>
          </div>
        </div>

        <div
          style={{
            ...styles.meetingStatus,
            background: interviewerSpeaking
              ? "rgba(37, 99, 235, 0.18)"
              : isListening
              ? "rgba(13, 148, 136, 0.18)"
              : "rgba(15, 23, 42, 0.88)",
            border: interviewerSpeaking
              ? "1px solid rgba(96, 165, 250, 0.55)"
              : isListening
              ? "1px solid rgba(45, 212, 191, 0.45)"
              : "1px solid rgba(148, 163, 184, 0.18)",
          }}
        >
          <span
            style={{
              ...styles.statusDot,
              background: interviewerSpeaking
                ? "#60a5fa"
                : isListening
                ? "#2dd4bf"
                : "#94a3b8",
            }}
          />
          {status}
        </div>
      </header>

      <div style={styles.callLayout}>
        <section style={styles.stageArea}>
          <div style={styles.stageOverlay} />

          <div style={styles.interviewerStage}>
            <div
              style={{
                ...styles.avatarWrap,
                transform: interviewerSpeaking ? "scale(1.02)" : "scale(1)",
                boxShadow: interviewerSpeaking
                  ? "0 0 0 12px rgba(34, 211, 238, 0.10), 0 30px 80px rgba(2, 132, 199, 0.22)"
                  : "0 22px 60px rgba(0,0,0,0.34)",
                transition: "all 0.25s ease",
              }}
            >
              <div style={styles.videoInner}>
                <video
                  ref={idleVideoRef}
                  src="/interviewer-idle.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  style={{
                    ...styles.avatarVideo,
                    ...styles.layeredAvatarVideo,
                    opacity: interviewerSpeaking ? 0 : 1,
                  }}
                />

                <video
                  ref={talkingVideoRef}
                  src="/interviewer-talking.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  style={{
                    ...styles.avatarVideo,
                    ...styles.layeredAvatarVideo,
                    opacity: interviewerSpeaking ? 1 : 0,
                  }}
                />

                <div style={styles.avatarOverlay} />
              </div>
            </div>

            <p style={styles.stageLabel}>AI Interviewer</p>
            <h2 style={styles.stageQuestion}>{question}</h2>
            <p style={styles.stageSubtext}>
              {interviewerSpeaking
                ? "Speaking..."
                : isListening
                ? "Listening to your response..."
                : micEnabled
                ? "Waiting for your next response..."
                : "Microphone muted"}
            </p>

            {interviewerSpeaking && (
              <div style={styles.voiceBars}>
                <span style={{ ...styles.voiceBar, animationDelay: "0s" }} />
                <span style={{ ...styles.voiceBar, animationDelay: "0.12s" }} />
                <span style={{ ...styles.voiceBar, animationDelay: "0.24s" }} />
                <span style={{ ...styles.voiceBar, animationDelay: "0.36s" }} />
              </div>
            )}
          </div>

          <div style={styles.selfView}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                ...styles.selfVideo,
                display: cameraReady && cameraEnabled ? "block" : "none",
              }}
            />

            {(!cameraReady || !cameraEnabled) && (
              <div style={styles.selfFallback}>
                {!cameraEnabled ? "Camera off" : cameraError || "Connecting camera..."}
              </div>
            )}

            <div style={styles.selfViewLabel}>You</div>
          </div>
        </section>

        {showTranscript && (
          <aside style={styles.transcriptDrawer}>
            <div style={styles.transcriptHeader}>
              <div>
                <p style={styles.transcriptEyebrow}>Live Transcript</p>
                <h2 style={styles.transcriptTitle}>Conversation</h2>
              </div>
            </div>

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
                      line.speaker === "You"
                        ? styles.userBubble
                        : styles.botBubble
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
          </aside>
        )}
      </div>

      <div style={styles.controlBar}>
        <button
          style={{
            ...styles.controlButton,
            ...(micEnabled ? {} : styles.controlButtonDanger),
          }}
          onClick={toggleMic}
        >
          {micEnabled ? "Mute" : "Unmute"}
        </button>

        <button
          style={{
            ...styles.controlButton,
            ...(cameraEnabled ? {} : styles.controlButtonDanger),
          }}
          onClick={() => setCameraEnabled((prev) => !prev)}
        >
          {cameraEnabled ? "Camera Off" : "Camera On"}
        </button>

        <button
          style={styles.controlButton}
          onClick={() => setShowTranscript((s) => !s)}
        >
          {showTranscript ? "Hide Transcript" : "Show Transcript"}
        </button>

        <button style={styles.leaveButton} onClick={() => navigate("/")}>
          Leave Interview
        </button>
      </div>

      <style>
        {`
          @keyframes bounce {
            0%, 100% {
              height: 8px;
              opacity: 0.72;
            }
            50% {
              height: 28px;
              opacity: 1;
            }
          }

          @media (max-width: 1100px) {
            .hiresim-video-layout {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>
    </main>
  );
}

const styles = {
  page: {
    position: "relative",
    height: "100vh",
    background:
      "radial-gradient(circle at top, rgba(34,211,238,0.08), transparent 28%), linear-gradient(180deg, #06111f 0%, #0b1220 38%, #0f172a 100%)",
    color: "#f8fafc",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    overflow: "hidden",
    boxSizing: "border-box",
  },

  backgroundGlowTop: {
    position: "absolute",
    top: "-120px",
    right: "-80px",
    width: "320px",
    height: "320px",
    borderRadius: "999px",
    background: "rgba(59, 130, 246, 0.12)",
    filter: "blur(70px)",
    pointerEvents: "none",
  },

  backgroundGlowBottom: {
    position: "absolute",
    bottom: "-140px",
    left: "-100px",
    width: "360px",
    height: "360px",
    borderRadius: "999px",
    background: "rgba(34, 211, 238, 0.10)",
    filter: "blur(80px)",
    pointerEvents: "none",
  },

  topBar: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4px 2px",
    gap: "16px",
    flexWrap: "wrap",
    flexShrink: 0,
  },

  meetingEyebrow: {
    margin: 0,
    fontSize: "0.78rem",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#7dd3fc",
    fontWeight: 800,
  },

  meetingTitle: {
    margin: "8px 0 10px 0",
    fontSize: "clamp(1.55rem, 2.5vw, 2.2rem)",
    color: "#f8fafc",
    fontWeight: 800,
    lineHeight: 1.1,
  },

  metaRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },

  metaPill: {
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(15, 23, 42, 0.72)",
    border: "1px solid rgba(125, 211, 252, 0.16)",
    color: "#cbd5e1",
    fontSize: "0.88rem",
    fontWeight: 700,
  },

  meetingStatus: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    padding: "11px 16px",
    borderRadius: "999px",
    color: "#e2e8f0",
    fontWeight: 700,
    flexShrink: 0,
    backdropFilter: "blur(12px)",
  },

  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    flexShrink: 0,
  },

  callLayout: {
    position: "relative",
    zIndex: 1,
    flex: 1,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 370px",
    gap: "18px",
    minHeight: 0,
    overflow: "hidden",
  },

  stageArea: {
    position: "relative",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.84) 0%, rgba(2,6,23,0.92) 100%)",
    borderRadius: "28px",
    overflow: "hidden",
    border: "1px solid rgba(148, 163, 184, 0.12)",
    minHeight: 0,
    display: "grid",
    placeItems: "center",
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.35)",
  },

  stageOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at top, rgba(56,189,248,0.08), transparent 30%)",
    pointerEvents: "none",
  },

  interviewerStage: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "44px",
    textAlign: "center",
    boxSizing: "border-box",
    position: "relative",
    zIndex: 1,
  },

  avatarWrap: {
    width: "198px",
    height: "198px",
    borderRadius: "999px",
    overflow: "hidden",
    marginBottom: "20px",
    background: "#020617",
    border: "1px solid rgba(125, 211, 252, 0.22)",
  },

  videoInner: {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },

  layeredAvatarVideo: {
    position: "absolute",
    inset: 0,
    transition: "opacity 0.2s ease",
    pointerEvents: "none",
  },

  avatarVideo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  avatarOverlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.18))",
    pointerEvents: "none",
  },

  stageLabel: {
    margin: 0,
    color: "#7dd3fc",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontSize: "0.78rem",
  },

  stageQuestion: {
    margin: "14px 0 12px 0",
    maxWidth: "780px",
    fontSize: "clamp(1.3rem, 2.2vw, 1.8rem)",
    lineHeight: 1.45,
    color: "#f8fafc",
    fontWeight: 700,
  },

  stageSubtext: {
    margin: 0,
    color: "#cbd5e1",
    fontSize: "0.98rem",
  },

  voiceBars: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: "6px",
    marginTop: "16px",
    height: "28px",
  },

  voiceBar: {
    width: "7px",
    height: "10px",
    borderRadius: "999px",
    background: "#67e8f9",
    animation: "bounce 0.9s ease-in-out infinite",
    boxShadow: "0 0 12px rgba(103, 232, 249, 0.35)",
  },

  selfView: {
    position: "absolute",
    right: "22px",
    bottom: "22px",
    width: "250px",
    aspectRatio: "16 / 10",
    borderRadius: "20px",
    overflow: "hidden",
    background: "#020617",
    border: "1px solid rgba(148, 163, 184, 0.22)",
    boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
    zIndex: 5,
    backdropFilter: "blur(10px)",
  },

  selfVideo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    transform: "scaleX(-1)",
    background: "#020617",
  },

  selfFallback: {
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
    color: "#cbd5e1",
    fontWeight: 700,
    background: "#020617",
    textAlign: "center",
    padding: "16px",
    boxSizing: "border-box",
  },

  selfViewLabel: {
    position: "absolute",
    left: "10px",
    bottom: "10px",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(15, 23, 42, 0.82)",
    border: "1px solid rgba(148, 163, 184, 0.16)",
    fontSize: "0.78rem",
    fontWeight: 800,
    color: "#e2e8f0",
  },

  transcriptDrawer: {
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.84) 0%, rgba(2,6,23,0.92) 100%)",
    borderRadius: "28px",
    padding: "18px",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    border: "1px solid rgba(148, 163, 184, 0.12)",
    minHeight: 0,
    height: "100%",
    boxSizing: "border-box",
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.28)",
  },

  transcriptHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
    flexShrink: 0,
  },

  transcriptEyebrow: {
    margin: 0,
    fontSize: "0.72rem",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#7dd3fc",
    fontWeight: 800,
  },

  transcriptTitle: {
    margin: "6px 0 0 0",
    color: "#f8fafc",
    fontSize: "1.08rem",
    fontWeight: 800,
  },

  transcriptList: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    display: "grid",
    gap: "12px",
    paddingRight: "6px",
    alignContent: "start",
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
    maxWidth: "88%",
    background: "rgba(30, 41, 59, 0.95)",
    border: "1px solid rgba(71, 85, 105, 0.75)",
    borderRadius: "18px",
    padding: "12px 14px",
    boxShadow: "0 10px 22px rgba(0,0,0,0.12)",
  },

  userBubble: {
    maxWidth: "88%",
    background: "linear-gradient(180deg, #0f766e 0%, #115e59 100%)",
    border: "1px solid rgba(45, 212, 191, 0.35)",
    borderRadius: "18px",
    padding: "12px 14px",
    boxShadow: "0 10px 22px rgba(0,0,0,0.12)",
  },

  userBubbleGhost: {
    maxWidth: "88%",
    background: "rgba(19, 78, 74, 0.62)",
    border: "1px dashed rgba(45, 212, 191, 0.65)",
    borderRadius: "18px",
    padding: "12px 14px",
  },

  bubbleSpeaker: {
    margin: 0,
    fontSize: "0.76rem",
    fontWeight: 800,
    color: "#cbd5e1",
    letterSpacing: "0.02em",
  },

  bubbleText: {
    margin: "6px 0 0 0",
    color: "#f8fafc",
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
  },

  controlBar: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    justifyContent: "center",
    gap: "14px",
    paddingTop: "2px",
    flexShrink: 0,
    flexWrap: "wrap",
  },

  controlButton: {
    border: "1px solid rgba(148, 163, 184, 0.14)",
    borderRadius: "999px",
    padding: "12px 18px",
    background: "rgba(15, 23, 42, 0.92)",
    color: "#f8fafc",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
    backdropFilter: "blur(10px)",
  },

  controlButtonDanger: {
    background: "rgba(127, 29, 29, 0.92)",
    border: "1px solid rgba(248, 113, 113, 0.25)",
  },

  leaveButton: {
    border: "1px solid rgba(248, 113, 113, 0.25)",
    borderRadius: "999px",
    padding: "12px 18px",
    background: "linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(127, 29, 29, 0.28)",
  },
};