import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // tsc already reports unresolved names; the base rule cannot read TS syntax
      // and reports 35 false positives across tests/.
      "no-undef": "off",
    },
  },
  {
    // `any` is frequently the honest type in a test mock or fixture. src/ and
    // scripts/ keep the rule — it stays enforced where the bugs live.
    files: ["tests/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);
