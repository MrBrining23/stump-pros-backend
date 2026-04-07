-- Follow-up drip system tables

CREATE TABLE IF NOT EXISTS follow_up_templates (
  id SERIAL PRIMARY KEY,
  sequence_name TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  delay_hours INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sequence_name, step_number)
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  template_id INTEGER REFERENCES follow_up_templates(id),
  sequence_name TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS follow_ups_status_scheduled_idx ON follow_ups (status, scheduled_at);
CREATE INDEX IF NOT EXISTS follow_ups_lead_id_idx ON follow_ups (lead_id);

-- Seed drip templates

-- no_response: sent after initial auto-SMS when lead doesn't reply
INSERT INTO follow_up_templates (sequence_name, step_number, delay_hours, message) VALUES
  ('no_response', 1, 2, 'Hi {{name}}, just following up! We''d love to help with your stump grinding. Feel free to text us photos of the stumps for a quick free quote!'),
  ('no_response', 2, 48, 'Hey {{name}}, still interested in getting those stumps taken care of? We offer free on-site estimates and competitive pricing. Just reply to this text!'),
  ('no_response', 3, 120, 'Hi {{name}}, this is our last follow-up. If you ever need stump grinding, don''t hesitate to reach out. We''re here to help! - Stump Pros WV')
ON CONFLICT (sequence_name, step_number) DO NOTHING;

-- quoted_not_booked: sent after an estimate is given but lead hasn't booked
INSERT INTO follow_up_templates (sequence_name, step_number, delay_hours, message) VALUES
  ('quoted_not_booked', 1, 48, 'Hi {{name}}, just checking in on the estimate we sent over. Any questions? We''re happy to help!'),
  ('quoted_not_booked', 2, 120, 'Hey {{name}}, wanted to make sure you got our estimate. We can usually get you on the schedule within a few days. Let us know!'),
  ('quoted_not_booked', 3, 192, 'Hi {{name}}, just a friendly reminder about your stump grinding estimate. We''d love to get this knocked out for you. Reply anytime!'),
  ('quoted_not_booked', 4, 336, 'Hi {{name}}, this is our last follow-up on the estimate. If you''d like to move forward or have questions, just text us back. Thanks! - Stump Pros WV')
ON CONFLICT (sequence_name, step_number) DO NOTHING;
