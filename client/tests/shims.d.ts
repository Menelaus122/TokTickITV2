// dom-accessibility-api ships its types, but TypeScript cannot resolve them through the package's
// "exports" map under `moduleResolution: bundler`. Testing Library depends on it, so it is always
// installed; the tests name it for one function, which this declares.
declare module "dom-accessibility-api" {
  export function computeAccessibleName(root: Element): string;
}
