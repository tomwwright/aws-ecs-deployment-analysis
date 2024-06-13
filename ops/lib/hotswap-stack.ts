import * as cdk from "aws-cdk-lib";
import { Cluster } from "aws-cdk-lib/aws-ecs";
import { Construct } from "constructs";
import { AnalysisFargateService } from "./service";
import { Vpc, SubnetType, SecurityGroup } from "aws-cdk-lib/aws-ec2";

interface FargateStackProps extends cdk.StackProps {
  version: string;
}

export class HotswapStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FargateStackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, "Vpc", {
      natGateways: 0, // NATs have an hourly cost
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "Public",
          subnetType: SubnetType.PUBLIC,
        },
      ],
      maxAzs: 1,
    });

    const cluster = new Cluster(this, "Cluster", {
      clusterName: id,
      vpc,
    });

    const securityGroup = new SecurityGroup(this, "SecurityGroup", {
      vpc,
    });

    new AnalysisFargateService(this, "Service", {
      cluster,
      securityGroup,
      useSafeDeployment: false,
      useDockerHealthCheck: true,
      useArmArchitecture: false,
      version: props.version,
      startupDelay: 0,
      assignPublicIp: true,
    });
  }
}
