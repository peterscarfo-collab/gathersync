# GatherSync - Mobile App Design Plan

## Design Philosophy
GatherSync follows Apple Human Interface Guidelines (HIG) to feel like a native iOS app. The design assumes **mobile portrait orientation (9:16)** and **one-handed usage**.

## Color Palette
- **Primary Accent**: Indigo (#4F46E5) - for CTAs, highlights, and best day markers
- **Secondary**: Slate (#64748B) - for secondary text and icons
- **Success**: Green (#10B981) - for availability indicators
- **Warning**: Amber (#F59E0B) - for partial availability
- **Error**: Red (#EF4444) - for unavailability
- **Background**: White (#FFFFFF) light / Dark (#0F172A) dark
- **Surface**: Light Gray (#F8FAFC) light / Darker Gray (#1E293B) dark
- **Text Primary**: Near Black (#0F172A) light / White (#F8FAFC) dark
- **Text Secondary**: Slate (#64748B)

## Typography
- **Title**: 28pt, Bold, Line Height 36pt
- **Subtitle**: 20pt, Semibold, Line Height 28pt
- **Body**: 16pt, Regular, Line Height 24pt
- **Caption**: 14pt, Regular, Line Height 20pt
- **Small**: 12pt, Regular, Line Height 16pt

## Spacing & Layout
- Base unit: 8pt grid
- Screen padding: 16pt horizontal
- Section spacing: 24pt vertical
- Card padding: 16pt
- Button height: 48pt minimum (thumb-friendly)
- Bottom action zone: Last 1/3 of screen for primary actions

## Screen List & User Flows

### 1. **Events List Screen** (Home Tab)
**Primary Content:**
- List of all events created by the user
- Each event card shows: Event name, month/year, participant count, best day indicator
- Empty state with "Create Your First Event" CTA
- Floating "+" button in bottom-right for creating new events

**Functionality:**
- Tap event card → Navigate to Event Detail
- Tap "+" button → Navigate to Create Event
- Swipe left on event → Delete option
- Pull to refresh

**Layout:**
- Header with app logo and title
- Search bar (optional, for many events)
- Scrollable list of event cards
- Floating action button (FAB) at bottom-right

### 2. **Create/Edit Event Screen** (Modal)
**Primary Content:**
- Event name input field
- Month/Year picker (iOS-style wheel picker)
- Initial participant list (optional)
- Save/Create button at bottom

**Functionality:**
- Text input for event name
- Native date picker for month/year selection
- Add participants inline or skip to add later
- Save creates event and navigates to Event Detail

**Layout:**
- Modal presentation from bottom
- Close button top-left
- Form fields in center
- Primary action button at bottom (within thumb zone)

### 3. **Event Detail Screen** (Main Screen)
**Primary Content:**
- Event name header (editable)
- Month/year display with navigation arrows
- Interactive calendar grid (7 columns × 4-6 rows)
- Heatmap visualization: days colored by availability count
- Best day(s) highlighted with star icon and green border
- Participant list below calendar
- "Add Participant" button
- "Share Event" button

**Functionality:**
- Tap day → Open Day Detail Sheet
- Tap participant → Open Participant Availability Editor
- Swipe left/right on calendar → Navigate months
- Tap "Add Participant" → Open Add Participant Sheet
- Tap "Share Event" → Native share sheet with event link

**Layout:**
- Sticky header with event name and month navigation
- Calendar takes upper 40% of screen
- Scrollable participant list below
- Action buttons at bottom

### 4. **Day Detail Sheet** (Bottom Sheet)
**Primary Content:**
- Selected date display (e.g., "December 15, 2025")
- Availability count (e.g., "8 of 10 available")
- List of participants with status indicators:
  - Green checkmark: Available
  - Red X: Unavailable
  - Gray dash: No response

**Functionality:**
- Scroll through participant list
- Tap participant → Toggle their availability for this day
- Swipe down to dismiss

**Layout:**
- Bottom sheet modal (60% screen height)
- Rounded top corners (24pt radius)
- Drag handle at top
- Scrollable content

### 5. **Participant Availability Editor** (Modal)
**Primary Content:**
- Participant name header
- Calendar grid for the month
- Toggle controls:
  - "Select Range" mode (Shift+Click simulation)
  - "Mark Unavailable All Month" toggle
- Individual day selection by tapping
- Save button

**Functionality:**
- Tap days to toggle availability
- Range selection: Tap start date, then end date (visual feedback)
- "Unavailable All Month" toggle clears all selections
- Save updates availability and returns to Event Detail

**Layout:**
- Full-screen modal
- Close button top-left, Save button top-right
- Calendar in center
- Toggle controls below calendar

### 6. **Add Participant Sheet** (Bottom Sheet)
**Primary Content:**
- Two tabs: "Manual" and "AI Import"
- **Manual Tab:**
  - Text input field
  - "Add" button
  - List of recently added participants (with remove option)
- **AI Import Tab:**
  - Multi-line text area for pasting message
  - "Extract Participants" button
  - Preview list of extracted names with checkboxes
  - "Add Selected" button

**Functionality:**
- Manual: Type name and tap Add
- AI: Paste text, tap Extract, review, select, and add
- Dismiss sheet after adding

**Layout:**
- Bottom sheet modal (70% screen height)
- Segmented control for tabs at top
- Input/textarea in center
- Action button at bottom

### 7. **Saves/Templates Screen** (Tab or Modal)
**Primary Content:**
- Two sections: "Event History" and "Group Templates"
- **Event History:**
  - List of saved event snapshots
  - Each shows: Event name, date saved, participant count
  - Tap to restore
- **Group Templates:**
  - List of saved participant groups
  - Each shows: Template name, participant count
  - Tap to use in new event

**Functionality:**
- Tap event snapshot → Restore full event state
- Tap template → Load participants into current event
- Swipe to delete
- "Save Current Event" button
- "Save as Template" button

**Layout:**
- Segmented control for sections
- Scrollable lists
- Action buttons at bottom

## Key User Flows

### Flow 1: Create New Event and Add Participants
1. User taps "+" FAB on Events List
2. Create Event modal appears
3. User enters event name, selects month/year
4. User taps "Create"
5. Event Detail screen opens
6. User taps "Add Participant"
7. Add Participant sheet appears
8. User adds participants manually or via AI
9. Sheet dismisses, participants appear in list

### Flow 2: Mark Participant Availability
1. User is on Event Detail screen
2. User taps a participant name
3. Participant Availability Editor opens
4. User taps days to mark availability
5. User taps "Save"
6. Calendar updates with new heatmap colors
7. Best day indicator updates if changed

### Flow 3: View Best Day and Details
1. User views Event Detail screen
2. Calendar shows heatmap with best day highlighted (star + green border)
3. User taps the best day
4. Day Detail sheet opens
5. User sees full list of who's available
6. User can toggle availability if needed
7. User swipes down to dismiss

### Flow 4: Save and Restore Event
1. User taps "Saves" button on Event Detail
2. Saves screen opens
3. User taps "Save Current Event"
4. Event snapshot saved to Event History
5. Later, user opens Saves screen
6. User taps saved event
7. Full event state restores (name, month, participants, availability)

### Flow 5: Use Group Template
1. User creates new event
2. User taps "Add Participant"
3. User switches to "Templates" tab (or accesses from Saves screen)
4. User taps a saved group template (e.g., "AI Guys")
5. Participant names populate
6. User proceeds to mark availability

## Component Style
- **Buttons**: 12pt corner radius, 48pt minimum height, bold text
- **Cards**: 16pt corner radius, subtle shadow, 16pt padding
- **Bottom Sheets**: 24pt top corner radius, drag handle, backdrop blur
- **Calendar Cells**: Square aspect ratio, 8pt corner radius, border on selection
- **Icons**: 24pt size, filled style for consistency
- **Input Fields**: 8pt corner radius, 48pt height, clear button on right

## Animations & Interactions
- **Haptic Feedback**: Light impact on button taps, medium on day selection
- **Transitions**: Smooth modal presentations (slide from bottom), sheet dismissals (swipe down)
- **Calendar Updates**: Fade transition when heatmap colors change
- **Best Day Highlight**: Subtle pulse animation on star icon

## Accessibility
- Minimum touch target: 44pt
- High contrast mode support
- VoiceOver labels for all interactive elements
- Dynamic type support for text scaling

## Data Persistence
- Local storage using AsyncStorage for offline-first experience
- All event data, participant lists, and availability stored locally
- Optional cloud sync (future enhancement with backend)

## Technical Notes
- Use React Native's `FlatList` for participant lists (performance)
- Calendar grid uses custom component with gesture handlers
- Bottom sheets use `react-native-bottom-sheet` or custom implementation
- Heatmap colors calculated dynamically based on availability percentage
- AI import uses regex/NLP to extract names and dates from natural language
