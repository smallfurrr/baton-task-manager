-- Up Migration

-- A subtask is an ordinary task row pointing at its parent. Nullable, so every
-- existing task stays valid as a top-level task. Deleting a parent deletes its subtree.
ALTER TABLE tasks ADD COLUMN parent_id integer REFERENCES tasks (id) ON DELETE CASCADE;

ALTER TABLE tasks ADD CONSTRAINT tasks_not_own_parent CHECK (parent_id IS NULL OR parent_id <> id);

CREATE INDEX tasks_parent_id_idx ON tasks (parent_id);

-- Down Migration

DROP INDEX tasks_parent_id_idx;
ALTER TABLE tasks DROP CONSTRAINT tasks_not_own_parent;
ALTER TABLE tasks DROP COLUMN parent_id;
