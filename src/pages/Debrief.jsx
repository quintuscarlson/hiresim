import { Link, useLocation, Navigate } from "react-router-dom";

export default function Debrief() {
  const location = useLocation();
  const data = location.state;

  if (!data) {
    return <Navigate to="/" replace />;
  }

  const {
    overallScore,
    communication,
    clarity,
    technicalDepth,
    confidence,
    strengths = [],
    improvements = [],
    summary,
    transcript = [],
    setup = {},
    role,
    type,
    length,
  } = data;

  const rawLength = setup.length || length || "";
  const rawRole = setup.role || role || "Not provided";
  const rawType = setup.type || type || "Not provided";

  const formattedLength = rawLength
    ? rawLength.charAt(0).toUpperCase() + rawLength.slice(1)
    : "Standard";

  const numericScore =
    typeof overallScore === "number"
      ? overallScore
      : parseInt(String(overallScore).replace(/[^\d]/g, ""), 10) || 0;

  const scoreTone =
    numericScore >= 85
      ? styles.scoreExcellent
      : numericScore >= 70
      ? styles.scoreGood
      : numericScore >= 50
      ? styles.scoreMedium
      : styles.scoreLow;

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Interview Complete</p>
            <h1 style={styles.title}>Your Feedback</h1>
            <p style={styles.subtitle}>
              Here’s a breakdown of how you performed and what to improve before
              your next round.
            </p>
          </div>

          <div style={styles.headerMeta}>
            <img src="/logo.png" alt="HireSim Logo" style={styles.logo} />
          </div>
        </div>

        <div style={styles.topGrid}>
          <div style={styles.scoreBox}>
            <p style={styles.scoreLabelTop}>Overall Score</p>
            <div style={{ ...styles.scoreCircle, ...scoreTone }}>
              <span style={styles.score}>{overallScore}</span>
            </div>
            <p style={styles.scoreSubtext}>
              {numericScore >= 85
                ? "Strong performance"
                : numericScore >= 70
                ? "Good foundation"
                : numericScore >= 50
                ? "Promising, with room to improve"
                : "Needs more practice"}
            </p>
          </div>

          <div style={styles.metaPanel}>
            <h2 style={styles.panelTitle}>Interview Setup</h2>
            <div style={styles.metaGrid}>
              <div style={styles.metaCard}>
                <p style={styles.metaLabel}>Role</p>
                <p style={styles.metaValue}>{rawRole}</p>
              </div>
              <div style={styles.metaCard}>
                <p style={styles.metaLabel}>Type</p>
                <p style={styles.metaValue}>{rawType}</p>
              </div>
              <div style={styles.metaCard}>
                <p style={styles.metaLabel}>Length</p>
                <p style={styles.metaValue}>{formattedLength}</p>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Communication</p>
            <h3 style={styles.statValue}>{communication}</h3>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Clarity</p>
            <h3 style={styles.statValue}>{clarity}</h3>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Technical Depth</p>
            <h3 style={styles.statValue}>{technicalDepth}</h3>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Confidence</p>
            <h3 style={styles.statValue}>{confidence}</h3>
          </div>
        </div>

        <div style={styles.summaryBox}>
          <h2 style={styles.sectionTitle}>Summary</h2>
          <p style={styles.summaryText}>
            {summary || "No summary was generated for this interview."}
          </p>
        </div>

        <div style={styles.twoCol}>
          <div style={styles.listBox}>
            <div style={styles.listHeader}>
              <span style={styles.listAccent}>✓</span>
              <h2 style={styles.sectionTitleNoMargin}>Strengths</h2>
            </div>

            {strengths.length > 0 ? (
              strengths.map((item, index) => (
                <div key={index} style={styles.listRow}>
                  <span style={styles.bulletGood}>•</span>
                  <p style={styles.listItem}>{item}</p>
                </div>
              ))
            ) : (
              <p style={styles.emptyText}>No strengths were provided.</p>
            )}
          </div>

          <div style={styles.listBox}>
            <div style={styles.listHeader}>
              <span style={styles.listAccent}>↗</span>
              <h2 style={styles.sectionTitleNoMargin}>Areas to Improve</h2>
            </div>

            {improvements.length > 0 ? (
              improvements.map((item, index) => (
                <div key={index} style={styles.listRow}>
                  <span style={styles.bulletImprove}>•</span>
                  <p style={styles.listItem}>{item}</p>
                </div>
              ))
            ) : (
              <p style={styles.emptyText}>No improvement notes were provided.</p>
            )}
          </div>
        </div>

        <div style={styles.transcriptBox}>
          <div style={styles.transcriptHeader}>
            <h2 style={styles.sectionTitleNoMargin}>Final Transcript</h2>
            <span style={styles.transcriptPill}>{transcript.length} entries</span>
          </div>

          <div style={styles.transcriptList}>
            {transcript.length > 0 ? (
              transcript.map((line, index) => {
                const isUser = line.speaker === "You";

                return (
                  <div
                    key={index}
                    style={
                      isUser ? styles.userBubbleWrap : styles.botBubbleWrap
                    }
                  >
                    <div style={isUser ? styles.userBubble : styles.botBubble}>
                      <p style={styles.bubbleSpeaker}>{line.speaker}</p>
                      <p style={styles.bubbleText}>{line.text}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p style={styles.emptyText}>No transcript available.</p>
            )}
          </div>
        </div>

        <div style={styles.actionRow}>
          <Link to="/" style={styles.primaryButton}>
            Back Home
          </Link>
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
    maxWidth: "1100px",
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

  headerMeta: {
    display: "flex",
    alignItems: "center",
  },

  logo: {
    width: "48px",
    height: "48px",
    objectFit: "contain",
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
    fontSize: "2.4rem",
    color: "#f8fafc",
  },

  subtitle: {
    margin: 0,
    color: "#94a3b8",
    lineHeight: 1.6,
    maxWidth: "700px",
  },

  topGrid: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: "18px",
    marginBottom: "20px",
  },

  scoreBox: {
    borderRadius: "24px",
    padding: "24px",
    background: "linear-gradient(135deg, #1d4ed8 0%, #0f172a 100%)",
    border: "1px solid rgba(96, 165, 250, 0.28)",
    boxShadow: "0 14px 32px rgba(29, 78, 216, 0.22)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "260px",
  },

  scoreLabelTop: {
    margin: 0,
    color: "#bfdbfe",
    fontSize: "0.85rem",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 700,
  },

  scoreCircle: {
    width: "150px",
    height: "150px",
    borderRadius: "999px",
    display: "grid",
    placeItems: "center",
    marginTop: "16px",
    marginBottom: "14px",
    border: "1px solid rgba(255,255,255,0.15)",
  },

  scoreExcellent: {
    background: "radial-gradient(circle, rgba(34,197,94,0.28), rgba(15,23,42,0.2))",
  },

  scoreGood: {
    background: "radial-gradient(circle, rgba(96,165,250,0.26), rgba(15,23,42,0.2))",
  },

  scoreMedium: {
    background: "radial-gradient(circle, rgba(250,204,21,0.22), rgba(15,23,42,0.2))",
  },

  scoreLow: {
    background: "radial-gradient(circle, rgba(248,113,113,0.22), rgba(15,23,42,0.2))",
  },

  score: {
    color: "#f8fafc",
    fontSize: "3rem",
    fontWeight: 800,
    lineHeight: 1,
  },

  scoreSubtext: {
    margin: 0,
    color: "#dbeafe",
    fontSize: "0.95rem",
    textAlign: "center",
  },

  metaPanel: {
    borderRadius: "24px",
    padding: "22px",
    background: "rgba(2, 6, 23, 0.68)",
    border: "1px solid rgba(148, 163, 184, 0.14)",
  },

  panelTitle: {
    marginTop: 0,
    marginBottom: "16px",
    color: "#f8fafc",
    fontSize: "1.1rem",
  },

  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px",
  },

  metaCard: {
    borderRadius: "18px",
    padding: "16px",
    background: "rgba(15, 23, 42, 0.95)",
    border: "1px solid rgba(96, 165, 250, 0.14)",
  },

  metaLabel: {
    margin: 0,
    color: "#60a5fa",
    fontSize: "0.8rem",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 700,
  },

  metaValue: {
    margin: "8px 0 0 0",
    color: "#f8fafc",
    fontSize: "1rem",
    fontWeight: 600,
    lineHeight: 1.4,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "14px",
    marginBottom: "20px",
  },

  statCard: {
    padding: "18px",
    borderRadius: "18px",
    background: "rgba(2, 6, 23, 0.65)",
    border: "1px solid rgba(148, 163, 184, 0.14)",
  },

  statLabel: {
    margin: 0,
    color: "#93c5fd",
    fontSize: "0.85rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  statValue: {
    margin: "10px 0 0 0",
    fontSize: "1.8rem",
    color: "#f8fafc",
  },

  summaryBox: {
    marginBottom: "20px",
    padding: "22px",
    borderRadius: "20px",
    background: "rgba(2, 6, 23, 0.72)",
    border: "1px solid rgba(148, 163, 184, 0.14)",
  },

  sectionTitle: {
    marginTop: 0,
    marginBottom: "12px",
    fontSize: "1.1rem",
    color: "#f8fafc",
  },

  sectionTitleNoMargin: {
    margin: 0,
    fontSize: "1.1rem",
    color: "#f8fafc",
  },

  summaryText: {
    margin: 0,
    color: "#cbd5e1",
    fontSize: "1rem",
    lineHeight: 1.7,
  },

  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "20px",
  },

  listBox: {
    padding: "22px",
    borderRadius: "20px",
    background: "rgba(2, 6, 23, 0.72)",
    border: "1px solid rgba(148, 163, 184, 0.14)",
  },

  listHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "16px",
  },

  listAccent: {
    width: "28px",
    height: "28px",
    borderRadius: "999px",
    display: "grid",
    placeItems: "center",
    background: "rgba(37, 99, 235, 0.18)",
    color: "#93c5fd",
    fontWeight: 800,
    flexShrink: 0,
  },

  listRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    marginBottom: "12px",
  },

  bulletGood: {
    color: "#34d399",
    fontWeight: 800,
    lineHeight: 1.4,
  },

  bulletImprove: {
    color: "#fbbf24",
    fontWeight: 800,
    lineHeight: 1.4,
  },

  listItem: {
    margin: 0,
    color: "#e2e8f0",
    lineHeight: 1.6,
  },

  emptyText: {
    margin: 0,
    color: "#94a3b8",
    lineHeight: 1.6,
  },

  transcriptBox: {
    marginBottom: "26px",
    padding: "22px",
    borderRadius: "20px",
    background: "rgba(2, 6, 23, 0.72)",
    border: "1px solid rgba(148, 163, 184, 0.14)",
    maxHeight: "420px",
    overflowY: "auto",
  },

  transcriptHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },

  transcriptPill: {
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(30, 41, 59, 0.9)",
    border: "1px solid rgba(96, 165, 250, 0.2)",
    color: "#bfdbfe",
    fontSize: "0.85rem",
    fontWeight: 700,
  },

  transcriptList: {
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

  actionRow: {
    display: "flex",
    justifyContent: "flex-start",
    marginTop: "4px",
  },

  primaryButton: {
    display: "inline-block",
    background: "linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)",
    color: "#eff6ff",
    padding: "14px 22px",
    borderRadius: "12px",
    fontWeight: 700,
    textDecoration: "none",
    boxShadow: "0 10px 24px rgba(37, 99, 235, 0.25)",
  },
};
