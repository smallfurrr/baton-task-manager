import { useQuery } from "@tanstack/react-query";
import { fetchSkills } from "../api/skills";

const skillsKey = ["skills"] as const;

export const useSkills = () => useQuery({ queryKey: skillsKey, queryFn: fetchSkills });
