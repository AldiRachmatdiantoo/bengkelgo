-- =====================================================================
-- 005_reminder_2h.sql : second booking reminder, about 2 hours before the slot
-- =====================================================================
ALTER TABLE booking_details ADD COLUMN reminder_2h_sent BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX idx_booking_reminder_2h ON booking_details(booking_date) WHERE reminder_2h_sent = FALSE;

-- Bookings whose slot already started don't need it.
UPDATE booking_details SET reminder_2h_sent = TRUE WHERE booking_date < CURRENT_DATE;
