#!/bin/bash

cd /home/pi/homepage
LOGCSV="system.csv"
HISTORY="history.csv"

# Lấy dữ liệu Pi
NOW=$(date '+%H:%M:%S')
CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print 100 - $8}' | head -1 | cut -d'%' -f1)
RAM=$(free | awk 'NR==2{printf "%.1f", $3*100/$2}')
TEMP=$(vcgencmd measure_temp | awk -F'=' '{print $2}' | cut -d"'" -f1 | awk '{printf "%.1f", $1}')
POWER=$(echo "scale=2; 0.6 + ($CPU * 1.9 / 100)" | bc 2>/dev/null || echo "0.80")

# Append vào cả 2 file
echo "$NOW,$CPU,$RAM,$TEMP,$POWER" >> "$LOGCSV"
echo "$NOW,$CPU,$RAM,$TEMP,$POWER" >> "$HISTORY"

# Giới hạn kích thước file (không cần header vì CSV đã có data)
if [[ $(wc -l < "$LOGCSV") -gt 1000 ]]; then
  tail -n 1000 "$LOGCSV" > "$LOGCSV.tmp" && mv "$LOGCSV.tmp" "$LOGCSV"
fi

if [[ $(wc -l < "$HISTORY") -gt 5000 ]]; then
  tail -n 5000 "$HISTORY" > "$HISTORY.tmp" && mv "$HISTORY.tmp" "$HISTORY"
fi
