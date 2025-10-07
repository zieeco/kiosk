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
import type * as access from "../access.js";
import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as care from "../care.js";
import type * as cleanup from "../cleanup.js";
import type * as compliance from "../compliance.js";
import type * as complianceEmails from "../complianceEmails.js";
import type * as dataCleanup from "../dataCleanup.js";
import type * as diagnostics from "../diagnostics.js";
import type * as emails from "../emails.js";
import type * as emailsSMTP from "../emailsSMTP.js";
import type * as employees from "../employees.js";
import type * as employeesImproved from "../employeesImproved.js";
import type * as fireEvac from "../fireEvac.js";
import type * as guardianChecklists from "../guardianChecklists.js";
import type * as http from "../http.js";
import type * as isp from "../isp.js";
import type * as kiosk from "../kiosk.js";
import type * as passwordReset from "../passwordReset.js";
import type * as passwordResetEmail from "../passwordResetEmail.js";
import type * as people from "../people.js";
import type * as router from "../router.js";
import type * as settings from "../settings.js";
import type * as supervisor from "../supervisor.js";
import type * as teams from "../teams.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  access: typeof access;
  admin: typeof admin;
  auth: typeof auth;
  care: typeof care;
  cleanup: typeof cleanup;
  compliance: typeof compliance;
  complianceEmails: typeof complianceEmails;
  dataCleanup: typeof dataCleanup;
  diagnostics: typeof diagnostics;
  emails: typeof emails;
  emailsSMTP: typeof emailsSMTP;
  employees: typeof employees;
  employeesImproved: typeof employeesImproved;
  fireEvac: typeof fireEvac;
  guardianChecklists: typeof guardianChecklists;
  http: typeof http;
  isp: typeof isp;
  kiosk: typeof kiosk;
  passwordReset: typeof passwordReset;
  passwordResetEmail: typeof passwordResetEmail;
  people: typeof people;
  router: typeof router;
  settings: typeof settings;
  supervisor: typeof supervisor;
  teams: typeof teams;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
