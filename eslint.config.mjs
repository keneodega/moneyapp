import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Custom rule overrides
  {
    rules: {
      // Allow any types during development (stricter in future)
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow unused vars with underscore prefix
      "@typescript-eslint/no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_" 
      }],
      // Allow empty interfaces for type extension patterns
      "@typescript-eslint/no-empty-object-type": "off",
      // Allow require imports for specific cases (e.g., Sentry)
      "@typescript-eslint/no-require-imports": "warn",
      // Allow unescaped entities (apostrophes in text)
      "react/no-unescaped-entities": "off",
      // Allow setState in useEffect for hydration patterns
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
