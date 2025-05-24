-- Initial database schema for MemeCoinGen
-- PostgreSQL 16+

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create custom types
CREATE TYPE blockchain_type AS ENUM ('ethereum', 'bsc', 'solana');
CREATE TYPE deployment_status AS ENUM ('pending', 'processing', 'deployed', 'failed');
CREATE TYPE social_platform AS ENUM ('twitter', 'discord', 'telegram', 'reddit');
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    subscription_tier subscription_tier DEFAULT 'free',
    subscription_expires_at TIMESTAMP,
    coins_created_this_month INTEGER DEFAULT 0,
    total_coins_created INTEGER DEFAULT 0,
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Meme coins table
CREATE TABLE meme_coins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    description TEXT,
    initial_supply NUMERIC(78, 0) NOT NULL,
    decimals INTEGER DEFAULT 18,
    image_url TEXT,
    metadata_uri TEXT,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blockchain blockchain_type NOT NULL,
    contract_address VARCHAR(255),
    mint_address VARCHAR(255), -- For Solana
    deployment_tx_hash VARCHAR(255),
    deployment_status deployment_status DEFAULT 'pending',
    deployment_error TEXT,
    deployment_gas_used NUMERIC(20, 0),
    deployment_gas_price NUMERIC(20, 0),
    deployment_cost_usd DECIMAL(10, 2),
    can_mint BOOLEAN DEFAULT false,
    can_burn BOOLEAN DEFAULT false,
    can_pause BOOLEAN DEFAULT false,
    max_supply NUMERIC(78, 0),
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deployed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Deployment queue table
CREATE TABLE deployment_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coin_id UUID NOT NULL REFERENCES meme_coins(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 0, -- Higher priority for paid users
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analytics table
CREATE TABLE analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coin_id UUID NOT NULL REFERENCES meme_coins(id) ON DELETE CASCADE,
    price DECIMAL(20, 10),
    price_usd DECIMAL(20, 10),
    market_cap DECIMAL(20, 2),
    volume_24h DECIMAL(20, 2),
    price_change_24h DECIMAL(10, 2),
    holders_count INTEGER,
    transfers_count INTEGER,
    liquidity_usd DECIMAL(20, 2),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- DEX pools table
CREATE TABLE dex_pools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coin_id UUID NOT NULL REFERENCES meme_coins(id) ON DELETE CASCADE,
    dex_name VARCHAR(50) NOT NULL,
    pool_address VARCHAR(255) NOT NULL,
    paired_token_symbol VARCHAR(10),
    paired_token_address VARCHAR(255),
    liquidity_token DECIMAL(78, 0),
    liquidity_paired DECIMAL(78, 0),
    liquidity_usd DECIMAL(20, 2),
    volume_24h DECIMAL(20, 2),
    tx_count_24h INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(coin_id, pool_address)
);

-- Social shares table
CREATE TABLE social_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coin_id UUID NOT NULL REFERENCES meme_coins(id) ON DELETE CASCADE,
    platform social_platform NOT NULL,
    post_id VARCHAR(255),
    post_url TEXT,
    engagement_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coin_id UUID REFERENCES meme_coins(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL, -- 'subscription', 'deployment', 'gas_fee'
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    stripe_payment_intent_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),
    status payment_status DEFAULT 'pending',
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- API keys table (for enterprise users)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL, -- Store hashed API key
    name VARCHAR(100),
    permissions JSONB DEFAULT '{"read": true, "write": true}',
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Rate limiting table
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET,
    endpoint VARCHAR(255) NOT NULL,
    requests_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_subscription ON users(subscription_tier, subscription_expires_at);

CREATE INDEX idx_coins_creator ON meme_coins(creator_id);
CREATE INDEX idx_coins_blockchain ON meme_coins(blockchain);
CREATE INDEX idx_coins_contract ON meme_coins(contract_address) WHERE contract_address IS NOT NULL;
CREATE INDEX idx_coins_symbol ON meme_coins(symbol);
CREATE INDEX idx_coins_status ON meme_coins(deployment_status);
CREATE INDEX idx_coins_created ON meme_coins(created_at DESC);

CREATE INDEX idx_analytics_coin_time ON analytics(coin_id, timestamp DESC);
CREATE INDEX idx_analytics_timestamp ON analytics(timestamp DESC);

CREATE INDEX idx_pools_coin ON dex_pools(coin_id);
CREATE INDEX idx_pools_dex ON dex_pools(dex_name);
CREATE INDEX idx_pools_liquidity ON dex_pools(liquidity_usd DESC);

CREATE INDEX idx_queue_status ON deployment_queue(scheduled_at, completed_at) WHERE completed_at IS NULL;
CREATE INDEX idx_queue_priority ON deployment_queue(priority DESC, scheduled_at);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status, created_at DESC);

CREATE INDEX idx_rate_limits_user ON rate_limits(user_id, endpoint, window_start);
CREATE INDEX idx_rate_limits_ip ON rate_limits(ip_address, endpoint, window_start);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Full text search indexes
CREATE INDEX idx_coins_search ON meme_coins USING gin(
    to_tsvector('english', name || ' ' || COALESCE(symbol, '') || ' ' || COALESCE(description, ''))
);

-- Create update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meme_coins_updated_at BEFORE UPDATE ON meme_coins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dex_pools_updated_at BEFORE UPDATE ON dex_pools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to reset monthly coin counts
CREATE OR REPLACE FUNCTION reset_monthly_coin_counts()
RETURNS void AS $$
BEGIN
    UPDATE users SET coins_created_this_month = 0;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for coin rankings
CREATE MATERIALIZED VIEW coin_rankings AS
SELECT 
    mc.id,
    mc.name,
    mc.symbol,
    mc.blockchain,
    mc.contract_address,
    mc.created_at,
    COALESCE(latest.price_usd, 0) as current_price,
    COALESCE(latest.market_cap, 0) as market_cap,
    COALESCE(latest.volume_24h, 0) as volume_24h,
    COALESCE(latest.holders_count, 0) as holders_count,
    COUNT(DISTINCT ss.id) as social_shares_count,
    COALESCE(SUM(dp.liquidity_usd), 0) as total_liquidity
FROM meme_coins mc
LEFT JOIN LATERAL (
    SELECT * FROM analytics 
    WHERE coin_id = mc.id 
    ORDER BY timestamp DESC 
    LIMIT 1
) latest ON true
LEFT JOIN social_shares ss ON ss.coin_id = mc.id
LEFT JOIN dex_pools dp ON dp.coin_id = mc.id
WHERE mc.deployment_status = 'deployed'
GROUP BY mc.id, mc.name, mc.symbol, mc.blockchain, mc.contract_address, mc.created_at,
         latest.price_usd, latest.market_cap, latest.volume_24h, latest.holders_count;

CREATE INDEX idx_coin_rankings_market_cap ON coin_rankings(market_cap DESC);
CREATE INDEX idx_coin_rankings_volume ON coin_rankings(volume_24h DESC);
CREATE INDEX idx_coin_rankings_created ON coin_rankings(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE users IS 'User accounts and subscription information';
COMMENT ON TABLE meme_coins IS 'Created meme coins and their deployment status';
COMMENT ON TABLE analytics IS 'Time-series market data for deployed coins';
COMMENT ON TABLE dex_pools IS 'DEX liquidity pools for deployed coins';
COMMENT ON TABLE deployment_queue IS 'Queue for processing coin deployments';
COMMENT ON TABLE social_shares IS 'Social media posts for coin promotion';
COMMENT ON TABLE transactions IS 'Payment and transaction history';
COMMENT ON TABLE api_keys IS 'API keys for enterprise users';
COMMENT ON TABLE rate_limits IS 'Rate limiting tracking';
COMMENT ON TABLE audit_logs IS 'Audit trail for security and compliance';