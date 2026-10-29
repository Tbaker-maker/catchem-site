# Morning Brief email go-live

Sending is OFF by default (`MORNING_BRIEF_EMAIL` unset).

To turn on later:
1. Reuse the existing Custom Reads mail key on the worker. Do not open a new paid mail plan without approval.
2. Set `MORNING_BRIEF_EMAIL=on` on the catchem-site Worker.
3. Confirm the Catch'em From address is verified on the mail provider.
4. Add a daily job that reads opt-in KV rows (`morning-brief-email:*`) and calls `sendMorningBriefEmail` for each one.
5. Keep the opt-in toggle on My collection. Sending stays skipped while the flag is off.
