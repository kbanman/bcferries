import {Construct, Duration, Stack, StackProps} from '@aws-cdk/core';
import {Code, Function, Runtime} from '@aws-cdk/aws-lambda'
import {Policy, PolicyStatement} from '@aws-cdk/aws-iam'
import {Rule, Schedule} from '@aws-cdk/aws-events'
import {LambdaFunction} from '@aws-cdk/aws-events-targets'

export class CdkStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const eventRuleName = 'trigger-ferries-checker-lambda'

        const lambda = new Function(this, 'Fn', {
            runtime: Runtime.NODEJS_12_X,
            code: Code.fromAsset('../build'),
            handler: 'index.handler',
            timeout: Duration.minutes(1),
            environment: {
                EVENT_RULE_NAME: eventRuleName,
                PHONE_NUMBER: this.node.tryGetContext('phoneNumber'),
            }
        })

        new Policy(this, 'lambdaAllowSns', {
            statements: [

                new PolicyStatement({
                    actions: ['sns:Publish'],
                    resources: ['*'],
                }),
                new PolicyStatement({
                    actions: ['events:*'],
                    resources: ['*'],
                }),
                new PolicyStatement({
                    actions: ['iam:passRole'],
                    resources: ['*'],
                })
            ],
        }).attachToRole(lambda.role!)

        const eventRule = new Rule(this, 'eventRule', {
            ruleName: eventRuleName,
            schedule: Schedule.expression('rate(5 minutes)'),
            enabled: true,
        })
        eventRule.addTarget(new LambdaFunction(lambda))
    }
}
