#!/bin/bash
set -euo pipefail

HISTORY="/home/pi/homepage/history.csv"
DAILY="/home/pi/homepage/daily_stats.csv"

if [[ "${1:-}" == "yesterday" ]]; then
  DATE=$(date -d "yesterday" '+%Y-%m-%d')
else
  DATE=$(date '+%Y-%m-%d')
fi

# Header chuẩn 15 cột (giống file hiện tại của bạn)
[[ ! -f "$DAILY" ]] && printf "Date,cpu_avg,ram_avg,temp_avg,power_avg,power_total,cpu_max,cpu_max_time,ram_max,ram_max_time,temp_max,temp_max_time,power_max,power_max_time,Samples\n" > "$DAILY"

# Skip nếu đã có
grep -q "^$DATE," "$DAILY" && { echo "Daily stats for $DATE exists. Skip."; exit 0; }

[[ ! -f "$HISTORY" || $(wc -l < "$HISTORY") -le 1 ]] && { echo "No history data."; exit 0; }

# AWK tính stats (power_total = sum(power)*60s/3600 → Wh)
awk -F, -v date="$DATE" '
BEGIN {
  cpu_sum=ram_sum=temp_sum=power_sum=0; count=0;
  cpu_max=ram_max=temp_max=power_max=-1;
  cpu_t=ram_t=temp_t=power_t="";
}
NR>1 {  # Skip header
  ts=$1; cpu=$2+0; ram=$3+0; temp=$4+0; power=$5+0;
  count++; cpu_sum+=cpu; ram_sum+=ram; temp_sum+=temp; power_sum+=power;
  if(cpu>cpu_max){cpu_max=cpu; cpu_t=ts}
  if(ram>ram_max){ram_max=ram; ram_t=ts}
  if(temp>temp_max){temp_max=temp; temp_t=ts}
  if(power>power_max){power_max=power; power_t=ts}
}
END {
  if(count>0){
    printf "%s,%.2f,%.2f,%.2f,%.2f,%.3f,%.1f,%s,%.1f,%s,%.1f,%s,%.2f,%s,%d\n",
      date,
      cpu_sum/count, ram_sum/count, temp_sum/count, power_sum/count,
      power_sum*60/3600,  # Wh cho 60s/sample
      cpu_max, cpu_t, ram_max, ram_t, temp_max, temp_t, power_max, power_t,
      count;
  }
}' "$HISTORY" >> "$DAILY"

# Reset history cho ngày mới
printf "Time,CPU,RAM,Temp,Power\n" > "$HISTORY"
echo "✅ Daily stats saved for $DATE ($count samples). History reset."
