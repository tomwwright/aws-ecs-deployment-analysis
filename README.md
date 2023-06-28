# aws-ecs-deployment-analysis

Analysing timings of ECS Services deployments via CloudFormation

## Setup 

```sh
pnpm install
```

## Produce data files

Query target group health check and deregistration configuration

```sh
./script/describe-target-group-health-checks.sh | tee data/target-groups.csv
```

Query ECS service deployment configuration

```sh
./script/describe-ecs-service-deploy-config.sh | tee data/ecs-services.csv
```

Query CloudFormation and ECS deployment events (this takes a long time)

```sh
cutoff="2023-06=19"
./script/describe-ecs-deploy-events.sh $cutoff | tee data/deploy-events-$cutoff.csv
```

Capture ECS Task state change events into a CloudWatch Log Group with EventBridge rule

```
{
  "source": ["aws.ecs"],
  "detail-type": ["ECS Task State Change"]
}
```

Query started task events using following CloudWatch Log Insights query and save in `data/started-tasks.csv`

```
fields detail.taskArn, detail.group, detail.createdAt, detail.connectivityAt, detail.pullStartedAt, detail.pullStoppedAt, detail.startedAt, detail.cpu, detail.memory, detail.attributes.0.value as arch, strcontains(concat(detail.attachments.0.type,detail.attachments.1.type) , "elb") as hasELB 
| filter detail.lastStatus = "RUNNING"
and detail.desiredStatus = "RUNNING"
and detail.group like /service:/
and detail.launchType = "FARGATE"
| sort @timestamp desc
| limit 5000
| dedup detail.taskArn
```

Query stopped task events using following CloudWatch Log Insights query and save in `data/stopped-tasks.csv`

```
fields detail.taskArn, detail.group, detail.stoppingAt, detail.executionStoppedAt, detail.stoppedAt, detail.cpu, detail.memory, detail.attributes.0.value as arch, strcontains(concat(detail.attachments.0.type,detail.attachments.1.type) , "elb") as hasELB 
| filter detail.lastStatus = "STOPPED"
and detail.desiredStatus = "STOPPED"
and detail.stopCode	= "ServiceSchedulerInitiated"
and detail.group like /service:/
and detail.launchType = "FARGATE"
| sort @timestamp desc
| limit 5000
| dedup detail.taskArn
```

## Produce timelines

To produce timelines you need to have in `data` directory the following input `.csv` files:
- `deploy-events-${cutoff}.csv`
- `started-tasks.csv`
- `stopped-tasks.csv`

Run TypeScript to produce timelines `.csv` data

```sh
cutoff="2023-06-19"
pnpm ts-node src/process.ts $cutoff > data/timelines-$cutoff.csv
```
