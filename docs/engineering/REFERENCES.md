# Technical references

Consult primary sources during implementation and check the selected versions' current support/security status. Reference access date: 2026-11-08. Linked Django 5.2 documentation is a framework reference, not a claim that 5.2 is the newest release or the final dependency choice.

## Framework and database

- [Django authentication](https://docs.djangoproject.com/en/5.2/topics/auth/default/): framework user/authentication/session integration.
- [Django deployment checklist](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/): production settings, secret handling and server review.
- [Django SQLite database notes](https://docs.djangoproject.com/en/5.2/ref/databases/#sqlite-notes): backend limitations and transaction considerations.
- [SQLite WAL](https://www.sqlite.org/wal.html): write concurrency, local-host filesystem boundary, checkpoint behavior.
- [SQLite online backup](https://www.sqlite.org/backup.html): consistent database snapshot facilities.

## Security implementation references

- [OWASP authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP file upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

These references support the control categories, not a certification of this project. Timeouts, quotas, topology, performance goals, phase order and privacy defaults in this handbook are proposed LIKHA engineering decisions requiring implementation and verification.
