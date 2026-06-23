/**
 * Runtime role selection.
 *
 * Chapar runs the same image in one of three roles, selected by CHAPAR_ROLE:
 *  - 'api'    : serves HTTP and enqueues jobs; does NOT consume the queue.
 *  - 'worker' : consumes the queue and sends notifications; no public API.
 *  - 'all'    : both (default) — convenient for local development and small deploys.
 *
 * Read from process.env (not ConfigService) because the role is needed at
 * module-definition time, before the Nest DI container is built.
 */
export type ChaparRole = 'api' | 'worker' | 'all';

export const getRole = (): ChaparRole => {
  const role = process.env.CHAPAR_ROLE;
  return role === 'api' || role === 'worker' ? role : 'all';
};

/** True when this process should serve the public API (notify/logs). */
export const runsApi = (): boolean => getRole() !== 'worker';

/** True when this process should consume the queue and send notifications. */
export const runsWorker = (): boolean => getRole() !== 'api';
