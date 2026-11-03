/** Suggests which of the known skills a task needs, based on its title. */
export interface SkillClassifier {
  /**
   * Returns the names from `skillNames` that the task needs. Implementations
   * may throw; callers must not rely on the result being valid (see `tagSkills`).
   */
  classify(title: string, skillNames: string[]): Promise<string[]>;
}

/** Classifier used when no LLM is configured: tags nothing. */
export const noopSkillClassifier: SkillClassifier = {
  classify: async () => [],
};
