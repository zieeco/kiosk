/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as auth from "../auth.js";
import type * as compliance from "../compliance.js";
import type * as employees from "../employees.js";
import type * as http from "../http.js";
import type * as kiosk from "../kiosk.js";
import type * as people from "../people.js";
import type * as router from "../router.js";
import type * as settings from "../settings.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  compliance: typeof compliance;
  employees: typeof employees;
  http: typeof http;
  kiosk: typeof kiosk;
  people: typeof people;
  router: typeof router;
  settings: typeof settings;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
