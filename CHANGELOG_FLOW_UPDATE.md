# Flow Update

Updated customer chat flow:

1. Only one start option: Check Stock
2. Item code retry handling:
   - First wrong code: ask to try again
   - Second wrong code: show Help Desk message + Connect Help Desk WhatsApp link
3. After valid item code:
   - Ask: "Kindly select the below option"
   - Options: PCS / BOX
   - Then ask quantity number
4. Availability response preserves user's selected unit:
   - PCS inquiry replies in PCS
   - BOX inquiry replies in BOX
5. After response:
   - Ask: "Is there anything I can do for you?"
   - Yes: Check Another Item / Connect Help Desk
   - No: Thank you message

Box conversion rules:

- LS... = 30 PCS per BOX
- H... = 20 PCS per BOX
- L... = 16 PCS per BOX
