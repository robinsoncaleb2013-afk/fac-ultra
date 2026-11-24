# Inventory — API routes

Every route file in `src/routes/api/`. Each is thin: it turns the request into a call on the matching server code in `src/lib/` and returns the answer.

- **account** (`src/routes/api/account.ts`): The account route: who am I, sign-in links, sign out, export and delete — answered by src/lib/accounts/accounts.server.ts.

- **board** (`src/routes/api/board.ts`): The board route: tournament leaderboards, answered by src/lib/tournaments/board.server.ts.

- **catch** (`src/routes/api/catch.ts`): The catch route: submits a cast to a tournament event for server checking, answered by src/lib/tournaments/entries.server.ts.

- **entry** (`src/routes/api/entry.ts`): The entry route: joining a tournament event, answered by src/lib/tournaments/entries.server.ts.

- **epoch** (`src/routes/api/epoch.ts`): The epoch route: tells the browser which build epoch the server is on, for the test-phase reset check.

- **events** (`src/routes/api/events.ts`): The events route: the open tournament list and the schedule, answered by src/lib/tournaments/events.server.ts.

- **friends** (`src/routes/api/friends.ts`): The friends route: friends, presence and invites, answered by src/lib/tournaments/friends.server.ts.

- **google-callback** (`src/routes/api/google-callback.ts`): The Google callback route: finishes Sign in with Google for the game's accounts (src/lib/accounts/google.server.ts).

- **google-start** (`src/routes/api/google-start.ts`): The Google start route: begins Sign in with Google for the game's accounts (src/lib/accounts/google.server.ts).

- **profiles** (`src/routes/api/profiles.ts`): The profiles route: the family profiles under one account, answered by src/lib/accounts/profiles.server.ts.

- **rtc** (`src/routes/api/rtc.ts`): The rtc route: the WebRTC signaling relay for live rooms, answered by src/lib/tournaments/rtc.server.ts.

- **save** (`src/routes/api/save.ts`): The save route: cloud save slots up and down, answered by src/lib/accounts/saves.server.ts.

- **survival-board** (`src/routes/api/survival-board.ts`): The survival board route: the daily Survival leaderboard, answered by src/lib/tournaments/board.server.ts.

- **trophies** (`src/routes/api/trophies.ts`): The trophies route: tournament trophies and final standings, answered by src/lib/tournaments/awards.server.ts.
