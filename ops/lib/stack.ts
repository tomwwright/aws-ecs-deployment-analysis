import * as cdk from "aws-cdk-lib";
import { Cluster } from "aws-cdk-lib/aws-ecs";
import { IApplicationTargetGroup } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";
import { AnalysisFargateService } from "./service";
import { SecurityGroup } from "aws-cdk-lib/aws-ec2";
import { AnalysisLoadBalancer } from "./loadbalancer";

interface FargateStackProps extends cdk.StackProps {
  version: string;
}

export class FargateStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FargateStackProps) {
    super(scope, id, props);

    const cluster = new Cluster(this, "Cluster", {
      clusterName: id,
    });

    const { vpc } = cluster;

    const securityGroup = new SecurityGroup(this, "SecurityGroup", {
      vpc,
    });

    const healthCheckIntervalConfigs = Object.entries({
      nolb: undefined,
      fastlb: 10,
      slowlb: 30,
    });
    const safeDeploymentConfigs = Object.entries({
      safe: true,
      unsafe: false,
    });
    const dockerHealthCheckConfigs = Object.entries({
      checks: true,
      nochecks: false,
    });
    const startupDelayConfigs = Object.entries({
      fastup: 1000,
      midup: 5000,
      slowup: 30000,
    });

    const configurations = [];

    for (const [
      useDockerHealthCheckName,
      useDockerHealthCheck,
    ] of dockerHealthCheckConfigs) {
      for (const [
        healthCheckIntervalName,
        healthCheckInterval,
      ] of healthCheckIntervalConfigs) {
        for (const [
          useSafeDeploymentName,
          useSafeDeployment,
        ] of safeDeploymentConfigs) {
          for (const [startupDelayName, startupDelay] of startupDelayConfigs) {
            const name = [
              "analyse",
              useSafeDeploymentName,
              useDockerHealthCheckName,
              healthCheckIntervalName,
              startupDelayName,
            ].join("-");

            configurations.push({
              name,
              healthCheckInterval,
              useSafeDeployment,
              useDockerHealthCheck,
              startupDelay,
              version: props.version,
            });
          }
        }
      }
    }

    const targetGroups: IApplicationTargetGroup[] = [];
    for (const configuration of configurations) {
      const { targetGroup } = new AnalysisFargateService(
        this,
        configuration.name,
        {
          cluster,
          securityGroup,
          ...configuration,
        }
      );

      if (targetGroup) {
        targetGroups.push(targetGroup);
      }
    }

    new AnalysisLoadBalancer(this, "LoadBalancer", {
      vpc,
      securityGroup,
      targetGroups,
      name: id,
    });
  }
}
