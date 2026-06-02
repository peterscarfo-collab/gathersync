# GatherSync Dashboard Help & Tutorials
*A comprehensive guide to mastering the GatherSync platform.*

## 1. Getting Started
Welcome to GatherSync! This application is designed to make event planning, participant management, and attendance tracking effortless.

As an Administrator, you have access to this Dashboard where you can oversee all events, manage users, and generate detailed reports.

## 2. Creating & Managing Events

**Flexible vs Fixed Events:**
*   **Flexible Events:** Best for finding a date. Invitees receive a calendar where they mark their availability (Green=Available, Red=Unavailable). The system then highlights the "Best Days" with the highest attendance percentage.
*   **Fixed Events:** Best when you already know the exact date and time. Invitees can quickly RSVP (Attending, Not Attending).

**To create an event:** Go to the Events tab, click the "+" button, and follow the wizard. You can add locations, virtual meeting links, a Team Leader, and set a **Minimum Attendance (Quorum)** to ensure the event only proceeds if enough people can make it.

## 3. Templates & Recurring Events

**Standard Templates:** Under the "Saves" tab, you can create and manage templates to instantly copy participants when creating a new event.

**Recurring Templates:** Also in the "Saves" tab, you can set up templates that automatically generate events on a schedule (e.g. "First Monday of every month" or "Weekly").
*   When creating a recurring template, use the **Copy from Past Event** button to quickly import all details (including meeting type, location, link, and exact participant list) from a previous gathering.
*   GatherSync will automatically look ahead and generate the event for the correct upcoming date, saving you from having to recreate regular meetings.

## 4. Importing Participants (CSV)
For large gatherings like corporate events, weddings, or club meetings, you can bulk-import your invitees via a CSV file.
1.  Open any Event's details screen.
2.  Click the three dots "..." menu in the top right.
3.  Select **Import Contact List (CSV)**.
4.  Prepare a spreadsheet with columns: *Name, Phone, Email, Title/Designation, Company/Organization, Lead Source, Day 1, Day 2, Day 3*.
    *   *Note: For flexible events, you can include Day 1, Day 2, and Day 3 columns with day numbers (e.g., 12, 14, 16) to automatically mark those days as available for the participant.*
5.  Copy/paste the data or select the file directly to instantly import everyone. GatherSync will automatically skip duplicates.

## 5. Sending Messages & Reminders
GatherSync makes it easy to communicate with your event participants.

**Custom Reminders:** On the event details page, you can draft a "Reminder Message". This message will be automatically prepended whenever you share the event link.

**Send Messages (SMS/Email):** From the event menu, select "Send Messages". Filter participants, then send an SMS, a Native Email (Bcc in your mail app), or an App Email (GatherSync sends personalized invitations from the app).

**Meeting updates:** When the time, date, Zoom link, or venue changes after the first invite, open Send Messages and turn on **Meeting update**. App Email uses subject `UPDATE — [Event name] (details changed)` with an orange **MEETING UPDATE** banner in the body. SMS and Native Email prepend an UPDATE notice at the top of the message. After you send App Email once for an event, **Meeting update** turns on automatically the next time you open Send Messages. Turn it off only for a true first invite (e.g. new participants).

**Example:** Your group meeting moved from 4:00pm to 3:30pm — edit the event, open Send Messages, confirm **Meeting update** is on, then send App Email to the group.

## 6. Tracking Attendance
When a Fixed Event is happening, you can take live attendance:
1.  Open the Event Details and open the menu.
2.  Select **Take / View Attendance**.
3.  Simply tap names to mark them as "Attended". Once saved, this feeds directly into your Analytics and Reports.

## 7. Receiving & Responding to Invitations (The Invitee Experience)
When you invite others to an event, they also get a seamless experience if they use GatherSync.
*   **Events I'm Invited To:** When an invitee RSVPs to your event using their email address, that event will automatically appear on their own GatherSync dashboard under the "Events I'm Invited To" section.
*   **Managing Their Own Record:** Invitees can click on the event from their dashboard to view the full details. They can then click on their own name in the participant list to edit their record.
*   **Editing Details & Adding Notes:** Invitees have full control over their own profile for that event. For example, if you added them as "Peter S", they have the ability to change it to their full name. They can also update their phone number, email address, Digital Twin URL, add Notes (e.g., "Can only arrive after 6pm"), and update their availability or RSVP status at any time. Any changes they make will automatically sync back to your organizer dashboard!

## 8. Reporting & Exporting

**Analytics Dashboard:** Found in the Admin menu, this gives you a macro view of your organization's health—total participants, overall response rates, and a history of past events.

**Export Event to CSV:** Need to print name tags using Canva, Microsoft Word, or import into another CRM? Open an event's menu and select "Export Event to CSV". It generates a file with all contact details, titles, organizations, and their final RSVP/Attendance status!

## 9. Participant Management & CRM
The **Participant Management** screen is your master directory and built-in CRM. If you edit a participant's phone number or Title here, it syncs globally across all their events!

**Searching, Filtering & Sorting:**
*   **Search:** Use the search bar to find people by name, phone, email, title, company, lead source, notes, or event name.
*   **Filter by Event:** Click **Filter: All Events** and choose a specific event or **Prospects Only** to narrow the list.
*   **Contact Filters:** Click **Total**, **With Phone**, **With Email**, or **With Source** to filter. Counts update to match your current event filter and search.
*   **Missing Data:** Amber cards below show database gaps — **No Phone**, **No Email**, **No Source**, **No Company**. Click one to list only those contacts, then **Export Filtered** for a cleanup CSV. On each card, missing fields appear in amber italic (e.g. *No phone*).
*   **Sort:** Sort by First Name, Last Name, Phone, Event, or Lead Source. Last Name sort lists people with a surname alphabetically first; single-name contacts (e.g. "Ben") appear at the end.
*   **Result Count:** When filters or search are active, a line above the summary cards shows how many people match (e.g. "Showing 12 of 175 matching prospects for 'letterbox'").

**Using the Prospecting System:**
*   **Add a Prospect:** Click "+", enter their details, and select "None (Add as Prospect)" as the event. They will be saved to your directory without creating an account.
*   **Find Prospects:** Use the "Filter: All Events" button at the top and select "Prospects Only" to instantly view your leads.
*   **Upgrade to User:** Open a prospect's details and scroll to the bottom. Click "Create Account & Send Link" to instantly generate a free GatherSync account and get a magic login link to email them!

**Actions Menu (Bulk Operations):**
Click the **Actions** button (⋯) in the top right to work with everyone currently shown in your filtered list:
*   **Add Filtered to Event...** — Select an event and bulk-add all visible contacts. Great for inviting letterbox-drop prospects to a virtual event without adding them one by one.
*   **Export Filtered List (CSV)** — Download only the people in your current view.
*   **Import Contact List (CSV)** — Bulk import new prospects or contacts.

You can also use **Import List** and **Export List** buttons below the summary cards for quick access to the same import/export tools.

## 10. Data Backup & Recovery
Your event data is safely stored on your device, but it's important to know how the backup system works:

**Export / Import Backup:** From the main Events screen, you can export your entire database as a JSON file to your device. You can then use this file to restore your data later via "Import Backup". *Note: Importing a backup completely overwrites your current data.*

**Single Event Backup:** Have an important event with a lot of transactions? Open that specific event, click the menu ("..."), and select **Export Backup (Single Event)**. This lets you save the state of just one event without affecting the rest of your app.

**Automatic Backups & Data Recovery:** GatherSync automatically takes hidden "safety snapshots" before major actions (like importing data or syncing to the cloud). If something goes wrong, use the **Data Recovery** tool to revert your app back to the exact moment before the action was taken.