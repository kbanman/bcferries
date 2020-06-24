import {AWSError} from 'aws-sdk'
import {ScheduledEvent} from 'aws-lambda'
import SNS from 'aws-sdk/clients/sns'
import CloudWatchEvents from 'aws-sdk/clients/cloudwatchevents'
import {BCFerries} from './ferries'
import {parseTime} from './utils'

const ferries = new BCFerries()
const sns = new SNS()

async function disableEvent() {
    const events = new CloudWatchEvents()
    return events.disableRule({Name: process.env.EVENT_RULE_NAME!}).promise()
}

async function sendSMS(message: string) {
    return sns.publish({
        PhoneNumber: process.env.PHONE_NUMBER,
        Message: message,
    }).promise()
}

export async function handler(event: ScheduledEvent, context: any) {
    await ferries.findSailings({
        departureDate: new Date(2020, 5, 26),
        returnDate: new Date(2020, 5, 28),
        passengers: 2,
    })
        .then(sailings => {
            console.log(sailings)
            const acceptable = sailings
                .filter(s => {
                    const [hour] = parseTime(s.depart)
                    return hour > 14 && !s.status.includes('Full')
                })
            if (acceptable.length > 0) {
                console.log(acceptable)
                sendSMS('BC Ferries has reservations!').then(() => {
                    return disableEvent()
                        .then(() => console.log('Disabled event'))
                        .catch(err => console.log('Failed to disable event', err))
                })
            }
        })
        .catch((err: AWSError) => {
            console.log('SADPANDA', err)
            return sendSMS('BCFerries error: ' + err.message)
        })
}
