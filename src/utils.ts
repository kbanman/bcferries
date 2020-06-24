import cheerio from 'cheerio'
import {AxiosResponse} from 'axios'

export const makeParams = (input: {}) => {
    const params = new URLSearchParams()
    for (let key in input) {
        // @ts-ignore
        params.set(key, input[key])
    }
    return params
}

export const extractViewState = (body: string): string => {
    const $ = cheerio.load(body)
    const vs = $('input[name="oracle.adf.faces.STATE_TOKEN"]').val()
    if (!vs) {
        console.log(body)
        throw new Error('No view state token found')
    }
    return vs
}

export const checkForError = (res: AxiosResponse) => {
    if (res.status != 200 || (res.data as string).includes('MISSING TERMINAL')) {
        throw new Error('Page error!')
    }
    return res
}
const TIME_PATTERN = /(\d+):(\d+) (A|P)M/
export const parseTime = (time: string): [number, number] => {
    const matches = TIME_PATTERN.exec(time)
    if (!matches) {
        throw new Error('Invalid time ' + time)
    }
    const [_, h, m, ap] = matches
    let hour = parseInt(h, 10)
    const minute = parseInt(m, 10)
    const pm = ap === 'P'
    if (hour < 12 && pm) {
        hour += 12
    }
    return [hour, minute]
}
