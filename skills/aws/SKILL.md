---
name: aws
description: Manage AWS resources via the aws CLI. Use when managing S3, EC2, Lambda, or other AWS services.
metadata:
  category: cloud
  dependencies:
    cli: aws
    checkCommand: aws --version
    install:
      darwin: { brew: awscli }
      linux: { pip: awscli }
      windows: { winget: Amazon.AWSCLI, choco: awscli, scoop: aws }
  config:
    - name: AWS_DEFAULT_REGION
      label: Default Region
      type: string
      required: false
  auth:
    type: api-key
    setupCommand: aws configure
---

# AWS CLI

Use `aws` to interact with Amazon Web Services.

## Common Commands

### S3
- List buckets: `aws s3 ls`
- List objects: `aws s3 ls s3://<bucket-name>`
- Copy file: `aws s3 cp <source> <destination>`
- Sync directory: `aws s3 sync <local-dir> s3://<bucket-name>/path`

### EC2
- List instances: `aws ec2 describe-instances`
- Start instance: `aws ec2 start-instances --instance-ids <id>`
- Stop instance: `aws ec2 stop-instances --instance-ids <id>`

### Lambda
- List functions: `aws lambda list-functions`
- Invoke function: `aws lambda invoke --function-name <name> output.json`

## Notes
- Requires `aws` CLI installed and configured via `aws configure`
- Default profile from `~/.aws/config` unless `AWS_PROFILE` is set
