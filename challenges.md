Challenging Your Ideas

  The "no server" claim needs nuance:
  - You still need a signaling server for WebRTC peer discovery and connection establishment. This can be lightweight (e.g., a serverless function, Firebase Realtime DB, or even a free
  service like PeerJS server).
  - STUN/TURN servers are needed for NAT traversal — without TURN, ~10-15% of users behind strict NATs won't be able to connect at all. Free STUN exists (Google's), but TURN costs money.
  - The invite link itself needs to resolve somewhere — a URL must point to something.

  Host migration is the hardest problem here:
  - When the host leaves, all peers must agree on the new host (consensus). What if two peers think they're the new host (split-brain)?
  - In-flight state (poll votes, poker hands, chat history) must be replicated across peers before the host can safely leave. If the host crashes (closes browser), unreplicated state is
  lost.
  - Consider: should every peer hold the full state (CRDT-based), making "host" just the signaling coordinator rather than the source of truth?

  WebRTC mesh doesn't scale:
  - With N peers, you get N*(N-1)/2 connections. Beyond ~6-8 people, bandwidth and CPU become problematic, especially for video/screen sharing.
  - Do you want to cap session size, or plan for larger groups?

  Security without a server:
  - How do you prevent someone from forging an invite link or joining uninvited?
  - Without server-side auth, identity is self-declared — anyone can claim to be anyone.
