import { ISecurityGroup, IVpc } from "aws-cdk-lib/aws-ec2";
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  IApplicationTargetGroup,
  ListenerAction,
  ListenerCondition,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";

type LoadBalancerProps = {
  vpc: IVpc;
  securityGroup: ISecurityGroup;
  targetGroups: IApplicationTargetGroup[];
  name: string;
};

export class AnalysisLoadBalancer extends Construct {
  constructor(scope: Construct, id: string, props: LoadBalancerProps) {
    super(scope, id);

    const { vpc, securityGroup, targetGroups, name } = props;

    const loadBalancer = new ApplicationLoadBalancer(this, "LoadBalancer", {
      vpc,
      securityGroup,
      loadBalancerName: name,
      internetFacing: false,
    });

    const listener = loadBalancer.addListener("Listener", {
      defaultAction: ListenerAction.fixedResponse(200, {
        messageBody: JSON.stringify({
          message: "ok",
        }),
      }),
      protocol: ApplicationProtocol.HTTP,
    });

    for (const { targetGroup, i } of targetGroups.map((targetGroup, i) => ({
      targetGroup,
      i,
    }))) {
      const priority = i + 1;
      listener.addTargetGroups(`TargetGroup${i}`, {
        targetGroups: [targetGroup],
        priority,
        conditions: [
          ListenerCondition.queryStrings([{ key: "i", value: `${priority}` }]),
        ],
      });
    }
  }
}
