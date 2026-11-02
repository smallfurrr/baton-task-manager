import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ErrorBanner } from "../../components/ErrorBanner";
import { NoticeBanner } from "../../components/NoticeBanner";
import { TaskTable } from "./TaskTable/TaskTable";
import { useDevelopers } from "../../hooks/developers";
import { useTasks, useUpdateTask } from "../../hooks/tasks";
import styles from "./TaskListPage.module.css";

/** Router state set by other pages to show a one-off message here. */
interface ListLocationState {
  notice?: string;
}

function readNotice(state: unknown): string | undefined {
  if (typeof state === "object" && state !== null && "notice" in state) {
    const { notice } = state as ListLocationState;
    return typeof notice === "string" ? notice : undefined;
  }
  return undefined;
}

export function TaskListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const tasks = useTasks();
  const developers = useDevelopers();
  const updateTask = useUpdateTask();

  // Show the message once, then clear it from history so a reload does not repeat it.
  const [notice] = useState(() => readNotice(location.state));
  useEffect(() => {
    if (readNotice(location.state)) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const loadError = tasks.error ?? developers.error;
  const pendingTaskId = updateTask.isPending ? updateTask.variables.id : null;
  const taskList = tasks.data;
  const developerList = developers.data;
  const loaded = taskList !== undefined && developerList !== undefined;

  return (
    <section>
      <div className={styles.heading}>
        <h2>Tasks</h2>
        <Link to="/tasks/new" className={styles.createLink}>
          Create task
        </Link>
      </div>
      {notice && <NoticeBanner message={notice} />}
      {updateTask.error && <ErrorBanner message={updateTask.error.message} />}
      {loadError && <ErrorBanner message={`Could not load tasks: ${loadError.message}`} />}
      {!loaded && !loadError && <p>Loading tasks…</p>}
      {loaded && taskList.length === 0 && (
        <p>
          No tasks yet. <Link to="/tasks/new">Create the first one</Link>.
        </p>
      )}
      {loaded && taskList.length > 0 && (
        <TaskTable
          tasks={taskList}
          developers={developerList}
          pendingTaskId={pendingTaskId}
          onUpdate={(id, changes) => updateTask.mutate({ id, changes })}
        />
      )}
    </section>
  );
}
