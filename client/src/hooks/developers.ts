import { useQuery } from "@tanstack/react-query";
import { fetchDevelopers } from "../api/developers";

const developersKey = ["developers"] as const;

export const useDevelopers = () => useQuery({ queryKey: developersKey, queryFn: fetchDevelopers });
