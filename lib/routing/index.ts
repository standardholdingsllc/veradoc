export { getLegacyCanonicalTarget } from "./legacy";
export { buildAbsoluteUrlFromOrigins, parseOriginMap } from "./origin-config";
export { decideRoute } from "./policy";
export { publicToInternalPath, stripInternalPrefix } from "./rewrites";
export { classifyHost, normalizeHostname, PRODUCTION_HOSTS } from "./surfaces";
export { getPublicTargetForRole } from "./targets";
export { CANONICAL_SURFACES, ROLE_TARGETS } from "./types";
export type {
  CanonicalSurface,
  PublicPath,
  PublicTarget,
  Surface,
} from "./types";
