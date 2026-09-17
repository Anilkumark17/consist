import { Router } from 'express';
import { and, desc, eq, ilike } from 'drizzle-orm';
import { db } from '../db/index.js';
import { actions, decisions, meetings, projectMembers, projects, users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { runMeetingAgent, extractWithHeuristics, uniqueNames } from '../agents/meetingAgent.js';
import { formatFollowUp, runFollowUpAgent } from '../agents/followUpAgent.js';
import { findUserByName, matchUsersByNames } from '../lib/matching.js';
import { canAccessProject } from '../lib/access.js';
import { normalizePriority, withBoardFields } from '../lib/board.js';

const router = Router();
router.use(requireAuth);

function defaultTitle() {
  return `Meeting · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function parseNames(value) {
  if (Array.isArray(value)) return uniqueNames(value);
  return uniqueNames(String(value || '').split(/[,;\n]+/));
}

function parseHeldAt(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function encodeParticipants(names) {
  return names.length ? JSON.stringify(names) : null;
}

function decodeParticipants(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? uniqueNames(parsed) : parseNames(value);
  } catch {
    return parseNames(value);
  }
}

async function loadTeam(projectId) {
  if (!projectId) return [];
  return db
    .select({
      id: projectMembers.id,
      name: projectMembers.name,
      role: projectMembers.role,
      userId: projectMembers.userId,
      email: users.email,
    })
    .from(projectMembers)
    .leftJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId));
}

function matchName(name, team) {
  const key = String(name || '').trim().toLowerCase();
  return team.find((member) => member.name.toLowerCase() === key) || null;
}

async function buildReview(meeting) {
  const [decisionRows, actionRows, team, project] = await Promise.all([
    db.select().from(decisions).where(eq(decisions.meetingId, meeting.id)),
    db.select().from(actions).where(eq(actions.meetingId, meeting.id)),
    loadTeam(meeting.projectId),
    meeting.projectId
      ? db.select().from(projects).where(eq(projects.id, meeting.projectId)).then((rows) => rows[0] || null)
      : Promise.resolve(null),
  ]);

  const extracted = extractWithHeuristics(meeting.transcript);
  const memberNames = uniqueNames([
    ...decodeParticipants(meeting.participants),
    ...extracted.members,
    ...actionRows.map((row) => row.owner),
  ]);
  const matches = await matchUsersByNames(memberNames);

  return {
    ...meeting,
    heldAt: meeting.heldAt,
    participants: decodeParticipants(meeting.participants),
    decisions: decisionRows,
    actions: actionRows.map(withBoardFields),
    project: project ? { id: project.id, name: project.name, members: team } : null,
    members: memberNames.map((name) => {
      const onTeam = matchName(name, team);
      const matchedUser = matches[name] || (onTeam?.userId ? { id: onTeam.userId, name: onTeam.name, email: onTeam.email } : null);
      return {
        name,
        onTeam: Boolean(onTeam),
        ready: Boolean(onTeam?.userId || matchedUser?.id),
        matchedUser: matchedUser || null,
      };
    }),
  };
}

router.get('/', async (req, res) => {
  try {
    const rows = await db
      .select({
        id: meetings.id,
        title: meetings.title,
        status: meetings.status,
        projectId: meetings.projectId,
        heldAt: meetings.heldAt,
        createdAt: meetings.createdAt,
      })
      .from(meetings)
      .where(eq(meetings.userId, req.user.userId))
      .orderBy(desc(meetings.createdAt));

    res.json({ meetings: rows });
  } catch (error) {
    console.error('List meetings failed:', error);
    res.status(500).json({ error: 'Could not load meetings' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    const allowed =
      meeting.userId === req.user.userId || (await canAccessProject(req.user.userId, meeting.projectId));
    if (!allowed) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({ meeting: await buildReview(meeting) });
  } catch (error) {
    console.error('Get meeting failed:', error);
    res.status(500).json({ error: 'Could not load meeting' });
  }
});

router.post('/', async (req, res) => {
  try {
    const transcript = String(req.body?.transcript || '').trim();
    const title = String(req.body?.title || '').trim() || defaultTitle();
    const projectId = req.body?.projectId ? Number(req.body.projectId) : null;
    const participants = parseNames(req.body?.participants);
    const heldAt = parseHeldAt(req.body?.date || req.body?.heldAt);

    if (transcript.length < 10) {
      return res.status(400).json({ error: 'Paste a longer meeting transcript' });
    }
    if (!projectId) {
      return res.status(400).json({ error: 'Choose a project first' });
    }
    if (!(await canAccessProject(req.user.userId, projectId))) {
      return res.status(403).json({ error: 'You cannot add this transcript to that project' });
    }

    const extracted = await runMeetingAgent(transcript);
    extracted.members = uniqueNames([...participants, ...extracted.members]);
    const followUps = runFollowUpAgent(extracted.actions);

    const [meeting] = await db
      .insert(meetings)
      .values({
        userId: req.user.userId,
        projectId,
        title,
        transcript,
        heldAt,
        participants: encodeParticipants(extracted.members),
        status: 'pending_review',
      })
      .returning();

    if (extracted.decisions.length) {
      await db
        .insert(decisions)
        .values(extracted.decisions.map((text) => ({ meetingId: meeting.id, text })));
    }

    if (followUps.length) {
      await db.insert(actions).values(
        followUps.map((item) => ({
          meetingId: meeting.id,
          projectId,
          owner: item.owner,
          task: item.task,
          detail: item.detail || null,
          deadline: item.deadline,
          priority: normalizePriority(item.priority),
          followUp: item.followUp,
          status: 'backlog',
          reviewStatus: 'pending',
        })),
      );
    }

    res.status(201).json({ meeting: await buildReview(meeting) });
  } catch (error) {
    console.error('Create meeting failed:', error);
    res.status(500).json({ error: 'Could not process transcript' });
  }
});

router.post('/:id/confirm', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);

    if (!meeting || meeting.userId !== req.user.userId) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    if (meeting.status === 'confirmed') {
      return res.status(409).json({ error: 'This transcript has already been confirmed' });
    }

    const [actor] = await db.select().from(users).where(eq(users.id, req.user.userId)).limit(1);
    let projectId = meeting.projectId || (req.body?.projectId ? Number(req.body.projectId) : null);

    if (projectId) {
      if (!(await canAccessProject(req.user.userId, projectId))) {
        return res.status(403).json({ error: 'You cannot assign this work to that project' });
      }
    } else {
      const projectName = String(req.body?.projectName || meeting.title || '').trim();
      if (projectName.length < 2) {
        return res.status(400).json({ error: 'Give the project a name' });
      }
      const [created] = await db
        .insert(projects)
        .values({ name: projectName, ownerId: req.user.userId })
        .returning();
      projectId = created.id;
    }

    const existingMembers = await db
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId));
    const existingNames = new Set(existingMembers.map((row) => row.name.toLowerCase()));

    async function upsertMember(name, userId, role = 'member') {
      const key = name.toLowerCase();
      if (existingNames.has(key)) {
        if (userId) {
          await db
            .update(projectMembers)
            .set({ userId })
            .where(and(eq(projectMembers.projectId, projectId), ilike(projectMembers.name, name)));
          const row = existingMembers.find((item) => item.name.toLowerCase() === key);
          if (row) row.userId = userId;
        }
        return;
      }
      existingNames.add(key);
      const [created] = await db.insert(projectMembers).values({ projectId, name, userId, role }).returning();
      existingMembers.push(created);
    }

    await upsertMember(actor.name, actor.id, 'owner');

    const memberInputs = Array.isArray(req.body?.members) ? req.body.members : [];
    for (const member of memberInputs) {
      if (member.include === false) continue;
      const name = String(member.name || '').trim();
      if (!name) continue;
      let userId = member.userId ? Number(member.userId) : null;
      if (!userId) {
        const matched = await findUserByName(name);
        userId = matched?.id || null;
      }
      await upsertMember(name, userId, userId === actor.id ? 'owner' : 'member');
    }

    const team = await loadTeam(projectId);
    const actionRows = await db.select().from(actions).where(eq(actions.meetingId, id));
    const inputById = new Map(
      (Array.isArray(req.body?.actions) ? req.body.actions : []).map((item) => [Number(item.id), item]),
    );

    const missing = [];
    for (const row of actionRows) {
      const input = inputById.get(row.id);
      const include = input ? input.include !== false : true;
      if (!include) continue;
      const owner = String(input?.owner || row.owner).trim();
      if (!owner || owner.toLowerCase() === 'unassigned') continue;
      if (!matchName(owner, team)) missing.push(owner);
    }
    if (missing.length) {
      return res.status(400).json({ error: `Add ${uniqueNames(missing).join(', ')} to the team first` });
    }

    for (const row of actionRows) {
      const input = inputById.get(row.id);
      const include = input ? input.include !== false : true;
      if (!include) {
        await db
          .update(actions)
          .set({ reviewStatus: 'rejected', projectId })
          .where(eq(actions.id, row.id));
        continue;
      }

      const owner = String(input?.owner || row.owner).trim();
      const task = String(input?.task || row.task).trim();
      const detail = String(input?.detail ?? row.detail ?? '').trim() || null;
      const deadline = input?.deadline === undefined ? row.deadline : input.deadline || null;
      const priority = normalizePriority(input?.priority ?? row.priority);
      const followUp = formatFollowUp({ owner, task, deadline });
      const teammate = matchName(owner, team);
      const assigneeId =
        (input?.assigneeId ? Number(input.assigneeId) : null) ||
        teammate?.userId ||
        (await findUserByName(owner))?.id ||
        null;

      await db
        .update(actions)
        .set({
          owner,
          task,
          detail,
          deadline,
          priority,
          followUp,
          projectId,
          assigneeId,
          status: assigneeId ? 'assigned' : 'backlog',
          reviewStatus: 'confirmed',
        })
        .where(eq(actions.id, row.id));
    }

    await db
      .update(meetings)
      .set({ status: 'confirmed', projectId })
      .where(eq(meetings.id, id));

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    res.json({
      meeting: await buildReview({ ...meeting, status: 'confirmed', projectId }),
      project,
    });
  } catch (error) {
    console.error('Confirm meeting failed:', error);
    res.status(500).json({ error: 'Could not confirm the review' });
  }
});

export default router;
