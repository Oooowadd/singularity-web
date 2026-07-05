import { queue } from "@trigger.dev/sdk";

// All user-facing tasks share this queue; web triggers with concurrencyKey=userId,
// so each user runs at most 2 tasks at once (abuse containment, quota overshoot bound).
export const userRunsQueue = queue({
  name: "user-runs",
  concurrencyLimit: 2,
});
