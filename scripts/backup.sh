#!/bin/bash
# Database backup script for MemeCoinGen

set -euo pipefail

# Configuration
BACKUP_DIR="/backup"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-memecoingen_prod}"
DB_USER="${DB_USER:-memecoingen}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
S3_BUCKET="${S3_BUCKET:-memecoingen-backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/memecoingen_backup_$TIMESTAMP.sql.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Function to send notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Database Backup $status: $message\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
}

# Function to cleanup old backups
cleanup_old_backups() {
    echo "Cleaning up backups older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR" -name "memecoingen_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
    
    # Also cleanup S3 if configured
    if [ -n "${AWS_ACCESS_KEY_ID:-}" ]; then
        aws s3api list-objects --bucket "$S3_BUCKET" --prefix "backups/" \
            --query "Contents[?LastModified<='$(date -d "$RETENTION_DAYS days ago" --iso-8601)'].{Key: Key}" \
            --output text | xargs -n 1 aws s3 rm "s3://$S3_BUCKET/"
    fi
}

# Main backup process
echo "Starting database backup at $(date)"

# Perform backup
if PGPASSWORD="$PGPASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --verbose \
    --no-owner \
    --no-privileges \
    --format=custom \
    --compress=9 \
    | gzip > "$BACKUP_FILE"; then
    
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "Backup completed successfully. Size: $BACKUP_SIZE"
    
    # Upload to S3 if configured
    if [ -n "${AWS_ACCESS_KEY_ID:-}" ]; then
        echo "Uploading backup to S3..."
        if aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/backups/$(basename "$BACKUP_FILE")" \
            --storage-class STANDARD_IA; then
            echo "Backup uploaded to S3 successfully"
            
            # Create lifecycle transition to Glacier after 7 days
            aws s3api put-object-tagging \
                --bucket "$S3_BUCKET" \
                --key "backups/$(basename "$BACKUP_FILE")" \
                --tagging 'TagSet=[{Key=backup-type,Value=daily}]'
        else
            send_notification "WARNING" "Failed to upload backup to S3"
        fi
    fi
    
    # Verify backup
    echo "Verifying backup integrity..."
    if gunzip -t "$BACKUP_FILE"; then
        echo "Backup verification passed"
        send_notification "SUCCESS" "Database backup completed. Size: $BACKUP_SIZE"
    else
        send_notification "ERROR" "Backup verification failed!"
        exit 1
    fi
    
    # Cleanup old backups
    cleanup_old_backups
    
else
    send_notification "ERROR" "Database backup failed!"
    exit 1
fi

echo "Backup process completed at $(date)"