# Security Specification - CapitalCalc

## Data Invariants
1. **User Profile Invariant**: A user profile (`/users/{uid}`) can only be created or modified by the authenticated user with that specific UID.
2. **Ownership Invariant**: All documents in `clients`, `simulations`, and `contacts` MUST have a `uid` field matching the creator's UID.
3. **Reference Integrity**: 
    - Simulations can optionally reference a `clientId`. If a `clientId` is provided, the client document MUST exist and belong to the same user.
4. **Immutability**: 
    - `id` and `uid` fields are immutable after document creation.
    - `createdAt` is immutable and must be set to the server time on create.
5. **Format Validation**:
    - Emails must follow a strict regex.
    - Statuses must be from a predefined enum.
    - Financial values must be non-negative.

## The "Dirty Dozen" Payloads
These payloads attempt to bypass security and should be rejected (PERMISSION_DENIED).

1. **Identity Spoofing**: Attempt to create a client for someone else.
   ```json
   { "id": "atk1", "uid": "victim_uid", "name": "Hack!", "status": "lead" }
   ```
2. **Privilege Escalation**: Attempt to change the `uid` of an existing document to "steal" it or move it.
   ```json
   { "uid": "attacker_uid" } // Update to existing doc owned by victim
   ```
3. **Ghost Field Injection**: Adding an unauthroized boolean to a client profile.
   ```json
   { "isVerified": true } 
   ```
4. **ID Poisoning**: Using a massive 1MB string as a document ID.
   ```json
   // Document ID: (long gibberish)
   ```
5. **Terminal State Shortcut**: Skipping professional verification for a client (if status logic existed, but here we'll just check status enum).
6. **Orphaned Simulation**: Creating a simulation referencing a non-existent client.
7. **Negative Investment**: Setting `initialInvestment` to -1000.
8. **PII Blanket Leak**: Authenticated user trying to list ALL clients (not just their own).
9. **Timestamp Fraud**: Providing a fake `createdAt` from the future.
10. **Shadow Key Update**: Updating a simulation and trying to change the `clientId` to a client owned by someone else.
11. **Regex Bypass**: Injecting HTML/Script into a `name` field.
12. **Self-Assigned Admin**: Trying to create a document in an `/admins/` collection (if it existed).

## Test Cases
The `firestore.rules` will be verified against these patterns.
