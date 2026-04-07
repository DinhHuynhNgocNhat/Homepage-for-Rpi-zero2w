#!/bin/bash
set -euo pipefail

BASE_DIR="/home/pi/homepage"
POWER_LOG="$BASE_DIR/power.log"

CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print 100 - $8}')
POWER=$(echo "0.6 + ($CPU * 1.9 / 100)" | bc -l)

echo "$(date '+%Y-%m-%d %H:%M:%S') | $POWER W" >> "$POWER_LOG"
