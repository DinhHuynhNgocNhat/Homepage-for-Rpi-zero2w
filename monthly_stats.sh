#!/bin/bash
set -euo pipefail

DAILY="/home/pi/homepage/daily_stats.csv"
MONTHLY="/home/pi/homepage/monthly_stats.csv"

if [[ "${1:-}" == "prev_month" ]]; then
  MONTH=$(date -d "1 month ago" '+%Y-%m')
else
  MONTH=$(date '+%Y-%m')
fi

# Header 15 cột (giống daily)
[[ ! -f "$MONTHLY" ]] && printf "Month,cpu_avg,ram_avg,temp_avg,power_avg,power_total,cpu_max,cpu_max_time,ram_max,ram_max_time,temp_max,temp_max_time,power_max,power_max_time,days\n" > "$MONTHLY"

[[ ! -f "$DAILY" ]] && { echo "No daily data"; exit 0; }
grep -q "^$MONTH," "$MONTHLY" && { echo "Monthly stats for $MONTH exists. Skip."; exit 0; }

# AWK tổng hợp từ daily_stats.csv (lấy data tháng đó)
awk -F, -v month="$MONTH" '
NR==1 {next}  # Skip header
substr($1,1,7)==month {
  days++; cpu_sum+=$2; ram_sum+=$3; temp_sum+=$4; power_sum+=$5; power_total+=$6;
  if($7>cpu_max || cpu_max<0){cpu_max=$7; cpu_max_t=$1" "$8}
  if($9>ram_max || ram_max<0){ram_max=$9; ram_max_t=$1" "$10}
  if($11>temp_max || temp_max<0){temp_max=$11; temp_max_t=$1" "$12}
  if($13>power_max || power_max<0){power_max=$13; power_max_t=$1" "$14}
}
END {
  if(days>0){
    printf "%s,%.2f,%.2f,%.2f,%.2f,%.3f,%.2f,%s,%.1f,%s,%.1f,%s,%.2f,%s,%d\n",
      month, cpu_sum/days, ram_sum/days, temp_sum/days, power_sum/days, power_total,
      cpu_max, cpu_max_t, ram_max, ram_max_t, temp_max, temp_max_t, power_max, power_max_t, days;
  }
}' "$DAILY" >> "$MONTHLY"

days=$(tail -n1 monthly_stats.csv | cut -d, -f15)
echo "✅ Monthly stats saved for $MONTH ($days days)"
