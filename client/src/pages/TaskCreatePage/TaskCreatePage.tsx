import { useNavigate } from "react-router-dom";
import { Banner } from "../../components/Banner/Banner";
import { TaskForm } from "./TaskForm/TaskForm";
import type { NavigationNoticeState } from "../../hooks/navigationNotice";
import { useSkills } from "../../hooks/skills";
import { useCreateTask } from "../../hooks/tasks";

export function TaskCreatePage() {
  const navigate = useNavigate();
  const skills = useSkills();
  const createTask = useCreateTask();

  return (
    <section>
      <h2>Create Task</h2>
      {skills.error && <Banner variant="error" message={`Could not load skills: ${skills.error.message}`} />}
      {!skills.error && !skills.data && <p>Loading…</p>}
      {skills.data && (
        <TaskForm
          skills={skills.data}
          submitting={createTask.isPending}
          submitError={createTask.error?.message}
          onSubmit={(input) =>
            createTask.mutate(input, {
              // The list refetches on success (see useCreateTask), so the new task is already there.
              onSuccess: () => navigate("/", { state: { notice: "Task created" } satisfies NavigationNoticeState }),
            })
          }
        />
      )}
    </section>
  );
}
