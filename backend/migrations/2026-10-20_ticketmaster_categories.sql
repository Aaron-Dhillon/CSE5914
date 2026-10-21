-- Replace the 12 campus categories with 8 that match Ticketmaster's classifications.
-- Wipes everyone's category picks. Run with autocommit (ADD VALUE can't be used in the same transaction).
ALTER TYPE event_option_category ADD VALUE IF NOT EXISTS 'concerts';
ALTER TYPE event_option_category ADD VALUE IF NOT EXISTS 'nightlife_djs';
ALTER TYPE event_option_category ADD VALUE IF NOT EXISTS 'sports';
ALTER TYPE event_option_category ADD VALUE IF NOT EXISTS 'musicals';
ALTER TYPE event_option_category ADD VALUE IF NOT EXISTS 'plays_dance';
ALTER TYPE event_option_category ADD VALUE IF NOT EXISTS 'comedy_shows';
ALTER TYPE event_option_category ADD VALUE IF NOT EXISTS 'family_holiday';

DELETE FROM user_preferences_categories;
DELETE FROM event_categories;
DELETE FROM categories;
INSERT INTO categories (name, description) VALUES
    ('Concerts',         'Rock, pop, country, hip-hop and other live music'),
    ('Nightlife & DJs',  'Electronic, club nights and bar shows'),
    ('Sports',           'Hockey, basketball, football and other games'),
    ('Musicals',         'Broadway tours and musical theatre'),
    ('Plays & Dance',    'Plays, dance, classical and children''s theatre'),
    ('Comedy & Shows',   'Stand-up, circus and specialty acts'),
    ('Family & Holiday', 'Family shows, ice shows and holiday events'),
    ('Other',            'Everything else');
