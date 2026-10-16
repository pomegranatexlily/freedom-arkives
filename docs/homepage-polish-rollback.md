# Homepage polish rollback point

Pre-polish main commit: 1bea81cd5e267949982df5e0370a8c7a760cf4fe

The approved polish changes app-navigation.js, app-navigation.css, and privacy-consent.js; packages the original Schibsted Grotesk font plus its OFL license under assets/fonts; and refreshes sw.js through the publishing workflow.

For rollback, restore those three source files and .github/workflows/compact-homepage.yml from the pre-polish commit together in one commit. Restoring the workflow prevents the polish script from reapplying. The unused packaged font may remain without affecting the old UI.

Do not revert the book catalog, manuscripts, reader files, artwork, or iPhone Home Screen icon. No new branch is required.
