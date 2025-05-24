#!/bin/bash
# Database restore script for MemeCoinGen

set -euo pipefail

# Configuration
BACKUP_DIR="/backup"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-memecoingen_prod}"
DB_USER="${DB_USER:-memecoingen}"
S3_BUCKET="${S3_BUCKET:-memecoingen-backups}"

# Parse arguments
BACKUP_FILE=""
FROM_S3=false

usage() {
    echo "Usage: $0 [-s] <backup_file>"
    echo "  -s: Download backup from S3"
    echo "  backup_file: Backup file name or S3 key"
    exit 1
}

while getopts "sh" opt; do
    case $opt in
        s)
            FROM_S3=true
            ;;
        h)
            usage
            ;;
        \?)
            echo "Invalid option: -$OPTARG" >&2
            usage
            ;;
    esac
done

shift $((OPTIND-1))

if [ $# -eq 0 ]; then
    echo "Error: Backup file not specified"
    usage
fi

BACKUP_FILE="$1"

# Function to send notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Database Restore $status: $message\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
}

echo "Starting database restore at $(date)"

# Download from S3 if specified
if [ "$FROM_S3" = true ]; then
    echo "Downloading backup from S3..."
    LOCAL_BACKUP="$BACKUP_DIR/$(basename "$BACKUP_FILE")"
    
    if aws s3 cp "s3://$S3_BUCKET/backups/$BACKUP_FILE" "$LOCAL_BACKUP"; then
        echo "Backup downloaded successfully"
        BACKUP_FILE="$LOCAL_BACKUP"
    else
        send_notification "ERROR" "Failed to download backup from S3"
        exit 1
    fi
else
    # Check if local file exists
    if [ ! -f "$BACKUP_FILE" ]; then
        echo "Error: Backup file not found: $BACKUP_FILE"
        exit 1
    fi
fi

# Create restore point
echo "Creating restore point..."
RESTORE_POINT="$BACKUP_DIR/pre_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
if PGPASSWORD="$PGPASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=custom \
    --compress=9 \
    | gzip > "$RESTORE_POINT"; then
    echo "Restore point created: $RESTORE_POINT"
else
    send_notification "ERROR" "Failed to create restore point"
    exit 1
fi

# Verify backup file
echo "Verifying backup file..."
if ! gunzip -t "$BACKUP_FILE"; then
    send_notification "ERROR" "Backup file is corrupted!"
    exit 1
fi

# Restore database
echo "Restoring database..."
echo "WARNING: This will drop and recreate the database. Press Ctrl+C to cancel or Enter to continue."
read -r

# Drop existing connections
PGPASSWORD="$PGPASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();"

# Drop and recreate database
PGPASSWORD="$PGPASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d postgres \
    -c "DROP DATABASE IF EXISTS $DB_NAME;"

PGPASSWORD="$PGPASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d postgres \
    -c "CREATE DATABASE $DB_NAME WITH OWNER $DB_USER ENCODING 'UTF8';"

# Restore from backup
if gunzip -c "$BACKUP_FILE" | PGPASSWORD="$PGPASSWORD" pg_restore \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --verbose \
    --no-owner \
    --no-privileges; then
    
    echo "Database restored successfully"
    
    # Run post-restore verification
    echo "Running post-restore verification..."
    TABLES_COUNT=$(PGPASSWORD="$PGPASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
    
    echo "Restored $TABLES_COUNT tables"
    
    # Analyze database for query optimizer
    echo "Analyzing database..."
    PGPASSWORD="$PGPASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -c "ANALYZE;"
    
    send_notification "SUCCESS" "Database restored successfully from $BACKUP_FILE"
    
else
    send_notification "ERROR" "Database restore failed! Restore point available at: $RESTORE_POINT"
    exit 1
fi

echo "Restore process completed at $(date)"