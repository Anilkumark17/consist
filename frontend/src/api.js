const SAMPLE_TRANSCRIPT = `Weekly sync — Sep 17

Anil: I'll take the API by Friday.
Rahul: I'll finish the design by Wednesday.
Priya: Let's go with Postgres for the action store. Agreed.
We decided to ship the landing page this week.
Action item: Rahul to send design mocks by Wed.
Anil will wire authentication by Friday.`;

const TECHNICAL =
  /request failed|failed query|drizzle|neon|postgres|sql|relation |column |syntax|econn|enoent|stack|at object|undefined|cannot read|internal server|status code|http\/|select |insert |update |delete /i;

export function friendlyMessage(error, fallback = 'Something went wrong. Please try again.') {
  const raw = String(error?.message || error || '').trim();
  if (!raw || TECHNICAL.test(raw)) return fallback;

  const known = [
    [/invalid email or password/i, 'Email or password is incorrect.'],
    [/already exists/i, 'That email is already registered.'],
    [/sign in required|session expired/i, 'Please sign in to continue.'],
    [/paste a longer/i, 'Paste a bit more of the meeting first.'],
    [/already been confirmed/i, 'This meeting is already confirmed.'],
    [/give the project/i, 'Give this a short project name.'],
    [/name must/i, 'Enter a name between 2 and 80 characters.'],
    [/password must/i, 'Use at least 8 characters for your password.'],
    [/enter a valid email/i, 'Enter a valid email address.'],
    [/could not process transcript/i, 'Could not read that transcript. Try again.'],
    [/could not confirm/i, 'Could not send this work. Try again.'],
    [/could not load (meetings|meeting|actions|projects|project|session|teammates)/i, 'Could not load your work. Refresh to try again.'],
    [/could not update/i, 'Could not update that task.'],
    [/could not create account/i, 'Could not create your account. Try again.'],
    [/could not sign in/i, 'Could not sign in. Try again.'],
    [/could not create project/i, 'Could not create that project. Try again.'],
    [/meeting not found/i, 'That meeting is no longer available.'],
    [/action not found/i, 'That task is no longer available.'],
    [/project not found/i, 'That project is no longer available.'],
    [/cannot add this transcript|cannot assign this work/i, 'You cannot add this to that project.'],
    [/choose a project first/i, 'Open a project, then add the meeting there.'],
    [/add .+ to the team first/i, 'Add missing people to the team before approving.'],
    [/could not add that person/i, 'Could not add that person. Try again.'],
    [/add this person to the team/i, 'Add this person to the team before moving the task.'],
    [/status must/i, 'Could not update that task.'],
    [/something went wrong/i, fallback],
  ];

  for (const [pattern, message] of known) {
    if (pattern.test(raw)) return message;
  }

  if (raw.length > 120 || /[{}\[\]\\]/.test(raw)) return fallback;
  return raw;
}

export async function api(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Check your connection and try again.');
  }

  if (!response.ok) {
    let message = '';
    try {
      const data = await response.json();
      message = data.error || '';
    } catch {
      message = '';
    }
    throw new Error(friendlyMessage(message || 'request failed'));
  }

  try {
    return await response.json();
  } catch {
    throw new Error('Something went wrong. Please try again.');
  }
}

export { SAMPLE_TRANSCRIPT };
