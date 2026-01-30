INSERT INTO layouts (name, slots, description, example_yaml) VALUES
('2-col', '{"L": {"x": -420, "y": 0, "width": 780, "height": 960}, "R": {"x": 420, "y": 0, "width": 780, "height": 960}}', 'Two equal columns side by side', 'layout: 2-col
cards:
  code: {slot: L, content: MyCode}
  table: {slot: R, content: MyTable}'),

('2L-1R', '{"L1": {"x": -420, "y": -240, "width": 780, "height": 450}, "L2": {"x": -420, "y": 240, "width": 780, "height": 450}, "R1": {"x": 420, "y": 0, "width": 780, "height": 960}}', 'Two cards stacked left, one tall card right', 'layout: 2L-1R
cards:
  top: {slot: L1, content: TopCode}
  bottom: {slot: L2, content: BottomCode}
  right: {slot: R1, content: RightCode}'),

('2L-2R', '{"L1": {"x": -420, "y": -240, "width": 780, "height": 450}, "L2": {"x": -420, "y": 240, "width": 780, "height": 450}, "R1": {"x": 420, "y": -240, "width": 780, "height": 450}, "R2": {"x": 420, "y": 240, "width": 780, "height": 450}}', 'Four cards in 2x2 grid', 'layout: 2L-2R
cards:
  tl: {slot: L1}
  bl: {slot: L2}
  tr: {slot: R1}
  br: {slot: R2}'),

('center', '{"C": {"x": 0, "y": 0, "width": 900, "height": 700}}', 'Single centered card', 'layout: center
cards:
  main: {slot: C, content: Code}'),

('center-title', '{"title": {"x": -70, "y": 0, "width": 1740, "height": 920}}', 'Full screen title text', 'layout: center-title'),

('split-vertical', '{"L": {"x": -480, "y": 0, "width": 960, "height": 1080}, "R": {"x": 480, "y": 0, "width": 960, "height": 1080}}', 'Left and right halves with different themes', 'layout: split-vertical');

INSERT INTO beats (name, description, params, category, example_yaml) VALUES
('appear', 'Fade in a component', '{"duration": "number"}', 'appear', 'beat: {type: appear, targets: [card1], duration: 1.1}'),

('appear-staggered', 'Fade in components sequentially', '{"delay": "number", "duration": "number"}', 'appear', 'beat: {type: appear-staggered, targets: [card1, card2, card3], delay: 0.3}'),

('disappear', 'Fade out components', '{"duration": "number"}', 'appear', 'beat: {type: disappear, targets: [card1]}'),

('highlight-lines', 'Dim all lines except specified ranges', '{"lines": "number[]", "duration": "number"}', 'highlight', 'beat: {type: highlight-lines, targets: [card1], lines: [3, 4, 5]}'),

('recolor-line', 'Change color of a specific line', '{"lines": "number[]", "color": "string", "duration": "number"}', 'highlight', 'beat: {type: recolor-line, targets: [card1], lines: [3], color: "#FF8CA3"}'),

('recolor-tokens', 'Change color of specific tokens in a line', '{"lines": "number[]", "tokens": "string[]", "color": "string"}', 'highlight', 'beat: {type: recolor-tokens, targets: [card1], lines: [5], tokens: ["PaymentDto"], color: "#FF8CA3"}'),

('reset-highlight', 'Reset line colors and show all lines', '{"lines": "number[]", "duration": "number"}', 'highlight', 'beat: {type: reset-highlight, targets: [card1], lines: [3, 4, 5]}'),

('scan-knowledge', 'Highlight lines across multiple cards sequentially', '{"lines": "number[]", "hold": "number"}', 'highlight', 'beat: {type: scan-knowledge, targets: [card1, card2, card3], lines: [3, 4, 5], hold: 0.3}'),

('wait', 'Pause for specified duration', '{"duration": "number"}', 'timing', 'beat: {type: wait, duration: 1.0}'),

('crossfade', 'Crossfade between two components', '{"duration": "number"}', 'transition', 'beat: {type: crossfade, targets: [from, to]}'),

('zoom-reveal', 'Zoom into card and reveal content', '{"scale": "number", "duration": "number"}', 'transition', 'beat: {type: zoom-reveal, targets: [card], scale: 1.8}'),

('swipe-reveal', 'Slide overlay to reveal background', '{"direction": "string", "duration": "number"}', 'transition', 'beat: {type: swipe-reveal, targets: [overlay], direction: "right"}'),

('title-fade', 'Fade in, hold, fade out for titles', '{"fadeIn": "number", "hold": "number", "fadeOut": "number"}', 'title', 'beat: {type: title-fade, fadeIn: 0.8, hold: 1.4, fadeOut: 0.8}'),

('focus', 'Emphasize one target and de-emphasize another', '{"activeOpacity": "number", "inactiveOpacity": "number", "duration": "number"}', 'transition', 'beat: {type: focus, targets: [active, inactive], inactiveOpacity: 0.55, duration: 0.6}');

INSERT INTO knowledge (category, title, content, tags) VALUES
('rule', 'Safe Zone', 'Screen: 1920x1080, center at (0,0). SafeZone boundaries: top=-480, bottom=480, left=-840, right=840. Never position elements outside SafeZone.', ARRAY['layout', 'positioning', 'boundaries']),

('rule', 'Font Size', 'Minimum font size is 14px. Code font sizes: small cards 14-16, medium cards 18-20, large cards 22-24.', ARRAY['typography', 'font', 'code']),

('rule', 'Timing', 'Use Timing tokens. Timing.micro=0.08, Timing.beat=0.22, Timing.fast=0.3, Timing.normal=0.6, Timing.slow=1.1. Never use raw numbers for durations.', ARRAY['animation', 'timing', 'duration']),

('rule', 'Colors', 'Dark theme: background.from=#0B0C10, background.to=#12141A, surface=#1B1D24, text.primary=#F4F1EB, accent=#FF8CA3. Light theme uses OpenStyle colors.', ARRAY['colors', 'theme', 'design']),

('rule', 'Layout Presets', 'Use getSlots(preset) for positioning. Available presets: 2-col, 2L-1R, 2L-2R, split-vertical, center, center-title. Never write x/y manually.', ARRAY['layout', 'positioning', 'presets']),

('rule', 'Code Content', 'Use only English strings in code examples. Add blank line between class declaration and first method. Use customTypes for syntax highlighting.', ARRAY['code', 'content', 'style']),

('rule', 'Beat Functions', 'Use beat functions from core/beats for animations. Prefer beats over ad-hoc opacity/position tweens. Available includes: appear, disappear, highlightLines, recolorLine, scanTableColumn, titleFade, typewriter, focus.', ARRAY['animation', 'beats', 'functions']),

('philosophy', 'Minimalism', 'Every element must earn its place. Prefer emptiness over decoration. White space creates rhythm and focus. Remove until it breaks, then add one thing back.', ARRAY['philosophy', 'design', 'principles']),

('philosophy', 'Contrast Through Inversion', 'Light theme: DARK shapes (circles) on warm beige background. Dark theme: light cards on deep gradient. Never mix approaches in single scene.', ARRAY['philosophy', 'design', 'contrast']),

('philosophy', 'Information Not Decoration', 'Color = meaning (status, type, emphasis). Shape = role (circle=service, rect=data/code). Animation = narrative (reveals knowledge, not just looks cool).', ARRAY['philosophy', 'design', 'meaning']),

('philosophy', 'Emotional Tone', 'Professional but warm. Technical but accessible. Think architecture monograph, not startup landing page. Think Dieter Rams, not Dribbble trending.', ARRAY['philosophy', 'design', 'tone']),

('rule', 'Light Theme Services', 'Services in light theme are DARK circles (#151515) with WHITE text. Radius 150-175px. Never use rectangles for services. Never use bright colors.', ARRAY['light-theme', 'services', 'circles']),

('rule', 'Light Theme Wires', 'Connection wires: rgba(21,21,21,0.55) semi-transparent dark, 1px width, round lineCap. Port dots: 20px blue (#486EA2). Packet dots: 16px transport (#B07C46).', ARRAY['light-theme', 'wires', 'connectors']),

('rule', 'Light Theme Cards', 'Card fill: #F6F1E8 cream. Stroke: #CFC6BA 1px. Shadow: rgba(21,21,21,0.18) blur 24 offset (-8,12). Radius: 22px. Padding: 18px horizontal, 16px vertical.', ARRAY['light-theme', 'cards', 'styling']),

('rule', 'Dark Theme Cards', 'Card fill: #1B1D24. Stroke: #262A34 1px. Shadow: rgba(0,0,0,0.50) blur 44 offset (-16,22). Radius: 28px large, 22px small.', ARRAY['dark-theme', 'cards', 'styling']),

('rule', 'Status Colors', 'Use colored TEXT not badges. Success (mint): rgba(155,227,197,0.86). Pending (sky): rgba(163,205,255,0.86). Error (rose): rgba(255,170,185,0.86). Neutral (violet): rgba(201,180,255,0.86).', ARRAY['colors', 'status', 'tables']),

('rule', 'Typography Fonts', 'Sans: Space Grotesk (primary), Inter (fallback). Mono: JetBrains Mono. NEVER use Arial, Roboto, or system fonts.', ARRAY['typography', 'fonts']),

('rule', 'Typography Scale Light', 'Service names: 32px weight 520 letterSpacing 0.6. Endpoint verbs: 18px weight 700 letterSpacing 2.2. Endpoint paths: 20px weight 600 letterSpacing 0.55.', ARRAY['typography', 'light-theme', 'scale']),

('rule', 'Animation Easing', 'Default: easeInOutCubic (smooth, professional). Linear: only for constant-velocity motion (packets). NEVER use bounce, elastic, or overshoot.', ARRAY['animation', 'easing', 'timing']),

('rule', 'Animation Timing Ratios', 'Hold before action: 0.2-0.5s. Hold after action: 0.3-0.6s. Between sequences: 0.4-1.0s. Stagger delay: 0.15-0.3s. Never rush, never drag.', ARRAY['animation', 'timing', 'rhythm']),

('rule', 'Highlight Animation', 'Dim other lines to opacity 0.22. Recolor target to accent. Duration: Timing.slow. Pink accent ONLY for must-see-NOW moments.', ARRAY['animation', 'highlight', 'code']),

('rule', 'Transport Animation', 'Packet moves at constant velocity (linear easing). Fade in at start (Timing.fast), fade out at end. Values appear with packet arrival.', ARRAY['animation', 'transport', 'data-flow']),

('rule', 'Pulse Animation', 'Fill to highlight, then back. Use Timing.beat for on/off. Maximum 3 pulses. Used for table cell scanning.', ARRAY['animation', 'pulse', 'emphasis']),

('rule', 'Scan Animation', 'Row-by-row highlight. Per-row delay: Timing.micro. Between passes: Timing.normal. Used for table filtering visualization.', ARRAY['animation', 'scan', 'tables']),

('antipattern', 'Color Antipatterns', 'NEVER: bright saturated backgrounds, rainbow schemes, pure black (#000), cold/blue whites, gradient fills on shapes (only bg gradients).', ARRAY['antipattern', 'colors']),

('antipattern', 'Typography Antipatterns', 'NEVER: font size below 14px, system fonts, decorative fonts, centered body text, letter-spacing on body text.', ARRAY['antipattern', 'typography']),

('antipattern', 'Geometry Antipatterns', 'NEVER: rectangles for services (use circles), corners > 28px, decorative shadows, 3D effects/bevels/emboss.', ARRAY['antipattern', 'geometry']),

('antipattern', 'Animation Antipatterns', 'NEVER: bounce/elastic easing, arbitrary timing values, constant motion without rest, too many simultaneous animations, flash/blink effects.', ARRAY['antipattern', 'animation']),

('example', 'Code Comparison Scene', 'Layout: 2-col or 2L-1R. Animation sequence: appear cards → highlightLines → recolorTokens → reset. Use CodeBlock for code display.', ARRAY['scene', 'example', 'code']),

('example', 'Chapter Intro Scene', 'Layout: center-title. Components: CHAPTER N (large) + subtitle lines (smaller). Chapter number in Colors.accent. Animation: titleFade.', ARRAY['scene', 'example', 'intro']),

('example', 'Knowledge Scan Scene', 'Layout: 2L-1R. Animation: appearStaggered → scan-knowledge across cards → break animation → reset. Highlight same case in all cards simultaneously.', ARRAY['scene', 'example', 'knowledge']),

('example', 'Service Diagram Scene', 'Light theme. Services: dark circles R=150-175. Wires: semi-transparent, horizontal. Labels above wires. Port dots where data enters/exits.', ARRAY['scene', 'example', 'services', 'light-theme']);

-- =============================================================================
-- PRODUCTION RECIPES (DAEDALUS)
-- =============================================================================

INSERT INTO knowledge (category, title, content, tags) VALUES
('rule', 'Still Export (Composition Feedback Loop)', 'When layout is disputed, export a PNG still and measure on pixels instead of guessing. Use scripts/still (Playwright + Vite dev server) to export a single frame into motion-canvas/output/still/<project>/<frame>.png, then iterate. This makes AI work measurable and reduces token burn.', ARRAY['production', 'workflow', 'still', 'layout']),
('rule', 'Deterministic Mock Embeddings', 'Mock embeddings must be deterministic (seeded hash), otherwise RAG results jump between runs and become unusable for production. Determinism is required for repeatable queries and stable iteration.', ARRAY['rag', 'embeddings', 'workflow']);

