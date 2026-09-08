/**
 * Check Node support before importing modules that require newer runtime APIs.
 */

export const MINIMUM_NODE_MAJOR = 20;

/**
 * A message when this Node is too old, undefined when it is fine.
 *
 * An unrecognisable version string returns undefined: refusing to run because
 * we could not parse `process.versions.node` would break users over our own
 * uncertainty, and every runtime we actually support reports a normal version.
 */
export function unsupportedNode(
  version: string,
  minimum: number = MINIMUM_NODE_MAJOR,
): string | undefined {
  const major = Number(/^v?(\d+)\./.exec(version)?.[1]);
  if (!Number.isInteger(major) || major >= minimum) return undefined;

  return (
    `zero-shelter needs Node ${minimum} or later, and this is Node ${version}.\n` +
    "Upgrade Node, or run it through a version manager (nvm use 20, fnm use 20).\n"
  );
}
