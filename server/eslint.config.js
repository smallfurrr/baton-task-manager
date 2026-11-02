import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // `any` needs an explanatory comment (see CLAUDE.md), so flag it by default.
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // Express identifies error handlers by arity, so `_next` must stay in the signature.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
);
