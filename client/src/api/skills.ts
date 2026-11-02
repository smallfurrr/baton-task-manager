import { request } from "./client";
import type { Skill } from "./types";

export const fetchSkills = () => request<Skill[]>("/skills");
