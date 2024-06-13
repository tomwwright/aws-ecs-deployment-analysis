#!/bin/bash

# cutoff date provided as argument
cutoff=$1

# list recently updated stacks
stacks=$(aws cloudformation list-stacks --query "StackSummaries[?LastUpdatedTime > \`$cutoff\` && starts_with(StackStatus, \`UPDATE\`)].StackName" | jq -r '.[]' | grep -v 'cdk-deploy-roles' | sort)

echo "Inspecting these stacks:"
echo $stacks | xargs -n 1 echo

# print headers
echo ""
echo "stack,changeSetId,elapsed,createdAt,updatedAt"

while read -r stack_name
do
  # retrieve stack info
  stack=$(aws cloudformation describe-stacks --stack-name $stack_name)
  change_set_id=$(echo $stack | jq -r '.Stacks[0].ChangeSetId')
  updated_at=$(echo $stack | jq -r '.Stacks[0].LastUpdatedTime' | sed 's/\..*//')

  if [ "$change_set_id" != "null" ]; then
    # retrieve change set info
    created_at=$(aws cloudformation describe-change-set --change-set-name $change_set_id | jq -r '.CreationTime' | sed 's/\..*//')

    # convert to seconds
    created_at_seconds=$(date -j -f "%Y-%m-%dT%H:%M:%S" $created_at +'%s')
    updated_at_seconds=$(date -j -f "%Y-%m-%dT%H:%M:%S" $updated_at +'%s')
    elapsed_seconds="$(($updated_at_seconds - $created_at_seconds))"

    # print record
    echo "$stack_name,$change_set_id,$elapsed_seconds,$created_at,$updated_at"
  fi
done <<<"$stacks"