const WEEKDAY_SHORT = {
  monday: 'Mon',
  mon: 'Mon',
  tuesday: 'Tue',
  tue: 'Tue',
  tues: 'Tue',
  wednesday: 'Wed',
  wed: 'Wed',
  thursday: 'Thu',
  thu: 'Thu',
  thur: 'Thu',
  thurs: 'Thu',
  friday: 'Fri',
  fri: 'Fri',
  saturday: 'Sat',
  sat: 'Sat',
  sunday: 'Sun',
  sun: 'Sun',
};

const DEADLINE_RE =
  /\b(?:by|before|due(?:\s+on)?)\s+((?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|eod|eow|eom|end of day|end of week)|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i;

const FIRST_PERSON_RE =
  /^(?:i(?:'ll| will| can| am going to)|i'm going to|i need to)\s+(.+)/i;

const THIRD_PERSON_RE =
  /^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+(?:will|to|should|needs to|is going to)\s+(.+)/;

const ASSIGN_RE =
  /^(?:assign(?:ed)?|give)\s+(.+?)\s+to\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i;

const ACTION_PREFIX_RE = /^(?:action item|ai|todo|follow[- ]?up)\s*[:\-]\s*/i;

const DECISION_RE =
  /(?:we\s+(?:decided|agreed)|decided(?:\s+to)?|agreed(?:\s+to|\s+that)?|decision\s*[:\-]|going with|we'll go with|let'?s (?:go with|use|decide on))\s+(.+)/i;

const FILLER_TAIL_RE =
  /\s+(?:and\s+)?(?:have\s+(?:it|that)\s+)?ready(?:\s+to\s+go)?$/i;

function shortenDeadline(raw) {
  if (!raw) return null;
  const value = String(raw)
    .replace(/^(?:by|before|due(?:\s+on)?)\s+/i, '')
    .trim();
  const prefix = /^next\s+/i.test(value) ? 'next ' : '';
  const key = value.toLowerCase().replace(/^next\s+/, '');
  if (['eod', 'end of day'].includes(key)) return 'EOD';
  if (['eow', 'end of week'].includes(key)) return 'EOW';
  if (WEEKDAY_SHORT[key]) {
    const canonical = key.length <= 4 ? WEEKDAY_SHORT[key] : key.charAt(0).toUpperCase() + key.slice(1);
    return prefix ? `next ${canonical}` : canonical;
  }
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractDeadline(text) {
  const match = text.match(DEADLINE_RE);
  if (!match) return { deadline: null, rest: text };
  return {
    deadline: shortenDeadline(match[1]),
    rest: text.replace(match[0], ' ').replace(/\s+/g, ' ').trim(),
  };
}

function polishTask(task) {
  let t = String(task || '')
    .replace(/\s+/g, ' ')
    .replace(/[.?!]+$/g, '')
    .trim();

  t = t.replace(/^(?:i(?:'ll| will| can| am going to)|i'm going to|i need to)\s+/i, '');
  t = t.replace(/^(?:please\s+)/i, '');
  t = t.replace(FILLER_TAIL_RE, '');
  t = t.replace(/\s+and\s+have\s+(?:it|that)\s*$/i, '');

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 12) t = words.slice(0, 12).join(' ');
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function polishDetail(detail) {
  const value = String(detail || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!value) return null;
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/[.?!]+$/g, '') + '.';
}

function stripActionPrefix(text) {
  return text.replace(ACTION_PREFIX_RE, '').trim();
}

function parseUtterances(transcript) {
  const lines = String(transcript)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const utterances = [];
  let speaker = null;

  for (const line of lines) {
    const headed = line.match(/^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s*[:\-]\s*(.+)$/);
    if (headed) {
      speaker = headed[1];
      utterances.push({ speaker, text: headed[2].trim() });
      continue;
    }
    utterances.push({ speaker, text: line });
  }

  return utterances;
}

function extractDecision(text) {
  const match = text.match(DECISION_RE);
  if (!match) return null;
  let body = match[1]
    .replace(/\b(?:everyone\s+)?agreed\.?$/i, '')
    .replace(/[.?!]+$/g, '')
    .trim();
  body = body.replace(/^(?:to\s+)/i, '');
  if (!body) return null;
  return body.charAt(0).toUpperCase() + body.slice(1);
}

function extractAction(text, speaker) {
  const prefixed = ACTION_PREFIX_RE.test(text);
  const cleaned = stripActionPrefix(text);
  const { deadline, rest } = extractDeadline(cleaned);

  const assign = rest.match(ASSIGN_RE);
  if (assign) {
    return {
      owner: assign[2],
      task: polishTask(assign[1]),
      deadline,
    };
  }

  const third = rest.match(THIRD_PERSON_RE);
  if (third) {
    return {
      owner: third[1],
      task: polishTask(third[2]),
      deadline,
    };
  }

  const first = rest.match(FIRST_PERSON_RE);
  if (first && speaker) {
    return {
      owner: speaker,
      task: polishTask(first[1]),
      deadline,
    };
  }

  if (prefixed && speaker) {
    return {
      owner: speaker,
      task: polishTask(rest),
      deadline,
    };
  }

  return null;
}

function extractWithHeuristics(transcript) {
  const utterances = parseUtterances(transcript);
  const decisions = [];
  const actions = [];
  const seen = new Set();

  for (const { speaker, text } of utterances) {
    const decision = extractDecision(text);
    if (decision && !seen.has(`d:${decision.toLowerCase()}`)) {
      seen.add(`d:${decision.toLowerCase()}`);
      decisions.push(decision);
    }

    const action = extractAction(text, speaker);
    if (!action) continue;
    const key = `${action.owner}|${action.task}|${action.deadline || ''}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push({ ...action, priority: inferPriority(text) });
  }

  return { decisions, actions, members: collectMembers(utterances, actions) };
}

function collectMembers(utterances, actionItems) {
  const names = [];
  for (const { speaker } of utterances) {
    if (speaker) names.push(speaker);
  }
  for (const action of actionItems) {
    if (action.owner) names.push(action.owner);
  }
  return uniqueNames(names);
}

function inferPriority(text) {
  const value = String(text || '');
  if (/\b(urgent|asap|today|critical|high priority)\b/i.test(value)) return 'high';
  if (/\b(later|whenever|low priority|nice to have)\b/i.test(value)) return 'low';
  return 'medium';
}

function uniqueNames(names) {
  const seen = new Set();
  const out = [];
  for (const raw of names) {
    const name = String(raw || '').trim();
    if (!name || name.toLowerCase() === 'unassigned') continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function normalizeExtraction(payload) {
  const decisions = Array.isArray(payload?.decisions)
    ? payload.decisions.map((d) => String(d).trim()).filter(Boolean)
    : [];

  const actionItems = Array.isArray(payload?.actions)
    ? payload.actions
        .map((item) => ({
          owner: String(item.owner || 'Unassigned').trim() || 'Unassigned',
          task: polishTask(item.task || item.title || item.action || ''),
          detail: polishDetail(item.detail || item.summary || ''),
          deadline: shortenDeadline(item.deadline || item.due || null),
          priority: normalizePriority(item.priority),
        }))
        .filter((item) => item.task)
    : [];

  const members = uniqueNames([
    ...(Array.isArray(payload?.members) ? payload.members : []),
    ...actionItems.map((item) => item.owner),
  ]);

  return { decisions, actions: actionItems, members };
}

function normalizePriority(value) {
  const key = String(value || '').toLowerCase();
  if (['low', 'medium', 'high'].includes(key)) return key;
  return 'medium';
}

const GROQ_SYSTEM = `You are Consist's meeting writer. Read the transcript and turn it into clean dashboard work a teammate would actually want to see.

Write in your own words. Never paste the speaker's line back.

Return JSON only:
{
  "members": ["First names"],
  "decisions": ["Declarative outcomes"],
  "actions": [
    {
      "owner": "First name",
      "task": "Imperative title, 4-10 words",
      "detail": "One original sentence of context. Do not repeat the task or the spoken line.",
      "deadline": "Friday or null",
      "priority": "low | medium | high"
    }
  ]
}

Rules:
- Task starts with a verb and names the deliverable: "Deliver the API", "Send design mocks", "Wire authentication".
- Merge the same person's duplicate commitments into one task when they are the same outcome.
- Keep distinct outcomes separate (API vs authentication stay separate).
- Decisions are facts: "Use Postgres for the action store." not "Let's go with...".
- Details add context, not a paraphrase of the title. Example: "Owns backend delivery for the weekly launch."
- Keep first names exactly as spoken.
- Deadlines stay human: Friday, Wednesday, EOD.
- Priority is medium unless the transcript is clearly urgent (high) or explicitly later (low).
- Unknown owner: Unassigned.`;

function parseModelJson(content) {
  const trimmed = String(content || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new Error('Model did not return JSON');
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

async function extractWithGroq(transcript) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: GROQ_SYSTEM },
        {
          role: 'user',
          content: `Turn this meeting transcript into customized dashboard work.\n\n${transcript}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Groq extraction failed (${response.status}): ${errBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  return normalizeExtraction(parseModelJson(content));
}

export async function runMeetingAgent(transcript) {
  try {
    const groq = await extractWithGroq(transcript);
    if (groq && (groq.actions.length || groq.decisions.length)) return groq;
  } catch (error) {
    console.warn('Meeting agent Groq fallback:', error.message);
  }
  return extractWithHeuristics(transcript);
}

export { polishTask as compressTask, extractWithHeuristics, shortenDeadline, uniqueNames };
