export default function TaskCard({ item, onStatus, columns = [], done = false }) {
  const status = item.status === 'completed' || item.status === 'done' || done;
  const meta = [item.owner, item.deadline, item.priority, item.projectName || item.meetingTitle]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={`task-card${status ? ' done' : ''}`}>
      <strong>{item.task}</strong>
      {item.detail && <p className="task-detail">{item.detail}</p>}
      <span>{meta}</span>
      {onStatus && columns.length > 0 && (
        <label className="status-picker">
          Move to
          <select
            aria-label={`Move ${item.task}`}
            value={item.status}
            onChange={(event) => onStatus(item, event.target.value)}
          >
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
