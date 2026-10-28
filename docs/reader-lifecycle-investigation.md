# Installed reader lifecycle candidate
Base: 62828f11d2512961a2e5ec671d0bb09049efdd84
Build: reader-lifecycle-20261028-r1

Reproduced code defects: stale playing state after visibility-only suspension,
unhandled native pause/persisted restoration, idle cancellation, same-turn cancel/speak,
and missing bounded voice-readiness retry. These do not prove the sole cause of actual
iPhone silence. The job runs existing code-integrity commands and all 15 regressions;
actual output, code commit SHA and baseline comparison are in reader-lifecycle-ci.json.

The patch checkpoints/resets interrupted speech, invalidates callbacks, retries Samantha
availability and waits for a new gesture after required cancellation. A reset during
seek/rate changes may require another Play tap. Automatic passage continuation stays.
Samantha-only selection, storage keys, imported text, position and bookmarks remain.
A build label and text-free snapshot identify the running code. No new audio APIs.
Manifest/worker scope and network-first policy are unchanged; only cache version changes.
No evidence identifies caching as the cause. No user storage is cleared.

This branch is not deployed and audible iPhone acceptance is not verified. After reviewed
deployment, reopen the existing installed app online, confirm the build label, audibly
play imported text and an introduction, background/reopen and tap Play to verify audible
continuation and position. Do not reinstall or delete storage. Safari-only success fails
acceptance. Simulated speech tests do not prove real sound.
