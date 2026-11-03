-- Up Migration

-- Whether a skill on a task was suggested by the classifier rather than chosen by the user.
-- Existing rows default to false: their origin was not recorded, so they count as user-chosen.
ALTER TABLE task_skills ADD COLUMN added_by_ai boolean NOT NULL DEFAULT false;

-- Down Migration

ALTER TABLE task_skills DROP COLUMN added_by_ai;
