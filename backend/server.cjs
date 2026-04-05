require("dotenv").config();
const axios = require("axios");
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const sessions = new Map();
const QUESTION_COUNTS = {
  quick: 3,
  standard: 5,
  full: 7,
};


function safeParseJSON(text) {
  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(cleaned);
}

const STAGE_ORDER = ["intro", "background", "behavioral", "technical", "wrapup"];

const STAGE_LIMITS = {
  intro: 1,
  background: 1,
  behavioral: 1,
  technical: 2,
  wrapup: 1,
};

function getNextStage(currentStage) {
  const index = STAGE_ORDER.indexOf(currentStage);
  if (index === -1 || index === STAGE_ORDER.length - 1) {
    return "wrapup";
  }
  return STAGE_ORDER[index + 1];
}

function advanceStageIfNeeded(session) {
  const limits = getStageLimits(session.type);
  const limit = limits[session.stage] ?? 1;

  if (session.answersInStage >= limit) {
    session.stage = getNextStage(session.stage);
    session.answersInStage = 0;
  }
}

async function generateFirstQuestion(setup) {
  const prompt = `
You are a realistic interviewer for a ${setup.role} interview.

Interview type: ${setup.type}
Difficulty: ${setup.difficulty}

This is the very beginning of the interview.
Ask a natural opening question that eases the candidate in.

Rules:
- Do NOT ask about a specific project yet
- Do NOT ask a deep technical question yet
- Start with a normal opening interview question
- It should sound like the first 1-2 minutes of a real interview

Good examples:
- Tell me a little about yourself.
- Can you walk me through your background?
- What interested you in this role?
- Why did you decide to apply for this position?

Return only the question text.
`;

  const content = await callGroq([
    {
      role: "system",
      content: "You are a professional interviewer who starts interviews naturally and conversationally.",
    },
    {
      role: "user",
      content: prompt,
    },
  ]);

  return content.trim();
}

function getStageLimits(type) {
  if (type === "behavioral") {
    return {
      intro: 1,
      background: 1,
      behavioral: 3,
      technical: 1,
      wrapup: 1,
    };
  }

  if (type === "technical") {
    return {
      intro: 1,
      background: 1,
      behavioral: 1,
      technical: 3,
      wrapup: 1,
    };
  }

  // default (balanced)
  return {
    intro: 1,
    background: 1,
    behavioral: 2,
    technical: 2,
    wrapup: 1,
  };
}

async function generateNextQuestion(session, latestAnswer) {
  const nextStage = session.stage;

  const transcriptText = session.transcript
    .map((line) => `${line.speaker}: ${line.text}`)
    .join("\n");

  let stageInstruction = "";

  if (nextStage === "intro") {
    stageInstruction = `
    Ask a natural opening interview question.
    Keep it warm, simple, and conversational.
    Do not ask about a specific project yet.
    Examples:
    - Can you tell me a little about yourself?
    - Can you walk me through your background?
    `;
  } else if (nextStage === "background") {
    stageInstruction = `
    Ask about the candidate's interests, goals, or background.
    This should still feel early in the interview.
    Examples:
    - What got you interested in software engineering?
    - What kinds of roles are you most interested in?
    - What are you hoping to learn from your next internship?
    `;
  } else if (nextStage === "behavioral") {
    stageInstruction = `
    Ask one behavioral interview question.
    Examples:
    - Tell me about a time you faced a challenge.
    - Describe a time you worked through a problem on a team.
    - Tell me about a time something did not go as planned.
    `;
  } else if (nextStage === "technical") {
    stageInstruction = `
    Ask about a technical project, design decision, debugging story, or engineering challenge.
    Examples:
    - Can you walk me through a project you're proud of?
    - Tell me about a technical challenge you solved.
    - How did you make a key design decision in a recent project?
    `;
  } else {
    stageInstruction = `
    Ask a closing question to wrap up the interview naturally.
    Examples:
    - Is there anything else you'd like to add?
    - Is there a project or experience we did not get to that you'd like to mention?
    - Do you have any final thoughts before we wrap up?
    `;
  }

  const askedQuestionsText = session.askedQuestions.join("\n");

  const prompt = `
  You are conducting a realistic mock interview.

  Role: ${session.role}
  Type: ${session.type}
  Difficulty: ${session.difficulty}
  Current stage: ${nextStage}

  Questions already asked:
  ${askedQuestionsText}

  Conversation so far:
  ${transcriptText}

  Candidate's latest answer:
  ${latestAnswer}

  ${stageInstruction}

  Rules:
  - Ask exactly one question
  - Make it feel like a natural next step in the interview
  - Avoid repeating earlier questions
  - Keep the progression realistic and human
  - Return only the question text
  `;

  const content = await callGroq([
    {
      role: "system",
      content: "You are a professional interviewer who follows a realistic interview flow from intro to deeper discussion.",
    },
    {
      role: "user",
      content: prompt,
    },
  ]);

  return {
    question: content.trim(),
  };
}

async function generateAIFeedback(session) {
  const transcriptText = session.transcript
    .map((line) => `${line.speaker}: ${line.text}`)
    .join("\n");

  const prompt = `
Evaluate this mock interview for a ${session.role} candidate.

Interview type: ${session.type}
Difficulty: ${session.difficulty}

Transcript:
${transcriptText}

Return strict JSON with this shape:
{
  "overallScore": number,
  "communication": number,
  "clarity": number,
  "technicalDepth": number,
  "confidence": number,
  "strengths": ["...", "...", "..."],
  "improvements": ["...", "...", "..."],
  "summary": "..."
}

Scores should be between 0 and 100.
Be realistic and harsh when answers are weak.
Return JSON only.
`;

  const content = await callGroq([
    {
      role: "system",
      content: "You are an expert technical interviewer and career coach.",
    },
    {
      role: "user",
      content: prompt,
    },
  ]);

  return safeParseJSON(content);
}

function countWords(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function hasNumbers(text) {
  return /\d/.test(text);
}

async function callGroq(messages) {
  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.7,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.choices[0].message.content;
}

function hasStrongActionWords(text) {
  return /\b(built|implemented|designed|debugged|optimized|led|created|developed|improved|shipped|deployed)\b/i.test(
    text
  );
}

function isWeakAnswer(text) {
  const cleaned = text.trim().toLowerCase();

  const weakPhrases = [
    "no",
    "nope",
    "idk",
    "i don't know",
    "dont know",
    "not sure",
    "maybe",
    "n/a",
    "nothing",
    "yes",
    "ok",
    "nah",
    "pass",
  ];

  return weakPhrases.includes(cleaned) || countWords(cleaned) <= 2;
}

function scoreInterview(answers, type) {
  if (!answers.length) {
    return {
      overallScore: 40,
      communication: 40,
      clarity: 40,
      technicalDepth: 40,
      confidence: 40,
      strengths: ["Completed the interview session"],
      improvements: [
        "Provide fuller answers",
        "Use specific examples",
        "Explain your impact more clearly",
      ],
      summary:
        "The responses were too limited to fully evaluate interview performance.",
    };
  }

  let communication = 60;
  let clarity = 60;
  let technicalDepth = 60;
  let confidence = 60;

  let strengths = [];
  let improvements = [];

  const totalWords = answers.reduce((sum, answer) => sum + countWords(answer), 0);
  const avgWords = totalWords / answers.length;

  const numericAnswers = answers.filter(hasNumbers).length;
  const actionAnswers = answers.filter(hasStrongActionWords).length;
  const shortAnswers = answers.filter((a) => countWords(a) < 12).length;
  const weakAnswers = answers.filter(isWeakAnswer).length;
  const ultraShortAnswers = answers.filter((a) => countWords(a) < 3).length;

  if (avgWords > 40) {
    communication += 12;
    clarity += 8;
    strengths.push("Responses were reasonably developed");
  } else if (avgWords > 25) {
    communication += 7;
    clarity += 5;
  } else if (avgWords < 15) {
    communication -= 15;
    clarity -= 15;
    improvements.push("Give more complete answers instead of very short responses");
  }

  if (numericAnswers >= 1) {
    clarity += 8;
    strengths.push("Used specific details or measurable results");
  } else {
    improvements.push("Add measurable outcomes or concrete details");
  }

  if (actionAnswers >= 2) {
    technicalDepth += 12;
    confidence += 6;
    strengths.push("Showed ownership using strong action-oriented examples");
  } else {
    technicalDepth -= 8;
    improvements.push("Describe what you specifically built or changed");
  }

  if (shortAnswers >= 2) {
    confidence -= 10;
    clarity -= 8;
    improvements.push("Expand on your examples and explain your reasoning");
  }

  if (type === "Technical" && actionAnswers >= 2) {
    technicalDepth += 8;
  }

  if (strengths.length === 0) {
    strengths.push("Completed the mock interview flow successfully");
  }

  if (improvements.length === 0) {
    improvements.push("Keep making answers more concise and outcome-focused");
  }

  if (weakAnswers >= 1) {
  communication -= 25;
  clarity -= 25;
  confidence -= 25;
  improvements.push("Avoid one-word or non-substantive answers");
}

if (weakAnswers >= 2) {
  communication -= 20;
  clarity -= 20;
  technicalDepth -= 20;
  confidence -= 20;
  improvements.push("Engage with the question and provide actual examples");
}

if (weakAnswers === answers.length) {
  communication = 0;
  clarity = 0;
  technicalDepth = 0;
  confidence = 0;

  return {
    overallScore: 0,
    communication: 0,
    clarity: 0,
    technicalDepth: 0,
    confidence: 0,
    strengths: ["Completed the session"],
    improvements: [
      "Answer the questions directly",
      "Use complete sentences",
      "Include real examples and details",
    ],
    summary:
      "The responses did not provide enough substance to evaluate interview performance.",
  };
}

if (ultraShortAnswers === answers.length) {
  return {
    overallScore: 0,
    communication: 0,
    clarity: 0,
    technicalDepth: 0,
    confidence: 0,
    strengths: ["Completed the session"],
    improvements: [
      "Give complete answers",
      "Explain your thinking",
      "Use examples from projects or experience",
    ],
    summary:
      "The responses were too short to demonstrate interview readiness.",
  };
}

communication = Math.max(0, Math.min(95, communication));
  clarity = Math.max(0, Math.min(95, clarity));
  technicalDepth = Math.max(0, Math.min(95, technicalDepth));
  confidence = Math.max(0, Math.min(95, confidence));

  const overallScore = Math.round(
    (communication + clarity + technicalDepth + confidence) / 4
  );

  return {
    overallScore,
    communication,
    clarity,
    technicalDepth,
    confidence,
    strengths: [...new Set(strengths)].slice(0, 3),
    improvements: [...new Set(improvements)].slice(0, 3),
    summary:
      overallScore >= 85
        ? "Strong interview performance with clear examples and good detail."
        : overallScore >= 70
        ? "Solid foundation, but your answers would be stronger with more specifics and impact."
        : "Your answers need more detail, stronger examples, and clearer explanation of your contributions.",
  };
}

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/interview/start", async (req, res) => {
  const { role, type, difficulty, length } = req.body;
  const sessionId = crypto.randomUUID();
  const firstQuestion = await generateFirstQuestion({ role, type, difficulty });

const session = {
  sessionId,
  role,
  type,
  difficulty,
  stage: "intro",
  questionCount: 1,
  answersInStage: 0,
  askedQuestions: [firstQuestion],
  transcript: [{ speaker: "Interviewer", text: firstQuestion }],
  answers: [],
  numQuestions: QUESTION_COUNTS[length] || 3,
};

  sessions.set(sessionId, session);

  res.json({
  sessionId,
  question: firstQuestion,
});
});

app.post("/api/interview/respond", async (req, res) => {
  const { sessionId, answer } = req.body;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const trimmed = (answer || "").trim();
  if (!trimmed) {
    return res.status(400).json({ error: "Answer is required" });
  }

  session.answers.push(trimmed);
  session.transcript.push({ speaker: "You", text: trimmed });

  session.answersInStage += 1;
  advanceStageIfNeeded(session);

  const isLastQuestion = session.answers.length >= session.numQuestions;
  
  if (isLastQuestion) {
    return res.json({ done: true });
  }

  const result = await generateNextQuestion(session, trimmed);
  session.questionCount += 1;
  session.askedQuestions.push(result.question);

  session.transcript.push({
    speaker: "Interviewer",
    text: result.question,
  });

res.json({
  done: false,
  question: result.question,
  transcript: session.transcript,
});
});

app.post("/api/interview/end", async (req, res) => {
  const { sessionId } = req.body;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  let feedback;

    try {
      feedback = await generateAIFeedback(session);
    } catch (err) {
      feedback = scoreInterview(session.answers, session.type);
    }

  res.json({
    ...feedback,
    transcript: session.transcript,
    setup: {
      role: session.role,
      type: session.type,
      difficulty: session.difficulty,
    },
  });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});