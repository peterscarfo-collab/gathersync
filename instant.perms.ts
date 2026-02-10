// Docs: https://www.instantdb.com/docs/permissions

import type { InstantRules } from "@instantdb/react";

// Perms revision: 2026-02-10c
const rules = {
  // Users can only see their own data
  $users: {
    allow: {
      view: "isOwner",
      update: "isOwner",
      create: "false", // InstantDB handles user creation through auth
      delete: "false", // Never allow user deletion via client
    },
    bind: {
      "isOwner": "auth.id != null && auth.id == data.id",
    },
  },

  // Events - authenticated users can view; only creators can modify
  events: {
    allow: {
      view: "isAuthenticated",
      create: "isAuthenticated",
      update: "isOwner",
      delete: "isOwner",
    },
    bind: {
      "isAuthenticated": "auth.id != null",
      "isOwner": "auth.id != null && data.creator != null && auth.id == data.creator.id",
    },
  },

  // Participants - authenticated users can view; creation allowed for authed users
  participants: {
    allow: {
      view: "isAuthenticated",
      create: "isAuthenticated",
      update: "isEventOwner",
      delete: "isEventOwner",
    },
    bind: {
      "isEventOwner": "auth.id != null && data.event != null && data.event.creator != null && auth.id == data.event.creator.id",
      "isAuthenticated": "auth.id != null",
    },
  },

  // Event Snapshots - only creator can manage
  eventSnapshots: {
    allow: {
      view: "isOwner",
      create: "isAuthenticated",
      update: "isOwner",
      delete: "isOwner",
    },
    bind: {
      "isAuthenticated": "auth.id != null",
      "isOwner": "auth.id != null && data.creator != null && auth.id == data.creator.id",
    },
  },

  // Group Templates - only creator can manage
  groupTemplates: {
    allow: {
      view: "isOwner",
      create: "isAuthenticated",
      update: "isOwner",
      delete: "isOwner",
    },
    bind: {
      "isAuthenticated": "auth.id != null",
      "isOwner": "auth.id != null && data.creator != null && auth.id == data.creator.id",
    },
  },

  // Push Tokens - only owner can manage their own tokens
  pushTokens: {
    allow: {
      view: "isOwner",
      create: "isAuthenticated",
      update: "isOwner",
      delete: "isOwner",
    },
    bind: {
      "isAuthenticated": "auth.id != null",
      "isOwner": "auth.id != null && data.user != null && auth.id == data.user.id",
    },
  },
} satisfies InstantRules;

export default rules;
