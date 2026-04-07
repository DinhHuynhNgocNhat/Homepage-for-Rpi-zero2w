#!/bin/bash
set -euo pipefail

MONTHLY="/home/pi/homepage/monthly_stats.csv"
YEARLY="/home/pi/homepage/yearly_stats.csv"

if [[ "${1:-}" == "prev_year" ]]; then
  YEAR=$(date -d "1 year ago" '+%Y')
else
  YEAR=$(date '+%Y')
fi

# Header
[[ ! -f "$YEARLY" ]] && printf "Year,cpu_avg,ram_avg,temp_avg,power_avg,power_total,cpu_max,cpu_max_time,ram_max,ram_max_time,temp_max,temp_max_time,power_max,power_max_time,months\n" > "$YEARLY"

[[ ! -f "$MONTHLY" ]] && { echo "No monthly data"; exit 0; }
grep -q "^$YEAR," "$YEARLY" && { echo "Yearly stats for $YEAR exists. Skip."; exit 0; }

# AWK từ monthly_stats.csv
awk -F, -v year="$YEAR" '
NR==1 {next}
substr($1,1,4)==year {
  months++; cpu_sum+=$2; ram_sum+=$3; temp_sum+=$4; power_sum+=$5; power_total+=$6;
  if($7>cpu_max || cpu_max<0){cpu_max=$7; cpu_max_t=$7" "$8}
  if($9>ram_max || ram_max<0){ram_max=$9; ram_max_t=$1" "$10}
  if($11>temp_max || temp_max<0){temp_max=$11; temp_max_t=$1" "$12}
  if($13>power_max || power_max<0){power_max=$13; power_max_t=$1" "$14}
}
END {
  if(months>0){
    printf "%s,%.2f,%.2f,%.2f,%.2f,%.3f,%.2f,%s,%.1f,%s,%.1f,%s,%.2f,%s,%d\n",
      year, cpu_sum/months, ram_sum/months, temp_sum/months, power_sum/months, power_total,
      cpu_max, cpu_max_t, ram_max, ram_max_t, temp_max, temp_max_t, power_max, power_max_t, months;
  }
}' "$MONTHLY" >> "$YEARLY"

days=$(tail -n1 yearly_stats.csv | cut -d, -f15)
months=$(tail -n1 yearly_stats.csv | cut -d, -f15); echo "✅ Yearly stats saved for $YEAR ($months months)"
