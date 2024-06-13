import { Duration } from "aws-cdk-lib";
import { ISecurityGroup } from "aws-cdk-lib/aws-ec2";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import {
  ContainerImage,
  CpuArchitecture,
  FargateService,
  FargateTaskDefinition,
  ICluster,
  LinuxParameters,
} from "aws-cdk-lib/aws-ecs";
import {
  ApplicationProtocol,
  ApplicationTargetGroup,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";

type FargateServiceProps = {
  cluster: ICluster;
  securityGroup: ISecurityGroup;
  useDockerHealthCheck: boolean;
  healthCheckInterval?: number;
  useSafeDeployment: boolean;
  startupDelay: number;
  useArmArchitecture: boolean;
  assignPublicIp?: boolean;
  version: string;
};

export class AnalysisFargateService extends Construct {
  public readonly targetGroup: ApplicationTargetGroup;
  constructor(scope: Construct, id: string, props: FargateServiceProps) {
    super(scope, id);

    const {
      cluster,
      healthCheckInterval,
      securityGroup,
      startupDelay,
      useArmArchitecture,
      useDockerHealthCheck,
      useSafeDeployment,
      version,
    } = props;

    const taskDefinition = new FargateTaskDefinition(this, "TaskDefinition", {
      runtimePlatform: {
        cpuArchitecture: useArmArchitecture
          ? CpuArchitecture.ARM64
          : CpuArchitecture.X86_64,
      },
    });
    taskDefinition.addContainer("expressjs", {
      image: ContainerImage.fromAsset("docker", {
        platform: useArmArchitecture
          ? Platform.LINUX_ARM64
          : Platform.LINUX_AMD64,
      }),
      portMappings: [
        {
          containerPort: 3000,
        },
      ],
      healthCheck: useDockerHealthCheck
        ? {
            command: ["CMD-SHELL", "curl -f http://localhost:3000/ || exit 1"],
            interval: Duration.seconds(5),
            timeout: Duration.seconds(2),
            startPeriod: Duration.millis(startupDelay),
          }
        : undefined,
      linuxParameters: new LinuxParameters(this, "LinuxParameters", {
        initProcessEnabled: true,
      }),
      environment: {
        SLEEP_MS: `${startupDelay}`,
        VERSION: version, // doesn't do anything except trigger deployments when changed
      },
    });

    const service = new FargateService(this, "Service", {
      cluster,
      taskDefinition,
      serviceName: id,
      securityGroups: [securityGroup],
      minHealthyPercent: useSafeDeployment ? 100 : 0,
      maxHealthyPercent: 200,
      assignPublicIp: props.assignPublicIp ?? false,
    });

    if (healthCheckInterval) {
      this.targetGroup = new ApplicationTargetGroup(this, "TargetGroup", {
        targets: [service],
        port: 3000,
        protocol: ApplicationProtocol.HTTP,
        vpc: cluster.vpc,
        healthCheck: {
          healthyThresholdCount: 2,
          timeout: Duration.seconds(2),
          interval: Duration.seconds(healthCheckInterval),
        },
      });
    }
  }
}
