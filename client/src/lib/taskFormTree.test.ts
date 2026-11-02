import { describe, expect, it } from "vitest";
import type { Skill } from "../api/types";
import {
  addSubtask,
  canAddSubtask,
  countNodes,
  depthOf,
  MAX_DEPTH,
  MAX_NODES,
  newNode,
  numberLabels,
  removeNode,
  toCreateInput,
  updateNode,
  validateTitle,
  validateTree,
  type FormNode,
} from "./taskFormTree";

/** A node with a fixed key, for readable tests. */
function node(key: string, title = "", subtasks: FormNode[] = [], skillIds: number[] = []): FormNode {
  return { key, title, skillIds, subtasks };
}

/** Keys of a tree in outline form: "a(b(d), c)" */
function outline(tree: FormNode): string {
  return tree.subtasks.length ? `${tree.key}(${tree.subtasks.map(outline).join(", ")})` : tree.key;
}

function chain(levels: number): FormNode {
  let tree = node(`level-${levels}`);
  for (let level = levels - 1; level >= 1; level--) tree = node(`level-${level}`, "", [tree]);
  return tree;
}

const skills: Skill[] = [
  { id: 1, name: "Frontend" },
  { id: 2, name: "Backend" },
];

describe("newNode", () => {
  it("creates an empty task with a key that differs from every other", () => {
    const a = newNode();
    const b = newNode();

    expect(a).toMatchObject({ title: "", skillIds: [], subtasks: [] });
    expect(a.key).not.toBe(b.key);
  });
});

describe("addSubtask", () => {
  it("adds a subtask as the last child of the chosen task, within the depth limit", () => {
    const tree = node("a", "", [node("b", "", [node("d")]), node("c")]);

    expect(outline(addSubtask(tree, "a", node("e")))).toBe("a(b(d), c, e)");
    expect(outline(addSubtask(tree, "b", node("e")))).toBe("a(b(d, e), c)");
    expect(outline(addSubtask(tree, "c", node("e")))).toBe("a(b(d), c(e))");
  });

  it("does not change the tree it was given", () => {
    const tree = node("a", "", [node("b")]);

    addSubtask(tree, "b", node("c"));

    expect(outline(tree)).toBe("a(b)");
  });

  it("leaves everything else in the tree shared and unchanged", () => {
    const untouched = node("c");
    const tree = node("a", "", [node("b"), untouched]);

    const next = addSubtask(tree, "b", node("d"));

    expect(next.subtasks[1]).toBe(untouched);
  });

  it("does nothing for an unknown parent", () => {
    const tree = node("a");

    expect(addSubtask(tree, "missing", node("b"))).toBe(tree);
  });

  it(`stops at ${MAX_DEPTH} levels`, () => {
    const deepest = chain(MAX_DEPTH);

    expect(canAddSubtask(deepest, `level-${MAX_DEPTH - 1}`)).toBe(true);
    expect(canAddSubtask(deepest, `level-${MAX_DEPTH}`)).toBe(false);
    expect(addSubtask(deepest, `level-${MAX_DEPTH}`, node("extra"))).toBe(deepest);
  });

  it(`stops at ${MAX_NODES} tasks in total`, () => {
    const almostFull = node("root", "", Array.from({ length: MAX_NODES - 2 }, (_, i) => node(`c${i}`)));

    const full = addSubtask(almostFull, "root", node("last"));

    expect(countNodes(full)).toBe(MAX_NODES);
    expect(canAddSubtask(full, "root")).toBe(false);
    expect(addSubtask(full, "root", node("one too many"))).toBe(full);
  });
});

describe("removeNode", () => {
  it("removes a subtask together with everything beneath it", () => {
    const tree = node("a", "", [node("b", "", [node("d")]), node("c")]);

    expect(outline(removeNode(tree, "b"))).toBe("a(c)");
  });

  it("removes a deeply nested subtask", () => {
    const tree = node("a", "", [node("b", "", [node("d", "", [node("e")])])]);

    expect(outline(removeNode(tree, "e"))).toBe("a(b(d))");
  });

  it("never removes the root task", () => {
    const tree = node("a", "", [node("b")]);

    expect(removeNode(tree, "a")).toBe(tree);
  });

  it("does nothing for an unknown key, and does not change the original", () => {
    const tree = node("a", "", [node("b")]);

    expect(removeNode(tree, "missing")).toBe(tree);
    removeNode(tree, "b");
    expect(outline(tree)).toBe("a(b)");
  });
});

describe("updateNode", () => {
  it("changes only the chosen node", () => {
    const tree = node("a", "root", [node("b", "child"), node("c", "other")]);

    const next = updateNode(tree, "b", { title: "renamed", skillIds: [2] });

    expect(next.subtasks[0]).toMatchObject({ key: "b", title: "renamed", skillIds: [2] });
    expect(next.subtasks[1]).toBe(tree.subtasks[1]);
    expect(next.title).toBe("root");
    expect(tree.subtasks[0]?.title).toBe("child");
  });

  it("can change one field without touching the other", () => {
    const tree = node("a", "keep", [], [1]);

    expect(updateNode(tree, "a", { title: "new" })).toMatchObject({ title: "new", skillIds: [1] });
    expect(updateNode(tree, "a", { skillIds: [] })).toMatchObject({ title: "keep", skillIds: [] });
  });
});

describe("countNodes and depthOf", () => {
  const tree = node("a", "", [node("b", "", [node("d")]), node("c")]);

  it("counts every task in the tree", () => {
    expect(countNodes(node("solo"))).toBe(1);
    expect(countNodes(tree)).toBe(4);
  });

  it("reports depth with the root at 1, and undefined for unknown keys", () => {
    expect(depthOf(tree, "a")).toBe(1);
    expect(depthOf(tree, "c")).toBe(2);
    expect(depthOf(tree, "d")).toBe(3);
    expect(depthOf(tree, "missing")).toBeUndefined();
  });
});

describe("numberLabels", () => {
  it("numbers the outline as in the wireframe", () => {
    const tree = node("a", "", [node("b", "", [node("d"), node("e")]), node("c")]);

    expect(Object.fromEntries(numberLabels(tree))).toEqual({
      a: "1",
      b: "1.1",
      d: "1.1.1",
      e: "1.1.2",
      c: "1.2",
    });
  });

  it("renumbers siblings after one is removed", () => {
    const tree = node("a", "", [node("b"), node("c"), node("d")]);

    expect(numberLabels(removeNode(tree, "b")).get("d")).toBe("1.2");
  });
});

describe("validateTitle", () => {
  it("accepts a normal title and one of exactly 500 characters", () => {
    expect(validateTitle("Write the docs")).toBeUndefined();
    expect(validateTitle("x".repeat(500))).toBeUndefined();
  });

  it("rejects empty, blank and over-long titles", () => {
    expect(validateTitle("")).toBe("Enter a title for the task.");
    expect(validateTitle("   ")).toBe("Enter a title for the task.");
    expect(validateTitle("x".repeat(501))).toBe("The title must be at most 500 characters.");
  });

  it("measures the length after trimming", () => {
    expect(validateTitle(`  ${"x".repeat(500)}  `)).toBeUndefined();
  });
});

describe("validateTree", () => {
  it("has no errors when every title is valid", () => {
    expect(validateTree(node("a", "root", [node("b", "child")])).size).toBe(0);
  });

  it("reports every invalid node by key, at any depth", () => {
    const tree = node("a", "", [node("b", "ok", [node("c", "   ")]), node("d", "x".repeat(501))]);

    const errors = validateTree(tree);

    expect([...errors.keys()]).toEqual(["a", "c", "d"]);
  });
});

describe("toCreateInput", () => {
  it("builds the nested request with trimmed titles and no form keys", () => {
    const tree = node("a", "  root  ", [node("b", " child ", [node("c", "grandchild")]), node("d", "second")]);

    expect(toCreateInput(tree, skills)).toEqual({
      title: "root",
      skillIds: [],
      subtasks: [
        { title: "child", skillIds: [], subtasks: [{ title: "grandchild", skillIds: [], subtasks: [] }] },
        { title: "second", skillIds: [], subtasks: [] },
      ],
    });
  });

  it("gives each task its own skills, ordered as the form lists them", () => {
    const tree = node("a", "root", [node("b", "child", [], [1])], [2, 1]);

    const input = toCreateInput(tree, skills);

    expect(input.skillIds).toEqual([1, 2]);
    expect(input.subtasks[0]?.skillIds).toEqual([1]);
  });

  it("ignores skill ids the form does not list", () => {
    expect(toCreateInput(node("a", "t", [], [1, 99]), skills).skillIds).toEqual([1]);
  });
});
