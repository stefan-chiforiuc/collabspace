● Why You Need a Signaling Server

  The fundamental problem: how does Peer B find Peer A in the first place?

  When you click an invite link, your browser knows it wants to connect to a session — but WebRTC doesn't work like a website URL. You can't just "dial" an IP address. Before two browsers
  can talk directly, they need to exchange connection metadata (called SDP offers/answers) — things like "I support these codecs, I'm reachable at these network candidates, here's my
  encryption fingerprint."

  This exchange has to happen through some channel that both peers can already reach. That's the signaling server — it's just a message relay for the initial handshake. Think of it like a
  matchmaker: it introduces two people, then leaves. It doesn't participate in the conversation.

  Why can't Peer A (the session creator) be the signaling server? Because to reach Peer A's "server," Peer B's browser would need to make an HTTP request to Peer A's IP address and port.
  But:
  - Peer A is behind a home router/NAT — not publicly reachable
  - Even if they were, browsers can't listen on arbitrary ports like a traditional server
  - The invite link has to point to a domain name that resolves to something — Peer A doesn't have one

  So the signaling server is the only part that needs a real address. The good news: it's stateless, handles tiny payloads, and can be a free-tier Cloudflare Worker or Firebase instance.
  After the handshake, it's not involved at all.

  STUN — "What's my public address?"

  Your computer sits behind a router (NAT). It has a private IP like 192.168.1.42, but the outside world sees your router's public IP like 85.214.107.3. Your computer doesn't know that
  public address.

  STUN (Session Traversal Utilities for NAT) is a simple server that your browser asks: "Hey, what IP and port do you see me coming from?" The STUN server replies: "You're
  85.214.107.3:54821." Now your browser can tell the other peer: "Reach me at this address."

  - STUN servers are free (Google runs public ones)
  - They're tiny — a single request/response, no ongoing involvement
  - Works for ~85% of users whose NATs are cooperative

  TURN — "I literally can't be reached, relay for me"

  Some NATs are strict (corporate firewalls, symmetric NATs). Even after STUN reveals your public address, the other peer's packets get blocked because the NAT only accepts replies from
  the exact server you originally contacted.

  TURN (Traversal Using Relays around NAT) is a relay server. When direct connection fails, both peers send their traffic through the TURN server. It's a fallback — the data flows through
  a middleman instead of peer-to-peer.

  - TURN servers cost money because they relay all the actual traffic (video, files, everything)
  - Needed by roughly 10-15% of users
  - Without TURN, those users simply can't connect

  The flow in practice

  Peer A creates session
           │
           ▼
  ┌─────────────────┐    1. "I exist, here's my session ID"
  │ Signaling Server │◄──────────────────────────────────
  │  (free/tiny)     │
  └─────────────────┘
           │
  Peer B opens invite link, app loads from your domain
           │
           ▼
  ┌─────────────────┐    2. "I want to join session X"
  │ Signaling Server │◄──────────────────────────────────
  └─────────────────┘
           │
           │  3. Relay SDP offers/answers between A and B
           ▼
  ┌────────┐         ┌────────┐
  │ Peer A │ ◄─────► │ STUN   │  4. Both peers ask STUN
  └────────┘         └────────┘     "what's my public IP?"
           │
           ▼
  ┌────────┐         ┌────────┐
  │ Peer A │ ◄═════► │ Peer B │  5. Direct connection!
  └────────┘  WebRTC └────────┘     Signaling server no
                                    longer involved.

           OR if direct fails:

  ┌────────┐         ┌────────┐
  │ Peer A │ ◄──►┌──────┐◄──► │ Peer B │  6. TURN relay
  └────────┘     │ TURN │     └────────┘     (fallback)
                 └──────┘

  Bottom line: The signaling server is unavoidable but trivially cheap (a single serverless function). STUN is free. TURN is the only potential cost, and you can start without it
  (accepting some users won't be able to connect) or use a service with a free tier.