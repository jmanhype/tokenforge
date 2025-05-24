-- Additional database functions for MemeCoinGen

-- Function to check user's deployment quota
CREATE OR REPLACE FUNCTION check_deployment_quota(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_tier subscription_tier;
    monthly_limit INTEGER;
    current_count INTEGER;
BEGIN
    -- Get user's subscription tier
    SELECT subscription_tier INTO user_tier
    FROM users
    WHERE id = user_id;

    -- Set monthly limits based on tier
    CASE user_tier
        WHEN 'free' THEN monthly_limit := 3;
        WHEN 'pro' THEN monthly_limit := 10;
        WHEN 'enterprise' THEN monthly_limit := 100;
        ELSE monthly_limit := 3;
    END CASE;

    -- Get current month's deployment count
    SELECT coins_created_this_month INTO current_count
    FROM users
    WHERE id = user_id;

    RETURN current_count < monthly_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to increment deployment count
CREATE OR REPLACE FUNCTION increment_deployment_count(user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE users
    SET coins_created_this_month = coins_created_this_month + 1,
        total_coins_created = total_coins_created + 1
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get deployment priority based on user tier
CREATE OR REPLACE FUNCTION get_deployment_priority(user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    user_tier subscription_tier;
BEGIN
    SELECT subscription_tier INTO user_tier
    FROM users
    WHERE id = user_id;

    CASE user_tier
        WHEN 'enterprise' THEN RETURN 100;
        WHEN 'pro' THEN RETURN 50;
        ELSE RETURN 0;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate gas fee estimates
CREATE OR REPLACE FUNCTION estimate_gas_fee(
    blockchain blockchain_type,
    include_liquidity BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
    estimated_gas_units NUMERIC,
    estimated_fee_native NUMERIC,
    estimated_fee_usd DECIMAL
) AS $$
BEGIN
    CASE blockchain
        WHEN 'ethereum' THEN
            estimated_gas_units := CASE 
                WHEN include_liquidity THEN 500000
                ELSE 300000
            END;
            estimated_fee_native := estimated_gas_units * 30; -- 30 gwei
            estimated_fee_usd := (estimated_fee_native / 1e18) * 2500; -- Assuming $2500 ETH
            
        WHEN 'bsc' THEN
            estimated_gas_units := CASE 
                WHEN include_liquidity THEN 400000
                ELSE 250000
            END;
            estimated_fee_native := estimated_gas_units * 5; -- 5 gwei
            estimated_fee_usd := (estimated_fee_native / 1e18) * 300; -- Assuming $300 BNB
            
        WHEN 'solana' THEN
            estimated_gas_units := 5000; -- lamports
            estimated_fee_native := estimated_gas_units;
            estimated_fee_usd := (estimated_fee_native / 1e9) * 100; -- Assuming $100 SOL
    END CASE;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old rate limit entries
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limits
    WHERE window_start < CURRENT_TIMESTAMP - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function to get trending coins
CREATE OR REPLACE FUNCTION get_trending_coins(
    time_window INTERVAL DEFAULT '24 hours',
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE(
    coin_id UUID,
    name VARCHAR,
    symbol VARCHAR,
    blockchain blockchain_type,
    contract_address VARCHAR,
    price_change_percent DECIMAL,
    volume_24h DECIMAL,
    social_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mc.id,
        mc.name,
        mc.symbol,
        mc.blockchain,
        mc.contract_address,
        COALESCE(
            ((latest.price_usd - earlier.price_usd) / NULLIF(earlier.price_usd, 0)) * 100,
            0
        ) as price_change_percent,
        COALESCE(latest.volume_24h, 0) as volume_24h,
        COALESCE(social_count.count::INTEGER, 0) as social_score
    FROM meme_coins mc
    LEFT JOIN LATERAL (
        SELECT * FROM analytics 
        WHERE coin_id = mc.id 
        ORDER BY timestamp DESC 
        LIMIT 1
    ) latest ON true
    LEFT JOIN LATERAL (
        SELECT * FROM analytics 
        WHERE coin_id = mc.id 
        AND timestamp <= CURRENT_TIMESTAMP - time_window
        ORDER BY timestamp DESC 
        LIMIT 1
    ) earlier ON true
    LEFT JOIN LATERAL (
        SELECT COUNT(*) as count
        FROM social_shares
        WHERE coin_id = mc.id
        AND created_at >= CURRENT_TIMESTAMP - time_window
    ) social_count ON true
    WHERE mc.deployment_status = 'deployed'
    AND latest.timestamp >= CURRENT_TIMESTAMP - time_window
    ORDER BY 
        COALESCE(latest.volume_24h, 0) DESC,
        price_change_percent DESC,
        social_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to archive old analytics data
CREATE OR REPLACE FUNCTION archive_old_analytics()
RETURNS void AS $$
BEGIN
    -- Create archive table if not exists
    CREATE TABLE IF NOT EXISTS analytics_archive (LIKE analytics INCLUDING ALL);
    
    -- Move data older than 30 days to archive
    INSERT INTO analytics_archive
    SELECT * FROM analytics
    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    -- Delete archived data from main table
    DELETE FROM analytics
    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    -- Vacuum the table
    VACUUM ANALYZE analytics;
END;
$$ LANGUAGE plpgsql;

-- Scheduled job functions (to be called by cron or pg_cron)
CREATE OR REPLACE FUNCTION daily_maintenance()
RETURNS void AS $$
BEGIN
    -- Clean up rate limits
    PERFORM cleanup_rate_limits();
    
    -- Archive old analytics
    PERFORM archive_old_analytics();
    
    -- Refresh materialized view
    REFRESH MATERIALIZED VIEW CONCURRENTLY coin_rankings;
    
    -- Update statistics
    ANALYZE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION monthly_maintenance()
RETURNS void AS $$
BEGIN
    -- Reset monthly coin counts
    PERFORM reset_monthly_coin_counts();
    
    -- Clean up old audit logs
    DELETE FROM audit_logs
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql;