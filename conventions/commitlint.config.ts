import type { UserConfig } from "@commitlint/types";

const VAGUE_SUBJECTS = ["wip", "fix stuff", "update", "changes", "misc", "asdf", "temp", "cleanup", "test123"];

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "no-vague-subject": ({ subject }) => {
          const s = (subject || "").trim().toLowerCase();
          return [
            !VAGUE_SUBJECTS.includes(s),
            `subject '${s}' is vague — use a descriptive imperative phrase`,
          ];
        },
      },
    },
  ],
  rules: {
    "no-vague-subject": [2, "always"],
    "type-enum": [2, "always", [
      "feat",
      "fix",
      "docs",
      "test",
      "refactor",
      "ci",
      "chore",
    ]],
    "type-case": [2, "always", "lower-case"],
    "subject-max-length": [2, "always", 150],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "body-max-line-length": [2, "always", 150],
    "body-leading-blank": [1, "always"],
    "footer-leading-blank": [1, "always"],
  },
};

export default config;
