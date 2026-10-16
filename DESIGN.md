# Design — Project Identity

> This document is project-long-lived. Tokens are not changed without
> the Architect's approval. Developers MUST use these tokens
> instead of improvising their own colors/spacings.

## Style Direction

Calm, bright utility UI for a small office: neutral off-white surfaces, one quiet blue accent, generous whitespace, tabular numerals for times — the sober, quiet confidence of Linear/Stripe, nothing decorative.

## Colors

- `--color-bg`: **#F7F8FA**
- `--color-surface`: **#FFFFFF**
- `--color-surface_alt`: **#EEF0F4**
- `--color-fg`: **#16181D**
- `--color-muted`: **#5F6672**
- `--color-border`: **#E3E6EB**
- `--color-border_strong`: **#C9CFD8**
- `--color-accent`: **#2F6FEB**
- `--color-accent_hover`: **#2560D0**
- `--color-accent_pressed`: **#1E4FAC**
- `--color-accent_soft`: **#EAF0FE**
- `--color-focus_ring`: **#7AA7F5**
- `--color-success`: **#1C7C54**
- `--color-success_soft`: **#E7F4EE**
- `--color-danger`: **#B4232A**
- `--color-danger_soft`: **#FBEBEC**
- `--color-warning`: **#8A5A00**
- `--color-warning_soft`: **#FBF1DE**
- `--color-overlay`: **rgba(16,18,23,0.45)**
- `--color-shadow_color`: **rgba(16,18,23,0.08)**

## Typography

- `font_family`: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif
- `font_family_mono`: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace
- `heading_weight`: 600
- `body_weight`: 400
- `numeric_variant`: font-variant-numeric: tabular-nums (mandatory for every time, duration and seat count)
- `size_display`: 28px/34px, weight 600, letter-spacing -0.01em
- `size_h1`: 22px/28px, weight 600
- `size_h2`: 17px/24px, weight 600
- `size_body`: 15px/22px (form inputs and body copy on mobile: 16px to avoid zoom)
- `size_small`: 13px/18px
- `size_label`: 13px/18px, weight 500, color=muted

## Spacing Scale

- `--space-0`: 4px
- `--space-1`: 8px
- `--space-2`: 12px
- `--space-3`: 16px
- `--space-4`: 24px
- `--space-5`: 32px
- `--space-6`: 48px

## Border-Radii

- `--radius-sm`: 6px
- `--radius-md`: 10px
- `--radius-lg`: 16px
- `--radius-pill`: 999px

## Components

### Button

Universal base: min-height 44px (touch), padding 10/16, radius md (10px), font 15px weight 500, gap 8px to icon, transition 120ms ease-out on bg/border/box-shadow. Focus-visible: 2px focus_ring ring with 2px offset, never removed. Primary: bg=accent, text #FFFFFF; hover bg=accent_hover; active bg=accent_pressed + translateY(1px); disabled: opacity 0.55, cursor not-allowed, no hover change. Secondary: bg=surface, text=fg, 1px border=border_strong; hover bg=surface_alt; active bg=#E4E7EC. Ghost: bg transparent, text=muted; hover bg=surface_alt + text=fg. Danger: bg=danger, text #FFFFFF; hover #9C1E24; active #8A1A20; used only for delete-room/delete-booking confirm. Full-width variant on screens <480px for the primary form action. Every button has visible text (no icon-only controls without aria-label).

### Input & Textarea

min-height 44px, padding 10/12, radius md, bg=surface, 1px border=border, font 16px on mobile / 15px desktop, color=fg, placeholder=muted. Hover border=border_strong. Focus: border=accent + 2px focus_ring glow, no outline removal. Disabled: bg=surface_alt, text=muted, cursor not-allowed. Error state: border=danger + 13px danger message with role=alert under the field; neutral untouched fields show NO error styling (validation appears only after input or submit, per AC-16).

### FormField

Vertical stack: label (13px/500/muted, always visible, linked via id to the control) + 8px gap + control + 4px gap + helper or error text (13px). Required fields marked with a '*' and the note 'Pflichtfeld' once at the top of the form. Neutral until touched: no red, no green.

### Select

Same box metrics as Input (44px, radius md, 1px border). Native <select> with custom chevron on the right, 16px text on mobile. Options read German labels; values stay ISO/UTC. Keyboard-operable, focus ring identical to Input.

### DateTimeField

Booking form time entry: a paired date control (type=date) plus two time controls (type=time, step 900) in one row that wraps to a stacked column below 480px. Displays and accepts 24h 'HH:MM'; the form assists the user by showing the computed duration next to the fields as 'Dauer: 2 Std. 30 Min.' (tabular-nums, muted), turning to danger text when > 8 Std. All values are interpreted and submitted as UTC; a static hint 'Alle Zeiten in UTC' sits under the field group.

### RoomCard

bg=surface, radius lg (16px), 1px border=border, padding 16-20, no shadow (shadow only on hover: 0 1px 2px shadow_color). Line 1: room name, 17px/600. Line 2: seats as '12 Plätze' with a small chair icon, 13px muted, tabular-nums. Line 3: equipment as Tag chips, wrapping with 8px gap. Whole card is one clickable target (min 44px per hit area) to the room day view; keyboard focusable with visible ring. Grid: 1 column <720px, 2 columns 720-1079px, 3 columns >=1080px.

### Tag / FilterChip

Radius pill, padding 4/10, font 13px/500. Default: bg=surface_alt, text=fg, 1px border=border. Interactive filter chip: same, plus hover border=border_strong; selected: bg=accent_soft, text=accent_pressed, border=#BFD2FB, with a leading check mark; focus ring as Button. min-height 32px visually but the hit area is padded to 44px on touch breakpoints. Chips render lowercase-preserved equipment keywords exactly as stored.

### FilterBar

Sticky bar under the page header on mobile (top: 56px, bg=bg, 1px bottom border). Layout: free-text field for room name plus a wrapping row of equipment FilterChips (8px gaps). On <480px the chips row wraps into multiple lines and the bar grows vertically — never horizontally scrollable. A 'Filter zurücksetzen' ghost button appears only when at least one filter is active.

### DayPicker

Row: '«' (previous day) + date display + '»' (next day) + 'Heute' ghost button; each control >=44px, keyboard reachable, arrows disabled (visually greyed with tooltip) only at their bounds. Date display: 'Mo, 14.03.2025' + a muted 'UTC' suffix. A small native date input sits behind the label for direct jumps.

### BookingRow

One booking in the day view: left column = time range in mono/tabular-nums ('09:00 – 11:30', 15px/600), width fixed 108px on desktop and stacked above the text below 480px; right column = title (15px/500) and 'gebucht von: Anna' (13px muted). Height >=64px, padding 12/16, 1px bottom border=border, hover bg=surface_alt. Past bookings (start <= now) get a muted 2px left marker + the label 'Begonnen' chip in warning style; their edit/delete buttons are rendered disabled with the tooltip/hint 'Begonnene Buchungen lassen sich nicht ändern' (AC-10/AC-20). Clicking a row opens it for edit; the whole row is focusable with a visible ring.

### Timeline / DayView

Header: room name + seats + equipment chips + DayPicker. Body: vertical list of BookingRow, chronologically ascending, wrapped in a Card (radius lg, bg=surface, 1px border). Free gaps between bookings are shown as a quiet dotted placeholder row with the label 'frei'. Empty day: EmptyState inside the card, not an empty surface.

### EmptyState

Centred block, padding 32, radius md, bg=surface_alt, 1px dashed border=border_strong: one line of 15px/500 fg in plain German, one line of 13px muted explaining the next step, plus an optional primary Button. Mandatory wording cases: no rooms match the equipment filter ('Keine Räume mit dieser Ausstattung gefunden — Filter anpassen oder zurücksetzen.'), empty day ('An diesem Tag ist der Raum frei.'), no free rooms ('Kein freier Raum für diesen Zeitraum — Zeitraum ändern oder Mindestzahl an Plätzen senken.').

### Notice / Banner

Inline block, radius md, padding 12/16, 1px border, 13-15px text, max 2 lines then detail expandable. Variants: error (bg=danger_soft, border=#E9BFC2, text=danger, role=alert), success (bg=success_soft, border=#BFE0D0, text=success), info (bg=accent_soft, border=#BFD2FB, text=accent_pressed), warning (bg=warning_soft, border=#E8D3A6, text=warning). The overlap rejection from the API (409) MUST render as the error variant above the form fields and name the occupied period explicitly: 'Der Raum ist von 09:00 bis 11:30 bereits gebucht.' — form inputs keep their values (AC-17).

### LoadingState

Skeletons in the shape of the expected content (RoomCard grid, BookingRow list) using bg=surface_alt with a 1.4s shimmer between surface_alt and #E4E7EC, radius matching the target component. Inline button loading: the primary Button shows a 16px spinner (currentColor) and stays width-stable, label unchanged. Every load and error state is visibly distinguishable on all views (AC non-functional).

### Modal (room create/edit)

Overlay=overlay, panel bg=surface, radius lg, max-width 520px, padding 24, shadow 0 8px 24px shadow_color; on <480px the panel becomes a bottom sheet (radius 16px top corners, full width, max-height 90vh, scrollable body). Header 17px/600 + close button (44px). Focus is trapped, Esc closes, focus returns to the trigger. Footer: ghost 'Abbrechen' + primary 'Speichern'.

### AppHeader

Sticky top, height 56px (mobile) / 64px (desktop), bg=surface with 1px bottom border=border. Left: product name 17px/600. Right: nav links 'Räume', 'Freie Räume' (active = fg + 2px accent underline, inactive = muted). Below 480px the nav collapses into a wrapping second row of two 44px tabs — no hamburger, no horizontal scroll. The nav also carries the persistent hint 'Alle Zeiten in UTC' in 13px muted on desktop.

### Toast

Bottom-centred on mobile, bottom-right on desktop, max-width 360px, radius md, padding 12/16, bg=#16181D, text #FFFFFF, 13-15px, auto-dismiss after 5s, dismissible by button, role=status. Used only for success confirmations ('Raum angelegt', 'Buchung gelöscht'); errors stay inline in the form, never toast-only.

## Layout Principles

- Container: max-width 1120px, centred, horizontal padding 16px (>=360px), 20px (>=768px), 32px (>=1280px). Forms and the booking detail column are max-width 720px.
- Breakpoints: 360px (minimum supported), 480px (stacking threshold), 768px (tablet: room grid goes 2-up, timeline gains its fixed 108px time column), 1080px (room grid 3-up), 1280px (max-width reached, padding grows only).
- No horizontal scrolling at any width from 360px up: every flex/grid row either wraps or stacks; filter bars, form rows and chips wrap; long titles break with overflow-wrap:anywhere; tabular time strings never shrink below 72px.
- Vertical rhythm: 8px base unit. 12px inside a control group, 16px between related blocks, 24px between cards, 48px between page sections. Page top padding 24px (mobile) / 40px (desktop).
- Structure per view: Rooms = header + FilterBar + responsive RoomCard grid. Room day view = room header card + DayPicker + Timeline card. New/edit booking = single-column form card (max 720px) with inline Notice above the fields. Free-room search = compact 3-field form row that stacks below 480px, results as RoomCard grid.
- Grid: CSS Grid with a 16px gap on mobile and 24px on desktop for the room cards; flex column with 12px gaps for timelines and forms. No fixed pixel widths on layout containers.
- Touch targets: every interactive element (button, chip, row, tab, icon control) has a hit area of at least 44x44px; adjacent targets are separated by at least 8px.
- ONE format for every date, time, duration and count the product shows — binding for all views: date 'DD.MM.YYYY' (14.03.2025), weekday 'Mo'-'So' German and abbreviated, full day view label 'Mo, 14.03.2025', time 24h 'HH:MM' (09:00), time range '09:00 – 11:30' (en dash with spaces), duration '2 Std. 30 Min.' ('45 Min.' when under an hour), seats '12 Plätze' ('1 Platz'), equipment keywords as stored. All values are UTC and are never converted for display; the context carries a single 13px muted 'UTC' suffix (day view header, form time group) instead of repeating it per row. Numbers and times always use tabular-nums.
- Accessibility baked into layout: logical heading order (h1 per view, h2 per section), labels above inputs (never placeholder-as-label), focus-visible ring on every focusable element, error text bound via aria-describedby, state changes announced (role=alert for errors, role=status for toasts and loading, aria-busy on loading containers). Contrast: fg on surface >= 12:1, muted on surface >= 4.5:1, white on accent 4.5:1.
- Colour is never the only signal: selected chips carry a check mark, past bookings carry the text chip 'Begonnen', disabled controls carry a visible hint, error fields carry text not just a red border.
- Responsive form behaviour: primary actions are full-width below 480px and right-aligned auto-width above; the sticky FilterBar and AppHeader stay opaque (bg=bg / surface) so content scrolling behind them never reduces legibility.
