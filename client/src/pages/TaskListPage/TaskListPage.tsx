import { Link } from "react-router-dom";
import { Banner } from "../../components/Banner/Banner";
import { buttonClassName } from "../../components/Button/Button";
import { TaskTable } from "./TaskTable/TaskTable";
import { useDevelopers } from "../../hooks/developers";
import { useNavigationNotice } from "../../hooks/navigationNotice";
import { useTasks, useUpdateTask } from "../../hooks/tasks";
import styles from "./TaskListPage.module.css";

export function TaskListPage() {
  const notice = useNavigationNotice();
  const tasks = useTasks();
  const developers = useDevelopers();
  const updateTask = useUpdateTask();

  const loadError = tasks.error ?? developers.error;
  const pendingTaskId = updateTask.isPending ? updateTask.variables.id : null;
  const taskList = tasks.data;
  const developerList = developers.data;
  const loaded = taskList !== undefined && developerList !== undefined;

  return (
    <section>
      <div className={styles.heading}>
        <h2>Tasks</h2>
        <Link to="/tasks/new" className={buttonClassName("primary")}>
          Create task
        </Link>
      </div>
      {notice && <Banner variant="notice" message={notice} />}
      {updateTask.error && <Banner variant="error" message={updateTask.error.message} />}
      {loadError && <Banner variant="error" message={`Could not load tasks: ${loadError.message}`} />}
      {!loaded && !loadError && <p className={styles.status}>Loading tasks…</p>}
      {loaded && taskList.length === 0 && (
        <p className={styles.empty}>
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
