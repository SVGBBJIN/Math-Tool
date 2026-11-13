-- Separate the text-reminder ("nagging") engine from practice, and add the scroll feed.
--
-- households.texts_enabled is the parent's master switch for Sendblue reminders. It defaults
-- to OFF, and practice (trainer, scroll, error review) never reads it.
-- plan_item 'scroll' lets scroll-feed minutes count toward the 10-minute streak minimum;
-- it is never a required item.
alter table public.households add column texts_enabled boolean not null default false;
alter type public.plan_item add value if not exists 'scroll';
