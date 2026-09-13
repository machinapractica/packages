import { installHooks } from './hooks.mjs';
// npm saves a newly added dependency to package.json AFTER this lifecycle runs.
// Do not edit that manifest here: setup owns persistent scripts after installation.
const project = process.env.npm_config_local_prefix || process.env.INIT_CWD;
if (project && process.env.npm_config_global !== 'true') installHooks(project);
