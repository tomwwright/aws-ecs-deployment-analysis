#!/bin/bash

groups=$(aws elbv2 describe-target-groups | jq -r '.TargetGroups[] | select(.TargetType == "ip") | [ .TargetGroupArn, .TargetGroupName, .HealthCheckEnabled, .HealthCheckIntervalSeconds, .HealthyThresholdCount ] | join(",")')

echo "arn,name,enabled,interval,count,delay"

while read -r group
do 
  arn=$(echo $group | cut -f1 -d ',')

  # aws api requires that attributes are queried for individually, ugh
  delay=$(aws elbv2 describe-target-group-attributes --target-group-arn $arn | jq -r '.Attributes[] | select(.Key == "deregistration_delay.timeout_seconds") | .Value')

  echo "$group,$delay"
done <<<"$groups"
