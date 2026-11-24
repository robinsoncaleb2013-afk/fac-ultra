# Inventory — components

Every file under `src/components/` (the screens, the Hub menus, the canvas stage and their hooks). Components draw and dispatch; the rules they show live in `src/game/`.

- **NightCard** (`src/components/game/NightCard.tsx`): The night-fishing card: starting a night, and collecting what the night caught when you return.

- **TutorialOverlay** (`src/components/game/TutorialOverlay.tsx`): The tutorial overlay: the voice-guided steps drawn over the water while a new player learns.

- **account** (`src/components/game/account.tsx`): The account sheet: cloud saves, the sign-in link, conflict choices, account settings, and Clear my data with its backup restore, for the game's own accounts.

- **achievements-ui** (`src/components/game/achievements-ui.tsx`): The achievements room: the table of goals and the player's progress through them.

- **board-state** (`src/components/game/board-state.ts`): The live-board hook: keeps a tournament board polling while it is on screen.

- **board** (`src/components/game/board.tsx`): The tournament boards on screen: the live board, the team rows and the ticker feed.

- **difficulty-picker** (`src/components/game/difficulty-picker.tsx`): The difficulty picker shown when a new Expedition or Story slot starts.

- **event-social** (`src/components/game/event-social.tsx`): The social side of events on screen: the room link, the emote bar, and the invite sections.

- **events** (`src/components/game/events.tsx`): The long-play events on screen: the announcement banner, the countdown chip and the Lodge's Events list, grouped by rarity.

- **fight-ring** (`src/components/game/fight-ring.ts`): The reel fight, drawn on the water around the bobber (the tension ring and the fish's run).

- **fight-room** (`src/components/game/fight-room.tsx`): The fish-fight room screen: the queue, the tank and the room chat.

- **fullscreen** (`src/components/game/fullscreen.tsx`): The full-screen button and hook for the game screens.

- **fun-hooks** (`src/components/game/fun-hooks.ts`): Small hooks for the fun layer's screens, kept apart from the components so fast refresh stays happy.

- **fun** (`src/components/game/fun.tsx`): The fun layer's screens: ambience, the colour-blind palette, Fish of the Day, the pet and stickers.

- **hazard-alerts** (`src/components/game/hazard-alerts.tsx`): The hazard alerts: the warnings shown when a Legend danger is about to bite.

- **CodesCard** (`src/components/game/hub/CodesCard.tsx`): The Settings card where promo codes are typed in and claimed.

- **CollectionsTab** (`src/components/game/hub/CollectionsTab.tsx`): The Collections tab: a read-only look at each save's collections from the main menu.

- **CornerHud** (`src/components/game/hub/CornerHud.tsx`): The corner HUD shown over the water while fishing.

- **Hub** (`src/components/game/hub/Hub.tsx`): The Hub: the two-level menu shell that hosts every tab, outside a game and inside one.

- **HubKeys** (`src/components/game/hub/HubKeys.tsx`): Keyboard and gamepad handling for the Hub menus.

- **LeaveDialog** (`src/components/game/hub/LeaveDialog.tsx`): The leave-this-game dialog, asking the plain-English question from src/game/leave.ts.

- **LodgeTab** (`src/components/game/hub/LodgeTab.tsx`): The Lodge tab and its sub-views inside the Hub: the logbook and the collection.

- **PlayTab** (`src/components/game/hub/PlayTab.tsx`): The Play tab: the mode cards, continue, and starting a game.

- **PlayersTab** (`src/components/game/hub/PlayersTab.tsx`): The Players tab: friends, invites and the way into the live rooms.

- **Satchel** (`src/components/game/hub/Satchel.tsx`): The Satchel: the floating bag button and its sheet, for what the player is carrying.

- **SettingsTab** (`src/components/game/hub/SettingsTab.tsx`): The Settings tab and the Account tab of the Hub.

- **SurvivalTabs** (`src/components/game/hub/SurvivalTabs.tsx`): Survival's own Hub tabs: Camp, Larder and the event tab.

- **TackleTab** (`src/components/game/hub/TackleTab.tsx`): The Tackle tab and the Shop: the gear lists, and the only place buying and selling happen.

- **TitleScreen** (`src/components/game/hub/TitleScreen.tsx`): The title screen: the FAC Ultra badge, Play, and the main-menu entries.

- **WatersTab** (`src/components/game/hub/WatersTab.tsx`): The Waters tab: the map of waters, travel, and the gates between them.

- **Wheel** (`src/components/game/hub/Wheel.tsx`): The Hub's wheel menu component.

- **actions** (`src/components/game/hub/actions.ts`): What the arrow keys, the Enter key and a gamepad do inside the Hub — one place, so a keyboard and a gamepad behave alike.

- **art** (`src/components/game/hub/art.tsx`): Small framed-art components for the Hub: paintings and tackle pictures in their frames.

- **friends-data** (`src/components/game/hub/friends-data.tsx`): The friends data hook for the Players tab: loading friends and invites, and hosting the invite link.

- **icons** (`src/components/game/hub/icons.tsx`): The Hub's icon set and the Logo component, which renders the FAC Ultra emblem.

- **panel-shell** (`src/components/game/hub/panel-shell.tsx`): DarkPanel: the shared dark panel shell the Hub's papers sit in.

- **parts** (`src/components/game/hub/parts.tsx`): Shared Hub building blocks: rows, list columns, the detail paper and fact lists.

- **settings-sections** (`src/components/game/hub/settings-sections.tsx`): The Settings tab's sections: sound, graphics, full screen, account, help, controls and saves.

- **keys** (`src/components/game/keys.ts`): Keyboard controls for the game screens outside the Hub.

- **kid** (`src/components/game/kid.tsx`): Kid Mode's SpeakButton: reads words aloud for young players.

- **CastDock** (`src/components/game/layout/CastDock.tsx`): The cast dock: the cast button and the fight controls at the water's edge.

- **Celebration** (`src/components/game/layout/Celebration.tsx`): The catch celebration overlay: the leap, the catch card and the fuss a good fish deserves.

- **DesktopLayout** (`src/components/game/layout/DesktopLayout.tsx`): The desktop game layout: the stage with its rails and docks on wide screens.

- **DragButtons** (`src/components/game/layout/DragButtons.tsx`): The draggable on-screen buttons for touch play.

- **MobileLayout** (`src/components/game/layout/MobileLayout.tsx`): The phone game layout: the stage and docks arranged for touch.

- **RigControl** (`src/components/game/layout/RigControl.tsx`): The rig control: rod, reel and line pickers, and the spot chips and bar.

- **use-form** (`src/components/game/layout/use-form.ts`): A small form-state hook for the layout's sheets and popovers.

- **lobby-text** (`src/components/game/lobby-text.ts`): The plain-English words for lobby problems: why a join failed, in words a kid can read.

- **lobby** (`src/components/game/lobby.tsx`): The tournament lobby: the events, joining, teams and the room.

- **mode-label** (`src/components/game/mode-label.tsx`): ModeLabel: the little label that names the current mode.

- **overlays** (`src/components/game/overlays.tsx`): The overlay layer: the toasts and the welcome-back report.

- **BagPanel** (`src/components/game/panels/BagPanel.tsx`): The bag panel: what the player has caught and what it is worth (an older panel, shown inside the Hub).

- **CampPanel** (`src/components/game/panels/CampPanel.tsx`): Survival's camp panel: the fire, the larder and the day count (an older panel, shown inside the Hub).

- **CastPanel** (`src/components/game/panels/CastPanel.tsx`): The cast panel: spots, bounties and the boss card (an older panel, shown inside the Hub).

- **DexPanel** (`src/components/game/panels/DexPanel.tsx`): The dex panel: the species book and the sticker book (an older panel, shown inside the Hub).

- **GearPanel** (`src/components/game/panels/GearPanel.tsx`): The gear panel: rods, reels and lines at a glance (an older panel, shown inside the Hub).

- **LodgePanel** (`src/components/game/panels/LodgePanel.tsx`): The lodge panel set: the aquarium, the derby, the crew view and settings (older panels, shown inside the Hub).

- **LurePanel** (`src/components/game/panels/LurePanel.tsx`): The lure panel: the lure box and what each lure does (an older panel, shown inside the Hub).

- **RecordsSection** (`src/components/game/panels/RecordsSection.tsx`): The record book section: personal bests and stewardship (an older panel, shown inside the Hub).

- **WatersPanel** (`src/components/game/panels/WatersPanel.tsx`): The waters panel: the list of waters and travel between them (an older panel, shown inside the Hub).

- **index** (`src/components/game/panels/index.tsx`): The panels folder's Panel switch: renders the panel for whichever tab is open.

- **shared** (`src/components/game/panels/shared.tsx`): Small shared panel pieces: the stat, badge, filter, toggle and art thumbnail.

- **pet-fx** (`src/components/game/pet-fx.ts`): The pet, drawn from simple shapes in three frames: rest, and two cheer frames.

- **photo** (`src/components/game/photo.ts`): Takes a photo of the stage canvas for sharing.

- **portrait** (`src/components/game/portrait.tsx`): FishPortrait: a small canvas that draws one fish swimming in place.

- **rarity-mark** (`src/components/game/rarity-mark.tsx`): RarityMark: the small rarity badge drawn on fish and cards, with a shape as well as a colour.

- **sessions** (`src/components/game/sessions.ts`): Counts play sessions on this device and remembers which hints have been dismissed.

- **shell** (`src/components/game/shell.tsx`): The Game component: the screen router (title, main menu, game) and the overlays. Layouts live in layout/.

- **slots** (`src/components/game/slots.tsx`): The save-slot picker: choosing, naming and starting slots.

- **stage-paint** (`src/components/game/stage-paint.ts`): One frame of the stage, painted in the documented order: painting, water effects, fish, the fight ring.

- **stage** (`src/components/game/stage.tsx`): The canvas: the requestAnimationFrame loop that ticks the engine's frame and paints the water, fish and effects.

- **story-ui** (`src/components/game/story-ui.tsx`): Story mode's on-screen pieces: the chapter chip and the Story room.

- **survival-fx** (`src/components/game/survival-fx.ts`): Survival's one extra picture: the campfire glow, an additive warm radial gradient.

- **survival** (`src/components/game/survival.tsx`): Survival's screens: the HUD, the start and end cards, the cast card and the runs log.

- **test-phase** (`src/components/game/test-phase.tsx`): The test-phase notices: the testing line and the reset notice players see.

- **tournament** (`src/components/game/tournament.tsx`): The in-event tournament panel and the ticker.

- **trips** (`src/components/game/trips.tsx`): Recreational trips on screen: starting a trip, the trip card, the trip bar and the logbook.

- **trophies** (`src/components/game/trophies.tsx`): The trophy shelf and the tournament history on screen.

- **trophy-room** (`src/components/game/trophy-room.tsx`): The Trophy Room screens: the personal-best plaques and the Kids book.

- **use-kid** (`src/components/game/use-kid.ts`): Hooks for Kid Mode in components: whether it is on, its rules, and reading words aloud.

- **use-mutation** (`src/components/game/use-mutation.ts`): A tiny hook that words a mutation's name and effect for catch cards.

- **use-tick** (`src/components/game/use-tick.ts`): A tiny hook that re-renders a component on a timer.

- **water-fx** (`src/components/game/water-fx.ts`): The living-water effects stack: the layers between the painting and the fish.

- **preview-host-bridge** (`src/components/preview-host-bridge.tsx`): Mounts once in the root route so the Grok preview chrome can drive navigation; a no-op when the app is not embedded.

- **button** (`src/components/ui/button.tsx`): The one shared UI primitive: the Button, used outside the game's own screens.
