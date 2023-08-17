#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { FargateStack } from "../lib/stack";

const app = new cdk.App();
const version = process.env.VERSION ?? "1";

new FargateStack(app, "ecs-deployment-analysis", {
  version,
});
