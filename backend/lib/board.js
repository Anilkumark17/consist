export const BOARD = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'review', label: 'Review' },
  { id: 'completed', label: 'Completed' },
];

export const BOARD_STATUSES = BOARD.map((column) => column.id);
export const PRIORITIES = ['low', 'medium', 'high'];

export function normalizeBoardStatus(status) {
  if (status === 'done') return 'completed';
  if (status === 'open') return 'assigned';
  if (BOARD_STATUSES.includes(status)) return status;
  return 'backlog';
}

export function normalizePriority(value) {
  const key = String(value || '').toLowerCase();
  return PRIORITIES.includes(key) ? key : 'medium';
}

export function progressFromActions(actions) {
  const total = actions.length;
  const completed = actions.filter((item) => normalizeBoardStatus(item.status) === 'completed').length;
  return { total, completed, percent: total ? Math.round((completed / total) * 100) : 0 };
}

export function withBoardFields(item) {
  return {
    ...item,
    status: normalizeBoardStatus(item.status),
    priority: normalizePriority(item.priority),
  };
}
