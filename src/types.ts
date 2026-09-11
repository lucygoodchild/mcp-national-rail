export interface Config {
    RTT_API_TOKEN: string;
    RTT_API_VERSION?: string;
}

export interface SystemStatus {
    realtimeNetworkRail?: string;
    rttCore?: string;
}

export interface GeographicLocation {
    namespace?: string;
    description?: string;
    shortCodes?: string[];
    longCodes?: string[];
}

export interface IndividualTemporalData {
    scheduleInternal?: string;
    scheduleAdvertised?: string;
    realtimeForecast?: string;
    realtimeEstimate?: string;
    realtimeActual?: string;
    realtimeNoReport?: boolean;
    realtimeInternalLateness?: number;
    realtimeAdvertisedLateness?: number;
    isCancelled?: boolean;
    cancellationReasonCode?: string;
}

export interface LocationTemporalData {
    arrival?: IndividualTemporalData;
    departure?: IndividualTemporalData;
    pass?: IndividualTemporalData;
    scheduledCallType?: string | null;
    realtimeCallType?: string | null;
    displayAs?: string | null;
    status?: string | null;
    isInterpolated?: boolean;
}

export interface PlannedActualData {
    planned?: string;
    forecast?: string;
    actual?: string;
}

export interface NetworkRailLocationMetadata {
    platform?: PlannedActualData;
    line?: PlannedActualData;
    path?: PlannedActualData;
    numberOfVehicles?: number;
    allocationIndex?: number;
    isRequestStop?: boolean;
    stockBranding?: string;
}

export interface ScheduleMetadata {
    uniqueIdentity?: string;
    namespace?: string;
    identity?: string;
    departureDate?: string;
    operator?: { code?: string; name?: string };
    modeType?: string;
    inPassengerService?: boolean;
    trainReportingIdentity?: string;
    stpIndicator?: string;
    runsAsRequired?: boolean;
}

export interface LocationPair {
    location?: GeographicLocation;
    temporalData?: IndividualTemporalData;
}

export interface ReasonBlock {
    type?: string;
    code?: string;
    system?: string;
    shortText?: string;
    longText?: string | null;
}

export interface NetworkRailLocationLineUpObject {
    temporalData?: LocationTemporalData;
    locationMetadata?: NetworkRailLocationMetadata;
    reasons?: ReasonBlock[];
    origin?: LocationPair[];
    destination?: LocationPair[];
    scheduleMetadata?: ScheduleMetadata;
}

export interface NetworkRailServiceLocation {
    temporalData?: LocationTemporalData;
    locationMetadata?: NetworkRailLocationMetadata;
    location?: GeographicLocation;
}

export interface LocationResponse {
    systemStatus?: SystemStatus;
    query?: { location?: GeographicLocation; timeFrom?: string; timeTo?: string };
    reasons?: ReasonBlock[];
    services?: NetworkRailLocationLineUpObject[];
}

export interface ServiceResponse {
    systemStatus?: SystemStatus;
    query?: { uniqueIdentity?: string };
    service?: {
        scheduleMetadata?: ScheduleMetadata;
        locations?: NetworkRailServiceLocation[];
        allocationData?: Allocation[];
        origin?: LocationPair[];
        destination?: LocationPair[];
        reasons?: ReasonBlock[];
    };
}

export interface AllocationItem {
    stockType?: string;
    identity?: string;
    identitySuppressed?: boolean;
    numberOfVehicles?: number;
    inReverse?: boolean;
    componentVehicles?: Array<{
        identity?: string;
        isPassengerVehicle?: boolean;
        isLocomotive?: boolean;
        index?: number;
    }>;
}

export interface Allocation {
    allocationIndex?: number;
    leadingClass?: string;
    passengerVehicles?: number;
    allocationItems?: AllocationItem[];
    attached?: LocationPair;
    detached?: LocationPair;
    service?: ScheduleMetadata;
}

export interface AllocationsByServiceResponse {
    systemStatus?: SystemStatus;
    query?: { departureDate?: string; toc?: string };
    services?: Array<{
        scheduleMetadata?: ScheduleMetadata;
        origin?: LocationPair[];
        destination?: LocationPair[];
        allocations?: Allocation[];
    }>;
}

export interface AllocationsByClassResponse {
    systemStatus?: SystemStatus;
    query?: { departureDate?: string; class?: string };
    identities?: Record<string, Allocation[]>;
}
