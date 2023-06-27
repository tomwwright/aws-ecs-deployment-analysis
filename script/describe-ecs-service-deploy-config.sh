#!/bin/bash

clusters=$(aws ecs list-clusters | jq -r '.clusterArns[]')

echo "clusterArn,serviceArn,desiredCount,minimumPercent,maximumPercent"

while read -r cluster
do
  services=$(aws ecs list-services --cluster $cluster | jq -r '.serviceArns[]')
  echo $services | xargs -n 10 aws ecs describe-services --cluster $cluster --services | jq -r '.services[] | [.clusterArn, .serviceArn, .desiredCount, .deploymentConfiguration.minimumHealthyPercent, .deploymentConfiguration.maximumPercent] | join(",")'
done <<<"$clusters"