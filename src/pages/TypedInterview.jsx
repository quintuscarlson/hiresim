import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { submitAnswer, endInterview } from "../lib/api";

export default function TypedInterview() {
  const location = useLocation();
  const navigate = useNavigate();
  const data = location.state;
  const transcriptEndRef = useRef(null);

  if (!data) {
    return <Navigate to="/" replace />;
  }

  const { setup, sessionId, question: initialQuestion } = data;

  const [question, setQuestion] = useState(initialQuestion);
  const [answer, setAnswer] = useState("");
  const [transcript, setTranscript] = useState([
    { speaker: "Interviewer", text: initialQuestion },
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  async function handleSubmitAnswer(e) {
    e.preventDefault();

    const trimmed = answer.trim();
    if (!trimmed || loading) return;

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
        {/* TOP */}
        <div style={styles.topRow}>
          <div>
            <p style={styles.status}>● Live Interview</p>
            <h1 style={styles.title}>{question}</h1>
          </div>

          <div style={styles.metaBox}>
            <p><strong>Role:</strong> {setup.role}</p>
            <p><strong>Type:</strong> {setup.type}</p>
           <p>
              <strong>Length:</strong>{" "}
              {setup.length
                ? setup.length.charAt(0).toUpperCase() + setup.length.slice(1)
                : "Standard"}
            </p>
          </div>
        </div>

        {/* TRANSCRIPT */}
        <div style={styles.transcriptBox}>
          <h2 style={styles.transcriptTitle}>Transcript</h2>
          <div style={styles.transcriptList}>
            {transcript.map((line, index) => (
              <p key={index} style={styles.transcriptLine}>
                <span style={styles.speaker}>{line.speaker}:</span>{" "}
                {line.text}
              </p>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* INPUT */}
        <form onSubmit={handleSubmitAnswer} style={styles.form}>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your response..."
            style={styles.textarea}
            rows={5}
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
    background: "#0f172a", // dark navy
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px",
  },

  card: {
    width: "100%",
    maxWidth: "950px",
    background: "#111827",
    borderRadius: "20px",
    padding: "32px",
    boxShadow: "0 0 40px rgba(0,0,0,0.6)",
    border: "1px solid #1f2937",
  },

  topRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    flexWrap: "wrap",
  },

  status: {
    color: "#22c55e",
    fontWeight: 600,
    margin: 0,
  },

  title: {
    marginTop: "10px",
    fontSize: "1.8rem",
    color: "#f9fafb",
    maxWidth: "600px",
  },

  metaBox: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "14px",
    padding: "14px",
    color: "#cbd5f5",
    fontSize: "0.9rem",
  },

  transcriptBox: {
    marginTop: "24px",
    background: "#020617",
    borderRadius: "14px",
    padding: "16px",
    border: "1px solid #1e293b",
    maxHeight: "280px",
    overflowY: "auto",
  },

  transcriptTitle: {
    margin: "0 0 10px 0",
    color: "#94a3b8",
    fontSize: "0.9rem",
  },

  transcriptList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  transcriptLine: {
    margin: 0,
    color: "#e5e7eb",
    fontSize: "0.95rem",
    lineHeight: 1.5,
  },

  speaker: {
    color: "#38bdf8", // light blue accent
    fontWeight: 600,
  },

  form: {
    marginTop: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  textarea: {
    background: "#020617",
    border: "1px solid #1e293b",
    color: "#f1f5f9",
    borderRadius: "12px",
    padding: "14px",
    fontSize: "0.95rem",
    outline: "none",
  },

  button: {
    background: "#38bdf8",
    border: "none",
    color: "#020617",
    padding: "12px",
    borderRadius: "10px",
    fontWeight: 600,
    cursor: "pointer",
  },
};