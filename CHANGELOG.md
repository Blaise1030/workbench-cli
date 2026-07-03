# Changelog

## [0.9.0](https://github.com/Blaise1030/workbench-cli/compare/v0.8.1...v0.9.0) (2026-07-03)


### Features

* LAN mode with rotating single-use 30s invite tokens ([813d324](https://github.com/Blaise1030/workbench-cli/commit/813d324667b9400c7320cfb18105d062a1cb71ef))
* **lan:** add rotating single-use invite tokens for secure LAN access (30s) ([b022f39](https://github.com/Blaise1030/workbench-cli/commit/b022f3923a075269ef3c616b80790776cac9920c))


### Bug Fixes

* **terminal:** suppress input forwarding during scrollback replay ([d64642c](https://github.com/Blaise1030/workbench-cli/commit/d64642cbda9e259538df32cb7fd85d00b0b33f5d))
* **terminal:** suppress input forwarding during scrollback replay ([defd245](https://github.com/Blaise1030/workbench-cli/commit/defd24573847f0c3d4649d7790ad925006df3f06))

## [0.8.1](https://github.com/Blaise1030/workbench-cli/compare/v0.8.0...v0.8.1) (2026-06-17)


### Bug Fixes

* **agents:** always show install prompt regardless of hooks enabled state ([87b9a5f](https://github.com/Blaise1030/workbench-cli/commit/87b9a5f26ce6325c0d51948b47706b42fc15dea8))
* **agents:** always show install prompt regardless of hooks enabled state ([f602144](https://github.com/Blaise1030/workbench-cli/commit/f602144c71dc05d249f9a452233e92d3d70d1439))

## [0.8.0](https://github.com/Blaise1030/workbench-cli/compare/v0.7.1...v0.8.0) (2026-06-13)


### Features

* **events:** scope event bus and watcher subscriptions per workspace ([2511ac8](https://github.com/Blaise1030/workbench-cli/commit/2511ac8ba48f6165be775ac91cf81730470dd0a7))
* **sessions:** add self-contained session context label and payload fields ([e5fedb5](https://github.com/Blaise1030/workbench-cli/commit/e5fedb547a9af7460211014cc67d636c84659f26))
* **sessions:** enrich ListAgentTerminals with project name and branch ([646bc61](https://github.com/Blaise1030/workbench-cli/commit/646bc61ab858e579df46ea451b36d6d4a229ac29))
* **sessions:** render sidebar session labels from payload, drop worktreeContextMap ([6b14cdb](https://github.com/Blaise1030/workbench-cli/commit/6b14cdba19e799b58ceaee0b7e32279eaf37d4ae))
* **sessions:** return projectName and branch from GET /api/sessions ([1de3628](https://github.com/Blaise1030/workbench-cli/commit/1de362818f423ab53a633f07c9cb899ac4040b19))
* **workspace:** single sidebar fetch for all worktrees grouped by project ([0f7e855](https://github.com/Blaise1030/workbench-cli/commit/0f7e855a04063d64a3dcde7b9390b58c9fb6c6c5))

## [0.7.1](https://github.com/Blaise1030/workbench-cli/compare/v0.7.0...v0.7.1) (2026-06-12)


### Bug Fixes

* **git:** stop git-panel polling storm + terminal tab/perf fixes ([3fd5e1c](https://github.com/Blaise1030/workbench-cli/commit/3fd5e1c99a4b65cc84a99087f839d55a520c08c9))
* **git:** stop git-panel polling storm from .git/index chmod echo ([c3aec22](https://github.com/Blaise1030/workbench-cli/commit/c3aec22dbb28bcc8450760148a1c72e42fd4e51b))
* **git:** untracked tab + eliminate index.lock contention (apps layout) ([de23669](https://github.com/Blaise1030/workbench-cli/commit/de23669ab7e50791f3ecba46c9fdd9ddcb143b49))


### Performance Improvements

* **terminal:** memoize file-path set in link provider ([f248e8b](https://github.com/Blaise1030/workbench-cli/commit/f248e8bbfbf1f3fd896f3776b39dce2d0f3d9943))
* **terminal:** reuse xterm instance across agent switches ([8d25594](https://github.com/Blaise1030/workbench-cli/commit/8d2559441f1e70c679f855af7f2be5722f695fc1))

## [0.7.0](https://github.com/Blaise1030/workbench-cli/compare/v0.6.0...v0.7.0) (2026-06-10)


### Features

* push-driven updates, clear attention on visit, and UI polish ([5953630](https://github.com/Blaise1030/workbench-cli/commit/5953630d109e3cc458dc4c6c4b9ebf1e6f44fc1c))
* **settings:** add Copy prompt button for /etc/hosts setup ([8d3c114](https://github.com/Blaise1030/workbench-cli/commit/8d3c114bf5186fa67637c97541230a0afcff3a48))
* **settings:** add hosts setup prompt builder ([5606ae2](https://github.com/Blaise1030/workbench-cli/commit/5606ae2b2104a7ba8de6c47da5b69b0d42bebbfa))

## [0.6.0](https://github.com/Blaise1030/workbench-cli/compare/v0.5.0...v0.6.0) (2026-06-09)


### Features

* added file watcher and notification ([13d0bba](https://github.com/Blaise1030/workbench-cli/commit/13d0bba820b7178591404acdec4602a5097c672c))
* revert agent page syncing code, replaced with prompt instead ([45ba7d8](https://github.com/Blaise1030/workbench-cli/commit/45ba7d835d31ed02e5f5e7248cd23e4711f897d2))

## [0.5.0](https://github.com/Blaise1030/workbench-cli/compare/v0.4.4...v0.5.0) (2026-06-09)


### Features

* updated settings module ([39c1203](https://github.com/Blaise1030/workbench-cli/commit/39c1203ac03cb92de0f88f546af2aa25f7b8fbe4))


### Bug Fixes

* fixed vulnerability ([a3b2c2d](https://github.com/Blaise1030/workbench-cli/commit/a3b2c2d4fd23bcceb3c47a7470fcbecdcd0f880f))

## [0.4.4](https://github.com/Blaise1030/workbench-cli/compare/v0.4.3...v0.4.4) (2026-06-09)


### Bug Fixes

* **ci:** fix go binary output path after apps/ reorganization ([85b5b6d](https://github.com/Blaise1030/workbench-cli/commit/85b5b6df286f4dd9e52ba82a65267e2f8561a9b3))

## [0.4.3](https://github.com/Blaise1030/workbench-cli/compare/v0.4.2...v0.4.3) (2026-06-07)


### Bug Fixes

* prevent app code-split chunks from failing Shiki bundle assertion ([9142ec5](https://github.com/Blaise1030/workbench-cli/commit/9142ec5d7e8491b25de291a993ce3e550c1e05f7))

## [0.4.2](https://github.com/Blaise1030/workbench-cli/compare/v0.4.1...v0.4.2) (2026-06-07)


### Bug Fixes

* added unstaged changes ([627f278](https://github.com/Blaise1030/workbench-cli/commit/627f2787f189ac275a6f093e258185012cd89bc9))

## [0.4.1](https://github.com/Blaise1030/workbench-cli/compare/v0.4.0...v0.4.1) (2026-06-07)


### Bug Fixes

* restore missing frontend files and auto-trigger release pipeline ([f44daf9](https://github.com/Blaise1030/workbench-cli/commit/f44daf9354a81f3b3954eba4feadee223d208c8a))

## [0.4.0](https://github.com/Blaise1030/workbench-cli/compare/v0.3.0...v0.4.0) (2026-06-07)


### Features

* add terminal agent picker and project remove context menu ([fea07a5](https://github.com/Blaise1030/workbench-cli/commit/fea07a5380ea804947db413b425713f230862ed6))
* **frontend:** add context menu, drag-and-drop, delete and new-entry dialogs to file explorer ([67bf983](https://github.com/Blaise1030/workbench-cli/commit/67bf983d9b2b3f847f5b846bf355fcb20099eaa0))
* **frontend:** add useCreateFile, useDeleteFile, useMoveFile hooks ([8cb17f3](https://github.com/Blaise1030/workbench-cli/commit/8cb17f3c664c1b9b0609af3671acbb994cabab3b))
* **frontend:** add VanJS file context menu builder ([78e8c71](https://github.com/Blaise1030/workbench-cli/commit/78e8c71b5225856575e1e4e7600dcf83afa91f76))
* **go:** add CreateFile, DeleteFile, MoveFile to workspace ([2a7586b](https://github.com/Blaise1030/workbench-cli/commit/2a7586b4826c3609cc97a6c1813b1d46e042d017))
* **go:** register POST /files, DELETE /files, POST /files/move routes ([9bc7ab6](https://github.com/Blaise1030/workbench-cli/commit/9bc7ab62f7825ff8dcda6e3ea4138060db1f78db))
* terminal agent picker and project remove context menu ([c670cb8](https://github.com/Blaise1030/workbench-cli/commit/c670cb84b071619025a93e93c9b1a23c8d0be564))
* updated toaster not showing issue ([987e805](https://github.com/Blaise1030/workbench-cli/commit/987e80504315b77b1afe0387183cb8e9723416f3))


### Bug Fixes

* add missing install.sh template to git tracking ([fd7af3b](https://github.com/Blaise1030/workbench-cli/commit/fd7af3b8e0b84aec19218ff8b4c5c3ba7abfad91))
* **frontend:** add success toasts to mutations and fix empty-state layout ([cb25d30](https://github.com/Blaise1030/workbench-cli/commit/cb25d307e6a48c1c0b023189cb940c3296750206))
* **frontend:** add success toasts to mutations and fix empty-state layout ([ae15859](https://github.com/Blaise1030/workbench-cli/commit/ae158595d2f8c200de7a93eb141b101bd0761811))
* landing page build issues ([fa71c24](https://github.com/Blaise1030/workbench-cli/commit/fa71c24f5ea616dbbc317a17282f471bc5b10941))
* **landing:** derive PAGES_BASE from Astro.site instead of hardcoded domain ([ea263b7](https://github.com/Blaise1030/workbench-cli/commit/ea263b76211c32fab95f0d9356e6824e1969cf3e))
* updated git panel stylings and experiences ([97f54fc](https://github.com/Blaise1030/workbench-cli/commit/97f54fce257e3af9b3e45a90dc7dbc0ef5e4b3dd))
* **workspace:** address PR review quality concerns ([6366bc5](https://github.com/Blaise1030/workbench-cli/commit/6366bc5ef872c61e04723ef95a76d5670866f512))
* **workspace:** allow importing non-git directories as projects ([504553f](https://github.com/Blaise1030/workbench-cli/commit/504553faafff297b4461d62487265676c7e19b83))
* **workspace:** allow importing non-git directories as projects ([231cea2](https://github.com/Blaise1030/workbench-cli/commit/231cea25472b1a57ded4442d6d3897e46e65391a))
* **workspace:** resolve CodeQL path-injection and git panel loading state ([dadce66](https://github.com/Blaise1030/workbench-cli/commit/dadce66198dad690a92d47f132b6c450454bb75f))
* **workspace:** validate project paths via git instead of os.Stat ([9dfdb70](https://github.com/Blaise1030/workbench-cli/commit/9dfdb7063f9c657407209bc6e8ce0ff5d348b870))

## [0.3.0](https://github.com/Blaise1030/workbench-cli/compare/v0.2.0...v0.3.0) (2026-06-04)


### Features

* add CLI entrypoint with TLS setup and server start ([aed0809](https://github.com/Blaise1030/workbench-cli/commit/aed0809c5f8b5a2996afc5949ca61517257a140c))
* add CodeMirrorEditor component ([ef29025](https://github.com/Blaise1030/workbench-cli/commit/ef290256cc97995940fb5bcc963dc8ba7fbb2ae8))
* add Cursor Agent and Gemini CLI session resume ([2884e31](https://github.com/Blaise1030/workbench-cli/commit/2884e311b9e15eee2a09682d6d25c9ed59d1fcb2))
* add detectLanguage helper for CodeMirror ([52df19b](https://github.com/Blaise1030/workbench-cli/commit/52df19b49711336994c839dfaddfce259b2eb24a))
* add dirty-dot indicator to FileTabList ([180f68c](https://github.com/Blaise1030/workbench-cli/commit/180f68ca62a900bd0e6f82aa5f41a99546410eeb))
* add GeneralSettings view ([3f22e45](https://github.com/Blaise1030/workbench-cli/commit/3f22e45b51b3cc6bb88210268d8122bcebf6cee5))
* add git diff panel with @pierre/diffs CodeView ([323f868](https://github.com/Blaise1030/workbench-cli/commit/323f868414049c981738a99af0f115c1c38ed772))
* add Hono app factory with POST /auth and cookie session ([c670ef1](https://github.com/Blaise1030/workbench-cli/commit/c670ef1d2c1d44966affd09bb849392ecc475dda))
* add Login.vue with token form and error states ([0f9e295](https://github.com/Blaise1030/workbench-cli/commit/0f9e295210266a1f42be52d8a4fc8eccea94e340))
* add nested routes for workspace panels and settings tabs ([379a1a9](https://github.com/Blaise1030/workbench-cli/commit/379a1a964ef4534f3bbd6c23cb362dc0dd37cdb1))
* add NetworkSettings view ([b695f7c](https://github.com/Blaise1030/workbench-cli/commit/b695f7c98066419cef8852f676c76ef5572939fa))
* add PR preview workflow with dev release installs ([8906a87](https://github.com/Blaise1030/workbench-cli/commit/8906a87139fabe3fea2ad631357f396fce381f7d))
* add PUT /worktrees/:id/files/content endpoint ([f69a141](https://github.com/Blaise1030/workbench-cli/commit/f69a14119a5124e08e536f8b5dad9812170a1252))
* add session state module with sid + active tracking ([ed53e0d](https://github.com/Blaise1030/workbench-cli/commit/ed53e0de5979eb77c8a6cb07bebfb4d341f9fa66))
* add settings tab bar with RouterView, delete Settings.vue ([41ebcf5](https://github.com/Blaise1030/workbench-cli/commit/41ebcf5e3018f89dd7648e2577c6bf11e8005de7))
* add terminal file path link provider ([06292f2](https://github.com/Blaise1030/workbench-cli/commit/06292f27b8f432924fd412122b7151bb1ef81766))
* add tls.ts with mkcert detection, cert generation, and caching ([ed8a104](https://github.com/Blaise1030/workbench-cli/commit/ed8a104c4d1451c28d6594022b0b3528ae53b35d))
* add useFileEditorSave composable ([1e5640e](https://github.com/Blaise1030/workbench-cli/commit/1e5640ebf5aae85df922d563faad67ae28f042db))
* added file search and theme selector ([647e8f8](https://github.com/Blaise1030/workbench-cli/commit/647e8f8d9744aeec16342fe3f9334e033f41a350))
* added file tabs ([d9283db](https://github.com/Blaise1030/workbench-cli/commit/d9283db59502960e433b29fd4eb4c2fc838b2a62))
* added go server ([ce40f5c](https://github.com/Blaise1030/workbench-cli/commit/ce40f5c5941687824998690a6e18194e7d2fb1aa))
* added landing page ([709314f](https://github.com/Blaise1030/workbench-cli/commit/709314fe8284fddf12c1906ae79a8739a38433da))
* **auth:** add CSRF Origin header validation middleware ([990c648](https://github.com/Blaise1030/workbench-cli/commit/990c64846557009f5214e603673d194a14aba2f6))
* **auth:** add per-IP rate limiting on token auth endpoint (10 req/min) ([efb00a8](https://github.com/Blaise1030/workbench-cli/commit/efb00a8bdb3cf0d7ba087e92667f27aa345f037e))
* branch switcher with keyboard navigation and combobox UI ([42b4410](https://github.com/Blaise1030/workbench-cli/commit/42b4410bb93d3a22a93190a447dff1c41ad7963c))
* **command-palette:** add CommandPalette component ([47e0482](https://github.com/Blaise1030/workbench-cli/commit/47e048279283a86326af2a3a09b1db0e2f846890))
* **command-palette:** add static command registry ([0570a6f](https://github.com/Blaise1030/workbench-cli/commit/0570a6f71e012b3182ba86dc3d674fc6799d091a))
* **command-palette:** add useCommandPalette singleton composable ([53287c1](https://github.com/Blaise1030/workbench-cli/commit/53287c116761964b0b296a23fdb64361e67d98d1))
* **command-palette:** add useFileSearch composable ([a51e336](https://github.com/Blaise1030/workbench-cli/commit/a51e336a8fb751667bd89ca202c53e0ba0d46a21))
* **command-palette:** mount palette in WorkspaceView and wire actions ([b5d2abc](https://github.com/Blaise1030/workbench-cli/commit/b5d2abcc3109c08c2b4d00776f5807691aead284))
* complete LAN terminal security hardening and CLI packaging ([6608d18](https://github.com/Blaise1030/workbench-cli/commit/6608d18ca6126c14408369fed4d9dc5d4611f023))
* **context-queue:** add formatQueueAppend helper ([8f579c3](https://github.com/Blaise1030/workbench-cli/commit/8f579c3bfab9153eadcae699adc3e48d95bb9620))
* **context-queue:** add worktree scratch queue for terminal prompts ([e8b8ce4](https://github.com/Blaise1030/workbench-cli/commit/e8b8ce45309d4d04715436c38b8f09b46244b77b))
* **docs:** add content collection schema ([6f15b72](https://github.com/Blaise1030/workbench-cli/commit/6f15b72affce4ec8ecf0fafb6dbeca5c423ca566))
* **docs:** add docs index page ([3b3e643](https://github.com/Blaise1030/workbench-cli/commit/3b3e64305d9bbfff08d37a40720d520964495c9d))
* **docs:** add DocsLayout with two-column sidebar ([a05df36](https://github.com/Blaise1030/workbench-cli/commit/a05df36ca51b8986522d37b7b01132cc036dec7f))
* **docs:** add dynamic doc page route ([194c877](https://github.com/Blaise1030/workbench-cli/commit/194c8778ff1af46fe8bc3e5d11175f5e31fec901))
* **docs:** add getting-started and concepts content ([e219f2c](https://github.com/Blaise1030/workbench-cli/commit/e219f2c4c42e176ec0dfb66cff9d9668791a2b98))
* **docs:** make sidebar DOCS nav a collapsible details/summary ([92f1f15](https://github.com/Blaise1030/workbench-cli/commit/92f1f1523917e2330e38e4538e4344360529b517))
* **docs:** use MarkdownLink in sidebar and nav, add showHref prop ([cbfe7d5](https://github.com/Blaise1030/workbench-cli/commit/cbfe7d50b8ccfcacd40dd832309dfc648359a4dd))
* **git:** completed git module ([b4152de](https://github.com/Blaise1030/workbench-cli/commit/b4152de0671d7a7b6dae46318f6521dd95015bb4))
* Hono server with LAN IP detection and session token ([c481870](https://github.com/Blaise1030/workbench-cli/commit/c4818704a0f209272b85c959588f7f38e322fed9))
* implement file explorer with tree, preview, and git status ([2c253ed](https://github.com/Blaise1030/workbench-cli/commit/2c253edee6e64027b788b595c454fc3a1be4ad84))
* implement session restore (persistent PTY, scrollback, agent resume) ([8b0a843](https://github.com/Blaise1030/workbench-cli/commit/8b0a84347d947afec1e5b4f3fb1784a2d4b49adc))
* **keybindings:** add client types and default bindings ([f799fe2](https://github.com/Blaise1030/workbench-cli/commit/f799fe2a3df1a6a7e38ee324ed472ad7fd306488))
* **keybindings:** add Hono router with GET and PUT handlers ([d585557](https://github.com/Blaise1030/workbench-cli/commit/d585557938c7732ea490078914cb040ae2852c7f))
* **keybindings:** add KeybindingsMap schema types ([98e2316](https://github.com/Blaise1030/workbench-cli/commit/98e2316b4e6982d7db922f969e0d4cf513e2d76f))
* **keybindings:** add KeybindingsSettings page with key capture and save ([7b6e408](https://github.com/Blaise1030/workbench-cli/commit/7b6e408bbcd5aa98da6453070b8010fac525cfbd))
* **keybindings:** add server store with file I/O and tests ([8d8ec27](https://github.com/Blaise1030/workbench-cli/commit/8d8ec2740ebfd13b5245c5b404545508368381cb))
* **keybindings:** add settings-keybindings route and tab ([dff68f8](https://github.com/Blaise1030/workbench-cli/commit/dff68f89393bf4212e70670331eb4d8f58e4786e))
* **keybindings:** add TanStack Query fetch and update mutation ([146b81f](https://github.com/Blaise1030/workbench-cli/commit/146b81f5ab391158528a88b24fbfab60e2074b94))
* **keybindings:** add useWorkspaceKeybindings composable ([3921aaa](https://github.com/Blaise1030/workbench-cli/commit/3921aaa02377d8338475217ff4c9b6348c39cb82))
* **keybindings:** register keybindings router at /api/keybindings ([bddb5ba](https://github.com/Blaise1030/workbench-cli/commit/bddb5ba5016cfd84156420c86b84df45e16563c7))
* **keybindings:** wire useWorkspaceKeybindings into TerminalWorkspace ([02e9403](https://github.com/Blaise1030/workbench-cli/commit/02e9403066731fe37ac091a177c6b8870eedfde2))
* LAN web terminal — complete ([bf016ba](https://github.com/Blaise1030/workbench-cli/commit/bf016ba26734022ec58d75586545e01d745688f2))
* **landing:** add fullWidth prop to Layout ([8b7b1bf](https://github.com/Blaise1030/workbench-cli/commit/8b7b1bf4fbde6de9d8a48ca151a61713bb1817ef))
* **landing:** add global styles, favicon, and Cloudflare config ([d28ff40](https://github.com/Blaise1030/workbench-cli/commit/d28ff404a5295e7bc8a85570ba7e879d241c226c))
* **landing:** add light-mode preview images and rename tab to GIT DIFF ([ec32396](https://github.com/Blaise1030/workbench-cli/commit/ec32396a3299a80a4e2a8ea16ea8d1bf297ca18d))
* **landing:** add screenshot asset, fullWidth layout prop, and FeaturePan component ([a3f9950](https://github.com/Blaise1030/workbench-cli/commit/a3f9950f61536d7033f35bd7a1c35556b5c3b5af))
* **landing:** add static releases page from GitHub API ([3957505](https://github.com/Blaise1030/workbench-cli/commit/39575050cac68a2de007f5261932c5a0dec6636c))
* **landing:** add two-column layout, content in left column ([688256a](https://github.com/Blaise1030/workbench-cli/commit/688256a90cc5636b6985779266f062404008def9))
* **landing:** add workbench screenshot asset ([b28f7d5](https://github.com/Blaise1030/workbench-cli/commit/b28f7d58e44d4437029440465db876e875020588))
* **landing:** build landing page with raw text-file aesthetic ([ba1d7c9](https://github.com/Blaise1030/workbench-cli/commit/ba1d7c98560b7a301dda70d516cfce3fd019e456))
* **landing:** redesign index page with cmux-inspired single-column layout ([0fad0d0](https://github.com/Blaise1030/workbench-cli/commit/0fad0d01b409337dc2fd26b15a06a2f0183d01ab))
* **landing:** scaffold Astro + Cloudflare static project ([16df7cb](https://github.com/Blaise1030/workbench-cli/commit/16df7cbe06a3ca78fe10f731bb77242fd3e54fdf))
* **landing:** two-column layout with sticky FeaturePan on index page ([a88afca](https://github.com/Blaise1030/workbench-cli/commit/a88afca36c5110ffd97e39db40b34cc6788b172f))
* localhost-first bind with settings UI and invite QR ([3078b40](https://github.com/Blaise1030/workbench-cli/commit/3078b40c27a94f5901977a8e91c0566fe243612d))
* notifications, agents config, and worktree/git panel bug fixes ([28bf410](https://github.com/Blaise1030/workbench-cli/commit/28bf41021c536a662badb1626c245475983e8e3e))
* notifications, agents config, and worktree/git panel bug fixes ([85c1ed2](https://github.com/Blaise1030/workbench-cli/commit/85c1ed257599d679611bb08c30bad88cf64bea75))
* refactor TerminalWorkspace to use Vue Router, replace activeId with route params ([2bc92da](https://github.com/Blaise1030/workbench-cli/commit/2bc92dadd64d88ae310c2571ac60d74a77276189))
* register file path link provider in Terminal.vue ([efc9f2c](https://github.com/Blaise1030/workbench-cli/commit/efc9f2c15e31acd62510849833692a24104f923e))
* removed rust implementation, add command K module ([1984312](https://github.com/Blaise1030/workbench-cli/commit/19843123d813d229f7f3a1cf2e46e3bee94c682f))
* revamp settings module ([a1c7e1f](https://github.com/Blaise1030/workbench-cli/commit/a1c7e1feb3413a9148f9dc03578c0da8d1938c2f))
* rewrite server to HTTPS with cookie-based WebSocket auth ([a33a2fa](https://github.com/Blaise1030/workbench-cli/commit/a33a2faae60418ff53c76a861025fdd2c96bfa9c))
* **server-go:** add module skeleton ([9636163](https://github.com/Blaise1030/workbench-cli/commit/963616326309ad4b491269ce420f478a79af5f4a))
* **server-go:** agents and LAN TLS ([7ad0741](https://github.com/Blaise1030/workbench-cli/commit/7ad074168c00864c9f428e3d4ffe63650870089b))
* **server-go:** auth phase 1 ([3ee38a5](https://github.com/Blaise1030/workbench-cli/commit/3ee38a5dabedd73bd716e11890c0567f9be5c340))
* **server-go:** CLI flags matching Node cli ([c906b01](https://github.com/Blaise1030/workbench-cli/commit/c906b01b0d26bd0ccb069c402320015048c78324))
* **server-go:** embedded and dev static file serving ([0943099](https://github.com/Blaise1030/workbench-cli/commit/0943099786284994b12ee88aa8b2b2b59e047e23))
* **server-go:** git panel ([b9dc0ad](https://github.com/Blaise1030/workbench-cli/commit/b9dc0ad3e26b84fb3fb398f2c39af78e11ca8299))
* **server-go:** HTTP server and /api/health ([f4d47b6](https://github.com/Blaise1030/workbench-cli/commit/f4d47b627e91b6262be0bda0a6fb10a75dbb70bd))
* **server-go:** PTY and WebSocket ([56cb082](https://github.com/Blaise1030/workbench-cli/commit/56cb082485ecbce30235497b51a9f7d8165426c4))
* **server-go:** settings and keybindings ([b881ca4](https://github.com/Blaise1030/workbench-cli/commit/b881ca462eddcc82b5f061672950dc2c4522a19a))
* **server-go:** workspace phase 3 ([52696d2](https://github.com/Blaise1030/workbench-cli/commit/52696d2508d8a720e103c3f970e6c8579bfd6e48))
* **server:** add GET /worktrees/:id/files/search route ([e1e17f2](https://github.com/Blaise1030/workbench-cli/commit/e1e17f24412ac12f723e9d0617bfd2e22e35abec))
* **server:** add searchFilesForWorktree with fuzzy scoring ([e5470a9](https://github.com/Blaise1030/workbench-cli/commit/e5470a92a9a9e7013d0984485a3e23a3eb234038))
* **settings:** replace tab bar with sidebar layout ([364cb45](https://github.com/Blaise1030/workbench-cli/commit/364cb455598fdff00346b3f9b4d5dca2c3ff7a11))
* sidebar agent sessions with register/status CLI and auto-resume ([062448c](https://github.com/Blaise1030/workbench-cli/commit/062448ce6b279390c2bc41b94c544bc5defb8386))
* split layout support ([67c93b4](https://github.com/Blaise1030/workbench-cli/commit/67c93b4ef42f16b1d880789077819fc473cd88da))
* Terminal.vue wterm component with WebSocket PTY bridge ([5f3a963](https://github.com/Blaise1030/workbench-cli/commit/5f3a963b2aa36cebedbcee35a051311a7fb249b3))
* token + PTY resize parser with tests ([18ead01](https://github.com/Blaise1030/workbench-cli/commit/18ead0149b40b39fb50b3d9e42ac94409a09b27d))
* update frontend to cookie auth — remove token from URL and props ([2295efd](https://github.com/Blaise1030/workbench-cli/commit/2295efd245d13044d8c840296262eb4e92c8de00))
* updated keybindings ([6e44207](https://github.com/Blaise1030/workbench-cli/commit/6e4420722695488e4023b634280dded9e2496d5c))
* updated packaging method ([5da75ce](https://github.com/Blaise1030/workbench-cli/commit/5da75ce71042cdf2e7082dc0835c4454824179c7))
* updated split screen layout ([ddd2d62](https://github.com/Blaise1030/workbench-cli/commit/ddd2d6291a2453d6c2ecc49ea4ab07f1a959453d))
* Vite + Vue scaffold with WS proxy ([42f5079](https://github.com/Blaise1030/workbench-cli/commit/42f507923cf88f72c6941acf8a1368902e41839b))
* WebSocket upgrade handler with PTY bridge and token guard ([8f4c35e](https://github.com/Blaise1030/workbench-cli/commit/8f4c35e8fa700b61be1d8f6b6acdc9ea1b06c233))
* wire CodeMirrorEditor into FileExplorerPanel with save and dirty state ([02e10ce](https://github.com/Blaise1030/workbench-cli/commit/02e10cef21db305be3f087ed4b42cdc4cbca36f3))
* wire GitPanel activeTab to route query param ([f79daf5](https://github.com/Blaise1030/workbench-cli/commit/f79daf5fee847068a48272012ab760be975932e9))


### Bug Fixes

* add missing FileExplorerTreePanelBridge.vue component ([27c6807](https://github.com/Blaise1030/workbench-cli/commit/27c6807c36710a9ffaf5fac30908161631523d3b))
* add missing git-unstaged-filter module ([327fcfe](https://github.com/Blaise1030/workbench-cli/commit/327fcfea4dc796d34fb2d9d960856504e06296ba))
* add relative positioning to editor panel for saving overlay ([21bf36a](https://github.com/Blaise1030/workbench-cli/commit/21bf36a59dba5afee03fd2cbba50d3f84c335341))
* add shadcn theme CSS variables and dark mode ([c6d63f5](https://github.com/Blaise1030/workbench-cli/commit/c6d63f53741aefb83ba605393eadf2ea63e2aba0))
* **auth:** allow multiple Origin hosts in RequireOrigin middleware ([929977a](https://github.com/Blaise1030/workbench-cli/commit/929977ab903a8575a6f0a787be88af21501e9f9e))
* **auth:** correct ratelimit doc comment and add concurrency test ([b1c5b83](https://github.com/Blaise1030/workbench-cli/commit/b1c5b831bde1c94c98f7562af200634db5e3cb2b))
* **auth:** use constant-time comparison for session token validation ([9f6dabf](https://github.com/Blaise1030/workbench-cli/commit/9f6dabf82e7fb9f09bca4ddb870f2a3ef548a3f9))
* **ci:** deploy Pages on release published event ([2d29ecd](https://github.com/Blaise1030/workbench-cli/commit/2d29ecd8f245d6fdfd256b9df8ba91b37d22e6b6))
* **ci:** grant Pages permissions to caller workflow ([79654fc](https://github.com/Blaise1030/workbench-cli/commit/79654fc4825ef63eba138489b2e5c419db1bfe8f))
* **ci:** unify Release Please, Go binaries, and install manifest ([4903978](https://github.com/Blaise1030/workbench-cli/commit/49039787ee2021d517581dd9f7d0e86d91617ef7))
* clean up router guard dead code, git redirect, duplicate imports ([f21a888](https://github.com/Blaise1030/workbench-cli/commit/f21a888f1f3ad5a16852f35d32e79b9a9586bec8))
* **content-queue:** fixed context queue ([a5c54f1](https://github.com/Blaise1030/workbench-cli/commit/a5c54f1a64bf9f98bf0f700c09725c38e4c57df7))
* correct bin path in cli package.json ([bbcefd7](https://github.com/Blaise1030/workbench-cli/commit/bbcefd7b74683724525560e984e782c4730ed8fc))
* correct vite outDir to point to repo-root dist/public ([8604908](https://github.com/Blaise1030/workbench-cli/commit/8604908bfeb20580abd52401b0a22bd7f71c8852))
* **docs:** disable Shiki, style code blocks with shadcn tokens ([f1f563c](https://github.com/Blaise1030/workbench-cli/commit/f1f563c146ffbb3197a34d0e4687850f64de3bfb))
* **docs:** fix DocsLayout issues from code review ([46aec0c](https://github.com/Blaise1030/workbench-cli/commit/46aec0c9a81a909c907118e20a3a0d63a25746db))
* **docs:** full-width header/footer in DocsLayout, point DOCS nav to /docs ([d16cf24](https://github.com/Blaise1030/workbench-cli/commit/d16cf24499debc241c2150605b85ec259c11195e))
* **docs:** show default disclosure arrow on sidebar summary ([24aa800](https://github.com/Blaise1030/workbench-cli/commit/24aa800a3cc3dcb3fd0ad908d9f02d171ece0ab1))
* enforce monospace font in CodeMirror editor for both light and dark mode ([fa33ac1](https://github.com/Blaise1030/workbench-cli/commit/fa33ac1dd0a8aa0b6529e85f0bb8baec0b86173f))
* explicit node:crypto import in token.ts ([5c9edbc](https://github.com/Blaise1030/workbench-cli/commit/5c9edbcde739fb56472265e86569d5ece0fd6d2c))
* expose Vite to LAN and print correct URL in dev mode ([940935e](https://github.com/Blaise1030/workbench-cli/commit/940935e18d951537e93f8b1f151cf2302f1589f2))
* fix landing page base path ([bcb0d61](https://github.com/Blaise1030/workbench-cli/commit/bcb0d61db45255396cb4ab7e7524cbb8a43af13b))
* fixed errors ([1257454](https://github.com/Blaise1030/workbench-cli/commit/1257454b9cc45f98032983c3e5d230ed328b8a5d))
* fixed worktree delete issue ([f339b7a](https://github.com/Blaise1030/workbench-cli/commit/f339b7a67518fbb1262ca7e0ed8fe6bec6816e0b))
* git panel ([4eba15a](https://github.com/Blaise1030/workbench-cli/commit/4eba15a7d6710f8613b4c9cb734829830f47a144))
* improve writeFileForWorktree error handling ([2f10639](https://github.com/Blaise1030/workbench-cli/commit/2f106399202dc35f9d83d1cd0844abadf29433ed))
* **landing:** document left-col dependency in FeaturePan, set visited link to blue ([f70f84e](https://github.com/Blaise1030/workbench-cli/commit/f70f84ecd1247619b90d0bef789a0b0c1a12d99b))
* **landing:** keep link color on visited state ([974151d](https://github.com/Blaise1030/workbench-cli/commit/974151dba237a508550b999ec9b99187d335ff32))
* **landing:** remove back button, fix CRLF line splitting on release body ([b5bc966](https://github.com/Blaise1030/workbench-cli/commit/b5bc966c321ec379f1ddbd7df91cc570099ed854))
* **landing:** use addEventListener for copy button, add clipboard error handling ([d487459](https://github.com/Blaise1030/workbench-cli/commit/d4874593a20ae289f4dd277919f331145099dd7b))
* pass configFile to createViteServer so dev mode finds frontend/vite.config.ts ([6b14183](https://github.com/Blaise1030/workbench-cli/commit/6b1418345af19949c75a3619edf7de9dc5ff2b82))
* persist terminal settings when toggling switches ([2947c75](https://github.com/Blaise1030/workbench-cli/commit/2947c75ff7a208c46e1a0df3d58f3d3faeccf296))
* polyfill navigator in Vitest for Node 20 CI ([cb6fef2](https://github.com/Blaise1030/workbench-cli/commit/cb6fef2642a22bc0208178be65318146aea25155))
* **release:** stage UI files for go:embed without nesting ([41252ba](https://github.com/Blaise1030/workbench-cli/commit/41252ba2bf5ca1cfc3d521895a5f6711e6e70a1b))
* reliable Set reactivity, dirty close dialog, save race condition ([94c126c](https://github.com/Blaise1030/workbench-cli/commit/94c126c1f1a65a99159bbb4b3fafc25aced299f9))
* remove duplicate Card block in NetworkSettings ([b67ca3f](https://github.com/Blaise1030/workbench-cli/commit/b67ca3feaf20be3566a725cc968fb90fcdba23f4))
* removed unwanted links ([f7c5f7b](https://github.com/Blaise1030/workbench-cli/commit/f7c5f7bc0e5e27aa1907523d79070d8e566bc4d8))
* restore ref import and preserve query params in GitPanel ([79a34f9](https://github.com/Blaise1030/workbench-cli/commit/79a34f9be585f68253359dc163e9c319ece3f4f2))
* **server-rs:** decouple PTY read loop from entries mutex to prevent executor stall ([4c2cf5e](https://github.com/Blaise1030/workbench-cli/commit/4c2cf5ea5eb8b713507f0ac553699982fb0c5e68))
* **settings:** avoid nested main landmark in sidebar layout ([549cbb5](https://github.com/Blaise1030/workbench-cli/commit/549cbb59668d545274e6ec842cce4f6e617c23da))
* support relative file paths in terminal link provider ([c41071f](https://github.com/Blaise1030/workbench-cli/commit/c41071f007559182b93a0f641b7e54c3c97f0dc1))
* **terminal:** expand SanitizeEnv to filter AWS, GitHub, and private key env vars ([d63a562](https://github.com/Blaise1030/workbench-cli/commit/d63a562cb811c4c85e7928497392fac922bbdd8e))
* **terminal:** idiomatic regex dash escaping and add variant test coverage ([2c64996](https://github.com/Blaise1030/workbench-cli/commit/2c649963d7049ad8f17c875bb1b4d41693cb881b))
* **workspace:** improve sidebar worktree navigation and deletion ([277a368](https://github.com/Blaise1030/workbench-cli/commit/277a3682e9af3036c48aef5a4bf1f9bd05972694))

## [0.2.0](https://github.com/Blaise1030/workbench-cli/compare/workbench-v0.1.1...workbench-v0.2.0) (2026-05-31)


### Features

* add CLI entrypoint with TLS setup and server start ([aed0809](https://github.com/Blaise1030/workbench-cli/commit/aed0809c5f8b5a2996afc5949ca61517257a140c))
* add CodeMirrorEditor component ([ef29025](https://github.com/Blaise1030/workbench-cli/commit/ef290256cc97995940fb5bcc963dc8ba7fbb2ae8))
* add Cursor Agent and Gemini CLI session resume ([2884e31](https://github.com/Blaise1030/workbench-cli/commit/2884e311b9e15eee2a09682d6d25c9ed59d1fcb2))
* add detectLanguage helper for CodeMirror ([52df19b](https://github.com/Blaise1030/workbench-cli/commit/52df19b49711336994c839dfaddfce259b2eb24a))
* add dirty-dot indicator to FileTabList ([180f68c](https://github.com/Blaise1030/workbench-cli/commit/180f68ca62a900bd0e6f82aa5f41a99546410eeb))
* add GeneralSettings view ([3f22e45](https://github.com/Blaise1030/workbench-cli/commit/3f22e45b51b3cc6bb88210268d8122bcebf6cee5))
* add git diff panel with @pierre/diffs CodeView ([323f868](https://github.com/Blaise1030/workbench-cli/commit/323f868414049c981738a99af0f115c1c38ed772))
* add Hono app factory with POST /auth and cookie session ([c670ef1](https://github.com/Blaise1030/workbench-cli/commit/c670ef1d2c1d44966affd09bb849392ecc475dda))
* add Login.vue with token form and error states ([0f9e295](https://github.com/Blaise1030/workbench-cli/commit/0f9e295210266a1f42be52d8a4fc8eccea94e340))
* add nested routes for workspace panels and settings tabs ([379a1a9](https://github.com/Blaise1030/workbench-cli/commit/379a1a964ef4534f3bbd6c23cb362dc0dd37cdb1))
* add NetworkSettings view ([b695f7c](https://github.com/Blaise1030/workbench-cli/commit/b695f7c98066419cef8852f676c76ef5572939fa))
* add PR preview workflow with dev release installs ([8906a87](https://github.com/Blaise1030/workbench-cli/commit/8906a87139fabe3fea2ad631357f396fce381f7d))
* add PUT /worktrees/:id/files/content endpoint ([f69a141](https://github.com/Blaise1030/workbench-cli/commit/f69a14119a5124e08e536f8b5dad9812170a1252))
* add session state module with sid + active tracking ([ed53e0d](https://github.com/Blaise1030/workbench-cli/commit/ed53e0de5979eb77c8a6cb07bebfb4d341f9fa66))
* add settings tab bar with RouterView, delete Settings.vue ([41ebcf5](https://github.com/Blaise1030/workbench-cli/commit/41ebcf5e3018f89dd7648e2577c6bf11e8005de7))
* add terminal file path link provider ([06292f2](https://github.com/Blaise1030/workbench-cli/commit/06292f27b8f432924fd412122b7151bb1ef81766))
* add tls.ts with mkcert detection, cert generation, and caching ([ed8a104](https://github.com/Blaise1030/workbench-cli/commit/ed8a104c4d1451c28d6594022b0b3528ae53b35d))
* add useFileEditorSave composable ([1e5640e](https://github.com/Blaise1030/workbench-cli/commit/1e5640ebf5aae85df922d563faad67ae28f042db))
* added file tabs ([d9283db](https://github.com/Blaise1030/workbench-cli/commit/d9283db59502960e433b29fd4eb4c2fc838b2a62))
* added go server ([ce40f5c](https://github.com/Blaise1030/workbench-cli/commit/ce40f5c5941687824998690a6e18194e7d2fb1aa))
* added landing page ([709314f](https://github.com/Blaise1030/workbench-cli/commit/709314fe8284fddf12c1906ae79a8739a38433da))
* **auth:** add CSRF Origin header validation middleware ([990c648](https://github.com/Blaise1030/workbench-cli/commit/990c64846557009f5214e603673d194a14aba2f6))
* **auth:** add per-IP rate limiting on token auth endpoint (10 req/min) ([efb00a8](https://github.com/Blaise1030/workbench-cli/commit/efb00a8bdb3cf0d7ba087e92667f27aa345f037e))
* **command-palette:** add CommandPalette component ([47e0482](https://github.com/Blaise1030/workbench-cli/commit/47e048279283a86326af2a3a09b1db0e2f846890))
* **command-palette:** add static command registry ([0570a6f](https://github.com/Blaise1030/workbench-cli/commit/0570a6f71e012b3182ba86dc3d674fc6799d091a))
* **command-palette:** add useCommandPalette singleton composable ([53287c1](https://github.com/Blaise1030/workbench-cli/commit/53287c116761964b0b296a23fdb64361e67d98d1))
* **command-palette:** add useFileSearch composable ([a51e336](https://github.com/Blaise1030/workbench-cli/commit/a51e336a8fb751667bd89ca202c53e0ba0d46a21))
* **command-palette:** mount palette in WorkspaceView and wire actions ([b5d2abc](https://github.com/Blaise1030/workbench-cli/commit/b5d2abcc3109c08c2b4d00776f5807691aead284))
* complete LAN terminal security hardening and CLI packaging ([6608d18](https://github.com/Blaise1030/workbench-cli/commit/6608d18ca6126c14408369fed4d9dc5d4611f023))
* **context-queue:** add formatQueueAppend helper ([8f579c3](https://github.com/Blaise1030/workbench-cli/commit/8f579c3bfab9153eadcae699adc3e48d95bb9620))
* **context-queue:** add worktree scratch queue for terminal prompts ([e8b8ce4](https://github.com/Blaise1030/workbench-cli/commit/e8b8ce45309d4d04715436c38b8f09b46244b77b))
* **docs:** add content collection schema ([6f15b72](https://github.com/Blaise1030/workbench-cli/commit/6f15b72affce4ec8ecf0fafb6dbeca5c423ca566))
* **docs:** add docs index page ([3b3e643](https://github.com/Blaise1030/workbench-cli/commit/3b3e64305d9bbfff08d37a40720d520964495c9d))
* **docs:** add DocsLayout with two-column sidebar ([a05df36](https://github.com/Blaise1030/workbench-cli/commit/a05df36ca51b8986522d37b7b01132cc036dec7f))
* **docs:** add dynamic doc page route ([194c877](https://github.com/Blaise1030/workbench-cli/commit/194c8778ff1af46fe8bc3e5d11175f5e31fec901))
* **docs:** add getting-started and concepts content ([e219f2c](https://github.com/Blaise1030/workbench-cli/commit/e219f2c4c42e176ec0dfb66cff9d9668791a2b98))
* **docs:** make sidebar DOCS nav a collapsible details/summary ([92f1f15](https://github.com/Blaise1030/workbench-cli/commit/92f1f1523917e2330e38e4538e4344360529b517))
* **docs:** use MarkdownLink in sidebar and nav, add showHref prop ([cbfe7d5](https://github.com/Blaise1030/workbench-cli/commit/cbfe7d50b8ccfcacd40dd832309dfc648359a4dd))
* **git:** completed git module ([b4152de](https://github.com/Blaise1030/workbench-cli/commit/b4152de0671d7a7b6dae46318f6521dd95015bb4))
* Hono server with LAN IP detection and session token ([c481870](https://github.com/Blaise1030/workbench-cli/commit/c4818704a0f209272b85c959588f7f38e322fed9))
* implement file explorer with tree, preview, and git status ([2c253ed](https://github.com/Blaise1030/workbench-cli/commit/2c253edee6e64027b788b595c454fc3a1be4ad84))
* implement session restore (persistent PTY, scrollback, agent resume) ([8b0a843](https://github.com/Blaise1030/workbench-cli/commit/8b0a84347d947afec1e5b4f3fb1784a2d4b49adc))
* **keybindings:** add client types and default bindings ([f799fe2](https://github.com/Blaise1030/workbench-cli/commit/f799fe2a3df1a6a7e38ee324ed472ad7fd306488))
* **keybindings:** add Hono router with GET and PUT handlers ([d585557](https://github.com/Blaise1030/workbench-cli/commit/d585557938c7732ea490078914cb040ae2852c7f))
* **keybindings:** add KeybindingsMap schema types ([98e2316](https://github.com/Blaise1030/workbench-cli/commit/98e2316b4e6982d7db922f969e0d4cf513e2d76f))
* **keybindings:** add KeybindingsSettings page with key capture and save ([7b6e408](https://github.com/Blaise1030/workbench-cli/commit/7b6e408bbcd5aa98da6453070b8010fac525cfbd))
* **keybindings:** add server store with file I/O and tests ([8d8ec27](https://github.com/Blaise1030/workbench-cli/commit/8d8ec2740ebfd13b5245c5b404545508368381cb))
* **keybindings:** add settings-keybindings route and tab ([dff68f8](https://github.com/Blaise1030/workbench-cli/commit/dff68f89393bf4212e70670331eb4d8f58e4786e))
* **keybindings:** add TanStack Query fetch and update mutation ([146b81f](https://github.com/Blaise1030/workbench-cli/commit/146b81f5ab391158528a88b24fbfab60e2074b94))
* **keybindings:** add useWorkspaceKeybindings composable ([3921aaa](https://github.com/Blaise1030/workbench-cli/commit/3921aaa02377d8338475217ff4c9b6348c39cb82))
* **keybindings:** register keybindings router at /api/keybindings ([bddb5ba](https://github.com/Blaise1030/workbench-cli/commit/bddb5ba5016cfd84156420c86b84df45e16563c7))
* **keybindings:** wire useWorkspaceKeybindings into TerminalWorkspace ([02e9403](https://github.com/Blaise1030/workbench-cli/commit/02e9403066731fe37ac091a177c6b8870eedfde2))
* LAN web terminal — complete ([bf016ba](https://github.com/Blaise1030/workbench-cli/commit/bf016ba26734022ec58d75586545e01d745688f2))
* **landing:** add fullWidth prop to Layout ([8b7b1bf](https://github.com/Blaise1030/workbench-cli/commit/8b7b1bf4fbde6de9d8a48ca151a61713bb1817ef))
* **landing:** add global styles, favicon, and Cloudflare config ([d28ff40](https://github.com/Blaise1030/workbench-cli/commit/d28ff404a5295e7bc8a85570ba7e879d241c226c))
* **landing:** add light-mode preview images and rename tab to GIT DIFF ([ec32396](https://github.com/Blaise1030/workbench-cli/commit/ec32396a3299a80a4e2a8ea16ea8d1bf297ca18d))
* **landing:** add screenshot asset, fullWidth layout prop, and FeaturePan component ([a3f9950](https://github.com/Blaise1030/workbench-cli/commit/a3f9950f61536d7033f35bd7a1c35556b5c3b5af))
* **landing:** add static releases page from GitHub API ([3957505](https://github.com/Blaise1030/workbench-cli/commit/39575050cac68a2de007f5261932c5a0dec6636c))
* **landing:** add two-column layout, content in left column ([688256a](https://github.com/Blaise1030/workbench-cli/commit/688256a90cc5636b6985779266f062404008def9))
* **landing:** add workbench screenshot asset ([b28f7d5](https://github.com/Blaise1030/workbench-cli/commit/b28f7d58e44d4437029440465db876e875020588))
* **landing:** build landing page with raw text-file aesthetic ([ba1d7c9](https://github.com/Blaise1030/workbench-cli/commit/ba1d7c98560b7a301dda70d516cfce3fd019e456))
* **landing:** redesign index page with cmux-inspired single-column layout ([0fad0d0](https://github.com/Blaise1030/workbench-cli/commit/0fad0d01b409337dc2fd26b15a06a2f0183d01ab))
* **landing:** scaffold Astro + Cloudflare static project ([16df7cb](https://github.com/Blaise1030/workbench-cli/commit/16df7cbe06a3ca78fe10f731bb77242fd3e54fdf))
* **landing:** two-column layout with sticky FeaturePan on index page ([a88afca](https://github.com/Blaise1030/workbench-cli/commit/a88afca36c5110ffd97e39db40b34cc6788b172f))
* localhost-first bind with settings UI and invite QR ([3078b40](https://github.com/Blaise1030/workbench-cli/commit/3078b40c27a94f5901977a8e91c0566fe243612d))
* refactor TerminalWorkspace to use Vue Router, replace activeId with route params ([2bc92da](https://github.com/Blaise1030/workbench-cli/commit/2bc92dadd64d88ae310c2571ac60d74a77276189))
* register file path link provider in Terminal.vue ([efc9f2c](https://github.com/Blaise1030/workbench-cli/commit/efc9f2c15e31acd62510849833692a24104f923e))
* removed rust implementation, add command K module ([1984312](https://github.com/Blaise1030/workbench-cli/commit/19843123d813d229f7f3a1cf2e46e3bee94c682f))
* revamp settings module ([a1c7e1f](https://github.com/Blaise1030/workbench-cli/commit/a1c7e1feb3413a9148f9dc03578c0da8d1938c2f))
* rewrite server to HTTPS with cookie-based WebSocket auth ([a33a2fa](https://github.com/Blaise1030/workbench-cli/commit/a33a2faae60418ff53c76a861025fdd2c96bfa9c))
* **server-go:** add module skeleton ([9636163](https://github.com/Blaise1030/workbench-cli/commit/963616326309ad4b491269ce420f478a79af5f4a))
* **server-go:** agents and LAN TLS ([7ad0741](https://github.com/Blaise1030/workbench-cli/commit/7ad074168c00864c9f428e3d4ffe63650870089b))
* **server-go:** auth phase 1 ([3ee38a5](https://github.com/Blaise1030/workbench-cli/commit/3ee38a5dabedd73bd716e11890c0567f9be5c340))
* **server-go:** CLI flags matching Node cli ([c906b01](https://github.com/Blaise1030/workbench-cli/commit/c906b01b0d26bd0ccb069c402320015048c78324))
* **server-go:** embedded and dev static file serving ([0943099](https://github.com/Blaise1030/workbench-cli/commit/0943099786284994b12ee88aa8b2b2b59e047e23))
* **server-go:** git panel ([b9dc0ad](https://github.com/Blaise1030/workbench-cli/commit/b9dc0ad3e26b84fb3fb398f2c39af78e11ca8299))
* **server-go:** HTTP server and /api/health ([f4d47b6](https://github.com/Blaise1030/workbench-cli/commit/f4d47b627e91b6262be0bda0a6fb10a75dbb70bd))
* **server-go:** PTY and WebSocket ([56cb082](https://github.com/Blaise1030/workbench-cli/commit/56cb082485ecbce30235497b51a9f7d8165426c4))
* **server-go:** settings and keybindings ([b881ca4](https://github.com/Blaise1030/workbench-cli/commit/b881ca462eddcc82b5f061672950dc2c4522a19a))
* **server-go:** workspace phase 3 ([52696d2](https://github.com/Blaise1030/workbench-cli/commit/52696d2508d8a720e103c3f970e6c8579bfd6e48))
* **server:** add GET /worktrees/:id/files/search route ([e1e17f2](https://github.com/Blaise1030/workbench-cli/commit/e1e17f24412ac12f723e9d0617bfd2e22e35abec))
* **server:** add searchFilesForWorktree with fuzzy scoring ([e5470a9](https://github.com/Blaise1030/workbench-cli/commit/e5470a92a9a9e7013d0984485a3e23a3eb234038))
* **settings:** replace tab bar with sidebar layout ([364cb45](https://github.com/Blaise1030/workbench-cli/commit/364cb455598fdff00346b3f9b4d5dca2c3ff7a11))
* Terminal.vue wterm component with WebSocket PTY bridge ([5f3a963](https://github.com/Blaise1030/workbench-cli/commit/5f3a963b2aa36cebedbcee35a051311a7fb249b3))
* token + PTY resize parser with tests ([18ead01](https://github.com/Blaise1030/workbench-cli/commit/18ead0149b40b39fb50b3d9e42ac94409a09b27d))
* update frontend to cookie auth — remove token from URL and props ([2295efd](https://github.com/Blaise1030/workbench-cli/commit/2295efd245d13044d8c840296262eb4e92c8de00))
* updated keybindings ([6e44207](https://github.com/Blaise1030/workbench-cli/commit/6e4420722695488e4023b634280dded9e2496d5c))
* updated packaging method ([5da75ce](https://github.com/Blaise1030/workbench-cli/commit/5da75ce71042cdf2e7082dc0835c4454824179c7))
* Vite + Vue scaffold with WS proxy ([42f5079](https://github.com/Blaise1030/workbench-cli/commit/42f507923cf88f72c6941acf8a1368902e41839b))
* WebSocket upgrade handler with PTY bridge and token guard ([8f4c35e](https://github.com/Blaise1030/workbench-cli/commit/8f4c35e8fa700b61be1d8f6b6acdc9ea1b06c233))
* wire CodeMirrorEditor into FileExplorerPanel with save and dirty state ([02e10ce](https://github.com/Blaise1030/workbench-cli/commit/02e10cef21db305be3f087ed4b42cdc4cbca36f3))
* wire GitPanel activeTab to route query param ([f79daf5](https://github.com/Blaise1030/workbench-cli/commit/f79daf5fee847068a48272012ab760be975932e9))


### Bug Fixes

* add relative positioning to editor panel for saving overlay ([21bf36a](https://github.com/Blaise1030/workbench-cli/commit/21bf36a59dba5afee03fd2cbba50d3f84c335341))
* add shadcn theme CSS variables and dark mode ([c6d63f5](https://github.com/Blaise1030/workbench-cli/commit/c6d63f53741aefb83ba605393eadf2ea63e2aba0))
* **auth:** allow multiple Origin hosts in RequireOrigin middleware ([929977a](https://github.com/Blaise1030/workbench-cli/commit/929977ab903a8575a6f0a787be88af21501e9f9e))
* **auth:** correct ratelimit doc comment and add concurrency test ([b1c5b83](https://github.com/Blaise1030/workbench-cli/commit/b1c5b831bde1c94c98f7562af200634db5e3cb2b))
* **auth:** use constant-time comparison for session token validation ([9f6dabf](https://github.com/Blaise1030/workbench-cli/commit/9f6dabf82e7fb9f09bca4ddb870f2a3ef548a3f9))
* **ci:** deploy Pages on release published event ([2d29ecd](https://github.com/Blaise1030/workbench-cli/commit/2d29ecd8f245d6fdfd256b9df8ba91b37d22e6b6))
* clean up router guard dead code, git redirect, duplicate imports ([f21a888](https://github.com/Blaise1030/workbench-cli/commit/f21a888f1f3ad5a16852f35d32e79b9a9586bec8))
* **content-queue:** fixed context queue ([a5c54f1](https://github.com/Blaise1030/workbench-cli/commit/a5c54f1a64bf9f98bf0f700c09725c38e4c57df7))
* correct bin path in cli package.json ([bbcefd7](https://github.com/Blaise1030/workbench-cli/commit/bbcefd7b74683724525560e984e782c4730ed8fc))
* correct vite outDir to point to repo-root dist/public ([8604908](https://github.com/Blaise1030/workbench-cli/commit/8604908bfeb20580abd52401b0a22bd7f71c8852))
* **docs:** disable Shiki, style code blocks with shadcn tokens ([f1f563c](https://github.com/Blaise1030/workbench-cli/commit/f1f563c146ffbb3197a34d0e4687850f64de3bfb))
* **docs:** fix DocsLayout issues from code review ([46aec0c](https://github.com/Blaise1030/workbench-cli/commit/46aec0c9a81a909c907118e20a3a0d63a25746db))
* **docs:** full-width header/footer in DocsLayout, point DOCS nav to /docs ([d16cf24](https://github.com/Blaise1030/workbench-cli/commit/d16cf24499debc241c2150605b85ec259c11195e))
* **docs:** show default disclosure arrow on sidebar summary ([24aa800](https://github.com/Blaise1030/workbench-cli/commit/24aa800a3cc3dcb3fd0ad908d9f02d171ece0ab1))
* enforce monospace font in CodeMirror editor for both light and dark mode ([fa33ac1](https://github.com/Blaise1030/workbench-cli/commit/fa33ac1dd0a8aa0b6529e85f0bb8baec0b86173f))
* explicit node:crypto import in token.ts ([5c9edbc](https://github.com/Blaise1030/workbench-cli/commit/5c9edbcde739fb56472265e86569d5ece0fd6d2c))
* expose Vite to LAN and print correct URL in dev mode ([940935e](https://github.com/Blaise1030/workbench-cli/commit/940935e18d951537e93f8b1f151cf2302f1589f2))
* fix landing page base path ([bcb0d61](https://github.com/Blaise1030/workbench-cli/commit/bcb0d61db45255396cb4ab7e7524cbb8a43af13b))
* fixed worktree delete issue ([f339b7a](https://github.com/Blaise1030/workbench-cli/commit/f339b7a67518fbb1262ca7e0ed8fe6bec6816e0b))
* git panel ([4eba15a](https://github.com/Blaise1030/workbench-cli/commit/4eba15a7d6710f8613b4c9cb734829830f47a144))
* improve writeFileForWorktree error handling ([2f10639](https://github.com/Blaise1030/workbench-cli/commit/2f106399202dc35f9d83d1cd0844abadf29433ed))
* **landing:** document left-col dependency in FeaturePan, set visited link to blue ([f70f84e](https://github.com/Blaise1030/workbench-cli/commit/f70f84ecd1247619b90d0bef789a0b0c1a12d99b))
* **landing:** keep link color on visited state ([974151d](https://github.com/Blaise1030/workbench-cli/commit/974151dba237a508550b999ec9b99187d335ff32))
* **landing:** remove back button, fix CRLF line splitting on release body ([b5bc966](https://github.com/Blaise1030/workbench-cli/commit/b5bc966c321ec379f1ddbd7df91cc570099ed854))
* **landing:** use addEventListener for copy button, add clipboard error handling ([d487459](https://github.com/Blaise1030/workbench-cli/commit/d4874593a20ae289f4dd277919f331145099dd7b))
* pass configFile to createViteServer so dev mode finds frontend/vite.config.ts ([6b14183](https://github.com/Blaise1030/workbench-cli/commit/6b1418345af19949c75a3619edf7de9dc5ff2b82))
* persist terminal settings when toggling switches ([2947c75](https://github.com/Blaise1030/workbench-cli/commit/2947c75ff7a208c46e1a0df3d58f3d3faeccf296))
* polyfill navigator in Vitest for Node 20 CI ([cb6fef2](https://github.com/Blaise1030/workbench-cli/commit/cb6fef2642a22bc0208178be65318146aea25155))
* **release:** stage UI files for go:embed without nesting ([41252ba](https://github.com/Blaise1030/workbench-cli/commit/41252ba2bf5ca1cfc3d521895a5f6711e6e70a1b))
* reliable Set reactivity, dirty close dialog, save race condition ([94c126c](https://github.com/Blaise1030/workbench-cli/commit/94c126c1f1a65a99159bbb4b3fafc25aced299f9))
* remove duplicate Card block in NetworkSettings ([b67ca3f](https://github.com/Blaise1030/workbench-cli/commit/b67ca3feaf20be3566a725cc968fb90fcdba23f4))
* removed unwanted links ([f7c5f7b](https://github.com/Blaise1030/workbench-cli/commit/f7c5f7bc0e5e27aa1907523d79070d8e566bc4d8))
* restore ref import and preserve query params in GitPanel ([79a34f9](https://github.com/Blaise1030/workbench-cli/commit/79a34f9be585f68253359dc163e9c319ece3f4f2))
* **server-rs:** decouple PTY read loop from entries mutex to prevent executor stall ([4c2cf5e](https://github.com/Blaise1030/workbench-cli/commit/4c2cf5ea5eb8b713507f0ac553699982fb0c5e68))
* **settings:** avoid nested main landmark in sidebar layout ([549cbb5](https://github.com/Blaise1030/workbench-cli/commit/549cbb59668d545274e6ec842cce4f6e617c23da))
* support relative file paths in terminal link provider ([c41071f](https://github.com/Blaise1030/workbench-cli/commit/c41071f007559182b93a0f641b7e54c3c97f0dc1))
* **terminal:** expand SanitizeEnv to filter AWS, GitHub, and private key env vars ([d63a562](https://github.com/Blaise1030/workbench-cli/commit/d63a562cb811c4c85e7928497392fac922bbdd8e))
* **terminal:** idiomatic regex dash escaping and add variant test coverage ([2c64996](https://github.com/Blaise1030/workbench-cli/commit/2c649963d7049ad8f17c875bb1b4d41693cb881b))
* **workspace:** improve sidebar worktree navigation and deletion ([277a368](https://github.com/Blaise1030/workbench-cli/commit/277a3682e9af3036c48aef5a4bf1f9bd05972694))
