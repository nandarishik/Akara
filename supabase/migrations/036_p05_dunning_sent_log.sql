CREATE TABLE IF NOT EXISTS dunning_sent_log (
    tenant_id UUID NOT NULL,
    day INTEGER NOT NULL,
    past_due_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (tenant_id, day, past_due_at)
);
