import { request } from "./client";
import type { Developer } from "./types";

export const fetchDevelopers = () => request<Developer[]>("/developers");
