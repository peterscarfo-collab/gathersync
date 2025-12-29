#!/usr/bin/env python3
"""Generate GatherSync instructions PDF with embedded QR code"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak
from reportlab.lib.colors import HexColor

# Create PDF
pdf_file = "GatherSync-Instructions-WithQR.pdf"
doc = SimpleDocTemplate(pdf_file, pagesize=letter,
                        rightMargin=0.75*inch, leftMargin=0.75*inch,
                        topMargin=0.75*inch, bottomMargin=0.75*inch)

# Container for the 'Flowable' objects
elements = []

# Define styles
styles = getSampleStyleSheet()
title_style = ParagraphStyle(
    'CustomTitle',
    parent=styles['Heading1'],
    fontSize=28,
    textColor=HexColor('#1a1a1a'),
    spaceAfter=12,
    alignment=TA_CENTER,
    fontName='Helvetica-Bold'
)

subtitle_style = ParagraphStyle(
    'CustomSubtitle',
    parent=styles['Heading2'],
    fontSize=16,
    textColor=HexColor('#4a4a4a'),
    spaceAfter=20,
    alignment=TA_CENTER,
    fontName='Helvetica'
)

heading_style = ParagraphStyle(
    'CustomHeading',
    parent=styles['Heading2'],
    fontSize=18,
    textColor=HexColor('#2563eb'),
    spaceAfter=12,
    spaceBefore=20,
    fontName='Helvetica-Bold'
)

subheading_style = ParagraphStyle(
    'CustomSubheading',
    parent=styles['Heading3'],
    fontSize=14,
    textColor=HexColor('#1a1a1a'),
    spaceAfter=8,
    spaceBefore=12,
    fontName='Helvetica-Bold'
)

body_style = ParagraphStyle(
    'CustomBody',
    parent=styles['BodyText'],
    fontSize=11,
    textColor=HexColor('#2a2a2a'),
    spaceAfter=6,
    leading=16,
    fontName='Helvetica'
)

# Page 1: Title and Introduction
elements.append(Spacer(1, 0.5*inch))
elements.append(Paragraph("Welcome to GatherSync! 🎉", title_style))
elements.append(Spacer(1, 0.1*inch))
elements.append(Paragraph("Your Personal Event Coordination Assistant", subtitle_style))
elements.append(Spacer(1, 0.3*inch))

intro_text = """Peter has invited you to test GatherSync - a new app designed to make coordinating 
group events easier. This app helps you find the perfect date when everyone is available."""
elements.append(Paragraph(intro_text, body_style))
elements.append(Spacer(1, 0.4*inch))

# Quick Start Guide
elements.append(Paragraph("Quick Start Guide", heading_style))
elements.append(Spacer(1, 0.2*inch))

# Step 1
elements.append(Paragraph("Step 1: Install Expo Go", subheading_style))
elements.append(Paragraph("<b>iPhone Users:</b>", body_style))
elements.append(Paragraph("1. Open the <b>App Store</b>", body_style))
elements.append(Paragraph("2. Search for <b>\"Expo Go\"</b>", body_style))
elements.append(Paragraph("3. Install the app (it's free)", body_style))
elements.append(Spacer(1, 0.1*inch))

elements.append(Paragraph("<b>Android Users:</b>", body_style))
elements.append(Paragraph("1. Open the <b>Google Play Store</b>", body_style))
elements.append(Paragraph("2. Search for <b>\"Expo Go\"</b>", body_style))
elements.append(Paragraph("3. Install the app (it's free)", body_style))
elements.append(Spacer(1, 0.3*inch))

# Step 2 with QR Code
elements.append(Paragraph("Step 2: Open GatherSync", subheading_style))
elements.append(Paragraph("<b>Option A: Scan the QR Code</b> (Easiest!)", body_style))
elements.append(Paragraph("1. Open the <b>Expo Go</b> app", body_style))
elements.append(Paragraph("2. Tap <b>\"Scan QR code\"</b>", body_style))
elements.append(Paragraph("3. Point your camera at the QR code below:", body_style))
elements.append(Spacer(1, 0.2*inch))

# Add QR code image
try:
    qr_img = Image("gathersync-qr.png", width=3*inch, height=3*inch)
    qr_img.hAlign = 'CENTER'
    elements.append(qr_img)
except Exception as e:
    elements.append(Paragraph(f"<i>QR Code image not found: {e}</i>", body_style))

elements.append(Spacer(1, 0.3*inch))

# Page Break
elements.append(PageBreak())

# Page 2: Alternative URL method
elements.append(Paragraph("<b>Option B: Enter URL Manually</b>", body_style))
elements.append(Paragraph("1. Open the <b>Expo Go</b> app", body_style))
elements.append(Paragraph("2. Tap <b>\"Enter URL manually\"</b> at the bottom", body_style))
elements.append(Paragraph("3. Copy and paste this URL:", body_style))
elements.append(Spacer(1, 0.1*inch))

url_style = ParagraphStyle(
    'URLStyle',
    parent=body_style,
    fontSize=9,
    textColor=HexColor('#2563eb'),
    fontName='Courier',
    leftIndent=20,
    rightIndent=20,
    backColor=HexColor('#f3f4f6'),
    borderPadding=10
)
elements.append(Paragraph("https://8081-ienb1rj930k0x92csc3x6-a41ba8ee.manus-asia.computer", url_style))
elements.append(Spacer(1, 0.1*inch))
elements.append(Paragraph("4. Tap <b>\"Connect\"</b>", body_style))
elements.append(Spacer(1, 0.3*inch))

# Step 3
elements.append(Paragraph("Step 3: Log In to Enable Cloud Sync", subheading_style))
elements.append(Paragraph("1. When GatherSync opens, you'll see a <b>\"Cloud Sync Available\"</b> banner", body_style))
elements.append(Paragraph("2. Tap the <b>\"Log In\"</b> button", body_style))
elements.append(Paragraph("3. <b>Create an account</b> or use <b>OAuth</b> (Google/GitHub)", body_style))
elements.append(Paragraph("4. After logging in, you'll be redirected back to the app", body_style))
elements.append(Spacer(1, 0.3*inch))

# Step 4
elements.append(Paragraph("Step 4: Sync Your Events", subheading_style))
elements.append(Paragraph("1. You should now see <b>\"Cloud sync enabled\"</b> banner (green)", body_style))
elements.append(Paragraph("2. Tap the <b>\"Sync Now\"</b> button", body_style))
elements.append(Paragraph("3. Wait 10-20 seconds while syncing", body_style))
elements.append(Paragraph("4. <b>You should see 2 events appear:</b>", body_style))
elements.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;• <b>AI Guys</b> - Monthly flexible event", body_style))
elements.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;• <b>Guru Breakfast</b> - Monthly event", body_style))
elements.append(Spacer(1, 0.3*inch))

# Page Break
elements.append(PageBreak())

# Page 3: Mark Availability
elements.append(Paragraph("Step 5: Mark Your Availability", subheading_style))
elements.append(Spacer(1, 0.1*inch))

elements.append(Paragraph("<b>For Flexible Events (AI Guys):</b>", body_style))
elements.append(Paragraph("1. Tap on the <b>AI Guys</b> event", body_style))
elements.append(Paragraph("2. Find your name in the participants list", body_style))
elements.append(Paragraph("3. Tap on your name", body_style))
elements.append(Paragraph("4. Mark the dates you're <b>available</b> or <b>unavailable</b>", body_style))
elements.append(Paragraph("5. The app will help find the best date when most people can attend", body_style))
elements.append(Spacer(1, 0.2*inch))

elements.append(Paragraph("<b>For Fixed Events (Guru Breakfast):</b>", body_style))
elements.append(Paragraph("1. Tap on the <b>Guru Breakfast</b> event", body_style))
elements.append(Paragraph("2. Find your name in the participants list", body_style))
elements.append(Paragraph("3. Tap on your name", body_style))
elements.append(Paragraph("4. Select your RSVP status:", body_style))
elements.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;✅ <b>Attending</b>", body_style))
elements.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;❌ <b>Not Attending</b>", body_style))
elements.append(Paragraph("&nbsp;&nbsp;&nbsp;&nbsp;❓ <b>No Response</b> (default)", body_style))
elements.append(Spacer(1, 0.3*inch))

# Step 6
elements.append(Paragraph("Step 6: Sync Your Changes", subheading_style))
elements.append(Paragraph("After marking your availability or RSVP:", body_style))
elements.append(Paragraph("1. Go back to the <b>Events</b> list (tap the back arrow)", body_style))
elements.append(Paragraph("2. Tap <b>\"Sync Now\"</b> again", body_style))
elements.append(Paragraph("3. Your responses will be uploaded to the cloud", body_style))
elements.append(Paragraph("4. Everyone else will see your updates when they sync", body_style))
elements.append(Spacer(1, 0.4*inch))

# Important Tips
elements.append(Paragraph("Important Tips", heading_style))
elements.append(Paragraph("✅ <b>Always sync after making changes</b> - Your availability/RSVP won't be shared until you tap \"Sync Now\"", body_style))
elements.append(Paragraph("✅ <b>Sync regularly to see updates</b> - Other people's responses will appear when you sync", body_style))
elements.append(Paragraph("✅ <b>Keep Expo Go installed</b> - You'll need it to access GatherSync until we release the standalone app", body_style))
elements.append(Paragraph("✅ <b>Internet connection required</b> - Syncing requires an active internet connection", body_style))
elements.append(Spacer(1, 0.4*inch))

# Page Break
elements.append(PageBreak())

# Page 4: Help and Testing
elements.append(Paragraph("Need Help?", heading_style))
elements.append(Paragraph("If you encounter any issues:", body_style))
elements.append(Paragraph("1. <b>Force close and reopen</b> - Swipe up from app switcher and reopen Expo Go", body_style))
elements.append(Paragraph("2. <b>Check your internet connection</b> - Sync requires WiFi or mobile data", body_style))
elements.append(Paragraph("3. <b>Contact Peter</b> - He's testing this app and wants your feedback!", body_style))
elements.append(Spacer(1, 0.4*inch))

elements.append(Paragraph("What to Test", heading_style))
elements.append(Paragraph("Peter would love your feedback on:", body_style))
elements.append(Paragraph("• ✅ Does the app load correctly?", body_style))
elements.append(Paragraph("• ✅ Can you see the events after syncing?", body_style))
elements.append(Paragraph("• ✅ Can you mark your availability/RSVP?", body_style))
elements.append(Paragraph("• ✅ Do your changes sync back to other users?", body_style))
elements.append(Paragraph("• ✅ Is the app easy to use?", body_style))
elements.append(Paragraph("• ✅ What features would make it more useful?", body_style))
elements.append(Spacer(1, 0.4*inch))

elements.append(Paragraph("Privacy & Data", heading_style))
elements.append(Paragraph("• Your data is stored securely in the cloud", body_style))
elements.append(Paragraph("• Only members of your events can see your responses", body_style))
elements.append(Paragraph("• You can delete your account and data at any time", body_style))
elements.append(Paragraph("• This is a test version - please don't enter sensitive information", body_style))
elements.append(Spacer(1, 0.5*inch))

# Footer
elements.append(Spacer(1, 0.3*inch))
elements.append(Paragraph("<b>Thank you for testing GatherSync!</b>", subtitle_style))
elements.append(Paragraph("Your feedback will help make this app better for everyone.", body_style))
elements.append(Spacer(1, 0.2*inch))
elements.append(Paragraph("<i>Questions? Contact Peter Scarfo</i>", body_style))
elements.append(Spacer(1, 0.3*inch))
elements.append(Paragraph("© 2025 Peter Scarfo. All rights reserved.", body_style))

# Build PDF
doc.build(elements)
print(f"✅ PDF generated successfully: {pdf_file}")
