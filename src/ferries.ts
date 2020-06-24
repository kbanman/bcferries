import axios, {AxiosInstance, AxiosRequestConfig} from 'axios'
import axiosCookieJarSupport from 'axios-cookiejar-support'
import {CookieJar} from 'tough-cookie'
import cheerio from 'cheerio'
import moment from 'moment'
import {checkForError, extractViewState, makeParams} from "./utils";

const DATE_FORMAT = 'MMMM D, YYYY'

enum TripType { RoundTrip = 0, OneWay = 1 }

interface SailingInput {
    departureDate: Date
    returnDate?: Date
    passengers: number
}

interface Sailing {
    depart: string // 9:20 AM
    arrive: string
    vessel: string
    maxHeight: string
    status: string // 'Select & Continue' | 'Full-Standby Only'
}

export class BCFerries {
    private readonly api: AxiosInstance
    private readonly cookies: CookieJar

    constructor(config?: AxiosRequestConfig) {
        this.cookies = new CookieJar()
        this.api = axios.create({
            baseURL: 'https://www.bcferries.com/bcferries/faces',
            withCredentials: true,
            ...config,
            jar: this.cookies,
        })
        axiosCookieJarSupport(this.api)
    }

    private reservationInput(input: any) {
        return this.api.post('/reservation/reservations.jsp', input, {
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        }).then(checkForError)
    }

    findSailings(input: SailingInput): Promise<Sailing[]> {
        const departureDate = moment(input.departureDate).format(DATE_FORMAT)
        const returnDate = input.returnDate ? moment(input.returnDate).format(DATE_FORMAT) : undefined
        return this.api.get('/reservation/reservations.jsp')
            .then(res => {
                const stateToken = extractViewState(res.data)
                return this.reservationInput(setRoundTrip(stateToken))
            })
            .then(res => {
                const stateToken = extractViewState(res.data)
                const inp = setDepartureDate(departureDate, stateToken)
                return this.reservationInput(inp)
            })
            .then(res => {
                if (!returnDate) {
                    return res
                }
                const stateToken = extractViewState(res.data)
                const inp = setReturnDate(departureDate, returnDate, stateToken)
                return this.reservationInput(inp)
            })
            .then(res => {
                const stateToken = extractViewState(res.data)
                const inp = setDepartureTerminal(stateToken, departureDate, returnDate)
                return this.reservationInput(inp)
            })
            .then(res => {
                const stateToken = extractViewState(res.data)
                const inp = setDestinationTerminal(stateToken, departureDate, returnDate)
                return this.reservationInput(inp)
            })
            .then(res => {
                const stateToken = extractViewState(res.data)
                const inp = moveToPassengerDetails(stateToken, departureDate, returnDate)
                return this.reservationInput(inp)
            })
            .then(res => {
                const stateToken = extractViewState(res.data)
                const inp = setPassengers(stateToken, input.passengers)
                return this.reservationInput(inp)
            })
            .then(res => {
                const stateToken = extractViewState(res.data)
                const inp = setVehicle(stateToken)
                return this.reservationInput(inp)
            })
            .then(res => {
                const stateToken = extractViewState(res.data)
                const inp = continueFromVehicle(stateToken)
                return this.reservationInput(inp)
            })
            .then(res => {
                const $ = cheerio.load(res.data)
                const sailings: Sailing[] = []
                $('.sai_div_sailings_row_outer').each((_, el) => {
                    sailings.push({
                        depart: $('.sai_col_depart', el).text(),
                        arrive: $('.sai_col_arrive', el).text(),
                        vessel: $('.sai_col_vessel', el).text(),
                        maxHeight: $('.sai_col_maxheight', el).text(),
                        status: $('.sai_col_select', el).text(),
                    })
                })
                return sailings
            })
    }
}

const baseInput = (stateToken: string, departureDate: string, returnDate?: string) => {
    const input = {
        'centerRegion:dateDestination:roundTrip': 0,
        'centerRegion:dateDestination:departureDateDisplay': departureDate,
        'centerRegion:dateDestination:departureDate': departureDate,
        'centerRegion:dateDestination:dept_click_proxy': '',
        'centerRegion:dateDestination:dest_click_proxy': '',
        inProgress: true,
        'oracle.adf.faces.FORM': 'resForm',
        'oracle.adf.faces.STATE_TOKEN': stateToken,
        event: 'update',
        partial: true,
    }
    if (returnDate) {
        Object.assign(input, {
            'centerRegion:dateDestination:returnDateDisplay': returnDate,
            'centerRegion:dateDestination:returnDate': returnDate,
        })
    }
    return input
}

function setRoundTrip(stateToken: string) {
    return makeParams({
        ...baseInput(stateToken, moment().format(DATE_FORMAT)),
        source: 'centerRegion:dateDestination:roundTrip',
        event: 'centerRegion:dateDestination:roundTrip',
    })
}

function setDepartureDate(departureDate: string, stateToken: string) {
    return makeParams({
        ...baseInput(stateToken, departureDate, moment().format(DATE_FORMAT)),
        source: 'centerRegion:dateDestination:departureDateDisplay',
        event: 'centerRegion:dateDestination:departureDateDisplay',
    })
}

function setReturnDate(departureDate: string, returnDate: string, stateToken: string) {
    return makeParams({
        ...baseInput(stateToken, departureDate, returnDate),
        source: 'centerRegion:dateDestination:returnDateDisplay',
        event: 'centerRegion:dateDestination:returnDateDisplay',
    })
}

function setDepartureTerminal(stateToken: string, departureDate: string, returnDate?: string) {
    return makeParams({
        ...baseInput(stateToken, departureDate, returnDate),
        'centerRegion:dateDestination:dept_click_proxy': '0.2254259792216966',
        source: 'centerRegion:dateDestination:iter_regionId:0:iter_terminalId:0:lnk_dep_locname',
        event: 'update',
    })
}

function setDestinationTerminal(stateToken: string, departureDate: string, returnDate?: string) {
    return makeParams({
        ...baseInput(stateToken, departureDate, returnDate),
        'centerRegion:dateDestination:dept_click_proxy': '0.2254259792216966',
        'centerRegion:dateDestination:dest_click_proxy': '0.9773169822997672',
        source: 'centerRegion:dateDestination:iter_arrivalRegion:1:iter_arrivalTerminal:0:_id176',
        event: 'update',
    })
}

function moveToPassengerDetails(stateToken: string, departureDate: string, returnDate?: string) {
    return makeParams({
        ...baseInput(stateToken, departureDate, returnDate),
        source: 'centerRegion:dateDestination:ContinueFromDateDestination',
        event: 'update',
    })
}

function setPassengers(stateToken: string, passengers: number) {
    return makeParams({
        'oracle.adf.faces.FORM': 'resForm',
        'oracle.adf.faces.STATE_TOKEN': stateToken,
        'centerRegion:passengers:passIterBaseOutbound:0:selectOnePassengerCountTop': passengers,
        'centerRegion:passengers:passIterBaseOutbound:1:selectOnePassengerCountTop': 0,
        'centerRegion:passengers:passIterBaseOutbound:2:selectOnePassengerCountTop': 0,
        'centerRegion:passengers:passIterBaseOutbound:3:selectOnePassengerCountTop': 0,
        source: 'centerRegion:passengers:ContinueFromPassengers',
        event: 'update',
        partial: true,
    })
}

function setVehicle(stateToken: string) {
    return makeParams({
        'oracle.adf.faces.FORM': 'resForm',
        'oracle.adf.faces.STATE_TOKEN': stateToken,
        'centerRegion:vehicle:veh_program_std': 'true',
        'centerRegion:vehicle:so_fareType_value': 0,
        'centerRegion:vehicle:so_lengthOver20_option': 0,
        'centerRegion:vehicle:so_lengthOver20_value': '',
        source: 'centerRegion:vehicle:veh_button_submit_track_proxy',
        event: 'update',
        partial: true,
    })
}

function continueFromVehicle(stateToken: string) {
    return makeParams({
        'oracle.adf.faces.FORM': 'resForm',
        'oracle.adf.faces.STATE_TOKEN': stateToken,
        'centerRegion:vehicle:veh_program_std': 'true',
        'centerRegion:vehicle:so_fareType_value': 0,
        'centerRegion:vehicle:so_lengthOver20_option': 0,
        'centerRegion:vehicle:so_lengthOver20_value': '',
        source: 'centerRegion:vehicle:ContinueFromVehicle',
        event: 'update',
        partial: true,
    })
}
