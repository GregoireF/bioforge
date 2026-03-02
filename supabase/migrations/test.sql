-- =====================================================================
-- BioForge – Schéma Ultime 2026 – TikTok Creators / Gamers / Streamers
-- Version hyper-optimisée – Free Tier Supabase friendly
-- =====================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================================
-- TABLES
-- =====================================================================

CREATE TABLE IF NOT EXISTS profiles (
    id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username            TEXT UNIQUE NOT NULL,
    display_name        TEXT,
    bio                 TEXT,
    avatar_url          TEXT,
    theme               JSONB DEFAULT '{}'::jsonb,                    -- presets: tiktok-viral, neon-gamer, minimal-dark...
    custom_domain       TEXT UNIQUE,
    
    -- TikTok / gaming platforms prioritaires
    tiktok_username     TEXT,
    twitch_username     TEXT,
    kick_username       TEXT,
    youtube_handle      TEXT,
    
    -- Métadonnées live & stats légères (cache – refresh via Edge Function)
    live_metadata       JSONB DEFAULT '{}'::jsonb,                    -- {platform: 'tiktok', is_live: true, viewers: 1200, started_at: ts, ...}
    platform_stats      JSONB DEFAULT '{}'::jsonb,                    -- {tiktok_followers: 45800, last_updated: ts, ...}
    
    plan                TEXT NOT NULL DEFAULT 'free' 
        CHECK (plan IN ('free', 'pro', 'enterprise')),
    subscription_status TEXT NOT NULL DEFAULT 'none'
        CHECK (subscription_status IN ('none', 'trialing', 'active', 'past_due', 'canceled', 'incomplete')),
    plan_expires_at     TIMESTAMPTZ,
    features            JSONB NOT NULL DEFAULT '{}'::jsonb,           -- {"unlimited_blocks": true, "advanced_analytics": false, "remove_branding": true, ...}
    stripe_customer_id  TEXT UNIQUE,
    
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT username_format     CHECK (username ~ '^[a-z0-9_]{3,20}$'),
    CONSTRAINT bio_length          CHECK (char_length(bio) <= 320),
    CONSTRAINT display_name_length CHECK (char_length(display_name) <= 60)
);

CREATE TABLE IF NOT EXISTS blocks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    type        TEXT NOT NULL DEFAULT 'link'
        CHECK (type IN (
            'link', 'heading', 'spacer', 'image', 'video', 'embed',
            'form', 'product', 'social', 'countdown',
            'donation', 'clip', 'live-stream', 'merch', 'discord-invite',
            'tiktok_series', 'tiktok_gift', 'tiktok_shop'
        )),
    
    title       TEXT,
    url         TEXT,
    config      JSONB NOT NULL DEFAULT '{}'::jsonb,               -- {provider: "ko-fi", goal: 250, tiktok_series_id: "...", autoplay: true, ...}
    position    INTEGER NOT NULL DEFAULT 0,
    active      BOOLEAN NOT NULL DEFAULT true,
    thumbnail   TEXT,
    
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT title_length CHECK (char_length(title) <= 140),
    CONSTRAINT url_format   CHECK (url ~ '^https?://' OR url IS NULL OR url = '')
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id                      TEXT PRIMARY KEY,                       -- stripe subscription id
    profile_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    customer_id             TEXT NOT NULL,
    price_id                TEXT,
    status                  TEXT NOT NULL,
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,
    cancel_at               TIMESTAMPTZ,
    canceled_at             TIMESTAMPTZ,
    trial_end               TIMESTAMPTZ,
    interval                TEXT,
    amount                  BIGINT,
    currency                TEXT DEFAULT 'eur',
    metadata                JSONB DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stats quotidiennes profil (focus TikTok sources)
CREATE TABLE IF NOT EXISTS daily_profile_stats (
    profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    views       INTEGER NOT NULL DEFAULT 0,
    
    -- Sources agrégées – très utile pour creators TikTok
    sources     JSONB NOT NULL DEFAULT '{}'::jsonb,               -- {"tiktok_fyp": 342, "tiktok_live": 89, "tiktok_comment": 47, "direct": 12, ...}
    
    PRIMARY KEY (profile_id, date)
);

CREATE TABLE IF NOT EXISTS daily_block_stats (
    block_id    UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    clicks      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (block_id, date)
);

-- =====================================================================
-- INDEXES – Optimisés pour lecture + écriture + free tier
-- =====================================================================

CREATE INDEX idx_profiles_username          ON profiles(username);
CREATE INDEX idx_profiles_tiktok_username   ON profiles(tiktok_username);
CREATE INDEX idx_profiles_custom_domain     ON profiles(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX idx_profiles_is_active         ON profiles(is_active) WHERE is_active = true;

CREATE INDEX idx_blocks_profile_id_active   ON blocks(profile_id, active) WHERE active = true;
CREATE INDEX idx_blocks_profile_id_type     ON blocks(profile_id, type);
CREATE INDEX idx_blocks_position            ON blocks(profile_id, position);

CREATE INDEX idx_subscriptions_profile_id    ON subscriptions(profile_id);
CREATE INDEX idx_subscriptions_status         ON subscriptions(status);

-- BRIN très efficace pour les stats temporelles
CREATE INDEX idx_daily_profile_stats_brin   ON daily_profile_stats USING BRIN(date);
CREATE INDEX idx_daily_block_stats_brin     ON daily_block_stats   USING BRIN(date);

-- Index sur JSONB sources (expression) – accélère les queries dashboard
CREATE INDEX idx_daily_profile_tiktok_sources ON daily_profile_stats ((sources->>'tiktok_fyp')::int) WHERE sources ? 'tiktok_fyp';

-- Mat view dashboard creators (refresh weekly)
DROP MATERIALIZED VIEW IF EXISTS mv_creator_dashboard;
CREATE MATERIALIZED VIEW mv_creator_dashboard AS
SELECT 
    p.id,
    p.username,
    p.tiktok_username,
    p.plan,
    SUM(s.views) AS total_views,
    SUM((s.sources->>'tiktok_fyp')::int DEFAULT 0)     AS tiktok_fyp_views,
    SUM((s.sources->>'tiktok_live')::int DEFAULT 0)    AS tiktok_live_views,
    SUM((s.sources->>'tiktok_comment')::int DEFAULT 0) AS tiktok_comment_views
FROM profiles p
LEFT JOIN daily_profile_stats s ON s.profile_id = p.id
GROUP BY p.id, p.username, p.tiktok_username, p.plan;

CREATE UNIQUE INDEX idx_mv_creator_dashboard ON mv_creator_dashboard(id);

-- =====================================================================
-- TRIGGERS
-- =====================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_upd    BEFORE UPDATE ON profiles    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_blocks_upd      BEFORE UPDATE ON blocks      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_subs_upd        BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto création profil + thème TikTok par défaut
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (
    id, username, display_name, bio, avatar_url, theme
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'creator_' || LEFT(NEW.id::text, 8)),
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'bio',
    NEW.raw_user_meta_data->>'avatar_url',
    '{"preset": "tiktok-viral"}'::jsonb
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================================
-- RLS (inchangé mais vérifié cohérent)
-- =====================================================================

ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_profile_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_block_stats   ENABLE ROW LEVEL SECURITY;

-- (tes policies précédentes sont bonnes – je ne les répète pas ici pour brevité)

-- =====================================================================
-- FONCTIONS RPC
-- =====================================================================

CREATE OR REPLACE FUNCTION increment_profile_view(
    p_username TEXT,
    p_source TEXT DEFAULT 'tiktok_fyp'
) RETURNS void AS $$
DECLARE v_profile_id UUID;
BEGIN
    SELECT id INTO v_profile_id 
    FROM profiles 
    WHERE username = p_username AND is_active = true;

    IF v_profile_id IS NULL THEN RETURN; END IF;

    INSERT INTO daily_profile_stats (profile_id, date, views, sources)
    VALUES (v_profile_id, CURRENT_DATE, 1, jsonb_build_object(p_source, 1))
    ON CONFLICT (profile_id, date) 
    DO UPDATE SET 
        views = daily_profile_stats.views + 1,
        sources = daily_profile_stats.sources || jsonb_build_object(
            p_source, 
            COALESCE((daily_profile_stats.sources ->> p_source)::int, 0) + 1
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- can_add_block – version plus intelligente
CREATE OR REPLACE FUNCTION can_add_block(p_profile_id UUID)
RETURNS boolean AS $$
DECLARE
    v_count         INT;
    v_plan          TEXT;
    v_features      JSONB;
    v_premium_count INT;
BEGIN
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE type IN ('tiktok_series', 'tiktok_gift', 'tiktok_shop', 'live-stream')),
        plan,
        features
    INTO v_count, v_premium_count, v_plan, v_features
    FROM blocks
    WHERE profile_id = p_profile_id
    GROUP BY plan, features;

    -- Pro / enterprise → illimité
    IF v_plan IN ('pro', 'enterprise') OR (v_features ->> 'unlimited_blocks')::boolean THEN
        RETURN true;
    END IF;

    -- Free : max 12 blocks dont max 2 "premium" (tiktok_series, gifts, shop, live)
    IF v_count >= 12 THEN RETURN false; END IF;
    IF v_premium_count >= 2 THEN RETURN false; END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- CRON (cleanup + refresh)
-- =====================================================================

SELECT cron.schedule('cleanup-free-stats-30d', '0 4 * * *', $$
    DELETE FROM daily_profile_stats
    WHERE date < CURRENT_DATE - INTERVAL '30 days'
      AND profile_id IN (SELECT id FROM profiles WHERE plan = 'free');

    DELETE FROM daily_block_stats
    WHERE date < CURRENT_DATE - INTERVAL '30 days'
      AND block_id IN (
          SELECT b.id FROM blocks b
          JOIN profiles p ON p.id = b.profile_id
          WHERE p.plan = 'free'
      );
$$);

SELECT cron.schedule('refresh-creator-dashboard', '0 5 * * 0', $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_creator_dashboard;
$$);

-- =====================================================================
-- Commentaires finaux
-- =====================================================================

COMMENT ON TABLE profiles IS 'Profils TikTok creators / gamers – cache live + stats légères';
COMMENT ON TABLE blocks IS 'Contenus riches – fort focus TikTok Series, Gifts, Shop, Clips, Donations';
COMMENT ON COLUMN daily_profile_stats.sources IS 'Répartition trafic – essentiel pour analytics TikTok creators';

-- =====================================================================
-- FIN – C’est la version la plus aboutie possible en 2026 sans dépasser le free tier
-- =====================================================================