import { useQuery } from "@tanstack/react-query";
import { fetchDevelopers } from "../api/developers";

export const developersKey = ["developers"] as const;

export const useDevelopers = () => useQuery({ queryKey: developersKey, queryFn: fetchDevelopers });
