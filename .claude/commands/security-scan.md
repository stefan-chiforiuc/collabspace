# /security-scan — Scan for Credentials and Vulnerabilities

Run a security scan of the codebase to find credentials, secrets, and common vulnerabilities.

## Instructions
1. Search the entire codebase for:
   - Patterns: `password`, `secret`, `token`, `api_key`, `apikey`, `auth_token`, `credential`, `private_key`
   - Base64 strings that look like keys (40+ character strings)
   - URLs with embedded credentials (`https://user:pass@`)
   - Private key headers (`-----BEGIN`)
   - `.env` files not listed in `.gitignore`
   - Hardcoded IP addresses or internal URLs
2. Check for common vulnerabilities:
   - `innerHTML` usage without sanitization (XSS risk)
   - `eval()` or `Function()` usage
   - `document.write()` usage
   - Unsanitized URL parameters
3. Verify `.gitignore` includes: `.env`, `.env.*`, `*.pem`, `*.key`
4. Report findings with severity (Critical/High/Medium/Low) and file locations.
5. If any credentials are found, **immediately flag them** and recommend remediation.

$ARGUMENTS
