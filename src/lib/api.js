const API_BASE = "http://localhost:3001";

export async function startInterview(setup) {
  const res = await fetch(`${API_BASE}/api/interview/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(setup),
  });

  if (!res.ok) {
    throw new Error("Failed to start interview");
  }

  return res.json();
}

export async function submitAnswer(payload) {
  const res = await fetch(`${API_BASE}/api/interview/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Failed to submit answer");
  }

  return res.json();
}

export async function endInterview(sessionId) {
  const res = await fetch(`${API_BASE}/api/interview/end`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionId }),
  });

  if (!res.ok) {
    throw new Error("Failed to end interview");
  }

  return res.json();
}