# Server-authoritative rewards and pet progression

## Preserve current rules deliberately

The browser prototype awards 15 stars per unique artwork, plus 5 on the first and 10 on the fourth artwork. Initial hosted rules preserve these values for eligible newly created artwork. Deleting artwork never makes the same reward available again. Editing an existing artwork does not count as creating another one.

Current quiz rules award 10 stars and 2 pet points per correct answer on the first eligible weekly attempt; practice attempts do not repeat rewards. Preserve any existing challenge rules after inspecting `challenge.js` and dashboard code; do not invent challenge rewards from the request payload. Keep the rules versioned and documented before converting them.

Pet activity thresholds are 2, 5, and 8 activity equivalents for growing, young, and grown; baby is below 2. In integer half-activity units these thresholds are 4, 10, and 16. Each eligible activity contributes 2 units, and each quiz pet point contributes 1 unit. Persist completion sources so a quiz completion and its correct-answer rewards can be explained separately and never accidentally counted twice. Tests must characterize the existing prototype before freezing the hosted policy.

## Authoritative event flow

The client requests an action, not a reward amount. The server verifies ownership, eligibility, source, assessment window, and prior event, then commits a uniquely keyed event and its balance projection together. Suggested keys: `artwork:{id}:created`, `milestone:artwork:first`, `milestone:artwork:fourth`, `quiz:{version}:{window}:eligible`, and stable challenge completion keys. Include a rule version so changes are explicit.

The lifetime artwork completion count is independent of visible gallery count and never decreases on deletion. Determine first/fourth milestones from eligible completion records inside the transaction, protected by unique milestone event keys. Do not determine them from a client count or currently visible images.

Wallet is a projection of an immutable ledger. Apply atomic increments or a serialized service transaction; avoid read-modify-write from stale snapshots. Reconciliation compares projections with ledger totals and reports discrepancies. Administrative adjustments are new audited events, not deletion of historical events. If purchases are retained, use an atomic nonnegative balance condition and unique purchase IDs, and preserve owned items independently of current balances.

## Assessment integrity

Keep correct answers on the server. Bind submitted options to an attempt's versioned question set and owner. Define a weekly eligibility window using the configured business timezone, not browser time or a client flag. Enforce one reward-bearing attempt per user/quiz/window with a unique claim record even when submissions race.

Grade and claim the reward together; an interruption cannot leave a graded attempt rewarded twice later. A repeated submission returns the previous result; a modified payload after finalization returns conflict. Withholding answer flags before submission prevents trivial answer discovery, but it does not make the assessment proctored or cheat-proof. Feedback may reveal answers after grading according to product policy.

## Abuse and import policy

An image save proves a valid save, not effort or learning quality. Unique IDs alone do not prevent someone submitting many new images. Record this limitation. Before public release decide whether daily artwork credit caps or challenge-specific evidence are needed; version the policy and show the limit clearly rather than silently withholding rewards. Test repeated blank/identical submissions and the chosen policy. Do not claim to measure learning from upload volume.

Legacy import creates no reward events by default. Do not turn `artwork-rewards.js` or `pet-progress.js` recovery code into a server backdoor for arbitrary historical totals. Hosted pages consume the server ledger; those scripts remain only in the explicitly separate offline experience or become pure rendering adapters.
