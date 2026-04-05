import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { submitAnswer, endInterview } from "../lib/api";

export default function Live() {
  const location = useLocation();
  const navigate = useNavigate();
  const data = location.state;
  const lastSpokenQuestionRef = useRef("");

  if (!data) {
    return <Navigate to="/" replace />;
  }

  const { setup, sessionId, question: initialQuestion } = data;

  const [isListening, setIsListening] = useState(false);
  const [question, setQuestion] = useState(initialQuestion);
  const [answer, setAnswer] = useState("");
  const [transcript, setTranscript] = useState([
    { speaker: "Interviewer", text: initialQuestion },
  ]);
  const [loading, setLoading] = useState(false);

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  const recognitionSupported = !!SpeechRecognition;
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event) => {
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + " ";
            }
        }

        if (finalTranscript.trim()) {
            setAnswer((prev) => `${prev} ${finalTranscript}`.trim());
        }
        };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [SpeechRecognition]);

  useEffect(() => {
    if (!question || !window.speechSynthesis) return;
    if (lastSpokenQuestionRef.current === question) return;

    lastSpokenQuestionRef.current = question;

    const utterance = new SpeechSynthesisUtterance(question);
    utterance.lang = "en-US";

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

    return () => {
        window.speechSynthesis.cancel();
    };
    }, [question]);

  function handleStartListening() {
    if (recognitionRef.current && !loading && !isListening) {
      recognitionRef.current.start();
    }
  }

  function handleStopListening() {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }

  async function handleSubmitAnswer(e) {
    e.preventDefault();

    const trimmed = answer.trim();
    if (!trimmed || loading) return;

    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }

    setLoading(true);

    try {
      const updatedTranscript = [
        ...transcript,
        { speaker: "You", text: trimmed },
      ];

      setTranscript(updatedTranscript);
      setAnswer("");

      const response = await submitAnswer({
        sessionId,
        answer: trimmed,
      });

      if (response.done) {
        const feedback = await endInterview(sessionId);

        navigate("/debrief", {
          state: feedback,
        });
        return;
      }

      setQuestion(response.question);
      setTranscript(response.transcript);
    } catch (error) {
      console.error(error);
      alert("Could not submit answer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.topRow}>
          <div>
            <p style={styles.status}>Interview Live</p>
            <h1 style={styles.title}>{question}</h1>
          </div>

          <div style={styles.metaBox}>
            <p style={styles.metaItem}>
              <strong>Role:</strong> {setup.role}
            </p>
            <p style={styles.metaItem}>
              <strong>Type:</strong> {setup.type}
            </p>
            <p style={styles.metaItem}>
              <strong>Difficulty:</strong> {setup.difficulty}
            </p>
          </div>
        </div>

        <div style={styles.micRow}>
          <button
            type="button"
            onClick={handleStartListening}
            style={styles.secondaryButton}
            disabled={!recognitionSupported || isListening || loading}
          >
            {isListening ? "Listening..." : "Start Listening"}
          </button>

          <button
            type="button"
            onClick={handleStopListening}
            style={styles.secondaryButton}
            disabled={!recognitionSupported || !isListening}
          >
            Stop Listening
          </button>
        </div>

        {!recognitionSupported && (
          <p style={styles.helperText}>
            Speech recognition is not supported in this browser. Try Chrome.
          </p>
        )}

        <p style={styles.text}>
          Answer the question below. You can type or use your microphone.
        </p>

        <div style={styles.transcriptBox}>
          <h2 style={styles.transcriptTitle}>Transcript</h2>
          <div style={styles.transcriptList}>
            {transcript.map((line, index) => (
              <p key={index} style={styles.transcriptLine}>
                <strong>{line.speaker}:</strong> {line.text}
              </p>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmitAnswer} style={styles.form}>
          <label style={styles.label}>Your Answer</label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your response here..."
            style={styles.textarea}
            rows={6}
          />
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Submitting..." : "Submit Answer"}
          </button>
        </form>
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
  },
  card: {
    width: "100%",
    maxWidth: "980px",
    background: "white",
    borderRadius: "24px",
    padding: "40px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "24px",
    flexWrap: "wrap",
  },
  status: {
    margin: 0,
    color: "#059669",
    fontWeight: 700,
  },
  title: {
    marginTop: "10px",
    marginBottom: "12px",
    fontSize: "2.2rem",
    lineHeight: 1.15,
    maxWidth: "620px",
  },
  metaBox: {
    minWidth: "240px",
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "16px",
  },
  metaItem: {
    margin: "0 0 8px 0",
    color: "#374151",
  },
  text: {
    color: "#4b5563",
    marginTop: "8px",
    marginBottom: "24px",
  },
  transcriptBox: {
    marginBottom: "24px",
    padding: "20px",
    borderRadius: "16px",
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    maxHeight: "320px",
    overflowY: "auto",
  },
  transcriptTitle: {
    marginTop: 0,
    marginBottom: "16px",
    fontSize: "1.1rem",
  },
  transcriptList: {
    display: "grid",
    gap: "12px",
  },
  transcriptLine: {
    margin: 0,
    color: "#111827",
    lineHeight: 1.6,
  },
  form: {
    display: "grid",
    gap: "10px",
  },
  label: {
    fontWeight: 600,
    color: "#111827",
  },
  textarea: {
    width: "100%",
    border: "1px solid #d1d5db",
    borderRadius: "14px",
    padding: "16px",
    fontSize: "1rem",
    resize: "vertical",
    minHeight: "140px",
  },
  button: {
    justifySelf: "start",
    border: "none",
    background: "#111827",
    color: "white",
    padding: "14px 22px",
    borderRadius: "12px",
    fontWeight: 600,
    fontSize: "1rem",
    cursor: "pointer",
    opacity: 1,
  },
  micRow: {
    display: "flex",
    gap: "12px",
    marginTop: "8px",
    marginBottom: "8px",
    flexWrap: "wrap",
  },
  secondaryButton: {
    border: "1px solid #d1d5db",
    background: "white",
    color: "#111827",
    padding: "12px 18px",
    borderRadius: "12px",
    fontWeight: 600,
    fontSize: "0.95rem",
    cursor: "pointer",
  },
  helperText: {
    margin: 0,
    color: "#6b7280",
    fontSize: "0.95rem",
  },
};