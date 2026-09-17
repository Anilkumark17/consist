import { shortenDeadline } from './meetingAgent.js';

export function formatFollowUp({ owner, task, deadline }) {
  const who = owner?.trim() || 'Unassigned';
  const what = task?.trim() || 'Follow-up';
  const when = shortenDeadline(deadline);
  return when ? `${who} → ${what} · ${when}` : `${who} → ${what}`;
}

export function runFollowUpAgent(actions) {
  return actions.map((action) => ({
    ...action,
    followUp: formatFollowUp(action),
  }));
}
