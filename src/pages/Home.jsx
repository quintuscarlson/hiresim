import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { startInterview } from "../lib/api";

export default function Home() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    role: "Software Engineering Intern",
    type: "Behavioral",
    length: "quick",
    mode: "typed",
  });

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleStart() {
    try {
      let micGranted = false;
      let cameraGranted = false;

      if (form.mode === "voice" || form.mode === "video") {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert("Your browser does not support microphone/camera access.");
          return;
        }

        const constraints =
          form.mode === "video"
            ? {
                audio: true,
                video: {
                  facingMode: "user",
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
              }
            : { audio: true };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        micGranted = true;
        cameraGranted = form.mode === "video";

        stream.getTracks().forEach((track) => track.stop());
      }

      const data = await startInterview(form);

      const routeMap = {
        typed: "/interview/typed",
        voice: "/interview/voice",
        video: "/interview/video",
      };

      navigate(routeMap[form.mode] || "/interview/typed", {
        state: {
          setup: form,
          sessionId: data.sessionId,
          question: data.question,
          micGranted,
          cameraGranted,
        },
      });
    } catch (error) {
      console.error("Start interview error:", error);

      if (form.mode === "voice" || form.mode === "video") {
        if (error.name === "NotAllowedError") {
          alert(
            form.mode === "video"
              ? "Camera or microphone access was blocked. In Safari, allow both camera and microphone for this site."
              : "Microphone access was blocked. In Safari, allow microphone for this site."
          );
        } else if (error.name === "NotFoundError") {
          alert(
            form.mode === "video"
              ? "A camera or microphone could not be found on this device."
              : "No microphone was found on this device."
          );
        } else {
          alert(
            form.mode === "video"
              ? "Could not access camera and microphone."
              : "Could not access microphone."
          );
        }
      } else {
        alert("Could not start interview.");
      }
    }
  }

  const estimatedTime =
    form.length === "quick"
      ? "2 min"
      : form.length === "standard"
      ? "5 min"
      : "10 min";

  const selectedModeLabel =
    form.mode === "typed"
      ? "Typed"
      : form.mode === "voice"
      ? "Voice"
      : "Video";

  return (
    <main style={styles.page}>
      <div style={styles.backgroundGlowOne} />
      <div style={styles.backgroundGlowTwo} />

      <section style={styles.shell}>
        <div style={styles.topBar}>
          <div style={styles.logoGroup}>
            <img
              src="/logo.png"
              alt="HireSim logo"
              style={styles.logo}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />

            <div style={styles.brandTextWrap}>
              <div style={styles.brandRow}>
                <h2 style={styles.brandName}>HireSim</h2>
                <span style={styles.betaBadge}>AI Mock Interviewer</span>
              </div>

              <p style={styles.brandTagline}>
                Practice behavioral, technical, voice, and video interviews in
                one polished workspace.
              </p>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.hero}>
            <p style={styles.eyebrow}>Mock interviews that feel more real</p>
            <h1 style={styles.title}>
              Practice like you’re already in the interview.
            </h1>
            <p style={styles.text}>
              Train for behavioral and technical interviews with typed, voice,
              or video sessions.
            </p>
          </div>

          <form style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Target Role</label>
              <input
                name="role"
                value={form.role}
                onChange={handleChange}
                placeholder="Software Engineering Intern"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Interview Mode</label>
              <div style={styles.selectWrap}>
                <select
                  name="mode"
                  value={form.mode}
                  onChange={handleChange}
                  style={styles.select}
                >
                  <option value="typed">Typed Interview</option>
                  <option value="voice">Voice Interview</option>
                  <option value="video">Video Interview</option>
                </select>
                <span style={styles.selectArrow}>⌄</span>
              </div>
            </div>

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Interview Emphasis</label>
                <div style={styles.selectWrap}>
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    style={styles.select}
                  >
                    <option value="Behavioral">Behavioral</option>
                    <option value="Technical">Technical</option>
                  </select>
                  <span style={styles.selectArrow}>⌄</span>
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Interview Length</label>
                <div style={styles.selectWrap}>
                  <select
                    name="length"
                    value={form.length}
                    onChange={handleChange}
                    style={styles.select}
                  >
                    <option value="quick">Quick (2–3 questions)</option>
                    <option value="standard">Standard (4–5 questions)</option>
                    <option value="full">Full (6–7 questions)</option>
                  </select>
                  <span style={styles.selectArrow}>⌄</span>
                </div>
              </div>
            </div>

            <div style={styles.modePreviewRow}>
              <div style={styles.modePreview}>
                <span style={styles.modePreviewLabel}>Selected Mode</span>
                <span style={styles.modePreviewValue}>{selectedModeLabel}</span>
              </div>

              <div style={styles.modePreview}>
                <span style={styles.modePreviewLabel}>Estimated Time</span>
                <span style={styles.modePreviewValue}>{estimatedTime}</span>
              </div>
            </div>

            <button type="button" onClick={handleStart} style={styles.button}>
              Start Interview
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    position: "relative",
    overflow: "hidden",
    background:
      "radial-gradient(circle at top, #13294b 0%, #0f172a 38%, #020617 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  backgroundGlowOne: {
    position: "absolute",
    top: "-140px",
    left: "-120px",
    width: "360px",
    height: "360px",
    borderRadius: "50%",
    background: "rgba(37, 99, 235, 0.16)",
    filter: "blur(100px)",
    pointerEvents: "none",
  },

  backgroundGlowTwo: {
    position: "absolute",
    bottom: "-160px",
    right: "-120px",
    width: "420px",
    height: "420px",
    borderRadius: "50%",
    background: "rgba(59, 130, 246, 0.12)",
    filter: "blur(110px)",
    pointerEvents: "none",
  },

  shell: {
    width: "100%",
    maxWidth: "920px",
    position: "relative",
    zIndex: 1,
  },

  topBar: {
    marginBottom: "22px",
    padding: "20px 24px",
    borderRadius: "24px",
    background: "rgba(15, 23, 42, 0.74)",
    border: "1px solid rgba(148, 163, 184, 0.14)",
    backdropFilter: "blur(16px)",
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.28)",
  },

  logoGroup: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
  },

  logo: {
    width: "72px",
    height: "72px",
    objectFit: "contain",
    borderRadius: "18px",
    flexShrink: 0,
  },

  brandTextWrap: {
    minWidth: 0,
  },

  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },

  brandName: {
    margin: 0,
    color: "#f8fafc",
    fontSize: "1.9rem",
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: "-0.02em",
  },

  betaBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(59, 130, 246, 0.16)",
    border: "1px solid rgba(96, 165, 250, 0.24)",
    color: "#93c5fd",
    fontSize: "0.78rem",
    fontWeight: 700,
    letterSpacing: "0.03em",
  },

  brandTagline: {
    margin: "8px 0 0 0",
    color: "#94a3b8",
    fontSize: "0.98rem",
    lineHeight: 1.5,
    maxWidth: "640px",
  },

  card: {
    width: "100%",
    background: "rgba(15, 23, 42, 0.8)",
    border: "1px solid rgba(148, 163, 184, 0.14)",
    borderRadius: "30px",
    padding: "38px",
    boxShadow: "0 30px 70px rgba(0, 0, 0, 0.45)",
    backdropFilter: "blur(18px)",
  },

  hero: {
    marginBottom: "28px",
  },

  eyebrow: {
    margin: 0,
    fontSize: "0.82rem",
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#60a5fa",
  },

  title: {
    marginTop: "14px",
    marginBottom: "14px",
    fontSize: "clamp(2.4rem, 5vw, 4.2rem)",
    lineHeight: 0.98,
    color: "#f8fafc",
    fontWeight: 800,
    letterSpacing: "-0.04em",
    maxWidth: "760px",
  },

  text: {
    margin: 0,
    fontSize: "1.05rem",
    lineHeight: 1.7,
    color: "#cbd5e1",
    maxWidth: "700px",
  },

  form: {
    display: "grid",
    gap: "18px",
  },

  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },

  field: {
    display: "grid",
    gap: "8px",
  },

  label: {
    fontSize: "0.95rem",
    fontWeight: 600,
    color: "#e2e8f0",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    borderRadius: "16px",
    padding: "15px 16px",
    fontSize: "1rem",
    background: "rgba(15, 23, 42, 0.96)",
    color: "#f8fafc",
    outline: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
  },

  selectWrap: {
    position: "relative",
  },

  select: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    borderRadius: "16px",
    padding: "15px 44px 15px 16px",
    fontSize: "1rem",
    background: "rgba(15, 23, 42, 0.96)",
    color: "#f8fafc",
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
    cursor: "pointer",
  },

  selectArrow: {
    position: "absolute",
    right: "16px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#94a3b8",
    fontSize: "1rem",
    pointerEvents: "none",
  },

  modePreviewRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },

  modePreview: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "16px",
    borderRadius: "18px",
    background: "rgba(30, 41, 59, 0.72)",
    border: "1px solid rgba(148, 163, 184, 0.12)",
  },

  modePreviewLabel: {
    fontSize: "0.78rem",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#94a3b8",
    fontWeight: 700,
  },

  modePreviewValue: {
    fontSize: "1.3rem",
    color: "#f8fafc",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },

  button: {
    marginTop: "8px",
    border: "none",
    background: "linear-gradient(135deg, #2563eb, #3b82f6)",
    color: "#ffffff",
    padding: "16px 22px",
    borderRadius: "16px",
    fontWeight: 700,
    fontSize: "1rem",
    cursor: "pointer",
    boxShadow: "0 18px 32px rgba(37, 99, 235, 0.35)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  },
};