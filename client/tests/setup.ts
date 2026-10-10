import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";

// How long findBy and waitFor wait for a screen to appear. The default is one second, which a loaded machine
// does not always give the first render of the whole application; see vite.config.ts and tests.md §7 (D-22).
configure({ asyncUtilTimeout: 5_000 });
