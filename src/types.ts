// Type definitions based on the API documentation
interface LocationDetail {
    name: string;
    crs: string;
    tiploc: string | string[];
    country?: string;
    system?: string;
}

interface Pair {
    tiploc: string;
    description: string;
    workingTime: string;
    publicTime: string;
}

interface Location {
    realtimeActivated: boolean;
    tiploc: string;
    crs: string;
    description: string;
    wttBookedArrival?: string;
    wttBookedDeparture?: string;
    gbttBookedArrival?: string;
    gbttBookedDeparture?: string;
    origin: Pair[];
    destination: Pair[];
    isCall: boolean;
    isPublicCall: boolean;
    realtimeArrival?: string;
    realtimeArrivalActual: boolean;
    realtimeDeparture?: string;
    realtimeDepartureActual: boolean;
    realtimeGbttDepartureLateness?: number;
    realtimeGbttArrivalLateness?: number;
    platform?: string;
    platformConfirmed: boolean;
    platformChanged: boolean;
    displayAs: string;
    cancelReasonShortText?: string;
    serviceLocation?: string;
}

export interface LocationContainer {
    locationDetail: Location;
    serviceUid: string;
    runDate: string;
    trainIdentity: string;
    runningIdentity: string;
    atocCode: string;
    atocName: string;
    serviceType: string;
    isPassenger: boolean;
    countdownMinutes?: number;
}

export interface ApiResponse {
    location: LocationDetail;
   filter: {
        origin?: LocationDetail;
        destination?: LocationDetail;
    } | null;
    services: LocationContainer[] | null;
}

export interface Config {
    RTT_API_USERNAME: string;
    RTT_API_PASSWORD: string;
}