-- Up Migration

CREATE TABLE developers (
  id   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE skills (
  id   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE developer_skills (
  developer_id integer NOT NULL REFERENCES developers (id) ON DELETE CASCADE,
  skill_id     integer NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
  PRIMARY KEY (developer_id, skill_id)
);
CREATE INDEX developer_skills_skill_id_idx ON developer_skills (skill_id);

-- status is text + CHECK rather than a Postgres enum: extending a CHECK in a
-- later migration is simpler than altering an enum type.
CREATE TABLE tasks (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title       text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 500),
  status      text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  assignee_id integer REFERENCES developers (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_assignee_id_idx ON tasks (assignee_id);

CREATE TABLE task_skills (
  task_id  integer NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  skill_id integer NOT NULL REFERENCES skills (id) ON DELETE RESTRICT,
  PRIMARY KEY (task_id, skill_id)
);
CREATE INDEX task_skills_skill_id_idx ON task_skills (skill_id);

-- Down Migration

DROP TABLE task_skills;
DROP TABLE tasks;
DROP TABLE developer_skills;
DROP TABLE skills;
DROP TABLE developers;
