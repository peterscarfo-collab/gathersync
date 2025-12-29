# Desktop Demo Testing Checklist

Test these flows before tomorrow's 10 AM demo:

## ✅ Core Event Creation Flow
- [ ] Click "+ Create Event" button
- [ ] Enter event name
- [ ] Select event type (Flexible or Fixed)
- [ ] For Fixed: Set date and time using HTML5 pickers
- [ ] For Flexible: Select month and year
- [ ] Click "Create Event"
- [ ] Verify event appears in list

## ✅ Add Participants
- [ ] Click on created event
- [ ] Click "+ Add Participant"
- [ ] **Manual Tab**: Enter name, phone, email
- [ ] Click "Add Participant"
- [ ] Verify participant appears in list
- [ ] **AI Import Tab**: Paste participant list
- [ ] Verify AI extracts names and contact info
- [ ] **Load Contacts**: Note this won't work on desktop (phone only)

## ✅ Edit Participant
- [ ] Click on a participant in the event
- [ ] Update phone number
- [ ] Update email
- [ ] Update notes
- [ ] Verify changes save automatically
- [ ] Click back arrow

## ✅ Delete Participant
- [ ] Click on a participant
- [ ] Click trash icon (top right)
- [ ] Confirm deletion in dialog
- [ ] Verify participant removed from list

## ✅ 3-Dot Menu (FIXED)
- [ ] Click 3 dots next to event name
- [ ] Verify modal menu appears
- [ ] Test "Edit Event"
- [ ] Test "Copy Event"
- [ ] Test "Delete Event"
- [ ] Click "Cancel" to close menu
- [ ] Click outside menu to dismiss

## ✅ Mark Availability (Flexible Events)
- [ ] Click on participant
- [ ] Toggle days available/unavailable
- [ ] Use "All Weekends" quick actions
- [ ] Toggle "Unavailable All Month"
- [ ] Verify changes save

## ✅ RSVP (Fixed Events)
- [ ] Click on participant
- [ ] Select "Attending", "Not Attending", or "Maybe"
- [ ] Verify status updates

## ⚠️ Known Limitations on Desktop
- **Load Contacts**: Doesn't work (no phone contacts on desktop)
- **Share Event**: May not work properly (native share sheet)
- **Export to Calendar**: May have issues on web
- **Text All Participants**: SMS won't work on desktop

## 🎯 Demo Strategy
1. **Focus on what works**: Event creation, manual participant entry, availability marking
2. **Acknowledge limitations**: "This is optimized for mobile, desktop version coming soon"
3. **Show the vision**: "Imagine this on your phone with full contact integration"
4. **Get feedback**: "Does this solve your scheduling problem?"

## 📝 After Demo
- Implement cloud sync (Priority #1)
- Build production web version for admins
- Get Apple Developer account for iOS TestFlight
