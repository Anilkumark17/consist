import 'dotenv/config';
import { runMeetingAgent } from '../agents/meetingAgent.js';
import { runFollowUpAgent } from '../agents/followUpAgent.js';

const transcript = `Weekly sync — Sep 17

Anil: I'll take the API by Friday.
Rahul: I'll finish the design by Wednesday.
Priya: Let's go with Postgres for the action store. Agreed.
We decided to ship the landing page this week.
Action item: Rahul to send design mocks by Wed.
Anil will wire authentication by Friday.`;

const extracted = await runMeetingAgent(transcript);
const actions = runFollowUpAgent(extracted.actions);
console.log(JSON.stringify({ members: extracted.members, decisions: extracted.decisions, actions }, null, 2));
