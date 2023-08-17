#!/bin/sh

# cutoff date provided as argument
cutoff=$1

# print headers
echo "timestamp,serviceArn,message"

# list recently updated stacks that may contain ECS services
stacks=$(aws cloudformation list-stacks --query "StackSummaries[?LastUpdatedTime > \`$cutoff\`].StackId" | jq -r '.[]' | grep -v "cdk-deploy-roles" | grep -v "cdk-source-security-groups" | grep -v "migrations" | grep -v "db" | grep -v "data") 

while read -r stack
do
  # retrieve any ECS Services from stack resources
  services=$(aws cloudformation list-stack-resources --stack-name $stack | jq -r '.StackResourceSummaries[] | select(.ResourceType == "AWS::ECS::Service") | [.LogicalResourceId,.PhysicalResourceId] | join(",")')

  if [ -n "$services" ]; then
    while read -r service
    do
      id=$(echo $service | cut -f1 -d ',')
      arn=$(echo $service | cut -f2 -d ',')

      # retrieve deployment events from cloudformation for service
      # assume that 200 items will be enough -- paginating this for old stacks takes forever
      cloudformation=$(aws cloudformation describe-stack-events --stack-name $stack --max-items 400 --query "StackEvents[?Timestamp > \`$cutoff\`]" | jq -r ".[] | select(.LogicalResourceId == \"$id\" and (.ResourceStatus == \"UPDATE_IN_PROGRESS\" or .ResourceStatus == \"UPDATE_COMPLETE\"  or .ResourceStatus == \"UPDATE_FAILED\")) | [.Timestamp, .PhysicalResourceId, .ResourceStatus] | join(\",\")")

      # retrieve deployment events from ecs for service
      cluster=$(echo $arn | cut -f2 -d '/')
      ecs=$(aws ecs describe-services --cluster $cluster --services $arn | jq -r ".services[] | .events[] | select(.message | contains(\"started\") or contains(\"registered\") or contains(\"stopped\") or contains(\"complete\")) | [.createdAt, \"$arn\", .message] | join(\",\")")
      
      echo "$cloudformation"
      echo "$ecs"
    done <<<"$services"
  fi
done <<<"$stacks"