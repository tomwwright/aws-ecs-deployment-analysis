#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { FargateStack } from "../lib/stack";
import { HotswapStack } from "../lib/hotswap-stack";

const app = new cdk.App();
const version = process.env.VERSION ?? "1";

new FargateStack(app, "ecs-deployment-analysis", {
  version,
});

new HotswapStack(app, "ecs-deployment-analysis-hotswap", {
  version,
});
