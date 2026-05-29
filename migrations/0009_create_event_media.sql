-- Migration: Create event media tables
-- Supports homepage media collage and public Rueckblick media

CREATE TABLE IF NOT EXISTS event_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,

    media_scope TEXT NOT NULL DEFAULT 'event'
        CHECK (media_scope IN ('event', 'general')),

    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),

    -- Base storage/moderation status.
    -- Public placement is controlled by separate flags so one file can appear
    -- on both the homepage and Rueckblick.
    status TEXT NOT NULL DEFAULT 'uploaded'
        CHECK (status IN ('uploaded', 'hidden')),

    show_on_homepage INTEGER NOT NULL DEFAULT 0 CHECK (show_on_homepage IN (0, 1)),
    show_on_rueckblick INTEGER NOT NULL DEFAULT 0 CHECK (show_on_rueckblick IN (0, 1)),

    object_key TEXT NOT NULL UNIQUE,
    public_url TEXT NOT NULL,

    thumbnail_object_key TEXT,
    thumbnail_url TEXT,

    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
    duration_seconds REAL CHECK (duration_seconds IS NULL OR duration_seconds > 0),
    width INTEGER CHECK (width IS NULL OR width > 0),
    height INTEGER CHECK (height IS NULL OR height > 0),

    original_filename TEXT,
    alt_text TEXT,
    captured_at TEXT,

    -- Audit mark confirming publication rights/consent before public display.
    publication_approved_at TEXT,
    publication_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

    CHECK (
        (media_type = 'image'
            AND mime_type IN ('image/jpeg', 'image/png', 'image/webp')
            AND size_bytes <= 3145728
            AND duration_seconds IS NULL)
        OR
        (media_type = 'video'
            AND mime_type IN ('video/mp4', 'video/webm')
            AND size_bytes <= 31457280
            AND duration_seconds IS NOT NULL
            AND duration_seconds <= 10)
    ),

    CHECK (
        (media_scope = 'event' AND event_id IS NOT NULL)
        OR
        (media_scope = 'general' AND event_id IS NULL)
    ),

    -- Media must not be public without manual rights/consent approval.
    CHECK (
        (show_on_homepage = 0 AND show_on_rueckblick = 0)
        OR publication_approved_at IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_event_media_event_id
    ON event_media(event_id);

CREATE INDEX IF NOT EXISTS idx_event_media_homepage_lookup
    ON event_media(show_on_homepage, status, media_type, created_at);

CREATE INDEX IF NOT EXISTS idx_event_media_rueckblick_lookup
    ON event_media(show_on_rueckblick, status, event_id, captured_at, created_at);

CREATE INDEX IF NOT EXISTS idx_event_media_scope
    ON event_media(media_scope, show_on_homepage, show_on_rueckblick, status);

CREATE TABLE IF NOT EXISTS media_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    homepage_max_images INTEGER NOT NULL DEFAULT 300
        CHECK (homepage_max_images >= 0 AND homepage_max_images <= 300),
    homepage_max_videos INTEGER NOT NULL DEFAULT 30
        CHECK (homepage_max_videos >= 0 AND homepage_max_videos <= 30),
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO media_settings (id, homepage_max_images, homepage_max_videos)
VALUES (1, 300, 30);
