#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { Mp4mp3Stack } from '../lib/mp4mp3-stack.js';

const app = new cdk.App();
new Mp4mp3Stack(app, 'Mp4mp3Stack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
