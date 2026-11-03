import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closePool, getPool } from "../db/pool.js";
import { seed } from "../db/seed.js";
import {
  IncompleteSubtasksError,
  InvalidReferenceError,
  NotFoundError,
  SkillMismatchError,
  ValidationError,
} from "../errors.js";
import { resetDatabase } from "../test/db.js";
import { fakeClassifier } from "../test/fakeClassifier.js";
import { idOf, taskCount } from "../test/fixtures.js";
import { createTask, getTask, updateTask } from "./taskService.js";

function assignTask(taskId: number, assigneeId: number | null) {
  return updateTask(taskId, { assigneeId });
}

async function taskRequiring(...skillNames: string[]): Promise<number> {
  const skillIds = await Promise.all(skillNames.map((name) => idOf("skills", name)));
  return (await createTask({ title: `Needs ${skillNames.join("+") || "nothing"}`, skillIds })).id;
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetDatabase(getPool());
  await seed(getPool());
});

afterAll(closePool);

describe("assignTask: skill rule", () => {
  it("lets Carol (Frontend + Backend) take a Frontend + Backend task", async () => {
    const taskId = await taskRequiring("Frontend", "Backend");
    const carol = await idOf("developers", "Carol");

    const task = await assignTask(taskId, carol);

    expect(task.assignee).toEqual({ id: carol, name: "Carol" });
  });

  it("lets a developer take a task requiring one skill they hold", async () => {
    const task = await assignTask(await taskRequiring("Backend"), await idOf("developers", "Bob"));

    expect(task.assignee?.name).toBe("Bob");
  });

  it("lets a developer with extra skills take a single-skill task", async () => {
    const task = await assignTask(await taskRequiring("Frontend"), await idOf("developers", "Carol"));

    expect(task.assignee?.name).toBe("Carol");
  });

  it("rejects Alice (Frontend only) on a Frontend + Backend task, naming the missing skill", async () => {
    const taskId = await taskRequiring("Frontend", "Backend");
    const alice = await idOf("developers", "Alice");

    const error = await assignTask(taskId, alice).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SkillMismatchError);
    expect((error as SkillMismatchError).message).toContain("Alice");
    expect((error as SkillMismatchError).message).toContain("Backend");
    expect((error as SkillMismatchError).message).not.toContain("Frontend");
  });

  it("rejects Bob (Backend only) on a Frontend task", async () => {
    const taskId = await taskRequiring("Frontend");

    await expect(assignTask(taskId, await idOf("developers", "Bob"))).rejects.toBeInstanceOf(SkillMismatchError);
  });

  it("rejects Dave (Backend only) on a Frontend + Backend task", async () => {
    const taskId = await taskRequiring("Frontend", "Backend");

    await expect(assignTask(taskId, await idOf("developers", "Dave"))).rejects.toBeInstanceOf(SkillMismatchError);
  });

  it("lets any developer take a task that requires no skills", async () => {
    for (const name of ["Alice", "Bob", "Carol", "Dave"]) {
      const task = await assignTask(await taskRequiring(), await idOf("developers", name));

      expect(task.assignee?.name).toBe(name);
    }
  });

  it("lets a developer with no skills take a task that requires no skills", async () => {
    const { rows } = await getPool().query<{ id: number }>("INSERT INTO developers (name) VALUES ('Erin') RETURNING id");

    const task = await assignTask(await taskRequiring(), rows[0]!.id);

    expect(task.assignee?.name).toBe("Erin");
  });

  it("keeps the existing assignee when a reassignment is rejected", async () => {
    const taskId = await taskRequiring("Backend");
    await assignTask(taskId, await idOf("developers", "Bob"));

    await expect(assignTask(taskId, await idOf("developers", "Alice"))).rejects.toBeInstanceOf(SkillMismatchError);

    expect((await getTask(taskId)).assignee?.name).toBe("Bob");
  });
});

describe("assignTask: other cases", () => {
  it("clears the assignee with null", async () => {
    const taskId = await taskRequiring("Backend");
    await assignTask(taskId, await idOf("developers", "Bob"));

    const task = await assignTask(taskId, null);

    expect(task.assignee).toBeNull();
  });

  it("clearing an already-unassigned task succeeds", async () => {
    const task = await assignTask(await taskRequiring(), null);

    expect(task.assignee).toBeNull();
  });

  it("rejects an unknown developer", async () => {
    await expect(assignTask(await taskRequiring(), 999999)).rejects.toBeInstanceOf(InvalidReferenceError);
  });

  it("rejects an unknown task", async () => {
    await expect(assignTask(999999, await idOf("developers", "Alice"))).rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not change the status", async () => {
    const taskId = await taskRequiring("Backend");
    await getPool().query("UPDATE tasks SET status = 'in_progress' WHERE id = $1", [taskId]);

    const task = await assignTask(taskId, await idOf("developers", "Bob"));

    expect(task.status).toBe("in_progress");
  });
});

type Node = { title: string; subtasks?: Node[] };

/** Create a tree and return a lookup from title to id. */
async function createTree(root: Node): Promise<Record<string, number>> {
  const created = await createTask({ title: root.title, skillIds: [], subtasks: toInput(root.subtasks) });
  const ids: Record<string, number> = {};
  (function walk(task: { id: number; title: string; subtasks: unknown[] }) {
    ids[task.title] = task.id;
    (task.subtasks as (typeof task)[]).forEach(walk);
  })(created);
  return ids;
}

function toInput(nodes: Node[] = []): { title: string; skillIds: number[]; subtasks: ReturnType<typeof toInput> }[] {
  return nodes.map((node) => ({ title: node.title, skillIds: [], subtasks: toInput(node.subtasks) }));
}

const setStatus = (id: number, status: "todo" | "in_progress" | "done") => updateTask(id, { status });

async function statusOf(id: number): Promise<string> {
  return (await getTask(id)).status;
}

describe("updateTask: Done rule", () => {
  it("lets a task with no subtasks become Done", async () => {
    const { solo } = await createTree({ title: "solo" });

    expect((await setStatus(solo!, "done")).status).toBe("done");
  });

  it("lets a task become Done once all its subtasks are Done, working bottom-up", async () => {
    const ids = await createTree({
      title: "root",
      subtasks: [{ title: "a", subtasks: [{ title: "a1" }] }, { title: "b" }],
    });

    await setStatus(ids.a1!, "done");
    await setStatus(ids.a!, "done");
    await setStatus(ids.b!, "done");
    const root = await setStatus(ids.root!, "done");

    expect(root.status).toBe("done");
  });

  it("rejects Done while a direct subtask is not Done, naming it", async () => {
    const ids = await createTree({ title: "root", subtasks: [{ title: "Write tests" }] });

    const error = await setStatus(ids.root!, "done").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(IncompleteSubtasksError);
    expect((error as IncompleteSubtasksError).message).toContain("1 subtask(s)");
    expect((error as IncompleteSubtasksError).message).toContain("Write tests");
    expect(await statusOf(ids.root!)).toBe("todo");
  });

  it("rejects Done while a deeper descendant is not Done, even if its parent is Done", async () => {
    const ids = await createTree({
      title: "root",
      subtasks: [{ title: "child", subtasks: [{ title: "grandchild" }] }],
    });
    // Put the tree in an inconsistent state directly, bypassing the service.
    await getPool().query("UPDATE tasks SET status = 'done' WHERE id = $1", [ids.child]);

    const error = await setStatus(ids.root!, "done").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(IncompleteSubtasksError);
    expect((error as IncompleteSubtasksError).details).toEqual({
      openSubtasks: [{ id: ids.grandchild, title: "grandchild", status: "todo" }],
    });
  });

  it("counts every open descendant, in creation order, and treats In progress as not Done", async () => {
    const ids = await createTree({
      title: "root",
      subtasks: [{ title: "a", subtasks: [{ title: "a1" }] }, { title: "b" }],
    });
    await setStatus(ids.b!, "in_progress");

    const error = (await setStatus(ids.root!, "done").catch((e: unknown) => e)) as IncompleteSubtasksError;

    expect(error.message).toContain("3 subtask(s)");
    expect((error.details as { openSubtasks: { title: string }[] }).openSubtasks.map((s) => s.title)).toEqual([
      "a",
      "a1",
      "b",
    ]);
  });

  it("shortens the message when many subtasks are open, but lists them all in the details", async () => {
    const ids = await createTree({
      title: "root",
      subtasks: ["s1", "s2", "s3", "s4", "s5"].map((title) => ({ title })),
    });

    const error = (await setStatus(ids.root!, "done").catch((e: unknown) => e)) as IncompleteSubtasksError;

    expect(error.message).toBe("Cannot mark task Done: 5 subtask(s) are not Done (s1, s2, s3, +2 more)");
    expect((error.details as { openSubtasks: unknown[] }).openSubtasks).toHaveLength(5);
  });

  it("does not stop a task with open subtasks from being To-do or In progress", async () => {
    const ids = await createTree({ title: "root", subtasks: [{ title: "child" }] });

    expect((await setStatus(ids.root!, "in_progress")).status).toBe("in_progress");
    expect((await setStatus(ids.root!, "todo")).status).toBe("todo");
  });

  it("lets a subtask become Done while its parent is still open", async () => {
    const ids = await createTree({ title: "root", subtasks: [{ title: "child" }] });

    expect((await setStatus(ids.child!, "done")).status).toBe("done");
    expect(await statusOf(ids.root!)).toBe("todo");
  });

  it("rejects the whole change when the status is blocked, so a valid assignee is not applied either", async () => {
    const ids = await createTree({ title: "root", subtasks: [{ title: "child" }] });
    const carol = await idOf("developers", "Carol");

    await expect(updateTask(ids.root!, { status: "done", assigneeId: carol })).rejects.toBeInstanceOf(
      IncompleteSubtasksError,
    );

    const task = await getTask(ids.root!);
    expect(task.assignee).toBeNull();
    expect(task.status).toBe("todo");
  });

  it("rejects the whole change when the assignment is blocked, so the status is not applied either", async () => {
    const backend = await idOf("skills", "Backend");
    const task = await createTask({ title: "api", skillIds: [backend] });

    await expect(updateTask(task.id, { status: "done", assigneeId: await idOf("developers", "Alice") })).rejects.toBeInstanceOf(
      SkillMismatchError,
    );

    expect(await statusOf(task.id)).toBe("todo");
  });

  it("applies the skill rule to subtasks like any other task", async () => {
    const backend = await idOf("skills", "Backend");
    const root = await createTask({
      title: "root",
      skillIds: [],
      subtasks: [{ title: "api", skillIds: [backend] }],
    });
    const subtask = root.subtasks[0]!;

    await expect(assignTask(subtask.id, await idOf("developers", "Alice"))).rejects.toBeInstanceOf(SkillMismatchError);
    expect((await assignTask(subtask.id, await idOf("developers", "Bob"))).assignee?.name).toBe("Bob");
  });
});

describe("updateTask: reopening Done ancestors", () => {
  /** Set statuses directly in SQL, to build a starting state without going through the rules. */
  async function force(status: "todo" | "in_progress" | "done", ...ids: number[]): Promise<void> {
    await getPool().query("UPDATE tasks SET status = $1 WHERE id = ANY($2::int[])", [status, ids]);
  }

  async function touchedSinceCreation(id: number): Promise<boolean> {
    const { rows } = await getPool().query<{ touched: boolean }>(
      "SELECT updated_at > created_at AS touched FROM tasks WHERE id = $1",
      [id],
    );
    return rows[0]!.touched;
  }

  it.each(["in_progress", "todo"] as const)("reopens a Done parent when its subtask is set to %s", async (status) => {
    const ids = await createTree({ title: "root", subtasks: [{ title: "child" }] });
    await force("done", ids.root!, ids.child!);

    await setStatus(ids.child!, status);

    expect(await statusOf(ids.child!)).toBe(status);
    expect(await statusOf(ids.root!)).toBe("in_progress");
  });

  it("reopens every Done ancestor up the tree", async () => {
    const ids = await createTree({
      title: "root",
      subtasks: [{ title: "a", subtasks: [{ title: "a1" }] }],
    });
    // The API only creates three levels, but the cascade has no depth limit: add a fourth directly.
    const { rows } = await getPool().query<{ id: number }>(
      "INSERT INTO tasks (title, parent_id) VALUES ('a1x', $1) RETURNING id",
      [ids.a1],
    );
    ids.a1x = rows[0]!.id;
    await force("done", ids.root!, ids.a!, ids.a1!, ids.a1x);

    await setStatus(ids.a1x!, "in_progress");

    expect(await statusOf(ids.a1!)).toBe("in_progress");
    expect(await statusOf(ids.a!)).toBe("in_progress");
    expect(await statusOf(ids.root!)).toBe("in_progress");
  });

  it("keeps walking up past an ancestor that is not Done", async () => {
    const ids = await createTree({
      title: "root",
      subtasks: [{ title: "mid", subtasks: [{ title: "leaf" }] }],
    });
    await force("done", ids.root!, ids.leaf!);
    await force("in_progress", ids.mid!); // an inconsistent starting state

    await setStatus(ids.leaf!, "todo");

    expect(await statusOf(ids.root!)).toBe("in_progress");
    expect(await statusOf(ids.mid!)).toBe("in_progress");
  });

  it("leaves ancestors that are To-do or In progress as they are", async () => {
    const ids = await createTree({
      title: "root",
      subtasks: [{ title: "mid", subtasks: [{ title: "leaf" }] }],
    });
    await force("done", ids.leaf!);
    await force("in_progress", ids.mid!);

    await setStatus(ids.leaf!, "todo");

    expect(await statusOf(ids.mid!)).toBe("in_progress");
    expect(await statusOf(ids.root!)).toBe("todo");
  });

  it("does not touch siblings, descendants or unrelated tasks", async () => {
    const ids = await createTree({
      title: "root",
      subtasks: [{ title: "a", subtasks: [{ title: "a1" }] }, { title: "b" }],
    });
    const other = await createTree({ title: "other tree", subtasks: [{ title: "other child" }] });
    await force("done", ids.root!, ids.a!, ids.a1!, ids.b!, other["other tree"]!, other["other child"]!);

    await setStatus(ids.a!, "in_progress");

    expect(await statusOf(ids.a!)).toBe("in_progress");
    expect(await statusOf(ids.root!)).toBe("in_progress");
    expect(await statusOf(ids.a1!)).toBe("done"); // descendant
    expect(await statusOf(ids.b!)).toBe("done"); // sibling
    expect(await statusOf(other["other tree"]!)).toBe("done");
    expect(await statusOf(other["other child"]!)).toBe("done");
  });

  it("updates only the reopened ancestors' updatedAt", async () => {
    const ids = await createTree({ title: "root", subtasks: [{ title: "a" }, { title: "b" }] });
    await force("done", ids.root!, ids.a!, ids.b!);

    await setStatus(ids.a!, "todo");

    expect(await touchedSinceCreation(ids.root!)).toBe(true);
    expect(await touchedSinceCreation(ids.b!)).toBe(false);
  });

  it("never cascades when a task is set to Done", async () => {
    const ids = await createTree({ title: "root", subtasks: [{ title: "mid", subtasks: [{ title: "leaf" }] }] });

    await setStatus(ids.leaf!, "done");

    expect(await statusOf(ids.mid!)).toBe("todo");
    expect(await statusOf(ids.root!)).toBe("todo");
  });

  it("does nothing for a task with no parent, or when the ancestors are not Done", async () => {
    const ids = await createTree({ title: "root", subtasks: [{ title: "child" }] });

    await expect(setStatus(ids.root!, "in_progress")).resolves.toMatchObject({ status: "in_progress" });
    await expect(setStatus(ids.child!, "in_progress")).resolves.toMatchObject({ status: "in_progress" });
    expect(await statusOf(ids.root!)).toBe("in_progress");
  });

  it("does not reopen anything on an assignment-only change", async () => {
    const ids = await createTree({ title: "root", subtasks: [{ title: "child" }] });
    await force("done", ids.root!, ids.child!);

    await updateTask(ids.child!, { assigneeId: await idOf("developers", "Alice") });

    expect(await statusOf(ids.root!)).toBe("done");
  });

  it("rolls the cascade back when the same request's assignment is rejected", async () => {
    const backend = await idOf("skills", "Backend");
    const root = await createTask({
      title: "root",
      skillIds: [],
      subtasks: [{ title: "api", skillIds: [backend] }],
    });
    const child = root.subtasks[0]!;
    await force("done", root.id, child.id);

    await expect(
      updateTask(child.id, { status: "in_progress", assigneeId: await idOf("developers", "Alice") }),
    ).rejects.toBeInstanceOf(SkillMismatchError);

    expect(await statusOf(child.id)).toBe("done");
    expect(await statusOf(root.id)).toBe("done");
  });

  it("keeps the whole tree consistent: reopening forces the parent to wait for the child again", async () => {
    const ids = await createTree({ title: "root", subtasks: [{ title: "child" }] });
    await setStatus(ids.child!, "done");
    await setStatus(ids.root!, "done");

    await setStatus(ids.child!, "in_progress"); // reopen: parent is reopened too

    expect(await statusOf(ids.root!)).toBe("in_progress");
    await expect(setStatus(ids.root!, "done")).rejects.toBeInstanceOf(IncompleteSubtasksError);
    await setStatus(ids.child!, "done");
    expect((await setStatus(ids.root!, "done")).status).toBe("done");
  });
});

describe("updateTask: concurrent status changes", () => {
  const sleep = (ms: number) => new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), ms));

  async function forceDone(...ids: number[]): Promise<void> {
    await getPool().query("UPDATE tasks SET status = 'done' WHERE id = ANY($1::int[])", [ids]);
  }

  /** Hold the lock on a tree's root, as a concurrent status change would, until `release` is called. */
  async function holdRootLock(rootId: number): Promise<{ release: () => Promise<void> }> {
    const client = await getPool().connect();
    await client.query("BEGIN");
    await client.query("SELECT id FROM tasks WHERE id = $1 FOR NO KEY UPDATE", [rootId]);
    return {
      release: async () => {
        await client.query("COMMIT");
        client.release();
      },
    };
  }

  it("makes a status change wait while another change holds the tree's lock", async () => {
    const ids = await createTree({ title: "root", subtasks: [{ title: "child", subtasks: [{ title: "leaf" }] }] });
    const lock = await holdRootLock(ids.root!);

    const change = setStatus(ids.leaf!, "in_progress"); // a deep task is locked through its root
    try {
      expect(await Promise.race([change, sleep(150)])).toBe("timeout");
    } finally {
      await lock.release();
    }
    expect((await change).status).toBe("in_progress");
  });

  it("does not make an assignee-only change wait", async () => {
    const ids = await createTree({ title: "root", subtasks: [{ title: "child" }] });
    const lock = await holdRootLock(ids.root!);

    try {
      const task = await Promise.race([assignTask(ids.child!, await idOf("developers", "Alice")), sleep(150)]);
      expect(task).not.toBe("timeout");
    } finally {
      await lock.release();
    }
  });

  it("does not make changes in another tree wait", async () => {
    const mine = await createTree({ title: "mine", subtasks: [{ title: "mine child" }] });
    const other = await createTree({ title: "other" });
    const lock = await holdRootLock(mine.mine!);

    try {
      expect(await Promise.race([setStatus(other.other!, "in_progress"), sleep(150)])).not.toBe("timeout");
    } finally {
      await lock.release();
    }
  });

  it("never leaves a Done parent above an unfinished child when Done and reopen race", async () => {
    for (let round = 0; round < 20; round++) {
      const ids = await createTree({ title: "root", subtasks: [{ title: "child" }] });
      // The child is Done and the parent is not: race "parent -> Done" against "child -> To-do".
      await forceDone(ids.child!);

      await Promise.allSettled([setStatus(ids.root!, "done"), setStatus(ids.child!, "todo")]);

      const [root, child] = await Promise.all([statusOf(ids.root!), statusOf(ids.child!)]);
      expect(root === "done" && child !== "done", `round ${round}: root ${root}, child ${child}`).toBe(false);
    }
  });
});

describe("createTask: size limits", () => {
  type Node = { title: string; skillIds: number[]; subtasks: Node[] };

  function chain(levels: number): Node {
    let node: Node = { title: "leaf", skillIds: [], subtasks: [] };
    for (let level = 1; level < levels; level++) node = { title: `level ${levels - level}`, skillIds: [], subtasks: [node] };
    return node;
  }

  it("accepts three levels: task, subtask, sub-subtask", async () => {
    await createTask(chain(3));

    expect(await taskCount()).toBe(3);
  });

  it("rejects a fourth level, whoever calls the service, and saves nothing", async () => {
    await expect(createTask(chain(4))).rejects.toBeInstanceOf(ValidationError);

    expect(await taskCount()).toBe(0);
  });

  it("rejects more than 100 tasks in one call and saves nothing", async () => {
    const tooMany = {
      title: "root",
      skillIds: [],
      subtasks: Array.from({ length: 100 }, (_, i) => ({ title: `child ${i}`, skillIds: [], subtasks: [] })),
    };

    await expect(createTask(tooMany)).rejects.toBeInstanceOf(ValidationError);

    expect(await taskCount()).toBe(0);
  });
});

describe("createTask: skill tagging", () => {
  const skillNames = (task: { skills: { name: string }[] }) => task.skills.map((skill) => skill.name).sort();

  it("tags a task created without skills with the classifier's suggestion", async () => {
    const classifier = fakeClassifier({ "Build the login API": ["Backend"] });

    const task = await createTask({ title: "Build the login API", skillIds: [] }, classifier);

    expect(skillNames(task)).toEqual(["Backend"]);
    expect(classifier.calls[0]?.skillNames.sort()).toEqual(["Backend", "Frontend"]);
  });

  it("skips the classifier when the user chose skills", async () => {
    const classifier = fakeClassifier({ Chosen: ["Backend"] });
    const frontend = await idOf("skills", "Frontend");

    const task = await createTask({ title: "Chosen", skillIds: [frontend] }, classifier);

    expect(skillNames(task)).toEqual(["Frontend"]);
    expect(classifier.calls).toEqual([]);
  });

  it("classifies each untagged subtask on its own and skips tagged ones", async () => {
    const classifier = fakeClassifier({
      Parent: ["Frontend", "Backend"],
      "Style the page": ["Frontend"],
      "Add the endpoint": ["Backend"],
    });
    const backend = await idOf("skills", "Backend");

    const task = await createTask(
      {
        title: "Parent",
        skillIds: [],
        subtasks: [
          { title: "Style the page", skillIds: [] },
          { title: "Tagged by user", skillIds: [backend], subtasks: [{ title: "Add the endpoint", skillIds: [] }] },
        ],
      },
      classifier,
    );

    expect(skillNames(task)).toEqual(["Backend", "Frontend"]);
    expect(skillNames(task.subtasks[0]!)).toEqual(["Frontend"]);
    expect(skillNames(task.subtasks[1]!)).toEqual(["Backend"]);
    expect(skillNames(task.subtasks[1]!.subtasks[0]!)).toEqual(["Backend"]);
    expect(classifier.calls.map((call) => call.title).sort()).toEqual(["Add the endpoint", "Parent", "Style the page"]);
  });

  it("saves the task without skills when the classifier fails, and still tags the others", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const classifier = fakeClassifier({ Parent: new Error("quota exceeded"), Child: ["Frontend"] });

    const task = await createTask(
      { title: "Parent", skillIds: [], subtasks: [{ title: "Child", skillIds: [] }] },
      classifier,
    );

    expect(task.skills).toEqual([]);
    expect(skillNames(task.subtasks[0]!)).toEqual(["Frontend"]);
  });

  it("ignores suggestions that are not known skills", async () => {
    const classifier = fakeClassifier({ Odd: ["DevOps", "backend"] });

    const task = await createTask({ title: "Odd", skillIds: [] }, classifier);

    expect(skillNames(task)).toEqual(["Backend"]);
  });

  it("leaves tasks untagged by default (no classifier configured)", async () => {
    expect((await createTask({ title: "Plain", skillIds: [] })).skills).toEqual([]);
  });

  describe("which skills were added by AI", () => {
    const flags = (task: { skills: { name: string; addedByAi: boolean }[] }) =>
      Object.fromEntries(task.skills.map((skill) => [skill.name, skill.addedByAi]));

    it("marks skills the classifier added, and only those", async () => {
      const classifier = fakeClassifier({ "Build the API": ["Backend"], Mixed: ["Frontend"] });
      const backend = await idOf("skills", "Backend");

      const task = await createTask(
        {
          title: "Build the API",
          skillIds: [],
          subtasks: [
            { title: "Chosen by user", skillIds: [backend] },
            { title: "Mixed", skillIds: [] },
          ],
        },
        classifier,
      );

      expect(flags(task)).toEqual({ Backend: true });
      expect(flags(task.subtasks[0]!)).toEqual({ Backend: false });
      expect(flags(task.subtasks[1]!)).toEqual({ Frontend: true });
    });

    it("marks every skill as user-chosen when no classifier is configured", async () => {
      const frontend = await idOf("skills", "Frontend");

      const task = await createTask({ title: "Plain", skillIds: [frontend] });

      expect(flags(task)).toEqual({ Frontend: false });
    });

    it("keeps the flag when the task is read again", async () => {
      const created = await createTask({ title: "Build the API", skillIds: [] }, fakeClassifier({ "Build the API": ["Backend"] }));

      expect(flags(await getTask(created.id))).toEqual({ Backend: true });
    });

    it("saves no skills, and so no flags, when the classifier fails", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});

      const task = await createTask({ title: "Oops", skillIds: [] }, fakeClassifier({ Oops: new Error("down") }));

      expect(task.skills).toEqual([]);
    });
  });
});
