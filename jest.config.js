// Config do Jest usando o preset do Next.js (`next/jest`) — cuida de
// transformar TS/JSX com o mesmo SWC do build, sem precisar configurar
// babel/ts-jest manualmente, e já carrega `.env.local` para os testes.
const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/"],
};

module.exports = createJestConfig(customJestConfig);
