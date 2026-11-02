import { useNavigate } from "react-router-dom";
import { ErrorBanner } from "../components/ErrorBanner";
import { TaskForm } from "../components/TaskForm";
import { useSkills } from "../hooks/skills";
import { useCreateTask } from "../hooks/tasks";

export function TaskCreatePage() {
  const navigate = useNavigate();
  const skills = useSkills();
  const createTask = useCreateTask();

  function renderBody() {
    if (skills.error) return <ErrorBanner message={`Could not load skills: ${skills.error.message}`} />;
    if (!skills.data) return <p>Loading…</p>;
    return (
      <TaskForm
        skills={skills.data}
        submitting={createTask.isPending}
        submitError={createTask.error?.message}
        onSubmit={(input) =>
          createTask.mutate(input, {
            // The list refetches on success (see useCreateTask), so the new task is already there.
            onSuccess: () => navigate("/", { state: { notice: "Task created" } }),
          })
        }
      />
    );
  }

  return (
    <section>
      <h2>Create Task</h2>
      {renderBody()}
    </section>
  );
}
